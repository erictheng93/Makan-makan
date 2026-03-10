/**
 * MenuService Unit Tests
 *
 * Comprehensive test suite for MenuService - targeting 80%+ coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MenuService } from "../services/MenuService";
import type { Env } from "../../../shared/types";
import type {
  CreateMenuItemData,
  UpdateMenuItemData,
  CreateCategoryData,
  UpdateCategoryData,
  MenuItem,
  Category,
  MenuStructure,
} from "../types";

// Mock environment
const mockEnv: Env = {
  DB: {} as any,
  JWT_SECRET: "test-secret",
  ENCRYPTION_KEY: "test-encryption-key-for-testing-only-32chars",
  CACHE_KV: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as any,
  SLACK_WEBHOOK_URL: "https://hooks.slack.com/test",
  NODE_ENV: "test",
  API_VERSION: "v1",
  TOKEN_BLACKLIST: {} as any,
  IMAGES_BUCKET: {} as any,
  BACKUP_STORAGE: {} as any,
  JOB_QUEUE: {} as any,
  REALTIME_ORDERS: {} as any,
  ANALYTICS_ENGINE: {} as any,
  RATE_LIMIT_KV: {} as any,
  REALTIME_SESSION: {} as any,
  CLOUDFLARE_IMAGES_KEY: "test-key",
  CLOUDFLARE_ACCOUNT_ID: "test-account",
};

// Mock DatabaseMenuService
const mockDbService = {
  getMenu: vi.fn(),
  getMenuItem: vi.fn(),
  createMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
  deleteMenuItem: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  getCategory: vi.fn(),
  searchMenuItems: vi.fn(),
  getFeaturedItems: vi.fn(),
  getPopularItems: vi.fn(),
  batchUpdateAvailability: vi.fn(),
  incrementOrderCount: vi.fn(),
  incrementViewCount: vi.fn(),
};

// Mock ConsoleLogger - use class-based mock for vitest 4 compatibility
vi.mock("../../../core/monitoring", () => {
  return {
    ConsoleLogger: class MockConsoleLogger {
      info = vi.fn();
      error = vi.fn();
      warn = vi.fn();
      debug = vi.fn();
    },
  };
});

// Mock the database service - use class-based mock for vitest 4 compatibility
vi.mock("@makanmakan/database", () => {
  return {
    MenuService: class MockMenuService {
      constructor() {
        Object.assign(this, mockDbService);
      }
    },
  };
});

// Mock data
const mockMenuItem: MenuItem = {
  id: 1,
  name: "Nasi Lemak",
  description: "Traditional Malaysian rice dish",
  ingredients: "Rice, coconut milk, sambal, anchovies",
  price: 12.99,
  originalPrice: 15.99,
  categoryId: 1,
  restaurantId: "1",
  isAvailable: true,
  isFeatured: true,
  isPopular: true,
  sortOrder: 1,
  spiceLevel: 2,
  preparationTime: 15,
  calories: 450,
  inventoryCount: 100,
  orderCount: 250,
  imageUrl: "https://example.com/nasi-lemak.jpg",
  allergens: ["nuts", "shellfish"],
  dietaryInfo: {
    vegetarian: false,
    vegan: false,
    glutenFree: true,
    halal: true,
  },
  options: {} as any, // MenuItemOptions type expects object, not array
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-15T00:00:00.000Z",
  reviewCount: 50,
  viewCount: 1000,
  rating: 4.5,
  tags: ["popular", "local"],
  keywords: "nasi lemak rice malaysian",
};

const mockCategory: Category = {
  id: 1,
  name: "Main Dishes",
  description: "Our signature main courses",
  parentId: undefined, // Changed from null to undefined
  sortOrder: 1,
  status: 1,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  restaurantId: "1",
  isActive: true,
  isVisible: true,
  itemCount: 10,
};

const mockMenuStructure: MenuStructure = {
  categories: [mockCategory],
  menuItems: [mockMenuItem],
};

describe("MenuService", () => {
  let menuService: MenuService;

  beforeEach(() => {
    menuService = new MenuService(mockEnv);
    // Replace internal services with mocks
    (menuService as any).dbService = mockDbService;
    (menuService as any).cacheService = mockEnv.CACHE_KV;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ========================================
  // Get Menu Tests
  // ========================================
  describe("getMenu", () => {
    it("should fetch menu from cache when available", async () => {
      (mockEnv.CACHE_KV.get as any).mockResolvedValue(mockMenuStructure);

      const result = await menuService.getMenu("1");

      expect(result).toEqual(mockMenuStructure);
      expect(mockEnv.CACHE_KV.get).toHaveBeenCalledWith("menu:1", "json");
      expect(mockDbService.getMenu).not.toHaveBeenCalled();
    });

    it("should fetch from database when cache misses", async () => {
      (mockEnv.CACHE_KV.get as any).mockResolvedValue(null);
      mockDbService.getMenu.mockResolvedValue(mockMenuStructure);

      const result = await menuService.getMenu("1");

      expect(result).toEqual(mockMenuStructure);
      expect(mockDbService.getMenu).toHaveBeenCalledWith("1");
    });

    it("should cache menu after fetching from database", async () => {
      (mockEnv.CACHE_KV.get as any).mockResolvedValue(null);
      mockDbService.getMenu.mockResolvedValue(mockMenuStructure);

      await menuService.getMenu("1");

      expect(mockEnv.CACHE_KV.put).toHaveBeenCalledWith(
        "menu:1",
        JSON.stringify(mockMenuStructure),
        { expirationTtl: 1800 },
      );
    });

    it("should return null when menu not found", async () => {
      (mockEnv.CACHE_KV.get as any).mockResolvedValue(null);
      mockDbService.getMenu.mockResolvedValue(null);

      const result = await menuService.getMenu("999");

      expect(result).toBeNull();
    });

    it("should handle cache errors gracefully", async () => {
      (mockEnv.CACHE_KV.get as any).mockRejectedValue(new Error("Cache error"));
      mockDbService.getMenu.mockResolvedValue(mockMenuStructure);

      const result = await menuService.getMenu("1");

      expect(result).toEqual(mockMenuStructure);
    });

    it("should handle cache store errors gracefully", async () => {
      (mockEnv.CACHE_KV.get as any).mockResolvedValue(null);
      (mockEnv.CACHE_KV.put as any).mockRejectedValue(
        new Error("Cache store error"),
      );
      mockDbService.getMenu.mockResolvedValue(mockMenuStructure);

      const result = await menuService.getMenu("1");

      expect(result).toEqual(mockMenuStructure);
    });

    it("should propagate database errors", async () => {
      (mockEnv.CACHE_KV.get as any).mockResolvedValue(null);
      mockDbService.getMenu.mockRejectedValue(new Error("Database error"));

      await expect(menuService.getMenu("1")).rejects.toThrow("Database error");
    });
  });

  // ========================================
  // Get Menu Item Tests
  // ========================================
  describe("getMenuItem", () => {
    it("should fetch menu item successfully", async () => {
      mockDbService.getMenuItem.mockResolvedValue(mockMenuItem);

      const result = await menuService.getMenuItem(1);

      expect(result).toEqual(mockMenuItem);
      expect(mockDbService.getMenuItem).toHaveBeenCalledWith(1);
    });

    it("should return null when item not found", async () => {
      mockDbService.getMenuItem.mockResolvedValue(null);

      const result = await menuService.getMenuItem(999);

      expect(result).toBeNull();
    });

    it("should transform menu item data", async () => {
      mockDbService.getMenuItem.mockResolvedValue({
        ...mockMenuItem,
        categoryId: "1",
        restaurantId: "1",
      });

      const result = await menuService.getMenuItem(1);

      expect(result?.categoryId).toBe(1);
      expect(result?.restaurantId).toBe(1);
    });

    it("should handle errors", async () => {
      mockDbService.getMenuItem.mockRejectedValue(new Error("Database error"));

      await expect(menuService.getMenuItem(1)).rejects.toThrow();
    });
  });

  // ========================================
  // Create Menu Item Tests
  // ========================================
  describe("createMenuItem", () => {
    const createData: CreateMenuItemData = {
      restaurantId: "1",
      categoryId: 1,
      name: "New Item",
      description: "A new item",
      price: 15.99,
    };

    beforeEach(() => {
      mockDbService.getCategory.mockResolvedValue(mockCategory);
      mockDbService.createMenuItem.mockResolvedValue({ id: 2, ...createData });
    });

    it("should create menu item successfully", async () => {
      const result = await menuService.createMenuItem(createData);

      expect(result.id).toBe(2);
      expect(result.name).toBe("New Item");
    });

    it("should validate category access", async () => {
      mockDbService.getCategory.mockResolvedValue({
        ...mockCategory,
        restaurantId: 2, // Different restaurant
      });

      await expect(menuService.createMenuItem(createData)).rejects.toThrow(
        "Category does not belong to the specified restaurant",
      );
    });

    it("should throw when category not found", async () => {
      mockDbService.getCategory.mockResolvedValue(null);

      await expect(menuService.createMenuItem(createData)).rejects.toThrow(
        "Category not found",
      );
    });

    it("should invalidate menu cache after creation", async () => {
      await menuService.createMenuItem(createData);

      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("menu:1");
    });

    it("should convert restaurantId to string for database", async () => {
      await menuService.createMenuItem(createData);

      expect(mockDbService.createMenuItem).toHaveBeenCalledWith(
        expect.objectContaining({ restaurantId: "1" }),
      );
    });
  });

  // ========================================
  // Update Menu Item Tests
  // ========================================
  describe("updateMenuItem", () => {
    const updateData: UpdateMenuItemData = {
      name: "Updated Item",
      price: 18.99,
    };

    beforeEach(() => {
      mockDbService.getMenuItem.mockResolvedValue(mockMenuItem);
      mockDbService.updateMenuItem.mockResolvedValue({
        ...mockMenuItem,
        ...updateData,
      });
    });

    it("should update menu item successfully", async () => {
      const result = await menuService.updateMenuItem(1, updateData);

      expect(result.name).toBe("Updated Item");
      expect(result.price).toBe(18.99);
    });

    it("should throw when item not found", async () => {
      mockDbService.getMenuItem.mockResolvedValue(null);

      await expect(menuService.updateMenuItem(999, updateData)).rejects.toThrow(
        "Menu item not found",
      );
    });

    it("should validate new category when changing", async () => {
      mockDbService.getCategory.mockResolvedValue({
        ...mockCategory,
        restaurantId: 2, // Different restaurant
      });

      await expect(
        menuService.updateMenuItem(1, { categoryId: 2 }),
      ).rejects.toThrow("Category does not belong to the specified restaurant");
    });

    it("should invalidate menu cache after update", async () => {
      await menuService.updateMenuItem(1, updateData);

      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("menu:1");
    });

    it("should not validate category when not changing", async () => {
      await menuService.updateMenuItem(1, { name: "New Name" });

      expect(mockDbService.getCategory).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Delete Menu Item Tests
  // ========================================
  describe("deleteMenuItem", () => {
    beforeEach(() => {
      mockDbService.getMenuItem.mockResolvedValue(mockMenuItem);
      mockDbService.updateMenuItem.mockResolvedValue({
        ...mockMenuItem,
        isAvailable: false,
      });
    });

    it("should soft delete menu item", async () => {
      const result = await menuService.deleteMenuItem(1);

      expect(result).toBe(true);
      expect(mockDbService.updateMenuItem).toHaveBeenCalledWith(1, {
        isAvailable: false,
        sortOrder: -1,
      });
    });

    it("should return false when item not found", async () => {
      mockDbService.getMenuItem.mockResolvedValue(null);

      const result = await menuService.deleteMenuItem(999);

      expect(result).toBe(false);
    });

    it("should invalidate menu cache after deletion", async () => {
      await menuService.deleteMenuItem(1);

      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("menu:1");
    });
  });

  // ========================================
  // Create Category Tests
  // ========================================
  describe("createCategory", () => {
    const createData: CreateCategoryData = {
      restaurantId: "1",
      name: "New Category",
      description: "A new category",
    };

    it("should create category successfully", async () => {
      mockDbService.createCategory.mockResolvedValue({ id: 2, ...createData });

      const result = await menuService.createCategory(createData);

      expect(result.name).toBe("New Category");
    });

    it("should convert restaurantId to string", async () => {
      mockDbService.createCategory.mockResolvedValue({ id: 2, ...createData });

      await menuService.createCategory(createData);

      expect(mockDbService.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({ restaurantId: "1" }),
      );
    });

    it("should invalidate menu cache", async () => {
      mockDbService.createCategory.mockResolvedValue({ id: 2, ...createData });

      await menuService.createCategory(createData);

      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("menu:1");
    });
  });

  // ========================================
  // Update Category Tests
  // ========================================
  describe("updateCategory", () => {
    const updateData: UpdateCategoryData = {
      name: "Updated Category",
    };

    beforeEach(() => {
      mockDbService.getCategory.mockResolvedValue(mockCategory);
    });

    it("should update category successfully", async () => {
      const result = await menuService.updateCategory(1, updateData);

      expect(result.name).toBe("Updated Category");
    });

    it("should throw when category not found", async () => {
      mockDbService.getCategory.mockResolvedValue(null);

      await expect(menuService.updateCategory(999, updateData)).rejects.toThrow(
        "Category not found",
      );
    });

    it("should invalidate menu cache", async () => {
      await menuService.updateCategory(1, updateData);

      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("menu:1");
    });
  });

  // ========================================
  // Delete Category Tests
  // ========================================
  describe("deleteCategory", () => {
    beforeEach(() => {
      mockDbService.getCategory.mockResolvedValue(mockCategory);
    });

    it("should delete empty category", async () => {
      mockDbService.searchMenuItems.mockResolvedValue({
        items: [],
        pagination: {},
      });

      const result = await menuService.deleteCategory(1);

      expect(result).toBe(true);
    });

    it("should return false when category not found", async () => {
      mockDbService.getCategory.mockResolvedValue(null);

      const result = await menuService.deleteCategory(999);

      expect(result).toBe(false);
    });

    it("should throw when category has items", async () => {
      mockDbService.searchMenuItems.mockResolvedValue({
        items: [mockMenuItem],
        pagination: {},
      });

      await expect(menuService.deleteCategory(1)).rejects.toThrow(
        "Cannot delete category that contains menu items",
      );
    });
  });

  // ========================================
  // Search Menu Items Tests
  // ========================================
  describe("searchMenuItems", () => {
    it("should search with all parameters", async () => {
      const mockResult = {
        items: [mockMenuItem],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockDbService.searchMenuItems.mockResolvedValue(mockResult);

      const params = {
        search: "nasi",
        categoryId: 1,
        priceRange: [10, 20] as [number, number],
        spiceLevel: 2,
        dietaryPreferences: ["halal"],
        isAvailable: true,
        isFeatured: true,
        page: 1,
        limit: 20,
      };

      const result = await menuService.searchMenuItems("1", params);

      expect(result.items).toHaveLength(1);
      expect(mockDbService.searchMenuItems).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({
          search: "nasi",
          categoryId: 1,
        }),
        1,
        20,
      );
    });

    it("should use default pagination", async () => {
      mockDbService.searchMenuItems.mockResolvedValue({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await menuService.searchMenuItems("1", {});

      expect(mockDbService.searchMenuItems).toHaveBeenCalledWith(
        "1",
        expect.any(Object),
        1,
        20,
      );
    });

    it("should transform search results", async () => {
      mockDbService.searchMenuItems.mockResolvedValue({
        items: [{ ...mockMenuItem, categoryId: "1", restaurantId: "1" }],
        pagination: {},
      });

      const result = await menuService.searchMenuItems("1", {});

      expect(result.items[0].categoryId).toBe(1);
      expect(result.items[0].restaurantId).toBe("1");
    });
  });

  // ========================================
  // Featured Items Tests
  // ========================================
  describe("getFeaturedItems", () => {
    it("should fetch featured items", async () => {
      mockDbService.getFeaturedItems.mockResolvedValue([mockMenuItem]);

      const result = await menuService.getFeaturedItems("1", 10);

      expect(result).toHaveLength(1);
      expect(mockDbService.getFeaturedItems).toHaveBeenCalledWith("1", 10);
    });

    it("should use default limit", async () => {
      mockDbService.getFeaturedItems.mockResolvedValue([]);

      await menuService.getFeaturedItems("1");

      expect(mockDbService.getFeaturedItems).toHaveBeenCalledWith("1", 10);
    });

    it("should transform results", async () => {
      mockDbService.getFeaturedItems.mockResolvedValue([
        { ...mockMenuItem, categoryId: "1" },
      ]);

      const result = await menuService.getFeaturedItems("1");

      expect(result[0].categoryId).toBe(1);
    });
  });

  // ========================================
  // Popular Items Tests
  // ========================================
  describe("getPopularItems", () => {
    it("should fetch popular items", async () => {
      mockDbService.getPopularItems.mockResolvedValue([mockMenuItem]);

      const result = await menuService.getPopularItems("1", 10);

      expect(result).toHaveLength(1);
      expect(mockDbService.getPopularItems).toHaveBeenCalledWith("1", 10);
    });

    it("should use default limit", async () => {
      mockDbService.getPopularItems.mockResolvedValue([]);

      await menuService.getPopularItems("1");

      expect(mockDbService.getPopularItems).toHaveBeenCalledWith("1", 10);
    });
  });

  // ========================================
  // Batch Operations Tests
  // ========================================
  describe("batchUpdateAvailability", () => {
    it("should batch update availability", async () => {
      mockDbService.batchUpdateAvailability.mockResolvedValue(undefined);

      const updates = [
        { id: 1, isAvailable: false },
        { id: 2, isAvailable: true },
      ];

      await menuService.batchUpdateAvailability("1", updates);

      expect(mockDbService.batchUpdateAvailability).toHaveBeenCalledWith(
        "1",
        updates,
      );
    });

    it("should invalidate cache after batch update", async () => {
      mockDbService.batchUpdateAvailability.mockResolvedValue(undefined);

      await menuService.batchUpdateAvailability("1", []);

      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("menu:1");
    });
  });

  describe("batchUpdatePrices", () => {
    it("should update each item price", async () => {
      mockDbService.updateMenuItem.mockResolvedValue(mockMenuItem);

      const updates = [
        { id: 1, price: 15.99, originalPrice: 18.99 },
        { id: 2, price: 12.99 },
      ];

      await menuService.batchUpdatePrices("1", updates);

      expect(mockDbService.updateMenuItem).toHaveBeenCalledTimes(2);
      expect(mockDbService.updateMenuItem).toHaveBeenCalledWith(1, {
        price: 15.99,
        originalPrice: 18.99,
      });
    });

    it("should invalidate cache after batch update", async () => {
      mockDbService.updateMenuItem.mockResolvedValue(mockMenuItem);

      await menuService.batchUpdatePrices("1", [{ id: 1, price: 10 }]);

      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("menu:1");
    });
  });

  describe("batchMoveItems", () => {
    beforeEach(() => {
      mockDbService.getCategory.mockResolvedValue(mockCategory);
      mockDbService.updateMenuItem.mockResolvedValue(mockMenuItem);
    });

    it("should move items to new category", async () => {
      const moves = [
        { id: 1, categoryId: 2 },
        { id: 2, categoryId: 2 },
      ];

      await menuService.batchMoveItems("1", moves);

      expect(mockDbService.updateMenuItem).toHaveBeenCalledTimes(2);
    });

    it("should validate all target categories", async () => {
      const moves = [
        { id: 1, categoryId: 2 },
        { id: 2, categoryId: 3 },
      ];

      await menuService.batchMoveItems("1", moves);

      expect(mockDbService.getCategory).toHaveBeenCalledTimes(2);
    });

    it("should throw when category not found", async () => {
      mockDbService.getCategory.mockResolvedValue(null);

      await expect(
        menuService.batchMoveItems("1", [{ id: 1, categoryId: 99 }]),
      ).rejects.toThrow("Category not found");
    });

    it("should invalidate cache after moves", async () => {
      await menuService.batchMoveItems("1", [{ id: 1, categoryId: 2 }]);

      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith("menu:1");
    });
  });

  // ========================================
  // Analytics Tests
  // ========================================
  describe("getMenuAnalytics", () => {
    beforeEach(() => {
      (mockEnv.CACHE_KV.get as any).mockResolvedValue(null);
      mockDbService.getMenu.mockResolvedValue({
        categories: [mockCategory],
        menuItems: [
          mockMenuItem,
          { ...mockMenuItem, id: 2, isAvailable: false, isFeatured: false },
          {
            ...mockMenuItem,
            id: 3,
            dietaryInfo: { vegetarian: true, vegan: true },
          },
        ],
      });
    });

    it("should calculate basic statistics", async () => {
      const result = await menuService.getMenuAnalytics("1");

      expect(result.totalItems).toBe(3);
      expect(result.availableItems).toBeGreaterThan(0);
      expect(result.featuredItems).toBeGreaterThan(0);
    });

    it("should calculate price statistics", async () => {
      const result = await menuService.getMenuAnalytics("1");

      expect(result.averagePrice).toBeGreaterThan(0);
      expect(result.priceRange.min).toBeDefined();
      expect(result.priceRange.max).toBeDefined();
    });

    it("should calculate category distribution", async () => {
      const result = await menuService.getMenuAnalytics("1");

      expect(result.categoryDistribution).toBeInstanceOf(Array);
      expect(result.categoryDistribution[0]).toHaveProperty("categoryId");
      expect(result.categoryDistribution[0]).toHaveProperty("categoryName");
      expect(result.categoryDistribution[0]).toHaveProperty("itemCount");
      expect(result.categoryDistribution[0]).toHaveProperty("percentage");
    });

    it("should get top performing items", async () => {
      const result = await menuService.getMenuAnalytics("1");

      expect(result.topPerformingItems).toBeInstanceOf(Array);
      expect(result.topPerformingItems[0]).toHaveProperty("orderCount");
      expect(result.topPerformingItems[0]).toHaveProperty("revenue");
    });

    it("should calculate dietary info stats", async () => {
      const result = await menuService.getMenuAnalytics("1");

      expect(result.dietaryInfoStats).toHaveProperty("vegetarian");
      expect(result.dietaryInfoStats).toHaveProperty("vegan");
      expect(result.dietaryInfoStats).toHaveProperty("glutenFree");
      expect(result.dietaryInfoStats).toHaveProperty("halal");
    });

    it("should calculate spice level distribution", async () => {
      const result = await menuService.getMenuAnalytics("1");

      expect(result.spiceLevelDistribution).toBeDefined();
    });

    it("should throw when menu not found", async () => {
      mockDbService.getMenu.mockResolvedValue(null);

      await expect(menuService.getMenuAnalytics("999")).rejects.toThrow(
        "Menu not found for restaurant",
      );
    });
  });

  describe("getPopularityMetrics", () => {
    beforeEach(() => {
      mockDbService.getPopularItems.mockResolvedValue([mockMenuItem]);
      mockDbService.searchMenuItems.mockResolvedValue({
        items: [mockMenuItem],
        pagination: {},
      });
    });

    it("should fetch all popularity metrics", async () => {
      const result = await menuService.getPopularityMetrics("1");

      expect(result.mostOrdered).toBeInstanceOf(Array);
      expect(result.mostViewed).toBeInstanceOf(Array);
      expect(result.highestRated).toBeInstanceOf(Array);
      expect(result.recentlyAdded).toBeInstanceOf(Array);
    });
  });

  // ========================================
  // Utility Functions Tests
  // ========================================
  describe("incrementOrderCount", () => {
    it("should increment order count", async () => {
      mockDbService.incrementOrderCount.mockResolvedValue(undefined);

      await menuService.incrementOrderCount(1, 2);

      expect(mockDbService.incrementOrderCount).toHaveBeenCalledWith(1, 2);
    });

    it("should use default increment of 1", async () => {
      mockDbService.incrementOrderCount.mockResolvedValue(undefined);

      await menuService.incrementOrderCount(1);

      expect(mockDbService.incrementOrderCount).toHaveBeenCalledWith(1, 1);
    });
  });

  describe("incrementViewCount", () => {
    it("should increment view count", async () => {
      mockDbService.incrementViewCount.mockResolvedValue(undefined);

      await menuService.incrementViewCount(1);

      expect(mockDbService.incrementViewCount).toHaveBeenCalledWith(1);
    });
  });

  describe("updateItemRating", () => {
    it("should update item rating without error", async () => {
      // This is a stub implementation that logs but doesn't throw
      await expect(menuService.updateItemRating(1, 4.5)).resolves.not.toThrow();
    });
  });

  // ========================================
  // Cache Invalidation Tests
  // ========================================
  describe("cache invalidation", () => {
    it("should handle cache deletion error gracefully", async () => {
      (mockEnv.CACHE_KV.delete as any).mockRejectedValue(
        new Error("Cache error"),
      );
      mockDbService.getMenuItem.mockResolvedValue(mockMenuItem);
      mockDbService.updateMenuItem.mockResolvedValue(mockMenuItem);

      // Should not throw despite cache error
      await expect(menuService.deleteMenuItem(1)).resolves.toBe(true);
    });

    it("should skip cache operations when cache service unavailable", async () => {
      const serviceWithoutCache = new MenuService({
        ...mockEnv,
        CACHE_KV: undefined,
      } as any);
      (serviceWithoutCache as any).dbService = mockDbService;
      (serviceWithoutCache as any).cacheService = undefined;

      mockDbService.getMenu.mockResolvedValue(mockMenuStructure);

      await serviceWithoutCache.getMenu("1");

      // Should not throw and should work without cache
      expect(mockDbService.getMenu).toHaveBeenCalled();
    });
  });

  // ========================================
  // Transform Helper Tests
  // ========================================
  describe("data transformation", () => {
    it("should transform menu item with defaults", async () => {
      const rawItem = {
        id: 1,
        name: "Test",
        price: 10,
        // Missing optional fields
      };
      mockDbService.getMenuItem.mockResolvedValue(rawItem);

      const result = await menuService.getMenuItem(1);

      expect(result?.isAvailable).toBe(false);
      expect(result?.isFeatured).toBe(false);
      expect(result?.isPopular).toBe(false);
      expect(result?.sortOrder).toBe(0);
      expect(result?.spiceLevel).toBe(0);
      expect(result?.inventoryCount).toBe(0);
      expect(result?.orderCount).toBe(0);
      expect(result?.allergens).toEqual([]);
    });

    it("should transform category with defaults", async () => {
      const rawCategory = {
        id: 1,
        name: "Test",
        restaurantId: "1",
      };
      mockDbService.getCategory.mockResolvedValue(rawCategory);
      mockDbService.searchMenuItems.mockResolvedValue({
        items: [],
        pagination: {},
      });

      const result = await menuService.deleteCategory(1);

      // Category was found and processed
      expect(mockDbService.getCategory).toHaveBeenCalled();
    });
  });
});
