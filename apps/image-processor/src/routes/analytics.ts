import { Hono } from 'hono'
import { z } from 'zod'
import { ImageService } from '../services/image-service'
import { authMiddleware, requireRole } from '../middleware/auth'
import { validateQuery, imageSchemas } from '../middleware/validation'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

/**
 * Get image analytics dashboard
 * GET /analytics/dashboard
 */
app.get('/dashboard',
  authMiddleware,
  requireRole([0, 1]), // Admin, Owner
  validateQuery(imageSchemas.analyticsQuery),
  async (c) => {
    try {
      const user = c.get('user')
      const query = c.get('validatedQuery')
      const imageService = new ImageService(c.env)

      // Apply access control
      let options = { ...query }
      if (user.role !== 0) {
        options.restaurantId = user.restaurantId
      }

      const result = await imageService.getImageAnalytics(options)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error || 'Failed to get analytics'
        }, 500)
      }

      return c.json({
        success: true,
        data: result.analytics
      })

    } catch (error) {
      console.error('Analytics dashboard error:', error)
      return c.json({
        success: false,
        error: 'Failed to get analytics dashboard'
      }, 500)
    }
  }
)

/**
 * Get storage usage analytics
 * GET /analytics/storage
 */
app.get('/storage',
  authMiddleware,
  requireRole([0, 1]), // Admin, Owner
  validateQuery(imageSchemas.analyticsQuery),
  async (c) => {
    try {
      const user = c.get('user')
      const query = c.get('validatedQuery')

      let whereConditions: string[] = []
      let params: any[] = []

      // Apply access control
      if (user.role !== 0) {
        whereConditions.push('restaurant_id = ?')
        params.push(user.restaurantId)
      } else if (query.restaurantId) {
        whereConditions.push('restaurant_id = ?')
        params.push(query.restaurantId)
      }

      if (query.dateFrom) {
        whereConditions.push('uploaded_at >= ?')
        params.push(query.dateFrom)
      }

      if (query.dateTo) {
        whereConditions.push('uploaded_at <= ?')
        params.push(query.dateTo)
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : ''

      // Storage by category
      const categoryStorage = await c.env.DB.prepare(`
        SELECT 
          category,
          COUNT(*) as image_count,
          SUM(size) as total_size,
          AVG(size) as avg_size,
          MAX(size) as max_size,
          MIN(size) as min_size
        FROM images ${whereClause}
        GROUP BY category
        ORDER BY total_size DESC
      `).bind(...params).all()

      // Storage by format
      const formatStorage = await c.env.DB.prepare(`
        SELECT 
          mime_type,
          COUNT(*) as image_count,
          SUM(size) as total_size,
          AVG(size) as avg_size
        FROM images ${whereClause}
        GROUP BY mime_type
        ORDER BY total_size DESC
      `).bind(...params).all()

      // Monthly upload trends
      const monthlyTrends = await c.env.DB.prepare(`
        SELECT 
          strftime('%Y-%m', uploaded_at) as month,
          COUNT(*) as images_uploaded,
          SUM(size) as storage_used,
          AVG(size) as avg_file_size
        FROM images ${whereClause}
        GROUP BY strftime('%Y-%m', uploaded_at)
        ORDER BY month DESC
        LIMIT 12
      `).bind(...params).all()

      // Total storage statistics
      const totalStats = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_images,
          SUM(size) as total_storage,
          AVG(size) as avg_file_size,
          MAX(size) as largest_file,
          MIN(size) as smallest_file
        FROM images ${whereClause}
      `).bind(...params).first()

      return c.json({
        success: true,
        data: {
          summary: totalStats,
          by_category: categoryStorage.results || [],
          by_format: formatStorage.results || [],
          monthly_trends: monthlyTrends.results || []
        }
      })

    } catch (error) {
      console.error('Storage analytics error:', error)
      return c.json({
        success: false,
        error: 'Failed to get storage analytics'
      }, 500)
    }
  }
)

/**
 * Get image usage analytics
 * GET /analytics/usage
 */
app.get('/usage',
  authMiddleware,
  requireRole([0, 1]), // Admin, Owner
  validateQuery(imageSchemas.analyticsQuery),
  async (c) => {
    try {
      const user = c.get('user')
      const query = c.get('validatedQuery')

      let whereConditions: string[] = []
      let params: any[] = []

      // Apply access control for image views
      if (user.role !== 0) {
        whereConditions.push('iv.image_id IN (SELECT id FROM images WHERE restaurant_id = ?)')
        params.push(user.restaurantId)
      } else if (query.restaurantId) {
        whereConditions.push('iv.image_id IN (SELECT id FROM images WHERE restaurant_id = ?)')
        params.push(query.restaurantId)
      }

      if (query.dateFrom) {
        whereConditions.push('iv.viewed_at >= ?')
        params.push(query.dateFrom)
      }

      if (query.dateTo) {
        whereConditions.push('iv.viewed_at <= ?')
        params.push(query.dateTo)
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : ''

      // Most viewed images
      const mostViewedImages = await c.env.DB.prepare(`
        SELECT 
          i.id,
          i.filename,
          i.original_filename,
          i.category,
          COUNT(iv.id) as view_count,
          COUNT(DISTINCT DATE(iv.viewed_at)) as days_viewed
        FROM images i
        LEFT JOIN image_views iv ON i.id = iv.image_id
        ${whereClause.replace('iv.image_id IN (SELECT id FROM images WHERE restaurant_id = ?)', 'i.restaurant_id = ?')}
        GROUP BY i.id, i.filename, i.original_filename, i.category
        HAVING COUNT(iv.id) > 0
        ORDER BY view_count DESC
        LIMIT 20
      `).bind(...params).all()

      // Variant usage statistics
      const variantUsage = await c.env.DB.prepare(`
        SELECT 
          variant,
          COUNT(*) as usage_count,
          COUNT(DISTINCT image_id) as unique_images
        FROM image_views iv
        ${whereClause}
        GROUP BY variant
        ORDER BY usage_count DESC
      `).bind(...params).all()

      // Daily usage trends
      const dailyUsage = await c.env.DB.prepare(`
        SELECT 
          DATE(viewed_at) as date,
          COUNT(*) as total_views,
          COUNT(DISTINCT image_id) as unique_images_viewed
        FROM image_views iv
        ${whereClause}
        GROUP BY DATE(viewed_at)
        ORDER BY date DESC
        LIMIT 30
      `).bind(...params).all()

      // Peak usage hours
      const hourlyUsage = await c.env.DB.prepare(`
        SELECT 
          strftime('%H', viewed_at) as hour,
          COUNT(*) as view_count,
          AVG(COUNT(*)) OVER() as avg_hourly_views
        FROM image_views iv
        ${whereClause}
        GROUP BY strftime('%H', viewed_at)
        ORDER BY hour
      `).bind(...params).all()

      return c.json({
        success: true,
        data: {
          most_viewed_images: mostViewedImages.results || [],
          variant_usage: variantUsage.results || [],
          daily_trends: dailyUsage.results || [],
          hourly_distribution: hourlyUsage.results || []
        }
      })

    } catch (error) {
      console.error('Usage analytics error:', error)
      return c.json({
        success: false,
        error: 'Failed to get usage analytics'
      }, 500)
    }
  }
)

/**
 * Get processing performance analytics
 * GET /analytics/performance
 */
app.get('/performance',
  authMiddleware,
  requireRole([0, 1]), // Admin, Owner
  validateQuery(imageSchemas.analyticsQuery),
  async (c) => {
    try {
      const user = c.get('user')
      const query = c.get('validatedQuery')

      let whereConditions: string[] = []
      let params: any[] = []

      if (query.dateFrom) {
        whereConditions.push('created_at >= ?')
        params.push(query.dateFrom)
      }

      if (query.dateTo) {
        whereConditions.push('created_at <= ?')
        params.push(query.dateTo)
      }

      // If not admin, filter by restaurant (via image ownership)
      if (user.role !== 0) {
        whereConditions.push(`image_id IN (
          SELECT id FROM images WHERE restaurant_id = ?
        )`)
        params.push(user.restaurantId)
      } else if (query.restaurantId) {
        whereConditions.push(`image_id IN (
          SELECT id FROM images WHERE restaurant_id = ?
        )`)
        params.push(query.restaurantId)
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : ''

      // Processing job statistics
      const jobStats = await c.env.DB.prepare(`
        SELECT 
          status,
          COUNT(*) as job_count,
          AVG(
            CASE 
              WHEN completed_at IS NOT NULL AND created_at IS NOT NULL 
              THEN (julianday(completed_at) - julianday(created_at)) * 24 * 60 * 60
              ELSE NULL 
            END
          ) as avg_processing_time_seconds,
          MIN(
            CASE 
              WHEN completed_at IS NOT NULL AND created_at IS NOT NULL 
              THEN (julianday(completed_at) - julianday(created_at)) * 24 * 60 * 60
              ELSE NULL 
            END
          ) as min_processing_time_seconds,
          MAX(
            CASE 
              WHEN completed_at IS NOT NULL AND created_at IS NOT NULL 
              THEN (julianday(completed_at) - julianday(created_at)) * 24 * 60 * 60
              ELSE NULL 
            END
          ) as max_processing_time_seconds
        FROM image_processing_jobs ${whereClause}
        GROUP BY status
        ORDER BY job_count DESC
      `).bind(...params).all()

      // Processing trends over time
      const processingTrends = await c.env.DB.prepare(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as jobs_created,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as jobs_completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as jobs_failed,
          AVG(
            CASE 
              WHEN completed_at IS NOT NULL AND created_at IS NOT NULL 
              THEN (julianday(completed_at) - julianday(created_at)) * 24 * 60 * 60
              ELSE NULL 
            END
          ) as avg_processing_time
        FROM image_processing_jobs ${whereClause}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `).bind(...params).all()

      // Error analysis
      const errorAnalysis = await c.env.DB.prepare(`
        SELECT 
          error,
          COUNT(*) as error_count
        FROM image_processing_jobs 
        ${whereClause} AND status = 'failed' AND error IS NOT NULL
        GROUP BY error
        ORDER BY error_count DESC
        LIMIT 10
      `).bind(...params).all()

      // Calculate performance metrics
      const jobResults = jobStats.results || []
      const totalJobs = jobResults.reduce((sum: number, row: any) => sum + row.job_count, 0)
      const completedJobs = jobResults.find((row: any) => row.status === 'completed')?.job_count || 0
      const failedJobs = jobResults.find((row: any) => row.status === 'failed')?.job_count || 0

      const performanceMetrics = {
        total_jobs: totalJobs,
        success_rate: totalJobs > 0 ? Number(((completedJobs / totalJobs) * 100).toFixed(2)) : 0,
        failure_rate: totalJobs > 0 ? Number(((failedJobs / totalJobs) * 100).toFixed(2)) : 0,
        avg_processing_time: completedJobs > 0 ? 
          jobResults.find((row: any) => row.status === 'completed')?.avg_processing_time_seconds || 0 : 0
      }

      return c.json({
        success: true,
        data: {
          performance_metrics: performanceMetrics,
          job_statistics: jobResults,
          processing_trends: processingTrends.results || [],
          error_analysis: errorAnalysis.results || []
        }
      })

    } catch (error) {
      console.error('Performance analytics error:', error)
      return c.json({
        success: false,
        error: 'Failed to get performance analytics'
      }, 500)
    }
  }
)

/**
 * Export analytics data
 * GET /analytics/export
 */
app.get('/export',
  authMiddleware,
  requireRole([0, 1]), // Admin, Owner
  validateQuery(imageSchemas.analyticsQuery.extend({
    type: z.enum(['summary', 'storage', 'usage', 'performance']).default('summary'),
    format: z.enum(['json', 'csv']).default('json')
  })),
  async (c) => {
    try {
      const { type, format } = c.get('validatedQuery')

      // For now, return a JSON response with export information
      // In a real implementation, you would generate the actual file
      
      return c.json({
        success: true,
        data: {
          type,
          format,
          message: 'Export functionality would generate downloadable file here',
          download_url: `https://api.makanmakan.com/images/analytics/exports/${Date.now()}.${format}`,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      })

    } catch (error) {
      console.error('Export analytics error:', error)
      return c.json({
        success: false,
        error: 'Failed to export analytics'
      }, 500)
    }
  }
)

export default app