/**
 * Real integration — Coupons API
 *
 * Pilot migration (full port). Started life in commit 1 as a 2-test
 * smoke that proved the new `seed.coupon()` helper inserts a valid
 * row through real Drizzle + miniflare D1. This file now covers the
 * same surface area as the legacy
 * `integration-legacy-mockdrizzle/coupons.integration.test.ts`
 * (7 tests) so the legacy file can be deleted in commit 5.
 *
 * Infrastructure notes (learned during port):
 *   - POST /coupons requires CSRF (double-submit cookie pattern).
 *     Helper `csrfHeaders` below matches the contract in
 *     `apps/api/src/middleware/csrf.ts` (64-hex token in both the
 *     X-CSRF-Token header and the csrf_token cookie, with host and
 *     origin that agree).
 *   - POST /coupons/validate is CSRF-EXCLUDED in app-factory.ts:466
 *     (public endpoint).
 *   - createCouponSchema requires validFrom/validTo as
 *     `z.string().datetime()` — full ISO 8601, not YYYY-MM-DD.
 *     The DB column is TEXT and the service layer stores whatever
 *     the API receives; seed.coupon() writes YYYY-MM-DD directly to
 *     the DB, which is why API-created and seed-created rows differ
 *     in their stored format. Both round-trip through the validate
 *     endpoint because the service compares as strings.
 *   - authHelper.adminToken() defaults userId=1, so the admin user
 *     must be seeded with id: 1 to keep downstream user lookups
 *     happy. See `apps/api/src/__tests__/integration/helpers/issue-test-jwt.ts`.
 */

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

/**
 * Build the header + cookie pair the CSRF middleware expects for a
 * mutating request. 64-hex matches the length check in
 * apps/api/src/middleware/csrf.ts; host and origin must agree for
 * the same-origin check to pass.
 */
function csrfHeaders(bearer: string) {
  const csrfToken = "a".repeat(64);
  return {
    authorization: `Bearer ${bearer}`,
    "content-type": "application/json",
    host: "test",
    origin: "https://test",
    "x-csrf-token": csrfToken,
    cookie: `csrf_token=${csrfToken}`,
  };
}

/**
 * YYYY-MM-DDTHH:mm:ss.sssZ matching zod's datetime() format, relative
 * to now. Centralised so all tests use the same clock and overrides
 * cannot accidentally drift.
 */
function offsetIso(daysOffset: number): string {
  return new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000).toISOString();
}

describe("Coupons API — real integration", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;
  let restaurantId: string;
  let adminToken: string;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });

  afterAll(async () => {
    // Guarded so a beforeAll timeout does not cascade into a
    // second failure that obscures the original cause.
    if (testApp) await testApp.dispose();
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
    const restaurant = await seed.restaurant();
    restaurantId = String(restaurant.id);

    // Seed the admin user row with id=1 so downstream user lookups
    // (e.g., createdBy, audit logs) do not trip on a missing FK.
    await seed.user({
      id: 1,
      username: "admin-coupons",
      role: 0,
      restaurantId,
    });
    adminToken = await testApp.authHelper.adminToken(restaurantId);
  });

  // ── POST /coupons (create) ────────────────────────────────────────────────

  it("POST /coupons creates a percentage coupon and returns 201", async () => {
    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/coupons", {
        method: "POST",
        headers: csrfHeaders(adminToken),
        body: JSON.stringify({
          code: "WELCOME15",
          name: "Welcome 15% Off",
          description: "New customer welcome discount",
          discountType: "percentage",
          discountValue: 15,
          minOrderAmount: 50,
          maxDiscountAmount: 200,
          validFrom: offsetIso(0),
          validTo: offsetIso(30),
          restaurantId,
        }),
      }),
    );

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.data?.code).toBe("WELCOME15");
    expect(body.data?.discountType).toBe("percentage");
    expect(body.data?.discountValue).toBe(15);
  });

  it("POST /coupons creates a fixed-amount coupon and returns 201", async () => {
    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/coupons", {
        method: "POST",
        headers: csrfHeaders(adminToken),
        body: JSON.stringify({
          code: "FLAT50",
          name: "Flat $50 Off",
          discountType: "fixed",
          discountValue: 50,
          minOrderAmount: 200,
          validFrom: offsetIso(0),
          validTo: offsetIso(60),
          restaurantId,
        }),
      }),
    );

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.data?.code).toBe("FLAT50");
    expect(body.data?.discountType).toBe("fixed");
    expect(body.data?.discountValue).toBe(50);
  });

  // ── GET /coupons (list) ───────────────────────────────────────────────────

  it("GET /coupons lists seeded coupons for the admin", async () => {
    // Seed 3 coupons directly — faster than 3 POSTs and isolates the
    // list endpoint from the create endpoint.
    await seed.coupon(restaurantId, { code: "LIST1", name: "List Coupon 1" });
    await seed.coupon(restaurantId, { code: "LIST2", name: "List Coupon 2" });
    await seed.coupon(restaurantId, { code: "LIST3", name: "List Coupon 3" });

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/coupons?page=1&limit=20", {
        headers: { authorization: `Bearer ${adminToken}` },
      }),
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    // The coupons list endpoint may return either an array directly
    // or a paginated shape { items, pagination }. Accept both.
    const items = Array.isArray(body.data)
      ? body.data
      : (body.data?.items ?? body.data?.coupons ?? []);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(3);
    const codes = items.map((c: any) => c.code);
    expect(codes).toEqual(expect.arrayContaining(["LIST1", "LIST2", "LIST3"]));
  });

  // ── POST /coupons/validate (public, CSRF-excluded) ───────────────────────

  it("POST /coupons/validate accepts an active coupon and returns discount math", async () => {
    // seed.coupon() defaults to validFrom: yesterday, validTo: +30d,
    // isActive: true, isVisible: true, discountType: percentage, value: 10.
    const created = await seed.coupon(restaurantId);

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/coupons/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: created.code,
          restaurantId,
          orderAmount: 500,
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.data?.valid).toBe(true);
    // 10% of 500 = 50. The service may or may not surface
    // discountAmount/finalAmount depending on wire shape; assert what
    // legacy asserted — just that the fields are populated.
    expect(body.data?.discountAmount).toBeDefined();
    expect(body.data?.finalAmount).toBeDefined();
  });

  it("POST /coupons/validate returns valid:false for an expired coupon", async () => {
    // Past window — seed.coupon with explicit date strings.
    const created = await seed.coupon(restaurantId, {
      code: "EXPIRED99",
      validFrom: "2020-01-01",
      validTo: "2020-12-31",
    });

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/coupons/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: created.code,
          restaurantId,
          orderAmount: 100,
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    // Validation returns valid:false for expired coupons (does NOT throw).
    expect(body.data?.valid).toBe(false);
    expect(body.data?.error).toBeDefined();
  });

  // ── POST /coupons/:id/deactivate ──────────────────────────────────────────

  it("POST /coupons/:id/deactivate flips isActive to false", async () => {
    const created = await seed.coupon(restaurantId, { code: "DEACT10" });

    const res = await testApp.app.fetch(
      new Request(`https://test/api/v1/coupons/${created.id}/deactivate`, {
        method: "POST",
        headers: csrfHeaders(adminToken),
      }),
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    // The wire shape may return camelCase or snake_case depending on
    // the transform — accept both so a wire refactor doesn't flake.
    const isActive = body.data?.isActive ?? body.data?.is_active;
    expect(isActive === false || isActive === 0).toBe(true);
  });

  // ── Auth gate on list endpoint ────────────────────────────────────────────

  it("GET /coupons without Authorization returns 401", async () => {
    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/coupons"),
    );

    expect(res.status).toBe(401);
    const body: any = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });
});
