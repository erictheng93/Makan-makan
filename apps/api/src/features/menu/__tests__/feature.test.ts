/**
 * Menu Feature Tests
 * Comprehensive unit tests for the Menu feature module
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import {
  envFactory,
  createMockKV,
  resetAllFactories,
} from "@makanmakan/testing-utils";
import type { Env } from "../../../shared/types";
import { MenuService } from "../services/MenuService";
import routes from "../routes";
import type {
  MenuItem,
  Category,
  MenuStructure,
  CreateMenuItemData,
  UpdateMenuItemData,
  CreateCategoryData,
  MenuAnalytics,
  PopularityMetrics,
} from "../types";

// =============================================================================
// HOISTED MOCK INSTANCES (must be defined before vi.mock factories run)
// =============================================================================

const mockDatabaseMenuServiceInstance = vi.hoisted(() => ({
  getMenu: vi.fn(),
  getMenuItem: vi.fn(),
  createMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
  deleteMenuItem: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  reorderCategories: vi.fn(),
  searchMenuItems: vi.fn(),
  getFeaturedItems: vi.fn(),
  getPopularItems: vi.fn(),
  batchUpdateAvailability: vi.fn(),
  incrementOrderCount: vi.fn(),
  incrementViewCount: vi.fn(),
}));

// =============================================================================
// MODULE-LEVEL MOCKS (hoisted by Vitest)
// =============================================================================

// Mock the database-layer MenuService so HTTP route tests use our controlled mock
vi.mock("@makanmakan/database", () => ({
  MenuService: class MockDatabaseMenuService {
    constructor() {
      Object.assign(this, mockDatabaseMenuServiceInstance);
    }
  },
}));

// Mock auth middleware so HTTP route tests bypass JWT validation
vi.mock("../../../shared/middleware", () => ({
  authMiddleware: vi.fn((c: any, next: any) => {
    c.set("user", {
      id: 100,
      username: "testuser",
      role: 1,
      restaurantId: "1",
    });
    return next();
  }),
  requireRole: vi.fn(() => (c: any, next: any) => next()),
  requireRestaurantAccess: vi.fn(() => (c: any, next: any) => next()),
  optionalAuth: vi.fn((c: any, next: any) => next()),
  validateBody: vi.fn((_schema: any) => async (c: any, next: any) => {
    const body = await c.req.json().catch(() => ({}));
    const result = _schema.safeParse(body);
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: result.error.issues,
          },
        },
        400,
      );
    }
    c.set("validatedBody", result.data);
    return next();
  }),
  validateQuery: vi.fn(() => (c: any, next: any) => {
    c.set("validatedQuery", {});
    return next();
  }),
  validateParams: vi.fn((_schema: any) => (c: any, next: any) => {
    // Extract path params directly from Hono context (c.req.param())
    const restaurantId = c.req.param("restaurantId");
    const id = c.req.param("id");
    const params: Record<string, any> = {};
    if (restaurantId !== undefined) params.restaurantId = restaurantId;
    if (id !== undefined) params.id = Number(id) || id;
    c.set("validatedParams", params);
    return next();
  }),
}));

vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: vi.fn(() => async (_c: any, next: any) => await next()),
  invalidateSubscriptionCache: vi.fn().mockResolvedValue(undefined),
}));

// Mock Logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

// Mock CacheKV with proper typing that simulates real KV behavior
const mockCacheKV = {
  ...createMockKV(),
  get: vi.fn((_key: string, _type?: string) => {
    // When type is 'json', KV automatically parses JSON
    // Return null by default (cache miss)
    return Promise.resolve(null);
  }),
  set: vi.fn().mockResolvedValue(undefined),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(true),
  list: vi.fn().mockResolvedValue({ keys: [] }),
};

// Mock data
const mockRestaurantId = "1";
const mockUserId = 100;

const mockMenuItem: MenuItem = {
  id: 1,
  restaurantId: mockRestaurantId as string,
  categoryId: 1,
  name: "Test Menu Item",
  inventoryCount: 100,
  description: "A delicious test item",
  price: 15.99,
  originalPrice: 18.99,
  imageUrl: "https://example.com/image.jpg",
  isAvailable: true,
  isFeatured: false,
  isPopular: false,
  sortOrder: 0,
  spiceLevel: 2,
  preparationTime: 20,
  calories: 350,
  dietaryInfo: {
    vegetarian: true,
    glutenFree: false,
  },
  allergens: ["nuts"],
  orderCount: 45,
  rating: 4.2,
  reviewCount: 12,
  viewCount: 156,
  tags: ["popular", "healthy"],
  keywords: "vegetarian healthy nuts",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-15T00:00:00.000Z",
};

const mockCategory: Category = {
  id: 1,
  restaurantId: mockRestaurantId as string,
  name: "Test Category",
  description: "A test category",
  sortOrder: 0,
  status: 1,
  itemCount: 5,
  isActive: true,
  isVisible: true,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockMenuStructure: MenuStructure = {
  categories: [mockCategory],
  menuItems: [mockMenuItem],
};

const _mockMenuAnalytics: MenuAnalytics = {
  totalItems: 10,
  availableItems: 8,
  featuredItems: 3,
  popularItems: 2,
  averagePrice: 22.5,
  priceRange: { min: 8.99, max: 45.0 },
  categoryDistribution: [
    {
      categoryId: 1,
      categoryName: "Main Dishes",
      itemCount: 5,
      percentage: 50,
    },
  ],
  topPerformingItems: [
    {
      id: 1,
      name: "Best Seller",
      orderCount: 100,
      revenue: 1599.0,
      rating: 4.8,
    },
  ],
  dietaryInfoStats: {
    vegetarian: 3,
    vegan: 1,
    glutenFree: 2,
    halal: 4,
  },
  spiceLevelDistribution: {
    0: 2,
    1: 3,
    2: 3,
    3: 1,
    4: 1,
  },
};

const _mockPopularityMetrics: PopularityMetrics = {
  mostOrdered: [mockMenuItem],
  mostViewed: [mockMenuItem],
  highestRated: [mockMenuItem],
  recentlyAdded: [mockMenuItem],
};

// Complete mock environment with all required Env properties
const mockEnv = envFactory.build({
  CACHE_KV: mockCacheKV,
}) as unknown as Env;

// Mock user for authentication tests
const _mockUser = {
  id: mockUserId,
  username: "testuser",
  fullName: "Test User",
  restaurantId: mockRestaurantId as string,
  role: 1, // SHOP_OWNER
  email: "test@example.com",
  isActive: true,
  isVerified: true,
  twoFactorEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Menu Feature Module", () => {
  let app: Hono<{ Bindings: Env }>;
  let menuService: MenuService;

  beforeEach(() => {
    resetAllFactories();
    app = new Hono<{ Bindings: Env }>();
    app.route("/", routes);

    // Reset all mocks
    vi.clearAllMocks();

    // Create menu service instance
    menuService = new MenuService(mockEnv);

    // CRITICAL: Replace internal services with our mocks
    // This ensures all tests use our controlled mock instances
    (menuService as any)["dbService"] = mockDatabaseMenuServiceInstance as any;
    (menuService as any)["cacheService"] = mockCacheKV;
    (menuService as any)["logger"] = mockLogger as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("MenuService", () => {
    describe("Menu Structure Operations", () => {
      test("should fetch complete menu successfully", async () => {
        // Mock the database service
        const mockDbService = {
          getMenu: vi.fn().mockResolvedValue(mockMenuStructure),
        };

        // Replace the db service in menu service
        (menuService as any).dbService = mockDbService;

        const result = await menuService.getMenu(mockRestaurantId);

        expect(result).toEqual(mockMenuStructure);
        expect(mockDbService.getMenu).toHaveBeenCalledWith(
          String(mockRestaurantId),
          undefined,
        );
      });

      test("should fetch menu item by id successfully", async () => {
        const mockDbService = {
          getMenuItem: vi.fn().mockResolvedValue(mockMenuItem),
        };

        (menuService as any).dbService = mockDbService;

        const result = await menuService.getMenuItem(1);

        expect(result).toEqual(mockMenuItem);
        expect(mockDbService.getMenuItem).toHaveBeenCalledWith(1);
      });

      test("should return null for non-existent menu item", async () => {
        const mockDbService = {
          getMenuItem: vi.fn().mockResolvedValue(null),
        };

        (menuService as any).dbService = mockDbService;

        const result = await menuService.getMenuItem(999);

        expect(result).toBeNull();
      });
    });

    describe("Menu Item Management", () => {
      test("should create menu item successfully", async () => {
        const createData: CreateMenuItemData = {
          restaurantId: mockRestaurantId as string,
          categoryId: 1,
          name: "New Test Item",
          description: "A new test item",
          price: 12.99,
        };

        const mockDbService = {
          createMenuItem: vi.fn().mockResolvedValue(mockMenuItem),
        };

        (menuService as any).dbService = mockDbService;
        (menuService as any).validateCategoryAccess = vi
          .fn()
          .mockResolvedValue(undefined);
        (menuService as any).invalidateMenuCache = vi
          .fn()
          .mockResolvedValue(undefined);

        const result = await menuService.createMenuItem(createData);

        expect(result).toEqual(mockMenuItem);
        expect(mockDbService.createMenuItem).toHaveBeenCalledWith({
          ...createData,
          restaurantId: String(createData.restaurantId),
        });
      });

      test("should update menu item successfully", async () => {
        const updateData: UpdateMenuItemData = {
          name: "Updated Item",
          price: 16.99,
          isAvailable: false,
        };

        const mockDbService = {
          getMenuItem: vi.fn().mockResolvedValue(mockMenuItem),
          updateMenuItem: vi
            .fn()
            .mockResolvedValue({ ...mockMenuItem, ...updateData }),
        };

        (menuService as any).dbService = mockDbService;
        (menuService as any).invalidateMenuCache = vi
          .fn()
          .mockResolvedValue(undefined);

        const result = await menuService.updateMenuItem(1, updateData);

        expect(result.name).toBe(updateData.name);
        expect(result.price).toBe(updateData.price);
        expect(mockDbService.updateMenuItem).toHaveBeenCalledWith(
          1,
          updateData,
        );
      });

      test("should throw error when updating non-existent menu item", async () => {
        const updateData: UpdateMenuItemData = { name: "Updated Item" };

        (menuService as any).getMenuItem = vi.fn().mockResolvedValue(null);

        await expect(
          menuService.updateMenuItem(999, updateData),
        ).rejects.toThrow("Menu item not found");
      });
    });

    describe("Category Management", () => {
      test("should create category successfully", async () => {
        const createData: CreateCategoryData = {
          restaurantId: mockRestaurantId as string,
          name: "New Category",
          description: "A new test category",
        };

        const mockDbService = {
          createCategory: vi.fn().mockResolvedValue(mockCategory),
        };

        (menuService as any).dbService = mockDbService;
        (menuService as any).invalidateMenuCache = vi
          .fn()
          .mockResolvedValue(undefined);

        const result = await menuService.createCategory(createData);

        expect(result).toEqual(mockCategory);
        expect(mockDbService.createCategory).toHaveBeenCalledWith({
          ...createData,
          restaurantId: String(createData.restaurantId),
        });
      });
    });

    describe("Search and Analytics", () => {
      test("should search menu items with filters", async () => {
        const mockSearchResult = {
          items: [mockMenuItem],
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
          },
        };

        const mockDbService = {
          searchMenuItems: vi.fn().mockResolvedValue(mockSearchResult),
        };

        (menuService as any).dbService = mockDbService;

        const searchParams = {
          search: "test",
          categoryId: 1,
          page: 1,
          limit: 20,
        };

        const result = await menuService.searchMenuItems(
          mockRestaurantId,
          searchParams,
        );

        expect(result).toEqual(mockSearchResult);
        expect(mockDbService.searchMenuItems).toHaveBeenCalledWith(
          String(mockRestaurantId),
          expect.objectContaining({
            search: "test",
            categoryId: 1,
          }),
          1,
          20,
        );
      });

      test("should get menu analytics", async () => {
        (menuService as any).getMenu = vi
          .fn()
          .mockResolvedValue(mockMenuStructure);

        const result = await menuService.getMenuAnalytics(mockRestaurantId);

        expect(result).toBeDefined();
        expect(typeof result.totalItems).toBe("number");
        expect(typeof result.averagePrice).toBe("number");
        expect(Array.isArray(result.categoryDistribution)).toBe(true);
      });

      test("should get popularity metrics", async () => {
        const mockDbService = {
          getPopularItems: vi.fn().mockResolvedValue([mockMenuItem]),
          searchMenuItems: vi.fn().mockResolvedValue({
            items: [mockMenuItem],
            pagination: {} as any,
          }),
        };

        (menuService as any).dbService = mockDbService;

        const result = await menuService.getPopularityMetrics(mockRestaurantId);

        expect(result).toBeDefined();
        expect(Array.isArray(result.mostOrdered)).toBe(true);
        expect(Array.isArray(result.mostViewed)).toBe(true);
        expect(Array.isArray(result.highestRated)).toBe(true);
        expect(Array.isArray(result.recentlyAdded)).toBe(true);
      });
    });

    describe("Bulk Operations", () => {
      test("should batch update availability", async () => {
        const updates = [
          { id: 1, isAvailable: false },
          { id: 2, isAvailable: true },
        ];

        const mockDbService = {
          batchUpdateAvailability: vi.fn().mockResolvedValue(undefined),
        };

        (menuService as any).dbService = mockDbService;
        (menuService as any).invalidateMenuCache = vi
          .fn()
          .mockResolvedValue(undefined);

        await menuService.batchUpdateAvailability(mockRestaurantId, updates);

        expect(mockDbService.batchUpdateAvailability).toHaveBeenCalledWith(
          String(mockRestaurantId),
          updates,
        );
      });

      test("should batch update prices", async () => {
        const updates = [
          { id: 1, price: 15.99, originalPrice: 18.99 },
          { id: 2, price: 12.99 },
        ];

        const mockDbService = {
          updateMenuItem: vi.fn().mockResolvedValue(mockMenuItem),
        };

        (menuService as any).dbService = mockDbService;
        (menuService as any).invalidateMenuCache = vi
          .fn()
          .mockResolvedValue(undefined);

        await menuService.batchUpdatePrices(mockRestaurantId, updates);

        expect(mockDbService.updateMenuItem).toHaveBeenCalledTimes(
          updates.length,
        );
      });
    });

    describe("Utility Functions", () => {
      test("should increment order count", async () => {
        const mockDbService = {
          incrementOrderCount: vi.fn().mockResolvedValue(undefined),
        };

        (menuService as any).dbService = mockDbService;

        await menuService.incrementOrderCount(1, 2);

        expect(mockDbService.incrementOrderCount).toHaveBeenCalledWith(1, 2);
      });

      test("should increment view count", async () => {
        const mockDbService = {
          incrementViewCount: vi.fn().mockResolvedValue(undefined),
        };

        (menuService as any).dbService = mockDbService;

        await menuService.incrementViewCount(1);

        expect(mockDbService.incrementViewCount).toHaveBeenCalledWith(1);
      });
    });
  });

  describe("Schema Validation", () => {
    test("should validate menu item creation data", async () => {
      const { menuSchemas } = await import("../schemas/validation");

      const validData = {
        categoryId: 1,
        name: "Test Item",
        price: 15.99,
        spiceLevel: 2,
      };

      const result = menuSchemas.createMenuItem.safeParse(validData);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.spiceLevel).toBe(2);
        expect(result.data.preparationTime).toBe(15); // default value
      }
    });

    test("should reject invalid menu item data", async () => {
      const { menuSchemas } = await import("../schemas/validation");

      const invalidData = {
        categoryId: -1, // Invalid: must be positive
        name: "", // Invalid: cannot be empty
        price: -10, // Invalid: must be positive
      };

      const result = menuSchemas.createMenuItem.safeParse(invalidData);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    test("should validate menu item image URLs and image data URLs", async () => {
      const { menuSchemas } = await import("../schemas/validation");
      const baseData = {
        categoryId: 1,
        name: "Test Item",
        price: 15.99,
      };
      const oneKbImageDataUrl = `data:image/png;base64,${"a".repeat(1368)}`;
      const textDataUrl = `data:text/plain;base64,${"a".repeat(1368)}`;

      expect(
        menuSchemas.createMenuItem.safeParse({
          ...baseData,
          imageUrl: "https://example.com/image.jpg",
        }).success,
      ).toBe(true);
      expect(
        menuSchemas.createMenuItem.safeParse({
          ...baseData,
          imageUrl: oneKbImageDataUrl,
        }).success,
      ).toBe(true);
      expect(
        menuSchemas.updateMenuItem.safeParse({
          imageUrl: textDataUrl,
        }).success,
      ).toBe(false);
    });

    test("should validate search filters", async () => {
      const { menuSchemas } = await import("../schemas/validation");

      const validFilters = {
        categoryId: "1",
        minPrice: "10.00",
        maxPrice: "50.00",
        spiceLevel: "2",
        isAvailable: "true",
        page: "1",
        limit: "20",
      };

      const result = menuSchemas.menuFilter.safeParse(validFilters);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.categoryId).toBe(1);
        expect(result.data.minPrice).toBe(10.0);
        expect(result.data.isAvailable).toBe(true);
      }
    });
  });

  describe("DB Service Delegation", () => {
    test("should delegate getMenu to DB service", async () => {
      const mockDbService = {
        getMenu: vi.fn().mockResolvedValue(mockMenuStructure),
      };

      const service = new MenuService(mockEnv);
      (service as any).dbService = mockDbService;

      const result = await service.getMenu(mockRestaurantId);

      expect(result).toEqual(mockMenuStructure);
      // Caching is handled internally by the DB service's cachedQuery
      expect(mockDbService.getMenu).toHaveBeenCalledWith(
        String(mockRestaurantId),
        undefined,
      );
    });

    test("should propagate DB service errors", async () => {
      const mockDbService = {
        getMenu: vi.fn().mockRejectedValue(new Error("Database error")),
      };

      const service = new MenuService(mockEnv);
      (service as any).dbService = mockDbService;

      await expect(service.getMenu(mockRestaurantId)).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("Category Reorder", () => {
    test("should reorder categories successfully", async () => {
      mockDatabaseMenuServiceInstance.reorderCategories.mockResolvedValue(
        undefined,
      );

      const res = await app.request(
        `/${mockRestaurantId}/categories/reorder`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
          body: JSON.stringify({
            categories: [
              { id: 1, sortOrder: 0 },
              { id: 2, sortOrder: 1 },
              { id: 3, sortOrder: 2 },
            ],
          }),
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as { success: boolean };
      expect(data.success).toBe(true);
      expect(
        mockDatabaseMenuServiceInstance.reorderCategories,
      ).toHaveBeenCalledWith(mockRestaurantId, [
        { id: 1, sortOrder: 0 },
        { id: 2, sortOrder: 1 },
        { id: 3, sortOrder: 2 },
      ]);
    });

    test("should reject empty categories array", async () => {
      const res = await app.request(
        `/${mockRestaurantId}/categories/reorder`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
          body: JSON.stringify({
            categories: [],
          }),
        },
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    test("should reject invalid category id", async () => {
      const res = await app.request(
        `/${mockRestaurantId}/categories/reorder`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
          body: JSON.stringify({
            categories: [{ id: -1, sortOrder: 0 }],
          }),
        },
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    test("should reject negative sortOrder", async () => {
      const res = await app.request(
        `/${mockRestaurantId}/categories/reorder`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
          body: JSON.stringify({
            categories: [{ id: 1, sortOrder: -1 }],
          }),
        },
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    test("should handle service error gracefully", async () => {
      mockDatabaseMenuServiceInstance.reorderCategories.mockRejectedValue(
        new Error("Database error"),
      );

      const res = await app.request(
        `/${mockRestaurantId}/categories/reorder`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
          body: JSON.stringify({
            categories: [{ id: 1, sortOrder: 0 }],
          }),
        },
        mockEnv,
      );

      expect(res.status).toBe(500);
    });
  });
});
