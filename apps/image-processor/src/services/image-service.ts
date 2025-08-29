import type { 
  Env, 
  ImageMetadata, 
  ImageProcessingJob, 
  ImageAnalytics,
  ImageTransformation 
} from '../types/env'

/**
 * Image service for database operations and metadata management
 */
export class ImageService {
  private db: D1Database
  private cache: KVNamespace

  constructor(env: Env) {
    this.db = env.DB
    this.cache = env.IMAGE_CACHE
  }

  /**
   * Save image metadata to database
   */
  async saveImageMetadata(metadata: Omit<ImageMetadata, 'id'>): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const imageId = metadata.filename.split('.')[0] // Use filename without extension as ID
      
      const result = await this.db.prepare(`
        INSERT INTO images (
          id, filename, original_filename, mime_type, size, width, height,
          variants, uploaded_at, uploaded_by, restaurant_id, category,
          tags, alt_text, caption, exif_data, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        imageId,
        metadata.filename,
        metadata.originalFilename,
        metadata.mimeType,
        metadata.size,
        metadata.width || null,
        metadata.height || null,
        JSON.stringify(metadata.variants),
        metadata.uploadedAt,
        metadata.uploadedBy || null,
        metadata.restaurantId || null,
        metadata.category || null,
        metadata.tags ? JSON.stringify(metadata.tags) : null,
        metadata.altText || null,
        metadata.caption || null,
        metadata.exifData ? JSON.stringify(metadata.exifData) : null
      ).run()

      // Cache the metadata for quick access
      await this.cache.put(
        `image:${imageId}`,
        JSON.stringify({ id: imageId, ...metadata }),
        { expirationTtl: 3600 } // Cache for 1 hour
      )

      return {
        success: true,
        id: imageId
      }

    } catch (error) {
      console.error('Error saving image metadata:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save metadata'
      }
    }
  }

  /**
   * Get image metadata by ID
   */
  async getImageMetadata(imageId: string): Promise<{ success: boolean; data?: ImageMetadata; error?: string }> {
    try {
      // Try cache first
      const cached = await this.cache.get(`image:${imageId}`)
      if (cached) {
        return {
          success: true,
          data: JSON.parse(cached)
        }
      }

      // Fetch from database
      const result = await this.db.prepare(`
        SELECT 
          id, filename, original_filename, mime_type, size, width, height,
          variants, uploaded_at, uploaded_by, restaurant_id, category,
          tags, alt_text, caption, exif_data
        FROM images 
        WHERE id = ?
      `).bind(imageId).first()

      if (!result) {
        return {
          success: false,
          error: 'Image not found'
        }
      }

      const metadata: ImageMetadata = {
        id: result.id as string,
        filename: result.filename as string,
        originalFilename: result.original_filename as string,
        mimeType: result.mime_type as string,
        size: result.size as number,
        width: result.width as number | undefined,
        height: result.height as number | undefined,
        variants: JSON.parse(result.variants as string),
        uploadedAt: result.uploaded_at as string,
        uploadedBy: result.uploaded_by as number | undefined,
        restaurantId: result.restaurant_id as number | undefined,
        category: result.category as string | undefined,
        tags: result.tags ? JSON.parse(result.tags as string) : undefined,
        altText: result.alt_text as string | undefined,
        caption: result.caption as string | undefined,
        exifData: result.exif_data ? JSON.parse(result.exif_data as string) : undefined
      }

      // Cache the result
      await this.cache.put(
        `image:${imageId}`,
        JSON.stringify(metadata),
        { expirationTtl: 3600 }
      )

      return {
        success: true,
        data: metadata
      }

    } catch (error) {
      console.error('Error getting image metadata:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get metadata'
      }
    }
  }

  /**
   * Update image metadata
   */
  async updateImageMetadata(
    imageId: string,
    updates: Partial<Omit<ImageMetadata, 'id' | 'filename' | 'uploadedAt'>>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateFields: string[] = []
      const params: any[] = []

      if (updates.altText !== undefined) {
        updateFields.push('alt_text = ?')
        params.push(updates.altText)
      }

      if (updates.caption !== undefined) {
        updateFields.push('caption = ?')
        params.push(updates.caption)
      }

      if (updates.category !== undefined) {
        updateFields.push('category = ?')
        params.push(updates.category)
      }

      if (updates.tags !== undefined) {
        updateFields.push('tags = ?')
        params.push(updates.tags ? JSON.stringify(updates.tags) : null)
      }

      if (updates.variants !== undefined) {
        updateFields.push('variants = ?')
        params.push(JSON.stringify(updates.variants))
      }

      if (updateFields.length === 0) {
        return {
          success: false,
          error: 'No fields to update'
        }
      }

      updateFields.push('updated_at = datetime(\'now\')')
      params.push(imageId)

      await this.db.prepare(`
        UPDATE images 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `).bind(...params).run()

      // Invalidate cache
      await this.cache.delete(`image:${imageId}`)

      return { success: true }

    } catch (error) {
      console.error('Error updating image metadata:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update metadata'
      }
    }
  }

  /**
   * Delete image metadata
   */
  async deleteImageMetadata(imageId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.db.prepare(`
        DELETE FROM images WHERE id = ?
      `).bind(imageId).run()

      // Remove from cache
      await this.cache.delete(`image:${imageId}`)

      return { success: true }

    } catch (error) {
      console.error('Error deleting image metadata:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete metadata'
      }
    }
  }

  /**
   * List images with filtering and pagination
   */
  async listImages(options: {
    restaurantId?: number
    category?: string
    uploadedBy?: number
    tags?: string[]
    page?: number
    limit?: number
    sortBy?: 'uploaded_at' | 'filename' | 'size'
    sortOrder?: 'ASC' | 'DESC'
  } = {}): Promise<{ success: boolean; data?: { images: ImageMetadata[]; total: number }; error?: string }> {
    try {
      const {
        restaurantId,
        category,
        uploadedBy,
        tags,
        page = 1,
        limit = 20,
        sortBy = 'uploaded_at',
        sortOrder = 'DESC'
      } = options

      let whereConditions: string[] = []
      let params: any[] = []

      if (restaurantId !== undefined) {
        whereConditions.push('restaurant_id = ?')
        params.push(restaurantId)
      }

      if (category !== undefined) {
        whereConditions.push('category = ?')
        params.push(category)
      }

      if (uploadedBy !== undefined) {
        whereConditions.push('uploaded_by = ?')
        params.push(uploadedBy)
      }

      if (tags && tags.length > 0) {
        // Simple tag search - could be improved with proper tag table
        const tagConditions = tags.map(() => 'tags LIKE ?').join(' AND ')
        whereConditions.push(`(${tagConditions})`)
        tags.forEach(tag => params.push(`%"${tag}"%`))
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : ''

      // Get total count
      const countResult = await this.db.prepare(`
        SELECT COUNT(*) as total FROM images ${whereClause}
      `).bind(...params).first()

      const total = countResult?.total as number || 0

      // Get paginated results
      const offset = (page - 1) * limit
      const images = await this.db.prepare(`
        SELECT 
          id, filename, original_filename, mime_type, size, width, height,
          variants, uploaded_at, uploaded_by, restaurant_id, category,
          tags, alt_text, caption
        FROM images 
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all()

      const imageList: ImageMetadata[] = (images.results || []).map((row: any) => ({
        id: row.id,
        filename: row.filename,
        originalFilename: row.original_filename,
        mimeType: row.mime_type,
        size: row.size,
        width: row.width,
        height: row.height,
        variants: JSON.parse(row.variants),
        uploadedAt: row.uploaded_at,
        uploadedBy: row.uploaded_by,
        restaurantId: row.restaurant_id,
        category: row.category,
        tags: row.tags ? JSON.parse(row.tags) : undefined,
        altText: row.alt_text,
        caption: row.caption
      }))

      return {
        success: true,
        data: {
          images: imageList,
          total
        }
      }

    } catch (error) {
      console.error('Error listing images:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list images'
      }
    }
  }

  /**
   * Create processing job
   */
  async createProcessingJob(
    imageId: string,
    transformations: ImageTransformation[],
    variants: string[]
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const job: ImageProcessingJob = {
        id: jobId,
        imageId,
        status: 'pending',
        transformations,
        variants,
        createdAt: new Date().toISOString()
      }

      await this.db.prepare(`
        INSERT INTO image_processing_jobs (
          id, image_id, status, transformations, variants, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        jobId,
        imageId,
        'pending',
        JSON.stringify(transformations),
        JSON.stringify(variants),
        job.createdAt
      ).run()

      // Cache job for quick access
      await this.cache.put(`job:${jobId}`, JSON.stringify(job), { expirationTtl: 3600 })

      return {
        success: true,
        jobId
      }

    } catch (error) {
      console.error('Error creating processing job:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create job'
      }
    }
  }

  /**
   * Update processing job status
   */
  async updateJobStatus(
    jobId: string,
    status: ImageProcessingJob['status'],
    progress?: number,
    error?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateFields = ['status = ?', 'updated_at = datetime(\'now\')']
      const params = [status]

      if (progress !== undefined) {
        updateFields.push('progress = ?')
        params.push(progress)
      }

      if (error !== undefined) {
        updateFields.push('error = ?')
        params.push(error)
      }

      if (status === 'completed') {
        updateFields.push('completed_at = datetime(\'now\')')
      }

      params.push(jobId)

      await this.db.prepare(`
        UPDATE image_processing_jobs 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `).bind(...params).run()

      // Update cache
      const cached = await this.cache.get(`job:${jobId}`)
      if (cached) {
        const job = JSON.parse(cached)
        job.status = status
        if (progress !== undefined) job.progress = progress
        if (error !== undefined) job.error = error
        if (status === 'completed') job.completedAt = new Date().toISOString()
        
        await this.cache.put(`job:${jobId}`, JSON.stringify(job), { expirationTtl: 3600 })
      }

      return { success: true }

    } catch (error) {
      console.error('Error updating job status:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update job'
      }
    }
  }

  /**
   * Get processing job status
   */
  async getJobStatus(jobId: string): Promise<{ success: boolean; job?: ImageProcessingJob; error?: string }> {
    try {
      // Try cache first
      const cached = await this.cache.get(`job:${jobId}`)
      if (cached) {
        return {
          success: true,
          job: JSON.parse(cached)
        }
      }

      // Fetch from database
      const result = await this.db.prepare(`
        SELECT * FROM image_processing_jobs WHERE id = ?
      `).bind(jobId).first()

      if (!result) {
        return {
          success: false,
          error: 'Job not found'
        }
      }

      const job: ImageProcessingJob = {
        id: result.id as string,
        imageId: result.image_id as string,
        status: result.status as ImageProcessingJob['status'],
        transformations: JSON.parse(result.transformations as string),
        variants: JSON.parse(result.variants as string),
        createdAt: result.created_at as string,
        completedAt: result.completed_at as string | undefined,
        error: result.error as string | undefined,
        progress: result.progress as number | undefined
      }

      return {
        success: true,
        job
      }

    } catch (error) {
      console.error('Error getting job status:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get job status'
      }
    }
  }

  /**
   * Get image analytics
   */
  async getImageAnalytics(options: {
    restaurantId?: number
    dateFrom?: string
    dateTo?: string
  } = {}): Promise<{ success: boolean; analytics?: ImageAnalytics; error?: string }> {
    try {
      const { restaurantId, dateFrom, dateTo } = options

      let whereConditions: string[] = []
      let params: any[] = []

      if (restaurantId !== undefined) {
        whereConditions.push('restaurant_id = ?')
        params.push(restaurantId)
      }

      if (dateFrom) {
        whereConditions.push('uploaded_at >= ?')
        params.push(dateFrom)
      }

      if (dateTo) {
        whereConditions.push('uploaded_at <= ?')
        params.push(dateTo)
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : ''

      // Basic statistics
      const basicStats = await this.db.prepare(`
        SELECT 
          COUNT(*) as total_images,
          SUM(size) as total_size,
          AVG(size) as avg_size
        FROM images ${whereClause}
      `).bind(...params).first()

      // Category breakdown
      const categoryStats = await this.db.prepare(`
        SELECT 
          category,
          COUNT(*) as count
        FROM images ${whereClause}
        GROUP BY category
        ORDER BY count DESC
        LIMIT 10
      `).bind(...params).all()

      // Processing job statistics
      const jobStats = await this.db.prepare(`
        SELECT 
          status,
          COUNT(*) as count,
          AVG(
            CASE 
              WHEN completed_at IS NOT NULL AND created_at IS NOT NULL 
              THEN (julianday(completed_at) - julianday(created_at)) * 24 * 60 * 60
              ELSE NULL 
            END
          ) as avg_processing_time_seconds
        FROM image_processing_jobs
        GROUP BY status
      `).all()

      const analytics: ImageAnalytics = {
        totalImages: basicStats?.total_images as number || 0,
        totalSize: basicStats?.total_size as number || 0,
        avgProcessingTime: 0, // Will be calculated from job stats
        mostUsedVariants: [], // Would need variant usage tracking
        uploadsByCategory: (categoryStats.results || []).map((row: any) => ({
          category: row.category || 'uncategorized',
          count: row.count
        })),
        errorRate: 0, // Calculate from job stats
        storageUsage: {
          original: basicStats?.total_size as number || 0,
          variants: 0, // Would need variant size tracking
          total: basicStats?.total_size as number || 0
        }
      }

      // Calculate processing metrics from job stats
      const jobResults = jobStats.results || []
      const completedJobs = jobResults.find((row: any) => row.status === 'completed')
      const failedJobs = jobResults.find((row: any) => row.status === 'failed')
      const totalJobs = jobResults.reduce((sum: number, row: any) => sum + row.count, 0)

      if (completedJobs) {
        analytics.avgProcessingTime = completedJobs.avg_processing_time_seconds || 0
      }

      if (failedJobs && totalJobs > 0) {
        analytics.errorRate = (failedJobs.count / totalJobs) * 100
      }

      return {
        success: true,
        analytics
      }

    } catch (error) {
      console.error('Error getting image analytics:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get analytics'
      }
    }
  }

  /**
   * Record image view/access for analytics
   */
  async recordImageView(imageId: string, variant: string = 'original'): Promise<void> {
    try {
      await this.db.prepare(`
        INSERT INTO image_views (image_id, variant, viewed_at)
        VALUES (?, ?, datetime('now'))
      `).bind(imageId, variant).run()
    } catch (error) {
      // Log error but don't fail the request
      console.error('Error recording image view:', error)
    }
  }
}