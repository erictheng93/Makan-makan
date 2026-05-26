import { describe, expect, it } from "vitest";
import {
  findMenuCategoryByQuery,
  findMenuItemByQuery,
  findServiceItemByQuery,
  menuCategoryElementId,
  menuItemElementId,
  serviceItemElementId,
  shopMenuItemQuery,
  shopMenuServiceQuery,
} from "@/utils/shopMenuDeepLink";
import type {
  Category,
  MenuItem,
  RestaurantServiceItem,
} from "@makanmakan/shared-types";

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
    createdAt: "",
    updatedAt: "",
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
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function serviceItem(
  overrides: Partial<RestaurantServiceItem> = {},
): RestaurantServiceItem {
  return {
    id: 7,
    restaurantId: "restaurant-1",
    name: "代客切水果",
    serviceType: "general",
    requiresBooking: false,
    sortOrder: 1,
    isActive: true,
    isPublic: true,
    createdAt: "",
    updatedAt: "",
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

  it("builds a stable serviceItemId query for service results", () => {
    expect(shopMenuServiceQuery({ serviceItemId: 7 })).toEqual({
      serviceItemId: "7",
    });
  });

  it("builds stable DOM ids for service items", () => {
    expect(serviceItemElementId(7)).toBe("service-item-7");
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

  it("finds a service item from URL query values", () => {
    const services = [serviceItem({ id: 6 }), serviceItem({ id: 7 })];

    expect(findServiceItemByQuery(services, "7")?.name).toBe("代客切水果");
    expect(findServiceItemByQuery(services, ["7"])?.id).toBe(7);
    expect(findServiceItemByQuery(services, "not-a-number")).toBeNull();
    expect(findServiceItemByQuery(services, undefined)).toBeNull();
  });
});
