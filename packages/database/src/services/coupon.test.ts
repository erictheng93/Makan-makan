import { describe, expect, it, vi } from "vitest";
import { CouponService, type CreateCouponData } from "./coupon";

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
