/**
 * Real integration smoke — Customer Orders API
 * GET /api/v1/customers/me/orders
 *
 * ══════════════════════════════════════════════════════════════════
 * PRODUCTION BUG DOCUMENTED HERE (do NOT fix in this file)
 * ══════════════════════════════════════════════════════════════════
 *
 * The endpoint `GET /api/v1/customers/me/orders` is permanently
 * inaccessible in production due to a double-middleware conflict:
 *
 *   1. app-factory.ts:445 registers `authMiddleware` globally on
 *      `/customers/*` via `apiV1.use("/customers/*", authMiddleware)`.
 *
 *   2. `authMiddleware` (apps/api/src/middleware/auth.ts:91-93) rejects
 *      every token whose `role` claim is > 4 with a 401 "Invalid role
 *      in token" error.
 *
 *   3. The route handler (apps/api/src/features/customers/routes/index.ts:41)
 *      also calls `authMiddleware` as the first per-route middleware and then
 *      `requireRole([5])` — but neither check is ever reached because the
 *      global middleware already returned 401 for the only valid caller
 *      (a customer with role=5).
 *
 *   4. Staff / owner tokens (role 0-4) pass the global `authMiddleware` but
 *      are then rejected by the per-route `requireRole([5])` with a 403.
 *
 * Net result: there is no role that can successfully call this endpoint.
 * Real customers (role=5) always receive 401 from the global middleware.
 *
 * The tests below assert the ACTUAL production behaviour, not the
 * intended behaviour. They are green when the bug is present and will
 * FAIL (loudly) once the bug is fixed — at which point the test
 * expectations should be updated to verify the correct happy-path.
 * ══════════════════════════════════════════════════════════════════
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

  // ── Test 2: Customer token (role=5) — documents the production bug ─────────
  //
  // A real customer token (role=5) is rejected by the GLOBAL authMiddleware
  // mounted in app-factory.ts before the route handler is ever reached.
  // The route's own `authMiddleware + requireRole([5])` chain is dead code
  // for real customers.
  //
  // BUG: This should return 200 with scoped orders. Fix requires either:
  //   (a) Remove the global `apiV1.use("/customers/*", authMiddleware)` from
  //       app-factory.ts and let the per-route middleware handle auth, OR
  //   (b) Widen authMiddleware to accept role=5 tokens and let requireRole
  //       gates enforce fine-grained access.
  it("returns 401 for a customer token (role=5) — global authMiddleware rejects role>4 [BUG]", async () => {
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

    // ACTUAL behaviour (bug present): global authMiddleware rejects role=5 → 401.
    // INTENDED behaviour (after fix): 200 with only customer100's orders in data.
    //
    // When the bug is fixed, replace the assertions below with:
    //   expect(res.status).toBe(200);
    //   const json: any = await res.json();
    //   expect(json.success).toBe(true);
    //   const orderIds = json.data.map((o: any) => o.customerId);
    //   expect(orderIds.every((id: number) => id === customer100.id)).toBe(true);
    expect(res.status).toBe(401);
    const json: any = await res.json();
    expect(json.success).toBe(false);
    expect(json.error?.code).toBeDefined();
  });

  // ── Test 3: Staff token (role=1 — owner) — documents scope-mismatch gate ──
  //
  // A staff/owner token passes the global authMiddleware (role ≤ 4) but is
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

    // Owner passes global authMiddleware (role=1 ≤ 4) but fails requireRole([5]).
    // The per-route requireRole guard returns 403 for any caller who is not role=5.
    expect(res.status).toBe(403);
    const json: any = await res.json();
    expect(json.success).toBe(false);
    expect(json.error?.code).toBeDefined();
  });
});
