/**
 * Coupons Feature Tests
 *
 * Comprehensive test suite for the coupons feature module
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import couponsRoutes from "../routes";
import { CouponsService } from "../services/CouponsService";

// Mock CouponsService
const mockCouponsService = {
  validateCouponWithBusinessRules: vi.fn(),
  getAvailableCoupons: vi.fn(),
  createCouponWithValidation: vi.fn(),
  getCouponsWithEnhancedFilters: vi.fn(),
  getCoupon: vi.fn(),
  updateCoupon: vi.fn(),
  deactivateCoupon: vi.fn(),
  deleteCoupon: vi.fn(),
  getComprehensiveCouponStats: vi.fn(),
  bulkActivateCoupons: vi.fn(),
  bulkDeactivateCoupons: vi.fn(),
  bulkDeleteCoupons: vi.fn(),
  useCoupon: vi.fn(),
  getCouponUsageTrends: vi.fn(),
};

// Mock the service class
vi.mock("../services/CouponsService", () => ({
  CouponsService: vi.fn(function () {
    return mockCouponsService;
  }),
}));

// Mock middleware
vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn((c: any, next: any) => {
    c.set("user", { id: 1, role: 1, restaurantId: 1 });
    return next();
  }),
  requireRole: vi.fn(() => (c: any, next: any) => next()),
}));

vi.mock("../../../middleware/validation", () => ({
  validateBody: vi.fn(() => (c: any, next: any) => {
    c.set("validatedBody", (c as any).testBody);
    return next();
  }),
  validateQuery: vi.fn(() => (c: any, next: any) => {
    c.set("validatedQuery", (c as any).testQuery);
    return next();
  }),
  validateParams: vi.fn(() => (c: any, next: any) => {
    c.set("validatedParams", (c as any).testParams);
    return next();
  }),
  commonSchemas: {
    idParam: {},
  },
}));

describe("Coupons Feature Module", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route("/coupons", couponsRoutes);
  });

  describe("POST /coupons/validate", () => {
    it("should validate coupon successfully with business rules", async () => {
      const validationResult = {
        valid: true,
        coupon: { id: 1, code: "VALID10" },
        discountAmount: 10,
        finalAmount: 90,
      };

      mockCouponsService.validateCouponWithBusinessRules.mockResolvedValue(
        validationResult,
      );

      const testApp = new Hono();
      testApp.use("*", async (c, next) => {
        c.env = { DB: {} };
        (c as any).testBody = {
          code: "VALID10",
          restaurantId: "1",
          orderAmount: 100,
        };
        return next();
      });
      testApp.route("/", couponsRoutes);

      const res = await testApp.request("/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "VALID10",
          restaurantId: "1",
          orderAmount: 100,
        }),
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual(validationResult);
      expect(
        mockCouponsService.validateCouponWithBusinessRules,
      ).toHaveBeenCalledWith("VALID10", "1", 100, undefined, undefined);
    });

    it("should handle validation errors", async () => {
      const validationResult = {
        valid: false,
        error: "優惠券代碼不存在或已失效",
      };

      mockCouponsService.validateCouponWithBusinessRules.mockResolvedValue(
        validationResult,
      );

      const testApp = new Hono();
      testApp.use("*", async (c, next) => {
        c.env = { DB: {} };
        (c as any).testBody = {
          code: "INVALID",
          restaurantId: "1",
          orderAmount: 100,
        };
        return next();
      });
      testApp.route("/", couponsRoutes);

      const res = await testApp.request("/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "INVALID",
          restaurantId: "1",
          orderAmount: 100,
        }),
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.valid).toBe(false);
      expect(data.data.error).toContain("不存在");
    });
  });

  describe("GET /coupons/available/:restaurantId", () => {
    it("should return available coupons for restaurant", async () => {
      const availableCoupons = [
        { id: 1, code: "WELCOME10", name: "Welcome Discount" },
        { id: 2, code: "SAVE20", name: "Save 20" },
      ];

      mockCouponsService.getAvailableCoupons.mockResolvedValue(
        availableCoupons,
      );

      const testApp = new Hono();
      testApp.use("*", async (c, next) => {
        c.env = { DB: {} };
        (c as any).testParams = { restaurantId: "1" };
        return next();
      });
      testApp.route("/", couponsRoutes);

      const res = await testApp.request("/available/1");

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual(availableCoupons);
      expect(mockCouponsService.getAvailableCoupons).toHaveBeenCalledWith("1");
    });
  });

  describe("POST /coupons", () => {
    it("should create coupon with validation", async () => {
      const couponData = {
        code: "NEWCOUPON",
        name: "New Coupon",
        discountType: "percentage",
        discountValue: 15,
        validFrom: "2025-01-01T00:00:00Z",
        validTo: "2025-12-31T23:59:59Z",
      };

      const createdCoupon = { id: 1, ...couponData };

      mockCouponsService.createCouponWithValidation.mockResolvedValue(
        createdCoupon,
      );

      const testApp = new Hono();
      testApp.use("*", (c, next) => {
        (c as any).testBody = couponData;
        c.set("user", {
          id: 1,
          username: "testuser",
          role: 1,
          restaurantId: 1,
        });
        c.env = { DB: {} };
        return next();
      });
      testApp.route("/", couponsRoutes);

      const res = await testApp.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(couponData),
      });

      expect(res.status).toBe(201);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual(createdCoupon);
    });
  });

  describe("GET /coupons", () => {
    it("should return paginated coupons with enhanced filters", async () => {
      const couponsResult = {
        coupons: [
          { id: 1, code: "COUPON1", name: "Coupon 1" },
          { id: 2, code: "COUPON2", name: "Coupon 2" },
        ],
        total: 2,
        page: 1,
        limit: 20,
        pages: 1,
      };

      mockCouponsService.getCouponsWithEnhancedFilters.mockResolvedValue(
        couponsResult,
      );

      const testApp = new Hono();
      testApp.use("*", (c, next) => {
        (c as any).testQuery = { page: 1, limit: 20 };
        c.set("user", {
          id: 1,
          username: "testuser",
          role: 1,
          restaurantId: 1,
        });
        c.env = { DB: {} };
        return next();
      });
      testApp.route("/", couponsRoutes);

      const res = await testApp.request("/");

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual(couponsResult.coupons);
      expect(data.pagination).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        pages: 1,
      });
    });
  });

  describe("POST /coupons/bulk", () => {
    it("should perform bulk activation", async () => {
      const bulkResult = { success: 2, failed: 0 };

      mockCouponsService.getCoupon
        .mockResolvedValueOnce({ id: 1, restaurantId: 1 })
        .mockResolvedValueOnce({ id: 2, restaurantId: 1 });
      mockCouponsService.bulkActivateCoupons.mockResolvedValue(bulkResult);

      const testApp = new Hono();
      testApp.use("*", (c, next) => {
        (c as any).testBody = { couponIds: [1, 2], action: "activate" };
        c.set("user", {
          id: 1,
          username: "testuser",
          role: 1,
          restaurantId: 1,
        });
        c.env = { DB: {} };
        return next();
      });
      testApp.route("/", couponsRoutes);

      const res = await testApp.request("/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponIds: [1, 2], action: "activate" }),
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual(bulkResult);
    });

    it("should deny access to coupons from different restaurant", async () => {
      mockCouponsService.getCoupon.mockResolvedValueOnce({
        id: 1,
        restaurantId: 2,
      });

      const testApp = new Hono();
      testApp.use("*", (c, next) => {
        (c as any).testBody = { couponIds: [1], action: "activate" };
        c.set("user", {
          id: 1,
          username: "testuser",
          role: 1,
          restaurantId: 1,
        });
        c.env = { DB: {} };
        return next();
      });
      testApp.route("/", couponsRoutes);

      const res = await testApp.request("/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponIds: [1], action: "activate" }),
      });

      expect(res.status).toBe(403);
      const data: any = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Access denied");
    });
  });

  describe("GET /coupons/:id/stats", () => {
    it("should return comprehensive coupon statistics", async () => {
      const coupon = {
        id: 1,
        code: "TESTCOUPON",
        name: "Test Coupon",
        discountType: "percentage",
        discountValue: 10,
        restaurantId: 1,
      };

      const stats = {
        totalUsed: 15,
        totalDiscount: 150.5,
        avgDiscount: 10.03,
        lastUsed: "2025-01-15T10:30:00Z",
        usageByDay: [],
        topUsers: [],
        averageOrderValue: 0,
      };

      mockCouponsService.getCoupon.mockResolvedValue(coupon);
      mockCouponsService.getComprehensiveCouponStats.mockResolvedValue(stats);

      const testApp = new Hono();
      testApp.use("*", (c, next) => {
        (c as any).testParams = { id: 1 };
        c.set("user", {
          id: 1,
          username: "testuser",
          role: 1,
          restaurantId: 1,
        });
        c.env = { DB: {} };
        return next();
      });
      testApp.route("/", couponsRoutes);

      const res = await testApp.request("/1/stats");

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.coupon.id).toBe(1);
      expect(data.data.stats).toEqual(stats);
    });
  });

  describe("GET /coupons/analytics/trends", () => {
    it("should return coupon usage trends", async () => {
      const trends = {
        totalCoupons: 5,
        activeCoupons: 3,
        totalUsage: 25,
        totalSavings: 500.0,
        usageByPeriod: [],
      };

      mockCouponsService.getCouponUsageTrends.mockResolvedValue(trends);

      const testApp = new Hono();
      testApp.use("*", (c, next) => {
        c.set("user", {
          id: 1,
          username: "testuser",
          role: 1,
          restaurantId: 1,
        });
        c.env = { DB: {} };
        return next();
      });
      testApp.route("/", couponsRoutes);

      const res = await testApp.request("/analytics/trends");

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual(trends);
    });
  });

  describe("Error Handling", () => {
    it("should handle service errors gracefully", async () => {
      mockCouponsService.validateCouponWithBusinessRules.mockRejectedValue(
        new Error("Database connection failed"),
      );

      const testApp = new Hono();
      testApp.use("*", async (c, next) => {
        c.env = { DB: {} };
        (c as any).testBody = {
          code: "TEST",
          restaurantId: "1",
          orderAmount: 100,
        };
        return next();
      });
      testApp.route("/", couponsRoutes);

      const res = await testApp.request("/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "TEST",
          restaurantId: "1",
          orderAmount: 100,
        }),
      });

      expect(res.status).toBe(500);
      const data: any = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Database connection failed");
    });
  });
});
