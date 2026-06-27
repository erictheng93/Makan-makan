import { afterEach, describe, it, expect, vi } from "vitest";
import {
  MarketCheckoutVoucherService,
  combineAppliedMarketCheckoutVouchers,
  listAppliedMarketCheckoutVouchers,
  redeemCachedMarketCheckoutVoucher,
  totalAppliedVoucherDiscountCents,
} from "./MarketCheckoutVoucherService";

afterEach(() => {
  vi.useRealTimers();
});

describe("MarketCheckoutVoucherService.computeDiscountCents", () => {
  it("computes a percentage discount", () => {
    expect(
      MarketCheckoutVoucherService.computeDiscountCents(
        {
          discountType: "percentage",
          discountPercentageBps: 1000,
          discountValueCents: null,
          maxDiscountAmountCents: null,
        },
        24000,
      ),
    ).toBe(2400);
  });

  it("computes a percentage discount from basis points when present", () => {
    expect(
      MarketCheckoutVoucherService.computeDiscountCents(
        {
          discountType: "percentage",
          discountPercentageBps: 1250,
          discountValueCents: 9999,
          maxDiscountAmountCents: null,
        },
        24000,
      ),
    ).toBe(3000);
  });

  it("caps a percentage discount at the max discount amount", () => {
    expect(
      MarketCheckoutVoucherService.computeDiscountCents(
        {
          discountType: "percentage",
          discountPercentageBps: 5000,
          discountValueCents: null,
          maxDiscountAmountCents: 5000,
        },
        24000,
      ),
    ).toBe(5000);
  });

  it("applies a fixed discount in cents", () => {
    expect(
      MarketCheckoutVoucherService.computeDiscountCents(
        {
          discountType: "fixed",
          discountValueCents: 3000,
          maxDiscountAmountCents: null,
        },
        24000,
      ),
    ).toBe(3000);
  });

  it("clamps a discount larger than the subtotal", () => {
    expect(
      MarketCheckoutVoucherService.computeDiscountCents(
        {
          discountType: "fixed",
          discountValueCents: 30000,
          maxDiscountAmountCents: null,
        },
        24000,
      ),
    ).toBe(24000);
  });

  it("returns zero for a non-positive subtotal", () => {
    expect(
      MarketCheckoutVoucherService.computeDiscountCents(
        {
          discountType: "percentage",
          discountPercentageBps: 1000,
          discountValueCents: null,
          maxDiscountAmountCents: null,
        },
        0,
      ),
    ).toBe(0);
  });
});

describe("MarketCheckoutVoucherService.splitDiscount", () => {
  it("splits proportionally by child amount", () => {
    const allocations = MarketCheckoutVoucherService.splitDiscount(2400, [
      { orderId: 1, amountCents: 16000 },
      { orderId: 2, amountCents: 8000 },
    ]);
    expect(allocations).toEqual([
      { orderId: 1, amountCents: 16000, discountCents: 1600 },
      { orderId: 2, amountCents: 8000, discountCents: 800 },
    ]);
  });

  it("gives the rounding remainder to the largest child", () => {
    // 1000 split over 3/3/4 -> floor 300/300/400 = 1000 (exact); use amounts
    // that force a remainder: 100 over 333/333/334 of 1000.
    const allocations = MarketCheckoutVoucherService.splitDiscount(100, [
      { orderId: 1, amountCents: 333 },
      { orderId: 2, amountCents: 333 },
      { orderId: 3, amountCents: 334 },
    ]);
    const total = allocations.reduce((sum, a) => sum + a.discountCents, 0);
    expect(total).toBe(100);
    // largest child (order 3) absorbs the remainder
    const largest = allocations.find((a) => a.orderId === 3)!;
    expect(largest.discountCents).toBeGreaterThanOrEqual(34);
  });

  it("always sums to the full discount", () => {
    const allocations = MarketCheckoutVoucherService.splitDiscount(777, [
      { orderId: 1, amountCents: 1234 },
      { orderId: 2, amountCents: 5678 },
      { orderId: 3, amountCents: 9012 },
    ]);
    const total = allocations.reduce((sum, a) => sum + a.discountCents, 0);
    expect(total).toBe(777);
  });

  it("assigns no discount when the subtotal is zero", () => {
    const allocations = MarketCheckoutVoucherService.splitDiscount(500, [
      { orderId: 1, amountCents: 0 },
      { orderId: 2, amountCents: 0 },
    ]);
    expect(allocations.every((a) => a.discountCents === 0)).toBe(true);
  });
});

describe("market checkout stacked voucher helpers", () => {
  const platformVoucher = {
    couponId: 1,
    code: "PLATFORM10",
    name: "Platform 10",
    fundedBy: "platform" as const,
    discountCents: 1000,
    allocations: [
      { orderId: 1, amountCents: 6000, discountCents: 600 },
      { orderId: 2, amountCents: 4000, discountCents: 400 },
    ],
  };
  const vendorVoucher = {
    couponId: 2,
    code: "SHOP50",
    name: "Shop 50",
    fundedBy: "vendor" as const,
    discountCents: 500,
    allocations: [{ orderId: 2, amountCents: 3600, discountCents: 500 }],
  };

  it("combines multiple vouchers into aggregate allocations", () => {
    const bundle = combineAppliedMarketCheckoutVouchers([
      platformVoucher,
      vendorVoucher,
    ]);

    expect(bundle).toMatchObject({
      discountCents: 1500,
      vouchers: [platformVoucher, vendorVoucher],
      allocations: [
        { orderId: 1, amountCents: 6000, discountCents: 600 },
        { orderId: 2, amountCents: 4000, discountCents: 900 },
      ],
    });
  });

  it("normalizes legacy single vouchers and stacked voucher bundles", () => {
    expect(listAppliedMarketCheckoutVouchers(platformVoucher)).toEqual([
      platformVoucher,
    ]);

    const bundle = combineAppliedMarketCheckoutVouchers([
      platformVoucher,
      vendorVoucher,
    ]);
    expect(listAppliedMarketCheckoutVouchers(bundle)).toEqual([
      platformVoucher,
      vendorVoucher,
    ]);
  });

  it("returns no vouchers and zero discount for empty applied values", () => {
    expect(listAppliedMarketCheckoutVouchers(null)).toEqual([]);
    expect(listAppliedMarketCheckoutVouchers(undefined)).toEqual([]);
    expect(combineAppliedMarketCheckoutVouchers([])).toBeUndefined();
    expect(totalAppliedVoucherDiscountCents(undefined)).toBe(0);
    expect(totalAppliedVoucherDiscountCents(platformVoucher)).toBe(1000);
  });
});

describe("redeemCachedMarketCheckoutVoucher", () => {
  it("redeems a valid cached stacked voucher bundle without querying persistence", async () => {
    const redeemSpy = vi
      .spyOn(MarketCheckoutVoucherService.prototype, "redeem")
      .mockResolvedValue();
    const cachedBundle = {
      appliedVoucher: {
        vouchers: [
          {
            couponId: 1,
            code: "PLATFORM10",
            name: "Platform 10",
            discountCents: 1000,
            allocations: [
              { orderId: 1001, amountCents: 10000, discountCents: 1000 },
            ],
          },
          {
            couponId: 2,
            code: "SHOP50",
            name: "Shop 50",
            restaurantId: "rest-1",
            discountCents: 500,
            allocations: [
              { orderId: 1002, amountCents: 5000, discountCents: 500 },
            ],
          },
        ],
      },
    };
    const env = {
      CACHE_KV: {
        get: vi.fn(async () => JSON.stringify(cachedBundle)),
      },
      DB: {
        prepare: vi.fn(),
      },
    };

    await redeemCachedMarketCheckoutVoucher(env as never, "checkout-1");

    expect(env.CACHE_KV.get).toHaveBeenCalledWith("market_checkout:checkout-1");
    expect(env.DB.prepare).not.toHaveBeenCalled();
    expect(redeemSpy).toHaveBeenCalledTimes(2);
    expect(redeemSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ couponId: 1, fundedBy: "platform" }),
    );
    expect(redeemSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ couponId: 2, fundedBy: "vendor" }),
    );
    redeemSpy.mockRestore();
  });

  it("redeems a persisted voucher when the cached checkout session has expired", async () => {
    const redeemSpy = vi
      .spyOn(MarketCheckoutVoucherService.prototype, "redeem")
      .mockResolvedValueOnce();
    const appliedVoucher = {
      couponId: 42,
      code: "ASYNC10",
      name: "ASYNC10",
      discountCents: 2400,
      allocations: [
        { orderId: 1001, amountCents: 16000, discountCents: 1600 },
        { orderId: 1002, amountCents: 8000, discountCents: 800 },
      ],
    };
    const env = {
      CACHE_KV: {
        get: vi.fn(async () => null),
      },
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            raw: vi.fn(async () => [[JSON.stringify(appliedVoucher)]]),
            first: vi.fn(async () => ({
              applied_voucher: JSON.stringify(appliedVoucher),
            })),
          })),
        })),
      },
    };

    await redeemCachedMarketCheckoutVoucher(env as never, "checkout-1");

    expect(
      vi
        .mocked(env.DB.prepare)
        .mock.calls.some(
          ([sql]) =>
            sql.toLowerCase().includes("select") &&
            sql.includes("applied_voucher"),
        ),
    ).toBe(true);
    expect(redeemSpy).toHaveBeenCalledWith({
      ...appliedVoucher,
      fundedBy: "platform",
      restaurantId: undefined,
    });
    redeemSpy.mockRestore();
  });

  it("ignores malformed cached and persisted voucher payloads", async () => {
    const redeemSpy = vi
      .spyOn(MarketCheckoutVoucherService.prototype, "redeem")
      .mockResolvedValueOnce();
    const env = {
      CACHE_KV: {
        get: vi.fn(async () => "{invalid json"),
      },
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            raw: vi.fn(async () => [["{invalid json"]]),
            first: vi.fn(async () => ({ applied_voucher: "{invalid json" })),
          })),
        })),
      },
    };

    await redeemCachedMarketCheckoutVoucher(env as never, "checkout-1");

    expect(redeemSpy).not.toHaveBeenCalled();
    redeemSpy.mockRestore();
  });

  it("swallows async voucher redemption failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const redeemSpy = vi
      .spyOn(MarketCheckoutVoucherService.prototype, "redeem")
      .mockRejectedValueOnce(new Error("redeem failed"));
    const env = {
      CACHE_KV: {
        get: vi.fn(async () =>
          JSON.stringify({
            appliedVoucher: {
              couponId: 1,
              code: "FAIL",
              name: "Fail",
              discountCents: 100,
              allocations: [
                { orderId: 1001, amountCents: 1000, discountCents: 100 },
              ],
            },
          }),
        ),
      },
      DB: { prepare: vi.fn() },
    };

    await redeemCachedMarketCheckoutVoucher(env as never, "checkout-1");

    expect(consoleError).toHaveBeenCalledWith(
      "Voucher redemption failed for async market checkout checkout-1:",
      expect.any(Error),
    );
    redeemSpy.mockRestore();
    consoleError.mockRestore();
  });
});

describe("MarketCheckoutVoucherService.validateAndPrice", () => {
  it("uses the +8 business date when checking voucher validity", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T16:30:00.000Z"));
    const service = makeValidateUnitService({
      id: 7,
      code: "TODAY",
      name: "Today",
      restaurantId: null,
      deletedAt: null,
      isActive: true,
      isVisible: true,
      validFrom: "2026-06-08",
      validTo: "2026-06-08",
      usageLimit: null,
      usedCount: null,
      minOrderAmountCents: null,
      discountType: "fixed",
      discountValueCents: 500,
      maxDiscountAmountCents: null,
    });

    await expect(
      service.validateAndPrice({
        code: "today",
        subtotalCents: 1000,
        childOrders: [
          { orderId: 1, restaurantId: "rest-1", amountCents: 1000 },
        ],
      }),
    ).resolves.toMatchObject({
      code: "TODAY",
      discountCents: 500,
    });
  });

  it("prices platform vouchers across all child orders", async () => {
    const service = makeValidateUnitService({
      id: 7,
      code: "SAVE10",
      name: "Save 10",
      restaurantId: null,
      deletedAt: null,
      isActive: true,
      isVisible: true,
      validFrom: "2026-01-01",
      validTo: "2099-12-31",
      usageLimit: 10,
      usedCount: 2,
      minOrderAmountCents: 1000,
      discountType: "percentage",
      discountPercentageBps: 1000,
      discountValueCents: null,
      maxDiscountAmountCents: 500,
    });

    await expect(
      service.validateAndPrice({
        code: " save10 ",
        subtotalCents: 5000,
        childOrders: [
          { orderId: 1, restaurantId: "rest-1", amountCents: 3000 },
          { orderId: 2, restaurantId: "rest-2", amountCents: 2000 },
        ],
      }),
    ).resolves.toEqual({
      couponId: 7,
      code: "SAVE10",
      name: "Save 10",
      restaurantId: null,
      fundedBy: "platform",
      discountCents: 500,
      allocations: [
        { orderId: 1, amountCents: 3000, discountCents: 300 },
        { orderId: 2, amountCents: 2000, discountCents: 200 },
      ],
    });
  });

  it("prices vendor vouchers only against matching child orders", async () => {
    const service = makeValidateUnitService({
      id: 8,
      code: "SHOP50",
      name: "Shop 50",
      restaurantId: "rest-2",
      deletedAt: null,
      isActive: true,
      isVisible: true,
      validFrom: "2026-01-01",
      validTo: "2099-12-31",
      usageLimit: null,
      usedCount: null,
      minOrderAmountCents: 1000,
      discountType: "fixed",
      discountValueCents: 500,
      maxDiscountAmountCents: null,
    });

    await expect(
      service.validateAndPrice({
        code: "shop50",
        subtotalCents: 7000,
        childOrders: [
          { orderId: 1, restaurantId: "rest-1", amountCents: 3000 },
          { orderId: 2, restaurantId: "rest-2", amountCents: 4000 },
        ],
      }),
    ).resolves.toMatchObject({
      couponId: 8,
      fundedBy: "vendor",
      discountCents: 500,
      allocations: [{ orderId: 2, amountCents: 4000, discountCents: 500 }],
    });
  });

  it("rejects invalid voucher states with voucher-specific errors", async () => {
    await expect(
      makeValidateUnitService(null).validateAndPrice({
        code: "",
        subtotalCents: 1000,
        childOrders: [{ orderId: 1, amountCents: 1000 }],
      }),
    ).rejects.toMatchObject({ code: "VOUCHER_CODE_REQUIRED" });

    await expect(
      makeValidateUnitService(null).validateAndPrice({
        code: "missing",
        subtotalCents: 1000,
        childOrders: [{ orderId: 1, amountCents: 1000 }],
      }),
    ).rejects.toMatchObject({ code: "VOUCHER_NOT_FOUND" });

    await expect(
      makeValidateUnitService({
        id: 9,
        code: "OLD",
        name: "Old",
        restaurantId: null,
        deletedAt: null,
        isActive: true,
        isVisible: true,
        validFrom: "2000-01-01",
        validTo: "2000-12-31",
        usageLimit: null,
        usedCount: null,
        minOrderAmountCents: 0,
        discountType: "fixed",
        discountValueCents: 100,
        maxDiscountAmountCents: null,
      }).validateAndPrice({
        code: "old",
        subtotalCents: 1000,
        childOrders: [{ orderId: 1, amountCents: 1000 }],
      }),
    ).rejects.toMatchObject({ code: "VOUCHER_EXPIRED" });
  });
});

describe("MarketCheckoutVoucherService.redeem", () => {
  it("inserts missing usage rows and increments used_count for the claim row", async () => {
    const insertRun = vi.fn(async () => undefined);
    const couponUpdateRun = vi.fn(async () => ({ meta: { changes: 1 } }));
    const service = makeRedeemUnitService(insertRun, couponUpdateRun);

    await service.redeem(appliedVoucherForRedeemRace());

    expect(insertRun).toHaveBeenCalledTimes(2);
    expect(couponUpdateRun).toHaveBeenCalledTimes(1);
  });

  it("does not increment used_count again for apply-time reserved vouchers", async () => {
    const insertRun = vi.fn(async () => undefined);
    const couponUpdateRun = vi.fn(async () => ({ meta: { changes: 1 } }));
    const service = makeRedeemUnitService(insertRun, couponUpdateRun);

    await service.redeem({
      ...appliedVoucherForRedeemRace(),
      reservationStatus: "reserved",
      reservedAt: "2026-06-13T00:00:00.000Z",
    });

    expect(insertRun).toHaveBeenCalledTimes(2);
    expect(couponUpdateRun).not.toHaveBeenCalled();
  });

  it("returns without writes when redemption is fully recorded or empty", async () => {
    const insertRun = vi.fn(async () => undefined);
    const couponUpdateRun = vi.fn(async () => ({ meta: { changes: 1 } }));
    const service = makeRedeemUnitService(insertRun, couponUpdateRun, [
      { orderId: 1001 },
      { orderId: 1002 },
    ]);

    await service.redeem(appliedVoucherForRedeemRace());
    await service.redeem({
      couponId: 42,
      code: "EMPTY",
      name: "Empty",
      fundedBy: "platform",
      discountCents: 0,
      allocations: [],
    });

    expect(insertRun).not.toHaveBeenCalled();
    expect(couponUpdateRun).not.toHaveBeenCalled();
  });

  it("releases the claimed used_count when a concurrent duplicate insert loses the race", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const insertRun = vi.fn(async () => {
        throw new Error("UNIQUE constraint failed: coupon_usage.coupon_id");
      });
      const couponUpdateRun = vi.fn(async () => ({ meta: { changes: 1 } }));
      const service = makeRedeemUnitService(insertRun, couponUpdateRun);

      await service.redeem(appliedVoucherForRedeemRace());

      expect(insertRun).toHaveBeenCalledTimes(2);
      expect(couponUpdateRun).toHaveBeenCalledTimes(2);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("releases the claimed used_count when only a non-claim usage row wins the race", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const insertRun = vi
        .fn()
        .mockRejectedValueOnce(
          new Error("UNIQUE constraint failed: coupon_usage.coupon_id"),
        )
        .mockResolvedValueOnce(undefined);
      const couponUpdateRun = vi.fn(async () => ({ meta: { changes: 1 } }));
      const service = makeRedeemUnitService(insertRun, couponUpdateRun);

      await service.redeem(appliedVoucherForRedeemRace());

      expect(insertRun).toHaveBeenCalledTimes(2);
      expect(couponUpdateRun).toHaveBeenCalledTimes(2);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("rejects exhausted vouchers before writing usage rows", async () => {
    const insertRun = vi.fn(async () => undefined);
    const couponUpdateRun = vi.fn(async () => ({ meta: { changes: 0 } }));
    const service = makeRedeemUnitService(insertRun, couponUpdateRun);

    await expect(service.redeem(appliedVoucherForRedeemRace())).rejects.toThrow(
      "This voucher has been fully redeemed",
    );

    expect(insertRun).not.toHaveBeenCalled();
    expect(couponUpdateRun).toHaveBeenCalledTimes(1);
  });
});

describe("MarketCheckoutVoucherService reservations", () => {
  it("claims a usage slot when reserving an unreserved voucher", async () => {
    const couponUpdateRun = vi.fn(async () => ({ meta: { changes: 1 } }));
    const service = makeReservationUnitService(couponUpdateRun);

    const reserved = await service.reserveUsage(appliedVoucherForRedeemRace());

    expect(couponUpdateRun).toHaveBeenCalledTimes(1);
    expect(reserved).toMatchObject({
      couponId: 42,
      code: "ASYNC10",
      reservationStatus: "reserved",
    });
    expect(reserved.reservedAt).toEqual(expect.any(String));
    expect(reserved.releasedAt).toBeUndefined();
  });

  it("does not claim another slot for an already reserved voucher", async () => {
    const couponUpdateRun = vi.fn(async () => ({ meta: { changes: 1 } }));
    const service = makeReservationUnitService(couponUpdateRun);
    const voucher = {
      ...appliedVoucherForRedeemRace(),
      reservationStatus: "reserved" as const,
      reservedAt: "2026-06-13T00:00:00.000Z",
    };

    await expect(service.reserveUsage(voucher)).resolves.toBe(voucher);

    expect(couponUpdateRun).not.toHaveBeenCalled();
  });

  it("releases only reserved voucher slots", async () => {
    const couponUpdateRun = vi.fn(async () => ({ meta: { changes: 1 } }));
    const service = makeReservationUnitService(couponUpdateRun);
    const reserved = {
      ...appliedVoucherForRedeemRace(),
      reservationStatus: "reserved" as const,
      reservedAt: "2026-06-13T00:00:00.000Z",
    };

    const released = await service.releaseReservation(reserved);
    await expect(service.releaseReservation(released)).resolves.toBe(released);

    expect(couponUpdateRun).toHaveBeenCalledTimes(1);
    expect(released).toMatchObject({
      couponId: 42,
      code: "ASYNC10",
      reservationStatus: "released",
    });
    expect(released.releasedAt).toEqual(expect.any(String));
  });
});

describe("MarketCheckoutVoucherService.markRefunded", () => {
  it("returns without writes when no order ids are provided", async () => {
    const updateRun = vi.fn(async () => undefined);
    const decrementRun = vi.fn(async () => undefined);
    const service = makeRefundUnitService({
      checkoutRows: [],
      childRows: [],
      usageRows: [],
      releaseRows: [],
      updateRun,
      decrementRun,
    });

    await service.markRefunded({ couponId: 42, orderIds: [] });

    expect(updateRun).not.toHaveBeenCalled();
    expect(decrementRun).not.toHaveBeenCalled();
  });

  it("marks usage refunded and releases one used_count for fully refunded checkouts", async () => {
    const updateRun = vi.fn(async () => undefined);
    const decrementRun = vi.fn(async () => undefined);
    const service = makeRefundUnitService({
      checkoutRows: [{ checkoutId: "checkout-1", orderId: 1001 }],
      childRows: [
        { checkoutId: "checkout-1", orderId: 1001 },
        { checkoutId: "checkout-1", orderId: 1002 },
      ],
      usageRows: [
        { orderId: 1001, status: "refunded" },
        { orderId: 1002, status: "refunded" },
      ],
      releaseRows: [{ id: 1 }],
      updateRun,
      decrementRun,
    });

    await service.markRefunded({
      couponId: 42,
      orderIds: [1001, 1001],
    });

    expect(updateRun).toHaveBeenCalledTimes(1);
    expect(decrementRun).toHaveBeenCalledTimes(1);
  });

  it("does not release used_count until every usage row is refunded", async () => {
    const updateRun = vi.fn(async () => undefined);
    const decrementRun = vi.fn(async () => undefined);
    const service = makeRefundUnitService({
      checkoutRows: [],
      childRows: [],
      usageRows: [{ orderId: 1001, status: "active" }],
      releaseRows: [],
      updateRun,
      decrementRun,
    });

    await service.markRefunded({
      couponId: 42,
      orderIds: [1001],
    });

    expect(updateRun).toHaveBeenCalledTimes(1);
    expect(decrementRun).not.toHaveBeenCalled();
  });
});

function makeValidateUnitService(coupon: unknown) {
  const service = Object.create(MarketCheckoutVoucherService.prototype) as {
    db: {
      select: ReturnType<typeof vi.fn>;
    };
    validateAndPrice: MarketCheckoutVoucherService["validateAndPrice"];
  };
  service.db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(async () => coupon),
        })),
      })),
    })),
  };
  return service;
}

function makeRedeemUnitService(
  insertRun: ReturnType<typeof vi.fn>,
  couponUpdateRun: ReturnType<typeof vi.fn>,
  existingRows: Array<{ orderId: string }> = [],
) {
  const service = Object.create(MarketCheckoutVoucherService.prototype) as {
    db: {
      select: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    redeem: MarketCheckoutVoucherService["redeem"];
  };
  service.db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          all: vi.fn(async () => existingRows),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        run: insertRun,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: couponUpdateRun,
        })),
      })),
    })),
  };
  return service;
}

function makeReservationUnitService(couponUpdateRun: ReturnType<typeof vi.fn>) {
  const service = Object.create(MarketCheckoutVoucherService.prototype) as {
    db: {
      update: ReturnType<typeof vi.fn>;
    };
    reserveUsage: MarketCheckoutVoucherService["reserveUsage"];
    releaseReservation: MarketCheckoutVoucherService["releaseReservation"];
  };
  service.db = {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: couponUpdateRun,
        })),
      })),
    })),
  };
  return service;
}

function makeRefundUnitService(options: {
  checkoutRows: Array<{ checkoutId: string; orderId: string }>;
  childRows: Array<{ checkoutId: string; orderId: string }>;
  usageRows: Array<{ orderId: string; status: string | null }>;
  releaseRows: Array<{ id: number }>;
  updateRun: ReturnType<typeof vi.fn>;
  decrementRun: ReturnType<typeof vi.fn>;
}) {
  const selectRows = [
    options.checkoutRows,
    options.childRows,
    options.usageRows,
  ];
  let updateCall = 0;
  const service = Object.create(MarketCheckoutVoucherService.prototype) as {
    db: {
      select: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    markRefunded: MarketCheckoutVoucherService["markRefunded"];
  };
  service.db = {
    select: vi.fn(() => {
      const rows = selectRows.shift() ?? [];
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            all: vi.fn(async () => rows),
          })),
        })),
      };
    }),
    update: vi.fn(() => {
      updateCall += 1;
      if (updateCall === 1) {
        return {
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              run: options.updateRun,
            })),
          })),
        };
      }
      if (updateCall === 2) {
        return {
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn(async () => options.releaseRows),
            })),
          })),
        };
      }
      return {
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            run: options.decrementRun,
          })),
        })),
      };
    }),
  };
  return service;
}

function appliedVoucherForRedeemRace() {
  return {
    couponId: 42,
    code: "ASYNC10",
    name: "ASYNC10",
    fundedBy: "platform" as const,
    discountCents: 2400,
    allocations: [
      { orderId: 1001, amountCents: 16000, discountCents: 1600 },
      { orderId: 1002, amountCents: 8000, discountCents: 800 },
    ],
  };
}
