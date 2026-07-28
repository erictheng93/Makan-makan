/**
 * Monitoring Service
 * Core monitoring and alerting service for the monitoring feature module
 */

import type { KVNamespace } from "@cloudflare/workers-types";
import { ConsoleLogger } from "../../../core/monitoring";
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

/** Environment values getMetrics() needs to reach Analytics Engine. */
export interface MonitoringEnv {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  ANALYTICS_DATASET?: string;
}

/** Aggregation window for the API metrics reported by getMetrics(). */
const METRICS_WINDOW_HOURS = 1;

/**
 * How long an aggregate is served from KV before Analytics Engine is queried
 * again. Also the floor on how often METRICS_KEY is written, which has to stay
 * above KV's 1-write-per-second-per-key limit. KV's own minimum TTL is 60s.
 */
const METRICS_CACHE_TTL_SECONDS = 60;

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
  private readonly HEALTH_KEY = "_system_health";
  private readonly ALERT_RULES_KEY = "_alert_rules";
  private readonly RECENT_ALERTS_KEY = "_recent_alerts";
  private readonly UPTIME_PROBE_KEY_PREFIX = "_uptime_probe:";
  private readonly REQUEST_TIMES: number[] = [];
  private readonly MAX_REQUEST_TIMES = 1000;
  private readonly startTime: number;

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

      await this.saveMetrics();
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

      await this.saveMetrics();
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

      await this.saveMetrics();
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

      await this.saveMetrics();
      this.logger.info(`Error recorded: [${severity}] ${type}: ${message}`);
    } catch (error) {
      this.logger.error("Record error failed", error as Error);
    }
  }

  /**
   * 獲取系統健康狀態
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const now = Date.now();

      // API 健康檢查
      const apiHealth: ComponentHealth = {
        status: this.getApiHealthStatus(),
        latency: this.metrics.apiMetrics.averageResponseTime,
        errorRate: this.metrics.apiMetrics.errorRate,
        lastCheck: now,
        issues: this.getApiIssues(),
      };

      // 數據庫健康檢查
      const databaseHealth: ComponentHealth = {
        status: this.getDatabaseHealthStatus(),
        latency: this.metrics.databaseMetrics.averageQueryTime,
        errorRate:
          this.metrics.databaseMetrics.errorCount /
          Math.max(this.metrics.databaseMetrics.queryCount, 1),
        lastCheck: now,
        issues: this.getDatabaseIssues(),
      };

      // 快取健康檢查
      const cacheHealth: ComponentHealth = {
        status: this.getCacheHealthStatus(),
        lastCheck: now,
        issues: this.getCacheIssues(),
        metrics: {
          hitRate: this.metrics.cacheMetrics.hitRate,
          totalKeys: this.metrics.cacheMetrics.totalKeys,
        },
      };

      // 外部服務健康檢查
      const externalHealth: ComponentHealth = {
        status: "healthy",
        lastCheck: now,
        issues: [],
      };

      // 計算整體健康狀態
      const componentStatuses = [
        apiHealth.status,
        databaseHealth.status,
        cacheHealth.status,
        externalHealth.status,
      ];
      const overall = this.calculateOverallHealth(componentStatuses);

      const healthStatus: HealthStatus = {
        overall,
        components: {
          api: apiHealth,
          database: databaseHealth,
          cache: cacheHealth,
          external: externalHealth,
        },
        uptime: now - this.getStartTime(),
        version: "2.0.0",
        timestamp: now,
      };

      // 儲存健康狀態
      await this.kv.put(this.HEALTH_KEY, JSON.stringify(healthStatus), {
        expirationTtl: 300, // 5分鐘
      });

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
      await this.saveMetrics();
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

  private async saveMetrics(): Promise<void> {
    try {
      this.metrics.timestamp = Date.now();
      await this.kv.put(this.METRICS_KEY, JSON.stringify(this.metrics), {
        expirationTtl: 86400, // 24小時
      });
    } catch (error) {
      this.logger.error("Save metrics error", error as Error);
    }
  }

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
      const existing = await this.kv.get(this.RECENT_ALERTS_KEY);
      const alerts = existing ? JSON.parse(existing) : [];
      alerts.unshift(alert);
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

  private async sendWebhookAlert(
    webhookUrl: string,
    title: string,
    message: string,
    severity: string,
  ): Promise<void> {
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
  {
    name: "Low Cache Hit Rate",
    condition: "cacheMetrics.hitRate < 0.3",
    metric: "cacheMetrics.hitRate",
    operator: "<" as const,
    threshold: 0.3,
    duration: 600,
    config: {
      type: "slack" as const,
      severity: "warning" as const,
      enabled: true,
      interval: 60,
    },
  },
] as const;
