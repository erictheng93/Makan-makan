import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { createId } from '@paralleldrive/cuid2'

export const qrCodes = sqliteTable('qr_codes', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  content: text('content').notNull(),
  styleJson: text('style_json'),
  format: text('format').notNull().default('png'),
  url: text('url'),
  metadataJson: text('metadata_json'),

  // 時間戳 - 標準化為 INTEGER (Unix seconds)
  createdAt: integer('created_at_new', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),

  // 舊欄位（兼容性，將在後續遷移中移除）
  createdAtLegacy: text('created_at'),
})

export const qrTemplates = sqliteTable('qr_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  styleJson: text('style_json').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdBy: integer('created_by'),

  // 時間戳 - 標準化為 INTEGER (Unix seconds)
  createdAt: integer('created_at_new', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at_new', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),

  // 舊欄位（兼容性）
  createdAtLegacy: text('created_at'),
  updatedAtLegacy: text('updated_at'),
})

export const qrDownloads = sqliteTable('qr_downloads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  qrCodeId: text('qr_code_id').notNull(),
  format: text('format').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  // 時間戳 - 標準化為 INTEGER (Unix seconds)
  downloadedAt: integer('downloaded_at_new', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),

  // 舊欄位（兼容性）
  downloadedAtLegacy: text('downloaded_at'),
})

export const qrBatches = sqliteTable('qr_batches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  batchId: text('batch_id').notNull().unique(),
  restaurantId: text('restaurant_id').notNull(), // 引用 restaurants.public_id (TEXT)
  totalCodes: integer('total_codes').notNull(),
  generatedCodes: integer('generated_codes').notNull().default(0),
  status: text('status').notNull().default('pending'),
  createdBy: integer('created_by').notNull(),

  // 時間戳 - 標準化為 INTEGER (Unix seconds)
  createdAt: integer('created_at_new', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  completedAt: integer('completed_at_new', { mode: 'timestamp' }),

  // 舊欄位（兼容性）
  createdAtLegacy: text('created_at'),
  completedAtLegacy: text('completed_at'),
})

// Export types for TypeScript
export type QRCode = typeof qrCodes.$inferSelect
export type NewQRCode = typeof qrCodes.$inferInsert
export type QRTemplate = typeof qrTemplates.$inferSelect
export type NewQRTemplate = typeof qrTemplates.$inferInsert
export type QRDownload = typeof qrDownloads.$inferSelect
export type NewQRDownload = typeof qrDownloads.$inferInsert
export type QRBatch = typeof qrBatches.$inferSelect
export type NewQRBatch = typeof qrBatches.$inferInsert