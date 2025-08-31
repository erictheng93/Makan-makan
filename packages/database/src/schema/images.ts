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
  restaurantId: integer('restaurant_id').notNull(),
  uploadedBy: integer('uploaded_by'),
  cloudflareImageId: text('cloudflare_image_id'),
  variants: text('variants'), // JSON array of available variants
  metadata: text('metadata'), // JSON metadata
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  uploadedAt: text('uploaded_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString())
})

export const imageViews = sqliteTable('image_views', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  imageId: text('image_id').notNull(),
  variant: text('variant').notNull(), // 'thumbnail', 'medium', 'large', 'original'
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  referer: text('referer'),
  viewedAt: text('viewed_at').notNull().$defaultFn(() => new Date().toISOString())
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
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  startedAt: text('started_at'),
  completedAt: text('completed_at')
})

// Export types for TypeScript
export type Image = typeof images.$inferSelect
export type NewImage = typeof images.$inferInsert
export type ImageView = typeof imageViews.$inferSelect
export type NewImageView = typeof imageViews.$inferInsert
export type ImageProcessingJob = typeof imageProcessingJobs.$inferSelect
export type NewImageProcessingJob = typeof imageProcessingJobs.$inferInsert