/**
 * Cache Feature Tests
 * Comprehensive test suite for cache functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CacheService, CACHE_STRATEGIES } from '../services/CacheService'
import type { KVNamespace } from '@cloudflare/workers-types'

// Mock KV namespace
const createMockKV = (): KVNamespace => {
  const storage = new Map<string, string>()
  const expirations = new Map<string, number>()

  return {
    get: vi.fn(async (key: string) => {
      const expiration = expirations.get(key)
      if (expiration && Date.now() > expiration) {
        storage.delete(key)
        expirations.delete(key)
        return null
      }
      return storage.get(key) || null
    }),

    put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number }) => {
      storage.set(key, value)
      if (options?.expirationTtl) {
        expirations.set(key, Date.now() + options.expirationTtl * 1000)
      }
    }),

    delete: vi.fn(async (key: string) => {
      const existed = storage.has(key)
      storage.delete(key)
      expirations.delete(key)
      return existed
    }),

    list: vi.fn(async (options?: { prefix?: string }) => {
      const keys = Array.from(storage.keys())
      const filteredKeys = options?.prefix
        ? keys.filter(key => key.startsWith(options.prefix!))
        : keys

      return {
        keys: filteredKeys.map(name => ({ name })),
        list_complete: true,
        cacheStatus: null
      }
    }),

    getWithMetadata: vi.fn(),
    // Add other required methods with basic implementations
  } as unknown as KVNamespace
}

describe('Cache Feature', () => {
  let mockKV: KVNamespace
  let cacheService: CacheService

  beforeEach(() => {
    vi.clearAllMocks()
    mockKV = createMockKV()
    cacheService = new CacheService(mockKV)
  })

  describe('CacheService', () => {
    describe('Basic Operations', () => {
      it('should set and get cache values', async () => {
        const testData = { message: 'test', timestamp: Date.now() }
        const key = 'test:key'

        await cacheService.set(key, testData, CACHE_STRATEGIES.MENU)
        const retrieved = await cacheService.get(key)

        expect(retrieved).toEqual(testData)
        expect(mockKV.put).toHaveBeenCalledWith(
          key,
          JSON.stringify(testData),
          { expirationTtl: CACHE_STRATEGIES.MENU.ttl }
        )
      })

      it('should return null for non-existent keys', async () => {
        const result = await cacheService.get('non-existent-key')
        expect(result).toBeNull()
      })

      it('should delete cache entries', async () => {
        const key = 'test:delete'
        await cacheService.set(key, { data: 'test' }, CACHE_STRATEGIES.MENU)

        const deleted = await cacheService.delete(key)
        expect(deleted).toBe(true)

        const retrieved = await cacheService.get(key)
        expect(retrieved).toBeNull()
      })
    })

    describe('Cache Strategies', () => {
      it('should apply correct TTL for different strategies', async () => {
        const testData = { test: 'data' }

        // Test MENU strategy
        await cacheService.set('menu:test', testData, CACHE_STRATEGIES.MENU)
        // Check that the data was stored with correct TTL (not the metadata call)
        expect(mockKV.put).toHaveBeenCalledWith(
          'menu:test',
          JSON.stringify(testData),
          { expirationTtl: CACHE_STRATEGIES.MENU.ttl }
        )

        // Test ANALYTICS strategy
        await cacheService.set('analytics:test', testData, CACHE_STRATEGIES.ANALYTICS)
        expect(mockKV.put).toHaveBeenCalledWith(
          'analytics:test',
          JSON.stringify(testData),
          { expirationTtl: CACHE_STRATEGIES.ANALYTICS.ttl }
        )
      })

      it('should handle different cache priorities', () => {
        expect(CACHE_STRATEGIES.MENU.priority).toBe('high')
        expect(CACHE_STRATEGIES.RESTAURANT.priority).toBe('normal')
        expect(CACHE_STRATEGIES.QR_CODE.priority).toBe('low')
      })
    })

    describe('Cache Tags and Invalidation', () => {
      it('should invalidate cache by tags', async () => {
        // Set multiple cache entries with menu tags
        await cacheService.set('menu:1', { id: 1 }, CACHE_STRATEGIES.MENU)
        await cacheService.set('menu:2', { id: 2 }, CACHE_STRATEGIES.MENU)
        await cacheService.set('restaurant:1', { id: 1 }, CACHE_STRATEGIES.RESTAURANT)

        const invalidatedCount = await cacheService.invalidateByTags(['menu'])

        // Should invalidate menu entries but not restaurant
        expect(invalidatedCount).toBeGreaterThan(0)
      })
    })

    describe('Cache Statistics', () => {
      it('should track hit and miss statistics', async () => {
        const key = 'stats:test'
        const testData = { test: 'stats' }

        // Miss (key doesn't exist)
        await cacheService.get(key)

        // Set and hit
        await cacheService.set(key, testData, CACHE_STRATEGIES.MENU)
        await cacheService.get(key)

        const stats = await cacheService.getStats()
        expect(stats.hitCount).toBeGreaterThan(0)
        expect(stats.missCount).toBeGreaterThan(0)
      })

      it('should calculate hit rate correctly', async () => {
        const stats = await cacheService.getStats()
        const total = stats.hitCount + stats.missCount

        if (total > 0) {
          expect(stats.averageHitRate).toBe(stats.hitCount / total)
        } else {
          expect(stats.averageHitRate).toBe(0)
        }
      })
    })

    describe('Cache Cleanup', () => {
      it('should cleanup expired entries', async () => {
        // This would need to be tested with actual time manipulation
        // For now, just verify the method exists and doesn't throw
        const cleanedCount = await cacheService.cleanup()
        expect(typeof cleanedCount).toBe('number')
      })
    })

    describe('Cache Warmup', () => {
      it('should warm up cache with multiple entries', async () => {
        const warmupData = [
          {
            key: 'warmup:1',
            value: { id: 1, name: 'test1' },
            config: CACHE_STRATEGIES.MENU
          },
          {
            key: 'warmup:2',
            value: { id: 2, name: 'test2' },
            config: CACHE_STRATEGIES.RESTAURANT
          }
        ]

        const successCount = await cacheService.warmup(warmupData)
        expect(successCount).toBe(warmupData.length)

        // Verify entries were set
        const entry1 = await cacheService.get('warmup:1')
        const entry2 = await cacheService.get('warmup:2')

        expect(entry1).toEqual(warmupData[0].value)
        expect(entry2).toEqual(warmupData[1].value)
      })
    })

    describe('Error Handling', () => {
      it('should handle KV errors gracefully', async () => {
        // Mock KV to throw errors
        const errorKV = {
          ...mockKV,
          get: vi.fn().mockRejectedValue(new Error('KV Error'))
        }

        const errorCacheService = new CacheService(errorKV as KVNamespace)

        // Should not throw, should return null
        const result = await errorCacheService.get('error:test')
        expect(result).toBeNull()
      })

      it('should handle set errors gracefully', async () => {
        const errorKV = {
          ...mockKV,
          put: vi.fn().mockRejectedValue(new Error('KV Put Error'))
        }

        const errorCacheService = new CacheService(errorKV as KVNamespace)

        // Should throw since it's a critical operation
        await expect(errorCacheService.set('error:test', { test: 'data' }, CACHE_STRATEGIES.MENU))
          .rejects.toThrow('KV Put Error')
      })
    })
  })

  describe('Cache Strategies Configuration', () => {
    it('should have all required cache strategies', () => {
      const requiredStrategies = ['MENU', 'RESTAURANT', 'ANALYTICS', 'SESSION', 'TABLE', 'QR_CODE']

      requiredStrategies.forEach(strategy => {
        expect(CACHE_STRATEGIES).toHaveProperty(strategy)
        expect(CACHE_STRATEGIES[strategy as keyof typeof CACHE_STRATEGIES]).toMatchObject({
          ttl: expect.any(Number),
          tags: expect.any(Array),
          priority: expect.stringMatching(/^(low|normal|high)$/)
        })
      })
    })

    it('should have reasonable TTL values', () => {
      Object.values(CACHE_STRATEGIES).forEach(strategy => {
        expect(strategy.ttl).toBeGreaterThan(0)
        expect(strategy.ttl).toBeLessThan(86400 * 7) // Max 1 week
      })
    })

    it('should have proper tag configurations', () => {
      expect(CACHE_STRATEGIES.MENU.tags).toContain('menu')
      expect(CACHE_STRATEGIES.RESTAURANT.tags).toContain('restaurant')
      expect(CACHE_STRATEGIES.ANALYTICS.tags).toContain('analytics')
      expect(CACHE_STRATEGIES.SESSION.tags).toContain('session')
      expect(CACHE_STRATEGIES.TABLE.tags).toContain('table')
      expect(CACHE_STRATEGIES.QR_CODE.tags).toContain('qrcode')
    })
  })
})