import type { Env } from "../../../types/env";
import type { AuthUser } from "../../../middleware/auth";
import { ApiError } from "../../../shared/utils/api-error";
import { amountFromCents } from "@makanmakan/database";
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

  const row = await env.DB.prepare(
    `SELECT id, restaurant_id, total_amount, total_amount_cents,
            refund_amount, refund_amount_cents, payment_method, payment_status
       FROM orders
      WHERE payment_transaction_id = ?
      LIMIT 1`,
  )
    .bind(input.transactionId)
    .first<{
      id: number;
      restaurant_id: string;
      total_amount: number;
      total_amount_cents: number | null;
      refund_amount: number | null;
      refund_amount_cents: number | null;
      payment_method: string | null;
      payment_status: string | null;
    }>();

  if (!row) {
    throw new ApiError("TRANSACTION_NOT_FOUND", "Transaction not found", 404);
  }

  assertRefundAccess(options.user, row.restaurant_id);

  if (
    ["pending", "failed", "cancelled", "refunded"].includes(
      row.payment_status ?? "",
    )
  ) {
    throw new ApiError(
      "PAYMENT_NOT_REFUNDABLE",
      "Payment is not in a refundable state",
      409,
    );
  }

  const paymentTotal =
    amountFromCents(row.total_amount_cents, row.total_amount) ?? 0;
  const refundAmount = input.amount ?? paymentTotal;
  const currentRefundTotal =
    amountFromCents(row.refund_amount_cents, row.refund_amount) ?? 0;
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
  const refundAmountCents = cents(refundAmount);

  const updateResult = await env.DB.prepare(
    `UPDATE orders
        SET payment_status = ?,
            refund_amount_cents = COALESCE(refund_amount_cents, ROUND(COALESCE(refund_amount, 0) * 100)) + ?,
            refund_amount = (COALESCE(refund_amount_cents, ROUND(COALESCE(refund_amount, 0) * 100)) + ?) / 100.0,
            status = CASE WHEN ? THEN 'refunded' ELSE status END,
            updated_at_ms = ?
      WHERE id = ?
        AND payment_transaction_id = ?
        AND COALESCE(payment_status, '') NOT IN ('pending', 'failed', 'cancelled', 'refunded')
        AND COALESCE(refund_amount_cents, ROUND(COALESCE(refund_amount, 0) * 100)) + ?
            <= COALESCE(total_amount_cents, ROUND(total_amount * 100))`,
  )
    .bind(
      paymentStatus,
      refundAmountCents,
      refundAmountCents,
      isFullRefund ? 1 : 0,
      now,
      row.id,
      input.transactionId,
      refundAmountCents,
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
  await env.DB.batch([
    preparePaymentLedgerForRefund(env.DB, {
      transactionId: input.transactionId,
      orderId: row.id,
      restaurantId: row.restaurant_id,
      amountCents: cents(paymentTotal),
      paymentMethod: row.payment_method ?? "unknown",
      status: toLedgerPaymentStatus(row.payment_status),
      now,
    }),
    env.DB.prepare(
      `UPDATE payment_transactions
          SET status = ?,
              updated_at_ms = ?
        WHERE transaction_id = ?`,
    ).bind(paymentStatus, now, input.transactionId),
    env.DB.prepare(
      `INSERT INTO refund_transactions (
          refund_id, payment_transaction_id, order_id, restaurant_id,
          amount_cents, reason, status, created_at_ms, updated_at_ms,
          completed_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`,
    ).bind(
      refundId,
      input.transactionId,
      row.id,
      row.restaurant_id,
      refundAmountCents,
      input.reason ?? null,
      now,
      now,
      now,
    ),
    paymentAudit.prepareAppend({
      restaurantId: row.restaurant_id,
      paymentTransactionId: input.transactionId,
      eventType: PAYMENT_AUDIT_EVENT_TYPES.REFUND,
      provider: row.payment_method ?? "internal",
      amount: cents(refundAmount),
      rawPayload: {
        refundId,
        orderId: row.id,
        reason: input.reason ?? null,
        paymentStatus,
      },
      occurredAtMs: now,
    }),
  ]);

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
  db: Env["DB"],
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
    .prepare(
      `INSERT OR IGNORE INTO payment_transactions (
          transaction_id, order_id, restaurant_id, amount_cents,
          payment_method, status, metadata, created_at_ms, updated_at_ms,
          completed_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      data.transactionId,
      data.orderId,
      data.restaurantId,
      data.amountCents,
      data.paymentMethod,
      data.status,
      JSON.stringify({ source: "refund_legacy_backfill" }),
      data.now,
      data.now,
      data.now,
    );
}

function cents(value: number): number {
  return Math.round(value * 100);
}

function mutationChanges(result: unknown): number {
  const meta = (result as { meta?: { changes?: unknown } } | null)?.meta;
  return typeof meta?.changes === "number" ? meta.changes : 0;
}
