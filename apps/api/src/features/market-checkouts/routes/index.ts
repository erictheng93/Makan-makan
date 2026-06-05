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
  ApiError,
  badRequest,
  conflict,
  forbidden,
  notFound,
} from "../../../shared/utils/api-error";
import { enforceQuota } from "../../../middleware/quotaGate";
import { meterEmit } from "../../../shared/utils/meter";
import { rateLimitMiddleware } from "../../../middleware/rateLimiter";
import {
  generateGuestToken,
  type GuestTokenData,
} from "../../../middleware/guestAuth";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { OrdersService } from "../../orders/services/OrdersService";
import type { OrderPaymentStatus, OrderStatus } from "../../orders/types";
import {
  refundPaymentTransaction,
  type RefundPaymentResult,
} from "../../payments/services/refundPayment";
import {
  checkMarketCheckoutPaymentProviderConnectivity,
  createMarketCheckoutPaymentProvider,
  getMarketCheckoutPaymentProviderStatus,
  queryMarketCheckoutProviderSplitStatus,
  refundCreditMarketCheckoutPayment,
  refundMarketCheckoutProviderSplitPayment,
  type MarketCheckoutProviderNextAction,
  type MarketCheckoutSplitMode,
} from "../services/MarketCheckoutPaymentProvider";
import { MarketCheckoutPaymentReconciliationService } from "../services/MarketCheckoutPaymentReconciliationService";
import { MarketCheckoutPaymentWebhookService } from "../services/MarketCheckoutPaymentWebhookService";
import {
  MarketCheckoutVoucherService,
  type AppliedVoucher,
} from "../services/MarketCheckoutVoucherService";
import { fromCents } from "../../../shared/utils/money";
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
  providerInput: z.record(z.string(), z.unknown()).optional(),
});

const recoverMarketCheckoutGuestTokenSchema = z.object({
  orderId: z.number().int().positive(),
  phoneLastDigits: z.string().regex(/^\d{3}$/),
});

const refundMarketCheckoutSchema = z.object({
  reason: z.string().max(500).optional(),
});

app.post("/payment-webhooks/:provider", async (c) => {
  const provider = c.req.param("provider").toLowerCase();
  const rawBody = await c.req.text();

  let result;
  try {
    result = await new MarketCheckoutPaymentWebhookService(c.env).handle(
      provider,
      rawBody,
      c.req.raw.headers,
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw badRequest("Invalid webhook JSON");
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      "MARKET_CHECKOUT_WEBHOOK_SIGNATURE_INVALID",
      error instanceof Error ? error.message : "Invalid webhook signature",
      401,
    );
  }

  return c.json({
    success: true,
    data: result,
  });
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
    platformFeeRateBps?: number;
  };
  status: "submitted";
  phoneLastDigits?: string;
  childOrders: MarketCheckoutChildOrder[];
  payment?: MarketCheckoutPaymentSummary;
  subtotal: number;
  /** MVP voucher (卷) applied to this checkout; KV-session scoped. */
  appliedVoucher?: AppliedVoucher;
  createdAt: string;
}

interface MarketCheckoutIndexItem {
  id: string;
  market: MarketCheckoutSession["market"];
  status: MarketCheckoutSession["status"];
  paymentStatus: MarketCheckoutPaymentSummary["status"] | "pending";
  subtotal: number;
  childOrderCount: number;
  operationAlerts?: MarketCheckoutOperationAlert[];
  createdAt: string;
  updatedAt: string;
}

interface MarketCheckoutOperationAlert {
  type:
    | "provider_pending_stale"
    | "provider_webhook_missing"
    | "provider_webhook_failed"
    | "provider_status_mismatch"
    | "provider_refund_pending"
    | "provider_refund_failed";
  label: string;
  severity: "warning" | "critical";
}

interface MarketCheckoutSummaryItem extends MarketCheckoutIndexItem {
  payment?: MarketCheckoutPaymentSummary;
}

interface MarketCheckoutVendorSettlement {
  restaurantId: string;
  restaurantName: string;
  checkoutCount: number;
  childOrderCount: number;
  subtotalCents: number;
  paidAmountCents: number;
  refundedAmountCents: number;
  netPaidAmountCents: number;
  platformFeeCents: number;
  vendorNetAmountCents: number;
  refundedPaymentCount: number;
  failedPaymentCount: number;
}

interface MarketCheckoutSettlementSummary {
  platformFeeRateBps: number;
  platformFeeCents: number;
  vendorNetAmountCents: number;
  vendorAllocations: Array<{
    restaurantId: string;
    restaurantName: string;
    orderId: number;
    orderNumber: string;
    grossAmountCents: number;
    refundedAmountCents: number;
    platformFeeCents: number;
    netAmountCents: number;
  }>;
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
  parentPayment?: MarketCheckoutParentPaymentSummary;
  settlement?: MarketCheckoutSettlementSummary;
}

interface MarketCheckoutParentPaymentSummary {
  paymentId: string;
  status: MarketCheckoutPaymentSummary["status"];
  provider: string;
  splitMode: MarketCheckoutSplitMode;
  idempotencyKey: string;
  providerTransactionId?: string;
  nextAction?: MarketCheckoutProviderNextAction;
  lastWebhook?: MarketCheckoutProviderLastWebhook;
  lastReconciliation?: MarketCheckoutProviderLastWebhook;
  lastRefund?: MarketCheckoutProviderLastWebhook;
  amountCents: number;
  paidAmountCents: number;
  refundedAmountCents: number;
  childPaymentIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface MarketCheckoutProviderLastWebhook {
  provider: string;
  eventId?: string | null;
  eventType: string;
  status: string;
  receivedAt: string;
  payload?: unknown;
  payloadSummary?: MarketCheckoutProviderPayloadSummary;
}

interface MarketCheckoutProviderPayloadSummary {
  objectId?: string;
  providerTransactionId?: string;
  status?: string;
  amountCents?: number;
  amountReceivedCents?: number;
  amountRefundedCents?: number;
  currency?: string;
  metadataKeys?: string[];
  failureCode?: string;
  failureReason?: string;
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
      platformFeeRateBps: market.platformFeeRateBps,
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

const applyVoucherSchema = z.object({
  code: z.string().min(1).max(64),
});

// Apply a platform-wide 卷 (voucher) code to an unpaid market checkout. MVP:
// anonymous code redemption, KV-session scoped. See
// docs/superpowers/specs/2026-06-03-market-checkout-voucher-redemption.md.
app.post("/:id/voucher", async (c) => {
  const checkoutId = c.req.param("id");
  const stored = await c.env.CACHE_KV.get(`market_checkout:${checkoutId}`);
  const session = stored
    ? (JSON.parse(stored) as MarketCheckoutSession)
    : await readPersistedMarketCheckoutSession(c.env, checkoutId);

  if (!session) {
    throw notFound("Market checkout not found");
  }
  if (session.payment?.status === "paid") {
    throw badRequest(
      "This checkout is already paid",
      "MARKET_CHECKOUT_ALREADY_PAID",
    );
  }

  const body = await c.req.json();
  const parsed = applyVoucherSchema.safeParse(body);
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

  const voucherChildOrders = session.childOrders.map((child) => ({
    orderId: child.orderId,
    amountCents: orderChildTotalCents(child),
  }));
  const subtotalCents = voucherChildOrders.reduce(
    (sum, child) => sum + child.amountCents,
    0,
  );

  const voucherService = new MarketCheckoutVoucherService(c.env);
  const appliedVoucher = await voucherService.validateAndPrice({
    code: parsed.data.code,
    subtotalCents,
    childOrders: voucherChildOrders,
  });

  const updatedSession: MarketCheckoutSession = { ...session, appliedVoucher };
  await c.env.CACHE_KV.put(
    `market_checkout:${checkoutId}`,
    JSON.stringify(updatedSession),
    { expirationTtl: 4 * 60 * 60 },
  );

  return c.json({
    success: true,
    data: {
      checkout: updatedSession,
      voucher: appliedVoucher,
      subtotalCents,
      discountCents: appliedVoucher.discountCents,
      payableCents: Math.max(0, subtotalCents - appliedVoucher.discountCents),
    },
  });
});

// Remove an applied voucher from an unpaid market checkout.
app.delete("/:id/voucher", async (c) => {
  const checkoutId = c.req.param("id");
  const stored = await c.env.CACHE_KV.get(`market_checkout:${checkoutId}`);
  const session = stored
    ? (JSON.parse(stored) as MarketCheckoutSession)
    : await readPersistedMarketCheckoutSession(c.env, checkoutId);

  if (!session) {
    throw notFound("Market checkout not found");
  }
  if (session.payment?.status === "paid") {
    throw badRequest(
      "This checkout is already paid",
      "MARKET_CHECKOUT_ALREADY_PAID",
    );
  }

  const { appliedVoucher: _removed, ...rest } = session;
  const updatedSession = rest as MarketCheckoutSession;
  await c.env.CACHE_KV.put(
    `market_checkout:${checkoutId}`,
    JSON.stringify(updatedSession),
    { expirationTtl: 4 * 60 * 60 },
  );

  return c.json({ success: true, data: { checkout: updatedSession } });
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

  const requestIdempotencyKey = c.req.header("Idempotency-Key");
  const paymentProvider = createMarketCheckoutPaymentProvider(
    c.env,
    parsed.data.method,
  );
  const providerSplitMode =
    parsed.data.method === "credits"
      ? "provider_split"
      : c.env.MARKET_CHECKOUT_SPLIT_MODE === "provider_split"
        ? "provider_split"
        : "child_transactions";
  // A 卷 (voucher), if applied, is funded proportionally per vendor: the amount
  // sent to the provider for each child order is reduced by its discount share,
  // so allocations still sum to the aggregate charge (provider contract).
  const appliedVoucher = session.appliedVoucher;
  const voucherDiscountByOrderId = new Map<number, number>(
    appliedVoucher
      ? appliedVoucher.allocations.map((alloc) => [
          alloc.orderId,
          alloc.discountCents,
        ])
      : [],
  );
  const payableChildOrders: MarketCheckoutChildOrder[] = appliedVoucher
    ? session.childOrders.map((child) => {
        const originalCents = orderChildTotalCents(child);
        const netCents = Math.max(
          0,
          originalCents - (voucherDiscountByOrderId.get(child.orderId) ?? 0),
        );
        return {
          ...child,
          totalAmount: fromCents(netCents),
          totalAmountCents: netCents,
        };
      })
    : session.childOrders;
  const payableSession: MarketCheckoutSession = appliedVoucher
    ? { ...session, childOrders: payableChildOrders }
    : session;

  let providerResult;
  try {
    providerResult = await paymentProvider.process({
      checkoutId,
      marketSlug: session.market.slug,
      childOrders: payableChildOrders,
      existingChildPayments: session.payment?.childPayments,
      method: parsed.data.method,
      country: parsed.data.country,
      currency: parsed.data.currency,
      customerInfo: parsed.data.customerInfo,
      providerInput: parsed.data.providerInput,
      requestIdempotencyKey: requestIdempotencyKey ?? undefined,
    });
  } catch (error) {
    const failedPayment = buildFailedMarketCheckoutPayment({
      checkoutId,
      session,
      method: parsed.data.method,
      country: parsed.data.country,
      currency: parsed.data.currency,
      provider: parsed.data.method,
      splitMode: providerSplitMode,
      idempotencyKey: requestIdempotencyKey ?? `market-checkout:${checkoutId}`,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Market checkout payment failed",
    });
    const failedSession: MarketCheckoutSession = {
      ...session,
      payment: failedPayment,
    };

    await c.env.CACHE_KV.put(
      `market_checkout:${checkoutId}`,
      JSON.stringify(failedSession),
      {
        expirationTtl: 4 * 60 * 60,
      },
    );
    await updatePersistedMarketCheckoutPayment(c.env, failedSession);
    await upsertMarketCheckoutIndex(c.env.CACHE_KV, failedSession);

    return c.json(
      {
        success: true,
        data: {
          checkout: failedSession,
          payment: failedPayment,
        },
      },
      202,
    );
  }
  const childPayments = providerResult.childPayments;
  const paidPayments = childPayments.filter(
    (payment) => payment?.status === "paid",
  );
  const totalAmount = payableChildOrders.reduce(
    (sum, child) => sum + Number(child.totalAmount ?? 0),
    0,
  );
  const paidAmount = paidPayments.reduce(
    (sum, child) => sum + Number(child?.amount ?? 0),
    0,
  );
  const paymentStatus =
    providerResult.paymentStatus === "pending"
      ? "pending"
      : paidPayments.length === session.childOrders.length
        ? "paid"
        : paidPayments.length > 0
          ? "partial_paid"
          : "failed";
  const now = new Date().toISOString();
  const paymentBase: MarketCheckoutPaymentSummary = {
    status: paymentStatus,
    method: parsed.data.method,
    currency: parsed.data.currency,
    country: parsed.data.country,
    totalAmount,
    totalAmountCents: Math.round(totalAmount * 100),
    paidAmount,
    paidAmountCents: Math.round(paidAmount * 100),
    paidAt: paymentStatus === "paid" ? now : session.payment?.paidAt,
    failedAt: paymentStatus === "failed" ? now : session.payment?.failedAt,
    childPayments: childPayments.filter(
      (
        payment,
      ): payment is MarketCheckoutPaymentSummary["childPayments"][number] =>
        payment !== undefined,
    ),
  };
  const payment: MarketCheckoutPaymentSummary = {
    ...paymentBase,
    parentPayment: buildMarketCheckoutParentPayment({
      checkoutId,
      existing: session.payment?.parentPayment,
      payment: paymentBase,
      provider: providerResult.provider,
      splitMode: providerResult.splitMode,
      idempotencyKey: providerResult.idempotencyKey,
      providerTransactionId: providerResult.providerTransactionId,
      nextAction: providerResult.nextAction,
      now,
    }),
    settlement: buildMarketCheckoutSettlement(payableSession, paymentBase),
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

  // Record voucher redemption only on verified full payment. Idempotent on
  // replay; a failure here must not fail the payment response (audit-only).
  if (appliedVoucher && updatedSession.payment?.status === "paid") {
    try {
      await new MarketCheckoutVoucherService(c.env).redeem(appliedVoucher);
    } catch (error) {
      console.error(
        `Voucher redemption failed for checkout ${checkoutId}:`,
        error,
      );
    }
  }

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

app.post(
  "/:id/guest-token",
  // Per-IP throttle (defense-in-depth). The per-checkout failure counter below
  // is the targeted brute-force defence; this guards against one IP probing
  // many checkouts.
  rateLimitMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    keyPrefix: "market_guest_token_recover",
    message: "Too many guest token recovery attempts. Please try again later.",
  }),
  async (c) => {
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

    // Per-checkout brute-force lockout: the phone code is only 3 digits, so
    // lock the recovery flow for a checkout after a few failed attempts —
    // regardless of source IP — so the 1000-value space cannot be enumerated.
    const attemptsKey = `market_checkout_recover_attempts:${checkoutId}`;
    const MAX_RECOVER_ATTEMPTS = 5;
    const RECOVER_LOCK_TTL_SECONDS = 60 * 60; // 1 hour
    const priorAttempts = Number((await c.env.CACHE_KV.get(attemptsKey)) ?? 0);
    if (priorAttempts >= MAX_RECOVER_ATTEMPTS) {
      return c.json(
        {
          success: false,
          error:
            "Too many failed verification attempts for this checkout. Please try again later.",
        },
        429,
      );
    }

    // Fail closed: a session without a stored phone code cannot be recovered,
    // and the supplied code must match unconditionally. A failed attempt
    // increments the per-checkout counter.
    if (
      !session.phoneLastDigits ||
      session.phoneLastDigits !== parsed.data.phoneLastDigits
    ) {
      await c.env.CACHE_KV.put(attemptsKey, String(priorAttempts + 1), {
        expirationTtl: RECOVER_LOCK_TTL_SECONDS,
      });
      return c.json(
        {
          success: false,
          error: "Phone verification failed for this market checkout",
        },
        403,
      );
    }

    // Successful verification clears the failure counter.
    await c.env.CACHE_KV.delete(attemptsKey);

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
  },
);

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

  if (!session.payment) {
    throw badRequest("Market checkout has no paid child payments to refund");
  }

  const parentPayment = session.payment.parentPayment;
  if (parentPayment?.splitMode === "provider_split") {
    if (!parentPayment.providerTransactionId) {
      throw badRequest(
        "Market checkout provider payment has no provider transaction to refund",
      );
    }
    if (
      session.payment.status !== "paid" &&
      session.payment.status !== "partial_paid"
    ) {
      throw badRequest("Market checkout provider payment is not refundable");
    }

    const refundableChildPayments = session.payment.childPayments.filter(
      (payment) => payment.status === "paid",
    );
    const allocations =
      refundableChildPayments.length > 0
        ? refundableChildPayments.map((payment) => ({
            restaurantId: payment.restaurantId,
            restaurantName: payment.restaurantName,
            orderId: payment.orderId,
            orderNumber: payment.orderNumber,
            amountCents: payment.amountCents,
          }))
        : session.childOrders.map((child) => ({
            restaurantId: child.restaurantId,
            restaurantName: child.restaurantName,
            orderId: child.orderId,
            orderNumber: child.orderNumber,
            amountCents: orderChildTotalCents(child),
          }));
    const amountCents = allocations.reduce(
      (sum, allocation) => sum + allocation.amountCents,
      0,
    );
    if (amountCents <= 0) {
      throw badRequest("Market checkout provider payment is not refundable");
    }

    const providerRefund =
      parentPayment.provider === "credit_balance"
        ? await refundCreditMarketCheckoutPayment(c.env, {
            spendIdempotencyKey: parentPayment.idempotencyKey,
            refundIdempotencyKey: `${parentPayment.idempotencyKey}:refund`,
            amountCents,
            currency: session.payment.currency,
            checkoutId,
            providerTransactionId: parentPayment.providerTransactionId,
          })
        : await refundMarketCheckoutProviderSplitPayment(c.env, {
            checkoutId,
            paymentId: parentPayment.paymentId,
            provider: parentPayment.provider,
            providerTransactionId: parentPayment.providerTransactionId,
            idempotencyKey: `${parentPayment.idempotencyKey}:refund`,
            amountCents,
            currency: session.payment.currency,
            reason: parsed.data.reason,
            allocations,
          });
    const now = new Date().toISOString();
    const lastRefund: MarketCheckoutProviderLastWebhook = {
      provider: providerRefund.provider,
      eventId: providerRefund.eventId ?? providerRefund.refundId,
      eventType:
        providerRefund.eventType ??
        `market_checkout.refund_${providerRefund.status}`,
      status: providerRefund.status,
      receivedAt: now,
      payloadSummary: summarizeProviderPayload({
        providerTransactionId:
          providerRefund.providerTransactionId ??
          parentPayment.providerTransactionId,
        status: providerRefund.status,
        amountRefundedCents: providerRefund.refundedAmountCents,
        currency: providerRefund.currency ?? session.payment.currency,
        providerPayload: providerRefund.providerPayload,
      }),
    };
    const refundCompleted =
      providerRefund.status === "refunded" ||
      providerRefund.status === "partial_refunded";
    const refundedAmountCents = refundCompleted
      ? providerRefund.refundedAmountCents
      : 0;
    const refundedAmount = refundedAmountCents / 100;
    const refundedOrderIds = new Set(allocations.map((item) => item.orderId));
    const childPayments = session.payment.childPayments.map((payment) =>
      refundCompleted && refundedOrderIds.has(payment.orderId)
        ? {
            ...payment,
            status: "refunded" as const,
            refundId: providerRefund.refundId,
          }
        : payment,
    );
    const paymentBase: MarketCheckoutPaymentSummary = {
      ...session.payment,
      status: refundCompleted ? providerRefund.status : session.payment.status,
      refundedAmount: (session.payment.refundedAmount ?? 0) + refundedAmount,
      refundedAmountCents:
        (session.payment.refundedAmountCents ?? 0) + refundedAmountCents,
      refundedAt: refundCompleted ? now : session.payment.refundedAt,
      childPayments,
    };
    const payment: MarketCheckoutPaymentSummary = {
      ...paymentBase,
      parentPayment: buildMarketCheckoutParentPayment({
        checkoutId,
        existing: parentPayment,
        payment: paymentBase,
        provider: parentPayment.provider,
        splitMode: parentPayment.splitMode,
        idempotencyKey: parentPayment.idempotencyKey,
        providerTransactionId:
          providerRefund.providerTransactionId ??
          parentPayment.providerTransactionId,
        lastRefund,
        now,
      }),
      settlement: buildMarketCheckoutSettlement(session, paymentBase),
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
    if (refundCompleted) {
      await markMarketCheckoutVoucherRefunded(c.env, session, [
        ...refundedOrderIds,
      ]);
    }

    return c.json({
      success: true,
      data: {
        checkout: updatedSession,
        payment,
        refunds: [
          {
            refundId: providerRefund.refundId,
            transactionId: parentPayment.paymentId,
            orderId: 0,
            amount: providerRefund.refundedAmountCents / 100,
            status: providerRefund.status === "failed" ? "failed" : "completed",
            paymentStatus: providerRefund.status,
            provider: providerRefund.provider,
            providerTransactionId: providerRefund.providerTransactionId,
            restaurantId: session.market.id,
            restaurantName: session.market.name,
            orderNumber: checkoutId,
          },
        ],
      },
    });
  }

  const refundablePayments =
    session.payment?.childPayments.filter(
      (payment) => payment.status === "paid" && payment.paymentId,
    ) ?? [];
  if (refundablePayments.length === 0) {
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
  const paymentBase: MarketCheckoutPaymentSummary = {
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
  const payment: MarketCheckoutPaymentSummary = {
    ...paymentBase,
    parentPayment: session.payment.parentPayment
      ? buildMarketCheckoutParentPayment({
          checkoutId,
          existing: session.payment.parentPayment,
          payment: paymentBase,
          provider: session.payment.parentPayment.provider,
          splitMode: session.payment.parentPayment.splitMode,
          idempotencyKey: session.payment.parentPayment.idempotencyKey,
          providerTransactionId:
            session.payment.parentPayment.providerTransactionId,
          now,
        })
      : undefined,
    settlement: buildMarketCheckoutSettlement(session, paymentBase),
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
  await markMarketCheckoutVoucherRefunded(
    c.env,
    session,
    refunds.map((refund) => refund.orderId),
  );

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
  const paymentStatus = c.req.query("paymentStatus");
  const dateRange = parseMarketCheckoutDateRange(c);
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
    if (paymentStatus && item.paymentStatus !== paymentStatus) return false;
    if (!isWithinMarketCheckoutDateRange(item.createdAt, dateRange)) {
      return false;
    }
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
  const operationAlert = c.req.query("operationAlert");
  const status = c.req.query("status");
  const dateRange = parseMarketCheckoutDateRange(c);

  const persistedIndex = await readPersistedMarketCheckoutIndex(c.env);
  const index =
    persistedIndex.length > 0
      ? persistedIndex
      : await readMarketCheckoutIndex(c.env.CACHE_KV);
  const filtered = index.filter((checkout) => {
    if (marketSlug && checkout.market.slug !== marketSlug) return false;
    if (paymentStatus && checkout.paymentStatus !== paymentStatus) return false;
    if (
      operationAlert &&
      !checkout.operationAlerts?.some((alert) => alert.type === operationAlert)
    ) {
      return false;
    }
    if (status && checkout.status !== status) return false;
    if (!isWithinMarketCheckoutDateRange(checkout.createdAt, dateRange)) {
      return false;
    }
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

app.get("/admin/export", authMiddleware, requireRole([0]), async (c) => {
  const marketSlug = c.req.query("marketSlug");
  const paymentStatus = c.req.query("paymentStatus");
  const operationAlert = c.req.query("operationAlert");
  const status = c.req.query("status");
  const dateRange = parseMarketCheckoutDateRange(c);
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
    if (paymentStatus && item.paymentStatus !== paymentStatus) return false;
    if (
      operationAlert &&
      !item.operationAlerts?.some((alert) => alert.type === operationAlert)
    ) {
      return false;
    }
    if (status && item.status !== status) return false;
    if (!isWithinMarketCheckoutDateRange(item.createdAt, dateRange)) {
      return false;
    }
    return true;
  });

  const csv = buildMarketCheckoutCsv(filtered);
  const suffix = new Date().toISOString().slice(0, 10);

  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="market-checkouts-${suffix}.csv"`,
  });
});

app.get("/admin/vendors", authMiddleware, requireRole([0]), async (c) => {
  const marketSlug = c.req.query("marketSlug");
  const paymentStatus = c.req.query("paymentStatus");
  const dateRange = parseMarketCheckoutDateRange(c);
  const sessions = await readPersistedMarketCheckoutOpsSessions(c.env);
  const filtered = sessions.filter((session) => {
    if (marketSlug && session.market.slug !== marketSlug) return false;
    if (
      paymentStatus &&
      (session.payment?.status ?? "pending") !== paymentStatus
    ) {
      return false;
    }
    if (!isWithinMarketCheckoutDateRange(session.createdAt, dateRange)) {
      return false;
    }
    return true;
  });

  return c.json({
    success: true,
    data: {
      vendors: buildMarketCheckoutVendorSettlements(filtered),
    },
  });
});

app.get(
  "/admin/vendors/export",
  authMiddleware,
  requireRole([0]),
  async (c) => {
    const marketSlug = c.req.query("marketSlug");
    const paymentStatus = c.req.query("paymentStatus");
    const dateRange = parseMarketCheckoutDateRange(c);
    const sessions = await readPersistedMarketCheckoutOpsSessions(c.env);
    const filtered = sessions.filter((session) => {
      if (marketSlug && session.market.slug !== marketSlug) return false;
      if (
        paymentStatus &&
        (session.payment?.status ?? "pending") !== paymentStatus
      ) {
        return false;
      }
      if (!isWithinMarketCheckoutDateRange(session.createdAt, dateRange)) {
        return false;
      }
      return true;
    });
    const csv = buildMarketCheckoutVendorSettlementCsv(
      buildMarketCheckoutVendorSettlements(filtered),
    );
    const suffix = new Date().toISOString().slice(0, 10);

    return c.body(csv, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="market-checkout-vendors-${suffix}.csv"`,
    });
  },
);

app.get(
  "/admin/accounting/export",
  authMiddleware,
  requireRole([0]),
  async (c) => {
    const marketSlug = c.req.query("marketSlug");
    const paymentStatus = c.req.query("paymentStatus");
    const dateRange = parseMarketCheckoutDateRange(c);
    const sessions = await readPersistedMarketCheckoutOpsSessions(c.env);
    const filtered = sessions.filter((session) => {
      if (marketSlug && session.market.slug !== marketSlug) return false;
      if (
        paymentStatus &&
        (session.payment?.status ?? "pending") !== paymentStatus
      ) {
        return false;
      }
      if (!isWithinMarketCheckoutDateRange(session.createdAt, dateRange)) {
        return false;
      }
      return true;
    });
    const csv = buildMarketCheckoutAccountingCsv(filtered);
    const suffix = new Date().toISOString().slice(0, 10);

    return c.body(csv, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="market-checkout-accounting-${suffix}.csv"`,
    });
  },
);

app.get("/admin/provider-status", authMiddleware, requireRole([0]), async (c) =>
  c.json({
    success: true,
    data: getMarketCheckoutPaymentProviderStatus(c.env),
  }),
);

app.post(
  "/admin/provider-status/check",
  authMiddleware,
  requireRole([0]),
  async (c) =>
    c.json({
      success: true,
      data: await checkMarketCheckoutPaymentProviderConnectivity(c.env),
    }),
);

app.post(
  "/admin/:id/reconcile",
  authMiddleware,
  requireRole([0]),
  async (c) => {
    const checkoutId = c.req.param("id") ?? "";
    const reconciliationService =
      new MarketCheckoutPaymentReconciliationService(c.env);
    const statusInput =
      await reconciliationService.getStatusLookupInput(checkoutId);
    let providerStatus;
    try {
      providerStatus = await queryMarketCheckoutProviderSplitStatus(
        c.env,
        statusInput,
      );
    } catch (error) {
      throw new ApiError(
        "MARKET_CHECKOUT_PROVIDER_STATUS_LOOKUP_FAILED",
        error instanceof Error
          ? error.message
          : "Market checkout provider status lookup failed",
        502,
      );
    }
    const reconciliation = await reconciliationService.reconcile(
      checkoutId,
      providerStatus,
    );

    return c.json({
      success: true,
      data: {
        reconciliation,
      },
    });
  },
);

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

  const hydratedSession = {
    ...session,
    childOrders,
  };

  return hydrateMarketCheckoutParentPayment(hydratedSession, env);
}

async function hydrateMarketCheckoutParentPayment(
  session: MarketCheckoutSession,
  env: Env,
): Promise<MarketCheckoutSession> {
  const row = await env.DB.prepare(
    `SELECT payment_id, provider, split_mode, idempotency_key, status,
            amount_cents, paid_amount_cents, refunded_amount_cents,
            currency, country_code, child_payment_ids,
            provider_transaction_id, provider_payload, created_at_ms, updated_at_ms
       FROM market_checkout_payments
      WHERE checkout_id = ?
      ORDER BY updated_at_ms DESC
      LIMIT 1`,
  )
    .bind(session.id)
    .first<{
      payment_id: string;
      provider: string;
      split_mode: MarketCheckoutSplitMode;
      idempotency_key: string | null;
      status: MarketCheckoutPaymentSummary["status"];
      amount_cents: number;
      paid_amount_cents: number;
      refunded_amount_cents: number;
      currency: MarketCheckoutPaymentSummary["currency"] | null;
      country_code: MarketCheckoutPaymentSummary["country"] | null;
      child_payment_ids: string | null;
      provider_transaction_id: string | null;
      provider_payload: string | null;
      created_at_ms: number;
      updated_at_ms: number;
    }>();

  if (!row) return session;

  const childPaymentIds = parseJsonStringArray(row.child_payment_ids);
  const providerPayload = parseProviderPayload(row.provider_payload);
  const parentPayment: MarketCheckoutParentPaymentSummary = {
    paymentId: row.payment_id,
    status: row.status,
    provider: row.provider,
    splitMode: row.split_mode,
    idempotencyKey: row.idempotency_key ?? `market-checkout:${session.id}`,
    providerTransactionId: row.provider_transaction_id ?? undefined,
    nextAction: providerPayload.nextAction,
    lastWebhook: providerPayload.lastWebhook,
    lastReconciliation: providerPayload.lastReconciliation,
    lastRefund: providerPayload.lastRefund,
    amountCents: row.amount_cents,
    paidAmountCents: row.paid_amount_cents,
    refundedAmountCents: row.refunded_amount_cents,
    childPaymentIds,
    createdAt: toIsoString(new Date(row.created_at_ms)),
    updatedAt: toIsoString(new Date(row.updated_at_ms)),
  };

  const existingPayment = session.payment;
  const payment: MarketCheckoutPaymentSummary = existingPayment
    ? {
        ...existingPayment,
        status: row.status,
        totalAmount: row.amount_cents / 100,
        totalAmountCents: row.amount_cents,
        paidAmount: row.paid_amount_cents / 100,
        paidAmountCents: row.paid_amount_cents,
        refundedAmount: row.refunded_amount_cents / 100,
        refundedAmountCents: row.refunded_amount_cents,
        currency: row.currency ?? existingPayment.currency,
        country: row.country_code ?? existingPayment.country,
        parentPayment,
      }
    : {
        status: row.status,
        method: row.provider,
        currency: row.currency ?? "TWD",
        country: row.country_code ?? "TW",
        totalAmount: row.amount_cents / 100,
        totalAmountCents: row.amount_cents,
        paidAmount: row.paid_amount_cents / 100,
        paidAmountCents: row.paid_amount_cents,
        refundedAmount: row.refunded_amount_cents / 100,
        refundedAmountCents: row.refunded_amount_cents,
        childPayments: [],
        parentPayment,
      };

  return {
    ...session,
    payment,
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

function buildFailedMarketCheckoutPayment(input: {
  checkoutId: string;
  session: MarketCheckoutSession;
  method: string;
  country: "TW" | "MY" | "VN";
  currency: "TWD" | "MYR" | "VND";
  provider: string;
  splitMode: MarketCheckoutSplitMode;
  idempotencyKey: string;
  errorMessage: string;
}): MarketCheckoutPaymentSummary {
  const now = new Date().toISOString();
  const totalAmount = input.session.childOrders.reduce(
    (sum, child) => sum + Number(child.totalAmount ?? 0),
    0,
  );
  const paymentBase: MarketCheckoutPaymentSummary = {
    status: "failed",
    method: input.method,
    currency: input.currency,
    country: input.country,
    totalAmount,
    totalAmountCents: Math.round(totalAmount * 100),
    paidAmount: 0,
    paidAmountCents: 0,
    failedAt: now,
    childPayments: input.session.childOrders.map((child) => ({
      restaurantId: child.restaurantId,
      restaurantName: child.restaurantName,
      orderId: child.orderId,
      orderNumber: child.orderNumber,
      status: "failed" as const,
      amount: Number(child.totalAmount ?? 0),
      amountCents: orderChildTotalCents(child),
      errorMessage: input.errorMessage,
    })),
  };

  return {
    ...paymentBase,
    parentPayment: buildMarketCheckoutParentPayment({
      checkoutId: input.checkoutId,
      existing: input.session.payment?.parentPayment,
      payment: paymentBase,
      provider: input.provider,
      splitMode: input.splitMode,
      idempotencyKey: input.idempotencyKey,
      now,
    }),
    settlement: buildMarketCheckoutSettlement(input.session, paymentBase),
  };
}

function buildMarketCheckoutSettlement(
  session: MarketCheckoutSession,
  payment: MarketCheckoutPaymentSummary,
): MarketCheckoutSettlementSummary {
  const paymentByOrderId = new Map(
    payment.childPayments.map((childPayment) => [
      childPayment.orderId,
      childPayment,
    ]),
  );
  const platformFeeRateBps = clampPlatformFeeRateBps(
    session.market.platformFeeRateBps,
  );
  const vendorAllocations = session.childOrders.map((child) => {
    const childPayment = paymentByOrderId.get(child.orderId);
    const grossAmountCents =
      childPayment?.status === "paid" || childPayment?.status === "refunded"
        ? childPayment.amountCents
        : 0;
    const refundedAmountCents =
      childPayment?.status === "refunded" ? childPayment.amountCents : 0;
    const netBeforeFeeCents = grossAmountCents - refundedAmountCents;
    const platformFeeCents = Math.round(
      (netBeforeFeeCents * platformFeeRateBps) / 10000,
    );

    return {
      restaurantId: child.restaurantId,
      restaurantName: child.restaurantName,
      orderId: child.orderId,
      orderNumber: child.orderNumber,
      grossAmountCents,
      refundedAmountCents,
      platformFeeCents,
      netAmountCents: netBeforeFeeCents - platformFeeCents,
    };
  });
  const platformFeeCents = vendorAllocations.reduce(
    (sum, allocation) => sum + allocation.platformFeeCents,
    0,
  );
  const vendorNetAmountCents = vendorAllocations.reduce(
    (sum, allocation) => sum + allocation.netAmountCents,
    0,
  );

  return {
    platformFeeRateBps,
    platformFeeCents,
    vendorNetAmountCents,
    vendorAllocations,
  };
}

async function markMarketCheckoutVoucherRefunded(
  env: Env,
  session: MarketCheckoutSession,
  orderIds: number[],
): Promise<void> {
  const appliedVoucher = session.appliedVoucher;
  if (!appliedVoucher || orderIds.length === 0) return;

  try {
    await new MarketCheckoutVoucherService(env).markRefunded({
      couponId: appliedVoucher.couponId,
      orderIds,
    });
  } catch (error) {
    console.error(
      `Voucher refund marking failed for market checkout ${session.id}:`,
      error,
    );
  }
}

function buildMarketCheckoutParentPayment(input: {
  checkoutId: string;
  existing?: MarketCheckoutParentPaymentSummary;
  payment: MarketCheckoutPaymentSummary;
  provider: string;
  splitMode: MarketCheckoutSplitMode;
  idempotencyKey: string;
  providerTransactionId?: string;
  nextAction?: MarketCheckoutProviderNextAction;
  lastRefund?: MarketCheckoutProviderLastWebhook;
  now: string;
}): MarketCheckoutParentPaymentSummary {
  const childPaymentIds = input.payment.childPayments
    .map((childPayment) => childPayment.paymentId)
    .filter((paymentId): paymentId is string => Boolean(paymentId));

  return {
    paymentId: input.existing?.paymentId ?? `market_pay_${input.checkoutId}`,
    status: input.payment.status,
    provider: input.existing?.provider ?? input.provider,
    splitMode: input.existing?.splitMode ?? input.splitMode,
    idempotencyKey: input.existing?.idempotencyKey ?? input.idempotencyKey,
    providerTransactionId:
      input.existing?.providerTransactionId ?? input.providerTransactionId,
    nextAction: input.nextAction ?? input.existing?.nextAction,
    lastWebhook: input.existing?.lastWebhook,
    lastReconciliation: input.existing?.lastReconciliation,
    lastRefund: input.lastRefund ?? input.existing?.lastRefund,
    amountCents: input.payment.totalAmountCents,
    paidAmountCents: input.payment.paidAmountCents,
    refundedAmountCents: input.payment.refundedAmountCents ?? 0,
    childPaymentIds,
    createdAt: input.existing?.createdAt ?? input.now,
    updatedAt: input.now,
  };
}

function clampPlatformFeeRateBps(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(10000, Math.max(0, Math.trunc(value)));
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
    platformFeeRateBps: clampPlatformFeeRateBps(
      session.market.platformFeeRateBps,
    ),
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

  await upsertMarketCheckoutParentPayment(env, session);
}

async function upsertMarketCheckoutParentPayment(
  env: Env,
  session: MarketCheckoutSession,
) {
  const parentPayment = session.payment?.parentPayment;
  if (!session.payment || !parentPayment) return;

  const updatedAt = parseTimestampMs(parentPayment.updatedAt) ?? Date.now();
  const createdAt =
    parseTimestampMs(parentPayment.createdAt) ??
    parseTimestampMs(session.createdAt) ??
    updatedAt;
  const completedAt =
    session.payment.status === "paid"
      ? (parseTimestampMs(session.payment.paidAt) ?? updatedAt)
      : null;
  const refundedAt =
    session.payment.status === "refunded" ||
    session.payment.status === "partial_refunded"
      ? (parseTimestampMs(session.payment.refundedAt) ?? updatedAt)
      : null;
  const failedAt =
    session.payment.status === "failed"
      ? (parseTimestampMs(session.payment.failedAt) ?? updatedAt)
      : null;

  await env.DB.prepare(
    `INSERT INTO market_checkout_payments (
        payment_id, checkout_id, market_id, provider, split_mode,
        idempotency_key, status, amount_cents, paid_amount_cents,
        refunded_amount_cents, currency, country_code, child_payment_ids,
        provider_transaction_id, provider_payload, created_at_ms,
        updated_at_ms, completed_at_ms, refunded_at_ms, failed_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(payment_id) DO UPDATE SET
        checkout_id = excluded.checkout_id,
        market_id = excluded.market_id,
        provider = excluded.provider,
        split_mode = excluded.split_mode,
        idempotency_key = excluded.idempotency_key,
        status = excluded.status,
        amount_cents = excluded.amount_cents,
        paid_amount_cents = excluded.paid_amount_cents,
        refunded_amount_cents = excluded.refunded_amount_cents,
        currency = excluded.currency,
        country_code = excluded.country_code,
        child_payment_ids = excluded.child_payment_ids,
        provider_transaction_id = excluded.provider_transaction_id,
        provider_payload = excluded.provider_payload,
        updated_at_ms = excluded.updated_at_ms,
        completed_at_ms = COALESCE(excluded.completed_at_ms, market_checkout_payments.completed_at_ms),
        refunded_at_ms = COALESCE(excluded.refunded_at_ms, market_checkout_payments.refunded_at_ms),
        failed_at_ms = COALESCE(excluded.failed_at_ms, market_checkout_payments.failed_at_ms)`,
  )
    .bind(
      parentPayment.paymentId,
      session.id,
      session.market.id,
      parentPayment.provider,
      parentPayment.splitMode,
      parentPayment.idempotencyKey,
      parentPayment.status,
      parentPayment.amountCents,
      parentPayment.paidAmountCents,
      parentPayment.refundedAmountCents,
      session.payment.currency,
      session.payment.country,
      JSON.stringify(parentPayment.childPaymentIds),
      parentPayment.providerTransactionId ?? null,
      JSON.stringify({
        source: "market-checkouts",
        splitMode: parentPayment.splitMode,
        nextAction: parentPayment.nextAction ?? null,
        lastWebhook: parentPayment.lastWebhook ?? null,
        lastReconciliation: parentPayment.lastReconciliation ?? null,
        lastRefund: parentPayment.lastRefund ?? null,
        settlement: session.payment.settlement ?? null,
      }),
      createdAt,
      updatedAt,
      completedAt,
      refundedAt,
      failedAt,
    )
    .run();
}

function parseTimestampMs(value: string | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function parseJsonStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function parseProviderPayload(value: string | null | undefined): {
  nextAction?: MarketCheckoutProviderNextAction;
  lastWebhook?: MarketCheckoutProviderLastWebhook;
  lastReconciliation?: MarketCheckoutProviderLastWebhook;
  lastRefund?: MarketCheckoutProviderLastWebhook;
} {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as {
      nextAction?: unknown;
      lastWebhook?: unknown;
      lastReconciliation?: unknown;
      lastRefund?: unknown;
    };

    return {
      nextAction: parseProviderPayloadNextAction(parsed.nextAction),
      lastWebhook: parseProviderPayloadLastWebhook(parsed.lastWebhook),
      lastReconciliation: parseProviderPayloadLastWebhook(
        parsed.lastReconciliation,
      ),
      lastRefund: parseProviderPayloadLastWebhook(parsed.lastRefund),
    };
  } catch {
    return {};
  }
}

function parseProviderPayloadNextAction(
  value: unknown,
): MarketCheckoutProviderNextAction | undefined {
  if (!value || typeof value !== "object") return undefined;
  const action = value as Partial<MarketCheckoutProviderNextAction>;
  if (
    action.type !== "redirect" &&
    action.type !== "client_secret" &&
    action.type !== "sdk_confirmation"
  ) {
    return undefined;
  }

  return {
    type: action.type,
    redirectUrl:
      typeof action.redirectUrl === "string" ? action.redirectUrl : undefined,
    clientSecret:
      typeof action.clientSecret === "string" ? action.clientSecret : undefined,
    expiresAt:
      typeof action.expiresAt === "string" ? action.expiresAt : undefined,
    providerPayload:
      action.providerPayload && typeof action.providerPayload === "object"
        ? (action.providerPayload as Record<string, unknown>)
        : undefined,
  };
}

function parseProviderPayloadLastWebhook(
  value: unknown,
): MarketCheckoutProviderLastWebhook | undefined {
  if (!value || typeof value !== "object") return undefined;
  const webhook = value as Partial<MarketCheckoutProviderLastWebhook>;
  if (
    typeof webhook.provider !== "string" ||
    typeof webhook.eventType !== "string" ||
    typeof webhook.status !== "string" ||
    typeof webhook.receivedAt !== "string"
  ) {
    return undefined;
  }

  return {
    provider: webhook.provider,
    eventId:
      typeof webhook.eventId === "string" || webhook.eventId === null
        ? webhook.eventId
        : undefined,
    eventType: webhook.eventType,
    status: webhook.status,
    receivedAt: webhook.receivedAt,
    payloadSummary: summarizeProviderPayload(webhook.payload),
  };
}

function summarizeProviderPayload(
  value: unknown,
): MarketCheckoutProviderPayloadSummary | undefined {
  if (!value || typeof value !== "object") return undefined;
  const payload = value as Record<string, unknown>;
  const nestedObject = objectRecord(objectRecord(payload.data)?.object);
  const providerPayload = objectRecord(payload.providerPayload);
  const nestedFailure = objectRecord(
    nestedObject?.last_payment_error ??
      nestedObject?.failure ??
      nestedObject?.error,
  );
  const providerFailure = objectRecord(
    providerPayload?.failure ?? providerPayload?.error,
  );
  const summary: MarketCheckoutProviderPayloadSummary = {
    objectId: stringValue(nestedObject?.id ?? payload.id),
    providerTransactionId: stringValue(payload.providerTransactionId),
    status: stringValue(nestedObject?.status ?? payload.status),
    amountCents: numberValue(nestedObject?.amount ?? payload.amountCents),
    amountReceivedCents: numberValue(
      nestedObject?.amount_received ?? payload.amountReceivedCents,
    ),
    amountRefundedCents: numberValue(
      nestedObject?.amount_refunded ?? payload.amountRefundedCents,
    ),
    currency: stringValue(nestedObject?.currency ?? payload.currency),
    metadataKeys: metadataKeysFrom(
      nestedObject?.metadata ?? payload.metadata ?? providerPayload?.metadata,
    ),
    failureCode: stringValue(
      nestedFailure?.code ??
        providerFailure?.code ??
        payload.failureCode ??
        payload.errorCode,
    ),
    failureReason: stringValue(
      nestedFailure?.message ??
        nestedFailure?.reason ??
        providerFailure?.message ??
        providerFailure?.reason ??
        payload.failureReason ??
        payload.errorMessage ??
        payload.message,
    ),
  };

  const compact = Object.fromEntries(
    Object.entries(summary).filter(([, fieldValue]) =>
      Array.isArray(fieldValue)
        ? fieldValue.length > 0
        : fieldValue !== undefined,
    ),
  ) as MarketCheckoutProviderPayloadSummary;

  return Object.keys(compact).length > 0 ? compact : undefined;
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function metadataKeysFrom(value: unknown): string[] | undefined {
  const metadata = objectRecord(value);
  if (!metadata) return undefined;
  const keys = Object.keys(metadata).sort();
  return keys.length > 0 ? keys : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : undefined;
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
      platformFeeRateBps: row.platformFeeRateBps,
    },
    status: row.status as MarketCheckoutSession["status"],
    paymentStatus:
      row.paymentStatus as MarketCheckoutIndexItem["paymentStatus"],
    subtotal: row.subtotalCents,
    childOrderCount: row.childOrderCount,
    operationAlerts: buildMarketCheckoutOperationAlerts(
      (row.paymentSummary ?? undefined) as
        | MarketCheckoutPaymentSummary
        | undefined,
    ),
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
      platformFeeRateBps: row.platformFeeRateBps,
    },
    status: row.status as MarketCheckoutSession["status"],
    paymentStatus:
      row.paymentStatus as MarketCheckoutIndexItem["paymentStatus"],
    subtotal: row.subtotalCents,
    childOrderCount: row.childOrderCount,
    payment: (row.paymentSummary ?? undefined) as
      | MarketCheckoutPaymentSummary
      | undefined,
    operationAlerts: buildMarketCheckoutOperationAlerts(
      (row.paymentSummary ?? undefined) as
        | MarketCheckoutPaymentSummary
        | undefined,
    ),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }));
}

async function readPersistedMarketCheckoutOpsSessions(
  env: Env,
): Promise<MarketCheckoutSession[]> {
  const db = createDatabase(env.DB);
  const rows = await db
    .select()
    .from(marketCheckoutSessions)
    .orderBy(desc(marketCheckoutSessions.createdAt))
    .limit(MARKET_CHECKOUT_INDEX_LIMIT)
    .all();

  if (rows.length === 0) return [];

  const checkoutIds = rows.map((row) => row.id);
  const children = await db
    .select()
    .from(marketCheckoutChildOrders)
    .where(inArray(marketCheckoutChildOrders.checkoutId, checkoutIds))
    .all();
  const childrenByCheckout = new Map<string, typeof children>();
  for (const child of children) {
    const existing = childrenByCheckout.get(child.checkoutId) ?? [];
    existing.push(child);
    childrenByCheckout.set(child.checkoutId, existing);
  }

  return rows.map((row) => ({
    id: row.id,
    market: {
      id: row.marketId,
      slug: row.marketSlug,
      name: row.marketName,
      platformFeeRateBps: row.platformFeeRateBps,
    },
    status: row.status as MarketCheckoutSession["status"],
    phoneLastDigits: row.phoneLastDigits ?? undefined,
    childOrders: (childrenByCheckout.get(row.id) ?? []).map((child) => ({
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

function buildMarketCheckoutVendorSettlements(
  sessions: MarketCheckoutSession[],
): MarketCheckoutVendorSettlement[] {
  const vendors = new Map<
    string,
    MarketCheckoutVendorSettlement & { checkoutIds: Set<string> }
  >();

  for (const session of sessions) {
    const allocationsByOrderId = new Map(
      session.payment?.settlement?.vendorAllocations.map((allocation) => [
        allocation.orderId,
        allocation,
      ]) ?? [],
    );

    for (const child of session.childOrders) {
      const payment = session.payment?.childPayments.find(
        (childPayment) => childPayment.orderId === child.orderId,
      );
      const allocation = allocationsByOrderId.get(child.orderId);
      const settlement = vendors.get(child.restaurantId) ?? {
        restaurantId: child.restaurantId,
        restaurantName: child.restaurantName,
        checkoutCount: 0,
        childOrderCount: 0,
        subtotalCents: 0,
        paidAmountCents: 0,
        refundedAmountCents: 0,
        netPaidAmountCents: 0,
        platformFeeCents: 0,
        vendorNetAmountCents: 0,
        refundedPaymentCount: 0,
        failedPaymentCount: 0,
        checkoutIds: new Set<string>(),
      };

      settlement.checkoutIds.add(session.id);
      settlement.childOrderCount += 1;
      settlement.subtotalCents += orderChildTotalCents(child);

      if (allocation) {
        settlement.paidAmountCents += allocation.grossAmountCents;
        settlement.refundedAmountCents += allocation.refundedAmountCents;
        settlement.platformFeeCents += allocation.platformFeeCents;
        settlement.vendorNetAmountCents += allocation.netAmountCents;
      } else if (payment?.status === "paid" || payment?.status === "refunded") {
        settlement.paidAmountCents += payment.amountCents;
        if (payment.status === "refunded") {
          settlement.refundedAmountCents += payment.amountCents;
        }
      }

      if (payment?.status === "refunded") {
        settlement.refundedPaymentCount += 1;
      }
      if (payment?.status === "failed") {
        settlement.failedPaymentCount += 1;
      }
      vendors.set(child.restaurantId, settlement);
    }
  }

  return Array.from(vendors.values())
    .map(({ checkoutIds, ...vendor }) => ({
      ...vendor,
      checkoutCount: checkoutIds.size,
      netPaidAmountCents: vendor.paidAmountCents - vendor.refundedAmountCents,
      vendorNetAmountCents:
        vendor.platformFeeCents > 0 || vendor.vendorNetAmountCents > 0
          ? vendor.vendorNetAmountCents
          : vendor.paidAmountCents - vendor.refundedAmountCents,
    }))
    .sort((a, b) => b.subtotalCents - a.subtotalCents);
}

function buildMarketCheckoutCsv(items: MarketCheckoutSummaryItem[]) {
  const headers = [
    "checkout_id",
    "market_slug",
    "market_name",
    "status",
    "payment_status",
    "payment_method",
    "payment_provider",
    "split_mode",
    "parent_payment_id",
    "provider_transaction_id",
    "last_webhook_status",
    "last_webhook_event_type",
    "last_webhook_received_at",
    "last_reconciliation_status",
    "last_reconciliation_event_type",
    "last_reconciliation_received_at",
    "child_order_count",
    "child_payment_count",
    "failed_child_payment_count",
    "subtotal_cents",
    "paid_amount_cents",
    "refunded_amount_cents",
    "net_paid_amount_cents",
    "created_at",
    "updated_at",
  ];
  const rows = items.map((item) => {
    const payment = item.payment;
    const parentPayment = payment?.parentPayment;
    const paidAmountCents = item.payment?.paidAmountCents ?? 0;
    const refundedAmountCents = item.payment?.refundedAmountCents ?? 0;
    const childPayments = payment?.childPayments ?? [];
    const failedChildPaymentCount = childPayments.filter(
      (childPayment) => childPayment.status === "failed",
    ).length;
    return [
      item.id,
      item.market.slug,
      item.market.name,
      item.status,
      item.paymentStatus,
      payment?.method ?? "",
      parentPayment?.provider ?? payment?.method ?? "",
      parentPayment?.splitMode ?? "",
      parentPayment?.paymentId ?? "",
      parentPayment?.providerTransactionId ?? "",
      parentPayment?.lastWebhook?.status ?? "",
      parentPayment?.lastWebhook?.eventType ?? "",
      parentPayment?.lastWebhook?.receivedAt ?? "",
      parentPayment?.lastReconciliation?.status ?? "",
      parentPayment?.lastReconciliation?.eventType ?? "",
      parentPayment?.lastReconciliation?.receivedAt ?? "",
      item.childOrderCount,
      childPayments.length,
      failedChildPaymentCount,
      item.subtotal,
      paidAmountCents,
      refundedAmountCents,
      paidAmountCents - refundedAmountCents,
      item.createdAt,
      item.updatedAt,
    ];
  });

  return [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(String(value))).join(","))
    .join("\n");
}

function buildMarketCheckoutVendorSettlementCsv(
  vendors: MarketCheckoutVendorSettlement[],
) {
  const headers = [
    "restaurant_id",
    "restaurant_name",
    "checkout_count",
    "child_order_count",
    "subtotal_cents",
    "paid_amount_cents",
    "refunded_amount_cents",
    "net_paid_amount_cents",
    "platform_fee_cents",
    "vendor_net_amount_cents",
    "refunded_payment_count",
    "failed_payment_count",
  ];
  const rows = vendors.map((vendor) => [
    vendor.restaurantId,
    vendor.restaurantName,
    vendor.checkoutCount,
    vendor.childOrderCount,
    vendor.subtotalCents,
    vendor.paidAmountCents,
    vendor.refundedAmountCents,
    vendor.netPaidAmountCents,
    vendor.platformFeeCents,
    vendor.vendorNetAmountCents,
    vendor.refundedPaymentCount,
    vendor.failedPaymentCount,
  ]);

  return [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(String(value))).join(","))
    .join("\n");
}

function buildMarketCheckoutAccountingCsv(sessions: MarketCheckoutSession[]) {
  const headers = [
    "entry_date",
    "checkout_id",
    "market_slug",
    "market_name",
    "restaurant_id",
    "restaurant_name",
    "order_id",
    "order_number",
    "payment_provider",
    "split_mode",
    "provider_transaction_id",
    "last_webhook_status",
    "last_webhook_received_at",
    "last_reconciliation_status",
    "last_reconciliation_received_at",
    "account_code",
    "account_name",
    "direction",
    "amount_cents",
    "currency",
    "source_type",
    "source_id",
    "memo",
  ];
  const rows: Array<Array<string | number>> = [];

  for (const session of sessions) {
    const payment = session.payment;
    if (!payment?.settlement) continue;

    for (const allocation of payment.settlement.vendorAllocations) {
      const netBeforeFeeCents =
        allocation.grossAmountCents - allocation.refundedAmountCents;
      const base = [
        payment.paidAt ?? session.createdAt,
        session.id,
        session.market.slug,
        session.market.name,
        allocation.restaurantId,
        allocation.restaurantName,
        allocation.orderId,
        allocation.orderNumber,
        payment.parentPayment?.provider ?? payment.method,
        payment.parentPayment?.splitMode ?? "",
        payment.parentPayment?.providerTransactionId ?? "",
        payment.parentPayment?.lastWebhook?.status ?? "",
        payment.parentPayment?.lastWebhook?.receivedAt ?? "",
        payment.parentPayment?.lastReconciliation?.status ?? "",
        payment.parentPayment?.lastReconciliation?.receivedAt ?? "",
      ] satisfies Array<string | number>;
      const sourceId =
        payment.parentPayment?.paymentId ??
        payment.childPayments.find(
          (childPayment) => childPayment.orderId === allocation.orderId,
        )?.paymentId ??
        session.id;
      // Credit-funded checkouts draw down the stored-value liability (2100)
      // instead of external payment clearing (1100).
      const customerClearing =
        payment.parentPayment?.provider === "credit_balance"
          ? { code: "2100", name: "credits_liability" }
          : { code: "1100", name: "payment_clearing" };

      if (netBeforeFeeCents > 0) {
        rows.push([
          ...base,
          customerClearing.code,
          customerClearing.name,
          "debit",
          netBeforeFeeCents,
          payment.currency,
          "market_checkout_settlement",
          sourceId,
          "net paid amount before platform fee",
        ]);
      }
      if (allocation.netAmountCents > 0) {
        rows.push([
          ...base,
          "2200",
          "vendor_payable",
          "credit",
          allocation.netAmountCents,
          payment.currency,
          "market_checkout_settlement",
          sourceId,
          "vendor net payable",
        ]);
      }
      if (allocation.platformFeeCents > 0) {
        rows.push([
          ...base,
          "4100",
          "platform_fee_revenue",
          "credit",
          allocation.platformFeeCents,
          payment.currency,
          "market_checkout_settlement",
          sourceId,
          "platform fee revenue",
        ]);
      }
      if (allocation.refundedAmountCents > 0) {
        rows.push([
          ...base,
          "1300",
          "refund_clearing",
          "debit",
          allocation.refundedAmountCents,
          payment.currency,
          "market_checkout_refund",
          sourceId,
          "refund issued to customer",
        ]);
        rows.push([
          ...base,
          customerClearing.code,
          customerClearing.name,
          "credit",
          allocation.refundedAmountCents,
          payment.currency,
          "market_checkout_refund",
          sourceId,
          "cash clearing reversal for refund",
        ]);
      }
    }
  }

  return [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(String(value))).join(","))
    .join("\n");
}

function escapeCsvValue(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
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
      platformFeeRateBps: row.platformFeeRateBps,
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
    operationAlerts: buildMarketCheckoutOperationAlerts(session.payment),
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

function buildMarketCheckoutOperationAlerts(
  payment: MarketCheckoutPaymentSummary | undefined,
  nowMs = Date.now(),
): MarketCheckoutOperationAlert[] {
  const parentPayment = payment?.parentPayment;
  if (!parentPayment || parentPayment.splitMode !== "provider_split") {
    return [];
  }

  const alerts: MarketCheckoutOperationAlert[] = [];
  if (parentPayment.status === "pending") {
    const updatedAtMs = Date.parse(parentPayment.updatedAt);
    if (Number.isFinite(updatedAtMs) && nowMs - updatedAtMs > 30 * 60 * 1000) {
      alerts.push({
        type: "provider_pending_stale",
        label: "待對帳",
        severity: "warning",
      });
    }
    if (!parentPayment.lastWebhook) {
      alerts.push({
        type: "provider_webhook_missing",
        label: "未收到 webhook",
        severity: "warning",
      });
    }
  }
  if (parentPayment.lastWebhook?.status === "failed") {
    alerts.push({
      type: "provider_webhook_failed",
      label: "webhook 失敗",
      severity: "critical",
    });
  }
  if (
    parentPayment.status === "pending" &&
    parentPayment.lastWebhook?.status === "paid"
  ) {
    alerts.push({
      type: "provider_status_mismatch",
      label: "狀態不一致",
      severity: "critical",
    });
  }
  if (parentPayment.lastRefund?.status === "pending") {
    alerts.push({
      type: "provider_refund_pending",
      label: "退款處理中",
      severity: "warning",
    });
  }
  if (parentPayment.lastRefund?.status === "failed") {
    alerts.push({
      type: "provider_refund_failed",
      label: "退款失敗",
      severity: "critical",
    });
  }

  return alerts;
}

function coercePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseMarketCheckoutDateRange(c: {
  req: { query: (key: string) => string | undefined };
}) {
  return {
    from: parseDateBoundary(c.req.query("dateFrom"), "start"),
    to: parseDateBoundary(c.req.query("dateTo"), "end"),
  };
}

function parseDateBoundary(
  value: string | undefined,
  boundary: "start" | "end",
) {
  if (!value) return null;
  const normalized =
    /^\d{4}-\d{2}-\d{2}$/.test(value) && boundary === "start"
      ? `${value}T00:00:00.000Z`
      : /^\d{4}-\d{2}-\d{2}$/.test(value) && boundary === "end"
        ? `${value}T23:59:59.999Z`
        : value;
  const time = new Date(normalized).getTime();
  return Number.isNaN(time) ? null : time;
}

function isWithinMarketCheckoutDateRange(
  createdAt: string,
  dateRange: { from: number | null; to: number | null },
) {
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) return true;
  if (dateRange.from !== null && createdTime < dateRange.from) return false;
  if (dateRange.to !== null && createdTime > dateRange.to) return false;
  return true;
}
