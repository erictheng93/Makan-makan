import { drizzle } from "drizzle-orm/d1";
import { and, eq, notInArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Env } from "../../../types/env";
import type { AuthUser } from "../../../middleware/auth";
import { ApiError } from "../../../shared/utils/api-error";
import {
  amountFromCents,
  orders,
  paymentTransactions,
  refundTransactions,
} from "@makanmakan/database";
import {
  PAYMENT_AUDIT_EVENT_TYPES,
  PaymentAuditService,
} from "../../billing/services/PaymentAuditService";

export interface RefundPaymentInput {
  transactionId: string;
  amount?: number;
  reason?: string;
}

export interface RefundPaymentResult {
  refundId: string;
  transactionId: string;
  orderId: number;
  amount: number;
  status: "completed";
  paymentStatus: "refunded" | "partial_refunded";
}

export interface RefundPaymentOptions {
  user?: AuthUser;
}

export async function refundPaymentTransaction(
  env: Env,
  input: RefundPaymentInput,
  options: RefundPaymentOptions = {},
): Promise<RefundPaymentResult> {
  assertAuthenticatedRefundUser(options.user);
  const db = drizzle(env.DB);

  const [row] = await db
    .select({
      id: orders.id,
      restaurantId: orders.restaurantId,
      totalAmount: orders.totalAmount,
      totalAmountCents: orders.totalAmountCents,
      refundAmount: orders.refundAmount,
      refundAmountCents: orders.refundAmountCents,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .where(eq(orders.paymentTransactionId, input.transactionId))
    .limit(1);

  if (!row) {
    throw new ApiError("TRANSACTION_NOT_FOUND", "Transaction not found", 404);
  }

  assertRefundAccess(options.user, row.restaurantId);

  if (
    ["pending", "failed", "cancelled", "refunded"].includes(
      row.paymentStatus ?? "",
    )
  ) {
    throw new ApiError(
      "PAYMENT_NOT_REFUNDABLE",
      "Payment is not in a refundable state",
      409,
    );
  }

  const paymentTotal =
    amountFromCents(row.totalAmountCents, row.totalAmount) ?? 0;
  const refundAmount = input.amount ?? paymentTotal;
  const currentRefundTotal =
    amountFromCents(row.refundAmountCents, row.refundAmount) ?? 0;
  const nextRefundTotal = currentRefundTotal + refundAmount;

  if (cents(nextRefundTotal) > cents(paymentTotal)) {
    throw new ApiError(
      "REFUND_AMOUNT_EXCEEDS_PAYMENT",
      "Refund amount exceeds payment total",
      409,
    );
  }

  const isFullRefund = cents(nextRefundTotal) >= cents(paymentTotal);
  const paymentStatus = isFullRefund ? "refunded" : "partial_refunded";
  const refundId = `ref_${input.transactionId}_${Date.now()}`;
  const now = Date.now();
  const timestamp = new Date(now);
  const refundAmountCents = cents(refundAmount);

  const currentRefundCentsSql = sql<number>`COALESCE(${orders.refundAmountCents}, ROUND(COALESCE(${orders.refundAmount}, 0) * 100))`;
  const totalAmountCentsSql = sql<number>`COALESCE(${orders.totalAmountCents}, ROUND(${orders.totalAmount} * 100))`;
  const updateResult = await db
    .update(orders)
    .set({
      paymentStatus,
      refundAmountCents: sql`${currentRefundCentsSql} + ${refundAmountCents}`,
      refundAmount: sql`(${currentRefundCentsSql} + ${refundAmountCents}) / 100.0`,
      status: isFullRefund ? "refunded" : sql`${orders.status}`,
      updatedAt: timestamp,
    })
    .where(
      and(
        eq(orders.id, row.id),
        eq(orders.paymentTransactionId, input.transactionId),
        notInArray(sql`COALESCE(${orders.paymentStatus}, '')`, [
          "pending",
          "failed",
          "cancelled",
          "refunded",
        ]),
        sql`${currentRefundCentsSql} + ${refundAmountCents} <= ${totalAmountCentsSql}`,
      ),
    )
    .run();

  if (mutationChanges(updateResult) === 0) {
    throw new ApiError(
      "REFUND_AMOUNT_EXCEEDS_PAYMENT",
      "Refund amount exceeds payment total",
      409,
    );
  }

  const paymentAudit = new PaymentAuditService(env.DB);
  await db.batch([
    preparePaymentLedgerForRefund(db, {
      transactionId: input.transactionId,
      orderId: row.id,
      restaurantId: row.restaurantId,
      amountCents: cents(paymentTotal),
      paymentMethod: row.paymentMethod ?? "unknown",
      status: toLedgerPaymentStatus(row.paymentStatus),
      now,
    }),
    db
      .update(paymentTransactions)
      .set({ status: paymentStatus, updatedAt: timestamp })
      .where(eq(paymentTransactions.transactionId, input.transactionId)),
    db.insert(refundTransactions).values({
      refundId,
      paymentTransactionId: input.transactionId,
      orderId: row.id,
      restaurantId: row.restaurantId,
      amountCents: refundAmountCents,
      reason: input.reason ?? null,
      status: "completed",
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: timestamp,
    }),
    paymentAudit.buildAppendQuery(db, {
      restaurantId: row.restaurantId,
      paymentTransactionId: input.transactionId,
      eventType: PAYMENT_AUDIT_EVENT_TYPES.REFUND,
      provider: row.paymentMethod ?? "internal",
      amount: cents(refundAmount),
      rawPayload: {
        refundId,
        orderId: row.id,
        reason: input.reason ?? null,
        paymentStatus,
      },
      occurredAtMs: now,
    }),
  ] as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

  return {
    refundId,
    transactionId: input.transactionId,
    orderId: row.id,
    amount: refundAmount,
    status: "completed",
    paymentStatus,
  };
}

function assertAuthenticatedRefundUser(
  user: AuthUser | undefined,
): asserts user is AuthUser {
  if (!user) {
    throw new ApiError("UNAUTHENTICATED", "Authentication required", 403);
  }
}

function assertRefundAccess(user: AuthUser, restaurantId: string) {
  if (![0, 1, 4].includes(user.role)) {
    throw new ApiError("INSUFFICIENT_ROLE", "Insufficient permissions", 403);
  }

  if (user.role !== 0 && String(user.restaurantId ?? "") !== restaurantId) {
    throw new ApiError("FORBIDDEN", "Access denied", 403);
  }
}

export function toExternalPaymentStatus(
  status: string | null | undefined,
): string {
  switch (status) {
    case "paid":
    case "completed":
      return "completed";
    case "refunded":
      return "refunded";
    case "partial_refunded":
      return "partial_refunded";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "processing":
      return "processing";
    default:
      return "pending";
  }
}

function toLedgerPaymentStatus(status: string | null | undefined): string {
  switch (status) {
    case "completed":
      return "paid";
    case "paid":
    case "refunded":
    case "partial_refunded":
    case "failed":
    case "cancelled":
      return status;
    default:
      return "paid";
  }
}

function preparePaymentLedgerForRefund(
  db: ReturnType<typeof drizzle>,
  data: {
    transactionId: string;
    orderId: number;
    restaurantId: string;
    amountCents: number;
    paymentMethod: string;
    status: string;
    now: number;
  },
) {
  return db
    .insert(paymentTransactions)
    .values({
      transactionId: data.transactionId,
      orderId: data.orderId,
      restaurantId: data.restaurantId,
      amountCents: data.amountCents,
      paymentMethod: data.paymentMethod,
      status: data.status as typeof paymentTransactions.$inferInsert.status,
      metadata: { source: "refund_legacy_backfill" },
      createdAt: new Date(data.now),
      updatedAt: new Date(data.now),
      completedAt: new Date(data.now),
    })
    .onConflictDoNothing();
}

function cents(value: number): number {
  return Math.round(value * 100);
}

function mutationChanges(result: unknown): number {
  const meta = (result as { meta?: { changes?: unknown } } | null)?.meta;
  return typeof meta?.changes === "number" ? meta.changes : 0;
}
