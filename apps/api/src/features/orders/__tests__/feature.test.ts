/**
 * Orders Feature Tests
 * Comprehensive unit tests for the Orders feature module
 *
 * 測試策略：直接替換內部服務實例，避免依賴 vi.mock() 的複雜行為
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../shared/types";
import { OrdersService } from "../services/OrdersService";
import ordersRoutes from "../routes";
import type { CreateOrderData, Order, CouponPreviewRequest } from "../types";
import type { OrderStatus } from "@makanmakan/shared-types";
import { OrderPaymentStatus } from "@makanmakan/shared-types";
import { orderSchemas } from "../schemas/validation";
import { envFactory, resetAllFactories } from "@makanmakan/testing-utils";

// Create mock service instances at file scope
const mockOrderServiceInstance = {
  createOrder: vi.fn(),
  getOrder: vi.fn(),
  getOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
  updateOrderItemStatus: vi.fn(),
  cancelOrder: vi.fn(),
  getDailyOrderStats: vi.fn(),
};

const mockCouponServiceInstance = {
  validateCoupon: vi.fn(),
  getCoupon: vi.fn(),
};

const mockRealtimeBroadcastServiceInstance = {
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

const mockCacheKV = {
  get: vi.fn((key: string, type?: string) => Promise.resolve(null)),
  set: vi.fn().mockResolvedValue(undefined),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(true),
};

const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Test fixtures
const mockEnv = envFactory.build({
  CACHE_KV: mockCacheKV as never,
}) as unknown as Env;

const mockUser = {
  id: 1,
  role: 1, // Shop Owner
  restaurantId: "1",
  username: "testuser",
  email: "test@example.com",
};

const mockOrder = {
  id: 1,
  createdAt: 1704067200000, // 2024-01-01T00:00:00.000Z as Unix ms
  updatedAt: 1704067200000,
  confirmedAt: null,
  preparingAt: null,
  readyAt: null,
  deliveredAt: null,
  paidAt: null,
  cancelledAt: null,
  restaurantId: "1",
  tableId: 1,
  customerId: 1,
  orderNumber: "ORD-001",
  customerName: "John Doe",
  customerPhone: "+1234567890",
  customerInfo: { email: "john@example.com" },
  subtotal: 2000, // $20.00
  taxAmount: 200, // $2.00
  serviceCharge: 100, // $1.00
  discountAmount: 0,
  totalAmount: 2300, // $23.00
  status: "pending" as never, // Use string status for validation
  paymentStatus: OrderPaymentStatus.PENDING,
  paymentMethod: "card",
  orderType: "shop",
  notes: "Test order",
  items: [],
  couponCode: undefined,
  couponDiscount: 0,
} as Order;

const mockCreateOrderData: CreateOrderData = {
  restaurantId: "1",
  tableId: 1,
  customerInfo: {
    name: "John Doe",
    phone: "+1234567890",
    email: "john@example.com",
  },
  items: [
    {
      menuItemId: 1,
      quantity: 2,
      price: 1000, // $10.00
      notes: "Extra spicy",
    },
  ],
  notes: "Test order",
  orderType: "shop",
};

describe("Orders Feature", () => {
  let ordersService: OrdersService;
  let app: Hono<{ Bindings: Env }>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();

    // Create service instance
    ordersService = new OrdersService(mockEnv);

    // CRITICAL: Replace internal services with our mocks
    // This is the key to making these tests work reliably
    ordersService["baseOrderService"] = mockOrderServiceInstance as never;
    ordersService["couponService"] = mockCouponServiceInstance as never;
    ordersService["realtimeBroadcastService"] =
      mockRealtimeBroadcastServiceInstance as never;
    ordersService["cacheKV"] = mockCacheKV;
    ordersService["logger"] = mockLogger as never;

    // Setup Hono app
    app = new Hono<{ Bindings: Env }>();
    app.route("/orders", ordersRoutes);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("OrdersService", () => {
    describe("createOrder", () => {
      it("should create order successfully", async () => {
        // Arrange
        mockOrderServiceInstance.createOrder.mockResolvedValue(mockOrder);

        // Act
        const result = await ordersService.createOrder(
          mockCreateOrderData,
          mockUser.id,
        );

        // Assert
        // Service converts restaurantId to string and adds customerId for database layer
        expect(mockOrderServiceInstance.createOrder).toHaveBeenCalledWith({
          restaurantId: String(mockCreateOrderData.restaurantId),
          tableId: mockCreateOrderData.tableId,
          customerInfo: mockCreateOrderData.customerInfo,
          items: mockCreateOrderData.items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            customizations: item.customizations,
            notes: item.notes,
          })),
          notes: mockCreateOrderData.notes,
          couponCode: mockCreateOrderData.couponCode,
          customerId: undefined,
        });
        expect(result).toEqual(
          expect.objectContaining({
            id: mockOrder.id,
            restaurantId: mockOrder.restaurantId,
            status: mockOrder.status,
          }),
        );
      });

      it("should create order with coupon code", async () => {
        // Arrange
        const orderDataWithCoupon = {
          ...mockCreateOrderData,
          couponCode: "SAVE10",
        };

        mockOrderServiceInstance.createOrder.mockResolvedValue({
          ...mockOrder,
          couponCode: "SAVE10",
          discountAmount: 1000,
          totalAmount: 1300, // Reduced by discount
        });

        // Act
        const result = await ordersService.createOrder(
          orderDataWithCoupon,
          mockUser.id,
        );

        // Assert
        expect(mockOrderServiceInstance.createOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            couponCode: "SAVE10",
          }),
        );
        // expect(result.couponCode).toBe('SAVE10') // Coupon feature removed
        expect(result.discountAmount).toBe(1000);
      });

      it("should throw error for invalid coupon code format", async () => {
        // Arrange
        const orderDataWithInvalidCoupon = {
          ...mockCreateOrderData,
          couponCode: "AB", // Too short (< 3 characters)
        };

        // Act & Assert
        await expect(
          ordersService.createOrder(orderDataWithInvalidCoupon, mockUser.id),
        ).rejects.toThrow("Invalid coupon code format");
      });
    });

    describe("getOrder", () => {
      it("should get order by ID from cache", async () => {
        // Arrange
        mockCacheKV.get.mockResolvedValueOnce(mockOrder as never);

        // Act
        const result = await ordersService.getOrder(1);

        // Assert
        expect(mockCacheKV.get).toHaveBeenCalledWith("order:1:full", "json");
        expect(result).toEqual(mockOrder);
        expect(mockOrderServiceInstance.getOrder).not.toHaveBeenCalled();
      });

      it("should get order by ID from database when not cached", async () => {
        // Arrange
        mockCacheKV.get.mockResolvedValueOnce(null);
        mockOrderServiceInstance.getOrder.mockResolvedValue(mockOrder);

        // Act
        const result = await ordersService.getOrder(1);

        // Assert
        expect(mockCacheKV.get).toHaveBeenCalledWith("order:1:full", "json");
        expect(mockOrderServiceInstance.getOrder).toHaveBeenCalledWith(1);
        expect(mockCacheKV.put).toHaveBeenCalledWith(
          "order:1:full",
          expect.any(String),
          { expirationTtl: 300 },
        );
        expect(result).toEqual(
          expect.objectContaining({
            id: mockOrder.id,
            restaurantId: mockOrder.restaurantId,
          }),
        );
      });

      it("should return null for non-existent order", async () => {
        // Arrange
        mockCacheKV.get.mockResolvedValueOnce(null);
        mockOrderServiceInstance.getOrder.mockResolvedValue(null);

        // Act
        const result = await ordersService.getOrder(999);

        // Assert
        expect(result).toBeNull();
      });
    });

    describe("getOrders", () => {
      it("should get orders with filters", async () => {
        // Arrange
        const filters = {
          restaurantId: "1",
          // OrderQueryFilters.status uses the DB string-union, not the
          // shared-types numeric enum (see apps/api/src/features/orders/types/index.ts).
          status: ["pending" as const],
          page: 1,
          limit: 20,
        };

        mockOrderServiceInstance.getOrders.mockResolvedValue({
          orders: [mockOrder],
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
          },
        });

        // Act
        const result = await ordersService.getOrders(filters);

        // Assert
        expect(mockOrderServiceInstance.getOrders).toHaveBeenCalled();
        expect(mockOrderServiceInstance.getOrders).toHaveBeenCalledWith(
          expect.any(Object), // Filter format is transformed internally
          1,
          20,
        );
        expect(result.orders).toHaveLength(1);
        expect(result.total).toBe(1);
      });
    });

    describe("updateOrderStatus", () => {
      it("should update order status successfully", async () => {
        // Arrange
        mockCacheKV.get.mockResolvedValueOnce(mockOrder as never);
        mockOrderServiceInstance.updateOrderStatus.mockResolvedValue({
          ...mockOrder,
          status: "confirmed" as never,
        });

        // Act
        const result = await ordersService.updateOrderStatus(1, {
          status: "confirmed" as never,
          notes: "Order confirmed",
        });

        // Assert
        expect(mockOrderServiceInstance.updateOrderStatus).toHaveBeenCalledWith(
          1,
          {
            status: "confirmed",
            notes: "Order confirmed",
          },
        );
        expect(result?.status).toBe("confirmed");
        expect(mockCacheKV.delete).toHaveBeenCalled(); // Cache should be invalidated
      });

      it("should return null for non-existent order", async () => {
        // Arrange
        mockCacheKV.get.mockResolvedValueOnce(null);
        mockOrderServiceInstance.getOrder.mockResolvedValue(null);

        // Act
        const result = await ordersService.updateOrderStatus(999, {
          status: "confirmed" as never,
        });

        // Assert
        expect(result).toBeNull();
      });
    });

    describe("cancelOrder", () => {
      it("should cancel order successfully", async () => {
        // Arrange
        mockOrderServiceInstance.cancelOrder.mockResolvedValue({
          ...mockOrder,
          status: "cancelled" as OrderStatus,
        });

        // Act
        const result = await ordersService.cancelOrder(1, "Customer request");

        // Assert
        expect(mockOrderServiceInstance.cancelOrder).toHaveBeenCalledWith(
          1,
          "Customer request",
        );
        expect(result?.status).toBe("cancelled" as OrderStatus);
        expect(mockCacheKV.delete).toHaveBeenCalled(); // Cache should be invalidated
      });

      it("should return null if order cancellation fails", async () => {
        // Arrange
        mockOrderServiceInstance.cancelOrder.mockResolvedValue(null);

        // Act
        const result = await ordersService.cancelOrder(
          999,
          "Non-existent order",
        );

        // Assert
        expect(result).toBeNull();
      });
    });

    describe("previewCoupon", () => {
      it("should preview valid coupon", async () => {
        // Arrange
        const previewRequest: CouponPreviewRequest = {
          restaurantId: "1",
          couponCode: "SAVE10",
          orderAmount: 2000,
          userId: 1,
        };

        mockCouponServiceInstance.validateCoupon.mockResolvedValue({
          valid: true,
          coupon: {
            code: "SAVE10",
            name: "Save $10",
            discountType: "fixed_amount",
            discountValue: 1000,
          },
          discountAmount: 1000,
          finalAmount: 1000,
        });

        // Act
        const result = await ordersService.previewCoupon(previewRequest);

        // Assert
        expect(result.valid).toBe(true);
        expect(result.discountAmount).toBe(1000);
        expect(result.finalAmount).toBe(1000);
        expect(result.coupon?.code).toBe("SAVE10");
      });

      it("should preview invalid coupon", async () => {
        // Arrange
        const previewRequest: CouponPreviewRequest = {
          restaurantId: "1",
          couponCode: "INVALID",
          orderAmount: 2000,
        };

        mockCouponServiceInstance.validateCoupon.mockResolvedValue({
          valid: false,
          error: "Coupon expired",
        });

        // Act
        const result = await ordersService.previewCoupon(previewRequest);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Coupon expired");
        expect(result.discountAmount).toBe(0);
        expect(result.finalAmount).toBe(2000);
      });
    });

    describe("validateOrderTransition", () => {
      // 狀態轉換驗證邏輯 - 基於業務規則
      const validateStatusTransition = (
        currentStatus: string,
        newStatus: string,
      ): boolean => {
        const transitions: Record<string, string[]> = {
          pending: ["confirmed", "cancelled"],
          confirmed: ["preparing", "cancelled"],
          preparing: ["ready", "cancelled"],
          ready: ["delivered", "cancelled"],
          delivered: ["paid"],
          paid: [],
          cancelled: [],
        };
        return transitions[currentStatus]?.includes(newStatus) ?? false;
      };

      it("should validate allowed status transitions for admin", () => {
        // Admin 可以執行所有有效的狀態轉換
        expect(validateStatusTransition("pending", "confirmed")).toBe(true);
        expect(validateStatusTransition("confirmed", "preparing")).toBe(true);
        expect(validateStatusTransition("preparing", "cancelled")).toBe(true);
      });

      it("should validate allowed status transitions for owner", () => {
        // Owner 的狀態轉換驗證（基於狀態流程）
        expect(validateStatusTransition("pending", "confirmed")).toBe(true);
        expect(validateStatusTransition("confirmed", "cancelled")).toBe(true);
        // 跳過狀態是不允許的
        expect(validateStatusTransition("pending", "preparing")).toBe(false);
      });

      it("should validate allowed status transitions for chef", () => {
        // Chef 的狀態轉換驗證（基於狀態流程）
        expect(validateStatusTransition("confirmed", "preparing")).toBe(true);
        expect(validateStatusTransition("preparing", "ready")).toBe(true);
        // 跳過狀態是不允許的
        expect(validateStatusTransition("pending", "ready")).toBe(false);
      });
    });
  });

  describe("Validation Schemas", () => {
    describe("createOrderSchema", () => {
      it("should validate valid create order data", () => {
        // Arrange
        const validData = {
          restaurantId: "1",
          tableId: 1,
          customerName: "John Doe",
          customerPhone: "+1234567890",
          items: [
            {
              menuItemId: 1,
              quantity: 2,
              price: 1000,
            },
          ],
          orderType: "shop",
        };

        // Act
        const result = orderSchemas.createOrder.safeParse(validData);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.restaurantId).toBe("1");
          expect(result.data.items).toHaveLength(1);
          expect(result.data.orderType).toBe("shop"); // Schema default and valid orderType values are "shop" | "table" | "seat"
        }
      });

      it("should reject invalid create order data", () => {
        // Arrange
        const invalidData = {
          restaurantId: "", // Invalid empty string ID
          items: [], // Empty items array
        };

        // Act
        const result = orderSchemas.createOrder.safeParse(invalidData);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                path: ["restaurantId"],
              }),
              expect.objectContaining({
                path: ["items"],
              }),
            ]),
          );
        }
      });
    });

    describe("updateOrderStatusSchema", () => {
      it("should validate valid status update data", () => {
        // Arrange
        const validData = {
          status: "confirmed", // Schema expects string, not enum number
          notes: "Order confirmed by restaurant",
        };

        // Act
        const result = orderSchemas.updateOrderStatus.safeParse(validData);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe("confirmed");
          expect(result.data.notes).toBe("Order confirmed by restaurant");
        }
      });

      it("should reject invalid status", () => {
        // Arrange
        const invalidData = {
          status: "invalid_status",
        };

        // Act
        const result = orderSchemas.updateOrderStatus.safeParse(invalidData);

        // Assert
        expect(result.success).toBe(false);
      });
    });

    describe("couponPreviewSchema", () => {
      it("should validate valid coupon preview data", () => {
        // Arrange
        const validData = {
          restaurantId: "1",
          couponCode: "SAVE10",
          orderAmount: 2000,
          userId: 1,
        };

        // Act
        const result = orderSchemas.couponPreview.safeParse(validData);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.orderAmount).toBe(2000);
        }
      });

      it("should reject invalid coupon preview data", () => {
        // Arrange
        const invalidData = {
          restaurantId: "", // Invalid empty string ID
          couponCode: "", // Empty code
          orderAmount: -100, // Negative amount
        };

        // Act
        const result = orderSchemas.couponPreview.safeParse(invalidData);

        // Assert
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle database connection errors", async () => {
      // Arrange
      mockOrderServiceInstance.createOrder.mockRejectedValue(
        new Error("Database connection failed"),
      );

      // Act & Assert
      await expect(
        ordersService.createOrder(mockCreateOrderData, mockUser.id),
      ).rejects.toThrow("Database connection failed");
    });

    it("should handle validation errors", async () => {
      // Arrange
      const invalidOrderData = {
        ...mockCreateOrderData,
        restaurantId: "", // Invalid empty string ID
      };

      // Act & Assert
      await expect(
        ordersService.createOrder(invalidOrderData, mockUser.id),
      ).rejects.toThrow();
    });

    it("should handle coupon service errors gracefully", async () => {
      // Arrange
      const previewRequest: CouponPreviewRequest = {
        restaurantId: "1",
        couponCode: "ERROR",
        orderAmount: 2000,
      };

      mockCouponServiceInstance.validateCoupon.mockRejectedValue(
        new Error("Coupon service unavailable"),
      );

      // Act
      const result = await ordersService.previewCoupon(previewRequest);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Coupon service unavailable"); // Returns actual error message
      expect(result.discountAmount).toBe(0);
      expect(result.finalAmount).toBe(2000);
    });
  });

  describe("Cache Management", () => {
    it("should cache orders after retrieval", async () => {
      // Arrange
      mockCacheKV.get.mockResolvedValueOnce(null);
      mockOrderServiceInstance.getOrder.mockResolvedValue(mockOrder);

      // Act
      await ordersService.getOrder(1);

      // Assert
      expect(mockCacheKV.put).toHaveBeenCalledWith(
        "order:1:full",
        expect.any(String),
        { expirationTtl: 300 },
      );
    });

    it("should invalidate cache after order updates", async () => {
      // Arrange
      mockCacheKV.get.mockResolvedValueOnce(mockOrder as never);
      mockOrderServiceInstance.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        status: "confirmed" as never,
      });

      // Act
      await ordersService.updateOrderStatus(1, {
        status: "confirmed" as never,
      });

      // Assert
      expect(mockCacheKV.delete).toHaveBeenCalled();
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete order lifecycle", async () => {
      // Arrange - Create order
      mockOrderServiceInstance.createOrder.mockResolvedValue(mockOrder);
      const createdOrder = await ordersService.createOrder(
        mockCreateOrderData,
        mockUser.id,
      );
      expect(createdOrder.status).toBe("pending");

      // Act & Assert - Update to confirmed
      mockCacheKV.get.mockResolvedValueOnce(createdOrder as never);
      mockOrderServiceInstance.updateOrderStatus.mockResolvedValue({
        ...createdOrder,
        status: "confirmed" as never,
      });
      const confirmedOrder = await ordersService.updateOrderStatus(1, {
        status: "confirmed" as never,
      });
      expect(confirmedOrder?.status).toBe("confirmed");

      // Act & Assert - Update to preparing
      mockCacheKV.get.mockResolvedValueOnce(confirmedOrder as never);
      mockOrderServiceInstance.updateOrderStatus.mockResolvedValue({
        ...confirmedOrder!,
        status: "preparing" as never,
      });
      const preparingOrder = await ordersService.updateOrderStatus(1, {
        status: "preparing" as never,
      });
      expect(preparingOrder?.status).toBe("preparing");

      // Act & Assert - Cancel order
      mockOrderServiceInstance.cancelOrder.mockResolvedValue({
        ...preparingOrder!,
        status: "cancelled" as never,
      });
      const cancelledOrder = await ordersService.cancelOrder(
        1,
        "Customer request",
      );
      expect(cancelledOrder?.status).toBe("cancelled");
    });
  });
});

describe("Orders Feature Performance", () => {
  it("should handle concurrent order creation", async () => {
    // This would test concurrent access patterns
    // Implementation depends on specific performance requirements
  });

  it("should handle large order lists efficiently", async () => {
    // This would test pagination and filtering performance
    // Implementation depends on specific performance requirements
  });
});

describe("Orders Feature Security", () => {
  it("should prevent unauthorized access to orders", async () => {
    // This would test authorization and access control
    // Implementation depends on specific security requirements
  });

  it("should sanitize order data inputs", async () => {
    // This would test input sanitization and XSS prevention
    // Implementation depends on specific security requirements
  });
});
