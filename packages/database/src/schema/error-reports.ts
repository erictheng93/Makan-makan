import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { restaurants } from './restaurants'

export const errorReports = sqliteTable('error_reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  restaurantId: integer('restaurant_id'),
  errorType: text('error_type', { 
    enum: ['network', 'api', 'sse', 'validation', 'permission', 'unknown'] 
  }).notNull(),
  severity: text('severity', { 
    enum: ['low', 'medium', 'high', 'critical'] 
  }).notNull(),
  errorCode: text('error_code'),
  errorMessage: text('error_message').notNull(),
  errorContext: text('error_context'), // JSON format
  originalError: text('original_error'), // JSON format
  userAgent: text('user_agent'),
  url: text('url'),
  timestamp: text('timestamp').notNull(), // ISO datetime string
  createdAt: text('created_at').notNull(),
  resolvedAt: text('resolved_at'),
  resolvedBy: integer('resolved_by'),
  resolutionNotes: text('resolution_notes')
}, (table) => ({
  userIdIdx: index('idx_error_reports_user_id').on(table.userId),
  restaurantIdIdx: index('idx_error_reports_restaurant_id').on(table.restaurantId),
  errorTypeIdx: index('idx_error_reports_error_type').on(table.errorType),
  severityIdx: index('idx_error_reports_severity').on(table.severity),
  timestampIdx: index('idx_error_reports_timestamp').on(table.timestamp),
  createdAtIdx: index('idx_error_reports_created_at').on(table.createdAt),
  typeSeverityIdx: index('idx_error_reports_type_severity').on(table.errorType, table.severity),
  restaurantTimestampIdx: index('idx_error_reports_restaurant_timestamp').on(table.restaurantId, table.timestamp)
}))

export const systemAlerts = sqliteTable('system_alerts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  severity: text('severity', { 
    enum: ['low', 'medium', 'high', 'critical'] 
  }).notNull(),
  alertType: text('alert_type').notNull(),
  restaurantId: integer('restaurant_id'),
  affectedComponent: text('affected_component'),
  createdAt: text('created_at').notNull(),
  resolvedAt: text('resolved_at'),
  resolvedBy: integer('resolved_by'),
  resolutionNotes: text('resolution_notes'),
  autoResolved: integer('auto_resolved', { mode: 'boolean' }).default(false)
}, (table) => ({
  severityIdx: index('idx_system_alerts_severity').on(table.severity),
  restaurantIdIdx: index('idx_system_alerts_restaurant_id').on(table.restaurantId),
  createdAtIdx: index('idx_system_alerts_created_at').on(table.createdAt)
}))

// Relations
export const errorReportsRelations = relations(errorReports, ({ one }) => ({
  user: one(users, {
    fields: [errorReports.userId],
    references: [users.id]
  }),
  restaurant: one(restaurants, {
    fields: [errorReports.restaurantId],
    references: [restaurants.id]
  }),
  resolvedByUser: one(users, {
    fields: [errorReports.resolvedBy],
    references: [users.id]
  })
}))

export const systemAlertsRelations = relations(systemAlerts, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [systemAlerts.restaurantId],
    references: [restaurants.id]
  }),
  resolvedByUser: one(users, {
    fields: [systemAlerts.resolvedBy],
    references: [users.id]
  })
}))

// Types
export type ErrorReport = typeof errorReports.$inferSelect
export type NewErrorReport = typeof errorReports.$inferInsert
export type SystemAlert = typeof systemAlerts.$inferSelect
export type NewSystemAlert = typeof systemAlerts.$inferInsert

// Constants
export const ERROR_TYPES = ['network', 'api', 'sse', 'validation', 'permission', 'unknown'] as const
export const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const
export const ALERT_TYPES = ['equipment_failure', 'inventory_low', 'performance_issue', 'system_maintenance'] as const