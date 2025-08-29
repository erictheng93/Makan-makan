// Integration tests for offline mode and synchronization
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import OfflineStatus from '@/components/offline/OfflineStatus.vue'
import { offlineService } from '@/services/offlineService'
import type { KitchenOrder, OfflineAction } from '@/types'

// Mock fetch for API calls
global.fetch = vi.fn()

const mockOrders: KitchenOrder[] = [
  {
    id: 1,
    orderNumber: '#001',
    tableNumber: 'T1',
    items: [{ id: 1, name: '炒飯', status: 'pending', cookingTime: 10, priority: 'normal' }],
    status: 1,
    totalAmount: 25.00,
    createdAt: new Date().toISOString(),
    elapsedTime: 5,
    estimatedTime: 15,
    priority: 'normal',
    customer: { name: '王小明', phone: '0912345678' },
    specialInstructions: '',
    assignedChef: null
  }
]

describe('Offline Sync Integration Tests', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    
    // Reset offline service state
    offlineService.clearOfflineData()
    offlineService.isOnline.value = true
    offlineService.isOfflineMode.value = false
    
    // Reset localStorage
    localStorage.clear()
    
    // Mock fetch responses
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    } as Response)
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    offlineService.destroy()
    vi.restoreAllMocks()
  })

  describe('Offline Service Integration', () => {
    it('should initialize and detect online status', () => {
      expect(offlineService.isOnline.value).toBe(true)
      expect(offlineService.isOfflineMode.value).toBe(false)
    })

    it('should handle going offline', async () => {
      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      
      const offlineEvent = new Event('offline')
      window.dispatchEvent(offlineEvent)
      
      await nextTick()
      
      expect(offlineService.isOnline.value).toBe(false)
      expect(offlineService.isOfflineMode.value).toBe(true)
    })

    it('should handle coming back online', async () => {
      // Start offline
      offlineService.isOnline.value = false
      offlineService.isOfflineMode.value = true
      
      // Go back online
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      
      const onlineEvent = new Event('online')
      window.dispatchEvent(onlineEvent)
      
      await nextTick()
      
      expect(offlineService.isOnline.value).toBe(true)
      expect(offlineService.isOfflineMode.value).toBe(false)
    })
  })

  describe('Action Queuing and Caching', () => {
    it('should queue actions when offline', () => {
      offlineService.isOnline.value = false
      
      const actionId = offlineService.queueAction(
        'start_cooking',
        1,
        { itemId: 1 }
      )
      
      expect(actionId).toBeDefined()
      expect(offlineService.pendingActions.value.length).toBe(1)
      
      const action = offlineService.pendingActions.value[0]
      expect(action.type).toBe('start_cooking')
      expect(action.orderId).toBe(1)
      expect(action.synced).toBe(false)
    })

    it('should apply actions locally for optimistic updates', () => {
      // Cache orders
      offlineService.cacheOrders(mockOrders)
      
      const action: OfflineAction = {
        id: 'test-action',
        type: 'start_cooking',
        orderId: 1,
        itemId: 1,
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 0
      }
      
      offlineService.applyActionLocally(action)
      
      const cachedOrders = offlineService.getCachedOrders()
      const updatedOrder = cachedOrders.find(o => o.id === 1)
      const updatedItem = updatedOrder?.items.find(i => i.id === 1)
      
      expect(updatedItem?.status).toBe('preparing')
    })

    it('should handle batch operations offline', () => {
      offlineService.cacheOrders(mockOrders)
      
      const batchAction: OfflineAction = {
        id: 'batch-action',
        type: 'batch_operation',
        orderId: 1,
        payload: { operation: 'start_all' },
        timestamp: Date.now(),
        synced: false,
        retryCount: 0
      }
      
      offlineService.applyActionLocally(batchAction)
      
      const cachedOrders = offlineService.getCachedOrders()
      const updatedOrder = cachedOrders.find(o => o.id === 1)
      
      expect(updatedOrder?.items.every(item => item.status === 'preparing')).toBe(true)
    })
  })

  describe('Synchronization Process', () => {
    it('should sync pending actions when online', async () => {
      // Queue some actions
      offlineService.queueAction('start_cooking', 1, { itemId: 1 })
      offlineService.queueAction('mark_ready', 1, { itemId: 1 })
      
      expect(offlineService.pendingActions.value.length).toBe(2)
      
      // Sync
      await offlineService.syncPendingActions()
      
      // Actions should be marked as synced and removed
      expect(offlineService.pendingActions.value.length).toBe(0)
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('should handle sync failures with retry', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))
      
      offlineService.queueAction('start_cooking', 1, { itemId: 1 })
      
      await offlineService.syncPendingActions()
      
      const action = offlineService.pendingActions.value[0]
      expect(action.retryCount).toBe(1)
      expect(action.error).toBe('Network error')
    })

    it('should handle sync conflicts', async () => {
      const conflictResponse = {
        success: false,
        conflict: {
          type: 'order_updated',
          serverData: { status: 3 }
        }
      }
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => conflictResponse
      } as Response)
      
      offlineService.queueAction('update_status', 1, { status: 2 })
      
      await offlineService.syncPendingActions()
      
      expect(offlineService.syncConflicts.value.length).toBe(1)
      expect(offlineService.syncConflicts.value[0].type).toBe('order_updated')
    })
  })

  describe('Offline Status Component Integration', () => {
    it('should display offline status correctly', async () => {
      const wrapper = mount(OfflineStatus)
      
      // Set offline state
      offlineService.isOfflineMode.value = true
      offlineService.pendingActions.value = [{
        id: '1',
        type: 'start_cooking',
        orderId: 1,
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 0
      }]
      
      await nextTick()
      
      expect(wrapper.find('[data-testid="offline-indicator"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('離線模式')
      expect(wrapper.text()).toContain('1') // pending actions count
    })

    it('should show sync progress', async () => {
      const wrapper = mount(OfflineStatus)
      
      offlineService.syncInProgress.value = true
      
      await nextTick()
      
      expect(wrapper.find('[data-testid="sync-progress"]').exists()).toBe(true)
    })

    it('should handle manual sync trigger', async () => {
      const wrapper = mount(OfflineStatus)
      
      const syncButton = wrapper.find('[data-testid="manual-sync"]')
      await syncButton.trigger('click')
      
      expect(fetch).toHaveBeenCalled()
    })

    it('should display conflict resolution UI', async () => {
      const wrapper = mount(OfflineStatus)
      
      offlineService.syncConflicts.value = [{
        id: 'conflict-1',
        type: 'order_updated',
        localData: { status: 2 },
        serverData: { status: 3 }
      }]
      
      await nextTick()
      
      expect(wrapper.find('[data-testid="conflicts-modal"]').exists()).toBe(true)
    })
  })

  describe('Data Persistence and Recovery', () => {
    it('should persist offline data to localStorage', () => {
      offlineService.queueAction('start_cooking', 1, { itemId: 1 })
      
      const savedData = localStorage.getItem('kitchen-offline-data')
      expect(savedData).toBeDefined()
      
      const parsedData = JSON.parse(savedData!)
      expect(parsedData.actions.length).toBe(1)
    })

    it('should restore offline data on initialization', () => {
      const offlineData = {
        orders: mockOrders,
        actions: [{
          id: 'restored-action',
          type: 'start_cooking',
          orderId: 1,
          payload: {},
          timestamp: Date.now(),
          synced: false,
          retryCount: 0
        }],
        lastSync: Date.now(),
        syncInProgress: false
      }
      
      localStorage.setItem('kitchen-offline-data', JSON.stringify(offlineData))
      
      // Create new service instance to test loading
      const newService = new (offlineService.constructor as any)()
      
      expect(newService.pendingActions.value.length).toBe(1)
      expect(newService.pendingActions.value[0].id).toBe('restored-action')
    })

    it('should cleanup old actions automatically', () => {
      const oldAction = {
        id: 'old-action',
        type: 'start_cooking',
        orderId: 1,
        payload: {},
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        synced: false,
        retryCount: 0
      }
      
      const recentAction = {
        id: 'recent-action',
        type: 'start_cooking',
        orderId: 2,
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 0
      }
      
      const offlineData = {
        orders: mockOrders,
        actions: [oldAction, recentAction],
        lastSync: Date.now(),
        syncInProgress: false
      }
      
      localStorage.setItem('kitchen-offline-data', JSON.stringify(offlineData))
      
      const newService = new (offlineService.constructor as any)()
      
      // Should only keep recent action
      expect(newService.pendingActions.value.length).toBe(1)
      expect(newService.pendingActions.value[0].id).toBe('recent-action')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle localStorage quota exceeded', () => {
      const originalSetItem = localStorage.setItem
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      
      // Should not crash when storage is full
      expect(() => {
        offlineService.queueAction('start_cooking', 1, { itemId: 1 })
      }).not.toThrow()
      
      localStorage.setItem = originalSetItem
    })

    it('should handle corrupted localStorage data', () => {
      localStorage.setItem('kitchen-offline-data', 'invalid json')
      
      // Should initialize without crashing
      expect(() => {
        new (offlineService.constructor as any)()
      }).not.toThrow()
    })

    it('should handle network timeouts gracefully', async () => {
      vi.mocked(fetch).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 1000)
        )
      )
      
      offlineService.queueAction('start_cooking', 1, { itemId: 1 })
      
      await offlineService.syncPendingActions()
      
      const action = offlineService.pendingActions.value[0]
      expect(action.error).toContain('Timeout')
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large numbers of pending actions', () => {
      const startTime = performance.now()
      
      // Queue many actions
      for (let i = 0; i < 1000; i++) {
        offlineService.queueAction('start_cooking', i, { itemId: 1 })
      }
      
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(1000) // 1 second
      expect(offlineService.pendingActions.value.length).toBe(1000)
    })

    it('should efficiently batch sync operations', async () => {
      // Queue multiple actions
      for (let i = 0; i < 10; i++) {
        offlineService.queueAction('start_cooking', i, { itemId: 1 })
      }
      
      const startTime = performance.now()
      await offlineService.syncPendingActions()
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(5000) // 5 seconds
      expect(fetch).toHaveBeenCalledTimes(10)
    })
  })

  describe('Integration with Order Management', () => {
    it('should sync with order store updates', async () => {
      // Mock order store action
      const orderAction = {
        type: 'START_COOKING',
        orderId: 1,
        itemId: 1
      }
      
      // When offline, should queue the action
      offlineService.isOnline.value = false
      
      offlineService.queueAction('start_cooking', orderAction.orderId, {
        itemId: orderAction.itemId
      })
      
      expect(offlineService.pendingActions.value.length).toBe(1)
    })
  })
})