import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

import { createDiscoveryRead, DiscoveryService } from "./DiscoveryService";

function createKV(initial: Record<string, unknown> = {}) {
  const values = new Map<string, string>(
    Object.entries(initial).map(([key, value]) => [
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    ]),
  );

  return {
    values,
    kv: {
      get: vi.fn(async (key: string) => values.get(key) ?? null),
      put: vi.fn(
        async (
          key: string,
          value: string,
          _options?: { expirationTtl?: number },
        ) => {
          values.set(key, value);
        },
      ),
    } as any,
  };
}

function createService(initialKV: Record<string, unknown> = {}) {
  const { kv, values } = createKV(initialKV);
  const service = new DiscoveryService({} as D1Database, kv, undefined, {
    searchDishIdsWithStatus: vi.fn(),
    warmQueryEmbedding: vi.fn(),
    upsertDishes: vi.fn(),
  } as any);

  return { service, kv, values };
}

describe("DiscoveryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cached dish searches with stored scope metadata", async () => {
    const cached = {
      results: [
        {
          menuItemId: 1,
          dishName: "Nasi Lemak",
          price: 80,
          priceCents: 8000,
          restaurantId: "restaurant-1",
          restaurantName: "Makan",
        },
      ],
      total: 1,
      scope: {
        market: {
          marketId: "market-1",
          hasSearchableCatalog: true,
          searchableProductCount: 1,
          publicServiceCount: 0,
        },
      },
    };
    const { service, kv } = createService({
      "search:query:version": "3",
      "search:query:v:3:nasilemak:m:market-1:p:2:l:5": cached,
    });

    await expect(
      service.searchDishes({
        q: " Nasi  Lemak ",
        marketId: "market-1",
        page: 2,
        limit: 5,
      }),
    ).resolves.toEqual({
      results: cached.results,
      total: 1,
      page: 2,
      limit: 5,
      scope: cached.scope,
    });
    expect(kv.get).toHaveBeenCalledWith("search:query:version", "text");
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  it("returns cached category and district restaurant browse results", async () => {
    const restaurant = {
      restaurantId: "restaurant-1",
      name: "Makan",
      type: "malaysian",
      category: "casual",
      district: "Central",
      city: "Taipei",
      priceRange: 2,
      rating: 4.5,
      isOpen: true,
      supportsTakeaway: true,
      supportsDelivery: false,
      imageUrl: null,
      detailUrl: "/api/v1/restaurants/restaurant-1",
      menuUrl: "/api/v1/menu/restaurant-1",
      serviceItemsUrl: "/api/v1/restaurants/restaurant-1/service-items",
      availableMenuItemCount: 3,
      publicServiceItemCount: 1,
    };
    const { service, kv } = createService({
      "search:query:version": "7",
      "search:categories:v:7:d:Central:ta:p:1:l:20": {
        categories: ["Rice", "Noodles"],
      },
      "search:restaurants:district:Central": [
        restaurant,
        {
          ...restaurant,
          restaurantId: "restaurant-2",
          supportsTakeaway: false,
        },
      ],
    });

    await expect(
      service.listDishCategories({ district: "Central", takeaway: true }),
    ).resolves.toEqual({ categories: ["Rice", "Noodles"] });
    await expect(
      service.browseRestaurants({
        district: "Central",
        takeaway: true,
        page: 1,
        limit: 1,
      }),
    ).resolves.toEqual({
      results: [restaurant],
      total: 1,
      page: 1,
      limit: 1,
    });

    expect(kv.get).toHaveBeenCalledWith("search:restaurants:district:Central");
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  it("builds stable helper values for URLs, cache keys, geo, and sorting", () => {
    const { service } = createService();
    const helpers = service as any;

    expect(helpers.normalizeQuery(" Nasi   Lemak ")).toBe("nasilemak");
    expect(helpers.restaurantDetailUrl("restaurant-1")).toBe(
      "/api/v1/restaurants/restaurant-1",
    );
    expect(helpers.restaurantMenuUrl("restaurant-1")).toBe(
      "/api/v1/menu/restaurant-1",
    );
    expect(helpers.restaurantServiceItemsUrl("restaurant-1")).toBe(
      "/api/v1/restaurants/restaurant-1/service-items",
    );
    expect(helpers.menuItemUrl(42)).toBe("/api/v1/menu/items/42");
    expect(helpers.marketDetailUrl("night-market")).toBe(
      "/markets/night-market",
    );
    expect(
      helpers.buildCacheKey(
        "search:query",
        {
          q: "Tea Set",
          city: "Taipei",
          district: "Central",
          catalogType: "product",
          categoryName: "Drinks",
          sortBy: "distance",
          priceMin: 50,
          priceMax: 100,
          openNow: true,
          takeaway: true,
          delivery: true,
          marketId: "market-1",
          lat: 25,
          lng: 121,
          radiusKm: 20,
          page: 3,
          limit: 10,
        },
        "9",
      ),
    ).toBe(
      "search:query:v:9:teaset:c:Taipei:d:Central:ct:product:" +
        "cat:Drinks:s:distance:pmin:50:pmax:100:open:ta:dl:" +
        "m:market-1:geo:25,121,20:p:3:l:10",
    );

    expect(helpers.getServiceIntent("takeaway")).toBe("takeaway");
    expect(helpers.getServiceIntent("deliver")).toBe("delivery");
    expect(helpers.getServiceIntent("dine in")).toBeNull();
    expect(helpers.getServiceTypeIntent("booking")).toBe("booking");
    expect(helpers.getServiceQueryAliases("massage")).toEqual(["massage"]);
    expect(helpers.getCatalogQueryAliases("dessert")).toEqual(["dessert"]);

    const geo = helpers.getGeoFilter({ lat: 25, lng: 121, radiusKm: 50 });
    expect(geo).toMatchObject({ lat: 25, lng: 121, radiusKm: 10 });
    expect(
      helpers.resultDistanceKm(geo, { latitude: 25, longitude: 121 }),
    ).toBe(0);
    expect(helpers.getGeoFilter({ lat: 25 })).toBeNull();
    expect(
      helpers.sortDistanceResultsFirst([
        { id: "no-distance" },
        { id: "far", distanceKm: 3 },
        { id: "near", distanceKm: 1 },
      ]),
    ).toEqual([
      { id: "near", distanceKm: 1 },
      { id: "far", distanceKm: 3 },
      { id: "no-distance" },
    ]);
    expect(
      helpers.sortOpenResultsFirst([
        { id: "closed", isOpen: false },
        { id: "open", isOpen: true },
      ]),
    ).toEqual([
      { id: "open", isOpen: true },
      { id: "closed", isOpen: false },
    ]);
  });

  it("formats market vendor context and semantic dish text", () => {
    const { service } = createService();
    const helpers = service as any;

    expect(
      helpers.marketVendorContext({
        marketVendorMarketId: "market-1",
        marketVendorStallNumber: "A12",
        marketVendorLocationLabel: "Food court",
        marketVendorIsPrimary: 1,
        marketVendorMarketSlug: "night-market",
        marketVendorMarketName: "Night Market",
      }),
    ).toEqual({
      marketId: "market-1",
      marketSlug: "night-market",
      marketName: "Night Market",
      marketUrl: "/markets/night-market",
      stallNumber: "A12",
      locationLabel: "Food court",
      isPrimary: true,
    });
    expect(
      helpers.marketVendorContext({
        marketVendorMarketId: null,
        marketVendorStallNumber: null,
        marketVendorLocationLabel: null,
        marketVendorIsPrimary: null,
        marketVendorMarketSlug: null,
        marketVendorMarketName: null,
      }),
    ).toBeUndefined();
    expect(
      helpers.semanticDishText({
        dishName: "Nasi Lemak",
        categoryName: "Rice",
        tags: [" coconut ", "", "spicy"],
      }),
    ).toBe("Nasi Lemak Rice  coconut  spicy");
  });

  it("creates read services with a D1 session constraint", () => {
    const sessionDb = {};
    const env = {
      DB: {
        withSession: vi.fn(() => sessionDb),
      },
      CACHE_KV: createKV().kv,
      AI: {},
      DISCOVERY_VECTORIZE: {},
      DISCOVERY_EMBEDDING_MODEL: "model",
    };

    expect(createDiscoveryRead(env as any)).toBeInstanceOf(DiscoveryService);
    expect(env.DB.withSession).toHaveBeenCalledWith("first-unconstrained");
  });
});
