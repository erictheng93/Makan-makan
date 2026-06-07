import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const cache = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  };
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  return { cache, db };
});

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

vi.mock("../../../core/cache", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    KVCacheService: vi.fn(function KVCacheService() {
      return mocks.cache;
    }),
    NoopCacheService: vi.fn(function NoopCacheService() {
      return mocks.cache;
    }),
  };
});

import { MarketsService } from "./MarketsService";

function createKV(version = "1") {
  const values = new Map<string, string>([["markets:version", version]]);

  return {
    values,
    kv: {
      get: vi.fn(async (key: string) => values.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
    } as any,
  };
}

function createService(version?: string) {
  const { kv, values } = createKV(version);
  return {
    service: new MarketsService({} as D1Database, kv),
    kv,
    values,
  };
}

const marketResult = {
  markets: [
    {
      id: "market-1",
      slug: "night-market",
      name: "Night Market",
      type: "night_market",
      city: "Taipei",
      district: "Central",
      vendorCount: 2,
      catalogCoverage: {
        searchableProductCount: 3,
        publicServiceCount: 1,
      },
      publicReadiness: { score: 80 },
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
};

describe("MarketsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cached public list data and skips market queries", async () => {
    mocks.cache.get.mockResolvedValue(marketResult);
    const { service, kv } = createService("4");
    const querySpy = vi.spyOn(service as any, "queryMarkets");

    await expect(
      service.listMarkets({ district: "Central", city: "Taipei" }),
    ).resolves.toBe(marketResult);

    expect(kv.get).toHaveBeenCalledWith("markets:version");
    expect(mocks.cache.get).toHaveBeenCalledWith(
      'markets:v4:list:{"city":"Taipei","district":"Central"}',
    );
    expect(querySpy).not.toHaveBeenCalled();
  });

  it("queries and caches public list, area, and detail misses", async () => {
    mocks.cache.get.mockResolvedValue(null);
    const { service } = createService("2");
    vi.spyOn(service as any, "queryMarkets").mockResolvedValue(marketResult);
    vi.spyOn(service as any, "queryAreas").mockResolvedValue({
      areas: [{ city: "Taipei", districts: ["Central"] }],
    });
    vi.spyOn(service as any, "queryMarketBySlug").mockResolvedValue({
      market: { id: "market-1", slug: "night-market" },
      vendorCount: 2,
    });

    await expect(service.listMarkets({ limit: 5 })).resolves.toBe(marketResult);
    await expect(service.listAreas()).resolves.toEqual({
      areas: [{ city: "Taipei", districts: ["Central"] }],
    });
    await expect(service.getMarketBySlug("night-market")).resolves.toEqual({
      market: { id: "market-1", slug: "night-market" },
      vendorCount: 2,
    });

    expect((service as any).queryMarkets).toHaveBeenCalledWith(
      { limit: 5 },
      { publicReadyOnly: true },
    );
    expect(mocks.cache.set).toHaveBeenCalledWith(
      'markets:v2:list:{"limit":5}',
      marketResult,
      expect.any(Number),
    );
    expect(mocks.cache.set).toHaveBeenCalledWith(
      "markets:v2:areas:all",
      { areas: [{ city: "Taipei", districts: ["Central"] }] },
      expect.any(Number),
    );
    expect(mocks.cache.set).toHaveBeenCalledWith(
      "markets:v2:detail:night-market",
      { market: { id: "market-1", slug: "night-market" }, vendorCount: 2 },
      expect.any(Number),
    );
  });

  it("aggregates market area readiness and sorts largest gaps first", async () => {
    const { service } = createService();
    vi.spyOn(service as any, "queryMarkets").mockResolvedValue({
      markets: [
        {
          city: "Taipei",
          district: "Central",
          vendorCount: 2,
          catalogCoverage: {
            searchableProductCount: 3,
            publicServiceCount: 1,
            vendorsMissingSearchableProducts: 1,
            vendorsMissingPublicServices: 2,
          },
          publicReadiness: { score: 80 },
        },
        {
          city: "Taipei",
          district: "Central",
          vendorCount: 0,
          catalogCoverage: {
            searchableProductCount: 0,
            publicServiceCount: 0,
            vendorsMissingSearchableProducts: 1,
            vendorsMissingPublicServices: 0,
          },
          publicReadiness: { score: 40 },
        },
        {
          city: "Kaohsiung",
          district: "West",
          vendorCount: 1,
          catalogCoverage: {
            searchableProductCount: 1,
            publicServiceCount: 0,
            vendorsMissingSearchableProducts: 0,
            vendorsMissingPublicServices: 0,
          },
          publicReadiness: { score: 90 },
        },
      ],
    });

    await expect(service.listAreaReadiness(10)).resolves.toEqual({
      areas: [
        {
          city: "Taipei",
          district: "Central",
          marketCount: 2,
          vendorCount: 2,
          searchableProductCount: 3,
          publicServiceCount: 1,
          vendorsMissingSearchableProducts: 2,
          vendorsMissingPublicServices: 2,
          marketsWithoutVendors: 1,
          marketsWithoutSearchableCatalog: 1,
          totalCatalogGapVendors: 4,
          averageReadinessScore: 60,
        },
        {
          city: "Kaohsiung",
          district: "West",
          marketCount: 1,
          vendorCount: 1,
          searchableProductCount: 1,
          publicServiceCount: 0,
          vendorsMissingSearchableProducts: 0,
          vendorsMissingPublicServices: 0,
          marketsWithoutVendors: 0,
          marketsWithoutSearchableCatalog: 0,
          totalCatalogGapVendors: 0,
          averageReadinessScore: 90,
        },
      ],
    });
    expect((service as any).queryMarkets).toHaveBeenCalledWith(
      { limit: 10 },
      { includeVendorBreakdown: true },
    );
  });

  it("delegates admin and readiness helpers without public cache", async () => {
    const { service } = createService();
    vi.spyOn(service as any, "queryMarkets").mockResolvedValue(marketResult);
    vi.spyOn(
      service as any,
      "catalogCoverageWithVendorBreakdown",
    ).mockResolvedValue({ searchableProductCount: 1, publicServiceCount: 2 });
    vi.spyOn(service, "getMarketById").mockResolvedValue(null);

    await expect(service.listAdminReadiness({ city: "Taipei" })).resolves.toBe(
      marketResult,
    );
    await expect(service.getCatalogReadiness("market-1")).resolves.toEqual({
      searchableProductCount: 1,
      publicServiceCount: 2,
    });
    await expect(service.getPublicReadiness("missing")).resolves.toBeNull();

    expect((service as any).queryMarkets).toHaveBeenCalledWith(
      { city: "Taipei" },
      { includeVendorBreakdown: true },
    );
    expect(mocks.cache.get).not.toHaveBeenCalled();
  });

  it("builds stable public cache keys and bumps numeric versions", async () => {
    const { service, values } = createService("9");

    await expect(
      (service as any).publicCacheKey("list", {
        z: 1,
        a: { b: 2, a: 1 },
        skipped: undefined,
      }),
    ).resolves.toBe('markets:v9:list:{"a":{"a":1,"b":2},"z":1}');

    await (service as any).bumpPublicCacheVersion();

    expect(values.get("markets:version")).toBe("10");
  });
});
