/**
 * Orders Bulk Operations Tests
 * 測試訂單批量操作功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Env } from '../../../shared/types'
import { OrdersService } from '../services/OrdersService'
// OrderStatus imported for type reference if needed
import type { BulkOrderOperation } from '../types'

// Mock services
const mockOrderServiceInstance = {
  createOrder: vi.fn(),
  getOrder: vi.fn(),
  getOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
  cancelOrder: vi.fn(),
  getDailyOrderStats: vi.fn()
}

const mockCouponServiceInstance = {
  validateCoupon: vi.fn()
}

const mockRealtimeBroadcastServiceInstance = {
  broadcastNewOrder: vi.fn().mockResolvedValue({ success: true, eventId: 'evt_test', recipientCount: 1 }),
  broadcastOrderStatusUpdate: vi.fn().mockResolvedValue({ success: true, eventId: 'evt_test', recipientCount: 1 }),
  generateEventId: vi.fn(() => 'evt_test_123')
}

const mockCacheKV = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(true)
}

const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

const mockEnv: Env = {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-jwt-secret-key-for-testing-only',
  API_VERSION: 'v1',
  ENCRYPTION_KEY: 'test-encryption-key-for-testing-only-32chars',
  DB: {} as any,
  CACHE_KV: mockCacheKV as any,
  TOKEN_BLACKLIST: {} as any,
  IMAGES_BUCKET: {} as any,
  BACKUP_STORAGE: {} as any,
  JOB_QUEUE: {} as any,
  REALTIME_ORDERS: {} as any,
  ANALYTICS_ENGINE: { writeDataPoint: vi.fn() } as any,
  RATE_LIMIT_KV: {} as any,
  REALTIME_SESSION: {} as any,
  API_BASE_URL: 'http://localhost:8787',
  INTERNAL_API_TOKEN: 'test-token',
  SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test',
  CLOUDFLARE_IMAGES_KEY: 'test-key'
}

const createMockOrder = (id: number, status: string = 'pending') => ({
  id,
  restaurantId: 1,
  orderNumber: `ORD-${String(id).padStart(3, '0')}`,
  status,
  totalAmount: 1000,
  subtotal: 900,
  taxAmount: 100,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  items: []
})

describe('Orders Bulk Operations', () => {
  let ordersService: OrdersService

  beforeEach(() => {
    vi.clearAllMocks()
    ordersService = new OrdersService(mockEnv)
    
    // Replace internal services with mocks
    ordersService['baseOrderService'] = mockOrderServiceInstance as any
    ordersService['couponService'] = mockCouponServiceInstance as any
    ordersService['realtimeBroadcastService'] = mockRealtimeBroadcastServiceInstance as any
    ordersService['cacheKV'] = mockCacheKV
    ordersService['logger'] = mockLogger as any
  })

  describe('bulkUpdateOrders - Status Updates', () => {
    it('should update multiple orders status successfully', async () => {
      const orderIds = [1, 2, 3]
      
      // Mock successful updates
      mockCacheKV.get.mockResolvedValue(createMockOrder(1, 'pending'))
      mockOrderServiceInstance.updateOrderStatus.mockImplementation((id) => 
        Promise.resolve({ ...createMockOrder(id), status: 'confirmed' })
      )

      const operation: BulkOrderOperation = {
        orderIds,
        action: 'update_status',
        data: { status: 'confirmed' }
      }

      const result = await ordersService.bulkUpdateOrders(operation, 1)

      expect(result.totalOrders).toBe(3)
      expect(result.successCount).toBe(3)
      expect(result.failedCount).toBe(0)
      expect(result.errors).toHaveLength(0)
      expect(result.batchId).toBeDefined()
    })

    it('should handle partial failures gracefully', async () => {
      const orderIds = [1, 2, 3]
      
      // Mock: first succeeds, second fails, third succeeds
      mockCacheKV.get
        .mockResolvedValueOnce(createMockOrder(1, 'pending'))
        .mockResolvedValueOnce(createMockOrder(2, 'pending'))
        .mockResolvedValueOnce(createMockOrder(3, 'pending'))
      
      mockOrderServiceInstance.updateOrderStatus
        .mockResolvedValueOnce({ ...createMockOrder(1), status: 'confirmed' })
        .mockRejectedValueOnce(new Error('Order 2 update failed'))
        .mockResolvedValueOnce({ ...createMockOrder(3), status: 'confirmed' })

      const operation: BulkOrderOperation = {
        orderIds,
        action: 'update_status',
        data: { status: 'confirmed' }
      }

      const result = await ordersService.bulkUpdateOrders(operation, 1)

      expect(result.totalOrders).toBe(3)
      expect(result.successCount).toBe(2)
      expect(result.failedCount).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].orderId).toBe(2)
      expect(result.errors[0].error).toContain('Order 2 update failed')
    })

    it('should return detailed results for each order', async () => {
      const orderIds = [1, 2]
      
      mockCacheKV.get.mockResolvedValue(createMockOrder(1, 'pending'))
      mockOrderServiceInstance.updateOrderStatus.mockImplementation((id) => 
        Promise.resolve({ ...createMockOrder(id), status: 'confirmed' })
      )

      const operation: BulkOrderOperation = {
        orderIds,
        action: 'update_status',
        data: { status: 'confirmed' }
      }

      const result = await ordersService.bulkUpdateOrders(operation, 1)

      expect(result.results).toHaveLength(2)
      result.results.forEach((r, index) => {
        expect(r.orderId).toBe(orderIds[index])
        expect(r.success).toBe(true)
        expect(r.data).toBeDefined()
      })
    })

    it('should include notes in status update', async () => {
      mockCacheKV.get.mockResolvedValue(createMockOrder(1, 'pending'))
      mockOrderServiceInstance.updateOrderStatus.mockResolvedValue({ 
        ...createMockOrder(1), 
        status: 'confirmed' 
      })

      const operation: BulkOrderOperation = {
        orderIds: [1],
        action: 'update_status',
        data: { 
          status: 'confirmed',
          notes: 'Bulk confirmed by manager'
        }
      }

      const result = await ordersService.bulkUpdateOrders(operation, 1)

      expect(result.successCount).toBe(1)
    })
  })

  describe('bulkUpdateOrders - Cancel', () => {
    it('should cancel multiple orders successfully', async () => {
      const orderIds = [1, 2, 3]
      
      mockOrderServiceInstance.cancelOrder.mockImplementation((id) => 
        Promise.resolve({ ...createMockOrder(id), status: 'cancelled' })
      )

      const operation: BulkOrderOperation = {
        orderIds,
        action: 'cancel',
        data: { reason: 'Restaurant closing early' }
      }

      const result = await ordersService.bulkUpdateOrders(operation, 1)

      expect(result.totalOrders).toBe(3)
      expect(result.successCount).toBe(3)
      expect(mockOrderServiceInstance.cancelOrder).toHaveBeenCalledTimes(3)
    })

    it('should use default reason when not provided', async () => {
      mockOrderServiceInstance.cancelOrder.mockResolvedValue({ 
        ...createMockOrder(1), 
        status: 'cancelled' 
      })

      const operation: BulkOrderOperation = {
        orderIds: [1],
        action: 'cancel'
      }

      const result = await ordersService.bulkUpdateOrders(operation, 1)

      expect(result.successCount).toBe(1)
      expect(mockOrderServiceInstance.cancelOrder).toHaveBeenCalledWith(1, 'Bulk cancellation')
    })

    it('should handle cancel failures', async () => {
      mockOrderServiceInstance.cancelOrder
        .mockResolvedValueOnce({ ...createMockOrder(1), status: 'cancelled' })
        .mockRejectedValueOnce(new Error('Cannot cancel completed order'))

      const operation: BulkOrderOperation = {
        orderIds: [1, 2],
        action: 'cancel',
        data: { reason: 'Test cancellation' }
      }

      const result = await ordersService.bulkUpdateOrders(operation, 1)

      expect(result.successCount).toBe(1)
      expect(result.failedCount).toBe(1)
      expect(result.errors[0].error).toContain('Cannot cancel completed order')
    })
  })

  describe('bulkUpdateOrders - Batch ID', () => {
    it('should generate batch ID when not provided', async () => {
      mockCacheKV.get.mockResolvedValue(createMockOrder(1, 'pending'))
      mockOrderServiceInstance.updateOrderStatus.mockResolvedValue({ 
        ...createMockOrder(1), 
        status: 'confirmed' 
      })

      const operation: BulkOrderOperation = {
        orderIds: [1],
        action: 'update_status',
        data: { status: 'confirmed' }
      }

      const result = await ordersService.bulkUpdateOrders(operation, 1)

      expect(result.batchId).toMatch(/^batch_\d+_[a-z0-9]+$/)
    })

    it('should use provided batch ID', async () => {
      mockCacheKV.get.mockResolvedValue(createMockOrder(1, 'pending'))
      mockOrderServiceInstance.updateOrderStatus.mockResolvedValue({ 
        ...createMockOrder(1), 
        status: 'confirmed' 
      })

      const operation: BulkOrderOperation = {
        orderIds: [1],
        action: 'update_status',
        data: { status: 'confirmed' },
        batchId: 'custom-batch-123'
      }

      const result = await ordersService.bulkUpdateOrders(operation, 1)

      expect(result.batchId).toBe('custom-batch-123')
    })
  })

  describe('bulkUpdateOrders - Edge Cases', () => {
    it('should handle empty order IDs array', async () => {
      const operation: BulkOrderOperation = {
        orderIds: [],
        action: 'update_status',
        data: { status: 'confirmed' }
      }

      const result = await ordersService.bulkUpdateOrders(operation, 1)

      expect(result.totalOrders).toBe(0)
      expect(result.successCount).toBe(0)
      expect(result.failedCount).toBe(0)
    })

    it('should handle unsupported action', async () => {
      const operation: BulkOrderOperation = {
        orderIds: [1],
        action: 'unsupported_action' as any,
        data: {}
      }

      const result = await ordersService.bulkUpdateOrders(operation, 1)

      expect(result.failedCount).toBe(1)
      expect(result.errors[0].error).toContain('Unsupported bulk operation')
    })

    it('should handle large batch of orders', async () => {
      const orderIds = Array.from({ length: 100 }, (_, i) => i + 1)
      
      mockCacheKV.get.mockResolvedValue(createMockOrder(1, 'pending'))
      mockOrderServiceInstance.updateOrderStatus.mockImplementation((id) => 
        Promise.resolve({ ...createMockOrder(id), status: 'confirmed' })
      )

      const operation: BulkOrderOperation = {
        orderIds,
        action: 'update_status',
        data: { status: 'confirmed' }
      }

      const result = await ordersService.bulkUpdateOrders(operation, 1)

      expect(result.totalOrders).toBe(100)
      expect(result.successCount).toBe(100)
    })

    it('should handle all orders failing', async () => {
      const orderIds = [1, 2, 3]
      
      mockCacheKV.get.mockResolvedValue(createMockOrder(1, 'pending'))
      mockOrderServiceInstance.updateOrderStatus.mockRejectedValue(new Error('Database unavailable'))

      const operation: BulkOrderOperation = {
        orderIds,
        action: 'update_status',
        data: { status: 'confirmed' }
      }

      const result = await ordersService.bulkUpdateOrders(operation, 1)

      expect(result.totalOrders).toBe(3)
      expect(result.successCount).toBe(0)
      expect(result.failedCount).toBe(3)
      expect(result.errors).toHaveLength(3)
    })
  })

  describe('bulkUpdateOrders - Logging', () => {
    it('should log bulk operation completion', async () => {
      mockCacheKV.get.mockResolvedValue(createMockOrder(1, 'pending'))
      mockOrderServiceInstance.updateOrderStatus.mockResolvedValue({ 
        ...createMockOrder(1), 
        status: 'confirmed' 
      })

      const operation: BulkOrderOperation = {
        orderIds: [1],
        action: 'update_status',
        data: { status: 'confirmed' }
      }

      await ordersService.bulkUpdateOrders(operation, 1)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Bulk operation completed',
        expect.objectContaining({
          batchId: expect.any(String),
          result: expect.any(Object)
        })
      )
    })
  })
})
