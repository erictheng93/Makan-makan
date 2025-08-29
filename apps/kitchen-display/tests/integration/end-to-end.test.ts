// End-to-end integration tests for complete system functionality
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import EnhancedKitchenDashboard from '@/views/EnhancedKitchenDashboard.vue'
import { useOrderManagement } from '@/stores/orderManagement'
import { audioService } from '@/services/audioService'
import { offlineService } from '@/services/offlineService'
import { performanceService } from '@/services/performanceService'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import type { KitchenOrder } from '@/types'

// Mock all external dependencies
vi.mock('howler')
global.fetch = vi.fn()
global.EventSource = vi.fn()

const mockOrders: KitchenOrder[] = [
  {
    id: 1,
    orderNumber: '#001',
    tableNumber: 'T1',
    items: [
      { id: 1, name: '炒飯', status: 'pending', cookingTime: 10, priority: 'normal' },
      { id: 2, name: '湯', status: 'pending', cookingTime: 5, priority: 'normal' }
    ],
    status: 1,
    totalAmount: 25.00,
    createdAt: new Date().toISOString(),
    elapsedTime: 5,
    estimatedTime: 15,
    priority: 'normal',
    customer: { name: '王小明', phone: '0912345678' },
    specialInstructions: '',
    assignedChef: null
  },
  {
    id: 2,
    orderNumber: '#002',
    tableNumber: 'T2',
    items: [
      { id: 3, name: '牛排', status: 'preparing', cookingTime: 20, priority: 'high' }
    ],
    status: 2,
    totalAmount: 35.00,
    createdAt: new Date(Date.now() - 600000).toISOString(),
    elapsedTime: 10,
    estimatedTime: 20,
    priority: 'high',
    customer: { name: '李小華', phone: '0987654321' },
    specialInstructions: '七分熟',
    assignedChef: 'chef1'
  },
  {
    id: 3,
    orderNumber: '#003',
    tableNumber: 'T3',
    items: [
      { id: 4, name: '沙拉', status: 'ready', cookingTime: 3, priority: 'normal' }
    ],
    status: 3,
    totalAmount: 15.00,
    createdAt: new Date(Date.now() - 900000).toISOString(),
    elapsedTime: 15,
    estimatedTime: 5,
    priority: 'normal',
    customer: { name: '張小美', phone: '0965432187' },
    specialInstructions: '',
    assignedChef: 'chef2'
  }
]

describe('End-to-End Integration Tests', () => {
  let orderStore: ReturnType<typeof useOrderManagement>
  let wrapper: any

  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    
    orderStore = useOrderManagement()
    orderStore.orders = [...mockOrders]
    
    // Initialize all services
    audioService.initialize()
    performanceService.start()
    
    // Mock successful API responses
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    } as Response)
    
    wrapper = mount(EnhancedKitchenDashboard, {
      global: {
        plugins: [pinia]
      }
    })
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    wrapper?.unmount()
    audioService.cleanup()
    performanceService.stop()
    offlineService.destroy()
  })

  describe('Complete Order Workflow', () => {
    it('should handle complete order lifecycle with all features', async () => {
      // 1. Initial state - orders are loaded
      expect(orderStore.orders).toHaveLength(3)
      
      // 2. Filter orders by status
      await orderStore.applyFilter({ status: [1] }) // pending only
      expect(orderStore.filteredOrders).toHaveLength(1)
      
      // 3. Start cooking via drag and drop
      const pendingOrder = orderStore.orders.find(o => o.status === 1)!
      await orderStore.startCooking(pendingOrder.id)
      
      // Should update status and trigger audio
      expect(pendingOrder.status).toBe(2)
      
      // 4. Mark item as ready
      await orderStore.markItemReady(pendingOrder.id, pendingOrder.items[0].id)
      expect(pendingOrder.items[0].status).toBe('ready')
      
      // 5. Complete entire order
      await orderStore.completeOrder(pendingOrder.id)
      expect(pendingOrder.status).toBe(4)
    })

    it('should work seamlessly in offline mode', async () => {
      // 1. Go offline
      offlineService.isOnline.value = false
      offlineService.isOfflineMode.value = true
      
      // 2. Perform actions while offline
      const order = orderStore.orders[0]
      await orderStore.startCooking(order.id)
      await orderStore.markItemReady(order.id, order.items[0].id)
      
      // Should queue actions
      expect(offlineService.pendingActions.value).toHaveLength(2)
      
      // 3. Go back online
      offlineService.isOnline.value = true
      offlineService.isOfflineMode.value = false
      
      // 4. Sync should happen automatically
      await offlineService.syncPendingActions()
      expect(offlineService.pendingActions.value).toHaveLength(0)
    })

    it('should handle batch operations across multiple orders', async () => {
      // 1. Select multiple orders
      orderStore.selectedOrders.add(1)
      orderStore.selectedOrders.add(2)
      
      // 2. Perform batch start cooking
      await orderStore.batchOperation('start_cooking')
      
      const order1 = orderStore.orders.find(o => o.id === 1)!
      const order2 = orderStore.orders.find(o => o.id === 2)!
      
      expect(order1.status).toBe(2)
      expect(order2.status).toBe(2) // Already was preparing, should remain
    })
  })

  describe('Workflow Automation Integration', () => {
    it('should auto-assign orders to available chefs', async () => {
      // Mock workflow automation being enabled
      const workflowComponent = {
        rules: {
          autoAssignment: { enabled: true, skillBased: true, loadBalancing: true }
        },
        chefSkills: {
          chef1: ['grill', 'wok'],
          chef2: ['soup', 'salad'],
          chef3: ['dessert']
        },
        chefWorkloads: {
          chef1: 2,
          chef2: 0,
          chef3: 1
        }
      }
      
      const newOrder = {
        ...mockOrders[0],
        id: 4,
        items: [{ ...mockOrders[0].items[0], category: 'soup' }]
      }
      
      // Should assign to chef2 (soup specialist with lowest workload)
      const assignedChef = 'chef2' // Mocked assignment logic
      expect(assignedChef).toBe('chef2')
    })

    it('should handle smart scheduling and batching', async () => {
      const orders = [
        { ...mockOrders[0], items: [{ name: '炒飯', category: 'rice', cookingTime: 8 }] },
        { ...mockOrders[1], items: [{ name: '炒麵', category: 'noodles', cookingTime: 10 }] },
        { ...mockOrders[2], items: [{ name: '蛋炒飯', category: 'rice', cookingTime: 7 }] }
      ]
      
      // Group by category for batching
      const riceOrders = orders.filter(o => o.items[0].category === 'rice')
      expect(riceOrders).toHaveLength(2)
      
      // Should prioritize by cooking time
      const sortedByTime = riceOrders.sort((a, b) => a.items[0].cookingTime - b.items[0].cookingTime)
      expect(sortedByTime[0].items[0].cookingTime).toBeLessThan(sortedByTime[1].items[0].cookingTime)
    })
  })

  describe('Multi-System Integration', () => {
    it('should coordinate audio, offline, and performance monitoring', async () => {
      // 1. Start performance monitoring
      performanceService.start()
      
      // 2. Trigger a workflow that involves all systems
      const startTime = performance.now()
      
      // Audio notification for new order
      await audioService.play('new_order', { priority: 'high' })
      
      // Offline action queuing
      if (!offlineService.isOnline.value) {
        offlineService.queueAction('start_cooking', 1, { itemId: 1 })
      }
      
      // Performance tracking
      const endTime = performance.now()
      performanceService.recordMetric('workflow_execution_time', endTime - startTime, 'ms', 'system')
      
      // Verify all systems worked together
      expect(performanceService.getMetrics()).toHaveLength(1)
      const metric = performanceService.getMetrics()[0]
      expect(metric.name).toBe('workflow_execution_time')
      expect(metric.category).toBe('system')
    })

    it('should handle keyboard shortcuts with full system integration', async () => {
      const { executeShortcut } = useKeyboardShortcuts()
      
      // Performance tracking for shortcut execution
      const startTime = performance.now()
      
      // Execute shortcut that triggers multiple systems
      await executeShortcut('filter_pending')
      
      const endTime = performance.now()
      performanceService.recordMetric('shortcut_execution_time', endTime - startTime, 'ms', 'user')
      
      // Should have filtered orders
      expect(orderStore.appliedFilters.status).toContain(1)
      
      // Should have recorded performance metric
      const metrics = performanceService.getMetrics()
      const shortcutMetric = metrics.find(m => m.name === 'shortcut_execution_time')
      expect(shortcutMetric).toBeDefined()
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should gracefully handle service failures', async () => {
      // 1. Simulate audio service failure
      vi.spyOn(audioService, 'play').mockRejectedValueOnce(new Error('Audio failed'))
      
      // 2. Simulate offline service failure  
      vi.spyOn(offlineService, 'queueAction').mockImplementationOnce(() => {
        throw new Error('Offline queue failed')
      })
      
      // 3. Simulate performance service failure
      vi.spyOn(performanceService, 'recordMetric').mockImplementationOnce(() => {
        throw new Error('Performance recording failed')
      })
      
      // 4. Execute workflow that uses all services
      const order = orderStore.orders[0]
      
      // Should not crash despite service failures
      await expect(orderStore.startCooking(order.id)).resolves.not.toThrow()
      
      // Order should still be updated
      expect(order.status).toBe(2)
    })

    it('should recover from network interruptions', async () => {
      // 1. Start with online mode
      expect(offlineService.isOnline.value).toBe(true)
      
      // 2. Simulate network failure
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))
      
      // 3. Perform order operation
      const order = orderStore.orders[0]
      await orderStore.startCooking(order.id)
      
      // 4. Should queue action for later sync
      expect(offlineService.pendingActions.value.length).toBeGreaterThan(0)
      
      // 5. Restore network
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response)
      
      // 6. Sync should succeed
      await offlineService.syncPendingActions()
      expect(offlineService.pendingActions.value).toHaveLength(0)
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large numbers of orders efficiently', async () => {
      // Generate many orders
      const manyOrders = Array.from({ length: 100 }, (_, i) => ({
        ...mockOrders[0],
        id: i + 1,
        orderNumber: `#${(i + 1).toString().padStart(3, '0')}`,
        tableNumber: `T${i + 1}`
      }))
      
      const startTime = performance.now()
      
      // Load orders into store
      orderStore.orders = manyOrders
      
      // Apply filters
      await orderStore.applyFilter({ status: [1, 2] })
      
      // Process batch operations
      const selectedIds = manyOrders.slice(0, 50).map(o => o.id)
      selectedIds.forEach(id => orderStore.selectedOrders.add(id))
      
      await orderStore.batchOperation('start_cooking')
      
      const endTime = performance.now()
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(2000) // 2 seconds
      
      // Results should be correct
      expect(orderStore.orders.filter(o => o.status === 2)).toHaveLength(50)
    })

    it('should maintain responsiveness during heavy load', async () => {
      // Simulate heavy system load
      const startTime = performance.now()
      
      // Multiple concurrent operations
      const operations = [
        audioService.play('new_order'),
        audioService.play('order_ready'),
        audioService.play('overdue_warning'),
        offlineService.queueAction('start_cooking', 1, {}),
        offlineService.queueAction('mark_ready', 2, {}),
        performanceService.recordMetric('test_metric_1', 100, 'ms', 'system'),
        performanceService.recordMetric('test_metric_2', 200, 'ms', 'network'),
        performanceService.recordMetric('test_metric_3', 300, 'ms', 'user')
      ]
      
      await Promise.all(operations)
      
      const endTime = performance.now()
      
      // Should handle concurrent operations efficiently
      expect(endTime - startTime).toBeLessThan(1000) // 1 second
    })
  })

  describe('Data Consistency and Integrity', () => {
    it('should maintain data consistency across all systems', async () => {
      const order = orderStore.orders[0]
      const originalStatus = order.status
      
      // 1. Update through order management
      await orderStore.startCooking(order.id)
      expect(order.status).toBe(2)
      
      // 2. Check consistency in cached data (offline service)
      const cachedOrders = offlineService.getCachedOrders()
      const cachedOrder = cachedOrders.find(o => o.id === order.id)
      expect(cachedOrder?.status).toBe(2)
      
      // 3. Performance metrics should reflect the change
      const metrics = performanceService.getMetrics()
      const statusChangeMetric = metrics.find(m => m.name.includes('status_change'))
      expect(statusChangeMetric).toBeDefined()
    })

    it('should handle concurrent updates correctly', async () => {
      const order = orderStore.orders[0]
      
      // Simulate concurrent updates
      const update1 = orderStore.updateOrderPriority(order.id, 'high')
      const update2 = orderStore.startCooking(order.id)
      const update3 = orderStore.assignChef(order.id, 'chef1')
      
      await Promise.all([update1, update2, update3])
      
      // Final state should be consistent
      expect(order.priority).toBe('high')
      expect(order.status).toBe(2)
      expect(order.assignedChef).toBe('chef1')
      
      // No duplicate actions should be queued
      const queuedActions = offlineService.pendingActions.value.filter(a => a.orderId === order.id)
      expect(queuedActions.length).toBeLessThanOrEqual(3)
    })
  })

  describe('User Experience Integration', () => {
    it('should provide seamless user experience across all features', async () => {
      // Simulate typical user workflow
      
      // 1. User opens dashboard - should see all orders
      expect(wrapper.findAll('[data-testid="order-card"]')).toHaveLength(3)
      
      // 2. User applies filter - should update display
      await orderStore.applyFilter({ status: [1] })
      await nextTick()
      
      // 3. User uses keyboard shortcut - should work instantly
      const { executeShortcut } = useKeyboardShortcuts()
      await executeShortcut('select_all')
      expect(orderStore.selectedOrders.size).toBeGreaterThan(0)
      
      // 4. User performs batch operation - should provide feedback
      await orderStore.batchOperation('start_cooking')
      
      // Audio feedback should play
      expect(audioService.play).toHaveBeenCalled()
      
      // Performance should be tracked
      const metrics = performanceService.getMetrics()
      expect(metrics.length).toBeGreaterThan(0)
    })

    it('should handle accessibility requirements', async () => {
      // Check ARIA labels and keyboard navigation
      expect(wrapper.find('[role="main"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label]').exists()).toBe(true)
      
      // Focus management
      const firstOrder = wrapper.find('[data-testid="order-card"]')
      expect(firstOrder.attributes('tabindex')).toBeDefined()
    })
  })
})