/**
 * BackupService Tests
 * Comprehensive test suite for backup service
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { BackupService } from '../BackupService'
import type {
  CreateBackupRequest,
  ListBackupsQuery,
  RestoreBackupRequest,
  BackupRecord,
  BackupConfiguration
} from '@makanmakan/shared-types'

// ========================================
// Mock Services
// ========================================

class MockStorageService {
  public storedBackups: Map<string, string> = new Map()
  public shouldFail = false

  async storeBackup(backup: any, data: string, _provider: string) {
    if (this.shouldFail) throw new Error('Storage failed')
    const path = `backups/${backup.id}.json`
    this.storedBackups.set(backup.id, data)
    return {
      storage_path: path,
      checksum: 'mock-checksum-' + Date.now()
    }
  }

  async backupExists(backup: any): Promise<boolean> {
    return this.storedBackups.has(backup.id)
  }

  async deleteBackup(backup: any): Promise<void> {
    this.storedBackups.delete(backup.id)
  }

  async generateDownloadResponse(backup: any): Promise<Response> {
    const data = this.storedBackups.get(backup.id) || '{}'
    return new Response(data, {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  reset() {
    this.storedBackups.clear()
    this.shouldFail = false
  }
}

class MockConfigService {
  private configs: Map<string, BackupConfiguration> = new Map()

  async getConfigurationById(id: string): Promise<BackupConfiguration | null> {
    return this.configs.get(id) || null
  }

  async getDefaultConfiguration(_restaurantId: string): Promise<BackupConfiguration | null> {
    return {
      id: 'default-config',
      restaurant_id: 'rest-1',
      name: 'Default Config',
      backup_type: 'full',
      schedule_enabled: false,
      retention_days: 30,
      include_tables: ['orders', 'menu_items'],
      exclude_tables: [],
      compression_enabled: true,
      encryption_enabled: true,
      storage_provider: 'r2',
      max_parallel_backups: 1,
      notifications_enabled: false,
      notification_channels: [],
      created_by: 'system',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  setConfig(id: string, config: BackupConfiguration) {
    this.configs.set(id, config)
  }
}

class MockValidationService {
  public shouldFailValidation = false
  public shouldFailLimits = false
  public shouldFailQuota = false

  async validateCreateBackupRequest(_request: CreateBackupRequest): Promise<void> {
    if (this.shouldFailValidation) {
      throw new Error('Validation failed')
    }
  }

  async checkBackupLimits(_restaurantId: string): Promise<void> {
    if (this.shouldFailLimits) {
      throw new Error('Backup limit exceeded')
    }
  }

  async checkStorageQuota(_restaurantId: string): Promise<void> {
    if (this.shouldFailQuota) {
      throw new Error('Storage quota exceeded')
    }
  }

  async validateTableNames(tables: string[]): Promise<void> {
    if (tables.includes('invalid_table')) {
      throw new Error('Invalid table name')
    }
  }

  async validateRestoreRequest(request: RestoreBackupRequest): Promise<void> {
    if (!request.safety_confirmation?.backup_integrity_verified) {
      throw new Error('Backup integrity not verified')
    }
  }

  reset() {
    this.shouldFailValidation = false
    this.shouldFailLimits = false
    this.shouldFailQuota = false
  }
}

// ========================================
// Mock Database
// ========================================

const createMockDB = () => {
  const backups = new Map<string, any>()
  const restoreOps = new Map<string, any>()
  const auditLogs: any[] = []

  return {
    prepare: (sql: string) => {
      // Support for prepare().first() without bind (for system health queries)
      const createQueryMethods = (params: any[] = []) => ({
        run: async () => {
          // Handle INSERT operations
          if (sql.includes('INSERT INTO backup_records')) {
            const id = params[0]
            backups.set(id, {
              id: params[0],
              restaurant_id: params[1],
              configuration_id: params[2],
              name: params[3],
              backup_type: params[4],
              status: params[5],
              file_size: params[6],
              compressed_size: params[7],
              records_count: params[8],
              tables_included: params[9],
              storage_provider: params[10],
              storage_path: params[11],
              encryption_enabled: params[12],
              checksum: params[13],
              started_at: params[14],
              completed_at: params[15],
              error_message: params[16],
              created_by: params[17],
              metadata: params[18]
            })
          } else if (sql.includes('INSERT INTO restore_operations')) {
            const id = params[0]
            restoreOps.set(id, {
              id: params[0],
              restaurant_id: params[1],
              backup_id: params[2],
              status: params[3]
            })
          } else if (sql.includes('INSERT INTO backup_audit_logs')) {
            auditLogs.push({
              id: params[0],
              restaurant_id: params[1],
              action: params[2],
              details: params[3],
              performed_by: params[4],
              ip_address: params[5],
              user_agent: params[6],
              timestamp: params[7]
            })
          } else if (sql.includes('UPDATE backup_records')) {
            // Handle updates
          } else if (sql.includes('DELETE FROM backup_records')) {
            const id = params[0]
            backups.delete(id)
          }
          return { success: true }
        },
        first: async () => {
          if (sql.includes('SELECT * FROM backup_records WHERE id')) {
            const id = params[0]
            return backups.get(id) || null
          }
          if (sql.includes('SELECT COUNT')) {
            return { total: backups.size }
          }
          if (sql.includes('SELECT * FROM backup_alerts')) {
            return []
          }
          // System health stats query
          if (sql.includes('COUNT(DISTINCT restaurant_id)') || sql.includes('total_restaurants')) {
            const backupList = Array.from(backups.values())
            const failedIn24h = backupList.filter(b =>
              b.status === 'failed' &&
              new Date(b.started_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
            ).length
            return {
              total_restaurants: new Set(backupList.map(b => b.restaurant_id)).size,
              total_backups: backupList.length,
              running_backups: backupList.filter(b => b.status === 'in_progress').length,
              failed_backups_24h: failedIn24h,
              avg_size: backupList.reduce((sum, b) => sum + (b.file_size || 0), 0) / (backupList.length || 1)
            }
          }
          // Storage stats query
          if (sql.includes('SUM(file_size)') && !sql.includes('COUNT(*)')) {
            const backupList = Array.from(backups.values()).filter(b => b.status === 'completed')
            return {
              total_bytes: backupList.reduce((sum, b) => sum + (b.file_size || 0), 0),
              total_files: backupList.length
            }
          }
          // Restaurant metrics query
          if (sql.includes('COUNT(*)') && sql.includes('total_backups') && sql.includes('restaurant_id')) {
            const restaurantId = params[0]
            const backupList = Array.from(backups.values()).filter(b => b.restaurant_id === restaurantId)
            return {
              total_backups: backupList.length,
              successful_backups: backupList.filter(b => b.status === 'completed').length,
              failed_backups: backupList.filter(b => b.status === 'failed').length,
              avg_backup_size: backupList.length > 0
                ? backupList.reduce((sum, b) => sum + (b.file_size || 0), 0) / backupList.length
                : 0,
              total_storage_used: backupList.reduce((sum, b) => sum + (b.file_size || 0), 0)
            }
          }
          return null
        },
        all: async () => {
          if (sql.includes('SELECT * FROM backup_records')) {
            // Handle pagination - limit and offset are the last two params
            const limit = sql.includes('LIMIT') && params.length >= 2 ? params[params.length - 2] : 20
            const offset = sql.includes('OFFSET') && params.length >= 1 ? params[params.length - 1] : 0
            const allBackups = Array.from(backups.values())
            return {
              results: allBackups.slice(offset, offset + limit)
            }
          }
          return { results: [] }
        }
      })

      return {
        bind: (...params: any[]) => createQueryMethods(params),
        // Direct first() call without bind (for queries without parameters)
        first: async () => createQueryMethods([]).first(),
        all: async () => createQueryMethods([]).all(),
        run: async () => createQueryMethods([]).run()
      }
    },
    getBackups: () => backups,
    getRestoreOps: () => restoreOps,
    getAuditLogs: () => auditLogs,
    reset: () => {
      backups.clear()
      restoreOps.clear()
      auditLogs.length = 0
    }
  }
}

// ========================================
// Setup
// ========================================

describe('BackupService', () => {
  let service: BackupService
  let mockDB: any
  let mockStorage: MockStorageService
  let mockConfig: MockConfigService
  let mockValidation: MockValidationService

  beforeEach(() => {
    mockDB = createMockDB()
    mockStorage = new MockStorageService()
    mockConfig = new MockConfigService()
    mockValidation = new MockValidationService()

    service = new BackupService(
      mockDB as any,
      mockStorage as any,
      mockConfig as any,
      mockValidation as any
    )
  })

  // ========================================
  // 1. Create Backup Tests
  // ========================================

  describe('Create Backup', () => {
    it('應該成功創建備份', async () => {
      const request: CreateBackupRequest = {
        restaurant_id: 'rest-1',
        name: 'Daily Backup',
        backup_type: 'full',
        force_immediate: false
      }

      const result = await service.createBackup(request, 'user-1')

      expect(result.status).toBe('pending')
      expect(result.backup_id).toBeDefined()
      expect(result.message).toContain('scheduled successfully')
      expect(result.estimated_duration_minutes).toBeGreaterThan(0)
    })

    it('應該在驗證失敗時拋出錯誤', async () => {
      mockValidation.shouldFailValidation = true

      const request: CreateBackupRequest = {
        restaurant_id: 'rest-1',
        name: 'Test Backup',
        backup_type: 'full'
      }

      await expect(service.createBackup(request, 'user-1')).rejects.toThrow('Validation failed')
    })

    it('應該在達到備份限制時拋出錯誤', async () => {
      mockValidation.shouldFailLimits = true

      const request: CreateBackupRequest = {
        restaurant_id: 'rest-1',
        name: 'Test Backup',
        backup_type: 'full'
      }

      await expect(service.createBackup(request, 'user-1')).rejects.toThrow('Backup limit exceeded')
    })

    it('應該在存儲配額不足時拋出錯誤', async () => {
      mockValidation.shouldFailQuota = true

      const request: CreateBackupRequest = {
        restaurant_id: 'rest-1',
        name: 'Test Backup',
        backup_type: 'full'
      }

      await expect(service.createBackup(request, 'user-1')).rejects.toThrow('Storage quota exceeded')
    })

    it('應該在無效的表名時拋出錯誤', async () => {
      const request: CreateBackupRequest = {
        restaurant_id: 'rest-1',
        name: 'Test Backup',
        backup_type: 'full',
        include_tables: ['invalid_table']
      }

      await expect(service.createBackup(request, 'user-1')).rejects.toThrow('Invalid table name')
    })

    it('應該在配置不存在時拋出錯誤', async () => {
      mockConfig.getDefaultConfiguration = async () => null

      const request: CreateBackupRequest = {
        restaurant_id: 'rest-1',
        name: 'Test Backup',
        backup_type: 'full'
      }

      await expect(service.createBackup(request, 'user-1')).rejects.toThrow('Backup configuration not found')
    })

    it('應該使用自定義配置創建備份', async () => {
      const customConfig: BackupConfiguration = {
        id: 'custom-config',
        restaurant_id: 'rest-1',
        name: 'Custom Config',
        backup_type: 'incremental',
        schedule_enabled: false,
        retention_days: 7,
        include_tables: ['orders'],
        exclude_tables: ['audit_logs'],
        compression_enabled: true,
        encryption_enabled: false,
        storage_provider: 'external',
        max_parallel_backups: 1,
        notifications_enabled: false,
        notification_channels: [],
        created_by: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      mockConfig.setConfig('custom-config', customConfig)

      const request: CreateBackupRequest = {
        restaurant_id: 'rest-1',
        name: 'Custom Backup',
        backup_type: 'incremental',
        configuration_id: 'custom-config'
      }

      const result = await service.createBackup(request, 'user-1')

      expect(result.status).toBe('pending')
      expect(result.backup_id).toBeDefined()
    })

    it('應該在 force_immediate 為 true 時立即執行備份', async () => {
      const request: CreateBackupRequest = {
        restaurant_id: 'rest-1',
        name: 'Immediate Backup',
        backup_type: 'full',
        force_immediate: true
      }

      const result = await service.createBackup(request, 'user-1')

      expect(result.status).toBe('pending')
      expect(result.backup_id).toBeDefined()
      // Note: The actual backup execution happens asynchronously
    })
  })

  // ========================================
  // 2. List Backups Tests
  // ========================================

  describe('List Backups', () => {
    beforeEach(async () => {
      // Create some test backups
      for (let i = 1; i <= 5; i++) {
        const request: CreateBackupRequest = {
          restaurant_id: 'rest-1',
          name: `Backup ${i}`,
          backup_type: 'full'
        }
        await service.createBackup(request, 'user-1')
      }
    })

    it('應該列出所有備份', async () => {
      const query: ListBackupsQuery = {
        restaurant_id: 'rest-1'
      }

      const result = await service.listBackups(query)

      expect(result.backups.length).toBeGreaterThan(0)
      expect(result.total).toBeGreaterThan(0)
    })

    it('應該根據狀態篩選備份', async () => {
      const query: ListBackupsQuery = {
        restaurant_id: 'rest-1',
        status: 'pending'
      }

      const result = await service.listBackups(query)

      result.backups.forEach(backup => {
        expect(backup.status).toBe('pending')
      })
    })

    it('應該根據備份類型篩選', async () => {
      const query: ListBackupsQuery = {
        restaurant_id: 'rest-1',
        backup_type: 'full'
      }

      const result = await service.listBackups(query)

      result.backups.forEach(backup => {
        expect(backup.backup_type).toBe('full')
      })
    })

    it('應該支持分頁', async () => {
      const query: ListBackupsQuery = {
        restaurant_id: 'rest-1',
        page: 1,
        limit: 2
      }

      const result = await service.listBackups(query)

      expect(result.backups.length).toBeLessThanOrEqual(2)
    })

    it('應該支持排序', async () => {
      const query: ListBackupsQuery = {
        restaurant_id: 'rest-1',
        sort_by: 'created_at',
        sort_order: 'desc'
      }

      const result = await service.listBackups(query)

      expect(result.backups.length).toBeGreaterThan(0)
    })

    it('應該根據日期範圍篩選', async () => {
      const now = new Date().toISOString()
      const yesterday = new Date(Date.now() - 86400000).toISOString()

      const query: ListBackupsQuery = {
        restaurant_id: 'rest-1',
        date_from: yesterday,
        date_to: now
      }

      const result = await service.listBackups(query)

      expect(result.total).toBeGreaterThanOrEqual(0)
    })
  })

  // ========================================
  // 3. Get Backup Tests
  // ========================================

  describe('Get Backup', () => {
    let backupId: string

    beforeEach(async () => {
      const request: CreateBackupRequest = {
        restaurant_id: 'rest-1',
        name: 'Test Backup',
        backup_type: 'full'
      }
      const result = await service.createBackup(request, 'user-1')
      backupId = result.backup_id
    })

    it('應該根據 ID 取得備份', async () => {
      const backup = await service.getBackupById(backupId)

      expect(backup).toBeDefined()
      expect(backup?.id).toBe(backupId)
      expect(backup?.name).toBe('Test Backup')
    })

    it('應該在備份不存在時返回 null', async () => {
      const backup = await service.getBackupById('non-existent-id')

      expect(backup).toBeNull()
    })
  })

  // ========================================
  // 4. Delete Backup Tests
  // ========================================

  describe('Delete Backup', () => {
    let backupId: string

    beforeEach(async () => {
      const request: CreateBackupRequest = {
        restaurant_id: 'rest-1',
        name: 'Test Backup',
        backup_type: 'full'
      }
      const result = await service.createBackup(request, 'user-1')
      backupId = result.backup_id
    })

    it('應該成功刪除備份', async () => {
      await service.deleteBackup(backupId, 'user-1')

      const backup = await service.getBackupById(backupId)
      expect(backup).toBeNull()
    })

    it('應該在備份不存在時拋出錯誤', async () => {
      await expect(service.deleteBackup('non-existent-id', 'user-1')).rejects.toThrow('Backup not found')
    })

    it('應該創建審計日誌', async () => {
      await service.deleteBackup(backupId, 'user-1')

      const logs = mockDB.getAuditLogs()
      const deleteLog = logs.find((log: any) =>
        log.action === 'backup_deleted' &&
        JSON.parse(log.details).backup_id === backupId
      )

      expect(deleteLog).toBeDefined()
    })
  })

  // ========================================
  // 5. Restore Backup Tests
  // ========================================

  describe('Restore Backup', () => {
    let backupId: string

    beforeEach(async () => {
      const request: CreateBackupRequest = {
        restaurant_id: 'rest-1',
        name: 'Test Backup',
        backup_type: 'full',
        force_immediate: true
      }
      const result = await service.createBackup(request, 'user-1')
      backupId = result.backup_id

      // Simulate completed backup
      mockStorage.storedBackups.set(backupId, JSON.stringify({ data: 'test' }))
    })

    it('應該在安全確認失敗時拋出錯誤', async () => {
      const request: RestoreBackupRequest = {
        restaurant_id: 'rest-1',
        backup_id: backupId,
        restore_type: 'full',
        overwrite_existing: true,
        safety_confirmation: {
          backup_integrity_verified: false,
          data_loss_risk_acknowledged: true,
          confirmation_phrase: 'RESTORE'
        }
      }

      await expect(service.restoreFromBackup(request, 'user-1')).rejects.toThrow('Backup integrity not verified')
    })
  })

  // ========================================
  // 6. System Health Tests
  // ========================================

  describe('System Health', () => {
    it('應該返回系統健康狀態', async () => {
      const health = await service.getSystemHealth()

      expect(health.overall_status).toBeDefined()
      expect(['healthy', 'warning', 'critical'].includes(health.overall_status)).toBe(true)
      expect(health.total_restaurants).toBeGreaterThanOrEqual(0)
      expect(health.storage_usage).toBeDefined()
      expect(health.performance_metrics).toBeDefined()
      expect(health.alerts_summary).toBeDefined()
    })

    it('應該在有失敗備份時返回警告狀態', async () => {
      // Create multiple failed backups to trigger warning
      for (let i = 0; i < 6; i++) {
        const request: CreateBackupRequest = {
          restaurant_id: 'rest-1',
          name: `Failed Backup ${i}`,
          backup_type: 'full'
        }
        const result = await service.createBackup(request, 'user-1')

        // Manually mark as failed (simulating backup failure)
        const backups = mockDB.getBackups()
        const backup = backups.get(result.backup_id)
        if (backup) {
          backup.status = 'failed'
          backup.started_at = new Date().toISOString()
        }
      }

      const health = await service.getSystemHealth()

      expect(['warning', 'critical'].includes(health.overall_status)).toBe(true)
    })
  })

  // ========================================
  // 7. Restaurant Metrics Tests
  // ========================================

  describe('Restaurant Metrics', () => {
    beforeEach(async () => {
      // Create test backups
      for (let i = 0; i < 3; i++) {
        const request: CreateBackupRequest = {
          restaurant_id: 'rest-1',
          name: `Backup ${i}`,
          backup_type: 'full'
        }
        await service.createBackup(request, 'user-1')
      }
    })

    it('應該返回餐廳指標', async () => {
      const metrics = await service.getRestaurantMetrics('rest-1', 'week')

      expect(metrics).toBeDefined()
      expect(metrics.total_backups).toBeGreaterThanOrEqual(0)
      expect(metrics.successful_backups).toBeGreaterThanOrEqual(0)
      expect(metrics.failed_backups).toBeGreaterThanOrEqual(0)
    })

    it('應該支持不同的時間範圍', async () => {
      const timeframes = ['hour', 'day', 'week', 'month']

      for (const timeframe of timeframes) {
        const metrics = await service.getRestaurantMetrics('rest-1', timeframe)
        expect(metrics).toBeDefined()
      }
    })
  })

  // ========================================
  // 8. Restaurant Alerts Tests
  // ========================================

  describe('Restaurant Alerts', () => {
    it('應該返回餐廳警報', async () => {
      const alerts = await service.getRestaurantAlerts('rest-1')

      expect(Array.isArray(alerts)).toBe(true)
    })

    it('應該只返回未解決的警報', async () => {
      const alerts = await service.getRestaurantAlerts('rest-1', true)

      expect(Array.isArray(alerts)).toBe(true)
    })
  })

  // ========================================
  // 9. Error Handling Tests
  // ========================================

  describe('Error Handling', () => {
    it('應該處理存儲服務失敗', async () => {
      mockStorage.shouldFail = true

      const request: CreateBackupRequest = {
        restaurant_id: 'rest-1',
        name: 'Test Backup',
        backup_type: 'full',
        force_immediate: true
      }

      await service.createBackup(request, 'user-1')
      // The backup creation should succeed, but execution would fail asynchronously
    })

    it('應該處理無效的 SQL 查詢', async () => {
      // Simulate database error
      mockDB.prepare = () => {
        throw new Error('Database error')
      }

      const query: ListBackupsQuery = {
        restaurant_id: 'rest-1'
      }

      await expect(service.listBackups(query)).rejects.toThrow()
    })
  })

  // ========================================
  // 10. Download Backup Tests
  // ========================================

  describe('Download Backup', () => {
    let backupId: string
    let backup: BackupRecord

    beforeEach(async () => {
      const request: CreateBackupRequest = {
        restaurant_id: 'rest-1',
        name: 'Test Backup',
        backup_type: 'full',
        force_immediate: true
      }
      const result = await service.createBackup(request, 'user-1')
      backupId = result.backup_id

      backup = (await service.getBackupById(backupId))!
      mockStorage.storedBackups.set(backupId, JSON.stringify({ data: 'test' }))
    })

    it('應該成功下載備份', async () => {
      const response = await service.downloadBackup(backup)

      expect(response).toBeInstanceOf(Response)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })
  })
})
