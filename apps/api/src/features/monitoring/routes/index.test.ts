import { beforeEach, describe, expect, it, vi } from "vitest";
import routes from "./index";
import { authMiddleware } from "../../../middleware/auth";

const mocks = vi.hoisted(() => ({
  currentUser: { id: 1, role: 0, restaurantId: "restaurant-1" },
  getHealthStatus: vi.fn(),
  getMetrics: vi.fn(),
  resetMetrics: vi.fn(),
  recordError: vi.fn(),
  getAlertRules: vi.fn(),
  createAlertRule: vi.fn(),
  updateAlertRule: vi.fn(),
  deleteAlertRule: vi.fn(),
  getRecentAlerts: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("user", mocks.currentUser);
    await next();
  }),
  requireRole: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

vi.mock("../services/MonitoringService", () => ({
  DEFAULT_ALERT_RULES: [
    {
      name: "High API Error Rate",
      condition: "apiMetrics.errorRate > 0.1",
      metric: "apiMetrics.errorRate",
      operator: ">",
      threshold: 0.1,
      duration: 300,
      config: { type: "slack", severity: "critical", enabled: true },
    },
    {
      name: "Slow API Response Time",
      condition: "apiMetrics.averageResponseTime > 1000",
      metric: "apiMetrics.averageResponseTime",
      operator: ">",
      threshold: 1000,
      duration: 300,
      config: { type: "slack", severity: "warning", enabled: true },
    },
  ],
  createMonitoringService: vi.fn(() => ({
    getHealthStatus: mocks.getHealthStatus,
    getMetrics: mocks.getMetrics,
    resetMetrics: mocks.resetMetrics,
    recordError: mocks.recordError,
    getAlertRules: mocks.getAlertRules,
    createAlertRule: mocks.createAlertRule,
    updateAlertRule: mocks.updateAlertRule,
    deleteAlertRule: mocks.deleteAlertRule,
    getRecentAlerts: mocks.getRecentAlerts,
  })),
}));

/**
 * Minimal Cache API stand-in. Keyed by URL, which is what the real one matches
 * on for a GET with no Vary.
 */
function installEdgeCache() {
  const store = new Map<string, Response>();
  const cache = {
    match: vi.fn(async (request: Request) => {
      const hit = store.get(request.url);
      return hit ? hit.clone() : undefined;
    }),
    put: vi.fn(async (request: Request, response: Response) => {
      store.set(request.url, response);
    }),
    delete: vi.fn(async () => true),
  };
  vi.stubGlobal("caches", { default: cache });
  return { cache, store };
}

function createEnv() {
  return {
    CACHE_KV: {},
    SLACK_WEBHOOK_URL: "https://hooks.example.test/slack",
  };
}

function jsonRequest(path: string, method: string, body: unknown) {
  return new Request(`https://monitoring.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function metrics(overrides: Record<string, unknown> = {}) {
  return {
    apiMetrics: {
      totalRequests: 120,
      errorRate: 0.075,
      averageResponseTime: 1250,
      p95ResponseTime: 1800,
      p99ResponseTime: 2400,
      slowRequestCount: 12,
      requestsPerSecond: 2,
    },
    databaseMetrics: {
      queryCount: 80,
      averageQueryTime: 650,
      slowQueryCount: 20,
      connectionPoolUsage: 0,
      errorCount: 4,
    },
    cacheMetrics: {
      hitRate: 0.45,
      totalKeys: 30,
      totalSize: 150 * 1024 * 1024,
      expiringKeysCount: 6,
      invalidationCount: 0,
    },
    resourceMetrics: {
      memoryUsage: 0,
      cpuUsage: 0,
      activeConnections: 0,
      queueLength: 0,
    },
    errorMetrics: {
      totalErrors: 10,
      criticalErrors: 2,
      warningCount: 5,
      errorsByType: {
        api_error: 4,
        database_error: 3,
        cache_error: 2,
        misc: 1,
      },
    },
    ...overrides,
  };
}

function health(overrides: Record<string, unknown> = {}) {
  return {
    overall: "healthy",
    uptime: 86400000,
    version: "2.0.0",
    timestamp: 1780790400000,
    components: {
      api: {
        status: "healthy",
        latency: 120,
        issues: [],
        lastCheck: 1780790400000,
      },
      database: {
        status: "warning",
        latency: 650,
        issues: ["Slow query time: 650.00ms"],
        lastCheck: 1780790400000,
      },
    },
    ...overrides,
  };
}

function alertRule(overrides: Record<string, unknown> = {}) {
  return {
    id: "rule-1",
    name: "Slow API",
    condition: "apiMetrics.averageResponseTime > 1000",
    metric: "apiMetrics.averageResponseTime",
    operator: ">",
    threshold: 1000,
    duration: 300,
    config: { type: "slack", severity: "warning", enabled: true },
    isActive: true,
    triggerCount: 0,
    ...overrides,
  };
}

describe("monitoring routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    mocks.getHealthStatus.mockResolvedValue(health());
    mocks.getMetrics.mockResolvedValue(metrics());
    mocks.resetMetrics.mockResolvedValue(undefined);
    mocks.recordError.mockResolvedValue(undefined);
    mocks.getAlertRules.mockResolvedValue([
      alertRule(),
      alertRule({ id: "rule-2" }),
    ]);
    mocks.createAlertRule.mockResolvedValue("rule-new");
    mocks.updateAlertRule.mockResolvedValue(true);
    mocks.deleteAlertRule.mockResolvedValue(true);
    mocks.getRecentAlerts.mockResolvedValue([
      { id: "alert-1", timestamp: 1780790399000 },
    ]);
  });

  afterEach(() => {
    vi.mocked(console.log).mockRestore();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns public health with status based on overall state", async () => {
    const healthyResponse = await routes.fetch(
      new Request("https://monitoring.test/health"),
      createEnv() as never,
    );
    expect(healthyResponse.status).toBe(200);
    await expect(healthyResponse.json()).resolves.toMatchObject({
      overall: "healthy",
      version: "2.0.0",
    });

    mocks.getHealthStatus.mockResolvedValueOnce(health({ overall: "warning" }));
    const warningResponse = await routes.fetch(
      new Request("https://monitoring.test/health"),
      createEnv() as never,
    );
    expect(warningResponse.status).toBe(200);

    mocks.getHealthStatus.mockResolvedValueOnce(
      health({ overall: "critical" }),
    );
    const criticalResponse = await routes.fetch(
      new Request("https://monitoring.test/health"),
      createEnv() as never,
    );
    expect(criticalResponse.status).toBe(503);
  });

  it("returns enhanced metrics and resets metrics", async () => {
    const metricsResponse = await routes.fetch(
      new Request("https://monitoring.test/metrics?period=1h&granularity=5m"),
      createEnv() as never,
    );

    expect(metricsResponse.status).toBe(200);
    await expect(metricsResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        query: {
          period: "1h",
          granularity: "5m",
          timestamp: 1780790400000,
        },
        summary: {
          totalRequestsLastHour: 120,
          errorRatePercentage: "7.50",
          averageResponseTimeMs: "1250.00",
          cacheHitRatePercentage: "45.00",
          totalErrorsLastHour: 10,
        },
      },
    });

    const resetResponse = await routes.fetch(
      new Request("https://monitoring.test/metrics", { method: "DELETE" }),
      createEnv() as never,
    );

    expect(resetResponse.status).toBe(200);
    await expect(resetResponse.json()).resolves.toMatchObject({
      success: true,
      message: "System metrics reset successfully",
      timestamp: 1780790400000,
    });
    expect(mocks.resetMetrics).toHaveBeenCalled();
  });

  it("records manual errors with metadata echoed in the response", async () => {
    const response = await routes.fetch(
      jsonRequest("/errors", "POST", {
        type: "manual_error",
        message: "Manual failure",
        severity: "critical",
        metadata: { orderId: 42 },
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        type: "manual_error",
        message: "Manual failure",
        severity: "critical",
        metadata: { orderId: 42 },
        timestamp: 1780790400000,
      },
    });
    expect(mocks.recordError).toHaveBeenCalledWith(
      "manual_error",
      "Manual failure",
      "critical",
    );
  });

  it("paginates, creates, updates, and deletes alert rules", async () => {
    const listResponse = await routes.fetch(
      new Request("https://monitoring.test/alerts/rules?page=2&limit=1"),
      createEnv() as never,
    );

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      data: {
        rules: [{ id: "rule-2" }],
        pagination: { page: 2, limit: 1, total: 2, totalPages: 2 },
      },
    });

    const createResponse = await routes.fetch(
      jsonRequest("/alerts/rules", "POST", {
        name: "Escaped operator",
        condition: "apiMetrics.averageResponseTime &gt; 1000",
        metric: "apiMetrics.averageResponseTime",
        operator: "&gt;",
        threshold: 1000,
        duration: 300,
        config: { type: "slack", severity: "warning", enabled: true },
      }),
      createEnv() as never,
    );
    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toMatchObject({
      data: {
        id: "rule-new",
        condition: "apiMetrics.averageResponseTime > 1000",
        operator: ">",
        created: 1780790400000,
      },
    });
    expect(mocks.createAlertRule).toHaveBeenCalledWith(
      expect.objectContaining({
        condition: "apiMetrics.averageResponseTime > 1000",
        operator: ">",
      }),
    );

    const updateResponse = await routes.fetch(
      jsonRequest("/alerts/rules/rule-1", "PUT", {
        threshold: 1500,
        operator: "&lt;=",
      }),
      createEnv() as never,
    );
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      data: { id: "rule-1", updated: 1780790400000 },
    });
    expect(mocks.updateAlertRule).toHaveBeenCalledWith("rule-1", {
      threshold: 1500,
      operator: "<=",
    });

    const deleteResponse = await routes.fetch(
      new Request("https://monitoring.test/alerts/rules/rule-1", {
        method: "DELETE",
      }),
      createEnv() as never,
    );
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toMatchObject({
      message: "Alert rule deleted successfully",
    });
  });

  it("returns 404 when alert rule updates or deletes miss", async () => {
    mocks.updateAlertRule.mockResolvedValueOnce(false);
    mocks.deleteAlertRule.mockResolvedValueOnce(false);

    const updateResponse = await routes.fetch(
      jsonRequest("/alerts/rules/missing", "PUT", { threshold: 1500 }),
      createEnv() as never,
    );
    expect(updateResponse.status).toBe(404);
    await expect(updateResponse.json()).resolves.toEqual({
      success: false,
      error: "Alert rule not found",
    });

    const deleteResponse = await routes.fetch(
      new Request("https://monitoring.test/alerts/rules/missing", {
        method: "DELETE",
      }),
      createEnv() as never,
    );
    expect(deleteResponse.status).toBe(404);
  });

  it("returns recent, default, and test alert responses", async () => {
    const recentResponse = await routes.fetch(
      new Request("https://monitoring.test/alerts/recent?since=1780790300000"),
      createEnv() as never,
    );
    expect(recentResponse.status).toBe(200);
    await expect(recentResponse.json()).resolves.toMatchObject({
      data: {
        alerts: [{ id: "alert-1" }],
        timestamp: 1780790400000,
      },
    });
    expect(mocks.getRecentAlerts).toHaveBeenCalledWith(1780790300000);

    const defaultsResponse = await routes.fetch(
      new Request("https://monitoring.test/alerts/defaults"),
      createEnv() as never,
    );
    expect(defaultsResponse.status).toBe(200);
    await expect(defaultsResponse.json()).resolves.toMatchObject({
      data: {
        count: 2,
        description: "Default alert rules for system monitoring",
      },
    });

    const testResponse = await routes.fetch(
      jsonRequest("/alerts/test", "POST", {
        type: "webhook",
        severity: "fatal",
      }),
      createEnv() as never,
    );
    expect(testResponse.status).toBe(200);
    await expect(testResponse.json()).resolves.toMatchObject({
      data: {
        message: "Test alert sent successfully",
        type: "webhook",
        severity: "fatal",
        timestamp: 1780790400000,
      },
    });
    expect(mocks.createAlertRule).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Test Alert",
        config: expect.objectContaining({
          webhookUrl: "https://hooks.example.test/slack",
        }),
      }),
    );
    expect(mocks.recordError).toHaveBeenCalledWith(
      "test_alert",
      "Test alert triggered - webhook notification with fatal severity",
      "fatal",
    );
  });

  it("builds monitoring overview from health and metrics", async () => {
    const response = await routes.fetch(
      new Request("https://monitoring.test/overview"),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      data: {
        status: "healthy",
        uptime: 86400000,
        keyMetrics: {
          requestsPerMinute: 120,
          errorRate: "7.50%",
          averageResponseTime: "1250ms",
          cacheHitRate: "45.0%",
          // Split from a single activeErrors count: of the 10 total, 2 are 5xx
          // and the other 8 are client 4xx, which are usually normal traffic
          // and should not read as system faults.
          serverErrors: 2,
          clientErrors: 8,
        },
        components: [
          { name: "api", status: "healthy", issues: 0 },
          { name: "database", status: "warning", issues: 1 },
        ],
      },
    });
    expect(body.data.topErrors).toEqual(
      expect.arrayContaining([
        { type: "api_error", count: 4 },
        { type: "database_error", count: 3 },
      ]),
    );
    // Omitted unless asked for, so existing callers keep the payload they had.
    expect(body.data.metrics).toBeUndefined();
  });

  // The dashboard needed both /overview and /metrics every refresh, but
  // /overview already loads the metrics to derive keyMetrics and trends.
  // Embedding them on request drops one round trip per refresh for free.
  it("embeds the raw metrics when include=metrics is requested", async () => {
    const response = await routes.fetch(
      new Request("https://monitoring.test/overview?include=metrics"),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.metrics).toMatchObject({
      apiMetrics: { totalRequests: 120 },
      databaseMetrics: { queryCount: 80 },
      cacheMetrics: { hitRate: 0.45 },
    });
    // The embedded copy has to agree with the summary derived from it.
    expect(body.data.keyMetrics.cacheHitRate).toBe("45.0%");
  });

  it("builds performance report with recommendations", async () => {
    const response = await routes.fetch(
      new Request("https://monitoring.test/reports/performance?days=14"),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      data: {
        period: "14 days",
        generatedAt: 1780790400000,
        apiPerformance: {
          totalRequests: 120,
          errorRate: "7.50%",
          slowRequests: 12,
        },
        databasePerformance: {
          totalQueries: 80,
          queryErrorRate: "5.00%",
        },
        cachePerformance: {
          hitRate: "45.00%",
          totalSize: "150.00 MB",
          expiringKeys: 6,
        },
        errorAnalysis: {
          totalErrors: 10,
        },
      },
    });
    expect(body.data.errorAnalysis.errorsByType).toEqual(
      expect.arrayContaining([
        { type: "api_error", count: 4, percentage: "40.0%" },
      ]),
    );
    expect(body.data.recommendations).toEqual(
      expect.arrayContaining([
        "Consider optimizing API response time - current average is high",
        "API error rate is high - check error logs and fix common issues",
        "Database query time is slow - optimize slow queries or add indexes",
        "High percentage of slow queries - review and optimize database queries",
        "Cache hit rate is low - review cache strategy and TTL settings",
        "Cache size is large - implement cache cleanup strategy",
        "Critical errors present - prioritize fixing and set up monitoring alerts",
      ]),
    );
  });

  it("uses the healthy recommendation when metrics are within thresholds", async () => {
    mocks.getMetrics.mockResolvedValueOnce(
      metrics({
        apiMetrics: {
          totalRequests: 5,
          errorRate: 0,
          averageResponseTime: 100,
          p95ResponseTime: 120,
          p99ResponseTime: 140,
          slowRequestCount: 0,
          requestsPerSecond: 1,
        },
        databaseMetrics: {
          queryCount: 10,
          averageQueryTime: 50,
          slowQueryCount: 0,
          connectionPoolUsage: 0,
          errorCount: 0,
        },
        cacheMetrics: {
          hitRate: 0.95,
          totalKeys: 3,
          totalSize: 1024,
          expiringKeysCount: 0,
          invalidationCount: 0,
        },
        errorMetrics: {
          totalErrors: 0,
          criticalErrors: 0,
          warningCount: 0,
          errorsByType: {},
        },
      }),
    );

    const response = await routes.fetch(
      new Request("https://monitoring.test/reports/performance"),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        period: "7 days",
        recommendations: [
          "System is performing well - continue current monitoring and maintenance practices",
        ],
      },
    });
  });

  // The overview is the dashboard's per-refresh request, so without this its
  // cost scaled with the number of people watching: every viewer spent its own
  // KV read and response build for a byte-identical payload.
  it("serves a repeat overview from the edge without touching the backend", async () => {
    installEdgeCache();

    const first = await routes.fetch(
      new Request("https://monitoring.test/overview?include=metrics"),
      createEnv() as never,
    );
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(mocks.getMetrics).toHaveBeenCalled();

    vi.clearAllMocks();
    mocks.getHealthStatus.mockResolvedValue(health());
    mocks.getMetrics.mockResolvedValue(metrics());

    const second = await routes.fetch(
      new Request("https://monitoring.test/overview?include=metrics"),
      createEnv() as never,
    );

    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual(firstBody);
    // No probe, no KV read, no rebuild -- the whole handler was skipped.
    expect(mocks.getHealthStatus).not.toHaveBeenCalled();
    expect(mocks.getMetrics).not.toHaveBeenCalled();

    // Without this header a hit is indistinguishable from a miss in production.
    expect(first.headers.get("x-monitoring-cache")).toBe("miss");
    expect(second.headers.get("x-monitoring-cache")).toBe("hit");
    expect(second.headers.get("cache-control")).toBe(
      first.headers.get("cache-control"),
    );
  });

  // The embedded metrics change the body, so the two shapes cannot share an
  // entry -- a caller asking for metrics must not receive the slim payload.
  it("keeps the two overview shapes in separate cache entries", async () => {
    installEdgeCache();

    await routes.fetch(
      new Request("https://monitoring.test/overview"),
      createEnv() as never,
    );

    const withMetrics = await routes.fetch(
      new Request("https://monitoring.test/overview?include=metrics"),
      createEnv() as never,
    );

    const body = await withMetrics.json();
    expect(body.data.metrics).toBeDefined();
  });

  it("still answers when the runtime has no Cache API", async () => {
    // caches is left unstubbed: the handler must not depend on it existing.
    const response = await routes.fetch(
      new Request("https://monitoring.test/overview"),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  // The entry is shared and unkeyed, which is only sound because the lookup
  // sits behind the auth and role middleware. If it ever moves in front, an
  // anonymous caller reads the system's metrics.
  it("never serves the shared entry to a caller auth would reject", async () => {
    const { cache } = installEdgeCache();

    await routes.fetch(
      new Request("https://monitoring.test/overview"),
      createEnv() as never,
    );
    cache.match.mockClear();

    vi.mocked(authMiddleware).mockImplementationOnce((async (c: {
      json: (body: unknown, status: number) => Response;
    }) => c.json({ success: false }, 401)) as never);

    const response = await routes.fetch(
      new Request("https://monitoring.test/overview"),
      createEnv() as never,
    );

    expect(response.status).toBe(401);
    expect(cache.match).not.toHaveBeenCalled();
  });
});
