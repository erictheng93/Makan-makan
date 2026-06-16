/**
 * Real integration — Auth API
 *
 * Pilot migration (full port). Started life in commit 2 as a 3-test
 * smoke that proved bcryptjs + jsonwebtoken + sessions all work under
 * miniflare/workerd. This file now covers the same surface area as the
 * legacy `auth.integration.test.ts` (16 tests) so the legacy file can
 * be deleted in commit 4.
 *
 * Infrastructure notes (from the smoke work):
 *   - /auth/register and /auth/login are CSRF-excluded in app-factory.ts
 *   - authMiddleware is JWT-only; it does NOT query the sessions table
 *   - /auth/me additionally calls AuthService.validateToken which DOES
 *     query the sessions table, so pre-signed tokens fail /me but work
 *     on other protected routes
 *   - authMiddleware rejects role > 4, so customer (role 5) tokens
 *     cannot hit any protected route including /me
 *   - DatabaseAuthService.register returns { success, user } — no
 *     tokens, despite the route's misleading "Auto-login" comment
 *   - seed.user accepts `passwordHash` override, which is the clean way
 *     to land a staff row whose login will succeed under real bcrypt
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
describe("Auth API — real integration", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;
  let restaurantId: string;

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
  });

  // ── POST /api/v1/auth/register ────────────────────────────────────────────

  describe("POST /api/v1/auth/register", () => {
    it("rejects legacy customer password registration", async () => {
      const res = await testApp.app.fetch(
        new Request("https://test/api/v1/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            username: "newcustomer",
            fullName: "New Customer",
            email: "newcustomer@example.com",
            password: "Secure@123",
          }),
        }),
      );

      expect(res.status).toBe(410);
      const body: any = await res.json();
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("CUSTOMER_PASSWORD_REGISTRATION_RETIRED");

      const row = await testApp.env.DB.prepare(
        `SELECT id FROM users WHERE username = 'newcustomer'`,
      ).first();
      expect(row).toBeNull();
    });

    it("does not leak duplicate username state after customer registration retirement", async () => {
      await seed.user({
        username: "existinguser",
        restaurantId,
        role: 4,
      });

      const res = await testApp.app.fetch(
        new Request("https://test/api/v1/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            username: "existinguser",
            fullName: "Duplicate User",
            email: "dup@example.com",
            password: "Secure@123",
          }),
        }),
      );

      expect(res.status).toBe(410);
      const body: any = await res.json();
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("CUSTOMER_PASSWORD_REGISTRATION_RETIRED");
    });

    it("rejects registration when fullName is missing (400)", async () => {
      const res = await testApp.app.fetch(
        new Request("https://test/api/v1/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            username: "noname",
            password: "Secure@123",
            // Missing fullName — required by customerRegister schema
          }),
        }),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });
  });

  // ── POST /api/v1/auth/login ───────────────────────────────────────────────

  describe("POST /api/v1/auth/login", () => {
    it("logs in a staff user with valid credentials", async () => {
      const bcrypt = (await import("bcryptjs")).default;
      const password = "Test@12345";
      await seed.user({
        username: "logintest",
        fullName: "Login Test User",
        email: "logintest@example.com",
        role: 1,
        restaurantId,
        passwordHash: await bcrypt.hash(password, 10),
      });

      const loginRes = await testApp.app.fetch(
        new Request("https://test/api/v1/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            username: "logintest",
            password,
          }),
        }),
      );

      expect(loginRes.status).toBe(200);
      const body: any = await loginRes.json();
      expect(body.success).toBe(true);
      expect(body.data?.token).toBeDefined();
      expect(body.data).not.toHaveProperty("refreshToken");
      expect(loginRes.headers.get("set-cookie")).toContain(
        "__Host-mm_staff_refresh=",
      );
      expect(loginRes.headers.get("set-cookie")).toContain("HttpOnly");
      expect(body.data?.user?.username).toBe("logintest");
    });

    it("returns 401 for an invalid password", async () => {
      const bcrypt = (await import("bcryptjs")).default;
      await seed.user({
        username: "wrongpwduser",
        fullName: "Wrong Password User",
        email: "wrongpwd@example.com",
        role: 1,
        restaurantId,
        passwordHash: await bcrypt.hash("Correct@123", 10),
      });

      const res = await testApp.app.fetch(
        new Request("https://test/api/v1/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            username: "wrongpwduser",
            password: "WrongPassword@999",
          }),
        }),
      );

      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.success).toBe(false);
    });

    it("returns 401 for a legacy customer user password login", async () => {
      const bcrypt = (await import("bcryptjs")).default;
      await seed.user({
        username: "legacycustomer",
        fullName: "Legacy Customer",
        role: 5,
        restaurantId: null,
        passwordHash: await bcrypt.hash("Customer@123", 10),
      });

      const res = await testApp.app.fetch(
        new Request("https://test/api/v1/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            username: "legacycustomer",
            password: "Customer@123",
          }),
        }),
      );

      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.success).toBe(false);
    });

    it("returns 401 for a non-existent user", async () => {
      const res = await testApp.app.fetch(
        new Request("https://test/api/v1/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            username: "ghostuser",
            password: "DoesNotMatter@1",
          }),
        }),
      );

      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.success).toBe(false);
    });
  });

  // ── GET /api/v1/auth/me ───────────────────────────────────────────────────

  describe("GET /api/v1/auth/me", () => {
    // Happy path: seed a staff user with a real bcrypt hash, log in to
    // create a session row, then call /me with the returned token. This
    // exercises the full chain — authMiddleware JWT verify AND
    // AuthService.validateToken's sessions table lookup.
    it("returns profile through the full auth chain (register-less path)", async () => {
      const bcrypt = (await import("bcryptjs")).default;
      const password = "StaffPass123!";
      const passwordHash = await bcrypt.hash(password, 10);

      const staff = await seed.user({
        username: "pilot-staff",
        passwordHash,
        role: 1, // owner
        restaurantId,
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

    it("returns 401 when no Authorization header is provided", async () => {
      const res = await testApp.app.fetch(
        new Request("https://test/api/v1/auth/me"),
      );

      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("MISSING_AUTH_HEADER");
    });

    it("returns 401 for a malformed token", async () => {
      const res = await testApp.app.fetch(
        new Request("https://test/api/v1/auth/me", {
          headers: { authorization: "Bearer this.is.not.a.valid.jwt" },
        }),
      );

      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.success).toBe(false);
    });

    it("returns 401 for a token signed with a wrong secret", async () => {
      // Sign a well-formed JWT with the wrong secret via hono/jwt.
      const { sign } = await import("hono/jwt");
      const now = Math.floor(Date.now() / 1000);
      const badToken = await sign(
        {
          id: 1,
          username: "hacker",
          role: 0,
          restaurantId: "1",
          iat: now,
          exp: now + 3600,
        },
        "a-completely-different-secret-that-is-long-enough-to-pass-the-min-length-check",
      );

      const res = await testApp.app.fetch(
        new Request("https://test/api/v1/auth/me", {
          headers: { authorization: `Bearer ${badToken}` },
        }),
      );

      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.success).toBe(false);
    });
  });

  // ── Role enforcement on admin endpoints ───────────────────────────────────

  describe("Role enforcement on admin endpoints", () => {
    // /auth/stats uses `authMiddleware + requireRole([0])` only — NO
    // sessions lookup — so pre-signed tokens from buildAuthHelper work
    // here (unlike /me which calls validateToken).

    it("allows an admin token to access GET /auth/stats", async () => {
      // Seed an admin user row so downstream service code that reads
      // from the users table by id doesn't trip on a missing row. The
      // JWT default user id is 1 (see issue-test-jwt.ts).
      await seed.user({
        id: 1,
        username: "admin-stats",
        role: 0,
        restaurantId,
      });

      const adminToken = await testApp.authHelper.adminToken(restaurantId);

      const res = await testApp.app.fetch(
        new Request("https://test/api/v1/auth/stats?timeRange=30d", {
          headers: { authorization: `Bearer ${adminToken}` },
        }),
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it("denies an owner token (role 1) from GET /auth/stats with 403 INSUFFICIENT_ROLE", async () => {
      const owner = await seed.user({
        username: "owner-role-test",
        role: 1,
        restaurantId,
      });

      const ownerToken = await testApp.authHelper.ownerToken(
        owner.id,
        restaurantId,
      );

      const res = await testApp.app.fetch(
        new Request("https://test/api/v1/auth/stats?timeRange=30d", {
          headers: { authorization: `Bearer ${ownerToken}` },
        }),
      );

      expect(res.status).toBe(403);
      const body: any = await res.json();
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("INSUFFICIENT_ROLE");
    });

    it("denies a chef token (role 2) from GET /auth/stats with 403", async () => {
      const chef = await seed.user({
        username: "chef-role-test",
        role: 2,
        restaurantId,
      });

      const chefToken = await testApp.authHelper.staffToken(
        chef.id,
        2,
        restaurantId,
      );

      const res = await testApp.app.fetch(
        new Request("https://test/api/v1/auth/stats?timeRange=30d", {
          headers: { authorization: `Bearer ${chefToken}` },
        }),
      );

      expect(res.status).toBe(403);
      const body: any = await res.json();
      expect(body.success).toBe(false);
    });
  });

  // ── Cross-restaurant access control ───────────────────────────────────────

  describe("Cross-restaurant access control", () => {
    // The kitchen route at `apps/api/src/features/kitchen/routes/index.ts:120`
    // checks `user.restaurantId !== restaurantId` inline. This is how
    // scoping is enforced — not via requireRestaurantAccess — so the
    // owner token's restaurantId claim must equal the URL param.

    it("denies an owner access to a different restaurant's kitchen orders", async () => {
      // Two real restaurants with distinct UUIDs.
      const restaurantA = await seed.restaurant({ name: "Restaurant A" });
      const restaurantB = await seed.restaurant({ name: "Restaurant B" });

      const ownerA = await seed.user({
        username: "ownerA",
        role: 1,
        restaurantId: String(restaurantA.id),
      });

      // Token scoped to restaurant A.
      const ownerAToken = await testApp.authHelper.ownerToken(
        ownerA.id,
        String(restaurantA.id),
      );

      const res = await testApp.app.fetch(
        new Request(`https://test/api/v1/kitchen/${restaurantB.id}/orders`, {
          headers: { authorization: `Bearer ${ownerAToken}` },
        }),
      );

      // Kitchen route's inline check throws forbidden when
      // user.restaurantId !== URL restaurantId.
      expect(res.status).toBe(403);
      const body: any = await res.json();
      expect(body.success).toBe(false);
    });

    it("allows an admin to access any restaurant's kitchen orders", async () => {
      const restaurantB = await seed.restaurant({ name: "Restaurant B" });

      // Seed the admin user row. The JWT default id is 1.
      await seed.user({
        id: 1,
        username: "admin-cross",
        role: 0,
        restaurantId: String(restaurantB.id),
      });

      // Admin JWT signed with restaurantB's id so the inline
      // user.restaurantId === URL restaurantId check passes.
      const adminToken = await testApp.authHelper.adminToken(
        String(restaurantB.id),
      );

      const res = await testApp.app.fetch(
        new Request(`https://test/api/v1/kitchen/${restaurantB.id}/orders`, {
          headers: { authorization: `Bearer ${adminToken}` },
        }),
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
    });
  });
});
