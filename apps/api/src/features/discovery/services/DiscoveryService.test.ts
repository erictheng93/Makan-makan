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

function createQuery(result: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    leftJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    groupBy: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    offset: vi.fn(() => builder),
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

function createD1() {
  const boundStatements: unknown[] = [];
  const d1 = {
    boundStatements,
    prepare: vi.fn((sql: string) => ({
      sql,
      bind: vi.fn((...args: unknown[]) => {
        const statement = { sql, args };
        boundStatements.push(statement);
        return statement;
      }),
      first: vi.fn(async () => ({
        source_available_dish_count: 8,
        unindexed_available_dish_count: 2,
        restaurants_with_unindexed_available_dishes: 1,
      })),
    })),
    batch: vi.fn(async () => []),
    withSession: vi.fn(() => d1),
  };
  return d1 as any;
}

function openAllWeek() {
  return {
    sunday: { open: "00:00", close: "23:59", closed: false },
    monday: { open: "00:00", close: "23:59", closed: false },
    tuesday: { open: "00:00", close: "23:59", closed: false },
    wednesday: { open: "00:00", close: "23:59", closed: false },
    thursday: { open: "00:00", close: "23:59", closed: false },
    friday: { open: "00:00", close: "23:59", closed: false },
    saturday: { open: "00:00", close: "23:59", closed: false },
  };
}

function closedAllWeek() {
  return {
    sunday: { open: "00:00", close: "23:59", closed: true },
    monday: { open: "00:00", close: "23:59", closed: true },
    tuesday: { open: "00:00", close: "23:59", closed: true },
    wednesday: { open: "00:00", close: "23:59", closed: true },
    thursday: { open: "00:00", close: "23:59", closed: true },
    friday: { open: "00:00", close: "23:59", closed: true },
    saturday: { open: "00:00", close: "23:59", closed: true },
  };
}

describe("DiscoveryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.select.mockReset();
    mocks.db.delete.mockReset();
    mocks.db.delete.mockImplementation(() => ({
      where: vi.fn(async () => undefined),
    }));
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

  it("filters cached district restaurants by delivery and price range", async () => {
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
      supportsDelivery: true,
      imageUrl: null,
      detailUrl: "/api/v1/restaurants/restaurant-1",
      menuUrl: "/api/v1/menu/restaurant-1",
      serviceItemsUrl: "/api/v1/restaurants/restaurant-1/service-items",
      availableMenuItemCount: 3,
      publicServiceItemCount: 1,
    };
    const { service } = createService({
      "search:restaurants:district:Central": [
        restaurant,
        {
          ...restaurant,
          restaurantId: "restaurant-2",
          supportsDelivery: false,
        },
        {
          ...restaurant,
          restaurantId: "restaurant-3",
          priceRange: 3,
        },
      ],
    });

    await expect(
      service.browseRestaurants({
        district: "Central",
        delivery: true,
        priceRange: 2,
      }),
    ).resolves.toMatchObject({
      total: 1,
      results: [{ restaurantId: "restaurant-1" }],
    });
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
    expect(
      helpers.buildCacheKey("search:query", { priceMin: 0, priceMax: 0 }, "9"),
    ).toBe("search:query:v:9:p:1:l:20");

    expect(helpers.getServiceIntent("takeaway")).toBe("takeaway");
    expect(helpers.getServiceIntent("deliver")).toBe("delivery");
    expect(helpers.getServiceIntent("dine in")).toBeNull();
    expect(helpers.getServiceTypeIntent("booking")).toBe("booking");
    expect(helpers.getServiceQueryAliases("massage")).toEqual(["massage"]);
    expect(helpers.getCatalogQueryAliases("dessert")).toEqual(["dessert"]);
    expect(helpers.ftsMatchCondition("ab")).toBeUndefined();
    expect(helpers.ftsMatchCondition('hot "pot"')).toBeTruthy();
    expect(
      helpers.getDishSearchOrderBy({ sortBy: "popular" }, {}, null),
    ).toHaveLength(2);
    expect(
      helpers.getDishSearchOrderBy({ sortBy: "price_desc" }, {}, null),
    ).toHaveLength(1);
    expect(
      helpers.getDishSearchOrderBy({ q: "Laksa" }, {}, "laksa", [1]),
    ).toHaveLength(2);
    expect(
      helpers.getDishSearchOrderBy({ q: "Laksa" }, {}, "laksa"),
    ).toHaveLength(2);
    expect(
      helpers.getServiceSearchOrderBy({ sortBy: "price_desc" }),
    ).toHaveLength(4);
    expect(
      helpers.getServiceSearchOrderBy({ sortBy: "price_asc" }),
    ).toHaveLength(4);
    expect(helpers.getServiceSearchOrderBy({})).toHaveLength(2);
    expect(helpers.getServiceSearchOrderBy({ q: "booking" })).toHaveLength(3);
    expect(helpers.getServiceSearchOrderBy({ q: "massage" })).toHaveLength(3);

    const geo = helpers.getGeoFilter({ lat: 25, lng: 121, radiusKm: 50 });
    expect(geo).toMatchObject({ lat: 25, lng: 121, radiusKm: 10 });
    expect(
      helpers.resultDistanceKm(geo, { latitude: 25, longitude: 121 }),
    ).toBe(0);
    expect(helpers.getGeoFilter({ lat: 25 })).toBeNull();
    expect(
      helpers.getGeoFilter({ lat: 25, lng: 121, radiusKm: 0 }),
    ).toMatchObject({ radiusKm: 0.1 });
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
        marketVendorMarketId: "market-1",
        marketVendorStallNumber: null,
        marketVendorLocationLabel: null,
        marketVendorIsPrimary: 0,
        marketVendorMarketSlug: null,
        marketVendorMarketName: null,
      }),
    ).toEqual({
      marketId: "market-1",
      marketSlug: null,
      marketName: null,
      marketUrl: null,
      stallNumber: null,
      locationLabel: null,
      isPrimary: false,
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

  it("maps uncached dish search rows, tag-index matches, and writes the cache", async () => {
    const semanticSearch = {
      searchDishIdsWithStatus: vi.fn(async () => ({
        matches: [{ menuItemId: 3 }],
        embeddingStatus: "hit" as const,
      })),
      warmQueryEmbedding: vi.fn(),
      upsertDishes: vi.fn(),
    };
    const { kv, values } = createKV({
      "search:query:version": "11",
      "search:tags:index": {
        laksa: [{ menuItemId: 2 }],
      },
    });
    const service = new DiscoveryService(
      {} as D1Database,
      kv,
      undefined,
      semanticSearch as any,
    );
    const prefixRow = {
      menuItemId: 1,
      dishName: "Laksa",
      price: 99,
      priceCents: 1250,
      catalogType: "menu_item",
      categoryName: "Noodles",
      restaurantId: "restaurant-1",
      restaurantName: "Makan",
      district: "Central",
      businessHours: null,
      supportsTakeaway: true,
      supportsDelivery: false,
      tags: ["spicy"],
      latitude: null,
      longitude: null,
      marketVendorMarketId: null,
      marketVendorStallNumber: null,
      marketVendorLocationLabel: null,
      marketVendorIsPrimary: null,
      marketVendorMarketSlug: null,
      marketVendorMarketName: null,
    };
    mockSelectResults([
      [prefixRow],
      [{ count: 1 }],
      [{ ...prefixRow, menuItemId: 2, dishName: "Curry Laksa" }],
    ]);

    await expect(
      service.searchDishes({ q: "Laksa", page: 1, limit: 10 }),
    ).resolves.toMatchObject({
      total: 2,
      page: 1,
      limit: 10,
      results: [
        {
          menuItemId: 1,
          dishName: "Laksa",
          price: 12.5,
          detailUrl: "/api/v1/restaurants/restaurant-1",
          menuItemUrl: "/api/v1/menu/items/1",
        },
        {
          menuItemId: 2,
          dishName: "Curry Laksa",
          price: 12.5,
        },
      ],
    });
    expect(semanticSearch.searchDishIdsWithStatus).toHaveBeenCalledWith(
      "Laksa",
      expect.objectContaining({ namespace: "dishes" }),
    );
    expect(
      JSON.parse(values.get("search:query:v:11:laksa:p:1:l:10") ?? "{}"),
    ).toMatchObject({ total: 2 });
  });

  it("applies dish search service intent filters without semantic lookup", async () => {
    const semanticSearch = {
      searchDishIdsWithStatus: vi.fn(),
      warmQueryEmbedding: vi.fn(),
      upsertDishes: vi.fn(),
    };
    const { kv, values } = createKV({ "search:query:version": "13" });
    const service = new DiscoveryService(
      {} as D1Database,
      kv,
      undefined,
      semanticSearch as any,
    );
    mockSelectResults([
      [
        {
          menuItemId: 4,
          dishName: "Pickup Tea",
          price: 40,
          priceCents: null,
          catalogType: "product",
          categoryName: "Drinks",
          restaurantId: "restaurant-4",
          restaurantName: "Tea Stand",
          district: "East",
          businessHours: null,
          supportsTakeaway: true,
          supportsDelivery: false,
          tags: null,
          latitude: null,
          longitude: null,
          marketVendorMarketId: "market-1",
          marketVendorStallNumber: null,
          marketVendorLocationLabel: null,
          marketVendorIsPrimary: false,
          marketVendorMarketSlug: null,
          marketVendorMarketName: null,
        },
      ],
      [{ count: Number.NaN }],
      [{ count: undefined }],
      [],
    ]);

    await expect(
      service.searchDishes({
        q: "takeaway",
        city: "Taipei",
        district: "East",
        categoryName: "Drinks",
        catalogType: "product",
        priceMin: 1,
        priceMax: 99,
        marketId: "market-1",
        page: 2,
        limit: 5,
      }),
    ).resolves.toMatchObject({
      total: 1,
      page: 2,
      limit: 5,
      results: [
        {
          menuItemId: 4,
          price: 40,
          supportsTakeaway: true,
          marketVendor: { marketId: "market-1", marketUrl: null },
        },
      ],
      scope: {
        market: {
          marketId: "market-1",
          searchableProductCount: 0,
          publicServiceCount: 0,
          hasSearchableCatalog: false,
        },
      },
    });
    expect(semanticSearch.searchDishIdsWithStatus).not.toHaveBeenCalled();
    expect(
      JSON.parse(
        values.get(
          "search:query:v:13:takeaway:c:Taipei:d:East:ct:product:" +
            "cat:Drinks:pmin:1:pmax:99:m:market-1:p:2:l:5",
        ) ?? "{}",
      ),
    ).toMatchObject({ total: 1 });
  });

  it("schedules semantic warmup instead of caching sparse cache-miss searches", async () => {
    const semanticSearch = {
      searchDishIdsWithStatus: vi.fn(async () => ({
        matches: [],
        embeddingStatus: "cache-miss" as const,
      })),
      warmQueryEmbedding: vi.fn(() => true),
      upsertDishes: vi.fn(),
    };
    const { service, kv } = createService({ "search:query:version": "14" });
    (service as any).semanticSearch = semanticSearch;
    mockSelectResults([[], [{ count: 0 }]]);

    await expect(
      service.searchDishes({ q: "Laksa", page: 1, limit: 10 }),
    ).resolves.toMatchObject({
      total: 0,
      results: [],
      scope: undefined,
    });

    expect(semanticSearch.warmQueryEmbedding).toHaveBeenCalledWith("Laksa");
    expect(kv.put).not.toHaveBeenCalled();
  });

  it("queries and caches categories, restaurant browsing, and service search", async () => {
    const { service, values } = createService({ "search:query:version": "5" });
    const restaurantRow = {
      id: "restaurant-1",
      name: "Makan",
      type: "malaysian",
      category: "casual",
      district: "Central",
      city: "Taipei",
      priceRange: 2,
      rating: 4.5,
      businessHours: null,
      supportsTakeaway: true,
      supportsDelivery: true,
      logoUrl: "logo.png",
      latitude: null,
      longitude: null,
    };
    mockSelectResults([
      [{ categoryName: "Noodles" }, { categoryName: "" }],
      [restaurantRow],
      [{ count: 1 }],
      [
        {
          restaurantId: "restaurant-1",
          marketVendorMarketId: "market-1",
          marketVendorStallNumber: "A1",
          marketVendorLocationLabel: "East wing",
          marketVendorIsPrimary: true,
          marketVendorMarketSlug: "night",
          marketVendorMarketName: "Night Market",
        },
      ],
      [{ restaurantId: "restaurant-1", count: 3 }],
      [{ restaurantId: "restaurant-1", count: 2 }],
      [
        {
          serviceItemId: 10,
          name: "Table booking",
          description: "Reserve seats",
          serviceType: "booking",
          priceCents: 0,
          priceLabel: "Free",
          durationMinutes: 30,
          requiresBooking: true,
          bookingUrl: "/book",
          tags: ["reservation"],
          restaurantId: "restaurant-1",
          restaurantName: "Makan",
          district: "Central",
          city: "Taipei",
          latitude: null,
          longitude: null,
          businessHours: null,
          marketVendorMarketId: null,
          marketVendorStallNumber: null,
          marketVendorLocationLabel: null,
          marketVendorIsPrimary: null,
          marketVendorMarketSlug: null,
          marketVendorMarketName: null,
        },
      ],
      [{ count: 1 }],
    ]);

    await expect(
      service.listDishCategories({ city: "Taipei" }),
    ).resolves.toEqual({ categories: ["Noodles"] });
    expect(
      JSON.parse(values.get("search:categories:v:5:c:Taipei:p:1:l:20") ?? "{}"),
    ).toEqual({ categories: ["Noodles"] });

    await expect(
      service.browseRestaurants({
        district: "Central",
        page: 1,
        limit: 10,
      }),
    ).resolves.toMatchObject({
      total: 1,
      results: [
        {
          restaurantId: "restaurant-1",
          imageUrl: "logo.png",
          availableMenuItemCount: 3,
          publicServiceItemCount: 2,
          marketVendor: { marketId: "market-1", stallNumber: "A1" },
        },
      ],
    });
    expect(
      JSON.parse(values.get("search:restaurants:district:Central") ?? "[]")[0],
    ).toMatchObject({ restaurantId: "restaurant-1" });

    await expect(
      service.searchServices({ q: "booking", page: 1, limit: 5 }),
    ).resolves.toMatchObject({
      total: 1,
      results: [
        {
          resultType: "service",
          serviceItemId: 10,
          serviceType: "booking",
          detailUrl: "/api/v1/restaurants/restaurant-1",
          serviceItemsUrl: "/api/v1/restaurants/restaurant-1/service-items",
        },
      ],
    });
  });

  it("applies category filters and resolves market slug before querying categories", async () => {
    const { service } = createService({ "search:query:version": "8" });
    mockSelectResults([
      [{ id: "market-1" }],
      [{ categoryName: "Noodles" }, { categoryName: null }],
    ]);

    await expect(
      service.listDishCategories({
        marketSlug: "night",
        district: "Central",
        city: "Taipei",
        catalogType: "product",
        takeaway: true,
        delivery: true,
      }),
    ).resolves.toEqual({ categories: ["Noodles"] });
  });

  it("post-filters dish searches by geo distance, open state, and sort order", async () => {
    const { service } = createService({ "search:query:version": "20" });
    const nearOpen = {
      menuItemId: 1,
      dishName: "Tea",
      price: 20,
      priceCents: null,
      catalogType: "menu_item",
      categoryName: "Drinks",
      restaurantId: "restaurant-1",
      restaurantName: "Open Near",
      district: "Central",
      businessHours: openAllWeek(),
      supportsTakeaway: true,
      supportsDelivery: true,
      tags: [],
      latitude: 25,
      longitude: 121,
      marketVendorMarketId: null,
      marketVendorStallNumber: null,
      marketVendorLocationLabel: null,
      marketVendorIsPrimary: null,
      marketVendorMarketSlug: null,
      marketVendorMarketName: null,
    };
    mockSelectResults([
      [
        nearOpen,
        {
          ...nearOpen,
          menuItemId: 2,
          restaurantId: "restaurant-2",
          restaurantName: "Closed Near",
          businessHours: closedAllWeek(),
        },
        {
          ...nearOpen,
          menuItemId: 3,
          restaurantId: "restaurant-3",
          restaurantName: "Missing Geo",
          latitude: null,
          longitude: null,
        },
      ],
      [{ count: 3 }],
    ]);

    await expect(
      service.searchDishes({
        lat: 25,
        lng: 121,
        radiusKm: 1,
        openNow: true,
        sortBy: "distance",
        page: 1,
        limit: 10,
      }),
    ).resolves.toMatchObject({
      total: 1,
      results: [
        {
          menuItemId: 1,
          restaurantName: "Open Near",
          distanceKm: 0,
        },
      ],
    });
  });

  it("post-filters restaurant browsing by geo distance and open state", async () => {
    const { service } = createService();
    const row = {
      id: "restaurant-1",
      name: "Open Near",
      type: "malaysian",
      category: "casual",
      district: "Central",
      city: "Taipei",
      priceRange: 2,
      rating: 4.5,
      businessHours: openAllWeek(),
      supportsTakeaway: true,
      supportsDelivery: true,
      logoUrl: null,
      latitude: 25,
      longitude: 121,
    };
    mockSelectResults([
      [
        row,
        {
          ...row,
          id: "restaurant-2",
          name: "Closed Near",
          businessHours: closedAllWeek(),
        },
        {
          ...row,
          id: "restaurant-3",
          name: "Missing Geo",
          latitude: null,
          longitude: null,
        },
      ],
      [{ count: 3 }],
      [],
      [],
      [],
    ]);

    await expect(
      service.browseRestaurants({
        q: "near",
        city: "Taipei",
        district: "Central",
        cuisineType: "malaysian",
        priceRange: 2,
        takeaway: true,
        delivery: true,
        marketId: "market-1",
        lat: 25,
        lng: 121,
        radiusKm: 1,
        openNow: true,
        sortBy: "open_now",
      }),
    ).resolves.toMatchObject({
      total: 1,
      results: [{ restaurantId: "restaurant-1", distanceKm: 0 }],
    });
  });

  it("post-filters service searches by geo distance and open state", async () => {
    const { service } = createService();
    const serviceRow = {
      serviceItemId: 10,
      name: "Booking",
      description: "Reserve",
      serviceType: "booking",
      priceCents: 1000,
      priceLabel: null,
      durationMinutes: 30,
      requiresBooking: true,
      bookingUrl: "/book",
      tags: ["reservation"],
      restaurantId: "restaurant-1",
      restaurantName: "Open Near",
      district: "Central",
      city: "Taipei",
      latitude: 25,
      longitude: 121,
      businessHours: openAllWeek(),
      marketVendorMarketId: "market-1",
      marketVendorStallNumber: "A1",
      marketVendorLocationLabel: "East",
      marketVendorIsPrimary: true,
      marketVendorMarketSlug: "night",
      marketVendorMarketName: "Night Market",
    };
    mockSelectResults([
      [
        serviceRow,
        {
          ...serviceRow,
          serviceItemId: 11,
          restaurantId: "restaurant-2",
          restaurantName: "Closed Near",
          businessHours: closedAllWeek(),
        },
        {
          ...serviceRow,
          serviceItemId: 12,
          restaurantId: "restaurant-3",
          restaurantName: "Missing Geo",
          latitude: null,
          longitude: null,
        },
      ],
      [{ count: 3 }],
      [{ count: 1 }],
      [{ count: 1 }],
    ]);

    await expect(
      service.searchServices({
        q: "booking",
        city: "Taipei",
        district: "Central",
        marketId: "market-1",
        serviceType: "booking",
        takeaway: true,
        delivery: true,
        lat: 25,
        lng: 121,
        radiusKm: 1,
        openNow: true,
        sortBy: "distance",
        page: 1,
        limit: 10,
      }),
    ).resolves.toMatchObject({
      total: 1,
      results: [
        {
          serviceItemId: 10,
          distanceKm: 0,
          marketVendor: { marketId: "market-1", stallNumber: "A1" },
        },
      ],
      scope: {
        market: {
          marketId: "market-1",
          hasSearchableCatalog: true,
        },
      },
    });
  });

  it("counts only currently open service types and sorts ties by name", async () => {
    const { service } = createService();
    mockSelectResults([
      [
        { serviceType: "delivery", businessHours: openAllWeek() },
        { serviceType: "booking", businessHours: openAllWeek() },
        { serviceType: "booking", businessHours: openAllWeek() },
        { serviceType: "tour", businessHours: closedAllWeek() },
      ],
    ]);

    await expect(
      service.listServiceTypes({
        district: "Central",
        marketId: "market-1",
        takeaway: true,
        delivery: true,
        openNow: true,
      }),
    ).resolves.toEqual({
      serviceTypes: [
        { serviceType: "booking", count: 2 },
        { serviceType: "delivery", count: 1 },
      ],
    });
  });

  it("returns negative takeaway eligibility reasons", async () => {
    const { service } = createService();
    mockSelectResults([
      [],
      [
        {
          isActive: true,
          deletedAt: null,
          supportsTakeaway: false,
          enableShopMode: true,
          shopQrCode: "SHOPQR",
          businessHours: openAllWeek(),
        },
      ],
      [
        {
          isActive: true,
          deletedAt: null,
          supportsTakeaway: true,
          enableShopMode: true,
          shopQrCode: "SHOPQR",
          businessHours: closedAllWeek(),
        },
      ],
    ]);

    await expect(
      service.getTakeawayEligibility("missing-restaurant"),
    ).resolves.toEqual({ eligible: false, reason: "restaurant_disabled" });
    await expect(
      service.getTakeawayEligibility("disabled-takeaway"),
    ).resolves.toEqual({ eligible: false, reason: "takeaway_disabled" });
    await expect(service.getTakeawayEligibility("closed")).resolves.toEqual({
      eligible: false,
      reason: "closed_now",
    });
  });

  it("handles missing market slugs and duplicate restaurant market vendors", async () => {
    const { service } = createService({ "search:query:version": "30" });
    mockSelectResults([
      [],
      [],
      [{ count: 0 }],
      [{ count: 0 }],
      [{ count: 0 }],
      [
        {
          restaurantId: "restaurant-1",
          marketVendorMarketId: "market-1",
          marketVendorStallNumber: "A1",
          marketVendorLocationLabel: "East",
          marketVendorIsPrimary: true,
          marketVendorMarketSlug: "night",
          marketVendorMarketName: "Night Market",
        },
        {
          restaurantId: "restaurant-1",
          marketVendorMarketId: "market-2",
          marketVendorStallNumber: "B2",
          marketVendorLocationLabel: "West",
          marketVendorIsPrimary: false,
          marketVendorMarketSlug: "day",
          marketVendorMarketName: "Day Market",
        },
      ],
    ]);

    await expect(
      service.searchServices({ marketSlug: "missing" }),
    ).resolves.toMatchObject({
      total: 0,
      scope: {
        market: {
          marketId: "__missing_market__",
          hasSearchableCatalog: false,
        },
      },
    });

    const vendors = await (service as any).restaurantBrowseMarketVendors(
      ["restaurant-1"],
      undefined,
    );
    expect(vendors.get("restaurant-1")).toMatchObject({
      marketId: "market-1",
      stallNumber: "A1",
    });
  });

  it("lists service types, popular results, restaurant detail helpers, and eligibility", async () => {
    const { service, kv } = createService({
      "search:meta:popular-keywords": ["laksa"],
    });
    const dishRow = {
      menuItemId: 1,
      dishName: "Laksa",
      price: 9,
      priceCents: 900,
      catalogType: "menu_item",
      categoryName: "Noodles",
      restaurantId: "restaurant-1",
      restaurantName: "Makan",
      district: "Central",
      businessHours: null,
      supportsTakeaway: true,
      supportsDelivery: false,
      tags: [],
      orderCount: 20,
    };
    mockSelectResults([
      [
        { serviceType: "booking", count: 3 },
        { serviceType: "delivery", count: 1 },
      ],
      [dishRow],
      [],
      [{ count: 0 }],
      [
        {
          id: 1,
          name: "Laksa",
          description: "Soup",
          catalogType: "menu_item",
          price: 9,
          is_available: true,
          image_url: null,
          category_name: "Noodles",
        },
      ],
      [
        {
          id: 10,
          restaurantId: "restaurant-1",
          name: "Booking",
          description: "Reserve",
          serviceType: "booking",
          priceCents: 0,
          priceLabel: "Free",
          durationMinutes: 30,
          requiresBooking: true,
          bookingUrl: "/book",
          availableHours: null,
          tags: null,
          keywords: ["reserve"],
          sortOrder: 1,
        },
      ],
      [
        {
          isActive: true,
          deletedAt: null,
          supportsTakeaway: true,
          enableShopMode: true,
          shopQrCode: "SHOPQR",
          businessHours: {
            sunday: { open: "00:00", close: "23:59", closed: false },
            monday: { open: "00:00", close: "23:59", closed: false },
            tuesday: { open: "00:00", close: "23:59", closed: false },
            wednesday: { open: "00:00", close: "23:59", closed: false },
            thursday: { open: "00:00", close: "23:59", closed: false },
            friday: { open: "00:00", close: "23:59", closed: false },
            saturday: { open: "00:00", close: "23:59", closed: false },
          },
        },
      ],
      [
        {
          marketId: "market-1",
          stallNumber: "A1",
          locationLabel: "East",
          isPrimary: true,
          marketSlug: "night",
          marketName: "Night Market",
          marketType: "night",
          city: "Taipei",
          district: "Central",
        },
      ],
    ]);

    await expect(service.listServiceTypes({ city: "Taipei" })).resolves.toEqual(
      {
        serviceTypes: [
          { serviceType: "booking", count: 3 },
          { serviceType: "delivery", count: 1 },
        ],
      },
    );
    await expect(service.getPopular()).resolves.toMatchObject({
      keywords: ["laksa"],
      dishes: [{ menuItemId: 1, price: 9 }],
      restaurants: [],
    });
    expect(kv.get).toHaveBeenCalledWith("search:meta:popular-keywords");
    await expect(
      service.getRestaurantMenu("restaurant-1"),
    ).resolves.toMatchObject([{ id: 1, name: "Laksa" }]);
    await expect(
      service.getRestaurantServices("restaurant-1"),
    ).resolves.toMatchObject([{ id: 10, tags: [], availableHours: null }]);
    await expect(
      service.getTakeawayEligibility("restaurant-1"),
    ).resolves.toEqual({ eligible: true, shopQrCode: "SHOPQR" });
    await expect(
      service.getRestaurantMarkets("restaurant-1"),
    ).resolves.toMatchObject({
      memberships: [
        {
          marketId: "market-1",
          marketUrl: "/markets/night",
          market: { slug: "night", name: "Night Market" },
        },
      ],
    });
  });

  it("reindexes dishes, rebuilds tag metadata, bumps version, and reports index status", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const d1 = createD1();
    const { kv, values } = createKV({
      "search:query:version": "12",
      "search:last_reindexed_at": "2026-06-06T00:00:00.000Z",
    });
    const semanticSearch = {
      searchDishIdsWithStatus: vi.fn(),
      warmQueryEmbedding: vi.fn(),
      upsertDishes: vi.fn(async (docs: unknown[]) => ({
        upserted: docs.length,
      })),
    };
    const service = new DiscoveryService(
      d1,
      kv,
      undefined,
      semanticSearch as any,
    );
    mockSelectResults([
      [
        {
          menuItemId: 1,
          name: "Laksa",
          price: 9,
          priceCents: null,
          catalogType: null,
          isAvailable: true,
          tags: ["spicy"],
          keywords: ["noodle"],
          deletedAtMs: null,
          categoryName: "Noodles",
          categoryActive: true,
          categoryVisible: true,
          categoryDeleted: null,
          restaurantId: "restaurant-1",
          district: "Central",
          restaurantType: "malaysian",
          supportsTakeaway: true,
          supportsDelivery: false,
          restaurantDeleted: null,
          latitude: 25,
          longitude: 121,
          marketIds: '["market-1"]',
          primaryMarketId: "market-1",
        },
      ],
      [
        {
          menuItemId: 1,
          restaurantId: "restaurant-1",
          dishName: "Laksa",
          categoryName: "Noodles",
          price: 9,
          priceCents: 900,
          catalogType: "menu_item",
          tags: ["spicy"],
          primaryMarketId: "market-1",
        },
      ],
      [
        {
          indexedDishCount: 4,
          availableDishCount: 3,
          indexedRestaurantCount: 2,
        },
      ],
    ]);

    await expect(service.reindex()).resolves.toEqual({
      dishes: 1,
      restaurants: 1,
      semanticDishes: 1,
      duration_ms: 0,
    });
    expect(d1.batch).toHaveBeenCalledWith([
      expect.objectContaining({
        args: expect.arrayContaining([1, "restaurant-1", "Laksa"]),
      }),
    ]);
    expect(semanticSearch.upsertDishes).toHaveBeenCalledWith([
      expect.objectContaining({
        menuItemId: 1,
        text: "Laksa Noodles spicy",
      }),
    ]);
    expect(JSON.parse(values.get("search:tags:index") ?? "{}")).toMatchObject({
      spicy: [{ menuItemId: 1, price: 9 }],
    });
    expect(values.get("search:query:version")).toBe(JSON.stringify(Date.now()));

    await expect(service.getIndexStatus()).resolves.toEqual({
      version: String(Date.now()),
      lastReindexedAt: "2026-06-07T00:00:00.000Z",
      indexedDishCount: 4,
      availableDishCount: 3,
      indexedRestaurantCount: 2,
      sourceAvailableDishCount: 8,
      unindexedAvailableDishCount: 2,
      restaurantsWithUnindexedAvailableDishes: 1,
    });
    vi.useRealTimers();
  });
});
