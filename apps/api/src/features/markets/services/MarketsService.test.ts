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

function createQuery(result: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    leftJoin: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    groupBy: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    offset: vi.fn(() => builder),
    returning: vi.fn(async () => result),
    then: (
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function mockSelectResults(results: unknown[]) {
  mocks.db.select.mockImplementation(() => createQuery(results.shift() ?? []));
}

function mockMutationResults(results: unknown[] = []) {
  const inserted: unknown[] = [];
  const updated: unknown[] = [];

  mocks.db.insert.mockImplementation(() => {
    const builder = {
      values: vi.fn((payload: unknown) => {
        inserted.push(payload);
        return builder;
      }),
      returning: vi.fn(async () => results.shift() ?? []),
    };
    return builder;
  });
  mocks.db.update.mockImplementation(() => {
    const builder = {
      set: vi.fn((payload: unknown) => {
        updated.push(payload);
        return builder;
      }),
      where: vi.fn(() => builder),
      returning: vi.fn(async () => results.shift() ?? []),
    };
    return builder;
  });

  return { inserted, updated };
}

function createD1(
  firstResults: Array<Record<string, unknown> | null> = [],
  allResults: Array<Record<string, unknown>[]> = [],
) {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => firstResults.shift() ?? null),
        all: vi.fn(async () => ({ results: allResults.shift() ?? [] })),
      })),
    })),
  } as any;
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
    mocks.db.select.mockReset();
    mocks.db.insert.mockReset();
    mocks.db.update.mockReset();
    mocks.db.delete.mockReset();
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

  it("maps uncached market list rows with catalog coverage and public readiness", async () => {
    mocks.cache.get.mockResolvedValue(null);
    const { service, values } = createService("3");
    (service as any).d1 = createD1([
      { count: 2 },
      {
        booking_required_service_count: 1,
        booking_url_missing_service_count: 1,
      },
    ]);
    mockSelectResults([
      [
        {
          id: "market-1",
          slug: "night-market",
          name: "Night Market",
          type: "night_market",
          description: "Food stalls",
          city: "Taipei",
          district: "Central",
          address: "Main road",
          latitude: 25,
          longitude: 121,
          boundaryGeojson: null,
          openingHours: null,
          mapLayout: null,
          bannerUrl: null,
          logoUrl: null,
          imageUrls: [],
          tags: ["food"],
          updatedAt: new Date("2026-06-07T00:00:00.000Z"),
          vendorCount: 3,
        },
      ],
      [{ count: 1 }],
      [{ count: 4 }],
    ]);

    await expect(
      service.listMarkets({ city: "Taipei", limit: 5 }),
    ).resolves.toMatchObject({
      total: 1,
      page: 1,
      limit: 5,
      markets: [
        {
          id: "market-1",
          vendorCount: 3,
          catalogCoverage: {
            searchableProductCount: 4,
            publicServiceCount: 2,
            bookingRequiredServiceCount: 1,
            bookingUrlMissingServiceCount: 1,
          },
          publicReadiness: expect.objectContaining({
            ready: expect.any(Boolean),
            score: expect.any(Number),
          }),
        },
      ],
    });
    expect(mocks.cache.set).toHaveBeenCalledWith(
      'markets:v3:list:{"city":"Taipei","limit":5}',
      expect.objectContaining({ total: 1 }),
      expect.any(Number),
    );
    expect(values.get("markets:version")).toBe("3");
  });

  it("builds market detail exploration facets and readiness on cache misses", async () => {
    mocks.cache.get.mockResolvedValue(null);
    const { service } = createService("4");
    (service as any).d1 = createD1([
      { count: 1 },
      {
        booking_required_service_count: 2,
        booking_url_missing_service_count: 0,
      },
    ]);
    const market = {
      id: "market-1",
      slug: "night-market",
      name: "Night Market",
      type: "night_market",
      city: "Taipei",
      district: "Central",
      isActive: true,
      deletedAt: null,
    };
    mockSelectResults([
      [market],
      [{ count: 2 }],
      [{ count: 3 }],
      [{ categoryName: "Rice", count: 2 }],
      [{ categoryName: "Sauce", count: 1 }],
      [{ serviceType: "booking", count: 4 }],
    ]);

    await expect(
      service.getMarketBySlug("night-market"),
    ).resolves.toMatchObject({
      market,
      vendorCount: 2,
      catalogCoverage: {
        searchableProductCount: 3,
        publicServiceCount: 1,
      },
      explorationSummary: {
        dishSearchUrl: "/api/v1/discovery/search?marketSlug=night-market",
        menuItemCategories: [
          {
            categoryName: "Rice",
            catalogType: "menu_item",
            searchUrl:
              "/api/v1/discovery/search?marketSlug=night-market&catalogType=menu_item&categoryName=Rice",
          },
        ],
        productCategories: [
          {
            categoryName: "Sauce",
            catalogType: "product",
          },
        ],
        serviceTypes: [
          {
            serviceType: "booking",
            searchUrl:
              "/api/v1/discovery/services?marketSlug=night-market&serviceType=booking",
          },
        ],
      },
    });
    expect(mocks.cache.set).toHaveBeenCalledWith(
      "markets:v4:detail:night-market",
      expect.objectContaining({ vendorCount: 2 }),
      expect.any(Number),
    );
  });

  it("lists vendors with open and distance filters plus menu/service access counts", async () => {
    mocks.cache.get.mockResolvedValue(null);
    const { service } = createService("5");
    vi.spyOn(service, "getMarketBySlug").mockResolvedValue({
      market: { id: "market-1" },
      publicReadiness: { ready: true },
    } as any);
    mockSelectResults([
      [
        {
          restaurantId: "restaurant-1",
          name: "Vendor A",
          type: "malaysian",
          category: "casual",
          district: "Central",
          city: "Taipei",
          latitude: 25,
          longitude: 121,
          priceRange: 2,
          rating: 4.8,
          businessHours: {
            sunday: { open: "00:00", close: "23:59", closed: false },
            monday: { open: "00:00", close: "23:59", closed: false },
            tuesday: { open: "00:00", close: "23:59", closed: false },
            wednesday: { open: "00:00", close: "23:59", closed: false },
            thursday: { open: "00:00", close: "23:59", closed: false },
            friday: { open: "00:00", close: "23:59", closed: false },
            saturday: { open: "00:00", close: "23:59", closed: false },
          },
          marketHours: null,
          supportsTakeaway: true,
          supportsDelivery: false,
          imageUrl: null,
          stallNumber: "A1",
          locationLabel: "Gate",
          mapPosition: { x: 1, y: 2 },
          isPrimary: true,
        },
      ],
      [{ count: 1 }],
      [{ restaurantId: "restaurant-1", count: 5 }],
      [{ restaurantId: "restaurant-1", count: 2 }],
    ]);

    await expect(
      service.listVendors("night-market", {
        lat: 25,
        lng: 121,
        radiusKm: 2,
        sortBy: "distance",
        openNow: true,
      }),
    ).resolves.toMatchObject({
      total: 1,
      vendors: [
        {
          restaurantId: "restaurant-1",
          isOpen: true,
          distanceKm: 0,
          detailUrl: "/api/v1/restaurants/restaurant-1",
          menuUrl: "/api/v1/menu/restaurant-1",
          serviceItemsUrl: "/api/v1/restaurants/restaurant-1/service-items",
          availableMenuItemCount: 5,
          publicServiceItemCount: 2,
        },
      ],
    });
    expect(mocks.cache.set).toHaveBeenCalledWith(
      expect.stringContaining("markets:v5:vendors:"),
      expect.objectContaining({ total: 1 }),
      expect.any(Number),
    );
  });

  it("creates, updates, soft-deletes markets and manages vendor membership cache versions", async () => {
    const { service, values } = createService("10");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const mutations = mockMutationResults([
      [{ id: "market-1", slug: "created" }],
      [{ id: "market-1", name: "Updated" }],
      [{ id: 1, marketId: "market-1", restaurantId: "restaurant-1" }],
      [{ id: 1, leftAt: new Date("2026-06-07T00:00:00.000Z") }],
    ]);
    mockSelectResults([
      [{ id: "market-1", deletedAt: null }],
      [{ id: "market-1", deletedAt: null }],
      [{ id: "market-1", deletedAt: null }],
      [],
    ]);

    await expect(
      service.createMarket({
        id: "market-1",
        slug: "created",
        name: "Created",
      } as any),
    ).resolves.toEqual({ id: "market-1", slug: "created" });
    await expect(
      service.updateMarket("market-1", { name: "Updated" } as any),
    ).resolves.toEqual({ id: "market-1", name: "Updated" });
    await expect(service.softDeleteMarket("market-1")).resolves.toBe(true);
    await expect(
      service.addVendor("market-1", {
        restaurantId: "restaurant-1",
        stallNumber: "A1",
        isPrimary: true,
      }),
    ).resolves.toMatchObject({
      id: 1,
      marketId: "market-1",
      restaurantId: "restaurant-1",
    });
    await expect(
      service.removeVendor("market-1", "restaurant-1"),
    ).resolves.toBe(true);

    expect(mutations.inserted[0]).toMatchObject({
      id: "market-1",
      isActive: true,
      createdAt: new Date("2026-06-07T00:00:00.000Z"),
    });
    expect(mutations.updated).toEqual([
      expect.objectContaining({ name: "Updated" }),
      expect.objectContaining({ isActive: false }),
      { isPrimary: false },
      expect.objectContaining({ leftAt: expect.any(Date) }),
    ]);
    expect(values.get("markets:version")).toBe("15");
    vi.useRealTimers();
  });
});
