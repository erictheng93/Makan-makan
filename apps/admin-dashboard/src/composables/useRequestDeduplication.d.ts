/**
 * Vue Composable for Request Deduplication
 *
 * Prevents duplicate API requests in Vue components
 */
import { type RequestDeduplicationOptions } from '@makanmakan/utils';
/**
 * Create a request deduplicator for a component
 *
 * @example
 * const { dedupe, invalidate, stats } = useRequestDeduplication()
 *
 * const fetchUser = async (id: number) => {
 *   return dedupe(`user:${id}`, () => api.getUser(id))
 * }
 */
export declare function useRequestDeduplication(options?: RequestDeduplicationOptions): {
    /**
     * Deduplicate a request
     */
    dedupe: <T>(key: string, requestFn: () => Promise<T>, options?: {
        ttl?: number;
    }) => Promise<T>;
    /**
     * Deduplicate with auto-generated key from arguments
     */
    dedupeByArgs: <T>(requestFn: (...args: any[]) => Promise<T>, ...args: any[]) => Promise<T>;
    /**
     * Invalidate specific cache entry
     */
    invalidate: (key: string) => void;
    /**
     * Invalidate entries matching pattern
     */
    invalidatePattern: (pattern: RegExp) => number;
    /**
     * Clear all cache
     */
    clear: () => void;
    /**
     * Cache statistics (reactive)
     */
    stats: import("vue").Ref<{
        size: number;
        maxSize: number;
        totalSubscribers: number;
        averageAge: number;
        entries: {
            key: string;
            age: number;
            subscribers: number;
        }[];
    }, {
        size: number;
        maxSize: number;
        totalSubscribers: number;
        averageAge: number;
        entries: {
            key: string;
            age: number;
            subscribers: number;
        }[];
    } | {
        size: number;
        maxSize: number;
        totalSubscribers: number;
        averageAge: number;
        entries: {
            key: string;
            age: number;
            subscribers: number;
        }[];
    }>;
};
/**
 * Create a deduplicated API function
 *
 * @example
 * const getUser = useDeduplicated(
 *   (id: number) => api.get(`/users/${id}`),
 *   (id) => `user:${id}`
 * )
 *
 * // Multiple calls with same ID will share the same request
 * const [user1, user2] = await Promise.all([
 *   getUser(1),
 *   getUser(1)
 * ])
 */
export declare function useDeduplicated<T extends (...args: any[]) => Promise<any>>(fn: T, keyGenerator: (...args: Parameters<T>) => string, options?: RequestDeduplicationOptions): T;
/**
 * Composable for managing multiple deduplicated requests
 *
 * @example
 * const { add, execute, clear } = useRequestBatch()
 *
 * add('user', () => api.getUser(1))
 * add('posts', () => api.getPosts())
 * add('user', () => api.getUser(1)) // Will be deduplicated
 *
 * const { user, posts } = await execute()
 */
export declare function useRequestBatch(): {
    /**
     * Add a request to the batch
     */
    add: <T>(key: string, requestFn: () => Promise<T>) => void;
    /**
     * Execute all batched requests (deduplicated)
     */
    execute: () => Promise<Record<string, any>>;
    /**
     * Clear all batched requests
     */
    clear: () => void;
    /**
     * Get number of batched requests
     */
    size: () => number;
};
