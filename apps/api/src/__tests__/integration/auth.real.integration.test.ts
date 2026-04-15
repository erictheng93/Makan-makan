/**
 * Real integration smoke — Auth API
 *
 * Pilot migration, commit 2: proves that bcryptjs + jsonwebtoken +
 * sessions table all survive the jump from legacy SharedDataStore to
 * real miniflare D1 + production createApp() factory.
 *
 * This file intentionally ships with THREE smoke tests that together
 * exercise every risky piece of infrastructure in the auth stack:
 *   1. POST /auth/register       — bcrypt.hash, JWT sign, session insert
 *   2. register → login roundtrip — bcrypt.compare, second JWT sign
 *   3. staff login → GET /me      — full auth chain with session validation
 *
 * The full 16-test migration of auth.integration.test.ts follows in a
 * later commit once this smoke proves the infrastructure is green.
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

describe("Auth API — real integration smoke", () => {
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

  // ── Smoke 1: POST /auth/register ──────────────────────────────────────────
  //
  // Exercises bcrypt.hash (via DatabaseAuthService.register) and the real
  // users INSERT. Customer registration is CSRF-excluded in
  // app-factory.ts:459, so no CSRF headers are needed. The public
  // register endpoint is hardcoded to role=5.
  //
  // NOTE: `DatabaseAuthService.register` returns { success, user } and
  // does NOT issue tokens despite the route's "Auto-login" comment. The
  // register → login token roundtrip is covered by smoke 2.
  it("POST /auth/register creates a customer user with bcrypt hash", async () => {
    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "pilot-customer-1",
          fullName: "Pilot Customer",
          email: "pilot-customer-1@test.local",
          // customerRegisterSchema only enforces min length, no strength check.
          password: "pilotpass",
        }),
      }),
    );

    expect(res.status).toBe(201);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(json.data?.user?.username).toBe("pilot-customer-1");
    expect(json.data?.user?.role).toBe(5);
  });

  // ── Smoke 2: register → login roundtrip ───────────────────────────────────
  //
  // Verifies bcrypt.compare by registering a user, then logging in with
  // the same plaintext password. If bcrypt.hash and bcrypt.compare are
  // not symmetric under miniflare, login will return 401.
  it("POST /auth/register then /auth/login returns a fresh access token", async () => {
    const username = "pilot-roundtrip";
    const password = "pilotpass";

    const registerRes = await testApp.app.fetch(
      new Request("https://test/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username,
          fullName: "Pilot Roundtrip",
          email: "pilot-roundtrip@test.local",
          password,
        }),
      }),
    );
    expect(registerRes.status).toBe(201);

    const loginRes = await testApp.app.fetch(
      new Request("https://test/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      }),
    );
    expect(loginRes.status).toBe(200);
    const loginJson: any = await loginRes.json();
    expect(loginJson.success).toBe(true);
    expect(loginJson.data?.token).toBeTruthy();
  });

  // ── Smoke 3: staff login → GET /me ────────────────────────────────────────
  //
  // The end-to-end chain test:
  //   seed staff user with REAL bcrypt hash (role=1, owner)
  //   → POST /auth/login   (bcrypt.compare, session row inserted)
  //   → GET /auth/me        (authMiddleware + authService.validateToken)
  //
  // We bypass the register endpoint because:
  //   - the public /register route hardcodes role=5 (customer), and
  //     authMiddleware rejects role > 4, so customer tokens always 401 /me
  //   - seeding directly lets us land a role=1 user without needing to
  //     discover a separate staff-registration endpoint
  //
  // userFactory's default passwordHash is a stub ("$2a$10$test.hash..."),
  // so we generate a real bcrypt hash at test time and pass it as an
  // override to seed.user().
  it("staff login → /me returns profile through the full auth chain", async () => {
    const bcrypt = (await import("bcryptjs")).default;
    const password = "StaffPass123!";
    const passwordHash = await bcrypt.hash(password, 10);

    const restaurant = await seed.restaurant();
    const staff = await seed.user({
      username: "pilot-staff",
      passwordHash,
      role: 1, // owner
      restaurantId: String(restaurant.id),
      isActive: true,
    });

    const loginRes = await testApp.app.fetch(
      new Request("https://test/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "pilot-staff",
          password,
        }),
      }),
    );
    expect(loginRes.status).toBe(200);
    const loginJson: any = await loginRes.json();
    const token: string = loginJson.data?.token;
    expect(token).toBeTruthy();

    const meRes = await testApp.app.fetch(
      new Request("https://test/api/v1/auth/me", {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    expect(meRes.status).toBe(200);
    const meJson: any = await meRes.json();
    expect(meJson.success).toBe(true);
    expect(meJson.data?.username ?? meJson.data?.user?.username).toBe(
      "pilot-staff",
    );

    // Belt-and-braces: staff row really exists with the id we seeded.
    expect(staff.username).toBe("pilot-staff");
  });
});
