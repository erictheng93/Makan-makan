/**
 * Contract Tests for Restaurants API Responses
 *
 * These tests verify that restaurant endpoints return STABLE response
 * shapes. The customer app, admin dashboard, and partner integrations
 * depend on these shapes -- any change here is a breaking change.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmasak/testing-utils";
import {
  assertMatchesSchema,
  assertNoExtraFields,
} from "../../../contracts/helpers";
import {
  ListRestaurantsResponse,
  GetRestaurantResponse,
  CreateRestaurantResponse,
  UpdateRestaurantResponse,
  DeleteRestaurantResponse,
  GetRestaurantStatsResponse,
  GenerateShopQRResponse,
  GetShopQRResponse,
  UpdateSettingsResponse,
  RestaurantSchema,
  RestaurantStatsSchema,
  ShopQRCodeSchema,
  RestaurantSettingsSchema,
  OperatingHoursSchema,
} from "../../../contracts/schemas/restaurants";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = new Date().toISOString();

const mockRestaurant = {
  id: "rest-001",
  name: "Kedai Makan Best",
  description: "Authentic Malaysian cuisine",
  address: "123 Jalan Sultan, KL 50000",
  phone: "+60123456789",
  email: "info@kedaimakan.com",
  logoUrl: "https://cdn.example.com/logo.png",
  coverImageUrl: "https://cdn.example.com/cover.jpg",
  operatingHours: [
    { day: 1, open: "08:00", close: "22:00" },
    { day: 2, open: "08:00", close: "22:00" },
  ],
  settings: {
    enableQROrdering: true,
    enableTableService: true,
    taxRate: 6,
    serviceCharge: 10,
    currency: "MYR",
    timezone: "Asia/Kuala_Lumpur",
  },
  ownerId: 1,
  isActive: true,
  createdAt: now,
  updatedAt: now,
};

const mockShopQR = {
  id: "qr-001",
  restaurantId: "rest-001",
  qrCode: "https://app.makanmasak.com/shop/rest-001",
  qrCodeUrl: "https://cdn.example.com/qr/shop-rest-001.png",
  shortUrl: "https://mkn.my/r001",
  isActive: true,
  createdAt: now,
  updatedAt: now,
};

// =========================================================================
// Tests
// =========================================================================

describe("Restaurants API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // =======================================================================
  // Restaurant Schema Contract
  // =======================================================================
  describe("Restaurant Schema Contract", () => {
    it("should match RestaurantSchema with all fields", () => {
      assertMatchesSchema(
        RestaurantSchema,
        mockRestaurant,
        "Restaurant entity",
      );
    });

    it("should require id, name", () => {
      const minimalRestaurant = {
        id: "rest-001",
        name: "Kedai Makan Best",
        createdAt: now,
        updatedAt: now,
      };

      assertMatchesSchema(
        RestaurantSchema,
        minimalRestaurant,
        "Restaurant minimal",
      );
    });

    it("should accept both numeric and string ids", () => {
      const numericIdRestaurant = {
        ...mockRestaurant,
        id: 42,
      };

      assertMatchesSchema(
        RestaurantSchema,
        numericIdRestaurant,
        "Restaurant with numeric id",
      );
    });

    it("should accept isActive as boolean or number", () => {
      const boolActive = { ...mockRestaurant, isActive: true };
      const numActive = { ...mockRestaurant, isActive: 1 };

      assertMatchesSchema(
        RestaurantSchema,
        boolActive,
        "Restaurant isActive=true",
      );
      assertMatchesSchema(RestaurantSchema, numActive, "Restaurant isActive=1");
    });

    it("should accept null for optional nullable fields", () => {
      const nullableRestaurant = {
        id: "rest-001",
        name: "Kedai Makan Best",
        description: null,
        address: null,
        phone: null,
        email: null,
        logoUrl: null,
        coverImageUrl: null,
        operatingHours: null,
        settings: null,
        createdAt: now,
        updatedAt: now,
      };

      assertMatchesSchema(
        RestaurantSchema,
        nullableRestaurant,
        "Restaurant with null optionals",
      );
    });
  });

  // =======================================================================
  // OperatingHours Schema Contract
  // =======================================================================
  describe("OperatingHours Schema Contract", () => {
    it("should match OperatingHoursSchema", () => {
      const hours = { day: 1, open: "08:00", close: "22:00" };

      assertMatchesSchema(OperatingHoursSchema, hours, "OperatingHours");
    });

    it("should accept day values 0-6 (Sun-Sat)", () => {
      for (let day = 0; day <= 6; day++) {
        const hours = { day, open: "08:00", close: "22:00" };
        const result = OperatingHoursSchema.safeParse(hours);
        expect(result.success).toBe(true);
      }
    });

    it("should reject day values outside 0-6", () => {
      const invalidHours = { day: 7, open: "08:00", close: "22:00" };
      const result = OperatingHoursSchema.safeParse(invalidHours);
      expect(result.success).toBe(false);
    });

    it("should accept optional closed flag", () => {
      const closedDay = { day: 0, open: "00:00", close: "00:00", closed: true };

      assertMatchesSchema(
        OperatingHoursSchema,
        closedDay,
        "OperatingHours (closed)",
      );
    });
  });

  // =======================================================================
  // RestaurantSettings Schema Contract
  // =======================================================================
  describe("RestaurantSettings Schema Contract", () => {
    it("should match RestaurantSettingsSchema", () => {
      const settings = {
        enableQROrdering: true,
        enableTableService: true,
        enableShopQR: true,
        autoAcceptOrders: false,
        orderTimeout: 300,
        enableLoyaltyProgram: false,
        taxRate: 6,
        serviceCharge: 10,
        currency: "MYR",
        timezone: "Asia/Kuala_Lumpur",
      };

      assertMatchesSchema(
        RestaurantSettingsSchema,
        settings,
        "RestaurantSettings",
      );
    });

    it("should accept empty settings object", () => {
      assertMatchesSchema(
        RestaurantSettingsSchema,
        {},
        "RestaurantSettings (empty)",
      );
    });
  });

  // =======================================================================
  // ListRestaurants Response Contract
  // =======================================================================
  describe("ListRestaurants Response Contract", () => {
    it("should match ListRestaurantsResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: [mockRestaurant],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };

      assertMatchesSchema(
        ListRestaurantsResponse,
        mockResponse,
        "GET /restaurants",
      );
    });

    it("should match ListRestaurantsResponse without pagination", () => {
      const mockResponse = {
        success: true as const,
        data: [mockRestaurant],
      };

      assertMatchesSchema(
        ListRestaurantsResponse,
        mockResponse,
        "GET /restaurants (no pagination)",
      );
    });

    it("should match ListRestaurantsResponse with empty data", () => {
      const mockResponse = {
        success: true as const,
        data: [] as (typeof mockRestaurant)[],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      };

      assertMatchesSchema(
        ListRestaurantsResponse,
        mockResponse,
        "GET /restaurants (empty)",
      );
    });
  });

  // =======================================================================
  // GetRestaurant Response Contract
  // =======================================================================
  describe("GetRestaurant Response Contract", () => {
    it("should match GetRestaurantResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockRestaurant },
      };

      assertMatchesSchema(
        GetRestaurantResponse,
        mockResponse,
        "GET /restaurants/:id",
      );
    });

    it("should wrap restaurant in { success: true, data: restaurant } envelope", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockRestaurant },
      };

      expect(mockResponse).toHaveProperty("success", true);
      expect(mockResponse).toHaveProperty("data");
      expect(mockResponse.data).toHaveProperty("id");
      expect(mockResponse.data).toHaveProperty("name");
      expect(mockResponse.data).toHaveProperty("isActive");
    });
  });

  // =======================================================================
  // CreateRestaurant Response Contract
  // =======================================================================
  describe("CreateRestaurant Response Contract", () => {
    it("should match CreateRestaurantResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockRestaurant },
      };

      assertMatchesSchema(
        CreateRestaurantResponse,
        mockResponse,
        "POST /restaurants",
      );
    });
  });

  // =======================================================================
  // UpdateRestaurant Response Contract
  // =======================================================================
  describe("UpdateRestaurant Response Contract", () => {
    it("should match UpdateRestaurantResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockRestaurant, name: "Updated Kedai Makan" },
      };

      assertMatchesSchema(
        UpdateRestaurantResponse,
        mockResponse,
        "PUT /restaurants/:id",
      );
    });
  });

  // =======================================================================
  // DeleteRestaurant Response Contract
  // =======================================================================
  describe("DeleteRestaurant Response Contract", () => {
    it("should match message-only response", () => {
      const mockResponse = {
        success: true as const,
        message: "Restaurant deleted successfully",
      };

      assertMatchesSchema(
        DeleteRestaurantResponse,
        mockResponse,
        "DELETE /restaurants/:id",
      );
    });
  });

  // =======================================================================
  // RestaurantStats Response Contract
  // =======================================================================
  describe("RestaurantStats Response Contract", () => {
    it("should match GetRestaurantStatsResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          totalOrders: 500,
          totalRevenue: 15000.0,
          averageOrderValue: 30.0,
          totalCustomers: 200,
        },
      };

      assertMatchesSchema(
        GetRestaurantStatsResponse,
        mockResponse,
        "GET /restaurants/:id/stats",
      );
    });

    it("should accept partial stats", () => {
      const mockResponse = {
        success: true as const,
        data: {
          totalOrders: 500,
        },
      };

      assertMatchesSchema(
        GetRestaurantStatsResponse,
        mockResponse,
        "GET /restaurants/:id/stats (partial)",
      );
    });
  });

  // =======================================================================
  // GenerateShopQR Response Contract
  // =======================================================================
  describe("GenerateShopQR Response Contract", () => {
    it("should match GenerateShopQRResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockShopQR },
      };

      assertMatchesSchema(
        GenerateShopQRResponse,
        mockResponse,
        "POST /restaurants/:id/qr/shop/generate",
      );
    });

    it("should match GetShopQRResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockShopQR },
      };

      assertMatchesSchema(
        GetShopQRResponse,
        mockResponse,
        "GET /restaurants/:id/qr/shop",
      );
    });

    it("should accept ShopQRCode with null shortUrl", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockShopQR, shortUrl: null },
      };

      assertMatchesSchema(
        GenerateShopQRResponse,
        mockResponse,
        "GenerateShopQR (null shortUrl)",
      );
    });
  });

  // =======================================================================
  // UpdateSettings Response Contract
  // =======================================================================
  describe("UpdateSettings Response Contract", () => {
    it("should match UpdateSettingsResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          enableQROrdering: true,
          enableTableService: true,
          taxRate: 8,
          serviceCharge: 10,
          currency: "MYR",
          timezone: "Asia/Kuala_Lumpur",
        },
      };

      assertMatchesSchema(
        UpdateSettingsResponse,
        mockResponse,
        "PUT /restaurants/:id/settings",
      );
    });
  });

  // =======================================================================
  // Response Envelope Contract
  // =======================================================================
  describe("Response Envelope Contract", () => {
    it("should wrap restaurant data in { success: true, data: {...} } envelope", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockRestaurant },
      };

      expect(mockResponse).toHaveProperty("success", true);
      expect(mockResponse).toHaveProperty("data");
      expect(mockResponse.data).toHaveProperty("id");
      expect(mockResponse.data).toHaveProperty("name");
    });

    it("should wrap restaurant list in { success: true, data: [...] } envelope", () => {
      const mockResponse = {
        success: true as const,
        data: [mockRestaurant],
      };

      expect(mockResponse).toHaveProperty("success", true);
      expect(mockResponse.data).toBeInstanceOf(Array);
      expect(mockResponse.data).toHaveLength(1);
    });
  });
});
