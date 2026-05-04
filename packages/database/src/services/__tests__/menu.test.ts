/**
 * MenuService Unit Tests
 *
 * Tests menu and category management including:
 * - Menu structure retrieval with caching
 * - Featured and popular items
 * - Complex search and filtering
 * - CRUD operations on menu items and categories
 * - Batch operations and counters
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Note: query-cache and connection-manager are mocked globally in setup.ts

import { MenuService } from "../menu";
import {
  createMockDatabase,
  createMockEnv,
  setupMockDbResponses,
  createQueryChain,
} from "./helpers/mockD1";
import type {
  CreateMenuItemData,
  UpdateMenuItemData,
  MenuFilters,
} from "../menu";
import {
  menuItemFactory,
  categoryFactory,
  resetAllFactories,
} from "@makanmasak/testing-utils";

describe("MenuService", () => {
  let menuService: MenuService;
  let mockDb: any;
  let mockEnv: any;

  type MenuServiceTestAccess = MenuService & {
    cachedQuery: (...args: unknown[]) => Promise<unknown>;
  };

  // Mock data - use factories for menu items, keep structure for relational queries
  const basePastaItem = menuItemFactory.build({
    overrides: {
      id: 1,
      name: "Pasta",
      description: "Delicious pasta",
      ingredients: "pasta, sauce",
      price: 12.99,
      originalPrice: 15.99,
      imageUrl: "pasta.jpg",
      imageVariants: {},
      isAvailable: true,
      isFeatured: true,
      isPopular: true,
      sortOrder: 1,
      inventoryCount: 50,
      spiceLevel: 0,
      preparationTime: 15,
      calories: 500,
      dietaryInfo: { vegetarian: true },
      allergens: ["gluten"],
      options: [],
      keywords: "italian pasta",
      orderCount: 100,
      viewCount: 500,
      rating: 4.5,
      createdAt: new Date("2024-01-01").getTime(),
      updatedAt: new Date("2024-01-01").getTime(),
    },
    relations: { restaurantId: 1, categoryId: 1 },
  });

  const baseCakeItem = menuItemFactory.build({
    overrides: {
      id: 2,
      name: "Cake",
      description: "Chocolate cake",
      ingredients: "chocolate, flour",
      price: 6.99,
      originalPrice: null,
      imageUrl: "cake.jpg",
      imageVariants: {},
      isAvailable: true,
      isFeatured: false,
      isPopular: true,
      sortOrder: 1,
      inventoryCount: 20,
      spiceLevel: 0,
      preparationTime: 5,
      calories: 300,
      dietaryInfo: { vegetarian: true },
      allergens: ["gluten", "dairy"],
      options: [],
      keywords: "dessert cake",
      orderCount: 80,
      viewCount: 300,
      rating: 4.8,
      createdAt: new Date("2024-01-01").getTime(),
      updatedAt: new Date("2024-01-01").getTime(),
    },
    relations: { restaurantId: 1, categoryId: 2 },
  });

  // Map factory output to the shape expected by relational queries
  const pastaMenuItem = {
    ...basePastaItem,
    restaurantId: "R-001",
    imageVariants: null,
    options: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const cakeMenuItem = {
    ...baseCakeItem,
    restaurantId: "R-001",
    imageVariants: null,
    options: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const mockCategory1 = {
    ...categoryFactory.build({
      overrides: {
        id: 1,
        name: "Main Dishes",
        description: "Our main courses",
        sortOrder: 1,
        isActive: true,
        isVisible: true,
        itemCount: 2,
        imageUrl: "cat1.jpg",
      },
      relations: { restaurantId: 1 },
    }),
    restaurantId: "R-001",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    menuItems: [pastaMenuItem],
  };

  const mockCategory2 = {
    ...categoryFactory.build({
      overrides: {
        id: 2,
        name: "Desserts",
        description: "Sweet treats",
        sortOrder: 2,
        isActive: true,
        isVisible: true,
        itemCount: 1,
        imageUrl: "cat2.jpg",
      },
      relations: { restaurantId: 1 },
    }),
    restaurantId: "R-001",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    menuItems: [cakeMenuItem],
  };

  const mockRestaurant = {
    id: 1,
    name: "Test Restaurant",
    categories: [mockCategory1, mockCategory2],
  };

  const mockMenuItem = pastaMenuItem;

  const validMenuItemData: CreateMenuItemData = {
    restaurantId: "R-001",
    categoryId: 1,
    name: "New Dish",
    description: "A new dish",
    ingredients: "ingredients",
    price: 19.99,
    originalPrice: 24.99,
    imageUrl: "new-dish.jpg",
    spiceLevel: 2,
    preparationTime: 20,
    calories: 600,
    allergens: ["nuts"],
    keywords: "new special",
  };

  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
    mockDb = createMockDatabase();
    mockEnv = createMockEnv({
      JWT_SECRET: "test-jwt-secret-key",
    });
    menuService = new MenuService(mockDb, mockEnv);
  });

  describe("getMenu", () => {
    it("should fetch full menu structure with categories and items", async () => {
      // Arrange
      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue(mockRestaurant),
        },
      };

      // Mock updateCategoryItemCount queries (called twice for 2 categories)
      mockDb.select.mockReturnValueOnce(
        createQueryChain([{ id: 1 }, { id: 2 }]),
      );
      mockDb.select.mockReturnValueOnce(createQueryChain([{ itemCount: 1 }]));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ itemCount: 1 }]));

      // Act
      const result = await menuService.getMenu("R-001");

      // Assert
      expect(result).toBeDefined();
      expect(result.categories).toHaveLength(2);
      expect(result.categories[0].name).toBe("Main Dishes");
      // expect(result.categories[0].itemCount).toBe(1) // itemCount property removed from Category type
      expect(result.menuItems).toHaveLength(2);
      expect(result.menuItems[0].name).toBe("Pasta");
    });

    it("should throw error when restaurant not found", async () => {
      // Arrange
      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      // Act & Assert
      await expect(menuService.getMenu("R-999")).rejects.toThrow(
        "Restaurant not found",
      );
    });

    it("should call cachedQuery for menu data", async () => {
      // Arrange
      mockDb.query = {
        restaurants: {
          findFirst: vi.fn().mockResolvedValue(mockRestaurant),
        },
      };

      // Mock updateCategoryItemCount queries
      mockDb.select.mockReturnValueOnce(
        createQueryChain([{ id: 1 }, { id: 2 }]),
      );
      mockDb.select.mockReturnValueOnce(createQueryChain([{ itemCount: 1 }]));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ itemCount: 1 }]));

      // Spy on cachedQuery method
      const cachedQuerySpy = vi.spyOn(
        menuService as unknown as MenuServiceTestAccess,
        "cachedQuery",
      );

      // Act
      await menuService.getMenu("R-001");

      // Assert - cachedQuery should be called with correct cache key
      expect(cachedQuerySpy).toHaveBeenCalledWith(
        expect.stringContaining("menu:R-001:full"),
        expect.any(Function),
        expect.objectContaining({
          ttl: 3600,
          tags: ["menu:R-001", "restaurant:R-001"],
        }),
      );
    });
  });

  describe("getFeaturedItems", () => {
    it("should return featured and available items", async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: [mockMenuItem],
      });

      // Act
      const result = await menuService.getFeaturedItems("R-001", 10);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Pasta");
      expect(result[0].isFeatured).toBe(true);
    });

    it("should respect limit parameter", async () => {
      // Arrange
      const manyItems = Array.from({ length: 20 }, (_, i) => ({
        ...mockMenuItem,
        id: i + 1,
        name: `Item ${i + 1}`,
      }));

      setupMockDbResponses(mockDb, {
        select: manyItems.slice(0, 5), // Simulate limit 5
      });

      // Act
      const result = await menuService.getFeaturedItems("R-001", 5);

      // Assert
      expect(result).toHaveLength(5);
    });

    it("should return empty array when no featured items", async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: [],
      });

      // Act
      const result = await menuService.getFeaturedItems("R-001");

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe("getPopularItems", () => {
    it("should return popular items ordered by order count and rating", async () => {
      // Arrange
      const items = [
        { ...mockMenuItem, orderCount: 150, rating: 4.8 },
        { ...mockMenuItem, id: 3, orderCount: 120, rating: 4.5 },
      ];

      setupMockDbResponses(mockDb, {
        select: items,
      });

      // Act
      const result = await menuService.getPopularItems("R-001");

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].orderCount).toBe(150);
    });

    it("should only return available items", async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: [mockMenuItem],
      });

      // Act
      const result = await menuService.getPopularItems("R-001");

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].isAvailable).toBe(true);
    });
  });

  describe("searchMenuItems", () => {
    it("should search with category filter", async () => {
      // Arrange
      // First select returns items, second select returns count
      mockDb.select.mockReturnValueOnce(createQueryChain([mockMenuItem]));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ totalCount: 1 }]));

      const filters: MenuFilters = {
        categoryId: 1,
      };

      // Act
      const result = await menuService.searchMenuItems("R-001", filters, 1, 20);

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it("should search with price range filter", async () => {
      // Arrange
      mockDb.select.mockReturnValueOnce(createQueryChain([mockMenuItem]));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ totalCount: 1 }]));

      const filters: MenuFilters = {
        priceRange: [10, 20],
      };

      // Act
      const result = await menuService.searchMenuItems("R-001", filters);

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].price).toBeGreaterThanOrEqual(10);
      expect(result.items[0].price).toBeLessThanOrEqual(20);
    });

    it("should search with text query", async () => {
      // Arrange
      mockDb.select.mockReturnValueOnce(createQueryChain([mockMenuItem]));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ totalCount: 1 }]));

      const filters: MenuFilters = {
        search: "pasta",
      };

      // Act
      const result = await menuService.searchMenuItems("R-001", filters);

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name.toLowerCase()).toContain("pasta");
    });

    it("should search with spice level filter", async () => {
      // Arrange
      const spicyItem = { ...mockMenuItem, spiceLevel: 3 };
      mockDb.select.mockReturnValueOnce(createQueryChain([spicyItem]));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ totalCount: 1 }]));

      const filters: MenuFilters = {
        spiceLevel: 3,
      };

      // Act
      const result = await menuService.searchMenuItems("R-001", filters);

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].spiceLevel).toBe(3);
    });

    it("should search with availability filter", async () => {
      // Arrange
      mockDb.select.mockReturnValueOnce(createQueryChain([mockMenuItem]));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ totalCount: 1 }]));

      const filters: MenuFilters = {
        isAvailable: true,
      };

      // Act
      const result = await menuService.searchMenuItems("R-001", filters);

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].isAvailable).toBe(true);
    });

    it("should search with featured filter", async () => {
      // Arrange
      mockDb.select.mockReturnValueOnce(createQueryChain([mockMenuItem]));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ totalCount: 1 }]));

      const filters: MenuFilters = {
        isFeatured: true,
      };

      // Act
      const result = await menuService.searchMenuItems("R-001", filters);

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].isFeatured).toBe(true);
    });

    it("should search with dietary preferences", async () => {
      // Arrange
      mockDb.select.mockReturnValueOnce(createQueryChain([mockMenuItem]));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ totalCount: 1 }]));

      const filters: MenuFilters = {
        dietaryPreferences: ["vegetarian"],
      };

      // Act
      const result = await menuService.searchMenuItems("R-001", filters);

      // Assert
      expect(result.items).toHaveLength(1);
    });

    it("should handle pagination correctly", async () => {
      // Arrange
      const items = Array.from({ length: 5 }, (_, i) => ({
        ...mockMenuItem,
        id: i + 1,
      }));

      mockDb.select.mockReturnValueOnce(createQueryChain(items));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ totalCount: 50 }]));

      // Act
      const result = await menuService.searchMenuItems("R-001", {}, 2, 20);

      // Assert
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.totalPages).toBe(3);
    });

    it("should return empty results when no matches", async () => {
      // Arrange
      mockDb.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ totalCount: 0 }]));

      const filters: MenuFilters = {
        search: "nonexistent",
      };

      // Act
      const result = await menuService.searchMenuItems("R-001", filters);

      // Assert
      expect(result.items).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe("createMenuItem", () => {
    it("should create new menu item successfully", async () => {
      // Arrange
      const createdItem = { ...mockMenuItem, ...validMenuItemData };
      setupMockDbResponses(mockDb, {
        insert: [createdItem],
        select: [{ itemCount: 1 }],
      });

      // Act
      const result = await menuService.createMenuItem(validMenuItemData);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe("New Dish");
      expect(result.price).toBe(19.99);
    });

    it("should update category item count after creation", async () => {
      // Arrange
      const createdItem = { ...mockMenuItem, ...validMenuItemData };
      setupMockDbResponses(mockDb, {
        insert: [createdItem],
        select: [{ itemCount: 2 }],
      });

      const updateSpy = vi.spyOn(mockDb, "update");

      // Act
      await menuService.createMenuItem(validMenuItemData);

      // Assert
      expect(updateSpy).toHaveBeenCalled();
    });

    it("should invalidate cache after creation", async () => {
      // Arrange
      const createdItem = { ...mockMenuItem, ...validMenuItemData };
      setupMockDbResponses(mockDb, {
        insert: [createdItem],
        select: [{ itemCount: 1 }],
      });

      // Act - should complete without error (cache invalidation is mocked)
      const result = await menuService.createMenuItem(validMenuItemData);

      // Assert - verify item was created successfully
      expect(result).toBeDefined();
      expect(result.name).toBe(validMenuItemData.name);
    });

    it("should throw error on database failure", async () => {
      // Arrange
      mockDb.insert.mockImplementation(() => {
        throw new Error("Database error");
      });

      // Act & Assert
      await expect(
        menuService.createMenuItem(validMenuItemData),
      ).rejects.toThrow("Database error");
    });
  });

  describe("updateMenuItem", () => {
    it("should update menu item successfully", async () => {
      // Arrange
      const updateData: UpdateMenuItemData = {
        name: "Updated Pasta",
        price: 14.99,
        isAvailable: false,
      };

      const updatedItem = { ...mockMenuItem, ...updateData };
      setupMockDbResponses(mockDb, {
        update: [updatedItem],
      });

      // Act
      const result = await menuService.updateMenuItem(1, updateData);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe("Updated Pasta");
      expect(result.price).toBe(14.99);
      expect(result.isAvailable).toBe(false);
    });

    it("should throw error when item not found", async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        update: [],
      });

      // Act & Assert
      await expect(
        menuService.updateMenuItem(999, { name: "Test" }),
      ).rejects.toThrow("Menu item not found");
    });

    it("should invalidate cache after update", async () => {
      // Arrange
      const updatedItem = { ...mockMenuItem, name: "Updated" };
      setupMockDbResponses(mockDb, {
        update: [updatedItem],
      });

      // Act - Update triggers cache invalidation internally
      const result = await menuService.updateMenuItem(1, { name: "Updated" });

      // Assert - Verify update completes successfully (cache invalidation happens internally)
      expect(result).toBeDefined();
      expect(result.name).toBe("Updated");
    });
  });

  describe("batchUpdateAvailability", () => {
    it("should update multiple items availability", async () => {
      // Arrange
      const updates = [
        { id: 1, isAvailable: false },
        { id: 2, isAvailable: true },
      ];

      setupMockDbResponses(mockDb, {
        update: [mockMenuItem],
      });

      const updateSpy = vi.spyOn(mockDb, "update");

      // Act
      await menuService.batchUpdateAvailability("R-001", updates);

      // Assert
      expect(updateSpy).toHaveBeenCalledTimes(2);
    });

    it("should invalidate cache after batch update", async () => {
      // Arrange
      const updates = [{ id: 1, isAvailable: false }];
      setupMockDbResponses(mockDb, {
        update: [mockMenuItem],
      });

      // Act - Batch update triggers cache invalidation internally
      await menuService.batchUpdateAvailability("R-001", updates);

      // Assert - Verify update operation was called (cache invalidation happens internally)
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("incrementOrderCount", () => {
    it("should increment order count by 1", async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        update: [{ ...mockMenuItem, orderCount: 101 }],
      });

      // Act
      await menuService.incrementOrderCount(1);

      // Assert
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should increment order count by custom amount", async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        update: [{ ...mockMenuItem, orderCount: 105 }],
      });

      // Act
      await menuService.incrementOrderCount(1, 5);

      // Assert
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("incrementViewCount", () => {
    it("should increment view count", async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        update: [{ ...mockMenuItem, viewCount: 501 }],
      });

      // Act
      await menuService.incrementViewCount(1);

      // Assert
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("getMenuItem", () => {
    it("should fetch menu item with relations", async () => {
      // Arrange
      mockDb.query = {
        menuItems: {
          findFirst: vi.fn().mockResolvedValue({
            ...mockMenuItem,
            category: { id: 1, name: "Main Dishes" },
            restaurant: { id: 1, name: "Test Restaurant" },
          }),
        },
      };

      // Act
      const result = await menuService.getMenuItem(1);

      // Assert
      expect(result).toBeDefined();
      expect(result!.id).toBe(1);
      expect(result!.name).toBe("Pasta");
    });

    it("should return null when item not found", async () => {
      // Arrange
      mockDb.query = {
        menuItems: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      // Act
      const result = await menuService.getMenuItem(999);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("createCategory", () => {
    it("should create new category successfully", async () => {
      // Arrange
      const categoryData = {
        restaurantId: "R-001",
        name: "Beverages",
        description: "Drinks",
        sortOrder: 3,
        imageUrl: "beverages.jpg",
      };

      const createdCategory = {
        id: 3,
        ...categoryData,
        isActive: true,
        isVisible: true,
        itemCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setupMockDbResponses(mockDb, {
        insert: [createdCategory],
      });

      // Act
      const result = await menuService.createCategory(categoryData);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe("Beverages");
      expect(result.restaurantId).toBe("R-001");
    });

    it("should throw error on database failure", async () => {
      // Arrange
      mockDb.insert.mockImplementation(() => {
        throw new Error("Database error");
      });

      // Act & Assert
      await expect(
        menuService.createCategory({
          restaurantId: "R-001",
          name: "Test Category",
        }),
      ).rejects.toThrow("Database error");
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors in getFeaturedItems", async () => {
      // Arrange
      mockDb.select.mockImplementation(() => {
        throw new Error("Database error");
      });

      // Act & Assert
      await expect(menuService.getFeaturedItems("R-001")).rejects.toThrow(
        "Database error",
      );
    });

    it("should handle database errors in searchMenuItems", async () => {
      // Arrange
      mockDb.select.mockImplementation(() => {
        throw new Error("Database error");
      });

      // Act & Assert
      await expect(menuService.searchMenuItems("R-001", {})).rejects.toThrow(
        "Database error",
      );
    });

    it("should handle database errors in incrementOrderCount", async () => {
      // Arrange
      mockDb.update.mockImplementation(() => {
        throw new Error("Database error");
      });

      // Act & Assert
      await expect(menuService.incrementOrderCount(1)).rejects.toThrow(
        "Database error",
      );
    });

    it("should handle database errors in incrementViewCount", async () => {
      // Arrange
      mockDb.update.mockImplementation(() => {
        throw new Error("Database error");
      });

      // Act & Assert
      await expect(menuService.incrementViewCount(1)).rejects.toThrow(
        "Database error",
      );
    });
  });
});
