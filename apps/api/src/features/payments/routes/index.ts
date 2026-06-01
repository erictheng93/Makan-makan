import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { Env } from "../../../types/env";
import type { AuthUser } from "../../../middleware/auth";
import { validateBody } from "../../../shared/middleware";
import { idempotencyMiddleware } from "../../../middleware/idempotency";
import { PaymentService } from "../services/PaymentService";
import { ApiError } from "../../../shared/utils/api-error";
import {
  refundPaymentTransaction,
  toExternalPaymentStatus,
} from "../services/refundPayment";

const app = new Hono<{ Bindings: Env }>();

const createPaymentRequestSchema = z
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

const rootPaymentRequestSchema = z
  .object({
    orderId: z.union([z.string().min(1), z.number().int().positive()]),
    restaurantId: z.string().min(1).optional(),
    country: z.enum(["TW", "MY", "VN"]).optional().default("TW"),
    currency: z.enum(["TWD", "MYR", "VND"]).optional().default("TWD"),
    paymentMode: z.enum(["full", "partial"]).optional().default("full"),
    expectedTotal: z.number().finite().nonnegative().optional(),
    payments: z
      .array(
        z.object({
          method: z.string().min(1).max(50),
          amount: z.number().finite().nonnegative(),
        }),
      )
      .min(1)
      .max(20)
      .optional(),
    closeOrder: z.boolean().optional(),
    method: z.string().min(1).max(50).optional(),
    amount: z.number().finite().nonnegative().optional(),
    gateway: z.string().min(1).max(50).optional(),
    customerInfo: z
      .object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
      })
      .optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (value.paymentMode === "partial" && !value.payments?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payments"],
        message: "payments are required for partial payment mode",
      });
    }

    if (value.paymentMode === "full" && value.amount === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "amount is required for full payment mode",
      });
    }
  });

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

const paymentEffectId = async (_c: unknown, response: Response) => {
  const body = (await response.clone().json()) as {
    data?: { transactionId?: string; paymentId?: string; id?: string };
  };
  return (
    body.data?.transactionId ?? body.data?.paymentId ?? body.data?.id ?? null
  );
};

interface PaymentRouteInput {
  orderId: string | number;
  restaurantId?: string;
  country?: "TW" | "MY" | "VN";
  currency?: "TWD" | "MYR" | "VND";
  paymentMode?: "full" | "partial";
  expectedTotal?: number;
  payments?: Array<{ method: string; amount: number }>;
  closeOrder?: boolean;
  method?: string;
  amount?: number;
  gateway?: string;
  customerInfo?: unknown;
  metadata?: unknown;
}

type PaymentContext = Context<{
  Bindings: Env;
  Variables: { validatedBody: PaymentRouteInput; user: AuthUser };
}>;

async function handlePayment(c: PaymentContext) {
  const input = c.get("validatedBody") as PaymentRouteInput;
  const orderId =
    input.restaurantId !== undefined
      ? await resolveOrderId(c.env.DB, input.orderId, input.restaurantId)
      : (toNumericOrderId(input.orderId) ??
        (() => {
          throw new ApiError(
            "RESTAURANT_ID_REQUIRED",
            "restaurantId is required for non-numeric payment orderId",
            400,
          );
        })());
  const service = new PaymentService(c.env);
  const user: AuthUser | undefined = c.get("user");
  const result = await service.processPayment(
    {
      orderId,
      paymentMode: input.paymentMode ?? "full",
      amount: input.amount,
      expectedTotal: input.expectedTotal ?? input.amount,
      payments: input.payments,
      closeOrder: input.closeOrder ?? true,
      method: input.method,
      gateway: input.gateway ?? input.method,
    },
    {
      user,
      country: input.country,
      currency: input.currency,
      idempotencyKey: c.req.header("Idempotency-Key") ?? undefined,
      customerInfo: input.customerInfo,
      metadata: input.metadata,
    },
  );

  return c.json(
    {
      success: true,
      data: {
        id: result.data.paymentId,
        paymentId: result.data.paymentId,
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
}

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
    effectId: paymentEffectId,
  }),
  validateBody(createPaymentRequestSchema),
  handlePayment,
);

app.post(
  "/",
  idempotencyMiddleware({
    scope: "payment",
    requireKey: false,
    effectId: paymentEffectId,
  }),
  validateBody(rootPaymentRequestSchema),
  handlePayment,
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
  const refund = await refundPaymentTransaction(c.env, input);

  return c.json({
    success: true,
    data: {
      refundId: refund.refundId,
      transactionId: refund.transactionId,
      amount: refund.amount,
      status: refund.status,
      paymentStatus: refund.paymentStatus,
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

export default app;
