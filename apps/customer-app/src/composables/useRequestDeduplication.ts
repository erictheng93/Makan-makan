/**
 * Vue Composable for Request Deduplication (PWA-Optimized)
 *
 * Prevents duplicate API requests in Vue components with PWA optimizations
 */

import { ref, onUnmounted } from "vue";
import {
  RequestDeduplicator,
  type RequestDeduplicationOptions,
} from "@makanmakan/utils";

/**
 * Create a request deduplicator for a component (PWA-optimized)
 *
 * @example
 * const { dedupe, invalidate, stats } = useRequestDeduplication({
 *   cacheDuration: 10000, // 10s cache for PWA
 *   debug: import.meta.env.DEV
 * })
 *
 * const fetchMenu = async (restaurantId: number) => {
 *   return dedupe(`menu:${restaurantId}`, () => api.getMenu(restaurantId))
 * }
 */
export function useRequestDeduplication(options?: RequestDeduplicationOptions) {
  const deduplicator = new RequestDeduplicator({
    cacheDuration: 10000, // Longer cache for PWA (10s)
    maxCacheSize: 50, // Smaller cache for mobile
    debug: import.meta.env.DEV,
    ...options,
  });

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
    dedupeByArgs: <T>(
      requestFn: (...args: any[]) => Promise<T>,
      ...args: any[]
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
 * Create a deduplicated API function (PWA-optimized)
 *
 * @example
 * const getMenu = useDeduplicated(
 *   (restaurantId: number) => api.get(`/restaurants/${restaurantId}/menu`),
 *   (restaurantId) => `menu:${restaurantId}`
 * )
 *
 * // Multiple calls with same restaurant ID will share the same request
 * const [menu1, menu2] = await Promise.all([
 *   getMenu(123),
 *   getMenu(123)
 * ])
 */
export function useDeduplicated<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string,
  options?: RequestDeduplicationOptions,
): T {
  const deduplicator = new RequestDeduplicator({
    cacheDuration: 10000,
    debug: import.meta.env.DEV,
    ...options,
  });

  return ((...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    return deduplicator.dedupe(key, () => fn(...args));
  }) as T;
}

/**
 * Composable for managing multiple deduplicated requests (PWA batch optimization)
 *
 * @example
 * const { add, execute, clear } = useRequestBatch()
 *
 * add('menu', () => api.getMenu(restaurantId))
 * add('restaurant', () => api.getRestaurant(restaurantId))
 * add('menu', () => api.getMenu(restaurantId)) // Will be deduplicated
 *
 * const { menu, restaurant } = await execute()
 */
export function useRequestBatch() {
  const requests = new Map<string, () => Promise<any>>();
  const deduplicator = new RequestDeduplicator({
    cacheDuration: 10000,
    debug: import.meta.env.DEV,
  });

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
      const results: Record<string, any> = {};

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

/**
 * Prefetch data in the background (PWA optimization)
 *
 * @example
 * // Prefetch menu when user hovers over restaurant card
 * const { prefetch, isPrefetched } = usePrefetch()
 *
 * onMouseEnter(() => {
 *   prefetch('menu:123', () => api.getMenu(123))
 * })
 */
export function usePrefetch(options?: RequestDeduplicationOptions) {
  const deduplicator = new RequestDeduplicator({
    cacheDuration: 30000, // 30s cache for prefetch
    debug: import.meta.env.DEV,
    ...options,
  });

  const prefetchedKeys = new Set<string>();

  return {
    /**
     * Prefetch data in the background
     */
    prefetch: async <T>(
      key: string,
      requestFn: () => Promise<T>,
    ): Promise<void> => {
      if (prefetchedKeys.has(key)) {
        return;
      }

      try {
        await deduplicator.dedupe(key, requestFn);
        prefetchedKeys.add(key);
      } catch (error) {
        console.warn(`[Prefetch] Failed to prefetch ${key}:`, error);
      }
    },

    /**
     * Check if data is prefetched
     */
    isPrefetched: (key: string): boolean => prefetchedKeys.has(key),

    /**
     * Get data from cache or fetch it
     */
    get: <T>(key: string, requestFn: () => Promise<T>): Promise<T> => {
      return deduplicator.dedupe(key, requestFn);
    },

    /**
     * Clear prefetch cache
     */
    clear: () => {
      prefetchedKeys.clear();
      deduplicator.clear();
    },
  };
}
