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
  const selectCalls = [] as unknown[];
  // No default implementation: mockSelectResults() (defined below, after this
  // module mock is wired up) sets one before every test runs. Calling
  // select() before that would throw "queue.shift is not a function" — which
  // never happens in practice, since beforeEach always calls
  // mockSelectResults({}) first.
  const select = vi.fn();

  return {
    selectCalls,
    select,
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

vi.mock("@makanmasak/database", () => database);

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

/**
 * Select fixtures are keyed by table, not by call order: `from(table)`
 * decides which queue a query draws from, so adding a query against one
 * table can no longer shift another table's results out from under it.
 *
 * Two things still need care when a route handler grows a new query:
 *
 * - Within a single table the queue is positional. The Nth read of a table
 *   takes that table's Nth fixture, so a new query means inserting a fixture
 *   at the matching index rather than appending one at the end.
 * - A table has to be listed in `fixtureTables` before it can be declared. An
 *   unregistered table matches no queue, so every read of it throws.
 *
 * Missing and exhausted fixtures both throw and name the table. The old
 * `results.shift() ?? [{ test: 1 }]` default is gone entirely — every test
 * that exercises a select path must declare every table it reads from,
 * including the health probe (see `HEALTH_PROBE_FROM` below).
 *
 * This is a route file: `app.onError` (wired above) catches whatever the
 * harness throws and turns it into a JSON error response. A
 * "Missing select fixture for X" failure therefore does NOT show up as a
 * thrown error in the assertion diff — it shows up as an unexpected status
 * code or body (`expected 500 to be 200`, or a 200 with an unexpectedly
 * "healthy" body). When a test fails that way, the harness's thrown message
 * was swallowed by onError; it never reaches the response, so there is
 * nothing to grep for in the JSON body — only the assertion's expected-vs-
 * actual mismatch signals it.
 *
 * `runBasicHealthCheck` (in ../index.ts) issues
 * `db.select({...}).from(sql\`(SELECT 1)\`)` — a raw SQL fragment, not a
 * schema table. It DOES call `from()`, so the `unselectedTable` guard below
 * doesn't fire for it, but it also has no real table identity to register in
 * `fixtureTables`, which exists only for the four tables the route handlers
 * actually import: orders, users, restaurants, auditLogs. Inventing a
 * pseudo-table entry for it (e.g. registering some `healthProbe` symbol as
 * if it were a schema table) would blur that registry's meaning. Instead its
 * fixture is declared through a separate `healthProbe` key on
 * `SelectFixtures` that is intentionally NOT part of `fixtureTables` /
 * `SelectFixtureName` — see `HEALTH_PROBE_FROM`.
 */
type SelectFixtureName = "orders" | "users" | "restaurants" | "auditLogs";
type SelectFixtures = Partial<Record<SelectFixtureName, unknown[][]>> & {
  healthProbe?: unknown[][];
};

const fixtureTables: Record<SelectFixtureName, unknown> = {
  orders: database.orders,
  users: database.users,
  restaurants: database.restaurants,
  auditLogs: database.auditLogs,
};
const fixtureTableNames = new Map<unknown, SelectFixtureName>(
  Object.entries(fixtureTables).map(([name, table]) => [
    table,
    name as SelectFixtureName,
  ]),
);
const unselectedTable = Symbol("unselectedTable");

// The mocked `sql` tag above returns the raw template text for any template
// with no interpolations, so `sql\`(SELECT 1)\`` — the exact argument
// `runBasicHealthCheck` passes to `.from()` — always evaluates to this
// string. It stands in for a raw SQL fragment, never a real schema table, so
// it stays out of `fixtureTables` and draws from its own `healthProbe` queue
// instead (see the doc comment above).
const HEALTH_PROBE_FROM = "(SELECT 1)";

function createQuery(nextResultFor: (table: unknown) => unknown) {
  let selectedTable: unknown = unselectedTable;
  const builder = {
    from: vi.fn((table: unknown) => {
      selectedTable = table;
      return builder;
    }),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void,
    ) => {
      if (selectedTable === unselectedTable) {
        return Promise.reject(
          new Error("Select fixture query never called from(table)"),
        ).then(resolve, reject);
      }
      return Promise.resolve(nextResultFor(selectedTable)).then(
        resolve,
        reject,
      );
    },
  };
  return builder;
}

function mockSelectResults(fixtures: SelectFixtures = {}) {
  const { healthProbe, ...tableFixtures } = fixtures;
  const selectResults = new Map<unknown, unknown[][]>(
    Object.entries(tableFixtures).map(([name, results]) => [
      fixtureTables[name as SelectFixtureName],
      [...(results ?? [])],
    ]),
  );
  selectResults.set(HEALTH_PROBE_FROM, [...(healthProbe ?? [])]);
  const nextResultFor = (table: unknown) => {
    const name =
      table === HEALTH_PROBE_FROM
        ? "healthProbe"
        : (fixtureTableNames.get(table) ?? "<unknown table>");
    const queue = selectResults.get(table);
    if (!queue) throw new Error(`Missing select fixture for ${name}`);
    const result = queue.shift();
    if (result === undefined) {
      throw new Error(`No select fixtures remaining for ${name}`);
    }
    return result;
  };
  database.select.mockImplementation((selection: unknown) => {
    database.selectCalls.push(selection);
    return createQuery(nextResultFor);
  });
}

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
  database.selectCalls.length = 0;
  mockSelectResults({});

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

  it("submits strict error reports without a restaurant scope", async () => {
    auth.user = { id: 43, role: 0, restaurantId: null };

    const { res } = request("/error-report", "POST", {
      errors: [
        {
          type: "permission",
          severity: "low",
          message: "Denied",
          timestamp: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect((await res).status).toBe(200);
    expect(serviceFns.createErrorReport).toHaveBeenCalledWith(
      {
        errors: [
          expect.objectContaining({
            type: "permission",
            severity: "low",
            message: "Denied",
          }),
        ],
      },
      43,
      null,
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

  it("normalizes mixed loose browser error arrays", async () => {
    auth.user = { id: 10, role: 5, restaurantId: 77 };
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-03T04:05:06.000Z"));

    const { res } = request("/errors", "POST", {
      errors: [
        {
          type: "network",
          severity: "medium",
          message: "offline",
          code: 1001,
          timestamp: "not-a-date",
          userAgent: "browser-agent",
          url: "https://app.example.test/offline",
          userId: 55,
          restaurantId: "S-20250124-009",
        },
        {
          category: "validation",
          severity: "invalid",
          message: "Bad quantity",
          timestamp: "2026-02-01T00:00:00.000Z",
        },
        {
          type: "sse",
          name: "StreamError",
        },
        "plain failure",
      ],
    });

    expect((await res).status).toBe(200);
    expect(serviceFns.createErrorReport).toHaveBeenCalledWith(
      {
        errors: [
          expect.objectContaining({
            type: "network",
            severity: "medium",
            code: 1001,
            message: "offline",
            timestamp: "2026-02-03T04:05:06.000Z",
            userAgent: "browser-agent",
            url: "https://app.example.test/offline",
            userId: 55,
            restaurantId: "S-20250124-009",
          }),
          expect.objectContaining({
            type: "validation",
            severity: "low",
            message: "Bad quantity",
            timestamp: "2026-02-01T00:00:00.000Z",
            userAgent: "vitest",
          }),
          expect.objectContaining({
            type: "sse",
            severity: "low",
            message: "StreamError",
          }),
          expect.objectContaining({
            type: "unknown",
            severity: "low",
            message: "Unknown client error",
            originalError: {},
          }),
        ],
      },
      10,
      "77",
      "vitest",
    );

    vi.useRealTimers();
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

  it("stores global performance telemetry using alternate report ids", async () => {
    auth.user = { id: 6, role: 0, restaurantId: null };

    const { res, kv } = request("/performance", "POST", {
      sync_id: "sync/42",
      duration: 42,
    });
    const body = await (await res).json();

    expect(body).toMatchObject({
      success: true,
      data: {
        reportId: "sync%2F42",
        stored: true,
        restaurantId: null,
      },
    });
    expect(kv.put).toHaveBeenCalledWith(
      "system:performance:global:6:sync%2F42",
      expect.stringContaining('"duration":42'),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
    expect(kv.put).toHaveBeenCalledWith(
      "system:performance:global:6:latest",
      expect.any(String),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
  });

  it("reports basic health and liveness probes", async () => {
    mockSelectResults({ healthProbe: [[{ test: 1 }]] });

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

  it("returns uptime monitor targets and stores evidence snapshots", async () => {
    mockSelectResults({ healthProbe: [[{ test: 1 }]] });

    const { res, kv } = request("/health/uptime");
    const response = await res;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      status: "operational",
      version: "test-v1",
      environment: "test",
      evidence: {
        kv_key: "system:uptime:last-check",
        stored: true,
        retention_seconds: 60 * 60 * 24 * 7,
      },
      checks: { database: true, cache: true },
    });
    expect(body.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "public_liveness",
          method: "GET",
          path: "/api/v1/system/health/live",
          expected_status: 200,
          interval_seconds: 60,
        }),
        expect.objectContaining({
          name: "dependency_readiness",
          path: "/api/v1/system/health/ready",
          expected_status: 200,
        }),
        expect.objectContaining({
          name: "dependency_health",
          path: "/api/v1/system/health",
          expected_status: 200,
        }),
      ]),
    );
    expect(kv.put).toHaveBeenCalledWith(
      "system:uptime:last-check",
      expect.stringContaining('"status":"healthy"'),
      { expirationTtl: 60 * 60 * 24 * 7 },
    );
  });

  it("reports degraded health when database checks return unexpected data", async () => {
    mockSelectResults({ healthProbe: [[{ test: 0 }]] });

    const response = await request("/health").res;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      status: "degraded",
      checks: { database: false, cache: true },
      services: [
        expect.objectContaining({ name: "database", status: "degraded" }),
        expect.objectContaining({ name: "kv_storage", status: "healthy" }),
      ],
    });
  });

  it("reports unhealthy health when KV checks fail", async () => {
    mockSelectResults({ healthProbe: [[{ test: 1 }]] });
    const failingKv = {
      get: vi.fn(),
      put: vi.fn(async () => {
        throw new Error("kv unavailable");
      }),
      delete: vi.fn(),
    };

    const response = await request("/health", "GET", undefined, {
      CACHE_KV: failingKv,
      API_VERSION: "",
      NODE_ENV: "",
    }).res;
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      success: false,
      status: "unhealthy",
      version: "v1",
      environment: "development",
      checks: { database: true, cache: false },
      services: [
        expect.objectContaining({ name: "database", status: "healthy" }),
        expect.objectContaining({
          name: "kv_storage",
          status: "unhealthy",
          error: "kv unavailable",
        }),
      ],
    });
  });

  it("reports degraded health when KV checks return unexpected data", async () => {
    mockSelectResults({ healthProbe: [[{ test: 1 }]] });
    const kv = createKv();
    kv.get.mockResolvedValueOnce("stale");

    const response = await request("/health", "GET", undefined, {
      CACHE_KV: kv,
    }).res;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      status: "degraded",
      checks: { database: true, cache: false },
      services: [
        expect.objectContaining({ name: "database", status: "healthy" }),
        expect.objectContaining({ name: "kv_storage", status: "degraded" }),
      ],
    });
  });

  it("reports database health check errors", async () => {
    database.createDatabase.mockImplementationOnce(() => {
      throw "database unavailable";
    });

    const response = await request("/health").res;
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      success: false,
      status: "unhealthy",
      checks: { database: false, cache: true },
      services: [
        expect.objectContaining({
          name: "database",
          status: "unhealthy",
          error: "Unknown error",
        }),
        expect.objectContaining({ name: "kv_storage", status: "healthy" }),
      ],
    });
  });

  it("returns not_ready when readiness dependencies fail", async () => {
    mockSelectResults({ users: [[{ test: 0 }]] });

    const response = await request("/health/ready").res;

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      status: "not_ready",
    });
  });

  it("returns ready when readiness dependencies pass", async () => {
    mockSelectResults({ users: [[{ test: 1 }]] });

    const response = await request("/health/ready").res;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      status: "ready",
    });
  });

  it("returns not_ready when readiness checks throw", async () => {
    mockSelectResults({ users: [[{ test: 1 }]] });
    const failingKv = {
      get: vi.fn(async () => {
        throw new Error("readiness kv unavailable");
      }),
      put: vi.fn(),
      delete: vi.fn(),
    };

    const response = await request("/health/ready", "GET", undefined, {
      CACHE_KV: failingKv,
    }).res;

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      status: "not_ready",
      error: "readiness kv unavailable",
    });
  });

  it("returns not_ready when readiness KV fallback fails", async () => {
    mockSelectResults({ users: [[{ test: 1 }]] });
    const kv = {
      get: vi.fn(async () => undefined),
      put: vi.fn(async () => undefined),
      delete: vi.fn(),
    };

    const response = await request("/health/ready", "GET", undefined, {
      CACHE_KV: kv,
    }).res;

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      status: "not_ready",
    });
    expect(kv.put).toHaveBeenCalledWith("ready-test", "ok", {
      expirationTtl: 60,
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

  it("passes undefined restaurant scope for owners without a restaurant", async () => {
    auth.user = { id: 8, role: 1, restaurantId: null };

    const response = await request("/error-stats").res;

    expect(response.status).toBe(200);
    expect(serviceFns.getErrorStats).toHaveBeenCalledWith(undefined);
  });

  it("uses default cleanup age when query is omitted", async () => {
    auth.user = { id: 1, role: 0 };

    const response = await request("/error-reports/cleanup", "DELETE").res;

    expect(response.status).toBe(200);
    expect(serviceFns.cleanupOldErrorReports).toHaveBeenCalledWith(30);
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
    mockSelectResults({
      healthProbe: [[{ test: 1 }]],
      orders: [
        [{ count: 3 }],
        [
          {
            total_requests: 10,
            recent_requests: 2,
            active_restaurants: 1,
            avg_order_value: 1250,
          },
        ],
      ],
      users: [[{ count: 2 }]],
      restaurants: [[{ count: 1 }]],
      auditLogs: [
        [
          {
            action: "payment_error",
            resource: "orders",
            description: "Card declined",
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      ],
    });

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

  it("returns detailed health recommendations for degraded dependencies", async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce("orders api down")
        .mockRejectedValueOnce(new Error("menu api down"))
        .mockRejectedValueOnce(new Error("orders api down")),
    );
    mockSelectResults({
      healthProbe: [[{ test: 0 }]],
      orders: [[], [{}]],
      users: [[]],
      restaurants: [[]],
      auditLogs: [[]],
    });

    const response = await request("/health/detailed").res;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      overview: { status: "degraded" },
      performance: {
        table_statistics: [
          { table_name: "orders", row_count: 0 },
          { table_name: "users", row_count: 0 },
          { table_name: "restaurants", row_count: 0 },
        ],
      },
      health_score: 50,
    });
    expect(body.performance.endpoint_health).toEqual([
      expect.objectContaining({
        name: "restaurants",
        status: "unhealthy",
        error: "Unknown error",
      }),
      expect.objectContaining({
        name: "menu",
        status: "unhealthy",
        error: "menu api down",
      }),
      expect.objectContaining({
        name: "orders",
        status: "unhealthy",
        error: "orders api down",
      }),
    ]);
    expect(body.recommendations).toEqual(
      expect.arrayContaining([
        "System health score is below optimal. Consider investigating issues.",
        "Unhealthy endpoints detected: restaurants, menu, orders",
      ]),
    );

    vi.stubGlobal("fetch", originalFetch);
  });

  it("does not fabricate synthetic system metrics in health responses", async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );
    mockSelectResults({
      healthProbe: [[{ test: 1 }]],
      orders: [[{ count: 1 }], [{ total_requests: 1 }]],
      users: [[{ count: 1 }]],
      restaurants: [[{ count: 1 }]],
      auditLogs: [[]],
    });

    const detailedResponse = await request("/health/detailed").res;
    const detailedBody = await detailedResponse.json();

    expect(detailedResponse.status).toBe(200);
    // Workers cannot introspect memory/CPU/RPS — reporting invented numbers
    // makes monitoring show a healthy system during a real outage.
    expect(detailedBody).not.toHaveProperty("metrics");
    expect(JSON.stringify(detailedBody)).not.toContain("Memory usage");

    mockSelectResults({ orders: [[{ total_orders: 1 }]] });
    const jsonResponse = await request("/health/metrics").res;
    const jsonBody = await jsonResponse.json();
    expect(jsonResponse.status).toBe(200);
    expect(jsonBody).not.toHaveProperty("system_metrics");

    mockSelectResults({ orders: [[{ total_orders: 1 }]] });
    const prometheusResponse = await request(
      "/health/metrics?format=prometheus",
    ).res;
    const prometheusBody = await prometheusResponse.text();
    expect(prometheusResponse.status).toBe(200);
    expect(prometheusBody).not.toContain("makanmakan_memory_usage_percent");
    expect(prometheusBody).not.toContain("makanmakan_cpu_usage_percent");
    expect(prometheusBody).not.toContain("makanmakan_requests_per_second");
    expect(prometheusBody).not.toContain("makanmakan_error_rate_percent");

    vi.stubGlobal("fetch", originalFetch);
  });

  it("returns health metrics as JSON and Prometheus text", async () => {
    mockSelectResults({
      orders: [
        [
          {
            orders_last_hour: 1,
            orders_last_24h: 5,
            pending_orders: 2,
            preparing_orders: 1,
            total_orders: 20,
          },
        ],
      ],
    });

    let response = await request("/health/metrics").res;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      business_metrics: { total_orders: 20 },
      alert_thresholds: { response_time_warning: 1000 },
    });

    mockSelectResults({ orders: [[{ total_orders: 21, pending_orders: 3 }]] });
    response = await request("/health/metrics?format=prometheus").res;
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/plain");
    expect(await response.text()).toContain("makanmakan_orders_total 21");
  });

  it("returns zeroed Prometheus business metrics when aggregates are empty", async () => {
    mockSelectResults({ orders: [[{}]] });

    const response = await request("/health/metrics?format=prometheus").res;
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("makanmakan_orders_total 0");
    expect(body).toContain("makanmakan_orders_pending 0");
    expect(body).toContain("makanmakan_orders_preparing 0");
  });

  it("routes select fixtures by table and reports missing fixtures", async () => {
    mockSelectResults({
      orders: [[{ count: 1 }]],
      users: [[{ count: 2 }]],
      healthProbe: [[{ test: 1 }]],
    });

    // Read in reverse declaration order: routing follows the table passed to
    // from(), not the execution order.
    await expect(
      database.select({}).from(database.users).limit(1),
    ).resolves.toEqual([{ count: 2 }]);
    await expect(database.select({}).from(database.orders)).resolves.toEqual([
      { count: 1 },
    ]);
    await expect(database.select({}).from(database.orders)).rejects.toThrow(
      "No select fixtures remaining for orders",
    );
    // restaurants is a registered table but wasn't declared for this call,
    // so it reports missing rather than falling back to [] or [{ test: 1 }].
    await expect(
      database.select({}).from(database.restaurants),
    ).rejects.toThrow("Missing select fixture for restaurants");
    // An object that isn't one of this file's four registered tables reports
    // the generic <unknown table> name instead of its own.
    await expect(
      database.select({}).from({ name: "untracked" }),
    ).rejects.toThrow("Missing select fixture for <unknown table>");
    // The raw-SQL health probe query draws from its own queue, not
    // fixtureTables — see the doc comment above HEALTH_PROBE_FROM.
    await expect(database.select({}).from(HEALTH_PROBE_FROM)).resolves.toEqual([
      { test: 1 },
    ]);
    // A query that never calls from() reports distinctly from either
    // missing-fixture case above.
    await expect(Promise.resolve(createQuery(() => []))).rejects.toThrow(
      "Select fixture query never called from(table)",
    );
  });
});
