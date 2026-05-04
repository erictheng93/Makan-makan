/**
 * Migration Service
 *
 * Tracks and applies database migrations to tenant D1 databases.
 * Each tenant has its own D1 database; this service manages which
 * migrations have been applied and executes pending ones.
 */

import { generateUUID } from "@makanmasak/utils";
import type { ManagementEnv } from "../types";
import { CloudflareApiClient } from "./CloudflareApiClient";

export interface MigrationRecord {
  id: string;
  tenantId: string;
  migrationName: string;
  checksum: string;
  appliedAt: string;
  success: boolean;
  errorMessage?: string;
}

export interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

export interface MigrationResult {
  totalApplied: number;
  totalSkipped: number;
  totalFailed: number;
  migrations: Array<{
    name: string;
    status: "applied" | "skipped" | "failed";
    error?: string;
  }>;
}

export class MigrationService {
  private env: ManagementEnv;
  private cfClient: CloudflareApiClient;

  constructor(env: ManagementEnv) {
    this.env = env;
    this.cfClient = new CloudflareApiClient(env);
  }

  /**
   * Get all migrations applied to a tenant
   */
  async getAppliedMigrations(tenantId: string): Promise<MigrationRecord[]> {
    const result = await this.env.MANAGEMENT_DB.prepare(
      `SELECT * FROM tenant_migrations
       WHERE tenant_id = ?
       ORDER BY migration_name ASC`,
    )
      .bind(tenantId)
      .all<{
        id: string;
        tenant_id: string;
        migration_name: string;
        checksum: string;
        applied_at: string;
        success: number;
        error_message: string | null;
      }>();

    return result.results.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      migrationName: row.migration_name,
      checksum: row.checksum,
      appliedAt: row.applied_at,
      success: row.success === 1,
      errorMessage: row.error_message ?? undefined,
    }));
  }

  /**
   * Apply pending migrations to a tenant's D1 database.
   * Migrations are applied in order by name. Stops on first failure.
   */
  async applyPendingMigrations(
    tenantId: string,
    apiToken: string,
    accountId: string,
    databaseId: string,
    migrations: MigrationFile[],
  ): Promise<MigrationResult> {
    const applied = await this.getAppliedMigrations(tenantId);
    const appliedNames = new Set(
      applied.filter((m) => m.success).map((m) => m.migrationName),
    );

    // Sort migrations by name to ensure consistent order
    const sorted = [...migrations].sort((a, b) => a.name.localeCompare(b.name));

    const result: MigrationResult = {
      totalApplied: 0,
      totalSkipped: 0,
      totalFailed: 0,
      migrations: [],
    };

    for (const migration of sorted) {
      if (appliedNames.has(migration.name)) {
        result.totalSkipped++;
        result.migrations.push({ name: migration.name, status: "skipped" });
        continue;
      }

      // Apply migration via Cloudflare API
      const migrationId = generateUUID();
      const execResult = await this.cfClient.runD1Migration(
        apiToken,
        accountId,
        databaseId,
        migration.sql,
      );

      if (execResult.success) {
        // Record success
        await this.recordMigration(
          migrationId,
          tenantId,
          migration.name,
          migration.checksum,
          true,
        );
        result.totalApplied++;
        result.migrations.push({ name: migration.name, status: "applied" });
      } else {
        // Record failure and stop
        await this.recordMigration(
          migrationId,
          tenantId,
          migration.name,
          migration.checksum,
          false,
          execResult.error,
        );
        result.totalFailed++;
        result.migrations.push({
          name: migration.name,
          status: "failed",
          error: execResult.error,
        });
        break; // Stop on first failure
      }
    }

    return result;
  }

  /**
   * Record a migration execution in the tracking table
   */
  private async recordMigration(
    id: string,
    tenantId: string,
    migrationName: string,
    checksum: string,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    await this.env.MANAGEMENT_DB.prepare(
      `INSERT INTO tenant_migrations (id, tenant_id, migration_name, checksum, success, error_message)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        tenantId,
        migrationName,
        checksum,
        success ? 1 : 0,
        errorMessage ?? null,
      )
      .run();
  }

  /**
   * Compute a simple checksum for migration content
   */
  static computeChecksum(sql: string): string {
    // Simple hash using Web Crypto would be async; use a sync approach for checksums
    let hash = 0;
    for (let i = 0; i < sql.length; i++) {
      const char = sql.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return `chk-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }
}
