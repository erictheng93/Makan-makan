/**
 * Coupons API Integration Tests
 *
 * Tests coupon CRUD, validation, and auth enforcement against
 * the full Hono app with SharedDataStore (no vi.mock calls).
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  createIntegrationTestApp,
  type IntegrationTestApp,
} from "./helpers/extended-test-app";
import {
  seedRestaurant,
  seedAdmin,
  clearAllTables,
  type SeedContext,
} from "./helpers/seed-helper";

describe("Coupons API Integration", () => {
  let ctx: IntegrationTestApp;
  let seedCtx: SeedContext;
  let restaurantId: number;
  let adminToken: string;

  beforeAll(async () => {
    ctx = await createIntegrationTestApp();
  });

  beforeEach(async () => {
    clearAllTables({ db: ctx.db, dataStore: ctx.dataStore });

    seedCtx = { db: ctx.db, dataStore: ctx.dataStore };

    const restaurant = await seedRestaurant(seedCtx);
    restaurantId = restaurant.id;

    const admin = await seedAdmin(seedCtx, restaurantId);
    adminToken = ctx.authHelper.adminToken(restaurantId);
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const futureDate = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return d.toISOString();
  };

  const pastDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
  };

  function seedCoupon(overrides: Record<string, any> = {}) {
    const now = new Date().toISOString();
    return ctx.dataStore.insert("coupons", {
      restaurantId: String(restaurantId),
      code: "TEST10",
      name: "Test Coupon",
      description: "Integration test coupon",
      discountType: "percentage",
      discountValue: 10,
      minOrderAmount: 0,
      maxDiscountAmount: null,
      usageLimit: 100,
      usageLimitPerUser: 1,
      usedCount: 0,
      validFrom: now,
      validTo: futureDate(30),
      isActive: 1,
      isVisible: 1,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
  }

  // ─── Test Cases ────────────────────────────────────────────────────────────

  it("POST /api/v1/coupons - should create a percentage coupon", async () => {
    const res = await ctx.app.request("/api/v1/coupons", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        code: "WELCOME15",
        name: "Welcome 15% Off",
        description: "New customer welcome discount",
        discountType: "percentage",
        discountValue: 15,
        minOrderAmount: 50,
        maxDiscountAmount: 200,
        validFrom: futureDate(0),
        validTo: futureDate(30),
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.code).toBe("WELCOME15");
    expect(body.data.discountType).toBe("percentage");
    expect(body.data.discountValue).toBe(15);
  });

  it("POST /api/v1/coupons - should create a fixed-amount coupon", async () => {
    const res = await ctx.app.request("/api/v1/coupons", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        code: "FLAT50",
        name: "Flat $50 Off",
        discountType: "fixed",
        discountValue: 50,
        minOrderAmount: 200,
        validFrom: futureDate(0),
        validTo: futureDate(60),
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.code).toBe("FLAT50");
    expect(body.data.discountType).toBe("fixed");
    expect(body.data.discountValue).toBe(50);
  });

  it("GET /api/v1/coupons - should list coupons", async () => {
    // Seed coupons directly
    seedCoupon({ code: "LIST1", name: "List Coupon 1" });
    seedCoupon({ code: "LIST2", name: "List Coupon 2" });
    seedCoupon({ code: "LIST3", name: "List Coupon 3" });

    const res = await ctx.app.request("/api/v1/coupons?page=1&limit=20", {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(3);
  });

  it("POST /api/v1/coupons/validate - should validate a valid coupon code", async () => {
    // Seed an active, visible coupon with valid date range via the API
    // (the validate endpoint uses Drizzle query.coupons.findFirst which needs
    //  isVisible, validFrom, validTo columns that the DB schema supports)
    const createRes = await ctx.app.request("/api/v1/coupons", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        code: "VALID20",
        name: "Valid 20% Off",
        discountType: "percentage",
        discountValue: 20,
        validFrom: pastDate(1),
        validTo: futureDate(30),
        isActive: true,
        isVisible: true,
        restaurantId: String(restaurantId),
      }),
    });
    expect(createRes.status).toBe(201);

    const res = await ctx.app.request("/api/v1/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "VALID20",
        restaurantId: String(restaurantId),
        orderAmount: 500,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.valid).toBe(true);
    expect(body.data.discountAmount).toBeDefined();
    expect(body.data.finalAmount).toBeDefined();
  });

  it("POST /api/v1/coupons/validate - should reject an expired coupon", async () => {
    // Create coupon that has already expired
    const createRes = await ctx.app.request("/api/v1/coupons", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        code: "EXPIRED99",
        name: "Expired Coupon",
        discountType: "percentage",
        discountValue: 99,
        validFrom: pastDate(60),
        validTo: pastDate(1),
        isActive: true,
        isVisible: true,
        restaurantId: String(restaurantId),
      }),
    });
    expect(createRes.status).toBe(201);

    const res = await ctx.app.request("/api/v1/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "EXPIRED99",
        restaurantId: String(restaurantId),
        orderAmount: 100,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // Validation returns valid:false for expired coupons (it does not throw)
    expect(body.data.valid).toBe(false);
    expect(body.data.error).toBeDefined();
  });

  it("POST /api/v1/coupons/:id/deactivate - should deactivate a coupon", async () => {
    // Create a coupon first
    const createRes = await ctx.app.request("/api/v1/coupons", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        code: "DEACT10",
        name: "To Be Deactivated",
        discountType: "percentage",
        discountValue: 10,
        validFrom: futureDate(0),
        validTo: futureDate(30),
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const couponId = created.data.id;

    // Deactivate it
    const res = await ctx.app.request(
      `/api/v1/coupons/${couponId}/deactivate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    // MockDrizzle update may return snake_case keys and integer 0/1 for booleans
    const isActive = body.data.isActive ?? body.data.is_active;
    expect(isActive === false || isActive === 0).toBe(true);
  });

  it("GET /api/v1/coupons without auth should return 401", async () => {
    const res = await ctx.app.request("/api/v1/coupons");

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });
});
