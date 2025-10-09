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
export interface RequestCacheEntry<T = any> {
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
    keyGenerator?: (...args: any[]) => string;
}
export declare class RequestDeduplicator {
    private cache;
    private options;
    constructor(options?: RequestDeduplicationOptions);
    /**
     * Deduplicate a request function
     * If request with same key is in-flight, returns existing promise
     * Otherwise, executes request and caches the promise
     */
    dedupe<T>(key: string, requestFn: () => Promise<T>, options?: {
        ttl?: number;
    }): Promise<T>;
    /**
     * Deduplicate with auto-generated key from arguments
     */
    dedupeByArgs<T>(requestFn: (...args: any[]) => Promise<T>, ...args: any[]): Promise<T>;
    /**
     * Clear specific cache entry
     */
    invalidate(key: string): void;
    /**
     * Clear cache entries matching pattern
     */
    invalidatePattern(pattern: RegExp): number;
    /**
     * Clear all cache entries
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        maxSize: number;
        totalSubscribers: number;
        averageAge: number;
        entries: {
            key: string;
            age: number;
            subscribers: number;
        }[];
    };
    /**
     * Cleanup expired entries
     */
    private cleanup;
    /**
     * Evict oldest entry when cache is full
     */
    private evictOldest;
}
export declare function getDeduplicator(options?: RequestDeduplicationOptions): RequestDeduplicator;
export declare function resetDeduplicator(): void;
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
export declare function deduplicate(options?: RequestDeduplicationOptions): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Higher-order function for request deduplication
 *
 * @example
 * const getUser = withDeduplication(async (id: number) => {
 *   return fetch(`/api/users/${id}`).then(r => r.json())
 * })
 */
export declare function withDeduplication<T extends (...args: any[]) => Promise<any>>(fn: T, options?: RequestDeduplicationOptions): T;
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
export declare function batchDedupe<T>(requests: Array<() => Promise<T>>, options?: RequestDeduplicationOptions): Promise<T[]>;
