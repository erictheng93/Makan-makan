/**
 * RevenueChart Component Tests
 * 測試營收圖表組件
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RevenueChart from '../RevenueChart.vue'

// Mock Chart.js
vi.mock('chart.js', () => ({
  Chart: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    update: vi.fn()
  })),
  CategoryScale: class {},
  LinearScale: class {},
  PointElement: class {},
  LineElement: class {},
  Title: class {},
  Tooltip: class {},
  Legend: class {},
  Filler: class {},
  register: vi.fn()
}))

// Mock icons
vi.mock('lucide-vue-next', () => ({
  BarChart3: { name: 'BarChart3', template: '<svg />' }
}))

describe('RevenueChart Component', () => {
  const mockData = [
    { label: '週一', value: 8500, date: '2025-11-11' },
    { label: '週二', value: 12000, date: '2025-11-12' },
    { label: '週三', value: 9800, date: '2025-11-13' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render with data', () => {
      const wrapper = mount(RevenueChart, {
        props: {
          data: mockData,
          period: 'weekly'
        }
      })

      expect(wrapper.exists()).toBe(true)
    })

    it('should show loading state', () => {
      const wrapper = mount(RevenueChart, {
        props: {
          data: [],
          loading: true,
          period: 'daily'
        }
      })

      expect(wrapper.find('.animate-pulse').exists()).toBe(true)
    })

    it('should show empty state when no data', () => {
      const wrapper = mount(RevenueChart, {
        props: {
          data: [],
          period: 'daily'
        }
      })

      expect(wrapper.text()).toContain('暫無營收數據')
    })

    it('should render canvas when data exists', () => {
      const wrapper = mount(RevenueChart, {
        props: {
          data: mockData,
          period: 'weekly'
        }
      })

      expect(wrapper.find('canvas').exists()).toBe(true)
    })
  })

  describe('Props Handling', () => {
    it('should accept daily period', () => {
      const wrapper = mount(RevenueChart, {
        props: {
          data: mockData,
          period: 'daily'
        }
      })

      expect(wrapper.props('period')).toBe('daily')
    })

    it('should accept weekly period', () => {
      const wrapper = mount(RevenueChart, {
        props: {
          data: mockData,
          period: 'weekly'
        }
      })

      expect(wrapper.props('period')).toBe('weekly')
    })

    it('should accept monthly period', () => {
      const wrapper = mount(RevenueChart, {
        props: {
          data: mockData,
          period: 'monthly'
        }
      })

      expect(wrapper.props('period')).toBe('monthly')
    })
  })

  describe('Loading State', () => {
    it('should not show canvas when loading', () => {
      const wrapper = mount(RevenueChart, {
        props: {
          data: mockData,
          loading: true,
          period: 'daily'
        }
      })

      expect(wrapper.find('canvas').exists()).toBe(false)
    })

    it('should show skeleton when loading', () => {
      const wrapper = mount(RevenueChart, {
        props: {
          data: [],
          loading: true,
          period: 'daily'
        }
      })

      const skeletonElements = wrapper.findAll('.bg-gray-300')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle single data point', () => {
      const singleData = [mockData[0]]

      const wrapper = mount(RevenueChart, {
        props: {
          data: singleData,
          period: 'daily'
        }
      })

      expect(wrapper.find('canvas').exists()).toBe(true)
    })

    it('should handle very large values', () => {
      const largeData = [
        { label: 'Day 1', value: 9999999, date: '2025-11-01' },
        { label: 'Day 2', value: 8888888, date: '2025-11-02' }
      ]

      const wrapper = mount(RevenueChart, {
        props: {
          data: largeData,
          period: 'daily'
        }
      })

      expect(wrapper.exists()).toBe(true)
    })

    it('should handle zero values', () => {
      const zeroData = [
        { label: 'Day 1', value: 0, date: '2025-11-01' },
        { label: 'Day 2', value: 0, date: '2025-11-02' }
      ]

      const wrapper = mount(RevenueChart, {
        props: {
          data: zeroData,
          period: 'daily'
        }
      })

      expect(wrapper.find('canvas').exists()).toBe(true)
    })

    it('should handle 30 days of data', () => {
      const monthData = Array.from({ length: 30 }, (_, i) => ({
        label: `Day ${i + 1}`,
        value: 5000 + Math.random() * 5000,
        date: `2025-11-${(i + 1).toString().padStart(2, '0')}`
      }))

      const wrapper = mount(RevenueChart, {
        props: {
          data: monthData,
          period: 'monthly'
        }
      })

      expect(wrapper.exists()).toBe(true)
    })
  })
})
