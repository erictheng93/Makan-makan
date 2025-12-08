/**
 * QR Codes Service
 * Business logic for QR codes feature
 */

import type { Env } from '../../../shared/types'
import { getDatabaseConnection } from '../../../core/database'
import { KVCacheService } from '../../../core/cache'
import { ConsoleLogger, SimplePerformanceTracker } from '../../../core/monitoring'
import { CACHE_TTL } from '../../../shared/constants'
import { QRCodeService } from '@makanmakan/database'

// Import types
import type {
  QRCodeEntity,
  QRBatchEntity,
  QRTemplate,
  GenerateQRRequest,
  BulkQRRequest,
  CreateQRTemplateData,
  UpdateQRTemplateData,
  QRStatistics,
  IQRCodeService,
  IQRTemplateService
} from '../types'

export class QrCodesService implements IQRCodeService, IQRTemplateService {
  private db: ReturnType<typeof getDatabaseConnection>
  private qrService: QRCodeService
  private cache: KVCacheService
  private logger: ConsoleLogger
  private performance: SimplePerformanceTracker

  constructor(private env: Env) {
    this.db = getDatabaseConnection(env)
    this.qrService = new QRCodeService(env.DB, env)
    this.cache = new KVCacheService(env.CACHE_KV)
    this.logger = new ConsoleLogger('qr-codes-service')
    this.performance = new SimplePerformanceTracker()
  }

  // QR Code Generation Methods
  async generateQR(data: GenerateQRRequest, userId?: number, restaurantId?: number): Promise<QRCodeEntity> {
    const timer = this.performance.startTimer('qr-codes.generate')

    try {
      // Add creator information to metadata
      if (!data.metadata) {
        data.metadata = {}
      }

      if (userId) {
        data.metadata.createdBy = userId.toString()
      }

      // Call the existing QRCodeService with correct method name
      const result = await this.qrService.generateQRCode({
        content: data.content,
        format: data.format || 'png',
        style: data.style,
        metadata: data.metadata
      })

      // Transform result to match our entity interface
      const qrEntity: QRCodeEntity = {
        id: result.id ? parseInt(result.id.toString()) : Math.floor(Math.random() * 1000000),
        content: data.content,
        format: data.format || 'png',
        style: data.style,
        metadata: data.metadata,
        downloadUrl: result.url || undefined,
        downloadCount: 0,
        fileSize: undefined,
        restaurantId,
        userId,
        createdAt: new Date(result.createdAt),
        updatedAt: new Date(result.createdAt)
      }

      // Create audit log
      await this.qrService.createAuditLog({
        userId: userId || 0,
        action: 'QR_GENERATED',
        resource: 'qr_codes',
        description: `Generated QR code for content: ${data.content.substring(0, 50)}...`
      })

      this.logger.info('QR Code generated', {
        id: qrEntity.id,
        format: data.format,
        userId,
        restaurantId
      })

      this.performance.recordMetric('qr-codes.generate.success', 1)
      return qrEntity

    } catch (error) {
      this.logger.error('Failed to generate QR code', error as Error, { data, userId, restaurantId })
      this.performance.recordMetric('qr-codes.generate.error', 1)
      throw error
    } finally {
      const duration = this.performance.endTimer(timer)
      this.performance.recordMetric('qr-codes.generate.duration', duration, 'ms')
    }
  }

  async generateBulkQR(data: BulkQRRequest, userId?: number, restaurantId?: number): Promise<QRBatchEntity> {
    const timer = this.performance.startTimer('qr-codes.generateBulk')

    try {
      if (!restaurantId || !userId) {
        throw new Error('Restaurant ID and User ID are required for bulk generation')
      }

      // Extract table IDs from the request
      const tableIds = data.tables.map(table => table.id)

      // Call the existing QRCodeService for bulk generation (convert to string for database service)
      const result = await this.qrService.generateBulkQRCodes(String(restaurantId), tableIds, userId)

      // Transform result to match our entity interface
      const batchEntity: QRBatchEntity = {
        id: Math.floor(Math.random() * 1000000), // We'll use the batchId as string identifier
        name: `Batch-${Date.now()}`,
        format: data.format || 'zip',
        itemCount: data.tables.length,
        downloadUrl: undefined,
        downloadCount: 0,
        totalFileSize: 0,
        restaurantId,
        userId,
        status: 'completed',
        progress: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
        batchId: result.batchId
      }

      this.logger.info('Bulk QR codes generated', {
        batchId: result.batchId,
        itemCount: data.tables.length,
        userId,
        restaurantId
      })

      this.performance.recordMetric('qr-codes.generateBulk.success', 1)
      return batchEntity

    } catch (error) {
      this.logger.error('Failed to generate bulk QR codes', error as Error, { data, userId, restaurantId })
      this.performance.recordMetric('qr-codes.generateBulk.error', 1)
      throw error
    } finally {
      const duration = this.performance.endTimer(timer)
      this.performance.recordMetric('qr-codes.generateBulk.duration', duration, 'ms')
    }
  }

  async downloadQR(id: number): Promise<{ data: Buffer; contentType: string; filename: string } | null> {
    const timer = this.performance.startTimer('qr-codes.download')

    try {
      // Get QR code details first
      const qrCode = await this.qrService.getQRCode(id.toString())

      if (!qrCode) {
        return null
      }

      // Record the download
      await this.qrService.recordDownload(id.toString(), qrCode.format || 'png')

      // For now, return a mock result since actual file generation is not implemented
      // In a real implementation, this would generate the actual QR code file
      const mockData = Buffer.from('QR code data placeholder')

      this.logger.info('QR code downloaded', { id })
      this.performance.recordMetric('qr-codes.download.success', 1)

      return {
        data: mockData,
        contentType: 'image/png',
        filename: `qr-code-${id}.png`
      }

    } catch (error) {
      this.logger.error('Failed to download QR code', error as Error, { id })
      this.performance.recordMetric('qr-codes.download.error', 1)
      throw error
    } finally {
      const duration = this.performance.endTimer(timer)
      this.performance.recordMetric('qr-codes.download.duration', duration, 'ms')
    }
  }

  async downloadBatch(batchId: string): Promise<{ data: Buffer; contentType: string; filename: string } | null> {
    const timer = this.performance.startTimer('qr-codes.downloadBatch')

    try {
      // Get batch status
      const batch = await this.qrService.getBatchStatus(batchId)

      if (!batch) {
        return null
      }

      // For now, return a mock result
      const mockData = Buffer.from('Batch QR codes zip placeholder')

      this.logger.info('Batch QR codes downloaded', { batchId })
      this.performance.recordMetric('qr-codes.downloadBatch.success', 1)

      return {
        data: mockData,
        contentType: 'application/zip',
        filename: `qr-batch-${batchId}.zip`
      }

    } catch (error) {
      this.logger.error('Failed to download batch QR codes', error as Error, { batchId })
      this.performance.recordMetric('qr-codes.downloadBatch.error', 1)
      throw error
    } finally {
      const duration = this.performance.endTimer(timer)
      this.performance.recordMetric('qr-codes.downloadBatch.duration', duration, 'ms')
    }
  }

  async getStatistics(restaurantId?: number): Promise<QRStatistics> {
    const timer = this.performance.startTimer('qr-codes.getStatistics')

    try {
      // Try cache first
      const cacheKey = `qr-stats:${restaurantId || 'global'}`
      const cached = await this.cache.get<QRStatistics>(cacheKey)

      if (cached) {
        this.logger.debug('Statistics retrieved from cache', { restaurantId })
        return cached
      }

      // Get statistics from the existing QRCodeService
      const stats = await this.qrService.getQRCodeStats()

      // Transform to match our interface
      const qrStats: QRStatistics = {
        totalQRCodes: stats.totalCodes || 0,
        totalDownloads: stats.totalDownloads || 0,
        totalTemplates: 0, // Will be calculated separately
        popularTemplates: (stats.popularTemplates || []).map(template => ({
          id: template.id,
          name: template.name,
          usage_count: template.usageCount || 0
        })),
        formatDistribution: {},
        recentActivity: []
      }

      // Cache the result
      await this.cache.set(cacheKey, qrStats, CACHE_TTL.MEDIUM)

      this.performance.recordMetric('qr-codes.getStatistics.success', 1)
      return qrStats

    } catch (error) {
      this.logger.error('Failed to get QR code statistics', error as Error, { restaurantId })
      this.performance.recordMetric('qr-codes.getStatistics.error', 1)
      throw error
    } finally {
      const duration = this.performance.endTimer(timer)
      this.performance.recordMetric('qr-codes.getStatistics.duration', duration, 'ms')
    }
  }

  // Template Management Methods
  async listTemplates(category?: string): Promise<QRTemplate[]> {
    const timer = this.performance.startTimer('qr-codes.listTemplates')

    try {
      // Try cache first
      const cacheKey = `qr-templates:${category || 'all'}`
      const cached = await this.cache.get<QRTemplate[]>(cacheKey)

      if (cached) {
        this.logger.debug('Templates retrieved from cache', { category })
        return cached
      }

      // Get templates from the existing QRCodeService
      const templates = await this.qrService.getActiveTemplates()

      // Transform to match our interface (map the database structure to our interface)
      const transformedTemplates: QRTemplate[] = templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description || '',
        category: 'modern', // Default category since it's not in DB schema
        style: template.styleJson ? JSON.parse(template.styleJson) : {},
        isActive: template.isActive,
        usage_count: 0, // Would need separate query to get usage count
        createdAt: new Date(template.createdAt),
        updatedAt: new Date(template.updatedAt)
      }))

      // Cache the result
      await this.cache.set(cacheKey, transformedTemplates, CACHE_TTL.LONG)

      this.performance.recordMetric('qr-codes.listTemplates.success', 1)
      return transformedTemplates

    } catch (error) {
      this.logger.error('Failed to list QR code templates', error as Error, { category })
      this.performance.recordMetric('qr-codes.listTemplates.error', 1)
      throw error
    } finally {
      const duration = this.performance.endTimer(timer)
      this.performance.recordMetric('qr-codes.listTemplates.duration', duration, 'ms')
    }
  }

  async getTemplate(id: number): Promise<QRTemplate | null> {
    const timer = this.performance.startTimer('qr-codes.getTemplate')

    try {
      // Try cache first
      const cacheKey = `qr-template:${id}`
      const cached = await this.cache.get<QRTemplate>(cacheKey)

      if (cached) {
        this.logger.debug('Template retrieved from cache', { id })
        return cached
      }

      // Get template from the existing QRCodeService
      const template = await this.qrService.getTemplate(id)

      if (!template) {
        return null
      }

      // Transform to match our interface
      const transformedTemplate: QRTemplate = {
        id: template.id,
        name: template.name,
        description: template.description || '',
        category: 'modern', // Default category since it's not in DB schema
        style: template.styleJson ? JSON.parse(template.styleJson) : {},
        isActive: template.isActive,
        usage_count: 0, // Would need separate query to get usage count
        createdAt: new Date(template.createdAt),
        updatedAt: new Date(template.updatedAt)
      }

      // Cache the result
      await this.cache.set(cacheKey, transformedTemplate, CACHE_TTL.LONG)

      this.performance.recordMetric('qr-codes.getTemplate.success', 1)
      return transformedTemplate

    } catch (error) {
      this.logger.error('Failed to get QR code template', error as Error, { id })
      this.performance.recordMetric('qr-codes.getTemplate.error', 1)
      throw error
    } finally {
      const duration = this.performance.endTimer(timer)
      this.performance.recordMetric('qr-codes.getTemplate.duration', duration, 'ms')
    }
  }

  async createTemplate(data: CreateQRTemplateData): Promise<QRTemplate> {
    const timer = this.performance.startTimer('qr-codes.createTemplate')

    try {
      // Create template using the existing QRCodeService - need to provide createdBy
      const template = await this.qrService.createTemplate({
        name: data.name,
        description: data.description,
        style: data.style,
        createdBy: 1 // Default user ID - should be passed from context
      })

      // Transform to match our interface
      const transformedTemplate: QRTemplate = {
        id: template.id,
        name: template.name,
        description: template.description || '',
        category: data.category,
        style: JSON.parse(template.styleJson),
        isActive: template.isActive,
        usage_count: 0,
        createdAt: new Date(template.createdAt),
        updatedAt: new Date(template.updatedAt)
      }

      // Clear template caches
      await this.cache.clear('qr-templates:')

      this.logger.info('QR code template created', { id: template.id, name: data.name })
      this.performance.recordMetric('qr-codes.createTemplate.success', 1)

      return transformedTemplate

    } catch (error) {
      this.logger.error('Failed to create QR code template', error as Error, { data })
      this.performance.recordMetric('qr-codes.createTemplate.error', 1)
      throw error
    } finally {
      const duration = this.performance.endTimer(timer)
      this.performance.recordMetric('qr-codes.createTemplate.duration', duration, 'ms')
    }
  }

  async updateTemplate(id: number, data: UpdateQRTemplateData): Promise<QRTemplate | null> {
    const timer = this.performance.startTimer('qr-codes.updateTemplate')

    try {
      // Update template using the existing QRCodeService
      const template = await this.qrService.updateTemplate(id, {
        name: data.name,
        description: data.description,
        style: data.style
      }, 1) // Default user ID - should be passed from context

      if (!template) {
        return null
      }

      // Transform to match our interface
      const transformedTemplate: QRTemplate = {
        id: template.id,
        name: template.name,
        description: template.description || '',
        category: data.category || 'modern',
        style: JSON.parse(template.styleJson),
        isActive: template.isActive,
        usage_count: 0,
        createdAt: new Date(template.createdAt),
        updatedAt: new Date(template.updatedAt)
      }

      // Clear caches
      await this.cache.delete(`qr-template:${id}`)
      await this.cache.clear('qr-templates:')

      this.logger.info('QR code template updated', { id })
      this.performance.recordMetric('qr-codes.updateTemplate.success', 1)

      return transformedTemplate

    } catch (error) {
      this.logger.error('Failed to update QR code template', error as Error, { id, data })
      this.performance.recordMetric('qr-codes.updateTemplate.error', 1)
      throw error
    } finally {
      const duration = this.performance.endTimer(timer)
      this.performance.recordMetric('qr-codes.updateTemplate.duration', duration, 'ms')
    }
  }

  async deleteTemplate(id: number): Promise<boolean> {
    const timer = this.performance.startTimer('qr-codes.deleteTemplate')

    try {
      // Delete template using the existing QRCodeService
      await this.qrService.deleteTemplate(id, 1) // Default user ID - should be passed from context

      // Clear caches
      await this.cache.delete(`qr-template:${id}`)
      await this.cache.clear('qr-templates:')

      this.logger.info('QR code template deleted', { id })
      this.performance.recordMetric('qr-codes.deleteTemplate.success', 1)

      return true

    } catch (error) {
      this.logger.error('Failed to delete QR code template', error as Error, { id })
      this.performance.recordMetric('qr-codes.deleteTemplate.error', 1)
      return false
    } finally {
      const duration = this.performance.endTimer(timer)
      this.performance.recordMetric('qr-codes.deleteTemplate.duration', duration, 'ms')
    }
  }
}