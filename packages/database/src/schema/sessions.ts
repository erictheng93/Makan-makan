import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { users } from './users'

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // Session ID (UUID)
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Session 資訊
  token: text('token').notNull().unique(), // JWT Token 或 Session Token
  refreshToken: text('refresh_token').unique(), // Refresh Token
  
  // 裝置和瀏覽器資訊
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  deviceInfo: text('device_info', { mode: 'json' }).$type<{
    platform?: string    // ios, android, web
    deviceType?: string  // mobile, tablet, desktop
    browser?: string     // chrome, safari, firefox
    version?: string     // 版本資訊
  }>(),
  
  // 地理位置（可選）
  location: text('location', { mode: 'json' }).$type<{
    country?: string
    city?: string
    coordinates?: {
      lat: number
      lng: number
    }
  }>(),
  
  // 狀態
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  
  // 時間資訊
  lastAccessedAt: integer('last_accessed_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  
  // 時間戳記
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdate(() => new Date()),
}, (table) => ({
  // 索引優化
  userActiveIdx: index('sessions_user_active_idx').on(table.userId, table.isActive),
  tokenIdx: index('sessions_token_idx').on(table.token),
  expiresIdx: index('sessions_expires_idx').on(table.expiresAt),
}))

export const sessionRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))