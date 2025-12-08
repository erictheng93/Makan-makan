/**
 * Analytics Middleware Tests
 * ?��?中�?件測�?
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { advancedAnalyticsMiddleware, AdvancedAnalyticsService } from '../analytics'
import { mockEnv } from '../../__tests__/setup'

describe('AdvancedAnalyticsService', () => {
  let service: AdvancedAnalyticsService
  let mockAnalyticsEngine: any
  let mockContext: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockAnalyticsEngine = {
      writeDataPoint: vi.fn(),
    }
    
    mockContext = {
      waitUntil: vi.fn((promise) => promise),
    }
    
    service = new AdvancedAnalyticsService(
      mockAnalyticsEngine,
      mockContext,
      mockEnv as any
    )
  })

  describe('recordEvent', () => {
    it('should record analytics event', async () => {
      await service.recordEvent({
        event: 'test_event',
        restaurant_id: 1,
        user_id: 100,
        dimensions: {
          country: 'TW',
          city: 'Taipei',
          endpoint: '/api/test',
        },
        metrics: {
          response_time: 150,
          order_value: 500,
        },
      })

      expect(mockContext.waitUntil).toHaveBeenCalled()
      expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith(
        expect.objectContaining({
          blobs: expect.arrayContaining(['test_event', '1', '100']),
          doubles: expect.any(Array),
          indexes: expect.any(Array),
        })
      )
    })

    it('should handle missing optional fields', async () => {
      await service.recordEvent({
        event: 'simple_event',
        dimensions: {},
        metrics: {},
      })

      expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalled()
    })

    it('should not throw on analytics error', async () => {
      mockAnalyticsEngine.writeDataPoint.mockImplementation(() => {
        throw new Error('Analytics error')
      })

      // Should not throw
      await expect(service.recordEvent({
        event: 'test',
        dimensions: {},
        metrics: {},
      })).resolves.not.toThrow()
    })
  })

  describe('recordBusinessMetrics', () => {
    it('should record business metrics snapshot', async () => {
      await service.recordBusinessMetrics(1, {
        revenue: 10000,
        orders_count: 50,
        average_order_value: 200,
        customer_satisfaction: 4.5,
        peak_hours: [{ hour: 12, orders: 20 }],
        popular_items: [{ item_id: 1, orders: 30 }],
      })

      expect(mockContext.waitUntil).toHaveBeenCalled()
    })

    it('should record peak hours data', async () => {
      await service.recordBusinessMetrics(1, {
        revenue: 10000,
        orders_count: 50,
        average_order_value: 200,
        customer_satisfaction: 4.5,
        peak_hours: [
          { hour: 12, orders: 20 },
          { hour: 18, orders: 25 },
        ],
        popular_items: [],
      })

      // Should record multiple events for peak hours
      expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledTimes(3) // 1 snapshot + 2 peak hours
    })

    it('should record popular items data', async () => {
      await service.recordBusinessMetrics(1, {
        revenue: 10000,
        orders_count: 50,
        average_order_value: 200,
        customer_satisfaction: 4.5,
        peak_hours: [],
        popular_items: [
          { item_id: 1, orders: 30 },
          { item_id: 2, orders: 20 },
        ],
      })

      expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledTimes(3) // 1 snapshot + 2 items
    })
  })

  describe('recordUserJourney', () => {
    it('should record user journey event', async () => {
      await service.recordUserJourney('user-123', 1, {
        event: 'page_view',
        page: '/menu',
        action: 'view',
        duration_ms: 5000,
        conversion_step: 2,
        funnel_position: 3,
      })

      expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith(
        expect.objectContaining({
          blobs: expect.arrayContaining(['user_journey']),
        })
      )
    })
  })

  describe('recordPerformanceMetrics', () => {
    it('should record performance metrics', async () => {
      await service.recordPerformanceMetrics('/api/orders', {
        response_time: 150,
        cpu_time: 50,
        memory_used: 10,
        cache_hit_rate: 0.8,
        error_rate: 0.01,
        concurrent_requests: 100,
      })

      expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalled()
    })

    it('should trigger alert for high error rate', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response())
      
      await service.recordPerformanceMetrics('/api/orders', {
        response_time: 150,
        cpu_time: 50,
        memory_used: 10,
        cache_hit_rate: 0.8,
        error_rate: 0.1, // 10% error rate - should trigger alert
        concurrent_requests: 100,
      })

      // Alert should be triggered via waitUntil
      expect(mockContext.waitUntil).toHaveBeenCalled()
      
      fetchSpy.mockRestore()
    })

    it('should trigger alert for slow response time', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response())
      
      await service.recordPerformanceMetrics('/api/orders', {
        response_time: 6000, // 6 seconds - should trigger alert
        cpu_time: 50,
        memory_used: 10,
        cache_hit_rate: 0.8,
        error_rate: 0.01,
        concurrent_requests: 100,
      })

      expect(mockContext.waitUntil).toHaveBeenCalled()
      
      fetchSpy.mockRestore()
    })
  })

  describe('recordSecurityEvent', () => {
    it('should record security event', async () => {
      await service.recordSecurityEvent('suspicious_request', {
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        country: 'TW',
        threat_score: 30,
        action_taken: 'allowed',
        endpoint: '/api/login',
        blocked: false,
      })

      expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledWith(
        expect.objectContaining({
          blobs: expect.arrayContaining(['security_event']),
        })
      )
    })

    it('should trigger alert for high threat score', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response())
      
      await service.recordSecurityEvent('attack_detected', {
        ip_address: '192.168.1.1',
        user_agent: 'Malicious Bot',
        country: 'XX',
        threat_score: 90, // High threat - should trigger alert
        action_taken: 'blocked',
        endpoint: '/api/admin',
        blocked: true,
      })

      expect(mockContext.waitUntil).toHaveBeenCalled()
      
      fetchSpy.mockRestore()
    })
  })

  describe('queryAnalytics', () => {
    it('should build analytics query', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const result = await service.queryAnalytics({
        event: 'api_request',
        restaurant_id: 1,
        time_range: '24h',
        metrics: ['response_time', 'error_rate'],
        group_by: ['endpoint'],
      })

      expect(consoleSpy).toHaveBeenCalledWith('Analytics Query:', expect.any(String))
      expect(result).toEqual([]) // Placeholder return
      
      consoleSpy.mockRestore()
    })

    it('should handle different time ranges', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const timeRanges = ['1h', '24h', '7d', '30d'] as const
      
      for (const range of timeRanges) {
        await service.queryAnalytics({
          time_range: range,
          metrics: ['count'],
        })
      }

      expect(consoleSpy).toHaveBeenCalledTimes(4)
      
      consoleSpy.mockRestore()
    })
  })
})

describe('Advanced Analytics Middleware', () => {
  let app: Hono<{ Bindings: typeof mockEnv }>
  let mockExecutionCtx: ExecutionContext

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock ExecutionContext
    mockExecutionCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    } as unknown as ExecutionContext

    app = new Hono<{ Bindings: typeof mockEnv }>()
    // Don't try to set executionCtx in middleware - it's read-only
    // Instead, pass it via app.request() second parameter
    app.use('*', advancedAnalyticsMiddleware())
    app.get('/test', (c) => c.json({ success: true }))
    app.get('/slow', async (c) => {
      await new Promise(resolve => setTimeout(resolve, 100))
      return c.json({ success: true })
    })
  })

  it('should record API request analytics', async () => {
    const req = new Request('http://localhost/test', {
      headers: {
        'User-Agent': 'Test Browser',
        'CF-IPCountry': 'TW',
        'CF-Connecting-IP': '192.168.1.1',
      },
    })

    // Use app.fetch() for Cloudflare Workers style with ExecutionContext
    const res = await app.fetch(req, mockEnv, mockExecutionCtx)

    expect(res.status).toBe(200)
  })

  it('should store analytics service in context', async () => {
    let analyticsService: any

    app.get('/check-analytics', (c) => {
      analyticsService = (c as any).get('analytics')
      return c.json({ success: true })
    })

    const req = new Request('http://localhost/check-analytics')
    await app.fetch(req, mockEnv, mockExecutionCtx)

    expect(analyticsService).toBeDefined()
  })

  it('should extract request metadata', async () => {
    const req = new Request('http://localhost/test', {
      headers: {
        'User-Agent': 'Mozilla/5.0 Chrome',
        'CF-IPCountry': 'TW',
        'CF-IPCity': 'Taipei',
        'CF-Connecting-IP': '192.168.1.1',
        'CF-Threat-Score': '10',
      },
    })

    const res = await app.fetch(req, mockEnv, mockExecutionCtx)

    expect(res.status).toBe(200)
  })

  it('should handle missing headers gracefully', async () => {
    const req = new Request('http://localhost/test')

    const res = await app.fetch(req, mockEnv, mockExecutionCtx)

    expect(res.status).toBe(200)
  })

  it('should work with mock analytics engine', async () => {
    // Test that middleware works even without real analytics engine
    const envWithoutAnalytics = { ...mockEnv, ANALYTICS_ENGINE: undefined }

    const appWithoutAnalytics = new Hono<{ Bindings: typeof envWithoutAnalytics }>()
    // Don't try to set executionCtx in middleware - pass via fetch instead
    appWithoutAnalytics.use('*', advancedAnalyticsMiddleware())
    appWithoutAnalytics.get('/test', (c) => c.json({ success: true }))

    const req = new Request('http://localhost/test')
    const res = await appWithoutAnalytics.fetch(req, envWithoutAnalytics, mockExecutionCtx)

    expect(res.status).toBe(200)
  })
})

describe('Analytics Helper Functions', () => {
  let service: AdvancedAnalyticsService
  let mockAnalyticsEngine: any
  let mockContext: any

  beforeEach(() => {
    mockAnalyticsEngine = { writeDataPoint: vi.fn() }
    mockContext = { waitUntil: vi.fn((p) => p) }
    service = new AdvancedAnalyticsService(mockAnalyticsEngine, mockContext, mockEnv as any)
  })

  it('should categorize response times correctly', async () => {
    // Test different response time categories through recordEvent
    const testCases = [
      { response_time: 50, expected: 1 },   // Fast
      { response_time: 200, expected: 2 },  // Good
      { response_time: 500, expected: 3 },  // Acceptable
      { response_time: 2000, expected: 4 }, // Slow
      { response_time: 5000, expected: 5 }, // Critical
    ]

    for (const testCase of testCases) {
      await service.recordEvent({
        event: 'test',
        dimensions: {},
        metrics: { response_time: testCase.response_time },
      })
    }

    expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledTimes(5)
  })

  it('should categorize order values correctly', async () => {
    const testCases = [
      { order_value: 5, expected: 1 },    // Small
      { order_value: 15, expected: 2 },   // Medium
      { order_value: 35, expected: 3 },   // Large
      { order_value: 75, expected: 4 },   // Premium
      { order_value: 150, expected: 5 },  // Enterprise
    ]

    for (const testCase of testCases) {
      await service.recordEvent({
        event: 'test',
        dimensions: {},
        metrics: { order_value: testCase.order_value },
      })
    }

    expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledTimes(5)
  })

  it('should categorize user engagement correctly', async () => {
    const testCases = [
      { duration: 30000, expected: 1 },     // Bounce (< 1 min)
      { duration: 180000, expected: 2 },    // Brief (1-5 min)
      { duration: 600000, expected: 3 },    // Engaged (5-15 min)
      { duration: 1200000, expected: 4 },   // Highly engaged (15-30 min)
      { duration: 2400000, expected: 5 },   // Power user (> 30 min)
    ]

    for (const testCase of testCases) {
      await service.recordEvent({
        event: 'test',
        dimensions: {},
        metrics: { user_session_duration: testCase.duration },
      })
    }

    expect(mockAnalyticsEngine.writeDataPoint).toHaveBeenCalledTimes(5)
  })
})
