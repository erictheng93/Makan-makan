/**
 * Modular Backup Service - Core backup functionality
 * Refactored from monolithic service to use dependency injection
 * Migrated to Drizzle ORM
 */

import type { D1Database } from '@cloudflare/workers-types'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, sql, count, desc, asc, gte, lte, sum, avg } from 'drizzle-orm'
import {
  backupRecords,
  backupAlerts,
  backupAuditLogs,
  restoreOperations
} from '@makanmakan/database'
import { notFound, conflict } from '../../../shared/utils/api-error'
import { BackupStorageService } from './BackupStorageService'
import { BackupConfigService } from './BackupConfigService'
import { BackupValidationService } from './BackupValidationService'
import type {
  BackupRecord,
  RestoreOperation,
  CreateBackupRequest,
  CreateBackupResponse,
  ListBackupsQuery,
  RestoreBackupRequest,
  BackupSystemHealth,
  BackupAlert,
  BackupAuditLog,
  BackupStatus
} from '@makanmakan/shared-types'

export class BackupService {
  private db;
  private requestContext?: { ipAddress: string; userAgent: string };

  constructor(
    d1: D1Database,
    private storageService: BackupStorageService,
    private configService: BackupConfigService,
    private validationService: BackupValidationService
  ) {
    this.db = drizzle(d1);
  }

  setRequestContext(ctx: { ipAddress: string; userAgent: string }): void {
    this.requestContext = ctx;
  }

  /**
   * Create a new backup for a specific restaurant
   */
  async createBackup(request: CreateBackupRequest, userId: string): Promise<CreateBackupResponse> {
    const backupId = crypto.randomUUID()
    const timestamp = new Date().toISOString()

    try {
      // Validate request and check limits
      await this.validationService.validateCreateBackupRequest(request)
      await this.validationService.checkBackupLimits(request.restaurant_id)
      await this.validationService.checkStorageQuota(request.restaurant_id)

      // Get configuration
      const config = request.configuration_id
        ? await this.configService.getConfigurationById(request.configuration_id)
        : await this.configService.getDefaultConfiguration(request.restaurant_id)

      if (!config) {
        throw notFound('Backup configuration not found', 'BACKUP_CONFIG_NOT_FOUND')
      }

      // Determine tables to backup
      const tablesToBackup = await this.getRestaurantTables(
        request.restaurant_id,
        request.include_tables || config.include_tables,
        request.exclude_tables || config.exclude_tables
      )

      // Validate table names
      if (tablesToBackup.length > 0) {
        await this.validationService.validateTableNames(tablesToBackup)
      }

      // Create backup record
      await this.db.insert(backupRecords).values({
        id: backupId,
        restaurantId: request.restaurant_id,
        configurationId: config.id,
        name: request.name,
        backupType: request.backup_type || config.backup_type,
        status: 'pending',
        fileSize: 0,
        compressedSize: 0,
        recordsCount: 0,
        tablesIncluded: tablesToBackup,
        storageProvider: config.storage_provider,
        storagePath: '',
        encryptionEnabled: config.encryption_enabled,
        checksum: '',
        startedAt: timestamp,
        createdBy: userId,
        metadata: {
          tables_info: [],
          performance_metrics: {
            backup_duration_ms: 0,
            compression_ratio: 0,
            upload_speed_mbps: 0
          },
          database_snapshot: {
            version: '1.0',
            schema_hash: '',
            total_tables: tablesToBackup.length,
            total_records: 0
          }
        }
      })

      // Execute backup immediately if requested
      if (request.force_immediate) {
        this.executeBackup(backupId).catch(error => {
          console.error(`Background backup failed for ${backupId}:`, error)
        })
      }

      return {
        backup_id: backupId,
        status: 'pending',
        estimated_duration_minutes: Math.max(tablesToBackup.length * 2, 5),
        message: 'Backup has been scheduled successfully'
      }

    } catch (error) {
      console.error('Error creating backup:', error)
      throw new Error(`Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute the actual backup process
   */
  async executeBackup(backupId: string): Promise<void> {
    try {
      await this.updateBackupStatus(backupId, 'in_progress')

      const backup = await this.getBackupRecord(backupId)
      if (!backup) {
        throw new Error('Backup record not found')
      }

      // Extract data from tables
      const backupData: Record<string, any[]> = {}
      let totalRecords = 0

      for (const tableName of backup.tables_included) {
        try {
          const tableData = await this.extractTableData(backup.restaurant_id, tableName)
          backupData[tableName] = tableData
          totalRecords += tableData.length
        } catch (error) {
          console.error(`Error backing up table ${tableName}:`, error)
          // Continue with other tables even if one fails
        }
      }

      // Serialize backup data
      const backupJson = JSON.stringify(backupData, null, 2)

      // Store backup using storage service
      const { storage_path, checksum } = await this.storageService.storeBackup(
        backup,
        backupJson,
        backup.storage_provider
      )

      const completedAt = new Date().toISOString()
      const duration = new Date(completedAt).getTime() - new Date(backup.started_at).getTime()

      // Update backup record with completion details
      await this.db.update(backupRecords)
        .set({
          status: 'completed',
          fileSize: backupJson.length,
          compressedSize: backupJson.length, // TODO: Implement actual compression
          recordsCount: totalRecords,
          storagePath: storage_path,
          checksum,
          completedAt,
          metadata: {
            tables_info: backup.tables_included.map(table => ({
              table_name: table,
              record_count: backupData[table]?.length || 0,
              estimated_size: JSON.stringify(backupData[table] || []).length
            })),
            performance_metrics: {
              backup_duration_ms: duration,
              compression_ratio: 1.0, // TODO: Calculate actual compression ratio
              upload_speed_mbps: backupJson.length > 0 ? (backupJson.length / 1024 / 1024) / (duration / 1000) : 0
            },
            database_snapshot: {
              version: '1.0',
              schema_hash: await this.getSchemaHash(backup.restaurant_id),
              total_tables: backup.tables_included.length,
              total_records: totalRecords
            }
          },
          updatedAt: new Date().toISOString()
        })
        .where(eq(backupRecords.id, backupId))

      // Create audit log
      await this.createAuditLog({
        restaurant_id: backup.restaurant_id,
        action: 'backup_created',
        details: {
          backup_id: backupId,
          tables_count: backup.tables_included.length,
          records_count: totalRecords,
          file_size: backupJson.length
        },
        performed_by: backup.created_by
      })

    } catch (error) {
      console.error(`Backup execution failed for ${backupId}:`, error)
      await this.updateBackupStatus(backupId, 'failed')

      // Update backup record with error message
      await this.db.update(backupRecords)
        .set({
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .where(eq(backupRecords.id, backupId))

      throw error
    }
  }

  /**
   * List backups for a restaurant with filtering and pagination
   */
  async listBackups(query: ListBackupsQuery): Promise<{ backups: BackupRecord[], total: number }> {
    const {
      restaurant_id,
      status,
      backup_type,
      date_from,
      date_to,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = query

    try {
      const conditions = [eq(backupRecords.restaurantId, restaurant_id)]

      if (status) {
        conditions.push(eq(backupRecords.status, status))
      }

      if (backup_type) {
        conditions.push(eq(backupRecords.backupType, backup_type))
      }

      if (date_from) {
        conditions.push(gte(backupRecords.startedAt, date_from))
      }

      if (date_to) {
        conditions.push(lte(backupRecords.startedAt, date_to))
      }

      const whereClause = and(...conditions)

      // Validate sort column to prevent SQL injection
      const validSortColumns = ['started_at', 'completed_at', 'file_size', 'name'] as const
      const sortColumn = validSortColumns.includes(sort_by as any) ? sort_by : 'started_at'

      // Map sort column to drizzle column
      const sortColumnMap: Record<string, any> = {
        started_at: backupRecords.startedAt,
        completed_at: backupRecords.completedAt,
        file_size: backupRecords.fileSize,
        name: backupRecords.name
      }

      const orderByColumn = sortColumnMap[sortColumn] || backupRecords.startedAt
      const orderFn = sort_order.toUpperCase() === 'ASC' ? asc : desc

      const offset = (page - 1) * limit

      const results = await this.db.select()
        .from(backupRecords)
        .where(whereClause)
        .orderBy(orderFn(orderByColumn))
        .limit(limit)
        .offset(offset)

      // Get total count for pagination
      const countResult = await this.db.select({ total: count() })
        .from(backupRecords)
        .where(whereClause)

      return {
        backups: this.parseBackupRecords(results as any[]),
        total: countResult[0]?.total || 0
      }

    } catch (error) {
      console.error('Error listing backups:', error)
      throw new Error(`Failed to list backups: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get backup by ID
   */
  async getBackupById(backupId: string): Promise<BackupRecord | null> {
    return this.getBackupRecord(backupId)
  }

  /**
   * Download backup file
   */
  async downloadBackup(backup: BackupRecord): Promise<Response> {
    try {
      return await this.storageService.generateDownloadResponse(backup)
    } catch (error) {
      console.error('Error downloading backup:', error)
      throw new Error('Failed to download backup')
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(request: RestoreBackupRequest, userId: string): Promise<string> {
    const operationId = crypto.randomUUID()

    try {
      await this.validationService.validateRestoreRequest(request)

      const backup = await this.getBackupRecord(request.backup_id)
      if (!backup || backup.restaurant_id !== request.restaurant_id) {
        throw notFound('Backup not found or access denied', 'BACKUP_NOT_FOUND')
      }

      if (backup.status !== 'completed') {
        throw conflict('Cannot restore from incomplete backup', 'BACKUP_INCOMPLETE')
      }

      // Verify backup integrity
      const backupExists = await this.storageService.backupExists(backup)
      if (!backupExists) {
        throw notFound('Backup file not found in storage', 'BACKUP_FILE_NOT_FOUND')
      }

      await this.db.insert(restoreOperations).values({
        id: operationId,
        restaurantId: request.restaurant_id,
        backupId: request.backup_id,
        status: 'pending',
        restoreType: request.restore_type,
        targetTables: request.target_tables || backup.tables_included,
        overwriteExisting: request.overwrite_existing,
        startedAt: new Date().toISOString(),
        tablesRestored: 0,
        recordsRestored: 0,
        performedBy: userId,
        safetyChecks: {
          backup_integrity_verified: request.safety_confirmation.backup_integrity_verified,
          target_compatibility_verified: true,
          data_loss_risk_acknowledged: request.safety_confirmation.data_loss_risk_acknowledged
        }
      })

      // Execute restore in background
      this.executeRestore(operationId).catch(error => {
        console.error(`Background restore failed for ${operationId}:`, error)
      })

      return operationId

    } catch (error) {
      console.error('Error initiating restore:', error)
      throw new Error(`Failed to initiate restore: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string, userId: string): Promise<void> {
    try {
      const backup = await this.getBackupRecord(backupId)
      if (!backup) {
        throw notFound('Backup not found', 'BACKUP_NOT_FOUND')
      }

      // Delete from storage
      await this.storageService.deleteBackup(backup)

      // Delete from database
      await this.db.delete(backupRecords).where(eq(backupRecords.id, backupId))

      // Create audit log
      await this.createAuditLog({
        restaurant_id: backup.restaurant_id,
        action: 'backup_deleted',
        details: {
          backup_id: backupId,
          backup_name: backup.name
        },
        performed_by: userId
      })

    } catch (error) {
      console.error('Error deleting backup:', error)
      throw new Error(`Failed to delete backup: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get system health
   */
  async getSystemHealth(): Promise<BackupSystemHealth> {
    try {
      // Get basic statistics using raw sql for complex aggregations
      const stats = await this.db.select({
        totalRestaurants: sql<number>`COUNT(DISTINCT ${backupRecords.restaurantId})`,
        totalBackups: count(),
        runningBackups: sql<number>`COUNT(CASE WHEN ${backupRecords.status} = 'in_progress' THEN 1 END)`,
        failedBackups24h: sql<number>`COUNT(CASE WHEN ${backupRecords.status} = 'failed' AND ${backupRecords.startedAt} > datetime('now', '-24 hours') THEN 1 END)`,
        avgSize: sql<number>`AVG(CASE WHEN ${backupRecords.status} = 'completed' AND ${backupRecords.fileSize} > 0 THEN ${backupRecords.fileSize} END)`
      })
        .from(backupRecords)
        .where(gte(backupRecords.startedAt, sql`datetime('now', '-30 days')`))

      const stat = stats[0] || {}

      // Get storage usage
      const storageStats = await this.db.select({
        totalBytes: sql<number>`COALESCE(SUM(${backupRecords.fileSize}), 0)`,
        totalFiles: count()
      })
        .from(backupRecords)
        .where(eq(backupRecords.status, 'completed'))

      const storage = storageStats[0] || {}

      // Determine overall status
      const failedBackups = (stat as any)?.failedBackups24h || 0
      const runningBackups = (stat as any)?.runningBackups || 0

      let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy'
      if (failedBackups > 10) {
        overallStatus = 'critical'
      } else if (failedBackups > 5 || runningBackups > 20) {
        overallStatus = 'warning'
      }

      return {
        overall_status: overallStatus,
        total_restaurants: (stat as any)?.totalRestaurants || 0,
        active_configurations: 0, // TODO: Get from backup_configurations table
        running_backups: runningBackups,
        failed_backups_24h: failedBackups,
        storage_usage: {
          total_bytes: (storage as any)?.totalBytes || 0,
          available_bytes: 0, // TODO: Calculate from storage provider
          usage_percentage: 0 // TODO: Calculate based on quota
        },
        performance_metrics: {
          average_backup_duration_minutes: 0, // TODO: Calculate from metadata
          average_success_rate_percentage: 0, // TODO: Calculate from stats
          average_compression_ratio: 0.5
        },
        alerts_summary: {
          critical: 0, // TODO: Get from backup_alerts table
          high: 0,
          medium: 0,
          low: 0
        }
      }

    } catch (error) {
      console.error('Error getting system health:', error)
      throw new Error('Failed to get system health')
    }
  }

  /**
   * Get restaurant metrics
   */
  async getRestaurantMetrics(restaurantId: string, timeframe: string = 'week'): Promise<any> {
    try {
      let dateFilter = "datetime('now', '-7 days')"

      switch (timeframe) {
        case 'hour':
          dateFilter = "datetime('now', '-1 hour')"
          break
        case 'day':
          dateFilter = "datetime('now', '-1 day')"
          break
        case 'month':
          dateFilter = "datetime('now', '-30 days')"
          break
      }

      const metrics = await this.db.select({
        total_backups: count(),
        successful_backups: sql<number>`COUNT(CASE WHEN ${backupRecords.status} = 'completed' THEN 1 END)`,
        failed_backups: sql<number>`COUNT(CASE WHEN ${backupRecords.status} = 'failed' THEN 1 END)`,
        avg_backup_size: sql<number>`AVG(CASE WHEN ${backupRecords.status} = 'completed' AND ${backupRecords.fileSize} > 0 THEN ${backupRecords.fileSize} END)`,
        total_storage_used: sql<number>`COALESCE(SUM(${backupRecords.fileSize}), 0)`
      })
        .from(backupRecords)
        .where(and(
          eq(backupRecords.restaurantId, restaurantId),
          gte(backupRecords.startedAt, sql.raw(dateFilter))
        ))

      return metrics[0] || {
        total_backups: 0,
        successful_backups: 0,
        failed_backups: 0,
        avg_backup_size: 0,
        total_storage_used: 0
      }

    } catch (error) {
      console.error('Error getting restaurant metrics:', error)
      throw new Error('Failed to get restaurant metrics')
    }
  }

  /**
   * Get restaurant alerts
   */
  async getRestaurantAlerts(restaurantId: string, unresolvedOnly: boolean = false): Promise<BackupAlert[]> {
    try {
      const conditions = [eq(backupAlerts.restaurantId, restaurantId)]

      if (unresolvedOnly) {
        conditions.push(eq(backupAlerts.resolved, false))
      }

      const results = await this.db.select()
        .from(backupAlerts)
        .where(and(...conditions))
        .orderBy(desc(backupAlerts.triggeredAt))

      return this.parseBackupAlerts(results as any[]) || []

    } catch (error) {
      console.error('Error getting restaurant alerts:', error)
      throw new Error('Failed to get restaurant alerts')
    }
  }

  // Private helper methods

  private async getRestaurantTables(
    restaurantId: string,
    includeTables?: string[],
    excludeTables?: string[]
  ): Promise<string[]> {
    const defaultTables = ['orders', 'order_items', 'menu_items', 'categories', 'tables', 'users']
    let tables = includeTables || defaultTables

    if (excludeTables) {
      tables = tables.filter(table => !excludeTables.includes(table))
    }

    return tables
  }

  private async updateBackupStatus(backupId: string, status: BackupStatus): Promise<void> {
    await this.db.update(backupRecords)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(backupRecords.id, backupId))
  }

  private async getBackupRecord(backupId: string): Promise<BackupRecord | null> {
    const results = await this.db.select()
      .from(backupRecords)
      .where(eq(backupRecords.id, backupId))
      .limit(1)

    if (results.length === 0) return null

    return this.parseBackupRecord(results[0] as any)
  }

  private parseBackupRecord(record: any): BackupRecord {
    return {
      ...record,
      restaurant_id: record.restaurantId ?? record.restaurant_id,
      configuration_id: record.configurationId ?? record.configuration_id,
      backup_type: record.backupType ?? record.backup_type,
      file_size: record.fileSize ?? record.file_size,
      compressed_size: record.compressedSize ?? record.compressed_size,
      records_count: record.recordsCount ?? record.records_count,
      tables_included: record.tablesIncluded ?? record.tables_included ?? [],
      storage_provider: record.storageProvider ?? record.storage_provider,
      storage_path: record.storagePath ?? record.storage_path,
      encryption_enabled: Boolean(record.encryptionEnabled ?? record.encryption_enabled),
      started_at: record.startedAt ?? record.started_at,
      completed_at: record.completedAt ?? record.completed_at,
      error_message: record.errorMessage ?? record.error_message,
      created_by: record.createdBy ?? record.created_by,
      metadata: record.metadata ?? {}
    }
  }

  private parseBackupRecords(records: any[]): BackupRecord[] {
    return records.map(record => this.parseBackupRecord(record))
  }

  private async extractTableData(restaurantId: string, tableName: string): Promise<any[]> {
    try {
      // Note: extractTableData needs raw SQL because the table name is dynamic
      const result = await this.db.run(
        sql.raw(`SELECT * FROM ${tableName} WHERE restaurant_id = '${restaurantId}'`)
      )

      return (result as any).results || []
    } catch (error) {
      console.error(`Error extracting data from table ${tableName}:`, error)
      return []
    }
  }

  private async getSchemaHash(restaurantId: string): Promise<string> {
    // Simple schema hash based on table structure
    // In production, this should be more sophisticated
    return `schema_${restaurantId}_${Date.now()}`
  }

  private async createAuditLog(log: Omit<BackupAuditLog, 'id' | 'ip_address' | 'user_agent' | 'timestamp'>): Promise<void> {
    await this.db.insert(backupAuditLogs).values({
      id: crypto.randomUUID(),
      restaurantId: log.restaurant_id,
      action: log.action,
      details: log.details as Record<string, unknown>,
      performedBy: log.performed_by,
      ipAddress: this.requestContext?.ipAddress ?? '0.0.0.0',
      userAgent: this.requestContext?.userAgent ?? 'MakanMakan-API',
      timestamp: new Date().toISOString()
    })
  }

  private async executeRestore(operationId: string): Promise<void> {
    // TODO: Implement restore execution logic
    console.log('Executing restore operation:', operationId)
    // This would involve:
    // 1. Retrieving backup data from storage
    // 2. Parsing and validating the data
    // 3. Backing up current data (for rollback)
    // 4. Restoring the data table by table
    // 5. Updating the restore operation status
  }

  /**
   * Parse backup alerts from database results
   */
  private parseBackupAlerts(results: any[]): BackupAlert[] {
    return results.map(result => ({
      ...result,
      acknowledged: Boolean(result.acknowledged),
      resolved: Boolean(result.resolved)
    }))
  }
}
