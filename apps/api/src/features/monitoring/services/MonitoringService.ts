/**
 * Monitoring Service
 * Core monitoring and alerting service for the monitoring feature module
 */

import type { D1Database, KVNamespace } from "@cloudflare/workers-types";
import { ConsoleLogger } from "../../../core/monitoring";
import {
  probeCache,
  probeDatabase,
  type ProbeResult,
} from "../../../core/health/probe";
import type {
  SystemMetrics,
  AlertRule,
  AlertConfig,
  HealthStatus,
  ComponentHealth,
} from "../types";
import {
  queryApiRequestAggregate,
  type ApiRequestAggregate,
} from "./analyticsEngineMetrics";

/** Environment the service needs for Analytics Engine reads and health probes. */
export interface MonitoringEnv {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  ANALYTICS_DATASET?: string;
  DB?: D1Database;
  QR_SIGNING_KEY?: string;
  /**
   * Comma-separated hostnames a `webhook` alert rule may be delivered to, e.g.
   * "hooks.example.com,ops.example.com". The URL lives in an alert rule, which
   * is data rather than deployment config, so it is checked against this list
   * at send time. Unset means no webhook alert is sent at all -- see
   * sendWebhookAlert.
   */
  ALERT_WEBHOOK_ALLOWED_HOSTS?: string;
}

/** Aggregation window for the API metrics reported by getMetrics(). */
const METRICS_WINDOW_HOURS = 1;

/**
 * How long an aggregate is served from KV before Analytics Engine is queried
 * again. Also the floor on how often METRICS_KEY is written, which has to stay
 * above KV's 1-write-per-second-per-key limit. KV's own minimum TTL is 60s.
 */
const METRICS_CACHE_TTL_SECONDS = 60;

/**
 * How long a dependency probe is reused before D1 and KV are touched again.
 *
 * getHealthStatus ran a D1 query and a KV read on every call, so the cost of
 * the health signal scaled with the number of people watching it -- ten open
 * dashboards meant ten times the probes for one system's worth of truth. The
 * probe is about the shared dependency, not about the caller, so one result can
 * answer everyone inside the window.
 *
 * Ten seconds is the trade: an outage is reported at most that late, which is
 * far inside the cadence of anything that consumes this (the dashboard polls at
 * 60s), while concurrent viewers collapse onto a single probe.
 */
const HEALTH_PROBE_TTL_MS = 10_000;

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE_TIME_WARNING: 500, // ms
  API_RESPONSE_TIME_CRITICAL: 1000, // ms
  DATABASE_QUERY_TIME_WARNING: 100, // ms
  DATABASE_QUERY_TIME_CRITICAL: 500, // ms
  ERROR_RATE_WARNING: 0.05, // 5%
  ERROR_RATE_CRITICAL: 0.1, // 10%
  CACHE_HIT_RATE_WARNING: 0.6, // 60%
  CACHE_HIT_RATE_CRITICAL: 0.3, // 30%
  MEMORY_USAGE_WARNING: 0.8, // 80%
  MEMORY_USAGE_CRITICAL: 0.9, // 90%
} as const;

const REDACTED_PATH = "[redacted-path]";

/**
 * 把訊息裡的請求路徑換掉，網域留著。
 *
 * 只吃「行首或空白/括號後面的 /xxx」與「絕對網址的路徑段」，所以
 * "requests/second" 這種夾在字中間的斜線不會被誤傷。留下網域是因為 uptime
 * 探測寫的是平台自己的位址，看得出探哪一支才有意義；會識別出租戶的是路徑上
 * 的 id，不是 host。
 */
function redactRequestPaths(message: string): string {
  return message.replace(
    /(https?:\/\/[^\s/]+)(\/\S*)|(?<=^|[\s(<"'[])\/[\w.~%+-]+(?:\/[\w.~%+-]*)*/g,
    (_match, origin: string | undefined) =>
      origin ? `${origin}/${REDACTED_PATH}` : REDACTED_PATH,
  );
}

export type UptimeProbeResult = {
  name: string;
  url: string;
  ok: boolean;
  statusCode?: number;
  responseTime: number;
  checkedAt?: number;
};

/**
 * Enhanced Monitoring Service with modular architecture
 */
export class MonitoringService {
  private kv: KVNamespace;
  private metrics: SystemMetrics;
  private alertRules: AlertRule[];
  private logger: ConsoleLogger;
  private readonly METRICS_KEY = "_system_metrics";
  private readonly ALERT_RULES_KEY = "_alert_rules";
  private readonly RECENT_ALERTS_KEY = "_recent_alerts";
  private readonly UPTIME_PROBE_KEY_PREFIX = "_uptime_probe:";
  private readonly REQUEST_TIMES: number[] = [];
  private readonly MAX_REQUEST_TIMES = 1000;
  private readonly startTime: number;

  /** In-flight getMetrics() load shared by concurrent callers; see getMetrics. */
  private metricsInFlight: Promise<SystemMetrics> | null = null;

  /** Dependency probes shared across callers; see probeDependencies. */
  private probes: {
    startedAt: number;
    result: Promise<[ProbeResult, ProbeResult]>;
  } | null = null;

  private env?: MonitoringEnv;

  /**
   * @param env - Optional. Supplying it lets getMetrics() aggregate real
   *   request metrics from Analytics Engine; without it getMetrics() reports
   *   zeroes rather than failing.
   */
  constructor(kv: KVNamespace, env?: MonitoringEnv) {
    this.kv = kv;
    this.env = env;
    this.metrics = this.createEmptyMetrics();
    this.alertRules = [];
    this.logger = new ConsoleLogger("monitoring");
    this.startTime = Date.now();
  }

  /**
   * 記錄 API 請求指標
   */
  async recordApiRequest(
    responseTime: number,
    statusCode: number,
    endpoint: string,
  ): Promise<void> {
    try {
      // 記錄響應時間
      this.REQUEST_TIMES.push(responseTime);
      if (this.REQUEST_TIMES.length > this.MAX_REQUEST_TIMES) {
        this.REQUEST_TIMES.shift();
      }

      // 更新指標
      this.metrics.apiMetrics.totalRequests++;

      if (statusCode >= 400) {
        this.metrics.apiMetrics.errorRate = this.calculateErrorRate();
      }

      if (responseTime > PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME_WARNING) {
        this.metrics.apiMetrics.slowRequestCount++;
      }

      // 計算平均響應時間
      this.metrics.apiMetrics.averageResponseTime =
        this.calculateAverageResponseTime();
      this.metrics.apiMetrics.p95ResponseTime = this.calculatePercentile(95);
      this.metrics.apiMetrics.p99ResponseTime = this.calculatePercentile(99);

      // 記錄錯誤
      if (statusCode >= 500) {
        await this.recordError(
          "api_error",
          `${statusCode} error on ${endpoint}`,
          "critical",
        );
      }

      // Deliberately does NOT persist. This used to end in saveMetrics(),
      // which wrote the whole metrics object to one KV key on every single
      // API request. That cost ~355ms of blocking KV write on the critical
      // path of every endpoint — it was the largest single latency component
      // in the API, larger than the login work it was measured alongside.
      //
      // It was also wrong three ways over:
      //   - The counters live on a per-isolate singleton, so each isolate held
      //     only the slice of traffic it happened to serve, and every one of
      //     them overwrote the same global key. The stored value was whatever
      //     the last isolate to write believed, never a global total.
      //   - Workers KV allows at most 1 write per second to the same key;
      //     beyond that it returns 429. Above ~1 req/s those writes were
      //     failing and the catch below was swallowing it.
      //   - It burned one KV write per API request against the account quota.
      //
      // The real per-request record already goes to Analytics Engine, written
      // from advancedAnalyticsMiddleware inside waitUntil. getMetrics() now
      // aggregates from there.
    } catch (error) {
      this.logger.error("Record API request error", error as Error);
    }
  }

  /**
   * 記錄數據庫查詢指標
   */
  async recordUptimeCheck(probe: UptimeProbeResult): Promise<void> {
    const checkedAt = probe.checkedAt ?? Date.now();
    const responseTime = Math.max(0, probe.responseTime);

    try {
      this.REQUEST_TIMES.push(responseTime);
      if (this.REQUEST_TIMES.length > this.MAX_REQUEST_TIMES) {
        this.REQUEST_TIMES.shift();
      }

      this.metrics.apiMetrics.totalRequests++;

      if (responseTime > PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME_WARNING) {
        this.metrics.apiMetrics.slowRequestCount++;
      }

      this.metrics.apiMetrics.averageResponseTime =
        this.calculateAverageResponseTime();
      this.metrics.apiMetrics.p95ResponseTime = this.calculatePercentile(95);
      this.metrics.apiMetrics.p99ResponseTime = this.calculatePercentile(99);

      await this.kv.put(
        `${this.UPTIME_PROBE_KEY_PREFIX}${this.sanitizeProbeName(probe.name)}`,
        JSON.stringify({
          ...probe,
          responseTime,
          checkedAt,
        }),
        { expirationTtl: 60 * 60 * 24 * 30 },
      );

      if (!probe.ok) {
        await this.recordError(
          "uptime_check_failed",
          `Uptime probe ${probe.name} failed with status ${
            probe.statusCode ?? "unknown"
          } for ${probe.url}`,
          "critical",
        );
        return;
      }
    } catch (error) {
      this.logger.error("Record uptime check error", error as Error);
    }
  }

  async recordDatabaseQuery(
    queryTime: number,
    success: boolean,
    queryType?: string,
  ): Promise<void> {
    try {
      this.metrics.databaseMetrics.queryCount++;

      if (queryTime > PERFORMANCE_THRESHOLDS.DATABASE_QUERY_TIME_WARNING) {
        this.metrics.databaseMetrics.slowQueryCount++;
      }

      if (!success) {
        this.metrics.databaseMetrics.errorCount++;
        await this.recordError(
          "database_error",
          `Database query failed: ${queryType}`,
          "warning",
        );
      }

      // 更新平均查詢時間
      this.metrics.databaseMetrics.averageQueryTime =
        (this.metrics.databaseMetrics.averageQueryTime + queryTime) / 2;
    } catch (error) {
      this.logger.error("Record database query error", error as Error);
    }
  }

  /**
   * 記錄快取指標
   */
  async recordCacheMetrics(
    hitRate: number,
    totalKeys: number,
    totalSize: number,
  ): Promise<void> {
    try {
      this.metrics.cacheMetrics.hitRate = hitRate;
      this.metrics.cacheMetrics.totalKeys = totalKeys;
      this.metrics.cacheMetrics.totalSize = totalSize;

      if (hitRate < PERFORMANCE_THRESHOLDS.CACHE_HIT_RATE_CRITICAL) {
        await this.recordError(
          "cache_performance",
          `Cache hit rate critically low: ${(hitRate * 100).toFixed(2)}%`,
          "critical",
        );
      }
    } catch (error) {
      this.logger.error("Record cache metrics error", error as Error);
    }
  }

  /**
   * 記錄錯誤
   */
  async recordError(
    type: string,
    message: string,
    severity: "info" | "warning" | "critical" | "fatal",
  ): Promise<void> {
    try {
      this.metrics.errorMetrics.totalErrors++;

      if (severity === "critical" || severity === "fatal") {
        this.metrics.errorMetrics.criticalErrors++;
      } else if (severity === "warning") {
        this.metrics.errorMetrics.warningCount++;
      }

      // 按類型統計錯誤
      this.metrics.errorMetrics.errorsByType[type] =
        (this.metrics.errorMetrics.errorsByType[type] || 0) + 1;

      // 檢查警報規則
      await this.checkAlertRules();

      // 如果是嚴重錯誤，立即發送警報
      if (severity === "critical" || severity === "fatal") {
        await this.sendAlert(
          {
            type: "slack",
            severity,
            enabled: true,
          },
          `${severity.toUpperCase()}: ${type}`,
          message,
        );
      }

      this.logger.info(`Error recorded: [${severity}] ${type}: ${message}`);
    } catch (error) {
      this.logger.error("Record error failed", error as Error);
    }
  }

  /**
   * The D1 and KV liveness probes, reused for HEALTH_PROBE_TTL_MS.
   *
   * The promise is cached rather than its result, so concurrent callers that
   * arrive during a probe share it instead of starting their own. Neither probe
   * rejects -- both resolve to an unhealthy ProbeResult on failure -- so a
   * cached entry can never be a rejected promise waiting to resurface.
   */
  private probeDependencies(): Promise<[ProbeResult, ProbeResult]> {
    const now = Date.now();
    if (this.probes && now - this.probes.startedAt < HEALTH_PROBE_TTL_MS) {
      return this.probes.result;
    }

    const result = Promise.all([
      probeDatabase(this.env?.DB),
      probeCache(this.kv),
    ]) as Promise<[ProbeResult, ProbeResult]>;

    this.probes = { startedAt: now, result };
    return result;
  }

  /**
   * 獲取系統健康狀態
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const now = Date.now();

      // Probe the dependencies rather than reading counters. Every component
      // here used to be derived from this.metrics, which is per-isolate
      // in-process state — an isolate that had served no traffic reported
      // perfect health no matter what state D1 or KV were actually in, so this
      // endpoint could not report an outage. Latency was reported as 0 for the
      // same reason.
      const [[databaseProbe, cacheProbe], apiMetrics] = await Promise.all([
        // Shared for HEALTH_PROBE_TTL_MS across every caller in this isolate,
        // so the probe cost stops scaling with the number of viewers.
        this.probeDependencies(),
        // Real request metrics, aggregated from Analytics Engine. Cached for a
        // minute, so this does not query on every health check.
        this.getMetrics().then((m) => m.apiMetrics),
      ]);

      const apiHealth: ComponentHealth = {
        status: this.getApiHealthStatus(),
        latency: apiMetrics.averageResponseTime,
        errorRate: apiMetrics.errorRate,
        lastCheck: now,
        issues: this.getApiIssues(),
      };

      // Probe and counters answer different questions, so both are kept: the
      // probe catches an outage the counters cannot see, and the counters catch
      // degradation — a reachable but slow dependency — that the probe cannot.
      const databaseHealth: ComponentHealth = {
        status: databaseProbe.healthy
          ? this.getDatabaseHealthStatus()
          : "critical",
        latency: databaseProbe.latencyMs,
        errorRate: databaseProbe.healthy
          ? this.metrics.databaseMetrics.errorCount /
            Math.max(this.metrics.databaseMetrics.queryCount, 1)
          : 1,
        lastCheck: now,
        issues: databaseProbe.error
          ? [databaseProbe.error]
          : this.getDatabaseIssues(),
      };

      const cacheHealth: ComponentHealth = {
        status: cacheProbe.healthy ? this.getCacheHealthStatus() : "critical",
        latency: cacheProbe.latencyMs,
        lastCheck: now,
        issues: cacheProbe.error ? [cacheProbe.error] : this.getCacheIssues(),
        metrics: {
          hitRate: this.metrics.cacheMetrics.hitRate,
          totalKeys: this.metrics.cacheMetrics.totalKeys,
        },
      };

      const configHealth = this.getConfigHealthStatus(now);

      // "external" checks nothing and never has — no probe, no counter, no
      // dependency behind it. It reported "healthy" unconditionally, which on a
      // dashboard is a claim, not a placeholder: a reader has no way to tell it
      // apart from the three components that are genuinely verified. Say
      // "unknown" until something actually checks an external dependency.
      const externalHealth: ComponentHealth = {
        status: "unknown",
        lastCheck: now,
        issues: [],
      };

      // 計算整體健康狀態. external is excluded — an unknown must not drag the
      // overall status down, and must not prop it up either.
      const componentStatuses = [
        apiHealth.status,
        databaseHealth.status,
        cacheHealth.status,
        configHealth.status,
      ];
      const overall = this.calculateOverallHealth(componentStatuses);

      const healthStatus: HealthStatus = {
        overall,
        components: {
          api: apiHealth,
          database: databaseHealth,
          cache: cacheHealth,
          config: configHealth,
          external: externalHealth,
        },
        uptime: now - this.getStartTime(),
        version: "2.0.0",
        timestamp: now,
      };

      // The health status is deliberately not written back to KV. Nothing ever
      // read that key, and this method is reachable from the public
      // /monitoring/health endpoint (which /health redirects to), so the write
      // handed anonymous callers a KV write per request -- the exact quota-burn
      // that probeCache() avoids by reading a sentinel instead of writing one.
      return healthStatus;
    } catch (error) {
      this.logger.error("Get health status error", error as Error);
      throw error;
    }
  }

  /**
   * 獲取系統指標
   */
  async getMetrics(): Promise<SystemMetrics> {
    // Single-flight. GET /overview calls this twice concurrently -- once at the
    // route and once inside getHealthStatus -- which on a cold cache raced two
    // Analytics Engine queries and two writes to the same KV key, against KV's
    // 1-write-per-second-per-key ceiling. Overlapping callers now share one
    // load.
    //
    // Deliberately not a durable memo: createMonitoringService hands back a
    // module-level singleton that outlives the request, so a retained result
    // would be served stale for the life of the isolate. The entry is released
    // as soon as the load settles; KV remains the cross-request cache.
    const inFlight = (this.metricsInFlight ??= this.loadMetrics().finally(
      () => {
        this.metricsInFlight = null;
      },
    ));

    return inFlight;
  }

  private async loadMetrics(): Promise<SystemMetrics> {
    try {
      // Cached aggregate first. This key is now written at most once per
      // METRICS_CACHE_TTL_SECONDS instead of once per request, which keeps it
      // clear of KV's 1-write-per-second-per-key ceiling.
      const saved = await this.kv.get(this.METRICS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }

      const aggregate = await this.queryRequestAggregate();
      if (!aggregate) {
        return this.metrics;
      }

      const metrics: SystemMetrics = {
        ...this.metrics,
        timestamp: Date.now(),
        // Both come from this one aggregate, so both become trustworthy at the
        // same moment and neither may be set without it.
        measured: { ...this.metrics.measured, api: true, errors: true },
        apiMetrics: {
          ...this.metrics.apiMetrics,
          totalRequests: aggregate.totalRequests,
          averageResponseTime: aggregate.averageResponseTime,
          p95ResponseTime: aggregate.p95ResponseTime,
          p99ResponseTime: aggregate.p99ResponseTime,
          slowRequestCount: aggregate.slowRequestCount,
          errorRate:
            aggregate.totalRequests > 0
              ? aggregate.errorCount / aggregate.totalRequests
              : 0,
          requestsPerSecond:
            aggregate.totalRequests / (METRICS_WINDOW_HOURS * 3600),
        },
        errorMetrics: {
          ...this.metrics.errorMetrics,
          totalErrors: aggregate.errorCount,
          criticalErrors: aggregate.criticalErrorCount,
        },
      };

      await this.kv.put(this.METRICS_KEY, JSON.stringify(metrics), {
        expirationTtl: METRICS_CACHE_TTL_SECONDS,
      });

      return metrics;
    } catch (error) {
      this.logger.error("Get metrics error", error as Error);
      return this.metrics;
    }
  }

  /**
   * Null whenever the aggregate cannot be produced — no Analytics Engine
   * credentials configured, or the query failed. Monitoring reporting zeroes
   * is always preferable to monitoring taking an endpoint down.
   */
  private async queryRequestAggregate(): Promise<ApiRequestAggregate | null> {
    const accountId = this.env?.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = this.env?.CLOUDFLARE_API_TOKEN;
    const dataset = this.env?.ANALYTICS_DATASET;

    if (!accountId || !apiToken || !dataset) {
      this.logger.debug(
        "Analytics Engine metrics unavailable: missing account id, API token, or dataset name",
      );
      return null;
    }

    try {
      return await queryApiRequestAggregate({
        accountId,
        apiToken,
        dataset,
        windowHours: METRICS_WINDOW_HOURS,
      });
    } catch (error) {
      this.logger.error("Analytics Engine query error", error as Error);
      return null;
    }
  }

  /**
   * 重置指標
   */
  async resetMetrics(): Promise<void> {
    try {
      this.metrics = this.createEmptyMetrics();
      this.REQUEST_TIMES.length = 0;
      // Detach any load already running so a caller arriving after the reset
      // cannot join it and receive pre-reset numbers.
      this.metricsInFlight = null;
      // Delete rather than write. METRICS_KEY caches the Analytics Engine
      // aggregate; writing this in-process snapshot into it would serve empty
      // counters as if they were the real aggregate until the entry expired.
      await this.kv.delete(this.METRICS_KEY);
      this.logger.info("System metrics reset");
    } catch (error) {
      this.logger.error("Reset metrics error", error as Error);
    }
  }

  /**
   * 創建警報規則
   */
  async createAlertRule(
    rule: Omit<AlertRule, "id" | "triggerCount" | "isActive">,
  ): Promise<string> {
    try {
      const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newRule: AlertRule = {
        ...rule,
        id,
        triggerCount: 0,
        isActive: true,
      };

      this.alertRules.push(newRule);
      await this.saveAlertRules();

      this.logger.info(`Alert rule created: ${rule.name}`, { id });
      return id;
    } catch (error) {
      this.logger.error("Create alert rule error", error as Error);
      throw error;
    }
  }

  /**
   * 獲取所有警報規則
   */
  async getAlertRules(): Promise<AlertRule[]> {
    try {
      const saved = await this.kv.get(this.ALERT_RULES_KEY);
      if (saved) {
        this.alertRules = JSON.parse(saved);
      }
      return this.alertRules;
    } catch (error) {
      this.logger.error("Get alert rules error", error as Error);
      return this.alertRules;
    }
  }

  /**
   * 更新警報規則
   */
  async updateAlertRule(
    id: string,
    updates: Partial<AlertRule>,
  ): Promise<boolean> {
    try {
      // First load existing rules from KV
      await this.getAlertRules();

      const ruleIndex = this.alertRules.findIndex((rule) => rule.id === id);
      if (ruleIndex === -1) {
        return false;
      }

      this.alertRules[ruleIndex] = {
        ...this.alertRules[ruleIndex],
        ...updates,
      };
      await this.saveAlertRules();

      this.logger.info(`Alert rule updated: ${id}`);
      return true;
    } catch (error) {
      this.logger.error("Update alert rule error", error as Error);
      return false;
    }
  }

  /**
   * 刪除警報規則
   */
  async deleteAlertRule(id: string): Promise<boolean> {
    try {
      // First load existing rules from KV
      await this.getAlertRules();

      const initialLength = this.alertRules.length;
      this.alertRules = this.alertRules.filter((rule) => rule.id !== id);

      if (this.alertRules.length < initialLength) {
        await this.saveAlertRules();
        this.logger.info(`Alert rule deleted: ${id}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error("Delete alert rule error", error as Error);
      return false;
    }
  }

  // Private helper methods

  private createEmptyMetrics(): SystemMetrics {
    return {
      timestamp: Date.now(),
      // Nothing populates database, cache, or resource metrics.
      // recordDatabaseQuery is never called anywhere in the codebase;
      // cacheMonitoringMiddleware is exported but never registered; and Workers
      // does not expose memory or CPU to the isolate at all. api flips to true
      // in getMetrics() once the Analytics Engine aggregate comes back.
      // errors is false here, not true. Error counts come from the same
      // Analytics Engine aggregate as the API metrics, so when that query
      // fails getMetrics() falls back to this object and the counts are
      // per-isolate in-process numbers — exactly the kind of data these flags
      // exist to exclude. Marking errors as measured by default let the
      // dashboard report a confident 100 out of "errors" while the aggregate
      // was not running at all. Both flip together in getMetrics().
      measured: {
        api: false,
        database: false,
        cache: false,
        resources: false,
        errors: false,
      },
      apiMetrics: {
        totalRequests: 0,
        errorRate: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        slowRequestCount: 0,
        requestsPerSecond: 0,
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
    };
  }

  // saveMetrics() lived here and wrote this.metrics into METRICS_KEY with a
  // 24 hour TTL, from recordUptimeCheck, recordDatabaseQuery,
  // recordCacheMetrics, recordError and resetMetrics.
  //
  // METRICS_KEY is the Analytics Engine aggregate's cache, and getMetrics()
  // returns early on a hit. So any one of those five paths — a single 5xx
  // reaching recordError was enough — replaced the aggregate with a per-isolate
  // in-process snapshot and locked it in for a day. Production was serving a
  // 20 hour old object with no `measured` block and no AE data, which meant the
  // dashboard's health score was computed from counters that never left one
  // isolate, and the AE query had not run since.
  //
  // Nothing reads that in-process snapshot: getMetrics() is the only reader of
  // METRICS_KEY and it wants the aggregate. The writes were pure interference,
  // so the method is gone rather than moved to its own key.

  private async saveAlertRules(): Promise<void> {
    try {
      await this.kv.put(this.ALERT_RULES_KEY, JSON.stringify(this.alertRules), {
        expirationTtl: 86400, // 24小時
      });
    } catch (error) {
      this.logger.error("Save alert rules error", error as Error);
    }
  }

  private async storeRecentAlert(alert: {
    id: string;
    title: string;
    message: string;
    severity: string;
    type: string;
    timestamp: number;
  }): Promise<void> {
    try {
      // RECENT_ALERTS_KEY 是全平台共用的一把 key，而 message 多半來自
      // metricsMiddleware 轉手的例外訊息與慢請求紀錄，裡面就帶著請求路徑
      // ——路徑上的 restaurant id、order id 是別的租戶的資料。標題只有規則
      // 名稱或 `SEVERITY: type`，不含路徑，所以只洗訊息這一欄。
      const redacted = {
        ...alert,
        message: redactRequestPaths(alert.message),
      };
      const existing = await this.kv.get(this.RECENT_ALERTS_KEY);
      const alerts = existing ? JSON.parse(existing) : [];
      alerts.unshift(redacted);
      // Keep last 50 alerts, max 24h retention
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const filtered = (alerts as { timestamp: number }[])
        .filter((a) => a.timestamp > cutoff)
        .slice(0, 50);
      await this.kv.put(this.RECENT_ALERTS_KEY, JSON.stringify(filtered), {
        expirationTtl: 86400,
      });
    } catch (error) {
      this.logger.error("Store recent alert error", error as Error);
    }
  }

  async getRecentAlerts(
    sinceTimestamp?: number,
  ): Promise<Record<string, unknown>[]> {
    try {
      const saved = await this.kv.get(this.RECENT_ALERTS_KEY);
      if (!saved) return [];
      const alerts = JSON.parse(saved) as ({ timestamp: number } & Record<
        string,
        unknown
      >)[];
      if (sinceTimestamp) {
        return alerts.filter((a) => a.timestamp > sinceTimestamp);
      }
      return alerts;
    } catch (error) {
      this.logger.error("Get recent alerts error", error as Error);
      return [];
    }
  }

  private calculateErrorRate(): number {
    const recentRequests = this.REQUEST_TIMES.slice(-100);
    const errors = recentRequests.filter((time) => time === -1).length; // -1 表示錯誤
    return errors / Math.max(recentRequests.length, 1);
  }

  private calculateAverageResponseTime(): number {
    if (this.REQUEST_TIMES.length === 0) return 0;
    return (
      this.REQUEST_TIMES.reduce((sum, time) => sum + time, 0) /
      this.REQUEST_TIMES.length
    );
  }

  private calculatePercentile(percentile: number): number {
    if (this.REQUEST_TIMES.length === 0) return 0;
    const sorted = [...this.REQUEST_TIMES].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  private getApiHealthStatus(): ComponentHealth["status"] {
    // 「critical」只給真正的失敗（高錯誤率），「critical → 503」由中間件
    // 映射出 503 Service Unavailable。回應慢但仍能服務不該回 503，
    // dev cold start / DTS rebuild / vite warmup 都會輕易跨過 1s 門檻，
    // 過去這會讓前端在 owner-overview mount 時跳「系統錯誤: 服務器錯誤」
    // toast 雖然 API 完全正常。slow latency 最多上升到 warning。
    if (
      this.metrics.apiMetrics.errorRate >
      PERFORMANCE_THRESHOLDS.ERROR_RATE_CRITICAL
    )
      return "critical";
    if (
      this.metrics.apiMetrics.errorRate >
      PERFORMANCE_THRESHOLDS.ERROR_RATE_WARNING
    )
      return "warning";
    if (
      this.metrics.apiMetrics.averageResponseTime >
      PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME_WARNING
    )
      return "warning";
    return "healthy";
  }

  private getDatabaseHealthStatus(): ComponentHealth["status"] {
    if (
      this.metrics.databaseMetrics.averageQueryTime >
      PERFORMANCE_THRESHOLDS.DATABASE_QUERY_TIME_CRITICAL
    )
      return "critical";
    if (
      this.metrics.databaseMetrics.averageQueryTime >
      PERFORMANCE_THRESHOLDS.DATABASE_QUERY_TIME_WARNING
    )
      return "warning";
    return "healthy";
  }

  private getCacheHealthStatus(): ComponentHealth["status"] {
    // No cache activity recorded yet — treat as healthy (not critical)
    if (
      this.metrics.cacheMetrics.totalKeys === 0 &&
      this.metrics.cacheMetrics.hitRate === 0
    )
      return "healthy";
    if (
      this.metrics.cacheMetrics.hitRate <
      PERFORMANCE_THRESHOLDS.CACHE_HIT_RATE_CRITICAL
    )
      return "critical";
    if (
      this.metrics.cacheMetrics.hitRate <
      PERFORMANCE_THRESHOLDS.CACHE_HIT_RATE_WARNING
    )
      return "warning";
    return "healthy";
  }

  private getApiIssues(): string[] {
    const issues: string[] = [];
    if (
      this.metrics.apiMetrics.errorRate >
      PERFORMANCE_THRESHOLDS.ERROR_RATE_WARNING
    ) {
      issues.push(
        `High error rate: ${(this.metrics.apiMetrics.errorRate * 100).toFixed(2)}%`,
      );
    }
    if (
      this.metrics.apiMetrics.averageResponseTime >
      PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME_WARNING
    ) {
      issues.push(
        `Slow response time: ${this.metrics.apiMetrics.averageResponseTime.toFixed(2)}ms`,
      );
    }
    return issues;
  }

  private getDatabaseIssues(): string[] {
    const issues: string[] = [];

    // recordDatabaseQuery is never called anywhere, so queryCount stays 0 and
    // these thresholds describe nothing. Same guard as the cache issues: an
    // absent measurement is not a clean bill of health, but it is not a
    // problem to report either.
    if (this.metrics.databaseMetrics.queryCount === 0) return issues;

    if (
      this.metrics.databaseMetrics.averageQueryTime >
      PERFORMANCE_THRESHOLDS.DATABASE_QUERY_TIME_WARNING
    ) {
      issues.push(
        `Slow query time: ${this.metrics.databaseMetrics.averageQueryTime.toFixed(2)}ms`,
      );
    }
    if (this.metrics.databaseMetrics.errorCount > 0) {
      issues.push(
        `Database errors: ${this.metrics.databaseMetrics.errorCount}`,
      );
    }
    return issues;
  }

  private getCacheIssues(): string[] {
    const issues: string[] = [];

    // Nothing populates cacheMetrics — cacheMonitoringMiddleware is exported
    // and never registered — so hitRate sits at 0 forever. Without this guard
    // the check below always fired and the dashboard permanently displayed
    // "Low hit rate: 0.00%" on a component it simultaneously called healthy,
    // because getCacheHealthStatus() already had the no-data guard and this
    // did not. There is no cache traffic to report a problem about.
    if (!this.hasCacheData()) return issues;

    if (
      this.metrics.cacheMetrics.hitRate <
      PERFORMANCE_THRESHOLDS.CACHE_HIT_RATE_WARNING
    ) {
      issues.push(
        `Low hit rate: ${(this.metrics.cacheMetrics.hitRate * 100).toFixed(2)}%`,
      );
    }
    return issues;
  }

  private getConfigHealthStatus(now: number): ComponentHealth {
    const issues: string[] = [];

    if (!this.env?.QR_SIGNING_KEY || this.env.QR_SIGNING_KEY.length < 32) {
      issues.push("QR_SIGNING_KEY must be set and at least 32 characters");
    }

    return {
      status: issues.length > 0 ? "critical" : "healthy",
      lastCheck: now,
      issues,
    };
  }

  /** Matches the no-data guard in getCacheHealthStatus so the two agree. */
  private hasCacheData(): boolean {
    return (
      this.metrics.cacheMetrics.totalKeys > 0 ||
      this.metrics.cacheMetrics.hitRate > 0
    );
  }

  private calculateOverallHealth(
    statuses: ComponentHealth["status"][],
  ): HealthStatus["overall"] {
    if (statuses.includes("down")) return "down";
    if (statuses.includes("critical")) return "critical";
    if (statuses.includes("warning")) return "warning";
    return "healthy";
  }

  private async checkAlertRules(): Promise<void> {
    try {
      const now = Date.now();

      for (const rule of this.alertRules) {
        if (!rule.isActive || !rule.config.enabled) continue;

        // 檢查冷卻期
        if (
          rule.lastTriggered &&
          now - rule.lastTriggered < (rule.config.interval || 30) * 60 * 1000
        ) {
          continue;
        }

        // 評估條件
        if (await this.evaluateAlertCondition(rule)) {
          rule.triggerCount++;
          rule.lastTriggered = now;

          await this.sendAlert(
            rule.config,
            rule.name,
            `Alert triggered: ${rule.condition}`,
          );
        }
      }

      await this.saveAlertRules();
    } catch (error) {
      this.logger.error("Check alert rules error", error as Error);
    }
  }

  private async sendAlert(
    config: AlertConfig,
    title: string,
    message: string,
  ): Promise<void> {
    try {
      if (!config.enabled) return;

      // Store to recent alerts for polling clients
      await this.storeRecentAlert({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        message,
        severity: config.severity,
        type: config.type,
        timestamp: Date.now(),
      });

      this.logger.info(
        `ALERT [${config.severity.toUpperCase()}]: ${title} - ${message}`,
      );

      if (config.type === "slack" && config.webhookUrl) {
        await this.sendSlackAlert(
          config.webhookUrl,
          title,
          message,
          config.severity,
        );
      } else if (config.type === "webhook" && config.webhookUrl) {
        await this.sendWebhookAlert(
          config.webhookUrl,
          title,
          message,
          config.severity,
        );
      }
    } catch (error) {
      this.logger.error("Send alert error", error as Error);
    }
  }

  private async sendSlackAlert(
    webhookUrl: string,
    title: string,
    message: string,
    severity: string,
  ): Promise<void> {
    try {
      const color =
        {
          info: "#36a64f",
          warning: "#ff9500",
          critical: "#ff4444",
          fatal: "#8b0000",
        }[severity] || "#36a64f";

      const payload = {
        attachments: [
          {
            color,
            title: `🚨 ${title}`,
            text: message,
            fields: [
              {
                title: "Severity",
                value: severity.toUpperCase(),
                short: true,
              },
              {
                title: "Timestamp",
                value: new Date().toISOString(),
                short: true,
              },
            ],
          },
        ],
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status}`);
      }
    } catch (error) {
      this.logger.error("Send Slack alert error", error as Error);
    }
  }

  /**
   * 警報規則裡的 webhookUrl 是資料，不是部署設定：任何能寫入規則的人都能
   * 指定一個位址，平台就會帶著全平台的 metrics 主動打過去。所以送出前先擋
   * 兩層——只走 https，主機必須列在 ALERT_WEBHOOK_ALLOWED_HOSTS。沒設定
   * 允許清單就一律不送（fail closed），寧可漏掉通知也不要把指標交出去。
   */
  private isWebhookUrlAllowed(webhookUrl: string): boolean {
    const allowedHosts = (this.env?.ALERT_WEBHOOK_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter((host) => host.length > 0);

    if (allowedHosts.length === 0) {
      this.logger.warn(
        "Webhook alert not sent: ALERT_WEBHOOK_ALLOWED_HOSTS is not configured",
      );
      return false;
    }

    let parsed: URL;
    try {
      parsed = new URL(webhookUrl);
    } catch {
      this.logger.warn("Webhook alert not sent: malformed webhook URL");
      return false;
    }

    if (parsed.protocol !== "https:") {
      this.logger.warn("Webhook alert not sent: webhook URL must use https");
      return false;
    }

    if (!allowedHosts.includes(parsed.hostname.toLowerCase())) {
      this.logger.warn("Webhook alert not sent: webhook host is not allowed", {
        host: parsed.hostname,
      });
      return false;
    }

    return true;
  }

  private async sendWebhookAlert(
    webhookUrl: string,
    title: string,
    message: string,
    severity: string,
  ): Promise<void> {
    if (!this.isWebhookUrlAllowed(webhookUrl)) return;

    try {
      const payload = {
        title,
        message,
        severity,
        timestamp: new Date().toISOString(),
        metrics: this.metrics,
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }
    } catch (error) {
      this.logger.error("Send webhook alert error", error as Error);
    }
  }

  private async evaluateAlertCondition(rule: AlertRule): Promise<boolean> {
    // 簡化的條件評估邏輯
    const value = this.getMetricValue(rule.metric);

    switch (rule.operator) {
      case ">":
        return value > rule.threshold;
      case "<":
        return value < rule.threshold;
      case ">=":
        return value >= rule.threshold;
      case "<=":
        return value <= rule.threshold;
      case "=":
        return value === rule.threshold;
      default:
        return false;
    }
  }

  private getMetricValue(metric: string): number {
    // 根據指標路徑獲取值
    const parts = metric.split(".");
    let value: unknown = this.metrics;

    for (const part of parts) {
      value = (value as Record<string, unknown> | undefined)?.[part];
    }

    return typeof value === "number" ? value : 0;
  }

  private sanitizeProbeName(name: string): string {
    const sanitized = name.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
    return sanitized || "unnamed";
  }

  private getStartTime(): number {
    // Workers isolate 沒有持久化的程序啟動時間 — 回報本實例建立時間。
    // uptime 因此代表「此 isolate 存活時長」，而非虛構的 24 小時。
    return this.startTime;
  }
}

// Service factory
let monitoringServiceInstance: MonitoringService | null = null;

export function createMonitoringService(
  kv: KVNamespace,
  env?: MonitoringEnv,
): MonitoringService {
  if (!monitoringServiceInstance) {
    monitoringServiceInstance = new MonitoringService(kv, env);
  }
  return monitoringServiceInstance;
}

// Pre-defined alert rules
export const DEFAULT_ALERT_RULES = [
  {
    name: "High API Error Rate",
    condition: "apiMetrics.errorRate > 0.1",
    metric: "apiMetrics.errorRate",
    operator: ">" as const,
    threshold: 0.1,
    duration: 300,
    config: {
      type: "slack" as const,
      severity: "critical" as const,
      enabled: true,
      interval: 15,
    },
  },
  {
    name: "Slow API Response Time",
    condition: "apiMetrics.averageResponseTime > 1000",
    metric: "apiMetrics.averageResponseTime",
    operator: ">" as const,
    threshold: 1000,
    duration: 300,
    config: {
      type: "slack" as const,
      severity: "warning" as const,
      enabled: true,
      interval: 30,
    },
  },
  // There was a "Low Cache Hit Rate" rule here, on cacheMetrics.hitRate < 0.3.
  // Nothing populates cacheMetrics — cacheMonitoringMiddleware is exported but
  // never registered — so hitRate is always 0 and the condition could never be
  // anything but true. It never fired only because no evaluator exists: grep
  // the repo and there is no checkAlerts or evaluateCondition anywhere, so
  // these rules are stored configuration that nothing acts on. Whoever wires
  // evaluation up would have been greeted by a warning that fires immediately
  // and forever. Add it back alongside a real cache metric, not before.
] as const;
