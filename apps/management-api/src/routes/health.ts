/**
 * Health Monitoring Routes
 *
 * Handles health checks and monitoring for tenant deployments
 */

import { Hono } from "hono";
import type {
  ManagementEnv,
  HealthStatus,
  TenantHealthSummary,
} from "../types";

const router = new Hono<{ Bindings: ManagementEnv }>();

// ============================================================
// Routes
// ============================================================

/**
 * Get health status for all tenants
 * GET /api/v1/health/tenants
 */
router.get("/tenants", async (c) => {
  try {
    // Get all active tenants with their health status
    const result = await c.env.MANAGEMENT_DB.prepare(
      `
      SELECT
        t.id,
        t.business_name,
        t.subdomain,
        t.status,
        t.deployed_version,
        h.status as health_status,
        h.response_time_ms,
        h.checked_at
      FROM tenants t
      LEFT JOIN (
        SELECT tenant_id, status, response_time_ms, checked_at,
               ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY checked_at DESC) as rn
        FROM health_checks
      ) h ON t.id = h.tenant_id AND h.rn = 1
      WHERE t.status = 'active'
      ORDER BY t.business_name
    `,
    ).all<{
      id: string;
      business_name: string;
      subdomain: string;
      status: string;
      deployed_version: string;
      health_status: HealthStatus | null;
      response_time_ms: number | null;
      checked_at: string | null;
    }>();

    const tenants = result.results.map((row) => ({
      tenantId: row.id,
      tenantName: row.business_name,
      subdomain: row.subdomain,
      deployedVersion: row.deployed_version,
      health: {
        status: row.health_status || "unknown",
        responseTimeMs: row.response_time_ms,
        lastCheck: row.checked_at,
      },
    }));

    // Calculate summary
    const summary = {
      total: tenants.length,
      healthy: tenants.filter((t) => t.health.status === "healthy").length,
      degraded: tenants.filter((t) => t.health.status === "degraded").length,
      down: tenants.filter((t) => t.health.status === "down").length,
      unknown: tenants.filter(
        (t) => !t.health.status || t.health.status === "unknown",
      ).length,
    };

    return c.json({
      success: true,
      data: {
        tenants,
        summary,
      },
    });
  } catch (error) {
    console.error("[Health] Get tenants health error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to get tenants health",
        code: "GET_HEALTH_FAILED",
      },
      500,
    );
  }
});

/**
 * Get health status for specific tenant
 * GET /api/v1/health/tenants/:tenantId
 */
router.get("/tenants/:tenantId", async (c) => {
  const tenantId = c.req.param("tenantId");

  try {
    // Get tenant info
    const tenant = await c.env.MANAGEMENT_DB.prepare(
      `
      SELECT id, business_name, subdomain, custom_domain, deployed_version, status
      FROM tenants WHERE id = ?
    `,
    )
      .bind(tenantId)
      .first<{
        id: string;
        business_name: string;
        subdomain: string;
        custom_domain: string;
        deployed_version: string;
        status: string;
      }>();

    if (!tenant) {
      return c.json(
        {
          success: false,
          error: "Tenant not found",
          code: "NOT_FOUND",
        },
        404,
      );
    }

    // Get recent health checks
    const healthChecks = await c.env.MANAGEMENT_DB.prepare(
      `
      SELECT id, status, response_time_ms, details, checked_at
      FROM health_checks
      WHERE tenant_id = ?
      ORDER BY checked_at DESC
      LIMIT 24
    `,
    )
      .bind(tenantId)
      .all<{
        id: string;
        status: HealthStatus;
        response_time_ms: number;
        details: string;
        checked_at: string;
      }>();

    // Calculate uptime and average response time
    const checks = healthChecks.results;
    const healthyChecks = checks.filter((h) => h.status === "healthy").length;
    const uptimePercentage =
      checks.length > 0 ? (healthyChecks / checks.length) * 100 : 0;
    const avgResponseTime =
      checks.length > 0
        ? checks.reduce((sum, h) => sum + (h.response_time_ms || 0), 0) /
          checks.length
        : 0;

    // Identify issues
    const issues: string[] = [];
    const latestCheck = checks[0];
    if (latestCheck) {
      if (latestCheck.status === "down") {
        issues.push("Service is currently down");
      } else if (latestCheck.status === "degraded") {
        issues.push("Service is experiencing degraded performance");
      }
      if (latestCheck.response_time_ms > 1000) {
        issues.push("High response time detected");
      }
    }

    const summary: TenantHealthSummary = {
      tenantId: tenant.id,
      tenantName: tenant.business_name,
      status: latestCheck?.status || ("unknown" as HealthStatus),
      lastCheck: latestCheck?.checked_at || "never",
      uptimePercentage: Math.round(uptimePercentage * 100) / 100,
      avgResponseTime: Math.round(avgResponseTime),
      issues: issues.length > 0 ? issues : undefined,
    };

    return c.json({
      success: true,
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.business_name,
          subdomain: tenant.subdomain,
          customDomain: tenant.custom_domain,
          deployedVersion: tenant.deployed_version,
          status: tenant.status,
        },
        health: summary,
        recentChecks: checks.slice(0, 10).map((h) => ({
          status: h.status,
          responseTimeMs: h.response_time_ms,
          checkedAt: h.checked_at,
        })),
      },
    });
  } catch (error) {
    console.error("[Health] Get tenant health error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to get tenant health",
        code: "GET_HEALTH_FAILED",
      },
      500,
    );
  }
});

/**
 * Record health check result (called by monitoring system)
 * POST /api/v1/health/report
 */
router.post("/report", async (c) => {
  try {
    const body = await c.req.json();
    const { tenantId, status, responseTimeMs, details } = body;

    if (!tenantId || !status) {
      return c.json(
        {
          success: false,
          error: "tenantId and status are required",
          code: "VALIDATION_ERROR",
        },
        400,
      );
    }

    if (!["healthy", "degraded", "down"].includes(status)) {
      return c.json(
        {
          success: false,
          error: "status must be healthy, degraded, or down",
          code: "VALIDATION_ERROR",
        },
        400,
      );
    }

    const checkId = crypto.randomUUID();
    const checkedAt = new Date().toISOString();

    await c.env.MANAGEMENT_DB.prepare(
      `
      INSERT INTO health_checks (id, tenant_id, status, response_time_ms, details, checked_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
        checkId,
        tenantId,
        status,
        responseTimeMs || null,
        details ? JSON.stringify(details) : null,
        checkedAt,
      )
      .run();

    // Update deployment status KV for quick access
    await c.env.DEPLOYMENT_STATUS_KV.put(
      `health:${tenantId}`,
      JSON.stringify({
        status,
        responseTimeMs,
        checkedAt,
      }),
      { expirationTtl: 3600 }, // 1 hour TTL
    );

    return c.json({
      success: true,
      data: {
        checkId,
        tenantId,
        status,
        checkedAt,
      },
    });
  } catch (error) {
    console.error("[Health] Report error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to record health check",
        code: "REPORT_FAILED",
      },
      500,
    );
  }
});

/**
 * Trigger health check for tenant
 * POST /api/v1/health/check/:tenantId
 */
router.post("/check/:tenantId", async (c) => {
  const tenantId = c.req.param("tenantId");

  try {
    // Get tenant info
    const tenant = await c.env.MANAGEMENT_DB.prepare(
      `
      SELECT id, subdomain, custom_domain FROM tenants WHERE id = ? AND status = 'active'
    `,
    )
      .bind(tenantId)
      .first<{
        id: string;
        subdomain: string;
        custom_domain: string;
      }>();

    if (!tenant) {
      return c.json(
        {
          success: false,
          error: "Tenant not found or not active",
          code: "NOT_FOUND",
        },
        404,
      );
    }

    // Determine health check URL
    const domain = tenant.custom_domain || `${tenant.subdomain}.makanmakan.app`;
    const healthUrl = `https://api.${domain}/health`;

    // Perform health check
    const startTime = Date.now();
    let status: HealthStatus;
    let responseTimeMs = 0;
    let details: Record<string, unknown> = {};

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        headers: { "User-Agent": "MakanMakan-HealthCheck/1.0" },
      });
      responseTimeMs = Date.now() - startTime;

      if (response.ok) {
        status = responseTimeMs < 500 ? "healthy" : "degraded";
        const data = await response.json().catch(() => ({}));
        details = { statusCode: response.status, data };
      } else {
        status = "degraded";
        details = { statusCode: response.status, error: response.statusText };
      }
    } catch (fetchError) {
      responseTimeMs = Date.now() - startTime;
      status = "down";
      details = {
        error:
          fetchError instanceof Error ? fetchError.message : "Unknown error",
      };
    }

    // Record the health check
    const checkId = crypto.randomUUID();
    const checkedAt = new Date().toISOString();

    await c.env.MANAGEMENT_DB.prepare(
      `
      INSERT INTO health_checks (id, tenant_id, status, response_time_ms, details, checked_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
        checkId,
        tenantId,
        status,
        responseTimeMs,
        JSON.stringify(details),
        checkedAt,
      )
      .run();

    // Update KV cache
    await c.env.DEPLOYMENT_STATUS_KV.put(
      `health:${tenantId}`,
      JSON.stringify({ status, responseTimeMs, checkedAt }),
      { expirationTtl: 3600 },
    );

    return c.json({
      success: true,
      data: {
        checkId,
        tenantId,
        status,
        responseTimeMs,
        checkedAt,
        details,
      },
    });
  } catch (error) {
    console.error("[Health] Check error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to perform health check",
        code: "CHECK_FAILED",
      },
      500,
    );
  }
});

export default router;
