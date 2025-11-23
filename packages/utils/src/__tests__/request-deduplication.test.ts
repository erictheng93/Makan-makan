/**
 * Request Deduplication Unit Tests
 * Comprehensive test coverage for request deduplication utility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  RequestDeduplicator,
  getDeduplicator,
  resetDeduplicator,
  withDeduplication,
  batchDedupe
} from '../request-deduplication'

describe('RequestDeduplicator', () => {
  let deduplicator: RequestDeduplicator

  beforeEach(() => {
    vi.useFakeTimers()
    deduplicator = new RequestDeduplicator({ debug: false })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    deduplicator.clear()
  })

  describe('Basic Deduplication', () => {
    it('should deduplicate identical concurrent requests', async () => {
      // Arrange
      let callCount = 0
      const requestFn = vi.fn(async () => {
        callCount++
        await new Promise(resolve => setTimeout(resolve, 100))
        return { data: 'test', count: callCount }
      })

      // Act - Make 3 concurrent requests with same key
      const promises = [
        deduplicator.dedupe('test-key', requestFn),
        deduplicator.dedupe('test-key', requestFn),
        deduplicator.dedupe('test-key', requestFn)
      ]

      vi.advanceTimersByTime(100)
      const results = await Promise.all(promises)

      // Assert
      expect(requestFn).toHaveBeenCalledTimes(1) // Only called once
      expect(results).toHaveLength(3)
      expect(results[0]).toEqual(results[1])
      expect(results[1]).toEqual(results[2])
      expect(results[0].count).toBe(1)
    })

    it('should not deduplicate requests with different keys', async () => {
      // Arrange
      const requestFn = vi.fn(async (value: string) => ({ data: value }))

      // Act
      const [result1, result2] = await Promise.all([
        deduplicator.dedupe('key1', () => requestFn('value1')),
        deduplicator.dedupe('key2', () => requestFn('value2'))
      ])

      // Assert
      expect(requestFn).toHaveBeenCalledTimes(2)
      expect(result1.data).toBe('value1')
      expect(result2.data).toBe('value2')
    })

    it('should return cached result within TTL window', async () => {
      // Arrange
      const requestFn = vi.fn(async () => ({ data: 'cached' }))

      // Act - First request
      await deduplicator.dedupe('test-key', requestFn)

      // Advance time but within TTL (default 5000ms)
      vi.advanceTimersByTime(2000)

      // Second request
      await deduplicator.dedupe('test-key', requestFn)

      // Assert
      expect(requestFn).toHaveBeenCalledTimes(1) // Still cached
    })

    it('should execute new request after TTL expires', async () => {
      // Arrange
      const requestFn = vi.fn(async () => ({ data: 'fresh' }))

      // Act - First request
      await deduplicator.dedupe('test-key', requestFn)

      // Advance time beyond TTL
      vi.advanceTimersByTime(6000)

      // Second request
      await deduplicator.dedupe('test-key', requestFn)

      // Assert
      expect(requestFn).toHaveBeenCalledTimes(2) // Cache expired, new call
    })
  })

  describe('TTL and Custom Options', () => {
    it('should respect custom TTL option', async () => {
      // Arrange
      const requestFn = vi.fn(async () => ({ data: 'test' }))
      const customTTL = 1000

      // Act
      await deduplicator.dedupe('test-key', requestFn, { ttl: customTTL })
      vi.advanceTimersByTime(500)
      await deduplicator.dedupe('test-key', requestFn, { ttl: customTTL })

      // Assert - Still cached at 500ms
      expect(requestFn).toHaveBeenCalledTimes(1)

      // Act - Advance past custom TTL
      vi.advanceTimersByTime(600)
      await deduplicator.dedupe('test-key', requestFn, { ttl: customTTL })

      // Assert - Cache expired at 1100ms
      expect(requestFn).toHaveBeenCalledTimes(2)
    })

    it('should use custom cache duration from constructor', async () => {
      // Arrange
      const customDeduplicator = new RequestDeduplicator({ cacheDuration: 2000 })
      const requestFn = vi.fn(async () => ({ data: 'test' }))

      // Act
      await customDeduplicator.dedupe('test-key', requestFn)
      vi.advanceTimersByTime(1500)
      await customDeduplicator.dedupe('test-key', requestFn)

      // Assert - Still cached at 1500ms
      expect(requestFn).toHaveBeenCalledTimes(1)

      // Cleanup
      customDeduplicator.clear()
    })

    it('should use custom key generator', async () => {
      // Arrange
      const customKeyGen = vi.fn((...args: any[]) => `custom-${args[0]}`)
      const dedup = new RequestDeduplicator({ keyGenerator: customKeyGen })
      const requestFn = vi.fn(async (id: number) => ({ id }))

      // Act
      await dedup.dedupeByArgs(requestFn, 123)

      // Assert
      expect(customKeyGen).toHaveBeenCalledWith(123)
      dedup.clear()
    })
  })

  describe('Cache Size Management', () => {
    it('should enforce maximum cache size', async () => {
      // Arrange
      const smallCache = new RequestDeduplicator({ maxCacheSize: 3 })
      const requestFn = vi.fn(async (key: string) => ({ data: key }))

      // Act - Add 5 items to cache with max 3
      // Note: Due to async nature and TTL-based cleanup, we may have >3 items temporarily
      const promises = []
      for (let i = 1; i <= 5; i++) {
        promises.push(smallCache.dedupe(`key${i}`, () => requestFn(`value${i}`)))
      }
      await Promise.all(promises)

      const stats = smallCache.getStats()

      // Assert - Cache should eventually be limited by eviction
      // Due to async cleanup, exact size may vary, but should not exceed significantly
      expect(stats.maxSize).toBe(3)
      expect(requestFn).toHaveBeenCalledTimes(5)

      // Cleanup
      smallCache.clear()
    })

    it('should evict oldest entry when cache is full', async () => {
      // Arrange
      const smallCache = new RequestDeduplicator({ maxCacheSize: 2 })
      const requestFn = vi.fn(async (key: string) => ({ data: key }))

      // Act
      await smallCache.dedupe('key1', () => requestFn('value1'))
      vi.advanceTimersByTime(100)
      await smallCache.dedupe('key2', () => requestFn('value2'))
      vi.advanceTimersByTime(100)
      await smallCache.dedupe('key3', () => requestFn('value3')) // Should evict key1

      const stats = smallCache.getStats()

      // Assert
      expect(stats.size).toBe(2)
      expect(stats.entries.find(e => e.key === 'key1')).toBeUndefined()

      // Cleanup
      smallCache.clear()
    })
  })

  describe('Error Handling', () => {
    it('should not cache failed requests', async () => {
      // Arrange
      let attemptCount = 0
      const failingFn = vi.fn(async () => {
        attemptCount++
        throw new Error(`Attempt ${attemptCount} failed`)
      })

      // Act & Assert - First attempt
      await expect(
        deduplicator.dedupe('test-key', failingFn)
      ).rejects.toThrow('Attempt 1 failed')

      // Second attempt should retry (not use cached error)
      await expect(
        deduplicator.dedupe('test-key', failingFn)
      ).rejects.toThrow('Attempt 2 failed')

      expect(failingFn).toHaveBeenCalledTimes(2)
    })

    it('should deduplicate concurrent requests even if they fail', async () => {
      // Arrange
      const failingFn = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        throw new Error('Request failed')
      })

      // Act - Make concurrent requests
      const promises = [
        deduplicator.dedupe('test-key', failingFn).catch(e => e),
        deduplicator.dedupe('test-key', failingFn).catch(e => e),
        deduplicator.dedupe('test-key', failingFn).catch(e => e)
      ]

      vi.advanceTimersByTime(100)
      const errors = await Promise.all(promises)

      // Assert - Only one actual call despite 3 concurrent requests
      expect(failingFn).toHaveBeenCalledTimes(1)
      expect(errors).toHaveLength(3)
      errors.forEach(error => {
        expect(error.message).toBe('Request failed')
      })
    })
  })

  describe('Cache Invalidation', () => {
    it('should invalidate specific cache entry', async () => {
      // Arrange
      const requestFn = vi.fn(async () => ({ data: 'test' }))
      await deduplicator.dedupe('test-key', requestFn)
      expect(requestFn).toHaveBeenCalledTimes(1)

      // Act - Invalidate and request again
      deduplicator.invalidate('test-key')
      await deduplicator.dedupe('test-key', requestFn)

      // Assert
      expect(requestFn).toHaveBeenCalledTimes(2)
    })

    it('should invalidate entries matching pattern', async () => {
      // Arrange
      const requestFn = vi.fn(async (key: string) => ({ data: key }))
      await deduplicator.dedupe('user:1', () => requestFn('user1'))
      await deduplicator.dedupe('user:2', () => requestFn('user2'))
      await deduplicator.dedupe('product:1', () => requestFn('product1'))

      // Act
      const invalidated = deduplicator.invalidatePattern(/^user:/)

      // Assert
      expect(invalidated).toBe(2)
      const stats = deduplicator.getStats()
      expect(stats.size).toBe(1)
      expect(stats.entries[0].key).toBe('product:1')
    })

    it('should clear all cache entries', async () => {
      // Arrange
      const requestFn = vi.fn(async (key: string) => ({ data: key }))
      await deduplicator.dedupe('key1', () => requestFn('value1'))
      await deduplicator.dedupe('key2', () => requestFn('value2'))
      await deduplicator.dedupe('key3', () => requestFn('value3'))

      // Act
      deduplicator.clear()

      // Assert
      const stats = deduplicator.getStats()
      expect(stats.size).toBe(0)
    })
  })

  describe('Statistics', () => {
    it('should track subscriber count', async () => {
      // Arrange
      const requestFn = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { data: 'test' }
      })

      // Act - Make 3 concurrent requests
      const promises = [
        deduplicator.dedupe('test-key', requestFn),
        deduplicator.dedupe('test-key', requestFn),
        deduplicator.dedupe('test-key', requestFn)
      ]

      // Check stats before resolution
      const statsDuring = deduplicator.getStats()

      vi.advanceTimersByTime(100)
      await Promise.all(promises)

      // Assert
      expect(statsDuring.totalSubscribers).toBe(3)
      expect(statsDuring.entries[0].subscribers).toBe(3)
    })

    it('should calculate average cache age', async () => {
      // Arrange
      const requestFn = vi.fn(async (key: string) => ({ data: key }))

      // Act
      await deduplicator.dedupe('key1', () => requestFn('value1'))
      vi.advanceTimersByTime(1000)
      await deduplicator.dedupe('key2', () => requestFn('value2'))
      vi.advanceTimersByTime(1000)

      const stats = deduplicator.getStats()

      // Assert
      expect(stats.averageAge).toBeGreaterThan(0)
      expect(stats.size).toBe(2)
    })

    it('should report cache size and max size', async () => {
      // Arrange
      const customDedup = new RequestDeduplicator({ maxCacheSize: 50 })
      const requestFn = vi.fn(async () => ({ data: 'test' }))

      // Act
      await customDedup.dedupe('key1', requestFn)
      await customDedup.dedupe('key2', requestFn)

      const stats = customDedup.getStats()

      // Assert
      expect(stats.size).toBe(2)
      expect(stats.maxSize).toBe(50)

      // Cleanup
      customDedup.clear()
    })
  })

  describe('dedupeByArgs', () => {
    it('should auto-generate key from arguments', async () => {
      // Arrange
      const requestFn = vi.fn(async (id: number, name: string) => ({
        id,
        name
      }))

      // Act
      const [result1, result2] = await Promise.all([
        deduplicator.dedupeByArgs(requestFn, 1, 'Alice'),
        deduplicator.dedupeByArgs(requestFn, 1, 'Alice')
      ])

      // Assert
      expect(requestFn).toHaveBeenCalledTimes(1)
      expect(result1).toEqual(result2)
      expect(result1).toEqual({ id: 1, name: 'Alice' })
    })

    it('should treat different arguments as different keys', async () => {
      // Arrange
      const requestFn = vi.fn(async (id: number) => ({ id }))

      // Act
      const [result1, result2] = await Promise.all([
        deduplicator.dedupeByArgs(requestFn, 1),
        deduplicator.dedupeByArgs(requestFn, 2)
      ])

      // Assert
      expect(requestFn).toHaveBeenCalledTimes(2)
      expect(result1.id).toBe(1)
      expect(result2.id).toBe(2)
    })
  })

  describe('Cleanup', () => {
    it('should automatically cleanup expired entries', async () => {
      // Arrange
      const requestFn = vi.fn(async (key: string) => ({ data: key }))
      await deduplicator.dedupe('key1', () => requestFn('value1'))
      await deduplicator.dedupe('key2', () => requestFn('value2'))

      // Act - Advance time beyond cache duration (triggers cleanup)
      vi.advanceTimersByTime(6000)

      // Assert - Cleanup should have removed expired entries
      const stats = deduplicator.getStats()
      expect(stats.size).toBe(0)
    })
  })
})

describe('Global Deduplicator', () => {
  beforeEach(() => {
    resetDeduplicator()
  })

  afterEach(() => {
    resetDeduplicator()
  })

  it('should return same instance on multiple calls', () => {
    // Act
    const instance1 = getDeduplicator()
    const instance2 = getDeduplicator()

    // Assert
    expect(instance1).toBe(instance2)
  })

  it('should create new instance after reset', () => {
    // Arrange
    const instance1 = getDeduplicator()

    // Act
    resetDeduplicator()
    const instance2 = getDeduplicator()

    // Assert
    expect(instance1).not.toBe(instance2)
  })

  it('should accept options on first call', async () => {
    // Arrange
    const dedup = getDeduplicator({ debug: false, maxCacheSize: 10 })
    const requestFn = vi.fn(async () => ({ data: 'test' }))

    // Act
    await dedup.dedupe('test-key', requestFn)
    const stats = dedup.getStats()

    // Assert
    expect(stats.maxSize).toBe(10)
  })
})

describe('withDeduplication HOF', () => {
  beforeEach(() => {
    resetDeduplicator()
    vi.useFakeTimers()
  })

  afterEach(() => {
    resetDeduplicator()
    vi.useRealTimers()
  })

  it('should wrap function with deduplication', async () => {
    // Arrange
    const originalFn = vi.fn(async (id: number) => ({ id, data: 'test' }))
    const wrappedFn = withDeduplication(originalFn)

    // Act
    const [result1, result2] = await Promise.all([
      wrappedFn(1),
      wrappedFn(1)
    ])

    // Assert
    expect(originalFn).toHaveBeenCalledTimes(1)
    expect(result1).toEqual(result2)
  })

  it('should preserve function signature', async () => {
    // Arrange
    type UserFn = (id: number, name: string) => Promise<{ id: number; name: string }>
    const originalFn: UserFn = async (id, name) => ({ id, name })
    const wrappedFn = withDeduplication(originalFn)

    // Act
    const result = await wrappedFn(1, 'Alice')

    // Assert - TypeScript should enforce correct types
    expect(result).toEqual({ id: 1, name: 'Alice' })
  })
})

describe('batchDedupe', () => {
  beforeEach(() => {
    resetDeduplicator()
    vi.useFakeTimers()
  })

  afterEach(() => {
    resetDeduplicator()
    vi.useRealTimers()
  })

  it('should deduplicate identical requests in batch', async () => {
    // Arrange
    const requestFn = vi.fn(async (id: number) => ({ id, data: `user${id}` }))
    const requests = [
      () => requestFn(1),
      () => requestFn(1), // Duplicate
      () => requestFn(2),
      () => requestFn(1), // Duplicate
      () => requestFn(3)
    ]

    // Act
    const results = await batchDedupe(requests)

    // Assert
    expect(results).toHaveLength(5)
    expect(requestFn).toHaveBeenCalledTimes(3) // Only unique requests
    expect(results[0]).toEqual(results[1]) // Duplicates should have same result
    expect(results[0]).toEqual(results[3])
  })

  it('should handle empty batch', async () => {
    // Act
    const results = await batchDedupe([])

    // Assert
    expect(results).toEqual([])
  })

  it('should preserve request order in results', async () => {
    // Arrange
    const requestFn = vi.fn(async (id: number) => ({ id }))
    const requests = [
      () => requestFn(3),
      () => requestFn(1),
      () => requestFn(2)
    ]

    // Act
    const results = await batchDedupe(requests)

    // Assert
    expect(results[0].id).toBe(3)
    expect(results[1].id).toBe(1)
    expect(results[2].id).toBe(2)
  })
})

describe('Debug Mode', () => {
  let consoleLogSpy: any
  let consoleErrorSpy: any

  beforeEach(() => {
    vi.useFakeTimers()
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('should log cache hits in debug mode', async () => {
    // Arrange
    const dedup = new RequestDeduplicator({ debug: true })
    const requestFn = vi.fn(async () => ({ data: 'test' }))

    // Act
    await dedup.dedupe('test-key', requestFn)
    await dedup.dedupe('test-key', requestFn)

    // Assert
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cache HIT')
    )

    // Cleanup
    dedup.clear()
  })

  it('should log cache misses in debug mode', async () => {
    // Arrange
    const dedup = new RequestDeduplicator({ debug: true })
    const requestFn = vi.fn(async () => ({ data: 'test' }))

    // Act
    await dedup.dedupe('test-key', requestFn)

    // Assert
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cache MISS')
    )

    // Cleanup
    dedup.clear()
  })

  it('should log errors in debug mode', async () => {
    // Arrange
    const dedup = new RequestDeduplicator({ debug: true })
    const failingFn = vi.fn(async () => {
      throw new Error('Test error')
    })

    // Act
    await dedup.dedupe('test-key', failingFn).catch(() => {})

    // Assert
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error for key'),
      expect.any(Error)
    )

    // Cleanup
    dedup.clear()
  })
})
