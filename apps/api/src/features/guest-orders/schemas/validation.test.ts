import { describe, expect, it } from "vitest";
import { createGuestOrderSchema } from "./validation";

const baseGuestOrder = {
  restaurantId: "rest_123",
  guestName: "Guest",
  phoneLastDigits: "678",
  orderType: "shop",
  items: [{ menuItemId: 1, quantity: 1 }],
};

describe("guest order validation", () => {
  it("requires customerPhone when creating a waiting-list pre-order", () => {
    const result = createGuestOrderSchema.safeParse({
      ...baseGuestOrder,
      waitingListId: "wait_123",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["customerPhone"]);
  });

  it("accepts waiting-list pre-orders with ticket phone verification", () => {
    const result = createGuestOrderSchema.safeParse({
      ...baseGuestOrder,
      waitingListId: "wait_123",
      customerPhone: "0912345678",
    });

    expect(result.success).toBe(true);
  });
});
