import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { amountFromCents, orders } from "@makanmakan/database";
import type { Env } from "../../../types/env";
import type { AuthUser } from "../../../middleware/auth";
import { ApiError } from "../../../shared/utils/api-error";
import type { PaymentRequestInput } from "../schemas/validation";

export interface ProcessPaymentOptions {
  gatewayFixture?: string | null;
  user?: AuthUser;
  country?: string;
  currency?: string;
  idempotencyKey?: string;
  customerInfo?: unknown;
  metadata?: unknown;
}

export interface ProcessPaymentResult {
  status: 200 | 202;
  data: {
    paymentId: string;
    orderId: number;
    orderStatus: string;
    paymentStatus: string;
    authorizedTotal: number;
  };
}

function cents(value: number): number {
  return Math.round(value * 100);
}

function jsonOrNull(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

function assertSameAmount(
  actual: number,
  expected: number,
  code: string,
  message: string,
) {
  if (cents(actual) !== cents(expected)) {
    throw new ApiError(code, message, 409, {
      expected: Number(expected.toFixed(2)),
      actual: Number(actual.toFixed(2)),
    });
  }
}

export class PaymentService {
  private db;

  constructor(private readonly env: Env) {
    this.db = drizzle(env.DB);
  }

  async processPayment(
    input: PaymentRequestInput,
    options: ProcessPaymentOptions = {},
  ): Promise<ProcessPaymentResult> {
    const [existing] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (!existing) {
      throw new ApiError("ORDER_NOT_FOUND", "Order not found", 404);
    }

    if (
      options.user?.restaurantId &&
      options.user.role !== 0 &&
      options.user.restaurantId !== existing.restaurantId
    ) {
      throw new ApiError("FORBIDDEN", "Access denied", 403);
    }

    const serverTotal =
      amountFromCents(existing.totalAmountCents, existing.totalAmount) ?? 0;
    if (input.expectedTotal !== undefined) {
      assertSameAmount(
        input.expectedTotal,
        serverTotal,
        "PAYMENT_TOTAL_MISMATCH",
        "Expected total does not match authoritative order total",
      );
    }

    if (input.paymentMode === "partial") {
      const paidTotal = (input.payments ?? []).reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );
      assertSameAmount(
        paidTotal,
        serverTotal,
        "PARTIAL_PAYMENT_TOTAL_MISMATCH",
        "Partial payment amounts do not match order total",
      );
    } else {
      assertSameAmount(
        input.amount ?? 0,
        serverTotal,
        "PAYMENT_AMOUNT_MISMATCH",
        "Payment amount does not match order total",
      );
    }

    const paymentId = `pay_${input.orderId}_${Date.now()}`;
    const method =
      input.paymentMode === "partial"
        ? "split"
        : (input.method ?? input.gateway ?? "other");

    await this.recordPaymentTransaction({
      transactionId: paymentId,
      orderId: input.orderId,
      restaurantId: existing.restaurantId,
      amountCents: cents(serverTotal),
      currency: options.currency ?? null,
      countryCode: options.country ?? null,
      paymentMethod: method,
      gateway: input.gateway ?? input.method ?? null,
      idempotencyKey: options.idempotencyKey ?? null,
      customerInfo: jsonOrNull(options.customerInfo),
      metadata: jsonOrNull({
        ...((options.metadata as Record<string, unknown> | undefined) ?? {}),
        paymentMode: input.paymentMode,
        closeOrder: input.closeOrder ?? true,
        gatewayFixture: options.gatewayFixture ?? null,
      }),
    });

    if (options.gatewayFixture === "timeout") {
      await this.db
        .update(orders)
        .set({
          paymentStatus: "pending",
          paymentMethod: method,
          paymentTransactionId: paymentId,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      return {
        status: 202,
        data: {
          paymentId,
          orderId: input.orderId,
          orderStatus: existing.status,
          paymentStatus: "pending",
          authorizedTotal: serverTotal,
        },
      };
    }

    const shouldCloseOrder = input.closeOrder ?? true;
    const [updated] = await this.db
      .update(orders)
      .set({
        ...(shouldCloseOrder ? { status: "paid", paidAt: new Date() } : {}),
        paymentStatus: "paid",
        paymentMethod: method,
        paymentTransactionId: paymentId,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, input.orderId))
      .returning({
        status: orders.status,
        paymentStatus: orders.paymentStatus,
      });

    await this.updatePaymentTransactionStatus(paymentId, "paid");

    return {
      status: 200,
      data: {
        paymentId,
        orderId: input.orderId,
        orderStatus:
          updated?.status ?? (shouldCloseOrder ? "paid" : existing.status),
        paymentStatus: updated?.paymentStatus ?? "paid",
        authorizedTotal: serverTotal,
      },
    };
  }

  private async recordPaymentTransaction(data: {
    transactionId: string;
    orderId: number;
    restaurantId: string;
    amountCents: number;
    currency: string | null;
    countryCode: string | null;
    paymentMethod: string;
    gateway: string | null;
    idempotencyKey: string | null;
    customerInfo: string | null;
    metadata: string | null;
  }) {
    const now = Date.now();

    await this.env.DB.prepare(
      `INSERT INTO payment_transactions (
          transaction_id, order_id, restaurant_id, amount_cents, currency,
          country_code, payment_method, gateway, status, idempotency_key,
          customer_info, metadata, created_at_ms, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
    )
      .bind(
        data.transactionId,
        data.orderId,
        data.restaurantId,
        data.amountCents,
        data.currency,
        data.countryCode,
        data.paymentMethod,
        data.gateway,
        data.idempotencyKey,
        data.customerInfo,
        data.metadata,
        now,
        now,
      )
      .run();
  }

  private async updatePaymentTransactionStatus(
    transactionId: string,
    status: "paid" | "failed" | "cancelled",
  ) {
    const now = Date.now();

    await this.env.DB.prepare(
      `UPDATE payment_transactions
          SET status = ?,
              updated_at_ms = ?,
              completed_at_ms = CASE WHEN ? = 'paid' THEN ? ELSE completed_at_ms END,
              failed_at_ms = CASE WHEN ? = 'failed' THEN ? ELSE failed_at_ms END
        WHERE transaction_id = ?`,
    )
      .bind(status, now, status, now, status, now, transactionId)
      .run();
  }
}
