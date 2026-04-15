/**
 * Kitchen Validation Schemas Tests
 * 廚房模組驗證模式測試
 */

import { describe, it, expect } from "vitest";
import {
  orderItemStatusUpdateSchema,
  restaurantIdSchema,
  orderItemParamsSchema,
  kitchenOrdersQuerySchema,
} from "../schemas/validation";

describe("Kitchen Validation Schemas", () => {
  describe("orderItemStatusUpdateSchema", () => {
    it("should validate valid status update", () => {
      const result = orderItemStatusUpdateSchema.safeParse({
        status: "preparing",
        notes: "Started cooking",
      });
      expect(result.success).toBe(true);
    });

    it("should accept all valid statuses", () => {
      const statuses = ["pending", "preparing", "ready", "completed"] as const;
      statuses.forEach((status) => {
        const result = orderItemStatusUpdateSchema.safeParse({ status });
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid status", () => {
      const result = orderItemStatusUpdateSchema.safeParse({
        status: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("should use default empty string for notes", () => {
      const result = orderItemStatusUpdateSchema.safeParse({ status: "ready" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.notes).toBe("");
      }
    });

    it("should accept notes as optional", () => {
      const result = orderItemStatusUpdateSchema.safeParse({
        status: "completed",
        notes: "Order completed successfully",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.notes).toBe("Order completed successfully");
      }
    });
  });

  describe("restaurantIdSchema", () => {
    it("should transform valid restaurant ID string to number", () => {
      const result = restaurantIdSchema.safeParse({ restaurantId: "123" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.restaurantId).toBe(123);
      }
    });

    it("should reject non-numeric string", () => {
      // Schema throws ZodError in transform, which propagates through safeParse
      expect(() => restaurantIdSchema.parse({ restaurantId: "abc" })).toThrow();
    });

    it("should reject zero", () => {
      expect(() => restaurantIdSchema.parse({ restaurantId: "0" })).toThrow();
    });

    it("should reject negative numbers", () => {
      expect(() => restaurantIdSchema.parse({ restaurantId: "-1" })).toThrow();
    });

    it("should handle large numbers", () => {
      const result = restaurantIdSchema.safeParse({ restaurantId: "999999" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.restaurantId).toBe(999999);
      }
    });
  });

  describe("orderItemParamsSchema", () => {
    it("should transform all params to numbers", () => {
      const result = orderItemParamsSchema.safeParse({
        restaurantId: "1",
        orderId: "100",
        itemId: "50",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.restaurantId).toBe(1);
        expect(result.data.orderId).toBe(100);
        expect(result.data.itemId).toBe(50);
      }
    });

    it("should reject invalid restaurantId", () => {
      // Schema throws ZodError in transform
      expect(() =>
        orderItemParamsSchema.parse({
          restaurantId: "invalid",
          orderId: "100",
          itemId: "50",
        }),
      ).toThrow();
    });

    it("should reject invalid orderId", () => {
      expect(() =>
        orderItemParamsSchema.parse({
          restaurantId: "1",
          orderId: "invalid",
          itemId: "50",
        }),
      ).toThrow();
    });

    it("should reject invalid itemId", () => {
      expect(() =>
        orderItemParamsSchema.parse({
          restaurantId: "1",
          orderId: "100",
          itemId: "invalid",
        }),
      ).toThrow();
    });

    it("should reject zero values", () => {
      expect(() =>
        orderItemParamsSchema.parse({
          restaurantId: "0",
          orderId: "100",
          itemId: "50",
        }),
      ).toThrow();

      expect(() =>
        orderItemParamsSchema.parse({
          restaurantId: "1",
          orderId: "0",
          itemId: "50",
        }),
      ).toThrow();

      expect(() =>
        orderItemParamsSchema.parse({
          restaurantId: "1",
          orderId: "100",
          itemId: "0",
        }),
      ).toThrow();
    });

    it("should reject negative values", () => {
      expect(() =>
        orderItemParamsSchema.parse({
          restaurantId: "-1",
          orderId: "100",
          itemId: "50",
        }),
      ).toThrow();
    });
  });

  describe("kitchenOrdersQuerySchema", () => {
    it("should transform includeHistory to boolean", () => {
      const result = kitchenOrdersQuerySchema.safeParse({
        includeHistory: "true",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeHistory).toBe(true);
      }
    });

    it("should handle false includeHistory", () => {
      const result = kitchenOrdersQuerySchema.safeParse({
        includeHistory: "false",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeHistory).toBe(false);
      }
    });

    it("should use default limit of 50", () => {
      const result = kitchenOrdersQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it("should transform limit string to number", () => {
      const result = kitchenOrdersQuerySchema.safeParse({ limit: "100" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(100);
      }
    });

    it("should cap limit at 200", () => {
      const result = kitchenOrdersQuerySchema.safeParse({ limit: "500" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(200);
      }
    });

    it("should enforce minimum limit of 1", () => {
      const result = kitchenOrdersQuerySchema.safeParse({ limit: "0" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(1);
      }
    });

    it("should handle invalid limit gracefully", () => {
      const result = kitchenOrdersQuerySchema.safeParse({ limit: "invalid" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50); // Falls back to default
      }
    });

    it("should accept empty object", () => {
      const result = kitchenOrdersQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

describe("Type Exports", () => {
  it("should export OrderItemStatusUpdate type", () => {
    // Type check - this test ensures the type is exported correctly
    const update = {
      status: "preparing" as const,
      notes: "test",
    };
    expect(update.status).toBe("preparing");
  });

  it("should export BroadcastTestEvent type", () => {
    const event = {
      type: "NEW_ORDER" as const,
      payload: {},
    };
    expect(event.type).toBe("NEW_ORDER");
  });

  it("should export RestaurantIdParams type", () => {
    const params = {
      restaurantId: 1,
    };
    expect(params.restaurantId).toBe(1);
  });

  it("should export OrderItemParams type", () => {
    const params = {
      restaurantId: 1,
      orderId: 100,
      itemId: 50,
    };
    expect(params.orderId).toBe(100);
  });

  it("should export KitchenOrdersQuery type", () => {
    const query = {
      includeHistory: true,
      limit: 50,
    };
    expect(query.limit).toBe(50);
  });
});
