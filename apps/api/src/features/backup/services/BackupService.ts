/**
 * Modular Backup Service - Core backup functionality
 * Refactored from monolithic service to use dependency injection
 */

import type { D1Database } from '@cloudflare/workers-types'
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
  constructor(
    private db: D1Database,
    private storageService: BackupStorageService,
    private configService: BackupConfigService,
    private validationService: BackupValidationService
  ) {}

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
        throw new Error('Backup configuration not found')
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
      const backup: Partial<BackupRecord> = {
        id: backupId,
        restaurant_id: request.restaurant_id,
        configuration_id: config.id,
        name: request.name,
        backup_type: request.backup_type || config.backup_type,
        status: 'pending' as BackupStatus,
        file_size: 0,
        compressed_size: 0,
        records_count: 0,
        tables_included: tablesToBackup,
        storage_provider: config.storage_provider,
        storage_path: '',
        encryption_enabled: config.encryption_enabled,
        checksum: '',
        started_at: timestamp,
        created_by: userId,
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
      }

      await this.saveBackupRecord(backup as BackupRecord)

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
      await this.updateBackupRecord(backupId, {
        status: 'completed',
        file_size: backupJson.length,
        compressed_size: backupJson.length, // TODO: Implement actual compression
        records_count: totalRecords,
        storage_path,
        checksum,
        completed_at: completedAt,
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
        }
      })

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
      await this.updateBackupRecord(backupId, {
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })

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
      let sql = `SELECT * FROM backup_records WHERE restaurant_id = ?`
      const params: any[] = [restaurant_id]

      if (status) {
        sql += ` AND status = ?`
        params.push(status)
      }

      if (backup_type) {
        sql += ` AND backup_type = ?`
        params.push(backup_type)
      }

      if (date_from) {
        sql += ` AND started_at >= ?`
        params.push(date_from)
      }

      if (date_to) {
        sql += ` AND started_at <= ?`
        params.push(date_to)
      }

      // Validate sort column to prevent SQL injection
      const validSortColumns = ['started_at', 'completed_at', 'file_size', 'name']
      const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'started_at'

      sql += ` ORDER BY ${sortColumn} ${sort_order.toUpperCase()}`
      sql += ` LIMIT ? OFFSET ?`

      const offset = (page - 1) * limit
      params.push(limit, offset)

      const result = await this.db.prepare(sql).bind(...params).all()

      // Get total count for pagination
      const countSql = sql.split('ORDER BY')[0].replace('SELECT *', 'SELECT COUNT(*) as total')
      const countParams = params.slice(0, -2) // Remove limit and offset
      const countResult = await this.db.prepare(countSql).bind(...countParams).first()

      return {
        backups: this.parseBackupRecords(result.results as any[]),
        total: (countResult as any)?.total || 0
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
        throw new Error('Backup not found or access denied')
      }

      if (backup.status !== 'completed') {
        throw new Error('Cannot restore from incomplete backup')
      }

      // Verify backup integrity
      const backupExists = await this.storageService.backupExists(backup)
      if (!backupExists) {
        throw new Error('Backup file not found in storage')
      }

      const operation: Partial<RestoreOperation> = {
        id: operationId,
        restaurant_id: request.restaurant_id,
        backup_id: request.backup_id,
        status: 'pending',
        restore_type: request.restore_type,
        target_tables: request.target_tables || backup.tables_included,
        overwrite_existing: request.overwrite_existing,
        started_at: new Date().toISOString(),
        tables_restored: 0,
        records_restored: 0,
        performed_by: userId,
        safety_checks: {
          backup_integrity_verified: request.safety_confirmation.backup_integrity_verified,
          target_compatibility_verified: true,
          data_loss_risk_acknowledged: request.safety_confirmation.data_loss_risk_acknowledged
        }
      }

      await this.saveRestoreOperation(operation as RestoreOperation)

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
        throw new Error('Backup not found')
      }

      // Delete from storage
      await this.storageService.deleteBackup(backup)

      // Delete from database
      await this.db.prepare(`
        DELETE FROM backup_records WHERE id = ?
      `).bind(backupId).run()

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
      // Get basic statistics
      const stats = await this.db.prepare(`
        SELECT
          COUNT(DISTINCT restaurant_id) as total_restaurants,
          COUNT(*) as total_backups,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as running_backups,
          COUNT(CASE WHEN status = 'failed' AND started_at > datetime('now', '-24 hours') THEN 1 END) as failed_backups_24h,
          AVG(CASE WHEN status = 'completed' AND file_size > 0 THEN file_size END) as avg_size
        FROM backup_records
        WHERE started_at > datetime('now', '-30 days')
      `).first()

      // Get storage usage
      const storageStats = await this.db.prepare(`
        SELECT
          SUM(file_size) as total_bytes,
          COUNT(*) as total_files
        FROM backup_records
        WHERE status = 'completed'
      `).first()

      // Determine overall status
      const failedBackups = (stats as any)?.failed_backups_24h || 0
      const runningBackups = (stats as any)?.running_backups || 0

      let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy'
      if (failedBackups > 10) {
        overallStatus = 'critical'
      } else if (failedBackups > 5 || runningBackups > 20) {
        overallStatus = 'warning'
      }

      return {
        overall_status: overallStatus,
        total_restaurants: (stats as any)?.total_restaurants || 0,
        active_configurations: 0, // TODO: Get from backup_configurations table
        running_backups: runningBackups,
        failed_backups_24h: failedBackups,
        storage_usage: {
          total_bytes: (storageStats as any)?.total_bytes || 0,
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

      const metrics = await this.db.prepare(`
        SELECT
          COUNT(*) as total_backups,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_backups,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_backups,
          AVG(CASE WHEN status = 'completed' AND file_size > 0 THEN file_size END) as avg_backup_size,
          SUM(file_size) as total_storage_used
        FROM backup_records
        WHERE restaurant_id = ? AND started_at >= ${dateFilter}
      `).bind(restaurantId).first()

      return metrics || {
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
      let sql = `SELECT * FROM backup_alerts WHERE restaurant_id = ?`
      const params = [restaurantId]

      if (unresolvedOnly) {
        sql += ` AND resolved = 0`
      }

      sql += ` ORDER BY triggered_at DESC`

      const result = await this.db.prepare(sql).bind(...params).all()
      return this.parseBackupAlerts(result.results as any[]) || []

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

  private async saveBackupRecord(backup: BackupRecord): Promise<void> {
    await this.db.prepare(`
      INSERT INTO backup_records (
        id, restaurant_id, configuration_id, name, backup_type, status,
        file_size, compressed_size, records_count, tables_included,
        storage_provider, storage_path, encryption_enabled, checksum,
        started_at, completed_at, error_message, created_by, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      backup.id,
      backup.restaurant_id,
      backup.configuration_id,
      backup.name,
      backup.backup_type,
      backup.status,
      backup.file_size,
      backup.compressed_size,
      backup.records_count,
      JSON.stringify(backup.tables_included),
      backup.storage_provider,
      backup.storage_path,
      backup.encryption_enabled ? 1 : 0,
      backup.checksum,
      backup.started_at,
      backup.completed_at,
      backup.error_message,
      backup.created_by,
      JSON.stringify(backup.metadata)
    ).run()
  }

  private async updateBackupStatus(backupId: string, status: BackupStatus): Promise<void> {
    await this.db.prepare(`
      UPDATE backup_records SET status = ?, updated_at = ? WHERE id = ?
    `).bind(status, new Date().toISOString(), backupId).run()
  }

  private async updateBackupRecord(backupId: string, updates: Partial<BackupRecord>): Promise<void> {
    const updateFields: string[] = []
    const params: any[] = []

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = ?`)
        if (key === 'metadata' || key === 'tables_included') {
          params.push(JSON.stringify(value))
        } else if (key === 'encryption_enabled') {
          params.push(value ? 1 : 0)
        } else {
          params.push(value)
        }
      }
    })

    if (updateFields.length > 0) {
      updateFields.push('updated_at = ?')
      params.push(new Date().toISOString())
      params.push(backupId)

      const sql = `UPDATE backup_records SET ${updateFields.join(', ')} WHERE id = ?`
      await this.db.prepare(sql).bind(...params).run()
    }
  }

  private async getBackupRecord(backupId: string): Promise<BackupRecord | null> {
    const result = await this.db.prepare(`
      SELECT * FROM backup_records WHERE id = ?
    `).bind(backupId).first()

    if (!result) return null

    return this.parseBackupRecord(result as any)
  }

  private parseBackupRecord(record: any): BackupRecord {
    return {
      ...record,
      encryption_enabled: Boolean(record.encryption_enabled),
      tables_included: JSON.parse(record.tables_included || '[]'),
      metadata: JSON.parse(record.metadata || '{}')
    }
  }

  private parseBackupRecords(records: any[]): BackupRecord[] {
    return records.map(record => this.parseBackupRecord(record))
  }

  private async extractTableData(restaurantId: string, tableName: string): Promise<any[]> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM ${tableName} WHERE restaurant_id = ?
      `).bind(restaurantId).all()

      return result.results || []
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
    const auditLog: BackupAuditLog = {
      id: crypto.randomUUID(),
      ...log,
      ip_address: '0.0.0.0', // TODO: Get from request context
      user_agent: 'MakanMakan-API', // TODO: Get from request context
      timestamp: new Date().toISOString()
    }

    await this.db.prepare(`
      INSERT INTO backup_audit_logs (
        id, restaurant_id, action, details, performed_by,
        ip_address, user_agent, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      auditLog.id,
      auditLog.restaurant_id,
      auditLog.action,
      JSON.stringify(auditLog.details),
      auditLog.performed_by,
      auditLog.ip_address,
      auditLog.user_agent,
      auditLog.timestamp
    ).run()
  }

  private async saveRestoreOperation(operation: RestoreOperation): Promise<void> {
    await this.db.prepare(`
      INSERT INTO restore_operations (
        id, restaurant_id, backup_id, status, restore_type, target_tables,
        overwrite_existing, started_at, completed_at, tables_restored,
        records_restored, error_message, performed_by, safety_checks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      operation.id,
      operation.restaurant_id,
      operation.backup_id,
      operation.status,
      operation.restore_type,
      JSON.stringify(operation.target_tables || []),
      operation.overwrite_existing ? 1 : 0,
      operation.started_at,
      operation.completed_at,
      operation.tables_restored,
      operation.records_restored,
      operation.error_message,
      operation.performed_by,
      JSON.stringify(operation.safety_checks)
    ).run()
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