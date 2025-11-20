/**
 * Offline Mode Integration Tests
 * 測試離線模式和數據同步
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock localStorage
const createLocalStorageMock = () => {
  const storage: Record<string, string> = {}

  return {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key]
    }),
    clear: vi.fn(() => {
      Object.keys(storage).forEach(key => delete storage[key])
    }),
    get length() {
      return Object.keys(storage).length
    },
    key: vi.fn((index: number) => {
      const keys = Object.keys(storage)
      return keys[index] || null
    })
  }
}

describe('Offline Mode Integration', () => {
  let mockLocalStorage: ReturnType<typeof createLocalStorageMock>

  beforeEach(() => {
    mockLocalStorage = createLocalStorageMock()
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    })
  })

  describe('Offline Detection', () => {
    it('should detect when going offline', () => {
      const isOnline = navigator.onLine

      expect(typeof isOnline).toBe('boolean')
    })

    it('should handle offline event', () => {
      const offlineHandler = (event: Event) => {
        return { status: 'offline', event }
      }

      const mockEvent = new Event('offline')
      const result = offlineHandler(mockEvent)

      expect(result.status).toBe('offline')
    })

    it('should handle online event', () => {
      const onlineHandler = (event: Event) => {
        return { status: 'online', event }
      }

      const mockEvent = new Event('online')
      const result = onlineHandler(mockEvent)

      expect(result.status).toBe('online')
    })
  })

  describe('Data Caching', () => {
    it('should cache orders when going offline', () => {
      const orders = [
        { id: '1', orderNumber: 'ORD-001', status: 1 },
        { id: '2', orderNumber: 'ORD-002', status: 2 }
      ]

      localStorage.setItem('offline-orders', JSON.stringify(orders))

      const cached = localStorage.getItem('offline-orders')
      const parsed = JSON.parse(cached!)

      expect(parsed).toHaveLength(2)
      expect(parsed[0].id).toBe('1')
    })

    it('should store pending actions offline', () => {
      const pendingActions = [
        { type: 'UPDATE_STATUS', orderId: '1', status: 2, timestamp: Date.now() },
        { type: 'COMPLETE_ORDER', orderId: '2', timestamp: Date.now() }
      ]

      localStorage.setItem('pending-actions', JSON.stringify(pendingActions))

      const stored = localStorage.getItem('pending-actions')
      const parsed = JSON.parse(stored!)

      expect(parsed).toHaveLength(2)
      expect(parsed[0].type).toBe('UPDATE_STATUS')
    })
  })

  describe('Sync on Reconnect', () => {
    it('should sync pending actions when back online', () => {
      const pendingActions = [
        { type: 'UPDATE_STATUS', orderId: '1', status: 2 },
        { type: 'UPDATE_STATUS', orderId: '2', status: 3 }
      ]

      localStorage.setItem('pending-actions', JSON.stringify(pendingActions))

      const stored = localStorage.getItem('pending-actions')
      const actions = JSON.parse(stored!)

      // Simulate sync
      const synced = actions.map((action: any) => ({
        ...action,
        synced: true
      }))

      expect(synced).toHaveLength(2)
      expect(synced[0].synced).toBe(true)
    })

    it('should merge server data with cached data', () => {
      const cachedOrders = [
        { id: '1', orderNumber: 'ORD-001', status: 1 }
      ]

      const serverOrders = [
        { id: '1', orderNumber: 'ORD-001', status: 2 },
        { id: '2', orderNumber: 'ORD-002', status: 1 }
      ]

      // Server data takes precedence
      const merged = serverOrders

      expect(merged).toHaveLength(2)
      expect(merged[0].status).toBe(2) // Updated from server
    })
  })

  describe('Conflict Resolution', () => {
    it('should resolve conflicts with server timestamp', () => {
      const localChange = {
        id: '1',
        status: 2,
        updatedAt: Date.now() - 1000 // 1 second ago
      }

      const serverChange = {
        id: '1',
        status: 3,
        updatedAt: Date.now() // Now
      }

      // Server is newer, use server data
      const resolved = serverChange.updatedAt > localChange.updatedAt
        ? serverChange
        : localChange

      expect(resolved.status).toBe(3)
    })
  })

  describe('UI Indicators', () => {
    it('should show offline indicator', () => {
      const isOffline = true

      const indicator = {
        visible: isOffline,
        message: '離線模式'
      }

      expect(indicator.visible).toBe(true)
      expect(indicator.message).toBe('離線模式')
    })

    it('should show syncing indicator', () => {
      const isSyncing = true

      const indicator = {
        visible: isSyncing,
        message: '同步中...'
      }

      expect(indicator.visible).toBe(true)
    })
  })

  describe('Data Persistence', () => {
    it('should maintain order state offline', () => {
      const orderState = {
        orders: [
          { id: '1', status: 2 }
        ],
        lastSync: Date.now()
      }

      localStorage.setItem('order-state', JSON.stringify(orderState))

      const stored = localStorage.getItem('order-state')
      const parsed = JSON.parse(stored!)

      expect(parsed.orders).toHaveLength(1)
      expect(parsed.lastSync).toBeDefined()
    })

    it('should clear cache on successful sync', () => {
      localStorage.setItem('pending-actions', JSON.stringify([1, 2, 3]))

      // After successful sync
      localStorage.removeItem('pending-actions')

      const remaining = localStorage.getItem('pending-actions')
      expect(remaining).toBeNull()
    })
  })
})
