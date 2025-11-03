/**
 * Orders + Realtime Integration Tests
 * 測試訂單服務與即時廣播的整合
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OrdersService } from '../services/OrdersService'
import { RealtimeBroadcastService } from '../../../services/RealtimeBroadcastService'
import type { Env } from '../../../shared/types'

// Import RealtimeEventType properly for runtime use
const RealtimeEventType = {
  NEW_ORDER: 'new_order',
  ORDER_STATUS_UPDATE: 'order_status_update'
} as const

// Mock dependencies
vi.mock('../../../services/RealtimeBroadcastService')
vi.mock('../../../core/monitoring', () => ({
  ConsoleLogger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })),
  SimplePerformanceTracker: vi.fn().mockImplementation(() => ({
    startTimer: vi.fn(() => 'timer-123'),
    endTimer: vi.fn(() => 100),
    recordMetric: vi.fn()
  }))
}))

vi.mock('@makanmakan/database', () => ({
  BaseOrderService: vi.fn().mockImplementation(() => ({
    createOrder: vi.fn(),
    getOrder: vi.fn(),
    updateOrderStatus: vi.fn(),
    updateOrderItemStatus: vi.fn()
  })),
  OrderStatus: {
    PENDING: 0,
    CONFIRMED: 1,
    PREPARING: 2,
    READY: 3,
    DELIVERED: 4,
    PAID: 5,
    CANCELLED: 6
  }
}))

describe('Orders + Realtime Integration', () => {
  let ordersService: OrdersService
  let mockEnv: Env
  let mockRealtimeBroadcastService: any
  let mockBaseOrderService: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock environment
    mockEnv = {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long',
      API_VERSION: '1.0.0',
      DB: {} as any,
      CACHE_KV: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
      } as any,
      TOKEN_BLACKLIST: {} as any,
      IMAGES_BUCKET: {} as any,
      BACKUP_STORAGE: {} as any,
      JOB_QUEUE: {} as any,
      REALTIME_ORDERS: {} as any,
      ANALYTICS_ENGINE: {} as any,
      RATE_LIMIT_KV: {} as any,
      REALTIME_SESSION: {} as any
    }

    // Create service instance
    ordersService = new OrdersService(mockEnv)

    // Get mocked services
    mockRealtimeBroadcastService = (ordersService as any).realtimeBroadcastService
    mockBaseOrderService = (ordersService as any).baseOrderService
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createOrder - Realtime Integration', () => {
    it('應該在創建訂單後廣播 NEW_ORDER 事件', async () => {
      const orderData = {
        restaurantId: 1,
        tableId: 10,
        customerName: 'John Doe',
        customerPhone: '+1234567890',
        items: [
          {
            menuItemId: 100,
            quantity: 2,
            notes: 'No onions'
          }
        ],
        notes: 'Quick service'
      }

      const createdOrder = {
        id: 1,
        restaurantId: 1,
        tableId: 10,
        orderNumber: '#001',
        customerName: 'John Doe',
        customerPhone: '+1234567890',
        totalAmount: 2000,
        subtotal: 2000,
        status: 0,
        paymentStatus: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          {
            id: 1,
            orderId: 1,
            menuItemId: 100,
            quantity: 2,
            unitPrice: 1000,
            totalPrice: 2000,
            notes: 'No onions',
            status: 0,
            menuItem: {
              id: 100,
              name: 'Burger',
              price: 1000
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      }

      mockBaseOrderService.createOrder.mockResolvedValue(createdOrder)
      mockRealtimeBroadcastService.generateEventId = vi.fn(() => 'evt_test_123')
      mockRealtimeBroadcastService.broadcastNewOrder = vi.fn().mockResolvedValue({
        success: true,
        eventId: 'evt_test_123',
        recipientCount: 3
      })

      const result = await ordersService.createOrder(orderData)

      // Verify order creation
      expect(result).toEqual(createdOrder)

      // Verify broadcast was called
      expect(mockRealtimeBroadcastService.broadcastNewOrder).toHaveBeenCalledTimes(1)

      const broadcastCall = mockRealtimeBroadcastService.broadcastNewOrder.mock.calls[0][0]
      expect(broadcastCall.type).toBe(RealtimeEventType.NEW_ORDER)
      expect(broadcastCall.restaurantId).toBe('1')
      expect(broadcastCall.data.orderId).toBe(1)
      expect(broadcastCall.data.orderNumber).toBe('#001')
      expect(broadcastCall.data.items).toHaveLength(1)
      expect(broadcastCall.data.items[0].menuItemName).toBe('Burger')
      expect(broadcastCall.data.items[0].price).toBe(1000)
      expect(broadcastCall.data.totalAmount).toBe(2000)
    })

    it('應該即使廣播失敗也能成功創建訂單', async () => {
      const orderData = {
        restaurantId: 2,
        tableId: 20,
        items: [
          {
            menuItemId: 200,
            quantity: 1
          }
        ]
      }

      const createdOrder = {
        id: 2,
        restaurantId: 2,
        tableId: 20,
        orderNumber: '#002',
        totalAmount: 500,
        subtotal: 500,
        status: 0,
        paymentStatus: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          {
            id: 2,
            orderId: 2,
            menuItemId: 200,
            quantity: 1,
            unitPrice: 500,
            totalPrice: 500,
            status: 0,
            menuItem: {
              id: 200,
              name: 'Salad',
              price: 500
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      }

      mockBaseOrderService.createOrder.mockResolvedValue(createdOrder)
      mockRealtimeBroadcastService.generateEventId = vi.fn(() => 'evt_test_456')
      mockRealtimeBroadcastService.broadcastNewOrder = vi.fn().mockResolvedValue({
        success: false,
        error: 'Broadcast failed'
      })

      // Should not throw even if broadcast fails
      const result = await ordersService.createOrder(orderData)

      expect(result).toEqual(createdOrder)
      expect(mockRealtimeBroadcastService.broadcastNewOrder).toHaveBeenCalled()
    })
  })

  describe('updateOrderStatus - Realtime Integration', () => {
    it('應該在更新訂單狀態後廣播 ORDER_STATUS_UPDATE 事件', async () => {
      const orderId = 3
      const newStatus = 2 // PREPARING
      const notes = 'Starting to prepare'

      const updatedOrder = {
        id: orderId,
        restaurantId: 3,
        tableId: 30,
        orderNumber: '#003',
        status: newStatus,
        totalAmount: 1500,
        subtotal: 1500,
        paymentStatus: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: []
      }

      mockBaseOrderService.updateOrderStatus.mockResolvedValue(updatedOrder)
      mockBaseOrderService.getOrder.mockResolvedValue(updatedOrder)
      mockRealtimeBroadcastService.generateEventId = vi.fn(() => 'evt_update_789')
      mockRealtimeBroadcastService.broadcastOrderStatusUpdate = vi.fn().mockResolvedValue({
        success: true,
        eventId: 'evt_update_789',
        recipientCount: 5
      })

      const result = await ordersService.updateOrderStatus(orderId, { status: newStatus, notes })

      // Verify update
      expect(result).toEqual(updatedOrder)

      // Verify broadcast
      expect(mockRealtimeBroadcastService.broadcastOrderStatusUpdate).toHaveBeenCalledTimes(1)

      const broadcastCall = mockRealtimeBroadcastService.broadcastOrderStatusUpdate.mock.calls[0][0]
      expect(broadcastCall.type).toBe(RealtimeEventType.ORDER_STATUS_UPDATE)
      expect(broadcastCall.restaurantId).toBe('3')
      expect(broadcastCall.data.orderId).toBe(orderId)
      expect(broadcastCall.data.orderNumber).toBe('#003')
      expect(broadcastCall.data.status).toBe('preparing')
    })
  })

  describe('broadcastOrderUpdate', () => {
    it('應該正確處理訂單更新事件', async () => {
      const order = {
        id: 4,
        restaurantId: 4,
        tableId: 40,
        orderNumber: '#004',
        status: 1,
        totalAmount: 3000,
        subtotal: 3000,
        paymentStatus: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      mockBaseOrderService.getOrder.mockResolvedValue(order)
      mockRealtimeBroadcastService.generateEventId = vi.fn(() => 'evt_broadcast_101')
      mockRealtimeBroadcastService.broadcastOrderStatusUpdate = vi.fn().mockResolvedValue({
        success: true,
        eventId: 'evt_broadcast_101',
        recipientCount: 2
      })

      await ordersService.broadcastOrderUpdate({
        orderId: 4,
        newStatus: 1,
        previousStatus: 0,
        notes: 'Order confirmed',
        updatedBy: 1,
        updatedAt: new Date()
      })

      expect(mockRealtimeBroadcastService.broadcastOrderStatusUpdate).toHaveBeenCalled()
    })

    it('應該在訂單不存在時不廣播', async () => {
      mockBaseOrderService.getOrder.mockResolvedValue(null)

      await ordersService.broadcastOrderUpdate({
        orderId: 999,
        newStatus: 1,
        previousStatus: 0,
        updatedBy: 1,
        updatedAt: new Date()
      })

      expect(mockRealtimeBroadcastService.broadcastOrderStatusUpdate).not.toHaveBeenCalled()
    })
  })

  describe('Event Data Mapping', () => {
    it('應該正確映射訂單項目到事件資料', async () => {
      const orderData = {
        restaurantId: 5,
        tableId: 50,
        items: [
          {
            menuItemId: 300,
            quantity: 3,
            customizations: {
              specialInstructions: 'Extra spicy'
            },
            notes: 'Chef special'
          }
        ]
      }

      const createdOrder = {
        id: 5,
        restaurantId: 5,
        tableId: 50,
        orderNumber: '#005',
        totalAmount: 4500,
        subtotal: 4500,
        status: 0,
        paymentStatus: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          {
            id: 5,
            orderId: 5,
            menuItemId: 300,
            quantity: 3,
            unitPrice: 1500,
            totalPrice: 4500,
            notes: 'Chef special',
            status: 0,
            customizations: {
              specialInstructions: 'Extra spicy'
            },
            menuItem: {
              id: 300,
              name: 'Spicy Noodles',
              price: 1500
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      }

      mockBaseOrderService.createOrder.mockResolvedValue(createdOrder)
      mockRealtimeBroadcastService.generateEventId = vi.fn(() => 'evt_mapping_202')
      mockRealtimeBroadcastService.broadcastNewOrder = vi.fn().mockResolvedValue({
        success: true,
        eventId: 'evt_mapping_202',
        recipientCount: 1
      })

      await ordersService.createOrder(orderData)

      const broadcastCall = mockRealtimeBroadcastService.broadcastNewOrder.mock.calls[0][0]

      expect(broadcastCall.data.items[0]).toMatchObject({
        orderItemId: 5,
        menuItemId: 300,
        menuItemName: 'Spicy Noodles',
        quantity: 3,
        price: 1500,
        notes: 'Chef special'
      })
    })
  })
})
