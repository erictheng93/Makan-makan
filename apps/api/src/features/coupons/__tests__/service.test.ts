/**
 * CouponsService Unit Tests
 *
 * Comprehensive test suite for the CouponsService class
 * Tests business logic methods that don't rely on database inheritance
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  afterEach,
  beforeAll,
} from "vitest";

// Mock the database module FIRST before importing anything else
vi.mock("@makanmasak/database", () => {
  // Create a base class that CouponsService can extend
  // Real CouponService extends BaseCouponService which requires (d1, env, mockDb?)
  class MockCouponService {
    protected db: any;
    protected env: any;
    constructor(db: any, env: any) {
      this.db = db;
      this.env = env;
    }
    validateCoupon = vi.fn();
    getCoupons = vi.fn();
    createCoupon = vi.fn();
    getCouponStats = vi.fn();
    updateCoupon = vi.fn();
    deactivateCoupon = vi.fn();
    deleteCoupon = vi.fn();
    getAvailableCoupons = vi.fn();
  }
  return {
    CouponService: MockCouponService,
  };
});

// Import after mocking
import { CouponsService } from "../services/CouponsService";

type CouponsServiceTestAccess = {
  createCoupon: ReturnType<typeof vi.fn>;
  getAvailableCoupons: ReturnType<typeof vi.fn>;
  updateCoupon: ReturnType<typeof vi.fn>;
  deactivateCoupon: ReturnType<typeof vi.fn>;
  deleteCoupon: ReturnType<typeof vi.fn>;
  getCoupons: ReturnType<typeof vi.fn>;
  getCouponStats: ReturnType<typeof vi.fn>;
};

const asCouponsServiceTest = (
  target: CouponsService,
): CouponsServiceTestAccess => target as unknown as CouponsServiceTestAccess;

// Mock environment
const mockEnv = {
  JWT_SECRET: "test-secret",
  CUSTOMER_APP_URL: "https://test.makanmasak.com",
};

/**
 * Helper to create a properly initialized service instance
 */
const createTestService = (mockDb: any) => {
  const service = new CouponsService(mockDb, mockEnv);
  return service;
};

describe("CouponsService", () => {
  let mockDb: any;
  let service: CouponsService;

  beforeAll(() => {
    // Ensure mocks are set up
    vi.resetModules();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    };
    // Create service instance once per test
    service = createTestService(mockDb);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =============================================
  // createCouponWithValidation Tests - Direct Logic Tests
  // =============================================
  describe("createCouponWithValidation - Date Validation", () => {
    it("should throw error when validFrom is after validTo", async () => {
      const invalidData = {
        code: "TESTCODE",
        name: "Test",
        discountType: "percentage" as const,
        discountValue: 10,
        validFrom: "2025-12-31T23:59:59Z",
        validTo: "2025-01-01T00:00:00Z",
      };

      await expect(
        service.createCouponWithValidation(invalidData),
      ).rejects.toThrow("有效期結束時間必須晚於開始時間");
    });

    it("should throw error when validFrom equals validTo", async () => {
      const invalidData = {
        code: "TESTCODE",
        name: "Test",
        discountType: "percentage" as const,
        discountValue: 10,
        validFrom: "2025-06-15T00:00:00Z",
        validTo: "2025-06-15T00:00:00Z",
      };

      await expect(
        service.createCouponWithValidation(invalidData),
      ).rejects.toThrow("有效期結束時間必須晚於開始時間");
    });

    it("should throw error when percentage discount exceeds 100%", async () => {
      const invalidData = {
        code: "TESTCODE",
        name: "Test",
        discountType: "percentage" as const,
        discountValue: 150,
        validFrom: "2025-01-01T00:00:00Z",
        validTo: "2025-12-31T23:59:59Z",
      };

      await expect(
        service.createCouponWithValidation(invalidData),
      ).rejects.toThrow("百分比折扣不能超過 100%");
    });

    it("should not throw for valid percentage discount at 100%", async () => {
      // Mock the base createCoupon method
      asCouponsServiceTest(service).createCoupon = vi
        .fn()
        .mockResolvedValue({ id: 1 });

      const validData = {
        code: "TESTCODE",
        name: "Test",
        discountType: "percentage" as const,
        discountValue: 100,
        validFrom: "2025-01-01T00:00:00Z",
        validTo: "2025-12-31T23:59:59Z",
      };

      await expect(
        service.createCouponWithValidation(validData),
      ).resolves.toBeDefined();
    });

    it("should allow fixed discount of any value", async () => {
      asCouponsServiceTest(service).createCoupon = vi
        .fn()
        .mockResolvedValue({ id: 1 });

      const data = {
        code: "TESTCODE",
        name: "Test",
        discountType: "fixed" as const,
        discountValue: 500,
        validFrom: "2025-01-01T00:00:00Z",
        validTo: "2025-12-31T23:59:59Z",
      };

      await expect(
        service.createCouponWithValidation(data),
      ).resolves.toBeDefined();
    });
  });

  // =============================================
  // calculatePotentialSavings Tests - Pure Logic
  // =============================================
  describe("calculatePotentialSavings", () => {
    it("should calculate savings for percentage coupons", async () => {
      const coupons = [
        { id: 1, discountType: "percentage", discountValue: 10 },
        { id: 2, discountType: "percentage", discountValue: 20 },
      ];

      const result = await service.calculatePotentialSavings(coupons, 100);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ couponId: 1, saving: 10 });
      expect(result[1]).toEqual({ couponId: 2, saving: 20 });
    });

    it("should calculate savings for fixed discount coupons", async () => {
      const coupons = [
        { id: 1, discountType: "fixed", discountValue: 15 },
        { id: 2, discountType: "fixed", discountValue: 25 },
      ];

      const result = await service.calculatePotentialSavings(coupons, 100);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ couponId: 1, saving: 15 });
      expect(result[1]).toEqual({ couponId: 2, saving: 25 });
    });

    it("should apply maxDiscountAmount cap for percentage", async () => {
      const coupons = [
        {
          id: 1,
          discountType: "percentage",
          discountValue: 50,
          maxDiscountAmount: 30,
        },
      ];

      const result = await service.calculatePotentialSavings(coupons, 100);

      expect(result[0].saving).toBe(30); // Capped at maxDiscountAmount
    });

    it("should prefer cents fields for fixed savings and caps", async () => {
      const coupons = [
        {
          id: 1,
          discountType: "fixed",
          discountValue: 99,
          discountValueCents: 1250,
        },
        {
          id: 2,
          discountType: "percentage",
          discountValue: 50,
          maxDiscountAmount: 99,
          maxDiscountAmountCents: 750,
        },
      ];

      const result = await service.calculatePotentialSavings(coupons, 100);

      expect(result[0].saving).toBe(12.5);
      expect(result[1].saving).toBe(7.5);
    });

    it("should not exceed order amount for fixed discount", async () => {
      const coupons = [{ id: 1, discountType: "fixed", discountValue: 150 }];

      const result = await service.calculatePotentialSavings(coupons, 100);

      expect(result[0].saving).toBe(100); // Capped at order amount
    });

    it("should preserve percentage savings to cents precision", async () => {
      const coupons = [
        { id: 1, discountType: "percentage", discountValue: 15 },
      ];

      const result = await service.calculatePotentialSavings(coupons, 33);

      expect(result[0].saving).toBe(4.95);
    });

    it("should handle empty coupons array", async () => {
      const result = await service.calculatePotentialSavings([], 100);

      expect(result).toEqual([]);
    });

    it("should handle mixed coupon types", async () => {
      const coupons = [
        { id: 1, discountType: "percentage", discountValue: 10 },
        { id: 2, discountType: "fixed", discountValue: 15 },
        {
          id: 3,
          discountType: "percentage",
          discountValue: 20,
          maxDiscountAmount: 10,
        },
      ];

      const result = await service.calculatePotentialSavings(coupons, 100);

      expect(result[0].saving).toBe(10); // 10% of 100
      expect(result[1].saving).toBe(15); // Fixed 15
      expect(result[2].saving).toBe(10); // 20% = 20, capped at 10
    });

    it("should handle zero order amount", async () => {
      const coupons = [
        { id: 1, discountType: "percentage", discountValue: 10 },
      ];

      const result = await service.calculatePotentialSavings(coupons, 0);

      expect(result[0].saving).toBe(0);
    });

    it("should handle very large order amounts with cap", async () => {
      const coupons = [
        {
          id: 1,
          discountType: "percentage",
          discountValue: 10,
          maxDiscountAmount: 1000,
        },
      ];

      const result = await service.calculatePotentialSavings(coupons, 100000);

      expect(result[0].saving).toBe(1000); // Capped at maxDiscountAmount
    });
  });

  // =============================================
  // getCouponUsageTrends Tests - Pure Logic
  // =============================================
  describe("getCouponUsageTrends", () => {
    it("should return trend structure with default values", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      const result = await service.getCouponUsageTrends();

      expect(result).toEqual({
        totalCoupons: 0,
        activeCoupons: 0,
        totalUsage: 0,
        totalSavings: 0,
        usageByPeriod: [],
      });
    });

    it("should accept optional parameters without error", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      const result = await service.getCouponUsageTrends(
        "1",
        "2025-01-01",
        "2025-12-31",
      );

      expect(result).toHaveProperty("totalCoupons");
      expect(result).toHaveProperty("activeCoupons");
      expect(result).toHaveProperty("usageByPeriod");
    });
  });

  // =============================================
  // getAvailableCouponsForUser Tests
  // =============================================
  describe("getAvailableCouponsForUser", () => {
    it("should return all coupons when no order amount provided", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      const availableCoupons = [
        { id: 1, code: "COUPON1", minOrderAmount: 50 },
        { id: 2, code: "COUPON2", minOrderAmount: 100 },
      ];
      asCouponsServiceTest(service).getAvailableCoupons = vi
        .fn()
        .mockResolvedValue(availableCoupons);

      const result = await service.getAvailableCouponsForUser("1", 1);

      expect(result).toHaveLength(2);
    });

    it("should filter coupons by minimum order amount", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      const availableCoupons = [
        { id: 1, code: "COUPON1", minOrderAmount: 50 },
        { id: 2, code: "COUPON2", minOrderAmount: 100 },
        { id: 3, code: "COUPON3", minOrderAmount: 200 },
      ];
      asCouponsServiceTest(service).getAvailableCoupons = vi
        .fn()
        .mockResolvedValue(availableCoupons);

      const result = await service.getAvailableCouponsForUser("1", 1, 120);

      expect(result).toHaveLength(2);
      expect(result.map((c: any) => c.id)).toEqual([1, 2]);
    });

    it("should prefer minOrderAmountCents when filtering coupons", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      const availableCoupons = [
        {
          id: 1,
          code: "COUPON1",
          discountType: "fixed",
          discountValue: 99,
          discountValueCents: 500,
          minOrderAmount: 999,
          minOrderAmountCents: 10000,
        },
      ];
      asCouponsServiceTest(service).getAvailableCoupons = vi
        .fn()
        .mockResolvedValue(availableCoupons);

      const result = await service.getAvailableCouponsForUser("1", 1, 120);

      expect(result).toHaveLength(1);
      expect(result[0].discountValue).toBe(5);
      expect(result[0].minOrderAmount).toBe(100);
    });

    it("should include coupons without minOrderAmount", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      const availableCoupons = [
        { id: 1, code: "COUPON1", minOrderAmount: null },
        { id: 2, code: "COUPON2" }, // undefined minOrderAmount
        { id: 3, code: "COUPON3", minOrderAmount: 100 },
      ];
      asCouponsServiceTest(service).getAvailableCoupons = vi
        .fn()
        .mockResolvedValue(availableCoupons);

      const result = await service.getAvailableCouponsForUser("1", 1, 50);

      expect(result).toHaveLength(2); // COUPON1 and COUPON2
    });

    it("should return empty array when no coupons meet criteria", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      const availableCoupons = [
        { id: 1, code: "COUPON1", minOrderAmount: 500 },
      ];
      asCouponsServiceTest(service).getAvailableCoupons = vi
        .fn()
        .mockResolvedValue(availableCoupons);

      const result = await service.getAvailableCouponsForUser("1", 1, 100);

      expect(result).toHaveLength(0);
    });
  });

  // =============================================
  // bulkActivateCoupons Tests
  // =============================================
  describe("bulkActivateCoupons", () => {
    it("should activate multiple coupons successfully", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      asCouponsServiceTest(service).updateCoupon = vi
        .fn()
        .mockResolvedValue({ id: 1, isActive: true });

      const result = await service.bulkActivateCoupons([1, 2, 3]);

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
      expect(asCouponsServiceTest(service).updateCoupon).toHaveBeenCalledTimes(
        3,
      );
    });

    it("should handle partial failures", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      asCouponsServiceTest(service).updateCoupon = vi
        .fn()
        .mockResolvedValueOnce({ id: 1 })
        .mockRejectedValueOnce(new Error("Update failed"))
        .mockResolvedValueOnce({ id: 3 });

      vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await service.bulkActivateCoupons([1, 2, 3]);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(1);
    });

    it("should handle empty array", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      const result = await service.bulkActivateCoupons([]);

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  // =============================================
  // bulkDeactivateCoupons Tests
  // =============================================
  describe("bulkDeactivateCoupons", () => {
    it("should deactivate multiple coupons successfully", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      asCouponsServiceTest(service).deactivateCoupon = vi
        .fn()
        .mockResolvedValue({ id: 1, isActive: false });

      const result = await service.bulkDeactivateCoupons([1, 2]);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });

    it("should handle deactivation failures", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      asCouponsServiceTest(service).deactivateCoupon = vi
        .fn()
        .mockResolvedValueOnce({ id: 1 })
        .mockRejectedValueOnce(new Error("Deactivation failed"));

      vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await service.bulkDeactivateCoupons([1, 2]);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  // =============================================
  // bulkDeleteCoupons Tests
  // =============================================
  describe("bulkDeleteCoupons", () => {
    it("should delete multiple coupons successfully", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      asCouponsServiceTest(service).deleteCoupon = vi
        .fn()
        .mockResolvedValue(undefined);

      const result = await service.bulkDeleteCoupons([1, 2, 3]);

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
    });

    it("should handle deletion failures", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      asCouponsServiceTest(service).deleteCoupon = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Deletion failed"))
        .mockRejectedValueOnce(new Error("Deletion failed"));

      vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await service.bulkDeleteCoupons([1, 2, 3]);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(2);
    });
  });

  // =============================================
  // getCouponsWithEnhancedFilters Tests
  // =============================================
  describe("getCouponsWithEnhancedFilters", () => {
    it("should calculate pages correctly", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      asCouponsServiceTest(service).getCoupons = vi.fn().mockResolvedValue({
        coupons: [],
        total: 50,
        page: 1,
        limit: 20,
      });

      const result = await service.getCouponsWithEnhancedFilters({}, 1, 20);

      expect(result.pages).toBe(3); // ceil(50/20) = 3
    });

    it("should handle exact division", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      asCouponsServiceTest(service).getCoupons = vi.fn().mockResolvedValue({
        coupons: [],
        total: 100,
        page: 1,
        limit: 20,
      });

      const result = await service.getCouponsWithEnhancedFilters({}, 1, 20);

      expect(result.pages).toBe(5);
    });

    it("should handle empty results", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      asCouponsServiceTest(service).getCoupons = vi.fn().mockResolvedValue({
        coupons: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const result = await service.getCouponsWithEnhancedFilters();

      expect(result.pages).toBe(0);
    });
  });

  // =============================================
  // getComprehensiveCouponStats Tests
  // =============================================
  describe("getComprehensiveCouponStats", () => {
    it("should return base stats with additional fields", async () => {
      const service = new CouponsService(mockDb, mockEnv);
      const baseStats = {
        totalUsed: 15,
        totalDiscount: 150.5,
        avgDiscount: 10.03,
        lastUsed: "2025-01-15T10:30:00Z",
      };
      asCouponsServiceTest(service).getCouponStats = vi
        .fn()
        .mockResolvedValue(baseStats);

      const result = await service.getComprehensiveCouponStats(1);

      expect(result.totalUsed).toBe(15);
      expect(result.usageByDay).toEqual([]);
      expect(result.topUsers).toEqual([]);
      expect(result.averageOrderValue).toBe(0);
    });
  });
});
