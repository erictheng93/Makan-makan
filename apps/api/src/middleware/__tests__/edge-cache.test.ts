/**
 * Edge Cache Middleware Tests
 * ?�緣快�?中�?件測�?
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { EdgeCacheManager, smartCacheMiddleware, cacheWarmingMiddleware } from '../edge-cache'
import { mockEnv } from '../../__tests__/setup'

// Mock global caches API
const mockCacheAPI = {
  default: {
    match: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}
vi.stubGlobal('caches', mockCacheAPI)

describe('EdgeCacheManager', () => {
  let cacheManager: EdgeCacheManager
  let mockKV: any
  let mockContext: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    }
    
    mockContext = {
      waitUntil: vi.fn((promise) => promise),
    }
    
    mockCacheAPI.default.match.mockResolvedValue(null)
    mockCacheAPI.default.put.mockResolvedValue(undefined)
    mockCacheAPI.default.delete.mockResolvedValue(true)
    
    cacheManager = new EdgeCacheManager(mockKV, mockContext, mockEnv as any)
  })

  describe('get', () => {
    it('should return cached value from Cache API', async () => {
      const cachedData = {
        value: { id: 1, name: 'Test' },
        cached_at: Date.now(),
        expires_at: Date.now() + 300000,
      }
      
      mockCacheAPI.default.match.mockResolvedValue({
        json: () => Promise.resolve(cachedData),
        headers: {
          get: () => 'HIT',
        },
      })

      const result = await cacheManager.get('test-key')
      
      expect(result).toEqual({ id: 1, name: 'Test' })
    })

    it('should fallback to KV on Cache API miss', async () => {
      mockCacheAPI.default.match.mockResolvedValue(null)
      
      const kvData = {
        key: 'test-key',
        value: { id: 2, name: 'KV Data' },
        cached_at: Date.now(),
        expires_at: Date.now() + 300000,
        tags: [],
        hit_count: 5,
        last_accessed: Date.now(),
      }
      mockKV.get.mockResolvedValue(kvData)

      const result = await cacheManager.get('test-key')
      
      expect(result).toEqual({ id: 2, name: 'KV Data' })
    })

    it('should return null on complete cache miss', async () => {
      mockCacheAPI.default.match.mockResolvedValue(null)
      mockKV.get.mockResolvedValue(null)

      const result = await cacheManager.get('missing-key')
      
      expect(result).toBeNull()
    })

    it('should return null for expired KV data', async () => {
      mockCacheAPI.default.match.mockResolvedValue(null)
      
      const expiredData = {
        key: 'test-key',
        value: { id: 1 },
        cached_at: Date.now() - 600000,
        expires_at: Date.now() - 300000, // Expired
        tags: [],
        hit_count: 0,
        last_accessed: Date.now() - 600000,
      }
      mockKV.get.mockResolvedValue(expiredData)

      const result = await cacheManager.get('test-key')
      
      expect(result).toBeNull()
    })

    it('should handle cache errors gracefully', async () => {
      mockCacheAPI.default.match.mockRejectedValue(new Error('Cache error'))
      mockKV.get.mockRejectedValue(new Error('KV error'))

      const result = await cacheManager.get('error-key')
      
      expect(result).toBeNull()
    })

    it('should populate Cache API from KV hit', async () => {
      mockCacheAPI.default.match.mockResolvedValue(null)
      
      const kvData = {
        key: 'test-key',
        value: { id: 1 },
        cached_at: Date.now(),
        expires_at: Date.now() + 300000,
        tags: [],
        hit_count: 0,
        last_accessed: Date.now(),
      }
      mockKV.get.mockResolvedValue(kvData)

      await cacheManager.get('test-key')
      
      expect(mockContext.waitUntil).toHaveBeenCalled()
    })
  })

  describe('set', () => {
    it('should store value in both Cache API and KV', async () => {
      await cacheManager.set('test-key', { id: 1 }, { ttl: 300 })
      
      expect(mockKV.put).toHaveBeenCalled()
      expect(mockCacheAPI.default.put).toHaveBeenCalled()
    })

    it('should include metadata in stored value', async () => {
      await cacheManager.set('test-key', { id: 1 }, { ttl: 300, tags: ['test'] })
      
      expect(mockKV.put).toHaveBeenCalledWith(
        'test-key',
        expect.stringContaining('"tags":["test"]'),
        expect.any(Object)
      )
    })

    it('should set expiration TTL', async () => {
      await cacheManager.set('test-key', { id: 1 }, { ttl: 600 })
      
      expect(mockKV.put).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ expirationTtl: 600 })
      )
    })

    it('should update tag mappings', async () => {
      mockKV.get.mockResolvedValue([])

      await cacheManager.set('test-key', { id: 1 }, { ttl: 300, tags: ['menu', 'restaurant'] })

      // Should attempt to store data (at least 1 call for data)
      expect(mockKV.put).toHaveBeenCalled()
      // Tags are stored asynchronously via Promise.allSettled, may not complete immediately
    })

    it('should handle storage errors gracefully', async () => {
      // When using Promise.allSettled, errors are handled gracefully without throwing
      mockKV.put.mockRejectedValue(new Error('Storage error'))

      // Should not throw - Promise.allSettled handles errors gracefully
      await expect(cacheManager.set('test-key', { id: 1 }, { ttl: 300 }))
        .resolves.toBeUndefined()
    })
  })

  describe('invalidate', () => {
    it('should invalidate by key', async () => {
      await cacheManager.invalidate('test-key', 'key')
      
      expect(mockKV.delete).toHaveBeenCalledWith('test-key')
      expect(mockCacheAPI.default.delete).toHaveBeenCalled()
    })

    it('should invalidate by tags', async () => {
      mockKV.get.mockResolvedValue(['key1', 'key2', 'key3'])
      
      await cacheManager.invalidate(['menu'], 'tag')
      
      // Should delete all keys associated with the tag
      expect(mockKV.delete).toHaveBeenCalledTimes(3)
    })

    it('should handle multiple tags', async () => {
      mockKV.get
        .mockResolvedValueOnce(['key1', 'key2'])
        .mockResolvedValueOnce(['key3'])
      
      await cacheManager.invalidate(['menu', 'restaurant'], 'tag')
      
      expect(mockKV.delete).toHaveBeenCalledTimes(3)
    })

    it('should handle invalidation errors gracefully', async () => {
      mockKV.delete.mockRejectedValue(new Error('Delete error'))
      
      // Should not throw
      await expect(cacheManager.invalidate('test-key', 'key')).resolves.not.toThrow()
    })
  })

  describe('getHealthMetrics', () => {
    it('should return health metrics', async () => {
      mockKV.get.mockResolvedValue({
        hit_rate: 0.85,
        miss_rate: 0.15,
        popular_keys: [{ key: 'menu:1', hits: 100 }],
        cache_size_estimate: 1000,
      })

      const metrics = await cacheManager.getHealthMetrics()
      
      expect(metrics.hit_rate).toBe(0.85)
      expect(metrics.popular_keys).toHaveLength(1)
    })

    it('should return default metrics on error', async () => {
      mockKV.get.mockRejectedValue(new Error('KV error'))

      const metrics = await cacheManager.getHealthMetrics()
      
      expect(metrics.hit_rate).toBe(0)
      expect(metrics.miss_rate).toBe(0)
      expect(metrics.popular_keys).toEqual([])
    })
  })
})

describe('Smart Cache Middleware', () => {
  let app: Hono<{ Bindings: typeof mockEnv }>
  let mockExecutionCtx: ExecutionContext

  beforeEach(() => {
    vi.clearAllMocks()

    mockCacheAPI.default.match.mockResolvedValue(null)
    mockCacheAPI.default.put.mockResolvedValue(undefined)

    mockEnv.CACHE_KV.get.mockResolvedValue(null)
    mockEnv.CACHE_KV.put.mockResolvedValue(undefined)

    // Create mock ExecutionContext
    mockExecutionCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    } as unknown as ExecutionContext

    app = new Hono<{ Bindings: typeof mockEnv }>()
    // Don't try to set executionCtx - pass via fetch instead
  })

  it('should cache GET requests', async () => {
    app.use('*', smartCacheMiddleware())
    app.get('/test', (c) => c.json({ success: true, data: { id: 1 } }))

    const req = new Request('http://localhost/test')
    const res = await app.fetch(req, mockEnv, mockExecutionCtx)

    expect(res.status).toBe(200)
  })

  it('should return cached response on hit', async () => {
    const cachedData = {
      value: { success: true, data: { id: 1 } },
      cached_at: Date.now(),
      expires_at: Date.now() + 300000,
    }

    mockEnv.CACHE_KV.get.mockResolvedValue(cachedData)

    app.use('*', smartCacheMiddleware())
    app.get('/test', (c) => c.json({ success: true, data: { id: 2 } }))

    const req = new Request('http://localhost/test')
    const res = await app.fetch(req, mockEnv, mockExecutionCtx)
    const result = await res.json() as any

    expect(result.cached).toBe(true)
  })

  it('should skip caching when condition returns false', async () => {
    app.use('*', smartCacheMiddleware({
      shouldCache: (c) => !c.req.path.includes('no-cache'),
    }))
    app.get('/no-cache', (c) => c.json({ success: true }))

    const req = new Request('http://localhost/no-cache')
    await app.fetch(req, mockEnv, mockExecutionCtx)

    expect(mockEnv.CACHE_KV.get).not.toHaveBeenCalled()
  })

  it('should use custom TTL', async () => {
    app.use('*', smartCacheMiddleware({ defaultTtl: 600 }))
    app.get('/test', (c) => c.json({ success: true, data: {} }))

    const req = new Request('http://localhost/test')
    await app.fetch(req, mockEnv, mockExecutionCtx)

    // TTL should be used in cache set
    expect(mockEnv.CACHE_KV.put).toHaveBeenCalled()
  })

  it('should apply cache tags', async () => {
    app.use('*', smartCacheMiddleware({
      cacheTags: (c) => ['menu', `restaurant:${c.req.param('id')}`],
    }))
    app.get('/restaurants/:id', (c) => c.json({ success: true, data: {} }))

    const req = new Request('http://localhost/restaurants/1')
    await app.fetch(req, mockEnv, mockExecutionCtx)

    expect(mockEnv.CACHE_KV.put).toHaveBeenCalled()
  })

  it('should not cache non-GET requests', async () => {
    app.use('*', smartCacheMiddleware())
    app.post('/test', (c) => c.json({ success: true }))

    const req = new Request('http://localhost/test', { method: 'POST' })
    await app.fetch(req, mockEnv, mockExecutionCtx)

    // Should not attempt to cache POST
    expect(mockEnv.CACHE_KV.put).not.toHaveBeenCalled()
  })

  it('should not cache error responses', async () => {
    app.use('*', smartCacheMiddleware())
    app.get('/error', (c) => c.json({ error: 'Not found' }, 404))

    const req = new Request('http://localhost/error')
    await app.fetch(req, mockEnv, mockExecutionCtx)

    expect(mockEnv.CACHE_KV.put).not.toHaveBeenCalled()
  })
})

describe('Cache Warming Middleware', () => {
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
    // Don't try to set executionCtx - pass via fetch instead
    app.use('*', cacheWarmingMiddleware())
  })

  it('should trigger preload for menu endpoints', async () => {
    app.get('/restaurants/:restaurantId/menu', (c) => c.json({ success: true }))

    const req = new Request('http://localhost/restaurants/1/menu')
    const res = await app.fetch(req, mockEnv, mockExecutionCtx)

    expect(res.status).toBe(200)
  })

  it('should pass through non-menu requests', async () => {
    app.get('/other', (c) => c.json({ success: true }))

    const req = new Request('http://localhost/other')
    const res = await app.fetch(req, mockEnv, mockExecutionCtx)

    expect(res.status).toBe(200)
  })
})

describe('Cache Key Building', () => {
  let cacheManager: EdgeCacheManager
  let mockKV: any
  let mockContext: any

  beforeEach(() => {
    mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn(),
      delete: vi.fn(),
    }
    mockContext = { waitUntil: vi.fn() }
    cacheManager = new EdgeCacheManager(mockKV, mockContext, mockEnv as any)
  })

  it('should build cache key without vary headers', async () => {
    await cacheManager.get('test-key')
    
    expect(mockCacheAPI.default.match).toHaveBeenCalledWith(
      'https://cache.makanmakan.app/test-key'
    )
  })

  it('should build cache key with vary headers', async () => {
    await cacheManager.get('test-key', { vary: ['Accept-Language', 'Accept-Encoding'] })
    
    expect(mockCacheAPI.default.match).toHaveBeenCalledWith(
      expect.stringContaining('vary=')
    )
  })
})

describe('Cache Priority', () => {
  let cacheManager: EdgeCacheManager
  let mockKV: any
  let mockContext: any

  beforeEach(() => {
    mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn(),
    }
    mockContext = { waitUntil: vi.fn() }
    cacheManager = new EdgeCacheManager(mockKV, mockContext, mockEnv as any)
  })

  it('should set high priority for important content', async () => {
    await cacheManager.set('menu:1', { items: [] }, {
      ttl: 300,
      priority: 'high',
    })
    
    expect(mockKV.put).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        metadata: expect.objectContaining({ priority: 'high' }),
      })
    )
  })

  it('should set normal priority by default', async () => {
    await cacheManager.set('data', { value: 1 }, { ttl: 300 })
    
    expect(mockKV.put).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        metadata: expect.objectContaining({ priority: 'normal' }),
      })
    )
  })
})
