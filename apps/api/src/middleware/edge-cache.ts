import { Context, Next } from "hono";
import type { Env } from "../types/env";

/**
 * Advanced Multi-Layer Edge Caching System
 * Layer 1: Cache API (5-20ms at edge nodes)
 * Layer 2: KV Store (50-200ms globally)
 * Layer 3: Database with intelligent preloading
 *
 * Expected Performance: 50-70% improvement on repeat requests
 */

export interface CacheOptions {
  ttl: number;
  tags?: string[];
  vary?: string[];
  revalidate?: boolean;
  priority?: "high" | "normal" | "low";
}

export interface CacheMetadata {
  key: string;
  value: unknown;
  cached_at: number;
  expires_at: number;
  tags: string[];
  hit_count: number;
  last_accessed: number;
}

interface CacheHealthMetrics {
  hit_rate: number;
  miss_rate: number;
  popular_keys: Array<{ key: string; hits: number }>;
  cache_size_estimate: number;
}

interface CachedResponseEnvelope {
  cached_at?: number;
  value?: unknown;
}

interface CacheableApiResponse {
  success: boolean;
  data?: unknown;
  [key: string]: unknown;
}

/**
 * Keep the global edge cache fail-closed. Only public GET routes with known
 * mutation invalidation keys belong here; security-sensitive reads such as
 * QR/booking verification must opt in explicitly if they ever become safe.
 */
export function isPublicApiCacheableRequest(
  method: string,
  path: string,
): boolean {
  if (method !== "GET") return false;

  const segments = path.split("/").filter(Boolean);
  if (segments[0] !== "api" || segments[1] !== "v1") return false;

  // These shapes mirror the exact keys invalidated by smartCacheMiddleware
  // after mutations. Do not broaden them to namespace prefixes: those also
  // contain authenticated analytics, market, and QR endpoints.
  const isRestaurantMenu =
    segments.length === 4 && segments[2] === "menu" && segments[3] !== "items";
  const isRestaurantDetail =
    segments.length === 4 &&
    segments[2] === "restaurants" &&
    segments[3] !== "popular";
  const isAvailableCoupons =
    segments.length === 5 &&
    segments[2] === "coupons" &&
    segments[3] === "available";

  return isRestaurantMenu || isRestaurantDetail || isAvailableCoupons;
}

function isCacheableApiResponse(data: unknown): data is CacheableApiResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { success?: unknown }).success === true &&
    "data" in data
  );
}

export class EdgeCacheManager {
  constructor(
    private kv: KVNamespace,
    private context: Pick<ExecutionContext, "waitUntil">,
    private env: Env,
  ) {}

  /**
   * Multi-layer cache retrieval with intelligent fallback
   */
  async get<T>(
    key: string,
    options: Partial<CacheOptions> = {},
  ): Promise<T | null> {
    const cacheKey = this.buildCacheKey(key, options.vary);

    try {
      // LAYER 1: Cache API (Ultra-fast edge cache)
      const cacheResponse = await caches.default.match(cacheKey);
      if (
        cacheResponse &&
        !cacheResponse.headers.get("cf-cache-status")?.includes("MISS")
      ) {
        const data = (await cacheResponse.json()) as CachedResponseEnvelope;

        // Update hit count asynchronously
        this.context.waitUntil(this.incrementHitCount(key));

        // Proactive revalidation for high-priority content
        if (
          options.priority === "high" &&
          data.cached_at !== undefined &&
          this.shouldRevalidate(data.cached_at)
        ) {
          this.context.waitUntil(this.revalidateInBackground(key, options));
        }

        return data.value as T;
      }

      // LAYER 2: KV Store (Global distributed cache)
      const kvData = await this.kv.get<CacheMetadata>(key, { type: "json" });
      if (kvData && !this.isExpired(kvData)) {
        const value = kvData.value as T;

        // Populate Cache API for next request (warm the edge)
        this.context.waitUntil(
          this.populateCacheAPI(cacheKey, kvData, options.ttl || 300),
        );

        // Update access metadata
        this.context.waitUntil(this.updateAccessMetadata(key, kvData));

        return value;
      }

      // LAYER 3: Cache miss - trigger intelligent preloading
      if (this.shouldPreload(key)) {
        this.context.waitUntil(this.triggerPreloadJob(key, options));
      }

      return null;
    } catch (error) {
      console.error("Edge cache retrieval error:", error);
      // Graceful degradation - return null to trigger fresh fetch
      return null;
    }
  }

  /**
   * Multi-layer cache storage with intelligent distribution
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = { ttl: 300 },
  ): Promise<void> {
    const metadata: CacheMetadata = {
      key,
      value,
      cached_at: Date.now(),
      expires_at: Date.now() + options.ttl * 1000,
      tags: options.tags || [],
      hit_count: 0,
      last_accessed: Date.now(),
    };

    const cacheKey = this.buildCacheKey(key, options.vary);

    try {
      // Parallel storage across all cache layers
      const storagePromises = [
        // Store in KV with metadata
        this.kv.put(key, JSON.stringify(metadata), {
          expirationTtl: options.ttl,
          metadata: {
            tags: JSON.stringify(options.tags || []),
            priority: options.priority || "normal",
          },
        }),

        // Store in Cache API with optimized headers
        caches.default.put(
          cacheKey,
          new Response(JSON.stringify(metadata), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": `max-age=${options.ttl}, s-maxage=${options.ttl}`,
              Vary: options.vary?.join(", ") || "",
              "CF-Cache-Tag": options.tags?.join(",") || "",
              "X-Cache-Priority": options.priority || "normal",
              "X-Cache-Timestamp": Date.now().toString(),
            },
          }),
        ),
      ];

      // Store tag mappings for selective invalidation
      if (options.tags?.length) {
        storagePromises.push(this.updateTagMappings(key, options.tags));
      }

      await Promise.allSettled(storagePromises);

      // Analytics: Track cache storage
      this.context.waitUntil(
        this.recordCacheMetric("cache_set", key, {
          ttl: options.ttl,
          tags_count: options.tags?.length || 0,
          priority: options.priority || "normal",
        }),
      );
    } catch (error) {
      console.error("Edge cache storage error:", error);
      throw new Error(`Failed to cache data for key: ${key}`);
    }
  }

  /**
   * Intelligent cache invalidation with tag support
   */
  async invalidate(
    keyOrTags: string | string[],
    type: "key" | "tag" = "key",
  ): Promise<void> {
    try {
      if (type === "key") {
        const key = keyOrTags as string;
        const cacheKey = this.buildCacheKey(key);

        // Parallel invalidation
        await Promise.allSettled([
          this.kv.delete(key),
          caches.default.delete(cacheKey),
        ]);

        this.context.waitUntil(
          this.recordCacheMetric("cache_invalidate_key", key),
        );
      } else if (type === "tag") {
        const tags = Array.isArray(keyOrTags) ? keyOrTags : [keyOrTags];

        // Get all keys associated with tags
        const keysToInvalidate = new Set<string>();

        for (const tag of tags) {
          const taggedKeys =
            (await this.kv.get<string[]>(`tag:${tag}`, { type: "json" })) || [];
          taggedKeys.forEach((key) => keysToInvalidate.add(key));
        }

        // Batch invalidation
        const invalidationPromises = Array.from(keysToInvalidate).map((key) =>
          this.invalidate(key, "key"),
        );

        await Promise.allSettled(invalidationPromises);

        this.context.waitUntil(
          this.recordCacheMetric("cache_invalidate_tags", tags.join(","), {
            keys_count: keysToInvalidate.size,
          }),
        );
      }
    } catch (error) {
      console.error("Cache invalidation error:", error);
    }
  }

  /**
   * Cache health monitoring and optimization
   */
  async getHealthMetrics(): Promise<{
    hit_rate: number;
    miss_rate: number;
    popular_keys: Array<{ key: string; hits: number }>;
    cache_size_estimate: number;
  }> {
    try {
      const metrics = await this.kv.get<CacheHealthMetrics>(
        "cache:health:metrics",
        {
          type: "json",
        },
      );
      return (
        metrics || {
          hit_rate: 0,
          miss_rate: 0,
          popular_keys: [],
          cache_size_estimate: 0,
        }
      );
    } catch (error) {
      console.error("Failed to get cache health metrics:", error);
      return {
        hit_rate: 0,
        miss_rate: 0,
        popular_keys: [],
        cache_size_estimate: 0,
      };
    }
  }

  // Private helper methods
  private buildCacheKey(key: string, vary?: string[]): string {
    if (!vary?.length) return `https://cache.makanmakan.app/${key}`;

    const varyString = vary.join("-");
    return `https://cache.makanmakan.app/${key}?vary=${varyString}`;
  }

  private isExpired(metadata: CacheMetadata): boolean {
    return Date.now() > metadata.expires_at;
  }

  private shouldRevalidate(cachedAt: number): boolean {
    const age = Date.now() - cachedAt;
    const maxAge = 5 * 60 * 1000; // 5 minutes
    return age > maxAge;
  }

  private shouldPreload(key: string): boolean {
    // Preload for restaurant menu items, popular queries
    return (
      key.includes("menu:") ||
      key.includes("restaurant:") ||
      key.includes("popular:")
    );
  }

  private async populateCacheAPI(
    cacheKey: string,
    metadata: CacheMetadata,
    ttl: number,
  ): Promise<void> {
    try {
      await caches.default.put(
        cacheKey,
        new Response(JSON.stringify(metadata), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": `max-age=${ttl}`,
            "X-Populated-From": "KV",
            "X-Population-Time": Date.now().toString(),
          },
        }),
      );
    } catch (error) {
      console.error("Failed to populate Cache API:", error);
    }
  }

  private async incrementHitCount(key: string): Promise<void> {
    try {
      const metadata = await this.kv.get<CacheMetadata>(key, { type: "json" });
      if (metadata) {
        metadata.hit_count += 1;
        metadata.last_accessed = Date.now();
        await this.kv.put(key, JSON.stringify(metadata));
      }
    } catch (error) {
      console.error("Failed to increment hit count:", error);
    }
  }

  private async updateAccessMetadata(
    key: string,
    metadata: CacheMetadata,
  ): Promise<void> {
    try {
      metadata.hit_count += 1;
      metadata.last_accessed = Date.now();
      await this.kv.put(key, JSON.stringify(metadata));
    } catch (error) {
      console.error("Failed to update access metadata:", error);
    }
  }

  private async updateTagMappings(key: string, tags: string[]): Promise<void> {
    try {
      const promises = tags.map(async (tag) => {
        const taggedKeys =
          (await this.kv.get<string[]>(`tag:${tag}`, { type: "json" })) || [];
        if (!taggedKeys.includes(key)) {
          taggedKeys.push(key);
          await this.kv.put(`tag:${tag}`, JSON.stringify(taggedKeys), {
            expirationTtl: 24 * 60 * 60, // 24 hours
          });
        }
      });

      await Promise.allSettled(promises);
    } catch (error) {
      console.error("Failed to update tag mappings:", error);
    }
  }

  async triggerPreloadJob(
    key: string,
    options: Partial<CacheOptions>,
  ): Promise<void> {
    try {
      // Queue preload job for background processing
      await this.env.PRELOAD_QUEUE?.send({
        key,
        options,
        triggered_at: Date.now(),
        priority: options.priority || "normal",
      });
    } catch (error) {
      console.error("Failed to trigger preload job:", error);
    }
  }

  private async revalidateInBackground(
    key: string,
    options: Partial<CacheOptions>,
  ): Promise<void> {
    try {
      // Queue revalidation job
      await this.env.REVALIDATION_QUEUE?.send({
        key,
        options,
        revalidate_at: Date.now(),
      });
    } catch (error) {
      console.error("Failed to queue revalidation:", error);
    }
  }

  private async recordCacheMetric(
    event: string,
    key: string,
    _additional?: Record<string, unknown>,
  ): Promise<void> {
    try {
      if (this.env.ANALYTICS_ENGINE) {
        await this.env.ANALYTICS_ENGINE.writeDataPoint({
          blobs: [event, key],
          doubles: [Date.now()],
          indexes: ["1"], // Count
        });
      }
    } catch (error) {
      console.error("Failed to record cache metric:", error);
    }
  }
}

/**
 * Smart caching middleware with automatic optimization
 */
export function smartCacheMiddleware(
  options: {
    defaultTtl?: number;
    varyHeaders?: string[];
    cacheTags?: (c: Context<{ Bindings: Env }>) => string[];
    shouldCache?: (c: Context<{ Bindings: Env }>) => boolean;
  } = {},
) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const cacheManager = new EdgeCacheManager(
      c.env.CACHE_KV,
      c.executionCtx,
      c.env,
    );

    const method = c.req.method;
    const path = c.req.path;
    const query = c.req.url.includes("?") ? c.req.url.split("?")[1] : "";
    const cacheKey = `${method}:${path}:${query}`;

    // shouldCache decides whether this request should be cached, but we still
    // need to run mutations through the rest of the middleware so the
    // post-mutation invalidation block fires. Track the decision but never
    // early-exit for non-GET methods.
    const cacheable = options.shouldCache ? options.shouldCache(c) : true;

    // For cacheable GET requests, try cache first (skip for authenticated requests)
    const hasAuth = !!c.req.header("Authorization");
    if (cacheable && method === "GET" && !hasAuth) {
      const vary = options.varyHeaders
        ?.map((header) => c.req.header(header) || "")
        .filter(Boolean);

      const cached = await cacheManager.get(cacheKey, {
        vary,
        priority: path.includes("/popular/") ? "high" : "normal",
      });

      if (cached) {
        // Cache hit - return cached response as-is (it's the full response object)
        // Spread it to avoid double-wrapping
        return c.json({
          ...(cached as Record<string, unknown>),
          cached: true,
          cache_hit: true,
        });
      }
    }

    // Cache miss or non-GET request - execute handler
    await next();

    // Invalidate related caches on successful mutations (non-blocking)
    if (
      ["POST", "PUT", "DELETE", "PATCH"].includes(method) &&
      c.res.status >= 200 &&
      c.res.status < 300
    ) {
      const restaurantId =
        c.req.param("restaurantId") || c.get("user")?.restaurantId;

      // Synchronously invalidate both cache tiers before the response goes
      // out — fire-and-forget invalidation lost races against the next GET
      // and left clients reading stale menus immediately after a write.
      // Both KV and Cache API must be cleared; the earlier code only touched
      // KV "to avoid local-dev hangs".
      if (restaurantId) {
        const kv = c.env.CACHE_KV;
        if (kv) {
          // Build the list of cache keys that this mutation should invalidate.
          // Each entry mirrors a public GET endpoint that smartCacheMiddleware
          // serves out of cache for unauthenticated readers.
          const keys: string[] = [];

          if (path.includes("/menu")) {
            keys.push(
              `GET:/api/v1/menu/${restaurantId}:`,
              `GET:/api/v1/menu/${restaurantId}:includeAll=true`,
            );
          }
          if (path.includes("/coupons")) {
            keys.push(`GET:/api/v1/coupons/available/${restaurantId}:`);
          }
          if (path.includes("/restaurants") || path.includes("/menu")) {
            keys.push(`GET:/api/v1/restaurants/${restaurantId}:`);
          }

          if (keys.length > 0) {
            await Promise.allSettled(
              keys.flatMap((key) => [
                kv.delete(key),
                // Cache API delete uses the same URL the cache writer built
                // via EdgeCacheManager.buildCacheKey — must match exactly.
                caches.default.delete(`https://cache.makanmakan.app/${key}`),
              ]),
            );
          }
        }
      }
    }

    // Cache successful GET responses (skip authenticated requests for real-time data)
    if (cacheable && method === "GET" && c.res.status === 200 && !hasAuth) {
      try {
        const responseData = await c.res.clone().json();

        if (isCacheableApiResponse(responseData)) {
          const tags = options.cacheTags ? options.cacheTags(c) : [];
          const ttl = options.defaultTtl || 300;
          const vary = options.varyHeaders
            ?.map((header) => c.req.header(header) || "")
            .filter(Boolean);

          await cacheManager.set(cacheKey, responseData, {
            ttl,
            tags,
            vary,
            priority: path.includes("/popular/") ? "high" : "normal",
          });
        }
      } catch (error) {
        console.error("Failed to cache response:", error);
      }
    }
  };
}

/**
 * Cache warming middleware for predictive optimization
 */
export function cacheWarmingMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const cacheManager = new EdgeCacheManager(
      c.env.CACHE_KV,
      c.executionCtx,
      c.env,
    );

    // Predictive warming based on request patterns
    const path = c.req.path;
    const restaurantId = c.req.param("restaurantId");

    // Warm related endpoints
    if (path.includes("/menu/") && restaurantId) {
      c.executionCtx.waitUntil(
        cacheManager.triggerPreloadJob(`menu:${restaurantId}:popular`, {
          ttl: 600,
          tags: [`restaurant:${restaurantId}`, "menu", "popular"],
          priority: "high",
        }),
      );
    }

    await next();
  };
}

declare module "hono" {
  interface ContextVariableMap {
    cacheManager: EdgeCacheManager;
  }
}
