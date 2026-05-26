import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import {
  dishSearchIndex,
  menuItems,
  markets,
  restaurantMarketMemberships,
  restaurantServiceItems,
} from "@makanmakan/database";
import { eq } from "drizzle-orm";
import { SearchIndexSyncService } from "../../features/discovery/services/SearchIndexSyncService";

function withCsrf(
  headers: Record<string, string> = {},
): Record<string, string> {
  const csrfToken = "c".repeat(64);
  return {
    host: "test",
    origin: "https://test",
    "x-csrf-token": csrfToken,
    cookie: `csrf_token=${csrfToken}`,
    ...headers,
  };
}

function openAllWeek() {
  const day = { open: "00:00", close: "23:59" };
  return {
    monday: day,
    tuesday: day,
    wednesday: day,
    thursday: day,
    friday: day,
    saturday: day,
    sunday: day,
  };
}

async function seedMarket(
  testApp: RealIntegrationTestApp,
  overrides: Partial<typeof markets.$inferInsert> = {},
) {
  const now = new Date();
  const [market] = await testApp.testDb.drizzle
    .insert(markets)
    .values({
      id: `market-${crypto.randomUUID()}`,
      slug: `discovery-market-${crypto.randomUUID()}`,
      name: "Discovery Test Market",
      type: "night_market",
      description: "Discovery integration market",
      city: "台中市",
      district: "西屯區",
      address: "台中市西屯區文華路",
      latitude: 24.1764,
      longitude: 120.6466,
      openingHours: openAllWeek(),
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  return market;
}

// ---------------------------------------------------------------------------
// Helper: seed entries directly into dish_search_index.
//
// IMPORTANT ARCHITECTURE NOTE: DiscoveryService searches `dish_search_index`,
// a denormalized materialized table that is NOT populated by normal menu-item
// inserts. The index is built by the admin POST /discovery/reindex endpoint,
// which requires role=0. For tests we bypass the HTTP layer and write index
// rows directly via Drizzle, which is the correct integration approach.
// ---------------------------------------------------------------------------
async function seedSearchIndex(
  testApp: RealIntegrationTestApp,
  restaurantId: string,
  items: {
    name: string;
    price: number;
    menuItemId: number;
    isAvailable?: boolean;
    district?: string;
    supportsTakeaway?: boolean;
    supportsDelivery?: boolean;
    tags?: string[];
    categoryName?: string | null;
    marketIds?: string[];
    primaryMarketId?: string | null;
  }[],
): Promise<void> {
  // D1/miniflare can reject large multi-row inserts if the combined SQL variable
  // count exceeds limits. Insert one row at a time to stay safe.
  for (const item of items) {
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: item.menuItemId,
      restaurantId,
      dishName: item.name,
      // Normalization mirrors DiscoveryService.normalizeQuery():
      // trim + lowercase + collapse whitespace
      dishNameNormalized: item.name.trim().toLowerCase().replace(/\s+/g, ""),
      categoryName: item.categoryName,
      isAvailable: (item.isAvailable ?? true) as unknown as boolean,
      price: item.price,
      district: item.district,
      supportsTakeaway: (item.supportsTakeaway ?? false) as unknown as boolean,
      supportsDelivery: (item.supportsDelivery ?? false) as unknown as boolean,
      tags: item.tags ?? [],
      marketIds: item.marketIds ?? [],
      primaryMarketId: item.primaryMarketId ?? null,
      updatedAt: new Date(),
    });
  }
}

describe("Discovery API — real integration", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });

  afterAll(async () => {
    await testApp.dispose();
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  // -------------------------------------------------------------------------
  // Core contract: pagination limit is applied and response envelope is correct
  // -------------------------------------------------------------------------
  it("returns paginated results and correct envelope for a dish search", async () => {
    const restaurant = await seed.restaurant();

    // Seed 12 menu items in the normalised index (with matching dish names).
    // We use seed.menuItem to create real menuItems (satisfying the FK on
    // dish_search_index.menu_item_id) and then populate the index manually.
    const menuItemIds: number[] = [];
    for (let i = 0; i < 12; i++) {
      const item = await seed.menuItem(String(restaurant.id), {
        isAvailable: true,
        name: `Nasi Lemak ${i}`,
        price: 100 + i * 10,
      });
      menuItemIds.push(item.id);
    }

    await seedSearchIndex(
      testApp,
      String(restaurant.id),
      menuItemIds.map((id, i) => ({
        menuItemId: id,
        name: `Nasi Lemak ${i}`,
        price: 100 + i * 10,
      })),
    );

    const res = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/discovery/search?q=Nasi+Lemak&page=1&limit=10",
      ),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);

    const data = json.data;
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(10);

    // LIMIT 10 should be respected — no more than 10 results on page 1
    expect(data.results.length).toBeLessThanOrEqual(10);

    // At least 10 matching items are in the index, so page 1 should be full
    expect(data.results.length).toBe(10);

    expect(data.total).toBe(12);
  });

  // -------------------------------------------------------------------------
  // Pagination offset: page 2 should return the remaining items
  // -------------------------------------------------------------------------
  it("page 2 returns the overflow items (pagination offset works)", async () => {
    const restaurant = await seed.restaurant();

    const menuItemIds: number[] = [];
    for (let i = 0; i < 12; i++) {
      const item = await seed.menuItem(String(restaurant.id), {
        isAvailable: true,
        name: `Nasi Lemak ${i}`,
        price: 100 + i * 10,
      });
      menuItemIds.push(item.id);
    }

    await seedSearchIndex(
      testApp,
      String(restaurant.id),
      menuItemIds.map((id, i) => ({
        menuItemId: id,
        name: `Nasi Lemak ${i}`,
        price: 100 + i * 10,
      })),
    );

    const res = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/discovery/search?q=Nasi+Lemak&page=2&limit=10",
      ),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);

    const data = json.data;
    expect(data.page).toBe(2);
    expect(data.limit).toBe(10);
    expect(data.total).toBe(12);

    // With 12 items and limit=10, page 2 should yield exactly 2 results
    expect(data.results.length).toBe(2);
    expect(data.results.map((r: any) => r.dishName)).toEqual([
      "Nasi Lemak 10",
      "Nasi Lemak 11",
    ]);

    // Results on page 2 should not overlap with page 1 (ordered by price asc —
    // the two cheapest pages should be distinct sets)
    const prices: number[] = data.results.map((r: any) => r.price);
    expect(Math.min(...prices)).toBeGreaterThan(100 + 9 * 10 - 1); // all > page-1 items
  });

  it("keeps aggregate total stable across pages for a multi-page search", async () => {
    const restaurant = await seed.restaurant();

    const menuItemIds: number[] = [];
    for (let i = 0; i < 25; i++) {
      const item = await seed.menuItem(String(restaurant.id), {
        isAvailable: true,
        name: `Curry Puff ${i}`,
        price: 100 + i,
      });
      menuItemIds.push(item.id);
    }

    await seedSearchIndex(
      testApp,
      String(restaurant.id),
      menuItemIds.map((id, i) => ({
        menuItemId: id,
        name: `Curry Puff ${i}`,
        price: 100 + i,
      })),
    );

    const page1Res = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/discovery/search?q=Curry+Puff&page=1&limit=10",
      ),
    );
    const page2Res = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/discovery/search?q=Curry+Puff&page=2&limit=10",
      ),
    );
    const page3Res = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/discovery/search?q=Curry+Puff&page=3&limit=10",
      ),
    );

    expect(page1Res.status).toBe(200);
    expect(page2Res.status).toBe(200);
    expect(page3Res.status).toBe(200);

    const page1 = ((await page1Res.json()) as ApiTestResponse).data;
    const page2 = ((await page2Res.json()) as ApiTestResponse).data;
    const page3 = ((await page3Res.json()) as ApiTestResponse).data;

    expect(page1.total).toBe(25);
    expect(page2.total).toBe(25);
    expect(page3.total).toBe(25);
    expect(page1.results).toHaveLength(10);
    expect(page2.results).toHaveLength(10);
    expect(page3.results).toHaveLength(5);
    expect(page3.results.map((r: any) => r.dishName)).toEqual([
      "Curry Puff 20",
      "Curry Puff 21",
      "Curry Puff 22",
      "Curry Puff 23",
      "Curry Puff 24",
    ]);
  });

  it("returns filtered totals independent of the current page slice", async () => {
    const restaurant = await seed.restaurant();

    const specs = [
      { name: "Mee 0", price: 100, district: "Xitun", supportsDelivery: true },
      { name: "Mee 1", price: 110, district: "Xitun", supportsDelivery: true },
      { name: "Mee 2", price: 120, district: "Xitun", supportsDelivery: true },
      { name: "Mee 3", price: 130, district: "Xitun", supportsDelivery: true },
      { name: "Mee 4", price: 140, district: "Xitun", supportsDelivery: false },
      { name: "Mee 5", price: 150, district: "Beitun", supportsDelivery: true },
    ];

    const rows: {
      menuItemId: number;
      name: string;
      price: number;
      district: string;
      supportsDelivery: boolean;
    }[] = [];

    for (const spec of specs) {
      const item = await seed.menuItem(String(restaurant.id), {
        isAvailable: true,
        name: spec.name,
        price: spec.price,
      });

      rows.push({
        menuItemId: item.id,
        name: spec.name,
        price: spec.price,
        district: spec.district,
        supportsDelivery: spec.supportsDelivery,
      });
    }

    await seedSearchIndex(
      testApp,
      String(restaurant.id),
      rows.map((row) => ({
        menuItemId: row.menuItemId,
        name: row.name,
        price: row.price,
        district: row.district,
        supportsDelivery: row.supportsDelivery,
      })),
    );

    const res = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/discovery/search?q=Mee&district=Xitun&delivery=true&priceMin=100&priceMax=130&page=1&limit=2",
      ),
    );

    expect(res.status).toBe(200);
    const data = ((await res.json()) as ApiTestResponse).data;

    expect(data.page).toBe(1);
    expect(data.limit).toBe(2);
    expect(data.results).toHaveLength(2);
    expect(data.total).toBe(4);
    expect(data.results.map((r: any) => r.dishName)).toEqual([
      "Mee 0",
      "Mee 1",
    ]);
  });

  it("treats takeaway service keywords as takeaway-capable dish searches", async () => {
    const restaurant = await seed.restaurant({
      name: "Service Search Vendor",
      supportsTakeaway: true,
    });
    const takeawayItem = await seed.menuItem(String(restaurant.id), {
      isAvailable: true,
      name: "Service Search Bao",
      price: 60,
    });
    const dineInOnlyItem = await seed.menuItem(String(restaurant.id), {
      isAvailable: true,
      name: "Service Search Soup",
      price: 80,
    });

    await seedSearchIndex(testApp, String(restaurant.id), [
      {
        menuItemId: takeawayItem.id,
        name: "Service Search Bao",
        price: 60,
        supportsTakeaway: true,
      },
      {
        menuItemId: dineInOnlyItem.id,
        name: "Service Search Soup",
        price: 80,
        supportsTakeaway: false,
      },
    ]);

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/discovery/search?q=外帶"),
    );

    expect(res.status).toBe(200);
    const data = ((await res.json()) as ApiTestResponse).data;

    expect(data.results.map((r: any) => r.menuItemId)).toEqual([
      takeawayItem.id,
    ]);
    expect(data.total).toBe(1);
  });

  it("treats delivery service keywords as delivery-capable dish searches", async () => {
    const restaurant = await seed.restaurant({
      name: "Delivery Service Vendor",
      supportsDelivery: true,
    });
    const deliveryItem = await seed.menuItem(String(restaurant.id), {
      isAvailable: true,
      name: "Delivery Service Tea",
      price: 50,
    });
    const pickupOnlyItem = await seed.menuItem(String(restaurant.id), {
      isAvailable: true,
      name: "Delivery Service Cake",
      price: 90,
    });

    await seedSearchIndex(testApp, String(restaurant.id), [
      {
        menuItemId: deliveryItem.id,
        name: "Delivery Service Tea",
        price: 50,
        supportsDelivery: true,
      },
      {
        menuItemId: pickupOnlyItem.id,
        name: "Delivery Service Cake",
        price: 90,
        supportsDelivery: false,
      },
    ]);

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/discovery/search?q=外送"),
    );

    expect(res.status).toBe(200);
    const data = ((await res.json()) as ApiTestResponse).data;

    expect(data.results.map((r: any) => r.menuItemId)).toEqual([
      deliveryItem.id,
    ]);
    expect(data.total).toBe(1);
  });

  it("searches public service items scoped to a market", async () => {
    const market = await seedMarket(testApp, {
      slug: "service-search-market",
    });
    const otherMarket = await seedMarket(testApp, {
      slug: "other-service-search-market",
    });
    const restaurant = await seed.restaurant({
      name: "Service Search Vendor",
      city: "台中市",
      district: "西屯區",
    });
    const otherRestaurant = await seed.restaurant({
      name: "Other Service Search Vendor",
      city: "台中市",
      district: "西屯區",
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values([
      {
        restaurantId: String(restaurant.id),
        marketId: market.id,
        joinedAt: new Date(),
      },
      {
        restaurantId: String(otherRestaurant.id),
        marketId: otherMarket.id,
        joinedAt: new Date(),
      },
    ]);
    await testApp.testDb.drizzle.insert(restaurantServiceItems).values([
      {
        restaurantId: String(restaurant.id),
        name: "代客切水果",
        description: "現場代切並分裝",
        serviceType: "general",
        priceCents: 3000,
        tags: ["水果", "分裝"],
        keywords: "水果 分裝 切水果",
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        restaurantId: String(restaurant.id),
        name: "內部切水果",
        serviceType: "general",
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        restaurantId: String(otherRestaurant.id),
        name: "其他市場切水果",
        serviceType: "general",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const res = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/discovery/services?q=切水果&marketId=${market.id}`,
      ),
    );

    expect(res.status).toBe(200);
    const data = ((await res.json()) as ApiTestResponse).data;

    expect(data.total).toBe(1);
    expect(data.results).toHaveLength(1);
    expect(data.results[0]).toMatchObject({
      name: "代客切水果",
      restaurantId: restaurant.id,
      restaurantName: "Service Search Vendor",
      district: "西屯區",
      serviceType: "general",
      priceCents: 3000,
      tags: ["水果", "分裝"],
    });
  });

  it("scopes dish search by city when districts have the same name", async () => {
    const taipeiRestaurant = await seed.restaurant({
      name: "Taipei Zhongshan Vendor",
      city: "台北市",
      district: "中山區",
    });
    const kaohsiungRestaurant = await seed.restaurant({
      name: "Kaohsiung Zhongshan Vendor",
      city: "高雄市",
      district: "中山區",
    });

    const taipeiItem = await seed.menuItem(String(taipeiRestaurant.id), {
      isAvailable: true,
      name: "City Scope Noodles",
      price: 100,
    });
    const kaohsiungItem = await seed.menuItem(String(kaohsiungRestaurant.id), {
      isAvailable: true,
      name: "City Scope Noodles",
      price: 120,
    });

    await seedSearchIndex(testApp, String(taipeiRestaurant.id), [
      {
        menuItemId: taipeiItem.id,
        name: "City Scope Noodles",
        price: 100,
        district: "中山區",
      },
    ]);
    await seedSearchIndex(testApp, String(kaohsiungRestaurant.id), [
      {
        menuItemId: kaohsiungItem.id,
        name: "City Scope Noodles",
        price: 120,
        district: "中山區",
      },
    ]);

    const res = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/discovery/search?q=City+Scope&city=%E5%8F%B0%E5%8C%97%E5%B8%82&district=%E4%B8%AD%E5%B1%B1%E5%8D%80&page=1&limit=10",
      ),
    );

    expect(res.status).toBe(200);
    const data = ((await res.json()) as ApiTestResponse).data;

    expect(data.total).toBe(1);
    expect(data.results.map((r: any) => r.restaurantName)).toEqual([
      "Taipei Zhongshan Vendor",
    ]);
  });

  it("filters dish search by category and lists scoped categories", async () => {
    const market = await seedMarket(testApp, {
      name: "Category Market",
      city: "台中市",
      district: "北區",
    });
    const restaurant = await seed.restaurant({
      name: "Category Vendor",
      city: "台中市",
      district: "北區",
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(restaurant.id),
      marketId: market.id,
      isPrimary: true,
      joinedAt: new Date(),
    });

    const snack = await seed.menuItem(String(restaurant.id), {
      isAvailable: true,
      name: "Category Scope Bao",
      price: 100,
    });
    const drink = await seed.menuItem(String(restaurant.id), {
      isAvailable: true,
      name: "Category Scope Tea",
      price: 80,
    });

    await seedSearchIndex(testApp, String(restaurant.id), [
      {
        menuItemId: snack.id,
        name: "Category Scope Bao",
        price: 100,
        district: "北區",
        categoryName: "小吃",
        marketIds: [market.id],
        primaryMarketId: market.id,
      },
      {
        menuItemId: drink.id,
        name: "Category Scope Tea",
        price: 80,
        district: "北區",
        categoryName: "飲品",
        marketIds: [market.id],
        primaryMarketId: market.id,
      },
    ]);

    const searchRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/discovery/search?q=Category+Scope&marketId=${market.id}&categoryName=%E5%B0%8F%E5%90%83&page=1&limit=10`,
      ),
    );
    const categoriesRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/discovery/categories?marketId=${market.id}`,
      ),
    );

    expect(searchRes.status).toBe(200);
    const searchData = ((await searchRes.json()) as ApiTestResponse).data;
    expect(searchData.total).toBe(1);
    expect(searchData.results.map((r: any) => r.dishName)).toEqual([
      "Category Scope Bao",
    ]);

    expect(categoriesRes.status).toBe(200);
    const categoriesJson: any = await categoriesRes.json();
    expect(categoriesJson.data.categories).toEqual(["小吃", "飲品"]);
  });

  it("sorts dish search results by popularity when requested", async () => {
    const restaurant = await seed.restaurant();
    const lowDemand = await seed.menuItem(String(restaurant.id), {
      isAvailable: true,
      name: "Popular Scope Rice",
      price: 100,
      orderCount: 2,
    });
    const highDemand = await seed.menuItem(String(restaurant.id), {
      isAvailable: true,
      name: "Popular Scope Noodles",
      price: 120,
      orderCount: 40,
    });

    await seedSearchIndex(testApp, String(restaurant.id), [
      {
        menuItemId: lowDemand.id,
        name: "Popular Scope Rice",
        price: 100,
      },
      {
        menuItemId: highDemand.id,
        name: "Popular Scope Noodles",
        price: 120,
      },
    ]);

    const res = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/discovery/search?q=Popular+Scope&sortBy=popular&page=1&limit=10",
      ),
    );

    expect(res.status).toBe(200);
    const data = ((await res.json()) as ApiTestResponse).data;
    expect(data.results.map((r: any) => r.dishName)).toEqual([
      "Popular Scope Noodles",
      "Popular Scope Rice",
    ]);
  });

  it("browses market dishes by category without a keyword", async () => {
    const market = await seedMarket(testApp, {
      name: "Browse Category Market",
    });
    const restaurant = await seed.restaurant();
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(restaurant.id),
      marketId: market.id,
      isPrimary: true,
      joinedAt: new Date(),
    });

    const snack = await seed.menuItem(String(restaurant.id), {
      isAvailable: true,
      name: "Browse Scope Bao",
      price: 100,
    });
    const drink = await seed.menuItem(String(restaurant.id), {
      isAvailable: true,
      name: "Browse Scope Tea",
      price: 80,
    });

    await seedSearchIndex(testApp, String(restaurant.id), [
      {
        menuItemId: snack.id,
        name: "Browse Scope Bao",
        price: 100,
        categoryName: "小吃",
        marketIds: [market.id],
        primaryMarketId: market.id,
      },
      {
        menuItemId: drink.id,
        name: "Browse Scope Tea",
        price: 80,
        categoryName: "飲品",
        marketIds: [market.id],
        primaryMarketId: market.id,
      },
    ]);

    const res = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/discovery/search?marketId=${market.id}&categoryName=%E5%B0%8F%E5%90%83&page=1&limit=10`,
      ),
    );

    expect(res.status).toBe(200);
    const data = ((await res.json()) as ApiTestResponse).data;
    expect(data.total).toBe(1);
    expect(data.results.map((r: any) => r.dishName)).toEqual([
      "Browse Scope Bao",
    ]);
  });

  // -------------------------------------------------------------------------
  // Empty result: q with no matches returns empty results array
  // -------------------------------------------------------------------------
  it("returns empty results for a query with no matching dishes", async () => {
    const restaurant = await seed.restaurant();

    const item = await seed.menuItem(String(restaurant.id), {
      isAvailable: true,
      name: "Roti Canai",
      price: 80,
    });

    await seedSearchIndex(testApp, String(restaurant.id), [
      { menuItemId: item.id, name: "Roti Canai", price: 80 },
    ]);

    const res = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/discovery/search?q=Laksa&page=1&limit=10",
      ),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.results).toEqual([]);
    expect(json.data.total).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Availability filter: unavailable items do not surface in search
  // -------------------------------------------------------------------------
  it("excludes unavailable dishes from search results", async () => {
    const restaurant = await seed.restaurant();

    const available = await seed.menuItem(String(restaurant.id), {
      isAvailable: true,
      name: "Mee Goreng",
      price: 90,
    });

    const unavailable = await seed.menuItem(String(restaurant.id), {
      isAvailable: false,
      name: "Mee Goreng Special",
      price: 120,
    });

    // Seed both into the index — one available, one not
    await seedSearchIndex(testApp, String(restaurant.id), [
      {
        menuItemId: available.id,
        name: "Mee Goreng",
        price: 90,
        isAvailable: true,
      },
      {
        menuItemId: unavailable.id,
        name: "Mee Goreng Special",
        price: 120,
        isAvailable: false,
      },
    ]);

    const res = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/discovery/search?q=Mee+Goreng&page=1&limit=10",
      ),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);

    const results: any[] = json.data.results;

    // Only the available item should appear
    const foundAvailable = results.find((r) => r.menuItemId === available.id);
    const foundUnavailable = results.find(
      (r) => r.menuItemId === unavailable.id,
    );

    expect(foundAvailable).toBeTruthy();
    expect(foundUnavailable).toBeUndefined();
  });

  it("keeps tag matched dish results scoped to the requested market", async () => {
    const market = await seedMarket(testApp, {
      slug: "tag-scoped-market",
    });
    const otherMarket = await seedMarket(testApp, {
      slug: "other-tag-market",
    });
    const restaurant = await seed.restaurant({
      name: "Market Tag Vendor",
    });
    const otherRestaurant = await seed.restaurant({
      name: "Other Market Vendor",
    });
    const marketItem = await seed.menuItem(String(restaurant.id), {
      name: "Market Bao",
      price: 60,
    });
    const otherItem = await seed.menuItem(String(otherRestaurant.id), {
      name: "Other Bao",
      price: 70,
    });

    await seedSearchIndex(testApp, String(restaurant.id), [
      {
        menuItemId: marketItem.id,
        name: "Market Bao",
        price: 60,
        tags: ["signature"],
        marketIds: [market.id],
        primaryMarketId: market.id,
      },
    ]);
    await seedSearchIndex(testApp, String(otherRestaurant.id), [
      {
        menuItemId: otherItem.id,
        name: "Other Bao",
        price: 70,
        tags: ["signature"],
        marketIds: [otherMarket.id],
        primaryMarketId: otherMarket.id,
      },
    ]);
    await testApp.testDb.bindings.CACHE_KV.put(
      "search:tags:index",
      JSON.stringify({
        signature: [
          { menuItemId: marketItem.id },
          { menuItemId: otherItem.id },
        ],
      }),
    );

    const res = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/discovery/search?q=signature&marketId=${market.id}`,
      ),
    );

    expect(res.status).toBe(200);
    const data = ((await res.json()) as ApiTestResponse).data;

    expect(data.results.map((r: any) => r.menuItemId)).toEqual([marketItem.id]);
    expect(data.total).toBe(1);
  });

  it("serves fresh search results after search index sync changes cached dishes", async () => {
    const restaurant = await seed.restaurant({
      name: "Cached Search Vendor",
    });
    const item = await seed.menuItem(String(restaurant.id), {
      name: "Cached Bao",
      price: 60,
      isAvailable: true,
    });
    await seedSearchIndex(testApp, String(restaurant.id), [
      {
        menuItemId: item.id,
        name: "Cached Bao",
        price: 60,
        isAvailable: true,
      },
    ]);

    const firstRes = await testApp.app.fetch(
      new Request("https://test/api/v1/discovery/search?q=Cached+Bao"),
    );
    expect(firstRes.status).toBe(200);
    const firstData = ((await firstRes.json()) as ApiTestResponse).data;
    expect(firstData.results.map((r: any) => r.menuItemId)).toEqual([item.id]);

    await testApp.testDb.drizzle
      .update(menuItems)
      .set({ isAvailable: false })
      .where(eq(menuItems.id, item.id));
    const sync = new SearchIndexSyncService(
      testApp.testDb.bindings.DB,
      testApp.testDb.bindings.CACHE_KV,
    );
    await sync.onMenuItemChanged(item.id);

    const secondRes = await testApp.app.fetch(
      new Request("https://test/api/v1/discovery/search?q=Cached+Bao"),
    );
    expect(secondRes.status).toBe(200);
    const secondData = ((await secondRes.json()) as ApiTestResponse).data;
    expect(secondData.results).toEqual([]);
    expect(secondData.total).toBe(0);
  });

  it("syncs discovery index after menu item availability changes through menu API", async () => {
    const market = await seedMarket(testApp, {
      slug: "menu-sync-market",
    });
    const restaurant = await seed.restaurant({
      name: "Menu Sync Vendor",
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(restaurant.id),
      marketId: market.id,
      isPrimary: true,
      joinedAt: new Date(),
    });
    await seed.user({
      id: 41,
      username: "menu-sync-admin",
      role: 0,
      restaurantId: String(restaurant.id),
    });
    const adminToken = await testApp.authHelper.adminToken(
      String(restaurant.id),
    );
    const item = await seed.menuItem(String(restaurant.id), {
      name: "Menu Sync Bao",
      price: 60,
      isAvailable: true,
    });
    await seedSearchIndex(testApp, String(restaurant.id), [
      {
        menuItemId: item.id,
        name: "Menu Sync Bao",
        price: 60,
        isAvailable: true,
        marketIds: [market.id],
        primaryMarketId: market.id,
      },
    ]);

    const firstRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/discovery/search?q=Menu+Sync+Bao&marketId=${market.id}`,
      ),
    );
    expect(firstRes.status).toBe(200);
    const firstData = ((await firstRes.json()) as ApiTestResponse).data;
    expect(firstData.results.map((r: any) => r.menuItemId)).toEqual([item.id]);

    const updateRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/menu/items/${item.id}`, {
        method: "PUT",
        headers: withCsrf({
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
        }),
        body: JSON.stringify({ isAvailable: false }),
      }),
    );
    expect(updateRes.status).toBe(200);

    const secondRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/discovery/search?q=Menu+Sync+Bao&marketId=${market.id}`,
      ),
    );
    expect(secondRes.status).toBe(200);
    const secondData = ((await secondRes.json()) as ApiTestResponse).data;
    expect(secondData.results).toEqual([]);
    expect(secondData.total).toBe(0);
  });

  it("excludes inactive and deleted markets from full reindex market membership fields", async () => {
    const adminRestaurant = await seed.restaurant({
      name: "Discovery Reindex Admin",
    });
    await seed.user({
      id: 31,
      username: "discovery-reindex-admin",
      role: 0,
      restaurantId: String(adminRestaurant.id),
    });
    const adminToken = await testApp.authHelper.adminToken(
      String(adminRestaurant.id),
    );
    const restaurant = await seed.restaurant({
      name: "Inactive Market Vendor",
      district: "西屯區",
      city: "台中市",
      latitude: 24.1491,
      longitude: 120.6842,
      supportsTakeaway: true,
    });
    const activeMarket = await seedMarket(testApp, {
      slug: "active-reindex-market",
    });
    const inactiveMarket = await seedMarket(testApp, {
      slug: "inactive-reindex-market",
      isActive: false,
    });
    const deletedMarket = await seedMarket(testApp, {
      slug: "deleted-reindex-market",
      deletedAt: new Date(),
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values([
      {
        restaurantId: String(restaurant.id),
        marketId: activeMarket.id,
        joinedAt: new Date(),
      },
      {
        restaurantId: String(restaurant.id),
        marketId: inactiveMarket.id,
        isPrimary: true,
        joinedAt: new Date(),
      },
      {
        restaurantId: String(restaurant.id),
        marketId: deletedMarket.id,
        joinedAt: new Date(),
      },
    ]);
    const item = await seed.menuItem(String(restaurant.id), {
      name: "Reindex Market Bao",
      price: 60,
      priceCents: 6000,
    });

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/discovery/reindex", {
        method: "POST",
        headers: withCsrf({
          authorization: `Bearer ${adminToken}`,
        }),
      }),
    );
    expect(res.status).toBe(200);

    const [indexed] = await testApp.testDb.drizzle
      .select({
        primaryMarketId: dishSearchIndex.primaryMarketId,
        marketIds: dishSearchIndex.marketIds,
      })
      .from(dishSearchIndex)
      .where(eq(dishSearchIndex.menuItemId, item.id))
      .limit(1);

    expect(indexed).toEqual({
      primaryMarketId: null,
      marketIds: [activeMarket.id],
    });
  });

  // -------------------------------------------------------------------------
  // Missing q param: validation error (not a 500)
  // -------------------------------------------------------------------------
  it("returns 400 when q param is missing", async () => {
    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/discovery/search?page=1&limit=10"),
    );

    // dishSearchQuerySchema requires q — should fail validation cleanly
    expect(res.status).toBe(400);
    const json: any = await res.json();
    expect(json.success).toBe(false);
  });
});
