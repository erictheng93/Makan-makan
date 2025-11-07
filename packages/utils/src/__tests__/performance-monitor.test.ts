/**
 * Performance Monitor Unit Tests
 * Comprehensive test coverage for performance monitoring system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  PerformanceMonitor,
  getPerformanceMonitor,
  resetPerformanceMonitor,
  type PerformanceMetric,
  type PerformanceMonitorOptions
} from '../performance-monitor'

// Mock browser APIs with stable time values
let mockTime = 0
const createMockPerformance = () => ({
  now: vi.fn(() => mockTime),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn(() => []),
  getEntriesByType: vi.fn(() => []),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn()
  // Don't include timing to avoid automatic TTFB tracking in tests
})

const mockWindow = {
  addEventListener: vi.fn(),
  location: {
    href: 'https://test.example.com'
  },
  navigator: {
    userAgent: 'Test User Agent'
  },
  PerformanceObserver: class MockPerformanceObserver {
    callback: any

    constructor(callback: any) {
      this.callback = callback
    }

    observe() {}
    disconnect() {}
  }
}

// Setup global mocks before tests
vi.stubGlobal('window', mockWindow)
vi.stubGlobal('PerformanceObserver', mockWindow.PerformanceObserver)

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor
  let mockPerformance: ReturnType<typeof createMockPerformance>

  beforeEach(() => {
    // Reset time counter
    mockTime = 0
    // Create fresh mock performance object
    mockPerformance = createMockPerformance()
    vi.stubGlobal('performance', mockPerformance)
  })

  afterEach(() => {
    if (monitor) {
      try {
        monitor.clear()
        monitor.disconnect()
      } catch (e) {
        // Ignore cleanup errors in tests
      }
    }
    vi.clearAllMocks()
  })

  describe('Metric Tracking', () => {
    it('should track custom metric', () => {
      // Arrange
      monitor = new PerformanceMonitor({ enabled: true })
      const metric = {
        name: 'api_call',
        value: 150,
        unit: 'ms' as const
      }

      // Act
      monitor.trackMetric(metric)
      const metrics = monitor.getMetrics()

      // Assert
      expect(metrics).toHaveLength(1)
      expect(metrics[0].name).toBe('api_call')
      expect(metrics[0].value).toBe(150)
      expect(metrics[0].unit).toBe('ms')
      expect(metrics[0].timestamp).toBeGreaterThan(0)
    })

    it('should track metric with tags', () => {
      // Arrange
      monitor = new PerformanceMonitor({ enabled: true })

      // Act
      monitor.trackMetric({
        name: 'database_query',
        value: 50,
        unit: 'ms',
        tags: {
          operation: 'SELECT',
          table: 'users'
        }
      })

      const metrics = monitor.getMetrics()

      // Assert
      expect(metrics[0].tags?.operation).toBe('SELECT')
      expect(metrics[0].tags?.table).toBe('users')
    })

    it('should not track metrics when disabled', () => {
      // Arrange
      monitor = new PerformanceMonitor({ enabled: false })

      // Act
      monitor.trackMetric({
        name: 'test',
        value: 100,
        unit: 'ms'
      })

      // Assert
      expect(monitor.getMetrics()).toHaveLength(0)
    })

    it('should track multiple metrics', () => {
      // Arrange
      monitor = new PerformanceMonitor({ enabled: true })

      // Act
      monitor.trackMetric({ name: 'metric1', value: 10, unit: 'ms' })
      monitor.trackMetric({ name: 'metric2', value: 20, unit: 'bytes' })
      monitor.trackMetric({ name: 'metric3', value: 30, unit: 'count' })

      const metrics = monitor.getMetrics()

      // Assert
      expect(metrics).toHaveLength(3)
      expect(metrics[0].name).toBe('metric1')
      expect(metrics[1].name).toBe('metric2')
      expect(metrics[2].name).toBe('metric3')
    })
  })

  describe('Function Measurement', () => {
    beforeEach(() => {
      // Mock performance.now() with incrementing time
      let time = 0
      mockPerformance.now.mockImplementation(() => {
        time += 50 // Each call advances by 50ms
        return time
      })
    })

    it('should measure synchronous function execution', async () => {
      // Arrange
      monitor = new PerformanceMonitor({ enabled: true })
      const syncFn = vi.fn(() => 'result')

      // Act
      const result = await monitor.measure('sync_fn', syncFn)

      // Assert
      expect(result).toBe('result')
      expect(syncFn).toHaveBeenCalled()

      const metrics = monitor.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0].name).toBe('sync_fn')
      expect(metrics[0].value).toBe(50) // Duration
    })

    it('should measure async function execution', async () => {
      // Arrange
      monitor = new PerformanceMonitor({ enabled: true })
      const asyncFn = vi.fn(async () => {
        return 'async result'
      })

      // Act
      const result = await monitor.measure('async_fn', asyncFn)

      // Assert
      expect(result).toBe('async result')
      const metrics = monitor.getMetrics()
      expect(metrics[0].name).toBe('async_fn')
    })

    it('should track error metrics when function throws', async () => {
      // Arrange
      monitor = new PerformanceMonitor({ enabled: true })
      const errorFn = vi.fn(async () => {
        throw new Error('Test error')
      })

      // Act & Assert
      await expect(monitor.measure('error_fn', errorFn)).rejects.toThrow('Test error')

      const metrics = monitor.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0].name).toBe('error_fn_error')
      expect(metrics[0].value).toBe(50)
    })

    it('should measure with tags', async () => {
      // Arrange
      monitor = new PerformanceMonitor({ enabled: true })
      const fn = vi.fn(() => 'result')

      // Act
      await monitor.measure('tagged_fn', fn, {
        endpoint: '/api/users',
        method: 'GET'
      })

      // Assert
      const metrics = monitor.getMetrics()
      expect(metrics[0].tags?.endpoint).toBe('/api/users')
      expect(metrics[0].tags?.method).toBe('GET')
    })
  })

  describe('Performance Marks and Measures', () => {

    it('should create performance mark', () => {
      // Arrange
      monitor = new PerformanceMonitor({ enabled: true })

      // Act
      monitor.mark('start_operation')

      // Assert
      expect(mockPerformance.mark).toHaveBeenCalledWith('start_operation')
    })

    it('should measure between marks', () => {
      // Arrange
      monitor = new PerformanceMonitor({ enabled: true })
      mockPerformance.getEntriesByName.mockReturnValue([
        { name: 'operation', duration: 100 }
      ])

      // Act
      monitor.measureBetween('operation', 'start_mark', 'end_mark')

      // Assert
      expect(mockPerformance.measure).toHaveBeenCalledWith('operation', 'start_mark', 'end_mark')

      const metrics = monitor.getMetrics()
      expect(metrics[0].name).toBe('operation')
      expect(metrics[0].value).toBe(100)
    })

    it('should handle measure errors gracefully', () => {
      // Arrange
      monitor = new PerformanceMonitor({ enabled: true })
      mockPerformance.measure.mockImplementation(() => {
        throw new Error('Mark not found')
      })

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Act
      monitor.measureBetween('operation', 'invalid_start', 'invalid_end')

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(monitor.getMetrics()).toHaveLength(0)

      consoleWarnSpy.mockRestore()
    })

    it('should not create marks when disabled', () => {
      // Arrange
      monitor = new PerformanceMonitor({ enabled: false })

      // Act
      monitor.mark('test_mark')

      // Assert
      expect(mockPerformance.mark).not.toHaveBeenCalled()
    })
  })

  describe('Web Vitals', () => {
    it('should return empty web vitals initially', () => {
      // Arrange
      monitor = new PerformanceMonitor({ enabled: false })

      // Act
      const vitals = monitor.getWebVitals()

      // Assert
      expect(vitals).toEqual({})
    })

    it('should return copy of web vitals', () => {
      // Arrange
      monitor = new PerformanceMonitor({ enabled: false })

      // Act
      const vitals1 = monitor.getWebVitals()
      const vitals2 = monitor.getWebVitals()

      // Assert
      expect(vitals1).not.toBe(vitals2) // Different objects
      expect(vitals1).toEqual(vitals2) // Same content
    })
  })

  describe('Clear and Reset', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({ enabled: true })
    })

    it('should clear all metrics', () => {
      // Arrange
      monitor.trackMetric({ name: 'test1', value: 10, unit: 'ms' })
      monitor.trackMetric({ name: 'test2', value: 20, unit: 'ms' })

      // Act
      monitor.clear()

      // Assert
      expect(monitor.getMetrics()).toHaveLength(0)
      expect(monitor.getWebVitals()).toEqual({})
      expect(mockPerformance.clearMarks).toHaveBeenCalled()
      expect(mockPerformance.clearMeasures).toHaveBeenCalled()
    })
  })

  describe('Report Generation', () => {
    beforeEach(() => {
      mockPerformance.getEntriesByType.mockReturnValue([])
    })

    it('should generate performance report', () => {
      // Arrange
      monitor = new PerformanceMonitor({ enabled: true })
      monitor.trackMetric({ name: 'test', value: 100, unit: 'ms' })

      // Act
      const report = monitor.generateReport()

      // Assert
      expect(report.customMetrics).toHaveLength(1)
      expect(report.timestamp).toBeGreaterThan(0)
      expect(report.url).toBe('https://test.example.com')
      expect(report.userAgent).toBeDefined() // Node.js environment has different userAgent
      expect(report.userAgent).toBeTruthy()
    })

    it('should include web vitals in report', () => {
      // Arrange
      monitor = new PerformanceMonitor({ enabled: false })

      // Act
      const report = monitor.generateReport()

      // Assert
      expect(report).toHaveProperty('webVitals')
      expect(report).toHaveProperty('resources')
      expect(report).toHaveProperty('customMetrics')
    })

    it('should call onReport callback when sending report', async () => {
      // Arrange
      const onReport = vi.fn()
      monitor = new PerformanceMonitor({
        enabled: false,
        onReport
      })

      // Act
      await monitor.sendReport()

      // Assert
      expect(onReport).toHaveBeenCalled()
      expect(onReport.mock.calls[0][0]).toHaveProperty('timestamp')
    })

    it('should respect sample rate when sending report', async () => {
      // Arrange
      const onReport = vi.fn()
      monitor = new PerformanceMonitor({
        enabled: false,
        sampleRate: 0, // Never sample
        onReport
      })

      // Act
      await monitor.sendReport()

      // Assert
      expect(onReport).not.toHaveBeenCalled()
    })

    it('should handle report callback errors', async () => {
      // Arrange
      const onReport = vi.fn().mockRejectedValue(new Error('Report failed'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      monitor = new PerformanceMonitor({
        enabled: false,
        onReport
      })

      // Act
      await monitor.sendReport()

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Resource Timing', () => {

    it('should get resource timings', () => {
      // Arrange
      mockPerformance.getEntriesByType.mockReturnValue([
        {
          name: 'https://example.com/script.js',
          duration: 100,
          transferSize: 50000,
          initiatorType: 'script'
        },
        {
          name: 'https://example.com/style.css',
          duration: 50,
          transferSize: 20000,
          initiatorType: 'link'
        }
      ])

      monitor = new PerformanceMonitor({
        enabled: false,
        trackResources: true
      })

      // Act
      const resources = monitor.getResourceTimings()

      // Assert
      expect(resources).toHaveLength(2)
      expect(resources[0].type).toBe('script')
      expect(resources[0].duration).toBe(100)
      expect(resources[0].size).toBe(50000)
      expect(resources[1].type).toBe('stylesheet')
    })

    it('should return empty array when resource tracking disabled', () => {
      // Arrange
      monitor = new PerformanceMonitor({
        enabled: false,
        trackResources: false
      })

      // Act
      const resources = monitor.getResourceTimings()

      // Assert
      expect(resources).toEqual([])
    })

    it('should categorize resources correctly', () => {
      // Arrange
      mockPerformance.getEntriesByType.mockReturnValue([
        { name: 'script.js', initiatorType: 'script', duration: 10, transferSize: 1000 },
        { name: 'style.css', initiatorType: 'link', duration: 10, transferSize: 1000 },
        { name: 'image.png', initiatorType: 'img', duration: 10, transferSize: 1000 },
        { name: 'api/data', initiatorType: 'fetch', duration: 10, transferSize: 1000 },
        { name: 'api/xml', initiatorType: 'xmlhttprequest', duration: 10, transferSize: 1000 },
        { name: 'font.woff', initiatorType: 'other', duration: 10, transferSize: 1000 }
      ])

      monitor = new PerformanceMonitor({
        enabled: false,
        trackResources: true
      })

      // Act
      const resources = monitor.getResourceTimings()

      // Assert
      expect(resources[0].type).toBe('script')
      expect(resources[1].type).toBe('stylesheet')
      expect(resources[2].type).toBe('image')
      expect(resources[3].type).toBe('fetch')
      expect(resources[4].type).toBe('xmlhttprequest')
      expect(resources[5].type).toBe('other')
    })
  })

  describe('Debug Mode', () => {
    let consoleLogSpy: any

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleLogSpy.mockRestore()
    })

    it('should log metrics in debug mode', () => {
      // Arrange
      monitor = new PerformanceMonitor({
        enabled: true,
        debug: true
      })

      // Act
      monitor.trackMetric({
        name: 'test_metric',
        value: 100,
        unit: 'ms'
      })

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[PerformanceMonitor] Metric:',
        expect.objectContaining({
          name: 'test_metric',
          value: 100
        })
      )
    })

    it('should not log when debug is disabled', () => {
      // Arrange
      monitor = new PerformanceMonitor({
        enabled: true,
        debug: false
      })

      // Act
      monitor.trackMetric({
        name: 'test_metric',
        value: 100,
        unit: 'ms'
      })

      // Assert
      expect(consoleLogSpy).not.toHaveBeenCalled()
    })
  })

  describe('Options', () => {
    it('should respect enabled option', () => {
      // Arrange & Act
      const enabledMonitor = new PerformanceMonitor({ enabled: true })
      const disabledMonitor = new PerformanceMonitor({ enabled: false })

      enabledMonitor.trackMetric({ name: 'test', value: 1, unit: 'count' })
      disabledMonitor.trackMetric({ name: 'test', value: 1, unit: 'count' })

      // Assert
      expect(enabledMonitor.getMetrics()).toHaveLength(1)
      expect(disabledMonitor.getMetrics()).toHaveLength(0)

      enabledMonitor.clear()
      disabledMonitor.clear()
    })

    it('should apply default options', () => {
      // Act
      const monitor = new PerformanceMonitor()

      // Assert - Just verify it doesn't throw
      expect(monitor).toBeDefined()

      monitor.clear()
    })
  })
})

describe('Global Performance Monitor', () => {
  beforeEach(() => {
    resetPerformanceMonitor()
  })

  afterEach(() => {
    resetPerformanceMonitor()
  })

  it('should return same instance on multiple calls', () => {
    // Act
    const instance1 = getPerformanceMonitor({ enabled: false })
    const instance2 = getPerformanceMonitor()

    // Assert
    expect(instance1).toBe(instance2)
  })

  it('should create new instance after reset', () => {
    // Arrange
    const instance1 = getPerformanceMonitor({ enabled: false })

    // Act
    resetPerformanceMonitor()
    const instance2 = getPerformanceMonitor({ enabled: false })

    // Assert
    expect(instance1).not.toBe(instance2)
  })

  it('should disconnect observer on reset', () => {
    // Arrange
    const instance = getPerformanceMonitor({ enabled: false })
    const disconnectSpy = vi.spyOn(instance, 'disconnect')

    // Act
    resetPerformanceMonitor()

    // Assert
    expect(disconnectSpy).toHaveBeenCalled()
  })
})
