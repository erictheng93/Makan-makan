import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useCartStore } from "@/stores/cart";

// Helper: build a minimal MenuItem
function buildMenuItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Nasi Lemak",
    price: 10,
    ...overrides,
  };
}

// Helper: build valid cart data for localStorage
function buildCartData(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    items: [],
    restaurantId: "rest-001",
    tableId: 1,
    timestamp: Date.now(),
    ...overrides,
  });
}

describe("cart store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      null,
    );
  });

  // ──────────────────────────────────────────────
  // Initial state
  // ──────────────────────────────────────────────

  describe("initial state", () => {
    it("should start with empty items", () => {
      const store = useCartStore();
      expect(store.items).toEqual([]);
      expect(store.isEmpty).toBe(true);
      expect(store.itemCount).toBe(0);
      expect(store.subtotal).toBe(0);
    });

    it("should have null restaurantId and tableId", () => {
      const store = useCartStore();
      expect(store.restaurantId).toBeNull();
      expect(store.tableId).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // initializeCart
  // ──────────────────────────────────────────────

  describe("initializeCart", () => {
    it("should set restaurantId and tableId", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      expect(store.restaurantId).toBe("rest-001");
      expect(store.tableId).toBe(1);
    });

    it("should clear cart when switching to a different restaurant", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem() as any, 2);
      expect(store.items).toHaveLength(1);

      store.initializeCart("rest-002", 1);
      expect(store.items).toHaveLength(0);
    });

    it("should clear cart when switching to a different table", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem() as any, 1);

      store.initializeCart("rest-001", 2);
      expect(store.items).toHaveLength(0);
    });

    it("should restore cart from localStorage on initialize", () => {
      const key = "makanmakan_cart_rest-001_1";
      const savedData = buildCartData({
        items: [
          {
            id: "1",
            menuItem: { id: 1, name: "Nasi Lemak", price: 10 },
            quantity: 2,
            price: 10,
            totalPrice: 20,
          },
        ],
      });
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((k: string) => (k === key ? savedData : null));

      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      expect(store.items).toHaveLength(1);
      expect(store.itemCount).toBe(2);
    });
  });

  // ──────────────────────────────────────────────
  // addItem
  // ──────────────────────────────────────────────

  describe("addItem", () => {
    it("should add a new item to cart", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem() as any, 2);

      expect(store.items).toHaveLength(1);
      expect(store.itemCount).toBe(2);
      expect(store.subtotal).toBe(20);
    });

    it("should merge quantity for identical items", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem() as any, 1);
      store.addItem(buildMenuItem() as any, 3);

      expect(store.items).toHaveLength(1);
      expect(store.itemCount).toBe(4);
      expect(store.subtotal).toBe(40);
    });

    it("should treat items with different customizations as separate", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);

      const menuItem = buildMenuItem() as any;
      store.addItem(menuItem, 1, {
        size: { id: 1, name: "Large", priceAdjustment: 5 },
      });
      store.addItem(menuItem, 1, {
        size: { id: 2, name: "Small", priceAdjustment: 0 },
      });

      expect(store.items).toHaveLength(2);
    });

    it("should calculate price with size customization", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem({ price: 10 }) as any, 1, {
        size: { id: 1, name: "Large", priceAdjustment: 5 },
      });

      expect(store.items[0].price).toBe(15);
      expect(store.items[0].totalPrice).toBe(15);
    });

    it("should calculate price with addOns", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem({ price: 10 }) as any, 1, {
        addOns: [
          { id: 1, name: "Egg", unitPrice: 2 },
          { id: 2, name: "Sambal", unitPrice: 1 },
        ],
      });

      expect(store.items[0].price).toBe(13);
    });

    it("should calculate price with option adjustments", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem({ price: 10 }) as any, 1, {
        options: [
          { id: 1, name: "Extra spicy", priceAdjustment: 2 },
          { id: 2, name: "No onion", priceAdjustment: 0 },
        ],
      });

      expect(store.items[0].price).toBe(12);
    });

    it("should ensure price is never negative", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem({ price: 5 }) as any, 1, {
        size: { id: 1, name: "Tiny", priceAdjustment: -10 },
      });

      expect(store.items[0].price).toBe(0);
    });

    it("should treat items with different notes as separate", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);

      const menuItem = buildMenuItem() as any;
      store.addItem(menuItem, 1, undefined, "no peanuts");
      store.addItem(menuItem, 1, undefined, "extra sauce");

      expect(store.items).toHaveLength(2);
    });

    it("should persist to localStorage after adding", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem() as any, 1);

      expect(window.localStorage.setItem).toHaveBeenCalled();
      const calls = (window.localStorage.setItem as ReturnType<typeof vi.fn>)
        .mock.calls;
      const lastCall = calls[calls.length - 1];
      const saved = JSON.parse(lastCall[1]);
      expect(saved.items).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────
  // updateQuantity
  // ──────────────────────────────────────────────

  describe("updateQuantity", () => {
    it("should update item quantity and recalculate totalPrice", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem({ price: 10 }) as any, 1);

      const itemId = store.items[0].id;
      store.updateQuantity(itemId, 5);

      expect(store.items[0].quantity).toBe(5);
      expect(store.items[0].totalPrice).toBe(50);
    });

    it("should remove item when quantity is set to 0", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem() as any, 1);

      const itemId = store.items[0].id;
      store.updateQuantity(itemId, 0);

      expect(store.items).toHaveLength(0);
    });

    it("should do nothing for non-existent item id", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem() as any, 1);

      store.updateQuantity("non-existent", 5);
      expect(store.items).toHaveLength(1);
      expect(store.items[0].quantity).toBe(1);
    });
  });

  // ──────────────────────────────────────────────
  // removeItem
  // ──────────────────────────────────────────────

  describe("removeItem", () => {
    it("should remove an item by id", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem() as any, 1);

      const itemId = store.items[0].id;
      store.removeItem(itemId);

      expect(store.items).toHaveLength(0);
      expect(store.isEmpty).toBe(true);
    });

    it("should not crash when removing non-existent item", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.removeItem("non-existent");
      expect(store.items).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────
  // clearCart
  // ──────────────────────────────────────────────

  describe("clearCart", () => {
    it("should clear all items and reset state", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem() as any, 3);

      store.clearCart();

      expect(store.items).toHaveLength(0);
      expect(store.restaurantId).toBeNull();
      expect(store.tableId).toBeNull();
      expect(window.localStorage.removeItem).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // updateItemNotes
  // ──────────────────────────────────────────────

  describe("updateItemNotes", () => {
    it("should update notes on an existing item", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem() as any, 1);

      const itemId = store.items[0].id;
      store.updateItemNotes(itemId, "no chili");

      expect(store.items[0].notes).toBe("no chili");
    });
  });

  // ──────────────────────────────────────────────
  // Zod validation (XSS prevention)
  // ──────────────────────────────────────────────

  describe("Zod validation on restore", () => {
    it("should reject cart data with invalid item id (XSS in id)", () => {
      const key = "makanmakan_cart_rest-001_1";
      const tampered = JSON.stringify({
        items: [
          {
            id: "", // empty string fails min(1)
            menuItem: { id: 1, name: "OK", price: 10 },
            quantity: 1,
            price: 10,
            totalPrice: 10,
          },
        ],
        restaurantId: "rest-001",
        tableId: 1,
        timestamp: Date.now(),
      });
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((k: string) => (k === key ? tampered : null));

      const store = useCartStore();
      store.initializeCart("rest-001", 1);

      // Validation fails, cart stays empty
      expect(store.items).toHaveLength(0);
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(key);
    });

    it("should reject cart data with negative quantity", () => {
      const key = "makanmakan_cart_rest-001_1";
      const tampered = JSON.stringify({
        items: [
          {
            id: "1",
            menuItem: { id: 1, name: "OK", price: 10 },
            quantity: -1, // fails min(1)
            price: 10,
            totalPrice: 10,
          },
        ],
        restaurantId: "rest-001",
        tableId: 1,
        timestamp: Date.now(),
      });
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((k: string) => (k === key ? tampered : null));

      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      expect(store.items).toHaveLength(0);
    });

    it("should reject expired cart data (>2 hours old)", () => {
      const key = "makanmakan_cart_rest-001_1";
      const expired = buildCartData({
        timestamp: Date.now() - 2 * 60 * 60 * 1000 - 1,
        items: [
          {
            id: "1",
            menuItem: { id: 1, name: "Nasi", price: 10 },
            quantity: 1,
            price: 10,
            totalPrice: 10,
          },
        ],
      });
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((k: string) => (k === key ? expired : null));

      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      expect(store.items).toHaveLength(0);
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(key);
    });

    it("should reject corrupted JSON", () => {
      const key = "makanmakan_cart_rest-001_1";
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((k: string) =>
        k === key ? "NOT VALID JSON!!!" : null,
      );

      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      expect(store.items).toHaveLength(0);
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(key);
    });

    it("should reject cart data with negative price in menuItem", () => {
      const key = "makanmakan_cart_rest-001_1";
      const tampered = JSON.stringify({
        items: [
          {
            id: "1",
            menuItem: { id: 1, name: "Hack", price: -100 },
            quantity: 1,
            price: 10,
            totalPrice: 10,
          },
        ],
        restaurantId: "rest-001",
        tableId: 1,
        timestamp: Date.now(),
      });
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((k: string) => (k === key ? tampered : null));

      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      expect(store.items).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────
  // Computed getters
  // ──────────────────────────────────────────────

  describe("computed getters", () => {
    it("itemCount should sum all quantities", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem({ id: 1 }) as any, 2);
      store.addItem(buildMenuItem({ id: 2, name: "Roti" }) as any, 3);

      expect(store.itemCount).toBe(5);
    });

    it("subtotal should sum all totalPrices", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem({ id: 1, price: 10 }) as any, 2); // 20
      store.addItem(buildMenuItem({ id: 2, name: "Roti", price: 5 }) as any, 3); // 15

      expect(store.subtotal).toBe(35);
    });

    it("isEmpty should be false when items exist", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem() as any, 1);
      expect(store.isEmpty).toBe(false);
    });

    it("getItemById should return matching item", () => {
      const store = useCartStore();
      store.initializeCart("rest-001", 1);
      store.addItem(buildMenuItem() as any, 1);

      const itemId = store.items[0].id;
      const found = store.getItemById(itemId);
      expect(found).toBeDefined();
      expect(found?.menuItem.name).toBe("Nasi Lemak");
    });

    it("getItemById should return undefined for non-existent id", () => {
      const store = useCartStore();
      expect(store.getItemById("non-existent")).toBeUndefined();
    });
  });
});
