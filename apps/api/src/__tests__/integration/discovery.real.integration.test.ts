import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import { dishSearchIndex } from "@makanmakan/database";

// Undo the global vi.mock("drizzle-orm/d1") so this test uses the real drizzle.
vi.unmock("drizzle-orm/d1");

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
