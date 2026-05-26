import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/services/api";
import { marketsService } from "./marketsService";

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  unwrapApiPayload: (payload: { data?: unknown }) => payload.data ?? payload,
}));

describe("marketsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists area-level market readiness summaries", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: {
          areas: [
            {
              city: "台中市",
              district: "西屯區",
              marketCount: 2,
              vendorCount: 8,
              searchableProductCount: 20,
              publicServiceCount: 5,
              vendorsMissingSearchableProducts: 3,
              vendorsMissingPublicServices: 4,
              totalCatalogGapVendors: 7,
              averageReadinessScore: 72,
            },
          ],
        },
      },
    } as never);

    const result = await marketsService.listAreaReadiness();

    expect(api.get).toHaveBeenCalledWith("/admin/markets/area-readiness");
    expect(result[0]).toMatchObject({
      city: "台中市",
      district: "西屯區",
      totalCatalogGapVendors: 7,
    });
  });

  it("searches vendor candidates excluding the selected market", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: {
          restaurants: [
            {
              id: "restaurant-1",
              name: "可加入店家",
              city: "台中市",
              district: "西屯區",
              address: "台中市西屯區文華路",
              type: "market_stall",
              category: "food",
              isAvailable: true,
              supportsTakeaway: true,
              supportsDelivery: false,
            },
          ],
          total: 1,
        },
      },
    } as never);

    const result = await marketsService.searchVendorCandidates({
      q: "可加入",
      marketId: "market-1",
      limit: 8,
    });

    expect(api.get).toHaveBeenCalledWith("/admin/markets/vendor-candidates", {
      q: "可加入",
      marketId: "market-1",
      limit: 8,
    });
    expect(result.restaurants[0]).toMatchObject({
      id: "restaurant-1",
      name: "可加入店家",
    });
  });

  it("adds an existing vendor to a market", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        data: {
          membership: {
            id: 1,
            restaurantId: "restaurant-1",
            marketId: "market-1",
            stallNumber: "A-01",
            isPrimary: true,
          },
        },
      },
    } as never);

    const result = await marketsService.addVendor("market-1", {
      restaurantId: "restaurant-1",
      stallNumber: "A-01",
      isPrimary: true,
    });

    expect(api.post).toHaveBeenCalledWith("/admin/markets/market-1/vendors", {
      restaurantId: "restaurant-1",
      stallNumber: "A-01",
      isPrimary: true,
    });
    expect(result).toMatchObject({
      restaurantId: "restaurant-1",
      marketId: "market-1",
    });
  });

  it("lists vendors attached to a public market", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: {
          vendors: [
            {
              restaurantId: "restaurant-1",
              name: "已加入攤",
              stallNumber: "A-01",
              isPrimary: true,
            },
          ],
          total: 23,
          page: 2,
          limit: 10,
        },
      },
    } as never);

    const result = await marketsService.listMarketVendors("fengjia", {
      q: "雞排",
      page: 2,
      limit: 10,
    });

    expect(api.get).toHaveBeenCalledWith("/markets/fengjia/vendors", {
      q: "雞排",
      page: 2,
      limit: 10,
    });
    expect(result.vendors[0]).toMatchObject({
      restaurantId: "restaurant-1",
      stallNumber: "A-01",
    });
    expect(result.total).toBe(23);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it("updates an existing market vendor membership", async () => {
    vi.mocked(api.put).mockResolvedValueOnce({
      data: {
        data: {
          membership: {
            id: 1,
            restaurantId: "restaurant-1",
            marketId: "market-1",
            stallNumber: "A-02",
            isPrimary: true,
          },
        },
      },
    } as never);

    const result = await marketsService.updateVendor(
      "market-1",
      "restaurant-1",
      {
        stallNumber: "A-02",
        isPrimary: true,
      },
    );

    expect(api.put).toHaveBeenCalledWith(
      "/admin/markets/market-1/vendors/restaurant-1",
      {
        stallNumber: "A-02",
        isPrimary: true,
      },
    );
    expect(result).toMatchObject({
      restaurantId: "restaurant-1",
      stallNumber: "A-02",
      isPrimary: true,
    });
  });

  it("removes an existing market vendor membership", async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({
      data: { data: { removed: true } },
    } as never);

    const result = await marketsService.removeVendor(
      "market-1",
      "restaurant-1",
    );

    expect(api.delete).toHaveBeenCalledWith(
      "/admin/markets/market-1/vendors/restaurant-1",
    );
    expect(result).toBe(true);
  });
});
