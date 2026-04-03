import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

vi.mock("@/i18n", () => ({
  i18n: { global: { t: (k: string) => k } },
}));

import { discoveryApi } from "@/services/discoveryApi";
import { apiClient } from "@/services/api";

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;

describe("discoveryApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchDishes", () => {
    it("should GET /discovery/search with filters", async () => {
      const mockResponse = {
        results: [{ menuItemId: 1, dishName: "Nasi Lemak" }],
        total: 1,
      };
      mockGet.mockResolvedValueOnce(mockResponse);

      const result = await discoveryApi.searchDishes({
        q: "nasi",
        district: "KL",
        page: 1,
      });

      expect(mockGet).toHaveBeenCalledWith("/discovery/search", {
        q: "nasi",
        district: "KL",
        page: 1,
      });
      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("browseRestaurants", () => {
    it("should GET /discovery/restaurants with filters", async () => {
      const mockResponse = {
        results: [{ restaurantId: "r1", name: "Test" }],
        total: 1,
      };
      mockGet.mockResolvedValueOnce(mockResponse);

      const result = await discoveryApi.browseRestaurants({
        openNow: true,
        priceMin: 5,
      });

      expect(mockGet).toHaveBeenCalledWith("/discovery/restaurants", {
        openNow: true,
        priceMin: 5,
      });
      expect(result.results).toHaveLength(1);
    });
  });

  describe("getRestaurantMenu", () => {
    it("should GET /discovery/restaurants/:id/menu", async () => {
      mockGet.mockResolvedValueOnce([{ id: 1, name: "Item 1" }]);

      const result = await discoveryApi.getRestaurantMenu("r1");

      expect(mockGet).toHaveBeenCalledWith(
        "/discovery/restaurants/r1/menu",
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("getPopular", () => {
    it("should GET /discovery/popular", async () => {
      const mockResponse = {
        keywords: ["nasi", "roti"],
        dishes: [{ menuItemId: 1, dishName: "Nasi" }],
        restaurants: [{ restaurantId: "r1", name: "Place" }],
      };
      mockGet.mockResolvedValueOnce(mockResponse);

      const result = await discoveryApi.getPopular();

      expect(mockGet).toHaveBeenCalledWith("/discovery/popular");
      expect(result.keywords).toEqual(["nasi", "roti"]);
      expect(result.dishes).toHaveLength(1);
      expect(result.restaurants).toHaveLength(1);
    });
  });
});
