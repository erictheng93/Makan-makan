/**
 * Kitchen Feature Routes
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { authMiddleware, sseAuthMiddleware } from "../../../middleware/auth";
import { moduleGate } from "../../../middleware/moduleGate";
import type { Env } from "../../../types/env";
import { KitchenService } from "../services/KitchenService";
import { createSuccessResponse } from "../../../shared/utils/response";
import { forbidden, badRequest } from "../../../shared/utils/api-error";

const app = new Hono<{ Bindings: Env }>();

/**
 * SSE 端點 - 廚房連線狀態指示
 * GET /api/v1/kitchen/{restaurantId}/events
 *
 * This stream only emits a "connected" welcome event and periodic heartbeats
 * so the kitchen-display UI can show online/offline status. Actual order
 * events flow through the realtime WebSocket (REALTIME_SESSION Durable
 * Object), not through this stream.
 */
app.get(
  "/:restaurantId/events",
  sseAuthMiddleware,
  moduleGate("kitchen_display"),
  async (c) => {
    const restaurantId = c.req.param("restaurantId");
    if (!restaurantId)
      throw badRequest("Missing restaurantId parameter", "MISSING_PARAM");
    const user = c.get("user");
    const kitchenService = new KitchenService(c.env);

    if (!kitchenService.validateChefAccess(user.id, user.role, restaurantId)) {
      throw forbidden(
        "Access denied. Chef role required.",
        "CHEF_ACCESS_REQUIRED",
      );
    }

    if (user.restaurantId !== restaurantId) {
      throw forbidden(
        "Access denied. Restaurant permission required.",
        "RESTAURANT_ACCESS_DENIED",
      );
    }

    console.log(
      `Kitchen SSE connection requested for restaurant ${restaurantId} by user ${user.id}`,
    );

    return streamSSE(c, async (stream) => {
      // Send initial connection confirmation. Don't await — Hono's streamSSE
      // needs the handler to yield quickly so the initial response headers
      // and body chunk are flushed to the client.
      stream.writeSSE({
        event: "connected",
        data: JSON.stringify({
          type: "HEARTBEAT",
          timestamp: new Date().toISOString(),
          restaurantId,
          message: "Kitchen display connected successfully",
        }),
        id: `heartbeat_${Date.now()}`,
      });

      const heartbeatInterval = setInterval(() => {
        try {
          stream.writeSSE({
            event: "heartbeat",
            data: JSON.stringify({
              type: "HEARTBEAT",
              timestamp: new Date().toISOString(),
              restaurantId,
            }),
            id: `heartbeat_${Date.now()}`,
          });
        } catch (error) {
          console.error("Kitchen SSE heartbeat failed:", error);
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Keep stream alive until client disconnects
      await new Promise<void>((resolve) => {
        c.req.raw.signal?.addEventListener("abort", () => {
          console.log(
            `Kitchen SSE connection closed (restaurant ${restaurantId})`,
          );
          clearInterval(heartbeatInterval);
          resolve();
        });
      });
    });
  },
);

/**
 * 獲取廚房訂單資料
 * GET /api/v1/kitchen/{restaurantId}/orders
 */
app.get(
  "/:restaurantId/orders",
  authMiddleware,
  moduleGate("kitchen_display"),
  async (c) => {
    const restaurantId = c.req.param("restaurantId");
    if (!restaurantId)
      throw badRequest("Missing restaurantId parameter", "MISSING_PARAM");
    const user = c.get("user");
    const kitchenService = new KitchenService(c.env);

    if (
      !kitchenService.validateChefAccess(user.id, user.role, restaurantId) ||
      user.restaurantId !== restaurantId
    ) {
      throw forbidden("Access denied", "ACCESS_DENIED");
    }

    const data = await kitchenService.getKitchenOrders(restaurantId, user.id);

    return c.json(
      createSuccessResponse(data, "Kitchen orders retrieved successfully"),
    );
  },
);

/**
 * 更新訂單項目狀態
 * PUT /api/v1/kitchen/{restaurantId}/orders/{orderId}/items/{itemId}
 */
app.put(
  "/:restaurantId/orders/:orderId/items/:itemId",
  authMiddleware,
  moduleGate("kitchen_display"),
  async (c) => {
    const restaurantId = c.req.param("restaurantId");
    if (!restaurantId)
      throw badRequest("Missing restaurantId parameter", "MISSING_PARAM");
    const orderIdParam = c.req.param("orderId");
    if (!orderIdParam)
      throw badRequest("Missing orderId parameter", "MISSING_PARAM");
    const itemIdParam = c.req.param("itemId");
    if (!itemIdParam)
      throw badRequest("Missing itemId parameter", "MISSING_PARAM");
    const orderId = parseInt(orderIdParam);
    const itemId = parseInt(itemIdParam);
    const statusUpdate = await c.req.json();
    const user = c.get("user");
    const kitchenService = new KitchenService(c.env);

    if (
      !kitchenService.validateChefAccess(user.id, user.role, restaurantId) ||
      user.restaurantId !== restaurantId
    ) {
      throw forbidden("Access denied", "ACCESS_DENIED");
    }

    const result = await kitchenService.updateOrderItemStatus(
      restaurantId,
      orderId,
      itemId,
      statusUpdate,
      user.id,
    );

    return c.json(
      createSuccessResponse(result, "Order item status updated successfully"),
    );
  },
);

export default app;
