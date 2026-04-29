/**
 * System Routes
 * All system-level endpoints including error reporting, health checks, and maintenance
 */

import { Hono } from "hono";
import { z } from "zod";
import { validateBody, validateQuery } from "../../../middleware/validation";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { SystemService } from "../services/SystemService";
import {
  errorReportSchema,
  errorStatsQuerySchema,
  cleanupQuerySchema,
} from "../schemas/validation";
import type { Env } from "../../../shared/types";
import type { ISystemService } from "../types";

// Create feature router
const routes = new Hono<{ Bindings: Env }>();
const systemTelemetrySchema = z.object({}).passthrough();

function createTelemetryId(payload: Record<string, unknown>): string {
  for (const key of ["report_id", "reportId", "sync_id", "syncId", "id"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return encodeURIComponent(value);
    }
  }
  return `${Date.now()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getOptionalPrimitive(value: unknown): string | number | undefined {
  return typeof value === "string" || typeof value === "number"
    ? value
    : undefined;
}

function toSystemErrorType(value: unknown) {
  switch (value) {
    case "network":
    case "validation":
      return value;
    case "api":
    case "sse":
    case "permission":
      return value;
    case "authentication":
      return "permission";
    default:
      return "unknown";
  }
}

function toSystemErrorSeverity(value: unknown) {
  switch (value) {
    case "low":
    case "medium":
    case "high":
    case "critical":
      return value;
    default:
      return "low";
  }
}

function toIsoTimestamp(value: unknown): string {
  const date =
    typeof value === "number" || typeof value === "string"
      ? new Date(value)
      : new Date();

  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

function normalizeLegacyError(
  raw: unknown,
  fallbackUserAgent?: string,
): z.infer<typeof errorReportSchema>["errors"][number] {
  const input = isRecord(raw) ? raw : {};
  const context = isRecord(input.context) ? input.context : {};
  const contextUser = isRecord(context.user) ? context.user : {};
  const contextExtra = isRecord(context.extra) ? context.extra : {};

  return {
    type: toSystemErrorType(input.category ?? input.type),
    severity: toSystemErrorSeverity(input.severity),
    code: getOptionalPrimitive(input.code),
    message:
      getString(input.message) ??
      getString(input.name) ??
      "Unknown client error",
    originalError: input,
    context,
    timestamp: toIsoTimestamp(input.timestamp),
    userAgent: getString(input.userAgent) ?? fallbackUserAgent,
    url: getString(input.url) ?? getString(context.url) ?? "",
    userId:
      getOptionalPrimitive(input.userId) ??
      getOptionalPrimitive(contextUser.id),
    restaurantId:
      getOptionalPrimitive(input.restaurantId) ??
      getOptionalPrimitive(contextExtra.restaurantId),
  };
}

/**
 * Error reporting endpoint
 * POST /api/v1/system/error-report
 */
routes.post(
  "/error-report",
  authMiddleware,
  validateBody(errorReportSchema),
  async (c) => {
    const { errors } = c.get("validatedBody");
    const user = c.get("user");
    const userAgent = c.req.header("User-Agent");

    const systemService: ISystemService = new SystemService(
      c.env.DB,
      c.env,
      c.env.CACHE_KV,
    );

    const result = await systemService.createErrorReport(
      { errors } as Parameters<typeof systemService.createErrorReport>[0],
      user.id,
      user.restaurantId == null ? null : String(user.restaurantId),
      userAgent,
    );

    return c.json(result);
  },
);

/**
 * Legacy client error reporting compatibility endpoint
 * POST /api/v1/system/errors
 */
routes.post(
  "/errors",
  authMiddleware,
  validateBody(systemTelemetrySchema),
  async (c) => {
    const payload = c.get("validatedBody") as Record<string, unknown>;
    const user = c.get("user");
    const userAgent = c.req.header("User-Agent");
    const rawErrors = Array.isArray(payload.errors)
      ? payload.errors
      : [payload];
    const errors = rawErrors.map((error) =>
      normalizeLegacyError(error, userAgent),
    );

    const systemService: ISystemService = new SystemService(
      c.env.DB,
      c.env,
      c.env.CACHE_KV,
    );

    const result = await systemService.createErrorReport(
      { errors },
      user.id,
      user.restaurantId == null ? null : String(user.restaurantId),
      userAgent,
    );

    return c.json(result);
  },
);

/**
 * Client performance telemetry compatibility endpoint
 * POST /api/v1/system/performance
 */
routes.post(
  "/performance",
  authMiddleware,
  validateBody(systemTelemetrySchema),
  async (c) => {
    const payload = c.get("validatedBody") as Record<string, unknown>;
    const user = c.get("user");
    const now = new Date().toISOString();
    const reportId = createTelemetryId(payload);
    const restaurantId =
      user.restaurantId == null ? "global" : String(user.restaurantId);
    const scope = encodeURIComponent(restaurantId);
    const record = {
      userId: user.id,
      restaurantId:
        user.restaurantId == null ? null : String(user.restaurantId),
      payload,
      userAgent: c.req.header("User-Agent") ?? null,
      receivedAt: now,
    };

    await c.env.CACHE_KV.put(
      `system:performance:${scope}:${user.id}:${reportId}`,
      JSON.stringify(record),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
    await c.env.CACHE_KV.put(
      `system:performance:${scope}:${user.id}:latest`,
      JSON.stringify(record),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );

    return c.json({
      success: true,
      data: {
        reportId,
        stored: true,
        restaurantId: record.restaurantId,
        receivedAt: now,
      },
    });
  },
);

// 健康檢查狀態接口
interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

interface ServiceCheck {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime?: number;
  error?: string;
  lastCheck: string;
}

interface SystemMetrics {
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu?: {
    usage: number;
  };
  requests?: {
    total: number;
    rps: number; // requests per second
    errorRate: number;
  };
}

interface EndpointHealth {
  name: string;
  path: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  statusCode?: number;
  error?: string;
}

// 模擬系統指標（在實際環境中會從實際系統獲取）
function getSystemMetrics(): SystemMetrics {
  return {
    memory: {
      used: Math.floor(Math.random() * 100) + 50, // MB
      total: 512, // MB
      percentage: Math.floor(Math.random() * 60) + 20,
    },
    cpu: {
      usage: Math.floor(Math.random() * 50) + 10,
    },
    requests: {
      total: Math.floor(Math.random() * 10000) + 1000,
      rps: Math.floor(Math.random() * 100) + 10,
      errorRate: Math.random() * 2, // 0-2%
    },
  };
}

/**
 * 基本健康檢查 (公開端點)
 * GET /api/v1/system/health
 */
routes.get("/health", async (c) => {
  const startTime = Date.now();

  // 檢查資料庫連接
  let dbStatus: ServiceCheck;
  try {
    // Use Drizzle ORM for health check
    const { createDatabase, sql, users } = await import("@makanmakan/database");
    const db = createDatabase(c.env.DB);
    const result = await db
      .select({ test: sql<number>`1` })
      .from(users)
      .limit(1);
    const testResult = result[0];
    const responseTime = Date.now() - startTime;
    dbStatus = {
      name: "database",
      status: testResult?.test === 1 ? "healthy" : "unhealthy",
      responseTime,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    dbStatus = {
      name: "database",
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
      lastCheck: new Date().toISOString(),
    };
  }

  // 檢查KV存儲
  let kvStatus: ServiceCheck;
  try {
    const testKey = `health-check-${Date.now()}`;
    await c.env.CACHE_KV.put(testKey, "test", { expirationTtl: 60 });
    const testValue = await c.env.CACHE_KV.get(testKey);
    const responseTime = Date.now() - startTime;

    kvStatus = {
      name: "kv_storage",
      status: testValue === "test" ? "healthy" : "degraded",
      responseTime,
      lastCheck: new Date().toISOString(),
    };

    // 清理測試數據
    await c.env.CACHE_KV.delete(testKey);
  } catch (error) {
    kvStatus = {
      name: "kv_storage",
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
      lastCheck: new Date().toISOString(),
    };
  }

  // 確定整體狀態
  const services = [dbStatus, kvStatus];
  const unhealthyServices = services.filter((s) => s.status === "unhealthy");
  const degradedServices = services.filter((s) => s.status === "degraded");

  let overallStatus: HealthStatus["status"] = "healthy";
  if (unhealthyServices.length > 0) {
    overallStatus = "unhealthy";
  } else if (degradedServices.length > 0) {
    overallStatus = "degraded";
  }

  const health: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime, // 簡化的uptime計算
    version: c.env.API_VERSION || "v1",
    environment: c.env.NODE_ENV || "development",
  };

  const statusCode =
    overallStatus === "healthy"
      ? 200
      : overallStatus === "degraded"
        ? 200
        : 503;

  return c.json(
    {
      success: overallStatus !== "unhealthy",
      ...health,
      services,
      checks: {
        database: dbStatus.status === "healthy",
        cache: kvStatus.status === "healthy",
      },
    },
    statusCode,
  );
});

/**
 * Error statistics endpoint
 * GET /api/v1/system/error-stats
 */
routes.get(
  "/error-stats",
  authMiddleware,
  requireRole([0, 1]), // Admin and Owner only
  validateQuery(errorStatsQuerySchema),
  async (c) => {
    const user = c.get("user");
    const query = c.get("validatedQuery");

    const systemService: ISystemService = new SystemService(
      c.env.DB,
      c.env,
      c.env.CACHE_KV,
    );

    // For owners, only show their restaurant data
    const restaurantId =
      user.role === 1
        ? user.restaurantId == null
          ? undefined
          : String(user.restaurantId)
        : query.restaurantId;

    const result = await systemService.getErrorStats(restaurantId);

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * Cleanup old error reports endpoint
 * DELETE /api/v1/system/error-reports/cleanup
 */
routes.delete(
  "/error-reports/cleanup",
  authMiddleware,
  requireRole([0]), // Admin only
  validateQuery(cleanupQuerySchema),
  async (c) => {
    const query = c.get("validatedQuery");

    const systemService: ISystemService = new SystemService(
      c.env.DB,
      c.env,
      c.env.CACHE_KV,
    );

    const result = await systemService.cleanupOldErrorReports(query.daysOld);

    return c.json(result);
  },
);

/**
 * 詳細系統健康檢查 (需要管理員權限)
 * GET /api/v1/system/health/detailed
 */
routes.get(
  "/health/detailed",
  authMiddleware,
  requireRole([0]), // 僅管理員
  async (c) => {
    const startTime = Date.now();

    // 執行基本健康檢查
    const basicHealthResponse = await fetch(
      `${c.req.url.split("/health/detailed")[0]}/health`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    const basicData = (await basicHealthResponse.json()) as {
      status: string;
    };

    // 獲取系統指標
    const metrics = getSystemMetrics();

    // 檢查資料庫性能
    const dbPerformanceStart = Date.now();
    const {
      createDatabase,
      count,
      gte,
      orders,
      users,
      restaurants,
      auditLogs,
      sql,
    } = await import("@makanmakan/database");
    const db = createDatabase(c.env.DB);

    // 獲取表統計
    const ordersCount = await db.select({ count: count() }).from(orders);
    const usersCount = await db.select({ count: count() }).from(users);
    const restaurantsCount = await db
      .select({ count: count() })
      .from(restaurants);

    const tableStats = [
      { table_name: "orders", row_count: ordersCount[0]?.count || 0 },
      { table_name: "users", row_count: usersCount[0]?.count || 0 },
      {
        table_name: "restaurants",
        row_count: restaurantsCount[0]?.count || 0,
      },
    ];

    const dbPerformanceTime = Date.now() - dbPerformanceStart;

    // 檢查最近的錯誤日誌
    const recentErrors = await db
      .select({
        action: auditLogs.action,
        resource: auditLogs.resource,
        description: auditLogs.description,
        created_at: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(
        sql`${auditLogs.action} LIKE '%error%' OR ${auditLogs.action} LIKE '%fail%'`,
      )
      .orderBy(sql`${auditLogs.createdAt} DESC`)
      .limit(10);

    // 檢查系統負載
    const currentTime = new Date();
    const oneHourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000);

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const systemLoad = await db
      .select({
        total_requests: count(),
        recent_requests: sql<number>`COUNT(CASE WHEN ${orders.createdAt} >= ${oneHourAgo.toISOString()} THEN 1 END)`,
        active_restaurants: sql<number>`COUNT(DISTINCT ${orders.restaurantId})`,
        avg_order_value: sql<number>`AVG(${orders.totalAmount})`,
      })
      .from(orders)
      .where(gte(orders.createdAt, twentyFourHoursAgo))
      .then((result) => result[0]);

    // API端點響應時間測試
    const endpointTests = [
      { name: "restaurants", path: "/api/v1/restaurants?limit=1" },
      { name: "menu", path: "/api/v1/menu/1" },
      { name: "orders", path: "/api/v1/orders?limit=1" },
    ];

    const endpointHealth: EndpointHealth[] = [];
    for (const endpoint of endpointTests) {
      const testStart = Date.now();
      try {
        const response = await fetch(
          `${c.req.url.split("/api")[0]}${endpoint.path}`,
          {
            method: "GET",
            headers: {
              Authorization: c.req.header("Authorization") || "",
              "Content-Type": "application/json",
            },
          },
        );

        const responseTime = Date.now() - testStart;
        endpointHealth.push({
          ...endpoint,
          status: response.ok ? "healthy" : "degraded",
          responseTime,
          statusCode: response.status,
        });
      } catch (error) {
        endpointHealth.push({
          ...endpoint,
          status: "unhealthy",
          responseTime: Date.now() - testStart,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // 計算整體系統健康分數 (0-100)
    let healthScore = 100;

    // 基於各項指標扣分
    if (basicData.status === "degraded") healthScore -= 20;
    if (basicData.status === "unhealthy") healthScore -= 50;

    if (metrics.memory && metrics.memory.percentage > 80) healthScore -= 15;
    if (metrics.cpu && metrics.cpu.usage > 80) healthScore -= 15;
    if (metrics.requests && metrics.requests.errorRate > 5) healthScore -= 20;

    if (dbPerformanceTime > 1000) healthScore -= 10; // 資料庫響應超過1秒

    const unhealthyEndpoints = endpointHealth.filter(
      (e) => e.status === "unhealthy",
    ).length;
    healthScore -= unhealthyEndpoints * 10;

    healthScore = Math.max(0, Math.min(100, healthScore));

    return c.json({
      success: true,
      overview: basicData,
      metrics,
      performance: {
        database_response_time: dbPerformanceTime,
        table_statistics: tableStats,
        endpoint_health: endpointHealth,
      },
      system_load: systemLoad,
      recent_errors: recentErrors.slice(0, 5),
      health_score: Math.round(healthScore),
      recommendations: generateRecommendations(
        healthScore,
        metrics,
        endpointHealth,
      ),
      timestamp: new Date().toISOString(),
      total_check_time: Date.now() - startTime,
    });
  },
);

/**
 * 系統指標端點 (需要管理員權限)
 * GET /api/v1/system/health/metrics
 */
routes.get(
  "/health/metrics",
  authMiddleware,
  requireRole([0]), // 僅管理員
  validateQuery(
    z.object({
      format: z.enum(["json", "prometheus"]).optional().default("json"),
    }),
  ),
  async (c) => {
    const { format } = c.get("validatedQuery");
    const metrics = getSystemMetrics();

    const { createDatabase, count, gte, orders, sql } =
      await import("@makanmakan/database");
    const db = createDatabase(c.env.DB);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // 獲取業務指標
    const businessMetrics = await db
      .select({
        orders_last_hour: sql<number>`COUNT(CASE WHEN ${orders.createdAt} >= ${oneHourAgo.toISOString()} THEN 1 END)`,
        orders_last_24h: sql<number>`COUNT(CASE WHEN ${orders.createdAt} >= ${twentyFourHoursAgo.toISOString()} THEN 1 END)`,
        pending_orders: sql<number>`COUNT(CASE WHEN ${orders.status} = 'pending' THEN 1 END)`,
        preparing_orders: sql<number>`COUNT(CASE WHEN ${orders.status} = 'preparing' THEN 1 END)`,
        total_orders: count(),
      })
      .from(orders)
      .where(gte(orders.createdAt, sevenDaysAgo))
      .then((result) => result[0]);

    if (format === "prometheus") {
      // Prometheus格式輸出
      const prometheusMetrics = `
# HELP makanmakan_orders_total Total number of orders
# TYPE makanmakan_orders_total counter
makanmakan_orders_total ${businessMetrics?.total_orders || 0}

# HELP makanmakan_orders_pending Number of pending orders
# TYPE makanmakan_orders_pending gauge
makanmakan_orders_pending ${businessMetrics?.pending_orders || 0}

# HELP makanmakan_orders_preparing Number of orders being prepared
# TYPE makanmakan_orders_preparing gauge
makanmakan_orders_preparing ${businessMetrics?.preparing_orders || 0}

# HELP makanmakan_memory_usage_percent Memory usage percentage
# TYPE makanmakan_memory_usage_percent gauge
makanmakan_memory_usage_percent ${metrics.memory?.percentage || 0}

# HELP makanmakan_cpu_usage_percent CPU usage percentage
# TYPE makanmakan_cpu_usage_percent gauge
makanmakan_cpu_usage_percent ${metrics.cpu?.usage || 0}

# HELP makanmakan_requests_per_second Current requests per second
# TYPE makanmakan_requests_per_second gauge
makanmakan_requests_per_second ${metrics.requests?.rps || 0}

# HELP makanmakan_error_rate_percent Current error rate percentage
# TYPE makanmakan_error_rate_percent gauge
makanmakan_error_rate_percent ${metrics.requests?.errorRate || 0}
      `.trim();

      c.header("Content-Type", "text/plain; charset=utf-8");
      return c.text(prometheusMetrics);
    }

    // JSON格式輸出
    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      system_metrics: metrics,
      business_metrics: businessMetrics,
      alert_thresholds: {
        memory_warning: 70,
        memory_critical: 85,
        cpu_warning: 70,
        cpu_critical: 90,
        error_rate_warning: 2,
        error_rate_critical: 5,
        response_time_warning: 1000,
        response_time_critical: 3000,
      },
    });
  },
);

/**
 * 就緒檢查 (Kubernetes readiness probe)
 * GET /api/v1/system/health/ready
 */
routes.get("/health/ready", async (c) => {
  try {
    // 檢查關鍵服務是否就緒
    const { createDatabase, sql, users } = await import("@makanmakan/database");
    const db = createDatabase(c.env.DB);
    const readyResult = await db
      .select({ test: sql<number>`1` })
      .from(users)
      .limit(1);
    const dbReady = readyResult[0]?.test === 1;
    const kvReady =
      (await c.env.CACHE_KV.get("health-check")) !== undefined
        ? true
        : (await c.env.CACHE_KV.put("ready-test", "ok", {
            expirationTtl: 60,
          })) !== undefined;

    const isReady = !!dbReady && kvReady;

    if (isReady) {
      return c.json({
        success: true,
        status: "ready",
        timestamp: new Date().toISOString(),
      });
    } else {
      return c.json(
        {
          success: false,
          status: "not_ready",
          timestamp: new Date().toISOString(),
        },
        503,
      );
    }
  } catch (error) {
    return c.json(
      {
        success: false,
        status: "not_ready",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      503,
    );
  }
});

/**
 * 存活檢查 (Kubernetes liveness probe)
 * GET /api/v1/system/health/live
 */
routes.get("/health/live", (c) => {
  // 簡單的存活檢查 - 如果能回應就表示存活
  return c.json({
    success: true,
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime:
      typeof process !== "undefined" && process.uptime
        ? Math.floor(process.uptime())
        : 0,
  });
});

// 生成系統建議
function generateRecommendations(
  healthScore: number,
  metrics: SystemMetrics,
  endpointHealth: EndpointHealth[],
): string[] {
  const recommendations: string[] = [];

  if (healthScore < 80) {
    recommendations.push(
      "System health score is below optimal. Consider investigating issues.",
    );
  }

  if (metrics.memory && metrics.memory.percentage > 80) {
    recommendations.push(
      "Memory usage is high. Consider scaling up or optimizing memory usage.",
    );
  }

  if (metrics.cpu && metrics.cpu.usage > 70) {
    recommendations.push(
      "CPU usage is elevated. Monitor for sustained high usage.",
    );
  }

  if (metrics.requests && metrics.requests.errorRate > 3) {
    recommendations.push(
      "Error rate is above acceptable threshold. Check application logs.",
    );
  }

  const slowEndpoints = endpointHealth.filter(
    (e) => e.responseTime && e.responseTime > 1000,
  );
  if (slowEndpoints.length > 0) {
    recommendations.push(
      `Slow response times detected on: ${slowEndpoints.map((e) => e.name).join(", ")}`,
    );
  }

  const unhealthyEndpoints = endpointHealth.filter(
    (e) => e.status === "unhealthy",
  );
  if (unhealthyEndpoints.length > 0) {
    recommendations.push(
      `Unhealthy endpoints detected: ${unhealthyEndpoints.map((e) => e.name).join(", ")}`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "System is operating normally. No immediate action required.",
    );
  }

  return recommendations;
}

export default routes;
