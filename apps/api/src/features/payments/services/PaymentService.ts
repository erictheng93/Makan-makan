import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { orders } from "@makanmakan/database";
import type { Env } from "../../../types/env";
import type { AuthUser } from "../../../middleware/auth";
import { ApiError } from "../../../shared/utils/api-error";
import type { PaymentRequestInput } from "../schemas/validation";

export interface ProcessPaymentOptions {
  gatewayFixture?: string | null;
  user?: AuthUser;
}

export interface ProcessPaymentResult {
  status: number;
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

    const serverTotal = Number(existing.totalAmount);
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

    if (options.gatewayFixture === "timeout") {
      await this.db
        .update(orders)
        .set({
          paymentStatus: "pending",
          paymentMethod: method,
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
}
