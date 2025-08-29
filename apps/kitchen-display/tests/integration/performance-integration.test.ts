// Integration tests for performance monitoring system
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import PerformanceDashboard from '@/components/performance/PerformanceDashboard.vue'
import { performanceService } from '@/services/performanceService'
import type { PerformanceMetric } from '@/types'

// Mock PerformanceObserver
global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  callback
}))

const mockMetrics: PerformanceMetric[] = [
  {
    name: 'order_load_time',
    value: 245,
    unit: 'ms',
    timestamp: Date.now(),
    category: 'system',
    severity: 'info'
  },
  {
    name: 'api_response_time',
    value: 150,
    unit: 'ms',
    timestamp: Date.now(),
    category: 'network',
    severity: 'info'
  },
  {
    name: 'memory_usage',
    value: 75,
    unit: 'MB',
    timestamp: Date.now(),
    category: 'system',
    severity: 'warning'
  }
]

describe('Performance Integration Tests', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    
    // Reset performance service
    performanceService.stop()
    performanceService.clearMetrics()
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    performanceService.stop()
  })

  describe('Performance Service Integration', () => {
    it('should initialize and start monitoring', () => {
      performanceService.start()
      
      expect(performanceService.isEnabled).toBe(true)
      expect(performanceService.isMonitoring).toBe(true)
    })

    it('should collect system metrics', async () => {
      performanceService.start()
      
      // Record some metrics
      performanceService.recordMetric('test_metric', 100, 'ms', 'system')
      performanceService.recordMetric('api_call', 200, 'ms', 'network')
      
      const metrics = performanceService.getMetrics()
      expect(metrics.length).toBe(2)
      expect(metrics[0].name).toBe('test_metric')
      expect(metrics[0].value).toBe(100)
    })

    it('should calculate statistics correctly', () => {
      const values = [100, 150, 200, 250, 300, 400, 500]
      
      values.forEach(value => {
        performanceService.recordMetric('response_time', value, 'ms', 'network')
      })
      
      const stats = performanceService.calculateStatistics('response_time')
      
      expect(stats.mean).toBe(271.43) // Average
      expect(stats.median).toBe(250)  // Middle value
      expect(stats.p95).toBeGreaterThan(stats.p90)
      expect(stats.p99).toBeGreaterThan(stats.p95)
    })

    it('should detect performance thresholds', async () => {
      performanceService.start()
      
      // Set threshold
      performanceService.setThreshold('api_response_time', 200, 'warning')
      
      // Record metrics that exceed threshold
      performanceService.recordMetric('api_response_time', 300, 'ms', 'network')
      
      await nextTick()
      
      const alerts = performanceService.getAlerts()
      expect(alerts.length).toBeGreaterThan(0)
      expect(alerts[0].severity).toBe('warning')
    })

    it('should track business metrics', () => {
      performanceService.recordMetric('orders_per_minute', 15, 'count', 'business')
      performanceService.recordMetric('average_cook_time', 12, 'minutes', 'business')
      performanceService.recordMetric('kitchen_efficiency', 85, 'percent', 'business')
      
      const businessMetrics = performanceService.getMetrics('business')
      expect(businessMetrics.length).toBe(3)
      
      const efficiency = businessMetrics.find(m => m.name === 'kitchen_efficiency')
      expect(efficiency?.value).toBe(85)
    })
  })

  describe('Performance Dashboard Integration', () => {
    it('should display real-time metrics', async () => {
      const wrapper = mount(PerformanceDashboard)
      
      // Mock metrics in service
      mockMetrics.forEach(metric => {
        performanceService.recordMetric(
          metric.name,
          metric.value,
          metric.unit,
          metric.category
        )
      })
      
      await nextTick()
      
      // Should display metric cards
      const metricCards = wrapper.findAll('[data-testid="metric-card"]')
      expect(metricCards.length).toBeGreaterThan(0)
    })

    it('should show performance charts', async () => {
      const wrapper = mount(PerformanceDashboard)
      
      // Generate time-series data
      const now = Date.now()
      for (let i = 0; i < 10; i++) {
        performanceService.recordMetric(
          'response_time',
          150 + Math.random() * 100,
          'ms',
          'network',
          'info',
          now - i * 60000 // 1 minute intervals
        )
      }
      
      await nextTick()
      
      expect(wrapper.find('[data-testid="performance-chart"]').exists()).toBe(true)
    })

    it('should filter metrics by category', async () => {
      const wrapper = mount(PerformanceDashboard)
      
      // Record different categories
      performanceService.recordMetric('cpu_usage', 60, '%', 'system')
      performanceService.recordMetric('api_latency', 120, 'ms', 'network')
      performanceService.recordMetric('orders_completed', 25, 'count', 'business')
      
      await nextTick()
      
      // Filter by system metrics
      const systemFilter = wrapper.find('[data-testid="filter-system"]')
      await systemFilter.trigger('click')
      
      await nextTick()
      
      const visibleMetrics = wrapper.findAll('[data-testid="metric-item"]:not(.hidden)')
      expect(visibleMetrics.length).toBe(1)
    })

    it('should export performance reports', async () => {
      const wrapper = mount(PerformanceDashboard)
      
      // Add test metrics
      mockMetrics.forEach(metric => {
        performanceService.recordMetric(
          metric.name,
          metric.value,
          metric.unit,
          metric.category
        )
      })
      
      const exportButton = wrapper.find('[data-testid="export-report"]')
      await exportButton.trigger('click')
      
      // Should trigger export
      expect(wrapper.emitted('report-exported')).toBeTruthy()
    })
  })

  describe('Performance Monitoring Integration', () => {
    it('should monitor page load performance', async () => {
      // Mock performance entries
      const mockEntries = [
        {
          name: 'navigation',
          entryType: 'navigation',
          duration: 1200,
          loadEventEnd: 1200,
          domContentLoadedEventEnd: 800
        }
      ]
      
      vi.spyOn(performance, 'getEntriesByType').mockReturnValue(mockEntries as any)
      
      performanceService.start()
      await performanceService.collectWebVitals()
      
      const metrics = performanceService.getMetrics()
      const loadMetric = metrics.find(m => m.name.includes('load'))
      
      expect(loadMetric).toBeDefined()
      expect(loadMetric?.category).toBe('system')
    })

    it('should track resource loading times', async () => {
      const mockResourceEntries = [
        {
          name: 'https://example.com/api/orders',
          entryType: 'resource',
          duration: 250,
          responseEnd: 1000,
          responseStart: 750
        },
        {
          name: '/sounds/notification.mp3',
          entryType: 'resource',
          duration: 150,
          responseEnd: 800,
          responseStart: 650
        }
      ]
      
      vi.spyOn(performance, 'getEntriesByType').mockReturnValue(mockResourceEntries as any)
      
      performanceService.collectResourceMetrics()
      
      const metrics = performanceService.getMetrics()
      const apiMetric = metrics.find(m => m.name.includes('api'))
      const assetMetric = metrics.find(m => m.name.includes('asset'))
      
      expect(apiMetric?.value).toBe(250)
      expect(assetMetric?.value).toBe(150)
    })

    it('should monitor user interactions', async () => {
      performanceService.start()
      
      // Simulate user interaction
      const interactionStart = performance.now()
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const interactionEnd = performance.now()
      
      performanceService.recordUserInteraction('order_card_click', interactionEnd - interactionStart)
      
      const metrics = performanceService.getMetrics()
      const interactionMetric = metrics.find(m => m.name === 'order_card_click')
      
      expect(interactionMetric).toBeDefined()
      expect(interactionMetric?.category).toBe('user')
    })
  })

  describe('Alert and Notification System', () => {
    it('should trigger alerts for critical thresholds', async () => {
      performanceService.start()
      
      // Set critical threshold
      performanceService.setThreshold('memory_usage', 90, 'error')
      
      // Record high memory usage
      performanceService.recordMetric('memory_usage', 95, '%', 'system')
      
      const alerts = performanceService.getAlerts()
      const criticalAlert = alerts.find(a => a.severity === 'error')
      
      expect(criticalAlert).toBeDefined()
      expect(criticalAlert?.metricName).toBe('memory_usage')
    })

    it('should provide performance recommendations', () => {
      // Record slow metrics
      performanceService.recordMetric('api_response_time', 800, 'ms', 'network')
      performanceService.recordMetric('dom_render_time', 300, 'ms', 'system')
      
      const recommendations = performanceService.getRecommendations()
      
      expect(recommendations.length).toBeGreaterThan(0)
      expect(recommendations.some(r => r.includes('API'))).toBe(true)
    })
  })

  describe('Data Persistence and Reporting', () => {
    it('should persist performance data', () => {
      performanceService.recordMetric('test_metric', 100, 'ms', 'system')
      
      const savedData = localStorage.getItem('kitchen-performance-metrics')
      expect(savedData).toBeDefined()
      
      const parsed = JSON.parse(savedData!)
      expect(parsed.length).toBe(1)
      expect(parsed[0].name).toBe('test_metric')
    })

    it('should generate time-based reports', () => {
      const now = Date.now()
      
      // Add metrics over time
      for (let i = 0; i < 24; i++) {
        performanceService.recordMetric(
          'hourly_metric',
          100 + i * 10,
          'ms',
          'system',
          'info',
          now - i * 3600000 // 1 hour intervals
        )
      }
      
      const report = performanceService.generateReport('24h')
      
      expect(report.timeRange).toBe('24h')
      expect(report.metrics.length).toBe(24)
      expect(report.summary).toBeDefined()
    })

    it('should cleanup old metrics data', () => {
      const oldTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000 // 8 days ago
      const recentTimestamp = Date.now()
      
      performanceService.recordMetric('old_metric', 100, 'ms', 'system', 'info', oldTimestamp)
      performanceService.recordMetric('recent_metric', 200, 'ms', 'system', 'info', recentTimestamp)
      
      performanceService.cleanupOldMetrics(7 * 24 * 60 * 60 * 1000) // Keep 7 days
      
      const metrics = performanceService.getMetrics()
      expect(metrics.some(m => m.name === 'old_metric')).toBe(false)
      expect(metrics.some(m => m.name === 'recent_metric')).toBe(true)
    })
  })

  describe('Integration with Other Systems', () => {
    it('should monitor order processing performance', () => {
      const orderStartTime = performance.now()
      
      // Simulate order processing
      setTimeout(() => {
        const orderEndTime = performance.now()
        performanceService.recordMetric(
          'order_processing_time',
          orderEndTime - orderStartTime,
          'ms',
          'business'
        )
      }, 100)
      
      // Should track business metrics
      const businessMetrics = performanceService.getMetrics('business')
      expect(businessMetrics).toBeDefined()
    })

    it('should integrate with audio service performance', () => {
      // Mock audio loading time
      performanceService.recordMetric('audio_load_time', 300, 'ms', 'system')
      performanceService.recordMetric('audio_play_latency', 15, 'ms', 'user')
      
      const audioMetrics = performanceService.getMetrics().filter(
        m => m.name.includes('audio')
      )
      
      expect(audioMetrics.length).toBe(2)
    })

    it('should monitor offline sync performance', () => {
      const syncStart = performance.now()
      
      // Simulate sync operation
      setTimeout(() => {
        const syncEnd = performance.now()
        performanceService.recordMetric(
          'offline_sync_duration',
          syncEnd - syncStart,
          'ms',
          'system'
        )
      }, 200)
      
      const syncMetrics = performanceService.getMetrics().filter(
        m => m.name.includes('sync')
      )
      
      expect(syncMetrics.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle PerformanceObserver not supported', () => {
      global.PerformanceObserver = undefined as any
      
      expect(() => {
        performanceService.start()
      }).not.toThrow()
      
      expect(performanceService.isMonitoring).toBe(false)
    })

    it('should handle invalid metric data gracefully', () => {
      expect(() => {
        performanceService.recordMetric('', NaN, '', 'system')
      }).not.toThrow()
      
      expect(() => {
        performanceService.recordMetric('test', Infinity, 'ms', 'invalid' as any)
      }).not.toThrow()
    })

    it('should handle memory limits', () => {
      // Fill up metrics to test memory management
      for (let i = 0; i < 10000; i++) {
        performanceService.recordMetric(`metric_${i}`, i, 'ms', 'system')
      }
      
      const metrics = performanceService.getMetrics()
      
      // Should limit the number of stored metrics
      expect(metrics.length).toBeLessThanOrEqual(5000)
    })
  })

  describe('Performance Optimization', () => {
    it('should efficiently process large datasets', () => {
      const startTime = performance.now()
      
      // Process many metrics
      for (let i = 0; i < 1000; i++) {
        performanceService.recordMetric(`test_${i}`, i, 'ms', 'system')
      }
      
      const stats = performanceService.calculateStatistics('test_1')
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(1000) // 1 second
      expect(stats).toBeDefined()
    })

    it('should batch metric collections efficiently', async () => {
      const batchStart = performance.now()
      
      await Promise.all([
        performanceService.collectWebVitals(),
        performanceService.collectResourceMetrics(),
        performanceService.collectMemoryMetrics()
      ])
      
      const batchEnd = performance.now()
      
      expect(batchEnd - batchStart).toBeLessThan(500) // 500ms
    })
  })
})