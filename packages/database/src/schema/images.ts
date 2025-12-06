import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { createId } from '@paralleldrive/cuid2'

export const images = sqliteTable('images', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  filename: text('filename').notNull(),
  originalFilename: text('original_filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  width: integer('width'),
  height: integer('height'),
  category: text('category').notNull(), // 'menu', 'restaurant', 'profile', etc.
  restaurantId: text('restaurant_id').notNull(), // 引用 restaurants.public_id (TEXT)
  uploadedBy: integer('uploaded_by'),
  cloudflareImageId: text('cloudflare_image_id'),
  variants: text('variants'), // JSON array of available variants
  metadata: text('metadata'), // JSON metadata
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

  // 時間戳 - 標準化為 INTEGER (Unix seconds)
  uploadedAt: integer('uploaded_at_new', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at_new', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),

  // 舊欄位（兼容性，將在後續遷移中移除）
  uploadedAtLegacy: text('uploaded_at'),
  updatedAtLegacy: text('updated_at'),
})

export const imageViews = sqliteTable('image_views', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  imageId: text('image_id').notNull(),
  variant: text('variant').notNull(), // 'thumbnail', 'medium', 'large', 'original'
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  referer: text('referer'),

  // 時間戳 - 標準化為 INTEGER (Unix seconds)
  viewedAt: integer('viewed_at_new', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),

  // 舊欄位（兼容性）
  viewedAtLegacy: text('viewed_at'),
})

export const imageProcessingJobs = sqliteTable('image_processing_jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  imageId: text('image_id').notNull(),
  jobType: text('job_type').notNull(), // 'upload', 'resize', 'optimize', 'variant_generation'
  status: text('status').notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  inputParams: text('input_params'), // JSON parameters
  outputData: text('output_data'), // JSON results
  error: text('error'),
  priority: integer('priority').notNull().default(5),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),

  // 時間戳 - 標準化為 INTEGER (Unix seconds)
  createdAt: integer('created_at_new', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  startedAt: integer('started_at_new', { mode: 'timestamp' }),
  completedAt: integer('completed_at_new', { mode: 'timestamp' }),

  // 舊欄位（兼容性）
  createdAtLegacy: text('created_at'),
  startedAtLegacy: text('started_at'),
  completedAtLegacy: text('completed_at'),
})

// Export types for TypeScript
export type Image = typeof images.$inferSelect
export type NewImage = typeof images.$inferInsert
export type ImageView = typeof imageViews.$inferSelect
export type NewImageView = typeof imageViews.$inferInsert
export type ImageProcessingJob = typeof imageProcessingJobs.$inferSelect
export type NewImageProcessingJob = typeof imageProcessingJobs.$inferInsert
