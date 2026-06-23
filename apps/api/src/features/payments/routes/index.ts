import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { orders, paymentTransactions } from "@makanmakan/database";
import type { Env } from "../../../types/env";
import type { AuthUser } from "../../../middleware/auth";
import { validateBody } from "../../../shared/middleware";
import { idempotencyMiddleware } from "../../../middleware/idempotency";
import { requireRole } from "../../../middleware/auth";
import { PaymentService } from "../services/PaymentService";
import { ApiError } from "../../../shared/utils/api-error";
import {
  refundPaymentTransaction,
  toExternalPaymentStatus,
} from "../services/refundPayment";
import {
  resolveOrderIdentity,
  type OrderIdentity,
} from "../../../shared/services/order-identity";

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
  const resolvedOrder = await resolvePaymentOrder(c.env.DB, input);
  const orderId =
    resolvedOrder?.id ?? toRequiredNumericPaymentOrderId(input.orderId);
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
          orderPublicId: resolvedOrder?.publicId ?? undefined,
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
  const db = drizzle(c.env.DB);
  const [transaction] = await db
    .select({
      transactionId: paymentTransactions.transactionId,
      orderId: paymentTransactions.orderId,
      status: paymentTransactions.status,
    })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.transactionId, transactionId))
    .limit(1);

  if (transaction) {
    return c.json({
      success: true,
      data: {
        transactionId: transaction.transactionId,
        orderId: transaction.orderId,
        paymentStatus: transaction.status,
        status: toExternalPaymentStatus(transaction.status),
      },
    });
  }

  const [row] = await db
    .select({
      id: orders.id,
      publicId: orders.publicId,
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .where(eq(orders.paymentTransactionId, transactionId))
    .limit(1);

  if (!row) {
    throw new ApiError("TRANSACTION_NOT_FOUND", "Transaction not found", 404);
  }

  return c.json({
    success: true,
    data: {
      transactionId,
      orderId: row.id,
      orderPublicId: row.publicId,
      paymentStatus: row.paymentStatus,
      status: toExternalPaymentStatus(row.paymentStatus),
    },
  });
});

app.post(
  "/refund",
  requireRole([0, 1, 4]),
  validateBody(refundSchema),
  async (c) => {
    const input = c.get("validatedBody");
    const user = c.get("user");
    const refund = await refundPaymentTransaction(c.env, input, { user });

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
  },
);

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
async function resolvePaymentOrder(
  db: Env["DB"],
  input: Pick<PaymentRouteInput, "orderId" | "restaurantId">,
): Promise<OrderIdentity | null> {
  if (input.restaurantId !== undefined) {
    return resolveOrderIdentity(db, input.orderId, {
      restaurantId: input.restaurantId,
    });
  }

  if (toNumericOrderId(input.orderId) !== null) return null;

  throw new ApiError(
    "RESTAURANT_ID_REQUIRED",
    "restaurantId is required for non-numeric payment orderId",
    400,
  );
}

function toRequiredNumericPaymentOrderId(orderId: string | number): number {
  const numericOrderId = toNumericOrderId(orderId);
  if (numericOrderId === null) {
    throw new ApiError(
      "RESTAURANT_ID_REQUIRED",
      "restaurantId is required for non-numeric payment orderId",
      400,
    );
  }
  return numericOrderId;
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
