import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: { id: 7, role: 1, restaurantId: "rest-1" } as {
    id: number;
    role: number;
    restaurantId?: string | number | null;
  },
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("user", auth.user);
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

const serviceFns = vi.hoisted(() => ({
  clearCache: vi.fn(),
  getDashboardData: vi.fn(),
  getRevenueAnalytics: vi.fn(),
  getProductAnalytics: vi.fn(),
  getCustomerAnalytics: vi.fn(),
  getPerformanceAnalytics: vi.fn(),
  generateExport: vi.fn(),
  getRealtimeData: vi.fn(),
  getFinancialReport: vi.fn(),
}));

vi.mock("../services/AnalyticsService", () => ({
  AnalyticsService: class {
    clearCache = serviceFns.clearCache;
    getDashboardData = serviceFns.getDashboardData;
    getRevenueAnalytics = serviceFns.getRevenueAnalytics;
    getProductAnalytics = serviceFns.getProductAnalytics;
    getCustomerAnalytics = serviceFns.getCustomerAnalytics;
    getPerformanceAnalytics = serviceFns.getPerformanceAnalytics;
    generateExport = serviceFns.generateExport;
    getRealtimeData = serviceFns.getRealtimeData;
    getFinancialReport = serviceFns.getFinancialReport;
  },
}));

import routes from "./index";

function createKv() {
  const values = new Map<string, string>();

  return {
    values,
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    put: vi.fn(
      async (
        key: string,
        value: string,
        _options?: { expirationTtl?: number },
      ) => {
        values.set(key, value);
      },
    ),
    delete: vi.fn(async (key: string) => {
      values.delete(key);
    }),
  };
}

function request(
  path: string,
  method = "GET",
  body?: unknown,
  kv = createKv(),
) {
  const res = routes.request(
    path,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
    },
    { DB: {}, CACHE_KV: kv } as never,
  );

  return { res, kv };
}

function rawRequest(path: string, method: string, body: string) {
  return routes.request(
    path,
    {
      method,
      body,
      headers: { "Content-Type": "application/json" },
    },
    { DB: {}, CACHE_KV: createKv() } as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 7, role: 1, restaurantId: "rest-1" };
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-07T12:00:00.000Z"));

  serviceFns.clearCache.mockResolvedValue(undefined);
  serviceFns.getDashboardData.mockResolvedValue({ revenue: 100 });
  serviceFns.getRevenueAnalytics.mockResolvedValue([{ date: "2026-06-07" }]);
  serviceFns.getProductAnalytics.mockResolvedValue([{ itemId: 1 }]);
  serviceFns.getCustomerAnalytics.mockResolvedValue([{ customerId: 1 }]);
  serviceFns.getPerformanceAnalytics.mockResolvedValue([{ metric: "orders" }]);
  serviceFns.generateExport.mockResolvedValue({
    success: true,
    data: { filename: "analytics.json" },
  });
  serviceFns.getRealtimeData.mockResolvedValue({
    timestamp: "2026-06-07T12:00:00.000Z",
    activeOrders: 3,
  });
  serviceFns.getFinancialReport.mockResolvedValue({ totalRevenue: 500 });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("analytics routes", () => {
  it("stores batch sync payloads in restaurant-scoped KV and clears cache", async () => {
    const { res, kv } = request("/batch-sync", "POST", {
      sync_id: "sync one",
      events: [{ type: "order" }, { type: "payment" }],
    });
    const response = await res;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        syncId: "sync%20one",
        synced: true,
        itemCount: 2,
        restaurantId: "rest-1",
      },
    });
    expect(kv.put).toHaveBeenCalledWith(
      "analytics:batch-sync:rest-1:7:sync%20one",
      expect.stringContaining('"sync_id":"sync one"'),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
    expect(kv.put).toHaveBeenCalledWith(
      "analytics:batch-sync:rest-1:7:latest",
      expect.any(String),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
    expect(serviceFns.clearCache).toHaveBeenCalledWith("rest-1");
  });

  it("handles global batch sync and invalid JSON without clearing restaurant cache", async () => {
    auth.user = { id: 1, role: 0, restaurantId: null };

    let response = await request("/batch-sync", "POST", { events: [] }).res;

    expect(response.status).toBe(200);
    expect(serviceFns.clearCache).not.toHaveBeenCalled();

    response = await rawRequest("/batch-sync", "POST", "{not json");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "INVALID_JSON" },
    });
  });

  it("syncs a specific restaurant only for admins or the matching owner", async () => {
    let response = await request("/rest-1/sync", "POST", {
      sync_id: "manual",
      totals: { orders: 2 },
    }).res;

    expect(response.status).toBe(200);
    expect(serviceFns.clearCache).toHaveBeenCalledWith("rest-1");

    response = await request("/other/sync", "POST", {}).res;
    expect(response.status).toBe(403);

    auth.user = { id: 1, role: 0 };
    response = await rawRequest("/rest-2/sync", "POST", "{bad");

    expect(response.status).toBe(400);
  });

  it("returns dashboard and revenue analytics with owner restaurant scoping", async () => {
    let response = await request("/dashboard?restaurantId=other&period=week")
      .res;

    expect(response.status).toBe(200);
    expect(serviceFns.getDashboardData).toHaveBeenCalledWith("rest-1", "week");

    response = await request(
      "/revenue?restaurantId=other&dateFrom=2026-06-01T00:00:00.000Z&dateTo=2026-06-07T00:00:00.000Z&groupBy=day&includeComparison=true",
    ).res;

    expect(response.status).toBe(200);
    expect(serviceFns.getRevenueAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "rest-1",
        groupBy: "day",
        includeComparison: true,
      }),
    );

    auth.user = { id: 1, role: 0 };
    response = await request("/dashboard?restaurant_id=admin-rest&period=today")
      .res;

    expect(response.status).toBe(200);
    expect(serviceFns.getDashboardData).toHaveBeenLastCalledWith(
      "admin-rest",
      "today",
    );
  });

  it("returns product, customer, and performance analytics with scoped filters", async () => {
    let response = await request("/products?restaurantId=other&limit=5").res;

    expect(response.status).toBe(200);
    expect(serviceFns.getProductAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "rest-1", limit: 5 }),
    );

    response = await request("/customers?restaurantId=other&groupBy=month").res;
    expect(response.status).toBe(200);
    expect(serviceFns.getCustomerAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "rest-1", groupBy: "month" }),
    );

    auth.user = { id: 9, role: 2, restaurantId: "kitchen-rest" };
    response = await request(
      "/performance?restaurantId=other&metric=revenue&limit=3",
    ).res;
    expect(response.status).toBe(200);
    expect(serviceFns.getPerformanceAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "kitchen-rest",
        metric: "revenue",
        limit: 3,
      }),
    );
  });

  it("generates exports and detailed analytics reports", async () => {
    let response = await request(
      "/export?restaurantId=other&type=revenue&format=csv&limit=10",
    ).res;

    expect(response.status).toBe(200);
    expect(serviceFns.generateExport).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "rest-1",
        type: "revenue",
        format: "csv",
        limit: 10,
      }),
    );

    response = await request(
      "/detailed-performance?restaurantId=other&includeStaffMetrics=true&includeItemAnalysis=true",
    ).res;
    expect(response.status).toBe(200);
    expect(serviceFns.getPerformanceAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "rest-1",
        includeStaffMetrics: true,
        includeItemAnalysis: true,
      }),
    );

    response = await request(
      "/financial-report?restaurantId=other&period=daily",
    ).res;
    expect(response.status).toBe(200);
    expect(serviceFns.getFinancialReport).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "rest-1", period: "daily" }),
    );
  });

  it("returns realtime and owner dashboards with role-aware restaurant selection", async () => {
    let response = await request("/realtime-dashboard?restaurantId=other").res;

    expect(response.status).toBe(200);
    expect(serviceFns.getRealtimeData).toHaveBeenCalledWith("rest-1");

    response = await request("/owner-dashboard?restaurantId=other").res;
    expect(response.status).toBe(200);
    expect(serviceFns.getDashboardData).toHaveBeenLastCalledWith("rest-1");

    auth.user = { id: 1, role: 0 };
    response = await request("/realtime-dashboard?restaurantId=admin-rest").res;
    expect(response.status).toBe(200);
    expect(serviceFns.getRealtimeData).toHaveBeenLastCalledWith("admin-rest");
  });

  it("opens an SSE analytics stream with event-stream headers", async () => {
    const response = await request("/sse?lastEventId=evt-1").res;

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");

    const reader = response.body?.getReader();
    const firstChunk = await reader?.read();
    await reader?.cancel();
    const text = new TextDecoder().decode(firstChunk?.value);

    expect(text).toContain("event: heartbeat");
    expect(text).toContain("SSE connected");
  });
});
