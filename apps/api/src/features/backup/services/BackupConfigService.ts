/**
 * Backup Configuration Service - Manages backup configurations
 */

import type { D1Database } from '@cloudflare/workers-types'
import type { BackupConfiguration } from '@makanmakan/shared-types'

export class BackupConfigService {
  constructor(private db: D1Database) {}

  /**
   * Get all configurations for a restaurant
   */
  async getConfigurations(restaurantId: string): Promise<BackupConfiguration[]> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM backup_configurations
        WHERE restaurant_id = ?
        ORDER BY created_at DESC
      `).bind(restaurantId).all()

      return this.parseConfigurations(result.results as any[]) || []

    } catch (error) {
      console.error('Error fetching backup configurations:', error)
      throw new Error('Failed to fetch backup configurations')
    }
  }

  /**
   * Get a specific configuration by ID
   */
  async getConfigurationById(configId: string): Promise<BackupConfiguration | null> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM backup_configurations
        WHERE id = ?
      `).bind(configId).first()

      return result ? this.parseConfiguration(result as any) : null

    } catch (error) {
      console.error('Error fetching backup configuration:', error)
      throw new Error('Failed to fetch backup configuration')
    }
  }

  /**
   * Get default configuration for a restaurant
   */
  async getDefaultConfiguration(restaurantId: string): Promise<BackupConfiguration | null> {
    try {
      // First try to get an existing default configuration
      const result = await this.db.prepare(`
        SELECT * FROM backup_configurations
        WHERE restaurant_id = ? AND name = 'Default Configuration'
        LIMIT 1
      `).bind(restaurantId).first()

      if (result) {
        return this.parseConfiguration(result as Record<string, unknown>)
      }

      // If no default exists, create one
      const defaultConfig: BackupConfiguration = {
        id: crypto.randomUUID(),
        restaurant_id: restaurantId,
        name: 'Default Configuration',
        description: 'Default backup configuration',
        backup_type: 'full',
        schedule_enabled: false,
        retention_days: 30,
        include_tables: ['orders', 'order_items', 'menu_items', 'categories', 'tables'],
        exclude_tables: [],
        compression_enabled: true,
        encryption_enabled: false,
        storage_provider: 'r2',
        max_parallel_backups: 1,
        notifications_enabled: false,
        notification_channels: [],
        created_by: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      await this.createConfiguration(defaultConfig)
      return defaultConfig

    } catch (error) {
      console.error('Error getting default configuration:', error)
      throw new Error('Failed to get default configuration')
    }
  }

  /**
   * Create a new configuration
   */
  async createConfiguration(config: BackupConfiguration): Promise<BackupConfiguration> {
    try {
      await this.db.prepare(`
        INSERT INTO backup_configurations (
          id, restaurant_id, name, description, backup_type, schedule_enabled,
          schedule_cron, retention_days, include_tables, exclude_tables,
          compression_enabled, encryption_enabled, storage_provider,
          max_parallel_backups, notifications_enabled, notification_channels,
          created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        config.id,
        config.restaurant_id,
        config.name,
        config.description,
        config.backup_type,
        config.schedule_enabled ? 1 : 0,
        config.schedule_cron,
        config.retention_days,
        JSON.stringify(config.include_tables || []),
        JSON.stringify(config.exclude_tables || []),
        config.compression_enabled ? 1 : 0,
        config.encryption_enabled ? 1 : 0,
        config.storage_provider,
        config.max_parallel_backups,
        config.notifications_enabled ? 1 : 0,
        JSON.stringify(config.notification_channels || []),
        config.created_by,
        config.created_at,
        config.updated_at
      ).run()

      return config

    } catch (error) {
      console.error('Error creating backup configuration:', error)
      throw new Error('Failed to create backup configuration')
    }
  }

  /**
   * Update an existing configuration
   */
  async updateConfiguration(configId: string, updates: Partial<BackupConfiguration>): Promise<BackupConfiguration> {
    try {
      const existing = await this.getConfigurationById(configId)
      if (!existing) {
        throw new Error('Configuration not found')
      }

      const updated: BackupConfiguration = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString()
      }

      await this.db.prepare(`
        UPDATE backup_configurations SET
          name = ?, description = ?, backup_type = ?, schedule_enabled = ?,
          schedule_cron = ?, retention_days = ?, include_tables = ?, exclude_tables = ?,
          compression_enabled = ?, encryption_enabled = ?, storage_provider = ?,
          max_parallel_backups = ?, notifications_enabled = ?, notification_channels = ?,
          updated_at = ?
        WHERE id = ?
      `).bind(
        updated.name,
        updated.description,
        updated.backup_type,
        updated.schedule_enabled ? 1 : 0,
        updated.schedule_cron,
        updated.retention_days,
        JSON.stringify(updated.include_tables || []),
        JSON.stringify(updated.exclude_tables || []),
        updated.compression_enabled ? 1 : 0,
        updated.encryption_enabled ? 1 : 0,
        updated.storage_provider,
        updated.max_parallel_backups,
        updated.notifications_enabled ? 1 : 0,
        JSON.stringify(updated.notification_channels || []),
        updated.updated_at,
        configId
      ).run()

      return updated

    } catch (error) {
      console.error('Error updating backup configuration:', error)
      throw new Error('Failed to update backup configuration')
    }
  }

  /**
   * Create or update configuration (upsert operation)
   */
  async createOrUpdateConfiguration(configInput: Partial<BackupConfiguration>, userId: string): Promise<BackupConfiguration> {
    try {
      if (configInput.id) {
        // Update existing configuration
        const updates = {
          ...configInput,
          updated_at: new Date().toISOString()
        }
        return await this.updateConfiguration(configInput.id, updates)
      } else {
        // Create new configuration
        const config: BackupConfiguration = {
          id: crypto.randomUUID(),
          restaurant_id: configInput.restaurant_id!,
          name: configInput.name!,
          description: configInput.description,
          backup_type: configInput.backup_type || 'full',
          schedule_enabled: configInput.schedule_enabled || false,
          schedule_cron: configInput.schedule_cron,
          retention_days: configInput.retention_days || 30,
          include_tables: configInput.include_tables,
          exclude_tables: configInput.exclude_tables,
          compression_enabled: configInput.compression_enabled !== false, // default true
          encryption_enabled: configInput.encryption_enabled || false,
          storage_provider: configInput.storage_provider || 'r2',
          max_parallel_backups: configInput.max_parallel_backups || 1,
          notifications_enabled: configInput.notifications_enabled || false,
          notification_channels: configInput.notification_channels || [],
          created_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        return await this.createConfiguration(config)
      }

    } catch (error) {
      console.error('Error creating/updating backup configuration:', error)
      throw new Error('Failed to save backup configuration')
    }
  }

  /**
   * Delete a configuration
   */
  async deleteConfiguration(configId: string): Promise<void> {
    try {
      // Check if configuration is in use by any backups
      const usageCheck = await this.db.prepare(`
        SELECT COUNT(*) as count
        FROM backup_records
        WHERE configuration_id = ?
      `).bind(configId).first()

      if ((usageCheck as any)?.count > 0) {
        throw new Error('Cannot delete configuration that is being used by existing backups')
      }

      await this.db.prepare(`
        DELETE FROM backup_configurations
        WHERE id = ?
      `).bind(configId).run()

    } catch (error) {
      console.error('Error deleting backup configuration:', error)
      throw new Error('Failed to delete backup configuration')
    }
  }

  /**
   * Get configurations with active schedules
   */
  async getScheduledConfigurations(): Promise<BackupConfiguration[]> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM backup_configurations
        WHERE schedule_enabled = 1 AND schedule_cron IS NOT NULL
        ORDER BY restaurant_id, name
      `).all()

      return this.parseConfigurations(result.results as any[]) || []

    } catch (error) {
      console.error('Error fetching scheduled configurations:', error)
      throw new Error('Failed to fetch scheduled configurations')
    }
  }

  /**
   * Validate configuration compatibility
   */
  async validateConfigurationCompatibility(config: BackupConfiguration): Promise<void> {
    // Check if the storage provider is available
    if (config.storage_provider === 'external') {
      throw new Error('External storage provider is not currently supported')
    }

    // Validate table combinations
    if (config.include_tables && config.exclude_tables) {
      const overlapping = config.include_tables.filter(table =>
        config.exclude_tables!.includes(table)
      )
      if (overlapping.length > 0) {
        throw new Error(`Tables cannot be both included and excluded: ${overlapping.join(', ')}`)
      }
    }

    // Validate schedule settings
    if (config.schedule_enabled && !config.schedule_cron) {
      throw new Error('Schedule is enabled but no cron expression provided')
    }

    // Validate notification settings
    if (config.notifications_enabled && (!config.notification_channels || config.notification_channels.length === 0)) {
      throw new Error('Notifications are enabled but no notification channels specified')
    }
  }

  /**
   * Clone a configuration for another restaurant
   */
  async cloneConfiguration(sourceConfigId: string, targetRestaurantId: string, userId: string): Promise<BackupConfiguration> {
    try {
      const sourceConfig = await this.getConfigurationById(sourceConfigId)
      if (!sourceConfig) {
        throw new Error('Source configuration not found')
      }

      const clonedConfig: BackupConfiguration = {
        ...sourceConfig,
        id: crypto.randomUUID(),
        restaurant_id: targetRestaurantId,
        name: `${sourceConfig.name} (Copy)`,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      return await this.createConfiguration(clonedConfig)

    } catch (error) {
      console.error('Error cloning backup configuration:', error)
      throw new Error('Failed to clone backup configuration')
    }
  }

  /**
   * Parse a single configuration from database result
   */
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

  /**
   * Parse multiple configurations from database results
   */
  private parseConfigurations(rows: any[]): BackupConfiguration[] {
    return rows.map(row => this.parseConfiguration(row))
  }
}