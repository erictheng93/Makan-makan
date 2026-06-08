/**
 * Production / Staging Smoke Test
 *
 * Minimal canary that runs against any deployed environment (local, staging,
 * production) and exits fast. Three layers, gated by environment variables:
 *
 *   Layer 1 (always runs)
 *     - GET /info returns 200 with deployment metadata
 *     - GET / returns HTML (customer app)
 *     - GET /api/v1/<bogus> returns 404 (router still mounted correctly)
 *
 *   Layer 2 (skipped unless SMOKE_AUTH_USERNAME + SMOKE_AUTH_PASSWORD set)
 *     - Auth login returns token
 *     - Authenticated read against /api/v1/orders succeeds
 *
 *   Layer 3 (skipped unless SMOKE_RESTAURANT_ID + SMOKE_MENU_ITEM_ID set,
 *   or local API + Layer 2 credentials can discover the owner's seeded
 *   restaurant and first available menu item)
 *     - Guest order create + guest-token read round-trip + cancel cleanup
 *
 *   Admin realtime WebSocket coverage lives in
 *     tests/e2e/smoke/admin-realtime-websocket.spec.ts and is skipped unless
 *     SMOKE_ADMIN_URL + Layer 2 credentials + SMOKE_RESTAURANT_ID are set;
 *     for localhost, SMOKE_ADMIN_URL defaults to http://localhost:3001 and
 *     SMOKE_RESTAURANT_ID can be discovered from the login response.
 *
 * Production smoke (deploy-production.yml) runs Layer 1 only — no
 * credentials configured, no test data created in prod. Staging smoke runs
 * all three layers because staging has seeded fixtures.
 *
 * Env vars (with localhost fallbacks for the local dev project):
 *   SMOKE_API_URL          — API base, e.g. https://api.staging.makanmakan.app
 *   SMOKE_CUSTOMER_URL     — customer app base, e.g. https://staging.makanmakan.app
 *   SMOKE_AUTH_USERNAME    — seeded user for Layer 2 (e.g. admin in staging)
 *   SMOKE_AUTH_PASSWORD    — password for SMOKE_AUTH_USERNAME
 *   SMOKE_RESTAURANT_ID    — seeded restaurant UUID for Layer 3; required
 *                            outside localhost
 *   SMOKE_MENU_ITEM_ID     — seeded menu item id for Layer 3; required outside
 *                            localhost
 *   SMOKE_ADMIN_URL        — admin dashboard base for admin realtime smoke;
 *                            defaults to http://localhost:3001 on localhost
 *   SMOKE_REALTIME_URL     — optional realtime HTTP base; derived from wsUrl
 *                            by the realtime smoke when omitted
 */

import { test, expect } from "@playwright/test";
import { optionalEnv, resolveLocalSmokeFixtureIds } from "./smoke-env";

const API_URL = process.env.SMOKE_API_URL || "http://localhost:8787";
const CUSTOMER_URL = process.env.SMOKE_CUSTOMER_URL || "http://localhost:3000";

const AUTH_USERNAME = optionalEnv("SMOKE_AUTH_USERNAME");
const AUTH_PASSWORD = optionalEnv("SMOKE_AUTH_PASSWORD");

const RESTAURANT_ID = optionalEnv("SMOKE_RESTAURANT_ID");
const menuItemIdValue = optionalEnv("SMOKE_MENU_ITEM_ID");
const MENU_ITEM_ID = menuItemIdValue ? Number(menuItemIdValue) : undefined;

// ─── Layer 1: unauthenticated liveness ──────────────────────────────────────

test.describe("Smoke: Layer 1 (unauthenticated liveness)", () => {
  test("GET /info returns 200 with deployment metadata", async () => {
    const res = await fetch(`${API_URL}/info`);
    expect(res.status, `${API_URL}/info status`).toBe(200);
    const body = await res.json();
    // /info shape is defined in apps/api/src/app-factory.ts:344 — must include
    // a deployment mode marker so a stale build / wrong env can't pass.
    expect(body).toEqual(
      expect.objectContaining({
        deployment: expect.objectContaining({
          mode: expect.any(String),
        }),
      }),
    );
  });

  test("GET / returns HTML (customer app reachable)", async () => {
    const res = await fetch(CUSTOMER_URL);
    expect(res.status, `${CUSTOMER_URL} status`).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(400);
    const contentType = res.headers.get("content-type") ?? "";
    expect(contentType.toLowerCase()).toContain("html");
  });

  test("GET unknown /api/v1/* returns 404 (router mounted)", async () => {
    // If routing is broken (e.g. wrangler config drift), bogus paths might
    // 200 with an SPA fallback or 502 from upstream. 404 from the API
    // confirms the API handler is the one responding.
    const res = await fetch(
      `${API_URL}/api/v1/__smoke_bogus_path_${Date.now()}`,
    );
    expect(res.status, "bogus API path should 404").toBe(404);
  });
});

// ─── Layer 2: authenticated read ────────────────────────────────────────────

const layer2Reason =
  "SMOKE_AUTH_USERNAME / SMOKE_AUTH_PASSWORD not set — skipping Layer 2";

test.describe("Smoke: Layer 2 (authenticated read)", () => {
  test("login returns token then GET /api/v1/orders succeeds", async () => {
    test.skip(!AUTH_USERNAME || !AUTH_PASSWORD, layer2Reason);

    const loginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: AUTH_USERNAME,
        password: AUTH_PASSWORD,
      }),
    });
    expect(loginRes.ok, `login status ${loginRes.status}`).toBe(true);
    const loginBody = (await loginRes.json()) as {
      success: boolean;
      data?: { token?: string };
    };
    expect(loginBody.success).toBe(true);
    const token = loginBody.data?.token;
    expect(typeof token, "login response missing token").toBe("string");

    const ordersRes = await fetch(`${API_URL}/api/v1/orders?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ordersRes.ok, `authenticated read status ${ordersRes.status}`).toBe(
      true,
    );
    const ordersBody = (await ordersRes.json()) as { success: boolean };
    expect(ordersBody.success).toBe(true);
  });
});

// ─── Layer 3: guest happy path ──────────────────────────────────────────────

const layer3Reason =
  "SMOKE_RESTAURANT_ID / SMOKE_MENU_ITEM_ID not set and local discovery " +
  "did not find them — skipping Layer 3";

interface GuestOrderResponse {
  success: boolean;
  data?: {
    order?: { id?: number };
    guestToken?: string;
  };
}

test.describe("Smoke: Layer 3 (guest happy path round-trip)", () => {
  test("create guest order, read with guest token, then cancel", async () => {
    const fixtureIds = await resolveLocalSmokeFixtureIds({
      apiUrl: API_URL,
      authUsername: AUTH_USERNAME,
      authPassword: AUTH_PASSWORD,
      restaurantId: RESTAURANT_ID,
      menuItemId: MENU_ITEM_ID,
    });

    test.skip(
      !fixtureIds.restaurantId || fixtureIds.menuItemId === undefined,
      layer3Reason,
    );

    // Use a randomized 3-digit phone to avoid the active-order-per-phone
    // dedup KV key biting the smoke test on consecutive runs.
    const phoneLastDigits = String(100 + Math.floor(Math.random() * 900));

    const createRes = await fetch(`${API_URL}/api/v1/guest-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: fixtureIds.restaurantId,
        orderType: "shop",
        items: [{ menuItemId: fixtureIds.menuItemId, quantity: 1 }],
        guestName: "smoke-test",
        phoneLastDigits,
      }),
    });
    expect(createRes.ok, `guest order create status ${createRes.status}`).toBe(
      true,
    );
    const createBody = (await createRes.json()) as GuestOrderResponse;
    expect(createBody.success).toBe(true);
    const orderId = createBody.data?.order?.id;
    const guestToken = createBody.data?.guestToken;
    expect(typeof orderId, "missing order.id").toBe("number");
    expect(typeof guestToken, "missing guestToken").toBe("string");

    try {
      const readRes = await fetch(`${API_URL}/api/v1/guest-orders/${orderId}`, {
        headers: { Authorization: `Bearer ${guestToken}` },
      });
      expect(readRes.ok, `guest order read status ${readRes.status}`).toBe(
        true,
      );
    } finally {
      // Always attempt cleanup so a failed assertion doesn't leak an order
      // into the staging dataset.
      if (orderId !== undefined && guestToken) {
        await fetch(`${API_URL}/api/v1/guest-orders/${orderId}/cancel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${guestToken}` },
        }).catch(() => {
          /* best-effort cleanup */
        });
      }
    }
  });
});
