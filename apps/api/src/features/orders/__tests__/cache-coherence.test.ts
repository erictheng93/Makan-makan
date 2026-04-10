/**
 * Cache Coherence & Concurrency Tests
 * Tests cache consistency, invalidation ordering, failure resilience,
 * and concurrent access patterns in OrdersService.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrdersService } from "../services/OrdersService";
import type { OrderQueryFilters } from "../types";
import type { OrderStatus } from "@makanmakan/shared-types";
import { resetAllFactories } from "@makanmakan/testing-utils";

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

describe("OrdersService — Cache Coherence & Concurrency", () => {
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
    const mockCouponService = {
      validateCoupon: vi.fn(),
    };
    (OrderService as any).mockImplementation(function () {
      return mockBaseOrderService;
    });
    (CouponService as any).mockImplementation(function () {
      return mockCouponService;
    });

    service = new OrdersService(mockEnv as any);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Cache Read-Through
  // ─────────────────────────────────────────────────────────────────────────
  describe("Cache Read-Through", () => {
    it("should return cached order without querying DB", async () => {
      const cachedOrder = {
        id: 1,
        orderNumber: "ORD-001",
        status: "pending" as OrderStatus,
      };
      mockEnv.CACHE_KV.get.mockResolvedValue(cachedOrder);

      const result = await service.getOrder(1);

      expect(result).toEqual(cachedOrder);
      expect(mockEnv.CACHE_KV.get).toHaveBeenCalledWith("order:1:full", "json");
      expect(mockBaseOrderService.getOrder).not.toHaveBeenCalled();
    });

    it("should query DB and populate cache on cache miss", async () => {
      const dbOrder = {
        id: 2,
        orderNumber: "ORD-002",
        status: "confirmed" as OrderStatus,
      };
      mockEnv.CACHE_KV.get.mockResolvedValue(null);
      mockBaseOrderService.getOrder.mockResolvedValue(dbOrder);

      const result = await service.getOrder(2);

      expect(result).toEqual(dbOrder);
      expect(mockBaseOrderService.getOrder).toHaveBeenCalledWith(2);
      expect(mockEnv.CACHE_KV.put).toHaveBeenCalledWith(
        "order:2:full",
        JSON.stringify(dbOrder),
        { expirationTtl: 300 },
      );
    });

    it("should NOT populate cache when order does not exist in DB", async () => {
      mockEnv.CACHE_KV.get.mockResolvedValue(null);
      mockBaseOrderService.getOrder.mockResolvedValue(null);

      const result = await service.getOrder(999);

      expect(result).toBeNull();
      expect(mockEnv.CACHE_KV.put).not.toHaveBeenCalled();
    });

    it("should use 'full' cache key when includeItems is true (default)", async () => {
      mockEnv.CACHE_KV.get.mockResolvedValue(null);
      mockBaseOrderService.getOrder.mockResolvedValue({ id: 3 });

      await service.getOrder(3, true);

      expect(mockEnv.CACHE_KV.get).toHaveBeenCalledWith("order:3:full", "json");
      expect(mockEnv.CACHE_KV.put).toHaveBeenCalledWith(
        "order:3:full",
        expect.any(String),
        { expirationTtl: 300 },
      );
    });

    it("should use 'basic' cache key when includeItems is false", async () => {
      mockEnv.CACHE_KV.get.mockResolvedValue(null);
      mockBaseOrderService.getOrder.mockResolvedValue({ id: 4 });

      await service.getOrder(4, false);

      expect(mockEnv.CACHE_KV.get).toHaveBeenCalledWith(
        "order:4:basic",
        "json",
      );
      expect(mockEnv.CACHE_KV.put).toHaveBeenCalledWith(
        "order:4:basic",
        expect.any(String),
        { expirationTtl: 300 },
      );
    });

    it("should use separate cache keys for full and basic on same order", async () => {
      const fullOrder = { id: 5, items: [{ id: 10 }] };
      const basicOrder = { id: 5 };
      mockBaseOrderService.getOrder.mockResolvedValue(fullOrder);
      mockEnv.CACHE_KV.get.mockResolvedValue(null);

      await service.getOrder(5, true);
      await service.getOrder(5, false);

      expect(mockEnv.CACHE_KV.put).toHaveBeenCalledWith(
        "order:5:full",
        expect.any(String),
        { expirationTtl: 300 },
      );
      expect(mockEnv.CACHE_KV.put).toHaveBeenCalledWith(
        "order:5:basic",
        expect.any(String),
        { expirationTtl: 300 },
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Cache Invalidation After Mutations
  // ─────────────────────────────────────────────────────────────────────────
  describe("Cache Invalidation After Mutations", () => {
    it("should delete both full and basic cache keys after updateOrder", async () => {
      const existingOrder = {
        id: 10,
        status: "pending" as OrderStatus,
        restaurantId: "1",
      };
      const updatedOrder = {
        id: 10,
        status: "confirmed" as OrderStatus,
        restaurantId: "1",
      };
      mockEnv.CACHE_KV.get.mockResolvedValue(existingOrder);
      mockBaseOrderService.updateOrderStatus.mockResolvedValue(updatedOrder);

      await service.updateOrder(
        10,
        { status: "confirmed" as OrderStatus },
        100,
      );

      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("order:10:full");
      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("order:10:basic");
    });

    it("should delete both cache keys after updateOrderStatus", async () => {
      const existingOrder = {
        id: 20,
        status: "pending" as OrderStatus,
        restaurantId: "1",
      };
      const updatedOrder = {
        id: 20,
        status: "confirmed" as OrderStatus,
        restaurantId: "1",
      };
      mockEnv.CACHE_KV.get.mockResolvedValue(existingOrder);
      mockBaseOrderService.updateOrderStatus.mockResolvedValue(updatedOrder);

      await service.updateOrderStatus(
        20,
        { status: "confirmed" as OrderStatus },
        100,
        0, // admin role
      );

      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("order:20:full");
      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("order:20:basic");
    });

    it("should delete both cache keys after cancelOrder", async () => {
      const cancelledOrder = { id: 30, status: "cancelled" as OrderStatus };
      mockBaseOrderService.cancelOrder.mockResolvedValue(cancelledOrder);

      await service.cancelOrder(30, "Customer request", 100);

      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("order:30:full");
      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("order:30:basic");
    });

    it("should NOT invalidate cache when cancelOrder returns null (no-op)", async () => {
      mockBaseOrderService.cancelOrder.mockResolvedValue(null);

      await service.cancelOrder(31, "Test", 100);

      expect(mockEnv.CACHE_KV.delete).not.toHaveBeenCalled();
    });

    it("should delete both cache keys after deleteOrder", async () => {
      const pendingOrder = { id: 40, status: "pending" };
      mockEnv.CACHE_KV.get.mockResolvedValue(pendingOrder);
      mockBaseOrderService.cancelOrder.mockResolvedValue(pendingOrder);

      await service.deleteOrder(40, 100);

      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("order:40:full");
      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("order:40:basic");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Cache Invalidation Ordering
  // ─────────────────────────────────────────────────────────────────────────
  describe("Cache Invalidation Ordering", () => {
    it("should invalidate cache AFTER DB write succeeds in updateOrder", async () => {
      const callOrder: string[] = [];
      const existingOrder = {
        id: 50,
        status: "pending" as OrderStatus,
        restaurantId: "1",
      };
      mockEnv.CACHE_KV.get.mockResolvedValue(existingOrder);
      mockBaseOrderService.updateOrderStatus.mockImplementation(async () => {
        callOrder.push("db_write");
        return { id: 50, status: "confirmed" as OrderStatus };
      });
      mockEnv.CACHE_KV.delete.mockImplementation(async () => {
        callOrder.push("cache_invalidate");
      });

      await service.updateOrder(
        50,
        { status: "confirmed" as OrderStatus },
        100,
      );

      // DB write should happen before any cache invalidation
      const dbIndex = callOrder.indexOf("db_write");
      const cacheIndex = callOrder.indexOf("cache_invalidate");
      expect(dbIndex).toBeLessThan(cacheIndex);
    });

    it("should invalidate cache AFTER DB write succeeds in updateOrderStatus", async () => {
      const callOrder: string[] = [];
      const existingOrder = {
        id: 51,
        status: "pending" as OrderStatus,
        restaurantId: "1",
      };
      mockEnv.CACHE_KV.get.mockResolvedValue(existingOrder);
      mockBaseOrderService.updateOrderStatus.mockImplementation(async () => {
        callOrder.push("db_write");
        return {
          id: 51,
          status: "confirmed" as OrderStatus,
          restaurantId: "1",
        };
      });
      mockEnv.CACHE_KV.delete.mockImplementation(async () => {
        callOrder.push("cache_invalidate");
      });

      await service.updateOrderStatus(
        51,
        { status: "confirmed" as OrderStatus },
        100,
        0,
      );

      const dbIndex = callOrder.indexOf("db_write");
      const cacheIndex = callOrder.indexOf("cache_invalidate");
      expect(dbIndex).toBeLessThan(cacheIndex);
    });

    it("should NOT invalidate cache when DB write fails in updateOrderStatus", async () => {
      const existingOrder = {
        id: 52,
        status: "pending" as OrderStatus,
        restaurantId: "1",
      };
      mockEnv.CACHE_KV.get.mockResolvedValue(existingOrder);
      mockBaseOrderService.updateOrderStatus.mockResolvedValue(null);

      // updateOrderStatus throws when base service returns null
      await expect(
        service.updateOrderStatus(
          52,
          { status: "confirmed" as OrderStatus },
          100,
          0,
        ),
      ).rejects.toThrow("Failed to update order status");

      // Cache should not be invalidated because the DB "write" failed
      expect(mockEnv.CACHE_KV.delete).not.toHaveBeenCalled();
    });

    it("should NOT invalidate cache when DB write throws in cancelOrder", async () => {
      mockBaseOrderService.cancelOrder.mockRejectedValue(
        new Error("DB connection error"),
      );

      await expect(service.cancelOrder(53, "reason", 100)).rejects.toThrow(
        "DB connection error",
      );

      expect(mockEnv.CACHE_KV.delete).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Stale Read After Write
  // ─────────────────────────────────────────────────────────────────────────
  describe("Stale Read After Write", () => {
    it("should return fresh data after update (not stale cached data)", async () => {
      const originalOrder = {
        id: 60,
        orderNumber: "ORD-060",
        status: "pending" as OrderStatus,
        restaurantId: "1",
      };
      const updatedOrder = {
        id: 60,
        orderNumber: "ORD-060",
        status: "confirmed" as OrderStatus,
        restaurantId: "1",
      };

      // Step 1: First getOrder populates cache
      mockEnv.CACHE_KV.get.mockResolvedValueOnce(null); // cache miss
      mockBaseOrderService.getOrder.mockResolvedValueOnce(originalOrder);

      const firstRead = await service.getOrder(60);
      expect(firstRead?.status).toBe("pending" as OrderStatus);
      expect(mockEnv.CACHE_KV.put).toHaveBeenCalledWith(
        "order:60:full",
        JSON.stringify(originalOrder),
        { expirationTtl: 300 },
      );

      // Step 2: updateOrderStatus should invalidate cache
      // updateOrderStatus internally calls getOrder (cache hit), then after
      // DB write + cache invalidation, broadcastOrderStatusUpdate receives the
      // order object directly (no extra getOrder call).
      mockEnv.CACHE_KV.get.mockResolvedValueOnce(originalOrder); // updateOrderStatus -> getOrder (cache hit)
      mockBaseOrderService.updateOrderStatus.mockResolvedValueOnce(
        updatedOrder,
      );

      await service.updateOrderStatus(
        60,
        { status: "confirmed" as OrderStatus },
        100,
        0,
      );

      // After invalidation, both keys should be deleted
      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("order:60:full");
      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("order:60:basic");

      // Step 3: Next getOrder should hit DB (cache was invalidated)
      mockEnv.CACHE_KV.get.mockResolvedValueOnce(null); // cache miss after invalidation
      mockBaseOrderService.getOrder.mockResolvedValueOnce(updatedOrder);

      const secondRead = await service.getOrder(60);
      expect(secondRead?.status).toBe("confirmed" as OrderStatus);
      // DB was queried: once for step 1, once for step 3 = 2 times total
      // (broadcastOrderStatusUpdate receives the order directly, no extra DB call)
      expect(mockBaseOrderService.getOrder).toHaveBeenCalledTimes(2);
    });

    it("should return fresh data after cancelOrder", async () => {
      const originalOrder = {
        id: 61,
        status: "pending" as OrderStatus,
        restaurantId: "1",
      };
      const cancelledOrder = {
        id: 61,
        status: "cancelled" as OrderStatus,
        restaurantId: "1",
      };

      // First read — cache miss, DB returns original
      mockEnv.CACHE_KV.get.mockResolvedValueOnce(null);
      mockBaseOrderService.getOrder.mockResolvedValueOnce(originalOrder);
      await service.getOrder(61);

      // Cancel the order
      mockBaseOrderService.cancelOrder.mockResolvedValueOnce(cancelledOrder);
      await service.cancelOrder(61, "Changed mind", 100);

      // Cache should be invalidated
      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("order:61:full");
      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("order:61:basic");

      // Second read — cache miss, DB returns cancelled version
      mockEnv.CACHE_KV.get.mockResolvedValueOnce(null);
      mockBaseOrderService.getOrder.mockResolvedValueOnce(cancelledOrder);

      const finalRead = await service.getOrder(61);
      expect(finalRead?.status).toBe("cancelled" as OrderStatus);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Cache Failure Resilience
  // ─────────────────────────────────────────────────────────────────────────
  describe("Cache Failure Resilience", () => {
    /**
     * NOTE: The current OrdersService implementation wraps getOrder in a
     * single try/catch that re-throws. Cache failures (get/set) are NOT
     * individually caught, so they propagate as errors.
     *
     * These tests document the CURRENT behavior. If cache resilience is
     * desired (fall back to DB when cache is unavailable), the service
     * would need separate try/catch around cache operations.
     */

    it("should propagate error when cacheKV.get throws in getOrder (current behavior)", async () => {
      mockEnv.CACHE_KV.get.mockRejectedValue(
        new Error("KV service unavailable"),
      );

      // Current behavior: error propagates, DB is never queried
      await expect(service.getOrder(70)).rejects.toThrow(
        "KV service unavailable",
      );
      expect(mockBaseOrderService.getOrder).not.toHaveBeenCalled();
    });

    it("should propagate error when cacheKV.set throws in getOrder (current behavior)", async () => {
      mockEnv.CACHE_KV.get.mockResolvedValue(null);
      mockBaseOrderService.getOrder.mockResolvedValue({
        id: 71,
        status: "pending" as OrderStatus,
      });
      mockEnv.CACHE_KV.put.mockRejectedValue(new Error("KV write failed"));

      // Current behavior: put failure propagates even though the order was found
      await expect(service.getOrder(71)).rejects.toThrow("KV write failed");
    });

    it("should propagate error when cacheKV.delete throws during invalidation in cancelOrder (current behavior)", async () => {
      const cancelledOrder = { id: 72, status: "cancelled" as OrderStatus };
      mockBaseOrderService.cancelOrder.mockResolvedValue(cancelledOrder);
      mockEnv.CACHE_KV.delete.mockRejectedValue(new Error("KV delete failed"));

      // Current behavior: delete failure propagates, mutation appears to fail
      await expect(service.cancelOrder(72, "Test", 100)).rejects.toThrow(
        "KV delete failed",
      );
    });

    it("should propagate error when cacheKV.delete throws during invalidation in updateOrder (current behavior)", async () => {
      const existingOrder = {
        id: 73,
        status: "pending" as OrderStatus,
        restaurantId: "1",
      };
      mockEnv.CACHE_KV.get.mockResolvedValue(existingOrder);
      mockBaseOrderService.updateOrderStatus.mockResolvedValue({
        id: 73,
        status: "confirmed" as OrderStatus,
      });
      mockEnv.CACHE_KV.delete.mockRejectedValue(new Error("KV delete failed"));

      await expect(
        service.updateOrder(73, { status: "confirmed" as OrderStatus }, 100),
      ).rejects.toThrow("KV delete failed");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Concurrent Access Patterns
  // ─────────────────────────────────────────────────────────────────────────
  describe("Concurrent Access Patterns", () => {
    /**
     * Race condition scenario:
     *   T1: getOrder(80)  — cache miss, begins DB query
     *   T2: updateOrderStatus(80, CONFIRMED) — writes DB, invalidates cache
     *   T1: DB query returns (stale PENDING), writes to cache
     *
     * Result: Cache now holds stale data (PENDING) even though DB has CONFIRMED.
     *
     * This is a known limitation of the read-through + invalidate pattern
     * without cache versioning or distributed locks.
     */

    it("should demonstrate potential stale cache after concurrent read + write", async () => {
      const staleOrder = {
        id: 80,
        status: "pending" as OrderStatus,
        restaurantId: "1",
      };
      const freshOrder = {
        id: 80,
        status: "confirmed" as OrderStatus,
        restaurantId: "1",
      };

      // Simulate: getOrder starts (cache miss), DB query is slow
      let resolveSlowDbQuery!: (value: any) => void;
      const slowDbQuery = new Promise((resolve) => {
        resolveSlowDbQuery = resolve;
      });

      // First call to getOrder triggers slow DB query
      mockEnv.CACHE_KV.get
        .mockResolvedValueOnce(null) // T1: cache miss for getOrder
        .mockResolvedValueOnce(staleOrder); // T2: updateOrderStatus reads cached order

      mockBaseOrderService.getOrder.mockReturnValueOnce(slowDbQuery);
      mockBaseOrderService.updateOrderStatus.mockResolvedValueOnce(freshOrder);

      // T1: Start reading (will be slow)
      const readPromise = service.getOrder(80);

      // T2: Update completes while T1 is still waiting for DB
      await service.updateOrderStatus(
        80,
        { status: "confirmed" as OrderStatus },
        100,
        0,
      );

      // Verify T2 invalidated cache
      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("order:80:full");
      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("order:80:basic");

      // T1: DB query finally returns stale data
      resolveSlowDbQuery(staleOrder);
      const result = await readPromise;

      // T1 writes stale data to cache AFTER T2's invalidation
      // This is the race condition — cache now holds stale PENDING status
      expect(result?.status).toBe("pending" as OrderStatus);
      // The cache.set from T1 happened after T2's delete — stale data is cached
      expect(mockEnv.CACHE_KV.put).toHaveBeenCalledWith(
        "order:80:full",
        JSON.stringify(staleOrder),
        { expirationTtl: 300 },
      );
    });

    it("should have correct cache state after sequential getOrder then updateOrderStatus", async () => {
      const pendingOrder = {
        id: 81,
        status: "pending" as OrderStatus,
        restaurantId: "1",
      };
      const confirmedOrder = {
        id: 81,
        status: "confirmed" as OrderStatus,
        restaurantId: "1",
      };

      // Sequential: first getOrder, then updateOrderStatus
      // 1. getOrder — cache miss, populates cache
      mockEnv.CACHE_KV.get.mockResolvedValueOnce(null);
      mockBaseOrderService.getOrder.mockResolvedValueOnce(pendingOrder);
      await service.getOrder(81);

      expect(mockEnv.CACHE_KV.put).toHaveBeenCalledWith(
        "order:81:full",
        JSON.stringify(pendingOrder),
        { expirationTtl: 300 },
      );

      // 2. updateOrderStatus — reads from cache, writes to DB, invalidates
      mockEnv.CACHE_KV.get.mockResolvedValueOnce(pendingOrder);
      mockBaseOrderService.updateOrderStatus.mockResolvedValueOnce(
        confirmedOrder,
      );
      await service.updateOrderStatus(
        81,
        { status: "confirmed" as OrderStatus },
        100,
        0,
      );

      // After sequential operations, cache should be invalidated
      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("order:81:full");
      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("order:81:basic");
    });

    it("should handle two concurrent reads (thundering herd) without error", async () => {
      const order = { id: 82, status: "pending" as OrderStatus };

      // Both reads see cache miss
      mockEnv.CACHE_KV.get.mockResolvedValue(null);
      mockBaseOrderService.getOrder.mockResolvedValue(order);

      // Fire two concurrent reads
      const [result1, result2] = await Promise.all([
        service.getOrder(82),
        service.getOrder(82),
      ]);

      expect(result1).toEqual(order);
      expect(result2).toEqual(order);

      // Both will call DB and both will write to cache (harmless duplicate writes)
      expect(mockBaseOrderService.getOrder).toHaveBeenCalledTimes(2);
      expect(mockEnv.CACHE_KV.put).toHaveBeenCalledTimes(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Analytics Cache
  // ─────────────────────────────────────────────────────────────────────────
  describe("Analytics Cache", () => {
    it("should use filter-based cache key for analytics", async () => {
      mockEnv.CACHE_KV.get.mockResolvedValue(null);
      mockBaseOrderService.getDailyOrderStats.mockResolvedValue({
        totalOrders: 50,
        totalRevenue: 250000,
        avgOrderValue: 5000,
      });

      const filters = { restaurantId: "1" };
      await service.getOrderAnalytics(filters);

      const expectedKey = `analytics:${JSON.stringify(filters)}`;
      expect(mockEnv.CACHE_KV.get).toHaveBeenCalledWith(expectedKey, "json");
    });

    it("should return cached analytics without querying DB", async () => {
      const cachedAnalytics = {
        summary: {
          totalOrders: 100,
          totalRevenue: 500000,
          averageOrderValue: 5000,
          averagePreparationTime: 0,
          orderCompletionRate: 0.95,
          customerRetentionRate: 0.75,
        },
        byStatus: [],
        byPaymentStatus: [],
        byOrderType: [],
        byTime: { hourly: [], daily: [], weekly: [], monthly: [] },
        topItems: [],
        customerAnalytics: {
          newCustomers: 0,
          returningCustomers: 0,
          averageOrdersPerCustomer: 0,
          customerLifetimeValue: 0,
        },
        performanceMetrics: {
          averageOrderProcessingTime: 0,
          peakHours: [],
          busyDays: [],
          orderAccuracy: 0.98,
          cancellationRate: 0.05,
        },
      };
      mockEnv.CACHE_KV.get.mockResolvedValue(cachedAnalytics);

      const result = await service.getOrderAnalytics({ restaurantId: "1" });

      expect(result).toEqual(cachedAnalytics);
      expect(mockBaseOrderService.getDailyOrderStats).not.toHaveBeenCalled();
    });

    it("should use different cache keys for different filter combinations", async () => {
      mockEnv.CACHE_KV.get.mockResolvedValue(null);
      mockBaseOrderService.getDailyOrderStats.mockResolvedValue({
        totalOrders: 10,
        totalRevenue: 50000,
        avgOrderValue: 5000,
      });

      const filters1 = { restaurantId: "1" };
      const filters2 = { restaurantId: "2" };
      // OrderQueryFilters.status uses the DB string-union, not the
      // shared-types numeric enum (see apps/api/src/features/orders/types/index.ts).
      // The type annotation lets TypeScript narrow the literal via contextual
      // typing (avoids the `readonly`/mutable mismatch from a bare `as const`).
      const filters3: OrderQueryFilters = {
        restaurantId: "1",
        status: ["pending"],
      };

      await service.getOrderAnalytics(filters1);
      await service.getOrderAnalytics(filters2);
      await service.getOrderAnalytics(filters3);

      const key1 = `analytics:${JSON.stringify(filters1)}`;
      const key2 = `analytics:${JSON.stringify(filters2)}`;
      const key3 = `analytics:${JSON.stringify(filters3)}`;

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(mockEnv.CACHE_KV.get).toHaveBeenCalledWith(key1, "json");
      expect(mockEnv.CACHE_KV.get).toHaveBeenCalledWith(key2, "json");
      expect(mockEnv.CACHE_KV.get).toHaveBeenCalledWith(key3, "json");
    });

    it("should cache analytics with 15-minute TTL (900 seconds)", async () => {
      mockEnv.CACHE_KV.get.mockResolvedValue(null);
      mockBaseOrderService.getDailyOrderStats.mockResolvedValue({
        totalOrders: 10,
        totalRevenue: 50000,
        avgOrderValue: 5000,
      });

      const filters = { restaurantId: "1" };
      await service.getOrderAnalytics(filters);

      expect(mockEnv.CACHE_KV.put).toHaveBeenCalledWith(
        `analytics:${JSON.stringify(filters)}`,
        expect.any(String),
        { expirationTtl: 900 },
      );
    });

    it("should NOT invalidate analytics cache when individual order is updated", async () => {
      const existingOrder = {
        id: 90,
        status: "pending" as OrderStatus,
        restaurantId: "1",
      };
      const updatedOrder = {
        id: 90,
        status: "confirmed" as OrderStatus,
        restaurantId: "1",
      };
      mockEnv.CACHE_KV.get.mockResolvedValue(existingOrder);
      mockBaseOrderService.updateOrderStatus.mockResolvedValue(updatedOrder);

      await service.updateOrderStatus(
        90,
        { status: "confirmed" as OrderStatus },
        100,
        0,
      );

      // Only order-specific keys should be deleted, not analytics keys
      const deleteArgs = mockEnv.CACHE_KV.delete.mock.calls.map(
        (call: any[]) => call[0],
      );
      expect(deleteArgs).toContain("order:90:full");
      expect(deleteArgs).toContain("order:90:basic");
      // No analytics keys should be in the delete calls
      const analyticsDeletes = deleteArgs.filter((key: string) =>
        key.startsWith("analytics:"),
      );
      expect(analyticsDeletes).toHaveLength(0);
    });
  });
});
