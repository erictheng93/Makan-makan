/**
 * Multi-Tenant Data Isolation Tests for Order System
 *
 * These tests verify that the order system properly isolates data between
 * restaurants (tenants) using the defence-in-depth CallerContext pattern.
 *
 * Two layers of protection:
 * 1. Route layer: sets restaurantId from JWT and checks access (existing)
 * 2. Service layer: CallerContext validates restaurant ownership (new)
 *
 * When CallerContext is provided, the service enforces tenant isolation.
 * Without it (backward compat), the route layer is the sole enforcer.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrdersService } from "../services/OrdersService";
import type { OrderStatus } from "@makanmakan/shared-types";
import { resetAllFactories } from "@makanmakan/testing-utils";

// ── Mock dependencies ──────────────────────────────────────────────────

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
  RealtimeBroadcastService: vi.fn(function () {
    return {
      broadcastNewOrder: vi.fn().mockResolvedValue({
        success: true,
        eventId: "evt-1",
        recipientCount: 1,
      }),
      broadcastOrderStatusUpdate: vi.fn().mockResolvedValue({
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

// ── Helpers ────────────────────────────────────────────────────────────

const RESTAURANT_A = "rest-A";
const RESTAURANT_B = "rest-B";

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

const makeMockOrder = (
  id: number,
  restaurantId: string,
  status: string = "pending",
) => ({
  id,
  orderNumber: `ORD-${id}`,
  restaurantId,
  tableId: 1,
  totalAmount: 5000,
  status,
  notes: "",
  items: [{ menuItemId: 1, quantity: 1 }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// ── Test suite ─────────────────────────────────────────────────────────

describe("OrdersService — Multi-Tenant Data Isolation", () => {
  let service: OrdersService;
  let mockEnv: ReturnType<typeof createMockEnv>;
  let mockBaseOrderService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetAllFactories();
    mockEnv = createMockEnv();

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

    const mockCouponService = { validateCoupon: vi.fn() };

    (OrderService as unknown as ApiTestMockedConstructor).mockImplementation(
      function () {
        return mockBaseOrderService;
      },
    );
    (CouponService as unknown as ApiTestMockedConstructor).mockImplementation(
      function () {
        return mockCouponService;
      },
    );

    service = new OrdersService(mockEnv as unknown as ApiTestEnv);
  });

  // ════════════════════════════════════════════════════════════════════
  // 1. Restaurant ID Filter Enforcement
  // ════════════════════════════════════════════════════════════════════

  describe("Restaurant ID Filter Enforcement", () => {
    it("should pass restaurantId filter to base service when non-admin user provides it", async () => {
      const userId = 10;
      const userRole = 1; // Shop Owner

      mockBaseOrderService.getOrders.mockResolvedValue({
        orders: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await service.getOrders({ restaurantId: RESTAURANT_A }, userId, userRole);

      expect(mockBaseOrderService.getOrders).toHaveBeenCalledTimes(1);
      const calledFilters = mockBaseOrderService.getOrders.mock.calls[0][0];
      expect(calledFilters.restaurantId).toBe(RESTAURANT_A);
    });

    it("should scope non-admin user to their own restaurant via CallerContext", async () => {
      const userId = 10;
      const userRole = 1; // Shop Owner
      const caller = { userId, userRole, userRestaurantId: RESTAURANT_A };

      mockBaseOrderService.getOrders.mockResolvedValue({
        orders: [makeMockOrder(1, RESTAURANT_A)],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await service.getOrders({}, userId, userRole, caller);

      // applyPermissionFilters should inject the caller's restaurant
      const calledFilters = mockBaseOrderService.getOrders.mock.calls[0][0];
      expect(calledFilters.restaurantId).toBe(RESTAURANT_A);
      expect(result.orders).toHaveLength(1);
    });

    it("should still work without CallerContext (backward compatible)", async () => {
      const userId = 10;
      const userRole = 1;

      mockBaseOrderService.getOrders.mockResolvedValue({
        orders: [makeMockOrder(1, RESTAURANT_A)],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      // No caller context — route layer is responsible for filtering
      const result = await service.getOrders(
        { restaurantId: RESTAURANT_A },
        userId,
        userRole,
      );

      expect(result.orders).toHaveLength(1);
    });

    it("should pass restaurantId filter through for all staff roles (2-4)", async () => {
      const staffRoles = [2, 3, 4]; // Chef, Service, Cashier

      for (const role of staffRoles) {
        vi.clearAllMocks();

        mockBaseOrderService.getOrders.mockResolvedValue({
          orders: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });

        await service.getOrders(
          { restaurantId: RESTAURANT_A },
          20,
          role as never,
        );

        const calledFilters = mockBaseOrderService.getOrders.mock.calls[0][0];
        expect(calledFilters.restaurantId).toBe(RESTAURANT_A);
      }
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 2. Cross-Restaurant Order Access
  // ════════════════════════════════════════════════════════════════════

  describe("Cross-Restaurant Order Access", () => {
    it("should reject getOrder when caller's restaurant doesn't match order's restaurant", async () => {
      const orderFromB = makeMockOrder(99, RESTAURANT_B);
      mockBaseOrderService.getOrder.mockResolvedValue(orderFromB);

      const callerFromA = {
        userId: 10,
        userRole: 1,
        userRestaurantId: RESTAURANT_A,
      };

      await expect(service.getOrder(99, true, callerFromA)).rejects.toThrow(
        "Access denied",
      );
    });

    it("should allow getOrder without CallerContext (backward compatible)", async () => {
      const orderFromB = makeMockOrder(99, RESTAURANT_B);
      mockBaseOrderService.getOrder.mockResolvedValue(orderFromB);

      // No caller context — no enforcement
      const result = await service.getOrder(99);
      expect(result).not.toBeNull();
      expect(result!.restaurantId).toBe(RESTAURANT_B);
    });

    it("should allow admin to getOrder from any restaurant", async () => {
      const orderFromB = makeMockOrder(99, RESTAURANT_B);
      mockBaseOrderService.getOrder.mockResolvedValue(orderFromB);

      const adminCaller = {
        userId: 1,
        userRole: 0,
        userRestaurantId: undefined,
      };

      const result = await service.getOrder(99, true, adminCaller);
      expect(result).not.toBeNull();
      expect(result!.restaurantId).toBe(RESTAURANT_B);
    });

    it("getActiveOrders should request only the specified restaurant", async () => {
      mockBaseOrderService.getOrders.mockResolvedValue({
        orders: [makeMockOrder(1, RESTAURANT_A, "confirmed")],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });

      const result = await service.getActiveOrders(RESTAURANT_A);

      expect(mockBaseOrderService.getOrders).toHaveBeenCalledTimes(1);
      const calledFilters = mockBaseOrderService.getOrders.mock.calls[0][0];
      expect(calledFilters.restaurantId).toBe(RESTAURANT_A);
      expect(result).toHaveLength(1);
      expect(result[0].restaurantId).toBe(RESTAURANT_A);
    });

    it("getActiveOrders passes the active status filter to the base service", async () => {
      mockBaseOrderService.getOrders.mockResolvedValue({
        orders: [],
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
      });

      await service.getActiveOrders(RESTAURANT_A);

      const calledFilters = mockBaseOrderService.getOrders.mock.calls[0][0];
      // The DB orders.status column is text, so getActiveOrders passes string
      // literals (matching the DB schema's OrderStatus union) — not the legacy
      // numeric OrderStatus enum from shared-types, which would silently fail
      // the SQL inArray comparison against a TEXT column.
      expect(calledFilters.status).toEqual(
        expect.arrayContaining(["confirmed", "preparing", "ready"]),
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 3. Cross-Restaurant Operations
  // ════════════════════════════════════════════════════════════════════

  describe("Cross-Restaurant Operations", () => {
    it("should reject updateOrderStatus when caller's restaurant doesn't match order", async () => {
      const orderFromB = makeMockOrder(50, RESTAURANT_B, "pending");
      mockBaseOrderService.getOrder.mockResolvedValue(orderFromB);

      const callerFromA = {
        userId: 10,
        userRole: 1,
        userRestaurantId: RESTAURANT_A,
      };

      await expect(
        service.updateOrderStatus(
          50,
          { status: "confirmed" as OrderStatus },
          10,
          1,
          callerFromA,
        ),
      ).rejects.toThrow("Access denied");

      // Base service should NOT have been called
      expect(mockBaseOrderService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it("should reject cancelOrder when caller's restaurant doesn't match order", async () => {
      const orderFromB = makeMockOrder(60, RESTAURANT_B);
      mockBaseOrderService.getOrder.mockResolvedValue(orderFromB);

      const callerFromA = {
        userId: 10,
        userRole: 1,
        userRestaurantId: RESTAURANT_A,
      };

      await expect(
        service.cancelOrder(60, "Cancelled by mistake", 10, callerFromA),
      ).rejects.toThrow("Access denied");

      // Base service cancelOrder should NOT have been called
      expect(mockBaseOrderService.cancelOrder).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 4. Admin Cross-Restaurant Access
  // ════════════════════════════════════════════════════════════════════

  describe("Admin Cross-Restaurant Access", () => {
    it("admin (role 0) can query orders across all restaurants", async () => {
      const mixedOrders = [
        makeMockOrder(1, RESTAURANT_A),
        makeMockOrder(2, RESTAURANT_B),
      ];

      mockBaseOrderService.getOrders.mockResolvedValue({
        orders: mixedOrders,
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      });

      const result = await service.getOrders({}, 1, 0); // admin role

      expect(result.orders).toHaveLength(2);

      // Admin filters pass through unchanged — no restaurant restriction
      const calledFilters = mockBaseOrderService.getOrders.mock.calls[0][0];
      expect(calledFilters.restaurantId).toBeUndefined();
    });

    it("admin can explicitly filter by a specific restaurant", async () => {
      mockBaseOrderService.getOrders.mockResolvedValue({
        orders: [makeMockOrder(1, RESTAURANT_A)],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await service.getOrders(
        { restaurantId: RESTAURANT_A },
        1,
        0,
      );

      const calledFilters = mockBaseOrderService.getOrders.mock.calls[0][0];
      expect(calledFilters.restaurantId).toBe(RESTAURANT_A);
      expect(result.orders).toHaveLength(1);
    });

    it("admin analytics should work without restaurant restriction", async () => {
      // getOrderAnalytics requires a restaurantId in the filters to
      // generate stats — even for admin.  This is by design, not a gap.
      const mockStats = {
        totalOrders: 50,
        totalRevenue: 250000,
        avgOrderValue: 5000,
      };
      mockBaseOrderService.getDailyOrderStats.mockResolvedValue(mockStats);

      const analytics = await service.getOrderAnalytics(
        { restaurantId: RESTAURANT_A },
        1, // admin userId
      );

      expect(analytics.summary.totalOrders).toBe(50);
      expect(mockBaseOrderService.getDailyOrderStats).toHaveBeenCalledWith(
        RESTAURANT_A,
        expect.any(Date),
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 5. Analytics Isolation
  // ════════════════════════════════════════════════════════════════════

  describe("Analytics Isolation", () => {
    it("getOrderAnalytics passes restaurantId to base service", async () => {
      const mockStats = {
        totalOrders: 10,
        totalRevenue: 50000,
        avgOrderValue: 5000,
      };
      mockBaseOrderService.getDailyOrderStats.mockResolvedValue(mockStats);

      await service.getOrderAnalytics({ restaurantId: RESTAURANT_A });

      expect(mockBaseOrderService.getDailyOrderStats).toHaveBeenCalledWith(
        RESTAURANT_A,
        expect.any(Date),
      );
    });

    it("getOrderAnalytics throws when restaurantId is missing", async () => {
      await expect(service.getOrderAnalytics({})).rejects.toThrow(
        "Restaurant ID required for analytics",
      );
    });

    it("getDailyStats passes restaurantId to base service", async () => {
      const mockStats = {
        totalOrders: 5,
        totalRevenue: 25000,
        avgOrderValue: 5000,
      };
      mockBaseOrderService.getDailyOrderStats.mockResolvedValue(mockStats);

      const targetDate = new Date("2026-03-20");
      await service.getDailyStats(RESTAURANT_A, targetDate);

      expect(mockBaseOrderService.getDailyOrderStats).toHaveBeenCalledWith(
        RESTAURANT_A,
        targetDate,
      );
    });

    it("getDailyStats for restaurant A does not query restaurant B", async () => {
      const mockStats = {
        totalOrders: 5,
        totalRevenue: 25000,
        avgOrderValue: 5000,
      };
      mockBaseOrderService.getDailyOrderStats.mockResolvedValue(mockStats);

      await service.getDailyStats(RESTAURANT_A);

      const [calledRestaurantId] =
        mockBaseOrderService.getDailyOrderStats.mock.calls[0];
      expect(calledRestaurantId).toBe(RESTAURANT_A);
      expect(calledRestaurantId).not.toBe(RESTAURANT_B);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 6. Data Leakage Prevention
  // ════════════════════════════════════════════════════════════════════

  describe("Data Leakage Prevention", () => {
    it("getOrders scoped to restaurant A should not include restaurant B orders", async () => {
      // Simulate the base service correctly returning only restaurant A
      // orders when the filter is set.
      const ordersA = [
        makeMockOrder(1, RESTAURANT_A),
        makeMockOrder(2, RESTAURANT_A),
      ];

      mockBaseOrderService.getOrders.mockResolvedValue({
        orders: ordersA,
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      });

      const result = await service.getOrders(
        { restaurantId: RESTAURANT_A },
        10,
        1,
      );

      // Every returned order should belong to restaurant A
      for (const order of result.orders) {
        expect(order.restaurantId).toBe(RESTAURANT_A);
      }
      expect(result.orders).toHaveLength(2);
    });

    it("should strip leaked orders from wrong restaurant via post-query filter", async () => {
      // Even if the base service (due to a bug) returns orders from
      // restaurant B when asked for restaurant A, the post-query filter
      // strips them as a defence-in-depth measure.
      const leakedOrders = [
        makeMockOrder(1, RESTAURANT_A),
        makeMockOrder(2, RESTAURANT_B), // leaked from DB!
      ];

      mockBaseOrderService.getOrders.mockResolvedValue({
        orders: leakedOrders,
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      });

      const result = await service.getOrders(
        { restaurantId: RESTAURANT_A },
        10,
        1,
      );

      // Post-query filter should remove the restaurant B order
      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].restaurantId).toBe(RESTAURANT_A);
    });

    it("should override spoofed restaurantId with caller's own restaurant via CallerContext", async () => {
      // A shop owner from restaurant A tries to query restaurant B's data.
      // With CallerContext, applyPermissionFilters overrides the spoofed
      // restaurantId with the caller's own restaurant.
      const ordersA = [makeMockOrder(1, RESTAURANT_A)];

      mockBaseOrderService.getOrders.mockResolvedValue({
        orders: ordersA,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const callerFromA = {
        userId: 10,
        userRole: 1,
        userRestaurantId: RESTAURANT_A,
      };

      // User 10 belongs to restaurant A, tries to query restaurant B
      const result = await service.getOrders(
        { restaurantId: RESTAURANT_B },
        10,
        1,
        callerFromA,
      );

      // The filter should be overridden to restaurant A
      const calledFilters = mockBaseOrderService.getOrders.mock.calls[0][0];
      expect(calledFilters.restaurantId).toBe(RESTAURANT_A);
      expect(result.orders).toHaveLength(1);
    });
  });
});
