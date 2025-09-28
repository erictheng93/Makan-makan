/**
 * QR Codes Feature Tests
 * Unit tests for the QR codes feature module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QrCodesService } from '../services/QrCodesService'
import type { Env } from '../../../shared/types'

// Mock environment
const mockEnv: Env = {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret',
  API_VERSION: '1.0.0',
  DB: {} as any,
  CACHE_KV: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn()
  } as any,
  TOKEN_BLACKLIST: {} as any,
  IMAGES_BUCKET: {} as any,
  BACKUP_STORAGE: {} as any,
  JOB_QUEUE: {} as any,
  REALTIME_ORDERS: {} as any,
  ANALYTICS_ENGINE: {
    writeDataPoint: vi.fn()
  } as any,
  RATE_LIMIT_KV: {} as any,
  REALTIME_SESSION: {} as any,
  API_BASE_URL: 'http://localhost:8787',
  INTERNAL_API_TOKEN: 'test-token',
  SLACK_WEBHOOK_URL: 'https://test-webhook.com',
  CLOUDFLARE_IMAGES_KEY: 'test-images-key'
}

describe('QrCodesService', () => {
  let service: QrCodesService

  beforeEach(() => {
    service = new QrCodesService(mockEnv)
    vi.clearAllMocks()
  })

  describe('generateQR', () => {
    it('should generate a QR code successfully', async () => {
      const mockData = {
        content: 'https://example.com/menu/123',
        format: 'png' as const,
        style: {
          size: 200,
          foregroundColor: '#000000',
          backgroundColor: '#ffffff'
        }
      }

      // Mock the underlying QRCodeService method
      vi.spyOn(service['qrService'], 'generateQRCode').mockResolvedValue({
        id: 'qr123',
        content: mockData.content,
        format: mockData.format,
        url: 'https://example.com/qr/qr123.png',
        styleJson: JSON.stringify(mockData.style),
        metadataJson: null,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      } as any)

      vi.spyOn(service['qrService'], 'createAuditLog').mockResolvedValue()

      const result = await service.generateQR(mockData, 1, 100)

      expect(result).toMatchObject({
        content: mockData.content,
        format: mockData.format,
        style: mockData.style,
        userId: 1,
        restaurantId: 100
      })
      expect(result.id).toBeDefined()
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)
    })
  })

  describe('generateBulkQR', () => {
    it('should generate bulk QR codes successfully', async () => {
      const mockData = {
        tables: [
          { id: 1, name: 'Table 1', content: 'https://example.com/table/1' },
          { id: 2, name: 'Table 2', content: 'https://example.com/table/2' }
        ],
        format: 'zip' as const
      }

      vi.spyOn(service['qrService'], 'generateBulkQRCodes').mockResolvedValue({
        batchId: 'batch123',
        totalCodes: 2
      })

      const result = await service.generateBulkQR(mockData, 1, 100)

      expect(result).toMatchObject({
        itemCount: 2,
        format: 'zip',
        status: 'completed',
        userId: 1,
        restaurantId: 100
      })
      expect(result.batchId).toBeDefined()
    })

    it('should throw error if userId or restaurantId is missing', async () => {
      const mockData = {
        tables: [
          { id: 1, name: 'Table 1', content: 'https://example.com/table/1' }
        ]
      }

      await expect(service.generateBulkQR(mockData)).rejects.toThrow(
        'Restaurant ID and User ID are required for bulk generation'
      )
    })
  })

  describe('downloadQR', () => {
    it('should return null for non-existent QR code', async () => {
      vi.spyOn(service['qrService'], 'getQRCode').mockResolvedValue(null)

      const result = await service.downloadQR(999)
      expect(result).toBeNull()
    })

    it('should return download data for existing QR code', async () => {
      vi.spyOn(service['qrService'], 'getQRCode').mockResolvedValue({
        id: 'qr123',
        content: 'test',
        format: 'png',
        url: null,
        styleJson: null,
        metadataJson: null,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      } as any)

      vi.spyOn(service['qrService'], 'recordDownload').mockResolvedValue()

      const result = await service.downloadQR(123)

      expect(result).toMatchObject({
        contentType: 'image/png',
        filename: 'qr-code-123.png'
      })
      expect(result?.data).toBeInstanceOf(Buffer)
    })
  })

  describe('getStatistics', () => {
    it('should return QR code statistics', async () => {
      const mockStats = {
        totalCodes: 10,
        todayCodes: 2,
        totalDownloads: 25,
        popularTemplates: []
      }

      vi.spyOn(service['qrService'], 'getQRCodeStats').mockResolvedValue(mockStats)

      const result = await service.getStatistics(100)

      expect(result).toMatchObject({
        totalQRCodes: 10,
        totalDownloads: 25,
        totalTemplates: 0,
        popularTemplates: [],
        formatDistribution: {},
        recentActivity: []
      })
    })
  })

  describe('listTemplates', () => {
    it('should return list of templates', async () => {
      const mockTemplates = [
        {
          id: 1,
          name: 'Modern Template',
          description: 'A modern QR code template',
          styleJson: '{"size": 200}',
          isActive: true,
          isDefault: false,
          createdBy: 1,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        }
      ]

      vi.spyOn(service['qrService'], 'getActiveTemplates').mockResolvedValue(mockTemplates as any)

      const result = await service.listTemplates()

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 1,
        name: 'Modern Template',
        description: 'A modern QR code template',
        category: 'modern',
        isActive: true
      })
    })
  })

  describe('createTemplate', () => {
    it('should create a new template', async () => {
      const mockTemplateData = {
        name: 'Test Template',
        description: 'A test template',
        category: 'modern' as const,
        style: { size: 200, foregroundColor: '#000000' }
      }

      const mockCreatedTemplate = {
        id: 1,
        name: mockTemplateData.name,
        description: mockTemplateData.description,
        styleJson: JSON.stringify(mockTemplateData.style),
        isActive: true,
        isDefault: false,
        createdBy: 1,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }

      vi.spyOn(service['qrService'], 'createTemplate').mockResolvedValue(mockCreatedTemplate as any)

      const result = await service.createTemplate(mockTemplateData)

      expect(result).toMatchObject({
        name: mockTemplateData.name,
        description: mockTemplateData.description,
        category: mockTemplateData.category,
        style: mockTemplateData.style,
        isActive: true
      })
    })
  })
})

// Integration tests would go here
describe('QR Codes API Integration', () => {
  // TODO: Add integration tests for the HTTP endpoints
  // These would test the actual routes with real HTTP requests
})

// Performance tests
describe('QR Codes Performance', () => {
  // TODO: Add performance tests to ensure operations complete within acceptable time limits
})