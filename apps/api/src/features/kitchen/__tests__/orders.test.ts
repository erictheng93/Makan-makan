/**
 * Kitchen Orders Tests
 * 測試廚房訂單獲取和狀態更新功能
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { KitchenService } from "../services/KitchenService";
import type { OrderItemStatusUpdate } from "../types";
import type { OrderStatus } from "@makanmasak/shared-types";

// Mock OrdersService with hoisted mock for flexibility
const mockGetOrders = vi.hoisted(() => vi.fn());
const mockGetDailyStats = vi.hoisted(() => vi.fn());
const mockUpdateItemStatus = vi.hoisted(() => vi.fn());

// Default mock data
const mockOrdersData = {
  orders: [
    {
      id: 1,
      orderNumber: "ORD-001",
      tableId: 1,
      status: "confirmed" as OrderStatus,
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
      status: "preparing" as OrderStatus,
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
      updateItemStatus = mockUpdateItemStatus;
    },
  };
});

const mockEnv = {
  NODE_ENV: "test",
  DB: {},
  CACHE_KV: {},
} as never;

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
    mockUpdateItemStatus.mockResolvedValue(undefined);
    kitchenService = new KitchenService(mockEnv);
  });

  describe("getKitchenOrders", () => {
    it("should fetch and transform orders for kitchen display", async () => {
      const result = await kitchenService.getKitchenOrders("test-restaurant-1");

      expect(result).toHaveProperty("pending");
      expect(result).toHaveProperty("preparing");
      expect(result).toHaveProperty("ready");
      expect(result).toHaveProperty("stats");
      expect(mockGetOrders).toHaveBeenCalledOnce();
      expect(mockGetOrders).toHaveBeenCalledWith(
        expect.objectContaining({ restaurantId: "test-restaurant-1" }),
      );
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
      expect(mockUpdateItemStatus).toHaveBeenCalledOnce();
      expect(mockUpdateItemStatus).toHaveBeenCalledWith(
        1,
        "preparing",
        "Started cooking",
      );
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

    it("should handle update without notes", async () => {
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

      expect(result.status).toBe("ready");
      expect(mockUpdateItemStatus).toHaveBeenCalledWith(1, "ready", undefined);
    });
  });
});
