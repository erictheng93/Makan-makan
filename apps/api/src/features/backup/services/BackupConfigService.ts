/**
 * Backup Configuration Service - Manages backup configurations
 * Migrated to Drizzle ORM
 */

import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, count, isNotNull, desc } from "drizzle-orm";
import { backupConfigurations, backupRecords } from "@makanmakan/database";
import type { BackupConfiguration } from "@makanmakan/shared-types";

export class BackupConfigService {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * Get all configurations for a restaurant
   */
  async getConfigurations(
    restaurantId: string,
  ): Promise<BackupConfiguration[]> {
    try {
      const results = await this.db
        .select()
        .from(backupConfigurations)
        .where(eq(backupConfigurations.restaurantId, restaurantId))
        .orderBy(desc(backupConfigurations.createdAt));

      return results.map((row) => this.parseConfiguration(row)) || [];
    } catch (error) {
      console.error("Error fetching backup configurations:", error);
      throw new Error("Failed to fetch backup configurations");
    }
  }

  /**
   * Get a specific configuration by ID
   */
  async getConfigurationById(
    configId: string,
  ): Promise<BackupConfiguration | null> {
    try {
      const results = await this.db
        .select()
        .from(backupConfigurations)
        .where(eq(backupConfigurations.id, configId))
        .limit(1);

      return results.length > 0 ? this.parseConfiguration(results[0]) : null;
    } catch (error) {
      console.error("Error fetching backup configuration:", error);
      throw new Error("Failed to fetch backup configuration");
    }
  }

  /**
   * Get default configuration for a restaurant
   */
  async getDefaultConfiguration(
    restaurantId: string,
  ): Promise<BackupConfiguration | null> {
    try {
      // First try to get an existing default configuration
      const results = await this.db
        .select()
        .from(backupConfigurations)
        .where(
          and(
            eq(backupConfigurations.restaurantId, restaurantId),
            eq(backupConfigurations.name, "Default Configuration"),
          ),
        )
        .limit(1);

      if (results.length > 0) {
        return this.parseConfiguration(results[0]);
      }

      // If no default exists, create one
      const defaultConfig: BackupConfiguration = {
        id: crypto.randomUUID(),
        restaurant_id: restaurantId,
        name: "Default Configuration",
        description: "Default backup configuration",
        backup_type: "full",
        schedule_enabled: false,
        retention_days: 30,
        include_tables: [
          "orders",
          "order_items",
          "menu_items",
          "categories",
          "tables",
        ],
        exclude_tables: [],
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

      await this.createConfiguration(defaultConfig);
      return defaultConfig;
    } catch (error) {
      console.error("Error getting default configuration:", error);
      throw new Error("Failed to get default configuration");
    }
  }

  /**
   * Create a new configuration
   */
  async createConfiguration(
    config: BackupConfiguration,
  ): Promise<BackupConfiguration> {
    try {
      await this.db.insert(backupConfigurations).values({
        id: config.id,
        restaurantId: config.restaurant_id,
        name: config.name,
        description: config.description,
        backupType: config.backup_type,
        scheduleEnabled: config.schedule_enabled,
        scheduleCron: config.schedule_cron,
        retentionDays: config.retention_days,
        includeTables: config.include_tables || [],
        excludeTables: config.exclude_tables || [],
        compressionEnabled: config.compression_enabled,
        encryptionEnabled: config.encryption_enabled,
        storageProvider: config.storage_provider,
        maxParallelBackups: config.max_parallel_backups,
        notificationsEnabled: config.notifications_enabled,
        notificationChannels: config.notification_channels || [],
        createdBy: config.created_by,
        createdAt: config.created_at,
        updatedAt: config.updated_at,
      });

      return config;
    } catch (error) {
      console.error("Error creating backup configuration:", error);
      throw new Error("Failed to create backup configuration");
    }
  }

  /**
   * Update an existing configuration
   */
  async updateConfiguration(
    configId: string,
    updates: Partial<BackupConfiguration>,
  ): Promise<BackupConfiguration> {
    try {
      const existing = await this.getConfigurationById(configId);
      if (!existing) {
        throw new Error("Configuration not found");
      }

      const updated: BackupConfiguration = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      await this.db
        .update(backupConfigurations)
        .set({
          name: updated.name,
          description: updated.description,
          backupType: updated.backup_type,
          scheduleEnabled: updated.schedule_enabled,
          scheduleCron: updated.schedule_cron,
          retentionDays: updated.retention_days,
          includeTables: updated.include_tables || [],
          excludeTables: updated.exclude_tables || [],
          compressionEnabled: updated.compression_enabled,
          encryptionEnabled: updated.encryption_enabled,
          storageProvider: updated.storage_provider,
          maxParallelBackups: updated.max_parallel_backups,
          notificationsEnabled: updated.notifications_enabled,
          notificationChannels: updated.notification_channels || [],
          updatedAt: updated.updated_at,
        })
        .where(eq(backupConfigurations.id, configId));

      return updated;
    } catch (error) {
      console.error("Error updating backup configuration:", error);
      throw new Error("Failed to update backup configuration");
    }
  }

  /**
   * Create or update configuration (upsert operation)
   */
  async createOrUpdateConfiguration(
    configInput: Partial<BackupConfiguration>,
    userId: string,
  ): Promise<BackupConfiguration> {
    try {
      if (configInput.id) {
        // Update existing configuration
        const updates = {
          ...configInput,
          updated_at: new Date().toISOString(),
        };
        return await this.updateConfiguration(configInput.id, updates);
      } else {
        // Create new configuration
        const config: BackupConfiguration = {
          id: crypto.randomUUID(),
          restaurant_id: configInput.restaurant_id!,
          name: configInput.name!,
          description: configInput.description,
          backup_type: configInput.backup_type || "full",
          schedule_enabled: configInput.schedule_enabled || false,
          schedule_cron: configInput.schedule_cron,
          retention_days: configInput.retention_days || 30,
          include_tables: configInput.include_tables,
          exclude_tables: configInput.exclude_tables,
          compression_enabled: configInput.compression_enabled !== false, // default true
          encryption_enabled: configInput.encryption_enabled || false,
          storage_provider: configInput.storage_provider || "r2",
          max_parallel_backups: configInput.max_parallel_backups || 1,
          notifications_enabled: configInput.notifications_enabled || false,
          notification_channels: configInput.notification_channels || [],
          created_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        return await this.createConfiguration(config);
      }
    } catch (error) {
      console.error("Error creating/updating backup configuration:", error);
      throw new Error("Failed to save backup configuration");
    }
  }

  /**
   * Delete a configuration
   */
  async deleteConfiguration(configId: string): Promise<void> {
    try {
      // Check if configuration is in use by any backups
      const usageResult = await this.db
        .select({ total: count() })
        .from(backupRecords)
        .where(eq(backupRecords.configurationId, configId));

      if ((usageResult[0]?.total || 0) > 0) {
        throw new Error(
          "Cannot delete configuration that is being used by existing backups",
        );
      }

      await this.db
        .delete(backupConfigurations)
        .where(eq(backupConfigurations.id, configId));
    } catch (error) {
      console.error("Error deleting backup configuration:", error);
      throw new Error("Failed to delete backup configuration");
    }
  }

  /**
   * Get configurations with active schedules
   */
  async getScheduledConfigurations(): Promise<BackupConfiguration[]> {
    try {
      const results = await this.db
        .select()
        .from(backupConfigurations)
        .where(
          and(
            eq(backupConfigurations.scheduleEnabled, true),
            isNotNull(backupConfigurations.scheduleCron),
          ),
        )
        .orderBy(backupConfigurations.restaurantId, backupConfigurations.name);

      return results.map((row) => this.parseConfiguration(row)) || [];
    } catch (error) {
      console.error("Error fetching scheduled configurations:", error);
      throw new Error("Failed to fetch scheduled configurations");
    }
  }

  /**
   * Validate configuration compatibility
   */
  async validateConfigurationCompatibility(
    config: BackupConfiguration,
  ): Promise<void> {
    // Check if the storage provider is available
    if (config.storage_provider === "external") {
      throw new Error("External storage provider is not currently supported");
    }

    // Validate table combinations
    if (config.include_tables && config.exclude_tables) {
      const overlapping = config.include_tables.filter((table) =>
        config.exclude_tables!.includes(table),
      );
      if (overlapping.length > 0) {
        throw new Error(
          `Tables cannot be both included and excluded: ${overlapping.join(", ")}`,
        );
      }
    }

    // Validate schedule settings
    if (config.schedule_enabled && !config.schedule_cron) {
      throw new Error("Schedule is enabled but no cron expression provided");
    }

    // Validate notification settings
    if (
      config.notifications_enabled &&
      (!config.notification_channels ||
        config.notification_channels.length === 0)
    ) {
      throw new Error(
        "Notifications are enabled but no notification channels specified",
      );
    }
  }

  /**
   * Clone a configuration for another restaurant
   */
  async cloneConfiguration(
    sourceConfigId: string,
    targetRestaurantId: string,
    userId: string,
  ): Promise<BackupConfiguration> {
    try {
      const sourceConfig = await this.getConfigurationById(sourceConfigId);
      if (!sourceConfig) {
        throw new Error("Source configuration not found");
      }

      const clonedConfig: BackupConfiguration = {
        ...sourceConfig,
        id: crypto.randomUUID(),
        restaurant_id: targetRestaurantId,
        name: `${sourceConfig.name} (Copy)`,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return await this.createConfiguration(clonedConfig);
    } catch (error) {
      console.error("Error cloning backup configuration:", error);
      throw new Error("Failed to clone backup configuration");
    }
  }

  /**
   * Parse a single configuration from database result
   */
  private parseConfiguration(
    row: Record<string, unknown>,
  ): BackupConfiguration {
    return {
      ...row,
      restaurant_id: row.restaurantId ?? row.restaurant_id,
      backup_type: row.backupType ?? row.backup_type,
      schedule_enabled: Boolean(row.scheduleEnabled ?? row.schedule_enabled),
      schedule_cron: row.scheduleCron ?? row.schedule_cron,
      retention_days: row.retentionDays ?? row.retention_days,
      compression_enabled: Boolean(
        row.compressionEnabled ?? row.compression_enabled,
      ),
      encryption_enabled: Boolean(
        row.encryptionEnabled ?? row.encryption_enabled,
      ),
      storage_provider: row.storageProvider ?? row.storage_provider,
      max_parallel_backups: row.maxParallelBackups ?? row.max_parallel_backups,
      notifications_enabled: Boolean(
        row.notificationsEnabled ?? row.notifications_enabled,
      ),
      include_tables: row.includeTables ?? row.include_tables ?? [],
      exclude_tables: row.excludeTables ?? row.exclude_tables ?? [],
      notification_channels:
        row.notificationChannels ?? row.notification_channels ?? [],
      created_by: row.createdBy ?? row.created_by,
      created_at: row.createdAt ?? row.created_at,
      updated_at: row.updatedAt ?? row.updated_at,
    } as BackupConfiguration;
  }
}
