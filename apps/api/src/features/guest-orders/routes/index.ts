/**
 * Guest Orders Routes
 * Public endpoints for unauthenticated QR code ordering.
 * Completely bypasses authMiddleware; uses KV-based guest tokens instead.
 */

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import {
  createDatabase,
  orders,
  restaurants,
  tables,
  seats,
} from "@makanmakan/database";
import type { Env } from "../../../types/env";
import {
  guestTokenAuth,
  generateGuestToken,
} from "../../../middleware/guestAuth";
import type { GuestTokenData } from "../../../middleware/guestAuth";
import {
  createGuestOrderSchema,
  addGuestOrderItemsSchema,
} from "../schemas/validation";
import { OrdersService } from "../../orders/services/OrdersService";
import {
  notFound,
  forbidden,
  badRequest,
  conflict,
} from "../../../shared/utils/api-error";
import { enforceQuota } from "../../../middleware/quotaGate";
import { meterEmit } from "../../../shared/utils/meter";

const app = new Hono<{ Bindings: Env }>();

// ─── POST / ─── Create guest order (no auth, rate limited) ───
app.post("/", async (c) => {
  // Parse and validate body
  const body = await c.req.json();
  const parsed = createGuestOrderSchema.safeParse(body);
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
  await enforceQuota(c, "orders.created", {
    restaurantId: data.restaurantId,
  });

  const db = createDatabase(c.env.DB);

  // 1. Query restaurant and check allowGuestOrders
  const restaurant = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, data.restaurantId))
    .get();

  if (!restaurant) {
    throw notFound("Restaurant not found");
  }

  if (!restaurant.isActive || !restaurant.isAvailable) {
    throw badRequest("Restaurant is currently unavailable");
  }

  const settings = restaurant.settings as Record<string, unknown> | null;
  if (!settings || settings.allowGuestOrders !== true) {
    throw forbidden("Guest orders are not enabled for this restaurant");
  }

  // 2. Check active order limit per phoneLastDigits + restaurant
  // When phoneLastDigits is the default "000", use IP to differentiate anonymous users
  const clientIp =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for") ||
    "unknown";
  const guestIdentifier =
    data.phoneLastDigits === "000" ? `anon:${clientIp}` : data.phoneLastDigits;
  const activeOrderKey = `guest_active:${data.restaurantId}:${guestIdentifier}`;
  const existingActiveOrder = await c.env.CACHE_KV.get(activeOrderKey);
  if (existingActiveOrder) {
    if (data.clientMutationId) {
      const duplicateMutation = await db
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, data.restaurantId),
            eq(orders.clientMutationId, data.clientMutationId),
          ),
        )
        .get();

      if (duplicateMutation) {
        throw conflict(
          "Client mutation has already been processed",
          "CLIENT_MUTATION_DUPLICATE",
        );
      }
    }

    return c.json(
      {
        success: false,
        error:
          "You already have an active order at this restaurant. Please wait for it to complete.",
      },
      429,
    );
  }

  // 3. Validate table/seat if needed
  if (data.orderType === "table" || data.orderType === "seat") {
    const table = await db
      .select()
      .from(tables)
      .where(eq(tables.id, data.tableId!))
      .get();

    if (!table || String(table.restaurantId) !== data.restaurantId) {
      throw badRequest("Table not found or does not belong to this restaurant");
    }
  }

  if (data.orderType === "seat") {
    const seat = await db
      .select()
      .from(seats)
      .where(eq(seats.id, data.seatId!))
      .get();

    if (!seat || seat.tableId !== data.tableId) {
      throw badRequest("Seat not found or does not belong to this table");
    }
  }

  // 4. Create order via OrdersService
  const fulfillmentType =
    data.deliveryInfo?.type ??
    (data.orderType === "shop" ? "takeaway" : "dine_in");

  const ordersService = new OrdersService(c.env);
  let order;
  try {
    order = await ordersService.createOrder({
      restaurantId: data.restaurantId,
      // Only pass tableId for table/seat orders — shop orders don't need a table
      tableId: data.orderType === "shop" ? undefined : data.tableId,
      waitingListId: data.waitingListId,
      waitingListCustomerPhone: data.customerPhone,
      customerInfo: {
        name: data.guestName,
        // phoneLastDigits is only 3 digits (for order dedup), not a real phone number.
        // Don't pass it as phone — it would fail the 7-20 digit validation in OrdersService.
      },
      items: data.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        customizations: item.customizations,
        notes: item.notes,
      })),
      notes: data.notes,
      clientMutationId: data.clientMutationId,
      orderType: data.orderType,
      deliveryInfo: {
        type: fulfillmentType,
        address: data.deliveryInfo?.address,
        phone: data.deliveryInfo?.phone,
        instructions: data.deliveryInfo?.instructions,
        deliveryFee: data.deliveryInfo?.deliveryFee,
      },
      isGuestOrder: true,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      /^Menu item \d+ is not available$/.test(error.message)
    ) {
      throw conflict(error.message, "MENU_ITEM_UNAVAILABLE");
    }

    if (
      error instanceof Error &&
      error.message === "CLIENT_MUTATION_DUPLICATE"
    ) {
      throw conflict(
        "Client mutation has already been processed",
        "CLIENT_MUTATION_DUPLICATE",
      );
    }

    throw error;
  }

  // 5. Generate guest token and store in KV
  const guestToken = generateGuestToken();
  const tokenData: GuestTokenData = {
    orderId: String(order.id),
    restaurantId: data.restaurantId,
    guestName: data.guestName,
    phoneLastDigits: data.phoneLastDigits,
    createdAt: Date.now(),
  };

  const fourHoursInSeconds = 4 * 60 * 60;
  await c.env.CACHE_KV.put(
    `guest_token:${guestToken}`,
    JSON.stringify(tokenData),
    { expirationTtl: fourHoursInSeconds },
  );

  // 6. Set active order KV key (2hr TTL)
  const twoHoursInSeconds = 2 * 60 * 60;
  await c.env.CACHE_KV.put(activeOrderKey, String(order.id), {
    expirationTtl: twoHoursInSeconds,
  });
  // Reverse mapping so any cancel path (admin DELETE, guest cancel, cleanup
  // jobs) can locate and clear the active-order key without knowing the
  // original phoneLastDigits + restaurantId combo.
  await c.env.CACHE_KV.put(`guest_active_lookup:${order.id}`, activeOrderKey, {
    expirationTtl: twoHoursInSeconds,
  });
  await meterEmit(c, "orders.created", {
    restaurantId: data.restaurantId,
    metadata: { orderId: order.id, source: "guest-orders" },
  });

  // 7. Return order + guestToken
  const tokenExpiresAt = new Date(
    Date.now() + fourHoursInSeconds * 1000,
  ).toISOString();
  return c.json(
    {
      success: true,
      data: {
        order,
        guestToken,
        tokenExpiresAt,
      },
    },
    201,
  );
});

// ─── GET /:id ─── View guest order (guest token required) ───
app.get("/:id", guestTokenAuth, async (c) => {
  const orderId = c.req.param("id");
  if (!orderId) throw badRequest("Missing order id");

  const ordersService = new OrdersService(c.env);
  const order = await ordersService.getOrder(orderId, true);

  if (!order) {
    throw notFound("Order not found");
  }

  return c.json({ success: true, data: { order } });
});

// ─── POST /:id/items ─── Add items to guest order (guest token required) ───
app.post("/:id/items", guestTokenAuth, async (c) => {
  const orderId = c.req.param("id");
  if (!orderId) throw badRequest("Missing order id");

  const body = await c.req.json();
  const parsed = addGuestOrderItemsSchema.safeParse(body);
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

  const ordersService = new OrdersService(c.env);
  const order = await ordersService.getOrder(orderId, true);

  if (!order) {
    throw notFound("Order not found");
  }

  // Only allow adding items to pending or confirmed orders
  const status = String(order.status).toLowerCase();
  if (status !== "pending" && status !== "confirmed") {
    throw badRequest(`Cannot add items to an order with status: ${status}`);
  }

  // Enforce guest item limit (20 total)
  const existingItemCount = order.items?.length ?? 0;
  if (existingItemCount + parsed.data.items.length > 20) {
    throw badRequest("Guest orders cannot exceed 20 items total");
  }

  const updatedOrder = await ordersService.addItemsToOrder(
    orderId,
    parsed.data.items,
  );

  return c.json({
    success: true,
    data: { order: updatedOrder },
    message: "Items added successfully",
  });
});

// ─── POST /:id/cancel ─── Cancel guest order (guest token required) ───
app.post("/:id/cancel", guestTokenAuth, async (c) => {
  const orderId = c.req.param("id");
  if (!orderId) throw badRequest("Missing order id");

  const ordersService = new OrdersService(c.env);
  const order = await ordersService.getOrder(orderId, false);

  if (!order) {
    throw notFound("Order not found");
  }

  // Only allow cancelling pending or confirmed orders
  const status = String(order.status).toLowerCase();
  if (status !== "pending" && status !== "confirmed") {
    throw badRequest(`Cannot cancel an order with status: ${status}`);
  }

  const cancelledOrder = await ordersService.cancelOrder(
    orderId,
    "Cancelled by guest",
  );

  // Clean up KV keys
  const guestData = c.get("guestOrder");
  const activeOrderKey = `guest_active:${guestData.restaurantId}:${guestData.phoneLastDigits}`;
  await Promise.allSettled([
    c.env.CACHE_KV.delete(activeOrderKey),
    c.env.CACHE_KV.delete(`guest_active_lookup:${orderId}`),
  ]);

  // Also remove guest token to prevent further access
  const authHeader = c.req.header("Authorization");
  if (authHeader) {
    const token = authHeader.substring(7);
    await c.env.CACHE_KV.delete(`guest_token:${token}`);
  }

  return c.json({
    success: true,
    data: { order: cancelledOrder },
    message: "Order cancelled successfully",
  });
});

export default app;
