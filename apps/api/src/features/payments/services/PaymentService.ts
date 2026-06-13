import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { amountFromCents, orders } from "@makanmakan/database";
import type { Env } from "../../../types/env";
import type { AuthUser } from "../../../middleware/auth";
import { ApiError } from "../../../shared/utils/api-error";
import type { PaymentRequestInput } from "../schemas/validation";
import {
  PAYMENT_AUDIT_EVENT_TYPES,
  PaymentAuditService,
} from "../../billing/services/PaymentAuditService";

export interface ProcessPaymentOptions {
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
  private paymentAudit: PaymentAuditService;

  constructor(private readonly env: Env) {
    this.db = drizzle(env.DB);
    this.paymentAudit = new PaymentAuditService(env.DB);
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
      String(options.user.restaurantId) !== String(existing.restaurantId)
    ) {
      throw new ApiError("FORBIDDEN", "Access denied", 403);
    }

    if (options.user && !canProcessPayment(options.user.role)) {
      throw new ApiError("INSUFFICIENT_ROLE", "Insufficient permissions", 403);
    }

    if (isAlreadyFinalized(existing.status, existing.paymentStatus)) {
      throw new ApiError(
        "ORDER_NOT_PAYABLE",
        "Order is not in a payable state",
        409,
      );
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
    const shouldCloseOrder = input.closeOrder ?? true;
    const now = Date.now();

    const orderUpdate = this.prepareOrderPaymentUpdate(
      input.orderId,
      paymentId,
      method,
      shouldCloseOrder,
      now,
    );
    const orderUpdateResult = await orderUpdate.run();
    if (mutationChanges(orderUpdateResult) === 0) {
      throw new ApiError(
        "ORDER_NOT_PAYABLE",
        "Order is not in a payable state",
        409,
      );
    }

    await this.env.DB.batch([
      this.preparePaymentTransactionInsert(
        {
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
            ...((options.metadata as Record<string, unknown> | undefined) ??
              {}),
            paymentMode: input.paymentMode,
            closeOrder: shouldCloseOrder,
          }),
        },
        now,
      ),
      this.paymentAudit.prepareAppend({
        restaurantId: existing.restaurantId,
        paymentTransactionId: paymentId,
        eventType: PAYMENT_AUDIT_EVENT_TYPES.ATTEMPT,
        provider: input.gateway ?? input.method ?? "internal",
        amount: cents(serverTotal),
        currency: options.currency ?? null,
        rawPayload: {
          orderId: input.orderId,
          paymentMode: input.paymentMode,
          paymentMethod: method,
          gateway: input.gateway ?? input.method ?? null,
          idempotencyKey: options.idempotencyKey ?? null,
          closeOrder: shouldCloseOrder,
        },
        occurredAtMs: now,
      }),
      ...this.prepareCloseOrderSideEffects(
        existing.tableId,
        shouldCloseOrder,
        now,
      ),
      this.preparePaymentTransactionStatusUpdate(paymentId, "paid", now),
      this.paymentAudit.prepareAppend({
        restaurantId: existing.restaurantId,
        paymentTransactionId: paymentId,
        eventType: PAYMENT_AUDIT_EVENT_TYPES.SUCCESS,
        provider: input.gateway ?? input.method ?? "internal",
        amount: cents(serverTotal),
        currency: options.currency ?? null,
        rawPayload: { status: "paid" },
        occurredAtMs: now,
      }),
    ]);

    return {
      status: 200,
      data: {
        paymentId,
        orderId: input.orderId,
        orderStatus: shouldCloseOrder ? "paid" : existing.status,
        paymentStatus: "paid",
        authorizedTotal: serverTotal,
      },
    };
  }

  private preparePaymentTransactionInsert(
    data: {
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
    },
    now: number,
  ) {
    return this.env.DB.prepare(
      `INSERT INTO payment_transactions (
          transaction_id, order_id, restaurant_id, amount_cents, currency,
          country_code, payment_method, gateway, status, idempotency_key,
          customer_info, metadata, created_at_ms, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
    ).bind(
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
    );
  }

  private prepareOrderPaymentUpdate(
    orderId: number,
    paymentId: string,
    paymentMethod: string,
    shouldCloseOrder: boolean,
    now: number,
  ) {
    if (shouldCloseOrder) {
      return this.env.DB.prepare(
        `UPDATE orders
            SET status = 'paid',
                paid_at_ms = ?,
                payment_status = 'paid',
                payment_method = ?,
                payment_transaction_id = ?,
                updated_at_ms = ?
          WHERE id = ?
            AND COALESCE(payment_status, 'pending') NOT IN ('paid', 'completed', 'refunded', 'partial_refunded')
            AND status NOT IN ('paid', 'cancelled', 'refunded')`,
      ).bind(now, paymentMethod, paymentId, now, orderId);
    }

    return this.env.DB.prepare(
      `UPDATE orders
          SET payment_status = 'paid',
              payment_method = ?,
              payment_transaction_id = ?,
              updated_at_ms = ?
        WHERE id = ?
          AND COALESCE(payment_status, 'pending') NOT IN ('paid', 'completed', 'refunded', 'partial_refunded')
          AND status NOT IN ('paid', 'cancelled', 'refunded')`,
    ).bind(paymentMethod, paymentId, now, orderId);
  }

  private prepareCloseOrderSideEffects(
    tableId: number | null | undefined,
    shouldCloseOrder: boolean,
    now: number,
  ) {
    if (!shouldCloseOrder || !tableId) return [];

    return [
      this.env.DB.prepare(
        `UPDATE tables
            SET is_occupied = 0,
                current_order_id = NULL,
                occupied_at_ms = NULL,
                occupied_by = NULL,
                updated_at_ms = ?
          WHERE id = ?`,
      ).bind(now, tableId),
    ];
  }

  private preparePaymentTransactionStatusUpdate(
    transactionId: string,
    status: "paid" | "failed" | "cancelled",
    now: number,
  ) {
    return this.env.DB.prepare(
      `UPDATE payment_transactions
          SET status = ?,
              updated_at_ms = ?,
              completed_at_ms = CASE WHEN ? = 'paid' THEN ? ELSE completed_at_ms END,
              failed_at_ms = CASE WHEN ? = 'failed' THEN ? ELSE failed_at_ms END
        WHERE transaction_id = ?`,
    ).bind(status, now, status, now, status, now, transactionId);
  }
}

function canProcessPayment(role: number): boolean {
  return [0, 1, 4].includes(role);
}

function isAlreadyFinalized(
  orderStatus: string | null | undefined,
  paymentStatus: string | null | undefined,
): boolean {
  return (
    ["cancelled", "paid", "refunded"].includes(orderStatus ?? "") ||
    ["paid", "completed", "refunded", "partial_refunded"].includes(
      paymentStatus ?? "",
    )
  );
}

function mutationChanges(result: unknown): number {
  const meta = (result as { meta?: { changes?: unknown } } | null)?.meta;
  return typeof meta?.changes === "number" ? meta.changes : 0;
}
