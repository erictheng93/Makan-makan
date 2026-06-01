import type { Env } from "../../../types/env";
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

export async function refundPaymentTransaction(
  env: Env,
  input: RefundPaymentInput,
): Promise<RefundPaymentResult> {
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

  await ensurePaymentLedgerForRefund(env.DB, {
    transactionId: input.transactionId,
    orderId: row.id,
    restaurantId: row.restaurant_id,
    amountCents: cents(paymentTotal),
    paymentMethod: row.payment_method ?? "unknown",
    status: toLedgerPaymentStatus(row.payment_status),
    now,
  });

  await env.DB.prepare(
    `UPDATE orders
        SET payment_status = ?,
            refund_amount = ?,
            status = CASE WHEN ? THEN 'refunded' ELSE status END,
            updated_at_ms = ?
      WHERE id = ?`,
  )
    .bind(paymentStatus, nextRefundTotal, isFullRefund ? 1 : 0, now, row.id)
    .run();

  await env.DB.prepare(
    `UPDATE payment_transactions
        SET status = ?,
            updated_at_ms = ?
      WHERE transaction_id = ?`,
  )
    .bind(paymentStatus, now, input.transactionId)
    .run();

  await env.DB.prepare(
    `INSERT INTO refund_transactions (
        refund_id, payment_transaction_id, order_id, restaurant_id,
        amount_cents, reason, status, created_at_ms, updated_at_ms,
        completed_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`,
  )
    .bind(
      refundId,
      input.transactionId,
      row.id,
      row.restaurant_id,
      cents(refundAmount),
      input.reason ?? null,
      now,
      now,
      now,
    )
    .run();

  await new PaymentAuditService(env.DB).append({
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
  });

  return {
    refundId,
    transactionId: input.transactionId,
    orderId: row.id,
    amount: refundAmount,
    status: "completed",
    paymentStatus,
  };
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

async function ensurePaymentLedgerForRefund(
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
  await db
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
    )
    .run();
}

function cents(value: number): number {
  return Math.round(value * 100);
}
