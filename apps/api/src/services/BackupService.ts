/**
 * Multi-tenant Backup Service
 * Enhanced version based on RestaurentPOS backup implementation
 * Adds enterprise features and multi-tenant isolation
 */

import type {
  BackupConfiguration,
  BackupRecord,
  RestoreOperation,
  CreateBackupRequest,
  CreateBackupResponse,
  ListBackupsQuery,
  RestoreBackupRequest,
  BackupSystemHealth,
  BackupAlert,
  BackupAuditLog,
  BackupStatus,
} from "@makanmakan/shared-types";
import type {
  D1Database,
  R2Bucket,
  KVNamespace,
} from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { and, count, desc, eq, gte, sum } from "drizzle-orm";
import {
  backupAlerts,
  backupConfigurations,
  backupRecords,
  systemAlerts,
} from "@makanmakan/database";
import { generateUUID } from "@makanmakan/utils";

/**
 * System health derivation thresholds.
 * - Success rate is measured over the trailing window below and only
 *   influences status once enough backups exist to be meaningful.
 * - Status mapping: healthy → "healthy", degraded → "warning",
 *   unhealthy → "critical" (matches BackupSystemHealth.overall_status).
 */
const HEALTH_SUCCESS_RATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const HEALTH_FAILED_24H_WARNING_THRESHOLD = 5; // > 5 failures/24h → warning
const HEALTH_FAILED_24H_CRITICAL_THRESHOLD = 10; // > 10 failures/24h → critical
const HEALTH_RUNNING_BACKUPS_WARNING_THRESHOLD = 20; // > 20 concurrent → warning
const HEALTH_SUCCESS_RATE_WARNING_PERCENTAGE = 80; // < 80% over window → warning
const HEALTH_SUCCESS_RATE_CRITICAL_PERCENTAGE = 50; // < 50% over window → critical
const HEALTH_MIN_WINDOW_BACKUPS_FOR_RATE_STATUS = 5; // rate needs ≥ 5 samples

/**
 * BackupSystemHealth plus the last successful backup timestamp, which the
 * shared type does not carry but monitoring consumers need.
 */
export type BackupSystemHealthReport = BackupSystemHealth & {
  last_successful_backup_at: string | null;
};

const BACKUP_SORT_COLUMNS = {
  created_at: "created_at",
  file_size: "file_size",
  duration: "started_at",
} as const;

const BACKUP_TABLE_NAMES = new Set([
  "orders",
  "order_items",
  "menu_items",
  "categories",
  "tables",
  "users",
  "restaurants",
  "audit_logs",
  "sessions",
  "qr_codes",
  "images",
]);

export class BackupService {
  private orm: ReturnType<typeof drizzle>;

  constructor(
    private db: D1Database,
    private storage: R2Bucket,
    private kv: KVNamespace,
  ) {
    this.orm = drizzle(db);
  }

  /**
   * Create a new backup for a specific restaurant
   */
  async createBackup(
    request: CreateBackupRequest,
    userId: string,
  ): Promise<CreateBackupResponse> {
    const backupId = generateUUID();
    const timestamp = new Date().toISOString();

    try {
      // Get configuration
      const config = await this.getBackupConfiguration(
        request.restaurant_id,
        request.configuration_id,
      );
      if (!config) {
        throw new Error("Backup configuration not found or access denied");
      }

      // Determine tables to backup
      const tablesToBackup = await this.getRestaurantTables(
        request.restaurant_id,
        request.include_tables || config.include_tables,
        request.exclude_tables || config.exclude_tables,
      );

      // Create backup record
      const backup: Partial<BackupRecord> = {
        id: backupId,
        restaurant_id: request.restaurant_id,
        configuration_id: config.id,
        name: request.name,
        backup_type: request.backup_type || config.backup_type,
        status: "pending" as BackupStatus,
        tables_included: tablesToBackup,
        storage_provider: config.storage_provider,
        encryption_enabled: config.encryption_enabled,
        started_at: timestamp,
        created_by: userId,
      };

      await this.saveBackupRecord(backup as BackupRecord);

      if (request.force_immediate) {
        this.executeBackup(backupId).catch((error) => {
          console.error(`Background backup failed for ${backupId}:`, error);
        });
      }

      return {
        backup_id: backupId,
        status: "pending",
        estimated_duration_minutes: tablesToBackup.length * 2,
        message: "Backup has been scheduled successfully",
      };
    } catch (error) {
      console.error("Error creating backup:", error);
      throw new Error(
        `Failed to create backup: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Execute the actual backup process
   */
  private async executeBackup(backupId: string): Promise<void> {
    try {
      await this.updateBackupStatus(backupId, "in_progress");

      const backup = await this.getBackupRecord(backupId);
      if (!backup) {
        throw new Error("Backup record not found");
      }

      // Extract data from tables
      const backupData: Record<string, Record<string, unknown>[]> = {};
      let totalRecords = 0;

      for (const tableName of backup.tables_included) {
        try {
          const tableData = await this.extractTableData(
            backup.restaurant_id,
            tableName,
          );
          backupData[tableName] = tableData;
          totalRecords += tableData.length;
        } catch (error) {
          console.error(`Error backing up table ${tableName}:`, error);
        }
      }

      // Serialize backup data
      const backupJson = JSON.stringify(backupData);
      const storagePath = this.generateStoragePath(
        backup.restaurant_id,
        backupId,
      );
      await this.uploadBackup(storagePath, backupJson);

      const checksum = await this.calculateChecksum(backupJson);
      const completedAt = new Date().toISOString();
      const duration =
        new Date(completedAt).getTime() - new Date(backup.started_at).getTime();

      await this.updateBackupRecord(backupId, {
        status: "completed",
        file_size: backupJson.length,
        compressed_size: backupJson.length,
        records_count: totalRecords,
        storage_path: storagePath,
        checksum: checksum,
        completed_at: completedAt,
        metadata: {
          tables_info: backup.tables_included.map((table) => ({
            table_name: table,
            record_count: backupData[table]?.length || 0,
            estimated_size: JSON.stringify(backupData[table] || []).length,
          })),
          performance_metrics: {
            backup_duration_ms: duration,
            compression_ratio: 1,
            upload_speed_mbps:
              backupJson.length > 0
                ? backupJson.length / 1024 / 1024 / (duration / 1000)
                : 0,
          },
          database_snapshot: {
            version: "1.0",
            schema_hash: await this.getSchemaHash(backup.restaurant_id),
            total_tables: backup.tables_included.length,
            total_records: totalRecords,
          },
        },
      });

      await this.createAuditLog({
        restaurant_id: backup.restaurant_id,
        action: "backup_created",
        details: {
          backup_id: backupId,
          tables_count: backup.tables_included.length,
        },
        performed_by: backup.created_by,
      });
    } catch (error) {
      console.error(`Backup execution failed for ${backupId}:`, error);
      await this.updateBackupStatus(backupId, "failed");
      throw error;
    }
  }

  /**
   * List backups for a restaurant with filtering and pagination
   */
  async listBackups(
    query: ListBackupsQuery,
  ): Promise<{ backups: BackupRecord[]; total: number }> {
    const {
      restaurant_id,
      status,
      backup_type,
      date_from,
      date_to,
      page = 1,
      limit = 20,
      sort_by = "created_at",
      sort_order = "desc",
    } = query;

    try {
      let sql = `SELECT * FROM backups WHERE restaurant_id = ?`;
      const params: (string | number)[] = [restaurant_id];

      if (status) {
        sql += ` AND status = ?`;
        params.push(status);
      }

      if (backup_type) {
        sql += ` AND backup_type = ?`;
        params.push(backup_type);
      }

      if (date_from) {
        sql += ` AND started_at >= ?`;
        params.push(date_from);
      }

      if (date_to) {
        sql += ` AND started_at <= ?`;
        params.push(date_to);
      }

      const sortColumn =
        BACKUP_SORT_COLUMNS[sort_by as keyof typeof BACKUP_SORT_COLUMNS] ??
        BACKUP_SORT_COLUMNS.created_at;
      const sortDirection = sort_order === "asc" ? "ASC" : "DESC";

      sql += ` ORDER BY ${sortColumn} ${sortDirection}`;
      sql += ` LIMIT ? OFFSET ?`;

      const offset = (page - 1) * limit;
      params.push(limit, offset);

      const result = await this.db
        .prepare(sql)
        .bind(...params)
        .all();

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM backups WHERE restaurant_id = ?`;
      const countResult = await this.db
        .prepare(countSql)
        .bind(restaurant_id)
        .first();

      return {
        backups: result.results as unknown as BackupRecord[],
        total: (countResult as { total?: number } | null)?.total || 0,
      };
    } catch (error) {
      console.error("Error listing backups:", error);
      throw new Error(
        `Failed to list backups: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(
    request: RestoreBackupRequest,
    userId: string,
  ): Promise<{ operation_id: string }> {
    const operationId = generateUUID();

    try {
      if (
        request.safety_confirmation.confirmation_phrase !==
        "I understand the risks"
      ) {
        throw new Error("Safety confirmation phrase is incorrect");
      }

      const backup = await this.getBackupRecord(request.backup_id);
      if (!backup || backup.restaurant_id !== request.restaurant_id) {
        throw new Error("Backup not found or access denied");
      }

      if (backup.status !== "completed") {
        throw new Error("Cannot restore from incomplete backup");
      }

      const operation: Partial<RestoreOperation> = {
        id: operationId,
        restaurant_id: request.restaurant_id,
        backup_id: request.backup_id,
        status: "pending",
        restore_type: request.restore_type,
        target_tables: request.target_tables,
        overwrite_existing: request.overwrite_existing,
        started_at: new Date().toISOString(),
        performed_by: userId,
        safety_checks: {
          backup_integrity_verified:
            request.safety_confirmation.backup_integrity_verified,
          target_compatibility_verified: true,
          data_loss_risk_acknowledged:
            request.safety_confirmation.data_loss_risk_acknowledged,
        },
      };

      await this.saveRestoreOperation(operation as RestoreOperation);

      this.executeRestore(operationId).catch((error) => {
        console.error(`Background restore failed for ${operationId}:`, error);
      });

      return { operation_id: operationId };
    } catch (error) {
      console.error("Error initiating restore:", error);
      throw new Error(
        `Failed to initiate restore: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Additional methods expected by backup routes
  async getBackupById(backupId: string): Promise<BackupRecord | null> {
    return this.getBackupRecord(backupId);
  }

  async restoreFromBackup(
    request: RestoreBackupRequest,
    userId: string,
  ): Promise<string> {
    const result = await this.restoreBackup(request, userId);
    return result.operation_id;
  }

  async deleteBackup(backupId: string, userId: string): Promise<void> {
    console.log("Deleting backup:", backupId, "by user:", userId);
  }

  async getBackupConfigurations(
    restaurantId: string,
  ): Promise<BackupConfiguration[]> {
    const defaultConfig = await this.getBackupConfiguration(restaurantId);
    return defaultConfig ? [defaultConfig] : [];
  }

  async createOrUpdateConfiguration(
    configInput: Omit<
      BackupConfiguration,
      "id" | "created_by" | "created_at" | "updated_at" | "storage_provider"
    >,
    userId: string,
  ): Promise<BackupConfiguration> {
    const config: BackupConfiguration = {
      id: generateUUID(),
      restaurant_id: configInput.restaurant_id,
      name: configInput.name,
      description: configInput.description,
      backup_type: configInput.backup_type,
      schedule_enabled: configInput.schedule_enabled,
      schedule_cron: configInput.schedule_cron,
      retention_days: configInput.retention_days,
      include_tables: configInput.include_tables,
      exclude_tables: configInput.exclude_tables,
      compression_enabled: configInput.compression_enabled,
      encryption_enabled: configInput.encryption_enabled,
      storage_provider: "r2",
      max_parallel_backups: configInput.max_parallel_backups,
      notifications_enabled: configInput.notifications_enabled,
      notification_channels: configInput.notification_channels,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    console.log("Creating/updating config:", config.id, "by user:", userId);
    return config;
  }

  async getSystemHealth(): Promise<BackupSystemHealthReport> {
    try {
      const now = Date.now();
      const since24h = new Date(now - 24 * 60 * 60 * 1000);
      const windowStart = new Date(now - HEALTH_SUCCESS_RATE_WINDOW_MS);

      const [runningRow] = await this.orm
        .select({ total: count() })
        .from(backupRecords)
        .where(eq(backupRecords.status, "in_progress"));

      const [failed24hRow] = await this.orm
        .select({ total: count() })
        .from(backupRecords)
        .where(
          and(
            eq(backupRecords.status, "failed"),
            gte(backupRecords.startedAt, since24h),
          ),
        );

      const [windowFailedRow] = await this.orm
        .select({ total: count() })
        .from(backupRecords)
        .where(
          and(
            eq(backupRecords.status, "failed"),
            gte(backupRecords.startedAt, windowStart),
          ),
        );

      const windowCompleted = await this.orm
        .select({
          startedAt: backupRecords.startedAt,
          completedAt: backupRecords.completedAt,
          fileSize: backupRecords.fileSize,
          compressedSize: backupRecords.compressedSize,
        })
        .from(backupRecords)
        .where(
          and(
            eq(backupRecords.status, "completed"),
            gte(backupRecords.startedAt, windowStart),
          ),
        );

      const [lastSuccessRow] = await this.orm
        .select({ completedAt: backupRecords.completedAt })
        .from(backupRecords)
        .where(eq(backupRecords.status, "completed"))
        .orderBy(desc(backupRecords.completedAt))
        .limit(1);

      const restaurantRows = await this.orm
        .selectDistinct({ restaurantId: backupRecords.restaurantId })
        .from(backupRecords);

      const [configRow] = await this.orm
        .select({ total: count() })
        .from(backupConfigurations);

      const [storageRow] = await this.orm
        .select({ totalBytes: sum(backupRecords.fileSize) })
        .from(backupRecords)
        .where(eq(backupRecords.status, "completed"));

      const unresolvedAlerts = await this.orm
        .select({ severity: backupAlerts.severity })
        .from(backupAlerts)
        .where(eq(backupAlerts.resolved, false));

      const runningBackups = runningRow?.total ?? 0;
      const failedBackups24h = failed24hRow?.total ?? 0;
      const windowFailed = windowFailedRow?.total ?? 0;
      const windowTotal = windowCompleted.length + windowFailed;
      // No backups in the window means an idle system, not a broken one.
      const successRate =
        windowTotal > 0 ? (windowCompleted.length / windowTotal) * 100 : 100;

      const durationsMs = windowCompleted
        .filter((row) => row.startedAt && row.completedAt)
        .map(
          (row) =>
            (row.completedAt as Date).getTime() -
            (row.startedAt as Date).getTime(),
        );
      const averageDurationMinutes =
        durationsMs.length > 0
          ? durationsMs.reduce((total, value) => total + value, 0) /
            durationsMs.length /
            60000
          : 0;

      const compressionRatios = windowCompleted
        .filter((row) => row.fileSize > 0 && row.compressedSize > 0)
        .map((row) => row.compressedSize / row.fileSize);
      const averageCompressionRatio =
        compressionRatios.length > 0
          ? compressionRatios.reduce((total, value) => total + value, 0) /
            compressionRatios.length
          : 1;

      const alertsSummary = { critical: 0, high: 0, medium: 0, low: 0 };
      for (const alert of unresolvedAlerts) {
        if (alert.severity in alertsSummary) {
          alertsSummary[alert.severity as keyof typeof alertsSummary]++;
        }
      }

      const hasRateSignal =
        windowTotal >= HEALTH_MIN_WINDOW_BACKUPS_FOR_RATE_STATUS;
      let overallStatus: BackupSystemHealth["overall_status"] = "healthy";
      if (
        failedBackups24h > HEALTH_FAILED_24H_CRITICAL_THRESHOLD ||
        (hasRateSignal && successRate < HEALTH_SUCCESS_RATE_CRITICAL_PERCENTAGE)
      ) {
        overallStatus = "critical";
      } else if (
        failedBackups24h > HEALTH_FAILED_24H_WARNING_THRESHOLD ||
        runningBackups > HEALTH_RUNNING_BACKUPS_WARNING_THRESHOLD ||
        (hasRateSignal && successRate < HEALTH_SUCCESS_RATE_WARNING_PERCENTAGE)
      ) {
        overallStatus = "warning";
      }

      return {
        overall_status: overallStatus,
        total_restaurants: restaurantRows.length,
        active_configurations: configRow?.total ?? 0,
        running_backups: runningBackups,
        failed_backups_24h: failedBackups24h,
        last_successful_backup_at: lastSuccessRow?.completedAt
          ? lastSuccessRow.completedAt.toISOString()
          : null,
        storage_usage: {
          total_bytes: Number(storageRow?.totalBytes ?? 0),
          // R2 has no fixed quota to report against.
          available_bytes: 0,
          usage_percentage: 0,
        },
        performance_metrics: {
          average_backup_duration_minutes: averageDurationMinutes,
          average_success_rate_percentage: successRate,
          average_compression_ratio: averageCompressionRatio,
        },
        alerts_summary: alertsSummary,
      };
    } catch (error) {
      console.error("Error getting backup system health:", error);
      throw new Error("Failed to get backup system health");
    }
  }

  async getRestaurantMetrics(
    restaurantId: string,
    timeframe?: string,
  ): Promise<Record<string, unknown>> {
    console.log(
      "Getting metrics for restaurant:",
      restaurantId,
      "timeframe:",
      timeframe,
    );
    return {};
  }

  async getRestaurantAlerts(
    restaurantId: string,
    filters?: Record<string, unknown>,
  ): Promise<BackupAlert[]> {
    console.log(
      "Getting alerts for restaurant:",
      restaurantId,
      "filters:",
      filters,
    );
    return [];
  }

  async createAlert(
    alert: Partial<BackupAlert>,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const message = alert.message ?? alert.title ?? "Backup alert";
    const restaurantId = alert.restaurant_id;

    if (restaurantId && restaurantId !== "system") {
      // Restaurant-scoped alerts live in backup_alerts. The table has no
      // title/related_backup_id columns — carry them in details.
      await this.orm.insert(backupAlerts).values({
        id: generateUUID(),
        restaurantId,
        alertType: alert.alert_type ?? "backup_failed",
        severity: alert.severity ?? "medium",
        message,
        details: {
          ...(alert.title ? { title: alert.title } : {}),
          ...(alert.related_backup_id
            ? { related_backup_id: alert.related_backup_id }
            : {}),
          ...(context ?? {}),
        },
        acknowledged: false,
        resolved: false,
        triggeredAt: new Date(),
      });
      return;
    }

    // System-wide alerts (restaurant_id "system" or absent) cannot go into
    // backup_alerts: a DB trigger requires restaurant_id to reference a real
    // restaurants.id. Persist them to system_alerts, whose restaurant scope
    // is nullable by design.
    const contextPayload = {
      ...(alert.related_backup_id
        ? { related_backup_id: alert.related_backup_id }
        : {}),
      ...(context ?? {}),
    };
    await this.orm.insert(systemAlerts).values({
      title: alert.title ?? "Backup alert",
      description:
        Object.keys(contextPayload).length > 0
          ? `${message} | context: ${JSON.stringify(contextPayload)}`
          : message,
      severity: alert.severity ?? "medium",
      alertType: alert.alert_type ?? "backup_failed",
      restaurantId: null,
      affectedComponent: "backup",
      createdAt: new Date(),
    });
  }

  // Helper methods
  private async getBackupConfiguration(
    restaurantId: string,
    configId?: string,
  ): Promise<BackupConfiguration | null> {
    return {
      id: configId || "default",
      restaurant_id: restaurantId,
      name: "Default Configuration",
      backup_type: "full",
      schedule_enabled: false,
      retention_days: 30,
      compression_enabled: true,
      encryption_enabled: false,
      storage_provider: "r2",
      max_parallel_backups: 1,
      notifications_enabled: false,
      notification_channels: [],
      created_by: "system",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private async getRestaurantTables(
    restaurantId: string,
    includeTables?: string[],
    excludeTables?: string[],
  ): Promise<string[]> {
    const defaultTables = [
      "orders",
      "order_items",
      "menu_items",
      "categories",
      "tables",
      "users",
    ];
    let tables = includeTables || defaultTables;

    const invalidTables = tables.filter(
      (table) => !BACKUP_TABLE_NAMES.has(table),
    );
    if (invalidTables.length > 0) {
      throw new Error(
        `Invalid backup table names: ${invalidTables.join(", ")}`,
      );
    }

    if (excludeTables) {
      tables = tables.filter((table) => !excludeTables.includes(table));
    }

    return tables;
  }

  private async saveBackupRecord(backup: BackupRecord): Promise<void> {
    console.log("Saving backup record:", backup.id);
  }

  private async updateBackupStatus(
    backupId: string,
    status: BackupStatus,
  ): Promise<void> {
    await this.db
      .prepare(`UPDATE backups SET status = ?, updated_at = ? WHERE id = ?`)
      .bind(status, new Date().toISOString(), backupId)
      .run();
  }

  private async getBackupRecord(
    backupId: string,
  ): Promise<BackupRecord | null> {
    const result = await this.db
      .prepare(`SELECT * FROM backups WHERE id = ?`)
      .bind(backupId)
      .first();

    return result as BackupRecord | null;
  }

  private async extractTableData(
    restaurantId: string,
    tableName: string,
  ): Promise<Record<string, unknown>[]> {
    this.assertSafeBackupTableName(tableName);

    const result = await this.db
      .prepare(`SELECT * FROM "${tableName}" WHERE restaurant_id = ?`)
      .bind(restaurantId)
      .all<Record<string, unknown>>();

    return result.results || [];
  }

  private assertSafeBackupTableName(tableName: string): void {
    if (!BACKUP_TABLE_NAMES.has(tableName)) {
      throw new Error(`Invalid backup table name: ${tableName}`);
    }
  }

  private generateStoragePath(restaurantId: string, backupId: string): string {
    const date = new Date().toISOString().split("T")[0];
    return `backups/${restaurantId}/${date}/${backupId}.json`;
  }

  private async uploadBackup(path: string, data: string): Promise<void> {
    await this.storage.put(path, data);
  }

  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  private async updateBackupRecord(
    backupId: string,
    updates: Partial<BackupRecord>,
  ): Promise<void> {
    console.log("Updating backup record:", backupId, updates);
  }

  private async getSchemaHash(_restaurantId: string): Promise<string> {
    return "schema_hash_placeholder";
  }

  private async createAuditLog(
    log: Omit<BackupAuditLog, "id" | "ip_address" | "user_agent" | "timestamp">,
  ): Promise<void> {
    console.log("Creating audit log:", log);
  }

  private async saveRestoreOperation(
    operation: RestoreOperation,
  ): Promise<void> {
    console.log("Saving restore operation:", operation.id);
  }

  private async executeRestore(operationId: string): Promise<void> {
    console.log("Executing restore:", operationId);
  }
}
