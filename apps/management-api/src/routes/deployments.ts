/**
 * Deployment Management Routes
 *
 * Handles deployment operations for tenants
 */

import { Hono } from "hono";
import { z } from "zod";
import type { ManagementEnv } from "../types";
import { ProvisioningService } from "../services/ProvisioningService";
import { MigrationService } from "../services/MigrationService";

const router = new Hono<{ Bindings: ManagementEnv }>();

// ============================================================
// Validation Schemas
// ============================================================

const deployRequestSchema = z.object({
  tenantId: z.string().min(1),
  targetVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "Version must be semver format"),
  deploymentType: z.enum(["initial", "update", "rollback"]).optional(),
});

const provisionRequestSchema = z.object({
  tenantId: z.string().min(1),
  resourceTypes: z
    .array(z.enum(["d1", "kv", "r2", "worker", "page"]))
    .optional(),
});

// ============================================================
// Routes
// ============================================================

/**
 * Get deployment status for tenant
 * GET /api/v1/deployments/:tenantId
 */
router.get("/:tenantId", async (c) => {
  const provisioningService = new ProvisioningService(c.env);
  const tenantId = c.req.param("tenantId");

  try {
    const status = await provisioningService.getDeploymentStatus(tenantId);

    return c.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("[Deployments] Get status error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to get deployment status",
        code: "GET_STATUS_FAILED",
      },
      500,
    );
  }
});

/**
 * List deployment history for tenant
 * GET /api/v1/deployments/:tenantId/history
 */
router.get("/:tenantId/history", async (c) => {
  const provisioningService = new ProvisioningService(c.env);
  const tenantId = c.req.param("tenantId");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);

  try {
    const history = await provisioningService.getDeploymentHistory(
      tenantId,
      limit,
    );

    return c.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("[Deployments] Get history error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to get deployment history",
        code: "GET_HISTORY_FAILED",
      },
      500,
    );
  }
});

/**
 * Provision resources for tenant
 * POST /api/v1/deployments/provision
 */
router.post("/provision", async (c) => {
  const provisioningService = new ProvisioningService(c.env);

  try {
    const body = await c.req.json();
    const validated = provisionRequestSchema.parse(body);

    const result = await provisioningService.provisionTenant(
      validated.tenantId,
      validated.resourceTypes,
    );

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: result.error || "Provisioning failed",
          code: "PROVISION_FAILED",
          details: result.failedResources,
        },
        500,
      );
    }

    return c.json({
      success: true,
      data: {
        tenantId: validated.tenantId,
        resources: result.resources,
        status: "provisioned",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: error.errors,
        },
        400,
      );
    }

    console.error("[Deployments] Provision error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to provision resources",
        code: "PROVISION_FAILED",
      },
      500,
    );
  }
});

/**
 * Deploy to tenant environment
 * POST /api/v1/deployments/deploy
 */
router.post("/deploy", async (c) => {
  const provisioningService = new ProvisioningService(c.env);

  try {
    const body = await c.req.json();
    const validated = deployRequestSchema.parse(body);

    const result = await provisioningService.deployToTenant(
      validated.tenantId,
      validated.targetVersion,
      validated.deploymentType || "update",
    );

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: result.error || "Deployment failed",
          code: "DEPLOY_FAILED",
          deploymentId: result.deploymentId,
        },
        500,
      );
    }

    return c.json({
      success: true,
      data: {
        deploymentId: result.deploymentId,
        tenantId: validated.tenantId,
        version: validated.targetVersion,
        status: "completed",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: error.errors,
        },
        400,
      );
    }

    console.error("[Deployments] Deploy error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to deploy",
        code: "DEPLOY_FAILED",
      },
      500,
    );
  }
});

/**
 * Rollback deployment
 * POST /api/v1/deployments/:tenantId/rollback
 */
router.post("/:tenantId/rollback", async (c) => {
  const provisioningService = new ProvisioningService(c.env);
  const tenantId = c.req.param("tenantId");

  try {
    const body = await c.req.json().catch(() => ({}));
    const targetVersion = body.targetVersion;

    const result = await provisioningService.rollbackDeployment(
      tenantId,
      targetVersion,
    );

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: result.error || "Rollback failed",
          code: "ROLLBACK_FAILED",
        },
        500,
      );
    }

    return c.json({
      success: true,
      data: {
        tenantId,
        rolledBackTo: result.version,
        status: "rolled_back",
      },
    });
  } catch (error) {
    console.error("[Deployments] Rollback error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to rollback deployment",
        code: "ROLLBACK_FAILED",
      },
      500,
    );
  }
});

/**
 * Batch deploy to multiple tenants
 * POST /api/v1/deployments/batch
 */
router.post("/batch", async (c) => {
  const provisioningService = new ProvisioningService(c.env);

  try {
    const body = await c.req.json();
    const { tenantIds, targetVersion } = body;

    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      return c.json(
        {
          success: false,
          error: "tenantIds must be a non-empty array",
          code: "VALIDATION_ERROR",
        },
        400,
      );
    }

    if (!targetVersion || !/^\d+\.\d+\.\d+$/.test(targetVersion)) {
      return c.json(
        {
          success: false,
          error: "targetVersion must be semver format",
          code: "VALIDATION_ERROR",
        },
        400,
      );
    }

    const results = await provisioningService.batchDeploy(
      tenantIds,
      targetVersion,
    );

    return c.json({
      success: true,
      data: {
        targetVersion,
        results,
        summary: {
          total: tenantIds.length,
          succeeded: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
        },
      },
    });
  } catch (error) {
    console.error("[Deployments] Batch deploy error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to batch deploy",
        code: "BATCH_DEPLOY_FAILED",
      },
      500,
    );
  }
});

/**
 * Get migration history for a tenant
 * GET /api/v1/deployments/:tenantId/migrations
 */
router.get("/:tenantId/migrations", async (c) => {
  const tenantId = c.req.param("tenantId");

  try {
    const migrationService = new MigrationService(c.env);
    const migrations = await migrationService.getAppliedMigrations(tenantId);

    return c.json({
      success: true,
      data: {
        tenantId,
        migrations,
        total: migrations.length,
        lastApplied:
          migrations.length > 0
            ? migrations[migrations.length - 1].appliedAt
            : null,
      },
    });
  } catch (error) {
    console.error("[Deployments] Get migrations error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to get migration history",
        code: "GET_MIGRATIONS_FAILED",
      },
      500,
    );
  }
});

export default router;
