import { Hono } from "hono";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  createDatabase,
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
import { OrdersService } from "../../orders/services/OrdersService";
import type { OrderPaymentStatus, OrderStatus } from "../../orders/types";
import { createMarketCheckoutSchema } from "../schemas/validation";

const app = new Hono<{ Bindings: Env }>();

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
  childOrders: MarketCheckoutChildOrder[];
  subtotal: number;
  createdAt: string;
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
      notes: [data.notes, vendor.notes].filter(Boolean).join("\n") || undefined,
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

  const checkoutId = crypto.randomUUID();
  const subtotal = children.reduce(
    (sum, child) => sum + orderTotalCents(child.order),
    0,
  );
  const session = {
    id: checkoutId,
    market: {
      id: market.id,
      slug: market.slug,
      name: market.name,
    },
    status: "submitted",
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

app.get("/:id", async (c) => {
  const checkoutId = c.req.param("id");
  const stored = await c.env.CACHE_KV.get(`market_checkout:${checkoutId}`);
  if (!stored) {
    throw notFound("Market checkout not found");
  }

  const session = JSON.parse(stored) as MarketCheckoutSession;
  const ordersService = new OrdersService(c.env);
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

  return c.json({
    success: true,
    data: {
      checkout: {
        ...session,
        childOrders,
      },
    },
  });
});

export default app;

function orderTotalCents(order: {
  totalAmount: number;
  totalAmountCents?: number | null;
}) {
  return Number(
    order.totalAmountCents ?? Math.round(Number(order.totalAmount ?? 0) * 100),
  );
}
