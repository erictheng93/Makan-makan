import { describe, it, expect } from "vitest";
import {
  MarketCheckoutVoucherService,
  combineAppliedMarketCheckoutVouchers,
  listAppliedMarketCheckoutVouchers,
} from "./MarketCheckoutVoucherService";

describe("MarketCheckoutVoucherService.computeDiscountCents", () => {
  it("computes a percentage discount", () => {
    expect(
      MarketCheckoutVoucherService.computeDiscountCents(
        {
          discountType: "percentage",
          discountValue: 10,
          discountValueCents: null,
          maxDiscountAmountCents: null,
        },
        24000,
      ),
    ).toBe(2400);
  });

  it("caps a percentage discount at the max discount amount", () => {
    expect(
      MarketCheckoutVoucherService.computeDiscountCents(
        {
          discountType: "percentage",
          discountValue: 50,
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
          discountValue: 30,
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
          discountValue: 300,
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
          discountValue: 10,
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
});
