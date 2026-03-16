/**
 * Backup Validation Service - Handles all validation logic for backup operations
 * Migrated to Drizzle ORM
 */

import { Context } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, sql, count, sum, inArray } from 'drizzle-orm'
import {
  backupRecords
} from '@makanmakan/database'
import type {
  CreateBackupRequest,
  RestoreBackupRequest,
  BackupConfiguration
} from '@makanmakan/shared-types'

export class BackupValidationService {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * Validate create backup request
   */
  async validateCreateBackupRequest(request: CreateBackupRequest): Promise<void> {
    if (!request.restaurant_id || !this.isValidUUID(request.restaurant_id)) {
      throw new Error('Valid restaurant ID is required')
    }

    if (!request.name || request.name.trim().length === 0) {
      throw new Error('Backup name is required')
    }

    if (request.name.length > 100) {
      throw new Error('Backup name must be 100 characters or less')
    }

    if (request.description && request.description.length > 500) {
      throw new Error('Backup description must be 500 characters or less')
    }

    if (request.backup_type && !['full', 'incremental', 'differential'].includes(request.backup_type)) {
      throw new Error('Invalid backup type')
    }

    if (request.configuration_id && !this.isValidUUID(request.configuration_id)) {
      throw new Error('Invalid configuration ID')
    }
  }

  /**
   * Validate restore backup request
   */
  async validateRestoreRequest(request: RestoreBackupRequest): Promise<void> {
    if (!request.restaurant_id || !this.isValidUUID(request.restaurant_id)) {
      throw new Error('Valid restaurant ID is required')
    }

    if (!request.backup_id || !this.isValidUUID(request.backup_id)) {
      throw new Error('Valid backup ID is required')
    }

    if (!['full', 'selective'].includes(request.restore_type)) {
      throw new Error('Invalid restore type')
    }

    if (!request.safety_confirmation) {
      throw new Error('Safety confirmation is required')
    }

    if (request.safety_confirmation.confirmation_phrase !== 'I understand the risks') {
      throw new Error('Safety confirmation phrase is incorrect')
    }

    if (!request.safety_confirmation.backup_integrity_verified) {
      throw new Error('Backup integrity must be verified before restore')
    }

    if (!request.safety_confirmation.data_loss_risk_acknowledged) {
      throw new Error('Data loss risk must be acknowledged before restore')
    }

    if (request.restore_type === 'selective' && (!request.target_tables || request.target_tables.length === 0)) {
      throw new Error('Target tables must be specified for selective restore')
    }
  }

  /**
   * Validate backup configuration request
   */
  async validateConfigurationRequest(config: Partial<BackupConfiguration>): Promise<void> {
    if (!config.restaurant_id || !this.isValidUUID(config.restaurant_id)) {
      throw new Error('Valid restaurant ID is required')
    }

    if (!config.name || config.name.trim().length === 0) {
      throw new Error('Configuration name is required')
    }

    if (config.name.length > 100) {
      throw new Error('Configuration name must be 100 characters or less')
    }

    if (config.description && config.description.length > 500) {
      throw new Error('Configuration description must be 500 characters or less')
    }

    if (config.backup_type && !['full', 'incremental', 'differential'].includes(config.backup_type)) {
      throw new Error('Invalid backup type')
    }

    if (config.retention_days !== undefined && (config.retention_days < 1 || config.retention_days > 365)) {
      throw new Error('Retention days must be between 1 and 365')
    }

    if (config.max_parallel_backups !== undefined && (config.max_parallel_backups < 1 || config.max_parallel_backups > 10)) {
      throw new Error('Max parallel backups must be between 1 and 10')
    }

    if (config.schedule_enabled && config.schedule_cron) {
      await this.validateCronExpression(config.schedule_cron)
    }

    if (config.notification_channels && config.notification_channels.length > 0) {
      const validChannels = ['email', 'slack', 'discord', 'webhook']
      const invalidChannels = config.notification_channels.filter(channel => !validChannels.includes(channel))
      if (invalidChannels.length > 0) {
        throw new Error(`Invalid notification channels: ${invalidChannels.join(', ')}`)
      }
    }
  }

  /**
   * Verify restaurant access for the current user
   */
  async verifyRestaurantAccess(c: Context, restaurantId: string): Promise<void> {
    const user = c.get('user')

    // Admin users (role 0) have access to all restaurants
    if (user.role === 0) {
      return
    }

    // Check if user belongs to this restaurant - use raw sql for restaurant_users table
    const result = await this.db.run(sql`
      SELECT 1 FROM restaurant_users
      WHERE user_id = ${user.id} AND restaurant_id = ${restaurantId}
    `)

    if (!result || (result as any).results?.length === 0) {
      throw new Error('Access denied: You do not have permission to access this restaurant')
    }
  }

  /**
   * Validate UUID format
   */
  isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
  }

  /**
   * Validate cron expression (basic validation)
   */
  private async validateCronExpression(cron: string): Promise<void> {
    const cronParts = cron.trim().split(/\s+/)

    if (cronParts.length !== 5) {
      throw new Error('Cron expression must have exactly 5 parts (minute hour day month day-of-week)')
    }

    // Basic validation for each part
    const [minute, hour, day, month, dayOfWeek] = cronParts

    // Minute: 0-59
    if (!this.isValidCronField(minute, 0, 59)) {
      throw new Error('Invalid minute in cron expression (0-59)')
    }

    // Hour: 0-23
    if (!this.isValidCronField(hour, 0, 23)) {
      throw new Error('Invalid hour in cron expression (0-23)')
    }

    // Day: 1-31
    if (!this.isValidCronField(day, 1, 31)) {
      throw new Error('Invalid day in cron expression (1-31)')
    }

    // Month: 1-12
    if (!this.isValidCronField(month, 1, 12)) {
      throw new Error('Invalid month in cron expression (1-12)')
    }

    // Day of week: 0-7 (0 and 7 are Sunday)
    if (!this.isValidCronField(dayOfWeek, 0, 7)) {
      throw new Error('Invalid day of week in cron expression (0-7)')
    }
  }

  /**
   * Validate a single cron field
   */
  private isValidCronField(field: string, min: number, max: number): boolean {
    // Allow wildcard
    if (field === '*') return true

    // Allow step values (e.g., */5)
    if (field.includes('/')) {
      const [range, step] = field.split('/')
      if (range === '*') {
        const stepNum = parseInt(step)
        return !isNaN(stepNum) && stepNum > 0 && stepNum <= max
      }
    }

    // Allow ranges (e.g., 1-5)
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(n => parseInt(n))
      return !isNaN(start) && !isNaN(end) && start >= min && end <= max && start <= end
    }

    // Allow comma-separated values (e.g., 1,3,5)
    if (field.includes(',')) {
      const values = field.split(',').map(n => parseInt(n))
      return values.every(val => !isNaN(val) && val >= min && val <= max)
    }

    // Single numeric value
    const num = parseInt(field)
    return !isNaN(num) && num >= min && num <= max
  }

  /**
   * Check if backup operation is allowed (rate limiting, concurrent backups, etc.)
   */
  async checkBackupLimits(restaurantId: string): Promise<void> {
    // Check for concurrent backups
    const activeResult = await this.db.select({ total: count() })
      .from(backupRecords)
      .where(and(
        eq(backupRecords.restaurantId, restaurantId),
        inArray(backupRecords.status, ['pending', 'in_progress'])
      ))

    if ((activeResult[0]?.total || 0) >= 3) {
      throw new Error('Maximum number of concurrent backups reached. Please wait for existing backups to complete.')
    }

    // Check for recent backup attempts (prevent spam)
    const recentResult = await this.db.select({ total: count() })
      .from(backupRecords)
      .where(and(
        eq(backupRecords.restaurantId, restaurantId),
        sql`${backupRecords.startedAt} > datetime('now', '-1 hour')`
      ))

    if ((recentResult[0]?.total || 0) >= 10) {
      throw new Error('Too many backup attempts in the last hour. Please wait before creating more backups.')
    }
  }

  /**
   * Validate table names for backup/restore operations
   */
  async validateTableNames(tables: string[]): Promise<void> {
    const validTables = [
      'orders', 'order_items', 'menu_items', 'categories', 'tables', 'users',
      'restaurants', 'audit_logs', 'sessions', 'qr_codes', 'images'
    ]

    const invalidTables = tables.filter(table => !validTables.includes(table))
    if (invalidTables.length > 0) {
      throw new Error(`Invalid table names: ${invalidTables.join(', ')}`)
    }
  }

  /**
   * Check storage quota before backup
   */
  async checkStorageQuota(restaurantId: string): Promise<void> {
    // Get current storage usage for the restaurant
    const storageResult = await this.db.select({
      totalSize: sql<number>`COALESCE(SUM(${backupRecords.fileSize}), 0)`
    })
      .from(backupRecords)
      .where(and(
        eq(backupRecords.restaurantId, restaurantId),
        eq(backupRecords.status, 'completed')
      ))

    const totalSizeBytes = storageResult[0]?.totalSize || 0
    const maxStorageBytes = 10 * 1024 * 1024 * 1024 // 10GB limit per restaurant

    if (totalSizeBytes >= maxStorageBytes) {
      throw new Error('Storage quota exceeded. Please delete old backups or contact support to increase your quota.')
    }
  }
}
