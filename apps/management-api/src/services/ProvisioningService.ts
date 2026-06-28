/**
 * Provisioning Service
 *
 * Handles resource provisioning and deployment for tenants
 */

import type {
  ManagementEnv,
  TenantResource,
  ResourceType,
  DeploymentLog,
  DeploymentType,
  DeploymentStatus,
} from "../types";
import { decrypt } from "@makanmakan/utils";
import { CloudflareApiClient } from "./CloudflareApiClient";
import { BundleService } from "./BundleService";
import { MigrationService } from "./MigrationService";
import type { MigrationFile } from "./MigrationService";

interface ProvisionResult {
  success: boolean;
  resources?: TenantResource[];
  failedResources?: Array<{ type: ResourceType; error: string }>;
  error?: string;
}

interface DeployResult {
  success: boolean;
  deploymentId?: string;
  error?: string;
}

interface BatchDeployResult {
  tenantId: string;
  success: boolean;
  deploymentId?: string;
  error?: string;
}

interface CloudflareCredentials {
  accountId: string;
  apiToken: string;
}

export class ProvisioningService {
  private env: ManagementEnv;
  private cfClient: CloudflareApiClient;

  constructor(env: ManagementEnv) {
    this.env = env;
    this.cfClient = new CloudflareApiClient(env);
  }

  /**
   * Provision all required resources for a tenant
   */
  async provisionTenant(
    tenantId: string,
    resourceTypes?: ResourceType[],
  ): Promise<ProvisionResult> {
    // Get tenant info including CF credentials
    const tenant = await this.env.MANAGEMENT_DB.prepare(
      `
      SELECT id, subdomain, cf_account_id, cf_api_token_enc
      FROM tenants WHERE id = ?
    `,
    )
      .bind(tenantId)
      .first<{
        id: string;
        subdomain: string;
        cf_account_id: string;
        cf_api_token_enc: string;
      }>();

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    const credentials = await this.getCloudflareCredentials(tenant);
    if (!credentials) {
      return { success: false, error: "Cloudflare account not connected" };
    }

    const { apiToken, accountId } = credentials;
    const prefix = `makanmakan-${tenant.subdomain}`;

    // Default resource types if not specified
    const types = resourceTypes || ["d1", "kv", "r2"];
    const results: TenantResource[] = [];
    const failures: Array<{ type: ResourceType; error: string }> = [];

    // Update tenant status to provisioning
    await this.updateTenantStatus(tenantId, "provisioning");

    for (const type of types) {
      const resourceName = this.getResourceName(prefix, type);
      const resourceId = crypto.randomUUID();

      // Create resource record as pending
      await this.createResourceRecord(
        tenantId,
        resourceId,
        type,
        resourceName,
        "creating",
      );

      try {
        let result: { success: boolean; error?: string; resourceId?: string };

        switch (type) {
          case "d1":
            result = await this.provisionD1(apiToken, accountId, resourceName);
            break;
          case "kv":
            result = await this.provisionKV(apiToken, accountId, resourceName);
            break;
          case "r2":
            result = await this.provisionR2(apiToken, accountId, resourceName);
            break;
          default:
            result = {
              success: false,
              error: `Unsupported resource type: ${type}`,
            };
        }

        if (result.success) {
          await this.updateResourceRecord(
            resourceId,
            "ready",
            result.resourceId,
          );
          results.push({
            id: resourceId,
            tenantId,
            resourceType: type,
            resourceName,
            resourceId: result.resourceId,
            status: "ready",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } else {
          await this.updateResourceRecord(
            resourceId,
            "error",
            undefined,
            result.error,
          );
          failures.push({ type, error: result.error || "Unknown error" });
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        await this.updateResourceRecord(
          resourceId,
          "error",
          undefined,
          errorMsg,
        );
        failures.push({ type, error: errorMsg });
      }
    }

    // Update tenant status based on results
    const newStatus =
      failures.length === 0
        ? "active"
        : failures.length === types.length
          ? "pending"
          : "active";
    await this.updateTenantStatus(tenantId, newStatus);

    return {
      success: failures.length === 0,
      resources: results,
      failedResources: failures.length > 0 ? failures : undefined,
    };
  }

  /**
   * Deploy application to tenant
   */
  async deployToTenant(
    tenantId: string,
    targetVersion: string,
    deploymentType: DeploymentType = "update",
  ): Promise<DeployResult> {
    const deploymentId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    // Create deployment log
    await this.createDeploymentLog(
      deploymentId,
      tenantId,
      deploymentType,
      targetVersion,
      startedAt,
    );

    try {
      // Get tenant info
      const tenant = await this.env.MANAGEMENT_DB.prepare(
        `
        SELECT id, subdomain, deployed_version, cf_account_id, cf_api_token_enc
        FROM tenants WHERE id = ?
      `,
      )
        .bind(tenantId)
        .first<{
          id: string;
          subdomain: string;
          deployed_version: string;
          cf_account_id: string;
          cf_api_token_enc: string;
        }>();

      if (!tenant) {
        await this.updateDeploymentLog(
          deploymentId,
          "failed",
          "Tenant not found",
        );
        return { success: false, deploymentId, error: "Tenant not found" };
      }

      const credentials = await this.getCloudflareCredentials(tenant);
      if (!credentials) {
        await this.updateDeploymentLog(
          deploymentId,
          "failed",
          "Cloudflare account not connected",
        );
        return {
          success: false,
          deploymentId,
          error: "Cloudflare account not connected",
        };
      }

      // Store from version for rollback purposes
      if (tenant.deployed_version) {
        await this.updateDeploymentLogFromVersion(
          deploymentId,
          tenant.deployed_version,
        );
      }

      // 1. Get bundle from R2
      const bundleService = new BundleService(this.env);
      const bundle = await bundleService.getBundle(targetVersion);
      if (!bundle) {
        await this.updateDeploymentLog(
          deploymentId,
          "failed",
          `Bundle not found for version ${targetVersion}`,
        );
        return {
          success: false,
          deploymentId,
          error: `Bundle not found for version ${targetVersion}`,
        };
      }

      // 2. Get tenant resources (D1 database ID needed for migrations)
      const resources = await this.env.MANAGEMENT_DB.prepare(
        `SELECT resource_type, resource_id FROM tenant_resources
         WHERE tenant_id = ? AND status = 'ready'`,
      )
        .bind(tenantId)
        .all<{ resource_type: string; resource_id: string }>();

      const resourceMap = new Map(
        resources.results.map((r) => [r.resource_type, r.resource_id]),
      );

      // 3. Resolve Cloudflare credentials
      const { apiToken, accountId } = credentials;

      // 4. Apply pending migrations if D1 resource exists
      const d1ResourceId = resourceMap.get("d1");
      if (d1ResourceId && bundle.migrations.length > 0) {
        const migrationService = new MigrationService(this.env);
        const migrationFiles: MigrationFile[] = bundle.migrations.map((m) => ({
          name: m.name,
          sql: m.sql,
          checksum: MigrationService.computeChecksum(m.sql),
        }));

        const migrationResult = await migrationService.applyPendingMigrations(
          tenantId,
          apiToken,
          accountId,
          d1ResourceId,
          migrationFiles,
        );

        if (migrationResult.totalFailed > 0) {
          const failedMigration = migrationResult.migrations.find(
            (m) => m.status === "failed",
          );
          await this.updateDeploymentLog(
            deploymentId,
            "failed",
            `Migration failed: ${failedMigration?.error || "Unknown error"}`,
          );
          return {
            success: false,
            deploymentId,
            error: `Migration failed: ${failedMigration?.error || "Unknown error"}`,
          };
        }
      }

      // 5. Build bindings array for the worker
      const bindings: Record<string, unknown>[] = [];

      if (d1ResourceId) {
        bindings.push({
          type: "d1",
          name: "DB",
          id: d1ResourceId,
        });
      }

      const kvResourceId = resourceMap.get("kv");
      if (kvResourceId) {
        bindings.push({
          type: "kv_namespace",
          name: "CACHE_KV",
          namespace_id: kvResourceId,
        });
      }

      const r2ResourceId = resourceMap.get("r2");
      if (r2ResourceId) {
        bindings.push({
          type: "r2_bucket",
          name: "STORAGE",
          bucket_name: r2ResourceId,
        });
      }

      // Add environment variable bindings
      bindings.push(
        { type: "plain_text", name: "NODE_ENV", text: "production" },
        { type: "plain_text", name: "API_VERSION", text: targetVersion },
      );

      // 6. Deploy worker to tenant's Cloudflare account
      const scriptName = `makanmakan-${tenant.subdomain}-api`;
      const deployResult = await this.cfClient.deployWorker(
        apiToken,
        accountId,
        scriptName,
        bundle.script,
        bindings,
      );

      if (!deployResult.success) {
        await this.updateDeploymentLog(
          deploymentId,
          "failed",
          `Worker deployment failed: ${deployResult.error}`,
        );
        return {
          success: false,
          deploymentId,
          error: `Worker deployment failed: ${deployResult.error}`,
        };
      }

      // 7. Update tenant's deployed version
      await this.env.MANAGEMENT_DB.prepare(
        `UPDATE tenants SET deployed_version = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(targetVersion, new Date().toISOString(), tenantId)
        .run();

      await this.updateDeploymentLog(deploymentId, "completed");

      return { success: true, deploymentId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      await this.updateDeploymentLog(deploymentId, "failed", errorMsg);
      return { success: false, deploymentId, error: errorMsg };
    }
  }

  /**
   * Rollback deployment to previous version
   */
  async rollbackDeployment(
    tenantId: string,
    targetVersion?: string,
  ): Promise<{ success: boolean; version?: string; error?: string }> {
    // Get last successful deployment
    const lastDeployment = await this.env.MANAGEMENT_DB.prepare(
      `
      SELECT from_version FROM deployment_logs
      WHERE tenant_id = ? AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `,
    )
      .bind(tenantId)
      .first<{ from_version: string }>();

    const rollbackVersion = targetVersion || lastDeployment?.from_version;

    if (!rollbackVersion) {
      return {
        success: false,
        error: "No previous version found for rollback",
      };
    }

    const result = await this.deployToTenant(
      tenantId,
      rollbackVersion,
      "rollback",
    );

    if (result.success) {
      return { success: true, version: rollbackVersion };
    }

    return { success: false, error: result.error };
  }

  /**
   * Batch deploy to multiple tenants
   */
  async batchDeploy(
    tenantIds: string[],
    targetVersion: string,
  ): Promise<BatchDeployResult[]> {
    const results: BatchDeployResult[] = [];

    // Deploy to each tenant (could be parallelized with limits)
    for (const tenantId of tenantIds) {
      try {
        const result = await this.deployToTenant(
          tenantId,
          targetVersion,
          "update",
        );
        results.push({
          tenantId,
          success: result.success,
          deploymentId: result.deploymentId,
          error: result.error,
        });
      } catch (error) {
        results.push({
          tenantId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  /**
   * Get deployment status for tenant
   */
  async getDeploymentStatus(tenantId: string): Promise<{
    currentVersion?: string;
    lastDeployment?: DeploymentLog;
    resources: TenantResource[];
  }> {
    // Get tenant info
    const tenant = await this.env.MANAGEMENT_DB.prepare(
      `
      SELECT deployed_version FROM tenants WHERE id = ?
    `,
    )
      .bind(tenantId)
      .first<{ deployed_version: string }>();

    // Get last deployment
    const lastDeployment = await this.env.MANAGEMENT_DB.prepare(
      `
      SELECT * FROM deployment_logs
      WHERE tenant_id = ?
      ORDER BY started_at DESC
      LIMIT 1
    `,
    )
      .bind(tenantId)
      .first<{
        id: string;
        tenant_id: string;
        deployment_type: DeploymentType;
        from_version: string;
        to_version: string;
        status: DeploymentStatus;
        logs: string;
        started_at: string;
        completed_at: string;
      }>();

    // Get resources
    const resourcesResult = await this.env.MANAGEMENT_DB.prepare(
      `
      SELECT * FROM tenant_resources WHERE tenant_id = ?
    `,
    )
      .bind(tenantId)
      .all<{
        id: string;
        tenant_id: string;
        resource_type: string;
        resource_name: string;
        resource_id: string;
        status: string;
        error_message: string;
        created_at: string;
        updated_at: string;
      }>();

    return {
      currentVersion: tenant?.deployed_version,
      lastDeployment: lastDeployment
        ? {
            id: lastDeployment.id,
            tenantId: lastDeployment.tenant_id,
            deploymentType: lastDeployment.deployment_type,
            fromVersion: lastDeployment.from_version,
            toVersion: lastDeployment.to_version,
            status: lastDeployment.status,
            logs: lastDeployment.logs,
            startedAt: lastDeployment.started_at,
            completedAt: lastDeployment.completed_at,
          }
        : undefined,
      resources: resourcesResult.results.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        resourceType: r.resource_type as ResourceType,
        resourceName: r.resource_name,
        resourceId: r.resource_id,
        status: r.status as TenantResource["status"],
        errorMessage: r.error_message,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    };
  }

  /**
   * Get deployment history for tenant
   */
  async getDeploymentHistory(
    tenantId: string,
    limit: number,
  ): Promise<DeploymentLog[]> {
    const result = await this.env.MANAGEMENT_DB.prepare(
      `
      SELECT * FROM deployment_logs
      WHERE tenant_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `,
    )
      .bind(tenantId, limit)
      .all<{
        id: string;
        tenant_id: string;
        deployment_type: DeploymentType;
        from_version: string;
        to_version: string;
        status: DeploymentStatus;
        logs: string;
        started_at: string;
        completed_at: string;
      }>();

    return result.results.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      deploymentType: row.deployment_type,
      fromVersion: row.from_version,
      toVersion: row.to_version,
      status: row.status,
      logs: row.logs,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    }));
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  private async decryptToken(encryptedToken: string): Promise<string> {
    return decrypt(encryptedToken, this.env.ENCRYPTION_KEY);
  }

  private async getCloudflareCredentials(tenant: {
    cf_account_id?: string | null;
    cf_api_token_enc?: string | null;
  }): Promise<CloudflareCredentials | null> {
    const platformAccountId =
      this.env.PLATFORM_CF_ACCOUNT_ID || this.env.CF_ACCOUNT_ID;
    const platformApiToken =
      this.env.PLATFORM_CF_API_TOKEN || this.env.CF_API_TOKEN;

    if (platformAccountId && platformApiToken) {
      return {
        accountId: platformAccountId,
        apiToken: platformApiToken,
      };
    }

    if (tenant.cf_account_id && tenant.cf_api_token_enc) {
      return {
        accountId: tenant.cf_account_id,
        apiToken: await this.decryptToken(tenant.cf_api_token_enc),
      };
    }

    return null;
  }

  private getResourceName(prefix: string, type: ResourceType): string {
    switch (type) {
      case "d1":
        return `${prefix}-db`;
      case "kv":
        return `${prefix}-cache`;
      case "r2":
        return `${prefix}-storage`;
      case "worker":
        return `${prefix}-api`;
      case "page":
        return `${prefix}-app`;
      default:
        return `${prefix}-${type}`;
    }
  }

  private async provisionD1(
    apiToken: string,
    accountId: string,
    name: string,
  ): Promise<{ success: boolean; resourceId?: string; error?: string }> {
    const result = await this.cfClient.createD1Database(
      apiToken,
      accountId,
      name,
    );
    return {
      success: result.success,
      resourceId: result.database?.uuid,
      error: result.error,
    };
  }

  private async provisionKV(
    apiToken: string,
    accountId: string,
    name: string,
  ): Promise<{ success: boolean; resourceId?: string; error?: string }> {
    const result = await this.cfClient.createKVNamespace(
      apiToken,
      accountId,
      name,
    );
    return {
      success: result.success,
      resourceId: result.namespace?.id,
      error: result.error,
    };
  }

  private async provisionR2(
    apiToken: string,
    accountId: string,
    name: string,
  ): Promise<{ success: boolean; resourceId?: string; error?: string }> {
    const result = await this.cfClient.createR2Bucket(
      apiToken,
      accountId,
      name,
    );
    return {
      success: result.success,
      resourceId: result.bucket?.name,
      error: result.error,
    };
  }

  private async updateTenantStatus(
    tenantId: string,
    status: string,
  ): Promise<void> {
    await this.env.MANAGEMENT_DB.prepare(
      `
      UPDATE tenants SET status = ?, updated_at = ? WHERE id = ?
    `,
    )
      .bind(status, new Date().toISOString(), tenantId)
      .run();
  }

  private async createResourceRecord(
    tenantId: string,
    resourceId: string,
    type: ResourceType,
    name: string,
    status: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.env.MANAGEMENT_DB.prepare(
      `
      INSERT INTO tenant_resources (id, tenant_id, resource_type, resource_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(resourceId, tenantId, type, name, status, now, now)
      .run();
  }

  private async updateResourceRecord(
    resourceId: string,
    status: string,
    cfResourceId?: string,
    errorMessage?: string,
  ): Promise<void> {
    if (cfResourceId) {
      await this.env.MANAGEMENT_DB.prepare(
        `
        UPDATE tenant_resources SET status = ?, resource_id = ?, updated_at = ? WHERE id = ?
      `,
      )
        .bind(status, cfResourceId, new Date().toISOString(), resourceId)
        .run();
    } else if (errorMessage) {
      await this.env.MANAGEMENT_DB.prepare(
        `
        UPDATE tenant_resources SET status = ?, error_message = ?, updated_at = ? WHERE id = ?
      `,
      )
        .bind(status, errorMessage, new Date().toISOString(), resourceId)
        .run();
    } else {
      await this.env.MANAGEMENT_DB.prepare(
        `
        UPDATE tenant_resources SET status = ?, updated_at = ? WHERE id = ?
      `,
      )
        .bind(status, new Date().toISOString(), resourceId)
        .run();
    }
  }

  private async createDeploymentLog(
    id: string,
    tenantId: string,
    type: DeploymentType,
    toVersion: string,
    startedAt: string,
  ): Promise<void> {
    await this.env.MANAGEMENT_DB.prepare(
      `
      INSERT INTO deployment_logs (id, tenant_id, deployment_type, to_version, status, started_at)
      VALUES (?, ?, ?, ?, 'in_progress', ?)
    `,
    )
      .bind(id, tenantId, type, toVersion, startedAt)
      .run();
  }

  private async updateDeploymentLog(
    id: string,
    status: DeploymentStatus,
    errorLog?: string,
  ): Promise<void> {
    const completedAt = new Date().toISOString();
    const logs = errorLog
      ? JSON.stringify([{ error: errorLog, timestamp: completedAt }])
      : null;

    await this.env.MANAGEMENT_DB.prepare(
      `
      UPDATE deployment_logs SET status = ?, logs = ?, completed_at = ? WHERE id = ?
    `,
    )
      .bind(status, logs, completedAt, id)
      .run();
  }

  private async updateDeploymentLogFromVersion(
    id: string,
    fromVersion: string,
  ): Promise<void> {
    await this.env.MANAGEMENT_DB.prepare(
      `
      UPDATE deployment_logs SET from_version = ? WHERE id = ?
    `,
    )
      .bind(fromVersion, id)
      .run();
  }
}
