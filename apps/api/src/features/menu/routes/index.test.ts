import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: undefined as
    | undefined
    | { id: number; role: number; restaurantId?: string | number | null },
}));

vi.mock("../../../shared/middleware", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../shared/middleware")>();

  return {
    ...actual,
    optionalAuth: vi.fn(async (c, next) => {
      if (auth.user) c.set("user", auth.user);
      await next();
    }),
    authMiddleware: vi.fn(async (c, next) => {
      c.set("user", auth.user ?? { id: 7, role: 0, restaurantId: "rest-1" });
      await next();
    }),
    requireRole: vi.fn(
      () => async (_c: unknown, next: () => Promise<void>) => next(),
    ),
    requireRestaurantAccess: vi.fn(
      () => async (_c: unknown, next: () => Promise<void>) => next(),
    ),
  };
});

const gateMocks = vi.hoisted(() => ({
  moduleGate: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: gateMocks.moduleGate,
}));

const serviceFns = vi.hoisted(() => ({
  getMenu: vi.fn(),
  isPublicRestaurantAvailable: vi.fn(),
  getFeaturedItems: vi.fn(),
  getPopularItems: vi.fn(),
  searchMenuItems: vi.fn(),
  getMenuItem: vi.fn(),
  incrementViewCount: vi.fn(),
  createMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
  deleteMenuItem: vi.fn(),
  batchUpdateAvailability: vi.fn(),
  batchUpdatePrices: vi.fn(),
  batchMoveItems: vi.fn(),
  createCategory: vi.fn(),
  getCategoryById: vi.fn(),
  updateCategory: vi.fn(),
  reorderCategories: vi.fn(),
  deleteCategory: vi.fn(),
  getMenuAnalytics: vi.fn(),
  getPopularityMetrics: vi.fn(),
}));

vi.mock("../services/MenuService", () => ({
  MenuService: class {
    getMenu = serviceFns.getMenu;
    isPublicRestaurantAvailable = serviceFns.isPublicRestaurantAvailable;
    getFeaturedItems = serviceFns.getFeaturedItems;
    getPopularItems = serviceFns.getPopularItems;
    searchMenuItems = serviceFns.searchMenuItems;
    getMenuItem = serviceFns.getMenuItem;
    incrementViewCount = serviceFns.incrementViewCount;
    createMenuItem = serviceFns.createMenuItem;
    updateMenuItem = serviceFns.updateMenuItem;
    deleteMenuItem = serviceFns.deleteMenuItem;
    batchUpdateAvailability = serviceFns.batchUpdateAvailability;
    batchUpdatePrices = serviceFns.batchUpdatePrices;
    batchMoveItems = serviceFns.batchMoveItems;
    createCategory = serviceFns.createCategory;
    getCategoryById = serviceFns.getCategoryById;
    updateCategory = serviceFns.updateCategory;
    reorderCategories = serviceFns.reorderCategories;
    deleteCategory = serviceFns.deleteCategory;
    getMenuAnalytics = serviceFns.getMenuAnalytics;
    getPopularityMetrics = serviceFns.getPopularityMetrics;
  },
}));

const syncFns = vi.hoisted(() => ({
  onMenuItemChanged: vi.fn(),
  onCategoryChanged: vi.fn(),
}));

vi.mock("../../discovery/services/SearchIndexSyncService", () => ({
  createSearchIndexSync: vi.fn(() => syncFns),
}));

import routes from "./index";
import { ApiError } from "../../../shared/utils/api-error";

// moduleGate(...) is called once per route at registration (module import
// time), not per-request — capture the keys now, before any
// vi.clearAllMocks() in beforeEach wipes the call history.
const moduleGateRegistrationKeys = gateMocks.moduleGate.mock.calls.map(
  (call) => call[0],
);

routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }
  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function createEnv() {
  return {
    DB: {},
    CACHE_KV: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
}

function request(path: string, method = "GET", body?: unknown) {
  return routes.request(
    path,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
    },
    createEnv() as never,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as never,
  );
}

const menu = {
  categories: [{ id: 3, name: "Noodles" }],
  menuItems: [{ id: 11, name: "Laksa", restaurantId: "rest-1" }],
};

const item = {
  id: 11,
  restaurantId: "rest-1",
  categoryId: 3,
  name: "Laksa",
  price: 180,
};

const category = {
  id: 3,
  restaurantId: "rest-1",
  name: "Noodles",
};

function itemBody(overrides: Record<string, unknown> = {}) {
  return {
    categoryId: 3,
    name: "Laksa",
    price: 180,
    description: "Curry noodles",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = undefined;

  serviceFns.getMenu.mockResolvedValue(menu);
  serviceFns.isPublicRestaurantAvailable.mockResolvedValue(true);
  serviceFns.getFeaturedItems.mockResolvedValue([item]);
  serviceFns.getPopularItems.mockResolvedValue([item]);
  serviceFns.searchMenuItems.mockResolvedValue({
    items: [item],
    pagination: { page: 2, limit: 5, total: 1 },
  });
  serviceFns.getMenuItem.mockResolvedValue(item);
  serviceFns.incrementViewCount.mockResolvedValue(undefined);
  serviceFns.createMenuItem.mockResolvedValue(item);
  serviceFns.updateMenuItem.mockResolvedValue({ ...item, name: "Updated" });
  serviceFns.deleteMenuItem.mockResolvedValue(true);
  serviceFns.batchUpdateAvailability.mockResolvedValue(undefined);
  serviceFns.batchUpdatePrices.mockResolvedValue(undefined);
  serviceFns.batchMoveItems.mockResolvedValue(undefined);
  serviceFns.createCategory.mockResolvedValue(category);
  serviceFns.getCategoryById.mockResolvedValue(category);
  serviceFns.updateCategory.mockResolvedValue({
    ...category,
    name: "Updated",
  });
  serviceFns.reorderCategories.mockResolvedValue(undefined);
  serviceFns.deleteCategory.mockResolvedValue(true);
  serviceFns.getMenuAnalytics.mockResolvedValue({ totalItems: 1 });
  serviceFns.getPopularityMetrics.mockResolvedValue({ mostOrdered: [item] });
  syncFns.onMenuItemChanged.mockResolvedValue(undefined);
  syncFns.onCategoryChanged.mockResolvedValue(undefined);
});

describe("menu routes", () => {
  it("returns public menus and lets admins include unavailable items", async () => {
    let response = await request("/rest-1");

    expect(response.status).toBe(200);
    expect(serviceFns.getMenu).toHaveBeenCalledWith("rest-1", {
      includeUnavailable: false,
    });

    auth.user = { id: 1, role: 0 };
    response = await request("/rest-1?includeAll=true");

    expect(response.status).toBe(200);
    expect(serviceFns.getMenu).toHaveBeenLastCalledWith("rest-1", {
      includeUnavailable: true,
    });

    serviceFns.getMenu.mockResolvedValueOnce(null);
    response = await request("/missing");

    expect(response.status).toBe(404);
  });

  it("serves featured, popular, search, and item detail public endpoints", async () => {
    let response = await request("/rest-1/featured?limit=4");

    expect(response.status).toBe(200);
    expect(serviceFns.isPublicRestaurantAvailable).toHaveBeenCalledWith(
      "rest-1",
    );
    expect(serviceFns.getFeaturedItems).toHaveBeenCalledWith("rest-1", 4);

    response = await request("/rest-1/popular?limit=3");
    expect(response.status).toBe(200);
    expect(serviceFns.getPopularItems).toHaveBeenCalledWith("rest-1", 3);

    response = await request(
      "/rest-1/search?categoryId=3&minPrice=100&maxPrice=300&spiceLevel=2&dietaryPreferences=halal, vegan&isFeatured=true&search=laksa&page=2&limit=5",
    );
    expect(response.status).toBe(200);
    expect(serviceFns.searchMenuItems).toHaveBeenCalledWith("rest-1", {
      categoryId: 3,
      priceRange: [100, 300],
      spiceLevel: 2,
      dietaryPreferences: ["halal", "vegan"],
      isAvailable: true,
      isFeatured: true,
      search: "laksa",
      page: 2,
      limit: 5,
    });

    response = await request("/items/11");
    expect(response.status).toBe(200);
    expect(serviceFns.incrementViewCount).toHaveBeenCalledWith(11);

    serviceFns.isPublicRestaurantAvailable.mockResolvedValueOnce(false);
    response = await request("/rest-1/featured");
    expect(response.status).toBe(404);

    serviceFns.getMenuItem.mockResolvedValueOnce(null);
    response = await request("/items/404");
    expect(response.status).toBe(404);
  });

  it("creates, updates, and deletes menu items with search sync", async () => {
    let response = await request("/rest-1/items", "POST", itemBody());

    expect(response.status).toBe(201);
    expect(serviceFns.createMenuItem).toHaveBeenCalledWith({
      categoryId: 3,
      name: "Laksa",
      price: 180,
      description: "Curry noodles",
      spiceLevel: 0,
      preparationTime: 15,
      restaurantId: "rest-1",
    });
    expect(syncFns.onMenuItemChanged).toHaveBeenCalledWith(11);

    response = await request("/items/11", "PUT", {
      name: "Updated",
      isFeatured: true,
    });
    expect(response.status).toBe(200);
    expect(serviceFns.updateMenuItem).toHaveBeenCalledWith(
      11,
      { name: "Updated", isFeatured: true },
      item,
    );

    response = await request("/items/11", "DELETE");
    expect(response.status).toBe(200);
    expect(serviceFns.deleteMenuItem).toHaveBeenCalledWith(11, item);
  });

  it("blocks menu item mutation when item access fails", async () => {
    auth.user = { id: 8, role: 1, restaurantId: "other" };

    let response = await request("/items/11", "PUT", { name: "Updated" });

    expect(response.status).toBe(403);
    expect(serviceFns.updateMenuItem).not.toHaveBeenCalled();

    serviceFns.getMenuItem.mockResolvedValueOnce(null);
    auth.user = { id: 1, role: 0 };
    response = await request("/items/11", "DELETE");

    expect(response.status).toBe(404);

    serviceFns.getMenuItem.mockResolvedValueOnce(item);
    serviceFns.deleteMenuItem.mockResolvedValueOnce(false);
    response = await request("/items/11", "DELETE");

    expect(response.status).toBe(404);
  });

  it("runs bulk menu item management workflows", async () => {
    let response = await request("/rest-1/items/availability", "PATCH", {
      updates: [{ id: 11, isAvailable: false }],
    });

    expect(response.status).toBe(200);
    expect(serviceFns.batchUpdateAvailability).toHaveBeenCalledWith("rest-1", [
      { id: 11, isAvailable: false },
    ]);
    expect(syncFns.onMenuItemChanged).toHaveBeenCalledWith(11);

    response = await request("/rest-1/items/prices", "PATCH", {
      updates: [{ id: 11, price: 190, originalPrice: 220 }],
    });
    expect(response.status).toBe(200);
    expect(serviceFns.batchUpdatePrices).toHaveBeenCalledWith("rest-1", [
      { id: 11, price: 190, originalPrice: 220 },
    ]);

    response = await request("/rest-1/items/categories", "PATCH", {
      updates: [{ id: 11, categoryId: 4 }],
    });
    expect(response.status).toBe(200);
    expect(serviceFns.batchMoveItems).toHaveBeenCalledWith("rest-1", [
      { id: 11, categoryId: 4 },
    ]);
  });

  it("creates, updates, reorders, and deletes categories", async () => {
    let response = await request("/rest-1/categories", "POST", {
      name: "Noodles",
      sortOrder: 1,
    });

    expect(response.status).toBe(201);
    expect(serviceFns.createCategory).toHaveBeenCalledWith({
      name: "Noodles",
      sortOrder: 1,
      restaurantId: "rest-1",
    });

    response = await request("/categories/3", "PUT", { name: "Updated" });
    expect(response.status).toBe(200);
    expect(serviceFns.updateCategory).toHaveBeenCalledWith(3, {
      name: "Updated",
    });
    expect(syncFns.onCategoryChanged).toHaveBeenCalledWith(3);

    response = await request("/rest-1/categories/reorder", "PATCH", {
      categories: [{ id: 3, sortOrder: 2 }],
    });
    expect(response.status).toBe(200);
    expect(serviceFns.reorderCategories).toHaveBeenCalledWith("rest-1", [
      { id: 3, sortOrder: 2 },
    ]);

    response = await request("/categories/3", "DELETE");
    expect(response.status).toBe(200);
    expect(serviceFns.deleteCategory).toHaveBeenCalledWith(3);
  });

  it("blocks category mutations on missing or unauthorized categories", async () => {
    auth.user = { id: 8, role: 1, restaurantId: "other" };

    let response = await request("/categories/3", "PUT", { name: "Updated" });

    expect(response.status).toBe(403);
    expect(serviceFns.updateCategory).not.toHaveBeenCalled();

    serviceFns.getCategoryById.mockResolvedValueOnce(null);
    auth.user = { id: 1, role: 0 };
    response = await request("/categories/3", "DELETE");

    expect(response.status).toBe(404);

    serviceFns.getCategoryById.mockResolvedValueOnce(category);
    serviceFns.deleteCategory.mockResolvedValueOnce(false);
    response = await request("/categories/3", "DELETE");

    expect(response.status).toBe(404);
  });

  it("returns menu analytics and popularity metrics", async () => {
    let response = await request("/rest-1/analytics?includeDetails=true");

    expect(response.status).toBe(200);
    expect(serviceFns.getMenuAnalytics).toHaveBeenCalledWith("rest-1");

    response = await request("/rest-1/popularity");

    expect(response.status).toBe(200);
    expect(serviceFns.getPopularityMetrics).toHaveBeenCalledWith("rest-1");

    // /popularity surfaces order-derived sales data and must require the
    // "analytics" (pro-tier) module, not "menu_management" (see
    // module-gate.test.ts for the real, unmocked-gate proof).
    expect(moduleGateRegistrationKeys).toContain("analytics");
  });
});
