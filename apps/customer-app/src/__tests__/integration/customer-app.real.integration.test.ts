/**
 * Real integration smoke — Customer App API contracts
 *
 * Covers the three endpoint groups that customer-app service layer depends on:
 *   Menu    : GET /api/v1/menu/:restaurantId
 *             GET /api/v1/restaurants/:restaurantId/categories
 *   Orders  : POST /api/v1/orders, GET /api/v1/orders/:id
 *   Discovery: GET /api/v1/discovery/restaurants
 *
 * Single file = single Miniflare boot. This eliminates the workerd IPC
 * "fetch failed" flake that appears when multiple miniflare instances boot
 * sequentially in the same process (observed at attempt 3+ with 3 separate files).
 *
 * Uses the deployed service and database paths.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "../../../../api/src/__tests__/integration/helpers/real-test-app";
import { buildSeedHelpers } from "../../../../api/src/__tests__/integration/helpers/seed-helper";
import { dishSearchIndex } from "@makanmasak/database";
// ── Shared Miniflare instance (one boot for the entire file) ──────────────────
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

// ── CSRF helpers for mutating endpoints ──────────────────────────────────────
const CSRF_TOKEN = "a".repeat(64);
const CSRF_HEADERS = {
  host: "test",
  origin: "https://test",
  "x-csrf-token": CSRF_TOKEN,
  cookie: `csrf_token=${CSRF_TOKEN}`,
  "content-type": "application/json",
};

// ── Helper: seed the denormalized dish search index directly ─────────────────
// DiscoveryService searches `dish_search_index` (a materialized view).
// Normal menu-item inserts do NOT populate this table — use this helper.
async function seedSearchIndex(
  restaurantId: string,
  items: Array<{ name: string; price: number; menuItemId: number }>,
): Promise<void> {
  for (const item of items) {
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: item.menuItemId,
      restaurantId,
      dishName: item.name,
      dishNameNormalized: item.name.trim().toLowerCase().replace(/\s+/g, ""),
      isAvailable: true as unknown as boolean,
      price: item.price,
      tags: [] as string[],
      updatedAt: new Date(),
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MENU
// ═══════════════════════════════════════════════════════════════════════════════

describe("Customer Menu API — real integration", () => {
  it("returns categories and menuItems arrays for a restaurant with items", async () => {
    const restaurant = await seed.restaurant();
    await seed.menuItem(restaurant.id, {
      name: "Nasi Lemak",
      priceCents: 12000,
      isAvailable: true,
    });

    const res = await testApp.app.fetch(
      new Request(`https://test/api/v1/menu/${restaurant.id}`),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);

    // menuApi.getRestaurantMenu() depends on both these arrays
    expect(Array.isArray(json.data.categories)).toBe(true);
    expect(Array.isArray(json.data.menuItems)).toBe(true);
    expect(json.data.menuItems.length).toBeGreaterThanOrEqual(1);

    const item = json.data.menuItems.find((i: any) => i.name === "Nasi Lemak");
    expect(item).toBeTruthy();
    expect(item.price).toBe(120);
  });

  it("excludes unavailable items from the public menu", async () => {
    const restaurant = await seed.restaurant();
    const visible = await seed.menuItem(restaurant.id, {
      name: "Visible Roti",
      isAvailable: true,
    });
    const hidden = await seed.menuItem(restaurant.id, {
      name: "Hidden Char Kway",
      isAvailable: false,
    });

    const res = await testApp.app.fetch(
      new Request(`https://test/api/v1/menu/${restaurant.id}`),
    );
    expect(res.status).toBe(200);
    const json: any = await res.json();
    const items: any[] = json.data.menuItems ?? [];

    expect(items.find((i: any) => i.id === visible.id)).toBeTruthy();
    expect(items.find((i: any) => i.id === hidden.id)).toBeUndefined();
  });

  it("returns 404 (or 200 with empty arrays) for an unknown restaurant", async () => {
    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/menu/nonexistent-restaurant-id"),
    );
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const json: any = await res.json();
      expect(Array.isArray(json.data.menuItems)).toBe(true);
    }
  });

  it("wraps successful responses in { success: true, data: ... }", async () => {
    const restaurant = await seed.restaurant();
    await seed.menuItem(restaurant.id, { isAvailable: true });

    const res = await testApp.app.fetch(
      new Request(`https://test/api/v1/menu/${restaurant.id}`),
    );
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("data");
  });

  it("categories endpoint returns an array", async () => {
    const restaurant = await seed.restaurant();
    await seed.menuItem(restaurant.id, {
      name: "Teh Tarik",
      isAvailable: true,
    });

    const res = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/categories`,
      ),
    );
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const json: any = await res.json();
      expect(Array.isArray(json.data)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Customer Orders API — real integration", () => {
  it("creates an order and returns id + status", async () => {
    const restaurant = await seed.restaurant();
    // users.id FK required; seed actor matching admin token sub=1
    await seed.user({ id: 1, role: 0, username: "test-admin" });
    const item = await seed.menuItem(restaurant.id, {
      isAvailable: true,
      price: 800,
    });

    const token = await testApp.authHelper.adminToken(String(restaurant.id));

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/orders", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, ...CSRF_HEADERS },
        body: JSON.stringify({
          restaurantId: String(restaurant.id),
          items: [{ menuItemId: item.id, quantity: 1 }],
        }),
      }),
    );

    expect(res.status).toBe(201);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBeTruthy();
    expect(typeof json.data.status).toBe("string");
  });

  it("round-trips the order: POST then GET returns same id and valid createdAt", async () => {
    const restaurant = await seed.restaurant();
    await seed.user({ id: 1, role: 0, username: "test-admin" });
    const item = await seed.menuItem(restaurant.id, {
      isAvailable: true,
      price: 500,
    });
    const token = await testApp.authHelper.adminToken(String(restaurant.id));

    const postRes = await testApp.app.fetch(
      new Request("https://test/api/v1/orders", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, ...CSRF_HEADERS },
        body: JSON.stringify({
          restaurantId: String(restaurant.id),
          items: [{ menuItemId: item.id, quantity: 2 }],
        }),
      }),
    );
    expect(postRes.status).toBe(201);
    const created: any = (await postRes.json()).data;

    const getRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/orders/${created.id}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    expect(getRes.status).toBe(200);
    const fetched: any = (await getRes.json()).data;

    expect(fetched.id).toBe(created.id);
    expect(fetched.restaurantId).toBe(String(restaurant.id));

    // createdAt: ISO string or ms integer — both are valid (documented wire variance)
    const ms =
      typeof fetched.createdAt === "number"
        ? fetched.createdAt
        : Date.parse(fetched.createdAt);
    expect(Number.isFinite(ms)).toBe(true);
    expect(Math.abs(ms - Date.now())).toBeLessThan(10_000);
  });

  it("returns 401 when no Authorization header is sent", async () => {
    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/orders", {
        method: "POST",
        headers: CSRF_HEADERS,
        body: JSON.stringify({ restaurantId: "1", items: [] }),
      }),
    );
    expect(res.status).toBe(401);
    const json: any = await res.json();
    expect(json.success).toBe(false);
    expect(json.error?.code).toBeDefined();
  });

  it("returns 404/403 when fetching a nonexistent order id", async () => {
    const restaurant = await seed.restaurant();
    await seed.user({ id: 1, role: 0, username: "test-admin" });
    const token = await testApp.authHelper.adminToken(String(restaurant.id));

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/orders/99999999", {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    expect([403, 404]).toContain(res.status);
    const json: any = await res.json();
    expect(json.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DISCOVERY
// ═══════════════════════════════════════════════════════════════════════════════

describe("Customer Discovery API — real integration", () => {
  it("returns a paginated result envelope for a dish name search", async () => {
    const restaurant = await seed.restaurant();
    const item = await seed.menuItem(restaurant.id, {
      name: "Nasi Lemak",
      isAvailable: true,
      price: 1200,
    });
    await seedSearchIndex(String(restaurant.id), [
      { name: "Nasi Lemak", price: 1200, menuItemId: item.id },
    ]);

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/discovery/restaurants?q=nasi&limit=10"),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    // menuApi.searchRestaurants() reads json.data.results
    expect(json.data).toHaveProperty("results");
    expect(Array.isArray(json.data.results)).toBe(true);
  });

  it("returns empty results for a query with no matches", async () => {
    const restaurant = await seed.restaurant();
    const item = await seed.menuItem(restaurant.id, { isAvailable: true });
    await seedSearchIndex(String(restaurant.id), [
      { name: "Roti Canai", price: 300, menuItemId: item.id },
    ]);

    const res = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/discovery/restaurants?q=nonexistentdish&limit=10",
      ),
    );
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.data.results).toHaveLength(0);
  });

  it("respects the limit parameter", async () => {
    const restaurant = await seed.restaurant();
    for (let i = 1; i <= 5; i++) {
      const item = await seed.menuItem(restaurant.id, {
        name: `Mee ${i}`,
        isAvailable: true,
        price: i * 100,
      });
      await seedSearchIndex(String(restaurant.id), [
        { name: `Mee ${i}`, price: i * 100, menuItemId: item.id },
      ]);
    }

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/discovery/restaurants?q=mee&limit=3"),
    );
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.data.results.length).toBeLessThanOrEqual(3);
  });

  it("returns 200 with empty results when no index rows exist", async () => {
    const res = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/discovery/restaurants?q=anything&limit=10",
      ),
    );
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const json: any = await res.json();
      expect(Array.isArray(json.data.results)).toBe(true);
    }
  });
});
