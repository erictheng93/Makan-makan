import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import { dishSearchIndex } from "@makanmakan/database";
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
      isAvailable: (item.isAvailable ?? true) as unknown as boolean,
      price: item.price,
      district: item.district,
      supportsTakeaway: (item.supportsTakeaway ?? false) as unknown as boolean,
      supportsDelivery: (item.supportsDelivery ?? false) as unknown as boolean,
      tags: [] as string[],
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
