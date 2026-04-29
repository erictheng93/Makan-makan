import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

vi.mock("../../../shared/middleware", () => ({
  customerAuthMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", {
      id: 5,
      username: "customer",
      role: 5,
      restaurantId: "rest-1",
    });
    await next();
  }),
  requireRole: vi.fn(() => async (_c: any, next: any) => {
    await next();
  }),
  validateBody: vi.fn((schema: any) => async (c: any, next: any) => {
    const body = await c.req.json();
    c.set("validatedBody", schema.parse(body));
    await next();
  }),
  validateQuery: vi.fn(() => async (_c: any, next: any) => {
    await next();
  }),
  validateParams: vi.fn(() => async (_c: any, next: any) => {
    await next();
  }),
}));

vi.mock("../../../middleware/guestAuth", () => ({
  guestSessionAuth: vi.fn(async (_c: any, next: any) => {
    await next();
  }),
  guestTokenAuth: vi.fn(async (_c: any, next: any) => {
    await next();
  }),
}));

vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: vi.fn(() => async (_c: any, next: any) => {
    await next();
  }),
}));

vi.mock("../services/OrdersService", () => ({
  OrdersService: vi.fn(),
}));

import orderRoutes from "../routes";

function createMockKV() {
  return {
    put: vi.fn().mockResolvedValue(undefined),
  };
}

function buildApp(kv = createMockKV()) {
  const app = new Hono<any>();
  app.route("/orders", orderRoutes);
  return { app, kv };
}

describe("Order Batch Sync Compatibility Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores order batch sync payloads in KV", async () => {
    const { app, kv } = buildApp();
    const payload = {
      sync_id: "orders-1",
      orders: [{ offline_order_id: "offline-1", total_amount: 1200 }],
    };

    const response = await app.request(
      "/orders/batch-sync",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      { CACHE_KV: kv },
    );
    const json = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      syncId: "orders-1",
      synced: true,
      itemCount: 1,
      restaurantId: "rest-1",
    });
    expect(kv.put).toHaveBeenCalledWith(
      "orders:batch-sync:rest-1:5:orders-1",
      expect.stringContaining('"offline_order_id":"offline-1"'),
      { expirationTtl: 2592000 },
    );
    expect(kv.put).toHaveBeenCalledWith(
      "orders:batch-sync:rest-1:5:latest",
      expect.stringContaining('"offline_order_id":"offline-1"'),
      { expirationTtl: 2592000 },
    );
  });
});
