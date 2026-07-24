/**
 * Updates Routes
 * 版本更新 API 路由 - Phase 3 實施
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { ApiError, badRequest, notFound } from "@makanmakan/utils";
import type { ManagementEnv } from "../types";
import { VersionSyncService } from "../services/VersionSyncService";

const updates = new Hono<{ Bindings: ManagementEnv }>();

/**
 * 獲取可用版本列表
 * GET /updates/releases
 */
updates.get("/releases", async (c) => {
  const service = new VersionSyncService(c.env);
  const releases = await service.getAvailableReleases();

  return c.json({
    success: true,
    data: {
      releases,
      latest: releases[0]?.version || null,
    },
  });
});

/**
 * 獲取需要更新的租戶
 * GET /updates/pending
 */
updates.get(
  "/pending",
  zValidator(
    "query",
    z.object({
      targetVersion: z.string().optional(),
    }),
  ),
  async (c) => {
    const { targetVersion } = c.req.valid("query");
    const service = new VersionSyncService(c.env);

    // 如果未指定版本，使用最新版本
    let version = targetVersion;
    if (!version) {
      const releases = await service.getAvailableReleases();
      version = releases[0]?.version;
    }

    if (!version) {
      throw badRequest("No releases available", "NO_RELEASES_AVAILABLE");
    }

    const tenants = await service.getTenantsNeedingUpdate(version);

    return c.json({
      success: true,
      data: {
        targetVersion: version,
        tenants: tenants.map((t) => ({
          id: t.id,
          businessName: t.businessName,
          currentVersion: t.deployedVersion,
        })),
        count: tenants.length,
      },
    });
  },
);

/**
 * 創建批量更新計劃
 * POST /updates/plans
 */
updates.post(
  "/plans",
  zValidator(
    "json",
    z.object({
      targetVersion: z.string(),
      tenantIds: z.array(z.string()).min(1),
      strategy: z.enum(["all_at_once", "rolling", "canary"]).default("rolling"),
      batchSize: z.number().min(1).max(20).optional(),
      canaryPercentage: z.number().min(1).max(50).optional(),
    }),
  ),
  async (c) => {
    const body = c.req.valid("json");
    const service = new VersionSyncService(c.env);

    const plan = await service.createBatchUpdatePlan(
      body.targetVersion,
      body.tenantIds,
      body.strategy,
      {
        batchSize: body.batchSize,
        canaryPercentage: body.canaryPercentage,
      },
    );

    return c.json({
      success: true,
      data: plan,
    });
  },
);

/**
 * 執行更新計劃
 * POST /updates/plans/:planId/execute
 */
updates.post("/plans/:planId/execute", async (c) => {
  const planId = c.req.param("planId");
  const service = new VersionSyncService(c.env);

  try {
    const progress = await service.executeBatchUpdatePlan(planId);

    return c.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;

    throw new ApiError(
      "EXECUTION_FAILED",
      error instanceof Error ? error.message : "Execution failed",
      400,
    );
  }
});

/**
 * 獲取更新計劃進度
 * GET /updates/plans/:planId/progress
 */
updates.get("/plans/:planId/progress", async (c) => {
  const planId = c.req.param("planId");
  const service = new VersionSyncService(c.env);

  const progress = await service.getUpdatePlanProgress(planId);

  if (!progress) {
    throw notFound("Plan not found", "NOT_FOUND");
  }

  return c.json({
    success: true,
    data: progress,
  });
});

/**
 * 取消更新計劃
 * POST /updates/plans/:planId/cancel
 */
updates.post("/plans/:planId/cancel", async (c) => {
  const planId = c.req.param("planId");
  const service = new VersionSyncService(c.env);

  try {
    await service.cancelUpdatePlan(planId);

    return c.json({
      success: true,
      message: "Plan cancelled",
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;

    throw new ApiError(
      "CANCEL_FAILED",
      error instanceof Error ? error.message : "Cancel failed",
      400,
    );
  }
});

/**
 * 快速更新所有過時租戶
 * POST /updates/update-all
 */
updates.post(
  "/update-all",
  zValidator(
    "json",
    z.object({
      targetVersion: z.string(),
      strategy: z.enum(["all_at_once", "rolling", "canary"]).default("rolling"),
      batchSize: z.number().min(1).max(20).optional().default(5),
    }),
  ),
  async (c) => {
    const body = c.req.valid("json");
    const service = new VersionSyncService(c.env);

    // 獲取所有需要更新的租戶
    const tenants = await service.getTenantsNeedingUpdate(body.targetVersion);

    if (tenants.length === 0) {
      return c.json({
        success: true,
        message: "All tenants are up to date",
        data: { count: 0 },
      });
    }

    // 創建並執行更新計劃
    const plan = await service.createBatchUpdatePlan(
      body.targetVersion,
      tenants.map((t) => t.id),
      body.strategy,
      { batchSize: body.batchSize },
    );

    const progress = await service.executeBatchUpdatePlan(plan.id);

    return c.json({
      success: true,
      data: {
        planId: plan.id,
        progress,
      },
    });
  },
);

export default updates;
