/**
 * POS (Point of Sale) API Integration Tests
 *
 * Full HTTP-chain tests for the POS feature.
 * No vi.mock() calls — uses the real route handlers with an in-memory DB.
 *
 * POS routes live under /api/v1/pos and include:
 *   /registers   — register (cash register) management
 *   /shifts      — shift start/end lifecycle
 *   /receipts    — receipt printing
 *   /refunds     — refund processing
 *   /reports     — daily and shift reports
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  createIntegrationTestApp,
  type IntegrationTestApp,
} from "./helpers/extended-test-app";
import {
  seedRestaurant,
  seedAdmin,
  seedTable,
  seedCategory,
  seedMenuItem,
  seedOrderWithItems,
  clearAllTables,
  type SeedContext,
} from "./helpers/seed-helper";

describe("POS API Integration", () => {
  let app: IntegrationTestApp["app"];
  let ctx: SeedContext;
  let authHelper: IntegrationTestApp["authHelper"];
  let restaurantId: number;
  let adminToken: string;
  let adminUserId: number;

  // Seeded data reused across tests
  let tableId: number;
  let categoryId: number;
  let menuItem1: {
    id: number;
    name: string;
    price: number;
    categoryId: number;
  };
  let menuItem2: {
    id: number;
    name: string;
    price: number;
    categoryId: number;
  };

  beforeAll(async () => {
    const testApp = await createIntegrationTestApp();
    app = testApp.app;
    ctx = { db: testApp.db, dataStore: testApp.dataStore };
    authHelper = testApp.authHelper;
  });

  beforeEach(async () => {
    clearAllTables(ctx);

    // Seed restaurant, admin, table, category, and menu items
    const restaurant = await seedRestaurant(ctx);
    restaurantId = restaurant.id;

    const admin = await seedAdmin(ctx, restaurantId);
    adminUserId = admin.id;
    adminToken = authHelper.adminToken(restaurantId);

    const table = await seedTable(ctx, restaurantId, { number: 1 });
    tableId = table.id;

    const category = await seedCategory(ctx, restaurantId, { name: "Main" });
    categoryId = category.id;

    menuItem1 = await seedMenuItem(ctx, restaurantId, categoryId, {
      name: "Nasi Lemak",
      price: 12.5,
    });
    menuItem2 = await seedMenuItem(ctx, restaurantId, categoryId, {
      name: "Roti Canai",
      price: 5.0,
    });
  });

  // ─── Helper: create a register and return its ID ─────────────────────────

  async function createRegister(
    name = "Register A",
  ): Promise<{ id: string; [k: string]: any }> {
    const res = await app.request("/api/v1/pos/registers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name,
        location: "Counter 1",
        restaurantId: String(restaurantId),
      }),
    });
    const body = (await res.json()) as ApiTestResponse;
    return body.data;
  }

  // ─── Helper: start a shift on a register and return the shift ────────────

  async function startShift(
    registerId: string,
  ): Promise<{ id: string; [k: string]: any }> {
    const res = await app.request("/api/v1/pos/shifts/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        registerId,
        operatorId: adminUserId,
        startAmount: 500,
        notes: "Morning shift",
      }),
    });
    const body = (await res.json()) as ApiTestResponse;
    return body.data;
  }

  // ─── 1. POST /api/v1/pos/registers — create a register ──────────────────

  it("should create a cash register for the restaurant", async () => {
    const res = await app.request("/api/v1/pos/registers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Main Register",
        location: "Front Counter",
        restaurantId: String(restaurantId),
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.id).toEqual(expect.any(String));
    expect(body.data.name).toBe("Main Register");
    expect(body.data.restaurantId).toBe(String(restaurantId));
  });

  // ─── 2. POST /api/v1/pos/shifts/start — start a shift (cash payment) ────

  it("should start a shift on a register", async () => {
    const register = await createRegister();

    const res = await app.request("/api/v1/pos/shifts/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        registerId: register.id,
        operatorId: adminUserId,
        startAmount: 500,
        notes: "Opening shift",
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.id).toEqual(expect.any(String));
    expect(body.data.status).toBe("active");
    expect(body.data.startAmount).toBe(500);
  });

  // ─── 3. POST /api/v1/pos/receipts/print — print receipt for order ───────

  it("should print a receipt for an existing order", async () => {
    // Seed an order with items
    const order = await seedOrderWithItems(
      ctx,
      restaurantId,
      [menuItem1.id, menuItem2.id],
      { tableId, status: "confirmed" },
    );

    // Create register + shift (required headers for receipt printing)
    const register = await createRegister();
    const shift = await startShift(register.id);

    const res = await app.request("/api/v1/pos/receipts/print", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
        "X-Register-Id": register.id,
        "X-Shift-Id": shift.id,
      },
      body: JSON.stringify({
        orderId: order.id,
        templateName: "standard",
        receiptType: "customer",
        copies: 1,
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.receiptNumber).toEqual(expect.any(String));
    expect(body.data.orderId).toBe(order.id);
    expect(body.data.registerId).toBe(register.id);
  });

  // ─── 4. GET /api/v1/pos/reports/daily — daily sales summary ─────────────

  it("should return a daily sales summary for the restaurant", async () => {
    // Seed an order so the summary has data
    await seedOrderWithItems(ctx, restaurantId, [menuItem1.id], {
      tableId,
      status: "completed",
    });

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const res = await app.request(
      `/api/v1/pos/reports/daily?restaurantId=${restaurantId}&date=${today}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.date).toBe(today);
    expect(body.data.summary).toBeDefined();
    expect(body.data.summary).toEqual(
      expect.objectContaining({
        totalOrders: expect.any(Number),
        totalSales: expect.any(Number),
        netSales: expect.any(Number),
      }),
    );
  });

  // ─── 5. POST /api/v1/pos/receipts/print — non-existent order → error ────

  it("should return error when printing receipt for non-existent order", async () => {
    const register = await createRegister();

    const res = await app.request("/api/v1/pos/receipts/print", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
        "X-Register-Id": register.id,
      },
      body: JSON.stringify({
        orderId: 999999,
        templateName: "standard",
        receiptType: "customer",
        copies: 1,
      }),
    });

    // The service returns { success: false, error: "..." } which the route
    // converts to a 400 via badRequest()
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });

  // ─── 6. GET /api/v1/pos/registers without auth → 401 ────────────────────

  it("should return 401 when no auth token is provided", async () => {
    const res = await app.request(
      `/api/v1/pos/registers?restaurantId=${restaurantId}`,
      {
        method: "GET",
        // No Authorization header
      },
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });
});
