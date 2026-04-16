/**
 * Real integration smoke — Customer Orders API
 * GET /api/v1/customers/me/orders
 *
 * This suite verifies the customer-facing orders path now works end-to-end.
 *
 * The endpoint `GET /api/v1/customers/me/orders` must accept customer
 * tokens and scope results to the authenticated customer.
 *
 * The tests below assert the fixed behavior: customers should receive
 * 200 and only see their own orders, while staff/owners remain blocked by
 * `requireRole([5])`.
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

const ENDPOINT = "https://test/api/v1/customers/me/orders";

describe("Customer Orders API — real integration", () => {
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

  // ── Test 1: No Authorization header ────────────────────────────────────────
  it("returns 401 when no Authorization header is present", async () => {
    const res = await testApp.app.fetch(new Request(ENDPOINT));

    expect(res.status).toBe(401);
    const json: any = await res.json();
    expect(json.success).toBe(false);
    expect(json.error?.code).toBeDefined();
  });

  // Customer token (role=5) should now be accepted and scoped to the
  // authenticated customer only.
  it("returns 200 for a customer token (role=5) and scopes orders to that customer", async () => {
    const restaurant = await seed.restaurant();

    // Seed two customers each with a real user row so FK constraints are satisfied.
    const customer100 = await seed.user({
      id: 100,
      role: 5,
      username: "customer-100",
    });
    const customer200 = await seed.user({
      id: 200,
      role: 5,
      username: "customer-200",
    });

    // Two orders — one owned by each customer.
    await seed.order(restaurant.id, { customerId: customer100.id });
    await seed.order(restaurant.id, { customerId: customer200.id });

    // Issue a customer-role JWT. The authHelper accepts role=5.
    const customerToken = await testApp.authHelper.customerToken(
      customer100.id,
    );

    const res = await testApp.app.fetch(
      new Request(ENDPOINT, {
        headers: { authorization: `Bearer ${customerToken}` },
      }),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].customerId).toBe(customer100.id);
  });

  // ── Test 3: Staff token (role=1 — owner) — documents scope-mismatch gate ──
  //
  // A staff/owner token passes the customer-auth middleware (role ≤ 4) but is
  // rejected by the per-route `requireRole([5])` guard. This test documents
  // that non-customer roles are explicitly blocked even after the global auth
  // check passes.
  it("returns 403 for a staff/owner token (role=1) — requireRole([5]) rejects non-customers", async () => {
    const restaurant = await seed.restaurant();

    // Seed an owner user so the FK is valid for the token's userId.
    const owner = await seed.user({
      id: 10,
      role: 1,
      username: "owner-user",
    });

    const ownerToken = await testApp.authHelper.ownerToken(
      owner.id,
      String(restaurant.id),
    );

    const res = await testApp.app.fetch(
      new Request(ENDPOINT, {
        headers: { authorization: `Bearer ${ownerToken}` },
      }),
    );

    // Owner passes customer-auth middleware (role=1 ≤ 4) but fails requireRole([5]).
    // The per-route requireRole guard returns 403 for any caller who is not role=5.
    expect(res.status).toBe(403);
    const json: any = await res.json();
    expect(json.success).toBe(false);
    expect(json.error?.code).toBeDefined();
  });
});
