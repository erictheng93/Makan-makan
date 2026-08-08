import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useShopCartStore } from "@/stores/shopCart";
import type {
  MenuItem,
  SelectedCustomizations,
} from "@makanmakan/shared-types";

function menuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 42,
    restaurantId: "restaurant-1",
    categoryId: 10,
    catalogType: "menu_item",
    name: "Beef Noodles",
    price: 100,
    spiceLevel: 0,
    sortOrder: 1,
    isAvailable: true,
    isFeatured: false,
    inventoryCount: null,
    orderCount: 0,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

const customizations = (): SelectedCustomizations => ({
  size: {
    id: "size-large",
    name: "Large",
    priceAdjustment: 20,
  },
  options: [
    {
      id: "spice-level",
      optionName: "Spice level",
      choiceId: "extra-spicy",
      choiceName: "Extra spicy",
      priceAdjustment: 5,
    },
  ],
  addOns: [
    {
      id: "egg",
      name: "Egg",
      unitPrice: 15,
      quantity: 1,
      totalPrice: 15,
    },
  ],
});

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("useShopCartStore", () => {
  it("adds customized items, merges matching rows, and persists scoped cart data", () => {
    const store = useShopCartStore();
    store.initializeCart("restaurant-1", "678");

    store.addItem(menuItem(), 1, customizations(), "less salt");
    store.addItem(menuItem(), 2, customizations(), "less salt");

    expect(store.items).toHaveLength(1);
    expect(store.items[0]).toMatchObject({
      quantity: 3,
      price: 140,
      totalPrice: 420,
      notes: "less salt",
    });
    expect(store.itemCount).toBe(3);
    expect(store.subtotal).toBe(420);
    expect(store.isEmpty).toBe(false);
    expect(
      localStorage.getItem("makanmakan_shop_cart_restaurant-1_678"),
    ).toContain("Beef Noodles");
  });

  it("removes items when quantity drops to zero and updates notes otherwise", () => {
    const store = useShopCartStore();
    store.initializeCart("restaurant-1", "678");
    store.addItem(menuItem(), 1);
    const id = store.items[0].id;

    store.updateItemNotes(id, "call on arrival");
    expect(store.items[0].notes).toBe("call on arrival");

    store.updateQuantity(id, 0);
    expect(store.items).toEqual([]);
    expect(store.isEmpty).toBe(true);
  });

  it("adds delivery fee only for delivery fulfillment and clears delivery info when switching away", () => {
    const store = useShopCartStore();
    store.initializeCart("restaurant-1", "678");
    store.addItem(menuItem(), 1);

    store.setFulfillmentType("delivery");
    store.setDeliveryInfo({
      address: "No. 1 Road",
      phone: "0912345678",
      instructions: "Leave at lobby",
    });
    store.setDeliveryFee(35);
    expect(store.totalWithDelivery).toBe(135);
    expect(store.deliveryInfo?.address).toBe("No. 1 Road");

    store.setFulfillmentType("takeaway");
    expect(store.totalWithDelivery).toBe(100);
    expect(store.deliveryInfo).toBeNull();
  });

  it("restores valid cart data for the same restaurant and phone suffix", () => {
    localStorage.setItem(
      "makanmakan_shop_cart_restaurant-1_678",
      JSON.stringify({
        items: [
          {
            id: "42",
            menuItem: menuItem(),
            quantity: 2,
            price: 100,
            totalPrice: 200,
          },
        ],
        restaurantId: "restaurant-1",
        phoneLastDigits: "678",
        timestamp: Date.now(),
        fulfillmentType: "delivery",
        deliveryInfo: {
          address: "No. 1 Road",
          phone: "0912345678",
          instructions: "",
        },
        deliveryFee: 30,
      }),
    );

    const store = useShopCartStore();
    store.initializeCart("restaurant-1", "678");

    expect(store.items).toHaveLength(1);
    expect(store.fulfillmentType).toBe("delivery");
    expect(store.deliveryFee).toBe(30);
    expect(store.totalWithDelivery).toBe(230);
  });

  it("discards invalid or expired persisted cart data", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    localStorage.setItem(
      "makanmakan_shop_cart_restaurant-1_678",
      JSON.stringify({
        items: [
          {
            id: "bad",
            menuItem: { id: -1, name: "<script>", price: -10 },
            quantity: 1,
            price: -10,
            totalPrice: -10,
          },
        ],
        restaurantId: "restaurant-1",
        phoneLastDigits: "678",
        timestamp: Date.now(),
      }),
    );
    let store = useShopCartStore();
    store.initializeCart("restaurant-1", "678");
    expect(store.items).toEqual([]);
    expect(
      localStorage.getItem("makanmakan_shop_cart_restaurant-1_678"),
    ).toBeNull();

    setActivePinia(createPinia());
    localStorage.setItem(
      "makanmakan_shop_cart_restaurant-1_678",
      JSON.stringify({
        items: [
          {
            id: "42",
            menuItem: menuItem(),
            quantity: 1,
            price: 100,
            totalPrice: 100,
          },
        ],
        restaurantId: "restaurant-1",
        phoneLastDigits: "678",
        timestamp: Date.now() - 3 * 60 * 60 * 1000,
      }),
    );
    store = useShopCartStore();
    store.initializeCart("restaurant-1", "678");
    expect(store.items).toEqual([]);
    expect(
      localStorage.getItem("makanmakan_shop_cart_restaurant-1_678"),
    ).toBeNull();
  });

  it("clears cart state and removes only the active scoped storage key", () => {
    const store = useShopCartStore();
    store.initializeCart("restaurant-1", "678");
    store.addItem(menuItem(), 1);

    store.clearCart();

    expect(store.items).toEqual([]);
    expect(store.restaurantId).toBeNull();
    expect(store.phoneLastDigits).toBe("");
    expect(
      localStorage.getItem("makanmakan_shop_cart_restaurant-1_678"),
    ).toBeNull();
  });
});
