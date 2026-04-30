import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// Mock discoveryApi before importing the store
vi.mock("@/services/discoveryApi", () => ({
  discoveryApi: {
    searchDishes: vi.fn(),
    browseRestaurants: vi.fn(),
    getPopular: vi.fn(),
  },
  // Re-export types as empty (they're just interfaces)
}));

import { useDiscoveryStore } from "@/stores/discovery";
import { discoveryApi } from "@/services/discoveryApi";
import type {
  DishSearchResult,
  RestaurantListItem,
} from "@/services/discoveryApi";

const buildDishResult = (
  overrides: Partial<DishSearchResult> = {},
): DishSearchResult => ({
  menuItemId: 1,
  dishName: "Nasi Lemak",
  price: 10,
  categoryName: null,
  restaurantId: "r1",
  restaurantName: "Test",
  district: null,
  isOpen: true,
  supportsTakeaway: true,
  supportsDelivery: false,
  tags: [],
  ...overrides,
});

const buildRestaurantResult = (
  overrides: Partial<RestaurantListItem> = {},
): RestaurantListItem => ({
  restaurantId: "r1",
  name: "Test",
  type: null,
  district: null,
  priceRange: null,
  rating: null,
  isOpen: true,
  supportsTakeaway: true,
  supportsDelivery: false,
  imageUrl: null,
  ...overrides,
});

const mockSearchDishes = discoveryApi.searchDishes as ReturnType<typeof vi.fn>;
const mockBrowseRestaurants = discoveryApi.browseRestaurants as ReturnType<
  typeof vi.fn
>;
const mockGetPopular = discoveryApi.getPopular as ReturnType<typeof vi.fn>;

describe("discovery store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────
  // Initial state
  // ──────────────────────────────────────────────

  describe("initial state", () => {
    it("should start in browse mode with empty results", () => {
      const store = useDiscoveryStore();
      expect(store.mode).toBe("browse");
      expect(store.searchQuery).toBe("");
      expect(store.dishResults).toEqual([]);
      expect(store.restaurantResults).toEqual([]);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.total).toBe(0);
      expect(store.page).toBe(1);
    });

    it("hasResults should be false initially", () => {
      const store = useDiscoveryStore();
      expect(store.hasResults).toBe(false);
    });

    it("isSearchMode should be false initially", () => {
      const store = useDiscoveryStore();
      expect(store.isSearchMode).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // searchDishes
  // ──────────────────────────────────────────────

  describe("searchDishes", () => {
    it("should fetch dishes and update state", async () => {
      const mockResults = [
        {
          menuItemId: 1,
          dishName: "Nasi Lemak",
          price: 10,
          restaurantId: "r1",
          restaurantName: "Test",
          isOpen: true,
          tags: [],
        },
      ];
      mockSearchDishes.mockResolvedValueOnce({
        results: mockResults,
        total: 1,
      });

      const store = useDiscoveryStore();
      await store.searchDishes("nasi");

      expect(store.mode).toBe("search");
      expect(store.searchQuery).toBe("nasi");
      expect(store.dishResults).toEqual(mockResults);
      expect(store.total).toBe(1);
      expect(store.loading).toBe(false);
      expect(mockSearchDishes).toHaveBeenCalledWith(
        expect.objectContaining({ q: "nasi", page: 1 }),
      );
    });

    it("should set error on failure", async () => {
      mockSearchDishes.mockRejectedValueOnce(new Error("API down"));

      const store = useDiscoveryStore();
      await store.searchDishes("fail");

      expect(store.error).toBe("API down");
      expect(store.loading).toBe(false);
    });

    it("should set isSearchMode to true", async () => {
      mockSearchDishes.mockResolvedValueOnce({ results: [], total: 0 });

      const store = useDiscoveryStore();
      await store.searchDishes("test");

      expect(store.isSearchMode).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // browseRestaurants
  // ──────────────────────────────────────────────

  describe("browseRestaurants", () => {
    it("should fetch restaurants and update state", async () => {
      const mockResults = [
        {
          restaurantId: "r1",
          name: "Burger Place",
          isOpen: true,
        },
      ];
      mockBrowseRestaurants.mockResolvedValueOnce({
        results: mockResults,
        total: 1,
      });

      const store = useDiscoveryStore();
      await store.browseRestaurants();

      expect(store.mode).toBe("browse");
      expect(store.restaurantResults).toEqual(mockResults);
      expect(store.total).toBe(1);
      expect(mockBrowseRestaurants).toHaveBeenCalledOnce();
    });

    it("should set error on failure", async () => {
      mockBrowseRestaurants.mockRejectedValueOnce(new Error("Network error"));

      const store = useDiscoveryStore();
      await store.browseRestaurants();

      expect(store.error).toBe("Network error");
    });
  });

  // ──────────────────────────────────────────────
  // loadPopular
  // ──────────────────────────────────────────────

  describe("loadPopular", () => {
    it("should populate popular data", async () => {
      mockGetPopular.mockResolvedValueOnce({
        keywords: ["nasi", "mee"],
        dishes: [{ menuItemId: 1, dishName: "Nasi Lemak" }],
        restaurants: [{ restaurantId: "r1", name: "Test" }],
      });

      const store = useDiscoveryStore();
      await store.loadPopular();

      expect(store.popularKeywords).toEqual(["nasi", "mee"]);
      expect(store.popularDishes).toHaveLength(1);
      expect(store.popularRestaurants).toHaveLength(1);
      expect(mockGetPopular).toHaveBeenCalledOnce();
    });
  });

  // ──────────────────────────────────────────────
  // updateFilters
  // ──────────────────────────────────────────────

  describe("updateFilters", () => {
    it("should merge filters and reset page to 1", async () => {
      mockBrowseRestaurants.mockResolvedValue({ results: [], total: 0 });

      const store = useDiscoveryStore();
      store.page = 3;
      store.updateFilters({ district: "KL" });

      expect(store.page).toBe(1);
      expect(store.filters).toEqual(
        expect.objectContaining({ district: "KL" }),
      );
    });

    it("should trigger searchDishes when in search mode with query", async () => {
      mockSearchDishes.mockResolvedValue({ results: [], total: 0 });

      const store = useDiscoveryStore();
      // Put into search mode
      store.mode = "search";
      store.searchQuery = "roti";

      store.updateFilters({ priceMax: 20 });

      expect(mockSearchDishes).toHaveBeenCalledWith(
        expect.objectContaining({ q: "roti", priceMax: 20 }),
      );
    });

    it("should trigger browseRestaurants when in browse mode", async () => {
      mockBrowseRestaurants.mockResolvedValue({ results: [], total: 0 });

      const store = useDiscoveryStore();
      store.updateFilters({ openNow: true });

      expect(mockBrowseRestaurants).toHaveBeenCalledWith(
        expect.objectContaining({ openNow: true }),
      );
    });
  });

  // ──────────────────────────────────────────────
  // clearSearch / resetAll
  // ──────────────────────────────────────────────

  describe("clearSearch", () => {
    it("should clear search state and switch to browse mode", () => {
      const store = useDiscoveryStore();
      store.searchQuery = "test";
      store.dishResults = [buildDishResult()];
      store.mode = "search";
      store.page = 3;

      store.clearSearch();

      expect(store.searchQuery).toBe("");
      expect(store.dishResults).toEqual([]);
      expect(store.mode).toBe("browse");
      expect(store.page).toBe(1);
    });
  });

  describe("resetAll", () => {
    it("should reset all state to defaults", () => {
      const store = useDiscoveryStore();
      store.searchQuery = "something";
      store.filters = { district: "PJ" };
      store.dishResults = [buildDishResult()];
      store.restaurantResults = [buildRestaurantResult()];
      store.error = "old error";
      store.total = 50;
      store.page = 5;
      store.mode = "search";

      store.resetAll();

      expect(store.searchQuery).toBe("");
      expect(store.filters).toEqual({});
      expect(store.dishResults).toEqual([]);
      expect(store.restaurantResults).toEqual([]);
      expect(store.error).toBeNull();
      expect(store.total).toBe(0);
      expect(store.page).toBe(1);
      expect(store.mode).toBe("browse");
    });
  });
});
