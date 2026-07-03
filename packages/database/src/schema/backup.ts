/**
 * Backup System Schema
 *
 * Tables:
 * - backup_records: 備份記錄
 * - backup_schedules: 備份排程
 * - backup_configurations: 備份配置
 * - backup_alerts: 備份警報
 * - backup_audit_logs: 備份審計日誌
 * - restore_operations: 還原操作記錄
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { restaurants } from "./restaurants";

// ==========================================
// 備份記錄表 (Backup Records)
// ==========================================

export const backupRecords = sqliteTable(
  "backup_records",
  {
    id: text("id").primaryKey(), // UUID
    restaurantId: text("restaurant_id").notNull(),
    configurationId: text("configuration_id"),
    name: text("name").notNull(),
    backupType: text("backup_type").notNull(), // full, incremental, differential
    status: text("status").notNull().default("pending"), // pending, in_progress, completed, failed
    fileSize: integer("file_size").notNull().default(0),
    compressedSize: integer("compressed_size").notNull().default(0),
    recordsCount: integer("records_count").notNull().default(0),
    tablesIncluded: text("tables_included", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    storageProvider: text("storage_provider").notNull().default("r2"),
    storagePath: text("storage_path").notNull().default(""),
    encryptionEnabled: integer("encryption_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    checksum: text("checksum").notNull().default(""),
    startedAt: integer("started_at_ms", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at_ms", { mode: "timestamp_ms" }),
    errorMessage: text("error_message"),
    createdBy: text("created_by").notNull(),
    metadata: text("metadata", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({}),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" }).default(
      sql`(unixepoch('now') * 1000)`,
    ),
  },
  (table) => ({
    restaurantIdx: index("idx_backup_records_restaurant").on(
      table.restaurantId,
    ),
    statusIdx: index("idx_backup_records_status").on(
      table.restaurantId,
      table.status,
    ),
    startedAtIdx: index("idx_backup_records_started_at").on(table.startedAt),
    configIdx: index("idx_backup_records_config").on(table.configurationId),
  }),
);

// ==========================================
// 備份排程表 (Backup Schedules)
// ==========================================

export const backupSchedules = sqliteTable(
  "backup_schedules",
  {
    id: text("id").primaryKey(), // UUID
    configurationId: text("configuration_id").notNull(),
    restaurantId: text("restaurant_id").notNull(),
    cronExpression: text("cron_expression").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    lastRunAt: integer("last_run_at_ms", { mode: "timestamp_ms" }),
    nextRunAt: integer("next_run_at_ms", { mode: "timestamp_ms" }),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" }).default(
      sql`(unixepoch('now') * 1000)`,
    ),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" }).default(
      sql`(unixepoch('now') * 1000)`,
    ),
  },
  (table) => ({
    configIdx: index("idx_backup_schedules_config").on(table.configurationId),
    restaurantIdx: index("idx_backup_schedules_restaurant").on(
      table.restaurantId,
    ),
    enabledIdx: index("idx_backup_schedules_enabled").on(table.enabled),
  }),
);

// ==========================================
// 備份配置表 (Backup Configurations)
// ==========================================

export const backupConfigurations = sqliteTable(
  "backup_configurations",
  {
    id: text("id").primaryKey(), // UUID
    restaurantId: text("restaurant_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    backupType: text("backup_type").notNull().default("full"), // full, incremental, differential
    scheduleEnabled: integer("schedule_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    scheduleCron: text("schedule_cron"),
    retentionDays: integer("retention_days").notNull().default(30),
    includeTables: text("include_tables", { mode: "json" })
      .$type<string[]>()
      .default([]),
    excludeTables: text("exclude_tables", { mode: "json" })
      .$type<string[]>()
      .default([]),
    compressionEnabled: integer("compression_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    encryptionEnabled: integer("encryption_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    storageProvider: text("storage_provider").notNull().default("r2"),
    maxParallelBackups: integer("max_parallel_backups").notNull().default(1),
    notificationsEnabled: integer("notifications_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    notificationChannels: text("notification_channels", { mode: "json" })
      .$type<string[]>()
      .default([]),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" }).default(
      sql`(unixepoch('now') * 1000)`,
    ),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" }).default(
      sql`(unixepoch('now') * 1000)`,
    ),
  },
  (table) => ({
    restaurantIdx: index("idx_backup_configurations_restaurant").on(
      table.restaurantId,
    ),
    scheduleIdx: index("idx_backup_configurations_schedule").on(
      table.scheduleEnabled,
    ),
  }),
);

// ==========================================
// 備份警報表 (Backup Alerts)
// ==========================================

export const backupAlerts = sqliteTable(
  "backup_alerts",
  {
    id: text("id").primaryKey(), // UUID
    restaurantId: text("restaurant_id").notNull(),
    alertType: text("alert_type").notNull(), // backup_failed, storage_quota, etc.
    severity: text("severity").notNull().default("medium"), // critical, high, medium, low
    message: text("message").notNull(),
    details: text("details", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({}),
    acknowledged: integer("acknowledged", { mode: "boolean" })
      .notNull()
      .default(false),
    resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
    triggeredAt: integer("triggered_at_ms", { mode: "timestamp_ms" }),
    resolvedAt: integer("resolved_at_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    restaurantIdx: index("idx_backup_alerts_restaurant").on(table.restaurantId),
    resolvedIdx: index("idx_backup_alerts_resolved").on(
      table.restaurantId,
      table.resolved,
    ),
    triggeredAtIdx: index("idx_backup_alerts_triggered_at").on(
      table.triggeredAt,
    ),
  }),
);

// ==========================================
// 備份審計日誌表 (Backup Audit Logs)
// ==========================================

export const backupAuditLogs = sqliteTable(
  "backup_audit_logs",
  {
    id: text("id").primaryKey(), // UUID
    restaurantId: text("restaurant_id").notNull(),
    action: text("action").notNull(), // backup_created, backup_deleted, etc.
    details: text("details", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({}),
    performedBy: text("performed_by").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    timestamp: integer("timestamp_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    restaurantIdx: index("idx_backup_audit_logs_restaurant").on(
      table.restaurantId,
    ),
    actionIdx: index("idx_backup_audit_logs_action").on(table.action),
    timestampIdx: index("idx_backup_audit_logs_timestamp").on(table.timestamp),
  }),
);

// ==========================================
// 還原操作表 (Restore Operations)
// ==========================================

export const restoreOperations = sqliteTable(
  "restore_operations",
  {
    id: text("id").primaryKey(), // UUID
    restaurantId: text("restaurant_id").notNull(),
    backupId: text("backup_id").notNull(),
    status: text("status").notNull().default("pending"), // pending, in_progress, completed, failed
    restoreType: text("restore_type").notNull(), // full, selective
    targetTables: text("target_tables", { mode: "json" })
      .$type<string[]>()
      .default([]),
    overwriteExisting: integer("overwrite_existing", { mode: "boolean" })
      .notNull()
      .default(false),
    startedAt: integer("started_at_ms", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at_ms", { mode: "timestamp_ms" }),
    tablesRestored: integer("tables_restored").notNull().default(0),
    recordsRestored: integer("records_restored").notNull().default(0),
    errorMessage: text("error_message"),
    performedBy: text("performed_by").notNull(),
    safetyChecks: text("safety_checks", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({}),
  },
  (table) => ({
    restaurantIdx: index("idx_restore_operations_restaurant").on(
      table.restaurantId,
    ),
    backupIdx: index("idx_restore_operations_backup").on(table.backupId),
    statusIdx: index("idx_restore_operations_status").on(table.status),
  }),
);

// ==========================================
// Relations 定義
// ==========================================

export const backupRecordsRelations = relations(
  backupRecords,
  ({ one, many }) => ({
    restaurant: one(restaurants, {
      fields: [backupRecords.restaurantId],
      references: [restaurants.id],
    }),
    configuration: one(backupConfigurations, {
      fields: [backupRecords.configurationId],
      references: [backupConfigurations.id],
    }),
    restoreOperations: many(restoreOperations),
  }),
);

export const backupSchedulesRelations = relations(
  backupSchedules,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [backupSchedules.restaurantId],
      references: [restaurants.id],
    }),
    configuration: one(backupConfigurations, {
      fields: [backupSchedules.configurationId],
      references: [backupConfigurations.id],
    }),
  }),
);

export const backupConfigurationsRelations = relations(
  backupConfigurations,
  ({ one, many }) => ({
    restaurant: one(restaurants, {
      fields: [backupConfigurations.restaurantId],
      references: [restaurants.id],
    }),
    backupRecords: many(backupRecords),
    schedules: many(backupSchedules),
  }),
);

export const backupAlertsRelations = relations(backupAlerts, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [backupAlerts.restaurantId],
    references: [restaurants.id],
  }),
}));

export const backupAuditLogsRelations = relations(
  backupAuditLogs,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [backupAuditLogs.restaurantId],
      references: [restaurants.id],
    }),
  }),
);

export const restoreOperationsRelations = relations(
  restoreOperations,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [restoreOperations.restaurantId],
      references: [restaurants.id],
    }),
    backup: one(backupRecords, {
      fields: [restoreOperations.backupId],
      references: [backupRecords.id],
    }),
  }),
);
