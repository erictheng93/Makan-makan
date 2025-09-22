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
  BackupAuditLog
} from '@makanmakan/shared-types'
import type { D1Database, R2Bucket, KVNamespace } from '@cloudflare/workers-types'

export class BackupService {
  constructor(
    private db: D1Database,
    private storage: R2Bucket,
    private kv: KVNamespace
  ) {}

  /**
   * Create a new backup for a specific restaurant
   * Enhanced with multi-tenant isolation and enterprise features
   */
  async createBackup(request: CreateBackupRequest, userId: string): Promise<CreateBackupResponse> {
    const backupId = crypto.randomUUID()
    const timestamp = new Date().toISOString()

    try {
      // 1. Verify restaurant access and get configuration
      const config = await this.getBackupConfiguration(request.restaurant_id, request.configuration_id)
      if (!config) {
        throw new Error('Backup configuration not found or access denied')
      }

      // 2. Check for concurrent backup limits
      await this.validateConcurrentBackups(request.restaurant_id, config.max_parallel_backups)

      // 3. Determine tables to backup
      const tablesToBackup = await this.getRestaurantTables(
        request.restaurant_id,
        request.include_tables || config.include_tables,
        request.exclude_tables || config.exclude_tables
      )

      // 4. Create backup record with 'pending' status
      const backupRecord: Partial<BackupRecord> = {
        id: backupId,
        restaurant_id: request.restaurant_id,
        configuration_id: request.configuration_id,
        name: request.name,
        backup_type: request.backup_type || config.backup_type,
        status: 'pending',
        tables_included: tablesToBackup,
        storage_provider: config.storage_provider,
        encryption_enabled: config.encryption_enabled,
        created_by: userId,
        started_at: timestamp
      }

      await this.insertBackupRecord(backupRecord)

      // 5. Start async backup process
      if (request.force_immediate) {
        // Execute backup immediately (for testing/manual backups)
        await this.executeBackup(backupId)
      } else {
        // Queue backup for async processing
        await this.queueBackupExecution(backupId)
      }

      // 6. Create audit log
      await this.createAuditLog({
        restaurant_id: request.restaurant_id,
        action: 'backup_created',
        details: { backup_id: backupId, name: request.name, type: request.backup_type },
        performed_by: userId,
      ip_address: "unknown",
      
        ip_address: '127.0.0.1', // TODO: Get real IP from request context
        user_agent: 'BackupService' // TODO: Get real user agent from request context
      })

      return {
        backup_id: backupId,
        status: 'pending',
        estimated_duration_minutes: this.estimateBackupDuration(tablesToBackup.length),
        message: 'Backup initiated successfully'
      }

    } catch (error) {
      // Log error and create alert
      await this.createAlert(request.restaurant_id, {
        alert_type: 'backup_failed',
        severity: 'high',
        title: 'Backup Creation Failed',
        message: `Failed to create backup: ${error.message}`,
        related_backup_id: backupId
      })

      throw error
    }
  }

  /**
   * Execute the actual backup process
   * Based on RestaurentPOS implementation but enhanced for multi-tenant
   */
  async executeBackup(backupId: string): Promise<void> {
    const backup = await this.getBackupRecord(backupId)
    if (!backup) {
      throw new Error('Backup record not found')
    }

    try {
      // 1. Update status to 'in_progress'
      await this.updateBackupStatus(backupId, 'in_progress')

      const startTime = Date.now()
      const tablesToBackup = Array.isArray(backup.tables_included) ? backup.tables_included : JSON.parse(backup.tables_included as string)
      let totalRecords = 0
      const backupData: Record<string, any[]> = {}

      // 2. Extract data from each table (with tenant isolation)
      for (const tableName of tablesToBackup) {
        try {
          const tableData = await this.extractTableData(backup.restaurant_id, tableName)
          backupData[tableName] = tableData
          totalRecords += tableData.length
        }) catch (error) {
          console.error(`Error backing up table ${tableName}:`, error)
          // Continue with other tables, log the error
        })
      }

      // 3. Serialize and optionally compress
      const backupJson = JSON.stringify(backupData)
      const compressedSize = backupJson.length

      // Get configuration for compression setting
      const config = await this.getBackupConfiguration(backup.restaurant_id, backup.configuration_id)
      if (config?.compression_enabled) {
        // TODO: Implement compression (gzip)
        // backupJson = await compress(backupJson)
        // compressedSize = backupJson.length
      }

      // 4. Calculate checksum for integrity
      const checksum = await this.calculateChecksum(backupJson)

      // 5. Store in appropriate storage
      const storagePath = await this.storeBackupData(
        backup.restaurant_id,
        backupId,
        backupJson,
        backup.storage_provider
      )

      // 6. Calculate performance metrics
      const duration = Date.now() - startTime
      const fileSizeBytes = new Blob([backupJson]).size

      // 7. Update backup record with completion info
      await this.updateBackupRecord(backupId, {
        status: 'completed',
        file_size: fileSizeBytes,
        compressed_size: compressedSize,
        records_count: totalRecords,
        storage_path: storagePath,
        checksum: checksum,
        completed_at: new Date().toISOString(),
        metadata: JSON.stringify({
          tables_info: tablesToBackup.map(table => ({
            table_name: table,
            record_count: backupData[table]?.length || 0,
            estimated_size: JSON.stringify(backupData[table] || []).length
          }))),
          performance_metrics: {
            backup_duration_ms: duration,
            compression_ratio: fileSizeBytes > 0 ? compressedSize / fileSizeBytes : 1,
            upload_speed_mbps: fileSizeBytes > 0 ? (fileSizeBytes / 1024 / 1024) / (duration / 1000) : 0
          }),
          database_snapshot: {
            version: '1.0',
            schema_hash: await this.getSchemaHash(backup.restaurant_id),
            total_tables: tablesToBackup.length,
            total_records: totalRecords
          })
        })
      })

      // 8. Update daily metrics
      await this.updateDailyMetrics(backup.restaurant_id, {
        successful_backup: true,
        size_bytes: fileSizeBytes,
        duration_seconds: Math.round(duration / 1000)
      })

    } catch (error) {
      // Handle backup failure
      await this.updateBackupStatus(backupId, 'failed', error.message)

      await this.createAlert(backup.restaurant_id, {
        alert_type: 'backup_failed',
        severity: 'critical',
        title: 'Backup Execution Failed',
        message: `Backup ${backup.name} failed: ${error.message}`,
        related_backup_id: backupId
      })

      await this.updateDailyMetrics(backup.restaurant_id, {
        successful_backup: false
      })

      throw error
    }
  }

  /**
   * List backups for a restaurant with filtering and pagination
   */
  async listBackups(query: ListBackupsQuery): Promise<{
    backups: BackupRecord[]
    total: number
    page: number
    pages: number
  }> {
    const page = query.page || 1
    const limit = Math.min(query.limit || 20, 100) // Max 100 per page
    const offset = (page - 1) * limit

    // Build WHERE clause with tenant isolation
    const whereConditions = ['restaurant_id = ?']
    let params: any[] = [query.restaurant_id]

    if (query.status) {
      whereConditions.push('status = ?')
      params.push(query.status)
    }

    if (query.backup_type) {
      whereConditions.push('backup_type = ?')
      params.push(query.backup_type)
    }

    if (query.date_from) {
      whereConditions.push('started_at >= ?')
      params.push(query.date_from)
    }

    if (query.date_to) {
      whereConditions.push('started_at <= ?')
      params.push(query.date_to)
    }

    const whereClause = whereConditions.join(' AND ')
    const orderBy = `ORDER BY ${query.sort_by || 'started_at'} ${query.sort_order || 'DESC'}`

    // Get total count
    const countResult = await this.db.prepare(`
      SELECT COUNT(*) as total
      FROM backup_records
      WHERE ${whereClause}
    `).bind(...params).first<{ total: number }>()

    const total = countResult?.total || 0

    // Get paginated results
    const backupsResult = await this.db.prepare(`
      SELECT * FROM backup_records
      WHERE ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all<BackupRecord>()

    return {
      backups: backupsResult.results || [],
      total,
      page,
      pages: Math.ceil(total / limit)
    }
  }

  /**
   * Restore from backup with comprehensive safety checks
   */
  async restoreFromBackup(request: RestoreBackupRequest, userId: string): Promise<string> {
    const restoreId = crypto.randomUUID()

    try {
      // 1. Validate safety confirmation
      if (request.safety_confirmation.confirmation_phrase !== "I understand the risks") {
        throw new Error('Safety confirmation phrase is incorrect')
      }

      // 2. Get and validate backup record
      const backup = await this.getBackupRecord(request.backup_id)
      if (!backup || backup.restaurant_id !== request.restaurant_id) {
        throw new Error('Backup not found or access denied')
      }

      if (backup.status !== 'completed') {
        throw new Error('Cannot restore from incomplete backup')
      }

      // 3. Verify backup integrity
      if (!request.safety_confirmation.backup_integrity_verified) {
        const isValid = await this.verifyBackupIntegrity(backup)
        if (!isValid) {
          throw new Error('Backup integrity verification failed')
        })
      }

      // 4. Create restore operation record
      const restoreOperation: Partial<RestoreOperation> = {
        id: restoreId,
        restaurant_id: request.restaurant_id,
        backup_id: request.backup_id,
        status: 'pending',
        restore_type: request.restore_type,
        target_tables: request.target_tables || undefined,
        overwrite_existing: request.overwrite_existing,
        performed_by: userId,
        safety_checks: {
          backup_integrity_verified: request.safety_confirmation.backup_integrity_verified,
          target_compatibility_verified: true, // TODO: Add real verification
          data_loss_risk_acknowledged: request.safety_confirmation.data_loss_risk_acknowledged
        })
      }

      await this.insertRestoreOperation(restoreOperation)

      // 5. Execute restore process
      await this.executeRestore(restoreId)

      // 6. Create audit log
      await this.createAuditLog({
        restaurant_id: request.restaurant_id,
        action: 'restore_initiated',
        details: {
          restore_id: restoreId,
          backup_id: request.backup_id,
          restore_type: request.restore_type
        }),
        performed_by: userId,
        ip_address: '127.0.0.1', // TODO: Get real IP from request context
        user_agent: 'BackupService' // TODO: Get real user agent from request context
      })

      return restoreId

    } catch (error) {
      await this.createAlert(request.restaurant_id, {
        alert_type: 'backup_failed',
        severity: 'critical',
        title: 'Restore Operation Failed',
        message: `Failed to restore backup: ${error.message}`,
        related_backup_id: request.backup_id
      })

      throw error
    }
  }

  /**
   * Get system health metrics
   */
  async getSystemHealth(): Promise<BackupSystemHealth> {
    // Get overall statistics
    const stats = await this.db.prepare(`
      SELECT
        COUNT(DISTINCT restaurant_id) as total_restaurants,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as running_backups,
        COUNT(CASE WHEN status = 'failed' AND started_at > datetime('now', '-1 day') THEN 1 END) as failed_backups_24h
      FROM backup_records
    `).first<{
      total_restaurants: number
      running_backups: number
      failed_backups_24h: number
    }>()

    // Get active configurations
    const configCount = await this.db.prepare(`
      SELECT COUNT(*) as count FROM backup_configurations WHERE schedule_enabled = true
    `).first<{ count: number }>()

    // Get alerts summary
    const alertsStats = await this.db.prepare(`
      SELECT
        severity,
        COUNT(*) as count
      FROM backup_alerts
      WHERE resolved = false
      GROUP BY severity
    `).all<{ severity: string, count: number }>()

    const alertsSummary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }

    alertsStats.results?.forEach(alert => {
      alertsSummary[alert.severity as keyof typeof alertsSummary] = alert.count
    })

    // Calculate overall health status
    const criticalIssues = alertsSummary.critical + (stats?.failed_backups_24h || 0)
    const warningIssues = alertsSummary.high + alertsSummary.medium

    let overall_status: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (criticalIssues > 0) {
      overall_status = 'critical'
    } else if (warningIssues > 0) {
      overall_status = 'warning'
    }

    return {
      overall_status,
      total_restaurants: stats?.total_restaurants || 0,
      active_configurations: configCount?.count || 0,
      running_backups: stats?.running_backups || 0,
      failed_backups_24h: stats?.failed_backups_24h || 0,
      storage_usage: {
        total_bytes: 0, // TODO: Calculate from R2 usage
        available_bytes: 0,
        usage_percentage: 0
      },
      performance_metrics: {
        average_backup_duration_minutes: 0, // TODO: Calculate from recent backups
        average_success_rate_percentage: 0,
        average_compression_ratio: 0
      },
      alerts_summary: alertsSummary
    }
  }

  // Private helper methods...

  private async getBackupConfiguration(restaurantId: string, configId?: string): Promise<BackupConfiguration | null> {
    let query = `SELECT * FROM backup_configurations WHERE restaurant_id = ?`
    const params = [restaurantId]

    if (configId) {
      query += ` AND id = ?`
      params.push(configId)
    } else {
      query += ` ORDER BY created_at DESC LIMIT 1`
    }

    const result = await this.db.prepare(query).bind(...params).first<BackupConfiguration>()
    return result || null
  }

  private async validateConcurrentBackups(restaurantId: string, maxParallel: number): Promise<void> {
    const runningCount = await this.db.prepare(`
      SELECT COUNT(*) as count
      FROM backup_records
      WHERE restaurant_id = ? AND status = 'in_progress'
    `).bind(restaurantId).first<{ count: number }>()

    if ((runningCount?.count || 0) >= maxParallel) {
      throw new Error(`Maximum concurrent backups (${maxParallel}) reached`)
    }
  }

  private async getRestaurantTables(
    restaurantId: string,
    includeTables?: string[],
    excludeTables?: string[]
  ): Promise<string[]> {
    // Get all tables for this restaurant (with tenant isolation)
    const allTables = [
      'orders', 'order_items', 'menu_items', 'customers',
      'tables', 'reservations', 'payments', 'users'
      // Add other restaurant-specific tables
    ]

    let tables = includeTables || allTables

    if (excludeTables) {
      tables = tables.filter(table => !excludeTables.includes(table))
    }

    return tables
  }

  private async extractTableData(restaurantId: string, tableName: string): Promise<any[]> {
    // Add tenant isolation WHERE clause for each table
    const query = `SELECT * FROM ${tableName} WHERE restaurant_id = ?`
    const result = await this.db.prepare(query).bind(restaurantId).all()
    return result.results || []
  }

  private async storeBackupData(
    restaurantId: string,
    backupId: string,
    data: string,
    provider: string
  ): Promise<string> {
    const storagePath = `backups/${restaurantId}/${backupId}.json`

    if (provider === 'r2') {
      // Store in Cloudflare R2
      await this.storage.put(storagePath, data, {
        httpMetadata: {
          contentType: 'application/json',
        }),
        customMetadata: {
          restaurant_id: restaurantId,
          backup_id: backupId,
          created_at: new Date().toISOString()
        })
      })
    } else if (provider === 'kv') {
      // Store in Cloudflare KV (for smaller backups)
      await this.kv.put(`backup:${backupId}`, data, {
        metadata: JSON.stringify({
          restaurant_id: restaurantId,
          created_at: new Date().toISOString()
        })
      })
    }

    return storagePath
  }

  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  private estimateBackupDuration(tableCount: number): number {
    // Estimate 2 minutes per table as baseline
    return Math.max(tableCount * 2, 5)
  }

  private async createAlert(restaurantId: string, alert: Omit<BackupAlert, 'id' | 'restaurant_id' | 'triggered_at' | 'acknowledged' | 'resolved'>): Promise<void> {
    const alertId = crypto.randomUUID()

    await this.db.prepare(`
      INSERT INTO backup_alerts (
        id, restaurant_id, alert_type, severity, title, message,
        related_backup_id, triggered_at, acknowledged, resolved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      alertId,
      restaurantId,
      alert.alert_type,
      alert.severity,
      alert.title,
      alert.message,
      alert.related_backup_id || null,
      new Date().toISOString(),
      false,
      false
    ).run()
  }

  private async createAuditLog(log: Omit<BackupAuditLog, 'id' | 'timestamp'>): Promise<void> {
    const logId = crypto.randomUUID()

    await this.db.prepare(`
      INSERT INTO backup_audit_logs (
        id, restaurant_id, action, details, performed_by, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      logId,
      log.restaurant_id,
      log.action,
      JSON.stringify(log.details),
      log.performed_by,
      new Date().toISOString()
    ).run()
  }

  // Additional helper methods for backup operations...
  private async insertBackupRecord(record: Partial<BackupRecord>): Promise<void> {
    await this.db.prepare(`
      INSERT INTO backup_records (
        id, restaurant_id, configuration_id, name, backup_type, status,
        tables_included, storage_provider, encryption_enabled, created_by, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      record.id,
      record.restaurant_id,
      record.configuration_id || null,
      record.name,
      record.backup_type,
      record.status,
      record.tables_included,
      record.storage_provider,
      record.encryption_enabled ? 1 : 0,
      record.created_by,
      record.started_at
    ).run()
  }

  private async updateBackupStatus(backupId: string, status: string, errorMessage?: string): Promise<void> {
    let query = `UPDATE backup_records SET status = ?`
    const params: any[] = [status]

    if (errorMessage) {
      query += `, error_message = ?`
      params.push(errorMessage)
    }

    if (status === 'completed') {
      query += `, completed_at = ?`
      params.push(new Date().toISOString())
    }

    query += ` WHERE id = ?`
    params.push(backupId)

    await this.db.prepare(query).bind(...params).run()
  }

  private async updateBackupRecord(backupId: string, updates: Partial<BackupRecord>): Promise<void> {
    const setClause: string[] = []
    const params: any[] = []

    Object.entries(updates).forEach(([key, value]) => {
      setClause.push(`${key} = ?`)
      params.push(typeof value === 'object' ? JSON.stringify(value) : value)
    })

    if (setClause.length === 0) return

    params.push(backupId)

    await this.db.prepare(`
      UPDATE backup_records SET ${setClause.join(', ')} WHERE id = ?
    `).bind(...params).run()
  }

  private async getBackupRecord(backupId: string): Promise<BackupRecord | null> {
    const result = await this.db.prepare(`
      SELECT * FROM backup_records WHERE id = ?
    `).bind(backupId).first<BackupRecord>()

    if (!result) return null

    // Parse JSON fields - handle both string and array formats
    if (result.tables_included) {
      result.tables_included = typeof result.tables_included === 'string'
        ? JSON.parse(result.tables_included)
        : result.tables_included
    }
    if (result.metadata) {
      result.metadata = typeof result.metadata === 'string'
        ? JSON.parse(result.metadata)
        : result.metadata
    }

    return result
  }

  private async queueBackupExecution(backupId: string): Promise<void> {
    // For now, execute immediately in the background
    // In production, this would use Cloudflare Queues
    setTimeout(async () => {
      try {
        await this.executeBackup(backupId)
      } catch (error) {
        console.error(`Background backup ${backupId} failed:`, error)
      }
    }, 1000) // 1 second delay to return response first
  }

  private async getSchemaHash(restaurantId: string): Promise<string> {
    // Generate a hash representing the current database schema
    // This could be enhanced to track actual schema changes
    const tables = await this.getRestaurantTables(restaurantId)
    const schemaString = tables.sort().join(',')
    const encoder = new TextEncoder()
    const data = encoder.encode(schemaString + new Date().toISOString().split('T')[0])
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16)
  }

  private async updateDailyMetrics(restaurantId: string, metrics: {
    successful_backup?: boolean
    size_bytes?: number
    duration_seconds?: number
  }): Promise<void> {
    const today = new Date().toISOString().split('T')[0]

    // Check if metrics exist for today
    const existing = await this.db.prepare(`
      SELECT * FROM backup_metrics_daily WHERE restaurant_id = ? AND date = ?
    `).bind(restaurantId, today).first<any>()

    if (existing) {
      // Update existing metrics
      const updates: string[] = []
      const params: any[] = []

      if (metrics.successful_backup !== undefined) {
        updates.push('total_backups = total_backups + 1')
        if (metrics.successful_backup) {
          updates.push('successful_backups = successful_backups + 1')
        }) else {
          updates.push('failed_backups = failed_backups + 1')
        })
      }

      if (metrics.size_bytes) {
        updates.push('total_size_bytes = total_size_bytes + ?')
        params.push(metrics.size_bytes)
      }

      if (metrics.duration_seconds) {
        updates.push('average_duration_seconds = ((average_duration_seconds * (total_backups - 1)) + ?) / total_backups')
        params.push(metrics.duration_seconds)
      }

      params.push(restaurantId, today)

      await this.db.prepare(`
        UPDATE backup_metrics_daily SET ${updates.join(', ')}, computed_at = ?
        WHERE restaurant_id = ? AND date = ?
      `).bind(...params, new Date().toISOString()).run()

    } else {
      // Create new metrics entry
      await this.db.prepare(`
        INSERT INTO backup_metrics_daily (
          id, restaurant_id, date, total_backups, successful_backups, failed_backups,
          total_size_bytes, average_duration_seconds, computed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        restaurantId,
        today,
        1,
        metrics.successful_backup ? 1 : 0,
        metrics.successful_backup ? 0 : 1,
        metrics.size_bytes || 0,
        metrics.duration_seconds || 0,
        new Date().toISOString()
      ).run()
    }
  }

  private async verifyBackupIntegrity(backup: BackupRecord): Promise<boolean> {
    try {
      // 1. Verify backup file exists in storage
      let backupData: string | null = null

      if (backup.storage_provider === 'r2') {
        const object = await this.storage.get(backup.storage_path)
        if (!object) return false
        backupData = await object.text()
      } else if (backup.storage_provider === 'kv') {
        backupData = await this.kv.get(`backup:${backup.id}`)
        if (!backupData) return false
      } else {
        return false
      }

      // 2. Verify checksum matches
      const calculatedChecksum = await this.calculateChecksum(backupData)
      if (calculatedChecksum !== backup.checksum) {
        console.error(`Checksum mismatch for backup ${backup.id}`)
        return false
      }

      // 3. Verify JSON structure is valid
      const parsedData = JSON.parse(backupData)
      const expectedTables = Array.isArray(backup.tables_included)
        ? backup.tables_included
        : JSON.parse(backup.tables_included as string)

      for (const table of expectedTables) {
        if (!parsedData[table] || !Array.isArray(parsedData[table])) {
          console.error(`Missing or invalid table data for ${table}`)
          return false
        })
      }

      return true

    } catch (error) {
      console.error(`Backup integrity verification failed for ${backup.id}:`, error)
      return false
    }
  }

  private async insertRestoreOperation(operation: Partial<RestoreOperation>): Promise<void> {
    await this.db.prepare(`
      INSERT INTO restore_operations (
        id, restaurant_id, backup_id, status, restore_type, target_tables,
        overwrite_existing, performed_by, safety_checks, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      operation.id,
      operation.restaurant_id,
      operation.backup_id,
      operation.status,
      operation.restore_type,
      operation.target_tables,
      operation.overwrite_existing ? 1 : 0,
      operation.performed_by,
      operation.safety_checks,
      operation.started_at || new Date().toISOString()
    ).run()
  }

  private async executeRestore(restoreId: string): Promise<void> {
    const restore = await this.db.prepare(`
      SELECT * FROM restore_operations WHERE id = ?
    `).bind(restoreId).first<RestoreOperation>()

    if (!restore) {
      throw new Error('Restore operation not found')
    }

    try {
      // 1. Update status to 'in_progress'
      await this.db.prepare(`
        UPDATE restore_operations SET status = ? WHERE id = ?
      `).bind('in_progress', restoreId).run()

      // 2. Get backup data
      const backup = await this.getBackupRecord(restore.backup_id)
      if (!backup) {
        throw new Error('Backup record not found')
      }

      // 3. Retrieve backup data from storage
      let backupData: string
      if (backup.storage_provider === 'r2') {
        const object = await this.storage.get(backup.storage_path)
        if (!object) throw new Error('Backup file not found in R2')
        backupData = await object.text()
      } else if (backup.storage_provider === 'kv') {
        const kvData = await this.kv.get(`backup:${backup.id}`)
        if (!kvData) throw new Error('Backup file not found in KV')
        backupData = kvData
      } else {
        throw new Error('Unsupported storage provider')
      }

      // 4. Parse backup data
      const parsedBackup = JSON.parse(backupData)

      // 5. Determine tables to restore
      const tablesToRestore = restore.target_tables
        ? (Array.isArray(restore.target_tables) ? restore.target_tables : JSON.parse(restore.target_tables as string))
        : Object.keys(parsedBackup)

      let totalRestored = 0
      let tablesRestored = 0

      // 6. Restore each table
      for (const tableName of tablesToRestore) {
        if (parsedBackup[tableName]) {
          try {
            // Clear existing data if overwrite is enabled
            if (restore.overwrite_existing) {
              await this.db.prepare(`
                DELETE FROM ${tableName} WHERE restaurant_id = ?
              `).bind(restore.restaurant_id).run()
            })

            // Insert restored data
            const tableData = parsedBackup[tableName]
            for (const row of tableData) {
              // Build dynamic INSERT query
              const columns = Object.keys(row)
              const placeholders = columns.map(() => '?').join(',')
              const values = Object.values(row)

              await this.db.prepare(`
                INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})
              `).bind(...values).run()

              totalRestored++
            })

            tablesRestored++
          }) catch (error) {
            console.error(`Error restoring table ${tableName}:`, error)
          })
        })
      }

      // 7. Update restore operation with results
      await this.db.prepare(`
        UPDATE restore_operations SET
          status = ?, completed_at = ?, tables_restored = ?, records_restored = ?
        WHERE id = ?
      `).bind(
        'completed',
        new Date().toISOString(),
        tablesRestored,
        totalRestored,
        restoreId
      ).run()

      // 8. Create success alert
      await this.createAlert(restore.restaurant_id, {
        alert_type: 'restoration_completed',
        severity: 'medium',
        title: 'Restore Completed Successfully',
        message: `Restored ${tablesRestored} tables with ${totalRestored} records from backup ${backup.name}`,
        related_backup_id: restore.backup_id
      })

    } catch (error) {
      // Handle restore failure
      await this.db.prepare(`
        UPDATE restore_operations SET status = ?, error_message = ?
        WHERE id = ?
      `).bind('failed', error.message, restoreId).run()

      await this.createAlert(restore.restaurant_id, {
        alert_type: 'backup_failed',
        severity: 'critical',
        title: 'Restore Operation Failed',
        message: `Failed to restore backup: ${error.message}`,
        related_backup_id: restore.backup_id
      })

      throw error
    }
  }

  // Additional public methods for backup management
  async getBackupConfigurations(restaurantId: string): Promise<BackupConfiguration[]> {
    const result = await this.db.prepare(`
      SELECT * FROM backup_configurations WHERE restaurant_id = ? ORDER BY created_at DESC
    `).bind(restaurantId).all<BackupConfiguration>()

    return result.results?.map(config => ({
      ...config,
      include_tables: config.include_tables
        ? (Array.isArray(config.include_tables) ? config.include_tables : JSON.parse(config.include_tables as string))
        : undefined,
      exclude_tables: config.exclude_tables
        ? (Array.isArray(config.exclude_tables) ? config.exclude_tables : JSON.parse(config.exclude_tables as string))
        : undefined,
      notification_channels: config.notification_channels
        ? (Array.isArray(config.notification_channels) ? config.notification_channels : JSON.parse(config.notification_channels as string))
        : ['email']
    })) || []
  }

  /**
   * Public method to get backup record by ID
   */
  async getBackupById(backupId: string): Promise<BackupRecord | null> {
    return this.getBackupRecord(backupId)
  }

  /**
   * Public method to create alerts
   */
  async createAlertPublic(restaurantId: string, alert: {
    alert_type: BackupAlert['alert_type']
    severity: BackupAlert['severity']
    title: string
    message: string
    related_backup_id?: string
  }): Promise<void> {
    return this.createAlert(restaurantId, alert)
  }

  async createOrUpdateConfiguration(config: Partial<BackupConfiguration>, userId: string): Promise<BackupConfiguration> {
    const configId = config.id || crypto.randomUUID()
    const timestamp = new Date().toISOString()

    // Check if configuration exists
    const existing = config.id ? await this.db.prepare(`
      SELECT id FROM backup_configurations WHERE id = ? AND restaurant_id = ?
    `).bind(config.id, config.restaurant_id).first() : null

    if (existing) {
      // Update existing configuration
      await this.db.prepare(`
        UPDATE backup_configurations SET
          name = ?, description = ?, backup_type = ?, schedule_enabled = ?, schedule_cron = ?,
          retention_days = ?, include_tables = ?, exclude_tables = ?, compression_enabled = ?,
          encryption_enabled = ?, max_parallel_backups = ?, notifications_enabled = ?,
          notification_channels = ?, updated_at = ?
        WHERE id = ? AND restaurant_id = ?
      `).bind(
        config.name,
        config.description || null,
        config.backup_type,
        config.schedule_enabled ? 1 : 0,
        config.schedule_cron || null,
        config.retention_days,
        config.include_tables ? JSON.stringify(config.include_tables) : null,
        config.exclude_tables ? JSON.stringify(config.exclude_tables) : null,
        config.compression_enabled ? 1 : 0,
        config.encryption_enabled ? 1 : 0,
        config.max_parallel_backups,
        config.notifications_enabled ? 1 : 0,
        JSON.stringify(config.notification_channels || ['email']),
        timestamp,
        configId,
        config.restaurant_id
      ).run()

      await this.createAuditLog({
        restaurant_id: config.restaurant_id!,
        action: 'configuration_updated',
        details: { configuration_id: configId, name: config.name },
        performed_by: userId,
      ip_address: "unknown",
      
        ip_address: '127.0.0.1', // TODO: Get real IP from request context
        user_agent: 'BackupService' // TODO: Get real user agent from request context
      })

    } else {
      // Create new configuration
      await this.db.prepare(`
        INSERT INTO backup_configurations (
          id, restaurant_id, name, description, backup_type, schedule_enabled, schedule_cron,
          retention_days, include_tables, exclude_tables, compression_enabled, encryption_enabled,
          max_parallel_backups, notifications_enabled, notification_channels, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        configId,
        config.restaurant_id,
        config.name,
        config.description || null,
        config.backup_type || 'full',
        config.schedule_enabled ? 1 : 0,
        config.schedule_cron || null,
        config.retention_days || 30,
        config.include_tables ? JSON.stringify(config.include_tables) : null,
        config.exclude_tables ? JSON.stringify(config.exclude_tables) : null,
        config.compression_enabled !== false ? 1 : 0,
        config.encryption_enabled !== false ? 1 : 0,
        config.max_parallel_backups || 3,
        config.notifications_enabled !== false ? 1 : 0,
        JSON.stringify(config.notification_channels || ['email']),
        userId,
        timestamp,
        timestamp
      ).run()

      await this.createAuditLog({
        restaurant_id: config.restaurant_id!,
        action: 'configuration_updated',
        details: { configuration_id: configId, name: config.name, action: 'created' },
        performed_by: userId,
      ip_address: "unknown",
      
        ip_address: '127.0.0.1', // TODO: Get real IP from request context
        user_agent: 'BackupService' // TODO: Get real user agent from request context
      })
    }

    // Return the created/updated configuration
    const result = await this.db.prepare(`
      SELECT * FROM backup_configurations WHERE id = ?
    `).bind(configId).first<BackupConfiguration>()

    if (!result) throw new Error('Failed to create/update configuration')

    return {
      ...result,
      include_tables: result.include_tables
        ? (Array.isArray(result.include_tables) ? result.include_tables : JSON.parse(result.include_tables as string))
        : undefined,
      exclude_tables: result.exclude_tables
        ? (Array.isArray(result.exclude_tables) ? result.exclude_tables : JSON.parse(result.exclude_tables as string))
        : undefined,
      notification_channels: result.notification_channels
        ? (Array.isArray(result.notification_channels) ? result.notification_channels : JSON.parse(result.notification_channels as string))
        : ['email']
    }
  }

  async getRestaurantMetrics(restaurantId: string, period: 'hour' | 'day' | 'week' | 'month' = 'week'): Promise<any> {
    let dateFilter = ''

    switch (period) {
      case 'hour':
        dateFilter = "datetime('now', '-1 hour')"
        break
      case 'day':
        dateFilter = "datetime('now', '-1 day')"
        break
      case 'week':
        dateFilter = "datetime('now', '-7 days')"
        break
      case 'month':
        dateFilter = "datetime('now', '-30 days')"
        break
    }

    // Get basic metrics
    const basicMetrics = await this.db.prepare(`
      SELECT
        COUNT(*) as total_backups,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_backups,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_backups,
        AVG(CASE WHEN file_size > 0 THEN file_size END) as average_backup_size,
        AVG(CASE WHEN completed_at IS NOT NULL THEN
          (julianday(completed_at) - julianday(started_at)) * 24 * 60
        END) as average_backup_duration,
        SUM(CASE WHEN file_size > 0 THEN file_size ELSE 0 END) as storage_usage_bytes
      FROM backup_records
      WHERE restaurant_id = ? AND started_at >= ${dateFilter}
    `).bind(restaurantId).first<any>()

    // Calculate performance trend (simplified)
    const recentSuccess = await this.db.prepare(`
      SELECT
        COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as recent_success_rate
      FROM backup_records
      WHERE restaurant_id = ? AND started_at >= datetime('now', '-3 days')
    `).bind(restaurantId).first<{ recent_success_rate: number }>()

    const olderSuccess = await this.db.prepare(`
      SELECT
        COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as older_success_rate
      FROM backup_records
      WHERE restaurant_id = ? AND started_at BETWEEN datetime('now', '-7 days') AND datetime('now', '-3 days')
    `).bind(restaurantId).first<{ older_success_rate: number }>()

    let performance_trend: 'improving' | 'stable' | 'degrading' = 'stable'
    if (recentSuccess && olderSuccess) {
      const diff = recentSuccess.recent_success_rate - olderSuccess.older_success_rate
      if (diff > 10) performance_trend = 'improving'
      else if (diff < -10) performance_trend = 'degrading'
    }

    return {
      restaurant_id: restaurantId,
      period,
      total_backups: basicMetrics?.total_backups || 0,
      successful_backups: basicMetrics?.successful_backups || 0,
      failed_backups: basicMetrics?.failed_backups || 0,
      average_backup_size: basicMetrics?.average_backup_size || 0,
      average_backup_duration: basicMetrics?.average_backup_duration || 0,
      storage_usage_bytes: basicMetrics?.storage_usage_bytes || 0,
      cost_estimation: ((basicMetrics?.storage_usage_bytes || 0) / 1024 / 1024 / 1024) * 0.015, // $0.015/GB estimate
      performance_trend
    }
  }

  async getRestaurantAlerts(restaurantId: string, unresolved_only: boolean = false): Promise<BackupAlert[]> {
    let query = `
      SELECT * FROM backup_alerts
      WHERE restaurant_id = ?
    `
    const params: any[] = [restaurantId]

    if (unresolved_only) {
      query += ` AND resolved = false`
    }

    query += ` ORDER BY triggered_at DESC`

    const result = await this.db.prepare(query).bind(...params).all<BackupAlert>()

    return result.results || []
  }

  async deleteBackup(backupId: string, userId: string): Promise<void> {
    // Get backup record first
    const backup = await this.getBackupRecord(backupId)
    if (!backup) {
      throw new Error('Backup not found')
    }

    try {
      // Delete from storage
      if (backup.storage_provider === 'r2') {
        await this.storage.delete(backup.storage_path)
      } else if (backup.storage_provider === 'kv') {
        await this.kv.delete(`backup:${backupId}`)
      }

      // Delete from database
      await this.db.prepare(`
        DELETE FROM backup_records WHERE id = ?
      `).bind(backupId).run()

      // Create audit log
      await this.createAuditLog({
        restaurant_id: backup.restaurant_id,
        action: 'backup_deleted',
        details: { backup_id: backupId, name: backup.name },
        performed_by: userId,
      ip_address: "unknown",
      
        ip_address: '127.0.0.1', // TODO: Get real IP from request context
        user_agent: 'BackupService' // TODO: Get real user agent from request context
      })

    } catch (error) {
      await this.createAlert(backup.restaurant_id, {
        alert_type: 'backup_failed',
        severity: 'medium',
        title: 'Backup Deletion Failed',
        message: `Failed to delete backup ${backup.name}: ${error.message}`,
        related_backup_id: backupId
      })

      throw error
    }
  }
}
  /**
   * Get database instance (for internal use)
   */
  public getDatabase(): D1Database {
    return this.db
  }
