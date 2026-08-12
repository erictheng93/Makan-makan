/**
 * Request Deduplication Utility
 *
 * Prevents duplicate API requests by caching in-flight requests
 * and sharing the same promise across multiple callers
 *
 * Use Cases:
 * - Multiple components requesting the same data simultaneously
 * - Rapid user interactions triggering duplicate requests
 * - Race conditions in reactive data fetching
 */

export interface RequestCacheEntry<T = unknown> {
  promise: Promise<T>;
  timestamp: number;
  subscribers: number;
}

export interface RequestDeduplicationOptions {
  /**
   * Cache duration in milliseconds
   * Requests within this window will be deduplicated
   * @default 5000 (5 seconds)
   */
  cacheDuration?: number;

  /**
   * Maximum cache size (number of entries)
   * Oldest entries will be evicted when limit is reached
   * @default 100
   */
  maxCacheSize?: number;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Custom cache key generator
   * Default: JSON.stringify(args)
   */
  keyGenerator?: (...args: unknown[]) => string;
}

export class RequestDeduplicator {
  private cache = new Map<string, RequestCacheEntry>();
  private options: Required<RequestDeduplicationOptions>;

  constructor(options: RequestDeduplicationOptions = {}) {
    this.options = {
      cacheDuration: options.cacheDuration ?? 5000,
      maxCacheSize: options.maxCacheSize ?? 100,
      debug: options.debug ?? false,
      keyGenerator: options.keyGenerator ?? ((...args) => JSON.stringify(args)),
    };

    // Periodic cleanup of expired entries
    setInterval(() => this.cleanup(), this.options.cacheDuration);
  }

  /**
   * Deduplicate a request function
   * If request with same key is in-flight, returns existing promise
   * Otherwise, executes request and caches the promise
   */
  async dedupe<T>(
    key: string,
    requestFn: () => Promise<T>,
    options?: { ttl?: number },
  ): Promise<T> {
    const cacheKey = key;
    const now = Date.now();
    const ttl = options?.ttl ?? this.options.cacheDuration;

    // Check if request is already in-flight
    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.timestamp < ttl) {
      cached.subscribers++;
      if (this.options.debug) {
        console.log(
          `[RequestDedup] Cache HIT for key: ${cacheKey} (subscribers: ${cached.subscribers})`,
        );
      }
      // One cache, string keys, a different result type behind each — the
      // entry's own type cannot be recovered, so the caller's T is the
      // assertion. Making that explicit beats hiding it behind `any`.
      return cached.promise as Promise<T>;
    }

    if (this.options.debug) {
      console.log(`[RequestDedup] Cache MISS for key: ${cacheKey}`);
    }

    // Execute request and cache promise
    const promise = requestFn()
      .then((result) => {
        // Keep successful result briefly for additional subscribers
        setTimeout(() => {
          this.cache.delete(cacheKey);
          if (this.options.debug) {
            console.log(`[RequestDedup] Expired key: ${cacheKey}`);
          }
        }, ttl);
        return result;
      })
      .catch((error) => {
        // Remove failed request immediately so it can be retried
        this.cache.delete(cacheKey);
        if (this.options.debug) {
          console.error(`[RequestDedup] Error for key: ${cacheKey}`, error);
        }
        throw error;
      });

    // Enforce cache size limit
    if (this.cache.size >= this.options.maxCacheSize) {
      this.evictOldest();
    }

    this.cache.set(cacheKey, {
      promise,
      timestamp: now,
      subscribers: 1,
    });

    return promise;
  }

  /**
   * Deduplicate with auto-generated key from arguments
   */
  async dedupeByArgs<TArgs extends unknown[], T>(
    requestFn: (...args: TArgs) => Promise<T>,
    ...args: TArgs
  ): Promise<T> {
    const key = this.options.keyGenerator(...args);
    return this.dedupe(key, () => requestFn(...args));
  }

  /**
   * Clear specific cache entry
   */
  invalidate(key: string): void {
    const deleted = this.cache.delete(key);
    if (this.options.debug && deleted) {
      console.log(`[RequestDedup] Invalidated key: ${key}`);
    }
  }

  /**
   * Clear cache entries matching pattern
   */
  invalidatePattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    if (this.options.debug && count > 0) {
      console.log(
        `[RequestDedup] Invalidated ${count} keys matching: ${pattern}`,
      );
    }
    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    if (this.options.debug && size > 0) {
      console.log(`[RequestDedup] Cleared ${size} cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.entries());
    const totalSubscribers = entries.reduce(
      (sum, [, entry]) => sum + entry.subscribers,
      0,
    );
    const avgAge =
      entries.length > 0
        ? entries.reduce(
            (sum, [, entry]) => sum + (Date.now() - entry.timestamp),
            0,
          ) / entries.length
        : 0;

    return {
      size: this.cache.size,
      maxSize: this.options.maxCacheSize,
      totalSubscribers,
      averageAge: Math.round(avgAge),
      entries: entries.map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        subscribers: entry.subscribers,
      })),
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.options.cacheDuration) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (this.options.debug && cleaned > 0) {
      console.log(`[RequestDedup] Cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Evict oldest entry when cache is full
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity; // Fix: Use Infinity to find oldest entry

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      if (this.options.debug) {
        console.log(`[RequestDedup] Evicted oldest key: ${oldestKey}`);
      }
    }
  }
}

/**
 * Global deduplicator instance
 */
let globalDeduplicator: RequestDeduplicator | null = null;

export function getDeduplicator(
  options?: RequestDeduplicationOptions,
): RequestDeduplicator {
  if (!globalDeduplicator) {
    globalDeduplicator = new RequestDeduplicator(options);
  }
  return globalDeduplicator;
}

export function resetDeduplicator(): void {
  globalDeduplicator?.clear();
  globalDeduplicator = null;
}

/**
 * Decorator for automatic request deduplication
 *
 * @example
 * class ApiService {
 *   @deduplicate()
 *   async getUser(id: number) {
 *     return fetch(`/api/users/${id}`).then(r => r.json())
 *   }
 * }
 */
export function deduplicate(options?: RequestDeduplicationOptions) {
  const deduplicator = getDeduplicator(options);

  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const key = `${target.constructor.name}.${propertyKey}:${JSON.stringify(args)}`;
      return deduplicator.dedupe(key, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Higher-order function for request deduplication
 *
 * @example
 * const getUser = withDeduplication(async (id: number) => {
 *   return fetch(`/api/users/${id}`).then(r => r.json())
 * })
 */
export function withDeduplication<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options?: RequestDeduplicationOptions,
): (...args: TArgs) => Promise<TResult> {
  const deduplicator = getDeduplicator(options);

  return (...args: TArgs) => deduplicator.dedupeByArgs(fn, ...args);
}

/**
 * Batch multiple requests into a single deduplication context
 *
 * @example
 * const [user1, user2, user3] = await batchDedupe([
 *   () => getUser(1),
 *   () => getUser(1), // Will be deduplicated
 *   () => getUser(2)
 * ])
 */
export async function batchDedupe<T>(
  requests: Array<() => Promise<T>>,
  options?: RequestDeduplicationOptions,
): Promise<T[]> {
  const deduplicator = getDeduplicator(options);
  const keyedRequests = new Map<string, () => Promise<T>>();

  // Group requests by their string representation
  for (const request of requests) {
    const key = request.toString();
    if (!keyedRequests.has(key)) {
      keyedRequests.set(key, request);
    }
  }

  // Execute unique requests
  const uniqueResults = await Promise.all(
    Array.from(keyedRequests.entries()).map(([key, request]) =>
      deduplicator.dedupe(key, request),
    ),
  );

  // Map results back to original request order
  const resultMap = new Map<string, T>();
  let index = 0;
  for (const key of keyedRequests.keys()) {
    resultMap.set(key, uniqueResults[index++]);
  }

  return requests.map((request) => resultMap.get(request.toString())!);
}
