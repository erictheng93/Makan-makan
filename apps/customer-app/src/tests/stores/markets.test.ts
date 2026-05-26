import { describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useMarketsStore } from "@/stores/markets";
import { marketsApi } from "@/services/marketsApi";

vi.mock("@/services/marketsApi", () => ({
  marketsApi: {
    listMarkets: vi.fn(),
    getMarket: vi.fn(),
    listVendors: vi.fn(),
    findNearby: vi.fn(),
  },
}));

describe("useMarketsStore", () => {
  it("loads market list and nearby markets", async () => {
    setActivePinia(createPinia());
    vi.mocked(marketsApi.listMarkets).mockResolvedValueOnce({
      markets: [{ id: "m1", slug: "fengjia", name: "逢甲夜市" }],
      total: 1,
      page: 1,
      limit: 20,
    } as never);
    vi.mocked(marketsApi.findNearby).mockResolvedValueOnce({
      markets: [{ id: "m1", slug: "fengjia", distanceKm: 0.2 }],
    } as never);

    const store = useMarketsStore();
    await store.loadMarkets({ city: "台中市" });
    await store.loadNearby({ lat: 24.1763, lng: 120.6465 });

    expect(store.markets).toHaveLength(1);
    expect(store.nearbyMarkets[0].distanceKm).toBe(0.2);
    expect(store.total).toBe(1);
  });

  it("appends additional public markets for large directories", async () => {
    setActivePinia(createPinia());
    vi.mocked(marketsApi.listMarkets)
      .mockResolvedValueOnce({
        markets: [{ id: "m1", slug: "fengjia", name: "逢甲夜市" }],
        total: 2,
        page: 1,
        limit: 1,
      } as never)
      .mockResolvedValueOnce({
        markets: [{ id: "m2", slug: "yizhong", name: "一中商圈" }],
        total: 2,
        page: 2,
        limit: 1,
      } as never);

    const store = useMarketsStore();
    await store.loadMarkets({ q: "台中", limit: 1 });

    expect(store.hasMoreMarkets).toBe(true);

    await store.loadMoreMarkets({ q: "台中" });

    expect(marketsApi.listMarkets).toHaveBeenLastCalledWith({
      q: "台中",
      page: 2,
      limit: 1,
    });
    expect(store.markets.map((market) => market.name)).toEqual([
      "逢甲夜市",
      "一中商圈",
    ]);
    expect(store.hasMoreMarkets).toBe(false);
  });

  it("loads selected market detail with vendors", async () => {
    setActivePinia(createPinia());
    vi.mocked(marketsApi.getMarket).mockResolvedValueOnce({
      market: { id: "m1", slug: "fengjia", name: "逢甲夜市" },
      vendorCount: 1,
      explorationSummary: {
        dishSearchUrl: "/api/v1/discovery/search?marketSlug=fengjia",
        serviceSearchUrl: "/api/v1/discovery/services?marketSlug=fengjia",
        dishCategories: [
          {
            categoryName: "炸物",
            count: 3,
            searchUrl:
              "/api/v1/discovery/search?marketSlug=fengjia&categoryName=%E7%82%B8%E7%89%A9",
          },
        ],
        serviceTypes: [
          {
            serviceType: "pickup",
            count: 2,
            searchUrl:
              "/api/v1/discovery/services?marketSlug=fengjia&serviceType=pickup",
          },
        ],
      },
    } as never);
    vi.mocked(marketsApi.listVendors).mockResolvedValueOnce({
      vendors: [{ restaurantId: "r1", name: "雞排攤" }],
      total: 1,
      page: 1,
      limit: 20,
    } as never);

    const store = useMarketsStore();
    await store.loadMarketDetail("fengjia");
    await store.loadVendors("fengjia", { takeaway: true });

    expect(store.selectedMarket?.slug).toBe("fengjia");
    expect(store.vendorCount).toBe(1);
    expect(store.explorationSummary?.dishCategories[0]).toMatchObject({
      categoryName: "炸物",
      count: 3,
    });
    expect(store.vendors[0].name).toBe("雞排攤");
  });

  it("appends additional vendors for large markets", async () => {
    setActivePinia(createPinia());
    vi.mocked(marketsApi.listVendors)
      .mockResolvedValueOnce({
        vendors: [{ restaurantId: "r1", name: "雞排攤" }],
        total: 2,
        page: 1,
        limit: 1,
      } as never)
      .mockResolvedValueOnce({
        vendors: [{ restaurantId: "r2", name: "甜點攤" }],
        total: 2,
        page: 2,
        limit: 1,
      } as never);

    const store = useMarketsStore();
    await store.loadVendors("fengjia", { q: "攤", limit: 1 });

    expect(store.hasMoreVendors).toBe(true);

    await store.loadMoreVendors("fengjia", { q: "攤" });

    expect(marketsApi.listVendors).toHaveBeenLastCalledWith("fengjia", {
      q: "攤",
      page: 2,
      limit: 1,
    });
    expect(store.vendors.map((vendor) => vendor.name)).toEqual([
      "雞排攤",
      "甜點攤",
    ]);
    expect(store.hasMoreVendors).toBe(false);
  });
});
