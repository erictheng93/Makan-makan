import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/utils/api-error";

const marketsFns = vi.hoisted(() => ({
  listMarkets: vi.fn(),
  findNearby: vi.fn(),
  listAreas: vi.fn(),
  listVendors: vi.fn(),
  getMarketBySlug: vi.fn(),
}));

vi.mock("../services/MarketsService", () => ({
  MarketsService: class {
    listMarkets = marketsFns.listMarkets;
    findNearby = marketsFns.findNearby;
    listAreas = marketsFns.listAreas;
    listVendors = marketsFns.listVendors;
    getMarketBySlug = marketsFns.getMarketBySlug;
  },
}));

import routes from "./index";

routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 404,
    );
  }
  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function request(path: string) {
  return routes.request(path, undefined, { DB: {}, CACHE_KV: {} } as never);
}

describe("public market routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists markets with validated query defaults and filters", async () => {
    marketsFns.listMarkets.mockResolvedValue({
      markets: [{ slug: "fengjia", name: "Fengjia Night Market" }],
      pagination: { page: 2, limit: 5, total: 1 },
    });

    const response = await request(
      "/?q=night&city=Taichung&type=night_market&page=2&limit=5",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        markets: [{ slug: "fengjia", name: "Fengjia Night Market" }],
        pagination: { page: 2, limit: 5, total: 1 },
      },
    });
    expect(marketsFns.listMarkets).toHaveBeenCalledWith({
      q: "night",
      city: "Taichung",
      type: "night_market",
      page: 2,
      limit: 5,
    });
  });

  it("finds nearby markets with coerced coordinates and default radius", async () => {
    marketsFns.findNearby.mockResolvedValue([{ slug: "linjiang" }]);

    const response = await request("/nearby?lat=25.03&lng=121.56&limit=3");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [{ slug: "linjiang" }],
    });
    expect(marketsFns.findNearby).toHaveBeenCalledWith(25.03, 121.56, 2, 3);
  });

  it("lists available market areas", async () => {
    marketsFns.listAreas.mockResolvedValue([
      { city: "Taipei", districts: ["Datong"] },
    ]);

    const response = await request("/areas");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [{ city: "Taipei", districts: ["Datong"] }],
    });
    expect(marketsFns.listAreas).toHaveBeenCalledOnce();
  });

  it("lists vendors for a market with validated search and distance filters", async () => {
    marketsFns.listVendors.mockResolvedValue({
      market: { slug: "fengjia" },
      vendors: [{ id: "restaurant-1", distanceKm: 0.4 }],
    });

    const response = await request(
      "/fengjia/vendors?openNow=true&q=tea&sortBy=distance&lat=24.18&lng=120.64&page=2&limit=4",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        market: { slug: "fengjia" },
        vendors: [{ id: "restaurant-1", distanceKm: 0.4 }],
      },
    });
    expect(marketsFns.listVendors).toHaveBeenCalledWith("fengjia", {
      openNow: true,
      q: "tea",
      sortBy: "distance",
      lat: 24.18,
      lng: 120.64,
      page: 2,
      limit: 4,
    });
  });

  it("maps missing vendor lists and market details to not found responses", async () => {
    marketsFns.listVendors.mockResolvedValueOnce(null);
    marketsFns.getMarketBySlug.mockResolvedValueOnce(null);

    const vendorsResponse = await request("/missing/vendors");
    const detailResponse = await request("/missing");

    expect(vendorsResponse.status).toBe(404);
    await expect(vendorsResponse.json()).resolves.toEqual({
      success: false,
      error: { code: "MARKET_NOT_FOUND", message: "Market not found" },
    });
    expect(detailResponse.status).toBe(404);
    await expect(detailResponse.json()).resolves.toEqual({
      success: false,
      error: { code: "MARKET_NOT_FOUND", message: "Market not found" },
    });
  });

  it("returns market detail by slug", async () => {
    marketsFns.getMarketBySlug.mockResolvedValue({
      market: { slug: "fengjia", name: "Fengjia Night Market" },
      vendors: [],
    });

    const response = await request("/fengjia");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        market: { slug: "fengjia", name: "Fengjia Night Market" },
        vendors: [],
      },
    });
    expect(marketsFns.getMarketBySlug).toHaveBeenCalledWith("fengjia");
  });

  it("rejects invalid query parameters before calling services", async () => {
    const response = await request("/nearby?lat=91&lng=121.56");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(marketsFns.findNearby).not.toHaveBeenCalled();
  });
});
