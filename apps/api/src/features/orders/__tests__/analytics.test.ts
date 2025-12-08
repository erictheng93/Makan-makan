/**
 * Orders Analytics Tests
 * Test order analytics, statistics and reporting functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Env } from '../../../shared/types'
import { OrdersService } from '../services/OrdersService'
import { OrderStatus } from '@makanmakan/shared-types'

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

describe('Orders Analytics', () => {
  let ordersService: OrdersService

  beforeEach(() => {
    vi.clearAllMocks()
    ordersService = new OrdersService(mockEnv)
    
    ordersService['baseOrderService'] = mockOrderServiceInstance as any
    ordersService['couponService'] = mockCouponServiceInstance as any
    ordersService['realtimeBroadcastService'] = mockRealtimeBroadcastServiceInstance as any
    ordersService['cacheKV'] = mockCacheKV
    ordersService['logger'] = mockLogger as any
  })

  describe('getOrderAnalytics', () => {
    it('should return analytics from cache if available', async () => {
      const cachedAnalytics = {
        summary: {
          totalOrders: 100,
          totalRevenue: 50000,
          averageOrderValue: 500,
          averagePreparationTime: 15,
          orderCompletionRate: 0.95,
          customerRetentionRate: 0.75
        },
        byStatus: [],
        byPaymentStatus: [],
        byOrderType: [],
        byTime: { hourly: [], daily: [], weekly: [], monthly: [] },
        topItems: [],
        customerAnalytics: {
          newCustomers: 20,
          returningCustomers: 80,
          averageOrdersPerCustomer: 2.5,
          customerLifetimeValue: 1250
        },
        performanceMetrics: {
          averageOrderProcessingTime: 12,
          peakHours: [12, 13, 18, 19],
          busyDays: ['Saturday', 'Sunday'],
          orderAccuracy: 0.98,
          cancellationRate: 0.05
        }
      }

      mockCacheKV.get.mockResolvedValueOnce(cachedAnalytics)

      const result = await ordersService.getOrderAnalytics({ restaurantId: 1 })

      expect(mockCacheKV.get).toHaveBeenCalled()
      expect(result).toEqual(cachedAnalytics)
    })

    it('should fetch and build analytics when cache miss', async () => {
      mockCacheKV.get.mockResolvedValueOnce(null)
      mockOrderServiceInstance.getDailyOrderStats.mockResolvedValue({
        totalOrders: 50,
        totalRevenue: 25000,
        avgOrderValue: 500,
        pendingOrders: 5,
        confirmedOrders: 10,
        completedOrders: 30,
        cancelledOrders: 5
      })

      const result = await ordersService.getOrderAnalytics({ restaurantId: 1 })

      expect(result.summary.totalOrders).toBe(50)
      expect(result.summary.totalRevenue).toBe(25000)
      expect(result.summary.averageOrderValue).toBe(500)
      expect(mockCacheKV.set).toHaveBeenCalled()
    })

    it('should throw error when restaurantId is missing', async () => {
      await expect(ordersService.getOrderAnalytics({}))
        .rejects.toThrow('Restaurant ID required for analytics')
    })

    it('should include performance metrics in analytics', async () => {
      mockCacheKV.get.mockResolvedValueOnce(null)
      mockOrderServiceInstance.getDailyOrderStats.mockResolvedValue({
        totalOrders: 100,
        totalRevenue: 50000,
        avgOrderValue: 500
      })

      const result = await ordersService.getOrderAnalytics({ restaurantId: 1 })

      expect(result.performanceMetrics).toBeDefined()
      expect(result.performanceMetrics.orderAccuracy).toBeDefined()
      expect(result.performanceMetrics.cancellationRate).toBeDefined()
    })
  })

  describe('getDailyStats', () => {
    it('should return daily statistics for restaurant', async () => {
      mockOrderServiceInstance.getDailyOrderStats.mockResolvedValue({
        totalOrders: 25,
        totalRevenue: 12500,
        avgOrderValue: 500,
        pendingOrders: 3,
        confirmedOrders: 5,
        completedOrders: 15,
        cancelledOrders: 2
      })

      const result = await ordersService.getDailyStats(1)

      expect(result.totalOrders).toBe(25)
      expect(result.totalRevenue).toBe(12500)
      expect(result.averageOrderValue).toBe(500)
    })

    it('should accept specific date parameter', async () => {
      const specificDate = new Date('2024-06-15')
      mockOrderServiceInstance.getDailyOrderStats.mockResolvedValue({
        totalOrders: 30,
        totalRevenue: 15000,
        avgOrderValue: 500
      })

      const result = await ordersService.getDailyStats(1, specificDate)

      // Service converts restaurantId to string for database layer
      expect(mockOrderServiceInstance.getDailyOrderStats).toHaveBeenCalledWith('1', specificDate)
      expect(result.totalOrders).toBe(30)
    })

    it('should handle database errors gracefully', async () => {
      mockOrderServiceInstance.getDailyOrderStats.mockRejectedValue(new Error('Database error'))

      await expect(ordersService.getDailyStats(1))
        .rejects.toThrow('Database error')
    })
  })

  describe('getActiveOrders', () => {
    it('should return only active orders', async () => {
      const activeOrders = [
        { id: 1, status: OrderStatus.CONFIRMED, restaurantId: 1 },
        { id: 2, status: OrderStatus.PREPARING, restaurantId: 1 },
        { id: 3, status: OrderStatus.READY, restaurantId: 1 }
      ]

      mockOrderServiceInstance.getOrders.mockResolvedValue({
        orders: activeOrders,
        pagination: { page: 1, limit: 100, total: 3, totalPages: 1 }
      })

      const result = await ordersService.getActiveOrders(1)

      expect(result).toHaveLength(3)
      expect(mockOrderServiceInstance.getOrders).toHaveBeenCalled()
    })

    it('should not include pending or completed orders', async () => {
      mockOrderServiceInstance.getOrders.mockResolvedValue({
        orders: [],
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 }
      })

      const result = await ordersService.getActiveOrders(1)

      expect(result).toHaveLength(0)
    })
  })

  describe('getPopularItems', () => {
    it('should return popular items from cache', async () => {
      const cachedItems = [
        { menuItemId: 1, name: 'Burger', quantity: 150, revenue: 15000 },
        { menuItemId: 2, name: 'Pizza', quantity: 120, revenue: 18000 }
      ]

      mockCacheKV.get.mockResolvedValueOnce(cachedItems)

      const result = await ordersService.getPopularItems(1)

      expect(result).toEqual(cachedItems)
    })

    it('should return empty array when no data', async () => {
      mockCacheKV.get.mockResolvedValueOnce(null)

      const result = await ordersService.getPopularItems(1)

      expect(result).toEqual([])
      expect(mockCacheKV.set).toHaveBeenCalled()
    })

    it('should accept time range parameter', async () => {
      mockCacheKV.get.mockResolvedValueOnce(null)

      await ordersService.getPopularItems(1, 'week')

      expect(mockCacheKV.get).toHaveBeenCalledWith(
        expect.stringContaining('week'),
        'json'
      )
    })
  })

  describe('getOrderStatistics', () => {
    it('should return order statistics', async () => {
      mockOrderServiceInstance.getDailyOrderStats.mockResolvedValue({
        totalOrders: 50,
        totalRevenue: 25000,
        avgOrderValue: 500,
        pendingOrders: 5,
        confirmedOrders: 10,
        completedOrders: 30,
        cancelledOrders: 5
      })

      const result = await ordersService.getOrderStatistics(1)

      expect(result.totalOrders).toBe(50)
      expect(result.totalRevenue).toBe(25000)
    })
  })
})
