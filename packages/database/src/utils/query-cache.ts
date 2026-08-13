/**
 * Query Result Caching Utility
 * Provides transparent caching for frequent database queries
 * Target: 85%+ cache hit rate for read-heavy operations
 */

import type { KVNamespace } from "@cloudflare/workers-types";

export interface QueryCacheOptions {
  ttl: number; // Time to live in seconds
  tags?: string[]; // Cache tags for smart invalidation
  keyPrefix?: string; // Namespace for cache keys
}

export interface CachedQuery<T> {
  data: T;
  cached_at: number;
  expires_at: number;
}

/**
 * Query cache wrapper for KV-based caching
 */
export class QueryCache {
  constructor(private kv: KVNamespace | undefined) {}

  /**
   * Get cached query result or execute query function
   */
  async getOrExecute<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    options: QueryCacheOptions,
  ): Promise<T> {
    // If KV not available, execute query directly
    if (!this.kv) {
      return await queryFn();
    }

    try {
      // Try to get from cache
      const cached = await this.kv.get<CachedQuery<T>>(cacheKey, {
        type: "json",
      });

      if (cached && Date.now() < cached.expires_at) {
        // A hit is read-only on purpose. This used to fire an un-awaited
        // kv.put() writing the whole entry back to bump a hit counter nobody
        // consumed — and that stray write could land AFTER an invalidation
        // deleted the key, resurrecting a stale menu for up to the full TTL
        // (#82). It also cost one KV write (rate-limited to 1/s per key,
        // ~10x read pricing) on every read of the hottest keys.
        return cached.data;
      }

      // Cache miss - execute query
      const result = await queryFn();

      // Store in cache
      await this.set(cacheKey, result, options);

      return result;
    } catch (error) {
      console.error("Query cache error:", error);
      // Fallback to direct query execution
      return await queryFn();
    }
  }

  /**
   * Store query result in cache
   */
  private async set<T>(
    cacheKey: string,
    data: T,
    options: QueryCacheOptions,
  ): Promise<void> {
    if (!this.kv) return;

    const cached: CachedQuery<T> = {
      data,
      cached_at: Date.now(),
      expires_at: Date.now() + options.ttl * 1000,
    };

    try {
      await this.kv.put(cacheKey, JSON.stringify(cached), {
        expirationTtl: options.ttl,
        metadata: {
          tags: JSON.stringify(options.tags || []),
          created_at: Date.now().toString(),
        },
      });

      // Store tag mappings for invalidation
      if (options.tags?.length) {
        await this.updateTagMappings(cacheKey, options.tags);
      }
    } catch (error) {
      console.error("Failed to cache query result:", error);
    }
  }

  /**
   * Invalidate cache by key or tags
   */
  async invalidate(
    keyOrTags: string | string[],
    type: "key" | "tag" = "key",
  ): Promise<void> {
    if (!this.kv) return;

    try {
      if (type === "key") {
        await this.kv.delete(keyOrTags as string);
      } else {
        const tags = Array.isArray(keyOrTags) ? keyOrTags : [keyOrTags];

        // Get all keys for these tags
        const keysToInvalidate = new Set<string>();

        for (const tag of tags) {
          const taggedKeys = await this.kv.get<string[]>(`cache:tag:${tag}`, {
            type: "json",
          });
          if (taggedKeys) {
            taggedKeys.forEach((key: string) => keysToInvalidate.add(key));
          }
        }

        // Delete all tagged keys
        await Promise.allSettled(
          Array.from(keysToInvalidate).map((key) => this.kv!.delete(key)),
        );

        // Clean up tag mappings
        await Promise.allSettled(
          tags.map((tag) => this.kv!.delete(`cache:tag:${tag}`)),
        );
      }
    } catch (error) {
      console.error("Cache invalidation error:", error);
    }
  }

  /**
   * Update tag mappings for cache keys
   */
  private async updateTagMappings(
    cacheKey: string,
    tags: string[],
  ): Promise<void> {
    if (!this.kv) return;

    try {
      for (const tag of tags) {
        const tagKey = `cache:tag:${tag}`;
        const existingKeys =
          (await this.kv.get<string[]>(tagKey, { type: "json" })) || [];

        if (!existingKeys.includes(cacheKey)) {
          existingKeys.push(cacheKey);
          await this.kv.put(tagKey, JSON.stringify(existingKeys), {
            expirationTtl: 7 * 24 * 60 * 60, // 7 days
          });
        }
      }
    } catch (error) {
      console.error("Failed to update tag mappings:", error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    total_keys: number;
    hit_rate: number;
    popular_queries: Array<{ key: string; hits: number }>;
  }> {
    if (!this.kv) {
      return { total_keys: 0, hit_rate: 0, popular_queries: [] };
    }

    try {
      const stats = await this.kv.get<any>("cache:stats", { type: "json" });
      return stats || { total_keys: 0, hit_rate: 0, popular_queries: [] };
    } catch {
      return { total_keys: 0, hit_rate: 0, popular_queries: [] };
    }
  }
}

/**
 * Helper to build cache keys with consistent naming
 */
export function buildCacheKey(
  resource: string,
  identifier: string | number,
  suffix?: string,
): string {
  const key = `query:${resource}:${identifier}`;
  return suffix ? `${key}:${suffix}` : key;
}
