import { eq, desc, count, and, sql, between, inArray } from 'drizzle-orm'
import { BaseService } from './base'
import { 
  images, 
  imageViews, 
  imageProcessingJobs,
  type NewImage,
  type NewImageView,
  type NewImageProcessingJob,
  type Image,
  type ImageView,
  type ImageProcessingJob
} from '../schema'

export interface ImageAnalyticsOptions {
  restaurantId?: number
  dateFrom?: string
  dateTo?: string
}

export interface StorageAnalytics {
  summary: {
    total_images: number
    total_storage: number
    avg_file_size: number
    largest_file: number
    smallest_file: number
  }
  by_category: Array<{
    category: string
    image_count: number
    total_size: number
    avg_size: number
    max_size: number
    min_size: number
  }>
  by_format: Array<{
    mime_type: string
    image_count: number
    total_size: number
    avg_size: number
  }>
  monthly_trends: Array<{
    month: string
    images_uploaded: number
    storage_used: number
    avg_file_size: number
  }>
}

export interface UsageAnalytics {
  most_viewed_images: Array<{
    id: string
    filename: string
    original_filename: string
    category: string
    view_count: number
    days_viewed: number
  }>
  variant_usage: Array<{
    variant: string
    usage_count: number
    unique_images: number
  }>
  daily_trends: Array<{
    date: string
    total_views: number
    unique_images_viewed: number
  }>
  hourly_distribution: Array<{
    hour: string
    view_count: number
    avg_hourly_views: number
  }>
}

export interface PerformanceAnalytics {
  performance_metrics: {
    total_jobs: number
    success_rate: number
    failure_rate: number
    avg_processing_time: number
  }
  job_statistics: Array<{
    status: string
    job_count: number
    avg_processing_time_seconds: number
    min_processing_time_seconds: number
    max_processing_time_seconds: number
  }>
  processing_trends: Array<{
    date: string
    jobs_created: number
    jobs_completed: number
    jobs_failed: number
    avg_processing_time: number
  }>
  error_analysis: Array<{
    error: string | null
    error_count: number
  }>
}

export interface CreateImageData {
  filename: string
  originalFilename: string
  mimeType: string
  size: number
  width?: number
  height?: number
  category: string
  restaurantId: number
  uploadedBy?: number
  cloudflareImageId?: string
  variants?: string[]
  metadata?: any
}

export class ImageService extends BaseService {
  /**
   * Record image view for analytics
   */
  async recordImageView(data: {
    imageId: string
    variant: string
    ipAddress?: string
    userAgent?: string
    referer?: string
  }): Promise<ImageView> {
    const viewData: NewImageView = {
      imageId: data.imageId,
      variant: data.variant,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      referer: data.referer
    }

    const result = await this.db.insert(imageViews).values(viewData).returning()
    return result[0]
  }

  /**
   * Get storage analytics
   */
  async getStorageAnalytics(options: ImageAnalyticsOptions): Promise<StorageAnalytics> {
    const whereConditions = []
    
    if (options.restaurantId) {
      whereConditions.push(eq(images.restaurantId, options.restaurantId))
    }
    
    if (options.dateFrom) {
      whereConditions.push(sql`${images.uploadedAt} >= ${options.dateFrom}`)
    }
    
    if (options.dateTo) {
      whereConditions.push(sql`${images.uploadedAt} <= ${options.dateTo}`)
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

    // Storage by category
    const categoryStorage = await this.db
      .select({
        category: images.category,
        image_count: count(),
        total_size: sql<number>`SUM(${images.size})`,
        avg_size: sql<number>`AVG(${images.size})`,
        max_size: sql<number>`MAX(${images.size})`,
        min_size: sql<number>`MIN(${images.size})`
      })
      .from(images)
      .where(whereClause)
      .groupBy(images.category)
      .orderBy(sql`SUM(${images.size}) DESC`)

    // Storage by format
    const formatStorage = await this.db
      .select({
        mime_type: images.mimeType,
        image_count: count(),
        total_size: sql<number>`SUM(${images.size})`,
        avg_size: sql<number>`AVG(${images.size})`
      })
      .from(images)
      .where(whereClause)
      .groupBy(images.mimeType)
      .orderBy(sql`SUM(${images.size}) DESC`)

    // Monthly upload trends
    const monthlyTrends = await this.db
      .select({
        month: sql<string>`strftime('%Y-%m', ${images.uploadedAt})`,
        images_uploaded: count(),
        storage_used: sql<number>`SUM(${images.size})`,
        avg_file_size: sql<number>`AVG(${images.size})`
      })
      .from(images)
      .where(whereClause)
      .groupBy(sql`strftime('%Y-%m', ${images.uploadedAt})`)
      .orderBy(sql`strftime('%Y-%m', ${images.uploadedAt}) DESC`)
      .limit(12)

    // Total storage statistics
    const totalStats = await this.db
      .select({
        total_images: count(),
        total_storage: sql<number>`SUM(${images.size})`,
        avg_file_size: sql<number>`AVG(${images.size})`,
        largest_file: sql<number>`MAX(${images.size})`,
        smallest_file: sql<number>`MIN(${images.size})`
      })
      .from(images)
      .where(whereClause)

    return {
      summary: totalStats[0],
      by_category: categoryStorage,
      by_format: formatStorage,
      monthly_trends: monthlyTrends
    }
  }

  /**
   * Get usage analytics
   */
  async getUsageAnalytics(options: ImageAnalyticsOptions): Promise<UsageAnalytics> {
    const whereConditions = []
    
    // Access control - filter image views by restaurant ownership
    if (options.restaurantId) {
      const restaurantImages = this.db.select({ id: images.id }).from(images).where(eq(images.restaurantId, options.restaurantId))
      whereConditions.push(inArray(imageViews.imageId, restaurantImages))
    }
    
    if (options.dateFrom) {
      whereConditions.push(sql`${imageViews.viewedAt} >= ${options.dateFrom}`)
    }
    
    if (options.dateTo) {
      whereConditions.push(sql`${imageViews.viewedAt} <= ${options.dateTo}`)
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

    // Most viewed images
    const mostViewedImages = await this.db
      .select({
        id: images.id,
        filename: images.filename,
        original_filename: images.originalFilename,
        category: images.category,
        view_count: count(imageViews.id),
        days_viewed: sql<number>`COUNT(DISTINCT DATE(${imageViews.viewedAt}))`
      })
      .from(images)
      .leftJoin(imageViews, eq(images.id, imageViews.imageId))
      .where(options.restaurantId ? eq(images.restaurantId, options.restaurantId) : undefined)
      .groupBy(images.id, images.filename, images.originalFilename, images.category)
      .having(sql`COUNT(${imageViews.id}) > 0`)
      .orderBy(sql`COUNT(${imageViews.id}) DESC`)
      .limit(20)

    // Variant usage statistics
    const variantUsage = await this.db
      .select({
        variant: imageViews.variant,
        usage_count: count(),
        unique_images: sql<number>`COUNT(DISTINCT ${imageViews.imageId})`
      })
      .from(imageViews)
      .where(whereClause)
      .groupBy(imageViews.variant)
      .orderBy(desc(count()))

    // Daily usage trends
    const dailyUsage = await this.db
      .select({
        date: sql<string>`DATE(${imageViews.viewedAt})`,
        total_views: count(),
        unique_images_viewed: sql<number>`COUNT(DISTINCT ${imageViews.imageId})`
      })
      .from(imageViews)
      .where(whereClause)
      .groupBy(sql`DATE(${imageViews.viewedAt})`)
      .orderBy(sql`DATE(${imageViews.viewedAt}) DESC`)
      .limit(30)

    // Peak usage hours
    const hourlyUsage = await this.db
      .select({
        hour: sql<string>`strftime('%H', ${imageViews.viewedAt})`,
        view_count: count(),
        avg_hourly_views: sql<number>`AVG(COUNT(*)) OVER()`
      })
      .from(imageViews)
      .where(whereClause)
      .groupBy(sql`strftime('%H', ${imageViews.viewedAt})`)
      .orderBy(sql`strftime('%H', ${imageViews.viewedAt})`)

    return {
      most_viewed_images: mostViewedImages,
      variant_usage: variantUsage,
      daily_trends: dailyUsage,
      hourly_distribution: hourlyUsage
    }
  }

  /**
   * Get performance analytics
   */
  async getPerformanceAnalytics(options: ImageAnalyticsOptions): Promise<PerformanceAnalytics> {
    const whereConditions = []
    
    if (options.dateFrom) {
      whereConditions.push(sql`${imageProcessingJobs.createdAt} >= ${options.dateFrom}`)
    }
    
    if (options.dateTo) {
      whereConditions.push(sql`${imageProcessingJobs.createdAt} <= ${options.dateTo}`)
    }

    // If restaurant filter, only include jobs for images owned by that restaurant
    if (options.restaurantId) {
      const restaurantImages = this.db.select({ id: images.id }).from(images).where(eq(images.restaurantId, options.restaurantId))
      whereConditions.push(inArray(imageProcessingJobs.imageId, restaurantImages))
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

    // Processing job statistics
    const jobStats = await this.db
      .select({
        status: imageProcessingJobs.status,
        job_count: count(),
        avg_processing_time_seconds: sql<number>`
          AVG(
            CASE 
              WHEN ${imageProcessingJobs.completedAt} IS NOT NULL AND ${imageProcessingJobs.createdAt} IS NOT NULL 
              THEN (julianday(${imageProcessingJobs.completedAt}) - julianday(${imageProcessingJobs.createdAt})) * 24 * 60 * 60
              ELSE NULL 
            END
          )
        `,
        min_processing_time_seconds: sql<number>`
          MIN(
            CASE 
              WHEN ${imageProcessingJobs.completedAt} IS NOT NULL AND ${imageProcessingJobs.createdAt} IS NOT NULL 
              THEN (julianday(${imageProcessingJobs.completedAt}) - julianday(${imageProcessingJobs.createdAt})) * 24 * 60 * 60
              ELSE NULL 
            END
          )
        `,
        max_processing_time_seconds: sql<number>`
          MAX(
            CASE 
              WHEN ${imageProcessingJobs.completedAt} IS NOT NULL AND ${imageProcessingJobs.createdAt} IS NOT NULL 
              THEN (julianday(${imageProcessingJobs.completedAt}) - julianday(${imageProcessingJobs.createdAt})) * 24 * 60 * 60
              ELSE NULL 
            END
          )
        `
      })
      .from(imageProcessingJobs)
      .where(whereClause)
      .groupBy(imageProcessingJobs.status)
      .orderBy(desc(count()))

    // Processing trends over time
    const processingTrends = await this.db
      .select({
        date: sql<string>`DATE(${imageProcessingJobs.createdAt})`,
        jobs_created: count(),
        jobs_completed: sql<number>`SUM(CASE WHEN ${imageProcessingJobs.status} = 'completed' THEN 1 ELSE 0 END)`,
        jobs_failed: sql<number>`SUM(CASE WHEN ${imageProcessingJobs.status} = 'failed' THEN 1 ELSE 0 END)`,
        avg_processing_time: sql<number>`
          AVG(
            CASE 
              WHEN ${imageProcessingJobs.completedAt} IS NOT NULL AND ${imageProcessingJobs.createdAt} IS NOT NULL 
              THEN (julianday(${imageProcessingJobs.completedAt}) - julianday(${imageProcessingJobs.createdAt})) * 24 * 60 * 60
              ELSE NULL 
            END
          )
        `
      })
      .from(imageProcessingJobs)
      .where(whereClause)
      .groupBy(sql`DATE(${imageProcessingJobs.createdAt})`)
      .orderBy(sql`DATE(${imageProcessingJobs.createdAt}) DESC`)
      .limit(30)

    // Error analysis
    const errorAnalysis = await this.db
      .select({
        error: imageProcessingJobs.error,
        error_count: count()
      })
      .from(imageProcessingJobs)
      .where(
        and(
          whereClause,
          eq(imageProcessingJobs.status, 'failed'),
          sql`${imageProcessingJobs.error} IS NOT NULL`
        )
      )
      .groupBy(imageProcessingJobs.error)
      .orderBy(desc(count()))
      .limit(10)

    // Calculate performance metrics
    const totalJobs = jobStats.reduce((sum, row) => sum + row.job_count, 0)
    const completedJobs = jobStats.find(row => row.status === 'completed')?.job_count || 0
    const failedJobs = jobStats.find(row => row.status === 'failed')?.job_count || 0

    const performanceMetrics = {
      total_jobs: totalJobs,
      success_rate: totalJobs > 0 ? Number(((completedJobs / totalJobs) * 100).toFixed(2)) : 0,
      failure_rate: totalJobs > 0 ? Number(((failedJobs / totalJobs) * 100).toFixed(2)) : 0,
      avg_processing_time: completedJobs > 0 ? 
        jobStats.find(row => row.status === 'completed')?.avg_processing_time_seconds || 0 : 0
    }

    return {
      performance_metrics: performanceMetrics,
      job_statistics: jobStats,
      processing_trends: processingTrends,
      error_analysis: errorAnalysis
    }
  }

  /**
   * Create image record
   */
  async createImage(data: CreateImageData): Promise<Image> {
    const imageData: NewImage = {
      filename: data.filename,
      originalFilename: data.originalFilename,
      mimeType: data.mimeType,
      size: data.size,
      width: data.width,
      height: data.height,
      category: data.category,
      restaurantId: data.restaurantId,
      uploadedBy: data.uploadedBy,
      cloudflareImageId: data.cloudflareImageId,
      variants: data.variants ? JSON.stringify(data.variants) : null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null
    }

    const result = await this.db.insert(images).values(imageData).returning()
    return result[0]
  }

  /**
   * Get image by ID
   */
  async getImage(id: string): Promise<Image | null> {
    const result = await this.db.select().from(images).where(eq(images.id, id)).limit(1)
    return result[0] || null
  }

  /**
   * Get images with pagination
   */
  async getImages(options: {
    restaurantId?: number
    category?: string
    offset?: number
    limit?: number
  }): Promise<Image[]> {
    const whereConditions = []
    
    if (options.restaurantId) {
      whereConditions.push(eq(images.restaurantId, options.restaurantId))
    }
    
    if (options.category) {
      whereConditions.push(eq(images.category, options.category))
    }

    whereConditions.push(eq(images.isActive, true))

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

    return this.db
      .select()
      .from(images)
      .where(whereClause)
      .orderBy(desc(images.uploadedAt))
      .offset(options.offset || 0)
      .limit(options.limit || 20)
  }

  /**
   * Update image
   */
  async updateImage(id: string, data: Partial<CreateImageData>): Promise<void> {
    const updateData: any = {
      updatedAt: new Date().toISOString()
    }

    if (data.cloudflareImageId) updateData.cloudflareImageId = data.cloudflareImageId
    if (data.variants) updateData.variants = JSON.stringify(data.variants)
    if (data.metadata) updateData.metadata = JSON.stringify(data.metadata)
    if (data.category) updateData.category = data.category

    await this.db.update(images).set(updateData).where(eq(images.id, id))
  }

  /**
   * Delete image (soft delete)
   */
  async deleteImage(id: string): Promise<void> {
    await this.db
      .update(images)
      .set({ 
        isActive: false,
        updatedAt: new Date().toISOString()
      })
      .where(eq(images.id, id))
  }

  /**
   * Get images count
   */
  async getImagesCount(options: {
    restaurantId?: number
    category?: string
  }): Promise<number> {
    const whereConditions = []
    
    if (options.restaurantId) {
      whereConditions.push(eq(images.restaurantId, options.restaurantId))
    }
    
    if (options.category) {
      whereConditions.push(eq(images.category, options.category))
    }

    whereConditions.push(eq(images.isActive, true))

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

    const result = await this.db
      .select({ count: count() })
      .from(images)
      .where(whereClause)

    return result[0]?.count || 0
  }

  /**
   * Create image processing job
   */
  async createProcessingJob(data: {
    imageId: string
    jobType: string
    inputParams?: any
    priority?: number
  }): Promise<ImageProcessingJob> {
    const jobData: NewImageProcessingJob = {
      imageId: data.imageId,
      jobType: data.jobType,
      inputParams: data.inputParams ? JSON.stringify(data.inputParams) : undefined,
      priority: data.priority || 5
    }

    const result = await this.db.insert(imageProcessingJobs).values(jobData).returning()
    return result[0]
  }

  /**
   * Update processing job status
   */
  async updateProcessingJobStatus(
    jobId: number,
    status: string,
    outputData?: any,
    error?: string
  ): Promise<void> {
    const updateData: any = {
      status
    }

    if (status === 'processing') {
      updateData.startedAt = new Date().toISOString()
    } else if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date().toISOString()
    }

    if (outputData) {
      updateData.outputData = JSON.stringify(outputData)
    }

    if (error) {
      updateData.error = error
    }

    await this.db
      .update(imageProcessingJobs)
      .set(updateData)
      .where(eq(imageProcessingJobs.id, jobId))
  }

  /**
   * Get processing job by ID
   */
  async getProcessingJob(jobId: number): Promise<ImageProcessingJob | null> {
    const result = await this.db
      .select()
      .from(imageProcessingJobs)
      .where(eq(imageProcessingJobs.id, jobId))
      .limit(1)
    return result[0] || null
  }

  /**
   * Get image analytics summary
   */
  async getImageAnalyticsSummary(): Promise<{
    total_images: number
    total_storage: number
    avg_file_size: number
    processed_today: number
  }> {
    const basicStats = await this.db
      .select({
        total_images: count(),
        total_storage: sql<number>`SUM(${images.size})`,
        avg_file_size: sql<number>`AVG(${images.size})`
      })
      .from(images)
      .where(eq(images.isActive, true))

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    
    const todayStats = await this.db
      .select({
        processed_today: count()
      })
      .from(images)
      .where(
        and(
          eq(images.isActive, true),
          sql`${images.uploadedAt} >= ${todayStart.toISOString()}`
        )
      )

    return {
      total_images: basicStats[0]?.total_images || 0,
      total_storage: basicStats[0]?.total_storage || 0,
      avg_file_size: basicStats[0]?.avg_file_size || 0,
      processed_today: todayStats[0]?.processed_today || 0
    }
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(): Promise<Array<{
    category: string
    count: number
  }>> {
    return this.db
      .select({
        category: images.category,
        count: count()
      })
      .from(images)
      .where(eq(images.isActive, true))
      .groupBy(images.category)
      .orderBy(desc(count()))
  }

  /**
   * Get processing job statistics
   */
  async getJobStats(): Promise<Array<{
    status: string
    count: number
    avg_duration: number
  }>> {
    return this.db
      .select({
        status: imageProcessingJobs.status,
        count: count(),
        avg_duration: sql<number>`
          AVG(
            CASE 
              WHEN ${imageProcessingJobs.completedAt} IS NOT NULL AND ${imageProcessingJobs.startedAt} IS NOT NULL
              THEN (julianday(${imageProcessingJobs.completedAt}) - julianday(${imageProcessingJobs.startedAt})) * 24 * 60 * 60
              ELSE 0
            END
          )
        `
      })
      .from(imageProcessingJobs)
      .groupBy(imageProcessingJobs.status)
      .orderBy(desc(count()))
  }
}

// Types exported through services/index.ts