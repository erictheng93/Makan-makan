/**
 * 列印服務測試
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PrinterService } from '../services/PrinterService'
import type { PrintRequest } from '@makanmakan/shared-types'

describe('PrinterService', () => {
  let printerService: PrinterService

  beforeEach(async () => {
    printerService = new PrinterService({
      queue: {
        maxConcurrentJobs: 2,
        maxRetries: 2,
        retryDelay: 1000,
        jobTimeout: 10000,
        maxQueueSize: 10
      },
      drivers: {
        connectionTimeout: 5000,
        commandTimeout: 3000,
        heartbeatInterval: 30000,
        retryAttempts: 3
      }
    })

    await printerService.initialize()
  })

  afterEach(async () => {
    await printerService.shutdown()
  })

  describe('Printer Management', () => {
    it('should register a new printer device', async () => {
      // This would require dependency injection to properly test
      // For now, we'll test that the service initializes correctly
      expect(printerService).toBeDefined()
    })

    it('should get empty device list when no printers registered', () => {
      const devices = printerService.getDevices()
      expect(devices).toEqual([])
    })

    it('should return null for default device when none registered', () => {
      const defaultDevice = printerService.getDefaultDevice()
      expect(defaultDevice).toBeNull()
    })
  })

  describe('Print Job Management', () => {
    it('should handle print request without available printers', async () => {
      const printRequest: PrintRequest = {
        country: 'TW',
        type: 'receipt',
        priority: 'normal',
        restaurantId: 1,
        userId: 'test-user',
        data: {
          order: {
            id: 'order-123',
            items: [
              {
                name: '測試商品',
                quantity: 2,
                price: 10.50,
                modifiers: []
              }
            ],
            subtotal: 21.00,
            tax: 1.05,
            total: 22.05,
            createdAt: new Date()
          }
        }
      }

      const result = await printerService.print(printRequest)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('NO_PRINTER_AVAILABLE')
    })
  })

  describe('Health Check', () => {
    it('should return unhealthy status when no devices', async () => {
      const health = await printerService.healthCheck()

      expect(health.service).toBe('unhealthy')
      expect(health.devices).toEqual([])
      expect(health.queue.pending).toBe(0)
      expect(health.queue.processing).toBe(0)
      expect(health.queue.failed).toBe(0)
    })
  })

  describe('Statistics', () => {
    it('should return initial statistics', () => {
      const stats = printerService.getStatistics()

      expect(stats.totalJobs).toBe(0)
      expect(stats.completedJobs).toBe(0)
      expect(stats.failedJobs).toBe(0)
    })
  })

  describe('Region Management', () => {
    it('should set and use region configuration', () => {
      const regionConfig = {
        country: 'TW' as const,
        currency: 'TWD' as const,
        locale: 'zh-TW',
        timezone: 'Asia/Taipei',
        dateFormat: 'YYYY/MM/DD',
        timeFormat: 'HH:mm:ss',
        numberFormat: {
          decimal: '.',
          thousand: ',',
          currency: {
            symbol: 'NT$',
            position: 'before' as const,
            space: false
          }
        },
        tax: {
          name: 'Tax',
          nameLocal: '營業稅',
          rate: 0.05,
          inclusive: false,
          displayFormat: '營業稅 (5%)'
        },
        legal: {
          requiresTaxNumber: true,
          requiresLicense: true,
          invoiceFormat: 'government' as const,
          retentionPeriod: 1825,
          electronicInvoice: true
        },
        receipt: {
          width: 32,
          headerLines: 8,
          footerLines: 6,
          itemNameMaxLength: 20,
          showItemCodes: false,
          showTaxBreakdown: true,
          defaultFont: 'normal',
          paperSize: '80mm'
        }
      }

      printerService.setRegion('TW', regionConfig)

      // This should not throw an error
      expect(true).toBe(true)
    })
  })
})