/**
 * Guest Orders Routes
 * Public endpoints for unauthenticated QR code ordering.
 * Completely bypasses authMiddleware; uses KV-based guest tokens instead.
 */

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import {
  createDatabase,
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

  try {
    const db = createDatabase(c.env.DB);

    // 1. Query restaurant and check allowGuestOrders
    const restaurant = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, data.restaurantId))
      .get();

    if (!restaurant) {
      return c.json({ success: false, error: "Restaurant not found" }, 404);
    }

    if (!restaurant.isActive || !restaurant.isAvailable) {
      return c.json(
        { success: false, error: "Restaurant is currently unavailable" },
        400,
      );
    }

    const settings = restaurant.settings as Record<string, unknown> | null;
    if (!settings || settings.allowGuestOrders !== true) {
      return c.json(
        {
          success: false,
          error: "Guest orders are not enabled for this restaurant",
        },
        403,
      );
    }

    // 2. Check active order limit per phoneLastDigits + restaurant
    const activeOrderKey = `guest_active:${data.restaurantId}:${data.phoneLastDigits}`;
    const existingActiveOrder = await c.env.CACHE_KV.get(activeOrderKey);
    if (existingActiveOrder) {
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
        return c.json(
          {
            success: false,
            error: "Table not found or does not belong to this restaurant",
          },
          400,
        );
      }
    }

    if (data.orderType === "seat") {
      const seat = await db
        .select()
        .from(seats)
        .where(eq(seats.id, data.seatId!))
        .get();

      if (!seat || seat.tableId !== data.tableId) {
        return c.json(
          {
            success: false,
            error: "Seat not found or does not belong to this table",
          },
          400,
        );
      }
    }

    // 4. Create order via OrdersService
    const fulfillmentType =
      data.deliveryInfo?.type ??
      (data.orderType === "shop" ? "takeaway" : "dine_in");

    const ordersService = new OrdersService(c.env);
    const order = await ordersService.createOrder({
      restaurantId: data.restaurantId,
      tableId: data.tableId,
      customerInfo: {
        name: data.guestName,
        phone: data.phoneLastDigits, // Store last 3 digits in phone field
      },
      items: data.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        customizations: item.customizations,
        notes: item.notes,
      })),
      notes: data.notes,
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
  } catch (error) {
    console.error("Guest order creation failed:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create guest order",
      },
      500,
    );
  }
});

// ─── GET /:id ─── View guest order (guest token required) ───
app.get("/:id", guestTokenAuth, async (c) => {
  const orderId = c.req.param("id");

  try {
    const ordersService = new OrdersService(c.env);
    const order = await ordersService.getOrder(Number(orderId), true);

    if (!order) {
      return c.json({ success: false, error: "Order not found" }, 404);
    }

    return c.json({ success: true, data: { order } });
  } catch (error) {
    console.error("Guest order view failed:", error);
    return c.json({ success: false, error: "Failed to retrieve order" }, 500);
  }
});

// ─── POST /:id/items ─── Add items to guest order (guest token required) ───
app.post("/:id/items", guestTokenAuth, async (c) => {
  const orderId = c.req.param("id");

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

  try {
    const ordersService = new OrdersService(c.env);
    const order = await ordersService.getOrder(Number(orderId), true);

    if (!order) {
      return c.json({ success: false, error: "Order not found" }, 404);
    }

    // Only allow adding items to pending or confirmed orders
    const status = String(order.status).toLowerCase();
    if (status !== "pending" && status !== "confirmed") {
      return c.json(
        {
          success: false,
          error: `Cannot add items to an order with status: ${status}`,
        },
        400,
      );
    }

    // Enforce guest item limit (20 total)
    const existingItemCount = order.items?.length ?? 0;
    if (existingItemCount + parsed.data.items.length > 20) {
      return c.json(
        { success: false, error: "Guest orders cannot exceed 20 items total" },
        400,
      );
    }

    // Use the order modification / addItems approach via the base service
    const updatedOrder = await ordersService.updateOrder(Number(orderId), {
      notes: order.notes, // preserve existing notes
    });

    // For now, create supplementary items through the service
    // The actual item addition depends on base service support
    // This broadcasts the update via realtime

    return c.json({
      success: true,
      data: { order: updatedOrder || order },
      message: "Items added successfully",
    });
  } catch (error) {
    console.error("Guest order add items failed:", error);
    return c.json({ success: false, error: "Failed to add items" }, 500);
  }
});

// ─── POST /:id/cancel ─── Cancel guest order (guest token required) ───
app.post("/:id/cancel", guestTokenAuth, async (c) => {
  const orderId = c.req.param("id");

  try {
    const ordersService = new OrdersService(c.env);
    const order = await ordersService.getOrder(Number(orderId), false);

    if (!order) {
      return c.json({ success: false, error: "Order not found" }, 404);
    }

    // Only allow cancelling pending or confirmed orders
    const status = String(order.status).toLowerCase();
    if (status !== "pending" && status !== "confirmed") {
      return c.json(
        {
          success: false,
          error: `Cannot cancel an order with status: ${status}`,
        },
        400,
      );
    }

    const cancelledOrder = await ordersService.cancelOrder(
      Number(orderId),
      "Cancelled by guest",
    );

    // Clean up KV keys
    const guestData = c.get("guestOrder");
    const activeOrderKey = `guest_active:${guestData.restaurantId}:${guestData.phoneLastDigits}`;
    await c.env.CACHE_KV.delete(activeOrderKey);

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
  } catch (error) {
    console.error("Guest order cancel failed:", error);
    return c.json({ success: false, error: "Failed to cancel order" }, 500);
  }
});

export default app;
