/**
 * Orders Store Tests
 * 測試訂單 store 的狀態管理和數據操作
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useOrdersStore } from '../orders'
import type { KitchenOrder } from '@/types'

// Mock kitchen API - inline definition to avoid hoisting issues
vi.mock('@/services/kitchenApi', () => ({
  kitchenApi: {
    getOrders: vi.fn(),
    updateOrderStatus: vi.fn(),
    updateItemStatus: vi.fn()
  }
}))

function createMockOrder(id: string, status: number, priority = 'normal'): KitchenOrder {
  return {
    id,
    orderNumber: `ORD-${id}`,
    tableName: 'T1',
    status,
    priority,
    createdAt: new Date().toISOString(),
    elapsedTime: 0,
    estimatedTime: 15,
    items: []
  }
}

describe('Orders Store', () => {
  let mockKitchenApi: any

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Get mocked kitchenApi
    const { kitchenApi } = await import('@/services/kitchenApi')
    mockKitchenApi = kitchenApi
  })

  describe('Initial State', () => {
    it('should initialize with empty orders', () => {
      const store = useOrdersStore()

      expect(store.orders).toEqual([])
      expect(store.totalOrders).toBe(0)
    })

    it('should initialize with default stats', () => {
      const store = useOrdersStore()

      expect(store.stats).toMatchObject({
        pendingCount: 0,
        preparingCount: 0,
        readyCount: 0,
        completedToday: 0
      })
    })

    it('should not be loading initially', () => {
      const store = useOrdersStore()

      expect(store.loading).toBe(false)
    })

    it('should have no error initially', () => {
      const store = useOrdersStore()

      expect(store.error).toBeNull()
    })
  })

  describe('Fetch Orders', () => {
    it('should fetch and load orders successfully', async () => {
      const mockOrders = [
        createMockOrder('1', 1),
        createMockOrder('2', 2)
      ]

      mockKitchenApi.getOrders.mockResolvedValue({
        success: true,
        data: {
          pending: [mockOrders[0]],
          preparing: [mockOrders[1]],
          ready: [],
          stats: {
            pendingCount: 1,
            preparingCount: 1,
            readyCount: 0,
            completedToday: 10,
            averageCookingTime: 15,
            averageWaitingTime: 5,
            efficiency: 90,
            urgentOrders: 0
          }
        }
      })

      const store = useOrdersStore()
      await store.fetchOrders(1)

      expect(store.orders).toHaveLength(2)
      expect(store.stats.completedToday).toBe(10)
      expect(store.loading).toBe(false)
    })

    it('should set loading state during fetch', async () => {
      mockKitchenApi.getOrders.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 100))
      )

      const store = useOrdersStore()
      const fetchPromise = store.fetchOrders(1)

      expect(store.loading).toBe(true)

      await fetchPromise
    })

    it('should handle fetch errors', async () => {
      mockKitchenApi.getOrders.mockRejectedValue(new Error('Network error'))

      const store = useOrdersStore()
      await store.fetchOrders(1)

      expect(store.error).toBe('Network error')
      expect(store.orders).toEqual([])
    })
  })

  describe('Computed Orders', () => {
    it('should filter pending orders', () => {
      const store = useOrdersStore()
      store.orders = [
        createMockOrder('1', 1), // pending
        createMockOrder('2', 2), // preparing
        createMockOrder('3', 1)  // pending
      ]

      expect(store.pendingOrders).toHaveLength(2)
    })

    it('should filter preparing orders', () => {
      const store = useOrdersStore()
      store.orders = [
        createMockOrder('1', 1),
        createMockOrder('2', 2), // preparing
        createMockOrder('3', 2)  // preparing
      ]

      expect(store.preparingOrders).toHaveLength(2)
    })

    it('should filter ready orders', () => {
      const store = useOrdersStore()
      store.orders = [
        createMockOrder('1', 3), // ready
        createMockOrder('2', 2),
        createMockOrder('3', 3)  // ready
      ]

      expect(store.readyOrders).toHaveLength(2)
    })

    it('should filter urgent orders', () => {
      const store = useOrdersStore()
      store.orders = [
        createMockOrder('1', 1, 'urgent'),
        createMockOrder('2', 1, 'normal'),
        createMockOrder('3', 2, 'urgent')
      ]

      expect(store.urgentOrders).toHaveLength(2)
    })

    it('should count total orders', () => {
      const store = useOrdersStore()
      store.orders = [
        createMockOrder('1', 1),
        createMockOrder('2', 2),
        createMockOrder('3', 3)
      ]

      expect(store.totalOrders).toBe(3)
    })
  })

  describe('Order Updates', () => {
    it('should update order status', async () => {
      mockKitchenApi.updateOrderStatus.mockResolvedValue({ success: true })

      const store = useOrdersStore()
      store.orders = [createMockOrder('1', 1)]

      await store.updateOrderStatus('1', 2)

      expect(mockKitchenApi.updateOrderStatus).toHaveBeenCalledWith('1', 2)
    })

    it('should update item status', async () => {
      mockKitchenApi.updateItemStatus.mockResolvedValue({ success: true })

      const store = useOrdersStore()
      await store.updateItemStatus('item-1', 'preparing')

      expect(mockKitchenApi.updateItemStatus).toHaveBeenCalledWith('item-1', 'preparing')
    })
  })

  describe('SSE Event Handling', () => {
    it('should handle NEW_ORDER event', () => {
      const store = useOrdersStore()
      const newOrder = createMockOrder('new-1', 1)

      store.handleSSEEvent({
        type: 'NEW_ORDER',
        payload: newOrder
      })

      expect(store.orders).toContainEqual(newOrder)
    })

    it('should handle ORDER_STATUS_UPDATE event', () => {
      const store = useOrdersStore()
      store.orders = [createMockOrder('1', 1)]

      store.handleSSEEvent({
        type: 'ORDER_STATUS_UPDATE',
        payload: { orderId: '1', status: 2 }
      })

      const order = store.orders.find(o => o.id === '1')
      expect(order?.status).toBe(2)
    })

    it('should handle ORDER_CANCELLED event', () => {
      const store = useOrdersStore()
      store.orders = [
        createMockOrder('1', 1),
        createMockOrder('2', 2)
      ]

      store.handleSSEEvent({
        type: 'ORDER_CANCELLED',
        payload: { orderId: '1' }
      })

      expect(store.orders).toHaveLength(1)
      expect(store.orders[0].id).toBe('2')
    })
  })

  describe('Clear and Reset', () => {
    it('should clear all orders', () => {
      const store = useOrdersStore()
      store.orders = [
        createMockOrder('1', 1),
        createMockOrder('2', 2)
      ]

      store.clearOrders()

      expect(store.orders).toEqual([])
    })

    it('should reset error state', () => {
      const store = useOrdersStore()
      store.error = 'Some error'

      store.clearError()

      expect(store.error).toBeNull()
    })
  })
})
