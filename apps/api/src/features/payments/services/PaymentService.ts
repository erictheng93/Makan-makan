import { drizzle } from "drizzle-orm/d1";
import { and, eq, notInArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import {
  amountFromCents,
  orders,
  paymentTransactions,
  tables,
} from "@makanmakan/database";
import type { OrderStatus } from "@makanmakan/shared-types";
import type { Env } from "../../../types/env";
import type { AuthUser } from "../../../middleware/auth";
import { ApiError } from "../../../shared/utils/api-error";
import type { PaymentRequestInput } from "../schemas/validation";
import {
  PAYMENT_AUDIT_EVENT_TYPES,
  PaymentAuditService,
} from "../../billing/services/PaymentAuditService";
import {
  finalizeOrderStatusSideEffects,
  invalidateOrderCache,
} from "../../orders/services/order-finalization";

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
    orderId: string;
    orderStatus: string;
    paymentStatus: string;
    authorizedTotal: number;
  };
}

function cents(value: number): number {
  return Math.round(value * 100);
}

function jsonOrNull(value: unknown): unknown | null {
  return value === undefined ? null : value;
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

    const serverTotal = amountFromCents(existing.totalAmountCents) ?? 0;
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

    await this.db.batch([
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
      this.paymentAudit.buildAppendQuery(this.db, {
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
      this.paymentAudit.buildAppendQuery(this.db, {
        restaurantId: existing.restaurantId,
        paymentTransactionId: paymentId,
        eventType: PAYMENT_AUDIT_EVENT_TYPES.SUCCESS,
        provider: input.gateway ?? input.method ?? "internal",
        amount: cents(serverTotal),
        currency: options.currency ?? null,
        rawPayload: { status: "paid" },
        occurredAtMs: now,
      }),
    ] as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

    if (shouldCloseOrder) {
      try {
        await finalizeOrderStatusSideEffects({
          env: this.env,
          order: {
            id: existing.id,
            restaurantId: existing.restaurantId,
            orderNumber: existing.orderNumber,
          },
          previousStatus: existing.status as OrderStatus,
          newStatus: "paid",
          updatedBy: options.user?.id,
          updatedByRole: roleName(options.user?.role),
        });
      } catch (error) {
        console.error("Payment succeeded but order side effects failed", {
          orderId: existing.id,
          paymentId,
          error,
        });
      }
    } else {
      try {
        await invalidateOrderCache(this.env.CACHE_KV, input.orderId);
      } catch (error) {
        console.error("Payment succeeded but order cache invalidation failed", {
          orderId: input.orderId,
          paymentId,
          error,
        });
      }
    }

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
      orderId: string;
      restaurantId: string;
      amountCents: number;
      currency: string | null;
      countryCode: string | null;
      paymentMethod: string;
      gateway: string | null;
      idempotencyKey: string | null;
      customerInfo: unknown | null;
      metadata: unknown | null;
    },
    now: number,
  ) {
    const timestamp = new Date(now);

    return this.db.insert(paymentTransactions).values({
      transactionId: data.transactionId,
      orderId: data.orderId,
      restaurantId: data.restaurantId,
      amountCents: data.amountCents,
      currency: data.currency,
      countryCode: data.countryCode,
      paymentMethod: data.paymentMethod,
      gateway: data.gateway,
      status: "pending",
      idempotencyKey: data.idempotencyKey,
      customerInfo: data.customerInfo,
      metadata: data.metadata,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  private prepareOrderPaymentUpdate(
    orderId: string,
    paymentId: string,
    paymentMethod: string,
    shouldCloseOrder: boolean,
    now: number,
  ) {
    const paidAt = new Date(now);
    const updatedAt = new Date(now);
    const payableGuard = and(
      eq(orders.id, orderId),
      sql`COALESCE(${orders.paymentStatus}, 'pending') NOT IN ('paid', 'completed', 'refunded', 'partial_refunded')`,
      notInArray(orders.status, ["paid", "cancelled", "refunded"]),
    );

    if (shouldCloseOrder) {
      return this.db
        .update(orders)
        .set({
          status: "paid",
          paidAt,
          paymentStatus: "paid",
          paymentMethod,
          paymentTransactionId: paymentId,
          updatedAt,
        })
        .where(payableGuard);
    }

    return this.db
      .update(orders)
      .set({
        paymentStatus: "paid",
        paymentMethod,
        paymentTransactionId: paymentId,
        updatedAt,
      })
      .where(payableGuard);
  }

  private prepareCloseOrderSideEffects(
    tableId: number | null | undefined,
    shouldCloseOrder: boolean,
    now: number,
  ) {
    if (!shouldCloseOrder || !tableId) return [];

    return [
      this.db
        .update(tables)
        .set({
          isOccupied: false,
          currentOrderId: null,
          occupiedAt: null,
          occupiedBy: null,
          updatedAt: new Date(now),
        })
        .where(eq(tables.id, tableId)),
    ];
  }

  private preparePaymentTransactionStatusUpdate(
    transactionId: string,
    status: "paid" | "failed" | "cancelled",
    now: number,
  ) {
    const timestamp = new Date(now);

    return this.db
      .update(paymentTransactions)
      .set({
        status,
        updatedAt: timestamp,
        completedAt:
          status === "paid"
            ? timestamp
            : sql`${paymentTransactions.completedAt}`,
        failedAt:
          status === "failed"
            ? timestamp
            : sql`${paymentTransactions.failedAt}`,
      })
      .where(eq(paymentTransactions.transactionId, transactionId));
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

function roleName(role: number | undefined): string {
  switch (role) {
    case 0:
      return "admin";
    case 1:
      return "owner";
    case 4:
      return "cashier";
    default:
      return "system";
  }
}
