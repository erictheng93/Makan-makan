/**
 * Service test: wires a real `OrdersService` instance to a mocked
 * broadcast service + mocked env, and verifies that order lifecycle
 * transitions emit the expected realtime events.
 *
 * This is a service-level test, NOT an API integration test. The DB
 * and realtime boundaries are intentionally mocked so the service's
 * event-emission logic can be asserted directly. For real integration
 * testing, see `apps/api/src/__tests__/integration/*.real.integration.test.ts`.
 *
 * Strategy note: internal service instances are replaced directly
 * rather than via `vi.mock()` to avoid hoisting surprises.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Env } from "../../../shared/types";
import { envFactory, resetAllFactories } from "@makanmasak/testing-utils";

// Mock @makanmasak/shared-types to ensure enums are available
vi.mock("@makanmasak/shared-types", async () => {
  const actual = await vi.importActual("@makanmasak/shared-types");
  return {
    ...actual,
    OrderStatus: {
      PENDING: 0,
      CONFIRMED: 1,
      PREPARING: 2,
      READY: 3,
      DELIVERED: 4,
      PAID: 5,
      CANCELLED: 6,
    },
    RealtimeEventType: {
      NEW_ORDER: "new_order",
      ORDER_STATUS_UPDATE: "order_status_update",
      ORDER_ITEM_STATUS_UPDATE: "order_item_status_update",
      KITCHEN_ITEM_STATUS: "kitchen_item_status",
      MENU_AVAILABILITY_UPDATE: "menu_availability_update",
    },
  };
});

// Import after mocking
import { OrdersService } from "../services/OrdersService";
import type { OrderStatus } from "@makanmasak/shared-types";

// RealtimeEventType for assertions
const RealtimeEventType = {
  NEW_ORDER: "new_order",
  ORDER_STATUS_UPDATE: "order_status_update",
} as const;

describe("Orders + Realtime Integration", () => {
  let ordersService: OrdersService;
  let mockEnv: Env;
  let mockBroadcastService: any;
  let mockOrderService: any;

  beforeEach(() => {
    resetAllFactories();
    // Create mock services
    mockBroadcastService = {
      broadcastNewOrder: vi.fn().mockResolvedValue({
        success: true,
        eventId: "evt_test_123",
        recipientCount: 1,
      }),
      broadcastOrderStatusUpdate: vi.fn().mockResolvedValue({
        success: true,
        eventId: "evt_update_123",
        recipientCount: 1,
      }),
      generateEventId: vi.fn(() => "evt_test_123"),
    };

    mockOrderService = {
      createOrder: vi.fn(),
      getOrder: vi.fn(),
      updateOrderStatus: vi.fn(),
      updateOrderItemStatus: vi.fn(),
    };

    // Mock environment
    mockEnv = envFactory.build({
      CACHE_KV: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(true),
      } as never,
    }) as unknown as Env;

    // Create service instance
    ordersService = new OrdersService(mockEnv);

    // CRITICAL: Replace internal services with our mocks
    // This is the key to making these tests work reliably
    ordersService["realtimeBroadcastService"] = mockBroadcastService;
    ordersService["baseOrderService"] = mockOrderService;
    ordersService["logger"] = {
      feature: "test-orders",
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as never;
  });

  describe("createOrder - Realtime Integration", () => {
    it("應該在創建訂單後廣播 NEW_ORDER 事件", async () => {
      const orderData = {
        restaurantId: "1",
        tableId: 10,
        customerName: "John Doe",
        customerPhone: "+1234567890",
        items: [
          {
            menuItemId: 100,
            quantity: 2,
            notes: "No onions",
          },
        ],
        notes: "Quick service",
      };

      const createdOrder = {
        id: 1,
        restaurantId: "1",
        tableId: 10,
        orderNumber: "#001",
        customerName: "John Doe",
        customerPhone: "+1234567890",
        totalAmount: 2000,
        subtotal: 2000,
        status: "pending" as OrderStatus,
        paymentStatus: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          {
            id: 1,
            orderId: 1,
            menuItemId: 100,
            quantity: 2,
            unitPrice: 1000,
            totalPrice: 2000,
            notes: "No onions",
            status: 0,
            menuItem: {
              id: 100,
              name: "Burger",
              price: 1000,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      mockOrderService.createOrder.mockResolvedValue(createdOrder);

      const result = await ordersService.createOrder(orderData);

      // Verify order creation
      expect(result).toEqual(createdOrder);

      // Verify broadcast was called
      expect(mockBroadcastService.broadcastNewOrder).toHaveBeenCalledTimes(1);

      const broadcastCall =
        mockBroadcastService.broadcastNewOrder.mock.calls[0][0];
      expect(broadcastCall.type).toBe(RealtimeEventType.NEW_ORDER);
      expect(broadcastCall.restaurantId).toBe("1");
      expect(broadcastCall.data.orderId).toBe(1);
      expect(broadcastCall.data.orderNumber).toBe("#001");
      expect(broadcastCall.data.items).toHaveLength(1);
      expect(broadcastCall.data.items[0].menuItemName).toBe("Burger");
      expect(broadcastCall.data.items[0].price).toBe(1000);
      expect(broadcastCall.data.totalAmount).toBe(2000);
    });

    it("應該即使廣播失敗也能成功創建訂單", async () => {
      const orderData = {
        restaurantId: "2",
        tableId: 20,
        items: [
          {
            menuItemId: 200,
            quantity: 1,
          },
        ],
      };

      const createdOrder = {
        id: 2,
        restaurantId: "2",
        tableId: 20,
        orderNumber: "#002",
        totalAmount: 500,
        subtotal: 500,
        status: "pending" as OrderStatus,
        paymentStatus: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          {
            id: 2,
            orderId: 2,
            menuItemId: 200,
            quantity: 1,
            unitPrice: 500,
            totalPrice: 500,
            status: 0,
            menuItem: {
              id: 200,
              name: "Salad",
              price: 500,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      mockOrderService.createOrder.mockResolvedValue(createdOrder);
      // Make broadcast fail for this test
      mockBroadcastService.broadcastNewOrder.mockResolvedValueOnce({
        success: false,
        error: "Broadcast failed",
      });

      // Should not throw even if broadcast fails
      const result = await ordersService.createOrder(orderData);

      expect(result).toEqual(createdOrder);
      expect(mockBroadcastService.broadcastNewOrder).toHaveBeenCalled();
    });
  });

  describe("updateOrderStatus - Realtime Integration", () => {
    it("應該在更新訂單狀態後廣播 ORDER_STATUS_UPDATE 事件", async () => {
      const orderId = 3;
      const currentStatus = "confirmed";
      const newStatus = "preparing";
      const notes = "Starting to prepare";

      const currentOrder = {
        id: orderId,
        restaurantId: "3",
        tableId: 30,
        orderNumber: "#003",
        status: currentStatus as never,
        totalAmount: 1500,
        subtotal: 1500,
        paymentStatus: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [],
      };

      const updatedOrder = {
        ...currentOrder,
        status: newStatus as never,
        updatedAt: new Date().toISOString(),
      };

      mockOrderService.getOrder.mockResolvedValue(currentOrder);
      mockOrderService.updateOrderStatus.mockResolvedValue(updatedOrder);

      const result = await ordersService.updateOrderStatus(orderId, {
        status: newStatus as never,
        notes,
      });

      // Verify update
      expect(result).toEqual(updatedOrder);

      // Verify broadcast
      expect(
        mockBroadcastService.broadcastOrderStatusUpdate,
      ).toHaveBeenCalledTimes(1);

      const broadcastCall =
        mockBroadcastService.broadcastOrderStatusUpdate.mock.calls[0][0];
      expect(broadcastCall.type).toBe(RealtimeEventType.ORDER_STATUS_UPDATE);
      expect(broadcastCall.restaurantId).toBe("3");
      expect(broadcastCall.data.orderId).toBe(orderId);
      expect(broadcastCall.data.orderNumber).toBe("#003");
      expect(broadcastCall.data.status).toBe("preparing");
    });
  });

  describe("broadcastOrderUpdate", () => {
    it("應該正確處理訂單更新事件", async () => {
      const order = {
        id: 4,
        restaurantId: "4",
        tableId: 40,
        orderNumber: "#004",
        status: "confirmed" as never,
        totalAmount: 3000,
        subtotal: 3000,
        paymentStatus: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockOrderService.getOrder.mockResolvedValue(order);

      await ordersService.broadcastOrderUpdate({
        orderId: 4,
        newStatus: "confirmed" as never,
        previousStatus: "pending" as OrderStatus,
        notes: "Order confirmed",
        updatedBy: 1,
        updatedAt: new Date(),
      });

      expect(
        mockBroadcastService.broadcastOrderStatusUpdate,
      ).toHaveBeenCalled();
    });

    it("應該在訂單不存在時不廣播", async () => {
      mockOrderService.getOrder.mockResolvedValue(null);

      await ordersService.broadcastOrderUpdate({
        orderId: 999,
        newStatus: "confirmed" as never,
        previousStatus: "pending" as OrderStatus,
        updatedBy: 1,
        updatedAt: new Date(),
      });

      expect(
        mockBroadcastService.broadcastOrderStatusUpdate,
      ).not.toHaveBeenCalled();
    });
  });

  describe("Event Data Mapping", () => {
    it("應該正確映射訂單項目到事件資料", async () => {
      const orderData = {
        restaurantId: "5",
        tableId: 50,
        items: [
          {
            menuItemId: 300,
            quantity: 3,
            customizations: {
              specialInstructions: "Extra spicy",
            },
            notes: "Chef special",
          },
        ],
      };

      const createdOrder = {
        id: 5,
        restaurantId: "5",
        tableId: 50,
        orderNumber: "#005",
        totalAmount: 4500,
        subtotal: 4500,
        status: "pending" as OrderStatus,
        paymentStatus: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          {
            id: 5,
            orderId: 5,
            menuItemId: 300,
            quantity: 3,
            unitPrice: 1500,
            totalPrice: 4500,
            notes: "Chef special",
            status: 0,
            customizations: {
              specialInstructions: "Extra spicy",
            },
            menuItem: {
              id: 300,
              name: "Spicy Noodles",
              price: 1500,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      mockOrderService.createOrder.mockResolvedValue(createdOrder);

      await ordersService.createOrder(orderData);

      const broadcastCall =
        mockBroadcastService.broadcastNewOrder.mock.calls[0][0];

      expect(broadcastCall.data.items[0]).toMatchObject({
        orderItemId: 5,
        menuItemId: 300,
        menuItemName: "Spicy Noodles",
        quantity: 3,
        price: 1500,
        notes: "Chef special",
      });
    });
  });
});
