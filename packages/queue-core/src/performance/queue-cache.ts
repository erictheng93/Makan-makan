/**
 * Queue Performance Cache System
 *
 * Optimized caching strategies for queue operations to improve performance
 */

export interface CacheConfig {
  queuePositionTtl: number // Cache TTL for queue position queries
  queueStatusTtl: number   // Cache TTL for queue status
  settingsTtl: number      // Cache TTL for queue settings
  maxCacheSize: number     // Maximum cache entries
  enableClustering: boolean // Enable cache clustering for multiple workers
}

export interface CacheKey {
  type: 'position' | 'status' | 'settings' | 'stats'
  restaurantId: number
  identifier?: string
}

export interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
  tags: string[]
}

export class QueueCache {
  private cache = new Map<string, CacheEntry>()
  private config: CacheConfig

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      queuePositionTtl: 30000,     // 30 seconds
      queueStatusTtl: 60000,       // 1 minute
      settingsTtl: 300000,         // 5 minutes
      maxCacheSize: 1000,
      enableClustering: false,
      ...config
    }
  }

  /**
   * Get cached data
   */
  get<T>(key: CacheKey): T | null {
    const cacheKey = this.generateKey(key)
    const entry = this.cache.get(cacheKey)

    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(cacheKey)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cached data
   */
  set<T>(key: CacheKey, data: T, customTtl?: number): void {
    const cacheKey = this.generateKey(key)
    const ttl = customTtl || this.getTtlForKey(key)

    // Ensure we don't exceed max cache size
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictOldest()
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      tags: this.generateTags(key)
    }

    this.cache.set(cacheKey, entry)
  }

  /**
   * Invalidate cache by tags
   */
  invalidateByTags(tags: string[]): void {
    for (const [key, entry] of this.cache.entries()) {
      if (tags.some(tag => entry.tags.includes(tag))) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Invalidate all cache for a restaurant
   */
  invalidateRestaurant(restaurantId: number): void {
    this.invalidateByTags([`restaurant:${restaurantId}`])
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now()
    let validEntries = 0
    let expiredEntries = 0

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp <= entry.ttl) {
        validEntries++
      } else {
        expiredEntries++
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      hitRate: validEntries / this.cache.size,
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        cleanedCount++
      }
    }

    return cleanedCount
  }

  private generateKey(key: CacheKey): string {
    const parts = [key.type, key.restaurantId.toString()]
    if (key.identifier) {
      parts.push(key.identifier)
    }
    return parts.join(':')
  }

  private getTtlForKey(key: CacheKey): number {
    switch (key.type) {
      case 'position':
        return this.config.queuePositionTtl
      case 'status':
        return this.config.queueStatusTtl
      case 'settings':
        return this.config.settingsTtl
      case 'stats':
        return this.config.queueStatusTtl
      default:
        return this.config.queuePositionTtl
    }
  }

  private generateTags(key: CacheKey): string[] {
    const tags = [
      `restaurant:${key.restaurantId}`,
      `type:${key.type}`
    ]

    if (key.identifier) {
      tags.push(`id:${key.identifier}`)
    }

    return tags
  }

  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTimestamp = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in bytes
    let totalSize = 0

    for (const [key, entry] of this.cache.entries()) {
      totalSize += key.length * 2 // UTF-16 characters
      totalSize += JSON.stringify(entry.data).length * 2
      totalSize += 100 // Overhead for object structure
    }

    return totalSize
  }
}

/**
 * Cache decorator for queue methods
 */
export function cached(
  keyGenerator: (args: any[]) => CacheKey,
  ttl?: number
) {
  return function (_target: any, _propertyName: string | symbol, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const cache: QueueCache = (this as any).cache || new QueueCache()
      const cacheKey = keyGenerator(args)

      // Try to get from cache first
      const cachedResult = cache.get(cacheKey)
      if (cachedResult) {
        return cachedResult
      }

      // Execute method and cache result
      const result = await method.apply(this, args)
      if (result && result.success) {
        cache.set(cacheKey, result, ttl)
      }

      return result
    }

    return descriptor
  }
}

/**
 * Cache invalidation decorator
 */
export function invalidateCache(
  tagGenerator: (args: any[]) => string[]
) {
  return function (_target: any, _propertyName: string | symbol, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args)

      // Invalidate cache if operation was successful
      if (result && result.success) {
        const cache: QueueCache = (this as any).cache || new QueueCache()
        const tags = tagGenerator(args)
        cache.invalidateByTags(tags)
      }

      return result
    }

    return descriptor
  }
}

// Singleton cache instance for global use
export const globalQueueCache = new QueueCache()

// Cache key generators
export const CacheKeyGenerators = {
  queuePosition: (queueId: string): CacheKey => ({
    type: 'position',
    restaurantId: 0, // Will be set by the method
    identifier: queueId
  }),

  queueStatus: (restaurantId: number): CacheKey => ({
    type: 'status',
    restaurantId
  }),

  queueSettings: (restaurantId: number): CacheKey => ({
    type: 'settings',
    restaurantId
  }),

  queueStats: (restaurantId: number): CacheKey => ({
    type: 'stats',
    restaurantId
  })
}

// Cache tag generators
export const CacheTagGenerators = {
  restaurantQueues: (restaurantId: number): string[] => [
    `restaurant:${restaurantId}`,
    'type:position',
    'type:status'
  ],

  restaurantSettings: (restaurantId: number): string[] => [
    `restaurant:${restaurantId}`,
    'type:settings'
  ],

  specificQueue: (queueId: string, restaurantId: number): string[] => [
    `restaurant:${restaurantId}`,
    `id:${queueId}`,
    'type:position'
  ]
}