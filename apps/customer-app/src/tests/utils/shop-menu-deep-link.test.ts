import { describe, expect, it } from "vitest";
import {
  findMenuCategoryByQuery,
  findMenuItemByQuery,
  menuCategoryElementId,
  menuItemElementId,
  shopMenuItemQuery,
} from "@/utils/shopMenuDeepLink";
import type { Category, MenuItem } from "@makanmakan/shared-types";

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

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 10,
    restaurantId: "restaurant-1",
    name: "小吃",
    sortOrder: 1,
    status: 1,
    ...overrides,
  };
}

describe("shop menu deep links", () => {
  it("builds a stable itemId query for dish results", () => {
    expect(shopMenuItemQuery({ menuItemId: 42 })).toEqual({ itemId: "42" });
  });

  it("preserves category context for dish results when available", () => {
    expect(shopMenuItemQuery({ menuItemId: 42, categoryName: "小吃" })).toEqual(
      {
        itemId: "42",
        categoryName: "小吃",
      },
    );
    expect(shopMenuItemQuery({ menuItemId: 42, categoryName: null })).toEqual({
      itemId: "42",
    });
  });

  it("builds stable DOM ids for menu items", () => {
    expect(menuItemElementId(42)).toBe("menu-item-42");
  });

  it("builds stable DOM ids for menu categories", () => {
    expect(menuCategoryElementId(10)).toBe("category-10");
  });

  it("finds a menu item from URL query values", () => {
    const items = [menuItem({ id: 41 }), menuItem({ id: 42 })];

    expect(findMenuItemByQuery(items, "42")?.name).toBe("鹽酥雞");
    expect(findMenuItemByQuery(items, ["42"])?.id).toBe(42);
    expect(findMenuItemByQuery(items, "not-a-number")).toBeNull();
    expect(findMenuItemByQuery(items, undefined)).toBeNull();
  });

  it("finds a menu category from URL query values", () => {
    const categories = [
      category({ id: 10, name: "小吃" }),
      category({ id: 11, name: "飲品" }),
    ];

    expect(findMenuCategoryByQuery(categories, " 飲品 ")?.id).toBe(11);
    expect(findMenuCategoryByQuery(categories, ["小吃"])?.id).toBe(10);
    expect(findMenuCategoryByQuery(categories, "甜點")).toBeNull();
    expect(findMenuCategoryByQuery(categories, undefined)).toBeNull();
  });
});
