import { beforeEach, describe, expect, it, vi } from "vitest";
import { CouponsService } from "./CouponsService";

function createService() {
  return new CouponsService({} as D1Database, { JWT_SECRET: "test" });
}

function createSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    orderBy: vi.fn(async () => result),
    then: (
      resolve: (value: unknown[]) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

describe("CouponsService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes coupon money fields from cent columns", () => {
    const service = createService();

    expect(
      service.formatCouponMoneyFields({
        id: 1,
        discountType: "fixed_amount",
        discountValue: 0,
        discountValueCents: 1250,
        maxDiscountAmount: 0,
        maxDiscountAmountCents: 500,
        minOrderAmount: 0,
        minOrderAmountCents: 2500,
      }),
    ).toMatchObject({
      discountValue: 12.5,
      maxDiscountAmount: 5,
      minOrderAmount: 25,
    });

    expect(
      service.formatCouponMoneyFields({
        id: 2,
        discountType: "percentage",
        discountValue: 15,
        discountValueCents: 9999,
        maxDiscountAmount: null,
        minOrderAmount: 10,
      }),
    ).toMatchObject({
      discountValue: 15,
      maxDiscountAmount: null,
      minOrderAmount: 10,
    });
  });

  it("delegates validation and paginated listing to inherited coupon methods", async () => {
    const service = createService();
    const validateCoupon = vi
      .spyOn(service, "validateCoupon")
      .mockResolvedValueOnce({ valid: true, discountAmount: 5 })
      .mockResolvedValueOnce({ valid: false, reason: "expired" });
    vi.spyOn(service, "getCoupons").mockResolvedValue({
      coupons: [
        {
          id: 1,
          discountType: "fixed_amount",
          discountValue: 0,
          discountValueCents: 1000,
          maxDiscountAmount: null,
          minOrderAmount: null,
        },
      ],
      total: 21,
      page: 2,
      limit: 10,
    });

    await expect(
      service.validateCouponWithBusinessRules(
        "SAVE10",
        "restaurant-1",
        100,
        42,
        [{ menuItemId: 1, quantity: 2 }],
      ),
    ).resolves.toEqual({ valid: true, discountAmount: 5 });
    expect(validateCoupon).toHaveBeenCalledWith(
      "SAVE10",
      "restaurant-1",
      100,
      42,
      [{ menuItemId: 1, quantity: 2 }],
    );
    await expect(
      service.validateCouponWithBusinessRules("OLD", "restaurant-1", 100),
    ).resolves.toEqual({ valid: false, reason: "expired" });

    await expect(
      service.getCouponsWithEnhancedFilters(
        { restaurantId: "restaurant-1" },
        2,
        10,
      ),
    ).resolves.toMatchObject({
      total: 21,
      page: 2,
      limit: 10,
      pages: 3,
      coupons: [{ id: 1, discountValue: 10 }],
    });
  });

  it("validates coupon creation before delegating", async () => {
    const service = createService();
    const createCoupon = vi
      .spyOn(service, "createCoupon")
      .mockResolvedValue({ id: 10 });

    await expect(
      service.createCouponWithValidation({
        code: "SAVE10",
        name: "Save 10",
        restaurantId: "restaurant-1",
        discountType: "percentage",
        discountValue: 10,
        validFrom: "2026-06-01T00:00:00.000Z",
        validTo: "2026-07-01T00:00:00.000Z",
      }),
    ).resolves.toEqual({ id: 10 });
    expect(createCoupon).toHaveBeenCalledOnce();

    await expect(
      service.createCouponWithValidation({
        code: "BADDATE",
        name: "Bad Date",
        discountType: "percentage",
        discountValue: 10,
        validFrom: "2026-07-01T00:00:00.000Z",
        validTo: "2026-06-01T00:00:00.000Z",
      }),
    ).rejects.toThrow();

    await expect(
      service.createCouponWithValidation({
        code: "BADPERCENT",
        name: "Bad Percent",
        discountType: "percentage",
        discountValue: 101,
        validFrom: "2026-06-01T00:00:00.000Z",
        validTo: "2026-07-01T00:00:00.000Z",
      }),
    ).rejects.toThrow();
  });

  it("augments stats and counts bulk operation failures", async () => {
    const service = createService();
    vi.spyOn(service, "getCouponStats").mockResolvedValue({
      totalUsage: 3,
      totalDiscount: 25,
      uniqueUsers: 2,
    });
    vi.spyOn(service, "updateCoupon")
      .mockResolvedValueOnce({ id: 1 })
      .mockRejectedValueOnce(new Error("update failed"));
    vi.spyOn(service, "deactivateCoupon")
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("deactivate failed"));
    vi.spyOn(service, "deleteCoupon")
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("delete failed"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      service.getComprehensiveCouponStats(10),
    ).resolves.toMatchObject({
      totalUsage: 3,
      usageByDay: [],
      topUsers: [],
      averageOrderValue: 0,
    });
    await expect(service.bulkActivateCoupons([1, 2])).resolves.toEqual({
      success: 1,
      failed: 1,
    });
    await expect(service.bulkDeactivateCoupons([1, 2])).resolves.toEqual({
      success: 1,
      failed: 1,
    });
    await expect(service.bulkDeleteCoupons([1, 2])).resolves.toEqual({
      success: 1,
      failed: 1,
    });
    consoleError.mockRestore();
  });

  it("filters available coupons by minimum order amount", async () => {
    const service = createService();
    vi.spyOn(service, "getAvailableCoupons").mockResolvedValue([
      {
        id: 1,
        discountType: "fixed_amount",
        discountValue: 0,
        discountValueCents: 500,
        minOrderAmount: null,
        minOrderAmountCents: 2000,
      },
      {
        id: 2,
        discountType: "fixed_amount",
        discountValue: 0,
        discountValueCents: 1000,
        minOrderAmount: null,
        minOrderAmountCents: 5000,
      },
    ]);

    await expect(
      service.getAvailableCouponsForUser("restaurant-1", 42, 30),
    ).resolves.toEqual([
      expect.objectContaining({ id: 1, discountValue: 5, minOrderAmount: 20 }),
    ]);
    await expect(
      service.getAvailableCouponsForUser("restaurant-1", 42),
    ).resolves.toHaveLength(2);
  });

  it("calculates fixed and capped percentage savings in currency units", async () => {
    const service = createService();

    await expect(
      service.calculatePotentialSavings(
        [
          {
            id: 1,
            discountType: "percentage",
            discountValue: 20,
            maxDiscountAmount: null,
            maxDiscountAmountCents: 1500,
            minOrderAmount: null,
          },
          {
            id: 2,
            discountType: "fixed_amount",
            discountValue: 0,
            discountValueCents: 12000,
            maxDiscountAmount: null,
            minOrderAmount: null,
          },
        ],
        100,
      ),
    ).resolves.toEqual([
      { couponId: 1, saving: 15 },
      { couponId: 2, saving: 100 },
    ]);

    await expect(
      service.calculatePotentialSavings(
        [
          {
            id: 3,
            discountType: "percentage",
            discountValue: 10,
            maxDiscountAmount: null,
            minOrderAmount: null,
          },
        ],
        80,
      ),
    ).resolves.toEqual([{ couponId: 3, saving: 8 }]);
  });

  it("aggregates coupon usage trends from db rows", async () => {
    const service = createService();
    const couponCounts = [{ totalCoupons: 4, activeCoupons: 2 }];
    const usageTotals = [{ totalUsage: 7, totalSavings: 35.5 }];
    const usageByPeriod = [
      { period: "2026-06-01", totalUsage: 3, totalSavings: 15 },
      { period: "2026-06-02", totalUsage: 4, totalSavings: 20.5 },
    ];
    const select = vi
      .fn()
      .mockReturnValueOnce(createSelectChain(couponCounts))
      .mockReturnValueOnce(createSelectChain(usageTotals))
      .mockReturnValueOnce(createSelectChain(usageByPeriod));
    Object.assign(service as unknown as { db: unknown }, {
      db: { select },
    });

    await expect(
      service.getCouponUsageTrends(
        "restaurant-1",
        "2026-06-01",
        "invalid-date",
      ),
    ).resolves.toEqual({
      totalCoupons: 4,
      activeCoupons: 2,
      totalUsage: 7,
      totalSavings: 35.5,
      usageByPeriod,
    });
    expect(select).toHaveBeenCalledTimes(3);
  });

  it("aggregates usage trends with only an end date filter", async () => {
    const service = createService();
    const select = vi
      .fn()
      .mockReturnValueOnce(createSelectChain([]))
      .mockReturnValueOnce(createSelectChain([]))
      .mockReturnValueOnce(createSelectChain([]));
    Object.assign(service as unknown as { db: unknown }, {
      db: { select },
    });

    await expect(
      service.getCouponUsageTrends(undefined, undefined, "2026-06-30"),
    ).resolves.toEqual({
      totalCoupons: 0,
      activeCoupons: 0,
      totalUsage: 0,
      totalSavings: 0,
      usageByPeriod: [],
    });
    expect(select).toHaveBeenCalledTimes(3);
  });
});
