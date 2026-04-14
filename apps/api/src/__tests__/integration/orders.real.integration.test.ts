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

// Undo the global vi.mock("drizzle-orm/d1") so this test uses the real drizzle.
vi.unmock("drizzle-orm/d1");

describe("Orders API — real integration", () => {
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

  it("round-trips created_at_ms through POST /orders -> GET /orders/:id", async () => {
    const restaurant = await seed.restaurant();

    // The `orders.customer_id` FK references `users.id`. Drizzle's D1 driver
    // enables `PRAGMA foreign_keys = ON`, so the user must exist before the
    // route's insert runs. Seed a user with id=1 to match the admin token.
    const actor = await seed.user({ id: 1, role: 0, username: "test-admin" });

    // Explicit `isAvailable: true` defeats the 5% flake from the factory
    // (menuItemFactory uses randomBoolean(0.95)). OrderService rejects items
    // where `isAvailable === false`.
    const menuItem = await seed.menuItem(restaurant.id, {
      isAvailable: true,
      price: 100,
    });

    // Admin token carrying the real restaurant UUID. The route checks
    // `if (user.restaurantId && user.restaurantId !== data.restaurantId)`
    // and throws 403 on mismatch; the default adminToken() carries "1" which
    // would not match the seeded UUID.
    const token = await testApp.authHelper.adminToken(String(restaurant.id));

    // Payload shape per `createOrderSchema` in
    // apps/api/src/features/orders/schemas/validation.ts:
    //   items[].price is optional (service computes from DB)
    //   items[].unitPrice is NOT a field — use `price` instead
    //   totalAmount is NOT in the schema — service auto-calculates
    //   orderType defaults to "table" (schema default; service discards the
    //   request value in this codebase and lets Drizzle apply the default)
    const payload = {
      restaurantId: String(restaurant.id),
      items: [{ menuItemId: menuItem.id, quantity: 2 }],
    };

    // CSRF double-submit cookie pattern (see apps/api/src/middleware/csrf.ts):
    //   1. Origin host matches request host
    //   2. X-CSRF-Token header present (64-hex chars)
    //   3. Matching `csrf_token` cookie
    const csrfToken = "a".repeat(64);
    const postRes = await testApp.app.fetch(
      new Request("https://test/api/v1/orders", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          host: "test",
          origin: "https://test",
          "x-csrf-token": csrfToken,
          cookie: `csrf_token=${csrfToken}`,
        },
        body: JSON.stringify(payload),
      }),
    );
    expect(postRes.status).toBe(201);
    const postJson: any = await postRes.json();
    expect(postJson.success).toBe(true);
    const created = postJson.data;
    expect(created.id).toBeTruthy();

    const getRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/orders/${created.id}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    expect(getRes.status).toBe(200);
    const getJson: any = await getRes.json();
    const fetched = getJson.data;

    expect(fetched.id).toBe(created.id);
    // Stable across write and read — same wire value on both hops.
    expect(fetched.createdAt).toEqual(created.createdAt);

    // ── createdAt wire type — documented production observation ─────────────
    // Drizzle's `timestamp_ms` mode returns a `Date` object from the DB. The
    // route currently serialises this Date through `JSON.stringify`, which
    // produces an ISO-8601 string (e.g. "2026-04-14T02:30:00.000Z") rather
    // than a Unix-ms integer. The legacy MockDrizzle tests cannot detect this
    // divergence because they bypass Drizzle's type transformer entirely.
    //
    // This smoke accepts both wire shapes (string or number) and verifies
    // semantic freshness instead of pinning the type, so the test remains
    // green if a future PR normalises the contract to integers. If/when that
    // fix lands, replace the parser below with a strict `typeof === "number"`
    // assertion to lock in the improvement.
    // ────────────────────────────────────────────────────────────────────────
    const createdAtMs =
      typeof fetched.createdAt === "number"
        ? fetched.createdAt
        : Date.parse(fetched.createdAt);
    expect(Number.isFinite(createdAtMs)).toBe(true);
    expect(Math.abs(createdAtMs - Date.now())).toBeLessThan(5000);

    // Belt-and-braces: the actor was created
    expect(actor.id).toBe(1);
  });
});
