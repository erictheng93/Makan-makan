/**
 * SSE Controller
 * Handles Server-Sent Events requests and business logic
 */

import { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { SSEService } from "../services/SSEService";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../../../shared/utils/response";
import type { Env } from "../../../types/env";
import type { SSEConnection, SSEEvent, BroadcastEvent } from "../types";

export class SSEController {
  private sseService: SSEService;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.sseService = new SSEService(env);
  }

  // Generate connection ID
  private generateConnectionId(): string {
    return `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Establish SSE connection
   * GET /api/v1/sse/events
   */
  async connect(c: Context) {
    const user = c.get("user");
    const queryRestaurantId = c.req.query("restaurant_id") || "";
    const restaurantId =
      queryRestaurantId ||
      (user.restaurantId == null ? "" : String(user.restaurantId));

    // Verify restaurant permissions
    if (user.role !== 0 && user.restaurantId !== restaurantId) {
      return c.json(
        {
          success: false,
          error: "Access denied. Restaurant permission required.",
        },
        403,
      );
    }

    return streamSSE(c, async (stream) => {
      const connectionId = this.generateConnectionId();

      // Create SSE connection
      const connection: SSEConnection = {
        id: connectionId,
        restaurantId: restaurantId!,
        userId: user.id,
        role: user.role,
        lastHeartbeat: Date.now(),
        controller: stream as unknown as ReadableStreamDefaultController,
      };

      // Register connection
      this.sseService.registerConnection(connectionId, connection);

      // Send welcome message
      const welcomeEvent: SSEEvent = {
        id: Date.now().toString(),
        event: "connected",
        data: {
          type: "connection_established",
          message: "SSE connected",
          timestamp: new Date().toISOString(),
          connectionId,
        },
      };

      stream.writeSSE({
        data: JSON.stringify(welcomeEvent.data),
        event: welcomeEvent.event,
        id: welcomeEvent.id,
      });

      // Set up heartbeat
      const heartbeatInterval = setInterval(() => {
        try {
          stream.writeSSE({
            data: JSON.stringify({
              type: "heartbeat",
              timestamp: new Date().toISOString(),
            }),
            event: "heartbeat",
          });
          connection.lastHeartbeat = Date.now();
        } catch (error) {
          console.error("SSE heartbeat error:", error);
          clearInterval(heartbeatInterval);
          this.sseService.removeConnection(connectionId);
        }
      }, 30000); // Every 30 seconds

      // Keep stream alive until client disconnects
      await new Promise<void>((resolve) => {
        c.req.raw.signal?.addEventListener("abort", () => {
          clearInterval(heartbeatInterval);
          this.sseService.removeConnection(connectionId);
          console.log(`SSE connection ${connectionId} closed`);
          resolve();
        });
      });
    });
  }

  /**
   * Get connection status
   * GET /api/v1/sse/connections
   */
  async getConnections(c: Context) {
    try {
      const restaurantId = c.req.query("restaurant_id") || "";
      const user = c.get("user");

      // Admin can see all connections, others only their restaurant
      if (user.role !== 0 && restaurantId !== user.restaurantId) {
        return c.json(
          {
            success: false,
            error: "Access denied. Admin access required.",
          },
          403,
        );
      }

      const status = this.sseService.getConnectionStatus();

      // Filter by restaurant if not admin
      if (user.role !== 0 && restaurantId) {
        const restaurantConnections =
          this.sseService.getConnectionsByRestaurant(restaurantId);
        return c.json(
          createSuccessResponse({
            connections: restaurantConnections.length,
            restaurantId,
            details: restaurantConnections.map((conn) => ({
              id: conn.id,
              userId: conn.userId,
              role: conn.role,
              lastHeartbeat: conn.lastHeartbeat,
              connected: Date.now() - conn.lastHeartbeat < 60000, // Active within 1 minute
            })),
          }),
        );
      }

      return c.json(createSuccessResponse(status));
    } catch (error) {
      console.error("SSE connections status error:", error);
      return c.json(
        createErrorResponse("Failed to get connection status"),
        500,
      );
    }
  }

  /**
   * Broadcast order update
   * POST /api/v1/sse/broadcast/order-update
   */
  async broadcastOrderUpdate(c: Context) {
    try {
      const { orderId, orderData, restaurantId, targetRoles } =
        await c.req.json();

      const event: BroadcastEvent = {
        type: "order-update",
        data: {
          orderId,
          order: orderData,
          timestamp: new Date().toISOString(),
        },
        restaurantId,
        targetRoles,
      };

      await this.sseService.broadcast(event);

      return c.json(
        createSuccessResponse({
          event_type: "order_update",
          orderId,
          restaurantId,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (error) {
      console.error("Failed to broadcast order update:", error);
      return c.json(
        createErrorResponse("Failed to broadcast order update"),
        500,
      );
    }
  }

  /**
   * Broadcast menu update
   * POST /api/v1/sse/broadcast/menu-update
   */
  async broadcastMenuUpdate(c: Context) {
    try {
      const { menuItemId, updateType, restaurantId, targetRoles } =
        await c.req.json();

      const event: BroadcastEvent = {
        type: "menu-update",
        data: {
          menuItemId,
          updateType, // 'created', 'updated', 'deleted', 'availability_changed'
          timestamp: new Date().toISOString(),
        },
        restaurantId,
        targetRoles,
      };

      await this.sseService.broadcast(event);

      return c.json(
        createSuccessResponse({
          event_type: "menu_update",
          menuItemId,
          updateType,
          restaurantId,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (error) {
      console.error("Failed to broadcast menu update:", error);
      return c.json(
        createErrorResponse("Failed to broadcast menu update"),
        500,
      );
    }
  }

  /**
   * Broadcast system notification
   * POST /api/v1/sse/broadcast/system-notification
   */
  async broadcastSystemNotification(c: Context) {
    try {
      const { title, message, level, persistent, restaurantId, targetRoles } =
        await c.req.json();

      const event: BroadcastEvent = {
        type: "system-notification",
        data: {
          title,
          message,
          level: level || "info", // 'info', 'warning', 'error', 'success'
          persistent: persistent || false,
          timestamp: new Date().toISOString(),
        },
        restaurantId,
        targetRoles,
      };

      await this.sseService.broadcast(event);

      return c.json(
        createSuccessResponse({
          event_type: "system_notification",
          title,
          level,
          restaurantId,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (error) {
      console.error("Failed to broadcast system notification:", error);
      return c.json(
        createErrorResponse("Failed to broadcast system notification"),
        500,
      );
    }
  }

  /**
   * Group Orders - Broadcast group created
   * POST /api/v1/sse/broadcast/group-created
   */
  async broadcastGroupCreated(c: Context) {
    try {
      const { groupOrderId, restaurantId, tableId, shareCode } =
        await c.req.json();

      const event: BroadcastEvent = {
        type: "group-created",
        data: {
          groupOrderId,
          shareCode,
          tableId,
          action: "group_created",
          timestamp: new Date().toISOString(),
        },
        restaurantId,
      };

      await this.sseService.broadcast(event);

      return c.json(
        createSuccessResponse({
          event_type: "group_created",
          groupOrderId,
        }),
      );
    } catch (error) {
      console.error("Failed to broadcast group creation:", error);
      return c.json(
        createErrorResponse("Failed to broadcast group creation"),
        500,
      );
    }
  }

  /**
   * Group Orders - Broadcast member joined
   * POST /api/v1/sse/broadcast/member-joined
   */
  async broadcastMemberJoined(c: Context) {
    try {
      const { groupOrderId, memberId, memberName, restaurantId } =
        await c.req.json();

      const event: BroadcastEvent = {
        type: "member-joined",
        data: {
          groupOrderId,
          memberId,
          memberName,
          action: "member_joined",
          timestamp: new Date().toISOString(),
        },
        restaurantId,
      };

      await this.sseService.broadcast(event);

      return c.json(
        createSuccessResponse({
          event_type: "member_joined",
          groupOrderId,
          memberId,
        }),
      );
    } catch (error) {
      console.error("Failed to broadcast member join:", error);
      return c.json(
        createErrorResponse("Failed to broadcast member join"),
        500,
      );
    }
  }

  /**
   * Group Orders - Broadcast cart updated
   * POST /api/v1/sse/broadcast/cart-updated
   */
  async broadcastCartUpdated(c: Context) {
    try {
      const {
        groupOrderId,
        memberId,
        action,
        item,
        itemId,
        updates,
        restaurantId,
      } = await c.req.json();

      const event: BroadcastEvent = {
        type: "cart-updated",
        data: {
          groupOrderId,
          memberId,
          action, // 'add', 'update', 'remove'
          item,
          itemId,
          updates,
          timestamp: new Date().toISOString(),
        },
        restaurantId,
      };

      await this.sseService.broadcast(event);

      return c.json(
        createSuccessResponse({
          event_type: "cart_updated",
          groupOrderId,
          action,
        }),
      );
    } catch (error) {
      console.error("Failed to broadcast cart update:", error);
      return c.json(
        createErrorResponse("Failed to broadcast cart update"),
        500,
      );
    }
  }

  /**
   * Test broadcast endpoint
   * POST /api/v1/sse/test
   */
  async broadcastTest(c: Context) {
    // Disable test endpoint in production
    if (this.env?.NODE_ENV === "production") {
      return c.json(
        createErrorResponse("Test endpoint not available in production"),
        401,
      );
    }

    try {
      const { event, message } = await c.req.json();

      await this.sseService.broadcastTest({
        event: event || "test",
        message: message || "Test broadcast message",
        timestamp: new Date().toISOString(),
        connectionId: "test",
      });

      return c.json(
        createSuccessResponse({
          message: "Test broadcast sent successfully",
        }),
      );
    } catch (error) {
      console.error("SSE test broadcast error:", error);
      return c.json(createErrorResponse("Failed to send test broadcast"), 500);
    }
  }
}
