import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api";
import { marketsApi } from "@/services/marketsApi";

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("marketsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists markets with area filters", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      markets: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    await marketsApi.listMarkets({ city: "台中市", district: "西屯區" });

    expect(apiClient.get).toHaveBeenCalledWith("/markets", {
      city: "台中市",
      district: "西屯區",
    });
  });

  it("lists markets with a keyword filter", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      markets: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    await marketsApi.listMarkets({ q: "逢甲" });

    expect(apiClient.get).toHaveBeenCalledWith("/markets", {
      q: "逢甲",
    });
  });

  it("lists available market areas for dynamic filters", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      areas: [{ city: "台中市", districts: ["西屯區"] }],
    });

    await marketsApi.listAreas();

    expect(apiClient.get).toHaveBeenCalledWith("/markets/areas");
  });

  it("loads market detail and vendors by slug", async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ market: { slug: "fengjia" }, vendorCount: 2 })
      .mockResolvedValueOnce({ vendors: [], total: 0, page: 1, limit: 20 });

    await marketsApi.getMarket("fengjia");
    await marketsApi.listVendors("fengjia", { takeaway: true, q: "tea" });

    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/markets/fengjia");
    expect(apiClient.get).toHaveBeenNthCalledWith(
      2,
      "/markets/fengjia/vendors",
      {
        takeaway: true,
        q: "tea",
      },
    );
  });

  it("finds nearby markets with GPS params", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ markets: [] });

    await marketsApi.findNearby({ lat: 24.1763, lng: 120.6465, radiusKm: 2 });

    expect(apiClient.get).toHaveBeenCalledWith("/markets/nearby", {
      lat: 24.1763,
      lng: 120.6465,
      radiusKm: 2,
    });
  });
});
