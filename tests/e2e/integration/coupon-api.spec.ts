/**
 * Coupon API Integration Tests
 *
 * Tests coupon creation, validation, availability listing, deactivation, and deletion
 * against the real API at localhost:8787 with real D1 database.
 * All coupons created during the run are cleaned up in afterAll.
 */

import { test, expect } from "@playwright/test";
import { loginAs, RESTAURANT_ID, USERS } from "./helpers";

const API_URL = "http://localhost:8787";

// ─── Types ───

interface AuthCredentials {
  token: string;
  csrfToken: string;
  csrfCookie: string;
}

interface CouponData {
  id: number;
  code: string;
  name: string;
  restaurantId: string;
  discountType: string;
  discountValue: number;
  minOrderAmount: number | null;
  isActive: boolean;
  usageLimit: number | null;
  validFrom: string | null;
  validTo: string | null;
}

interface ValidateResult {
  valid: boolean;
  discountAmount?: number;
  finalAmount?: number;
  coupon?: { id: number; code: string; [key: string]: unknown };
  reason?: string;
  [key: string]: unknown;
}

// ─── Auth header helper ───

function authHeaders(auth: AuthCredentials): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.token}`,
    "X-CSRF-Token": auth.csrfToken,
    Cookie: auth.csrfCookie,
    Origin: API_URL,
  };
}

// ─── Auth cache — avoid repeated logins for the same user ───

const authCache = new Map<string, AuthCredentials>();

async function loginOnce(username: string): Promise<AuthCredentials> {
  if (authCache.has(username)) return authCache.get(username)!;
  const auth = await loginAs(username);
  authCache.set(username, auth);
  return auth;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });

test.describe("Coupon API", () => {
  // Unique per test run to avoid collision with leftover DB rows
  const COUPON_CODE = `E2ETEST_${Date.now()}`;
  const MINIMUM_ORDER = 30;
  const DISCOUNT_VALUE = 10; // 10%
  const ORDER_AMOUNT_VALID = 75; // 10% of 75 = 7.5
  const ORDER_AMOUNT_BELOW_MIN = 20;

  let createdCouponId: number | undefined;

  test.afterAll(async () => {
    if (createdCouponId !== undefined) {
      try {
        const auth = await loginOnce(USERS.ADMIN);
        await fetch(`${API_URL}/api/v1/coupons/${createdCouponId}`, {
          method: "DELETE",
          headers: authHeaders(auth),
        });
      } catch {
        // Swallow — best-effort cleanup
      }
    }
  });

  // ── 1. Owner creates a percentage-off coupon ────────────────────────────

  test("owner creates a percentage-off coupon", async () => {
    const auth = await loginOnce(USERS.OWNER);

    const res = await fetch(`${API_URL}/api/v1/coupons`, {
      method: "POST",
      headers: authHeaders(auth),
      body: JSON.stringify({
        code: COUPON_CODE,
        name: "E2E test 10% discount",
        restaurantId: RESTAURANT_ID,
        discountType: "percentage",
        discountValue: DISCOUNT_VALUE,
        minOrderAmount: MINIMUM_ORDER,
        isActive: true,
        usageLimit: 100,
        validFrom: "2025-01-01T00:00:00.000Z",
        validTo: "2027-12-31T23:59:59.000Z",
      }),
    });

    expect(res.status).toBe(201);

    const json = (await res.json()) as {
      success: boolean;
      data: CouponData;
    };

    expect(json.success).toBe(true);
    expect(json.data).toMatchObject({
      code: COUPON_CODE,
      discountType: "percentage",
      discountValue: DISCOUNT_VALUE,
      restaurantId: RESTAURANT_ID,
      isActive: true,
    });
    expect(json.data.id).toBeGreaterThan(0);

    createdCouponId = json.data.id;
  });

  // ── 2. GET /available/:restaurantId returns the newly created coupon ────

  test("GET /available/:restaurantId includes the newly created coupon", async () => {
    expect(createdCouponId).toBeDefined();

    const res = await fetch(
      `${API_URL}/api/v1/coupons/available/${RESTAURANT_ID}`,
    );

    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      data: CouponData[];
    };

    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);

    const found = json.data.find((c) => c.id === createdCouponId);
    expect(found).toBeDefined();
    expect(found?.code).toBe(COUPON_CODE);
    expect(found?.isActive).toBe(true);
  });

  // ── 2b. Owner GET /coupons (admin list, not cached) sees the new coupon ──

  test("owner GET /coupons sees the newly created coupon in the admin list", async () => {
    expect(createdCouponId).toBeDefined();

    const auth = await loginOnce(USERS.OWNER);
    const res = await fetch(`${API_URL}/api/v1/coupons`, {
      headers: {
        Authorization: `Bearer ${auth.token}`,
        Origin: API_URL,
      },
    });

    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      data: CouponData[];
    };
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);

    const found = json.data.find((c) => c.id === createdCouponId);
    expect(found).toBeDefined();
    expect(found).toMatchObject({
      code: COUPON_CODE,
      discountType: "percentage",
      discountValue: DISCOUNT_VALUE,
      isActive: true,
    });
  });

  // ── 3. POST /validate — valid code + sufficient amount returns discount ──

  test("POST /validate with valid code and sufficient order amount returns discount", async () => {
    const res = await fetch(`${API_URL}/api/v1/coupons/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: COUPON_CODE,
        restaurantId: RESTAURANT_ID,
        orderAmount: ORDER_AMOUNT_VALID,
      }),
    });

    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      data: ValidateResult;
    };

    expect(json.success).toBe(true);
    expect(json.data.valid).toBe(true);

    // 10% of 75 = 7.5 — the API rounds, so accept any value in [7, 8].
    if (json.data.discountAmount !== undefined) {
      expect(json.data.discountAmount).toBeGreaterThanOrEqual(7);
      expect(json.data.discountAmount).toBeLessThanOrEqual(8);
    }

    if (json.data.finalAmount !== undefined) {
      // Final = 75 - discount, so within [67, 68]
      expect(json.data.finalAmount).toBeGreaterThanOrEqual(67);
      expect(json.data.finalAmount).toBeLessThanOrEqual(68);
    }
  });

  // ── 4. POST /validate — unknown coupon code returns invalid ─────────────

  test("POST /validate with unknown coupon code returns invalid or 400", async () => {
    const res = await fetch(`${API_URL}/api/v1/coupons/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "DOES_NOT_EXIST_XYZ",
        restaurantId: RESTAURANT_ID,
        orderAmount: ORDER_AMOUNT_VALID,
      }),
    });

    if (res.status === 200) {
      const json = (await res.json()) as {
        success: boolean;
        data: ValidateResult;
      };
      expect(json.success).toBe(true);
      expect(json.data.valid).toBe(false);
    } else {
      // Some implementations return 400/404 for unknown codes — both are acceptable
      expect([400, 404]).toContain(res.status);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    }
  });

  // ── 5. POST /validate — order amount below minimum returns invalid ───────

  test("POST /validate with order amount below minimum returns invalid", async () => {
    const res = await fetch(`${API_URL}/api/v1/coupons/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: COUPON_CODE,
        restaurantId: RESTAURANT_ID,
        orderAmount: ORDER_AMOUNT_BELOW_MIN, // 20 < minimumOrderAmount 30
      }),
    });

    if (res.status === 200) {
      const json = (await res.json()) as {
        success: boolean;
        data: ValidateResult;
      };
      expect(json.success).toBe(true);
      expect(json.data.valid).toBe(false);
    } else {
      expect([400, 422]).toContain(res.status);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    }
  });

  // ── 6. Non-owner (chef) cannot create coupons → 403 ─────────────────────

  test("non-owner (chef) cannot create coupons — returns 403", async () => {
    const auth = await loginOnce(USERS.CHEF);

    const res = await fetch(`${API_URL}/api/v1/coupons`, {
      method: "POST",
      headers: authHeaders(auth),
      body: JSON.stringify({
        code: `CHEF_SHOULD_FAIL_${Date.now()}`,
        name: "Chef unauthorized coupon",
        restaurantId: RESTAURANT_ID,
        discountType: "percentage",
        discountValue: 5,
        isActive: true,
        validFrom: "2025-01-01T00:00:00.000Z",
        validTo: "2027-12-31T23:59:59.000Z",
      }),
    });

    expect(res.status).toBe(403);

    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(false);
  });

  // ── 7. Owner deactivates the coupon ─────────────────────────────────────

  test("owner can deactivate the coupon", async () => {
    expect(createdCouponId).toBeDefined();

    const auth = await loginOnce(USERS.OWNER);

    const res = await fetch(
      `${API_URL}/api/v1/coupons/${createdCouponId}/deactivate`,
      {
        method: "POST",
        headers: authHeaders(auth),
      },
    );

    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      data?: { isActive: boolean };
    };
    expect(json.success).toBe(true);

    // If the response includes the updated coupon, verify isActive is false
    if (json.data?.isActive !== undefined) {
      expect(json.data.isActive).toBe(false);
    }
  });

  // ── 8. Admin deletes the coupon ──────────────────────────────────────────

  test("admin can delete the coupon", async () => {
    expect(createdCouponId).toBeDefined();

    const auth = await loginOnce(USERS.ADMIN);

    const res = await fetch(`${API_URL}/api/v1/coupons/${createdCouponId}`, {
      method: "DELETE",
      headers: authHeaders(auth),
    });

    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);

    // Mark as cleaned up so afterAll skip is a no-op
    createdCouponId = undefined;
  });
});
