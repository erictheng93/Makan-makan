import { describe, expect, it } from "vitest";
import { updateCouponSchema, updateTemplateSchema } from "./validation";

function buildTemplateUpdate(overrides: Record<string, unknown> = {}) {
  return {
    name: "Weekend promo",
    description: "Template for weekend discounts",
    templateData: { discountType: "percentage", discountValue: 10 },
    ...overrides,
  };
}

describe("updateTemplateSchema", () => {
  it("accepts an update that leaves the owning restaurant alone", () => {
    const result = updateTemplateSchema.safeParse(buildTemplateUpdate());

    expect(result.success).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({ name: "Weekend promo" }),
    );
  });

  it("accepts a partial update", () => {
    const result = updateTemplateSchema.safeParse({ name: "Renamed" });

    expect(result.success).toBe(true);
  });

  it("refuses to re-home a template into another restaurant", () => {
    const result = updateTemplateSchema.safeParse(
      buildTemplateUpdate({ restaurantId: "restaurant-2" }),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["restaurantId"] }),
      ]),
    );
  });

  it("refuses restaurantId even when it names the current restaurant", () => {
    // The handler checks ownership against the pre-update row, so a matching id
    // would still be forwarded into the UPDATE. The field is rejected outright
    // rather than compared.
    const result = updateTemplateSchema.safeParse(
      buildTemplateUpdate({ restaurantId: "restaurant-1" }),
    );

    expect(result.success).toBe(false);
  });
});

describe("updateCouponSchema", () => {
  // Paired with updateTemplateSchema above: the two carry one decision, so a
  // regression in either shape should turn this file red.
  it("refuses to re-home a coupon into another restaurant", () => {
    const result = updateCouponSchema.safeParse({
      name: "Moved coupon",
      restaurantId: "restaurant-2",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["restaurantId"] }),
      ]),
    );
  });

  it("accepts an update that leaves the owning restaurant alone", () => {
    const result = updateCouponSchema.safeParse({ name: "Renamed coupon" });

    expect(result.success).toBe(true);
  });
});
