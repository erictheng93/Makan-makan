// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { Coupon, CouponDetailStats } from "@makanmasak/shared-types";
import CouponStatsModal from "./CouponStatsModal.vue";

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({ formatPrice: (amount: number) => `$${amount}` }),
}));
vi.mock("@/composables/useDateFormatter", () => ({
  useDateFormatter: () => ({ formatDateTime: (value: string) => value }),
}));

const coupon: Coupon = {
  id: 1,
  code: "SAVE",
  name: "Save",
  discountType: "fixed",
  discountValue: 5,
  minOrderAmount: 0,
  usageLimit: undefined,
  usedCount: 0,
  validFrom: "2026-01-01T00:00:00.000Z",
  validTo: "2099-01-01T00:00:00.000Z",
  isActive: true,
  isVisible: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function textFor(avgDiscount: number) {
  // lastUsed is optional rather than nullable; omitting it is the "never used"
  // case the scoring branches read.
  const stats: CouponDetailStats = {
    totalUsed: 5,
    avgDiscount,
    totalDiscount: 0,
  };
  return mount(CouponStatsModal, { props: { coupon, stats } }).text();
}

describe("CouponStatsModal display-currency scoring", () => {
  it.each([
    [20, "couponStats.rating.good"],
    [10, "couponStats.rating.good"],
    [5, "couponStats.rating.good"],
    [2, "couponStats.rating.average"],
  ])("uses the %s display-currency threshold", (avgDiscount, rating) => {
    expect(textFor(avgDiscount)).toContain(rating);
  });

  it("recommends a low discount only below five display-currency units", () => {
    expect(textFor(5)).not.toContain("couponStats.recommend.lowDiscount");
    expect(textFor(4.99)).toContain("couponStats.recommend.lowDiscount");
  });
});
