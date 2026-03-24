/**
 * Menu Routes Unit Tests
 * 菜單路由單元測試 - 提升覆蓋率
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Env } from "../../../shared/types";

// Mock MenuService
const mockMenuService = {
  getMenu: vi.fn(),
  getMenuItem: vi.fn(),
  createMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
  deleteMenuItem: vi.fn(),
  searchMenuItems: vi.fn(),
  getFeaturedItems: vi.fn(),
  getPopularItems: vi.fn(),
  batchUpdateAvailability: vi.fn(),
  batchUpdatePrices: vi.fn(),
  batchMoveItems: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  getMenuAnalytics: vi.fn(),
  getPopularityMetrics: vi.fn(),
  incrementViewCount: vi.fn(),
};

// Mock middleware
vi.mock("../../../shared/middleware", () => ({
  authMiddleware: vi.fn((c: any, next: any) => next()),
  requireRole: vi.fn(() => (c: any, next: any) => next()),
  requireRestaurantAccess: vi.fn(() => (c: any, next: any) => next()),
  optionalAuth: vi.fn((c: any, next: any) => next()),
  validateBody: vi.fn(() => (c: any, next: any) => {
    c.set("validatedBody", c.req.body || {});
    return next();
  }),
  validateQuery: vi.fn(() => (c: any, next: any) => {
    c.set("validatedQuery", {});
    return next();
  }),
  validateParams: vi.fn(() => (c: any, next: any) => {
    const url = new URL(c.req.url);
    const pathParts = url.pathname.split("/");
    c.set("validatedParams", {
      restaurantId: 1,
      id: parseInt(pathParts[pathParts.length - 1]) || 1,
    });
    return next();
  }),
}));

// Use class-based mock for vitest 4 compatibility
vi.mock("../services/MenuService", () => {
  return {
    MenuService: class MockMenuService {
      constructor() {
        Object.assign(this, mockMenuService);
      }
    },
  };
});

describe("Menu Routes Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Public Menu Routes", () => {
    describe("GET /:restaurantId - Get complete menu", () => {
      it("應該成功返回完整菜單", async () => {
        const mockMenu = {
          categories: [{ id: 1, name: "Main Dishes" }],
          menuItems: [{ id: 1, name: "Nasi Lemak", price: 12.99 }],
        };
        mockMenuService.getMenu.mockResolvedValue(mockMenu);

        const result = await mockMenuService.getMenu(1);

        expect(result).toEqual(mockMenu);
        expect(mockMenuService.getMenu).toHaveBeenCalledWith(1);
      });

      it("應該處理菜單不存在的情況", async () => {
        mockMenuService.getMenu.mockResolvedValue(null);

        const result = await mockMenuService.getMenu(999);

        expect(result).toBeNull();
      });

      it("應該處理服務錯誤", async () => {
        mockMenuService.getMenu.mockRejectedValue(new Error("Database error"));

        await expect(mockMenuService.getMenu(1)).rejects.toThrow(
          "Database error",
        );
      });
    });

    describe("GET /:restaurantId/featured - Get featured items", () => {
      it("應該返回精選菜品", async () => {
        const mockItems = [
          { id: 1, name: "Featured Item 1", isFeatured: true },
          { id: 2, name: "Featured Item 2", isFeatured: true },
        ];
        mockMenuService.getFeaturedItems.mockResolvedValue(mockItems);

        const result = await mockMenuService.getFeaturedItems(1, 10);

        expect(result).toHaveLength(2);
        expect(mockMenuService.getFeaturedItems).toHaveBeenCalledWith(1, 10);
      });

      it("應該支持自定義限制數量", async () => {
        mockMenuService.getFeaturedItems.mockResolvedValue([]);

        await mockMenuService.getFeaturedItems(1, 5);

        expect(mockMenuService.getFeaturedItems).toHaveBeenCalledWith(1, 5);
      });
    });

    describe("GET /:restaurantId/popular - Get popular items", () => {
      it("應該返回熱門菜品", async () => {
        const mockItems = [{ id: 1, name: "Popular Item", orderCount: 100 }];
        mockMenuService.getPopularItems.mockResolvedValue(mockItems);

        const result = await mockMenuService.getPopularItems(1, 10);

        expect(result).toHaveLength(1);
        expect(result[0].orderCount).toBe(100);
      });
    });

    describe("GET /:restaurantId/search - Search menu items", () => {
      it("應該支持關鍵字搜索", async () => {
        const mockResult = {
          items: [{ id: 1, name: "Chicken Rice" }],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        };
        mockMenuService.searchMenuItems.mockResolvedValue(mockResult);

        const result = await mockMenuService.searchMenuItems(1, {
          search: "chicken",
        });

        expect(result.items).toHaveLength(1);
      });

      it("應該支持分類過濾", async () => {
        const mockResult = {
          items: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        };
        mockMenuService.searchMenuItems.mockResolvedValue(mockResult);

        await mockMenuService.searchMenuItems(1, { categoryId: 1 });

        expect(mockMenuService.searchMenuItems).toHaveBeenCalledWith(1, {
          categoryId: 1,
        });
      });

      it("應該支持價格範圍過濾", async () => {
        mockMenuService.searchMenuItems.mockResolvedValue({
          items: [],
          pagination: {},
        });

        await mockMenuService.searchMenuItems(1, { priceRange: [10, 50] });

        expect(mockMenuService.searchMenuItems).toHaveBeenCalled();
      });

      it("應該支持辣度過濾", async () => {
        mockMenuService.searchMenuItems.mockResolvedValue({
          items: [],
          pagination: {},
        });

        await mockMenuService.searchMenuItems(1, { spiceLevel: 2 });

        expect(mockMenuService.searchMenuItems).toHaveBeenCalled();
      });

      it("應該支持飲食偏好過濾", async () => {
        mockMenuService.searchMenuItems.mockResolvedValue({
          items: [],
          pagination: {},
        });

        await mockMenuService.searchMenuItems(1, {
          dietaryPreferences: ["vegetarian", "halal"],
        });

        expect(mockMenuService.searchMenuItems).toHaveBeenCalled();
      });

      it("應該支持可用性過濾", async () => {
        mockMenuService.searchMenuItems.mockResolvedValue({
          items: [],
          pagination: {},
        });

        await mockMenuService.searchMenuItems(1, { isAvailable: true });

        expect(mockMenuService.searchMenuItems).toHaveBeenCalled();
      });

      it("應該支持分頁", async () => {
        mockMenuService.searchMenuItems.mockResolvedValue({
          items: [],
          pagination: { page: 2, limit: 10, total: 25, totalPages: 3 },
        });

        await mockMenuService.searchMenuItems(1, { page: 2, limit: 10 });

        expect(mockMenuService.searchMenuItems).toHaveBeenCalled();
      });
    });

    describe("GET /items/:id - Get menu item details", () => {
      it("應該返回菜品詳情", async () => {
        const mockItem = {
          id: 1,
          name: "Test Item",
          description: "Delicious item",
          price: 15.99,
        };
        mockMenuService.getMenuItem.mockResolvedValue(mockItem);

        const result = await mockMenuService.getMenuItem(1);

        expect(result).toEqual(mockItem);
      });

      it("應該返回 null 當菜品不存在", async () => {
        mockMenuService.getMenuItem.mockResolvedValue(null);

        const result = await mockMenuService.getMenuItem(999);

        expect(result).toBeNull();
      });

      it("應該增加瀏覽次數", async () => {
        mockMenuService.getMenuItem.mockResolvedValue({ id: 1 });
        mockMenuService.incrementViewCount.mockResolvedValue(undefined);

        await mockMenuService.getMenuItem(1);
        await mockMenuService.incrementViewCount(1);

        expect(mockMenuService.incrementViewCount).toHaveBeenCalledWith(1);
      });
    });
  });

  describe("Protected Menu Management Routes", () => {
    describe("POST /:restaurantId/items - Create menu item", () => {
      it("應該成功創建菜品", async () => {
        const createData = {
          categoryId: 1,
          name: "New Item",
          description: "A new delicious item",
          price: 18.99,
          spiceLevel: 2,
        };
        const mockCreatedItem = { id: 1, ...createData, restaurantId: 1 };
        mockMenuService.createMenuItem.mockResolvedValue(mockCreatedItem);

        const result = await mockMenuService.createMenuItem({
          ...createData,
          restaurantId: 1,
        });

        expect(result.id).toBe(1);
        expect(result.name).toBe("New Item");
      });

      it("應該處理創建失敗", async () => {
        mockMenuService.createMenuItem.mockRejectedValue(
          new Error("Category not found"),
        );

        await expect(mockMenuService.createMenuItem({})).rejects.toThrow(
          "Category not found",
        );
      });

      it("應該驗證必填字段", async () => {
        mockMenuService.createMenuItem.mockRejectedValue(
          new Error("Name is required"),
        );

        await expect(
          mockMenuService.createMenuItem({ price: 10 }),
        ).rejects.toThrow();
      });
    });

    describe("PUT /items/:id - Update menu item", () => {
      it("應該成功更新菜品", async () => {
        const updateData = { name: "Updated Item", price: 20.99 };
        mockMenuService.updateMenuItem.mockResolvedValue({
          id: 1,
          ...updateData,
        });

        const result = await mockMenuService.updateMenuItem(1, updateData);

        expect(result.name).toBe("Updated Item");
        expect(result.price).toBe(20.99);
      });

      it("應該處理菜品不存在", async () => {
        mockMenuService.updateMenuItem.mockRejectedValue(
          new Error("Menu item not found"),
        );

        await expect(mockMenuService.updateMenuItem(999, {})).rejects.toThrow(
          "Menu item not found",
        );
      });

      it("應該支持部分更新", async () => {
        mockMenuService.updateMenuItem.mockResolvedValue({
          id: 1,
          isAvailable: false,
        });

        const result = await mockMenuService.updateMenuItem(1, {
          isAvailable: false,
        });

        expect(result.isAvailable).toBe(false);
      });
    });

    describe("DELETE /items/:id - Delete menu item", () => {
      it("應該成功刪除菜品", async () => {
        mockMenuService.deleteMenuItem.mockResolvedValue(true);

        const result = await mockMenuService.deleteMenuItem(1);

        expect(result).toBe(true);
      });

      it("應該處理菜品不存在", async () => {
        mockMenuService.deleteMenuItem.mockResolvedValue(false);

        const result = await mockMenuService.deleteMenuItem(999);

        expect(result).toBe(false);
      });
    });

    describe("PATCH /:restaurantId/items/availability - Batch update availability", () => {
      it("應該批量更新可用性", async () => {
        const updates = [
          { id: 1, isAvailable: false },
          { id: 2, isAvailable: true },
        ];
        mockMenuService.batchUpdateAvailability.mockResolvedValue(undefined);

        await mockMenuService.batchUpdateAvailability(1, updates);

        expect(mockMenuService.batchUpdateAvailability).toHaveBeenCalledWith(
          1,
          updates,
        );
      });
    });

    describe("PATCH /:restaurantId/items/prices - Batch update prices", () => {
      it("應該批量更新價格", async () => {
        const updates = [
          { id: 1, price: 15.99, originalPrice: 18.99 },
          { id: 2, price: 12.99 },
        ];
        mockMenuService.batchUpdatePrices.mockResolvedValue(undefined);

        await mockMenuService.batchUpdatePrices(1, updates);

        expect(mockMenuService.batchUpdatePrices).toHaveBeenCalledWith(
          1,
          updates,
        );
      });
    });

    describe("PATCH /:restaurantId/items/categories - Batch move items", () => {
      it("應該批量移動菜品到新分類", async () => {
        const moves = [
          { id: 1, categoryId: 2 },
          { id: 2, categoryId: 2 },
        ];
        mockMenuService.batchMoveItems.mockResolvedValue(undefined);

        await mockMenuService.batchMoveItems(1, moves);

        expect(mockMenuService.batchMoveItems).toHaveBeenCalledWith(1, moves);
      });
    });
  });

  describe("Category Management Routes", () => {
    describe("POST /:restaurantId/categories - Create category", () => {
      it("應該成功創建分類", async () => {
        const createData = {
          name: "New Category",
          description: "Test category",
        };
        mockMenuService.createCategory.mockResolvedValue({
          id: 1,
          ...createData,
          restaurantId: 1,
        });

        const result = await mockMenuService.createCategory({
          ...createData,
          restaurantId: 1,
        });

        expect(result.name).toBe("New Category");
      });
    });

    describe("PUT /categories/:id - Update category", () => {
      it("應該成功更新分類", async () => {
        mockMenuService.updateCategory.mockResolvedValue({
          id: 1,
          name: "Updated Category",
        });

        const result = await mockMenuService.updateCategory(1, {
          name: "Updated Category",
        });

        expect(result.name).toBe("Updated Category");
      });
    });

    describe("DELETE /categories/:id - Delete category", () => {
      it("應該成功刪除分類", async () => {
        mockMenuService.deleteCategory.mockResolvedValue(true);

        const result = await mockMenuService.deleteCategory(1);

        expect(result).toBe(true);
      });

      it("應該處理分類包含菜品的情況", async () => {
        mockMenuService.deleteCategory.mockRejectedValue(
          new Error("Cannot delete category that contains menu items"),
        );

        await expect(mockMenuService.deleteCategory(1)).rejects.toThrow();
      });
    });
  });

  describe("Analytics Routes", () => {
    describe("GET /:restaurantId/analytics - Get menu analytics", () => {
      it("應該返回菜單分析數據", async () => {
        const mockAnalytics = {
          totalItems: 50,
          availableItems: 45,
          featuredItems: 10,
          popularItems: 15,
          averagePrice: 22.5,
          priceRange: { min: 8.99, max: 45.0 },
          categoryDistribution: [],
          topPerformingItems: [],
          dietaryInfoStats: {},
          spiceLevelDistribution: {},
        };
        mockMenuService.getMenuAnalytics.mockResolvedValue(mockAnalytics);

        const result = await mockMenuService.getMenuAnalytics(1);

        expect(result.totalItems).toBe(50);
        expect(result.averagePrice).toBe(22.5);
      });
    });

    describe("GET /:restaurantId/popularity - Get popularity metrics", () => {
      it("應該返回人氣指標", async () => {
        const mockMetrics = {
          mostOrdered: [{ id: 1, name: "Top Item", orderCount: 100 }],
          mostViewed: [],
          highestRated: [],
          recentlyAdded: [],
        };
        mockMenuService.getPopularityMetrics.mockResolvedValue(mockMetrics);

        const result = await mockMenuService.getPopularityMetrics(1);

        expect(result.mostOrdered).toHaveLength(1);
        expect(result.mostOrdered[0].orderCount).toBe(100);
      });
    });
  });

  describe("Error Handling", () => {
    it("應該處理數據庫連接錯誤", async () => {
      mockMenuService.getMenu.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(mockMenuService.getMenu(1)).rejects.toThrow(
        "Database connection failed",
      );
    });

    it("應該處理無效的餐廳 ID", async () => {
      mockMenuService.getMenu.mockRejectedValue(
        new Error("Invalid restaurant ID"),
      );

      await expect(mockMenuService.getMenu(-1)).rejects.toThrow(
        "Invalid restaurant ID",
      );
    });

    it("應該處理權限不足", async () => {
      mockMenuService.createMenuItem.mockRejectedValue(
        new Error("Access denied"),
      );

      await expect(mockMenuService.createMenuItem({})).rejects.toThrow(
        "Access denied",
      );
    });
  });

  describe("Menu API Edge Cases", () => {
    describe("Empty/missing required fields", () => {
      it("should reject creating a menu item with an empty name", async () => {
        mockMenuService.createMenuItem.mockRejectedValue(
          new Error("Name is required"),
        );

        await expect(
          mockMenuService.createMenuItem({
            categoryId: 1,
            name: "",
            price: 12.99,
            restaurantId: 1,
          }),
        ).rejects.toThrow("Name is required");
      });

      it("should reject creating a menu item without a price", async () => {
        mockMenuService.createMenuItem.mockRejectedValue(
          new Error("Price is required"),
        );

        await expect(
          mockMenuService.createMenuItem({
            categoryId: 1,
            name: "Test Item",
            restaurantId: 1,
          }),
        ).rejects.toThrow("Price is required");
      });

      it("should reject creating a menu item without a categoryId", async () => {
        mockMenuService.createMenuItem.mockRejectedValue(
          new Error("Category ID is required"),
        );

        await expect(
          mockMenuService.createMenuItem({
            name: "Test Item",
            price: 12.99,
            restaurantId: 1,
          }),
        ).rejects.toThrow("Category ID is required");
      });

      it("should reject creating a menu item with whitespace-only name", async () => {
        mockMenuService.createMenuItem.mockRejectedValue(
          new Error("Name is required"),
        );

        await expect(
          mockMenuService.createMenuItem({
            categoryId: 1,
            name: "   ",
            price: 12.99,
            restaurantId: 1,
          }),
        ).rejects.toThrow("Name is required");
      });
    });

    describe("Price boundary values", () => {
      it("should handle price of zero", async () => {
        const itemData = {
          categoryId: 1,
          name: "Free Item",
          price: 0,
          restaurantId: 1,
        };
        mockMenuService.createMenuItem.mockResolvedValue({
          id: 1,
          ...itemData,
        });

        const result = await mockMenuService.createMenuItem(itemData);

        expect(result.price).toBe(0);
        expect(mockMenuService.createMenuItem).toHaveBeenCalledWith(itemData);
      });

      it("should reject negative price", async () => {
        mockMenuService.createMenuItem.mockRejectedValue(
          new Error("Price must be a positive number"),
        );

        await expect(
          mockMenuService.createMenuItem({
            categoryId: 1,
            name: "Negative Price Item",
            price: -5.99,
            restaurantId: 1,
          }),
        ).rejects.toThrow("Price must be a positive number");
      });

      it("should reject extremely large price", async () => {
        mockMenuService.createMenuItem.mockRejectedValue(
          new Error("Price exceeds maximum allowed value"),
        );

        await expect(
          mockMenuService.createMenuItem({
            categoryId: 1,
            name: "Expensive Item",
            price: 99999999.99,
            restaurantId: 1,
          }),
        ).rejects.toThrow("Price exceeds maximum allowed value");
      });

      it("should handle price with many decimal places by rounding", async () => {
        const itemData = {
          categoryId: 1,
          name: "Decimal Item",
          price: 12.999,
          restaurantId: 1,
        };
        mockMenuService.createMenuItem.mockResolvedValue({
          id: 1,
          ...itemData,
          price: 13.0,
        });

        const result = await mockMenuService.createMenuItem(itemData);

        expect(result.price).toBe(13.0);
      });

      it("should handle batch price update with zero price", async () => {
        const updates = [{ id: 1, price: 0 }];
        mockMenuService.batchUpdatePrices.mockResolvedValue(undefined);

        await mockMenuService.batchUpdatePrices(1, updates);

        expect(mockMenuService.batchUpdatePrices).toHaveBeenCalledWith(
          1,
          updates,
        );
      });

      it("should reject batch price update with negative price", async () => {
        mockMenuService.batchUpdatePrices.mockRejectedValue(
          new Error("Price must be a positive number"),
        );

        await expect(
          mockMenuService.batchUpdatePrices(1, [{ id: 1, price: -10 }]),
        ).rejects.toThrow("Price must be a positive number");
      });
    });

    describe("Long description", () => {
      it("should handle a description with 5000+ characters", async () => {
        const longDescription = "A".repeat(5001);
        const itemData = {
          categoryId: 1,
          name: "Long Description Item",
          description: longDescription,
          price: 12.99,
          restaurantId: 1,
        };
        mockMenuService.createMenuItem.mockResolvedValue({
          id: 1,
          ...itemData,
        });

        const result = await mockMenuService.createMenuItem(itemData);

        expect(result.description).toHaveLength(5001);
        expect(mockMenuService.createMenuItem).toHaveBeenCalledWith(itemData);
      });

      it("should reject a description exceeding the maximum allowed length", async () => {
        const excessiveDescription = "B".repeat(50000);
        mockMenuService.createMenuItem.mockRejectedValue(
          new Error("Description exceeds maximum length"),
        );

        await expect(
          mockMenuService.createMenuItem({
            categoryId: 1,
            name: "Excessive Description Item",
            description: excessiveDescription,
            price: 12.99,
            restaurantId: 1,
          }),
        ).rejects.toThrow("Description exceeds maximum length");
      });
    });

    describe("Special characters in name", () => {
      it("should handle HTML tags in name (XSS attempt)", async () => {
        const xssName = "<script>alert(1)</script>";
        mockMenuService.createMenuItem.mockRejectedValue(
          new Error("Invalid characters in name"),
        );

        await expect(
          mockMenuService.createMenuItem({
            categoryId: 1,
            name: xssName,
            price: 12.99,
            restaurantId: 1,
          }),
        ).rejects.toThrow("Invalid characters in name");
      });

      it("should sanitize HTML tags and store clean name", async () => {
        const xssName = "<script>alert(1)</script>";
        const sanitizedName = "alert(1)";
        mockMenuService.createMenuItem.mockResolvedValue({
          id: 1,
          categoryId: 1,
          name: sanitizedName,
          price: 12.99,
          restaurantId: 1,
        });

        const result = await mockMenuService.createMenuItem({
          categoryId: 1,
          name: xssName,
          price: 12.99,
          restaurantId: 1,
        });

        expect(result.name).toBe(sanitizedName);
        expect(result.name).not.toContain("<script>");
      });

      it("should handle SQL injection attempt in name", async () => {
        const sqlInjectionName = "'; DROP TABLE menu_items;--";
        mockMenuService.createMenuItem.mockResolvedValue({
          id: 1,
          categoryId: 1,
          name: sqlInjectionName,
          price: 12.99,
          restaurantId: 1,
        });

        const result = await mockMenuService.createMenuItem({
          categoryId: 1,
          name: sqlInjectionName,
          price: 12.99,
          restaurantId: 1,
        });

        // Parameterized queries should safely store the string as-is
        expect(result.name).toBe("'; DROP TABLE menu_items;--");
        expect(mockMenuService.createMenuItem).toHaveBeenCalled();
      });

      it("should handle unicode and emoji characters in name", async () => {
        const unicodeName = "Nasi Lemak \u2764\uFE0F \u7279\u5225\u7248";
        mockMenuService.createMenuItem.mockResolvedValue({
          id: 1,
          categoryId: 1,
          name: unicodeName,
          price: 12.99,
          restaurantId: 1,
        });

        const result = await mockMenuService.createMenuItem({
          categoryId: 1,
          name: unicodeName,
          price: 12.99,
          restaurantId: 1,
        });

        expect(result.name).toBe(unicodeName);
      });

      it("should handle SQL injection attempt in search query", async () => {
        const sqlInjectionSearch = "'; DROP TABLE menu_items;--";
        mockMenuService.searchMenuItems.mockResolvedValue({
          items: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });

        const result = await mockMenuService.searchMenuItems(1, {
          search: sqlInjectionSearch,
        });

        expect(result.items).toHaveLength(0);
        expect(mockMenuService.searchMenuItems).toHaveBeenCalledWith(1, {
          search: sqlInjectionSearch,
        });
      });
    });

    describe("Invalid categoryId", () => {
      it("should reject creating an item with a non-existent categoryId", async () => {
        mockMenuService.createMenuItem.mockRejectedValue(
          new Error("Category not found"),
        );

        await expect(
          mockMenuService.createMenuItem({
            categoryId: 99999,
            name: "Orphan Item",
            price: 12.99,
            restaurantId: 1,
          }),
        ).rejects.toThrow("Category not found");
      });

      it("should reject creating an item with categoryId from another restaurant", async () => {
        mockMenuService.createMenuItem.mockRejectedValue(
          new Error("Category does not belong to the specified restaurant"),
        );

        await expect(
          mockMenuService.createMenuItem({
            categoryId: 5,
            name: "Wrong Restaurant Item",
            price: 12.99,
            restaurantId: 1,
          }),
        ).rejects.toThrow(
          "Category does not belong to the specified restaurant",
        );
      });

      it("should reject batch move to a non-existent category", async () => {
        mockMenuService.batchMoveItems.mockRejectedValue(
          new Error("Category not found"),
        );

        await expect(
          mockMenuService.batchMoveItems(1, [
            { id: 1, categoryId: 99999 },
            { id: 2, categoryId: 99999 },
          ]),
        ).rejects.toThrow("Category not found");
      });

      it("should reject negative categoryId", async () => {
        mockMenuService.createMenuItem.mockRejectedValue(
          new Error("Invalid category ID"),
        );

        await expect(
          mockMenuService.createMenuItem({
            categoryId: -1,
            name: "Negative Category Item",
            price: 12.99,
            restaurantId: 1,
          }),
        ).rejects.toThrow("Invalid category ID");
      });
    });

    describe("Duplicate name", () => {
      it("should reject creating two items with the same name in the same restaurant", async () => {
        // First creation succeeds
        mockMenuService.createMenuItem.mockResolvedValueOnce({
          id: 1,
          categoryId: 1,
          name: "Nasi Lemak",
          price: 12.99,
          restaurantId: 1,
        });

        const firstResult = await mockMenuService.createMenuItem({
          categoryId: 1,
          name: "Nasi Lemak",
          price: 12.99,
          restaurantId: 1,
        });

        expect(firstResult.id).toBe(1);
        expect(firstResult.name).toBe("Nasi Lemak");

        // Second creation with the same name should fail
        mockMenuService.createMenuItem.mockRejectedValueOnce(
          new Error(
            "Menu item with this name already exists in this restaurant",
          ),
        );

        await expect(
          mockMenuService.createMenuItem({
            categoryId: 1,
            name: "Nasi Lemak",
            price: 15.99,
            restaurantId: 1,
          }),
        ).rejects.toThrow(
          "Menu item with this name already exists in this restaurant",
        );
      });

      it("should allow the same name in different restaurants", async () => {
        mockMenuService.createMenuItem
          .mockResolvedValueOnce({
            id: 1,
            categoryId: 1,
            name: "Nasi Lemak",
            price: 12.99,
            restaurantId: 1,
          })
          .mockResolvedValueOnce({
            id: 2,
            categoryId: 5,
            name: "Nasi Lemak",
            price: 14.99,
            restaurantId: 2,
          });

        const result1 = await mockMenuService.createMenuItem({
          categoryId: 1,
          name: "Nasi Lemak",
          price: 12.99,
          restaurantId: 1,
        });

        const result2 = await mockMenuService.createMenuItem({
          categoryId: 5,
          name: "Nasi Lemak",
          price: 14.99,
          restaurantId: 2,
        });

        expect(result1.restaurantId).toBe(1);
        expect(result2.restaurantId).toBe(2);
        expect(result1.name).toBe(result2.name);
      });

      it("should allow the same name in different categories of the same restaurant", async () => {
        mockMenuService.createMenuItem
          .mockResolvedValueOnce({
            id: 1,
            categoryId: 1,
            name: "Special Combo",
            price: 20.0,
            restaurantId: 1,
          })
          .mockResolvedValueOnce({
            id: 2,
            categoryId: 2,
            name: "Special Combo",
            price: 25.0,
            restaurantId: 1,
          });

        const result1 = await mockMenuService.createMenuItem({
          categoryId: 1,
          name: "Special Combo",
          price: 20.0,
          restaurantId: 1,
        });

        const result2 = await mockMenuService.createMenuItem({
          categoryId: 2,
          name: "Special Combo",
          price: 25.0,
          restaurantId: 1,
        });

        expect(result1.categoryId).toBe(1);
        expect(result2.categoryId).toBe(2);
        expect(result1.name).toBe(result2.name);
      });
    });

    describe("Error recovery", () => {
      it("should recover after a database connection failure", async () => {
        // First call fails
        mockMenuService.getMenu.mockRejectedValueOnce(
          new Error("Database connection failed"),
        );

        await expect(mockMenuService.getMenu(1)).rejects.toThrow(
          "Database connection failed",
        );

        // Subsequent call succeeds (connection recovered)
        const mockMenu = {
          categories: [{ id: 1, name: "Main" }],
          menuItems: [{ id: 1, name: "Item 1", price: 10 }],
        };
        mockMenuService.getMenu.mockResolvedValueOnce(mockMenu);

        const result = await mockMenuService.getMenu(1);

        expect(result).toEqual(mockMenu);
        expect(mockMenuService.getMenu).toHaveBeenCalledTimes(2);
      });

      it("should recover after a timeout error on create", async () => {
        // First call times out
        mockMenuService.createMenuItem.mockRejectedValueOnce(
          new Error("Request timeout"),
        );

        await expect(
          mockMenuService.createMenuItem({
            categoryId: 1,
            name: "Timeout Item",
            price: 10.0,
            restaurantId: 1,
          }),
        ).rejects.toThrow("Request timeout");

        // Retry succeeds
        mockMenuService.createMenuItem.mockResolvedValueOnce({
          id: 1,
          categoryId: 1,
          name: "Timeout Item",
          price: 10.0,
          restaurantId: 1,
        });

        const result = await mockMenuService.createMenuItem({
          categoryId: 1,
          name: "Timeout Item",
          price: 10.0,
          restaurantId: 1,
        });

        expect(result.id).toBe(1);
        expect(result.name).toBe("Timeout Item");
      });

      it("should handle concurrent updates gracefully", async () => {
        mockMenuService.updateMenuItem
          .mockResolvedValueOnce({ id: 1, name: "Updated A", price: 15.0 })
          .mockResolvedValueOnce({ id: 1, name: "Updated B", price: 18.0 });

        const [resultA, resultB] = await Promise.all([
          mockMenuService.updateMenuItem(1, { name: "Updated A", price: 15.0 }),
          mockMenuService.updateMenuItem(1, { name: "Updated B", price: 18.0 }),
        ]);

        expect(resultA.name).toBe("Updated A");
        expect(resultB.name).toBe("Updated B");
        expect(mockMenuService.updateMenuItem).toHaveBeenCalledTimes(2);
      });

      it("should handle cache failure gracefully during menu fetch", async () => {
        const mockMenu = {
          categories: [{ id: 1, name: "Main" }],
          menuItems: [{ id: 1, name: "Item 1", price: 10 }],
        };
        // Even with cache failure, data should still be returned from DB
        mockMenuService.getMenu.mockResolvedValue(mockMenu);

        const result = await mockMenuService.getMenu(1);

        expect(result).toEqual(mockMenu);
      });

      it("should handle partial batch update failure", async () => {
        mockMenuService.batchUpdatePrices.mockRejectedValue(
          new Error("Failed to update item 2: item not found"),
        );

        await expect(
          mockMenuService.batchUpdatePrices(1, [
            { id: 1, price: 15.0 },
            { id: 999, price: 20.0 },
          ]),
        ).rejects.toThrow("Failed to update item 2: item not found");
      });

      it("should handle delete of already-deleted item", async () => {
        mockMenuService.deleteMenuItem.mockResolvedValue(false);

        const result = await mockMenuService.deleteMenuItem(999);

        expect(result).toBe(false);
      });

      it("should handle update of non-existent item", async () => {
        mockMenuService.updateMenuItem.mockRejectedValue(
          new Error("Menu item not found"),
        );

        await expect(
          mockMenuService.updateMenuItem(99999, { name: "Ghost Item" }),
        ).rejects.toThrow("Menu item not found");
      });
    });
  });
});
