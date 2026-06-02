import { Hono } from "hono";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  createDatabase,
  marketCheckoutChildOrders,
  marketCheckoutSessions,
  menuItems,
  markets,
  restaurantMarketMemberships,
  restaurants,
} from "@makanmakan/database";
import type { Env } from "../../../types/env";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from "../../../shared/utils/api-error";
import { enforceQuota } from "../../../middleware/quotaGate";
import { meterEmit } from "../../../shared/utils/meter";
import {
  generateGuestToken,
  type GuestTokenData,
} from "../../../middleware/guestAuth";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { OrdersService } from "../../orders/services/OrdersService";
import type { OrderPaymentStatus, OrderStatus } from "../../orders/types";
import { PaymentService } from "../../payments/services/PaymentService";
import {
  refundPaymentTransaction,
  type RefundPaymentResult,
} from "../../payments/services/refundPayment";
import { createMarketCheckoutSchema } from "../schemas/validation";
import { z } from "zod";

const app = new Hono<{ Bindings: Env }>();
const MARKET_CHECKOUT_INDEX_KEY = "market_checkout:index";
const MARKET_CHECKOUT_INDEX_LIMIT = 200;

const payMarketCheckoutSchema = z.object({
  method: z.string().min(1).max(50).default("market_online"),
  country: z.enum(["TW", "MY", "VN"]).optional().default("TW"),
  currency: z.enum(["TWD", "MYR", "VND"]).optional().default("TWD"),
  customerInfo: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

const recoverMarketCheckoutGuestTokenSchema = z.object({
  orderId: z.number().int().positive(),
  phoneLastDigits: z.string().regex(/^\d{3}$/),
});

const refundMarketCheckoutSchema = z.object({
  reason: z.string().max(500).optional(),
});

interface MarketCheckoutChildOrder {
  restaurantId: string;
  restaurantName: string;
  orderId: number;
  orderNumber: string;
  totalAmount: number;
  totalAmountCents?: number | null;
  tokenExpiresAt: string;
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  updatedAt?: number;
}

interface MarketCheckoutSession {
  id: string;
  market: {
    id: string;
    slug: string;
    name: string;
  };
  status: "submitted";
  phoneLastDigits?: string;
  childOrders: MarketCheckoutChildOrder[];
  payment?: MarketCheckoutPaymentSummary;
  subtotal: number;
  createdAt: string;
}

interface MarketCheckoutIndexItem {
  id: string;
  market: MarketCheckoutSession["market"];
  status: MarketCheckoutSession["status"];
  paymentStatus: MarketCheckoutPaymentSummary["status"] | "pending";
  subtotal: number;
  childOrderCount: number;
  createdAt: string;
  updatedAt: string;
}

interface MarketCheckoutSummaryItem extends MarketCheckoutIndexItem {
  payment?: MarketCheckoutPaymentSummary;
}

interface MarketCheckoutPaymentSummary {
  status:
    | "pending"
    | "partial_paid"
    | "paid"
    | "failed"
    | "refunded"
    | "partial_refunded";
  method: string;
  currency: "TWD" | "MYR" | "VND";
  country: "TW" | "MY" | "VN";
  totalAmount: number;
  totalAmountCents: number;
  paidAmount: number;
  paidAmountCents: number;
  refundedAmount?: number;
  refundedAmountCents?: number;
  paidAt?: string;
  failedAt?: string;
  refundedAt?: string;
  childPayments: Array<{
    restaurantId: string;
    restaurantName: string;
    orderId: number;
    orderNumber: string;
    paymentId?: string;
    refundId?: string;
    status: "paid" | "failed" | "refunded";
    amount: number;
    amountCents: number;
    errorMessage?: string;
  }>;
}

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createMarketCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const data = parsed.data;
  const db = createDatabase(c.env.DB);
  const market = await db
    .select()
    .from(markets)
    .where(and(eq(markets.slug, data.marketSlug), eq(markets.isActive, true)))
    .get();

  if (!market) {
    throw notFound("Market not found");
  }

  const restaurantIds = data.vendors.map((vendor) => vendor.restaurantId);
  if (new Set(restaurantIds).size !== restaurantIds.length) {
    throw badRequest("Each vendor can appear only once in a market checkout");
  }

  const clientIp =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for") ||
    "unknown";
  const guestIdentifier =
    data.phoneLastDigits === "000" ? `anon:${clientIp}` : data.phoneLastDigits;
  const activeOrderKeys = restaurantIds.map(
    (restaurantId) => `guest_active:${restaurantId}:${guestIdentifier}`,
  );

  await Promise.all(
    data.vendors.map((vendor) =>
      enforceQuota(c, "orders.created", {
        restaurantId: vendor.restaurantId,
      }),
    ),
  );

  const vendors = await Promise.all(
    data.vendors.map(async (vendor) => {
      const [restaurant, membership] = await Promise.all([
        db
          .select()
          .from(restaurants)
          .where(eq(restaurants.id, vendor.restaurantId))
          .get(),
        db
          .select()
          .from(restaurantMarketMemberships)
          .where(
            and(
              eq(restaurantMarketMemberships.marketId, market.id),
              eq(restaurantMarketMemberships.restaurantId, vendor.restaurantId),
              isNull(restaurantMarketMemberships.leftAt),
            ),
          )
          .get(),
      ]);

      if (!restaurant || !membership) {
        throw badRequest(
          `Restaurant ${vendor.restaurantId} is not an active vendor in this market`,
        );
      }
      if (!restaurant.isActive || !restaurant.isAvailable) {
        throw badRequest(`Restaurant ${vendor.restaurantId} is unavailable`);
      }

      const settings = restaurant.settings as Record<string, unknown> | null;
      if (!settings || settings.allowGuestOrders !== true) {
        throw forbidden(
          `Guest orders are not enabled for restaurant ${vendor.restaurantId}`,
        );
      }

      return { vendor, restaurant };
    }),
  );

  const existingActiveOrders = await Promise.all(
    activeOrderKeys.map((key) => c.env.CACHE_KV.get(key)),
  );
  if (existingActiveOrders.some(Boolean)) {
    throw conflict(
      "You already have an active order at one of these vendors. Please wait for it to complete.",
      "MARKET_VENDOR_ACTIVE_ORDER_EXISTS",
    );
  }

  for (const vendor of data.vendors) {
    const requestedItemIds = vendor.items.map((item) => item.menuItemId);
    const availableItems = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(
        and(
          eq(menuItems.restaurantId, vendor.restaurantId),
          eq(menuItems.isAvailable, true),
          inArray(menuItems.id, requestedItemIds),
        ),
      )
      .all();
    if (availableItems.length !== new Set(requestedItemIds).size) {
      throw conflict(
        `One or more items are unavailable for restaurant ${vendor.restaurantId}`,
        "MENU_ITEM_UNAVAILABLE",
      );
    }
  }

  const ordersService = new OrdersService(c.env);
  const checkoutId = crypto.randomUUID();
  const children = [];

  for (const { vendor, restaurant } of vendors) {
    const childOrder = await ordersService.createOrder({
      restaurantId: vendor.restaurantId,
      customerInfo: {
        name: data.guestName,
      },
      items: vendor.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        customizations: item.customizations,
        notes: item.notes,
      })),
      notes: buildMarketCheckoutOrderNotes({
        marketName: market.name,
        marketSlug: market.slug,
        checkoutId,
        checkoutNotes: data.notes,
        vendorNotes: vendor.notes,
      }),
      orderSource: "market_checkout",
      clientMutationId: vendor.clientMutationId,
      orderType: "shop",
      deliveryInfo: {
        type: "takeaway",
      },
      isGuestOrder: true,
    });

    const guestToken = generateGuestToken();
    const tokenData: GuestTokenData = {
      orderId: String(childOrder.id),
      restaurantId: vendor.restaurantId,
      guestName: data.guestName,
      phoneLastDigits: data.phoneLastDigits,
      createdAt: Date.now(),
    };

    const fourHoursInSeconds = 4 * 60 * 60;
    const twoHoursInSeconds = 2 * 60 * 60;
    const activeOrderKey = `guest_active:${vendor.restaurantId}:${guestIdentifier}`;

    await c.env.CACHE_KV.put(
      `guest_token:${guestToken}`,
      JSON.stringify(tokenData),
      { expirationTtl: fourHoursInSeconds },
    );
    await c.env.CACHE_KV.put(activeOrderKey, String(childOrder.id), {
      expirationTtl: twoHoursInSeconds,
    });
    await c.env.CACHE_KV.put(
      `guest_active_lookup:${childOrder.id}`,
      activeOrderKey,
      { expirationTtl: twoHoursInSeconds },
    );
    await meterEmit(c, "orders.created", {
      restaurantId: vendor.restaurantId,
      metadata: {
        orderId: childOrder.id,
        source: "market-checkouts",
        marketSlug: data.marketSlug,
      },
    });

    children.push({
      restaurantId: vendor.restaurantId,
      restaurantName: restaurant.name,
      order: childOrder,
      guestToken,
      tokenExpiresAt: new Date(
        Date.now() + fourHoursInSeconds * 1000,
      ).toISOString(),
    });
  }

  const subtotal = children.reduce(
    (sum, child) => sum + orderTotalCents(child.order),
    0,
  );
  const session: MarketCheckoutSession = {
    id: checkoutId,
    market: {
      id: market.id,
      slug: market.slug,
      name: market.name,
    },
    status: "submitted",
    phoneLastDigits: data.phoneLastDigits,
    childOrders: children.map((child) => ({
      restaurantId: child.restaurantId,
      restaurantName: child.restaurantName,
      orderId: child.order.id,
      orderNumber: child.order.orderNumber,
      totalAmount: child.order.totalAmount,
      totalAmountCents: orderTotalCents(child.order),
      tokenExpiresAt: child.tokenExpiresAt,
    })),
    subtotal,
    createdAt: new Date().toISOString(),
  };

  await c.env.CACHE_KV.put(
    `market_checkout:${checkoutId}`,
    JSON.stringify(session),
    {
      expirationTtl: 4 * 60 * 60,
    },
  );
  await persistMarketCheckoutSession(c.env, session);
  await upsertMarketCheckoutIndex(c.env.CACHE_KV, session);

  return c.json(
    {
      success: true,
      data: {
        checkout: session,
        childOrders: children,
      },
    },
    201,
  );
});

app.post("/:id/pay", async (c) => {
  const checkoutId = c.req.param("id");
  const stored = await c.env.CACHE_KV.get(`market_checkout:${checkoutId}`);
  const session = stored
    ? (JSON.parse(stored) as MarketCheckoutSession)
    : await readPersistedMarketCheckoutSession(c.env, checkoutId);

  if (!session) {
    throw notFound("Market checkout not found");
  }

  const body = await c.req.json();
  const parsed = payMarketCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  if (session.payment?.status === "paid") {
    return c.json({
      success: true,
      data: {
        checkout: session,
        payment: session.payment,
      },
    });
  }

  if (session.childOrders.length === 0) {
    throw badRequest("Market checkout has no child orders to pay");
  }

  const paymentService = new PaymentService(c.env);
  const childPaymentsByOrderId = new Map(
    session.payment?.childPayments.map((payment) => [
      payment.orderId,
      payment,
    ]) ?? [],
  );
  const requestIdempotencyKey = c.req.header("Idempotency-Key");

  for (const child of session.childOrders) {
    if (childPaymentsByOrderId.get(child.orderId)?.status === "paid") {
      continue;
    }

    const amount = Number(child.totalAmount ?? 0);
    try {
      const result = await paymentService.processPayment(
        {
          orderId: child.orderId,
          paymentMode: "full",
          amount,
          expectedTotal: amount,
          closeOrder: false,
          method: parsed.data.method,
          gateway: parsed.data.method,
        },
        {
          country: parsed.data.country,
          currency: parsed.data.currency,
          idempotencyKey: requestIdempotencyKey
            ? `${requestIdempotencyKey}:${child.orderId}`
            : `market-checkout:${checkoutId}:${child.orderId}`,
          customerInfo: parsed.data.customerInfo,
          metadata: {
            source: "market-checkouts",
            marketCheckoutId: checkoutId,
            marketSlug: session.market.slug,
            restaurantId: child.restaurantId,
          },
        },
      );

      childPaymentsByOrderId.set(child.orderId, {
        restaurantId: child.restaurantId,
        restaurantName: child.restaurantName,
        orderId: child.orderId,
        orderNumber: child.orderNumber,
        paymentId: result.data.paymentId,
        status: "paid",
        amount: result.data.authorizedTotal,
        amountCents: Math.round(result.data.authorizedTotal * 100),
      });
    } catch (error) {
      childPaymentsByOrderId.set(child.orderId, {
        restaurantId: child.restaurantId,
        restaurantName: child.restaurantName,
        orderId: child.orderId,
        orderNumber: child.orderNumber,
        status: "failed",
        amount,
        amountCents: Math.round(amount * 100),
        errorMessage:
          error instanceof Error ? error.message : "Payment processing failed",
      });
    }
  }

  const childPayments = session.childOrders.map((child) =>
    childPaymentsByOrderId.get(child.orderId),
  );
  const paidPayments = childPayments.filter(
    (payment) => payment?.status === "paid",
  );
  const totalAmount = session.childOrders.reduce(
    (sum, child) => sum + Number(child.totalAmount ?? 0),
    0,
  );
  const paidAmount = paidPayments.reduce(
    (sum, child) => sum + Number(child?.amount ?? 0),
    0,
  );
  const paymentStatus =
    paidPayments.length === session.childOrders.length
      ? "paid"
      : paidPayments.length > 0
        ? "partial_paid"
        : "failed";
  const now = new Date().toISOString();
  const payment: MarketCheckoutPaymentSummary = {
    status: paymentStatus,
    method: parsed.data.method,
    currency: parsed.data.currency,
    country: parsed.data.country,
    totalAmount,
    totalAmountCents: Math.round(totalAmount * 100),
    paidAmount,
    paidAmountCents: Math.round(paidAmount * 100),
    paidAt: paymentStatus === "paid" ? now : session.payment?.paidAt,
    failedAt: paymentStatus !== "paid" ? now : session.payment?.failedAt,
    childPayments: childPayments.filter(
      (
        payment,
      ): payment is MarketCheckoutPaymentSummary["childPayments"][number] =>
        payment !== undefined,
    ),
  };

  const updatedSession: MarketCheckoutSession = {
    ...session,
    payment,
  };

  await c.env.CACHE_KV.put(
    `market_checkout:${checkoutId}`,
    JSON.stringify(updatedSession),
    {
      expirationTtl: 4 * 60 * 60,
    },
  );
  await updatePersistedMarketCheckoutPayment(c.env, updatedSession);
  await upsertMarketCheckoutIndex(c.env.CACHE_KV, updatedSession);

  return c.json(
    {
      success: true,
      data: {
        checkout: updatedSession,
        payment,
      },
    },
    payment.status === "paid" ? 200 : 202,
  );
});

app.post("/:id/guest-token", async (c) => {
  const checkoutId = c.req.param("id") ?? "";
  const body = await c.req.json();
  const parsed = recoverMarketCheckoutGuestTokenSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const stored = await c.env.CACHE_KV.get(`market_checkout:${checkoutId}`);
  const session = stored
    ? (JSON.parse(stored) as MarketCheckoutSession)
    : await readPersistedMarketCheckoutSession(c.env, checkoutId);
  if (!session) {
    throw notFound("Market checkout not found");
  }

  if (
    session.phoneLastDigits &&
    session.phoneLastDigits !== parsed.data.phoneLastDigits
  ) {
    return c.json(
      {
        success: false,
        error: "Phone verification failed for this market checkout",
      },
      403,
    );
  }

  const child = session.childOrders.find(
    (order) => order.orderId === parsed.data.orderId,
  );
  if (!child) {
    throw notFound("Child order not found for this market checkout");
  }

  const guestToken = generateGuestToken();
  const tokenData: GuestTokenData = {
    orderId: String(child.orderId),
    restaurantId: child.restaurantId,
    guestName: "Guest",
    phoneLastDigits: parsed.data.phoneLastDigits,
    createdAt: Date.now(),
  };
  const fourHoursInSeconds = 4 * 60 * 60;
  const tokenExpiresAt = new Date(
    Date.now() + fourHoursInSeconds * 1000,
  ).toISOString();

  await c.env.CACHE_KV.put(
    `guest_token:${guestToken}`,
    JSON.stringify(tokenData),
    { expirationTtl: fourHoursInSeconds },
  );

  return c.json({
    success: true,
    data: {
      orderId: child.orderId,
      restaurantId: child.restaurantId,
      guestToken,
      tokenExpiresAt,
    },
  });
});

app.post("/:id/refund", authMiddleware, requireRole([0]), async (c) => {
  const checkoutId = c.req.param("id") ?? "";
  const body = await c.req.json().catch(() => ({}));
  const parsed = refundMarketCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const stored = await c.env.CACHE_KV.get(`market_checkout:${checkoutId}`);
  const session = stored
    ? (JSON.parse(stored) as MarketCheckoutSession)
    : await readPersistedMarketCheckoutSession(c.env, checkoutId);
  if (!session) {
    throw notFound("Market checkout not found");
  }

  const refundablePayments =
    session.payment?.childPayments.filter(
      (payment) => payment.status === "paid" && payment.paymentId,
    ) ?? [];
  if (!session.payment || refundablePayments.length === 0) {
    throw badRequest("Market checkout has no paid child payments to refund");
  }

  const refunds: Array<
    RefundPaymentResult &
      Pick<
        (typeof refundablePayments)[number],
        "restaurantId" | "restaurantName" | "orderNumber"
      >
  > = [];
  for (const payment of refundablePayments) {
    const refund = await refundPaymentTransaction(c.env, {
      transactionId: payment.paymentId!,
      reason: parsed.data.reason,
    });
    refunds.push({
      ...refund,
      restaurantId: payment.restaurantId,
      restaurantName: payment.restaurantName,
      orderNumber: payment.orderNumber,
    });
  }

  const refundedPaymentIds = new Set(
    refunds.map((refund) => refund.transactionId),
  );
  const childPayments = session.payment.childPayments.map((payment) =>
    payment.paymentId && refundedPaymentIds.has(payment.paymentId)
      ? {
          ...payment,
          status: "refunded" as const,
          refundId: refunds.find(
            (refund) => refund.transactionId === payment.paymentId,
          )?.refundId,
        }
      : payment,
  );
  const remainingPaidPayments = childPayments.filter(
    (payment) => payment.status === "paid",
  );
  const refundedAmount = refunds.reduce(
    (sum, refund) => sum + refund.amount,
    0,
  );
  const now = new Date().toISOString();
  const payment: MarketCheckoutPaymentSummary = {
    ...session.payment,
    status:
      remainingPaidPayments.length === 0 ? "refunded" : "partial_refunded",
    refundedAmount: (session.payment.refundedAmount ?? 0) + refundedAmount,
    refundedAmountCents:
      (session.payment.refundedAmountCents ?? 0) +
      Math.round(refundedAmount * 100),
    refundedAt: now,
    childPayments,
  };

  const updatedSession: MarketCheckoutSession = {
    ...session,
    payment,
  };

  await c.env.CACHE_KV.put(
    `market_checkout:${checkoutId}`,
    JSON.stringify(updatedSession),
    { expirationTtl: 4 * 60 * 60 },
  );
  await updatePersistedMarketCheckoutPayment(c.env, updatedSession);
  await upsertMarketCheckoutIndex(c.env.CACHE_KV, updatedSession);

  return c.json({
    success: true,
    data: {
      checkout: updatedSession,
      payment,
      refunds,
    },
  });
});

app.get("/admin/summary", authMiddleware, requireRole([0]), async (c) => {
  const marketSlug = c.req.query("marketSlug");
  const persistedItems = await readPersistedMarketCheckoutSummaryItems(c.env);
  const items =
    persistedItems.length > 0
      ? persistedItems
      : (await readMarketCheckoutIndex(c.env.CACHE_KV)).map((item) => ({
          ...item,
          payment: undefined,
        }));
  const filtered = items.filter((item) => {
    if (marketSlug && item.market.slug !== marketSlug) return false;
    return true;
  });

  return c.json({
    success: true,
    data: buildMarketCheckoutAdminSummary(filtered),
  });
});

app.get("/admin", authMiddleware, requireRole([0]), async (c) => {
  const page = coercePositiveInt(c.req.query("page"), 1);
  const limit = Math.min(coercePositiveInt(c.req.query("limit"), 20), 100);
  const marketSlug = c.req.query("marketSlug");
  const paymentStatus = c.req.query("paymentStatus");
  const status = c.req.query("status");

  const persistedIndex = await readPersistedMarketCheckoutIndex(c.env);
  const index =
    persistedIndex.length > 0
      ? persistedIndex
      : await readMarketCheckoutIndex(c.env.CACHE_KV);
  const filtered = index.filter((checkout) => {
    if (marketSlug && checkout.market.slug !== marketSlug) return false;
    if (paymentStatus && checkout.paymentStatus !== paymentStatus) return false;
    if (status && checkout.status !== status) return false;
    return true;
  });
  const offset = (page - 1) * limit;

  return c.json({
    success: true,
    data: {
      checkouts: filtered.slice(offset, offset + limit),
      total: filtered.length,
      page,
      limit,
    },
  });
});

app.get("/admin/:id", authMiddleware, requireRole([0]), async (c) => {
  const checkoutId = c.req.param("id") ?? "";
  const persisted = await readPersistedMarketCheckoutSession(c.env, checkoutId);
  if (persisted) {
    const checkout = await hydrateMarketCheckoutSession(persisted, c.env);

    return c.json({
      success: true,
      data: {
        checkout,
      },
    });
  }

  const stored = await c.env.CACHE_KV.get(`market_checkout:${checkoutId}`);
  if (!stored) {
    throw notFound("Market checkout not found");
  }

  const session = JSON.parse(stored) as MarketCheckoutSession;
  const checkout = await hydrateMarketCheckoutSession(session, c.env);

  return c.json({
    success: true,
    data: {
      checkout,
    },
  });
});

app.get("/:id", async (c) => {
  const checkoutId = c.req.param("id") ?? "";
  const persisted = await readPersistedMarketCheckoutSession(c.env, checkoutId);
  if (persisted) {
    const checkout = await hydrateMarketCheckoutSession(persisted, c.env);

    return c.json({
      success: true,
      data: {
        checkout,
      },
    });
  }

  const stored = await c.env.CACHE_KV.get(`market_checkout:${checkoutId}`);
  if (!stored) {
    throw notFound("Market checkout not found");
  }

  const session = JSON.parse(stored) as MarketCheckoutSession;
  const checkout = await hydrateMarketCheckoutSession(session, c.env);

  return c.json({
    success: true,
    data: {
      checkout,
    },
  });
});

export default app;

async function hydrateMarketCheckoutSession(
  session: MarketCheckoutSession,
  env: Env,
): Promise<MarketCheckoutSession> {
  const ordersService = new OrdersService(env);
  const childOrders = await Promise.all(
    session.childOrders.map(async (child) => {
      try {
        const order = await ordersService.getOrder(child.orderId, false);
        if (!order) return child;

        return {
          ...child,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          totalAmountCents: orderTotalCents(order),
          status: order.status,
          paymentStatus: order.paymentStatus,
          updatedAt: order.updatedAt,
        };
      } catch {
        return child;
      }
    }),
  );

  return {
    ...session,
    childOrders,
  };
}

function orderTotalCents(order: {
  totalAmount: number;
  totalAmountCents?: number | null;
}) {
  return Number(
    order.totalAmountCents ?? Math.round(Number(order.totalAmount ?? 0) * 100),
  );
}

function buildMarketCheckoutOrderNotes(input: {
  marketName: string;
  marketSlug: string;
  checkoutId: string;
  checkoutNotes?: string;
  vendorNotes?: string;
}) {
  return [
    `市場結帳：${input.marketName} / ${input.marketSlug} / ${input.checkoutId}`,
    input.checkoutNotes,
    input.vendorNotes,
  ]
    .filter(Boolean)
    .join("\n");
}

async function persistMarketCheckoutSession(
  env: Env,
  session: MarketCheckoutSession,
) {
  const db = createDatabase(env.DB);
  const createdAt = new Date(session.createdAt);

  await db.insert(marketCheckoutSessions).values({
    id: session.id,
    marketId: session.market.id,
    marketSlug: session.market.slug,
    marketName: session.market.name,
    status: session.status,
    paymentStatus: session.payment?.status ?? "pending",
    phoneLastDigits: session.phoneLastDigits ?? null,
    subtotalCents: session.subtotal,
    childOrderCount: session.childOrders.length,
    paymentSummary: serializePaymentSummary(session.payment),
    createdAt,
    updatedAt: createdAt,
  });

  if (session.childOrders.length === 0) return;

  await db.insert(marketCheckoutChildOrders).values(
    session.childOrders.map((child) => ({
      checkoutId: session.id,
      restaurantId: child.restaurantId,
      restaurantName: child.restaurantName,
      orderId: child.orderId,
      orderNumber: child.orderNumber,
      totalAmount: child.totalAmount,
      totalAmountCents: orderChildTotalCents(child),
      tokenExpiresAt: new Date(child.tokenExpiresAt),
      createdAt,
    })),
  );
}

async function updatePersistedMarketCheckoutPayment(
  env: Env,
  session: MarketCheckoutSession,
) {
  if (!session.payment) return;

  const db = createDatabase(env.DB);
  await db
    .update(marketCheckoutSessions)
    .set({
      paymentStatus: session.payment.status,
      paymentSummary: serializePaymentSummary(session.payment),
      updatedAt: new Date(),
    })
    .where(eq(marketCheckoutSessions.id, session.id));
}

async function readPersistedMarketCheckoutIndex(
  env: Env,
): Promise<MarketCheckoutIndexItem[]> {
  const db = createDatabase(env.DB);
  const rows = await db
    .select()
    .from(marketCheckoutSessions)
    .orderBy(desc(marketCheckoutSessions.createdAt))
    .limit(MARKET_CHECKOUT_INDEX_LIMIT)
    .all();

  return rows.map((row) => ({
    id: row.id,
    market: {
      id: row.marketId,
      slug: row.marketSlug,
      name: row.marketName,
    },
    status: row.status as MarketCheckoutSession["status"],
    paymentStatus:
      row.paymentStatus as MarketCheckoutIndexItem["paymentStatus"],
    subtotal: row.subtotalCents,
    childOrderCount: row.childOrderCount,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }));
}

async function readPersistedMarketCheckoutSummaryItems(
  env: Env,
): Promise<MarketCheckoutSummaryItem[]> {
  const db = createDatabase(env.DB);
  const rows = await db
    .select()
    .from(marketCheckoutSessions)
    .orderBy(desc(marketCheckoutSessions.createdAt))
    .limit(MARKET_CHECKOUT_INDEX_LIMIT)
    .all();

  return rows.map((row) => ({
    id: row.id,
    market: {
      id: row.marketId,
      slug: row.marketSlug,
      name: row.marketName,
    },
    status: row.status as MarketCheckoutSession["status"],
    paymentStatus:
      row.paymentStatus as MarketCheckoutIndexItem["paymentStatus"],
    subtotal: row.subtotalCents,
    childOrderCount: row.childOrderCount,
    payment: (row.paymentSummary ?? undefined) as
      | MarketCheckoutPaymentSummary
      | undefined,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }));
}

function buildMarketCheckoutAdminSummary(items: MarketCheckoutSummaryItem[]) {
  const paymentStatusCounts: Record<string, number> = {
    pending: 0,
    partial_paid: 0,
    paid: 0,
    failed: 0,
    refunded: 0,
    partial_refunded: 0,
  };
  const markets = new Map<
    string,
    {
      id: string;
      slug: string;
      name: string;
      checkoutCount: number;
      subtotalCents: number;
      paidAmountCents: number;
      refundedAmountCents: number;
    }
  >();

  let subtotalCents = 0;
  let paidAmountCents = 0;
  let refundedAmountCents = 0;
  let childOrderCount = 0;

  for (const item of items) {
    const status = item.paymentStatus ?? "pending";
    paymentStatusCounts[status] = (paymentStatusCounts[status] ?? 0) + 1;
    subtotalCents += item.subtotal;
    paidAmountCents += item.payment?.paidAmountCents ?? 0;
    refundedAmountCents += item.payment?.refundedAmountCents ?? 0;
    childOrderCount += item.childOrderCount;

    const market = markets.get(item.market.slug) ?? {
      id: item.market.id,
      slug: item.market.slug,
      name: item.market.name,
      checkoutCount: 0,
      subtotalCents: 0,
      paidAmountCents: 0,
      refundedAmountCents: 0,
    };
    market.checkoutCount += 1;
    market.subtotalCents += item.subtotal;
    market.paidAmountCents += item.payment?.paidAmountCents ?? 0;
    market.refundedAmountCents += item.payment?.refundedAmountCents ?? 0;
    markets.set(item.market.slug, market);
  }

  return {
    totalCheckouts: items.length,
    totalSubtotalCents: subtotalCents,
    paidAmountCents,
    refundedAmountCents,
    netPaidAmountCents: paidAmountCents - refundedAmountCents,
    averageCheckoutCents:
      items.length > 0 ? Math.round(subtotalCents / items.length) : 0,
    childOrderCount,
    paymentStatusCounts,
    topMarkets: Array.from(markets.values())
      .sort((a, b) => b.subtotalCents - a.subtotalCents)
      .slice(0, 5),
  };
}

async function readPersistedMarketCheckoutSession(
  env: Env,
  checkoutId: string,
): Promise<MarketCheckoutSession | null> {
  const db = createDatabase(env.DB);
  const row = await db
    .select()
    .from(marketCheckoutSessions)
    .where(eq(marketCheckoutSessions.id, checkoutId))
    .get();
  if (!row) return null;

  const children = await db
    .select()
    .from(marketCheckoutChildOrders)
    .where(eq(marketCheckoutChildOrders.checkoutId, checkoutId))
    .all();

  return {
    id: row.id,
    market: {
      id: row.marketId,
      slug: row.marketSlug,
      name: row.marketName,
    },
    status: row.status as MarketCheckoutSession["status"],
    phoneLastDigits: row.phoneLastDigits ?? undefined,
    childOrders: children.map((child) => ({
      restaurantId: child.restaurantId,
      restaurantName: child.restaurantName,
      orderId: child.orderId,
      orderNumber: child.orderNumber,
      totalAmount: child.totalAmount,
      totalAmountCents: child.totalAmountCents,
      tokenExpiresAt: toIsoString(child.tokenExpiresAt),
    })),
    payment: (row.paymentSummary ?? undefined) as
      | MarketCheckoutPaymentSummary
      | undefined,
    subtotal: row.subtotalCents,
    createdAt: toIsoString(row.createdAt),
  };
}

function orderChildTotalCents(child: MarketCheckoutChildOrder) {
  return Number(
    child.totalAmountCents ?? Math.round(Number(child.totalAmount ?? 0) * 100),
  );
}

function toIsoString(value: Date | number | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

function serializePaymentSummary(
  payment: MarketCheckoutPaymentSummary | undefined,
): Record<string, unknown> | null {
  if (!payment) return null;
  return JSON.parse(JSON.stringify(payment)) as Record<string, unknown>;
}

async function readMarketCheckoutIndex(
  kv: KVNamespace,
): Promise<MarketCheckoutIndexItem[]> {
  const stored = await kv.get(MARKET_CHECKOUT_INDEX_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isMarketCheckoutIndexItem)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  } catch {
    return [];
  }
}

async function upsertMarketCheckoutIndex(
  kv: KVNamespace,
  session: MarketCheckoutSession,
) {
  const summary: MarketCheckoutIndexItem = {
    id: session.id,
    market: session.market,
    status: session.status,
    paymentStatus: session.payment?.status ?? "pending",
    subtotal: session.subtotal,
    childOrderCount: session.childOrders.length,
    createdAt: session.createdAt,
    updatedAt: new Date().toISOString(),
  };
  const nextIndex = [
    summary,
    ...(await readMarketCheckoutIndex(kv)).filter(
      (checkout) => checkout.id !== session.id,
    ),
  ].slice(0, MARKET_CHECKOUT_INDEX_LIMIT);

  await kv.put(MARKET_CHECKOUT_INDEX_KEY, JSON.stringify(nextIndex), {
    expirationTtl: 4 * 60 * 60,
  });
}

function isMarketCheckoutIndexItem(
  value: unknown,
): value is MarketCheckoutIndexItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<MarketCheckoutIndexItem>;
  return (
    typeof item.id === "string" &&
    item.market !== undefined &&
    typeof item.market.id === "string" &&
    typeof item.market.slug === "string" &&
    typeof item.market.name === "string" &&
    item.status === "submitted" &&
    typeof item.subtotal === "number" &&
    typeof item.childOrderCount === "number" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function coercePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
