/**
 * Deployment Management Routes
 *
 * Handles deployment operations for tenants
 */

import { Hono } from "hono";
import { z } from "zod";
import { ApiError, badRequest } from "@makanmakan/utils";
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
    if (error instanceof ApiError) throw error;

    console.error("[Deployments] Get status error:", error);
    throw new ApiError(
      "GET_STATUS_FAILED",
      "Failed to get deployment status",
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
    if (error instanceof ApiError) throw error;

    console.error("[Deployments] Get history error:", error);
    throw new ApiError(
      "GET_HISTORY_FAILED",
      "Failed to get deployment history",
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
      throw new ApiError(
        "PROVISION_FAILED",
        result.error || "Provisioning failed",
        500,
        result.failedResources,
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
      throw badRequest("Validation failed", "VALIDATION_ERROR", error.issues);
    }
    if (error instanceof ApiError) throw error;

    console.error("[Deployments] Provision error:", error);
    throw new ApiError(
      "PROVISION_FAILED",
      "Failed to provision resources",
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
      throw new ApiError(
        "DEPLOY_FAILED",
        result.error || "Deployment failed",
        500,
        { deploymentId: result.deploymentId },
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
      throw badRequest("Validation failed", "VALIDATION_ERROR", error.issues);
    }
    if (error instanceof ApiError) throw error;

    console.error("[Deployments] Deploy error:", error);
    throw new ApiError("DEPLOY_FAILED", "Failed to deploy", 500);
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
      throw new ApiError(
        "ROLLBACK_FAILED",
        result.error || "Rollback failed",
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
    if (error instanceof ApiError) throw error;

    console.error("[Deployments] Rollback error:", error);
    throw new ApiError("ROLLBACK_FAILED", "Failed to rollback deployment", 500);
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
      throw badRequest(
        "tenantIds must be a non-empty array",
        "VALIDATION_ERROR",
      );
    }

    if (!targetVersion || !/^\d+\.\d+\.\d+$/.test(targetVersion)) {
      throw badRequest(
        "targetVersion must be semver format",
        "VALIDATION_ERROR",
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
    if (error instanceof ApiError) throw error;

    console.error("[Deployments] Batch deploy error:", error);
    throw new ApiError("BATCH_DEPLOY_FAILED", "Failed to batch deploy", 500);
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
        // Latest by applied_at, not by name order — migration names do not
        // always sort chronologically.
        lastApplied:
          migrations.length > 0
            ? migrations.reduce(
                (latest, m) => (m.appliedAt > latest ? m.appliedAt : latest),
                migrations[0].appliedAt,
              )
            : null,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;

    console.error("[Deployments] Get migrations error:", error);
    throw new ApiError(
      "GET_MIGRATIONS_FAILED",
      "Failed to get migration history",
      500,
    );
  }
});

export default router;
