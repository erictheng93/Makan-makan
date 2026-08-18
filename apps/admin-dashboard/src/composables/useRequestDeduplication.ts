/**
 * Vue Composable for Request Deduplication
 *
 * Prevents duplicate API requests in Vue components
 */

import { ref, onUnmounted } from "vue";
import {
  RequestDeduplicator,
  type RequestDeduplicationOptions,
} from "@makanmasak/utils";

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
export function useRequestDeduplication(options?: RequestDeduplicationOptions) {
  const deduplicator = new RequestDeduplicator(options);
  const stats = ref(deduplicator.getStats());

  // Update stats periodically
  const statsInterval = setInterval(() => {
    stats.value = deduplicator.getStats();
  }, 5000);

  // Cleanup on unmount
  onUnmounted(() => {
    clearInterval(statsInterval);
    deduplicator.clear();
  });

  return {
    /**
     * Deduplicate a request
     */
    dedupe: <T>(
      key: string,
      requestFn: () => Promise<T>,
      options?: { ttl?: number },
    ) => deduplicator.dedupe(key, requestFn, options),

    /**
     * Deduplicate with auto-generated key from arguments
     */
    dedupeByArgs: <TArgs extends unknown[], TResult>(
      requestFn: (...args: TArgs) => Promise<TResult>,
      ...args: TArgs
    ) => deduplicator.dedupeByArgs(requestFn, ...args),

    /**
     * Invalidate specific cache entry
     */
    invalidate: (key: string) => {
      deduplicator.invalidate(key);
      stats.value = deduplicator.getStats();
    },

    /**
     * Invalidate entries matching pattern
     */
    invalidatePattern: (pattern: RegExp) => {
      const count = deduplicator.invalidatePattern(pattern);
      stats.value = deduplicator.getStats();
      return count;
    },

    /**
     * Clear all cache
     */
    clear: () => {
      deduplicator.clear();
      stats.value = deduplicator.getStats();
    },

    /**
     * Cache statistics (reactive)
     */
    stats,
  };
}

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
export function useDeduplicated<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyGenerator: (...args: TArgs) => string,
  options?: RequestDeduplicationOptions,
): (...args: TArgs) => Promise<TResult> {
  const deduplicator = new RequestDeduplicator(options);

  return (...args: TArgs) => {
    const key = keyGenerator(...args);
    return deduplicator.dedupe(key, () => fn(...args));
  };
}

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
export function useRequestBatch() {
  const requests = new Map<string, () => Promise<unknown>>();
  const deduplicator = new RequestDeduplicator();

  return {
    /**
     * Add a request to the batch
     */
    add: <T>(key: string, requestFn: () => Promise<T>) => {
      requests.set(key, requestFn);
    },

    /**
     * Execute all batched requests (deduplicated)
     */
    execute: async () => {
      const results: Record<string, unknown> = {};

      await Promise.all(
        Array.from(requests.entries()).map(async ([key, requestFn]) => {
          try {
            results[key] = await deduplicator.dedupe(key, requestFn);
          } catch (error) {
            console.error(`[RequestBatch] Failed to execute ${key}:`, error);
            results[key] = { error };
          }
        }),
      );

      return results;
    },

    /**
     * Clear all batched requests
     */
    clear: () => {
      requests.clear();
      deduplicator.clear();
    },

    /**
     * Get number of batched requests
     */
    size: () => requests.size,
  };
}
