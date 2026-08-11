import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useCartStore } from "@/stores/cart";
import type { MenuItem } from "@makanmasak/shared-types";

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

describe("useCartStore", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("scopes dine-in carts by seat when a seat id is present", () => {
    const store = useCartStore();

    store.initializeCart("restaurant-1", 4, 6);
    store.addItem(menuItem(), 1);

    expect(store.seatId).toBe(6);
    expect(localStorage.getItem("makanmakan_cart_restaurant-1_4")).toBeNull();
    expect(
      localStorage.getItem("makanmakan_cart_restaurant-1_4_seat_6"),
    ).toContain("Beef Noodles");

    store.initializeCart("restaurant-1", 4, 7);

    expect(store.items).toEqual([]);
    expect(store.seatId).toBe(7);
    expect(
      localStorage.getItem("makanmakan_cart_restaurant-1_4_seat_6"),
    ).toContain("Beef Noodles");
  });

  it("restores a persisted cart only for the matching seat", () => {
    localStorage.setItem(
      "makanmakan_cart_restaurant-1_4_seat_6",
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
        tableId: 4,
        seatId: 6,
        timestamp: Date.now(),
      }),
    );

    const store = useCartStore();
    store.initializeCart("restaurant-1", 4, 6);
    expect(store.items).toHaveLength(1);

    store.initializeCart("restaurant-1", 4, 7);
    expect(store.items).toEqual([]);
  });
});
