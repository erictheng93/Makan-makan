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
    get: vi.fn(async () => (Array.isArray(result) ? result[0] : result)),
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

  it("returns cached public area and vendor data without querying", async () => {
    const cachedAreas = { areas: [{ city: "Taipei", districts: ["Central"] }] };
    const cachedVendors = {
      vendors: [{ restaurantId: "restaurant-1", name: "Vendor" }],
      total: 1,
      page: 1,
      limit: 20,
    };
    mocks.cache.get
      .mockResolvedValueOnce(cachedAreas)
      .mockResolvedValueOnce(cachedVendors);
    const { service } = createService("7");
    const queryAreasSpy = vi.spyOn(service as any, "queryAreas");
    const queryVendorsSpy = vi.spyOn(service as any, "queryVendors");

    await expect(service.listAreas()).resolves.toBe(cachedAreas);
    await expect(
      service.listVendors("night-market", { q: "vendor" }),
    ).resolves.toBe(cachedVendors);

    expect(mocks.cache.get).toHaveBeenCalledWith("markets:v7:areas:all");
    expect(mocks.cache.get).toHaveBeenCalledWith(
      'markets:v7:vendors:{"q":"vendor","slug":"night-market"}',
    );
    expect(queryAreasSpy).not.toHaveBeenCalled();
    expect(queryVendorsSpy).not.toHaveBeenCalled();
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

  it("sorts tied area readiness by city and district without readiness scores", async () => {
    const { service } = createService();
    vi.spyOn(service as any, "queryMarkets").mockResolvedValue({
      markets: [
        {
          city: "Taipei",
          district: "West",
          vendorCount: 1,
          catalogCoverage: {
            searchableProductCount: 0,
            publicServiceCount: 1,
            vendorsMissingSearchableProducts: undefined,
            vendorsMissingPublicServices: undefined,
          },
        },
        {
          city: "Taipei",
          district: "East",
          vendorCount: 1,
          catalogCoverage: {
            searchableProductCount: 1,
            publicServiceCount: 0,
            vendorsMissingSearchableProducts: 0,
            vendorsMissingPublicServices: 0,
          },
        },
        {
          city: "Kaohsiung",
          district: "North",
          vendorCount: 1,
          catalogCoverage: {
            searchableProductCount: 1,
            publicServiceCount: 0,
            vendorsMissingSearchableProducts: 0,
            vendorsMissingPublicServices: 0,
          },
        },
      ],
    });

    await expect(service.listAreaReadiness()).resolves.toEqual({
      areas: [
        expect.objectContaining({
          city: "Kaohsiung",
          district: "North",
          totalCatalogGapVendors: 0,
          averageReadinessScore: 0,
        }),
        expect.objectContaining({
          city: "Taipei",
          district: "East",
          totalCatalogGapVendors: 0,
          averageReadinessScore: 0,
        }),
        expect.objectContaining({
          city: "Taipei",
          district: "West",
          totalCatalogGapVendors: 0,
          averageReadinessScore: 0,
        }),
      ],
    });
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

  it("computes public readiness for an existing market", async () => {
    const { service } = createService();
    vi.spyOn(service, "getMarketById").mockResolvedValue({
      id: "market-1",
      description: "Night market",
      city: "Taipei",
      district: "Central",
      address: "Main Street",
      latitude: 25,
      longitude: 121,
      openingHours: {
        monday: { open: "10:00", close: "22:00", closed: false },
      },
      bannerUrl: "https://example.test/banner.jpg",
      logoUrl: null,
      imageUrls: [],
      mapLayout: { title: "Map" },
    } as any);
    vi.spyOn(service as any, "countCatalogCoverage").mockResolvedValue({
      searchableProductCount: 4,
      publicServiceCount: 1,
    });
    mockSelectResults([[{ count: 2 }]]);

    await expect(
      service.getPublicReadiness("market-1", { additionalVendorCount: 1 }),
    ).resolves.toMatchObject({
      ready: true,
      completedCount: 8,
      totalCount: 8,
      issues: [],
    });
    expect((service as any).countCatalogCoverage).toHaveBeenCalledWith(
      "market-1",
    );
  });

  it("builds catalog readiness gaps for empty and mixed vendor coverage", async () => {
    const { service } = createService();
    vi.spyOn(service as any, "countCatalogCoverage")
      .mockResolvedValueOnce({
        searchableProductCount: 0,
        publicServiceCount: 0,
        bookingRequiredServiceCount: 0,
        bookingUrlMissingServiceCount: 0,
      })
      .mockResolvedValueOnce({
        searchableProductCount: 5,
        publicServiceCount: 2,
        bookingRequiredServiceCount: 1,
        bookingUrlMissingServiceCount: 1,
      });

    mockSelectResults([[]]);
    await expect(
      (service as any).catalogCoverageWithVendorBreakdown("empty-market"),
    ).resolves.toMatchObject({
      vendorsWithSearchableProducts: 0,
      vendorsMissingSearchableProducts: 0,
      missingProductVendors: [],
      missingSearchEntrypointVendors: [],
    });

    (service as any).d1 = createD1(
      [],
      [[{ restaurantId: "restaurant-2" }], [{ restaurantId: "restaurant-3" }]],
    );
    mockSelectResults([
      [
        {
          restaurantId: "restaurant-1",
          name: "Vendor A",
          stallNumber: "A1",
          locationLabel: "Gate",
          mapPosition: { x: 1, y: 2 },
        },
        {
          restaurantId: "restaurant-2",
          name: "Vendor B",
          stallNumber: " ",
          locationLabel: null,
          mapPosition: null,
        },
        {
          restaurantId: "restaurant-3",
          name: "Vendor C",
          stallNumber: "C1",
          locationLabel: "Lane",
          mapPosition: { x: "bad" },
        },
      ],
      [{ restaurantId: "restaurant-1" }],
    ]);

    await expect(
      (service as any).catalogCoverageWithVendorBreakdown("market-1"),
    ).resolves.toMatchObject({
      searchableProductCount: 5,
      publicServiceCount: 2,
      vendorsWithSearchableProducts: 1,
      vendorsMissingSearchableProducts: 2,
      vendorsWithPublicServices: 1,
      vendorsMissingPublicServices: 2,
      vendorsMissingBookingUrls: 1,
      vendorsMissingStallNumbers: 1,
      vendorsMissingMapPositions: 2,
      vendorsMissingSearchEntrypoints: 1,
      missingProductVendors: [
        expect.objectContaining({ restaurantId: "restaurant-2" }),
        expect.objectContaining({ restaurantId: "restaurant-3" }),
      ],
      missingBookingUrlVendors: [
        expect.objectContaining({ restaurantId: "restaurant-3" }),
      ],
      missingSearchEntrypointVendors: [
        expect.objectContaining({ restaurantId: "restaurant-3" }),
      ],
    });
  });

  it("returns null vendors for missing or not-public-ready markets", async () => {
    mocks.cache.get.mockResolvedValue(null);
    const { service } = createService();
    vi.spyOn(service, "getMarketBySlug")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        market: { id: "market-1" },
        publicReadiness: { ready: false },
      } as any);

    await expect(service.listVendors("missing", {})).resolves.toBeNull();
    await expect(service.listVendors("draft-market", {})).resolves.toBeNull();
    expect(mocks.cache.set).not.toHaveBeenCalled();
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

  it("handles default and non-numeric public cache versions", async () => {
    const serviceWithoutKV = new MarketsService({} as D1Database);

    await expect(
      (serviceWithoutKV as any).publicCacheKey("areas", null),
    ).resolves.toBe("markets:v1:areas:null");
    await expect(
      (serviceWithoutKV as any).bumpPublicCacheVersion(),
    ).resolves.toBeUndefined();

    const { service, values } = createService("invalid");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_785_456_000_000);

    await (service as any).bumpPublicCacheVersion();

    expect(values.get("markets:version")).toBe("1785456000000");
    nowSpy.mockRestore();
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

  it("updates existing vendor memberships with existing values as fallbacks", async () => {
    const { service, values } = createService("30");
    const existingMembership = {
      id: 9,
      marketId: "market-1",
      restaurantId: "restaurant-1",
      stallNumber: "B2",
      locationLabel: "Corner",
      mapPosition: { x: 1, y: 2 },
      marketHours: { monday: { open: "09:00", close: "17:00" } },
      isPrimary: true,
    };
    const mutations = mockMutationResults([[]]);
    mockSelectResults([
      [{ id: "market-1", deletedAt: null }],
      [existingMembership],
    ]);

    await expect(
      service.addVendor("market-1", {
        restaurantId: "restaurant-1",
      }),
    ).resolves.toEqual(existingMembership);

    expect(mutations.updated).toEqual([
      {
        stallNumber: "B2",
        locationLabel: "Corner",
        mapPosition: { x: 1, y: 2 },
        marketHours: { monday: { open: "09:00", close: "17:00" } },
        isPrimary: true,
      },
    ]);
    expect(values.get("markets:version")).toBe("31");
  });

  it("handles missing vendor membership targets and insert defaults", async () => {
    const { service, values } = createService("40");
    const mutations = mockMutationResults([
      [{ id: 12, marketId: "market-1", restaurantId: "restaurant-2" }],
      [],
    ]);
    mockSelectResults([
      [],
      [{ id: "deleted-market", deletedAt: new Date("2026-06-07T00:00:00Z") }],
      [{ id: "market-1", deletedAt: null }],
      [],
    ]);

    await expect(
      service.addVendor("missing-market", {
        restaurantId: "restaurant-1",
      }),
    ).resolves.toBeNull();
    await expect(
      service.addVendor("deleted-market", {
        restaurantId: "restaurant-1",
      }),
    ).resolves.toBeNull();
    await expect(
      service.addVendor("market-1", {
        restaurantId: "restaurant-2",
      }),
    ).resolves.toEqual({
      id: 12,
      marketId: "market-1",
      restaurantId: "restaurant-2",
    });
    await expect(
      service.removeVendor("market-1", "restaurant-3"),
    ).resolves.toBe(false);

    expect(mutations.inserted).toEqual([
      expect.objectContaining({
        marketId: "market-1",
        restaurantId: "restaurant-2",
        stallNumber: null,
        locationLabel: null,
        mapPosition: null,
        marketHours: null,
        isPrimary: false,
      }),
    ]);
    expect(mutations.updated).toEqual([
      expect.objectContaining({ leftAt: expect.any(Date) }),
    ]);
    expect(values.get("markets:version")).toBe("41");
  });

  it("lists sitemap entries, uncached areas, nearby markets, and direct market lookup", async () => {
    mocks.cache.get.mockResolvedValue(null);
    const { service } = createService("6");
    (service as any).d1 = createD1([
      { count: 1 },
      {
        booking_required_service_count: 0,
        booking_url_missing_service_count: 0,
      },
    ]);
    const market = {
      id: "market-1",
      slug: "night-market",
      name: "Night Market",
      city: "Taipei",
      district: "Central",
      latitude: 25,
      longitude: 121,
      updatedAt: new Date("2026-06-07T00:00:00.000Z"),
    };
    mockSelectResults([
      [{ slug: "night-market", updatedAt: market.updatedAt }],
      [
        { city: "Taipei", district: "Central" },
        { city: "Taipei", district: "East" },
        { city: "Kaohsiung", district: "West" },
      ],
      [market],
      [{ count: 2 }],
      [market],
    ]);

    await expect(service.listSitemapEntries(3)).resolves.toEqual([
      { slug: "night-market", updatedAt: market.updatedAt },
    ]);
    await expect(service.listAreas()).resolves.toEqual({
      areas: [
        { city: "Taipei", districts: ["Central", "East"] },
        { city: "Kaohsiung", districts: ["West"] },
      ],
    });
    await expect(service.findNearby(25, 121, 1, 5)).resolves.toEqual({
      markets: [
        expect.objectContaining({
          id: "market-1",
          distanceKm: 0,
          catalogCoverage: expect.objectContaining({
            searchableProductCount: 2,
            publicServiceCount: 1,
          }),
        }),
      ],
    });
    await expect(service.getMarketById("market-1")).resolves.toEqual(market);

    expect(mocks.cache.set).toHaveBeenCalledWith(
      "markets:v6:areas:all",
      expect.objectContaining({ areas: expect.any(Array) }),
      expect.any(Number),
    );
  });

  it("maps restaurant memberships, restaurant join requests, admin requests, and vendor candidates", async () => {
    const { service } = createService();
    mockSelectResults([
      [
        {
          id: 1,
          restaurantId: "restaurant-1",
          marketId: "market-1",
          stallNumber: "A1",
          locationLabel: "Gate",
          mapPosition: { x: 1, y: 2 },
          marketHours: { monday: { open: "10:00", close: "18:00" } },
          isPrimary: true,
          joinedAt: new Date("2026-06-07T00:00:00.000Z"),
          marketSlug: "night-market",
          marketName: "Night Market",
          marketType: "night_market",
          city: "Taipei",
          district: "Central",
        },
      ],
      [
        {
          id: 2,
          restaurantId: "restaurant-1",
          marketId: "market-1",
          status: "pending",
          message: "Please add us",
          requestedAt: new Date("2026-06-07T00:00:00.000Z"),
          resolvedAt: null,
          marketSlug: "night-market",
          marketName: "Night Market",
          marketType: "night_market",
          city: "Taipei",
          district: "Central",
        },
      ],
      [
        {
          id: 3,
          restaurantId: "restaurant-1",
          marketId: "market-1",
          status: "approved",
          message: null,
          requestedAt: new Date("2026-06-07T00:00:00.000Z"),
          resolvedAt: new Date("2026-06-08T00:00:00.000Z"),
          marketSlug: "night-market",
          marketName: "Night Market",
          marketType: "night_market",
          city: "Taipei",
          district: "Central",
          restaurantName: "Makan",
          restaurantDistrict: "Central",
          restaurantCity: "Taipei",
        },
      ],
      [
        {
          id: "restaurant-2",
          name: "Candidate",
          city: "Taipei",
          district: "East",
          address: "Street",
          type: "malaysian",
          category: "casual",
          isAvailable: true,
          supportsTakeaway: true,
          supportsDelivery: false,
        },
      ],
    ]);

    await expect(
      service.listRestaurantMemberships("restaurant-1"),
    ).resolves.toEqual({
      memberships: [
        expect.objectContaining({
          id: 1,
          market: expect.objectContaining({
            id: "market-1",
            slug: "night-market",
          }),
        }),
      ],
    });
    await expect(
      service.listRestaurantJoinRequests("restaurant-1"),
    ).resolves.toEqual({
      requests: [
        expect.objectContaining({
          id: 2,
          market: expect.objectContaining({ name: "Night Market" }),
        }),
      ],
    });
    await expect(
      service.listJoinRequests({ status: "approved" }),
    ).resolves.toEqual({
      requests: [
        expect.objectContaining({
          id: 3,
          restaurant: {
            id: "restaurant-1",
            name: "Makan",
            city: "Taipei",
            district: "Central",
          },
        }),
      ],
    });
    await expect(
      service.listVendorCandidates({
        q: "candidate",
        marketId: "market-1",
        limit: 5,
      }),
    ).resolves.toEqual({
      restaurants: [expect.objectContaining({ id: "restaurant-2" })],
      total: 1,
    });
  });

  it("lists admin requests and vendor candidates with default filters", async () => {
    const { service } = createService();
    mockSelectResults([
      [
        {
          id: 4,
          restaurantId: "restaurant-3",
          marketId: "market-2",
          status: "pending",
          message: "Interested",
          requestedAt: new Date("2026-06-07T00:00:00.000Z"),
          resolvedAt: null,
          marketSlug: "morning-market",
          marketName: "Morning Market",
          marketType: "traditional_market",
          city: "Kaohsiung",
          district: "North",
          restaurantName: "Candidate",
          restaurantDistrict: "North",
          restaurantCity: "Kaohsiung",
        },
      ],
      [
        {
          id: "restaurant-4",
          name: "Default Candidate",
          city: "Kaohsiung",
          district: "North",
          address: "Market Road",
          type: "taiwanese",
          category: "casual",
          isAvailable: true,
          supportsTakeaway: false,
          supportsDelivery: true,
        },
      ],
    ]);

    await expect(service.listJoinRequests()).resolves.toEqual({
      requests: [
        expect.objectContaining({
          id: 4,
          status: "pending",
          market: expect.objectContaining({ slug: "morning-market" }),
        }),
      ],
    });
    await expect(service.listVendorCandidates({ q: "   " })).resolves.toEqual({
      restaurants: [expect.objectContaining({ id: "restaurant-4" })],
      total: 1,
    });
  });

  it("handles join request creation states and approval/rejection branches", async () => {
    const { service, values } = createService("20");
    const market = {
      id: "market-1",
      slug: "night-market",
      isActive: true,
      deletedAt: null,
    };

    mockSelectResults([[market], [{ id: 10 }]]);
    await expect(
      service.createJoinRequest("restaurant-1", {
        marketSlug: "night-market",
      }),
    ).resolves.toEqual({ status: "already_member" });

    mockSelectResults([[market], [], [{ id: 11 }]]);
    await expect(
      service.createJoinRequest("restaurant-1", {
        marketId: "market-1",
      }),
    ).resolves.toEqual({ status: "already_pending" });

    mockSelectResults([[market], [], []]);
    mockMutationResults([[{ id: 12, status: "pending" }]]);
    await expect(
      service.createJoinRequest("restaurant-1", {
        marketId: "market-1",
        message: "Please add us",
      }),
    ).resolves.toEqual({
      status: "created",
      request: { id: 12, status: "pending" },
    });

    mockSelectResults([[]]);
    await expect(service.approveJoinRequest(99)).resolves.toEqual({
      status: "not_found",
    });

    mockSelectResults([[{ id: 2, status: "approved" }]]);
    await expect(service.rejectJoinRequest(2)).resolves.toEqual({
      status: "not_pending",
    });

    mockSelectResults([
      [
        {
          id: 3,
          status: "pending",
          marketId: "market-1",
          restaurantId: "restaurant-1",
        },
      ],
      [market],
      [],
    ]);
    mockMutationResults([
      [{ id: 1, marketId: "market-1", restaurantId: "restaurant-1" }],
      [{ id: 3, status: "approved" }],
    ]);
    await expect(
      service.approveJoinRequest(3, { stallNumber: "A1", isPrimary: true }),
    ).resolves.toMatchObject({
      status: "approved",
      request: { id: 3, status: "approved" },
      membership: { id: 1 },
    });

    mockSelectResults([[{ id: 4, status: "pending" }]]);
    mockMutationResults([[{ id: 4, status: "rejected" }]]);
    await expect(service.rejectJoinRequest(4)).resolves.toEqual({
      status: "rejected",
      request: { id: 4, status: "rejected" },
    });
    expect(Number(values.get("markets:version"))).toBeGreaterThan(20);
  });
});
