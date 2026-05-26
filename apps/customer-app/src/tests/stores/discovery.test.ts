import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useDiscoveryStore } from "@/stores/discovery";
import { discoveryApi } from "@/services/discoveryApi";

vi.mock("@/services/discoveryApi", () => ({
  discoveryApi: {
    searchDishes: vi.fn(),
    browseRestaurants: vi.fn(),
    getPopular: vi.fn(),
  },
}));

describe("useDiscoveryStore", () => {
  beforeEach(() => {
    vi.mocked(discoveryApi.searchDishes).mockReset();
    vi.mocked(discoveryApi.browseRestaurants).mockReset();
    vi.mocked(discoveryApi.getPopular).mockReset();
  });

  it("passes selected market scope to dish search", async () => {
    setActivePinia(createPinia());
    vi.mocked(discoveryApi.searchDishes).mockResolvedValueOnce({
      results: [],
      total: 0,
    } as never);
    vi.mocked(discoveryApi.browseRestaurants).mockResolvedValueOnce({
      results: [],
      total: 0,
    } as never);

    const store = useDiscoveryStore();
    store.updateFilters({ marketId: "market-1" });
    await store.searchDishes("章魚燒");

    expect(discoveryApi.searchDishes).toHaveBeenLastCalledWith({
      q: "章魚燒",
      marketId: "market-1",
      page: 1,
    });
  });

  it("browses market dishes when selecting a market without a keyword", async () => {
    setActivePinia(createPinia());
    vi.mocked(discoveryApi.searchDishes).mockResolvedValueOnce({
      results: [
        {
          menuItemId: 42,
          dishName: "章魚燒",
          price: 80,
          categoryName: "小吃",
          restaurantId: "restaurant-1",
          restaurantName: "章魚燒攤",
          district: "西屯區",
          isOpen: true,
          supportsTakeaway: true,
          supportsDelivery: false,
          tags: [],
        },
      ],
      total: 1,
    } as never);

    const store = useDiscoveryStore();
    store.updateFilters({ marketId: "market-1" });

    await vi.waitFor(() => {
      expect(discoveryApi.searchDishes).toHaveBeenCalledWith({
        marketId: "market-1",
        page: 1,
      });
    });
    expect(discoveryApi.browseRestaurants).not.toHaveBeenCalled();
    expect(store.isSearchMode).toBe(true);
    expect(store.dishResults).toHaveLength(1);
  });

  it("browses category dishes when selecting a category without a keyword", async () => {
    setActivePinia(createPinia());
    vi.mocked(discoveryApi.searchDishes).mockResolvedValueOnce({
      results: [],
      total: 0,
    } as never);

    const store = useDiscoveryStore();
    store.updateFilters({ categoryName: "飲品" });

    await vi.waitFor(() => {
      expect(discoveryApi.searchDishes).toHaveBeenCalledWith({
        categoryName: "飲品",
        page: 1,
      });
    });
    expect(discoveryApi.browseRestaurants).not.toHaveBeenCalled();
  });
});
