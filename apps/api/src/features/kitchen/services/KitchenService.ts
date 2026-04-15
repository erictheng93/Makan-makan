/**
 * Kitchen Service
 * Business logic for kitchen operations.
 *
 * NOTE: This service previously tracked SSE connections and broadcast events
 * via an in-memory Map. That code was dead: each request handler created a
 * fresh KitchenService instance, so the Map was never shared across requests
 * and cross-request broadcasts could never reach any listener. Real-time
 * kitchen updates flow through RealtimeBroadcastService → REALTIME_SESSION
 * Durable Object → WebSocket clients (apps/kitchen-display uses
 * useRealtimeKitchen.ts for this). The /kitchen/:id/events SSE endpoint now
 * just provides a "connected" status indicator and periodic heartbeats.
 */

import type { Env } from "../../../types/env";
import { ConsoleLogger } from "../../../core/monitoring";
import type {
  IKitchenService,
  KitchenOrder,
  KitchenOrdersResponse,
  OrderItemStatusUpdate,
} from "../types";
import { OrdersService } from "../../orders/services/OrdersService";

export class KitchenService implements IKitchenService {
  private logger: ConsoleLogger;
  private env: Env;
  private ordersService: OrdersService;

  constructor(env: Env) {
    this.env = env;
    this.logger = new ConsoleLogger("KitchenService");
    this.ordersService = new OrdersService(env);
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
          status: order.status,
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

      const pending = kitchenOrders.filter((o) => o.status === "confirmed");
      const preparing = kitchenOrders.filter((o) => o.status === "preparing");
      const ready = kitchenOrders.filter((o) => o.status === "ready");

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

      return {
        orderId,
        itemId,
        status: statusUpdate.status,
        updatedAt: new Date().toISOString(),
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

    return true;
  }
}
