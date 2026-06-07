import { afterEach, describe, expect, it, vi } from "vitest";
import { Status } from "@makanmakan/shared-types";
import { MenuService } from "./MenuService";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MenuService", () => {
  function createPublicDb(rows: unknown[] = [{ id: "rest-1" }]) {
    return {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => rows),
          })),
        })),
      })),
    };
  }

  function createService(options?: {
    db?: unknown;
    dbService?: Record<string, unknown>;
  }) {
    const dbService = {
      getMenu: vi.fn(),
      getMenuItem: vi.fn(),
      createMenuItem: vi.fn(),
      updateMenuItem: vi.fn(),
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      getCategory: vi.fn(),
      searchMenuItems: vi.fn(),
      reorderCategories: vi.fn(),
      getFeaturedItems: vi.fn(),
      getPopularItems: vi.fn(),
      batchUpdateAvailability: vi.fn(),
      incrementOrderCount: vi.fn(),
      incrementViewCount: vi.fn(),
      ...options?.dbService,
    };
    const service = new MenuService({ DB: {} as D1Database } as never);
    Object.defineProperty(service, "db", {
      value: options?.db ?? createPublicDb(),
    });
    Object.defineProperty(service, "dbService", { value: dbService });
    return { service, dbService };
  }

  function menuItem(overrides: Record<string, unknown> = {}) {
    return {
      id: 101,
      restaurantId: "rest-1",
      categoryId: 7,
      name: "Laksa",
      description: "Rich curry soup",
      price: 180,
      originalPrice: 220,
      isAvailable: true,
      isFeatured: false,
      isPopular: false,
      sortOrder: 3,
      inventoryCount: 5,
      orderCount: 4,
      allergens: ["shellfish"],
      dietaryInfo: { halal: true },
      spiceLevel: 2,
      rating: 4.5,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
      ...overrides,
    };
  }

  function category(overrides: Record<string, unknown> = {}) {
    return {
      id: 7,
      restaurantId: "rest-1",
      name: "Noodles",
      description: "Comfort food",
      sortOrder: 2,
      isActive: true,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-02T00:00:00.000Z"),
      ...overrides,
    };
  }

  it("returns null for public menu reads when the restaurant is unavailable", async () => {
    const { service, dbService } = createService({ db: createPublicDb([]) });

    await expect(service.getMenu("rest-1")).resolves.toBeNull();
    expect(dbService.getMenu).not.toHaveBeenCalled();
  });

  it("fetches and transforms menus when public access is allowed", async () => {
    const { service, dbService } = createService({
      dbService: {
        getMenu: vi.fn(async () => ({
          categories: [category({ status: Status.ACTIVE })],
          menuItems: [
            menuItem({
              categoryId: "7",
              restaurantId: 42,
              isAvailable: undefined,
              allergens: undefined,
            }),
          ],
        })),
      },
    });

    await expect(service.getMenu("rest-1")).resolves.toMatchObject({
      categories: [
        {
          id: 7,
          restaurantId: "rest-1",
          status: Status.ACTIVE,
          createdAt: "2026-06-01T00:00:00.000Z",
        },
      ],
      menuItems: [
        {
          id: 101,
          restaurantId: "42",
          categoryId: 7,
          isAvailable: false,
          allergens: [],
          reviewCount: 0,
          viewCount: 0,
        },
      ],
    });
    expect(dbService.getMenu).toHaveBeenCalledWith("rest-1", undefined);
  });

  it("creates menu items only after category restaurant validation", async () => {
    const created = menuItem({ id: 202, restaurantId: "rest-1" });
    const { service, dbService } = createService({
      dbService: {
        getCategory: vi.fn(async () => category()),
        createMenuItem: vi.fn(async () => created),
      },
    });

    await expect(
      service.createMenuItem({
        restaurantId: "rest-1",
        categoryId: 7,
        name: "Laksa",
        price: 180,
      } as never),
    ).resolves.toMatchObject({ id: 202, restaurantId: "rest-1" });
    expect(dbService.createMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "rest-1",
        categoryId: 7,
        name: "Laksa",
      }),
    );
  });

  it("rejects menu item creation when the category belongs to another restaurant", async () => {
    const { service, dbService } = createService({
      dbService: {
        getCategory: vi.fn(async () => category({ restaurantId: "other" })),
      },
    });

    await expect(
      service.createMenuItem({
        restaurantId: "rest-1",
        categoryId: 7,
        name: "Laksa",
        price: 180,
      } as never),
    ).rejects.toThrow("Category does not belong to the specified restaurant");
    expect(dbService.createMenuItem).not.toHaveBeenCalled();
  });

  it("updates menu items with prefetched data and validates category moves", async () => {
    const { service, dbService } = createService({
      dbService: {
        getCategory: vi.fn(async () => category({ id: 8 })),
        updateMenuItem: vi.fn(async () =>
          menuItem({ id: 101, categoryId: 8, restaurantId: "rest-1" }),
        ),
      },
    });

    await expect(
      service.updateMenuItem(
        101,
        { categoryId: 8, restaurantId: "rest-1", name: "New Laksa" },
        menuItem({ categoryId: 7 }) as never,
      ),
    ).resolves.toMatchObject({ id: 101, categoryId: 8 });
    expect(dbService.updateMenuItem).toHaveBeenCalledWith(101, {
      categoryId: 8,
      restaurantId: "rest-1",
      name: "New Laksa",
    });
  });

  it("soft deletes menu items and reports missing items as false", async () => {
    const { service, dbService } = createService({
      dbService: {
        updateMenuItem: vi.fn(async () => menuItem()),
      },
    });

    await expect(
      service.deleteMenuItem(101, menuItem() as never),
    ).resolves.toBe(true);
    expect(dbService.updateMenuItem).toHaveBeenCalledWith(101, {
      isAvailable: false,
      sortOrder: -1,
    });

    await expect(service.deleteMenuItem(404, null as never)).resolves.toBe(
      false,
    );
  });

  it("creates and updates categories with normalized status and timestamps", async () => {
    const { service, dbService } = createService({
      dbService: {
        createCategory: vi.fn(async () => category({ id: 9 })),
        updateCategory: vi.fn(async () => category({ id: 9, isActive: false })),
      },
    });

    await expect(
      service.createCategory({
        restaurantId: "rest-1",
        name: "Drinks",
        sortOrder: 1,
      } as never),
    ).resolves.toMatchObject({
      id: 9,
      restaurantId: "rest-1",
      status: Status.ACTIVE,
      createdAt: "2026-06-01T00:00:00.000Z",
    });
    await expect(
      service.updateCategory(9, { isActive: false } as never),
    ).resolves.toMatchObject({
      id: 9,
      status: Status.INACTIVE,
    });
  });

  it("blocks category deletion when menu items still reference it", async () => {
    const { service, dbService } = createService({
      dbService: {
        getCategory: vi.fn(async () => category()),
        searchMenuItems: vi.fn(async () => ({
          items: [menuItem()],
          pagination: { page: 1, limit: 1, total: 1 },
        })),
      },
    });

    await expect(service.deleteCategory(7)).rejects.toThrow(
      "Cannot delete category that contains menu items",
    );
    expect(dbService.updateCategory).not.toHaveBeenCalled();
  });

  it("deletes empty categories by marking them inactive", async () => {
    const { service, dbService } = createService({
      dbService: {
        getCategory: vi.fn(async () => category()),
        searchMenuItems: vi.fn(async () => ({
          items: [],
          pagination: { page: 1, limit: 1, total: 0 },
        })),
        updateCategory: vi.fn(async () => category({ isActive: false })),
      },
    });

    await expect(service.deleteCategory(7)).resolves.toBe(true);
    expect(dbService.updateCategory).toHaveBeenCalledWith(7, {
      isActive: false,
    });
  });

  it("searches, highlights featured and popular items, and performs counters", async () => {
    const { service, dbService } = createService({
      dbService: {
        searchMenuItems: vi.fn(async () => ({
          items: [menuItem({ id: 1 })],
          pagination: { page: 2, limit: 5, total: 1 },
        })),
        getFeaturedItems: vi.fn(async () => [menuItem({ isFeatured: true })]),
        getPopularItems: vi.fn(async () => [menuItem({ isPopular: true })]),
      },
    });

    await expect(
      service.searchMenuItems("rest-1", {
        search: "laksa",
        categoryId: 7,
        page: 2,
        limit: 5,
      }),
    ).resolves.toMatchObject({
      items: [{ id: 1 }],
      pagination: { page: 2, limit: 5, total: 1 },
    });
    expect(dbService.searchMenuItems).toHaveBeenCalledWith(
      "rest-1",
      expect.objectContaining({ search: "laksa", categoryId: 7 }),
      2,
      5,
    );
    await expect(service.getFeaturedItems("rest-1")).resolves.toMatchObject([
      { isFeatured: true },
    ]);
    await expect(service.getPopularItems("rest-1", 3)).resolves.toMatchObject([
      { isPopular: true },
    ]);
    await service.incrementOrderCount(101, 2);
    await service.incrementViewCount(101);
    await service.updateItemRating(101, 4.8);
    expect(dbService.incrementOrderCount).toHaveBeenCalledWith(101, 2);
    expect(dbService.incrementViewCount).toHaveBeenCalledWith(101);
    expect(dbService.updateMenuItem).toHaveBeenCalledWith(101, {
      rating: 4.8,
    });
  });

  it("batch updates availability, prices, and category moves", async () => {
    const { service, dbService } = createService({
      dbService: {
        getCategory: vi.fn(async () => category({ id: 8 })),
      },
    });

    await service.batchUpdateAvailability("rest-1", [
      { id: 101, isAvailable: false },
    ]);
    await service.batchUpdatePrices("rest-1", [
      { id: 101, price: 190, originalPrice: 220 },
      { id: 102, price: 95 },
    ] as never);
    await service.batchMoveItems("rest-1", [
      { id: 101, categoryId: 8 },
      { id: 102, categoryId: 8 },
    ]);

    expect(dbService.batchUpdateAvailability).toHaveBeenCalledWith("rest-1", [
      { id: 101, isAvailable: false },
    ]);
    expect(dbService.updateMenuItem).toHaveBeenNthCalledWith(1, 101, {
      price: 190,
      originalPrice: 220,
    });
    expect(dbService.updateMenuItem).toHaveBeenNthCalledWith(2, 102, {
      price: 95,
      originalPrice: undefined,
    });
    expect(dbService.updateMenuItem).toHaveBeenNthCalledWith(3, 101, {
      categoryId: 8,
    });
    expect(dbService.updateMenuItem).toHaveBeenNthCalledWith(4, 102, {
      categoryId: 8,
    });
  });

  it("computes analytics from the transformed menu", async () => {
    const service = new MenuService({ DB: {} as D1Database } as never);
    vi.spyOn(service, "getMenu").mockResolvedValue({
      categories: [
        category({ id: 7, name: "Noodles", createdAt: "", updatedAt: "" }),
        category({ id: 8, name: "Rice", createdAt: "", updatedAt: "" }),
      ],
      menuItems: [
        menuItem({
          id: 1,
          categoryId: 7,
          price: 100,
          isAvailable: true,
          isFeatured: true,
          isPopular: true,
          orderCount: 5,
          dietaryInfo: { vegetarian: true, halal: true },
          spiceLevel: 1,
        }),
        menuItem({
          id: 2,
          categoryId: 8,
          price: 300,
          isAvailable: false,
          isFeatured: false,
          isPopular: false,
          orderCount: 2,
          dietaryInfo: { vegan: true, glutenFree: true },
          spiceLevel: 3,
        }),
      ],
    } as never);

    await expect(service.getMenuAnalytics("rest-1")).resolves.toMatchObject({
      totalItems: 2,
      availableItems: 1,
      featuredItems: 1,
      popularItems: 1,
      averagePrice: 200,
      priceRange: { min: 100, max: 300 },
      categoryDistribution: [
        {
          categoryId: 7,
          categoryName: "Noodles",
          itemCount: 1,
          percentage: 50,
        },
        {
          categoryId: 8,
          categoryName: "Rice",
          itemCount: 1,
          percentage: 50,
        },
      ],
      topPerformingItems: [
        { id: 1, name: "Laksa", orderCount: 5, revenue: 500, rating: 4.5 },
        { id: 2, name: "Laksa", orderCount: 2, revenue: 600, rating: 4.5 },
      ],
      dietaryInfoStats: {
        vegetarian: 1,
        vegan: 1,
        glutenFree: 1,
        halal: 1,
      },
      spiceLevelDistribution: { 1: 1, 3: 1 },
    });
  });

  it("builds popularity metrics with independently sorted item lists", async () => {
    const { service, dbService } = createService({
      dbService: {
        getPopularItems: vi.fn(async () => [menuItem({ id: 1 })]),
        searchMenuItems: vi.fn(async () => ({
          items: [
            menuItem({
              id: 2,
              viewCount: 5,
              rating: 3,
              createdAt: "2026-06-01T00:00:00.000Z",
            }),
            menuItem({
              id: 3,
              viewCount: 9,
              rating: 5,
              createdAt: "2026-06-03T00:00:00.000Z",
            }),
          ],
          pagination: { page: 1, limit: 10, total: 2 },
        })),
      },
    });

    await expect(service.getPopularityMetrics("rest-1")).resolves.toMatchObject(
      {
        mostOrdered: [{ id: 1 }],
        mostViewed: [{ id: 2 }, { id: 3 }],
        highestRated: [{ id: 3 }, { id: 2 }],
        recentlyAdded: [{ id: 3 }, { id: 2 }],
      },
    );
    expect(dbService.searchMenuItems).toHaveBeenCalledTimes(3);
  });
});
