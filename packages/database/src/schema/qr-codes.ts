import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { createId } from '@paralleldrive/cuid2'

export const qrCodes = sqliteTable('qr_codes', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  content: text('content').notNull(),
  styleJson: text('style_json'),
  format: text('format').notNull().default('png'),
  url: text('url'),
  metadataJson: text('metadata_json'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString())
})

export const qrTemplates = sqliteTable('qr_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  styleJson: text('style_json').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdBy: integer('created_by'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString())
})

export const qrDownloads = sqliteTable('qr_downloads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  qrCodeId: text('qr_code_id').notNull(),
  format: text('format').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  downloadedAt: text('downloaded_at').notNull().$defaultFn(() => new Date().toISOString())
})

export const qrBatches = sqliteTable('qr_batches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  batchId: text('batch_id').notNull().unique(),
  restaurantId: integer('restaurant_id').notNull(),
  totalCodes: integer('total_codes').notNull(),
  generatedCodes: integer('generated_codes').notNull().default(0),
  status: text('status').notNull().default('pending'),
  createdBy: integer('created_by').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  completedAt: text('completed_at')
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