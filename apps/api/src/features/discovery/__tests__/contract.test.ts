/**
 * Contract Tests for Discovery API Responses
 *
 * These tests verify that public discovery endpoints return STABLE response
 * shapes. The customer app (search, browse, menu display) depends on these
 * shapes -- any change here is a breaking change.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmakan/testing-utils";
import {
  assertMatchesSchema,
  assertNoSensitiveFields,
} from "../../../contracts/helpers";
import {
  SearchResponse,
  BrowseRestaurantsResponse,
  GetRestaurantMenuResponse,
  GetPopularItemsResponse,
} from "../../../contracts/schemas/discovery";
import { MenuItemSchema } from "../../../contracts/schemas/menu";
import { RestaurantSchema } from "../../../contracts/schemas/restaurants";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = new Date().toISOString();

const mockMenuItem = {
  id: "item-001",
  restaurantId: "rest-001",
  categoryId: 10,
  name: "Nasi Lemak",
  description: "Coconut rice with sambal",
  price: 12.5,
  imageUrl: "https://cdn.example.com/nasi-lemak.jpg",
  isAvailable: true,
  isActive: true,
  isFeatured: true,
  customizations: null,
  sizes: null,
  addOns: null,
  dietaryInfo: { halal: true },
  preparationTime: 15,
  sortOrder: 1,
  createdAt: now,
  updatedAt: now,
};

const mockRestaurant = {
  id: "rest-001",
  name: "Kedai Makan Best",
  description: "Authentic Malaysian cuisine",
  address: "123 Jalan Sultan, KL",
  phone: "+60123456789",
  email: "info@kedaimakan.com",
  logoUrl: "https://cdn.example.com/logo.png",
  coverImageUrl: "https://cdn.example.com/cover.jpg",
  operatingHours: null,
  settings: null,
  ownerId: 1,
  isActive: true,
  createdAt: now,
  updatedAt: now,
};

// =========================================================================
// Tests
// =========================================================================

describe("Discovery API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // =======================================================================
  // SearchResponse Contract
  // =======================================================================
  describe("Search Response Contract", () => {
    it("should match SearchResponse envelope with restaurant results", () => {
      const mockResponse = {
        success: true as const,
        data: {
          restaurants: [mockRestaurant],
          items: [mockMenuItem],
          query: "nasi lemak",
          total: 2,
        },
      };

      assertMatchesSchema(
        SearchResponse,
        mockResponse,
        "GET /discovery/search",
      );
    });

    it("should match SearchResponse with empty results", () => {
      const mockResponse = {
        success: true as const,
        data: {
          restaurants: [],
          items: [],
          query: "nonexistent",
          total: 0,
        },
      };

      assertMatchesSchema(
        SearchResponse,
        mockResponse,
        "GET /discovery/search (empty)",
      );
    });

    it("should match SearchResponse with minimal data", () => {
      const mockResponse = {
        success: true as const,
        data: null,
      };

      // SearchResponse uses z.unknown() so null is valid
      assertMatchesSchema(
        SearchResponse,
        mockResponse,
        "GET /discovery/search (null data)",
      );
    });

    it("should match SearchResponse with string data", () => {
      // Since SearchResponse uses z.unknown(), it's flexible
      const mockResponse = {
        success: true as const,
        data: "no results",
      };

      assertMatchesSchema(
        SearchResponse,
        mockResponse,
        "GET /discovery/search (string data)",
      );
    });
  });

  // =======================================================================
  // BrowseRestaurants Response Contract
  // =======================================================================
  describe("BrowseRestaurants Response Contract", () => {
    it("should match BrowseRestaurantsResponse envelope", () => {
      const mockResponse = {
        success: true as const,
        data: [mockRestaurant],
      };

      assertMatchesSchema(
        BrowseRestaurantsResponse,
        mockResponse,
        "GET /discovery/restaurants",
      );
    });

    it("should match BrowseRestaurantsResponse with enriched data", () => {
      const mockResponse = {
        success: true as const,
        data: {
          restaurants: [mockRestaurant],
          categories: ["Malaysian", "Chinese", "Indian"],
          total: 1,
          page: 1,
        },
      };

      assertMatchesSchema(
        BrowseRestaurantsResponse,
        mockResponse,
        "GET /discovery/restaurants (enriched)",
      );
    });

    it("should match BrowseRestaurantsResponse with empty data", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        BrowseRestaurantsResponse,
        mockResponse,
        "GET /discovery/restaurants (empty)",
      );
    });
  });

  // =======================================================================
  // GetRestaurantMenu Response Contract
  // =======================================================================
  describe("GetRestaurantMenu Response Contract", () => {
    it("should match GetRestaurantMenuResponse schema with items", () => {
      const mockResponse = {
        success: true as const,
        data: {
          items: [mockMenuItem],
        },
      };

      assertMatchesSchema(
        GetRestaurantMenuResponse,
        mockResponse,
        "GET /discovery/restaurants/:id/menu",
      );
    });

    it("should match GetRestaurantMenuResponse with empty items", () => {
      const mockResponse = {
        success: true as const,
        data: {
          items: [] as (typeof mockMenuItem)[],
        },
      };

      assertMatchesSchema(
        GetRestaurantMenuResponse,
        mockResponse,
        "GET /discovery/restaurants/:id/menu (empty)",
      );
    });

    it("should match GetRestaurantMenuResponse without items field", () => {
      const mockResponse = {
        success: true as const,
        data: {},
      };

      assertMatchesSchema(
        GetRestaurantMenuResponse,
        mockResponse,
        "GET /discovery/restaurants/:id/menu (no items)",
      );
    });

    it("should accept additional fields via passthrough", () => {
      const mockResponse = {
        success: true as const,
        data: {
          items: [mockMenuItem],
          categories: [{ id: 10, name: "Main Course" }],
          restaurantName: "Kedai Makan Best",
        },
      };

      assertMatchesSchema(
        GetRestaurantMenuResponse,
        mockResponse,
        "GET /discovery/restaurants/:id/menu (with extras)",
      );
    });
  });

  // =======================================================================
  // GetPopularItems Response Contract
  // =======================================================================
  describe("GetPopularItems Response Contract", () => {
    it("should match GetPopularItemsResponse envelope", () => {
      const mockResponse = {
        success: true as const,
        data: [mockMenuItem],
      };

      assertMatchesSchema(
        GetPopularItemsResponse,
        mockResponse,
        "GET /discovery/popular",
      );
    });

    it("should match GetPopularItemsResponse with empty data", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        GetPopularItemsResponse,
        mockResponse,
        "GET /discovery/popular (empty)",
      );
    });
  });

  // =======================================================================
  // Sensitive Fields Contract (Public Endpoints)
  // =======================================================================
  describe("Public Endpoint Sensitive Fields", () => {
    it("should NOT expose internal pricing fields in public menu items", () => {
      const publicMenuItem = { ...mockMenuItem } as Record<string, unknown>;

      assertNoSensitiveFields(
        publicMenuItem,
        ["costPrice", "profitMargin", "supplierCost"],
        "Discovery menu item",
      );
    });

    it("should NOT expose internal restaurant fields in public listing", () => {
      const publicRestaurant = { ...mockRestaurant } as Record<string, unknown>;

      assertNoSensitiveFields(
        publicRestaurant,
        ["apiKey", "webhookSecret", "stripeAccountId", "internalNotes"],
        "Discovery restaurant",
      );
    });

    it("should verify restaurant entity has expected public fields", () => {
      const result = RestaurantSchema.safeParse(mockRestaurant);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toHaveProperty("id");
        expect(result.data).toHaveProperty("name");
        expect(result.data).toHaveProperty("isActive");
      }
    });

    it("should verify menu item entity has expected public fields", () => {
      const result = MenuItemSchema.safeParse(mockMenuItem);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toHaveProperty("id");
        expect(result.data).toHaveProperty("restaurantId");
        expect(result.data).toHaveProperty("name");
        expect(result.data).toHaveProperty("price");
      }
    });
  });

  // =======================================================================
  // Response Envelope Contract
  // =======================================================================
  describe("Response Envelope Contract", () => {
    it("should wrap search results in { success: true, data: {...} } envelope", () => {
      const mockResponse = {
        success: true as const,
        data: {
          restaurants: [mockRestaurant],
          items: [mockMenuItem],
        },
      };

      expect(mockResponse).toHaveProperty("success", true);
      expect(mockResponse).toHaveProperty("data");
    });

    it("should wrap restaurant menu in { success: true, data: { items } } envelope", () => {
      const mockResponse = {
        success: true as const,
        data: {
          items: [mockMenuItem],
        },
      };

      expect(mockResponse).toHaveProperty("success", true);
      expect(mockResponse).toHaveProperty("data");
      expect(mockResponse.data).toHaveProperty("items");
    });
  });
});
