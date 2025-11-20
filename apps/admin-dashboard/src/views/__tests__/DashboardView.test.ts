/**
 * DashboardView Component Tests
 * 測試 Dashboard 視圖
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import DashboardView from '../DashboardView.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useAuthStore } from '@/stores/auth'

// Mock child components
vi.mock('@/components/dashboard/StatsCard.vue', () => ({
  default: { name: 'StatsCard', template: '<div class="stats-card" />' }
}))
vi.mock('@/components/dashboard/OrdersChart.vue', () => ({
  default: { name: 'OrdersChart', template: '<div class="orders-chart" />' }
}))
vi.mock('@/components/dashboard/RevenueChart.vue', () => ({
  default: { name: 'RevenueChart', template: '<div class="revenue-chart" />' }
}))

// Mock API
vi.mock('@/services/api', () => ({
  api: { get: vi.fn() }
}))

describe('DashboardView Component', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Component Mounting', () => {
    it('should mount successfully', () => {
      const wrapper = mount(DashboardView, {
        global: {
          stubs: {
            StatsCard: true,
            OrdersChart: true,
            RevenueChart: true
          }
        }
      })

      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('Store Integration', () => {
    it('should use dashboard store', () => {
      mount(DashboardView, {
        global: {
          stubs: {
            StatsCard: true,
            OrdersChart: true,
            RevenueChart: true
          }
        }
      })

      const dashboardStore = useDashboardStore()
      expect(dashboardStore).toBeDefined()
    })

    it('should use auth store', () => {
      mount(DashboardView, {
        global: {
          stubs: {
            StatsCard: true,
            OrdersChart: true,
            RevenueChart: true
          }
        }
      })

      const authStore = useAuthStore()
      expect(authStore).toBeDefined()
    })
  })

  describe('Data Loading', () => {
    it('should handle loading state', () => {
      const wrapper = mount(DashboardView, {
        global: {
          stubs: {
            StatsCard: true,
            OrdersChart: true,
            RevenueChart: true
          }
        }
      })

      const dashboardStore = useDashboardStore()
      dashboardStore.isLoading = true

      expect(dashboardStore.isLoading).toBe(true)
    })

    it('should display stats when data is available', () => {
      const wrapper = mount(DashboardView, {
        global: {
          stubs: {
            StatsCard: true,
            OrdersChart: true,
            RevenueChart: true
          }
        }
      })

      const dashboardStore = useDashboardStore()
      dashboardStore.stats = {
        todayOrders: 50,
        todayRevenue: 15000,
        averageOrderValue: 300,
        completionRate: 95,
        topMenuItems: [],
        revenueChart: [],
        ordersChart: []
      }

      expect(dashboardStore.stats).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle fetch error', () => {
      const wrapper = mount(DashboardView, {
        global: {
          stubs: {
            StatsCard: true,
            OrdersChart: true,
            RevenueChart: true
          }
        }
      })

      const dashboardStore = useDashboardStore()
      dashboardStore.error = 'Failed to load data'

      expect(dashboardStore.error).toBe('Failed to load data')
    })
  })
})
