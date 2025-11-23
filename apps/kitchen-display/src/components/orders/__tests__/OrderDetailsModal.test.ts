/**
 * OrderDetailsModal Component Tests
 * 測試訂單詳情模態框的顯示和功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import OrderDetailsModal from '../OrderDetailsModal.vue'
import type { KitchenOrder, ItemStatus } from '@/types'

// Mock Heroicons
vi.mock('@heroicons/vue/24/outline', () => ({
  XMarkIcon: { name: 'XMarkIcon', template: '<svg />' },
  ExclamationTriangleIcon: { name: 'ExclamationTriangleIcon', template: '<svg />' },
  ClockIcon: { name: 'ClockIcon', template: '<svg />' },
  ChatBubbleLeftEllipsisIcon: { name: 'ChatBubbleLeftEllipsisIcon', template: '<svg />' }
}))

function createMockOrder(overrides: Partial<KitchenOrder> = {}): KitchenOrder {
  return {
    id: 1,
    orderNumber: 'ORD-001',
    tableName: 'T1',
    tableId: 1,
    status: 1,
    priority: 'normal',
    createdAt: new Date().toISOString(),
    elapsedTime: 10,
    estimatedTime: 15,
    totalItems: 2,
    items: [
      {
        id: 1,
        name: '宮保雞丁',
        quantity: 2,
        status: 'pending' as ItemStatus,
        estimatedTime: 15
      },
      {
        id: 2,
        name: '麻婆豆腐',
        quantity: 1,
        status: 'pending' as ItemStatus,
        estimatedTime: 10
      }
    ],
    ...overrides
  }
}

describe('OrderDetailsModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Visibility', () => {
    it('should not render when show is false', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder(),
          show: false
        }
      })

      expect(wrapper.find('.fixed.inset-0').exists()).toBe(false)
    })

    it('should render when show is true', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder(),
          show: true
        }
      })

      expect(wrapper.find('.fixed.inset-0').exists()).toBe(true)
    })
  })

  describe('Order Header', () => {
    it('should display order number', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder({ orderNumber: 'ORD-123' }),
          show: true
        }
      })

      expect(wrapper.text()).toContain('ORD-123')
    })

    it('should display close button', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder(),
          show: true
        }
      })

      const closeButton = wrapper.find('button')
      expect(closeButton.exists()).toBe(true)
    })

    it('should emit close event when close button clicked', async () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder(),
          show: true
        }
      })

      await wrapper.find('button').trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('Order Basic Info', () => {
    it('should display table name', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder({ tableName: 'T5' }),
          show: true
        }
      })

      expect(wrapper.text()).toContain('T5')
    })

    it('should display created time', () => {
      const createdAt = '2025-11-15T14:30:00'
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder({ createdAt }),
          show: true
        }
      })

      expect(wrapper.text()).toContain('下單時間')
    })

    it('should display customer name when available', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder({ customerName: '張三' }),
          show: true
        }
      })

      expect(wrapper.text()).toContain('張三')
    })

    it('should display elapsed time', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder({ elapsedTime: 25 }),
          show: true
        }
      })

      expect(wrapper.text()).toContain('25分鐘')
    })

    it('should format elapsed time over 60 minutes correctly', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder({ elapsedTime: 125 }),
          show: true
        }
      })

      expect(wrapper.text()).toContain('2時5分')
    })
  })

  describe('Order Items Display', () => {
    it('should display all order items', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder(),
          show: true
        }
      })

      expect(wrapper.text()).toContain('宮保雞丁')
      expect(wrapper.text()).toContain('麻婆豆腐')
    })

    it('should display item quantities', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder(),
          show: true
        }
      })

      expect(wrapper.text()).toContain('x2')
      expect(wrapper.text()).toContain('x1')
    })

    it('should display item status badges', () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: '宮保雞丁',
            quantity: 1,
            status: 'preparing' as ItemStatus
          }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.text()).toContain('製作中')
    })

    it('should display item notes when available', () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: '宮保雞丁',
            quantity: 1,
            status: 'pending' as ItemStatus,
            notes: '不要辣'
          }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.text()).toContain('不要辣')
    })

    it('should display item customizations', () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: '宮保雞丁',
            quantity: 1,
            status: 'pending' as ItemStatus,
            customizations: ['加辣', '少油']
          }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.text()).toContain('加辣')
      expect(wrapper.text()).toContain('少油')
    })
  })

  describe('Item Status Actions', () => {
    it('should show start button for pending items', () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: '宮保雞丁',
            quantity: 1,
            status: 'pending' as ItemStatus
          }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.text()).toContain('開始製作')
    })

    it('should show complete button for preparing items', () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: '宮保雞丁',
            quantity: 1,
            status: 'preparing' as ItemStatus
          }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.text()).toContain('標記完成')
    })

    it('should show ready badge for completed items', () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: '宮保雞丁',
            quantity: 1,
            status: 'ready' as ItemStatus
          }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.text()).toContain('已完成')
    })

    it('should emit update-status when start button clicked', async () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: '宮保雞丁',
            quantity: 1,
            status: 'pending' as ItemStatus
          }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      const startButton = wrapper.find('.bg-blue-600')
      await startButton.trigger('click')

      expect(wrapper.emitted('update-status')).toBeTruthy()
      expect(wrapper.emitted('update-status')?.[0]).toEqual([1, 1, 'preparing'])
    })

    it('should emit update-status when complete button clicked', async () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: '宮保雞丁',
            quantity: 1,
            status: 'preparing' as ItemStatus
          }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      const completeButton = wrapper.find('.bg-green-600')
      await completeButton.trigger('click')

      expect(wrapper.emitted('update-status')).toBeTruthy()
      expect(wrapper.emitted('update-status')?.[0]).toEqual([1, 1, 'ready'])
    })
  })

  describe('Order Notes', () => {
    it('should display order notes when available', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder({ notes: '請盡快準備' }),
          show: true
        }
      })

      expect(wrapper.text()).toContain('請盡快準備')
    })

    it('should not display notes section when no notes', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder(),
          show: true
        }
      })

      const notesSection = wrapper.text().includes('訂單備註')
      expect(notesSection).toBe(false)
    })
  })

  describe('Order Timeline', () => {
    it('should display creation time', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder(),
          show: true
        }
      })

      expect(wrapper.text()).toContain('訂單建立')
    })

    it('should display confirmed time when available', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder({
            confirmedAt: new Date().toISOString()
          }),
          show: true
        }
      })

      expect(wrapper.text()).toContain('訂單確認')
    })
  })

  describe('Batch Complete All', () => {
    it('should show complete all button when has uncompleted items', () => {
      const order = createMockOrder({
        items: [
          { id: 1, name: 'Item 1', quantity: 1, status: 'pending' as ItemStatus },
          { id: 2, name: 'Item 2', quantity: 1, status: 'preparing' as ItemStatus }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.text()).toContain('全部完成')
    })

    it('should not show complete all button when all items ready', () => {
      const order = createMockOrder({
        items: [
          { id: 1, name: 'Item 1', quantity: 1, status: 'ready' as ItemStatus },
          { id: 2, name: 'Item 2', quantity: 1, status: 'ready' as ItemStatus }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      const completeAllButton = wrapper.findAll('button').find(btn => btn.text() === '全部完成')
      expect(completeAllButton).toBeUndefined()
    })

    it('should emit multiple update-status events when complete all clicked', async () => {
      const order = createMockOrder({
        items: [
          { id: 1, name: 'Item 1', quantity: 1, status: 'pending' as ItemStatus },
          { id: 2, name: 'Item 2', quantity: 1, status: 'preparing' as ItemStatus }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      const completeAllButton = wrapper.findAll('button').find(btn => btn.text() === '全部完成')
      await completeAllButton?.trigger('click')

      expect(wrapper.emitted('update-status')).toBeTruthy()
      expect(wrapper.emitted('update-status')?.length).toBe(2)
    })
  })

  describe('Modal Backdrop', () => {
    it('should emit close when backdrop clicked', async () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder(),
          show: true
        }
      })

      const backdrop = wrapper.find('.fixed.inset-0')
      await backdrop.trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('should not close when modal content clicked', async () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder(),
          show: true
        }
      })

      const modalContent = wrapper.find('.bg-white.rounded-2xl')
      await modalContent.trigger('click')

      expect(wrapper.emitted('close')).toBeFalsy()
    })
  })

  describe('Time Formatting', () => {
    it('should format date time correctly', () => {
      const createdAt = '2025-11-15T14:30:00'
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder({ createdAt }),
          show: true
        }
      })

      expect(wrapper.text()).toContain('2025')
    })

    it('should highlight overdue time in red', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder({ elapsedTime: 20 }),
          show: true
        }
      })

      const timeElement = wrapper.find('.text-red-600')
      expect(timeElement.exists()).toBe(true)
    })

    it('should highlight warning time in orange', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder({ elapsedTime: 12 }),
          show: true
        }
      })

      const timeElement = wrapper.find('.text-orange-600')
      expect(timeElement.exists()).toBe(true)
    })

    it('should show normal time in gray', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder({ elapsedTime: 5 }),
          show: true
        }
      })

      const timeElement = wrapper.find('.text-gray-900')
      expect(timeElement.exists()).toBe(true)
    })
  })

  describe('Item Status Classes', () => {
    it('should apply correct class for pending status', () => {
      const order = createMockOrder({
        items: [
          { id: 1, name: 'Item', quantity: 1, status: 'pending' as ItemStatus }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.html()).toContain('status-pending')
    })

    it('should apply correct class for preparing status', () => {
      const order = createMockOrder({
        items: [
          { id: 1, name: 'Item', quantity: 1, status: 'preparing' as ItemStatus }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.html()).toContain('bg-blue-100')
    })

    it('should apply correct class for ready status', () => {
      const order = createMockOrder({
        items: [
          { id: 1, name: 'Item', quantity: 1, status: 'ready' as ItemStatus }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.html()).toContain('status-ready')
    })
  })

  describe('Item Status Text', () => {
    it('should show correct text for pending items', () => {
      const order = createMockOrder({
        items: [
          { id: 1, name: 'Item', quantity: 1, status: 'pending' as ItemStatus }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.text()).toContain('待處理')
    })

    it('should show correct text for preparing items', () => {
      const order = createMockOrder({
        items: [
          { id: 1, name: 'Item', quantity: 1, status: 'preparing' as ItemStatus }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.text()).toContain('製作中')
    })

    it('should show correct text for ready items', () => {
      const order = createMockOrder({
        items: [
          { id: 1, name: 'Item', quantity: 1, status: 'ready' as ItemStatus }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.text()).toContain('已完成')
    })

    it('should show correct text for completed items', () => {
      const order = createMockOrder({
        items: [
          { id: 1, name: 'Item', quantity: 1, status: 'completed' as ItemStatus }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.text()).toContain('已送達')
    })
  })

  describe('Edge Cases', () => {
    it('should handle order with no items', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder({ items: [] }),
          show: true
        }
      })

      expect(wrapper.exists()).toBe(true)
    })

    it('should handle very long item names', () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: '超級特別好吃的招牌宮保雞丁配上特製醬汁',
            quantity: 1,
            status: 'pending' as ItemStatus
          }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.text()).toContain('超級特別好吃')
    })

    it('should handle large quantities', () => {
      const order = createMockOrder({
        items: [
          { id: 1, name: 'Item', quantity: 999, status: 'pending' as ItemStatus }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.text()).toContain('x999')
    })

    it('should handle items with all optional fields', () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: 'Item',
            quantity: 1,
            status: 'preparing' as ItemStatus,
            notes: 'Special note',
            customizations: ['Extra spicy', 'No MSG'],
            estimatedTime: 20,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
          }
        ]
      })

      const wrapper = mount(OrderDetailsModal, {
        props: { order, show: true }
      })

      expect(wrapper.text()).toContain('Special note')
      expect(wrapper.text()).toContain('Extra spicy')
      expect(wrapper.text()).toContain('20分鐘')
    })
  })

  describe('Footer Actions', () => {
    it('should display last update time', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder(),
          show: true
        }
      })

      expect(wrapper.text()).toContain('最後更新')
    })

    it('should have close button in footer', () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder(),
          show: true
        }
      })

      const closeButton = wrapper.findAll('button').find(btn => btn.text() === '關閉')
      expect(closeButton).toBeDefined()
    })

    it('should emit close when footer close clicked', async () => {
      const wrapper = mount(OrderDetailsModal, {
        props: {
          order: createMockOrder(),
          show: true
        }
      })

      const closeButton = wrapper.findAll('button').find(btn => btn.text() === '關閉')
      await closeButton?.trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })
})
