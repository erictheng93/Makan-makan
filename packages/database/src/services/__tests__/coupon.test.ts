import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { CouponService } from "../coupon";
import type {
  CouponValidationResult,
  CreateCouponData,
  UseCouponData,
} from "../coupon";

// Mock database
const mockDb = {
  query: {
    coupons: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} as any;

describe("CouponService", () => {
  let couponService: CouponService;

  beforeEach(() => {
    vi.clearAllMocks();
    couponService = new CouponService(mockDb, { JWT_SECRET: "test-secret" });
  });

  describe("validateCoupon", () => {
    it("should return invalid result when coupon not found", async () => {
      mockDb.query.coupons.findFirst.mockResolvedValue(null);

      const result = await couponService.validateCoupon("INVALID", "1", 100);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("優惠券代碼不存在");
    });

    it("should return invalid result when coupon is expired", async () => {
      const expiredCoupon = {
        id: 1,
        code: "EXPIRED",
        validFrom: "2023-01-01T00:00:00Z",
        validTo: "2023-01-31T23:59:59Z",
        isActive: true,
        isVisible: true,
        discountType: "percentage",
        discountValue: 10,
        minOrderAmount: 0,
        usageLimit: null,
        usedCount: 0,
        usageLimitPerUser: null,
      };

      mockDb.query.coupons.findFirst.mockResolvedValue(expiredCoupon);

      const result = await couponService.validateCoupon("EXPIRED", "1", 100);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("已過期");
    });

    it("should return invalid result when usage limit exceeded", async () => {
      const exhaustedCoupon = {
        id: 1,
        code: "EXHAUSTED",
        validFrom: "2026-01-01T00:00:00Z",
        validTo: "2026-12-31T23:59:59Z",
        isActive: true,
        isVisible: true,
        discountType: "fixed",
        discountValue: 10,
        minOrderAmount: 0,
        usageLimit: 100,
        usedCount: 100,
        usageLimitPerUser: null,
      };

      mockDb.query.coupons.findFirst.mockResolvedValue(exhaustedCoupon);

      const result = await couponService.validateCoupon("EXHAUSTED", "1", 100);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("使用次數已達上限");
    });

    it("should return invalid result when order amount below minimum", async () => {
      const minAmountCoupon = {
        id: 1,
        code: "MINORDER",
        validFrom: "2026-01-01T00:00:00Z",
        validTo: "2026-12-31T23:59:59Z",
        isActive: true,
        isVisible: true,
        discountType: "percentage",
        discountValue: 10,
        minOrderAmount: 200,
        usageLimit: null,
        usedCount: 0,
        usageLimitPerUser: null,
      };

      mockDb.query.coupons.findFirst.mockResolvedValue(minAmountCoupon);

      const result = await couponService.validateCoupon("MINORDER", "1", 100);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("訂單金額需滿 $200");
    });

    it("should calculate percentage discount correctly", async () => {
      const percentageCoupon = {
        id: 1,
        code: "PERCENT10",
        validFrom: "2026-01-01T00:00:00Z",
        validTo: "2026-12-31T23:59:59Z",
        isActive: true,
        isVisible: true,
        discountType: "percentage",
        discountValue: 10,
        minOrderAmount: 0,
        usageLimit: null,
        usedCount: 0,
        usageLimitPerUser: null,
        maxDiscountAmount: 20,
      };

      mockDb.query.coupons.findFirst.mockResolvedValue(percentageCoupon);

      const result = await couponService.validateCoupon("PERCENT10", "1", 100);

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(10); // 10% of 100
      expect(result.finalAmount).toBe(90);
    });

    it("should apply maximum discount limit for percentage coupons", async () => {
      const percentageCoupon = {
        id: 1,
        code: "PERCENT10",
        validFrom: "2026-01-01T00:00:00Z",
        validTo: "2026-12-31T23:59:59Z",
        isActive: true,
        isVisible: true,
        discountType: "percentage",
        discountValue: 20,
        minOrderAmount: 0,
        usageLimit: null,
        usedCount: 0,
        usageLimitPerUser: null,
        maxDiscountAmount: 15,
      };

      mockDb.query.coupons.findFirst.mockResolvedValue(percentageCoupon);

      const result = await couponService.validateCoupon("PERCENT10", "1", 100);

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(15); // capped at maxDiscountAmount
      expect(result.finalAmount).toBe(85);
    });

    it("should calculate fixed discount correctly", async () => {
      const fixedCoupon = {
        id: 1,
        code: "FIXED20",
        validFrom: "2026-01-01T00:00:00Z",
        validTo: "2026-12-31T23:59:59Z",
        isActive: true,
        isVisible: true,
        discountType: "fixed",
        discountValue: 20,
        minOrderAmount: 0,
        usageLimit: null,
        usedCount: 0,
        usageLimitPerUser: null,
      };

      mockDb.query.coupons.findFirst.mockResolvedValue(fixedCoupon);

      const result = await couponService.validateCoupon("FIXED20", "1", 100);

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(20);
      expect(result.finalAmount).toBe(80);
    });

    it("should not exceed order amount", async () => {
      const largeCoupon = {
        id: 1,
        code: "LARGE",
        validFrom: "2026-01-01T00:00:00Z",
        validTo: "2026-12-31T23:59:59Z",
        isActive: true,
        isVisible: true,
        discountType: "fixed",
        discountValue: 150,
        minOrderAmount: 0,
        usageLimit: null,
        usedCount: 0,
        usageLimitPerUser: null,
      };

      mockDb.query.coupons.findFirst.mockResolvedValue(largeCoupon);

      const result = await couponService.validateCoupon("LARGE", "1", 100);

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(100); // capped at order amount
      expect(result.finalAmount).toBe(0);
    });
  });

  describe("createCoupon", () => {
    it("should create coupon successfully", async () => {
      const couponData: CreateCouponData = {
        restaurantId: "1",
        code: "NEWCOUPON",
        name: "New Coupon",
        discountType: "percentage",
        discountValue: 15,
        validFrom: "2026-01-01T00:00:00Z",
        validTo: "2026-12-31T23:59:59Z",
      };

      const createdCoupon = { id: 1, ...couponData };

      mockDb.query.coupons.findFirst.mockResolvedValue(null); // No existing coupon
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdCoupon]),
        }),
      });

      const result = await couponService.createCoupon(couponData);

      expect(result).toEqual(createdCoupon);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should throw error when coupon code already exists", async () => {
      const couponData: CreateCouponData = {
        restaurantId: "1",
        code: "EXISTING",
        name: "Existing Coupon",
        discountType: "percentage",
        discountValue: 15,
        validFrom: "2026-01-01T00:00:00Z",
        validTo: "2026-12-31T23:59:59Z",
      };

      mockDb.query.coupons.findFirst.mockResolvedValue({
        id: 1,
        code: "EXISTING",
      });

      await expect(couponService.createCoupon(couponData)).rejects.toThrow(
        "優惠券代碼已存在",
      );
    });
  });

  describe("useCoupon", () => {
    it("should record coupon usage correctly", async () => {
      const usageData: UseCouponData = {
        couponId: 1,
        orderId: 100,
        userId: 10,
        discountAmount: 15,
        originalAmount: 100,
        finalAmount: 85,
      };

      const usageRecord = { id: 1, ...usageData };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([usageRecord]),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      });

      const result = await couponService.useCoupon(usageData);

      expect(result).toEqual(usageRecord);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("getCoupons", () => {
    it("should return paginated coupons list", async () => {
      const mockCoupons = [
        { id: 1, code: "COUPON1", name: "Coupon 1" },
        { id: 2, code: "COUPON2", name: "Coupon 2" },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      });

      mockDb.query.coupons.findMany.mockResolvedValue(mockCoupons);

      const result = await couponService.getCoupons({}, 1, 10);

      expect(result.coupons).toEqual(mockCoupons);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe("getAvailableCoupons", () => {
    it("should return only valid and visible coupons", async () => {
      const availableCoupons = [
        {
          id: 1,
          code: "AVAILABLE1",
          name: "Available Coupon 1",
          isActive: true,
          isVisible: true,
        },
      ];

      mockDb.query.coupons.findMany.mockResolvedValue(availableCoupons);

      const result = await couponService.getAvailableCoupons("1");

      expect(result).toEqual(availableCoupons);
      expect(mockDb.query.coupons.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.any(Array),
        }),
      );
    });
  });
});
