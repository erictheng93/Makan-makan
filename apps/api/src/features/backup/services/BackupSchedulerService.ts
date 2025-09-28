/**
 * Backup Scheduler Service - Handles scheduled backup operations
 */

import type { D1Database, AnalyticsEngineDataset } from '@cloudflare/workers-types'
import { BackupService } from './BackupService'
import { BackupConfigService } from './BackupConfigService'
import type { BackupConfiguration, CreateBackupRequest } from '@makanmakan/shared-types'

export interface ScheduleInfo {
  id: string
  configuration_id: string
  restaurant_id: string
  last_run_at?: string
  next_run_at?: string
  consecutive_failures: number
  enabled: boolean
}

export class BackupSchedulerService {
  constructor(
    private db: D1Database,
    private backupService: BackupService,
    private configService: BackupConfigService,
    private analytics?: AnalyticsEngineDataset
  ) {}

  /**
   * Process all scheduled backups that are due to run
   */
  async processScheduledBackups(): Promise<{
    processed: number
    succeeded: number
    failed: number
    errors: string[]
  }> {
    const now = new Date()
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[]
    }

    try {
      const scheduledConfigs = await this.getScheduledConfigurations()

      for (const config of scheduledConfigs) {
        results.processed++

        try {
          if (await this.shouldRunBackup(config, now)) {
            await this.executeScheduledBackup(config, now)
            results.succeeded++

            // Track successful scheduling
            this.analytics?.writeDataPoint({
              blobs: [
                'scheduled_backup_created',
                config.restaurant_id,
                config.id
              ],
              doubles: [Date.now()],
              indexes: ['scheduled_backup']
            })
          }
        } catch (error) {
          results.failed++
          const errorMessage = `Failed to process scheduled backup for ${config.restaurant_id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          results.errors.push(errorMessage)
          console.error(errorMessage)

          // Update consecutive failures count
          await this.updateConsecutiveFailures(config.id)

          // Track failed scheduling
          this.analytics?.writeDataPoint({
            blobs: [
              'scheduled_backup_failed',
              config.restaurant_id,
              config.id,
              errorMessage
            ],
            doubles: [Date.now()],
            indexes: ['scheduled_backup_failed']
          })
        }
      }

      return results

    } catch (error) {
      console.error('Error processing scheduled backups:', error)
      throw new Error(`Failed to process scheduled backups: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute a scheduled backup for a specific configuration
   */
  async executeScheduledBackup(config: BackupConfiguration, scheduledTime: Date): Promise<string> {
    try {
      const backupRequest: CreateBackupRequest = {
        restaurant_id: config.restaurant_id,
        configuration_id: config.id,
        name: `Scheduled_${config.name}_${scheduledTime.toISOString().split('T')[0]}`,
        description: `Automated backup created by scheduler at ${scheduledTime.toISOString()}`,
        backup_type: config.backup_type,
        include_tables: config.include_tables,
        exclude_tables: config.exclude_tables,
        force_immediate: false
      }

      const response = await this.backupService.createBackup(backupRequest, 'system')

      // Update schedule's last run time
      await this.updateScheduleLastRun(config.id, scheduledTime)

      // Calculate and update next run time
      const nextRun = this.calculateNextRun(config.schedule_cron!, scheduledTime)
      if (nextRun) {
        await this.updateScheduleNextRun(config.id, nextRun)
      }

      console.log(`Successfully scheduled backup for restaurant ${config.restaurant_id}, backup ID: ${response.backup_id}`)

      return response.backup_id

    } catch (error) {
      console.error(`Error executing scheduled backup for ${config.restaurant_id}:`, error)
      throw error
    }
  }

  /**
   * Check if a backup should run based on its schedule
   */
  async shouldRunBackup(config: BackupConfiguration, currentTime: Date): Promise<boolean> {
    if (!config.schedule_enabled || !config.schedule_cron) {
      return false
    }

    // Get schedule information
    const scheduleInfo = await this.getScheduleInfo(config.id)

    // Don't run if there are too many consecutive failures
    if (scheduleInfo && scheduleInfo.consecutive_failures >= 5) {
      console.warn(`Skipping backup for ${config.restaurant_id} due to ${scheduleInfo.consecutive_failures} consecutive failures`)
      return false
    }

    // Check if it's time to run based on cron expression
    return this.isCronDue(config.schedule_cron, scheduleInfo?.last_run_at, currentTime)
  }

  /**
   * Create or update a backup schedule
   */
  async createOrUpdateSchedule(configId: string, restaurantId: string, cronExpression: string): Promise<void> {
    try {
      const nextRun = this.calculateNextRun(cronExpression, new Date())

      await this.db.prepare(`
        INSERT OR REPLACE INTO backup_schedules (
          id, configuration_id, restaurant_id, cron_expression, enabled,
          next_run_at, consecutive_failures, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        configId,
        restaurantId,
        cronExpression,
        1, // enabled
        nextRun?.toISOString(),
        0, // consecutive_failures
        new Date().toISOString(),
        new Date().toISOString()
      ).run()

    } catch (error) {
      console.error('Error creating/updating backup schedule:', error)
      throw new Error('Failed to create/update backup schedule')
    }
  }

  /**
   * Disable a backup schedule
   */
  async disableSchedule(configId: string): Promise<void> {
    try {
      await this.db.prepare(`
        UPDATE backup_schedules SET enabled = 0, updated_at = ? WHERE configuration_id = ?
      `).bind(new Date().toISOString(), configId).run()

    } catch (error) {
      console.error('Error disabling backup schedule:', error)
      throw new Error('Failed to disable backup schedule')
    }
  }

  /**
   * Get all active scheduled configurations
   */
  async getScheduledConfigurations(): Promise<BackupConfiguration[]> {
    try {
      const result = await this.db.prepare(`
        SELECT bc.* FROM backup_configurations bc
        JOIN backup_schedules bs ON bc.id = bs.configuration_id
        WHERE bc.schedule_enabled = 1
        AND bc.schedule_cron IS NOT NULL
        AND bs.enabled = 1
        ORDER BY bc.restaurant_id, bc.name
      `).all()

      return this.parseConfigurations(result.results as any[])

    } catch (error) {
      console.error('Error fetching scheduled configurations:', error)
      throw new Error('Failed to fetch scheduled configurations')
    }
  }

  /**
   * Get schedule information for a configuration
   */
  async getScheduleInfo(configId: string): Promise<ScheduleInfo | null> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM backup_schedules WHERE configuration_id = ?
      `).bind(configId).first()

      return result as ScheduleInfo | null

    } catch (error) {
      console.error('Error fetching schedule info:', error)
      return null
    }
  }

  /**
   * Get upcoming scheduled backups
   */
  async getUpcomingBackups(hours: number = 24): Promise<Array<{
    configuration: BackupConfiguration
    scheduled_time: string
    restaurant_name?: string
  }>> {
    try {
      const futureTime = new Date()
      futureTime.setHours(futureTime.getHours() + hours)

      const result = await this.db.prepare(`
        SELECT
          bc.*,
          bs.next_run_at,
          r.name as restaurant_name
        FROM backup_configurations bc
        JOIN backup_schedules bs ON bc.id = bs.configuration_id
        LEFT JOIN restaurants r ON bc.restaurant_id = r.id
        WHERE bc.schedule_enabled = 1
        AND bs.enabled = 1
        AND bs.next_run_at IS NOT NULL
        AND bs.next_run_at <= ?
        ORDER BY bs.next_run_at ASC
      `).bind(futureTime.toISOString()).all()

      return (result.results as any[]).map(row => ({
        configuration: this.parseConfiguration(row),
        scheduled_time: row.next_run_at,
        restaurant_name: row.restaurant_name
      }))

    } catch (error) {
      console.error('Error fetching upcoming backups:', error)
      throw new Error('Failed to fetch upcoming backups')
    }
  }

  /**
   * Check if a cron expression is due to run
   */
  private isCronDue(cronExpression: string, lastRunAt: string | undefined, currentTime: Date): boolean {
    try {
      // Simple cron parsing - in production, use a proper cron parser library
      const cronParts = cronExpression.split(' ')
      if (cronParts.length !== 5) {
        console.warn(`Invalid cron expression: ${cronExpression}`)
        return false
      }

      const [minute, hour, day, month, dayOfWeek] = cronParts

      // Check if current time matches the cron pattern
      const now = currentTime
      const cronMatches = this.matchesCronPattern(minute, now.getMinutes()) &&
                          this.matchesCronPattern(hour, now.getHours()) &&
                          this.matchesCronPattern(day, now.getDate()) &&
                          this.matchesCronPattern(month, now.getMonth() + 1) &&
                          this.matchesCronPattern(dayOfWeek, now.getDay())

      if (!cronMatches) {
        return false
      }

      // If never run before, run now
      if (!lastRunAt) {
        return true
      }

      // Check if enough time has passed since last run
      const lastRun = new Date(lastRunAt)
      const timeDiff = now.getTime() - lastRun.getTime()
      const minInterval = 30 * 60 * 1000 // Minimum 30 minutes between runs

      return timeDiff >= minInterval

    } catch (error) {
      console.error('Error checking cron due time:', error)
      return false
    }
  }

  /**
   * Check if a value matches a cron pattern
   */
  private matchesCronPattern(pattern: string, value: number): boolean {
    if (pattern === '*') return true

    // Handle step values (e.g., */5)
    if (pattern.includes('/')) {
      const [range, step] = pattern.split('/')
      const stepNum = parseInt(step)
      if (range === '*') {
        return value % stepNum === 0
      }
    }

    // Handle ranges (e.g., 1-5)
    if (pattern.includes('-')) {
      const [start, end] = pattern.split('-').map(n => parseInt(n))
      return value >= start && value <= end
    }

    // Handle comma-separated values (e.g., 1,3,5)
    if (pattern.includes(',')) {
      const values = pattern.split(',').map(n => parseInt(n))
      return values.includes(value)
    }

    // Single numeric value
    return parseInt(pattern) === value
  }

  /**
   * Calculate the next run time for a cron expression
   */
  private calculateNextRun(cronExpression: string, fromTime: Date): Date | null {
    try {
      // This is a simplified implementation
      // In production, use a proper cron library like node-cron
      const nextRun = new Date(fromTime)

      // For daily backups (e.g., "0 2 * * *"), schedule for next day at 2 AM
      if (cronExpression === '0 2 * * *') {
        nextRun.setDate(nextRun.getDate() + 1)
        nextRun.setHours(2, 0, 0, 0)
        return nextRun
      }

      // For hourly backups (e.g., "0 * * * *"), schedule for next hour
      if (cronExpression === '0 * * * *') {
        nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0)
        return nextRun
      }

      // Add more cron patterns as needed
      console.warn(`Unsupported cron expression for next run calculation: ${cronExpression}`)
      return null

    } catch (error) {
      console.error('Error calculating next run time:', error)
      return null
    }
  }

  private async updateScheduleLastRun(configId: string, timestamp: Date): Promise<void> {
    await this.db.prepare(`
      UPDATE backup_schedules
      SET last_run_at = ?, consecutive_failures = 0, updated_at = ?
      WHERE configuration_id = ?
    `).bind(timestamp.toISOString(), new Date().toISOString(), configId).run()
  }

  private async updateScheduleNextRun(configId: string, nextRun: Date): Promise<void> {
    await this.db.prepare(`
      UPDATE backup_schedules
      SET next_run_at = ?, updated_at = ?
      WHERE configuration_id = ?
    `).bind(nextRun.toISOString(), new Date().toISOString(), configId).run()
  }

  private async updateConsecutiveFailures(configId: string): Promise<void> {
    await this.db.prepare(`
      UPDATE backup_schedules
      SET consecutive_failures = consecutive_failures + 1, updated_at = ?
      WHERE configuration_id = ?
    `).bind(new Date().toISOString(), configId).run()
  }

  private parseConfiguration(row: any): BackupConfiguration {
    return {
      ...row,
      schedule_enabled: Boolean(row.schedule_enabled),
      compression_enabled: Boolean(row.compression_enabled),
      encryption_enabled: Boolean(row.encryption_enabled),
      notifications_enabled: Boolean(row.notifications_enabled),
      include_tables: JSON.parse(row.include_tables || '[]'),
      exclude_tables: JSON.parse(row.exclude_tables || '[]'),
      notification_channels: JSON.parse(row.notification_channels || '[]')
    }
  }

  private parseConfigurations(rows: any[]): BackupConfiguration[] {
    return rows.map(row => this.parseConfiguration(row))
  }
}