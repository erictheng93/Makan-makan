import { describe, expect, it, vi } from "vitest";
import {
  CouponEligibilityError,
  CouponService,
  type CreateCouponData,
  type RedeemableCouponRow,
} from "./coupon";

describe("CouponService.updateCoupon", () => {
  it("does not update coupon restaurant ownership", async () => {
    let writtenValues: Record<string, unknown> | undefined;
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn((values: Record<string, unknown>) => {
      writtenValues = values;
      return { where };
    });
    const service = Object.create(CouponService.prototype) as CouponService;
    Object.assign(service, {
      db: {
        update: vi.fn(() => ({ set })),
      },
    });

    await service.updateCoupon(10, {
      restaurantId: "restaurant-2",
      name: "Moved coupon",
    } as Partial<CreateCouponData>);

    expect(writtenValues).toMatchObject({ name: "Moved coupon" });
    expect(writtenValues).not.toHaveProperty("restaurantId");
  });
});

describe("CouponService.assertCouponRedeemable per-user limit", () => {
  function buildCoupon(
    overrides: Partial<RedeemableCouponRow> = {},
  ): RedeemableCouponRow {
    return {
      id: 10,
      restaurantId: "restaurant-1",
      deletedAt: null,
      isActive: true,
      isVisible: true,
      validFrom: "2000-01-01",
      validTo: "2999-12-31",
      usageLimit: null,
      usedCount: 0,
      usageLimitPerUser: null,
      minOrderAmountCents: null,
      applicableMenuItems: null,
      applicableCategories: null,
      ...overrides,
    };
  }

  function buildService(usageCount = 0) {
    const select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ count: usageCount }]),
      })),
    }));
    const service = Object.create(CouponService.prototype) as CouponService;
    Object.assign(service, { db: { select } });
    return { service, select };
  }

  it("rejects a guest redemption when the coupon has a per-user limit but no global cap", async () => {
    const { service, select } = buildService();

    await expect(
      service.assertCouponRedeemable(
        buildCoupon({ usageLimitPerUser: 1, usageLimit: null }),
        {
          restaurantId: "restaurant-1",
          orderAmountCents: 1000,
          mode: "redeem",
        },
      ),
    ).rejects.toMatchObject({ code: "COUPON_REQUIRES_IDENTITY" });
    // 沒有身分可數，所以連 coupon_usage 都不該去查
    expect(select).not.toHaveBeenCalled();
  });

  it("still lets a guest redeem when a global cap bounds the damage", async () => {
    const { service, select } = buildService();

    await expect(
      service.assertCouponRedeemable(
        buildCoupon({ usageLimitPerUser: 1, usageLimit: 5, usedCount: 0 }),
        {
          restaurantId: "restaurant-1",
          orderAmountCents: 1000,
          mode: "redeem",
        },
      ),
    ).resolves.toBeUndefined();
    expect(select).not.toHaveBeenCalled();
  });

  it("keeps counting per-user usage for an identified caller", async () => {
    const { service, select } = buildService(1);

    await expect(
      service.assertCouponRedeemable(buildCoupon({ usageLimitPerUser: 1 }), {
        restaurantId: "restaurant-1",
        orderAmountCents: 1000,
        userId: "user-1",
        mode: "redeem",
      }),
    ).rejects.toMatchObject({ code: "COUPON_USER_LIMIT_REACHED" });
    expect(select).toHaveBeenCalledOnce();
  });

  it("leaves guest redemption untouched when no per-user limit is set", async () => {
    const { service, select } = buildService();

    await expect(
      service.assertCouponRedeemable(buildCoupon(), {
        restaurantId: "restaurant-1",
        orderAmountCents: 1000,
        mode: "redeem",
      }),
    ).resolves.toBeUndefined();
    expect(select).not.toHaveBeenCalled();
  });

  it("surfaces the identity failure as a CouponEligibilityError", async () => {
    const { service } = buildService();

    await expect(
      service.assertCouponRedeemable(buildCoupon({ usageLimitPerUser: 2 }), {
        restaurantId: "restaurant-1",
        orderAmountCents: 1000,
        mode: "validate",
      }),
    ).rejects.toBeInstanceOf(CouponEligibilityError);
  });
});
