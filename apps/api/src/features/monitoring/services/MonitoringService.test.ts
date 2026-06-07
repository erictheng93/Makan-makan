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
    vi.mocked(console.error).mockRestore();
    vi.mocked(console.info).mockRestore();
    vi.useRealTimers();
  });

  it("records API request metrics and persists response percentiles", async () => {
    const { kv, values } = createKV();
    const service = new MonitoringService(kv);

    await service.recordApiRequest(100, 200, "/health");
    await service.recordApiRequest(700, 200, "/orders");

    const metrics = JSON.parse(values.get("_system_metrics") ?? "{}");
    expect(metrics.apiMetrics).toMatchObject({
      totalRequests: 2,
      averageResponseTime: 400,
      p95ResponseTime: 700,
      p99ResponseTime: 700,
      slowRequestCount: 1,
    });
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

  it("derives component health and stores the snapshot", async () => {
    const { kv, values } = createKV();
    const service = new MonitoringService(kv);

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
        external: { status: "healthy" },
      },
      version: "2.0.0",
      timestamp: Date.now(),
    });
    expect(JSON.parse(values.get("_system_health") ?? "{}")).toMatchObject({
      overall: "critical",
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

  it("exposes default rules and singleton factory behavior", () => {
    expect(DEFAULT_ALERT_RULES).toHaveLength(3);

    const first = createMonitoringService(createKV().kv);
    const second = createMonitoringService(createKV().kv);

    expect(second).toBe(first);
  });
});
