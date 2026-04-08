import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("@/i18n", () => ({
  i18n: { global: { t: (k: string) => k } },
}));

import { menuApi } from "@/services/menuApi";
import { apiClient } from "@/services/api";

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;

describe("menuApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRestaurantMenu", () => {
    it("should GET /menu/:restaurantId", async () => {
      const mockMenu = {
        restaurant: { id: "r1" },
        categories: [],
        menuItems: [],
        featuredItems: [],
      };
      mockGet.mockResolvedValueOnce(mockMenu);

      const result = await menuApi.getRestaurantMenu("r1");

      expect(mockGet).toHaveBeenCalledWith("/menu/r1");
      expect(result.restaurant.id).toBe("r1");
    });

    it("should include tableId param when provided", async () => {
      mockGet.mockResolvedValueOnce({});

      await menuApi.getRestaurantMenu("r1", 5);

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("tableId=5"),
      );
    });
  });

  describe("getRestaurant", () => {
    it("should GET /restaurants/:id", async () => {
      mockGet.mockResolvedValueOnce({ id: "r1", name: "Test" });

      const result = await menuApi.getRestaurant("r1");

      expect(mockGet).toHaveBeenCalledWith("/restaurants/r1");
      expect(result.name).toBe("Test");
    });
  });

  describe("getCategoryMenu", () => {
    it("should GET /restaurants/:id/categories/:catId/menu", async () => {
      mockGet.mockResolvedValueOnce({
        category: { id: 1 },
        menuItems: [],
      });

      await menuApi.getCategoryMenu("r1", 3);

      expect(mockGet).toHaveBeenCalledWith("/restaurants/r1/categories/3/menu");
    });
  });

  describe("getMenuItem", () => {
    it("should GET /restaurants/:id/menu/:itemId", async () => {
      mockGet.mockResolvedValueOnce({ id: 10, name: "Roti" });

      const result = await menuApi.getMenuItem("r1", 10);

      expect(mockGet).toHaveBeenCalledWith("/restaurants/r1/menu/10");
      expect(result.name).toBe("Roti");
    });
  });

  describe("getFeaturedItems", () => {
    it("should GET featured items with default limit", async () => {
      mockGet.mockResolvedValueOnce([]);

      await menuApi.getFeaturedItems("r1");

      expect(mockGet).toHaveBeenCalledWith(
        "/restaurants/r1/menu/featured?limit=10",
      );
    });

    it("should use custom limit", async () => {
      mockGet.mockResolvedValueOnce([]);

      await menuApi.getFeaturedItems("r1", 5);

      expect(mockGet).toHaveBeenCalledWith(
        "/restaurants/r1/menu/featured?limit=5",
      );
    });
  });

  describe("searchMenuItems", () => {
    it("should GET search endpoint with query and options", async () => {
      mockGet.mockResolvedValueOnce({
        menuItems: [],
        total: 0,
        hasMore: false,
      });

      await menuApi.searchMenuItems("r1", "nasi", {
        categoryId: 2,
        priceMin: 5,
        priceMax: 20,
        limit: 10,
      });

      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain("/restaurants/r1/menu/search");
      expect(url).toContain("query=nasi");
      expect(url).toContain("categoryId=2");
      expect(url).toContain("priceMin=5");
      expect(url).toContain("priceMax=20");
      expect(url).toContain("limit=10");
    });
  });

  describe("checkItemAvailability", () => {
    it("should POST to availability endpoint", async () => {
      mockPost.mockResolvedValueOnce({
        1: { isAvailable: true, inventoryCount: 10 },
        2: { isAvailable: false, inventoryCount: 0 },
      });

      const result = await menuApi.checkItemAvailability("r1", [1, 2]);

      expect(mockPost).toHaveBeenCalledWith(
        "/restaurants/r1/menu/availability",
        { menuItemIds: [1, 2] },
      );
      expect(result[1].isAvailable).toBe(true);
      expect(result[2].isAvailable).toBe(false);
    });
  });

  describe("getCategories", () => {
    it("should GET /restaurants/:id/categories", async () => {
      mockGet.mockResolvedValueOnce([{ id: 1, name: "Main" }]);

      const result = await menuApi.getCategories("r1");

      expect(mockGet).toHaveBeenCalledWith("/restaurants/r1/categories");
      expect(result).toHaveLength(1);
    });
  });

  describe("validateTable", () => {
    it("should GET validate endpoint", async () => {
      mockGet.mockResolvedValueOnce({
        isValid: true,
        table: { id: 1, number: "A1", seats: 4, status: "available" },
      });

      const result = await menuApi.validateTable("r1", 1);

      expect(mockGet).toHaveBeenCalledWith("/restaurants/r1/tables/1/validate");
      expect(result.isValid).toBe(true);
    });
  });

  describe("searchRestaurants", () => {
    it("should GET /discovery/restaurants with query params", async () => {
      mockGet.mockResolvedValueOnce({
        results: [{ restaurantId: "r1", name: "Test" }],
      });

      const result = await menuApi.searchRestaurants("burger");

      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain("q=burger");
      expect(url).toContain("limit=10");
      expect(result).toHaveLength(1);
    });
  });

  describe("getMenu (alias)", () => {
    it("should delegate to getRestaurantMenu", async () => {
      mockGet.mockResolvedValueOnce({
        restaurant: { id: "r1" },
        categories: [],
        menuItems: [],
        featuredItems: [],
      });

      await menuApi.getMenu("r1", 2);

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("/menu/r1"));
    });
  });
});
