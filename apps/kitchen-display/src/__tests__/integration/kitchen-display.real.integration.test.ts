/**
 * Real integration smoke — Kitchen Display API contracts
 *
 * Covers the two REST endpoint groups the kitchen display depends on:
 *   Orders  : GET /api/v1/kitchen/:restaurantId/orders
 *             Response shape: { pending: KitchenOrder[], preparing: [], ready: [], stats: {} }
 *   Items   : PUT /api/v1/kitchen/:restaurantId/orders/:orderId/items/:itemId
 *
 * Note: kitchen only surfaces orders with status "confirmed", "preparing", or "ready".
 * A freshly POST-ed order is "pending" — it must be confirmed via
 * PUT /api/v1/orders/:id/status before it appears in the kitchen list.
 *
 * SSE (/kitchen/:restaurantId/events), offline-mode, and audio notifications
 * belong at the E2E/Playwright layer — excluded here intentionally.
 *
 * Single file = single Miniflare boot — eliminates workerd IPC flake.
 * Uses the deployed service and database paths.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq, orderItems } from "@makanmakan/database";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "../../../../api/src/__tests__/integration/helpers/real-test-app";
import { buildSeedHelpers } from "../../../../api/src/__tests__/integration/helpers/seed-helper";
// ── Shared Miniflare instance ────────────────────────────────────────────────
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

// ── CSRF helpers (required by the API's csrf.ts middleware) ──────────────────
const CSRF_TOKEN = "a".repeat(64);
const CSRF_HEADERS = {
  host: "test",
  origin: "https://test",
  "x-csrf-token": CSRF_TOKEN,
  cookie: `csrf_token=${CSRF_TOKEN}`,
  "content-type": "application/json",
};

async function activateKitchenSubscription(restaurantId: string | number) {
  const id = String(restaurantId);
  const now = Date.now();

  await testApp.env.DB.prepare(
    `INSERT INTO shop_subscriptions
      (id, restaurant_id, plan_tier, module_overrides, deployment_mode,
       is_active, trial_ends_at_ms, created_at_ms, updated_at_ms)
     VALUES (?, ?, 'trial', ?, 'managed', 1, ?, ?, ?)`,
  )
    .bind(
      `kitchen-sub-${id}`,
      id,
      JSON.stringify({ kitchen_display: true, online_ordering: true }),
      now + 24 * 60 * 60 * 1000,
      now,
      now,
    )
    .run();
}

// ─── Helper: create and confirm an order so it appears in the kitchen list ──
// Kitchen only surfaces orders with status "confirmed" | "preparing" | "ready".
async function createConfirmedOrder(
  restaurantId: string,
  menuItemId: number,
  token: string,
): Promise<{ orderId: number; itemId: number }> {
  const postRes = await testApp.app.fetch(
    new Request("https://test/api/v1/orders", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, ...CSRF_HEADERS },
      body: JSON.stringify({
        restaurantId,
        items: [{ menuItemId, quantity: 1 }],
      }),
    }),
  );
  expect(postRes.status).toBe(201);
  const created: any = (await postRes.json()).data;

  // Confirm the order so it appears in the kitchen queue
  await testApp.app.fetch(
    new Request(`https://test/api/v1/orders/${created.id}/status`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, ...CSRF_HEADERS },
      body: JSON.stringify({ status: "confirmed" }),
    }),
  );

  const [createdItem] = await testApp.testDb.drizzle
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(eq(orderItems.orderId, created.id))
    .limit(1);

  expect(createdItem?.id, "created order must include a kitchen item").toEqual(
    expect.any(Number),
  );

  return {
    orderId: created.id,
    itemId: createdItem.id,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Suite A — GET /api/v1/kitchen/:restaurantId/orders
// ═══════════════════════════════════════════════════════════════════════════════

describe("Kitchen Display GET orders — real integration", () => {
  it("chef (role=2) can fetch kitchen orders for their restaurant", async () => {
    const restaurant = await seed.restaurant();
    await activateKitchenSubscription(restaurant.id);
    const chef = await seed.user({ id: 10, role: 2, username: "chef-user" });
    const token = await testApp.authHelper.staffToken(
      chef.id,
      2,
      String(restaurant.id),
    );

    const res = await testApp.app.fetch(
      new Request(`https://test/api/v1/kitchen/${restaurant.id}/orders`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    // Kitchen response: { pending: [], preparing: [], ready: [], stats: {} }
    expect(Array.isArray(json.data.pending)).toBe(true);
    expect(Array.isArray(json.data.preparing)).toBe(true);
    expect(Array.isArray(json.data.ready)).toBe(true);
    expect(typeof json.data.stats).toBe("object");
  });

  it("chef from a different restaurant gets 403", async () => {
    const restaurant = await seed.restaurant();
    const otherRestaurant = await seed.restaurant();
    await activateKitchenSubscription(restaurant.id);
    await activateKitchenSubscription(otherRestaurant.id);
    const chef = await seed.user({ id: 11, role: 2, username: "chef-other" });
    // Token carries otherRestaurant.id but request targets restaurant.id
    const token = await testApp.authHelper.staffToken(
      chef.id,
      2,
      String(otherRestaurant.id),
    );

    const res = await testApp.app.fetch(
      new Request(`https://test/api/v1/kitchen/${restaurant.id}/orders`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(403);
    const json: any = await res.json();
    expect(json.success).toBe(false);
    expect(json.error?.code).toBeDefined();
  });

  it("returns 401 when accessing kitchen orders without auth", async () => {
    const restaurant = await seed.restaurant();

    const res = await testApp.app.fetch(
      new Request(`https://test/api/v1/kitchen/${restaurant.id}/orders`),
    );

    expect(res.status).toBe(401);
    const json: any = await res.json();
    expect(json.success).toBe(false);
    expect(json.error?.code).toBeDefined();
  });

  it("service-crew (role=3) is also permitted to fetch kitchen orders", async () => {
    const restaurant = await seed.restaurant();
    await activateKitchenSubscription(restaurant.id);
    const crew = await seed.user({ id: 20, role: 3, username: "service-crew" });
    const token = await testApp.authHelper.staffToken(
      crew.id,
      3,
      String(restaurant.id),
    );

    const res = await testApp.app.fetch(
      new Request(`https://test/api/v1/kitchen/${restaurant.id}/orders`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    // validateChefAccess grants roles 0-3; role=3 must not get 401/403
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Suite B — PUT /api/v1/kitchen/:restaurantId/orders/:orderId/items/:itemId
// ═══════════════════════════════════════════════════════════════════════════════

describe("Kitchen Display PUT item status — real integration", () => {
  it("chef can move an order item from pending to preparing to ready", async () => {
    const restaurant = await seed.restaurant();
    await activateKitchenSubscription(restaurant.id);
    await seed.user({ id: 1, role: 0, username: "test-admin" });
    const chef = await seed.user({ id: 10, role: 2, username: "chef-user" });
    const menuItem = await seed.menuItem(restaurant.id, {
      isAvailable: true,
      price: 1200,
    });

    const adminToken = await testApp.authHelper.adminToken(
      String(restaurant.id),
    );
    const chefToken = await testApp.authHelper.staffToken(
      chef.id,
      2,
      String(restaurant.id),
    );

    const { orderId, itemId } = await createConfirmedOrder(
      String(restaurant.id),
      menuItem.id,
      adminToken,
    );

    const putRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/kitchen/${restaurant.id}/orders/${orderId}/items/${itemId}`,
        {
          method: "PUT",
          headers: { authorization: `Bearer ${chefToken}`, ...CSRF_HEADERS },
          body: JSON.stringify({ status: "preparing" }),
        },
      ),
    );

    expect(putRes.status).toBe(200);
    const preparingJson: any = await putRes.json();
    expect(preparingJson.success).toBe(true);

    const [preparingItem] = await testApp.testDb.drizzle
      .select({ status: orderItems.status })
      .from(orderItems)
      .where(eq(orderItems.id, itemId))
      .limit(1);
    expect(preparingItem?.status).toBe("preparing");

    const readyRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/kitchen/${restaurant.id}/orders/${orderId}/items/${itemId}`,
        {
          method: "PUT",
          headers: { authorization: `Bearer ${chefToken}`, ...CSRF_HEADERS },
          body: JSON.stringify({ status: "ready" }),
        },
      ),
    );

    expect(readyRes.status).toBe(200);
    const readyJson: any = await readyRes.json();
    expect(readyJson.success).toBe(true);

    const [readyItem] = await testApp.testDb.drizzle
      .select({ status: orderItems.status })
      .from(orderItems)
      .where(eq(orderItems.id, itemId))
      .limit(1);
    expect(readyItem?.status).toBe("ready");
  });

  it("chef from wrong restaurant gets 403 on PUT", async () => {
    const restaurant = await seed.restaurant();
    const otherRestaurant = await seed.restaurant();
    await activateKitchenSubscription(restaurant.id);
    await activateKitchenSubscription(otherRestaurant.id);
    await seed.user({ id: 1, role: 0, username: "test-admin" });
    const chef = await seed.user({ id: 11, role: 2, username: "chef-other" });

    const item = await seed.menuItem(restaurant.id, {
      isAvailable: true,
      price: 800,
    });
    const adminToken = await testApp.authHelper.adminToken(
      String(restaurant.id),
    );
    const wrongToken = await testApp.authHelper.staffToken(
      chef.id,
      2,
      String(otherRestaurant.id),
    );

    const { orderId, itemId } = await createConfirmedOrder(
      String(restaurant.id),
      item.id,
      adminToken,
    );

    const putRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/kitchen/${restaurant.id}/orders/${orderId}/items/${itemId}`,
        {
          method: "PUT",
          headers: { authorization: `Bearer ${wrongToken}`, ...CSRF_HEADERS },
          body: JSON.stringify({ status: "preparing" }),
        },
      ),
    );

    expect(putRes.status).toBe(403);
    const json: any = await putRes.json();
    expect(json.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Suite C — End-to-end round-trip
// ═══════════════════════════════════════════════════════════════════════════════

describe("Kitchen Display round-trip — real integration", () => {
  it("admin creates + confirms an order and chef sees it in the kitchen queue", async () => {
    const restaurant = await seed.restaurant();
    await activateKitchenSubscription(restaurant.id);
    await seed.user({ id: 1, role: 0, username: "test-admin" });
    const chef = await seed.user({ id: 10, role: 2, username: "chef-user" });
    const menuItem = await seed.menuItem(restaurant.id, {
      isAvailable: true,
      price: 950,
    });

    const adminToken = await testApp.authHelper.adminToken(
      String(restaurant.id),
    );
    const chefToken = await testApp.authHelper.staffToken(
      chef.id,
      2,
      String(restaurant.id),
    );

    const { orderId } = await createConfirmedOrder(
      String(restaurant.id),
      menuItem.id,
      adminToken,
    );

    // Chef polls kitchen orders — confirmed order must appear in `pending` bucket
    const getRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/kitchen/${restaurant.id}/orders`, {
        headers: { authorization: `Bearer ${chefToken}` },
      }),
    );
    expect(getRes.status).toBe(200);
    const json: any = await getRes.json();
    expect(json.success).toBe(true);

    // Kitchen maps "confirmed" orders to the `pending` bucket
    const allOrders = [
      ...(json.data.pending ?? []),
      ...(json.data.preparing ?? []),
      ...(json.data.ready ?? []),
    ];
    const found = allOrders.find(
      (o: any) => String(o.id) === String(orderId) || o.orderId === orderId,
    );
    expect(found).toBeTruthy();
  });

  it("kitchen queue is empty before any confirmed orders exist", async () => {
    const restaurant = await seed.restaurant();
    await activateKitchenSubscription(restaurant.id);
    const chef = await seed.user({ id: 10, role: 2, username: "chef-user" });
    const token = await testApp.authHelper.staffToken(
      chef.id,
      2,
      String(restaurant.id),
    );

    const res = await testApp.app.fetch(
      new Request(`https://test/api/v1/kitchen/${restaurant.id}/orders`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.pending).toHaveLength(0);
    expect(json.data.preparing).toHaveLength(0);
    expect(json.data.ready).toHaveLength(0);
  });
});
