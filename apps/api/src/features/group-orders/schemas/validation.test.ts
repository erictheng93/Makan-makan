import { describe, expect, it } from "vitest";
import {
  activitiesQuerySchema,
  createGroupOrderSchema,
  splitBillSchema,
  statisticsQuerySchema,
  updateCartItemSchema,
  validateCartItemQuantity,
  validateGroupOrderPermissions,
  validatePaymentAmount,
} from "./validation";

const memberId = "018ffb9a-7b8a-7c3d-9f23-123456789abc";

describe("group order validation schemas", () => {
  it("sanitizes notes without applying service-owned defaults", () => {
    expect(
      createGroupOrderSchema.parse({
        restaurantId: 123,
        notes: '<script>alert("x")</script>',
      }),
    ).toMatchObject({
      restaurantId: "123",
      notes: "scriptalert(x)/script",
    });
  });

  it("requires at least one cart item update field", () => {
    expect(updateCartItemSchema.parse({ quantity: 2 })).toEqual({
      quantity: 2,
    });
    expect(() => updateCartItemSchema.parse({})).toThrow(
      "At least one field must be provided for update",
    );
  });

  it("requires custom split details for custom bills", () => {
    expect(
      splitBillSchema.parse({
        splitType: "custom",
        customAmounts: [{ memberId, amount: 50 }],
      }),
    ).toMatchObject({
      splitType: "custom",
      serviceChargeRate: 0,
      taxRate: 0,
    });

    expect(() => splitBillSchema.parse({ splitType: "custom" })).toThrow(
      "Custom splits or custom amounts are required when split type is custom",
    );
  });

  /**
   * Rates are fractions, the same as `restaurants.settings.taxRate` and what
   * `calculateOrderTotal` expects: 0.1 is 10%. The bound used to be 100, which
   * accepted a percentage-shaped 10 — a hundredfold overcharge that looked
   * like a perfectly ordinary value.
   */
  it("accepts rates as fractions and rejects percentage-shaped ones", () => {
    expect(
      splitBillSchema.parse({
        splitType: "equal",
        serviceChargeRate: 0.1,
        taxRate: 0.05,
      }),
    ).toMatchObject({ serviceChargeRate: 0.1, taxRate: 0.05 });

    expect(() =>
      splitBillSchema.parse({ splitType: "equal", serviceChargeRate: 10 }),
    ).toThrow();
    expect(() =>
      splitBillSchema.parse({ splitType: "equal", taxRate: 5 }),
    ).toThrow();
  });

  it("normalizes activity and statistics queries", () => {
    expect(activitiesQuerySchema.parse({ limit: "10", offset: "5" })).toEqual({
      limit: 10,
      offset: 5,
    });
    expect(
      statisticsQuerySchema.parse({
        restaurantId: " ",
        startDate: "",
        endDate: "",
      }),
    ).toEqual({
      timeRange: "month",
      restaurantId: undefined,
      startDate: undefined,
      endDate: undefined,
    });
  });

  it("validates helper permission and amount checks", () => {
    expect(
      validateGroupOrderPermissions({ canModifyOthersCart: true }, 3),
    ).toEqual({
      valid: false,
      error: "Insufficient permissions for: canModifyOthersCart",
    });
    expect(validateGroupOrderPermissions(undefined, 1)).toEqual({
      valid: true,
    });
    expect(validateCartItemQuantity(3, 2)).toEqual({
      valid: false,
      error: "Only 2 items available in stock",
    });
    expect(validatePaymentAmount(20, 10)).toEqual({
      valid: false,
      error: "Payment amount (20) exceeds total due (10)",
    });
  });
});
