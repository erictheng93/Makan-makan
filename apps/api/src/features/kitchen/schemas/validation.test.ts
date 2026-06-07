import { describe, expect, it } from "vitest";
import {
  kitchenOrdersQuerySchema,
  orderItemParamsSchema,
  orderItemStatusUpdateSchema,
  restaurantIdSchema,
} from "./validation";

describe("kitchen validation schemas", () => {
  it("applies status update defaults", () => {
    expect(orderItemStatusUpdateSchema.parse({ status: "ready" })).toEqual({
      status: "ready",
      notes: "",
    });

    expect(() =>
      orderItemStatusUpdateSchema.parse({ status: "cancelled" }),
    ).toThrow();
  });

  it("transforms positive integer route params", () => {
    expect(restaurantIdSchema.parse({ restaurantId: "12" })).toEqual({
      restaurantId: 12,
    });
    expect(
      orderItemParamsSchema.parse({
        restaurantId: "12",
        orderId: "34",
        itemId: "56",
      }),
    ).toEqual({ restaurantId: 12, orderId: 34, itemId: 56 });

    expect(() => restaurantIdSchema.parse({ restaurantId: "0" })).toThrow(
      "Restaurant ID must be a positive integer",
    );
  });

  it("normalizes order query params", () => {
    expect(kitchenOrdersQuerySchema.parse({})).toEqual({
      includeHistory: false,
      limit: 50,
    });
    expect(
      kitchenOrdersQuerySchema.parse({ includeHistory: "true", limit: "500" }),
    ).toEqual({
      includeHistory: true,
      limit: 200,
    });
    expect(kitchenOrdersQuerySchema.parse({ limit: "not-a-number" })).toEqual({
      includeHistory: false,
      limit: 50,
    });
  });
});
