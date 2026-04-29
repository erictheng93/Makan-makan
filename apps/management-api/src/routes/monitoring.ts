/**
 * Monitoring Routes
 * 監控 API 路由 - Phase 3 增強
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { ManagementEnv } from "../types";

const monitoring = new Hono<{ Bindings: ManagementEnv }>();

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * 獲取系統總覽統計
 * GET /monitoring/overview
 */
monitoring.get("/overview", async (c) => {
  const db = c.env.MANAGEMENT_DB;

  // 獲取各種統計
  const [tenantStats, healthStats, deploymentStats, versionStats] =
    await Promise.all([
      // 租戶統計
      db
        .prepare(
          `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'provisioning' THEN 1 ELSE 0 END) as provisioning,
          SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended
        FROM tenants
      `,
        )
        .first(),

      // 健康狀態統計（最近 1 小時）
      db
        .prepare(
          `
        SELECT
          status,
          COUNT(DISTINCT tenant_id) as count
        FROM health_checks
        WHERE checked_at > datetime('now', '-1 hour')
        GROUP BY status
      `,
        )
        .all(),

      // 部署統計（最近 24 小時）
      db
        .prepare(
          `
        SELECT
          status,
          COUNT(*) as count
        FROM deployment_logs
        WHERE started_at > datetime('now', '-24 hours')
        GROUP BY status
      `,
        )
        .all(),

      // 版本分佈
      db
        .prepare(
          `
        SELECT
          deployed_version as version,
          COUNT(*) as count
        FROM tenants
        WHERE deployed_version IS NOT NULL AND status = 'active'
        GROUP BY deployed_version
        ORDER BY count DESC
      `,
        )
        .all(),
    ]);

  // 處理健康狀態
  const healthMap: Record<string, number> = {
    healthy: 0,
    degraded: 0,
    down: 0,
  };
  healthStats.results?.forEach((row: Record<string, unknown>) => {
    healthMap[row.status as string] = row.count as number;
  });

  // 處理部署狀態
  const deploymentMap: Record<string, number> = {
    completed: 0,
    failed: 0,
    in_progress: 0,
  };
  deploymentStats.results?.forEach((row: Record<string, unknown>) => {
    deploymentMap[row.status as string] = row.count as number;
  });

  return c.json({
    success: true,
    data: {
      tenants: tenantStats,
      health: healthMap,
      deployments: deploymentMap,
      versions: versionStats.results,
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * 獲取健康狀態時間線
 * GET /monitoring/health/timeline
 */
monitoring.get(
  "/health/timeline",
  zValidator(
    "query",
    z.object({
      hours: z.string().optional().default("24"),
      tenantId: z.string().optional(),
    }),
  ),
  async (c) => {
    const { hours, tenantId } = c.req.valid("query");
    const db = c.env.MANAGEMENT_DB;
    const lookbackHours = parsePositiveInteger(hours, 24);
    const params: (string | number)[] = [`-${lookbackHours} hours`];

    let query = `
      SELECT
        strftime('%Y-%m-%d %H:00:00', checked_at) as hour,
        status,
        COUNT(*) as count,
        AVG(response_time_ms) as avg_response_time
      FROM health_checks
      WHERE checked_at > datetime('now', ?)
    `;

    if (tenantId) {
      query += ` AND tenant_id = ?`;
      params.push(tenantId);
    }

    query += `
      GROUP BY hour, status
      ORDER BY hour ASC
    `;

    const results = await db
      .prepare(query)
      .bind(...params)
      .all();

    // 組織成時間線格式
    const timeline: Record<
      string,
      {
        healthy: number;
        degraded: number;
        down: number;
        avgResponseTime: number;
      }
    > = {};

    results.results?.forEach((row: Record<string, unknown>) => {
      const hour = row.hour as string;
      if (!timeline[hour]) {
        timeline[hour] = {
          healthy: 0,
          degraded: 0,
          down: 0,
          avgResponseTime: 0,
        };
      }
      timeline[hour][row.status as "healthy" | "degraded" | "down"] =
        row.count as number;
      if (row.avg_response_time) {
        timeline[hour].avgResponseTime = Math.round(
          row.avg_response_time as number,
        );
      }
    });

    return c.json({
      success: true,
      data: {
        timeline: Object.entries(timeline).map(([hour, data]) => ({
          hour,
          ...data,
        })),
        hours: lookbackHours,
      },
    });
  },
);

/**
 * 獲取效能指標
 * GET /monitoring/performance
 */
monitoring.get("/performance", async (c) => {
  const db = c.env.MANAGEMENT_DB;

  // 獲取各租戶的效能指標
  const results = await db
    .prepare(
      `
      SELECT
        t.id as tenant_id,
        t.business_name,
        t.deployed_version,
        AVG(h.response_time_ms) as avg_response_time,
        MIN(h.response_time_ms) as min_response_time,
        MAX(h.response_time_ms) as max_response_time,
        COUNT(h.id) as check_count,
        SUM(CASE WHEN h.status = 'healthy' THEN 1 ELSE 0 END) as healthy_count
      FROM tenants t
      LEFT JOIN health_checks h ON t.id = h.tenant_id
        AND h.checked_at > datetime('now', '-24 hours')
      WHERE t.status = 'active'
      GROUP BY t.id
      ORDER BY avg_response_time DESC
    `,
    )
    .all();

  // 計算健康率
  const performance = results.results?.map((row: Record<string, unknown>) => ({
    tenantId: row.tenant_id,
    businessName: row.business_name,
    deployedVersion: row.deployed_version,
    avgResponseTime: Math.round((row.avg_response_time as number) || 0),
    minResponseTime: row.min_response_time || 0,
    maxResponseTime: row.max_response_time || 0,
    healthRate:
      (row.check_count as number) > 0
        ? Math.round(
            ((row.healthy_count as number) / (row.check_count as number)) * 100,
          )
        : 0,
  }));

  // 計算整體平均
  const overall = {
    avgResponseTime: Math.round(
      (performance?.reduce((sum, p) => sum + p.avgResponseTime, 0) || 0) /
        (performance?.length || 1),
    ),
    avgHealthRate: Math.round(
      (performance?.reduce((sum, p) => sum + p.healthRate, 0) || 0) /
        (performance?.length || 1),
    ),
    totalTenants: performance?.length || 0,
  };

  return c.json({
    success: true,
    data: {
      overall,
      tenants: performance,
    },
  });
});

/**
 * 獲取告警列表
 * GET /monitoring/alerts
 */
monitoring.get(
  "/alerts",
  zValidator(
    "query",
    z.object({
      status: z
        .enum(["active", "resolved", "all"])
        .optional()
        .default("active"),
      severity: z
        .enum(["critical", "warning", "info", "all"])
        .optional()
        .default("all"),
      limit: z.string().optional().default("50"),
    }),
  ),
  async (c) => {
    const { status, severity, limit } = c.req.valid("query");
    const db = c.env.MANAGEMENT_DB;
    const limitValue = parsePositiveInteger(limit, 50);
    const params: (string | number)[] = [];

    // 從健康檢查生成告警
    let query = `
      SELECT
        h.id,
        h.tenant_id,
        t.business_name,
        h.status,
        h.response_time_ms,
        h.details,
        h.checked_at,
        CASE
          WHEN h.status = 'down' THEN 'critical'
          WHEN h.status = 'degraded' THEN 'warning'
          ELSE 'info'
        END as severity
      FROM health_checks h
      JOIN tenants t ON h.id = t.id
      WHERE 1=1
    `;

    if (status === "active") {
      query += ` AND h.status IN ('down', 'degraded')`;
    }

    if (severity !== "all") {
      if (severity === "critical") {
        query += ` AND h.status = 'down'`;
      } else if (severity === "warning") {
        query += ` AND h.status = 'degraded'`;
      }
    }

    query += `
      ORDER BY h.checked_at DESC
      LIMIT ?
    `;
    params.push(limitValue);

    const results = await db
      .prepare(query)
      .bind(...params)
      .all();

    return c.json({
      success: true,
      data: {
        alerts: results.results?.map((row: Record<string, unknown>) => ({
          id: row.id,
          tenantId: row.tenant_id,
          businessName: row.business_name,
          status: row.status,
          severity: row.severity,
          responseTimeMs: row.response_time_ms,
          details: row.details ? JSON.parse(row.details as string) : null,
          timestamp: row.checked_at,
        })),
        total: results.results?.length || 0,
      },
    });
  },
);

/**
 * 獲取版本更新狀態
 * GET /monitoring/versions
 */
monitoring.get("/versions", async (c) => {
  const db = c.env.MANAGEMENT_DB;

  // 獲取版本分佈和更新狀態
  const [versionDist, recentUpdates, pendingUpdates] = await Promise.all([
    // 版本分佈
    db
      .prepare(
        `
        SELECT
          COALESCE(deployed_version, 'not_deployed') as version,
          COUNT(*) as count,
          GROUP_CONCAT(business_name) as tenants
        FROM tenants
        WHERE status = 'active'
        GROUP BY deployed_version
        ORDER BY version DESC
      `,
      )
      .all(),

    // 最近更新
    db
      .prepare(
        `
        SELECT
          d.tenant_id,
          t.business_name,
          d.from_version,
          d.to_version,
          d.status,
          d.started_at,
          d.completed_at
        FROM deployment_logs d
        JOIN tenants t ON d.tenant_id = t.id
        WHERE d.deployment_type = 'update'
        ORDER BY d.started_at DESC
        LIMIT 10
      `,
      )
      .all(),

    // 待更新租戶（版本低於最新）
    db
      .prepare(
        `
        SELECT
          t.id,
          t.business_name,
          t.deployed_version
        FROM tenants t
        WHERE t.status = 'active'
          AND t.deployed_version IS NOT NULL
          AND t.deployed_version < (
            SELECT MAX(deployed_version) FROM tenants WHERE status = 'active'
          )
        ORDER BY t.deployed_version ASC
      `,
      )
      .all(),
  ]);

  // 獲取最新版本
  const latestVersion =
    versionDist.results
      ?.filter((v: Record<string, unknown>) => v.version !== "not_deployed")
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        (b.version as string).localeCompare(a.version as string),
      )[0]?.version || null;

  return c.json({
    success: true,
    data: {
      latestVersion,
      distribution: versionDist.results?.map(
        (row: Record<string, unknown>) => ({
          version: row.version,
          count: row.count,
          tenants: (row.tenants as string)?.split(",") || [],
        }),
      ),
      recentUpdates: recentUpdates.results,
      pendingUpdates: pendingUpdates.results,
    },
  });
});

export default monitoring;
