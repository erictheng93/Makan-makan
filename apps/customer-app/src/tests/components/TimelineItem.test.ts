import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import TimelineItem from '@/components/TimelineItem.vue'

// Mock the formatDateTime function
vi.mock('@/utils/format', () => ({
  formatDateTime: vi.fn((date: string | Date, format: string) => {
    if (format === 'HH:mm') {
      return '10:30'
    }
    return '2024-01-15 10:30'
  })
}))

describe('TimelineItem.vue', () => {
  let wrapper: VueWrapper<any>

  const mockData = {
    title: '訂單已確認',
    description: '餐廳已確認您的訂單，正在準備中',
    status: 'completed' as const,
    timestamp: '2024-01-15T10:30:00Z',
    estimatedTime: '15-20 分鐘'
  }

  beforeEach(() => {
    wrapper = mount(TimelineItem, {
      props: {
        title: mockData.title,
        description: mockData.description,
        status: mockData.status,
        timestamp: mockData.timestamp,
        isLast: false
      }
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('基本渲染', () => {
    it('應該正確渲染標題', () => {
      expect(wrapper.text()).toContain('訂單已確認')
    })

    it('應該正確渲染描述', () => {
      expect(wrapper.text()).toContain('餐廳已確認您的訂單，正在準備中')
    })

    it('應該正確渲染時間戳記', () => {
      expect(wrapper.text()).toContain('10:30')
    })

    it('應該顯示狀態圖標', () => {
      const svg = wrapper.find('svg')
      expect(svg.exists()).toBe(true)
    })
  })

  describe('狀態樣式', () => {
    it('已完成狀態應該顯示綠色樣式', () => {
      const dot = wrapper.find('.w-8.h-8.rounded-full')
      expect(dot.classes()).toContain('bg-green-500')
      expect(dot.classes()).toContain('border-green-500')
    })

    it('進行中狀態應該顯示藍色樣式', async () => {
      await wrapper.setProps({ status: 'current' })
      
      const dot = wrapper.find('.w-8.h-8.rounded-full')
      expect(dot.classes()).toContain('bg-blue-500')
      expect(dot.classes()).toContain('border-blue-500')
    })

    it('等待中狀態應該顯示灰色樣式', async () => {
      await wrapper.setProps({ status: 'pending' })
      
      const dot = wrapper.find('.w-8.h-8.rounded-full')
      expect(dot.classes()).toContain('bg-white')
      expect(dot.classes()).toContain('border-gray-300')
    })
  })

  describe('時間線連接線', () => {
    it('非最後一個項目應該顯示連接線', () => {
      const connector = wrapper.find('.absolute.top-8')
      expect(connector.exists()).toBe(true)
    })

    it('最後一個項目不應該顯示連接線', async () => {
      await wrapper.setProps({ isLast: true })
      
      const connector = wrapper.find('.absolute.top-8')
      expect(connector.exists()).toBe(false)
    })

    it('已完成狀態的連接線應該是綠色', () => {
      const connector = wrapper.find('.absolute.top-8')
      expect(connector.classes()).toContain('bg-green-500')
    })

    it('未完成狀態的連接線應該是灰色', async () => {
      await wrapper.setProps({ status: 'pending' })
      
      const connector = wrapper.find('.absolute.top-8')
      expect(connector.classes()).toContain('bg-gray-300')
    })
  })

  describe('狀態圖標', () => {
    it('已完成狀態應該顯示勾選圖標', () => {
      const checkIcon = wrapper.find('.w-4.h-4.text-white svg')
      expect(checkIcon.exists()).toBe(true)
    })

    it('進行中狀態應該顯示脈動圓點', async () => {
      await wrapper.setProps({ status: 'current' })
      
      const pulsingDot = wrapper.find('.animate-pulse')
      expect(pulsingDot.exists()).toBe(true)
    })

    it('等待中狀態應該顯示灰色圓點', async () => {
      await wrapper.setProps({ status: 'pending' })
      
      const grayDot = wrapper.find('.bg-gray-300.rounded-full')
      expect(grayDot.exists()).toBe(true)
    })
  })

  describe('時間顯示', () => {
    it('應該格式化並顯示時間', () => {
      expect(wrapper.text()).toContain('10:30')
    })

    it('沒有時間戳記時不應該顯示時間', async () => {
      await wrapper.setProps({ timestamp: null })
      
      expect(wrapper.text()).not.toContain('10:30')
    })

    it('應該有時間圖標', () => {
      const timeIcon = wrapper.find('.w-3.h-3[stroke="currentColor"]')
      expect(timeIcon.exists()).toBe(true)
    })
  })

  describe('預估時間', () => {
    it('進行中狀態且有預估時間時應該顯示預估時間', async () => {
      await wrapper.setProps({
        status: 'current',
        estimatedTime: '15-20 分鐘'
      })
      
      expect(wrapper.text()).toContain('預估 15-20 分鐘')
    })

    it('非進行中狀態不應該顯示預估時間', async () => {
      await wrapper.setProps({
        status: 'completed',
        estimatedTime: '15-20 分鐘'
      })
      
      expect(wrapper.text()).not.toContain('預估 15-20 分鐘')
    })

    it('沒有預估時間時不應該顯示', () => {
      expect(wrapper.text()).not.toContain('預估')
    })
  })

  describe('插槽內容', () => {
    it('應該支援預設插槽', async () => {
      const wrapperWithSlot = mount(TimelineItem, {
        props: {
          title: mockData.title,
          status: mockData.status
        },
        slots: {
          default: '<div class="test-slot">額外內容</div>'
        }
      })
      
      expect(wrapperWithSlot.html()).toContain('test-slot')
      expect(wrapperWithSlot.text()).toContain('額外內容')
      
      wrapperWithSlot.unmount()
    })
  })

  describe('響應式設計', () => {
    it('應該有適當的佈局類', () => {
      const container = wrapper.find('.relative.flex.items-start')
      expect(container.exists()).toBe(true)
    })

    it('應該有適當的間距', () => {
      const container = wrapper.find('.space-x-3')
      expect(container.exists()).toBe(true)
    })
  })

  describe('邊界情況', () => {
    it('應該處理空的描述', async () => {
      await wrapper.setProps({ description: '' })
      
      const descriptionElement = wrapper.find('p')
      expect(descriptionElement.exists()).toBe(false)
    })

    it('應該處理無效的狀態值', async () => {
      await wrapper.setProps({ status: 'invalid' as any })
      
      // 應該使用預設樣式
      const dot = wrapper.find('.w-8.h-8.rounded-full')
      expect(dot.classes()).toContain('bg-white')
      expect(dot.classes()).toContain('border-gray-300')
    })

    it('應該處理空的時間戳記', async () => {
      await wrapper.setProps({ timestamp: '' })
      
      const timeSection = wrapper.find('.text-sm.text-gray-500')
      expect(timeSection.exists()).toBe(false)
    })
  })

  describe('CSS 類別檢查', () => {
    it('標題應該有正確的樣式類別', () => {
      const title = wrapper.find('h4')
      expect(title.classes()).toContain('text-sm')
      expect(title.classes()).toContain('font-medium')
      expect(title.classes()).toContain('text-green-900')
    })

    it('描述應該有正確的樣式類別', () => {
      const description = wrapper.find('p')
      expect(description.classes()).toContain('text-sm')
      expect(description.classes()).toContain('text-green-700')
    })
  })
})