/**
 * Realtime Updates Integration Tests
 * 測試實時更新功能的整合
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useOrdersStore } from '@/stores/orders'
import { useAudioNotifications } from '@/composables/useAudioNotifications'
import type { KitchenSSEEvent, KitchenOrder } from '@/types'

// Mock services - inline definitions to avoid hoisting issues
vi.mock('@/services/kitchenApi', () => ({
  kitchenApi: {
    getOrders: vi.fn(),
    updateOrderStatus: vi.fn().mockResolvedValue({ success: true })
  }
}))

vi.mock('@/services/audioService', () => ({
  audioService: {
    playNewOrder: vi.fn().mockResolvedValue(undefined),
    playOrderReady: vi.fn().mockResolvedValue(undefined),
    playWarning: vi.fn().mockResolvedValue(undefined)
  }
}))

describe('Realtime Updates Integration', () => {
  let mockKitchenApi: any
  let mockAudioService: any

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Get mocked services
    const kitchenApiModule = await import('@/services/kitchenApi')
    const audioServiceModule = await import('@/services/audioService')
    mockKitchenApi = kitchenApiModule.kitchenApi
    mockAudioService = audioServiceModule.audioService
  })

  describe('Order Updates via SSE', () => {
    it('should add new order and play notification', async () => {
      const ordersStore = useOrdersStore()
      const { handleSSEEvent } = useAudioNotifications()

      const newOrder: KitchenOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        tableName: 'T1',
        status: 1,
        priority: 'normal',
        createdAt: new Date().toISOString(),
        elapsedTime: 0,
        estimatedTime: 15,
        items: []
      }

      const event: KitchenSSEEvent = {
        type: 'NEW_ORDER',
        payload: newOrder
      }

      // Handle in store
      ordersStore.handleSSEEvent(event)

      // Handle in audio
      await handleSSEEvent(event)

      expect(ordersStore.orders).toContainEqual(newOrder)
      expect(mockAudioService.playNewOrder).toHaveBeenCalledWith(false)
    })

    it('should handle urgent order with special notification', async () => {
      const ordersStore = useOrdersStore()
      const { handleSSEEvent } = useAudioNotifications()

      const urgentOrder: KitchenOrder = {
        id: 'ord-urgent',
        orderNumber: 'ORD-URGENT',
        tableName: 'T5',
        status: 1,
        priority: 'urgent',
        createdAt: new Date().toISOString(),
        elapsedTime: 0,
        estimatedTime: 10,
        items: []
      }

      const event: KitchenSSEEvent = {
        type: 'NEW_ORDER',
        payload: urgentOrder
      }

      ordersStore.handleSSEEvent(event)
      await handleSSEEvent(event)

      expect(ordersStore.urgentOrders).toHaveLength(1)
      expect(mockAudioService.playNewOrder).toHaveBeenCalledWith(true)
    })

    it('should update order status and play notification', async () => {
      const ordersStore = useOrdersStore()
      const { handleSSEEvent } = useAudioNotifications()

      ordersStore.orders = [{
        id: 'ord-1',
        orderNumber: 'ORD-001',
        tableName: 'T1',
        status: 2, // preparing
        priority: 'normal',
        createdAt: new Date().toISOString(),
        elapsedTime: 10,
        estimatedTime: 15,
        items: []
      }]

      const event: KitchenSSEEvent = {
        type: 'ORDER_STATUS_UPDATE',
        payload: { orderId: 'ord-1', status: 'ready' }
      }

      ordersStore.handleSSEEvent({
        type: 'ORDER_STATUS_UPDATE',
        payload: { orderId: 'ord-1', status: 3 }
      })

      await handleSSEEvent(event)

      const order = ordersStore.orders.find(o => o.id === 'ord-1')
      expect(order?.status).toBe(3)
      expect(mockAudioService.playOrderReady).toHaveBeenCalled()
    })

    it('should handle order cancellation with warning sound', async () => {
      const ordersStore = useOrdersStore()
      const { handleSSEEvent } = useAudioNotifications()

      ordersStore.orders = [{
        id: 'ord-1',
        orderNumber: 'ORD-001',
        tableName: 'T1',
        status: 1,
        priority: 'normal',
        createdAt: new Date().toISOString(),
        elapsedTime: 0,
        estimatedTime: 15,
        items: []
      }]

      const event: KitchenSSEEvent = {
        type: 'ORDER_CANCELLED',
        payload: { orderId: 'ord-1' }
      }

      ordersStore.handleSSEEvent(event)
      await handleSSEEvent(event)

      expect(ordersStore.orders).toHaveLength(0)
      expect(mockAudioService.playWarning).toHaveBeenCalled()
    })
  })

  describe('Multiple Concurrent Updates', () => {
    it('should handle multiple orders arriving simultaneously', async () => {
      const ordersStore = useOrdersStore()
      const { handleSSEEvent } = useAudioNotifications()

      const orders = Array.from({ length: 5 }, (_, i) => ({
        id: `ord-${i}`,
        orderNumber: `ORD-${i}`,
        tableName: `T${i}`,
        status: 1,
        priority: 'normal',
        createdAt: new Date().toISOString(),
        elapsedTime: 0,
        estimatedTime: 15,
        items: []
      }))

      const events = orders.map(order => ({
        type: 'NEW_ORDER' as const,
        payload: order
      }))

      // Process all events
      for (const event of events) {
        ordersStore.handleSSEEvent(event)
        await handleSSEEvent(event)
      }

      expect(ordersStore.totalOrders).toBe(5)
      expect(mockAudioService.playNewOrder).toHaveBeenCalledTimes(5)
    })

    it('should maintain order consistency during rapid updates', async () => {
      const ordersStore = useOrdersStore()

      const order: KitchenOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        tableName: 'T1',
        status: 1,
        priority: 'normal',
        createdAt: new Date().toISOString(),
        elapsedTime: 0,
        estimatedTime: 15,
        items: []
      }

      ordersStore.orders = [order]

      // Rapid status updates
      const updates = [
        { type: 'ORDER_STATUS_UPDATE', payload: { orderId: 'ord-1', status: 2 } },
        { type: 'ORDER_STATUS_UPDATE', payload: { orderId: 'ord-1', status: 3 } },
        { type: 'ORDER_STATUS_UPDATE', payload: { orderId: 'ord-1', status: 4 } }
      ]

      for (const update of updates) {
        ordersStore.handleSSEEvent(update as KitchenSSEEvent)
      }

      // Final status should reflect last update
      const finalOrder = ordersStore.orders.find(o => o.id === 'ord-1')
      expect(finalOrder?.status).toBe(4)
    })
  })

  describe('Event Synchronization', () => {
    it('should sync store state with UI updates', async () => {
      const ordersStore = useOrdersStore()

      const initialOrder: KitchenOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-001',
        tableName: 'T1',
        status: 1,
        priority: 'normal',
        createdAt: new Date().toISOString(),
        elapsedTime: 0,
        estimatedTime: 15,
        items: []
      }

      ordersStore.orders = [initialOrder]

      expect(ordersStore.pendingOrders).toHaveLength(1)
      expect(ordersStore.preparingOrders).toHaveLength(0)

      // Update status
      ordersStore.handleSSEEvent({
        type: 'ORDER_STATUS_UPDATE',
        payload: { orderId: 'ord-1', status: 2 }
      })

      expect(ordersStore.pendingOrders).toHaveLength(0)
      expect(ordersStore.preparingOrders).toHaveLength(1)
    })

    it('should maintain stats consistency', async () => {
      const ordersStore = useOrdersStore()

      mockKitchenApi.getOrders.mockResolvedValue({
        success: true,
        data: {
          pending: [],
          preparing: [],
          ready: [],
          stats: {
            pendingCount: 5,
            preparingCount: 10,
            readyCount: 3,
            completedToday: 50,
            averageCookingTime: 15,
            averageWaitingTime: 5,
            efficiency: 90,
            urgentOrders: 2
          }
        }
      })

      await ordersStore.fetchOrders(1)

      expect(ordersStore.stats.pendingCount).toBe(5)
      expect(ordersStore.stats.completedToday).toBe(50)
    })
  })

  describe('Error Recovery in Realtime Context', () => {
    it('should handle malformed SSE events gracefully', () => {
      const ordersStore = useOrdersStore()

      const malformedEvent = {
        type: 'UNKNOWN_TYPE',
        payload: null
      }

      // Should not throw
      expect(() => {
        ordersStore.handleSSEEvent(malformedEvent as any)
      }).not.toThrow()
    })

    it('should continue processing after failed event', async () => {
      const ordersStore = useOrdersStore()
      const { handleSSEEvent } = useAudioNotifications()

      const events: KitchenSSEEvent[] = [
        { type: 'NEW_ORDER', payload: { id: 'ord-1', orderNumber: 'ORD-001' } as any },
        { type: 'INVALID_TYPE', payload: null } as any,
        { type: 'NEW_ORDER', payload: { id: 'ord-2', orderNumber: 'ORD-002' } as any }
      ]

      for (const event of events) {
        try {
          ordersStore.handleSSEEvent(event)
          await handleSSEEvent(event)
        } catch (error) {
          // Continue processing
        }
      }

      // Should have processed valid events
      expect(ordersStore.orders.length).toBeGreaterThan(0)
    })
  })

  describe('Performance Under Load', () => {
    it('should handle high-frequency updates efficiently', async () => {
      const ordersStore = useOrdersStore()

      const startTime = Date.now()

      // Simulate 100 rapid updates
      for (let i = 0; i < 100; i++) {
        ordersStore.handleSSEEvent({
          type: 'NEW_ORDER',
          payload: {
            id: `ord-${i}`,
            orderNumber: `ORD-${i}`,
            tableName: `T${i % 10}`,
            status: 1,
            priority: 'normal',
            createdAt: new Date().toISOString(),
            elapsedTime: 0,
            estimatedTime: 15,
            items: []
          }
        })
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(ordersStore.totalOrders).toBe(100)
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })
  })
})
