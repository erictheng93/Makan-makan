import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: undefined as
    | undefined
    | { id: number; role: number; restaurantId?: string | number | null },
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set(
      "user",
      auth.user ?? { id: 7, role: 0, restaurantId: "S-20250124-001" },
    );
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

const serviceFns = vi.hoisted(() => ({
  createErrorReport: vi.fn(),
  getErrorStats: vi.fn(),
  cleanupOldErrorReports: vi.fn(),
}));

vi.mock("../services/SystemService", () => ({
  SystemService: class {
    createErrorReport = serviceFns.createErrorReport;
    getErrorStats = serviceFns.getErrorStats;
    cleanupOldErrorReports = serviceFns.cleanupOldErrorReports;
  },
}));

const database = vi.hoisted(() => {
  const results = [] as unknown[][];
  const selectCalls = [] as unknown[];

  function createBuilder(result: unknown[]) {
    const promise = Promise.resolve(result);
    return {
      from: vi.fn(() => builder),
      where: vi.fn(() => builder),
      orderBy: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise),
    };

    var builder: any;
  }

  function select(selection: unknown) {
    selectCalls.push(selection);
    const result = results.length > 0 ? results.shift()! : [{ test: 1 }];
    const promise = Promise.resolve(result);
    const builder = {
      from: vi.fn(() => builder),
      where: vi.fn(() => builder),
      orderBy: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise),
    };
    return builder;
  }

  return {
    results,
    selectCalls,
    createDatabase: vi.fn(() => ({ select })),
    count: vi.fn(() => "count()"),
    gte: vi.fn(() => "gte()"),
    avgMoneyAmount: vi.fn(() => "avgMoneyAmount()"),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) =>
      String.raw({ raw: strings }, ...values.map(String)),
    ),
    orders: {
      createdAt: "orders.created_at",
      restaurantId: "orders.restaurant_id",
      status: "orders.status",
      totalAmountCents: "orders.total_amount_cents",
      totalAmount: "orders.total_amount",
    },
    users: {},
    restaurants: {},
    auditLogs: {
      action: "audit_logs.action",
      resource: "audit_logs.resource",
      description: "audit_logs.description",
      createdAt: "audit_logs.created_at",
    },
  };
});

vi.mock("@makanmakan/database", () => database);

import app from "./index";
import { ApiError } from "../../../shared/utils/api-error";

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409 | 500,
    );
  }
  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function createKv() {
  const values = new Map<string, string>();
  return {
    values,
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      values.delete(key);
    }),
  };
}

function request(
  path: string,
  method = "GET",
  body?: unknown,
  envOverrides: Record<string, unknown> = {},
) {
  const kv = createKv();
  const env = {
    DB: {},
    CACHE_KV: kv,
    API_VERSION: "test-v1",
    NODE_ENV: "test",
    ...envOverrides,
  };

  const res = app.request(
    path,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined
          ? { "User-Agent": "vitest" }
          : {
              "Content-Type": "application/json",
              "User-Agent": "vitest",
              Authorization: "Bearer test",
            },
    },
    env as never,
  );

  return { res, kv };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = undefined;
  database.results.length = 0;
  database.selectCalls.length = 0;

  serviceFns.createErrorReport.mockResolvedValue({
    success: true,
    data: { total_errors: 1, significant_errors: 0, report_id: "report-1" },
  });
  serviceFns.getErrorStats.mockResolvedValue({
    summary: { total_errors_24h: 2 },
    stats_24h: [],
    weekly_trend: [],
    common_errors: [],
  });
  serviceFns.cleanupOldErrorReports.mockResolvedValue({
    success: true,
    data: { deleted_count: 3 },
  });
});

describe("system routes", () => {
  it("submits strict error reports with authenticated user context", async () => {
    auth.user = { id: 42, role: 1, restaurantId: "S-20250124-001" };

    const { res } = request("/error-report", "POST", {
      errors: [
        {
          type: "api",
          severity: "high",
          code: "E_API",
          message: "Request failed",
          context: { route: "/orders" },
          timestamp: "2026-01-01T00:00:00.000Z",
          url: "https://app.example.test/orders",
        },
      ],
    });

    expect((await res).status).toBe(200);
    expect(serviceFns.createErrorReport).toHaveBeenCalledWith(
      {
        errors: [
          expect.objectContaining({
            type: "api",
            severity: "high",
            message: "Request failed",
          }),
        ],
      },
      42,
      "S-20250124-001",
      "vitest",
    );
  });

  it("normalizes loose browser error telemetry", async () => {
    auth.user = { id: 9, role: 2, restaurantId: null };

    const { res } = request("/errors", "POST", {
      category: "authentication",
      severity: "critical",
      name: "AuthError",
      timestamp: 1767225600000,
      context: {
        url: "https://app.example.test/login",
        user: { id: "customer-1" },
        extra: { restaurantId: 12 },
      },
    });

    expect((await res).status).toBe(200);
    expect(serviceFns.createErrorReport).toHaveBeenCalledWith(
      {
        errors: [
          expect.objectContaining({
            type: "permission",
            severity: "critical",
            message: "AuthError",
            userAgent: "vitest",
            url: "https://app.example.test/login",
            userId: "customer-1",
            restaurantId: 12,
          }),
        ],
      },
      9,
      null,
      "vitest",
    );
  });

  it("stores performance telemetry in scoped KV records", async () => {
    auth.user = { id: 5, role: 1, restaurantId: "S-20250124-002" };

    const { res, kv } = request("/performance", "POST", {
      reportId: "perf 1",
      lcp: 123,
    });
    const body = await (await res).json();

    expect(body).toMatchObject({
      success: true,
      data: {
        reportId: "perf%201",
        stored: true,
        restaurantId: "S-20250124-002",
      },
    });
    expect(kv.put).toHaveBeenCalledWith(
      "system:performance:S-20250124-002:5:perf%201",
      expect.stringContaining('"lcp":123'),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
    expect(kv.put).toHaveBeenCalledWith(
      "system:performance:S-20250124-002:5:latest",
      expect.any(String),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
  });

  it("reports basic health and liveness probes", async () => {
    database.results.push([{ test: 1 }]);

    let response = await request("/health").res;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      status: "healthy",
      version: "test-v1",
      environment: "test",
      checks: { database: true, cache: true },
    });

    response = await request("/health/live").res;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      status: "alive",
    });
  });

  it("returns not_ready when readiness dependencies fail", async () => {
    database.results.push([{ test: 0 }]);

    const response = await request("/health/ready").res;

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      status: "not_ready",
    });
  });

  it("scopes error stats for owners and cleans reports for admins", async () => {
    auth.user = { id: 7, role: 1, restaurantId: "S-20250124-003" };

    let response = await request(
      "/error-stats?restaurantId=S-20250124-004&days=14",
    ).res;
    expect(response.status).toBe(200);
    expect(serviceFns.getErrorStats).toHaveBeenCalledWith("S-20250124-003");

    auth.user = { id: 1, role: 0 };
    response = await request("/error-stats?restaurantId=S-20250124-004").res;
    expect(response.status).toBe(200);
    expect(serviceFns.getErrorStats).toHaveBeenCalledWith("S-20250124-004");

    response = await request("/error-reports/cleanup?daysOld=45", "DELETE").res;
    expect(response.status).toBe(200);
    expect(serviceFns.cleanupOldErrorReports).toHaveBeenCalledWith(45);
  });

  it("returns detailed health with endpoint checks and recommendations", async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockRejectedValueOnce(new Error("network down")),
    );
    database.results.push(
      [{ test: 1 }],
      [{ count: 3 }],
      [{ count: 2 }],
      [{ count: 1 }],
      [
        {
          action: "payment_error",
          resource: "orders",
          description: "Card declined",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      [
        {
          total_requests: 10,
          recent_requests: 2,
          active_restaurants: 1,
          avg_order_value: 1250,
        },
      ],
    );

    const response = await request("/health/detailed").res;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      overview: { status: "healthy" },
      performance: {
        table_statistics: [
          { table_name: "orders", row_count: 3 },
          { table_name: "users", row_count: 2 },
          { table_name: "restaurants", row_count: 1 },
        ],
        endpoint_health: [
          expect.objectContaining({ name: "restaurants", status: "healthy" }),
          expect.objectContaining({ name: "menu", status: "degraded" }),
          expect.objectContaining({ name: "orders", status: "unhealthy" }),
        ],
      },
      system_load: expect.objectContaining({ total_requests: 10 }),
      recent_errors: [expect.objectContaining({ action: "payment_error" })],
    });

    vi.stubGlobal("fetch", originalFetch);
  });

  it("returns health metrics as JSON and Prometheus text", async () => {
    database.results.push([
      {
        orders_last_hour: 1,
        orders_last_24h: 5,
        pending_orders: 2,
        preparing_orders: 1,
        total_orders: 20,
      },
    ]);

    let response = await request("/health/metrics").res;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      business_metrics: { total_orders: 20 },
      alert_thresholds: { memory_warning: 70 },
    });

    database.results.push([{ total_orders: 21, pending_orders: 3 }]);
    response = await request("/health/metrics?format=prometheus").res;
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/plain");
    expect(await response.text()).toContain("makanmakan_orders_total 21");
  });
});
