import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../../types/env";
import type { AuthUser } from "../../../middleware/auth";
import { validateBody } from "../../../shared/middleware";
import { idempotencyMiddleware } from "../../../middleware/idempotency";
import { PaymentService } from "../services/PaymentService";
import { ApiError } from "../../../shared/utils/api-error";
import {
  paymentSchemas,
  type PaymentRequestInput,
} from "../schemas/validation";

const app = new Hono<{ Bindings: Env }>();

const legacyPaymentRequestSchema = z
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

const legacyRefundSchema = z.object({
  transactionId: z.string().min(1),
  amount: z.number().finite().positive().optional(),
  reason: z.string().max(500).optional(),
});

const paymentMethodsByCountry: Record<string, string[]> = {
  TW: ["credit_card", "debit_card", "ecpay", "newebpay", "line_pay"],
  MY: ["credit_card", "debit_card", "fpx", "touch_n_go", "grab_pay"],
  VN: ["credit_card", "debit_card", "momo", "zalo_pay", "viet_qr", "vnpay"],
};

app.post(
  "/",
  idempotencyMiddleware({
    scope: "payment",
    effectId: async (_c, response) => {
      const body = (await response.clone().json()) as {
        data?: { paymentId?: string };
      };
      return body.data?.paymentId ?? null;
    },
  }),
  validateBody(paymentSchemas.processPayment),
  async (c) => {
    const input: PaymentRequestInput = c.get("validatedBody");
    const user: AuthUser | undefined = c.get("user");
    const service = new PaymentService(c.env);
    // Gateway fixture headers bypass real gateway calls and are only honored
    // outside production. In prod, any forged header is ignored so callers
    // cannot fake a timeout/pending payment state.
    const fixtureAllowed = c.env.NODE_ENV !== "production";
    const result = await service.processPayment(input, {
      user,
      gatewayFixture: fixtureAllowed
        ? (c.req.header("X-Payment-Gateway-Fixture") ?? null)
        : null,
    });

    return c.json(
      {
        success: true,
        data: result.data,
      },
      result.status,
    );
  },
);

app.post("/create", validateBody(legacyPaymentRequestSchema), async (c) => {
  const input = c.get("validatedBody");
  const orderId = await resolveLegacyOrderId(
    c.env.DB,
    input.orderId,
    input.restaurantId,
  );
  const service = new PaymentService(c.env);
  const user: AuthUser | undefined = c.get("user");
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
        status: toLegacyPaymentStatus(result.data.paymentStatus),
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
});

app.get("/status/:transactionId", async (c) => {
  const transactionId = c.req.param("transactionId");
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
      status: toLegacyPaymentStatus(row.payment_status),
    },
  });
});

app.post("/refund", validateBody(legacyRefundSchema), async (c) => {
  const input = c.get("validatedBody");
  const row = await c.env.DB.prepare(
    `SELECT id, total_amount, refund_amount
       FROM orders
      WHERE payment_transaction_id = ?
      LIMIT 1`,
  )
    .bind(input.transactionId)
    .first<{
      id: number;
      total_amount: number;
      refund_amount: number | null;
    }>();

  if (!row) {
    throw new ApiError("TRANSACTION_NOT_FOUND", "Transaction not found", 404);
  }

  const refundAmount = input.amount ?? Number(row.total_amount);
  if (cents(refundAmount) > cents(Number(row.total_amount))) {
    throw new ApiError(
      "REFUND_AMOUNT_EXCEEDS_PAYMENT",
      "Refund amount exceeds payment total",
      409,
    );
  }

  const nextRefundTotal = Number(row.refund_amount ?? 0) + refundAmount;
  const isFullRefund =
    cents(nextRefundTotal) >= cents(Number(row.total_amount));
  const paymentStatus = isFullRefund ? "refunded" : "partial_refunded";
  const refundId = `ref_${input.transactionId}_${Date.now()}`;

  await c.env.DB.prepare(
    `UPDATE orders
        SET payment_status = ?,
            refund_amount = ?,
            status = CASE WHEN ? THEN 'refunded' ELSE status END,
            updated_at_ms = ?
      WHERE id = ?`,
  )
    .bind(
      paymentStatus,
      nextRefundTotal,
      isFullRefund ? 1 : 0,
      Date.now(),
      row.id,
    )
    .run();

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

async function resolveLegacyOrderId(
  db: Env["DB"],
  orderId: string | number,
  restaurantId: string,
): Promise<number> {
  const numericOrderId = toNumericOrderId(orderId);
  if (numericOrderId !== null) return numericOrderId;

  const legacyOrderId = String(orderId).trim();
  const row = await db
    .prepare(
      `SELECT id
         FROM orders
        WHERE restaurant_id = ?
          AND (order_number = ? OR client_mutation_id = ?)
        LIMIT 1`,
    )
    .bind(restaurantId, legacyOrderId, legacyOrderId)
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

function toLegacyPaymentStatus(status: string | null | undefined): string {
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

function cents(value: number): number {
  return Math.round(value * 100);
}

export default app;
