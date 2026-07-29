// @vitest-environment jsdom
// Importing the service pulls in ./api -> errorHandler, whose OfflineManager
// touches window at construction time.

import { describe, expect, it } from "vitest";
import { monitoringService } from "./monitoringService";
import type { SystemMetrics } from "@/types/monitoring";

/**
 * The health score used to deduct 15 points whenever cacheMetrics.hitRate was
 * below 0.3. Nothing populates cacheMetrics, so hitRate was always 0, the
 * condition was always true, and the score was permanently capped at 85 for a
 * reason unrelated to system health.
 *
 * The same always-true condition had already been found and removed from the
 * backend's default alert rules — this copy survived because each rule decided
 * on its own whether to trust its metric. Rules now declare the group they read
 * and unmeasured groups are dropped from both the deduction and the
 * denominator, so the failure cannot be reintroduced by forgetting a check.
 */

function buildMetrics(overrides: Partial<SystemMetrics> = {}): SystemMetrics {
  return {
    timestamp: Date.now(),
    measured: {
      api: true,
      database: false,
      cache: false,
      resources: false,
      errors: true,
    },
    apiMetrics: {
      totalRequests: 1000,
      errorRate: 0,
      averageResponseTime: 100,
      p95ResponseTime: 150,
      p99ResponseTime: 200,
      slowRequestCount: 0,
      requestsPerSecond: 1,
    },
    databaseMetrics: {
      queryCount: 0,
      averageQueryTime: 0,
      slowQueryCount: 0,
      connectionPoolUsage: 0,
      errorCount: 0,
    },
    cacheMetrics: {
      hitRate: 0,
      totalKeys: 0,
      totalSize: 0,
      expiringKeysCount: 0,
      invalidationCount: 0,
    },
    resourceMetrics: {
      memoryUsage: 0,
      cpuUsage: 0,
      activeConnections: 0,
      queueLength: 0,
    },
    errorMetrics: {
      totalErrors: 0,
      criticalErrors: 0,
      warningCount: 0,
      errorsByType: {},
    },
    ...overrides,
  } as SystemMetrics;
}

describe("calculateHealthScore", () => {
  it("awards a perfect score when every measured group meets its target", () => {
    // database and cache are unmeasured and sit at 0, which under the old
    // formula cost 15 points and made 100 unreachable.
    expect(monitoringService.calculateHealthScore(buildMetrics())).toBe(100);
  });

  it("ignores unmeasured groups no matter how bad their values look", () => {
    const withGarbage = buildMetrics({
      databaseMetrics: {
        queryCount: 0,
        averageQueryTime: 99_999,
        slowQueryCount: 0,
        connectionPoolUsage: 0,
        errorCount: 0,
      },
      cacheMetrics: {
        hitRate: 0,
        totalKeys: 0,
        totalSize: 0,
        expiringKeysCount: 0,
        invalidationCount: 0,
      },
    });

    expect(monitoringService.calculateHealthScore(withGarbage)).toBe(100);
  });

  it("scores those same values once the group is measured", () => {
    const measuredAndBad = buildMetrics({
      measured: {
        api: true,
        database: true,
        cache: false,
        resources: false,
        errors: true,
      },
      databaseMetrics: {
        queryCount: 10,
        averageQueryTime: 99_999,
        slowQueryCount: 10,
        connectionPoolUsage: 0,
        errorCount: 0,
      },
    });

    const score = monitoringService.calculateHealthScore(measuredAndBad);
    expect(score).not.toBeNull();
    expect(score!).toBeLessThan(100);
  });

  it("returns null rather than 0 when nothing is measured", () => {
    // 0 would render as a totally broken system; the truth is "unknown".
    const nothing = buildMetrics({
      measured: {
        api: false,
        database: false,
        cache: false,
        resources: false,
        errors: false,
      },
    });

    expect(monitoringService.calculateHealthScore(nothing)).toBeNull();
  });

  it("treats a missing measured block as unmeasured, not as trustworthy", () => {
    const legacy = buildMetrics();
    delete (legacy as { measured?: unknown }).measured;

    expect(monitoringService.calculateHealthScore(legacy)).toBeNull();
  });

  it("does not penalise client 4xx, only server 5xx", () => {
    const clientNoise = buildMetrics({
      errorMetrics: {
        totalErrors: 50,
        criticalErrors: 0,
        warningCount: 0,
        errorsByType: {},
      },
    });
    expect(monitoringService.calculateHealthScore(clientNoise)).toBe(100);

    const serverFaults = buildMetrics({
      errorMetrics: {
        totalErrors: 50,
        criticalErrors: 50,
        warningCount: 0,
        errorsByType: {},
      },
    });
    expect(monitoringService.calculateHealthScore(serverFaults)!).toBeLessThan(
      100,
    );
  });

  it("degrades p99 latency gradually rather than in a cliff", () => {
    const at = (p99: number) =>
      monitoringService.calculateHealthScore(
        buildMetrics({
          apiMetrics: { ...buildMetrics().apiMetrics, p99ResponseTime: p99 },
        }),
      )!;

    // CLAUDE.md targets P99 < 300ms.
    expect(at(300)).toBe(100);
    expect(at(900)).toBeLessThan(at(600));
    expect(at(600)).toBeLessThan(at(300));
    // Past the bad bound the rule is fully spent, not unbounded.
    expect(at(5000)).toBe(at(1500));
  });
});

describe("healthScoreBasis", () => {
  it("reports only the groups the score actually covers", () => {
    expect(monitoringService.healthScoreBasis(buildMetrics())).toEqual([
      "api",
      "errors",
    ]);
  });

  it("is empty when nothing is measured", () => {
    const nothing = buildMetrics({
      measured: {
        api: false,
        database: false,
        cache: false,
        resources: false,
        errors: false,
      },
    });
    expect(monitoringService.healthScoreBasis(nothing)).toEqual([]);
  });
});
