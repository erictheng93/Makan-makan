// Integration tests for workflow automation features
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import WorkflowAutomation from '@/components/workflow/WorkflowAutomation.vue'
import { useOrderManagement } from '@/stores/orderManagement'
import type { KitchenOrder } from '@/types'

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
  }
]

describe('Workflow Integration Tests', () => {
  let wrapper: VueWrapper
  let orderStore: ReturnType<typeof useOrderManagement>

  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    
    wrapper = mount(WorkflowAutomation, {
      global: {
        plugins: [pinia]
      }
    })
    
    orderStore = useOrderManagement()
    orderStore.orders = [...mockOrders]
  })

  afterEach(() => {
    wrapper.unmount()
  })

  describe('Auto Assignment Workflow', () => {
    it('should auto-assign orders based on skill matching', async () => {
      const workflowComponent = wrapper.vm as any
      
      // Enable skill-based assignment
      workflowComponent.rules.autoAssignment.enabled = true
      workflowComponent.rules.autoAssignment.skillBased = true
      
      workflowComponent.chefSkills = {
        chef1: ['grill', 'wok'],
        chef2: ['soup', 'salad'],
        chef3: ['dessert', 'beverage']
      }
      
      const grillOrder = {
        ...mockOrders[0],
        items: [{ ...mockOrders[0].items[0], category: 'grill' }]
      }
      
      const assignedChef = workflowComponent.assignOrderToChef(grillOrder)
      expect(assignedChef).toBe('chef1')
    })

    it('should consider chef workload in assignment', async () => {
      const workflowComponent = wrapper.vm as any
      
      workflowComponent.rules.autoAssignment.enabled = true
      workflowComponent.rules.autoAssignment.loadBalancing = true
      
      // Mock chef workloads
      workflowComponent.chefWorkloads = {
        chef1: 3, // busy
        chef2: 1, // available
        chef3: 2  // moderate
      }
      
      const newOrder = mockOrders[0]
      const assignedChef = workflowComponent.assignOrderToChef(newOrder)
      expect(assignedChef).toBe('chef2') // Should assign to least busy chef
    })
  })

  describe('Auto Progression Workflow', () => {
    it('should automatically progress order status', async () => {
      const workflowComponent = wrapper.vm as any
      
      workflowComponent.rules.autoProgression.enabled = true
      workflowComponent.rules.autoProgression.startDelay = 100 // 100ms for testing
      
      const pendingOrder = mockOrders[0]
      
      // Start auto progression
      workflowComponent.scheduleAutoProgression(pendingOrder)
      
      // Wait for progression
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Check if order status changed
      expect(workflowComponent.progressionTimers.has(pendingOrder.id)).toBe(true)
    })

    it('should handle completion auto-progression', async () => {
      const workflowComponent = wrapper.vm as any
      
      workflowComponent.rules.autoProgression.enabled = true
      workflowComponent.rules.autoProgression.completeDelay = 100
      
      const preparingOrder = mockOrders[1]
      
      workflowComponent.scheduleAutoProgression(preparingOrder)
      
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Should trigger completion logic
      expect(workflowComponent.progressionTimers.has(preparingOrder.id)).toBe(true)
    })
  })

  describe('Smart Scheduling Workflow', () => {
    it('should batch similar items together', async () => {
      const workflowComponent = wrapper.vm as any
      
      workflowComponent.rules.smartScheduling.enabled = true
      workflowComponent.rules.smartScheduling.batchSimilar = true
      
      const orders = [
        { ...mockOrders[0], items: [{ name: '炒飯', category: 'rice' }] },
        { ...mockOrders[1], items: [{ name: '炒麵', category: 'rice' }] }
      ]
      
      const batches = workflowComponent.createBatches(orders)
      
      expect(batches.length).toBeGreaterThan(0)
      expect(batches[0].items.every((item: any) => item.category === 'rice')).toBe(true)
    })

    it('should prioritize by cooking time', async () => {
      const workflowComponent = wrapper.vm as any
      
      workflowComponent.rules.smartScheduling.enabled = true
      workflowComponent.rules.smartScheduling.cookingTimeBased = true
      
      const orders = [
        { ...mockOrders[0], estimatedTime: 20 },
        { ...mockOrders[1], estimatedTime: 10 }
      ]
      
      const sorted = workflowComponent.sortByPriority(orders)
      
      // Should prioritize shorter cooking times
      expect(sorted[0].estimatedTime).toBeLessThan(sorted[1].estimatedTime)
    })
  })

  describe('Quality Control Workflow', () => {
    it('should perform automatic quality checks', async () => {
      const workflowComponent = wrapper.vm as any
      
      workflowComponent.rules.qualityControl.enabled = true
      workflowComponent.rules.qualityControl.autoCheck = true
      
      const completedOrder = {
        ...mockOrders[0],
        status: 3, // completed
        items: mockOrders[0].items.map(item => ({ ...item, status: 'ready' }))
      }
      
      const qualityResult = workflowComponent.performQualityCheck(completedOrder)
      
      expect(qualityResult).toBeDefined()
      expect(qualityResult.passed).toBe(true)
    })

    it('should detect quality issues', async () => {
      const workflowComponent = wrapper.vm as any
      
      workflowComponent.rules.qualityControl.enabled = true
      
      const problematicOrder = {
        ...mockOrders[0],
        elapsedTime: 60, // Very long time
        estimatedTime: 15
      }
      
      const qualityResult = workflowComponent.performQualityCheck(problematicOrder)
      
      expect(qualityResult.issues).toContain('excessive_time')
    })
  })

  describe('Integration with Order Management', () => {
    it('should integrate with drag-and-drop operations', async () => {
      const workflowComponent = wrapper.vm as any
      
      // Enable workflows
      workflowComponent.rules.autoAssignment.enabled = true
      
      // Simulate drag-and-drop event
      const dragEvent = {
        orderId: 1,
        fromStatus: 'pending',
        toStatus: 'preparing',
        chef: 'chef1'
      }
      
      workflowComponent.handleDragDropEvent(dragEvent)
      
      // Should update order and apply workflow rules
      expect(workflowComponent.lastDragDropEvent).toEqual(dragEvent)
    })

    it('should work with batch operations', async () => {
      const workflowComponent = wrapper.vm as any
      
      workflowComponent.rules.smartScheduling.enabled = true
      
      const batchOperation = {
        type: 'start_all',
        orderIds: [1, 2],
        chef: 'chef1'
      }
      
      workflowComponent.handleBatchOperation(batchOperation)
      
      expect(workflowComponent.lastBatchOperation).toEqual(batchOperation)
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle chef assignment errors gracefully', async () => {
      const workflowComponent = wrapper.vm as any
      
      // Simulate no available chefs
      workflowComponent.chefWorkloads = {
        chef1: 10,
        chef2: 10,
        chef3: 10
      }
      
      const order = mockOrders[0]
      const assignedChef = workflowComponent.assignOrderToChef(order)
      
      // Should fall back to round-robin or default assignment
      expect(assignedChef).toBeDefined()
    })

    it('should recover from automation failures', async () => {
      const workflowComponent = wrapper.vm as any
      
      workflowComponent.rules.autoProgression.enabled = true
      
      // Simulate failure
      const originalConsoleError = console.error
      console.error = vi.fn()
      
      try {
        workflowComponent.scheduleAutoProgression(null) // Invalid order
        
        // Should not crash and should log error
        expect(console.error).toHaveBeenCalled()
      } finally {
        console.error = originalConsoleError
      }
    })
  })

  describe('Performance and Optimization', () => {
    it('should handle large numbers of orders efficiently', async () => {
      const workflowComponent = wrapper.vm as any
      
      // Generate many orders
      const manyOrders = Array.from({ length: 100 }, (_, i) => ({
        ...mockOrders[0],
        id: i + 1,
        orderNumber: `#${(i + 1).toString().padStart(3, '0')}`
      }))
      
      const startTime = performance.now()
      workflowComponent.processOrderBatch(manyOrders)
      const endTime = performance.now()
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000) // 1 second
    })

    it('should cleanup timers properly', async () => {
      const workflowComponent = wrapper.vm as any
      
      // Create progression timers
      workflowComponent.scheduleAutoProgression(mockOrders[0])
      workflowComponent.scheduleAutoProgression(mockOrders[1])
      
      expect(workflowComponent.progressionTimers.size).toBe(2)
      
      // Cleanup
      workflowComponent.cleanupTimers()
      
      expect(workflowComponent.progressionTimers.size).toBe(0)
    })
  })
})