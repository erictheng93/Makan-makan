import { describe, expect, it } from "vitest";
import { createOrderSchema } from "./validation";

const baseOrder = {
  restaurantId: "rest_123",
  items: [{ menuItemId: 1, quantity: 1 }],
};

describe("order validation", () => {
  it("requires customerPhone when creating a waiting-list pre-order", () => {
    const result = createOrderSchema.safeParse({
      ...baseOrder,
      waitingListId: "wait_123",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["customerPhone"]);
  });

  it("accepts waiting-list pre-orders with ticket phone verification", () => {
    const result = createOrderSchema.safeParse({
      ...baseOrder,
      waitingListId: "wait_123",
      customerPhone: "0912345678",
    });

    expect(result.success).toBe(true);
  });
});
