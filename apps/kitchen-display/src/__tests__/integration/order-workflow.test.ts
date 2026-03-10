/**
 * Order Workflow Integration Tests
 * 測試完整的訂單工作流程
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useOrdersStore } from "@/stores/orders";
import type {
  KitchenOrder,
  KitchenOrderItem,
  KitchenSSEEvent,
  ItemStatus,
} from "@/types";

// Helper function to create order items with required fields
function createMockItem(
  overrides: Partial<KitchenOrderItem> = {},
): KitchenOrderItem {
  return {
    id: 1,
    name: "炒飯",
    quantity: 1,
    status: "pending" as ItemStatus,
    estimatedTime: 10,
    priority: "normal",
    ...overrides,
  };
}

// Helper function to create orders with required fields
function createMockOrder(overrides: Partial<KitchenOrder> = {}): KitchenOrder {
  return {
    id: 1,
    orderNumber: "ORD-001",
    tableId: 1,
    tableName: "T1",
    status: 1,
    priority: "normal",
    createdAt: new Date().toISOString(),
    elapsedTime: 0,
    estimatedTime: 15,
    totalItems: 0,
    items: [],
    ...overrides,
  };
}

// Helper function to create SSE events with required fields
function createSSEEvent(
  overrides: Partial<KitchenSSEEvent> & {
    type: KitchenSSEEvent["type"];
    payload: any;
  },
): KitchenSSEEvent {
  return {
    timestamp: new Date().toISOString(),
    restaurantId: 1,
    ...overrides,
  } as KitchenSSEEvent;
}

// Mock kitchen API - inline definition to avoid hoisting issues
vi.mock("@/services/kitchenApi", () => ({
  kitchenApi: {
    getOrders: vi.fn(),
    startCooking: vi.fn().mockResolvedValue({ success: true }),
    markItemReady: vi.fn().mockResolvedValue({ success: true }),
    updateItemStatus: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe("Order Workflow Integration", () => {
  let mockKitchenApi: any;

  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    // Get mocked kitchenApi
    const { kitchenApi } = await import("@/services/kitchenApi");
    mockKitchenApi = kitchenApi;
  });

  describe("Complete Order Lifecycle", () => {
    it("should handle order from pending to completed", async () => {
      const store = useOrdersStore();

      // Initial order in pending state
      const order: KitchenOrder = createMockOrder({
        id: 1,
        orderNumber: "ORD-001",
        tableName: "T1",
        status: 1,
        priority: "normal",
        totalItems: 1,
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 2,
            status: "pending",
            estimatedTime: 15,
            priority: "normal",
          },
        ],
      });

      store.orders = [order];
      expect(store.pendingOrders).toHaveLength(1);

      // Start preparing (local state update, no API call)
      store.updateOrderStatus(1, 2);
      expect(store.orders[0].status).toBe(2);
      expect(store.preparingOrders).toHaveLength(1);

      // Mark as ready
      store.updateOrderStatus(1, 3);
      expect(store.orders[0].status).toBe(3);
      expect(store.readyOrders).toHaveLength(1);

      // Complete order (status 4 would be COMPLETED)
      store.updateOrderStatus(1, 4);
      expect(store.orders[0].status).toBe(4);
    });

    it("should handle item-level status updates", async () => {
      const store = useOrdersStore();

      const order: KitchenOrder = createMockOrder({
        id: 1,
        orderNumber: "ORD-001",
        tableName: "T1",
        status: 2,
        priority: "normal",
        elapsedTime: 5,
        totalItems: 2,
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 1,
            status: "pending",
            estimatedTime: 10,
            priority: "normal",
          },
          {
            id: 2,
            name: "炒麵",
            quantity: 1,
            status: "pending",
            estimatedTime: 12,
            priority: "normal",
          },
        ],
      });

      store.orders = [order];

      // Start first item (local state update, correct signature: orderId, itemId, status)
      store.updateItemStatus(1, 1, "preparing");
      expect(store.orders[0].items[0].status).toBe("preparing");

      // Complete first item
      store.updateItemStatus(1, 1, "ready");
      expect(store.orders[0].items[0].status).toBe("ready");

      // Start second item
      store.updateItemStatus(1, 2, "preparing");
      expect(store.orders[0].items[1].status).toBe("preparing");

      // Complete second item
      store.updateItemStatus(1, 2, "ready");
      expect(store.orders[0].items[1].status).toBe("ready");
    });

    it("should handle urgent order prioritization", async () => {
      const store = useOrdersStore();

      const normalOrder: KitchenOrder = createMockOrder({
        id: 1,
        tableId: 1,
        orderNumber: "ORD-001",
        tableName: "T1",
        status: 1,
        priority: "normal",
        totalItems: 0,
      });

      const urgentOrder: KitchenOrder = createMockOrder({
        id: 2,
        tableId: 2,
        orderNumber: "ORD-002",
        tableName: "T2",
        status: 1,
        priority: "urgent",
        estimatedTime: 10,
        totalItems: 0,
      });

      store.orders = [normalOrder, urgentOrder];

      // Urgent orders should be identifiable
      expect(store.urgentOrders).toHaveLength(1);
      expect(store.urgentOrders[0].id).toBe(2);

      // Normal orders should still be accessible
      expect(store.pendingOrders).toHaveLength(2);
    });
  });

  describe("Multi-Order Processing", () => {
    it("should handle multiple concurrent orders", async () => {
      const store = useOrdersStore();

      const orders: KitchenOrder[] = Array.from({ length: 10 }, (_, i) =>
        createMockOrder({
          id: i,
          tableId: i + 1,
          orderNumber: `ORD-${String(i).padStart(3, "0")}`,
          tableName: `T${i + 1}`,
          status: 1,
          priority: i < 3 ? "urgent" : "normal",
          totalItems: 0,
        }),
      );

      store.orders = orders;

      expect(store.totalOrders).toBe(10);
      expect(store.urgentOrders).toHaveLength(3);
      expect(store.pendingOrders).toHaveLength(10);

      // Process first 5 orders to preparing
      for (let i = 0; i < 5; i++) {
        store.updateOrderStatus(i, 2); // Use number ID, local method
      }

      expect(store.preparingOrders).toHaveLength(5);
      expect(store.pendingOrders).toHaveLength(5);
    });

    it("should maintain order consistency during batch updates", async () => {
      const store = useOrdersStore();

      store.orders = Array.from({ length: 20 }, (_, i) =>
        createMockOrder({
          id: i,
          tableId: i + 1,
          orderNumber: `ORD-${i}`,
          tableName: `T${i}`,
          status: 1,
          totalItems: 0,
          priority: "normal",
        }),
      );

      const initialCount = store.totalOrders;

      // Update multiple orders simultaneously (local method, synchronous)
      const orderIds = [0, 1, 2, 3, 4];
      orderIds.forEach((i) => {
        store.updateOrderStatus(i, 2);
      });

      // Total count should remain the same
      expect(store.totalOrders).toBe(initialCount);
    });
  });

  describe("Error Recovery", () => {
    it("should handle failed API calls gracefully", async () => {
      // Test actual API calls that can fail, not local methods
      mockKitchenApi.startCooking.mockRejectedValueOnce(
        new Error("API Update failed"),
      );

      const store = useOrdersStore();
      store.orders = [
        createMockOrder({
          id: 1,
          tableId: 1,
          orderNumber: "ORD-001",
          tableName: "T1",
          status: 1,
          priority: "normal",
          totalItems: 1,
          items: [
            createMockItem({
              id: 1,
              name: "炒飯",
              quantity: 1,
              status: "pending",
              estimatedTime: 10,
            }),
          ],
        }),
      ];

      // Test API call failure (startCooking is an actual API call)
      await expect(store.startCooking(1, 1, 1)).rejects.toThrow();

      // Order state should not change on API error (item status should still be pending)
      expect(store.orders[0].items[0].status).toBe("pending");
    });

    it("should handle network errors during fetch", async () => {
      mockKitchenApi.getOrders.mockRejectedValue(new Error("Network error"));

      const store = useOrdersStore();
      await store.fetchOrders(1);

      expect(store.error).toBe("Network error");
      expect(store.orders).toEqual([]);
    });
  });

  describe("Real-time Updates", () => {
    it("should add new order from SSE event", () => {
      const store = useOrdersStore();

      const newOrder: KitchenOrder = createMockOrder({
        id: 100,
        tableId: 5,
        orderNumber: "ORD-NEW",
        tableName: "T5",
        status: 1,
        priority: "urgent",
        totalItems: 0,
      });

      store.handleSSEEvent(
        createSSEEvent({
          type: "NEW_ORDER",
          payload: newOrder,
        }),
      );

      expect(store.orders).toContainEqual(newOrder);
      expect(store.urgentOrders).toHaveLength(1);
    });

    it("should update order status from SSE event", () => {
      const store = useOrdersStore();

      store.orders = [
        createMockOrder({
          id: 1,
          tableId: 1,
          orderNumber: "ORD-001",
          tableName: "T1",
          status: 1,
          priority: "normal",
          totalItems: 1,
          items: [
            createMockItem({
              id: 1,
              name: "炒飯",
              quantity: 1,
              status: "pending",
              estimatedTime: 10,
            }),
          ],
        }),
      ];

      // ORDER_STATUS_UPDATE event expects itemId in payload
      store.handleSSEEvent(
        createSSEEvent({
          type: "ORDER_STATUS_UPDATE",
          orderId: 1,
          payload: {
            itemId: 1,
            status: "preparing",
            updatedAt: new Date().toISOString(),
          },
        }),
      );

      const order = store.orders.find((o) => o.id === 1);
      // The handler updates item status and then recalculates order status
      expect(order?.items[0].status).toBe("preparing");
      expect(order?.status).toBe(2); // Should be PREPARING after item update
    });

    it("should remove cancelled order from SSE event", () => {
      const store = useOrdersStore();

      store.orders = [
        createMockOrder({
          id: 1,
          tableId: 1,
          orderNumber: "ORD-001",
          tableName: "T1",
          status: 1,
          priority: "normal",
          totalItems: 0,
        }),
      ];

      // ORDER_CANCELLED event expects orderId at top level, not in payload
      store.handleSSEEvent(
        createSSEEvent({
          type: "ORDER_CANCELLED",
          orderId: 1,
          payload: { reason: "Customer requested" },
        }),
      );

      expect(store.orders).toHaveLength(0);
    });
  });

  describe("Performance Metrics", () => {
    it("should track average cooking time", async () => {
      const store = useOrdersStore();

      mockKitchenApi.getOrders.mockResolvedValue({
        success: true,
        data: {
          pending: [],
          preparing: [],
          ready: [],
          stats: {
            pendingCount: 0,
            preparingCount: 0,
            readyCount: 0,
            completedToday: 50,
            averageCookingTime: 18,
            averageWaitingTime: 5,
            efficiency: 92,
            urgentOrders: 0,
          },
        },
      });

      await store.fetchOrders(1);

      expect(store.stats.averageCookingTime).toBe(18);
      expect(store.stats.efficiency).toBe(92);
    });

    it("should track orders completed today", async () => {
      const store = useOrdersStore();

      mockKitchenApi.getOrders.mockResolvedValue({
        success: true,
        data: {
          pending: [],
          preparing: [],
          ready: [],
          stats: {
            pendingCount: 0,
            preparingCount: 0,
            readyCount: 0,
            completedToday: 75,
            averageCookingTime: 15,
            averageWaitingTime: 6,
            efficiency: 95,
            urgentOrders: 0,
          },
        },
      });

      await store.fetchOrders(1);

      expect(store.stats.completedToday).toBe(75);
    });
  });
});
