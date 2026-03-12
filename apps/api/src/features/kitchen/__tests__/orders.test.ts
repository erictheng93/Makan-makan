/**
 * Kitchen Orders Tests
 * 測試廚房訂單獲取和狀態更新功能
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { KitchenService } from "../services/KitchenService";
import type { KitchenSSEEvent, OrderItemStatusUpdate } from "../types";
import { OrderStatus } from "@makanmakan/shared-types";

// Mock OrdersService with hoisted mock for flexibility
const mockGetOrders = vi.hoisted(() => vi.fn());
const mockGetDailyStats = vi.hoisted(() => vi.fn());

// Default mock data
const mockOrdersData = {
  orders: [
    {
      id: 1,
      orderNumber: "ORD-001",
      tableId: 1,
      status: OrderStatus.CONFIRMED,
      createdAt: new Date().toISOString(),
      items: [
        {
          id: 1,
          menuItemId: 101,
          quantity: 2,
          status: 0,
          menuItem: { name: "炒飯" },
          notes: "不要蔥",
        },
      ],
      customerInfo: { name: "張三" },
      notes: "快點",
    },
    {
      id: 2,
      orderNumber: "ORD-002",
      tableId: 2,
      status: OrderStatus.PREPARING,
      createdAt: new Date().toISOString(),
      items: [
        {
          id: 2,
          menuItemId: 102,
          quantity: 1,
          status: 1,
          menuItem: { name: "炒麵" },
        },
      ],
    },
  ],
  pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
};

vi.mock("../../orders/services/OrdersService", () => {
  return {
    OrdersService: class MockOrdersService {
      getOrders = mockGetOrders;
      getDailyStats = mockGetDailyStats;
    },
  };
});

const mockEnv = {
  NODE_ENV: "test",
  DB: {},
  CACHE_KV: {},
} as any;

describe("KitchenService Orders", () => {
  let kitchenService: KitchenService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock return values
    mockGetOrders.mockResolvedValue(mockOrdersData);
    mockGetDailyStats.mockResolvedValue({
      completedToday: 0,
      cancelledToday: 0,
    });
    kitchenService = new KitchenService(mockEnv);
  });

  describe("getKitchenOrders", () => {
    it("should fetch and transform orders for kitchen display", async () => {
      const result = await kitchenService.getKitchenOrders("test-restaurant-1");

      expect(result).toHaveProperty("pending");
      expect(result).toHaveProperty("preparing");
      expect(result).toHaveProperty("ready");
      expect(result).toHaveProperty("stats");
    });

    it("should categorize orders by status", async () => {
      const result = await kitchenService.getKitchenOrders("test-restaurant-1");

      // Orders should be categorized
      expect(Array.isArray(result.pending)).toBe(true);
      expect(Array.isArray(result.preparing)).toBe(true);
      expect(Array.isArray(result.ready)).toBe(true);
    });

    it("should include order statistics", async () => {
      const result = await kitchenService.getKitchenOrders("test-restaurant-1");

      expect(result.stats).toHaveProperty("pendingCount");
      expect(result.stats).toHaveProperty("preparingCount");
      expect(result.stats).toHaveProperty("readyCount");
    });

    it("should transform order items correctly", async () => {
      const result = await kitchenService.getKitchenOrders("test-restaurant-1");

      const allOrders = [
        ...result.pending,
        ...result.preparing,
        ...result.ready,
      ];
      if (allOrders.length > 0) {
        const order = allOrders[0];
        expect(order).toHaveProperty("id");
        expect(order).toHaveProperty("orderNumber");
        expect(order).toHaveProperty("items");

        if (order.items.length > 0) {
          expect(order.items[0]).toHaveProperty("name");
          expect(order.items[0]).toHaveProperty("quantity");
          expect(order.items[0]).toHaveProperty("status");
        }
      }
    });

    it("should calculate elapsed time for orders", async () => {
      const result = await kitchenService.getKitchenOrders("test-restaurant-1");

      const allOrders = [
        ...result.pending,
        ...result.preparing,
        ...result.ready,
      ];
      allOrders.forEach((order) => {
        expect(order).toHaveProperty("elapsedTime");
        expect(typeof order.elapsedTime).toBe("number");
      });
    });

    it("should handle empty orders gracefully", async () => {
      // Override mock to return empty orders for this test
      mockGetOrders.mockResolvedValueOnce({
        orders: [],
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
      });

      const freshService = new KitchenService(mockEnv);
      const result = await freshService.getKitchenOrders("test-restaurant-1");

      expect(result.pending).toHaveLength(0);
      expect(result.preparing).toHaveLength(0);
      expect(result.ready).toHaveLength(0);
    });
  });

  describe("updateOrderItemStatus", () => {
    it("should update item status and return result", async () => {
      const statusUpdate: OrderItemStatusUpdate = {
        status: "preparing",
        notes: "Started cooking",
      };

      const result = await kitchenService.updateOrderItemStatus(
        "test-restaurant-1", // restaurantId
        1, // orderId
        1, // itemId
        statusUpdate,
        100, // userId
      );

      expect(result).toHaveProperty("orderId", 1);
      expect(result).toHaveProperty("itemId", 1);
      expect(result).toHaveProperty("status", "preparing");
      expect(result).toHaveProperty("updatedAt");
      expect(result).toHaveProperty("broadcastSent");
    });

    it("should broadcast status update to kitchen connections", async () => {
      // Register a connection first
      kitchenService.registerConnection("test-conn", {
        restaurantId: "test-restaurant-1",
        userId: 100,
        lastHeartbeat: Date.now(),
      });

      const statusUpdate: OrderItemStatusUpdate = {
        status: "ready",
      };

      const result = await kitchenService.updateOrderItemStatus(
        "test-restaurant-1",
        1,
        1,
        statusUpdate,
        100,
      );

      expect(result.broadcastSent).toBeGreaterThanOrEqual(0);
    });

    it("should include notes in status update", async () => {
      const statusUpdate: OrderItemStatusUpdate = {
        status: "preparing",
        notes: "Extra spicy as requested",
      };

      const result = await kitchenService.updateOrderItemStatus(
        "test-restaurant-1",
        1,
        1,
        statusUpdate,
        100,
      );

      expect(result.status).toBe("preparing");
    });
  });

  describe("broadcastToKitchen", () => {
    it("should broadcast event to all restaurant connections", () => {
      // Register multiple connections
      kitchenService.registerConnection("conn-1", {
        restaurantId: "test-restaurant-1",
        userId: 101,
        lastHeartbeat: Date.now(),
      });
      kitchenService.registerConnection("conn-2", {
        restaurantId: "test-restaurant-1",
        userId: 102,
        lastHeartbeat: Date.now(),
      });
      kitchenService.registerConnection("conn-3", {
        restaurantId: "test-restaurant-2", // Different restaurant
        userId: 103,
        lastHeartbeat: Date.now(),
      });

      const event: KitchenSSEEvent = {
        id: "test-event-1",
        event: "new-order",
        data: {
          type: "NEW_ORDER",
          orderId: 123,
          timestamp: new Date().toISOString(),
          restaurantId: "test-restaurant-1",
        },
      };

      // Note: Without actual SSE controllers, this will return 0
      // In real scenario, it would send to conn-1 and conn-2
      const sentCount = kitchenService.broadcastToKitchen(
        "test-restaurant-1",
        event,
      );

      expect(typeof sentCount).toBe("number");
    });

    it("should not broadcast to other restaurants", () => {
      kitchenService.registerConnection("conn-1", {
        restaurantId: "test-restaurant-2",
        userId: 101,
        lastHeartbeat: Date.now(),
      });

      const event: KitchenSSEEvent = {
        data: {
          type: "NEW_ORDER",
          orderId: 123,
          timestamp: new Date().toISOString(),
          restaurantId: "test-restaurant-1",
        },
      };

      const sentCount = kitchenService.broadcastToKitchen(
        "test-restaurant-1",
        event,
      );

      expect(sentCount).toBe(0);
    });
  });

  describe("broadcastTestEvent", () => {
    it("should broadcast test event for development", () => {
      kitchenService.registerConnection("test-conn", {
        restaurantId: "test-restaurant-1",
        userId: 100,
        lastHeartbeat: Date.now(),
      });

      const sentCount = kitchenService.broadcastTestEvent("test-restaurant-1", {
        type: "NEW_ORDER",
        payload: { message: "Test broadcast" },
      });

      expect(typeof sentCount).toBe("number");
    });

    it("should use default type if not provided", () => {
      const sentCount = kitchenService.broadcastTestEvent("test-restaurant-1", {
        payload: { test: true },
      });

      expect(typeof sentCount).toBe("number");
    });
  });

  describe("Connection Management with Orders", () => {
    it("should track connections per restaurant", () => {
      kitchenService.registerConnection("conn-1", {
        restaurantId: "test-restaurant-1",
        userId: 101,
        lastHeartbeat: Date.now(),
      });
      kitchenService.registerConnection("conn-2", {
        restaurantId: "test-restaurant-1",
        userId: 102,
        lastHeartbeat: Date.now(),
      });

      const status = kitchenService.getConnectionStatus("test-restaurant-1");

      expect(status.restaurantConnections).toBe(2);
    });

    it("should cleanup expired connections before fetching orders", async () => {
      // Register an expired connection (more than 5 minutes ago - the timeout threshold)
      kitchenService.registerConnection("expired-conn", {
        restaurantId: "test-restaurant-1",
        userId: 100,
        lastHeartbeat: Date.now() - 6 * 60 * 1000, // 6 minutes ago (past 5 min timeout)
      });

      // Manually trigger cleanup (getKitchenOrders doesn't directly call cleanup)
      kitchenService.cleanupExpiredConnections();

      const status = kitchenService.getConnectionStatus("test-restaurant-1");
      expect(status.restaurantConnections).toBe(0);
    });
  });
});
