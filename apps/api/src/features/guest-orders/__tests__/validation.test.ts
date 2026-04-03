/**
 * Guest Orders Validation Schema Tests
 * 訪客點餐驗證模式測試
 */

import { describe, it, expect } from "vitest";
import {
  createGuestOrderSchema,
  addGuestOrderItemsSchema,
} from "../schemas/validation";

describe("Guest Orders Validation Schemas", () => {
  describe("createGuestOrderSchema", () => {
    const validShopOrder = {
      restaurantId: "01234567-89ab-cdef-0123-456789abcdef",
      guestName: "Eric",
      phoneLastDigits: "456",
      orderType: "shop" as const,
      items: [{ menuItemId: 1, quantity: 2 }],
    };

    const validTableOrder = {
      ...validShopOrder,
      orderType: "table" as const,
      tableId: 5,
    };

    const validSeatOrder = {
      ...validShopOrder,
      orderType: "seat" as const,
      tableId: 5,
      seatId: 12,
    };

    // ─── Happy Paths ───

    it("should validate a valid shop order", () => {
      const result = createGuestOrderSchema.safeParse(validShopOrder);
      expect(result.success).toBe(true);
    });

    it("should validate a valid table order", () => {
      const result = createGuestOrderSchema.safeParse(validTableOrder);
      expect(result.success).toBe(true);
    });

    it("should validate a valid seat order", () => {
      const result = createGuestOrderSchema.safeParse(validSeatOrder);
      expect(result.success).toBe(true);
    });

    it("should accept optional notes", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        notes: "No spicy please",
      });
      expect(result.success).toBe(true);
    });

    it("should accept items with customizations", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        items: [
          {
            menuItemId: 1,
            quantity: 1,
            customizations: {
              size: { id: "lg", name: "Large", priceAdjustment: 20 },
              specialInstructions: "Extra sauce",
            },
            notes: "For kid",
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    // ─── Guest Name Validation ───

    it("should accept empty guestName (defaults to 'Guest')", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        guestName: "",
      });
      expect(result.success).toBe(true);
    });

    it("should reject guestName over 50 chars", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        guestName: "A".repeat(51),
      });
      expect(result.success).toBe(false);
    });

    // ─── Phone Last Digits Validation ───

    it("should reject phoneLastDigits with fewer than 3 digits", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        phoneLastDigits: "45",
      });
      expect(result.success).toBe(false);
    });

    it("should reject phoneLastDigits with more than 3 digits", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        phoneLastDigits: "4567",
      });
      expect(result.success).toBe(false);
    });

    it("should reject phoneLastDigits with non-digit characters", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        phoneLastDigits: "abc",
      });
      expect(result.success).toBe(false);
    });

    it("should reject phoneLastDigits with mixed chars", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        phoneLastDigits: "4a6",
      });
      expect(result.success).toBe(false);
    });

    // ─── Order Type / Table / Seat Constraints ───

    it("should reject table order without tableId", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        orderType: "table",
        // no tableId
      });
      expect(result.success).toBe(false);
    });

    it("should reject seat order without tableId", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        orderType: "seat",
        seatId: 12,
        // no tableId
      });
      expect(result.success).toBe(false);
    });

    it("should reject seat order without seatId", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        orderType: "seat",
        tableId: 5,
        // no seatId
      });
      expect(result.success).toBe(false);
    });

    it("should accept shop order without tableId or seatId", () => {
      const { tableId: _t, seatId: _s, ...shopOnly } = validSeatOrder;
      const result = createGuestOrderSchema.safeParse({
        ...shopOnly,
        orderType: "shop",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid orderType", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        orderType: "delivery",
      });
      expect(result.success).toBe(false);
    });

    // ─── Items Validation ───

    it("should reject empty items array", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        items: [],
      });
      expect(result.success).toBe(false);
    });

    it("should reject more than 20 items", () => {
      const items = Array.from({ length: 21 }, (_, i) => ({
        menuItemId: i + 1,
        quantity: 1,
      }));
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        items,
      });
      expect(result.success).toBe(false);
    });

    it("should accept exactly 20 items", () => {
      const items = Array.from({ length: 20 }, (_, i) => ({
        menuItemId: i + 1,
        quantity: 1,
      }));
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        items,
      });
      expect(result.success).toBe(true);
    });

    it("should reject item with zero quantity", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        items: [{ menuItemId: 1, quantity: 0 }],
      });
      expect(result.success).toBe(false);
    });

    it("should reject item with quantity over 99", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        items: [{ menuItemId: 1, quantity: 100 }],
      });
      expect(result.success).toBe(false);
    });

    it("should reject item with negative menuItemId", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        items: [{ menuItemId: -1, quantity: 1 }],
      });
      expect(result.success).toBe(false);
    });

    // ─── Notes Validation ───

    it("should reject notes over 500 chars", () => {
      const result = createGuestOrderSchema.safeParse({
        ...validShopOrder,
        notes: "X".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    // ─── Missing Required Fields ───

    it("should reject missing restaurantId", () => {
      const { restaurantId: _r, ...rest } = validShopOrder;
      const result = createGuestOrderSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("should accept missing guestName (defaults to 'Guest')", () => {
      const { guestName: _g, ...rest } = validShopOrder;
      const result = createGuestOrderSchema.safeParse(rest);
      expect(result.success).toBe(true);
    });

    it("should accept missing phoneLastDigits (defaults to '000')", () => {
      const { phoneLastDigits: _p, ...rest } = validShopOrder;
      const result = createGuestOrderSchema.safeParse(rest);
      expect(result.success).toBe(true);
    });
  });

  describe("deliveryInfo validation", () => {
    it("should accept valid takeaway deliveryInfo", () => {
      const data = {
        restaurantId: "test-restaurant-id",
        guestName: "Eric",
        orderType: "shop",
        items: [{ menuItemId: 1, quantity: 1 }],
        phoneLastDigits: "123",
        deliveryInfo: { type: "takeaway" },
      };
      const result = createGuestOrderSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should accept valid delivery deliveryInfo with address and phone", () => {
      const data = {
        restaurantId: "test-restaurant-id",
        guestName: "Eric",
        orderType: "shop",
        items: [{ menuItemId: 1, quantity: 1 }],
        phoneLastDigits: "123",
        deliveryInfo: {
          type: "delivery",
          address: "台北市大安區忠孝東路四段100號",
          phone: "0912345678",
          instructions: "放門口",
          deliveryFee: 60,
        },
      };
      const result = createGuestOrderSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should reject delivery without address", () => {
      const data = {
        restaurantId: "test-restaurant-id",
        guestName: "Eric",
        orderType: "shop",
        items: [{ menuItemId: 1, quantity: 1 }],
        phoneLastDigits: "123",
        deliveryInfo: { type: "delivery", phone: "0912345678" },
      };
      const result = createGuestOrderSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject delivery without phone", () => {
      const data = {
        restaurantId: "test-restaurant-id",
        guestName: "Eric",
        orderType: "shop",
        items: [{ menuItemId: 1, quantity: 1 }],
        phoneLastDigits: "123",
        deliveryInfo: { type: "delivery", address: "台北市大安區" },
      };
      const result = createGuestOrderSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe("addGuestOrderItemsSchema", () => {
    it("should validate valid items addition", () => {
      const result = addGuestOrderItemsSchema.safeParse({
        items: [
          { menuItemId: 1, quantity: 2 },
          { menuItemId: 3, quantity: 1 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty items", () => {
      const result = addGuestOrderItemsSchema.safeParse({ items: [] });
      expect(result.success).toBe(false);
    });

    it("should reject more than 20 items", () => {
      const items = Array.from({ length: 21 }, (_, i) => ({
        menuItemId: i + 1,
        quantity: 1,
      }));
      const result = addGuestOrderItemsSchema.safeParse({ items });
      expect(result.success).toBe(false);
    });

    it("should reject missing items field", () => {
      const result = addGuestOrderItemsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
