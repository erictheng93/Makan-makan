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

  it("loads selected market detail with vendors", async () => {
    setActivePinia(createPinia());
    vi.mocked(marketsApi.getMarket).mockResolvedValueOnce({
      market: { id: "m1", slug: "fengjia", name: "逢甲夜市" },
      vendorCount: 1,
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
    expect(store.vendors[0].name).toBe("雞排攤");
  });
});
