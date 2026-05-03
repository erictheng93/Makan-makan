import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../../types/env";
import type { AuthUser } from "../../../middleware/auth";
import { validateBody } from "../../../shared/middleware";
import { idempotencyMiddleware } from "../../../middleware/idempotency";
import { PaymentService } from "../services/PaymentService";
import { ApiError } from "../../../shared/utils/api-error";
import { amountFromCents } from "@makanmakan/database";
import {
  PAYMENT_AUDIT_EVENT_TYPES,
  PaymentAuditService,
} from "../../billing/services/PaymentAuditService";

const app = new Hono<{ Bindings: Env }>();

const paymentRequestSchema = z
  .object({
    orderId: z.union([z.string().min(1), z.number().int().positive()]),
    restaurantId: z.string().min(1),
    country: z.enum(["TW", "MY", "VN"]),
    currency: z.enum(["TWD", "MYR", "VND"]),
    amount: z.number().finite().positive(),
    method: z.string().min(1).max(50),
    customerInfo: z
      .object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
      })
      .optional(),
    metadata: z.record(z.unknown()).optional(),
    returnUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
  })
  .passthrough();

const refundSchema = z.object({
  transactionId: z.string().min(1),
  amount: z.number().finite().positive().optional(),
  reason: z.string().max(500).optional(),
});

const paymentMethodsByCountry: Record<string, string[]> = {
  TW: ["credit_card", "debit_card", "ecpay", "newebpay", "line_pay"],
  MY: ["credit_card", "debit_card", "fpx", "touch_n_go", "grab_pay"],
  VN: ["credit_card", "debit_card", "momo", "zalo_pay", "viet_qr", "vnpay"],
};

/**
 * POST /api/v1/payments/create
 *
 * Process a payment. The idempotencyMiddleware is wired so that any
 * client sending an `Idempotency-Key` header gets safe retry behaviour
 * (a duplicate request replays the original response instead of
 * double-charging). The header is currently optional because the
 * admin-dashboard frontend doesn't send it yet — flip requireKey to
 * true once the apiClient is updated to always include one.
 */
app.post(
  "/create",
  idempotencyMiddleware({
    scope: "payment",
    requireKey: false,
    effectId: async (_c, response) => {
      const body = (await response.clone().json()) as {
        data?: { transactionId?: string };
      };
      return body.data?.transactionId ?? null;
    },
  }),
  validateBody(paymentRequestSchema),
  async (c) => {
    const input = c.get("validatedBody");
    const orderId = await resolveOrderId(
      c.env.DB,
      input.orderId,
      input.restaurantId,
    );
    const service = new PaymentService(c.env);
    const user: AuthUser | undefined = c.get("user");
    // Gateway fixture headers bypass real gateway calls and are only honored
    // outside production. In prod, any forged header is ignored so callers
    // cannot fake a timeout/pending payment state.
    const fixtureAllowed = c.env.NODE_ENV !== "production";
    const result = await service.processPayment(
      {
        orderId,
        paymentMode: "full",
        amount: input.amount,
        expectedTotal: input.amount,
        closeOrder: true,
        method: input.method,
        gateway: input.method,
      },
      {
        user,
        country: input.country,
        currency: input.currency,
        idempotencyKey: c.req.header("Idempotency-Key") ?? undefined,
        customerInfo: input.customerInfo,
        metadata: input.metadata,
        gatewayFixture: fixtureAllowed
          ? (c.req.header("X-Payment-Gateway-Fixture") ?? null)
          : null,
      },
    );

    return c.json(
      {
        success: true,
        data: {
          transactionId: result.data.paymentId,
          status: toExternalPaymentStatus(result.data.paymentStatus),
          metadata: {
            orderId: result.data.orderId,
            orderStatus: result.data.orderStatus,
            paymentStatus: result.data.paymentStatus,
            authorizedTotal: result.data.authorizedTotal,
            country: input.country,
            currency: input.currency,
            method: input.method,
          },
        },
      },
      result.status,
    );
  },
);

app.get("/status/:transactionId", async (c) => {
  const transactionId = c.req.param("transactionId");
  const transaction = await c.env.DB.prepare(
    `SELECT transaction_id, order_id, status
       FROM payment_transactions
      WHERE transaction_id = ?
      LIMIT 1`,
  )
    .bind(transactionId)
    .first<{
      transaction_id: string;
      order_id: number;
      status: string;
    }>();

  if (transaction) {
    return c.json({
      success: true,
      data: {
        transactionId: transaction.transaction_id,
        orderId: transaction.order_id,
        paymentStatus: transaction.status,
        status: toExternalPaymentStatus(transaction.status),
      },
    });
  }

  const row = await c.env.DB.prepare(
    `SELECT id, payment_status
       FROM orders
      WHERE payment_transaction_id = ?
      LIMIT 1`,
  )
    .bind(transactionId)
    .first<{ id: number; payment_status: string | null }>();

  if (!row) {
    throw new ApiError("TRANSACTION_NOT_FOUND", "Transaction not found", 404);
  }

  return c.json({
    success: true,
    data: {
      transactionId,
      orderId: row.id,
      paymentStatus: row.payment_status,
      status: toExternalPaymentStatus(row.payment_status),
    },
  });
});

app.post("/refund", validateBody(refundSchema), async (c) => {
  const input = c.get("validatedBody");
  const row = await c.env.DB.prepare(
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

  await ensurePaymentLedgerForRefund(c.env.DB, {
    transactionId: input.transactionId,
    orderId: row.id,
    restaurantId: row.restaurant_id,
    amountCents: cents(paymentTotal),
    paymentMethod: row.payment_method ?? "unknown",
    status: toLedgerPaymentStatus(row.payment_status),
    now,
  });

  await c.env.DB.prepare(
    `UPDATE orders
        SET payment_status = ?,
            refund_amount = ?,
            status = CASE WHEN ? THEN 'refunded' ELSE status END,
            updated_at_ms = ?
      WHERE id = ?`,
  )
    .bind(paymentStatus, nextRefundTotal, isFullRefund ? 1 : 0, now, row.id)
    .run();

  await c.env.DB.prepare(
    `UPDATE payment_transactions
        SET status = ?,
            updated_at_ms = ?
      WHERE transaction_id = ?`,
  )
    .bind(paymentStatus, now, input.transactionId)
    .run();

  await c.env.DB.prepare(
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

  await new PaymentAuditService(c.env.DB).append({
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

  return c.json({
    success: true,
    data: {
      refundId,
      transactionId: input.transactionId,
      amount: refundAmount,
      status: "completed",
      paymentStatus,
    },
  });
});

app.get("/methods/:country", async (c) => {
  const country = c.req.param("country").toUpperCase();
  const supportedMethods = paymentMethodsByCountry[country] ?? [];

  return c.json({
    success: true,
    data: {
      country,
      supportedMethods,
    },
  });
});

/**
 * Resolve the canonical numeric `orders.id` from any of the identifiers
 * the frontend may pass: a numeric id, a string-encoded numeric id,
 * the human-readable `order_number`, or a `client_mutation_id`.
 */
async function resolveOrderId(
  db: Env["DB"],
  orderId: string | number,
  restaurantId: string,
): Promise<number> {
  const numericOrderId = toNumericOrderId(orderId);
  if (numericOrderId !== null) return numericOrderId;

  const lookupKey = String(orderId).trim();
  const row = await db
    .prepare(
      `SELECT id
         FROM orders
        WHERE restaurant_id = ?
          AND (order_number = ? OR client_mutation_id = ?)
        LIMIT 1`,
    )
    .bind(restaurantId, lookupKey, lookupKey)
    .first<{ id: number }>();

  if (!row) {
    throw new ApiError("ORDER_NOT_FOUND", "Order not found", 404);
  }

  return row.id;
}

function toNumericOrderId(orderId: string | number): number | null {
  if (typeof orderId === "number") return orderId;
  if (!/^\d+$/.test(orderId.trim())) return null;

  const numericOrderId =
    typeof orderId === "number" ? orderId : Number.parseInt(orderId, 10);

  if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
    throw new ApiError(
      "ORDER_ID_INVALID",
      "Payment orderId must be a positive numeric order id",
      400,
    );
  }

  return numericOrderId;
}

function toExternalPaymentStatus(status: string | null | undefined): string {
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

export default app;
