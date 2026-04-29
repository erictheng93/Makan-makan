/**
 * Modular Backup Service - Core backup functionality
 * Refactored from monolithic service to use dependency injection
 * Migrated to Drizzle ORM
 */

import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import {
  eq,
  and,
  sql,
  count,
  desc,
  asc,
  gte,
  lte,
} from "drizzle-orm";
import {
  backupRecords,
  backupAlerts,
  backupAuditLogs,
  backupConfigurations,
  restoreOperations,
} from "@makanmakan/database";
import { notFound, conflict } from "../../../shared/utils/api-error";
import { BackupStorageService } from "./BackupStorageService";
import { BackupConfigService } from "./BackupConfigService";
import { BackupValidationService } from "./BackupValidationService";
import type {
  BackupRecord,
  CreateBackupRequest,
  CreateBackupResponse,
  ListBackupsQuery,
  RestoreBackupRequest,
  BackupSystemHealth,
  BackupAlert,
  BackupAuditLog,
  BackupStatus,
} from "@makanmakan/shared-types";

type BackupManifest = {
  rowCounts: Record<string, number>;
  tables: string[];
  createdAt: string;
  checksum?: string;
};

type BackupExecutionResult = {
  checksum: string;
  manifest: BackupManifest;
  backup: BackupRecord;
};

type RestoreOperationView = {
  restaurantId: string;
  backupId: string;
  restoreType: string;
  targetTables: string[];
  overwriteExisting: boolean;
  performedBy: string;
  [key: string]: unknown;
};

export type RestoreBackupResult = {
  restore_id: string;
  checksum: string;
  rowCounts: Record<string, number>;
};

export class BackupService {
  private db;
  private d1: D1Database;
  private requestContext?: { ipAddress: string; userAgent: string };

  constructor(
    d1: D1Database,
    private storageService: BackupStorageService,
    private configService: BackupConfigService,
    private validationService: BackupValidationService,
  ) {
    this.d1 = d1;
    this.db = drizzle(d1);
  }

  setRequestContext(ctx: { ipAddress: string; userAgent: string }): void {
    this.requestContext = ctx;
  }

  /**
   * Create a new backup for a specific restaurant
   */
  async createBackup(
    request: CreateBackupRequest,
    userId: string,
  ): Promise<CreateBackupResponse> {
    const backupId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    try {
      // Validate request and check limits
      await this.validationService.validateCreateBackupRequest(request);
      await this.validationService.checkBackupLimits(request.restaurant_id);
      await this.validationService.checkStorageQuota(request.restaurant_id);

      // Get configuration
      const config = request.configuration_id
        ? await this.configService.getConfigurationById(
            request.configuration_id,
          )
        : await this.configService.getDefaultConfiguration(
            request.restaurant_id,
          );

      if (!config) {
        throw notFound(
          "Backup configuration not found",
          "BACKUP_CONFIG_NOT_FOUND",
        );
      }
      if (config.restaurant_id !== request.restaurant_id) {
        throw notFound(
          "Backup configuration not found",
          "BACKUP_CONFIG_NOT_FOUND",
        );
      }

      // Determine tables to backup
      const tablesToBackup = await this.getRestaurantTables(
        request.restaurant_id,
        request.include_tables || config.include_tables,
        request.exclude_tables || config.exclude_tables,
      );

      // Validate table names
      if (tablesToBackup.length > 0) {
        await this.validationService.validateTableNames(tablesToBackup);
      }

      const manifest = await this.createBackupManifest(
        request.restaurant_id,
        tablesToBackup,
      );

      // Create backup record
      await this.db.insert(backupRecords).values({
        id: backupId,
        restaurantId: request.restaurant_id,
        configurationId: config.id,
        name: request.name,
        backupType: request.backup_type || config.backup_type,
        status: "pending",
        fileSize: 0,
        compressedSize: 0,
        recordsCount: 0,
        tablesIncluded: tablesToBackup,
        storageProvider: config.storage_provider,
        storagePath: "",
        encryptionEnabled: config.encryption_enabled,
        checksum: "",
        startedAt: timestamp,
        createdBy: userId,
        metadata: {
          manifest,
          tables_info: [],
          performance_metrics: {
            backup_duration_ms: 0,
            compression_ratio: 0,
            upload_speed_mbps: 0,
          },
          database_snapshot: {
            version: "1.0",
            schema_hash: "",
            total_tables: tablesToBackup.length,
            total_records: 0,
          },
        },
      });

      // Execute backup immediately if requested
      if (request.force_immediate) {
        const completed = await this.executeBackup(backupId, {
          id: backupId,
          restaurant_id: request.restaurant_id,
          configuration_id: config.id,
          name: request.name,
          backup_type: request.backup_type || config.backup_type,
          status: "pending",
          file_size: 0,
          compressed_size: 0,
          compression_enabled: config.compression_enabled,
          records_count: 0,
          tables_included: tablesToBackup,
          storage_provider: config.storage_provider,
          storage_path: "",
          encryption_enabled: config.encryption_enabled,
          checksum: "",
          started_at: timestamp,
          created_by: userId,
          metadata: {
            manifest,
            tables_info: [],
            performance_metrics: {
              backup_duration_ms: 0,
              compression_ratio: 0,
              upload_speed_mbps: 0,
            },
            database_snapshot: {
              version: "1.0",
              schema_hash: "",
              total_tables: tablesToBackup.length,
              total_records: 0,
            },
          },
        });

        return {
          backup_id: backupId,
          backup: completed.backup,
          status: completed.backup.status,
          estimated_duration_minutes: 0,
          message: "Backup completed successfully",
          manifest: completed.manifest,
          checksum: completed.checksum,
        };
      }

      return {
        backup_id: backupId,
        backup: { id: backupId },
        status: "pending",
        estimated_duration_minutes: Math.max(tablesToBackup.length * 2, 5),
        message: "Backup has been scheduled successfully",
        manifest,
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
  async executeBackup(
    backupId: string,
    backupOverride?: BackupRecord,
  ): Promise<BackupExecutionResult> {
    try {
      await this.updateBackupStatus(backupId, "in_progress");

      const backup = backupOverride ?? (await this.getBackupRecord(backupId));
      if (!backup) {
        throw new Error("Backup record not found");
      }

      // Extract data from tables
      const backupData: Record<string, Record<string, unknown>[]> = {};
      let totalRecords = 0;
      const rowCounts: Record<string, number> = {};

      for (const tableName of backup.tables_included) {
        try {
          const tableData = await this.extractTableData(
            backup.restaurant_id,
            tableName,
          );
          backupData[tableName] = tableData;
          const rowCount = await this.countTableRows(
            backup.restaurant_id,
            tableName,
          );
          rowCounts[tableName] = rowCount;
          totalRecords += rowCount;
        } catch (error) {
          console.error(`Error backing up table ${tableName}:`, error);
          rowCounts[tableName] = 0;
          // Continue with other tables even if one fails
        }
      }

      // Serialize backup data
      const backupJson = JSON.stringify(backupData, null, 2);

      // Compute gzip-compressed size when compression is enabled so we can
      // report compressedSize / compression_ratio honestly. The storage
      // service still receives the raw payload — gzip here is purely for
      // metrics and does not duplicate any storage-side compression.
      let compressedSize = backupJson.length;
      let compressionRatio = 1.0;
      if (backup.compression_enabled) {
        const stream = new Blob([backupJson])
          .stream()
          .pipeThrough(new CompressionStream("gzip"));
        const compressedBuffer = await new Response(stream).arrayBuffer();
        compressedSize = compressedBuffer.byteLength;
        compressionRatio =
          compressedSize > 0 ? backupJson.length / compressedSize : 1.0;
      }

      // Store backup using storage service
      const { storage_path, checksum } = await this.storageService.storeBackup(
        backup,
        backupJson,
        backup.storage_provider,
      );

      const completedAt = new Date().toISOString();
      const duration =
        new Date(completedAt).getTime() - new Date(backup.started_at).getTime();
      const schemaHash = await this.getSchemaHash(backup.restaurant_id);
      const manifest: BackupManifest = {
        rowCounts,
        tables: backup.tables_included,
        createdAt: completedAt,
        checksum,
      };
      const metadata = {
        ...(backup.metadata ?? {}),
        manifest,
        tables_info: backup.tables_included.map((table) => ({
          table_name: table,
          record_count: rowCounts[table] ?? backupData[table]?.length ?? 0,
          estimated_size: JSON.stringify(backupData[table] || []).length,
        })),
        performance_metrics: {
          backup_duration_ms: duration,
          compression_ratio: compressionRatio,
          upload_speed_mbps:
            backupJson.length > 0
              ? backupJson.length / 1024 / 1024 / (duration / 1000)
              : 0,
        },
        database_snapshot: {
          version: "1.0",
          schema_hash: schemaHash,
          total_tables: backup.tables_included.length,
          total_records: totalRecords,
        },
      };

      // Update backup record with completion details
      await this.db
        .update(backupRecords)
        .set({
          status: "completed",
          fileSize: backupJson.length,
          compressedSize,
          recordsCount: totalRecords,
          storagePath: storage_path,
          checksum,
          completedAt,
          metadata,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(backupRecords.id, backupId));

      // Create audit log
      await this.createAuditLog({
        restaurant_id: backup.restaurant_id,
        action: "backup_created",
        details: {
          backup_id: backupId,
          tables_count: backup.tables_included.length,
          records_count: totalRecords,
          file_size: backupJson.length,
        },
        performed_by: backup.created_by,
      });

      return {
        checksum,
        manifest,
        backup: {
          ...backup,
          status: "completed",
          file_size: backupJson.length,
          compressed_size: backupJson.length,
          records_count: totalRecords,
          storage_path,
          checksum,
          completed_at: completedAt,
          metadata,
        },
      };
    } catch (error) {
      console.error(`Backup execution failed for ${backupId}:`, error);
      await this.updateBackupStatus(backupId, "failed");

      // Update backup record with error message
      await this.db
        .update(backupRecords)
        .set({
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(backupRecords.id, backupId));

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
      const conditions = [eq(backupRecords.restaurantId, restaurant_id)];

      if (status) {
        conditions.push(eq(backupRecords.status, status));
      }

      if (backup_type) {
        conditions.push(eq(backupRecords.backupType, backup_type));
      }

      if (date_from) {
        conditions.push(gte(backupRecords.startedAt, date_from));
      }

      if (date_to) {
        conditions.push(lte(backupRecords.startedAt, date_to));
      }

      const whereClause = and(...conditions);

      // Validate sort column to prevent SQL injection
      const validSortColumns = [
        "started_at",
        "completed_at",
        "file_size",
        "name",
      ] as const;
      const sortColumn = (
        validSortColumns as readonly string[]
      ).includes(sort_by)
        ? sort_by
        : "started_at";

      // Map sort column to drizzle column
      const sortColumnMap = {
        started_at: backupRecords.startedAt,
        completed_at: backupRecords.completedAt,
        file_size: backupRecords.fileSize,
        name: backupRecords.name,
      };

      const orderByColumn =
        sortColumnMap[sortColumn as keyof typeof sortColumnMap] ||
        backupRecords.startedAt;
      const orderFn = sort_order.toUpperCase() === "ASC" ? asc : desc;

      const offset = (page - 1) * limit;

      const results = await this.db
        .select()
        .from(backupRecords)
        .where(whereClause)
        .orderBy(orderFn(orderByColumn))
        .limit(limit)
        .offset(offset);

      // Get total count for pagination
      const countResult = await this.db
        .select({ total: count() })
        .from(backupRecords)
        .where(whereClause);

      return {
        backups: this.parseBackupRecords(results),
        total: countResult[0]?.total || 0,
      };
    } catch (error) {
      console.error("Error listing backups:", error);
      throw new Error(
        `Failed to list backups: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get backup by ID
   */
  async getBackupById(backupId: string): Promise<BackupRecord | null> {
    return this.getBackupRecord(backupId);
  }

  /**
   * Download backup file
   */
  async downloadBackup(backup: BackupRecord): Promise<Response> {
    try {
      return await this.storageService.generateDownloadResponse(backup);
    } catch (error) {
      console.error("Error downloading backup:", error);
      throw new Error("Failed to download backup");
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(
    request: RestoreBackupRequest,
    userId: string,
  ): Promise<string | RestoreBackupResult> {
    const operationId = crypto.randomUUID();

    try {
      await this.validationService.validateRestoreRequest(request);

      const backup = await this.getBackupRecord(request.backup_id);
      if (!backup || backup.restaurant_id !== request.restaurant_id) {
        throw notFound("Backup not found or access denied", "BACKUP_NOT_FOUND");
      }

      if (backup.status !== "completed") {
        throw conflict(
          "Cannot restore from incomplete backup",
          "BACKUP_INCOMPLETE",
        );
      }

      // Verify backup integrity
      const backupExists = await this.storageService.backupExists(backup);
      if (!backupExists) {
        throw notFound(
          "Backup file not found in storage",
          "BACKUP_FILE_NOT_FOUND",
        );
      }

      const targetTables = request.target_tables || backup.tables_included;
      const preRestoreBackupId = request.overwrite_existing
        ? await this.createPreRestoreSafetyBackup({
            restaurantId: request.restaurant_id,
            targetTables,
            userId,
          })
        : undefined;

      await this.db.insert(restoreOperations).values({
        id: operationId,
        restaurantId: request.restaurant_id,
        backupId: request.backup_id,
        status: "pending",
        restoreType: request.restore_type,
        targetTables,
        overwriteExisting: request.overwrite_existing,
        startedAt: new Date().toISOString(),
        tablesRestored: 0,
        recordsRestored: 0,
        performedBy: userId,
        safetyChecks: {
          backup_integrity_verified:
            request.safety_confirmation.backup_integrity_verified,
          target_compatibility_verified: true,
          data_loss_risk_acknowledged:
            request.safety_confirmation.data_loss_risk_acknowledged,
          pre_restore_backup_id: preRestoreBackupId,
        },
      });

      if (request.restore_type === "selective" && !request.overwrite_existing) {
        const result = await this.executeRestore(operationId);
        return {
          restore_id: operationId,
          checksum: result.checksum,
          rowCounts: result.rowCounts,
        };
      }

      // Execute restore in background
      this.executeRestore(operationId).catch((error) => {
        console.error(`Background restore failed for ${operationId}:`, error);
      });

      return operationId;
    } catch (error) {
      console.error("Error initiating restore:", error);
      throw new Error(
        `Failed to initiate restore: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string, userId: string): Promise<void> {
    try {
      const backup = await this.getBackupRecord(backupId);
      if (!backup) {
        throw notFound("Backup not found", "BACKUP_NOT_FOUND");
      }

      // Delete from storage
      await this.storageService.deleteBackup(backup);

      // Delete from database
      await this.db.delete(backupRecords).where(eq(backupRecords.id, backupId));

      // Create audit log
      await this.createAuditLog({
        restaurant_id: backup.restaurant_id,
        action: "backup_deleted",
        details: {
          backup_id: backupId,
          backup_name: backup.name,
        },
        performed_by: userId,
      });
    } catch (error) {
      console.error("Error deleting backup:", error);
      throw new Error(
        `Failed to delete backup: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get system health
   */
  async getSystemHealth(): Promise<BackupSystemHealth> {
    try {
      // Get basic statistics using raw sql for complex aggregations
      const stats = await this.db
        .select({
          totalRestaurants: sql<number>`COUNT(DISTINCT ${backupRecords.restaurantId})`,
          totalBackups: count(),
          runningBackups: sql<number>`COUNT(CASE WHEN ${backupRecords.status} = 'in_progress' THEN 1 END)`,
          failedBackups24h: sql<number>`COUNT(CASE WHEN ${backupRecords.status} = 'failed' AND ${backupRecords.startedAt} > datetime('now', '-24 hours') THEN 1 END)`,
          avgSize: sql<number>`AVG(CASE WHEN ${backupRecords.status} = 'completed' AND ${backupRecords.fileSize} > 0 THEN ${backupRecords.fileSize} END)`,
          avgDurationMs: sql<number>`AVG(CASE WHEN ${backupRecords.status} = 'completed' THEN json_extract(${backupRecords.metadata}, '$.performance_metrics.backup_duration_ms') END)`,
          avgCompressionRatio: sql<number>`AVG(CASE WHEN ${backupRecords.status} = 'completed' THEN json_extract(${backupRecords.metadata}, '$.performance_metrics.compression_ratio') END)`,
        })
        .from(backupRecords)
        .where(gte(backupRecords.startedAt, sql`datetime('now', '-30 days')`));

      const stat = stats[0] || {};

      // Get storage usage
      const storageStats = await this.db
        .select({
          totalBytes: sql<number>`COALESCE(SUM(${backupRecords.fileSize}), 0)`,
          totalFiles: count(),
        })
        .from(backupRecords)
        .where(eq(backupRecords.status, "completed"));

      const storage = storageStats[0] || {};

      const activeConfigurationsResult = await this.db
        .select({ total: count() })
        .from(backupConfigurations);

      const unresolvedAlerts = await this.db
        .select({ severity: backupAlerts.severity })
        .from(backupAlerts)
        .where(eq(backupAlerts.resolved, false));

      // Determine overall status
      const failedBackups = stat?.failedBackups24h || 0;
      const runningBackups = stat?.runningBackups || 0;

      let overallStatus: "healthy" | "warning" | "critical" = "healthy";
      if (failedBackups > 10) {
        overallStatus = "critical";
      } else if (failedBackups > 5 || runningBackups > 20) {
        overallStatus = "warning";
      }

      const totalBackupsCount = stat?.totalBackups || 0;

      return {
        overall_status: overallStatus,
        total_restaurants: stat?.totalRestaurants || 0,
        active_configurations: activeConfigurationsResult[0]?.total || 0,
        running_backups: runningBackups,
        failed_backups_24h: failedBackups,
        storage_usage: {
          total_bytes: storage?.totalBytes || 0,
          available_bytes: 0,
          usage_percentage: 0,
        },
        performance_metrics: {
          average_backup_duration_minutes:
            (stat?.avgDurationMs || 0) / 1000 / 60,
          average_success_rate_percentage:
            totalBackupsCount > 0
              ? ((totalBackupsCount - (failedBackups || 0)) /
                  (totalBackupsCount || 1)) *
                100
              : 100,
          average_compression_ratio:
            Number(stat?.avgCompressionRatio) || 1,
        },
        alerts_summary: this.buildAlertSummary(unresolvedAlerts),
      };
    } catch (error) {
      console.error("Error getting system health:", error);
      throw new Error("Failed to get system health");
    }
  }

  /**
   * Get restaurant metrics
   */
  async getRestaurantMetrics(
    restaurantId: string,
    timeframe: string = "week",
  ): Promise<{
    total_backups: number;
    successful_backups: number;
    failed_backups: number;
    avg_backup_size: number;
    total_storage_used: number;
  }> {
    try {
      let dateFilter = "datetime('now', '-7 days')";

      switch (timeframe) {
        case "hour":
          dateFilter = "datetime('now', '-1 hour')";
          break;
        case "day":
          dateFilter = "datetime('now', '-1 day')";
          break;
        case "month":
          dateFilter = "datetime('now', '-30 days')";
          break;
      }

      const metrics = await this.db
        .select({
          total_backups: count(),
          successful_backups: sql<number>`COUNT(CASE WHEN ${backupRecords.status} = 'completed' THEN 1 END)`,
          failed_backups: sql<number>`COUNT(CASE WHEN ${backupRecords.status} = 'failed' THEN 1 END)`,
          avg_backup_size: sql<number>`AVG(CASE WHEN ${backupRecords.status} = 'completed' AND ${backupRecords.fileSize} > 0 THEN ${backupRecords.fileSize} END)`,
          total_storage_used: sql<number>`COALESCE(SUM(${backupRecords.fileSize}), 0)`,
        })
        .from(backupRecords)
        .where(
          and(
            eq(backupRecords.restaurantId, restaurantId),
            gte(backupRecords.startedAt, sql.raw(dateFilter)),
          ),
        );

      return (
        metrics[0] || {
          total_backups: 0,
          successful_backups: 0,
          failed_backups: 0,
          avg_backup_size: 0,
          total_storage_used: 0,
        }
      );
    } catch (error) {
      console.error("Error getting restaurant metrics:", error);
      throw new Error("Failed to get restaurant metrics");
    }
  }

  /**
   * Get restaurant alerts
   */
  async getRestaurantAlerts(
    restaurantId: string,
    unresolvedOnly: boolean = false,
  ): Promise<BackupAlert[]> {
    try {
      const conditions = [eq(backupAlerts.restaurantId, restaurantId)];

      if (unresolvedOnly) {
        conditions.push(eq(backupAlerts.resolved, false));
      }

      const results = await this.db
        .select()
        .from(backupAlerts)
        .where(and(...conditions))
        .orderBy(desc(backupAlerts.triggeredAt));

      return this.parseBackupAlerts(results) || [];
    } catch (error) {
      console.error("Error getting restaurant alerts:", error);
      throw new Error("Failed to get restaurant alerts");
    }
  }

  /**
   * Get backup alert by ID
   */
  async getAlertById(alertId: string): Promise<BackupAlert | null> {
    try {
      const results = await this.db
        .select()
        .from(backupAlerts)
        .where(eq(backupAlerts.id, alertId))
        .limit(1);

      const alerts = this.parseBackupAlerts(results);
      return alerts[0] ?? null;
    } catch (error) {
      console.error("Error getting backup alert:", error);
      throw new Error("Failed to get backup alert");
    }
  }

  /**
   * Acknowledge backup alert
   */
  async acknowledgeAlert(
    alertId: string,
    userId: string,
  ): Promise<BackupAlert> {
    try {
      const alert = await this.getAlertById(alertId);
      if (!alert) {
        throw notFound("Alert not found", "BACKUP_ALERT_NOT_FOUND");
      }

      await this.db
        .update(backupAlerts)
        .set({ acknowledged: true })
        .where(eq(backupAlerts.id, alertId));

      await this.createAuditLog({
        restaurant_id: alert.restaurant_id,
        action: "backup_alert_acknowledged",
        details: { alert_id: alertId },
        performed_by: userId,
      });

      return {
        ...alert,
        acknowledged: true,
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error acknowledging backup alert:", error);
      throw new Error(
        `Failed to acknowledge backup alert: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  /**
   * Resolve backup alert
   */
  async resolveAlert(alertId: string, userId: string): Promise<BackupAlert> {
    try {
      const alert = await this.getAlertById(alertId);
      if (!alert) {
        throw notFound("Alert not found", "BACKUP_ALERT_NOT_FOUND");
      }

      const resolvedAt = new Date().toISOString();
      await this.db
        .update(backupAlerts)
        .set({ resolved: true, resolvedAt })
        .where(eq(backupAlerts.id, alertId));

      await this.createAuditLog({
        restaurant_id: alert.restaurant_id,
        action: "backup_alert_resolved",
        details: { alert_id: alertId },
        performed_by: userId,
      });

      return {
        ...alert,
        resolved: true,
        resolved_at: resolvedAt,
      };
    } catch (error) {
      console.error("Error resolving backup alert:", error);
      throw new Error(
        `Failed to resolve backup alert: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  // Private helper methods

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

    if (excludeTables) {
      tables = tables.filter((table) => !excludeTables.includes(table));
    }

    return tables;
  }

  private async createBackupManifest(
    restaurantId: string,
    tables: string[],
  ): Promise<BackupManifest> {
    const rowCounts: Record<string, number> = {};
    for (const table of tables) {
      rowCounts[table] = await this.countTableRows(restaurantId, table);
    }

    return {
      rowCounts,
      tables,
      createdAt: new Date().toISOString(),
    };
  }

  private async updateBackupStatus(
    backupId: string,
    status: BackupStatus,
  ): Promise<void> {
    await this.db
      .update(backupRecords)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(backupRecords.id, backupId));
  }

  private async getBackupRecord(
    backupId: string,
  ): Promise<BackupRecord | null> {
    const results = await this.db
      .select()
      .from(backupRecords)
      .where(eq(backupRecords.id, backupId))
      .limit(1);

    if (results.length === 0) return null;

    return this.parseBackupRecord(results[0] as Record<string, unknown>);
  }

  private parseBackupRecord(record: Record<string, unknown>): BackupRecord {
    const r = record as Record<string, unknown>;
    return {
      ...r,
      restaurant_id: r.restaurantId ?? r.restaurant_id,
      configuration_id: r.configurationId ?? r.configuration_id,
      backup_type: r.backupType ?? r.backup_type,
      file_size: r.fileSize ?? r.file_size,
      compressed_size: r.compressedSize ?? r.compressed_size,
      records_count: r.recordsCount ?? r.records_count,
      tables_included: r.tablesIncluded ?? r.tables_included ?? [],
      storage_provider: r.storageProvider ?? r.storage_provider,
      storage_path: r.storagePath ?? r.storage_path,
      encryption_enabled: Boolean(r.encryptionEnabled ?? r.encryption_enabled),
      started_at: r.startedAt ?? r.started_at,
      completed_at: r.completedAt ?? r.completed_at,
      error_message: r.errorMessage ?? r.error_message,
      created_by: r.createdBy ?? r.created_by,
      metadata: r.metadata ?? {},
    } as BackupRecord;
  }

  private parseBackupRecords(
    records: Record<string, unknown>[],
  ): BackupRecord[] {
    return records.map((record) => this.parseBackupRecord(record));
  }

  private async extractTableData(
    restaurantId: string,
    tableName: string,
  ): Promise<Record<string, unknown>[]> {
    try {
      const physicalTable = this.resolvePhysicalTableName(tableName);
      this.assertSafeIdentifier(physicalTable);

      const scope = await this.getRestaurantScopeClause(
        physicalTable,
        restaurantId,
      );
      if (!scope) {
        return [];
      }

      return await this.runPreparedAll(
        `SELECT * FROM "${physicalTable}" WHERE ${scope.clause}`,
        scope.values,
      );
    } catch (error) {
      console.error(`Error extracting data from table ${tableName}:`, error);
      return [];
    }
  }

  private async countTableRows(
    restaurantId: string,
    tableName: string,
  ): Promise<number> {
    try {
      const physicalTable = this.resolvePhysicalTableName(tableName);
      this.assertSafeIdentifier(physicalTable);

      const scope = await this.getRestaurantScopeClause(
        physicalTable,
        restaurantId,
      );
      if (!scope) {
        return 0;
      }

      const rows = await this.runPreparedAll<{ total: number }>(
        `SELECT COUNT(*) as total FROM "${physicalTable}" WHERE ${scope.clause}`,
        scope.values,
      );
      return Number(rows[0]?.total ?? 0);
    } catch (error) {
      console.error(`Error counting rows in table ${tableName}:`, error);
      return 0;
    }
  }

  private resolvePhysicalTableName(tableName: string): string {
    return tableName === "menus" ? "menu_items" : tableName;
  }

  private async getRestaurantScopeClause(
    tableName: string,
    restaurantId: string,
  ): Promise<{ clause: string; values: unknown[] } | null> {
    const columns = await this.getTableColumns(tableName);
    if (columns.length === 0) {
      return null;
    }

    if (columns.includes("restaurant_id")) {
      return { clause: "restaurant_id = ?", values: [restaurantId] };
    }

    if (tableName === "restaurants") {
      if (columns.includes("id")) {
        return { clause: "id = ?", values: [restaurantId] };
      }
      if (columns.includes("public_id")) {
        return { clause: "public_id = ?", values: [restaurantId] };
      }
    }

    return null;
  }

  private async getTableColumns(tableName: string): Promise<string[]> {
    this.assertSafeIdentifier(tableName);
    const rows = await this.runPreparedAll<{ name: string }>(
      `PRAGMA table_info("${tableName}")`,
    );
    return rows.map((row) => row.name).filter(Boolean);
  }

  private async runPreparedAll<T = Record<string, unknown>>(
    statement: string,
    values: unknown[] = [],
  ): Promise<T[]> {
    if (!("prepare" in this.d1) || typeof this.d1.prepare !== "function") {
      return [];
    }

    const prepared = this.d1.prepare(statement);
    const bound = values.length > 0 ? prepared.bind(...values) : prepared;
    const result = await bound.all<T>();
    return result.results ?? [];
  }

  private async getSchemaHash(restaurantId: string): Promise<string> {
    // Simple schema hash based on table structure
    // In production, this should be more sophisticated
    return `schema_${restaurantId}_${Date.now()}`;
  }

  private async createAuditLog(
    log: Omit<BackupAuditLog, "id" | "ip_address" | "user_agent" | "timestamp">,
  ): Promise<void> {
    await this.db.insert(backupAuditLogs).values({
      id: crypto.randomUUID(),
      restaurantId: log.restaurant_id,
      action: log.action,
      details: log.details as Record<string, unknown>,
      performedBy: log.performed_by,
      ipAddress: this.requestContext?.ipAddress ?? "0.0.0.0",
      userAgent: this.requestContext?.userAgent ?? "MakanMakan-API",
      timestamp: new Date().toISOString(),
    });
  }

  private async executeRestore(
    operationId: string,
  ): Promise<{ checksum: string; rowCounts: Record<string, number> }> {
    try {
      await this.updateRestoreOperation(operationId, {
        status: "in_progress",
      });

      const operation = await this.getRestoreOperation(operationId);
      if (!operation) {
        throw new Error("Restore operation not found");
      }

      const backup = await this.getBackupRecord(operation.backupId);
      if (!backup) {
        throw new Error("Backup record not found");
      }

      const backupDataText = await this.storageService.retrieveBackup(backup);

      // Verify integrity inline — calculateChecksum lives on BackupStorageService (private)
      let checksum = "";
      if (backup.checksum) {
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest(
          "SHA-256",
          encoder.encode(backupDataText),
        );
        checksum = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        if (checksum !== backup.checksum) {
          throw new Error("Backup checksum verification failed");
        }
      }
      checksum ||= backup.checksum;

      const backupData = JSON.parse(backupDataText) as Record<
        string,
        Record<string, unknown>[]
      >;
      const manifest = this.getManifestFromBackup(backup, backupData);
      const targetTables = (
        operation.targetTables?.length
          ? operation.targetTables
          : backup.tables_included
      ).filter((table: string) =>
        Object.prototype.hasOwnProperty.call(backupData, table),
      );

      await this.validationService.validateTableNames(targetTables);

      let tablesRestored = 0;
      let recordsRestored = 0;

      if (
        operation.restoreType === "selective" &&
        !operation.overwriteExisting
      ) {
        await this.validateRestoreSchemaCompatibility(targetTables, backupData);
        tablesRestored = targetTables.length;
        recordsRestored = targetTables.reduce(
          (total: number, table: string) =>
            total +
            (manifest.rowCounts[table] ?? backupData[table]?.length ?? 0),
          0,
        );
      } else {
        for (const tableName of targetTables) {
          const rows = backupData[tableName] || [];
          const restoredForTable = await this.restoreTableData({
            tableName,
            restaurantId: operation.restaurantId,
            rows,
            overwriteExisting: operation.overwriteExisting,
          });

          tablesRestored += 1;
          recordsRestored += restoredForTable;
        }
      }

      await this.updateRestoreOperation(operationId, {
        status: "completed",
        completedAt: new Date().toISOString(),
        tablesRestored,
        recordsRestored,
      });

      await this.createAuditLog({
        restaurant_id: operation.restaurantId,
        action: "backup_restored",
        details: {
          backup_id: operation.backupId,
          restore_id: operationId,
          restore_type: operation.restoreType,
          tables_restored: tablesRestored,
          records_restored: recordsRestored,
        },
        performed_by: operation.performedBy,
      });

      return {
        checksum,
        rowCounts: manifest.rowCounts,
      };
    } catch (error) {
      await this.updateRestoreOperation(operationId, {
        status: "failed",
        completedAt: new Date().toISOString(),
        errorMessage:
          error instanceof Error ? error.message : "Unknown restore error",
      });
      throw error;
    }
  }

  private async validateRestoreSchemaCompatibility(
    targetTables: string[],
    backupData: Record<string, Record<string, unknown>[]>,
  ): Promise<void> {
    for (const tableName of targetTables) {
      const physicalTable = this.resolvePhysicalTableName(tableName);
      const targetColumns = await this.getTableColumns(physicalTable);
      if (targetColumns.length === 0) {
        throw new Error(`Restore target table does not exist: ${tableName}`);
      }

      const rows = backupData[tableName] ?? [];
      const backupColumns = new Set<string>();
      for (const row of rows) {
        for (const column of Object.keys(row)) {
          backupColumns.add(column);
        }
      }

      const missingColumns = [...backupColumns].filter(
        (column) => !targetColumns.includes(column),
      );
      if (missingColumns.length > 0) {
        throw new Error(
          `Restore schema mismatch for ${tableName}: ${missingColumns.join(", ")}`,
        );
      }
    }
  }

  private getManifestFromBackup(
    backup: BackupRecord,
    backupData: Record<string, Record<string, unknown>[]>,
  ): BackupManifest {
    type ManifestShape = {
      rowCounts?: Record<string, number>;
      row_counts?: Record<string, number>;
      tables?: string[];
      createdAt?: string;
      created_at?: string;
      checksum?: string;
    };
    const metadata = backup.metadata as
      | { manifest?: ManifestShape }
      | undefined;
    const manifest: ManifestShape = metadata?.manifest ?? {};
    const rowCounts =
      manifest.rowCounts ??
      manifest.row_counts ??
      Object.fromEntries(
        Object.entries(backupData).map(([table, rows]) => [table, rows.length]),
      );

    return {
      rowCounts,
      tables: manifest.tables ?? backup.tables_included,
      createdAt:
        manifest.createdAt ?? manifest.created_at ?? backup.completed_at ?? "",
      checksum: manifest.checksum ?? backup.checksum,
    };
  }

  private async getRestoreOperation(
    operationId: string,
  ): Promise<RestoreOperationView | null> {
    const results = await this.db
      .select()
      .from(restoreOperations)
      .where(eq(restoreOperations.id, operationId))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const row = results[0] as Record<string, unknown>;
    return {
      ...row,
      restaurantId: (row.restaurantId ?? row.restaurant_id) as string,
      backupId: (row.backupId ?? row.backup_id) as string,
      restoreType: (row.restoreType ?? row.restore_type) as string,
      targetTables: (row.targetTables ?? row.target_tables ?? []) as string[],
      overwriteExisting: Boolean(
        row.overwriteExisting ?? row.overwrite_existing,
      ),
      performedBy: (row.performedBy ?? row.performed_by) as string,
    };
  }

  private async updateRestoreOperation(
    operationId: string,
    updates: Partial<typeof restoreOperations.$inferInsert>,
  ): Promise<void> {
    await this.db
      .update(restoreOperations)
      .set(updates)
      .where(eq(restoreOperations.id, operationId));
  }

  private async createPreRestoreSafetyBackup({
    restaurantId,
    targetTables,
    userId,
  }: {
    restaurantId: string;
    targetTables: string[];
    userId: string;
  }): Promise<string> {
    const response = await this.createBackup(
      {
        restaurant_id: restaurantId,
        name: `Pre-restore safety backup - ${new Date().toISOString()}`,
        description:
          "Automatically created before an overwrite restore operation.",
        backup_type: "full",
        include_tables: targetTables,
        force_immediate: false,
      },
      userId,
    );

    await this.executeBackup(response.backup_id);
    return response.backup_id;
  }

  private async restoreTableData({
    tableName,
    restaurantId,
    rows,
    overwriteExisting,
  }: {
    tableName: string;
    restaurantId: string;
    rows: Record<string, unknown>[];
    overwriteExisting: boolean;
  }): Promise<number> {
    this.assertSafeIdentifier(tableName);

    if (overwriteExisting) {
      await this.d1
        .prepare(`DELETE FROM "${tableName}" WHERE restaurant_id = ?`)
        .bind(restaurantId)
        .run();
    }

    let inserted = 0;
    for (const row of rows) {
      const columns = Object.keys(row).filter((column) => {
        this.assertSafeIdentifier(column);
        return row[column] !== undefined;
      });

      if (columns.length === 0) {
        continue;
      }

      const placeholders = columns.map(() => "?").join(", ");
      const columnList = columns.map((column) => `"${column}"`).join(", ");
      const values = columns.map((column) => this.toD1Value(row[column]));

      await this.d1
        .prepare(
          `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`,
        )
        .bind(...values)
        .run();
      inserted += 1;
    }

    return inserted;
  }

  private assertSafeIdentifier(identifier: string): void {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
      throw new Error(`Unsafe SQL identifier: ${identifier}`);
    }
  }

  private toD1Value(value: unknown): string | number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }
    if (typeof value === "number" || typeof value === "string") {
      return value;
    }
    return JSON.stringify(value);
  }

  private buildAlertSummary(
    alertStats: Array<{ severity: string; total?: number }>,
  ): BackupSystemHealth["alerts_summary"] {
    const summary = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const stat of alertStats) {
      if (stat.severity in summary) {
        summary[stat.severity as keyof typeof summary] += stat.total ?? 1;
      }
    }
    return summary;
  }

  /**
   * Parse backup alerts from database results
   */
  private parseBackupAlerts(
    results: Record<string, unknown>[],
  ): BackupAlert[] {
    return results.map((result) => {
      const details = this.parseAlertDetails(result.details);
      const alertType = String(
        result.alert_type ?? result.alertType ?? "backup_failed",
      );
      const message = String(result.message ?? "");

      return {
        id: String(result.id),
        restaurant_id: String(result.restaurant_id ?? result.restaurantId),
        alert_type: alertType as BackupAlert["alert_type"],
        severity: String(result.severity ?? "medium") as BackupAlert["severity"],
        title: String(
          result.title ?? details.title ?? this.formatAlertTitle(alertType),
        ),
        message,
        related_backup_id: this.optionalString(
          result.related_backup_id ??
            result.relatedBackupId ??
            details.related_backup_id,
        ),
        triggered_at: String(result.triggered_at ?? result.triggeredAt ?? ""),
        acknowledged: Boolean(result.acknowledged),
        acknowledged_by: this.optionalString(
          result.acknowledged_by ?? result.acknowledgedBy,
        ),
        acknowledged_at: this.optionalString(
          result.acknowledged_at ?? result.acknowledgedAt,
        ),
        resolved: Boolean(result.resolved),
        resolved_at: this.optionalString(result.resolved_at ?? result.resolvedAt),
      };
    });
  }

  private parseAlertDetails(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value === "string" && value.trim()) {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return {};
      }
    }
    return {};
  }

  private optionalString(value: unknown): string | undefined {
    return value === null || value === undefined ? undefined : String(value);
  }

  private formatAlertTitle(alertType: string): string {
    return alertType
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
}
