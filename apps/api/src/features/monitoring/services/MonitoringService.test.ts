import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ALERT_RULES,
  MonitoringService,
  createMonitoringService,
} from "./MonitoringService";

function createKV() {
  const values = new Map<string, string>();

  return {
    values,
    kv: {
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
      list: vi.fn(async () => ({
        keys: Array.from(values.keys()).map((name) => ({ name })),
      })),
    } as any,
  };
}

describe("MonitoringService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("OK", { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // Regression: recordApiRequest used to end in saveMetrics(), putting the
  // whole metrics object into one KV key on every API request. That was ~355ms
  // of blocking KV write on the critical path of every endpoint, it exceeded
  // KV's 1-write-per-second-per-key limit, and it burned a KV write per
  // request. The per-request record belongs in Analytics Engine, which
  // advancedAnalyticsMiddleware already writes inside waitUntil.
  it("does not touch KV on the request path", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv);

    await service.recordApiRequest(100, 200, "/health");
    await service.recordApiRequest(700, 200, "/orders");

    expect(kv.put).not.toHaveBeenCalled();
  });

  it("still records server failures as alerts", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv);

    await service.recordApiRequest(120, 500, "/orders");

    // 5xx still goes through recordError, which is rare enough to persist.
    expect(kv.put).toHaveBeenCalled();
  });

  it("records server API failures as critical alerts", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv);

    await service.recordApiRequest(1200, 503, "/orders");

    await expect(service.getMetrics()).resolves.toMatchObject({
      apiMetrics: {
        totalRequests: 1,
        averageResponseTime: 1200,
        slowRequestCount: 1,
      },
      errorMetrics: {
        totalErrors: 1,
        criticalErrors: 1,
        errorsByType: { api_error: 1 },
      },
    });
    await expect(service.getRecentAlerts()).resolves.toEqual([
      expect.objectContaining({
        title: "CRITICAL: api_error",
        message: "503 error on /orders",
        severity: "critical",
        type: "slack",
      }),
    ]);
  });

  it("records database, cache, and error metrics", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv);

    await service.recordDatabaseQuery(600, false, "select");
    await service.recordCacheMetrics(0.2, 12, 2048);
    await service.recordError("manual_error", "Manual failure", "warning");

    await expect(service.getMetrics()).resolves.toMatchObject({
      databaseMetrics: {
        queryCount: 1,
        averageQueryTime: 300,
        slowQueryCount: 1,
        errorCount: 1,
      },
      cacheMetrics: {
        hitRate: 0.2,
        totalKeys: 12,
        totalSize: 2048,
      },
      errorMetrics: {
        totalErrors: 3,
        criticalErrors: 1,
        warningCount: 2,
        errorsByType: {
          database_error: 1,
          cache_performance: 1,
          manual_error: 1,
        },
      },
    });
  });

  // Counters still drive degradation when the dependency answers its probe —
  // a reachable but slow database is a warning, not an outage.
  it("derives component health from probes and counters", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv, {
      DB: {
        prepare: vi.fn(() => ({ first: vi.fn(async () => ({ ok: 1 })) })),
      } as never,
    });

    await service.recordApiRequest(700, 200, "/slow");
    await service.recordDatabaseQuery(600, true, "select");
    await service.recordCacheMetrics(0.2, 5, 1000);

    const health = await service.getHealthStatus();

    expect(health).toMatchObject({
      overall: "critical",
      components: {
        api: { status: "warning" },
        database: { status: "warning" },
        cache: { status: "critical" },
        // Nothing checks external, so it says so rather than claiming health.
        external: { status: "unknown" },
      },
      version: "2.0.0",
      timestamp: Date.now(),
    });
  });

  // Regression: the dashboard permanently showed "Low hit rate: 0.00%" against
  // a cache component it simultaneously called healthy. getCacheHealthStatus
  // guarded for "no cache traffic recorded"; getCacheIssues did not, and
  // nothing populates cacheMetrics because cacheMonitoringMiddleware is
  // exported and never registered, so hitRate sat at 0 and the check always
  // fired. An absent measurement is not a problem to report.
  it("reports no cache or database issues when nothing was recorded", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv, {
      DB: {
        prepare: vi.fn(() => ({ first: vi.fn(async () => ({ ok: 1 })) })),
      } as never,
    });

    const health = await service.getHealthStatus();

    expect(health.components.cache.issues).toEqual([]);
    expect(health.components.database.issues).toEqual([]);
    // Status and issues have to agree — the contradiction was the symptom.
    expect(health.components.cache.status).toBe("healthy");
  });

  it("still reports a low hit rate once cache traffic exists", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv, {
      DB: {
        prepare: vi.fn(() => ({ first: vi.fn(async () => ({ ok: 1 })) })),
      } as never,
    });

    await service.recordCacheMetrics(0.2, 12, 2048);
    const health = await service.getHealthStatus();

    expect(health.components.cache.issues).toEqual([
      expect.stringContaining("Low hit rate"),
    ]);
  });

  it("keeps an unknown component out of the overall roll-up", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv, {
      DB: {
        prepare: vi.fn(() => ({ first: vi.fn(async () => ({ ok: 1 })) })),
      } as never,
    });

    const health = await service.getHealthStatus();

    // external is "unknown"; it must neither drag overall down nor prop it up.
    expect(health.components.external.status).toBe("unknown");
    expect(health.overall).toBe("healthy");
  });

  // Regression: getHealthStatus() used to persist the snapshot under
  // _system_health on every call. Nothing ever read that key back, and the
  // method is reachable from the public /monitoring/health endpoint, so any
  // anonymous caller could spend the account's KV write quota one request at a
  // time -- the same hole probeCache() sidesteps by reading a sentinel.
  it("never persists a health snapshot to KV", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv, {
      DB: {
        prepare: vi.fn(() => ({ first: vi.fn(async () => ({ ok: 1 })) })),
      } as never,
    });

    await service.getHealthStatus();

    // Asserted per-key rather than as "no writes at all": getMetrics() runs
    // inside getHealthStatus and legitimately refreshes its own cache key once
    // per METRICS_CACHE_TTL_SECONDS. The health snapshot is the write that has
    // no reader and must stay gone. Matching on the key alone rather than on a
    // full argument list so a reintroduced write is caught whatever options it
    // passes.
    const writtenKeys = kv.put.mock.calls.map(([key]: [string]) => key);
    expect(writtenKeys).not.toContain("_system_health");
  });

  // GET /overview calls getMetrics twice concurrently -- once at the route and
  // once inside getHealthStatus -- so an uncoalesced load raced two Analytics
  // Engine queries and two writes to one KV key on every cold-cache refresh.
  it("shares one load between concurrent getMetrics callers", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv);

    await Promise.all([
      service.getMetrics(),
      service.getMetrics(),
      service.getMetrics(),
    ]);

    const metricsReads = kv.get.mock.calls.filter(
      ([key]: [string]) => key === "_system_metrics",
    );
    expect(metricsReads).toHaveLength(1);
  });

  it("shares one load between getHealthStatus and a concurrent getMetrics", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv, {
      DB: {
        prepare: vi.fn(() => ({ first: vi.fn(async () => ({ ok: 1 })) })),
      } as never,
    });

    await Promise.all([service.getHealthStatus(), service.getMetrics()]);

    const metricsReads = kv.get.mock.calls.filter(
      ([key]: [string]) => key === "_system_metrics",
    );
    expect(metricsReads).toHaveLength(1);
  });

  // The coalescing window must close when the load settles. The service is a
  // module-level singleton that outlives the request, so a retained result
  // would be served stale for the life of the isolate.
  it("reloads metrics for callers that do not overlap", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv);

    await service.getMetrics();
    await service.getMetrics();

    const metricsReads = kv.get.mock.calls.filter(
      ([key]: [string]) => key === "_system_metrics",
    );
    expect(metricsReads).toHaveLength(2);
  });

  // The dashboard plotted database and cache zeroes next to real API latency,
  // presenting unmeasured groups as observed. These flags are what stops that,
  // so they have to track what actually has a data source.
  it("reports database, cache, and resource metrics as unmeasured", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv);

    const metrics = await service.getMetrics();

    expect(metrics.measured).toMatchObject({
      database: false,
      cache: false,
      resources: false,
    });
    // And the zeroes they carry are still zeroes — the flag is the only thing
    // distinguishing "not measured" from "measured as zero".
    expect(metrics.databaseMetrics.queryCount).toBe(0);
    expect(metrics.cacheMetrics.hitRate).toBe(0);
  });

  it("marks api as measured only once the aggregate comes back", async () => {
    const { kv } = createKV();

    // No Analytics Engine credentials -> no aggregate -> api stays unmeasured.
    const withoutAe = await new MonitoringService(kv).getMetrics();
    expect(withoutAe.measured.api).toBe(false);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [{ totalRequests: "10", p95ResponseTime: "40" }],
        }),
      ),
    );
    const withAe = await new MonitoringService(createKV().kv, {
      CLOUDFLARE_ACCOUNT_ID: "acct",
      CLOUDFLARE_API_TOKEN: "token",
      ANALYTICS_DATASET: "ds",
    }).getMetrics();

    expect(withAe.measured.api).toBe(true);
    expect(withAe.apiMetrics.totalRequests).toBe(10);
  });

  function healthyDb() {
    return {
      prepare: vi.fn(() => ({ first: vi.fn(async () => ({ ok: 1 })) })),
    } as never;
  }

  it("reports healthy when both dependencies answer their probes", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv, { DB: healthyDb() });

    const healthy = await service.getHealthStatus();
    expect(healthy).toMatchObject({
      overall: "healthy",
      components: {
        api: { status: "healthy", issues: [] },
        database: { status: "healthy", issues: [] },
        // No cache traffic recorded, so there is nothing to report. This
        // previously asserted issues: ["Low hit rate: 0.00%"] — the assertion
        // was written around the bug rather than against the intent, and
        // pinned a component that claimed to be healthy while listing a
        // problem.
        cache: { status: "healthy", issues: [] },
      },
    });
  });

  // The reason for probing at all. Health used to be derived from in-process
  // counters, so an isolate that had served no traffic reported perfect health
  // no matter what state D1 was in — the endpoint could not report an outage.
  it("reports critical when the database probe fails", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv, {
      DB: {
        prepare: vi.fn(() => ({
          first: vi.fn(async () => {
            throw new Error("D1_ERROR: unreachable");
          }),
        })),
      } as never,
    });

    const status = await service.getHealthStatus();

    expect(status.overall).toBe("critical");
    expect(status.components.database).toMatchObject({ status: "critical" });
    expect(status.components.database.issues?.[0]).toContain("unreachable");
  });

  it("reports critical when no database binding is configured", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv);

    const status = await service.getHealthStatus();

    expect(status.components.database.status).toBe("critical");
  });

  it("surfaces critical API issues from recorded traffic", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv, { DB: healthyDb() });

    await service.recordApiRequest(600, 200, "/slow");
    await service.recordError("rate", "Elevated rate", "warning");
    type MetricsState = Awaited<ReturnType<MonitoringService["getMetrics"]>>;
    (
      service as unknown as { metrics: MetricsState }
    ).metrics.apiMetrics.errorRate = 0.2;

    const degraded = await service.getHealthStatus();
    expect(degraded.components.api).toMatchObject({
      status: "critical",
      issues: ["High error rate: 20.00%", "Slow response time: 600.00ms"],
    });
  });

  it("creates, updates, loads, and deletes alert rules", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    const id = await service.createAlertRule({
      name: "Slow requests",
      condition: "apiMetrics.averageResponseTime > 500",
      metric: "apiMetrics.averageResponseTime",
      operator: ">",
      threshold: 500,
      duration: 60,
      config: { type: "slack", severity: "warning", enabled: true },
    });

    expect(id).toMatch(/^alert_1780790400000_/);
    await expect(service.getAlertRules()).resolves.toMatchObject([
      { id, triggerCount: 0, isActive: true },
    ]);

    await expect(
      service.updateAlertRule(id, { threshold: 1000 }),
    ).resolves.toBe(true);
    await expect(service.deleteAlertRule(id)).resolves.toBe(true);
    await expect(service.deleteAlertRule("missing")).resolves.toBe(false);
  });

  it("returns false when updating an unknown alert rule", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv);

    await expect(
      service.updateAlertRule("missing", { threshold: 10 }),
    ).resolves.toBe(false);
  });

  it("triggers enabled alert rules and stores recent alerts", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv);
    const id = await service.createAlertRule({
      name: "Critical errors",
      condition: "errorMetrics.criticalErrors >= 1",
      metric: "errorMetrics.criticalErrors",
      operator: ">=",
      threshold: 1,
      duration: 60,
      config: {
        type: "webhook",
        severity: "critical",
        enabled: true,
        webhookUrl: "https://alerts.example.test/hook",
      },
    });

    await service.recordError("fatal_error", "Fatal failure", "fatal");

    const rules = await service.getAlertRules();
    expect(rules.find((rule) => rule.id === id)).toMatchObject({
      triggerCount: 1,
      lastTriggered: Date.now(),
    });
    await expect(service.getRecentAlerts()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Critical errors",
          severity: "critical",
          type: "webhook",
        }),
        expect.objectContaining({
          title: "FATAL: fatal_error",
          severity: "fatal",
          type: "slack",
        }),
      ]),
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://alerts.example.test/hook",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("evaluates alert operators and skips inactive, disabled, and cooling rules", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv);

    await service.createAlertRule({
      name: "Less than threshold",
      condition: "errorMetrics.totalErrors < 5",
      metric: "errorMetrics.totalErrors",
      operator: "<",
      threshold: 5,
      duration: 60,
      config: { type: "slack", severity: "warning", enabled: true },
    });
    await service.createAlertRule({
      name: "At most threshold",
      condition: "errorMetrics.totalErrors <= 1",
      metric: "errorMetrics.totalErrors",
      operator: "<=",
      threshold: 1,
      duration: 60,
      config: { type: "slack", severity: "warning", enabled: true },
    });
    const equalityId = await service.createAlertRule({
      name: "Equals threshold",
      condition: "errorMetrics.totalErrors = 1",
      metric: "errorMetrics.totalErrors",
      operator: "=",
      threshold: 1,
      duration: 60,
      config: { type: "slack", severity: "warning", enabled: true },
    });
    const inactiveId = await service.createAlertRule({
      name: "Inactive rule",
      condition: "errorMetrics.totalErrors >= 1",
      metric: "errorMetrics.totalErrors",
      operator: ">=",
      threshold: 1,
      duration: 60,
      config: { type: "slack", severity: "warning", enabled: true },
    });
    await service.createAlertRule({
      name: "Disabled rule",
      condition: "errorMetrics.totalErrors >= 1",
      metric: "errorMetrics.totalErrors",
      operator: ">=",
      threshold: 1,
      duration: 60,
      config: { type: "slack", severity: "warning", enabled: false },
    });
    await service.createAlertRule({
      name: "Unknown operator",
      condition: "errorMetrics.totalErrors != 2",
      metric: "errorMetrics.totalErrors",
      operator: "!=" as never,
      threshold: 2,
      duration: 60,
      config: { type: "slack", severity: "warning", enabled: true },
    });
    await service.updateAlertRule(inactiveId, { isActive: false });

    await service.recordError("first", "First", "info");
    await service.recordError("second", "Second", "info");

    const alerts = await service.getRecentAlerts();
    expect(alerts.map((alert) => alert.title)).toEqual(
      expect.arrayContaining([
        "Less than threshold",
        "At most threshold",
        "Equals threshold",
      ]),
    );
    expect(alerts.map((alert) => alert.title)).not.toEqual(
      expect.arrayContaining([
        "Inactive rule",
        "Disabled rule",
        "Unknown operator",
      ]),
    );

    const rules = await service.getAlertRules();
    expect(rules.find((rule) => rule.id === equalityId)).toMatchObject({
      triggerCount: 1,
    });
  });

  it("filters recent alerts and resets metrics", async () => {
    const { kv } = createKV();
    const service = new MonitoringService(kv);

    await service.recordError("old", "Old alert", "critical");
    vi.advanceTimersByTime(1000);
    const since = Date.now() - 1;
    await service.recordError("new", "New alert", "critical");

    const filtered = await service.getRecentAlerts(since);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({ title: "CRITICAL: new" });

    await service.resetMetrics();
    await expect(service.getMetrics()).resolves.toMatchObject({
      apiMetrics: { totalRequests: 0 },
      errorMetrics: { totalErrors: 0 },
    });
  });

  it("records uptime probe evidence and alerts on failed checks", async () => {
    const { kv, values } = createKV();
    const service = new MonitoringService(kv);

    await service.recordUptimeCheck({
      name: "public_health",
      url: "https://api.makanmasak.com/api/v1/system/health",
      ok: false,
      statusCode: 503,
      responseTime: 1250,
    });

    expect(
      JSON.parse(values.get("_uptime_probe:public_health") ?? "{}"),
    ).toMatchObject({
      name: "public_health",
      url: "https://api.makanmasak.com/api/v1/system/health",
      ok: false,
      statusCode: 503,
      responseTime: 1250,
      checkedAt: Date.now(),
    });
    await expect(service.getMetrics()).resolves.toMatchObject({
      apiMetrics: {
        totalRequests: 1,
        averageResponseTime: 1250,
        slowRequestCount: 1,
      },
      errorMetrics: {
        totalErrors: 1,
        criticalErrors: 1,
        errorsByType: { uptime_check_failed: 1 },
      },
    });
    await expect(service.getRecentAlerts()).resolves.toEqual([
      expect.objectContaining({
        title: "CRITICAL: uptime_check_failed",
        message:
          "Uptime probe public_health failed with status 503 for https://api.makanmasak.com/api/v1/system/health",
        severity: "critical",
      }),
    ]);
  });

  it("falls back safely when saved metrics and alerts are invalid", async () => {
    const { kv, values } = createKV();
    const service = new MonitoringService(kv);
    values.set("_system_metrics", "{bad-json");
    values.set("_recent_alerts", "{bad-json");

    await expect(service.getMetrics()).resolves.toMatchObject({
      apiMetrics: { totalRequests: 0 },
    });
    await expect(service.getRecentAlerts()).resolves.toEqual([]);
  });

  it("falls back safely when saved alert rules are invalid or absent", async () => {
    const { kv, values } = createKV();
    const service = new MonitoringService(kv);

    await expect(service.getAlertRules()).resolves.toEqual([]);

    values.set("_alert_rules", "{bad-json");
    await expect(service.getAlertRules()).resolves.toEqual([]);
  });

  it("exposes default rules and singleton factory behavior", () => {
    // Two, not three: the "Low Cache Hit Rate" rule was removed because
    // cacheMetrics has no data source, so its condition could never be false.
    expect(DEFAULT_ALERT_RULES).toHaveLength(2);
    // Every remaining rule must target a group that is actually measured.
    for (const rule of DEFAULT_ALERT_RULES) {
      expect(rule.metric).toMatch(/^apiMetrics\./);
    }

    const first = createMonitoringService(createKV().kv);
    const second = createMonitoringService(createKV().kv);

    expect(second).toBe(first);
  });
});
