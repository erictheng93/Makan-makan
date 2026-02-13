/**
 * OrderService Unit Tests
 *
 * Tests order management including:
 * - Order creation with validation
 * - Minimum order amount validation
 * - Order status management
 * - Order queries and filtering
 * - Daily statistics
 * - Coupon integration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock query-cache utilities
vi.mock("../../utils/query-cache", () => {
  class MockQueryCache {
    constructor(_kv: any) {}
    async getOrExecute<T>(
      _cacheKey: string,
      queryFn: () => Promise<T>,
      _options?: any,
    ): Promise<T> {
      return await queryFn();
    }
    async invalidate(
      _keyOrTags: string | string[],
      _type: "key" | "tag" = "key",
    ): Promise<void> {}
    async getStats() {
      return { total_keys: 0, hit_rate: 0, popular_queries: [] };
    }
  }
  return {
    QueryCache: MockQueryCache,
    buildCacheKey: (
      _resource: string,
      _identifier: string | number,
      _suffix?: string,
    ) => {
      const key = `query:${_resource}:${_identifier}`;
      return _suffix ? `${key}:${_suffix}` : key;
    },
  };
});

// Mock connection-manager
vi.mock("../../utils/connection-manager", () => ({
  getConnectionManager: vi.fn(() => ({
    executeQuery: vi.fn(async (queryFn) => await queryFn()),
  })),
}));

// Mock coupon service
vi.mock("../coupon", () => {
  const MockCouponService = class {
    validateCoupon = vi.fn().mockResolvedValue({
      valid: true,
      discountAmount: 10,
      coupon: {
        id: 1,
        code: "TEST10",
        discountType: "fixed",
        discountValue: 10,
      },
    });
    useCoupon = vi.fn().mockResolvedValue(undefined);
    constructor(_d1: any, _env: any) {}
  };
  return { CouponService: MockCouponService };
});

import { OrderService } from "../order";
import {
  createMockDatabase,
  createMockEnv,
  setupMockDbResponses,
  createQueryChain,
} from "./helpers/mockD1";
import type {
  CreateOrderData,
  UpdateOrderStatusData,
  OrderFilters,
} from "../order";

describe("OrderService", () => {
  let orderService: OrderService;
  let mockDb: any;
  let mockEnv: any;

  // Mock data
  const mockRestaurant = {
    id: 1,
    name: "Test Restaurant",
    isAvailable: true,
    settings: {
      minOrderAmount: 20,
      taxRate: 0.06,
      serviceChargeRate: 0.1,
    },
  };

  const mockTable = {
    id: 1,
    restaurantId: "R-001",
    tableNumber: "T1",
    isActive: true,
    isOccupied: false,
  };

  const mockMenuItem = {
    id: 1,
    restaurantId: "R-001",
    categoryId: 1,
    name: "Burger",
    price: 15.0,
    isAvailable: true,
    inventoryCount: 50,
  };

  const mockOrder = {
    id: 1,
    restaurantId: "R-001",
    tableId: 1,
    customerId: null,
    orderNumber: "1-TEST-ABC",
    status: "pending",
    subtotal: 30.0,
    taxAmount: 1.8,
    serviceCharge: 3.0,
    discountAmount: 0,
    totalAmount: 34.8,
    customerInfo: null,
    estimatedPrepTime: 15,
    actualPrepTime: null,
    confirmedAt: null,
    preparingAt: null,
    readyAt: null,
    deliveredAt: null,
    paidAt: null,
    cancelledAt: null,
    paymentMethod: null,
    paymentStatus: "unpaid",
    rating: null,
    reviewComment: null,
    notes: undefined,
    internalNotes: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    items: [
      {
        id: 1,
        orderId: 1,
        menuItemId: 1,
        quantity: 2,
        unitPrice: 15.0,
        totalPrice: 30.0,
        customizations: undefined,
        notes: undefined,
        status: "pending",
      },
    ],
  };

  const validOrderData: CreateOrderData = {
    restaurantId: "R-001",
    tableId: 1,
    items: [
      {
        menuItemId: 1,
        quantity: 2,
        customizations: undefined,
        notes: undefined,
      },
    ],
    notes: "Test order",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDatabase();
    mockEnv = createMockEnv({
      JWT_SECRET: "test-jwt-secret-key",
    });
    orderService = new OrderService(mockDb, mockEnv);
  });

  describe("getMinimumOrderAmount", () => {
    it("should return minimum order amount and enabled status", async () => {
      // Arrange
      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue(mockRestaurant),
        },
      };

      // Act
      const result = await orderService.getMinimumOrderAmount("R-001");

      // Assert
      expect(result).toEqual({
        minOrderAmount: 20,
        enabled: true,
      });
    });

    it("should return disabled when minOrderAmount is 0", async () => {
      // Arrange
      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue({
            ...mockRestaurant,
            settings: { minOrderAmount: 0 },
          }),
        },
      };

      // Act
      const result = await orderService.getMinimumOrderAmount("R-001");

      // Assert
      expect(result).toEqual({
        minOrderAmount: 0,
        enabled: false,
      });
    });

    it("should return disabled when restaurant is not available", async () => {
      // Arrange
      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue({
            ...mockRestaurant,
            isAvailable: false,
          }),
        },
      };

      // Act
      const result = await orderService.getMinimumOrderAmount("R-001");

      // Assert
      expect(result.enabled).toBe(false);
    });

    it("should throw error when restaurant not found", async () => {
      // Arrange
      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      // Act & Assert
      await expect(orderService.getMinimumOrderAmount("999")).rejects.toThrow(
        "Restaurant not found",
      );
    });
  });

  describe("validateMinimumOrder", () => {
    it("should validate successful when amount meets minimum", async () => {
      // Arrange
      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue(mockRestaurant),
        },
      };

      // Act
      const result = await orderService.validateMinimumOrder("R-001", 25);

      // Assert
      expect(result).toEqual({ valid: true });
    });

    it("should return invalid when amount below minimum", async () => {
      // Arrange
      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue(mockRestaurant),
        },
      };

      // Act
      const result = await orderService.validateMinimumOrder("R-001", 15);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.shortfall).toBe(5);
      expect(result.message).toContain("最低消費");
    });

    it("should validate successful when minimum order disabled", async () => {
      // Arrange
      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue({
            ...mockRestaurant,
            settings: { minOrderAmount: 0 },
          }),
        },
      };

      // Act
      const result = await orderService.validateMinimumOrder("R-001", 5);

      // Assert
      expect(result.valid).toBe(true);
    });
  });

  describe("createOrder", () => {
    it("should create order successfully", async () => {
      // Arrange
      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue(mockRestaurant),
        },
        tables: {
          findFirst: vi.fn().mockResolvedValue(mockTable),
        },
        menuItems: {
          findMany: vi.fn().mockResolvedValue([mockMenuItem]),
        },
      };

      setupMockDbResponses(mockDb, {
        insert: [mockOrder, mockOrder.items],
      });

      // Mock update for inventory updates
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([])),
      });

      // Act
      const result = await orderService.createOrder(validOrderData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.totalAmount).toBe(34.8);
    });

    it("should throw error when restaurant not available", async () => {
      // Arrange
      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue({
            ...mockRestaurant,
            isAvailable: false,
          }),
        },
      };

      // Act & Assert
      await expect(orderService.createOrder(validOrderData)).rejects.toThrow(
        "Restaurant is not available",
      );
    });

    it("should throw error when table not available", async () => {
      // Arrange
      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue(mockRestaurant),
        },
        tables: {
          findFirst: vi.fn().mockResolvedValue({
            ...mockTable,
            isActive: false,
          }),
        },
      };

      // Act & Assert
      await expect(orderService.createOrder(validOrderData)).rejects.toThrow(
        "Table is not available",
      );
    });

    it("should throw error when menu item not available", async () => {
      // Arrange
      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue(mockRestaurant),
        },
        tables: {
          findFirst: vi.fn().mockResolvedValue(mockTable),
        },
        menuItems: {
          findMany: vi.fn().mockResolvedValue([
            {
              ...mockMenuItem,
              isAvailable: false,
            },
          ]),
        },
      };

      // Act & Assert
      await expect(orderService.createOrder(validOrderData)).rejects.toThrow(
        "Menu item 1 is not available",
      );
    });

    it("should throw error when insufficient inventory", async () => {
      // Arrange
      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue(mockRestaurant),
        },
        tables: {
          findFirst: vi.fn().mockResolvedValue(mockTable),
        },
        menuItems: {
          findMany: vi.fn().mockResolvedValue([
            {
              ...mockMenuItem,
              inventoryCount: 1,
            },
          ]),
        },
      };

      // Act & Assert
      await expect(orderService.createOrder(validOrderData)).rejects.toThrow(
        "Insufficient inventory for Burger",
      );
    });

    it("should calculate price with customizations", async () => {
      // Arrange
      const orderWithCustomizations: CreateOrderData = {
        ...validOrderData,
        items: [
          {
            menuItemId: 1,
            quantity: 1,
            customizations: {
              size: { id: "size-large", name: "Large", priceAdjustment: 3 },
              options: [
                {
                  id: "opt-1",
                  optionName: "Cheese Options",
                  choiceId: "choice-extra-cheese",
                  choiceName: "Extra Cheese",
                  priceAdjustment: 2,
                },
              ],
              addOns: [
                {
                  id: "addon-fries",
                  name: "Fries",
                  unitPrice: 5,
                  quantity: 1,
                  totalPrice: 5,
                },
              ],
            },
            notes: undefined,
          },
        ],
      };

      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue(mockRestaurant),
        },
        tables: {
          findFirst: vi.fn().mockResolvedValue(mockTable),
        },
        menuItems: {
          findMany: vi.fn().mockResolvedValue([mockMenuItem]),
        },
      };

      setupMockDbResponses(mockDb, {
        insert: [
          { ...mockOrder, subtotal: 25, totalAmount: 29 },
          mockOrder.items,
        ],
      });

      // Mock update for inventory updates
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([])),
      });

      // Act
      const result = await orderService.createOrder(orderWithCustomizations);

      // Assert
      expect(result).toBeDefined();
      // Price: 15 (base) + 3 (size) + 2 (option) + 5 (add-on) = 25
    });

    it("should throw error when order below minimum amount", async () => {
      // Arrange
      const smallOrder: CreateOrderData = {
        restaurantId: "R-001",
        tableId: 1,
        items: [
          {
            menuItemId: 1,
            quantity: 1, // Only 15, below minimum 20
            customizations: undefined,
            notes: undefined,
          },
        ],
      };

      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue(mockRestaurant),
        },
        tables: {
          findFirst: vi.fn().mockResolvedValue(mockTable),
        },
        menuItems: {
          findMany: vi.fn().mockResolvedValue([mockMenuItem]),
        },
      };

      // Act & Assert
      await expect(orderService.createOrder(smallOrder)).rejects.toThrow(
        "訂單未達最低消費標準",
      );
    });

    it("should apply coupon discount", async () => {
      // Arrange
      const orderWithCoupon: CreateOrderData = {
        ...validOrderData,
        couponCode: "TEST10",
      };

      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue(mockRestaurant),
        },
        tables: {
          findFirst: vi.fn().mockResolvedValue(mockTable),
        },
        menuItems: {
          findMany: vi.fn().mockResolvedValue([mockMenuItem]),
        },
      };

      setupMockDbResponses(mockDb, {
        insert: [
          { ...mockOrder, discountAmount: 10, totalAmount: 24.8 },
          mockOrder.items,
        ],
      });

      // Mock update for inventory updates
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([])),
      });

      // Act
      const result = await orderService.createOrder(orderWithCoupon);

      // Assert
      expect(result).toBeDefined();
      expect(result.discountAmount).toBe(10);
    });
  });

  describe("getOrder", () => {
    it("should fetch order with related data", async () => {
      // Arrange
      mockDb.query = {
        orders: {
          findFirst: vi.fn().mockResolvedValue({
            ...mockOrder,
            items: mockOrder.items,
            restaurant: mockRestaurant,
            table: mockTable,
          }),
        },
      };

      // Act
      const result = await orderService.getOrder(1);

      // Assert
      expect(result).toBeDefined();
      expect(result!.id).toBe(1);
      expect(result!.items).toHaveLength(1);
    });

    it("should return null when order not found", async () => {
      // Arrange
      mockDb.query = {
        orders: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      // Act
      const result = await orderService.getOrder(999);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("getOrderByNumber", () => {
    it("should fetch order by order number", async () => {
      // Arrange
      mockDb.query = {
        orders: {
          findFirst: vi.fn().mockResolvedValue({
            ...mockOrder,
            items: mockOrder.items,
          }),
        },
      };

      // Act
      const result = await orderService.getOrderByNumber("1-TEST-ABC");

      // Assert
      expect(result).toBeDefined();
      expect(result!.orderNumber).toBe("1-TEST-ABC");
    });

    it("should return null when order number not found", async () => {
      // Arrange
      mockDb.query = {
        orders: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      // Act
      const result = await orderService.getOrderByNumber("INVALID");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("getOrders", () => {
    it("should fetch orders with pagination", async () => {
      // Arrange
      const orders = [mockOrder, { ...mockOrder, id: 2 }];

      // Mock relational query for orders list
      mockDb.query = {
        orders: {
          findMany: vi.fn().mockResolvedValue(orders),
        },
      };

      // Mock select query for count
      mockDb.select.mockReturnValue(createQueryChain([{ totalCount: 2 }]));

      const filters: OrderFilters = {
        restaurantId: "R-001",
      };

      // Act
      const result = await orderService.getOrders(filters, 1, 20);

      // Assert
      expect(result.orders).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it("should filter by table", async () => {
      // Arrange
      mockDb.query = {
        orders: {
          findMany: vi.fn().mockResolvedValue([mockOrder]),
        },
      };

      mockDb.select.mockReturnValue(createQueryChain([{ totalCount: 1 }]));

      const filters: OrderFilters = {
        restaurantId: "R-001",
        tableId: 1,
      };

      // Act
      const result = await orderService.getOrders(filters);

      // Assert
      expect(result.orders).toHaveLength(1);
    });

    it("should filter by status", async () => {
      // Arrange
      mockDb.query = {
        orders: {
          findMany: vi.fn().mockResolvedValue([mockOrder]),
        },
      };

      mockDb.select.mockReturnValue(createQueryChain([{ totalCount: 1 }]));

      const filters: OrderFilters = {
        restaurantId: "R-001",
        status: "pending",
      };

      // Act
      const result = await orderService.getOrders(filters);

      // Assert
      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].status).toBe("pending");
    });

    it("should filter by date range", async () => {
      // Arrange
      mockDb.query = {
        orders: {
          findMany: vi.fn().mockResolvedValue([mockOrder]),
        },
      };

      mockDb.select.mockReturnValue(createQueryChain([{ totalCount: 1 }]));

      const filters: OrderFilters = {
        restaurantId: "R-001",
        dateRange: [new Date("2024-01-01"), new Date("2024-01-31")],
      };

      // Act
      const result = await orderService.getOrders(filters);

      // Assert
      expect(result.orders).toHaveLength(1);
    });

    it("should filter by amount range", async () => {
      // Arrange
      mockDb.query = {
        orders: {
          findMany: vi.fn().mockResolvedValue([mockOrder]),
        },
      };

      mockDb.select.mockReturnValue(createQueryChain([{ totalCount: 1 }]));

      const filters: OrderFilters = {
        restaurantId: "R-001",
        minAmount: 20,
        maxAmount: 50,
      };

      // Act
      const result = await orderService.getOrders(filters);

      // Assert
      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].totalAmount).toBeGreaterThanOrEqual(20);
      expect(result.orders[0].totalAmount).toBeLessThanOrEqual(50);
    });
  });

  describe("updateOrderStatus", () => {
    it("should update order status successfully", async () => {
      // Arrange
      const updatedOrder = {
        ...mockOrder,
        status: "confirmed",
        confirmedAt: new Date(),
      };

      setupMockDbResponses(mockDb, {
        update: [updatedOrder],
      });

      const statusData: UpdateOrderStatusData = {
        status: "confirmed",
        notes: "Order confirmed",
      };

      // Act
      const result = await orderService.updateOrderStatus(1, statusData);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe("confirmed");
      expect(result.confirmedAt).toBeDefined();
    });

    it("should throw error when order not found", async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        update: [],
      });

      // Act & Assert
      await expect(
        orderService.updateOrderStatus(999, { status: "confirmed" }),
      ).rejects.toThrow("Order not found");
    });

    it("should update preparing status with timestamp", async () => {
      // Arrange
      const updatedOrder = {
        ...mockOrder,
        status: "preparing",
        preparingAt: new Date(),
      };

      setupMockDbResponses(mockDb, {
        update: [updatedOrder],
      });

      // Act
      const result = await orderService.updateOrderStatus(1, {
        status: "preparing",
      });

      // Assert
      expect(result.status).toBe("preparing");
      expect(result.preparingAt).toBeDefined();
    });

    it("should update delivered status with timestamp", async () => {
      // Arrange
      const updatedOrder = {
        ...mockOrder,
        status: "delivered",
        deliveredAt: new Date(),
      };

      setupMockDbResponses(mockDb, {
        update: [updatedOrder],
      });

      // Act
      const result = await orderService.updateOrderStatus(1, {
        status: "delivered",
      });

      // Assert
      expect(result.status).toBe("delivered");
      expect(result.deliveredAt).toBeDefined();
    });
  });

  describe("cancelOrder", () => {
    it("should cancel order successfully", async () => {
      // Arrange
      const cancelledOrder = {
        ...mockOrder,
        status: "cancelled",
        cancelledAt: new Date(),
        internalNotes: "Customer request",
      };

      // Mock getOrder call (called by cancelOrder)
      mockDb.query = {
        orders: {
          findFirst: vi.fn().mockResolvedValue({
            ...mockOrder,
            items: mockOrder.items,
          }),
        },
      };

      // Mock inventory restore updates
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([])),
      });

      setupMockDbResponses(mockDb, {
        update: [cancelledOrder],
      });

      // Act
      const result = await orderService.cancelOrder(1, "Customer request");

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe("cancelled");
      expect(result.cancelledAt).toBeDefined();
    });

    it("should throw error when order not found", async () => {
      // Arrange
      mockDb.query = {
        orders: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      // Act & Assert
      await expect(orderService.cancelOrder(999)).rejects.toThrow(
        "Order not found",
      );
    });
  });

  describe("getDailyOrderStats", () => {
    it("should return daily statistics", async () => {
      // Arrange
      const stats = {
        totalOrders: 10,
        totalRevenue: 500,
        avgOrderValue: 50,
        pendingOrders: 2,
        confirmedOrders: 3,
        completedOrders: 4,
        cancelledOrders: 1,
      };

      mockDb.select.mockReturnValue(createQueryChain([stats]));

      // Act
      const result = await orderService.getDailyOrderStats("R-001");

      // Assert
      expect(result).toEqual(stats);
    });

    it("should return zero stats when no orders", async () => {
      // Arrange
      mockDb.select.mockReturnValue(createQueryChain([]));

      // Act
      const result = await orderService.getDailyOrderStats("R-001");

      // Assert
      expect(result.totalOrders).toBe(0);
      expect(result.totalRevenue).toBe(0);
    });

    it("should filter by specific date", async () => {
      // Arrange
      const stats = {
        totalOrders: 5,
        totalRevenue: 250,
        avgOrderValue: 50,
        pendingOrders: 1,
        confirmedOrders: 2,
        completedOrders: 2,
        cancelledOrders: 0,
      };

      mockDb.select.mockReturnValue(createQueryChain([stats]));

      // Act
      const specificDate = new Date("2024-01-15");
      const result = await orderService.getDailyOrderStats(
        "R-001",
        specificDate,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.totalOrders).toBe(5);
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors in createOrder", async () => {
      // Arrange
      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockImplementation(() => {
            throw new Error("Database error");
          }),
        },
      };

      // Act & Assert
      await expect(orderService.createOrder(validOrderData)).rejects.toThrow(
        "Database error",
      );
    });

    it("should handle database errors in getOrders", async () => {
      // Arrange
      mockDb.select.mockImplementation(() => {
        throw new Error("Database error");
      });

      // Act & Assert
      await expect(
        orderService.getOrders({ restaurantId: "R-001" }),
      ).rejects.toThrow("Database error");
    });

    it("should handle database errors in getDailyOrderStats", async () => {
      // Arrange
      mockDb.select.mockImplementation(() => {
        throw new Error("Database error");
      });

      // Act & Assert
      await expect(orderService.getDailyOrderStats("R-001")).rejects.toThrow(
        "Database error",
      );
    });
  });
});
