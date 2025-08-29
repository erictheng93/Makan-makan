import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { restaurants } from './restaurants'

// 操作類型定義
export const AUDIT_ACTIONS = {
  // 認證相關
  LOGIN: 'login',
  LOGOUT: 'logout',
  REGISTER: 'register',
  PASSWORD_CHANGE: 'password_change',
  
  // 訂單相關
  ORDER_CREATE: 'order_create',
  ORDER_UPDATE: 'order_update',
  ORDER_CANCEL: 'order_cancel',
  ORDER_CONFIRM: 'order_confirm',
  ORDER_COMPLETE: 'order_complete',
  
  // 菜單相關
  MENU_CREATE: 'menu_create',
  MENU_UPDATE: 'menu_update',
  MENU_DELETE: 'menu_delete',
  MENU_VIEW: 'menu_view',
  
  // 系統相關
  SYSTEM_CONFIG: 'system_config',
  DATA_EXPORT: 'data_export',
  DATA_IMPORT: 'data_import',
  
  // 其他
  OTHER: 'other'
} as const

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS]

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // 關聯資訊
  userId: integer('user_id').references(() => users.id), // 可為空（系統操作）
  restaurantId: integer('restaurant_id').references(() => restaurants.id), // 可為空（全局操作）
  
  // 操作資訊
  action: text('action').notNull(),
  resource: text('resource').notNull(), // 操作的資源類型 (orders, menu_items, users 等)
  resourceId: text('resource_id'), // 操作的資源 ID
  
  // 操作詳情
  description: text('description').notNull(), // 操作描述
  changes: text('changes', { mode: 'json' }).$type<{
    before?: Record<string, any> // 變更前的值
    after?: Record<string, any>  // 變更後的值
    metadata?: Record<string, any> // 額外的元數據
  }>(),
  
  // 請求資訊
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  
  // 結果資訊
  success: integer('success', { mode: 'boolean' }).notNull().default(true),
  errorMessage: text('error_message'),
  
  // 效能資訊
  executionTimeMs: integer('execution_time_ms'), // 執行時間（毫秒）
  
  // 時間戳記
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  // 索引優化
  userActionIdx: index('audit_logs_user_action_idx').on(table.userId, table.action, table.createdAt),
  restaurantActionIdx: index('audit_logs_restaurant_action_idx').on(table.restaurantId, table.action, table.createdAt),
  resourceIdx: index('audit_logs_resource_idx').on(table.resource, table.resourceId, table.createdAt),
  timeIdx: index('audit_logs_time_idx').on(table.createdAt),
}))

export const auditLogRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  restaurant: one(restaurants, {
    fields: [auditLogs.restaurantId],
    references: [restaurants.id],
  }),
}))