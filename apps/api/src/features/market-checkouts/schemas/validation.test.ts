import { describe, expect, it } from "vitest";
import { createMarketCheckoutSchema } from "./validation";

describe("createMarketCheckoutSchema", () => {
  const validPayload = {
    marketSlug: "fengjia",
    guestName: "Guest",
    phoneLastDigits: "123",
    vendors: [
      {
        restaurantId: "restaurant-1",
        items: [{ menuItemId: 1, quantity: 2 }],
      },
      {
        restaurantId: "restaurant-2",
        items: [{ menuItemId: 2, quantity: 1 }],
      },
    ],
  };

  it("accepts a multi-vendor market checkout payload", () => {
    const result = createMarketCheckoutSchema.safeParse(validPayload);

    expect(result.success).toBe(true);
  });

  it("requires at least two vendors", () => {
    const result = createMarketCheckoutSchema.safeParse({
      ...validPayload,
      vendors: [validPayload.vendors[0]],
    });

    expect(result.success).toBe(false);
  });

  it("sanitizes user-provided notes", () => {
    const result = createMarketCheckoutSchema.parse({
      ...validPayload,
      notes: '<script>alert("x")</script>',
    });

    expect(result.notes).toBe("scriptalert(x)/script");
  });
});
