import { afterEach, describe, expect, it, vi } from "vitest";
import { getCouponStatus } from "./couponStatus";

const now = new Date("2026-08-28T12:00:00.000Z");

function coupon(overrides: Record<string, unknown> = {}) {
  return {
    isActive: true,
    validFrom: "2026-08-28T11:00:00.000Z",
    validTo: "2026-08-28T13:00:00.000Z",
    usageLimit: 10,
    usedCount: 0,
    ...overrides,
  };
}

describe("getCouponStatus", () => {
  afterEach(() => vi.useRealTimers());

  it("uses the documented inactive, expired, exhausted, scheduled, active priority", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(
      getCouponStatus(
        coupon({ isActive: false, validTo: "2026-08-27T00:00:00.000Z" }),
      ),
    ).toBe("inactive");
    expect(
      getCouponStatus(
        coupon({ validTo: "2026-08-28T11:59:59.999Z", usedCount: 10 }),
      ),
    ).toBe("expired");
    expect(
      getCouponStatus(
        coupon({ validFrom: "2026-08-29T00:00:00.000Z", usedCount: 10 }),
      ),
    ).toBe("exhausted");
    expect(
      getCouponStatus(coupon({ validFrom: "2026-08-29T00:00:00.000Z" })),
    ).toBe("scheduled");
    expect(getCouponStatus(coupon())).toBe("active");
  });

  it("keeps a coupon active at its exact validTo boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(getCouponStatus(coupon({ validTo: now.toISOString() }))).toBe(
      "active",
    );
  });
});
