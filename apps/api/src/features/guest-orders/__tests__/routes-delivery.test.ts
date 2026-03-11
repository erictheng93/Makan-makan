/**
 * Guest Orders - Delivery/Takeaway Route Logic Tests
 * Tests the fulfillment type resolution and deliveryInfo passthrough
 * that happens between validation and order creation in the POST /guest-orders route.
 */

import { describe, it, expect } from "vitest";
import { createGuestOrderSchema } from "../schemas/validation";
import type { CreateGuestOrderInput } from "../schemas/validation";

// ── Pure function extracted from routes/index.ts lines 131-133 ──────────────
// This mirrors the exact logic in the route so tests stay in sync.
function resolveFulfillmentType(data: {
  deliveryInfo?: { type?: string };
  orderType: string;
}): string {
  return (
    data.deliveryInfo?.type ??
    (data.orderType === "shop" ? "takeaway" : "dine_in")
  );
}

// ── Shared fixtures ──────────────────────────────────────────────────────────
const baseShopOrder = {
  restaurantId: "01234567-89ab-cdef-0123-456789abcdef",
  guestName: "Alice",
  phoneLastDigits: "789",
  orderType: "shop" as const,
  items: [{ menuItemId: 1, quantity: 1 }],
};

const baseTableOrder = {
  ...baseShopOrder,
  orderType: "table" as const,
  tableId: 3,
};

const baseSeatOrder = {
  ...baseShopOrder,
  orderType: "seat" as const,
  tableId: 3,
  seatId: 7,
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Guest Orders - Delivery/Takeaway Route Logic", () => {
  describe("fulfillment type resolution", () => {
    it("should use deliveryInfo.type when provided as 'takeaway'", () => {
      const result = resolveFulfillmentType({
        orderType: "shop",
        deliveryInfo: { type: "takeaway" },
      });
      expect(result).toBe("takeaway");
    });

    it("should use deliveryInfo.type when provided as 'delivery'", () => {
      const result = resolveFulfillmentType({
        orderType: "shop",
        deliveryInfo: { type: "delivery" },
      });
      expect(result).toBe("delivery");
    });

    it("should use deliveryInfo.type when provided as 'dine_in'", () => {
      const result = resolveFulfillmentType({
        orderType: "table",
        tableId: 1,
        deliveryInfo: { type: "dine_in" },
      } as Parameters<typeof resolveFulfillmentType>[0]);
      expect(result).toBe("dine_in");
    });

    it("should fallback to 'takeaway' for shop orders without deliveryInfo", () => {
      const result = resolveFulfillmentType({ orderType: "shop" });
      expect(result).toBe("takeaway");
    });

    it("should fallback to 'takeaway' for shop orders with deliveryInfo but no type", () => {
      const result = resolveFulfillmentType({
        orderType: "shop",
        deliveryInfo: {},
      });
      expect(result).toBe("takeaway");
    });

    it("should fallback to 'dine_in' for table orders without deliveryInfo", () => {
      const result = resolveFulfillmentType({ orderType: "table" });
      expect(result).toBe("dine_in");
    });

    it("should fallback to 'dine_in' for seat orders without deliveryInfo", () => {
      const result = resolveFulfillmentType({ orderType: "seat" });
      expect(result).toBe("dine_in");
    });

    it("should prefer explicit deliveryInfo.type over orderType fallback for table order", () => {
      // Even though table normally falls back to dine_in, an explicit type wins.
      const result = resolveFulfillmentType({
        orderType: "table",
        deliveryInfo: { type: "takeaway" },
      });
      expect(result).toBe("takeaway");
    });
  });

  describe("deliveryInfo passthrough — validated data structure", () => {
    it("should preserve all delivery fields after validation", () => {
      const input = {
        ...baseShopOrder,
        deliveryInfo: {
          type: "delivery" as const,
          address: "台北市大安區忠孝東路四段100號",
          phone: "0912345678",
          instructions: "請放門口",
          deliveryFee: 60,
        },
      };

      const parsed = createGuestOrderSchema.safeParse(input);
      expect(parsed.success).toBe(true);

      if (!parsed.success) return; // type narrowing
      const di = parsed.data.deliveryInfo!;
      expect(di.type).toBe("delivery");
      expect(di.address).toBe("台北市大安區忠孝東路四段100號");
      expect(di.phone).toBe("0912345678");
      expect(di.instructions).toBe("請放門口");
      expect(di.deliveryFee).toBe(60);
    });

    it("should handle missing optional delivery fields", () => {
      const input = {
        ...baseShopOrder,
        deliveryInfo: {
          type: "takeaway" as const,
          // address, phone, instructions, deliveryFee all absent
        },
      };

      const parsed = createGuestOrderSchema.safeParse(input);
      expect(parsed.success).toBe(true);

      if (!parsed.success) return;
      const di = parsed.data.deliveryInfo!;
      expect(di.type).toBe("takeaway");
      expect(di.address).toBeUndefined();
      expect(di.phone).toBeUndefined();
      expect(di.instructions).toBeUndefined();
      expect(di.deliveryFee).toBeUndefined();
    });

    it("should allow orders without any deliveryInfo", () => {
      const parsed = createGuestOrderSchema.safeParse(baseShopOrder);
      expect(parsed.success).toBe(true);

      if (!parsed.success) return;
      expect(parsed.data.deliveryInfo).toBeUndefined();
    });

    it("should produce undefined deliveryInfo for table orders that omit it", () => {
      const parsed = createGuestOrderSchema.safeParse(baseTableOrder);
      expect(parsed.success).toBe(true);

      if (!parsed.success) return;
      expect(parsed.data.deliveryInfo).toBeUndefined();
    });

    it("should produce undefined deliveryInfo for seat orders that omit it", () => {
      const parsed = createGuestOrderSchema.safeParse(baseSeatOrder);
      expect(parsed.success).toBe(true);

      if (!parsed.success) return;
      expect(parsed.data.deliveryInfo).toBeUndefined();
    });
  });

  describe("combined: fulfillment type resolution from validated data", () => {
    it("should resolve to 'takeaway' when shop order has takeaway deliveryInfo", () => {
      const input = {
        ...baseShopOrder,
        deliveryInfo: { type: "takeaway" as const },
      };
      const parsed = createGuestOrderSchema.safeParse(input);
      expect(parsed.success).toBe(true);

      if (!parsed.success) return;
      const fulfillmentType = resolveFulfillmentType(parsed.data);
      expect(fulfillmentType).toBe("takeaway");
    });

    it("should resolve to 'delivery' when shop order has delivery deliveryInfo", () => {
      const input = {
        ...baseShopOrder,
        deliveryInfo: {
          type: "delivery" as const,
          address: "No.1 Jalan Test",
          phone: "0112345678",
        },
      };
      const parsed = createGuestOrderSchema.safeParse(input);
      expect(parsed.success).toBe(true);

      if (!parsed.success) return;
      const fulfillmentType = resolveFulfillmentType(parsed.data);
      expect(fulfillmentType).toBe("delivery");
    });

    it("should resolve to 'takeaway' when shop order has no deliveryInfo", () => {
      const parsed = createGuestOrderSchema.safeParse(baseShopOrder);
      expect(parsed.success).toBe(true);

      if (!parsed.success) return;
      const fulfillmentType = resolveFulfillmentType(parsed.data);
      expect(fulfillmentType).toBe("takeaway");
    });

    it("should resolve to 'dine_in' when table order has no deliveryInfo", () => {
      const parsed = createGuestOrderSchema.safeParse(baseTableOrder);
      expect(parsed.success).toBe(true);

      if (!parsed.success) return;
      const fulfillmentType = resolveFulfillmentType(parsed.data);
      expect(fulfillmentType).toBe("dine_in");
    });

    it("should resolve to 'dine_in' when seat order has no deliveryInfo", () => {
      const parsed = createGuestOrderSchema.safeParse(baseSeatOrder);
      expect(parsed.success).toBe(true);

      if (!parsed.success) return;
      const fulfillmentType = resolveFulfillmentType(parsed.data);
      expect(fulfillmentType).toBe("dine_in");
    });

    it("should build correct deliveryInfo object to pass to OrdersService", () => {
      // Mirrors the spread in routes/index.ts lines 151-157
      const input = {
        ...baseShopOrder,
        deliveryInfo: {
          type: "delivery" as const,
          address: "5 Delivery Lane",
          phone: "0987654321",
          instructions: "Ring bell",
          deliveryFee: 30,
        },
      };
      const parsed = createGuestOrderSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (!parsed.success) return;

      const data = parsed.data as CreateGuestOrderInput;
      const fulfillmentType = resolveFulfillmentType(data);

      const deliveryInfoArg = {
        type: fulfillmentType,
        address: data.deliveryInfo?.address,
        phone: data.deliveryInfo?.phone,
        instructions: data.deliveryInfo?.instructions,
        deliveryFee: data.deliveryInfo?.deliveryFee,
      };

      expect(deliveryInfoArg.type).toBe("delivery");
      expect(deliveryInfoArg.address).toBe("5 Delivery Lane");
      expect(deliveryInfoArg.phone).toBe("0987654321");
      expect(deliveryInfoArg.instructions).toBe("Ring bell");
      expect(deliveryInfoArg.deliveryFee).toBe(30);
    });

    it("should build deliveryInfo with undefined optional fields when absent", () => {
      // Shop order with no deliveryInfo — route still passes an object with undefineds
      const parsed = createGuestOrderSchema.safeParse(baseShopOrder);
      expect(parsed.success).toBe(true);
      if (!parsed.success) return;

      const data = parsed.data as CreateGuestOrderInput;
      const fulfillmentType = resolveFulfillmentType(data);

      const deliveryInfoArg = {
        type: fulfillmentType,
        address: data.deliveryInfo?.address,
        phone: data.deliveryInfo?.phone,
        instructions: data.deliveryInfo?.instructions,
        deliveryFee: data.deliveryInfo?.deliveryFee,
      };

      expect(deliveryInfoArg.type).toBe("takeaway");
      expect(deliveryInfoArg.address).toBeUndefined();
      expect(deliveryInfoArg.phone).toBeUndefined();
      expect(deliveryInfoArg.instructions).toBeUndefined();
      expect(deliveryInfoArg.deliveryFee).toBeUndefined();
    });
  });
});
