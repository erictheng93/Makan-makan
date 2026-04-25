/**
 * Monitoring Feature Routes
 * All monitoring and alerting related API endpoints
 */

import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { validateBody, validateQuery } from "../../../middleware/validation";
import {
  createMonitoringService,
  DEFAULT_ALERT_RULES,
} from "../services/MonitoringService";
import {
  alertRuleSchema,
  recordErrorSchema,
  metricsQuerySchema,
  performanceReportQuerySchema,
  testAlertSchema,
  updateAlertRuleSchema,
  paginationSchema,
} from "../schemas/validation";
import type { Env } from "../../../types/env";
import type { MonitoringOverview, PerformanceReport } from "../types";
import { badRequest } from "../../../shared/utils/api-error";

const app = new Hono<{ Bindings: Env }>();

// Health check endpoint (public)
app.get("/health", async (c) => {
  const monitoringService = createMonitoringService(c.env.CACHE_KV);
  const healthStatus = await monitoringService.getHealthStatus();

  // Set appropriate status code based on health
  let statusCode = 200;
  if (healthStatus.overall === "critical" || healthStatus.overall === "down") {
    statusCode = 503;
  } else if (healthStatus.overall === "warning") {
    statusCode = 200; // Warning state is still serviceable
  }

  return c.json(healthStatus, statusCode as any);
});

// Get system metrics (admin + owner)
app.get(
  "/metrics",
  authMiddleware,
  requireRole([0, 1]), // Admin + Owner
  validateQuery(metricsQuerySchema),
  async (c) => {
    const { period, granularity } = c.get("validatedQuery");
    const monitoringService = createMonitoringService(c.env.CACHE_KV);
    const metrics = await monitoringService.getMetrics();

    const enhancedMetrics = {
      ...metrics,
      query: {
        period,
        granularity,
        timestamp: Date.now(),
      },
      summary: {
        totalRequestsLastHour: metrics.apiMetrics.totalRequests,
        errorRatePercentage: (metrics.apiMetrics.errorRate * 100).toFixed(2),
        averageResponseTimeMs:
          metrics.apiMetrics.averageResponseTime.toFixed(2),
        cacheHitRatePercentage: (metrics.cacheMetrics.hitRate * 100).toFixed(2),
        totalErrorsLastHour: metrics.errorMetrics.totalErrors,
      },
    };

    return c.json({
      success: true,
      data: enhancedMetrics,
    });
  },
);

// Reset system metrics (admin only - destructive operation)
app.delete("/metrics", authMiddleware, requireRole([0]), async (c) => {
  const monitoringService = createMonitoringService(c.env.CACHE_KV);
  await monitoringService.resetMetrics();

  console.log("System metrics reset by admin");

  return c.json({
    success: true,
    message: "System metrics reset successfully",
    timestamp: Date.now(),
  });
});

// Record error manually (admin only - write operation)
app.post(
  "/errors",
  authMiddleware,
  requireRole([0]),
  validateBody(recordErrorSchema),
  async (c) => {
    const { type, message, severity, metadata } = c.get("validatedBody");
    const monitoringService = createMonitoringService(c.env.CACHE_KV);

    await monitoringService.recordError(type, message, severity);

    console.log(
      `Manual error recorded: [${severity.toUpperCase()}] ${type}: ${message}`,
    );

    return c.json(
      {
        success: true,
        data: {
          type,
          message,
          severity,
          metadata,
          timestamp: Date.now(),
        },
      },
      201,
    );
  },
);

// Alert rules management

// Get all alert rules (admin + owner)
app.get(
  "/alerts/rules",
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(paginationSchema),
  async (c) => {
    const { page, limit } = c.get("validatedQuery");
    const monitoringService = createMonitoringService(c.env.CACHE_KV);
    const allRules = await monitoringService.getAlertRules();

    // Paginate results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedRules = allRules.slice(startIndex, endIndex);

    return c.json({
      success: true,
      data: {
        rules: paginatedRules,
        pagination: {
          page,
          limit,
          total: allRules.length,
          totalPages: Math.ceil(allRules.length / limit),
        },
      },
    });
  },
);

// Create alert rule (admin + owner)
app.post(
  "/alerts/rules",
  authMiddleware,
  requireRole([0, 1]),
  validateBody(alertRuleSchema),
  async (c) => {
    const ruleData = c.get("validatedBody");
    const monitoringService = createMonitoringService(c.env.CACHE_KV);

    const ruleId = await monitoringService.createAlertRule(ruleData);

    console.log(`Alert rule created: ${ruleData.name} (${ruleId})`);

    return c.json(
      {
        success: true,
        data: {
          id: ruleId,
          ...ruleData,
          created: Date.now(),
        },
      },
      201,
    );
  },
);

// Update alert rule (admin + owner)
app.put(
  "/alerts/rules/:id",
  authMiddleware,
  requireRole([0, 1]),
  validateBody(updateAlertRuleSchema),
  async (c) => {
    const ruleId = c.req.param("id");
    if (!ruleId) throw badRequest("Missing id parameter", "MISSING_PARAM");
    const updates = c.get("validatedBody");
    const monitoringService = createMonitoringService(c.env.CACHE_KV);

    const success = await monitoringService.updateAlertRule(
      ruleId,
      updates as Parameters<typeof monitoringService.updateAlertRule>[1],
    );

    if (!success) {
      return c.json({ success: false, error: "Alert rule not found" }, 404);
    }

    return c.json({
      success: true,
      data: {
        id: ruleId,
        updated: Date.now(),
      },
    });
  },
);

// Delete alert rule (admin + owner)
app.delete(
  "/alerts/rules/:id",
  authMiddleware,
  requireRole([0, 1]),
  async (c) => {
    const ruleId = c.req.param("id");
    if (!ruleId) throw badRequest("Missing id parameter", "MISSING_PARAM");
    const monitoringService = createMonitoringService(c.env.CACHE_KV);

    const success = await monitoringService.deleteAlertRule(ruleId);

    if (!success) {
      return c.json({ success: false, error: "Alert rule not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Alert rule deleted successfully",
    });
  },
);

// Get recent alerts for polling (admin + owner)
app.get("/alerts/recent", authMiddleware, requireRole([0, 1]), async (c) => {
  const sinceParam = c.req.query("since");
  const sinceTimestamp = sinceParam ? parseInt(sinceParam, 10) : undefined;
  const monitoringService = createMonitoringService(c.env.CACHE_KV);
  const recentAlerts = await monitoringService.getRecentAlerts(sinceTimestamp);

  return c.json({
    success: true,
    data: {
      alerts: recentAlerts,
      timestamp: Date.now(),
    },
  });
});

// Get default alert rules (admin + owner)
app.get("/alerts/defaults", authMiddleware, requireRole([0, 1]), async (c) => {
  return c.json({
    success: true,
    data: {
      rules: DEFAULT_ALERT_RULES,
      count: DEFAULT_ALERT_RULES.length,
      description: "Default alert rules for system monitoring",
    },
  });
});

// Test alert system (admin + owner)
app.post(
  "/alerts/test",
  authMiddleware,
  requireRole([0, 1]),
  validateBody(testAlertSchema),
  async (c) => {
    const { type, severity, webhookUrl } = c.get("validatedBody");
    const monitoringService = createMonitoringService(c.env.CACHE_KV);

    // Create test alert rule
    await monitoringService.createAlertRule({
      name: "Test Alert",
      condition: "manual_test",
      metric: "test.value",
      operator: ">",
      threshold: 0,
      duration: 0,
      config: {
        type,
        severity,
        enabled: true,
        webhookUrl: webhookUrl || c.env.SLACK_WEBHOOK_URL,
      },
    });

    // Trigger test error
    await monitoringService.recordError(
      "test_alert",
      `Test alert triggered - ${type} notification with ${severity} severity`,
      severity,
    );

    return c.json({
      success: true,
      data: {
        message: "Test alert sent successfully",
        type,
        severity,
        timestamp: Date.now(),
      },
    });
  },
);

// System overview (admin + owner)
app.get("/overview", authMiddleware, requireRole([0, 1]), async (c) => {
  const monitoringService = createMonitoringService(c.env.CACHE_KV);
  const [healthStatus, metrics] = await Promise.all([
    monitoringService.getHealthStatus(),
    monitoringService.getMetrics(),
  ]);

  const overview: MonitoringOverview = {
    status: healthStatus.overall,
    uptime: healthStatus.uptime,
    version: healthStatus.version,
    timestamp: Date.now(),

    keyMetrics: {
      requestsPerMinute: Math.round(metrics.apiMetrics.requestsPerSecond * 60),
      errorRate: `${(metrics.apiMetrics.errorRate * 100).toFixed(2)}%`,
      averageResponseTime: `${metrics.apiMetrics.averageResponseTime.toFixed(0)}ms`,
      cacheHitRate: `${(metrics.cacheMetrics.hitRate * 100).toFixed(1)}%`,
      activeErrors: metrics.errorMetrics.totalErrors,
    },

    components: Object.entries(healthStatus.components).map(
      ([name, component]) => ({
        name,
        status: component.status,
        latency: component.latency,
        issues: component.issues.length,
        issueDetails: component.issues,
        lastCheck: component.lastCheck,
      }),
    ),

    topErrors: Object.entries(metrics.errorMetrics.errorsByType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count })),

    trends: {
      responseTime: {
        current: metrics.apiMetrics.averageResponseTime,
        p95: metrics.apiMetrics.p95ResponseTime,
        p99: metrics.apiMetrics.p99ResponseTime,
      },
      throughput: {
        requestsPerSecond: metrics.apiMetrics.requestsPerSecond,
        totalRequests: metrics.apiMetrics.totalRequests,
      },
    },
  };

  return c.json({
    success: true,
    data: overview,
  });
});

// Performance report (admin + owner)
app.get(
  "/reports/performance",
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(performanceReportQuerySchema),
  async (c) => {
    const { days } = c.get("validatedQuery");
    const monitoringService = createMonitoringService(c.env.CACHE_KV);
    const metrics = await monitoringService.getMetrics();

    const report: PerformanceReport = {
      period: `${days} days`,
      generatedAt: Date.now(),

      apiPerformance: {
        totalRequests: metrics.apiMetrics.totalRequests,
        averageResponseTime: metrics.apiMetrics.averageResponseTime,
        p95ResponseTime: metrics.apiMetrics.p95ResponseTime,
        p99ResponseTime: metrics.apiMetrics.p99ResponseTime,
        errorRate: (metrics.apiMetrics.errorRate * 100).toFixed(2) + "%",
        slowRequests: metrics.apiMetrics.slowRequestCount,
      },

      databasePerformance: {
        totalQueries: metrics.databaseMetrics.queryCount,
        averageQueryTime: metrics.databaseMetrics.averageQueryTime,
        slowQueries: metrics.databaseMetrics.slowQueryCount,
        queryErrorRate:
          (
            (metrics.databaseMetrics.errorCount /
              Math.max(metrics.databaseMetrics.queryCount, 1)) *
            100
          ).toFixed(2) + "%",
      },

      cachePerformance: {
        hitRate: (metrics.cacheMetrics.hitRate * 100).toFixed(2) + "%",
        totalKeys: metrics.cacheMetrics.totalKeys,
        totalSize: `${(metrics.cacheMetrics.totalSize / 1024 / 1024).toFixed(2)} MB`,
        expiringKeys: metrics.cacheMetrics.expiringKeysCount,
      },

      errorAnalysis: {
        totalErrors: metrics.errorMetrics.totalErrors,
        criticalErrors: metrics.errorMetrics.criticalErrors,
        warningsCount: metrics.errorMetrics.warningCount,
        errorsByType: Object.entries(metrics.errorMetrics.errorsByType)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([type, count]) => ({
            type,
            count,
            percentage:
              ((count / metrics.errorMetrics.totalErrors) * 100).toFixed(1) +
              "%",
          })),
      },

      recommendations: generateRecommendations(metrics),
    };

    return c.json({
      success: true,
      data: report,
    });
  },
);

// Helper function to generate recommendations
function generateRecommendations(metrics: any): string[] {
  const recommendations: string[] = [];

  if (metrics.apiMetrics.averageResponseTime > 1000) {
    recommendations.push(
      "Consider optimizing API response time - current average is high",
    );
  }

  if (metrics.apiMetrics.errorRate > 0.05) {
    recommendations.push(
      "API error rate is high - check error logs and fix common issues",
    );
  }

  if (metrics.databaseMetrics.averageQueryTime > 500) {
    recommendations.push(
      "Database query time is slow - optimize slow queries or add indexes",
    );
  }

  if (
    metrics.databaseMetrics.slowQueryCount >
    metrics.databaseMetrics.queryCount * 0.1
  ) {
    recommendations.push(
      "High percentage of slow queries - review and optimize database queries",
    );
  }

  if (metrics.cacheMetrics.hitRate < 0.6) {
    recommendations.push(
      "Cache hit rate is low - review cache strategy and TTL settings",
    );
  }

  if (metrics.cacheMetrics.totalSize > 100 * 1024 * 1024) {
    // 100MB
    recommendations.push(
      "Cache size is large - implement cache cleanup strategy",
    );
  }

  if (metrics.errorMetrics.criticalErrors > 0) {
    recommendations.push(
      "Critical errors present - prioritize fixing and set up monitoring alerts",
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "System is performing well - continue current monitoring and maintenance practices",
    );
  }

  return recommendations;
}

export default app;
