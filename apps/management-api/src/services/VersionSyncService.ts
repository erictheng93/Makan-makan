/**
 * Version Sync Service
 * 版本同步服務 - Phase 3 實施
 */

import type {
  ManagementEnv,
  Tenant,
  LicenseTier,
  TenantStatus,
} from "../types";
import { ProvisioningService } from "./ProvisioningService";
import { randomId } from "../utils/random";

export interface VersionRelease {
  version: string;
  releaseDate: string;
  changelog: string[];
  breaking: boolean;
  minVersion?: string; // 最低可升級版本
}

export interface BatchUpdatePlan {
  id: string;
  targetVersion: string;
  strategy: "all_at_once" | "rolling" | "canary";
  tenantIds: string[];
  batchSize?: number; // 用於 rolling 策略
  canaryPercentage?: number; // 用於 canary 策略
  status: "planned" | "in_progress" | "completed" | "failed" | "cancelled";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface BatchUpdateProgress {
  planId: string;
  totalTenants: number;
  completedTenants: number;
  failedTenants: number;
  inProgressTenants: number;
  pendingTenants: number;
  results: {
    tenantId: string;
    businessName: string;
    status: "pending" | "in_progress" | "completed" | "failed";
    deploymentId?: string;
    error?: string;
  }[];
}

export class VersionSyncService {
  private env: ManagementEnv;
  private provisioningService: ProvisioningService;

  constructor(env: ManagementEnv) {
    this.env = env;
    this.provisioningService = new ProvisioningService(env);
  }

  /**
   * 獲取可用的版本發佈
   */
  async getAvailableReleases(): Promise<VersionRelease[]> {
    // 在實際實現中，這會從配置或 API 獲取
    // 這裡使用硬編碼的範例
    return [
      {
        version: "1.2.0",
        releaseDate: "2024-01-15",
        changelog: ["新增 AI 分析功能", "優化訂單處理效能", "修復若干 bug"],
        breaking: false,
      },
      {
        version: "1.1.0",
        releaseDate: "2024-01-01",
        changelog: ["新增員工排班系統", "新增請假管理功能", "改進 UI/UX"],
        breaking: false,
      },
      {
        version: "1.0.0",
        releaseDate: "2023-12-01",
        changelog: ["初始版本發佈"],
        breaking: false,
      },
    ];
  }

  /**
   * 創建批量更新計劃
   */
  async createBatchUpdatePlan(
    targetVersion: string,
    tenantIds: string[],
    strategy: "all_at_once" | "rolling" | "canary" = "rolling",
    options?: { batchSize?: number; canaryPercentage?: number },
  ): Promise<BatchUpdatePlan> {
    const plan: BatchUpdatePlan = {
      id: randomId("plan"),
      targetVersion,
      strategy,
      tenantIds,
      batchSize: options?.batchSize || 5,
      canaryPercentage: options?.canaryPercentage || 10,
      status: "planned",
      createdAt: new Date().toISOString(),
    };

    // 儲存計劃（在實際實現中會存入資料庫）
    await this.env.CACHE_KV.put(
      `update_plan:${plan.id}`,
      JSON.stringify(plan),
      { expirationTtl: 86400 * 7 }, // 7 天過期
    );

    return plan;
  }

  /**
   * 執行批量更新計劃
   */
  async executeBatchUpdatePlan(planId: string): Promise<BatchUpdateProgress> {
    const planData = await this.env.CACHE_KV.get(`update_plan:${planId}`);
    if (!planData) {
      throw new Error("Update plan not found");
    }

    const plan: BatchUpdatePlan = JSON.parse(planData);
    plan.status = "in_progress";
    plan.startedAt = new Date().toISOString();

    // 更新計劃狀態
    await this.env.CACHE_KV.put(`update_plan:${plan.id}`, JSON.stringify(plan));

    // 獲取租戶資訊
    const tenants = await this.getTenantsByIds(plan.tenantIds);

    // 初始化進度
    const progress: BatchUpdateProgress = {
      planId: plan.id,
      totalTenants: tenants.length,
      completedTenants: 0,
      failedTenants: 0,
      inProgressTenants: 0,
      pendingTenants: tenants.length,
      results: tenants.map((t) => ({
        tenantId: t.id,
        businessName: t.businessName,
        status: "pending" as const,
      })),
    };

    // 根據策略執行更新
    switch (plan.strategy) {
      case "all_at_once":
        await this.executeAllAtOnce(plan, tenants, progress);
        break;
      case "rolling":
        await this.executeRolling(plan, tenants, progress);
        break;
      case "canary":
        await this.executeCanary(plan, tenants, progress);
        break;
    }

    return progress;
  }

  /**
   * 全部同時更新
   */
  private async executeAllAtOnce(
    plan: BatchUpdatePlan,
    tenants: Tenant[],
    progress: BatchUpdateProgress,
  ): Promise<void> {
    const promises = tenants.map((tenant) =>
      this.updateTenant(tenant, plan.targetVersion, progress),
    );
    await Promise.allSettled(promises);
  }

  /**
   * 滾動更新
   */
  private async executeRolling(
    plan: BatchUpdatePlan,
    tenants: Tenant[],
    progress: BatchUpdateProgress,
  ): Promise<void> {
    const batchSize = plan.batchSize || 5;

    for (let i = 0; i < tenants.length; i += batchSize) {
      const batch = tenants.slice(i, i + batchSize);
      const promises = batch.map((tenant) =>
        this.updateTenant(tenant, plan.targetVersion, progress),
      );
      await Promise.allSettled(promises);

      // 等待一段時間再處理下一批
      if (i + batchSize < tenants.length) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  /**
   * 金絲雀更新
   */
  private async executeCanary(
    plan: BatchUpdatePlan,
    tenants: Tenant[],
    progress: BatchUpdateProgress,
  ): Promise<void> {
    const canaryCount = Math.ceil(
      tenants.length * ((plan.canaryPercentage || 10) / 100),
    );
    const canaryTenants = tenants.slice(0, canaryCount);
    const remainingTenants = tenants.slice(canaryCount);

    // 先更新金絲雀租戶
    const canaryPromises = canaryTenants.map((tenant) =>
      this.updateTenant(tenant, plan.targetVersion, progress),
    );
    await Promise.allSettled(canaryPromises);

    // 檢查金絲雀結果
    const canaryResults = progress.results.filter((r) =>
      canaryTenants.some((t) => t.id === r.tenantId),
    );
    const canaryFailures = canaryResults.filter((r) => r.status === "failed");

    if (canaryFailures.length > 0) {
      // 金絲雀失敗，停止更新
      console.error("Canary update failed, stopping batch update");
      return;
    }

    // 等待確認金絲雀運行正常
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // 更新剩餘租戶
    const remainingPromises = remainingTenants.map((tenant) =>
      this.updateTenant(tenant, plan.targetVersion, progress),
    );
    await Promise.allSettled(remainingPromises);
  }

  /**
   * 更新單個租戶
   */
  private async updateTenant(
    tenant: Tenant,
    targetVersion: string,
    progress: BatchUpdateProgress,
  ): Promise<void> {
    const result = progress.results.find((r) => r.tenantId === tenant.id);
    if (!result) return;

    result.status = "in_progress";
    progress.inProgressTenants++;
    progress.pendingTenants--;

    try {
      const deployment = await this.provisioningService.deployToTenant(
        tenant.id,
        targetVersion,
      );
      result.status = "completed";
      result.deploymentId = deployment.deploymentId;
      progress.completedTenants++;
    } catch (error) {
      result.status = "failed";
      result.error = error instanceof Error ? error.message : "Unknown error";
      progress.failedTenants++;
    } finally {
      progress.inProgressTenants--;
    }
  }

  /**
   * 將 D1 tenants 資料列 (snake_case 欄位) 映射成 camelCase 的 Tenant。
   *
   * `SELECT *` 回傳的欄位是資料庫的 snake_case 名稱 (business_name 等)，
   * 直接 `as Tenant[]` 會謊報型別 — 消費端讀 `.businessName` 會拿到 undefined。
   * 這個 mapper 做明確的欄位對應，讓型別與 runtime 一致。
   */
  private mapTenantRow(row: Record<string, unknown>): Tenant {
    return {
      id: row.id as string,
      businessName: row.business_name as string,
      contactEmail: row.contact_email as string,
      contactPhone: (row.contact_phone as string | null) ?? undefined,
      latitude: (row.latitude as number | null) ?? undefined,
      longitude: (row.longitude as number | null) ?? undefined,
      subdomain: row.subdomain as string,
      customDomain: (row.custom_domain as string | null) ?? undefined,
      deployedVersion: (row.deployed_version as string | null) ?? undefined,
      licenseTier: row.license_tier as LicenseTier,
      licenseKey: row.license_key as string,
      licenseExpiresAt: (row.license_expires_at as string | null) ?? undefined,
      status: row.status as TenantStatus,
      createdAt: row.created_at as string,
      activatedAt: (row.activated_at as string | null) ?? undefined,
      updatedAt: row.updated_at as string,
    };
  }

  /**
   * 獲取租戶列表
   */
  private async getTenantsByIds(ids: string[]): Promise<Tenant[]> {
    const db = this.env.MANAGEMENT_DB;
    const placeholders = ids.map(() => "?").join(",");
    const results = await db
      .prepare(`SELECT * FROM tenants WHERE id IN (${placeholders})`)
      .bind(...ids)
      .all();

    return (results.results ?? []).map((row) =>
      this.mapTenantRow(row as Record<string, unknown>),
    );
  }

  /**
   * 獲取需要更新的租戶
   */
  async getTenantsNeedingUpdate(targetVersion: string): Promise<Tenant[]> {
    const db = this.env.MANAGEMENT_DB;
    const results = await db
      .prepare(
        `
        SELECT * FROM tenants
        WHERE status = 'active'
          AND (deployed_version IS NULL OR deployed_version < ?)
        ORDER BY business_name
      `,
      )
      .bind(targetVersion)
      .all();

    return (results.results ?? []).map((row) =>
      this.mapTenantRow(row as Record<string, unknown>),
    );
  }

  /**
   * 獲取更新計劃進度
   */
  async getUpdatePlanProgress(
    planId: string,
  ): Promise<BatchUpdateProgress | null> {
    const progressData = await this.env.CACHE_KV.get(
      `update_progress:${planId}`,
    );
    if (!progressData) return null;
    return JSON.parse(progressData);
  }

  /**
   * 取消更新計劃
   */
  async cancelUpdatePlan(planId: string): Promise<void> {
    const planData = await this.env.CACHE_KV.get(`update_plan:${planId}`);
    if (!planData) {
      throw new Error("Update plan not found");
    }

    const plan: BatchUpdatePlan = JSON.parse(planData);
    if (plan.status === "in_progress") {
      throw new Error("Cannot cancel an in-progress update plan");
    }

    plan.status = "cancelled";
    await this.env.CACHE_KV.put(`update_plan:${plan.id}`, JSON.stringify(plan));
  }
}
