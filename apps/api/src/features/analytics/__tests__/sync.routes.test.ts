import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const { mockClearCache } = vi.hoisted(() => ({
  mockClearCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", {
      id: 7,
      username: "owner",
      role: 1,
      restaurantId: "rest-1",
    });
    await next();
  }),
  requireRole: vi.fn(() => async (_c: any, next: any) => await next()),
}));

vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: vi.fn(() => async (_c: any, next: any) => await next()),
}));

vi.mock("../services/AnalyticsService", () => ({
  AnalyticsService: vi.fn(function () {
    return { clearCache: mockClearCache };
  }),
}));

import analyticsRoutes from "../routes";

function createMockKV() {
  return {
    put: vi.fn().mockResolvedValue(undefined),
  };
}

function buildApp(kv = createMockKV()) {
  const app = new Hono<any>();
  app.route("/analytics", analyticsRoutes);
  return { app, kv };
}

describe("Analytics Sync Compatibility Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClearCache.mockResolvedValue(undefined);
  });

  it("stores synced analytics payloads and clears analytics cache", async () => {
    const { app, kv } = buildApp();

    const response = await app.request(
      "/analytics/rest-1/sync",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sync_id: "sync-1",
          totals: { orders: 5, revenue: 1200 },
        }),
      },
      { DB: {}, CACHE_KV: kv },
    );
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      data: {
        syncId: "sync-1",
        synced: true,
        restaurantId: "rest-1",
      },
    });
    expect(kv.put).toHaveBeenCalledWith(
      "analytics:sync:rest-1:sync-1",
      expect.stringContaining('"restaurantId":"rest-1"'),
      { expirationTtl: 2592000 },
    );
    expect(kv.put).toHaveBeenCalledWith(
      "analytics:sync:rest-1:latest",
      expect.stringContaining('"restaurantId":"rest-1"'),
      { expirationTtl: 2592000 },
    );
    expect(mockClearCache).toHaveBeenCalledWith("rest-1");
  });

  it("stores customer batch analytics sync payloads", async () => {
    const { app, kv } = buildApp();

    const response = await app.request(
      "/analytics/batch-sync",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sync_id: "analytics-batch-1",
          events: [{ type: "page_view", path: "/menu" }],
        }),
      },
      { DB: {}, CACHE_KV: kv },
    );
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      syncId: "analytics-batch-1",
      synced: true,
      itemCount: 1,
      restaurantId: "rest-1",
    });
    expect(kv.put).toHaveBeenCalledWith(
      "analytics:batch-sync:rest-1:7:analytics-batch-1",
      expect.stringContaining('"page_view"'),
      { expirationTtl: 2592000 },
    );
    expect(kv.put).toHaveBeenCalledWith(
      "analytics:batch-sync:rest-1:7:latest",
      expect.stringContaining('"page_view"'),
      { expirationTtl: 2592000 },
    );
    expect(mockClearCache).toHaveBeenCalledWith("rest-1");
  });

  it("rejects owner syncs for another restaurant", async () => {
    const { app, kv } = buildApp();

    const response = await app.request(
      "/analytics/rest-2/sync",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync_id: "sync-2" }),
      },
      { DB: {}, CACHE_KV: kv },
    );
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(403);
    expect(json.error.code).toBe("ANALYTICS_SYNC_FORBIDDEN");
    expect(kv.put).not.toHaveBeenCalled();
    expect(mockClearCache).not.toHaveBeenCalled();
  });
});
