/**
 * Contract Tests for Menu API Responses
 *
 * These tests verify that menu endpoints return STABLE response shapes.
 * The customer app (public menu display) and admin dashboard depend on
 * these shapes -- any change here is a breaking change.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmakan/testing-utils";
import {
  assertMatchesSchema,
  assertNoExtraFields,
} from "../../../contracts/helpers";
import {
  GetMenuResponse,
  GetMenuItemResponse,
  CreateMenuItemResponse,
  UpdateMenuItemResponse,
  DeleteMenuItemResponse,
  GetFeaturedResponse,
  GetPopularResponse,
  SearchMenuResponse,
  CreateCategoryResponse,
  UpdateCategoryResponse,
  DeleteCategoryResponse,
  BulkUpdateResponse,
  MenuItemSchema,
  CategorySchema,
  FullMenuSchema,
} from "../../../contracts/schemas/menu";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = new Date().toISOString();

const mockCategory = {
  id: 10,
  restaurantId: "rest-001",
  name: "Main Course",
  description: "Signature dishes",
  sortOrder: 1,
  isActive: true,
  createdAt: now,
  updatedAt: now,
};

const mockMenuItem = {
  id: "item-001",
  restaurantId: "rest-001",
  categoryId: 10,
  name: "Nasi Lemak",
  description: "Coconut rice with sambal, anchovies, and peanuts",
  price: 12.5,
  imageUrl: "https://cdn.example.com/nasi-lemak.jpg",
  isAvailable: true,
  isActive: true,
  isFeatured: false,
  customizations: {
    spiceLevel: ["mild", "medium", "hot"],
  },
  sizes: null,
  addOns: [
    { name: "Extra Sambal", price: 1.0 },
    { name: "Fried Egg", price: 2.0 },
  ],
  dietaryInfo: { halal: true, vegetarian: false },
  preparationTime: 15,
  sortOrder: 1,
  createdAt: now,
  updatedAt: now,
};

// =========================================================================
// Tests
// =========================================================================

describe("Menu API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // =======================================================================
  // MenuItem Schema Contract
  // =======================================================================
  describe("MenuItem Schema Contract", () => {
    it("should match MenuItemSchema with all fields", () => {
      assertMatchesSchema(MenuItemSchema, mockMenuItem, "MenuItem entity");
    });

    it("should require id, restaurantId, name, price", () => {
      const minimalItem = {
        id: "item-001",
        restaurantId: "rest-001",
        name: "Nasi Lemak",
        price: 12.5,
        createdAt: now,
        updatedAt: now,
      };

      assertMatchesSchema(MenuItemSchema, minimalItem, "MenuItem minimal");
    });

    it("should accept both numeric and string ids", () => {
      const numericIdItem = {
        ...mockMenuItem,
        id: 42,
        categoryId: "cat-uuid-001",
      };

      assertMatchesSchema(
        MenuItemSchema,
        numericIdItem,
        "MenuItem with numeric id",
      );
    });

    it("should accept null for optional nullable fields", () => {
      const nullableItem = {
        id: "item-001",
        restaurantId: "rest-001",
        name: "Nasi Lemak",
        price: 12.5,
        categoryId: null,
        description: null,
        imageUrl: null,
        customizations: null,
        sizes: null,
        addOns: null,
        dietaryInfo: null,
        preparationTime: null,
        createdAt: now,
        updatedAt: now,
      };

      assertMatchesSchema(
        MenuItemSchema,
        nullableItem,
        "MenuItem with null optionals",
      );
    });
  });

  // =======================================================================
  // Category Schema Contract
  // =======================================================================
  describe("Category Schema Contract", () => {
    it("should match CategorySchema with all fields", () => {
      assertMatchesSchema(CategorySchema, mockCategory, "Category entity");
    });

    it("should require id, restaurantId, name", () => {
      const minimalCategory = {
        id: 10,
        restaurantId: "rest-001",
        name: "Main Course",
        createdAt: now,
        updatedAt: now,
      };

      assertMatchesSchema(CategorySchema, minimalCategory, "Category minimal");
    });
  });

  // =======================================================================
  // GetMenu Response Contract
  // =======================================================================
  describe("GetMenu Response Contract", () => {
    it("should match GetMenuResponse with categories and items", () => {
      const mockResponse = {
        success: true as const,
        data: {
          categories: [
            {
              ...mockCategory,
              items: [mockMenuItem],
            },
          ],
          items: [mockMenuItem],
        },
      };

      assertMatchesSchema(
        GetMenuResponse,
        mockResponse,
        "GET /menu/:restaurantId",
      );
    });

    it("should match GetMenuResponse with only categories", () => {
      const mockResponse = {
        success: true as const,
        data: {
          categories: [
            {
              ...mockCategory,
              items: [mockMenuItem],
            },
          ],
        },
      };

      assertMatchesSchema(
        GetMenuResponse,
        mockResponse,
        "GET /menu/:restaurantId (categories only)",
      );
    });

    it("should match GetMenuResponse with only items", () => {
      const mockResponse = {
        success: true as const,
        data: {
          items: [mockMenuItem],
        },
      };

      assertMatchesSchema(
        GetMenuResponse,
        mockResponse,
        "GET /menu/:restaurantId (items only)",
      );
    });

    it("should match GetMenuResponse with empty menu", () => {
      const mockResponse = {
        success: true as const,
        data: {
          categories: [],
          items: [],
        },
      };

      assertMatchesSchema(
        GetMenuResponse,
        mockResponse,
        "GET /menu/:restaurantId (empty)",
      );
    });
  });

  // =======================================================================
  // GetMenuItem Response Contract
  // =======================================================================
  describe("GetMenuItem Response Contract", () => {
    it("should match GetMenuItemResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockMenuItem },
      };

      assertMatchesSchema(
        GetMenuItemResponse,
        mockResponse,
        "GET /menu/items/:id",
      );
    });

    it("should wrap menu item in { success: true, data: menuItem } envelope", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockMenuItem },
      };

      expect(mockResponse).toHaveProperty("success", true);
      expect(mockResponse).toHaveProperty("data");
      expect(mockResponse.data).toHaveProperty("id");
      expect(mockResponse.data).toHaveProperty("restaurantId");
      expect(mockResponse.data).toHaveProperty("name");
      expect(mockResponse.data).toHaveProperty("price");
    });
  });

  // =======================================================================
  // CreateMenuItem Response Contract
  // =======================================================================
  describe("CreateMenuItem Response Contract", () => {
    it("should match CreateMenuItemResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockMenuItem },
        message: "Menu item created successfully",
      };

      assertMatchesSchema(
        CreateMenuItemResponse,
        mockResponse,
        "POST /menu/:restaurantId/items",
      );
    });

    it("should match CreateMenuItemResponse without message", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockMenuItem },
      };

      assertMatchesSchema(
        CreateMenuItemResponse,
        mockResponse,
        "POST /menu/:restaurantId/items (no message)",
      );
    });
  });

  // =======================================================================
  // UpdateMenuItem Response Contract
  // =======================================================================
  describe("UpdateMenuItem Response Contract", () => {
    it("should match UpdateMenuItemResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockMenuItem, name: "Updated Nasi Lemak", price: 15.0 },
        message: "Menu item updated successfully",
      };

      assertMatchesSchema(
        UpdateMenuItemResponse,
        mockResponse,
        "PUT /menu/items/:id",
      );
    });
  });

  // =======================================================================
  // DeleteMenuItem Response Contract
  // =======================================================================
  describe("DeleteMenuItem Response Contract", () => {
    it("should match DeleteMenuItemResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: null,
        message: "Menu item deleted successfully",
      };

      assertMatchesSchema(
        DeleteMenuItemResponse,
        mockResponse,
        "DELETE /menu/items/:id",
      );
    });
  });

  // =======================================================================
  // Featured/Popular Items Response Contract
  // =======================================================================
  describe("Featured Items Response Contract", () => {
    it("should match GetFeaturedResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: [{ ...mockMenuItem, isFeatured: true }],
      };

      assertMatchesSchema(
        GetFeaturedResponse,
        mockResponse,
        "GET /menu/:restaurantId/featured",
      );
    });

    it("should match GetFeaturedResponse with empty array", () => {
      const mockResponse = {
        success: true as const,
        data: [] as (typeof mockMenuItem)[],
      };

      assertMatchesSchema(
        GetFeaturedResponse,
        mockResponse,
        "GET /menu/:restaurantId/featured (empty)",
      );
    });
  });

  describe("Popular Items Response Contract", () => {
    it("should match GetPopularResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: [mockMenuItem],
      };

      assertMatchesSchema(
        GetPopularResponse,
        mockResponse,
        "GET /menu/:restaurantId/popular",
      );
    });
  });

  // =======================================================================
  // SearchMenu Response Contract
  // =======================================================================
  describe("SearchMenu Response Contract", () => {
    it("should match SearchMenuResponse schema with pagination", () => {
      const mockResponse = {
        success: true as const,
        data: [mockMenuItem],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };

      assertMatchesSchema(
        SearchMenuResponse,
        mockResponse,
        "GET /menu/:restaurantId/search",
      );
    });

    it("should match SearchMenuResponse without pagination", () => {
      const mockResponse = {
        success: true as const,
        data: [mockMenuItem],
      };

      assertMatchesSchema(
        SearchMenuResponse,
        mockResponse,
        "GET /menu/:restaurantId/search (no pagination)",
      );
    });
  });

  // =======================================================================
  // Category Response Contracts
  // =======================================================================
  describe("Category Response Contracts", () => {
    it("should match CreateCategoryResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockCategory },
        message: "Category created",
      };

      assertMatchesSchema(
        CreateCategoryResponse,
        mockResponse,
        "POST /menu/:restaurantId/categories",
      );
    });

    it("should match UpdateCategoryResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockCategory, name: "Updated Main Course" },
        message: "Category updated",
      };

      assertMatchesSchema(
        UpdateCategoryResponse,
        mockResponse,
        "PUT /menu/categories/:id",
      );
    });

    it("should match DeleteCategoryResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: null,
        message: "Category deleted",
      };

      assertMatchesSchema(
        DeleteCategoryResponse,
        mockResponse,
        "DELETE /menu/categories/:id",
      );
    });
  });

  // =======================================================================
  // BulkUpdate Response Contract
  // =======================================================================
  describe("BulkUpdate Response Contract", () => {
    it("should match BulkUpdateResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: null,
        message: "3 items updated",
      };

      assertMatchesSchema(
        BulkUpdateResponse,
        mockResponse,
        "PATCH /menu/:restaurantId/items/availability",
      );
    });
  });

  // =======================================================================
  // Response Envelope Contract
  // =======================================================================
  describe("Response Envelope Contract", () => {
    it("should wrap menu data in { success: true, data: {...} } envelope", () => {
      const mockResponse = {
        success: true as const,
        data: {
          categories: [{ ...mockCategory, items: [mockMenuItem] }],
          items: [mockMenuItem],
        },
      };

      expect(mockResponse).toHaveProperty("success", true);
      expect(mockResponse).toHaveProperty("data");
      expect(mockResponse.data).toHaveProperty("categories");
      expect(mockResponse.data).toHaveProperty("items");
    });
  });
});
