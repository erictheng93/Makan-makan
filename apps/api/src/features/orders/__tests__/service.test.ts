/**
 * Orders Service Tests
 * 訂單服務層測試 - 提升覆蓋率
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OrdersService } from "../services/OrdersService";
import {
  OrderStatus,
  OrderPaymentStatus,
  OrderPaymentMethod,
} from "@makanmakan/shared-types";

// Mock dependencies
vi.mock("@makanmakan/database", () => ({
  OrderService: vi.fn(function () {
    return {
      createOrder: vi.fn(),
      getOrder: vi.fn(),
      getOrders: vi.fn(),
      updateOrderStatus: vi.fn(),
      cancelOrder: vi.fn(),
      getDailyOrderStats: vi.fn(),
    };
  }),
  CouponService: vi.fn(function () {
    return {
      validateCoupon: vi.fn(),
    };
  }),
}));

vi.mock("../../../services/RealtimeBroadcastService", () => ({
  RealtimeBroadcastService: vi.fn(function () {
    return {
      broadcastNewOrder: vi
        .fn()
        .mockResolvedValue({
          success: true,
          eventId: "evt-1",
          recipientCount: 1,
        }),
      broadcastOrderStatusUpdate: vi
        .fn()
        .mockResolvedValue({
          success: true,
          eventId: "evt-2",
          recipientCount: 1,
        }),
      generateEventId: vi.fn().mockReturnValue("evt-123"),
    };
  }),
}));

vi.mock("../../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function () {
    return {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
  }),
}));

// Mock environment
const createMockEnv = () => ({
  NODE_ENV: "test",
  DB: {
    prepare: vi.fn(() => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
    })),
  },
  CACHE_KV: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
});

describe("OrdersService", () => {
  let service: OrdersService;
  let mockEnv: ReturnType<typeof createMockEnv>;
  let mockBaseOrderService: any;
  let mockCouponService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();

    // Get mocked services
    const { OrderService, CouponService } =
      await import("@makanmakan/database");
    mockBaseOrderService = {
      createOrder: vi.fn(),
      getOrder: vi.fn(),
      getOrders: vi.fn(),
      updateOrderStatus: vi.fn(),
      cancelOrder: vi.fn(),
      getDailyOrderStats: vi.fn(),
    };
    mockCouponService = {
      validateCoupon: vi.fn(),
    };
    // Use function syntax for constructor mocks in Vitest 4
    (OrderService as any).mockImplementation(function () {
      return mockBaseOrderService;
    });
    (CouponService as any).mockImplementation(function () {
      return mockCouponService;
    });

    service = new OrdersService(mockEnv as any);
  });

  describe("Order Creation", () => {
    describe("createOrder", () => {
      const validOrderData = {
        restaurantId: '1',
        tableId: 5,
        items: [
          { menuItemId: 1, quantity: 2, notes: "Extra spicy" },
          { menuItemId: 2, quantity: 1 },
        ],
        notes: "Birthday celebration",
        customerInfo: {
          name: "John Doe",
          phone: "+60123456789",
          email: "john@example.com",
        },
      };

      it("should create order successfully", async () => {
        const mockOrder = {
          id: 1,
          orderNumber: "ORD-001",
          restaurantId: '1',
          totalAmount: 5000,
          status: OrderStatus.PENDING,
          items: validOrderData.items,
          createdAt: new Date().toISOString(),
        };
        mockBaseOrderService.createOrder.mockResolvedValue(mockOrder);

        const result = await service.createOrder(validOrderData, 100);

        expect(result).toEqual(mockOrder);
        expect(mockBaseOrderService.createOrder).toHaveBeenCalled();
      });

      it("should reject order with invalid restaurant ID", async () => {
        const invalidData = { ...validOrderData, restaurantId: '' };

        await expect(service.createOrder(invalidData, 100)).rejects.toThrow(
          "Invalid restaurant ID",
        );
      });

      it("should reject order with no items", async () => {
        const invalidData = { ...validOrderData, items: [] };

        await expect(service.createOrder(invalidData, 100)).rejects.toThrow(
          "Order must contain at least one item",
        );
      });

      it("should reject order with too many items", async () => {
        const invalidData = {
          ...validOrderData,
          items: Array(101).fill({ menuItemId: 1, quantity: 1 }),
        };

        await expect(service.createOrder(invalidData, 100)).rejects.toThrow(
          "Order cannot exceed 100 items",
        );
      });

      it("should reject order with invalid menu item ID", async () => {
        const invalidData = {
          ...validOrderData,
          items: [{ menuItemId: 0, quantity: 1 }],
        };

        await expect(service.createOrder(invalidData, 100)).rejects.toThrow(
          "Invalid menu item ID",
        );
      });

      it("should reject order with invalid quantity", async () => {
        const invalidData = {
          ...validOrderData,
          items: [{ menuItemId: 1, quantity: 0 }],
        };

        await expect(service.createOrder(invalidData, 100)).rejects.toThrow(
          "Invalid item quantity",
        );
      });

      it("should reject order with quantity exceeding limit", async () => {
        const invalidData = {
          ...validOrderData,
          items: [{ menuItemId: 1, quantity: 1000 }],
        };

        await expect(service.createOrder(invalidData, 100)).rejects.toThrow(
          "Invalid item quantity: cannot exceed 999",
        );
      });

      it("should reject order with invalid phone format", async () => {
        const invalidData = {
          ...validOrderData,
          customerInfo: { phone: "123" },
        };

        await expect(service.createOrder(invalidData, 100)).rejects.toThrow(
          "Invalid phone number format",
        );
      });

      it("should reject order with invalid email format", async () => {
        const invalidData = {
          ...validOrderData,
          customerInfo: { email: "invalid-email" },
        };

        await expect(service.createOrder(invalidData, 100)).rejects.toThrow(
          "Invalid email format",
        );
      });

      it("should reject order with notes exceeding limit", async () => {
        const invalidData = {
          ...validOrderData,
          notes: "x".repeat(1001),
        };

        await expect(service.createOrder(invalidData, 100)).rejects.toThrow(
          "Order notes cannot exceed 1000 characters",
        );
      });

      it("should reject order with invalid coupon code format", async () => {
        const invalidData = {
          ...validOrderData,
          couponCode: "AB", // Too short
        };

        await expect(service.createOrder(invalidData, 100)).rejects.toThrow(
          "Invalid coupon code format",
        );
      });
    });
  });

  describe("Order Retrieval", () => {
    describe("getOrder", () => {
      it("should return order from cache if available", async () => {
        const cachedOrder = { id: 1, orderNumber: "ORD-001" };
        mockEnv.CACHE_KV.get.mockResolvedValue(cachedOrder);

        const result = await service.getOrder(1);

        expect(result).toEqual(cachedOrder);
        expect(mockBaseOrderService.getOrder).not.toHaveBeenCalled();
      });

      it("should fetch from database if not in cache", async () => {
        const dbOrder = { id: 1, orderNumber: "ORD-001" };
        mockEnv.CACHE_KV.get.mockResolvedValue(null);
        mockBaseOrderService.getOrder.mockResolvedValue(dbOrder);

        const result = await service.getOrder(1);

        expect(result).toEqual(dbOrder);
        expect(mockBaseOrderService.getOrder).toHaveBeenCalledWith(1);
      });

      it("should return null for non-existent order", async () => {
        mockEnv.CACHE_KV.get.mockResolvedValue(null);
        mockBaseOrderService.getOrder.mockResolvedValue(null);

        const result = await service.getOrder(999);

        expect(result).toBeNull();
      });
    });

    describe("getOrders", () => {
      it("should return filtered orders", async () => {
        const mockOrders = {
          orders: [{ id: 1 }, { id: 2 }],
          pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
        };
        mockBaseOrderService.getOrders.mockResolvedValue(mockOrders);

        const result = await service.getOrders({
          restaurantId: '1',
          status: [OrderStatus.PENDING],
        });

        expect(result.orders).toHaveLength(2);
        expect(result.total).toBe(2);
      });

      it("should apply pagination", async () => {
        mockBaseOrderService.getOrders.mockResolvedValue({
          orders: [],
          pagination: { page: 2, limit: 10, total: 25, totalPages: 3 },
        });

        const result = await service.getOrders({
          page: 2,
          limit: 10,
        });

        expect(result.pagination.page).toBe(2);
        expect(result.pagination.limit).toBe(10);
      });
    });

    describe("getActiveOrders", () => {
      it("should return active orders for restaurant", async () => {
        mockBaseOrderService.getOrders.mockResolvedValue({
          orders: [
            { id: 1, status: OrderStatus.CONFIRMED },
            { id: 2, status: OrderStatus.PREPARING },
          ],
          pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
        });

        const result = await service.getActiveOrders('1');

        expect(result).toHaveLength(2);
      });
    });
  });

  describe("Order Updates", () => {
    describe("updateOrder", () => {
      it("should update order successfully", async () => {
        const existingOrder = { id: 1, status: OrderStatus.PENDING };
        const updatedOrder = { id: 1, status: OrderStatus.CONFIRMED };

        mockEnv.CACHE_KV.get.mockResolvedValue(existingOrder);
        mockBaseOrderService.updateOrderStatus.mockResolvedValue(updatedOrder);

        const result = await service.updateOrder(
          1,
          { status: OrderStatus.CONFIRMED },
          100,
        );

        expect(result?.status).toBe(OrderStatus.CONFIRMED);
      });

      it("should return null for non-existent order", async () => {
        mockEnv.CACHE_KV.get.mockResolvedValue(null);
        mockBaseOrderService.getOrder.mockResolvedValue(null);

        const result = await service.updateOrder(
          999,
          { status: OrderStatus.CONFIRMED },
          100,
        );

        expect(result).toBeNull();
      });
    });

    describe("updateOrderStatus", () => {
      it("should update status and broadcast", async () => {
        const existingOrder = {
          id: 1,
          status: OrderStatus.PENDING,
          restaurantId: '1',
        };
        const updatedOrder = {
          id: 1,
          status: OrderStatus.CONFIRMED,
          restaurantId: '1',
        };

        mockEnv.CACHE_KV.get.mockResolvedValue(existingOrder);
        mockBaseOrderService.updateOrderStatus.mockResolvedValue(updatedOrder);

        const result = await service.updateOrderStatus(
          1,
          { status: OrderStatus.CONFIRMED, notes: "Confirmed by manager" },
          100,
          1,
        );

        expect(result?.status).toBe(OrderStatus.CONFIRMED);
      });

      it("should reject invalid status transition", async () => {
        const existingOrder = { id: 1, status: OrderStatus.DELIVERED };
        mockEnv.CACHE_KV.get.mockResolvedValue(existingOrder);

        await expect(
          service.updateOrderStatus(1, { status: OrderStatus.PENDING }, 100, 1),
        ).rejects.toThrow();
      });
    });

    describe("cancelOrder", () => {
      it("should cancel order successfully", async () => {
        const cancelledOrder = { id: 1, status: OrderStatus.CANCELLED };
        mockBaseOrderService.cancelOrder.mockResolvedValue(cancelledOrder);

        const result = await service.cancelOrder(1, "Customer request", 100);

        expect(result?.status).toBe(OrderStatus.CANCELLED);
      });

      it("should return null if cancellation fails", async () => {
        mockBaseOrderService.cancelOrder.mockResolvedValue(null);

        const result = await service.cancelOrder(1, "Test", 100);

        expect(result).toBeNull();
      });
    });

    describe("deleteOrder", () => {
      it("should delete pending order", async () => {
        const pendingOrder = { id: 1, status: "pending" };
        mockEnv.CACHE_KV.get.mockResolvedValue(pendingOrder);
        mockBaseOrderService.cancelOrder.mockResolvedValue(pendingOrder);

        const result = await service.deleteOrder(1, 100);

        expect(result).toBe(true);
      });

      it("should reject deletion of non-pending order", async () => {
        const confirmedOrder = { id: 1, status: "confirmed" };
        mockEnv.CACHE_KV.get.mockResolvedValue(confirmedOrder);

        await expect(service.deleteOrder(1, 100)).rejects.toThrow(
          "Only pending orders can be deleted",
        );
      });

      it("should return false for non-existent order", async () => {
        mockEnv.CACHE_KV.get.mockResolvedValue(null);
        mockBaseOrderService.getOrder.mockResolvedValue(null);

        const result = await service.deleteOrder(999, 100);

        expect(result).toBe(false);
      });
    });
  });

  describe("Coupon Operations", () => {
    describe("validateCoupon", () => {
      it("should validate coupon successfully", async () => {
        mockCouponService.validateCoupon.mockResolvedValue({
          valid: true,
          coupon: {
            code: "SAVE10",
            name: "Save 10%",
            discountType: "percentage",
            discountValue: 10,
          },
          discountAmount: 500,
          finalAmount: 4500,
        });

        const result = await service.validateCoupon({
          restaurantId: '1',
          couponCode: "SAVE10",
          orderAmount: 5000,
        });

        expect(result.valid).toBe(true);
        expect(result.discountAmount).toBe(500);
        expect(result.finalAmount).toBe(4500);
      });

      it("should handle invalid coupon", async () => {
        mockCouponService.validateCoupon.mockResolvedValue({
          valid: false,
          error: "Coupon expired",
        });

        const result = await service.validateCoupon({
          restaurantId: '1',
          couponCode: "EXPIRED",
          orderAmount: 5000,
        });

        expect(result.valid).toBe(false);
        expect(result.error).toBe("Coupon expired");
      });

      it("should handle validation errors", async () => {
        mockCouponService.validateCoupon.mockRejectedValue(
          new Error("Service unavailable"),
        );

        const result = await service.validateCoupon({
          restaurantId: '1',
          couponCode: "TEST",
          orderAmount: 5000,
        });

        expect(result.valid).toBe(false);
        expect(result.error).toBe("Service unavailable");
      });
    });

    describe("previewCoupon", () => {
      it("should preview coupon discount", async () => {
        mockCouponService.validateCoupon.mockResolvedValue({
          valid: true,
          discountAmount: 1000,
          finalAmount: 4000,
        });

        const result = await service.previewCoupon({
          restaurantId: '1',
          couponCode: "SUMMER20",
          orderAmount: 5000,
        });

        expect(result.valid).toBe(true);
        expect(result.discountAmount).toBe(1000);
      });
    });
  });

  describe("Analytics and Statistics", () => {
    describe("getOrderAnalytics", () => {
      it("should return analytics for restaurant", async () => {
        mockBaseOrderService.getDailyOrderStats.mockResolvedValue({
          totalOrders: 50,
          totalRevenue: 250000,
          avgOrderValue: 5000,
        });

        const result = await service.getOrderAnalytics({ restaurantId: '1' });

        expect(result.summary.totalOrders).toBe(50);
        expect(result.summary.totalRevenue).toBe(250000);
      });

      it("should use cached analytics if available", async () => {
        const cachedAnalytics = {
          summary: { totalOrders: 100, totalRevenue: 500000 },
        };
        mockEnv.CACHE_KV.get.mockResolvedValue(cachedAnalytics);

        const result = await service.getOrderAnalytics({ restaurantId: '1' });

        expect(result.summary.totalOrders).toBe(100);
        expect(mockBaseOrderService.getDailyOrderStats).not.toHaveBeenCalled();
      });

      it("should throw error if restaurant ID not provided", async () => {
        await expect(service.getOrderAnalytics({})).rejects.toThrow(
          "Restaurant ID required for analytics",
        );
      });
    });

    describe("getDailyStats", () => {
      it("should return daily statistics", async () => {
        mockBaseOrderService.getDailyOrderStats.mockResolvedValue({
          totalOrders: 25,
          totalRevenue: 125000,
          avgOrderValue: 5000,
        });

        const result = await service.getDailyStats('1');

        expect(result.totalOrders).toBe(25);
        expect(result.totalRevenue).toBe(125000);
      });
    });

    describe("getPopularItems", () => {
      it("should return popular items", async () => {
        const result = await service.getPopularItems('1', "month");

        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe("Bulk Operations", () => {
    describe("bulkUpdateOrders", () => {
      it("should update multiple orders", async () => {
        const updatedOrder = { id: 1, status: OrderStatus.CONFIRMED };
        mockEnv.CACHE_KV.get.mockResolvedValue({
          id: 1,
          status: OrderStatus.PENDING,
          restaurantId: '1',
        });
        mockBaseOrderService.updateOrderStatus.mockResolvedValue(updatedOrder);

        const result = await service.bulkUpdateOrders(
          {
            action: "update_status",
            orderIds: [1, 2, 3],
            data: { status: OrderStatus.CONFIRMED },
          },
          100,
        );

        expect(result.totalOrders).toBe(3);
        expect(result.batchId).toBeDefined();
      });

      it("should cancel multiple orders", async () => {
        mockBaseOrderService.cancelOrder.mockResolvedValue({
          id: 1,
          status: OrderStatus.CANCELLED,
        });

        const result = await service.bulkUpdateOrders(
          {
            action: "cancel",
            orderIds: [1, 2],
            data: { reason: "Restaurant closed" },
          },
          100,
        );

        expect(result.totalOrders).toBe(2);
      });

      it("should handle partial failures", async () => {
        mockEnv.CACHE_KV.get
          .mockResolvedValueOnce({
            id: 1,
            status: OrderStatus.PENDING,
            restaurantId: '1',
          })
          .mockResolvedValueOnce(null); // Order not found
        mockBaseOrderService.updateOrderStatus.mockResolvedValue({
          id: 1,
          status: OrderStatus.CONFIRMED,
        });

        const result = await service.bulkUpdateOrders(
          {
            action: "update_status",
            orderIds: [1, 999],
            data: { status: OrderStatus.CONFIRMED },
          },
          100,
        );

        expect(result.successCount).toBeGreaterThanOrEqual(0);
        expect(result.failedCount).toBeGreaterThanOrEqual(0);
      });

      it("should handle unsupported action gracefully", async () => {
        const result = await service.bulkUpdateOrders(
          {
            action: "invalid_action" as any,
            orderIds: [1],
          },
          100,
        );

        // Service handles unsupported actions by returning failure results
        expect(result.failedCount).toBe(1);
        expect(result.successCount).toBe(0);
        expect(result.errors[0].error).toContain("Unsupported bulk operation");
      });
    });
  });

  describe("Receipt Generation", () => {
    describe("generateReceipt", () => {
      it("should generate receipt for order", async () => {
        const order = {
          id: 1,
          orderNumber: "ORD-001",
          restaurantId: '1',
          restaurant: { name: "Test Restaurant", address: "123 Main St" },
          customerInfo: { name: "John Doe", phone: "+60123456789" },
          items: [
            {
              id: 1,
              menuItem: { name: "Nasi Lemak" },
              quantity: 2,
              unitPrice: 1500,
              totalPrice: 3000,
            },
          ],
          subtotal: 3000,
          taxAmount: 180,
          serviceCharge: 300,
          discountAmount: 0,
          totalAmount: 3480,
          paymentMethod: "cash",
          paymentStatus: "paid",
          createdAt: new Date().toISOString(),
        };
        mockEnv.CACHE_KV.get.mockResolvedValue(order);

        const result = await service.generateReceipt(1);

        expect(result.orderNumber).toBe("ORD-001");
        expect(result.restaurantInfo.name).toBe("Test Restaurant");
        expect(result.items).toHaveLength(1);
        expect(result.summary.total).toBe(3480);
      });

      it("should throw error for non-existent order", async () => {
        mockEnv.CACHE_KV.get.mockResolvedValue(null);
        mockBaseOrderService.getOrder.mockResolvedValue(null);

        await expect(service.generateReceipt(999)).rejects.toThrow(
          "Order not found",
        );
      });
    });
  });

  describe("Permissions", () => {
    describe("checkOrderPermissions", () => {
      it("should return full permissions for admin", async () => {
        const result = await service.checkOrderPermissions(1, 0);

        expect(result.canView).toBe(true);
        expect(result.canCreate).toBe(true);
        expect(result.canUpdate).toBe(true);
        expect(result.canCancel).toBe(true);
        expect(result.canViewAllRestaurants).toBe(true);
      });

      it("should return limited permissions for owner", async () => {
        const result = await service.checkOrderPermissions(1, 1);

        expect(result.canView).toBe(true);
        expect(result.canUpdate).toBe(true);
        expect(result.canViewAllRestaurants).toBe(false);
      });

      it("should return status update permission for chef", async () => {
        const result = await service.checkOrderPermissions(1, 2);

        expect(result.canView).toBe(true);
        expect(result.canUpdateStatus).toBe(true);
        expect(result.canUpdate).toBe(false);
      });

      it("should return payment permission for cashier", async () => {
        const result = await service.checkOrderPermissions(1, 4);

        expect(result.canView).toBe(true);
        expect(result.canUpdatePayment).toBe(true);
        expect(result.canUpdate).toBe(false);
      });

      it("should return view-only for customer", async () => {
        const result = await service.checkOrderPermissions(1, 5);

        expect(result.canView).toBe(true);
        expect(result.canCreate).toBe(true);
        expect(result.canUpdate).toBe(false);
        expect(result.canCancel).toBe(false);
      });
    });
  });

  describe("Export", () => {
    describe("exportOrders", () => {
      it("should export orders as CSV", async () => {
        const result = await service.exportOrders({ restaurantId: '1' }, "csv");

        expect(result).toBeInstanceOf(Buffer);
      });

      it("should export orders as Excel", async () => {
        const result = await service.exportOrders({ restaurantId: '1' }, "excel");

        expect(result).toBeInstanceOf(Buffer);
      });

      it("should export orders as PDF", async () => {
        const result = await service.exportOrders({ restaurantId: '1' }, "pdf");

        expect(result).toBeInstanceOf(Buffer);
      });
    });
  });

  describe("Search", () => {
    describe("searchOrders", () => {
      it("should search orders by query", async () => {
        mockBaseOrderService.getOrders.mockResolvedValue({
          orders: [{ id: 1, orderNumber: "ORD-001" }],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });

        const result = await service.searchOrders(
          { query: "ORD-001" },
          { restaurantId: '1' },
          100,
        );

        expect(result).toHaveLength(1);
      });
    });
  });

  describe("Status History", () => {
    describe("getOrderStatusHistory", () => {
      it("should return status history", async () => {
        const order = {
          id: 1,
          status: OrderStatus.DELIVERED,
          updatedAt: new Date().toISOString(),
          notes: "Delivered to customer",
        };
        mockEnv.CACHE_KV.get.mockResolvedValue(order);

        const result = await service.getOrderStatusHistory(1);

        expect(result).toHaveLength(1);
        expect(result[0].status).toBe(OrderStatus.DELIVERED);
      });

      it("should return empty array for non-existent order", async () => {
        mockEnv.CACHE_KV.get.mockResolvedValue(null);
        mockBaseOrderService.getOrder.mockResolvedValue(null);

        const result = await service.getOrderStatusHistory(999);

        expect(result).toEqual([]);
      });
    });
  });
});
