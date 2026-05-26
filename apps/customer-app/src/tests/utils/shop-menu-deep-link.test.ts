import { describe, expect, it } from "vitest";
import {
  findMenuItemByQuery,
  menuItemElementId,
  shopMenuItemQuery,
} from "@/utils/shopMenuDeepLink";
import type { MenuItem } from "@makanmakan/shared-types";

function menuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 101,
    restaurantId: "restaurant-1",
    categoryId: 10,
    name: "鹽酥雞",
    price: 7500,
    spiceLevel: 0,
    sortOrder: 1,
    isAvailable: true,
    isFeatured: false,
    inventoryCount: -1,
    orderCount: 0,
    ...overrides,
  };
}

describe("shop menu deep links", () => {
  it("builds a stable itemId query for dish results", () => {
    expect(shopMenuItemQuery({ menuItemId: 42 })).toEqual({ itemId: "42" });
  });

  it("builds stable DOM ids for menu items", () => {
    expect(menuItemElementId(42)).toBe("menu-item-42");
  });

  it("finds a menu item from URL query values", () => {
    const items = [menuItem({ id: 41 }), menuItem({ id: 42 })];

    expect(findMenuItemByQuery(items, "42")?.name).toBe("鹽酥雞");
    expect(findMenuItemByQuery(items, ["42"])?.id).toBe(42);
    expect(findMenuItemByQuery(items, "not-a-number")).toBeNull();
    expect(findMenuItemByQuery(items, undefined)).toBeNull();
  });
});
