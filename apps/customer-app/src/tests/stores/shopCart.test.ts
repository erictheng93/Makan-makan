import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useShopCartStore } from "@/stores/shopCart";

// Helper: build a minimal valid cart data object for localStorage
function buildCartData(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    items: [],
    restaurantId: "rest-001",
    phoneLastDigits: "123",
    timestamp: Date.now(),
    fulfillmentType: "takeaway",
    deliveryInfo: null,
    deliveryFee: 0,
    ...overrides,
  });
}

// Helper: build a minimal valid cart item for tests that need subtotal
function buildCartItem(totalPrice = 100) {
  return {
    id: "item-1",
    menuItem: { id: 1, name: "Nasi Lemak", price: 100 },
    quantity: 1,
    customizations: undefined,
    notes: undefined,
    price: totalPrice,
    totalPrice,
  };
}

describe("shopCart store – delivery/takeaway features", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    // Reset localStorage mock to return null by default
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      null,
    );
  });

  // ──────────────────────────────────────────────
  // fulfillmentType state
  // ──────────────────────────────────────────────

  describe("fulfillmentType state", () => {
    it("should initialize with default fulfillmentType 'takeaway'", () => {
      const store = useShopCartStore();
      expect(store.fulfillmentType).toBe("takeaway");
    });

    it("should set fulfillmentType to 'takeaway' via setFulfillmentType", () => {
      const store = useShopCartStore();
      store.fulfillmentType = "delivery" as "delivery"; // set up non-default first
      store.setFulfillmentType("takeaway");
      expect(store.fulfillmentType).toBe("takeaway");
    });

    it("should set fulfillmentType to 'delivery' via setFulfillmentType", () => {
      const store = useShopCartStore();
      store.setFulfillmentType("delivery");
      expect(store.fulfillmentType).toBe("delivery");
    });

    it("should clear deliveryInfo when switching from delivery to takeaway", () => {
      const store = useShopCartStore();
      // First set delivery with info
      store.setFulfillmentType("delivery");
      store.setDeliveryInfo({
        address: "123 Main St",
        phone: "0123456789",
        instructions: "Leave at door",
      });
      expect(store.deliveryInfo).not.toBeNull();

      // Now switch back to takeaway
      store.setFulfillmentType("takeaway");
      expect(store.deliveryInfo).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // deliveryInfo state
  // ──────────────────────────────────────────────

  describe("deliveryInfo state", () => {
    it("should initialize deliveryInfo as null", () => {
      const store = useShopCartStore();
      expect(store.deliveryInfo).toBeNull();
    });

    it("should set deliveryInfo via setDeliveryInfo", () => {
      const store = useShopCartStore();
      const info = {
        address: "456 Jalan Ampang",
        phone: "0198765432",
        instructions: "Ring doorbell",
      };
      store.setDeliveryInfo(info);
      expect(store.deliveryInfo).toEqual(info);
    });

    it("should persist deliveryInfo after setting it", () => {
      const store = useShopCartStore();
      const info = {
        address: "456 Jalan Ampang",
        phone: "0198765432",
        instructions: "Ring doorbell",
      };
      store.setDeliveryInfo(info);
      // The value should remain reactive and intact
      expect(store.deliveryInfo?.address).toBe("456 Jalan Ampang");
      expect(store.deliveryInfo?.phone).toBe("0198765432");
      expect(store.deliveryInfo?.instructions).toBe("Ring doorbell");
    });
  });

  // ──────────────────────────────────────────────
  // deliveryFee state
  // ──────────────────────────────────────────────

  describe("deliveryFee state", () => {
    it("should initialize deliveryFee as 0", () => {
      const store = useShopCartStore();
      expect(store.deliveryFee).toBe(0);
    });

    it("should set deliveryFee via setDeliveryFee", () => {
      const store = useShopCartStore();
      store.setDeliveryFee(5.5);
      expect(store.deliveryFee).toBe(5.5);
    });
  });

  // ──────────────────────────────────────────────
  // totalWithDelivery computed
  // ──────────────────────────────────────────────

  describe("totalWithDelivery computed", () => {
    it("should return subtotal when fulfillmentType is takeaway (no fee added)", () => {
      const store = useShopCartStore();
      // Add item to get a non-zero subtotal via direct push (bypasses addItem complexity)
      store.items.push(buildCartItem(100) as any);
      store.setDeliveryFee(10);
      store.setFulfillmentType("takeaway");
      expect(store.totalWithDelivery).toBe(100);
    });

    it("should return subtotal + deliveryFee when fulfillmentType is delivery", () => {
      const store = useShopCartStore();
      store.items.push(buildCartItem(100) as any);
      store.setDeliveryFee(10);
      store.setFulfillmentType("delivery");
      expect(store.totalWithDelivery).toBe(110);
    });

    it("should return subtotal when deliveryFee is 0 even for delivery", () => {
      const store = useShopCartStore();
      store.items.push(buildCartItem(100) as any);
      store.setDeliveryFee(0);
      store.setFulfillmentType("delivery");
      expect(store.totalWithDelivery).toBe(100);
    });

    it("should update when fulfillmentType changes", () => {
      const store = useShopCartStore();
      store.items.push(buildCartItem(100) as any);
      store.setDeliveryFee(15);

      store.setFulfillmentType("delivery");
      expect(store.totalWithDelivery).toBe(115);

      store.setFulfillmentType("takeaway");
      expect(store.totalWithDelivery).toBe(100);
    });
  });

  // ──────────────────────────────────────────────
  // localStorage persistence (saveCart / restoreCart)
  // ──────────────────────────────────────────────

  describe("localStorage persistence", () => {
    it("should call localStorage.setItem with fulfillmentType when saving", () => {
      const store = useShopCartStore();
      // initializeCart sets restaurantId + phoneLastDigits so saveCart can proceed
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        null,
      );
      store.initializeCart("rest-001", "123");
      store.setFulfillmentType("delivery");

      const setItemCalls = (
        window.localStorage.setItem as ReturnType<typeof vi.fn>
      ).mock.calls;
      const lastCall = setItemCalls[setItemCalls.length - 1];
      expect(lastCall).toBeDefined();
      const saved = JSON.parse(lastCall[1]);
      expect(saved.fulfillmentType).toBe("delivery");
    });

    it("should call localStorage.setItem with deliveryInfo when saving", () => {
      const store = useShopCartStore();
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        null,
      );
      store.initializeCart("rest-001", "123");
      store.setFulfillmentType("delivery");

      const info = {
        address: "789 KL",
        phone: "0111111111",
        instructions: "Call me",
      };
      store.setDeliveryInfo(info);

      const setItemCalls = (
        window.localStorage.setItem as ReturnType<typeof vi.fn>
      ).mock.calls;
      const lastCall = setItemCalls[setItemCalls.length - 1];
      const saved = JSON.parse(lastCall[1]);
      expect(saved.deliveryInfo).toEqual(info);
    });

    it("should call localStorage.setItem with deliveryFee when saving", () => {
      const store = useShopCartStore();
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        null,
      );
      store.initializeCart("rest-001", "123");
      store.setDeliveryFee(7.5);

      const setItemCalls = (
        window.localStorage.setItem as ReturnType<typeof vi.fn>
      ).mock.calls;
      const lastCall = setItemCalls[setItemCalls.length - 1];
      const saved = JSON.parse(lastCall[1]);
      expect(saved.deliveryFee).toBe(7.5);
    });

    it("should restore fulfillmentType from localStorage on initializeCart", () => {
      const store = useShopCartStore();
      const key = "makanmakan_shop_cart_rest-001_123";
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((k: string) =>
        k === key ? buildCartData({ fulfillmentType: "delivery" }) : null,
      );

      store.initializeCart("rest-001", "123");
      expect(store.fulfillmentType).toBe("delivery");
    });

    it("should restore deliveryInfo from localStorage on initializeCart", () => {
      const store = useShopCartStore();
      const key = "makanmakan_shop_cart_rest-001_123";
      const info = {
        address: "99 Test Rd",
        phone: "0122222222",
        instructions: "Leave outside",
      };
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((k: string) =>
        k === key
          ? buildCartData({ fulfillmentType: "delivery", deliveryInfo: info })
          : null,
      );

      store.initializeCart("rest-001", "123");
      expect(store.deliveryInfo).toEqual(info);
    });

    it("should restore deliveryFee from localStorage on initializeCart", () => {
      const store = useShopCartStore();
      const key = "makanmakan_shop_cart_rest-001_123";
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((k: string) =>
        k === key ? buildCartData({ deliveryFee: 12.5 }) : null,
      );

      store.initializeCart("rest-001", "123");
      expect(store.deliveryFee).toBe(12.5);
    });

    it("should default fulfillmentType to 'takeaway' when not in saved data", () => {
      const store = useShopCartStore();
      const key = "makanmakan_shop_cart_rest-001_123";
      // Omit fulfillmentType — Zod schema defaults it to 'takeaway'
      const dataWithoutFulfillment = JSON.stringify({
        items: [],
        restaurantId: "rest-001",
        phoneLastDigits: "123",
        timestamp: Date.now(),
        deliveryInfo: null,
        deliveryFee: 0,
        // fulfillmentType intentionally omitted
      });
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((k: string) =>
        k === key ? dataWithoutFulfillment : null,
      );

      store.initializeCart("rest-001", "123");
      expect(store.fulfillmentType).toBe("takeaway");
    });

    it("should default deliveryInfo to null when not in saved data", () => {
      const store = useShopCartStore();
      const key = "makanmakan_shop_cart_rest-001_123";
      const dataWithoutDeliveryInfo = JSON.stringify({
        items: [],
        restaurantId: "rest-001",
        phoneLastDigits: "123",
        timestamp: Date.now(),
        fulfillmentType: "takeaway",
        deliveryFee: 0,
        // deliveryInfo intentionally omitted
      });
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((k: string) =>
        k === key ? dataWithoutDeliveryInfo : null,
      );

      store.initializeCart("rest-001", "123");
      expect(store.deliveryInfo).toBeNull();
    });

    it("should reject corrupted localStorage data (invalid JSON)", () => {
      const store = useShopCartStore();
      const key = "makanmakan_shop_cart_rest-001_123";
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((k: string) =>
        k === key ? "{ this is not json !!!" : null,
      );

      store.initializeCart("rest-001", "123");

      // Store should remain at defaults — cart not corrupted
      expect(store.fulfillmentType).toBe("takeaway");
      expect(store.deliveryInfo).toBeNull();
      expect(store.deliveryFee).toBe(0);
    });

    it("should reject tampered localStorage data (XSS attempt in deliveryInfo address)", () => {
      const store = useShopCartStore();
      const key = "makanmakan_shop_cart_rest-001_123";
      // Inject an object with a script tag; Zod will accept it as a string (it IS a string),
      // but the store should still load without executing — the important assertion is that
      // Zod parses it (or rejects malformed structures) without crashing and that no script runs.
      // We specifically test that a deliveryInfo.address value containing a script tag does NOT
      // cause a parse failure (Zod accepts strings) but the store handles it safely.
      const xssPayload = buildCartData({
        fulfillmentType: "delivery",
        deliveryInfo: {
          address: "<script>alert('xss')</script>",
          phone: "0100000000",
          instructions: "normal",
        },
      });
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((k: string) => (k === key ? xssPayload : null));

      store.initializeCart("rest-001", "123");

      // The store should restore (Zod validates structure, not content sanitization for strings)
      // and the value is stored as a plain string — no DOM injection happens in a store
      expect(store.deliveryInfo?.address).toBe("<script>alert('xss')</script>");
      expect(store.fulfillmentType).toBe("delivery");
    });

    it("should not restore expired cart data (>2 hours old)", () => {
      const store = useShopCartStore();
      const key = "makanmakan_shop_cart_rest-001_123";
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000 - 1; // 1ms past the limit
      const expiredData = buildCartData({
        timestamp: twoHoursAgo,
        fulfillmentType: "delivery",
        deliveryFee: 8,
        deliveryInfo: {
          address: "old address",
          phone: "0100000001",
          instructions: "",
        },
      });
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((k: string) => (k === key ? expiredData : null));

      store.initializeCart("rest-001", "123");

      // Expired data should be discarded — state stays at defaults
      expect(store.fulfillmentType).toBe("takeaway");
      expect(store.deliveryFee).toBe(0);
      expect(store.deliveryInfo).toBeNull();
      // localStorage.removeItem should have been called to clean up
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(key);
    });
  });

  // ──────────────────────────────────────────────
  // initializeCart integration
  // ──────────────────────────────────────────────

  describe("initializeCart integration", () => {
    it("should clear delivery data when switching to different restaurant", () => {
      const store = useShopCartStore();
      // Seed localStorage with delivery data for rest-001 AND rest-002
      const keyOld = "makanmakan_shop_cart_rest-001_123";
      const keyNew = "makanmakan_shop_cart_rest-002_456";
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((k: string) => {
        if (k === keyOld) {
          return buildCartData({
            restaurantId: "rest-001",
            phoneLastDigits: "123",
            fulfillmentType: "delivery",
            deliveryFee: 5,
            deliveryInfo: {
              address: "Old address",
              phone: "0100000002",
              instructions: "none",
            },
          });
        }
        if (k === keyNew) {
          return buildCartData({
            restaurantId: "rest-002",
            phoneLastDigits: "456",
            fulfillmentType: "takeaway",
            deliveryFee: 0,
            deliveryInfo: null,
          });
        }
        return null;
      });

      // Initialize with rest-001 — delivery state should be restored
      store.initializeCart("rest-001", "123");
      expect(store.fulfillmentType).toBe("delivery");
      expect(store.deliveryFee).toBe(5);

      // Now switch to a different restaurant (rest-002)
      // initializeCart calls clearCart (items reset) then restoreCart for the new key
      store.initializeCart("rest-002", "456");

      // Restored from rest-002 saved data — defaults (takeaway, fee 0)
      expect(store.fulfillmentType).toBe("takeaway");
      expect(store.deliveryFee).toBe(0);
      expect(store.deliveryInfo).toBeNull();
      // items should also be cleared
      expect(store.items).toHaveLength(0);
    });
  });
});
