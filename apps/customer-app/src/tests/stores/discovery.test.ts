import { describe, expect, it, vi } from "vitest";
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
});
