/**
 * BackupValidationService Tests
 * 驗證備份操作的所有輸入驗證邏輯
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BackupValidationService } from '../BackupValidationService'
import type {
  CreateBackupRequest,
  RestoreBackupRequest,
  BackupConfiguration
} from '@makanmakan/shared-types'

// ========================================
// Mock Drizzle ORM
// ========================================

const { mockSelectChain, mockDrizzleDb } = vi.hoisted(() => {
  const mockSelectChain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  }
  mockSelectChain.then = (resolve: any, reject: any) =>
    Promise.resolve([{ total: 0 }]).then(resolve, reject)

  const mockDrizzleDb = {
    select: vi.fn().mockReturnValue(mockSelectChain),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    run: vi.fn().mockResolvedValue({ results: [{ '1': 1 }] })
  }

  return { mockSelectChain, mockDrizzleDb }
})

vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn().mockReturnValue(mockDrizzleDb)
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  sql: vi.fn((...args: any[]) => args),
  count: vi.fn(() => 'count'),
  sum: vi.fn(() => 'sum'),
  inArray: vi.fn((...args: any[]) => args)
}))

vi.mock('@makanmakan/database', () => ({
  backupRecords: {
    restaurantId: 'restaurantId',
    status: 'status',
    startedAt: 'startedAt',
    fileSize: 'fileSize'
  }
}))

// ========================================
// Test Helpers
// ========================================

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440001'

const buildCreateRequest = (overrides: Partial<CreateBackupRequest> = {}): CreateBackupRequest => ({
  restaurant_id: VALID_UUID,
  name: 'Daily Backup',
  backup_type: 'full',
  ...overrides
} as CreateBackupRequest)

const buildRestoreRequest = (overrides: Partial<RestoreBackupRequest> = {}): RestoreBackupRequest => ({
  restaurant_id: VALID_UUID,
  backup_id: VALID_UUID_2,
  restore_type: 'full',
  safety_confirmation: {
    confirmation_phrase: 'I understand the risks',
    backup_integrity_verified: true,
    data_loss_risk_acknowledged: true
  },
  ...overrides
} as RestoreBackupRequest)

// ========================================
// Tests
// ========================================

describe('BackupValidationService', () => {
  let service: BackupValidationService
  const mockD1 = {} as any

  beforeEach(() => {
    vi.clearAllMocks()
    service = new BackupValidationService(mockD1)

    // Reset the select chain to return 0 counts by default
    mockSelectChain.then = (resolve: any, reject: any) =>
      Promise.resolve([{ total: 0, totalSize: 0 }]).then(resolve, reject)
  })

  // ========================================
  // validateCreateBackupRequest
  // ========================================

  describe('validateCreateBackupRequest - 建立備份請求驗證', () => {
    it('should pass validation for a valid request', async () => {
      await expect(
        service.validateCreateBackupRequest(buildCreateRequest())
      ).resolves.toBeUndefined()
    })

    it('should reject missing restaurant_id', async () => {
      await expect(
        service.validateCreateBackupRequest(buildCreateRequest({ restaurant_id: '' }))
      ).rejects.toThrow('Valid restaurant ID is required')
    })

    it('should reject invalid UUID for restaurant_id', async () => {
      await expect(
        service.validateCreateBackupRequest(buildCreateRequest({ restaurant_id: 'not-a-uuid' }))
      ).rejects.toThrow('Valid restaurant ID is required')
    })

    it('should reject missing backup name', async () => {
      await expect(
        service.validateCreateBackupRequest(buildCreateRequest({ name: '' }))
      ).rejects.toThrow('Backup name is required')
    })

    it('should reject whitespace-only backup name', async () => {
      await expect(
        service.validateCreateBackupRequest(buildCreateRequest({ name: '   ' }))
      ).rejects.toThrow('Backup name is required')
    })

    it('should reject backup name exceeding 100 characters', async () => {
      await expect(
        service.validateCreateBackupRequest(buildCreateRequest({ name: 'x'.repeat(101) }))
      ).rejects.toThrow('Backup name must be 100 characters or less')
    })

    it('should accept backup name at exactly 100 characters', async () => {
      await expect(
        service.validateCreateBackupRequest(buildCreateRequest({ name: 'x'.repeat(100) }))
      ).resolves.toBeUndefined()
    })

    it('should reject description exceeding 500 characters', async () => {
      await expect(
        service.validateCreateBackupRequest(buildCreateRequest({ description: 'x'.repeat(501) }))
      ).rejects.toThrow('Backup description must be 500 characters or less')
    })

    it('should reject invalid backup type', async () => {
      await expect(
        service.validateCreateBackupRequest(buildCreateRequest({ backup_type: 'snapshot' as any }))
      ).rejects.toThrow('Invalid backup type')
    })

    it('should accept valid backup types', async () => {
      for (const type of ['full', 'incremental', 'differential'] as const) {
        await expect(
          service.validateCreateBackupRequest(buildCreateRequest({ backup_type: type }))
        ).resolves.toBeUndefined()
      }
    })

    it('should reject invalid configuration_id UUID', async () => {
      await expect(
        service.validateCreateBackupRequest(buildCreateRequest({ configuration_id: 'bad-id' }))
      ).rejects.toThrow('Invalid configuration ID')
    })
  })

  // ========================================
  // validateRestoreRequest
  // ========================================

  describe('validateRestoreRequest - 還原請求驗證', () => {
    it('should pass validation for a valid restore request', async () => {
      await expect(
        service.validateRestoreRequest(buildRestoreRequest())
      ).resolves.toBeUndefined()
    })

    it('should reject missing restaurant_id', async () => {
      await expect(
        service.validateRestoreRequest(buildRestoreRequest({ restaurant_id: '' }))
      ).rejects.toThrow('Valid restaurant ID is required')
    })

    it('should reject missing backup_id', async () => {
      await expect(
        service.validateRestoreRequest(buildRestoreRequest({ backup_id: '' }))
      ).rejects.toThrow('Valid backup ID is required')
    })

    it('should reject invalid restore_type', async () => {
      await expect(
        service.validateRestoreRequest(buildRestoreRequest({ restore_type: 'partial' as any }))
      ).rejects.toThrow('Invalid restore type')
    })

    it('should reject missing safety confirmation', async () => {
      await expect(
        service.validateRestoreRequest(buildRestoreRequest({ safety_confirmation: undefined as any }))
      ).rejects.toThrow('Safety confirmation is required')
    })

    it('should reject wrong confirmation phrase', async () => {
      await expect(
        service.validateRestoreRequest(buildRestoreRequest({
          safety_confirmation: {
            confirmation_phrase: 'wrong phrase',
            backup_integrity_verified: true,
            data_loss_risk_acknowledged: true
          }
        }))
      ).rejects.toThrow('Safety confirmation phrase is incorrect')
    })

    it('should reject unverified backup integrity', async () => {
      await expect(
        service.validateRestoreRequest(buildRestoreRequest({
          safety_confirmation: {
            confirmation_phrase: 'I understand the risks',
            backup_integrity_verified: false,
            data_loss_risk_acknowledged: true
          }
        }))
      ).rejects.toThrow('Backup integrity must be verified before restore')
    })

    it('should reject unacknowledged data loss risk', async () => {
      await expect(
        service.validateRestoreRequest(buildRestoreRequest({
          safety_confirmation: {
            confirmation_phrase: 'I understand the risks',
            backup_integrity_verified: true,
            data_loss_risk_acknowledged: false
          }
        }))
      ).rejects.toThrow('Data loss risk must be acknowledged before restore')
    })

    it('should reject selective restore without target tables', async () => {
      await expect(
        service.validateRestoreRequest(buildRestoreRequest({
          restore_type: 'selective',
          target_tables: []
        }))
      ).rejects.toThrow('Target tables must be specified for selective restore')
    })

    it('should accept selective restore with target tables', async () => {
      await expect(
        service.validateRestoreRequest(buildRestoreRequest({
          restore_type: 'selective',
          target_tables: ['orders', 'menu_items']
        }))
      ).resolves.toBeUndefined()
    })
  })

  // ========================================
  // validateConfigurationRequest
  // ========================================

  describe('validateConfigurationRequest - 設定請求驗證', () => {
    const buildConfig = (overrides: Partial<BackupConfiguration> = {}): Partial<BackupConfiguration> => ({
      restaurant_id: VALID_UUID,
      name: 'Test Config',
      ...overrides
    })

    it('should pass for valid configuration', async () => {
      await expect(
        service.validateConfigurationRequest(buildConfig())
      ).resolves.toBeUndefined()
    })

    it('should reject retention_days below 1', async () => {
      await expect(
        service.validateConfigurationRequest(buildConfig({ retention_days: 0 }))
      ).rejects.toThrow('Retention days must be between 1 and 365')
    })

    it('should reject retention_days above 365', async () => {
      await expect(
        service.validateConfigurationRequest(buildConfig({ retention_days: 366 }))
      ).rejects.toThrow('Retention days must be between 1 and 365')
    })

    it('should reject max_parallel_backups below 1', async () => {
      await expect(
        service.validateConfigurationRequest(buildConfig({ max_parallel_backups: 0 }))
      ).rejects.toThrow('Max parallel backups must be between 1 and 10')
    })

    it('should reject max_parallel_backups above 10', async () => {
      await expect(
        service.validateConfigurationRequest(buildConfig({ max_parallel_backups: 11 }))
      ).rejects.toThrow('Max parallel backups must be between 1 and 10')
    })

    it('should reject invalid notification channels', async () => {
      await expect(
        service.validateConfigurationRequest(buildConfig({
          notification_channels: ['email', 'sms', 'pigeon']
        }))
      ).rejects.toThrow('Invalid notification channels: sms, pigeon')
    })

    it('should accept valid notification channels', async () => {
      await expect(
        service.validateConfigurationRequest(buildConfig({
          notification_channels: ['email', 'slack', 'discord', 'webhook']
        }))
      ).resolves.toBeUndefined()
    })

    it('should validate cron expression when schedule is enabled', async () => {
      await expect(
        service.validateConfigurationRequest(buildConfig({
          schedule_enabled: true,
          schedule_cron: '0 2 * * *'
        }))
      ).resolves.toBeUndefined()
    })

    it('should reject invalid cron expression', async () => {
      await expect(
        service.validateConfigurationRequest(buildConfig({
          schedule_enabled: true,
          schedule_cron: '* *'  // Only 2 parts
        }))
      ).rejects.toThrow('Cron expression must have exactly 5 parts')
    })
  })

  // ========================================
  // verifyRestaurantAccess
  // ========================================

  describe('verifyRestaurantAccess - 餐廳存取權限驗證', () => {
    it('should allow admin access to any restaurant', async () => {
      const mockContext = {
        get: vi.fn().mockReturnValue({ id: 1, role: 0 })
      } as any

      await expect(
        service.verifyRestaurantAccess(mockContext, VALID_UUID)
      ).resolves.toBeUndefined()

      // Admin bypass should not query DB
      expect(mockDrizzleDb.run).not.toHaveBeenCalled()
    })

    it('should query DB for non-admin users', async () => {
      mockDrizzleDb.run.mockResolvedValue({ results: [{ '1': 1 }] })

      const mockContext = {
        get: vi.fn().mockReturnValue({ id: 42, role: 1 })
      } as any

      await expect(
        service.verifyRestaurantAccess(mockContext, VALID_UUID)
      ).resolves.toBeUndefined()

      expect(mockDrizzleDb.run).toHaveBeenCalledOnce()
    })

    it('should deny access when user is not in the restaurant', async () => {
      mockDrizzleDb.run.mockResolvedValue({ results: [] })

      const mockContext = {
        get: vi.fn().mockReturnValue({ id: 42, role: 1 })
      } as any

      await expect(
        service.verifyRestaurantAccess(mockContext, VALID_UUID)
      ).rejects.toThrow('Access denied')
    })
  })

  // ========================================
  // isValidUUID
  // ========================================

  describe('isValidUUID - UUID 格式驗證', () => {
    it('should accept valid UUIDs', () => {
      expect(service.isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
      expect(service.isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true)
    })

    it('should reject invalid UUIDs', () => {
      expect(service.isValidUUID('')).toBe(false)
      expect(service.isValidUUID('not-a-uuid')).toBe(false)
      expect(service.isValidUUID('123')).toBe(false)
      expect(service.isValidUUID('550e8400-e29b-61d4-a716-446655440000')).toBe(false) // version 6 not in 1-5
    })
  })

  // ========================================
  // checkBackupLimits
  // ========================================

  describe('checkBackupLimits - 備份限制檢查', () => {
    it('should pass when limits are not exceeded', async () => {
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([{ total: 1 }]).then(resolve)

      await expect(service.checkBackupLimits(VALID_UUID)).resolves.toBeUndefined()
    })

    it('should reject when concurrent backups are at maximum', async () => {
      // First call returns 3 (concurrent limit), second call would return 0
      let callCount = 0
      mockSelectChain.then = (resolve: any) => {
        callCount++
        return Promise.resolve([{ total: callCount === 1 ? 3 : 0 }]).then(resolve)
      }

      await expect(service.checkBackupLimits(VALID_UUID))
        .rejects.toThrow('Maximum number of concurrent backups reached')
    })

    it('should reject when too many recent backup attempts', async () => {
      let callCount = 0
      mockSelectChain.then = (resolve: any) => {
        callCount++
        return Promise.resolve([{ total: callCount === 1 ? 0 : 10 }]).then(resolve)
      }

      await expect(service.checkBackupLimits(VALID_UUID))
        .rejects.toThrow('Too many backup attempts in the last hour')
    })
  })

  // ========================================
  // validateTableNames
  // ========================================

  describe('validateTableNames - 表格名稱驗證', () => {
    it('should accept valid table names', async () => {
      await expect(
        service.validateTableNames(['orders', 'menu_items', 'categories'])
      ).resolves.toBeUndefined()
    })

    it('should reject invalid table names', async () => {
      await expect(
        service.validateTableNames(['orders', 'fake_table', 'hacks'])
      ).rejects.toThrow('Invalid table names: fake_table, hacks')
    })
  })

  // ========================================
  // checkStorageQuota
  // ========================================

  describe('checkStorageQuota - 儲存配額檢查', () => {
    it('should pass when under quota', async () => {
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([{ totalSize: 100 }]).then(resolve)

      await expect(service.checkStorageQuota(VALID_UUID)).resolves.toBeUndefined()
    })

    it('should reject when storage quota exceeded (10GB)', async () => {
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([{ totalSize: 10 * 1024 * 1024 * 1024 }]).then(resolve)

      await expect(service.checkStorageQuota(VALID_UUID))
        .rejects.toThrow('Storage quota exceeded')
    })
  })
})
