import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context, Next } from "hono";
import type { AuthUser } from "../../../middleware/auth";
import {
  createSelectFixtureDb,
  type SelectFixtures,
} from "@makanmasak/database/testing";

const auth = vi.hoisted(() => ({
  user: undefined as undefined | AuthUser,
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: Context, next: Next) => {
    c.set(
      "user",
      auth.user ?? {
        id: "user-7",
        username: "admin",
        role: 0,
        restaurantId: "S-20250124-001",
      },
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
 * This is a route file: a harness throw does NOT show up as a thrown error
 * in the assertion diff — it shows up as an unexpected status code or body.
 * Most `/health*` handlers wrap their db work in their own local try/catch
 * (`runBasicHealthCheck` in ../index.ts:373-393, `/health/ready` at
 * index.ts:828-872) before `app.onError` (wired above) ever gets a chance,
 * and those catch blocks put `error.message` straight into the response —
 * `services[].error` for the basic health check, `body.error` for
 * `/health/ready`. Routes that don't catch locally fall through to
 * `app.onError`, which embeds `String(err)` into `error.message` of the 500
 * JSON. Either way the harness's "Missing/No select fixtures ..." text DOES
 * reach the response body — it just lands inside an `error`/`services[].error`
 * field on an unexpectedly-500/degraded/unhealthy result instead of failing
 * the assertion directly. When a test fails that way, inspect
 * `response.json()` (or the failed assertion's actual value) for that text
 * rather than expecting a rejected promise.
 *
 * `runBasicHealthCheck` (in ../index.ts) no longer goes through Drizzle. It
 * probes the raw binding — `env.DB.withSession(...).prepare("SELECT 1 AS
 * test").all()` — because `served_by_primary` / `served_by_region` live on
 * `D1Result.meta` and the query builder does not surface them (#321).
 *
 * `healthProbe` stays the knob for it so every existing test reads the same,
 * but it now feeds `probeQueue` below rather than a Drizzle fixture queue.
 * Declaring it under `fixtureTables` as well is harmless — the select fixture
 * helper does not complain about fixtures nothing consumed.
 */
const fixtureTables = {
  orders: database.orders,
  users: database.users,
  restaurants: database.restaurants,
  auditLogs: database.auditLogs,
};
type SelectFixtureName = keyof typeof fixtureTables | "healthProbe";

// Rows the next D1 health probe returns, and an error to throw instead.
let probeQueue: unknown[][] = [];
let probeError: unknown = null;
let probeMeta: Record<string, unknown> = {};
// How long the D1 probe takes to answer. Only the timing test sets it; it is
// how that test tells a KV number that includes D1's from one that does not.
let probeDelayMs = 0;

function mockSelectResults(fixtures: SelectFixtures<SelectFixtureName> = {}) {
  const { healthProbe, ...tableFixtures } = fixtures as Record<
    string,
    unknown[][]
  >;
  probeQueue = healthProbe ? [...healthProbe] : [];
  probeError = null;
  probeMeta = {};
  probeDelayMs = 0;

  const fixtureDb = createSelectFixtureDb(
    fixtureTables,
    tableFixtures as SelectFixtures<keyof typeof fixtureTables>,
  );
  database.select.mockImplementation((selection: unknown) => {
    database.selectCalls.push(selection);
    return fixtureDb.select();
  });
}

function createProbeD1() {
  const all = vi.fn(async () => {
    if (probeDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, probeDelayMs));
    }
    if (probeError) throw probeError;
    const rows = probeQueue.shift();
    if (!rows) {
      // Mirrors the select-fixture helper: name the missing fixture rather
      // than quietly reporting a healthy database.
      throw new Error("No health probe fixtures remaining for healthProbe");
    }
    return { results: rows, meta: probeMeta };
  });

  // Typed to take the arguments the route actually passes: the test file is in
  // the typecheck project, and a zero-arg vi.fn() here fails tsc even though
  // vitest runs it happily.
  return {
    withSession: vi.fn((_constraint: string) => ({
      prepare: vi.fn((_query: string) => ({ all })),
    })),
  };
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
    DB: createProbeD1(),
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
    auth.user = {
      id: "user-42",
      username: "owner",
      role: 1,
      restaurantId: "S-20250124-001",
    };

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
      "user-42",
      "S-20250124-001",
      "vitest",
    );
  });

  it("submits strict error reports without a restaurant scope", async () => {
    auth.user = {
      id: "user-43",
      username: "admin",
      role: 0,
      restaurantId: undefined,
    };

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
      "user-43",
      null,
      "vitest",
    );
  });

  it("normalizes loose browser error telemetry", async () => {
    auth.user = {
      id: "user-9",
      username: "chef",
      role: 2,
      restaurantId: undefined,
    };

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
      "user-9",
      null,
      "vitest",
    );
  });

  it("normalizes mixed loose browser error arrays", async () => {
    auth.user = {
      id: "user-10",
      username: "customer",
      role: 5,
      restaurantId: 77,
    };
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
      "user-10",
      "77",
      "vitest",
    );

    vi.useRealTimers();
  });

  it("stores performance telemetry in scoped KV records", async () => {
    auth.user = {
      id: "user-5",
      username: "owner",
      role: 1,
      restaurantId: "S-20250124-002",
    };

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
      "system:performance:S-20250124-002:user-5:perf%201",
      expect.stringContaining('"lcp":123'),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
    expect(kv.put).toHaveBeenCalledWith(
      "system:performance:S-20250124-002:user-5:latest",
      expect.any(String),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
  });

  it("stores global performance telemetry using alternate report ids", async () => {
    auth.user = {
      id: "user-6",
      username: "admin",
      role: 0,
      restaurantId: undefined,
    };

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
      "system:performance:global:user-6:sync%2F42",
      expect.stringContaining('"duration":42'),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
    expect(kv.put).toHaveBeenCalledWith(
      "system:performance:global:user-6:latest",
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
    const body = await response.json<{ targets: unknown[] }>();

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

  it("surfaces which D1 instance answered when D1 reports it", async () => {
    mockSelectResults({ healthProbe: [[{ test: 1 }]] });
    probeMeta = { served_by_primary: false, served_by_region: "WNAM" };

    const response = await request("/health").res;
    const body = (await response.json()) as {
      services: { name: string; servedByPrimary?: boolean }[];
    };

    // The only proof read replication is doing anything (#321). The config
    // toggle and the withSession() call are both silent, so without this the
    // difference between a working replica and a no-op is guesswork.
    expect(body.services).toContainEqual(
      expect.objectContaining({
        name: "database",
        servedByPrimary: false,
        servedByRegion: "WNAM",
      }),
    );
  });

  it("omits the served-by fields where D1 does not report them", async () => {
    mockSelectResults({ healthProbe: [[{ test: 1 }]] });

    const response = await request("/health").res;
    const body = (await response.json()) as {
      services: Record<string, unknown>[];
    };
    const database = body.services.find((s) => s.name === "database");

    // miniflare returns neither field, so the health payload must not invent
    // them — an absent field has to stay absent rather than read as "primary".
    expect(database).toBeDefined();
    expect(database).not.toHaveProperty("servedByPrimary");
    expect(database).not.toHaveProperty("servedByRegion");
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
      // The default probe reads, so it is the read that has to fail. Failing
      // `put` here would prove nothing: the public endpoint no longer writes.
      get: vi.fn(async () => {
        throw new Error("kv unavailable");
      }),
      put: vi.fn(),
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

  it("reports degraded health when the deep KV probe reads back the wrong value", async () => {
    mockSelectResults({ healthProbe: [[{ test: 1 }]] });
    const kv = createKv();
    kv.get.mockResolvedValueOnce("stale");

    // Only the write probe can tell "wrong value" from "reachable": the
    // default read probe reads a sentinel it never wrote, so any value it gets
    // back — including none — still proves the round trip.
    const response = await request("/health?deep=1", "GET", undefined, {
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

  it("spends no KV write on the public health probe", async () => {
    mockSelectResults({ healthProbe: [[{ test: 1 }]] });

    const { res, kv } = request("/health");
    const response = await res;
    const body = await response.json();

    // #324: this endpoint used to cost three write-class KV round trips per
    // anonymous call — put + get + delete for the probe, then a put of the
    // uptime evidence key. In production each of those was ~420ms, and the
    // endpoint is the one external monitors poll.
    expect(kv.put).not.toHaveBeenCalled();
    expect(kv.delete).not.toHaveBeenCalled();
    expect(kv.get).toHaveBeenCalledTimes(1);
    expect(kv.get).toHaveBeenCalledWith("_health_probe");

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "healthy",
      services: [
        expect.objectContaining({ name: "database" }),
        expect.objectContaining({ name: "kv_storage", probe: "read" }),
      ],
    });
  });

  it("runs the write-path probe and records evidence only when asked", async () => {
    mockSelectResults({ healthProbe: [[{ test: 1 }]] });

    const { res, kv } = request("/health?deep=1");
    const response = await res;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "healthy",
      services: [
        expect.objectContaining({ name: "database" }),
        expect.objectContaining({
          name: "kv_storage",
          status: "healthy",
          probe: "read-write",
        }),
      ],
    });

    expect(kv.put).toHaveBeenCalledWith(
      expect.stringMatching(/^health-check-/),
      "test",
      { expirationTtl: 60 },
    );
    expect(kv.put).toHaveBeenCalledWith(
      "system:uptime:last-check",
      expect.stringContaining('"status":"healthy"'),
      { expirationTtl: 60 * 60 * 24 * 7 },
    );
    expect(kv.delete).toHaveBeenCalledWith(
      expect.stringMatching(/^health-check-/),
    );
  });

  it("treats an explicit deep=0 as the cheap probe", async () => {
    mockSelectResults({ healthProbe: [[{ test: 1 }]] });

    const { res, kv } = request("/health?deep=0");
    await res;

    // Otherwise `deep=0` reads as a non-empty string and opts in, which is the
    // opposite of what it says.
    expect(kv.put).not.toHaveBeenCalled();
  });

  it("times the KV probe from its own start rather than the request's", async () => {
    mockSelectResults({ healthProbe: [[{ test: 1 }]] });
    probeDelayMs = 150;

    const response = await request("/health").res;
    const body = await response.json<{
      services: { name: string; responseTime: number }[];
    }>();
    const database = body.services.find((s) => s.name === "database");
    const cache = body.services.find((s) => s.name === "kv_storage");

    // #324 read the KV probe as three times the cost of D1. Both checks shared
    // one clock started before the D1 query, so every millisecond D1 spent was
    // counted again inside the KV number. The two probes are also concurrent
    // now, so a slow D1 must not show up in the KV figure at all.
    expect(database?.responseTime).toBeGreaterThanOrEqual(100);
    expect(cache?.responseTime).toBeLessThan(100);
  });

  it("reports database health check errors", async () => {
    probeError = "database unavailable";

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
    auth.user = {
      id: "user-7",
      username: "owner",
      role: 1,
      restaurantId: "S-20250124-003",
    };

    let response = await request(
      "/error-stats?restaurantId=S-20250124-004&days=14",
    ).res;
    expect(response.status).toBe(200);
    expect(serviceFns.getErrorStats).toHaveBeenCalledWith("S-20250124-003");

    auth.user = { id: "user-1", username: "admin", role: 0 };
    response = await request("/error-stats?restaurantId=S-20250124-004").res;
    expect(response.status).toBe(200);
    expect(serviceFns.getErrorStats).toHaveBeenCalledWith("S-20250124-004");

    response = await request("/error-reports/cleanup?daysOld=45", "DELETE").res;
    expect(response.status).toBe(200);
    expect(serviceFns.cleanupOldErrorReports).toHaveBeenCalledWith(45);
  });

  it("passes undefined restaurant scope for owners without a restaurant", async () => {
    auth.user = {
      id: "user-8",
      username: "owner",
      role: 1,
      restaurantId: undefined,
    };

    const response = await request("/error-stats").res;

    expect(response.status).toBe(200);
    expect(serviceFns.getErrorStats).toHaveBeenCalledWith(undefined);
  });

  it("uses default cleanup age when query is omitted", async () => {
    auth.user = { id: "user-1", username: "admin", role: 0 };

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
    const body = await response.json<{
      performance: { endpoint_health: unknown[] };
      recommendations: unknown[];
    }>();

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
    // healthProbe is no longer a Drizzle fixture at all — it feeds the raw D1
    // session probe, which is why declaring it above did not consume one of
    // these queues.
    const probe = createProbeD1();
    await expect(
      probe
        .withSession("first-unconstrained")
        .prepare("SELECT 1 AS test")
        .all(),
    ).resolves.toEqual({ results: [{ test: 1 }], meta: {} });
    await expect(
      probe
        .withSession("first-unconstrained")
        .prepare("SELECT 1 AS test")
        .all(),
    ).rejects.toThrow("No health probe fixtures remaining for healthProbe");
    // A query that never calls from() reports distinctly from either
    // missing-fixture case above.
    await expect(Promise.resolve(database.select({}))).rejects.toThrow(
      "Select fixture query never called from(table)",
    );
  });
});
