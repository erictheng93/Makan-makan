/**
 * Kitchen Service
 * Business logic for kitchen operations and real-time events
 */

import type { Env } from "../../../types/env";
import { ConsoleLogger } from "../../../core/monitoring";
import type {
  IKitchenService,
  KitchenConnection,
  KitchenSSEEvent,
  KitchenOrder,
  KitchenOrdersResponse,
  OrderItemStatusUpdate,
  ConnectionStatus,
  BroadcastTestEvent,
} from "../types";
import { OrdersService } from "../../orders/services/OrdersService";
import { OrderStatus } from "@makanmakan/shared-types";

export class KitchenService implements IKitchenService {
  private connections = new Map<string, KitchenConnection>();
  private logger: ConsoleLogger;
  private env: Env;
  private ordersService: OrdersService;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cleanupInitialized = false;

  constructor(env: Env) {
    this.env = env;
    this.logger = new ConsoleLogger("KitchenService");
    this.ordersService = new OrdersService(env);
    // Don't start cleanup interval in constructor - use lazy initialization
  }

  private initializeCleanup(): void {
    if (!this.cleanupInitialized) {
      this.cleanupInitialized = true;
      // In Worker environment, use periodic cleanup strategy instead of global setInterval
      // Cleanup logic will be triggered on each request
    }
  }

  // Connection Management
  registerConnection(
    connectionId: string,
    connection: KitchenConnection,
  ): void {
    // Initialize cleanup and trigger cleanup check
    this.initializeCleanup();
    this.cleanupExpiredConnections();

    this.connections.set(connectionId, connection);
    this.logger.info("Kitchen SSE connection registered", {
      connectionId,
      restaurantId: connection.restaurantId,
      userId: connection.userId,
    });
  }

  removeConnection(connectionId: string): void {
    if (this.connections.delete(connectionId)) {
      this.logger.info("Kitchen SSE connection removed", { connectionId });
    }
  }

  broadcastToKitchen(restaurantId: string, event: KitchenSSEEvent): number {
    let sentCount = 0;

    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.restaurantId === restaurantId && connection.controller) {
        try {
          const eventData = this.formatSSEEvent(event);
          connection.controller?.writeSSE({ data: eventData });
          sentCount++;
        } catch (error) {
          this.logger.error(
            `Failed to send event to connection ${connectionId}`,
            error instanceof Error ? error : undefined,
          );
          // Remove failed connection
          this.connections.delete(connectionId);
        }
      }
    }

    this.logger.info(`Broadcasted event to ${sentCount} kitchen connections`, {
      restaurantId,
      eventType: event.data.type,
    });
    return sentCount;
  }

  cleanupExpiredConnections(): void {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes timeout

    for (const [connectionId, connection] of this.connections.entries()) {
      if (now - connection.lastHeartbeat > timeout) {
        this.logger.info("Cleaning up expired connection", { connectionId });
        this.connections.delete(connectionId);
      }
    }
  }

  getConnectionStatus(restaurantId: string): ConnectionStatus {
    const restaurantConnections = Array.from(this.connections.entries())
      .filter(([_, conn]) => conn.restaurantId === restaurantId)
      .map(([id, conn]) => ({
        id,
        userId: conn.userId,
        restaurantId: conn.restaurantId,
        lastHeartbeat: new Date(conn.lastHeartbeat).toISOString(),
        connected: Date.now() - conn.lastHeartbeat < 60000, // 1 minute threshold
      }));

    return {
      totalConnections: this.connections.size,
      restaurantConnections: restaurantConnections.length,
      connections: restaurantConnections,
    };
  }

  // Kitchen Operations
  async getKitchenOrders(
    restaurantId: string,
    userId?: number,
  ): Promise<KitchenOrdersResponse> {
    try {
      this.logger.info("Fetching kitchen orders", { restaurantId, userId });

      // Query actual orders from database
      const ordersService = this.ordersService;

      // Get orders that are relevant to kitchen (confirmed, preparing, ready).
      // OrderQueryFilters.status uses the DB string-union OrderStatus
      // (see apps/api/src/features/orders/types/index.ts), so we pass string
      // literals matching the orders.status text column. `as const` is needed
      // so TypeScript narrows the literal types instead of widening to string[].
      const result = await ordersService.getOrders({
        restaurantId,
        status: ["confirmed", "preparing", "ready"] as const,
      });

      // Transform orders to KitchenOrder format
      const kitchenOrders: KitchenOrder[] = result.orders.map((order) => {
        const elapsedMinutes = Math.floor(
          (Date.now() - new Date(order.createdAt).getTime()) / 60000,
        );

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          tableId: order.tableId || 0, // Default to 0 if no table
          tableName: order.tableId ? `Table ${order.tableId}` : "No Table",
          // TODO(Phase 5): Remove this string→number bridge when kitchen-display
          // migrates to the canonical string union (Issue #9, Phase 5).
          status:
            order.status === "confirmed"
              ? 1
              : order.status === "preparing"
                ? 2
                : order.status === "ready"
                  ? 3
                  : order.status === "delivered"
                    ? 4
                    : order.status === "paid"
                      ? 5
                      : order.status === "cancelled"
                        ? 6
                        : 0,
          items: (order.items || []).map((item) => {
            // item.status is already a string — pass through directly.
            const itemStatus =
              (item.status as unknown as
                | "pending"
                | "preparing"
                | "ready"
                | "completed") || "pending";

            return {
              id: item.id,
              name: item.menuItem?.name || "Unknown Item",
              quantity: item.quantity,
              status: itemStatus,
              notes: item.notes || "",
              priority: "normal" as const,
              estimatedTime: 15,
            };
          }),
          customerName: order.customerInfo?.name || "Guest",
          notes: order.notes,
          createdAt: order.createdAt,
          totalItems:
            order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
          priority: "normal",
          elapsedTime: elapsedMinutes,
        };
      });

      // Filter by status for backwards compatibility (o.status is numeric: 1=confirmed, 2=preparing, 3=ready)
      const pending = kitchenOrders.filter((o) => o.status === 1);
      const preparing = kitchenOrders.filter((o) => o.status === 2);
      const ready = kitchenOrders.filter((o) => o.status === 3);

      // Get daily stats for completedToday count
      const dailyStats = await ordersService.getDailyStats(restaurantId);

      // Calculate average waiting time from current pending orders
      let totalWaitingTime = 0;
      const pendingOrdersCount = pending.length + preparing.length;
      if (pendingOrdersCount > 0) {
        pending.forEach((o) => {
          totalWaitingTime += o.elapsedTime || 0;
        });
        preparing.forEach((o) => {
          totalWaitingTime += o.elapsedTime || 0;
        });
      }
      const averageWaitingTime =
        pendingOrdersCount > 0
          ? Math.round(totalWaitingTime / pendingOrdersCount)
          : 0;

      // Count urgent orders (orders waiting more than 30 minutes)
      const urgentThreshold = 30; // minutes
      const urgentOrders = kitchenOrders.filter(
        (o) => (o.elapsedTime || 0) > urgentThreshold,
      ).length;

      // Calculate efficiency: completedToday / (completedToday + pending + preparing)
      const totalOrders = dailyStats.totalOrders || 0;
      const completed = dailyStats.completedOrders || 0;
      const efficiency =
        totalOrders > 0 ? Math.round((completed / totalOrders) * 100) : 0;

      const stats = {
        pendingCount: pending.length,
        preparingCount: preparing.length,
        readyCount: ready.length,
        completedToday: completed,
        averageCookingTime: dailyStats.averagePreparationTime || 0, // From order stats
        averageWaitingTime,
        efficiency,
        urgentOrders,
      };

      return {
        pending,
        preparing,
        ready,
        stats,
      };
    } catch (error) {
      this.logger.error(
        "Failed to fetch kitchen orders",
        error instanceof Error ? error : undefined,
        { restaurantId },
      );
      throw error;
    }
  }

  async updateOrderItemStatus(
    restaurantId: string,
    orderId: number,
    itemId: number,
    statusUpdate: OrderItemStatusUpdate,
    userId: number,
  ): Promise<{
    orderId: number;
    itemId: number;
    status: string;
    updatedAt: string;
    broadcastSent: number;
  }> {
    try {
      this.logger.info("Updating order item status", {
        restaurantId,
        orderId,
        itemId,
        status: statusUpdate.status,
        userId,
      });

      await this.ordersService.updateItemStatus(
        itemId,
        statusUpdate.status,
        statusUpdate.notes,
      );

      const updatedAt = new Date().toISOString();

      // Broadcast status update event
      const event: KitchenSSEEvent = {
        id: `update_${Date.now()}_${orderId}_${itemId}`,
        event: "order-update",
        data: {
          type: "ORDER_STATUS_UPDATE",
          orderId,
          payload: {
            itemId,
            status: statusUpdate.status,
            updatedBy: userId,
            updatedAt,
            notes: statusUpdate.notes,
          },
          timestamp: updatedAt,
          restaurantId,
        },
      };

      const sentCount = this.broadcastToKitchen(restaurantId, event);

      return {
        orderId,
        itemId,
        status: statusUpdate.status,
        updatedAt,
        broadcastSent: sentCount,
      };
    } catch (error) {
      this.logger.error(
        "Failed to update order item status",
        error instanceof Error ? error : undefined,
        {
          restaurantId,
          orderId,
          itemId,
        },
      );
      throw error;
    }
  }

  // Development/Testing
  broadcastTestEvent(restaurantId: string, event: BroadcastTestEvent): number {
    const testEvent: KitchenSSEEvent = {
      id: `test_${Date.now()}`,
      event: "test-event",
      data: {
        type: event.type || "NEW_ORDER",
        orderId: 999,
        payload: event.payload || { message: "Test broadcast event" },
        timestamp: new Date().toISOString(),
        restaurantId,
      },
    };

    const sentCount = this.broadcastToKitchen(restaurantId, testEvent);
    this.logger.info("Test event broadcasted", {
      restaurantId,
      sentCount,
      event: testEvent,
    });

    return sentCount;
  }

  // Utilities
  generateConnectionId(): string {
    return `kitchen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  formatSSEEvent(event: KitchenSSEEvent): string {
    let result = "";

    if (event.id) {
      result += `id: ${event.id}\n`;
    }

    if (event.event) {
      result += `event: ${event.event}\n`;
    }

    result += `data: ${JSON.stringify(event.data)}\n`;

    return result;
  }

  validateChefAccess(
    userId: number,
    userRole: number,
    restaurantId: string,
  ): boolean {
    // Kitchen access: Admin (0), Owner (1), Chef (2), Service Crew (3)
    const allowedRoles = [0, 1, 2, 3];
    if (!allowedRoles.includes(userRole)) {
      this.logger.warn("Access denied - insufficient kitchen permissions", {
        userId,
        userRole,
        restaurantId,
        allowedRoles,
      });
      return false;
    }

    // Additional restaurant validation would go here
    // For now, assuming user.restaurantId is validated elsewhere

    return true;
  }

  // Cleanup method for service shutdown
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.connections.clear();
    this.logger.info("Kitchen service destroyed");
  }
}
