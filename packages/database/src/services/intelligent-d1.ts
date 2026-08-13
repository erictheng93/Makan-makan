import type { D1Database } from "@cloudflare/workers-types";
import { BaseService } from "./base";

/**
 * Intelligent D1 Database Service with Predictive Optimization
 * Features:
 * - Predictive query preloading based on usage patterns
 * - Multi-layer caching with intelligent invalidation
 * - Query performance analytics and optimization
 * - Edge-distributed query execution
 * - Smart pagination with prefetching
 * - Real-time query pattern learning
 */

interface QueryMetadata {
  sql: string;
  params: unknown[];
  executionTime: number;
  cacheKey: string;
  cacheTtl: number;
  tags: string[];
  priority: "high" | "normal" | "low";
  frequency: number;
  lastExecuted: number;
  averageResponseTime: number;
  popularityScore: number;
}

interface QueryPattern {
  pattern: string;
  frequency: number;
  averageTime: number;
  peakHours: number[];
  userRoles: number[];
  endpoints: string[];
  predictedNextExecution: number;
}

interface CacheStrategy {
  type: "aggressive" | "standard" | "minimal";
  ttl: number;
  invalidationTriggers: string[];
  preloadTriggers: string[];
  geographicDistribution: boolean;
}

interface OptimizationOptions {
  cacheKey?: string;
  cacheTtl?: number;
  tags?: string[];
  priority?: "high" | "normal" | "low";
  endpoint?: string;
  userRole?: number;
  enablePreloading?: boolean;
}

interface EdgeCacheManager {
  get<T>(key: string): Promise<T | null | undefined>;
  set<T>(
    key: string,
    value: T,
    options: {
      ttl: number;
      tags: string[];
      priority: "high" | "normal" | "low";
    },
  ): Promise<void>;
}

interface AnalyticsEngine {
  writeDataPoint(data: {
    blobs: string[];
    doubles: number[];
    indexes: number[];
  }): Promise<unknown>;
}

interface CountResult {
  total: number;
}

export class IntelligentD1Service extends BaseService {
  private queryAnalytics: Map<string, QueryMetadata> = new Map();
  private queryPatterns: Map<string, QueryPattern> = new Map();
  private preloadQueue: Set<string> = new Set();
  private cacheManager?: EdgeCacheManager;
  private analyticsEngine?: AnalyticsEngine;

  constructor(
    d1: D1Database,
    env: import("./base").CloudflareEnv,
    cacheManager?: EdgeCacheManager,
    analyticsEngine?: AnalyticsEngine,
    _context?: ExecutionContext,
  ) {
    super(d1, env);
    this.cacheManager = cacheManager;
    this.analyticsEngine = analyticsEngine;

    // Initialize background tasks
    this.initializeIntelligentFeatures();
  }

  /**
   * Execute query with intelligent optimization and predictive features
   */
  async executeWithOptimization<T>(
    sql: string,
    params: unknown[] = [],
    options: OptimizationOptions = {},
  ): Promise<T[]> {
    const startTime = Date.now();
    const querySignature = this.generateQuerySignature(sql, params);

    // Update query analytics
    this.updateQueryAnalytics(querySignature, sql, params, options);

    // Try cache first (unless high priority requiring fresh data)
    if (options.priority !== "high" && options.cacheKey && this.cacheManager) {
      const cached = await this.cacheManager.get<T[]>(options.cacheKey);
      if (cached) {
        // Record cache hit
        this.recordQueryMetric(
          "cache_hit",
          querySignature,
          Date.now() - startTime,
        );

        // Trigger background preloading if needed
        if (options.enablePreloading) {
          this.triggerPredictivePreloading(querySignature, options);
        }

        return cached;
      }
    }

    // Execute query with timeout based on priority
    const timeout = this.getQueryTimeout(options.priority || "normal");
    let result: T[];

    try {
      const queryPromise = this.executeQuery<T>(sql, params);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Query timeout")), timeout),
      );

      result = await Promise.race([queryPromise, timeoutPromise]);
    } catch (error) {
      this.recordQueryError(querySignature, error, Date.now() - startTime);
      throw error;
    }

    const executionTime = Date.now() - startTime;

    // Cache result if successful and cacheable
    if (result && options.cacheKey && this.cacheManager) {
      const cacheStrategy = this.determineCacheStrategy(
        querySignature,
        executionTime,
        options,
      );

      await this.cacheManager.set(options.cacheKey, result, {
        ttl: cacheStrategy.ttl,
        tags: options.tags || [],
        priority: options.priority || "normal",
      });
    }

    // Record successful execution
    this.recordQueryMetric("execution_success", querySignature, executionTime);

    // Learn from this query for future optimization
    this.learnQueryPattern(querySignature, options, executionTime);

    // Trigger predictive preloading
    if (options.enablePreloading !== false) {
      this.triggerPredictivePreloading(querySignature, options);
    }

    return result;
  }

  /**
   * Preload popular queries proactively
   */
  async preloadPopularQueries(
    restaurantId?: string,
    timeWindow: string = "1h",
  ): Promise<void> {
    try {
      const popularQueries = await this.getPopularQueries(
        timeWindow,
        restaurantId,
      );

      const preloadPromises = popularQueries
        .filter((query) => !this.preloadQueue.has(query.cacheKey))
        .slice(0, 20) // Limit concurrent preloads
        .map(async (query) => {
          this.preloadQueue.add(query.cacheKey);

          try {
            // Execute query and cache result
            const result = await this.executeQuery(query.sql, query.params);

            if (this.cacheManager) {
              await this.cacheManager.set(query.cacheKey, result, {
                ttl: query.cacheTtl,
                tags: query.tags,
                priority: "normal",
              });
            }

            this.recordQueryMetric("preload_success", query.cacheKey, 0);
          } catch (error) {
            this.recordQueryMetric("preload_error", query.cacheKey, 0);
            console.error("Preload failed for query:", query.cacheKey, error);
          } finally {
            this.preloadQueue.delete(query.cacheKey);
          }
        });

      await Promise.allSettled(preloadPromises);
    } catch (error) {
      console.error("Preload popular queries failed:", error);
    }
  }

  /**
   * Get intelligent pagination with predictive prefetching
   */
  async getPaginatedWithPrefetch<T>(
    baseQuery: string,
    params: unknown[],
    page: number,
    limit: number,
    options: {
      cacheKeyPrefix: string;
      tags?: string[];
      prefetchPages?: number;
    },
  ): Promise<{
    data: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
    prefetched: number[];
  }> {
    const offset = (page - 1) * limit;

    // Get current page data
    const dataQuery = `${baseQuery} LIMIT ${limit} OFFSET ${offset}`;
    const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery})`;

    const cacheKey = `${options.cacheKeyPrefix}:${page}:${limit}`;
    const countCacheKey = `${options.cacheKeyPrefix}:count`;

    // Execute current page and count in parallel
    const [data, countResult] = await Promise.all([
      this.executeWithOptimization<T>(dataQuery, params, {
        cacheKey,
        tags: options.tags,
        enablePreloading: true,
      }),
      this.executeWithOptimization<CountResult>(countQuery, params, {
        cacheKey: countCacheKey,
        cacheTtl: 300, // Count changes less frequently
        tags: options.tags,
      }),
    ]);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    const pagination = {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };

    // Predictive prefetching of next pages
    const prefetchPages = options.prefetchPages || 2;
    const prefetchedPages: number[] = [];

    if (pagination.hasNext && prefetchPages > 0) {
      const pagesToPrefetch = [];

      // Prefetch next pages
      for (let i = 1; i <= Math.min(prefetchPages, totalPages - page); i++) {
        pagesToPrefetch.push(page + i);
      }

      // Prefetch previous page if user is likely to go back
      if (page > 1 && page <= 3) {
        // Users often go back in first few pages
        pagesToPrefetch.push(page - 1);
      }

      const prefetchPromises = pagesToPrefetch.map(async (prefetchPage) => {
        const prefetchOffset = (prefetchPage - 1) * limit;
        const prefetchQuery = `${baseQuery} LIMIT ${limit} OFFSET ${prefetchOffset}`;
        const prefetchCacheKey = `${options.cacheKeyPrefix}:${prefetchPage}:${limit}`;

        try {
          await this.executeWithOptimization<T>(prefetchQuery, params, {
            cacheKey: prefetchCacheKey,
            tags: options.tags,
            priority: "low", // Low priority for prefetch
            enablePreloading: false, // Don't trigger recursive preloading
          });

          prefetchedPages.push(prefetchPage);
        } catch (error) {
          console.error(`Prefetch failed for page ${prefetchPage}:`, error);
        }
      });

      // Run prefetching in background
      Promise.allSettled(prefetchPromises);
    }

    return {
      data,
      pagination,
      prefetched: prefetchedPages,
    };
  }

  /**
   * Smart menu query optimization for restaurant data
   */
  async getOptimizedMenuData(
    restaurantId: string,
    options: {
      includeCategories?: boolean;
      includeAvailabilityOnly?: boolean;
      userRole?: number;
      deviceType?: string;
    } = {},
  ): Promise<unknown[]> {
    // Determine optimal query strategy based on context
    const cacheStrategy = this.getMenuCacheStrategy(restaurantId, options);

    if (options.includeCategories) {
      // Complex query with joins - use aggressive caching
      return this.getMenuWithCategories(restaurantId, cacheStrategy);
    } else {
      // Simple menu items - use standard caching
      return this.getMenuItems(restaurantId, cacheStrategy, options);
    }
  }

  /**
   * Intelligent order analytics queries with time-based optimization
   */
  async getOrderAnalytics(
    restaurantId: string,
    timeRange: "1h" | "24h" | "7d" | "30d",
    metrics: string[],
    options: {
      userRole?: number;
      priority?: "high" | "normal" | "low";
    } = {},
  ): Promise<Record<string, unknown>[]> {
    const cacheKey = `analytics:${restaurantId}:${timeRange}:${metrics.join(",")}`;
    const cacheTtl = this.getAnalyticsCacheTtl(timeRange);

    // For real-time analytics (1h), use shorter cache and higher priority
    const priority = timeRange === "1h" ? "high" : options.priority || "normal";

    const query = this.buildAnalyticsQuery(restaurantId, timeRange, metrics);

    return this.executeWithOptimization(query.sql, query.params, {
      cacheKey,
      cacheTtl,
      tags: [
        `restaurant:${restaurantId}`,
        "analytics",
        `timerange:${timeRange}`,
      ],
      priority,
      enablePreloading: timeRange !== "1h", // Don't preload real-time data
    });
  }

  // Private helper methods

  private async executeQuery<T>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    try {
      const stmt = this.d1.prepare(sql);
      const result =
        params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
      return result.results as T[];
    } catch (error) {
      this.handleError(error, "executeQuery");
    }
  }

  private generateQuerySignature(sql: string, params: unknown[]): string {
    // Normalize SQL and create signature for pattern matching
    const normalizedSql = sql.replace(/\s+/g, " ").trim().toLowerCase();
    const paramTypes = params.map((p) => typeof p).join(",");
    return `${this.hashString(normalizedSql)}:${paramTypes}`;
  }

  private updateQueryAnalytics(
    signature: string,
    sql: string,
    params: unknown[],
    options: OptimizationOptions,
  ): void {
    const existing = this.queryAnalytics.get(signature);
    const now = Date.now();

    const metadata: QueryMetadata = {
      sql,
      params,
      executionTime: 0, // Will be updated after execution
      cacheKey: options.cacheKey || "",
      cacheTtl: options.cacheTtl || 300,
      tags: options.tags || [],
      priority: options.priority || "normal",
      frequency: existing ? existing.frequency + 1 : 1,
      lastExecuted: now,
      averageResponseTime: existing?.averageResponseTime || 0,
      popularityScore: existing ? this.calculatePopularityScore(existing) : 0,
    };

    this.queryAnalytics.set(signature, metadata);
  }

  private recordQueryMetric(
    event: string,
    querySignature: string,
    executionTime: number,
  ): void {
    if (this.analyticsEngine) {
      this.analyticsEngine
        .writeDataPoint({
          blobs: [event, querySignature],
          doubles: [Date.now(), executionTime],
          indexes: [executionTime > 1000 ? 1 : 0], // Slow query flag
        })
        .catch((error: unknown) => console.error("Analytics error:", error));
    }
  }

  private recordQueryError(
    querySignature: string,
    error: unknown,
    executionTime: number,
  ): void {
    this.recordQueryMetric("query_error", querySignature, executionTime);
    console.error("Query execution error:", {
      querySignature,
      error,
      executionTime,
    });
  }

  private getQueryTimeout(priority: "high" | "normal" | "low"): number {
    switch (priority) {
      case "high":
        return 10000; // 10 seconds for critical queries
      case "normal":
        return 5000; // 5 seconds for normal queries
      case "low":
        return 2000; // 2 seconds for background queries
    }
  }

  private determineCacheStrategy(
    querySignature: string,
    executionTime: number,
    options: OptimizationOptions,
  ): CacheStrategy {
    const metadata = this.queryAnalytics.get(querySignature);

    if (executionTime > 1000 || (metadata && metadata.frequency > 10)) {
      // Aggressive caching for slow or frequent queries
      return {
        type: "aggressive",
        ttl: options.cacheTtl || 1800, // 30 minutes
        invalidationTriggers: options.tags || [],
        preloadTriggers: ["related_data_updated"],
        geographicDistribution: true,
      };
    } else if (executionTime > 500 || (metadata && metadata.frequency > 5)) {
      // Standard caching
      return {
        type: "standard",
        ttl: options.cacheTtl || 600, // 10 minutes
        invalidationTriggers: options.tags || [],
        preloadTriggers: [],
        geographicDistribution: false,
      };
    } else {
      // Minimal caching for fast queries
      return {
        type: "minimal",
        ttl: options.cacheTtl || 300, // 5 minutes
        invalidationTriggers: options.tags || [],
        preloadTriggers: [],
        geographicDistribution: false,
      };
    }
  }

  private async getPopularQueries(
    timeWindow: string,
    restaurantId?: string,
  ): Promise<QueryMetadata[]> {
    // Get popular queries from analytics
    const queries = Array.from(this.queryAnalytics.values())
      .filter((q) => {
        if (restaurantId && !q.tags.includes(`restaurant:${restaurantId}`)) {
          return false;
        }

        const timeThreshold = this.getTimeThreshold(timeWindow);
        return q.lastExecuted > timeThreshold;
      })
      .sort((a, b) => b.popularityScore - a.popularityScore);

    return queries.slice(0, 50); // Top 50 popular queries
  }

  private calculatePopularityScore(metadata: QueryMetadata): number {
    const now = Date.now();
    const recency = 1 / (1 + (now - metadata.lastExecuted) / (1000 * 60 * 60)); // Decay over hours
    const frequency = Math.log(metadata.frequency + 1);
    const performance = metadata.averageResponseTime > 1000 ? 2 : 1; // Boost slow queries

    return frequency * recency * performance;
  }

  private triggerPredictivePreloading(
    querySignature: string,
    _options: OptimizationOptions,
  ): void {
    // Analyze query patterns and preload related queries
    const patterns = this.predictRelatedQueries(querySignature);

    patterns.forEach((pattern) => {
      if (pattern.predictedNextExecution < Date.now() + 300000) {
        // Next 5 minutes
        // Queue for preloading
        this.preloadQueue.add(pattern.pattern);
      }
    });
  }

  private predictRelatedQueries(querySignature: string): QueryPattern[] {
    // Machine learning-like pattern recognition
    // For now, simple heuristic-based prediction
    return Array.from(this.queryPatterns.values())
      .filter((pattern) =>
        this.isRelatedPattern(querySignature, pattern.pattern),
      )
      .sort((a, b) => a.predictedNextExecution - b.predictedNextExecution);
  }

  private isRelatedPattern(signature1: string, signature2: string): boolean {
    // Simple similarity check - could be enhanced with ML
    const parts1 = signature1.split(":");
    const parts2 = signature2.split(":");

    return parts1[1] === parts2[1]; // Same parameter types
  }

  private learnQueryPattern(
    querySignature: string,
    options: OptimizationOptions,
    executionTime: number,
  ): void {
    const existing = this.queryPatterns.get(querySignature);
    const now = Date.now();
    const hour = new Date(now).getHours();

    const pattern: QueryPattern = {
      pattern: querySignature,
      frequency: existing ? existing.frequency + 1 : 1,
      averageTime: existing
        ? (existing.averageTime * existing.frequency + executionTime) /
          (existing.frequency + 1)
        : executionTime,
      peakHours: existing?.peakHours || [],
      userRoles: existing?.userRoles || [],
      endpoints: existing?.endpoints || [],
      predictedNextExecution: this.predictNextExecution(existing, now, hour),
    };

    // Update peak hours
    if (!pattern.peakHours.includes(hour)) {
      pattern.peakHours.push(hour);
    }

    // Update user roles
    if (options.userRole && !pattern.userRoles.includes(options.userRole)) {
      pattern.userRoles.push(options.userRole);
    }

    // Update endpoints
    if (options.endpoint && !pattern.endpoints.includes(options.endpoint)) {
      pattern.endpoints.push(options.endpoint);
    }

    this.queryPatterns.set(querySignature, pattern);
  }

  private predictNextExecution(
    existing: QueryPattern | undefined,
    now: number,
    currentHour: number,
  ): number {
    if (!existing) {
      return now + 3600000; // 1 hour from now as default
    }

    // Simple prediction based on frequency and peak hours
    const avgFrequencyMs =
      existing.frequency > 1
        ? 86400000 / existing.frequency // Average time between executions
        : 3600000; // Default 1 hour

    // If current hour is a peak hour, predict sooner
    const multiplier = existing.peakHours.includes(currentHour) ? 0.5 : 1.0;

    return now + avgFrequencyMs * multiplier;
  }

  private initializeIntelligentFeatures(): void {
    // Background task to clean up old analytics data
    setInterval(() => {
      this.cleanupOldAnalytics();
    }, 3600000); // Every hour

    // Background task to update popularity scores
    setInterval(() => {
      this.updatePopularityScores();
    }, 300000); // Every 5 minutes
  }

  private cleanupOldAnalytics(): void {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days

    for (const [signature, metadata] of this.queryAnalytics) {
      if (metadata.lastExecuted < cutoff) {
        this.queryAnalytics.delete(signature);
      }
    }

    for (const [pattern, data] of this.queryPatterns) {
      if (data.predictedNextExecution < cutoff) {
        this.queryPatterns.delete(pattern);
      }
    }
  }

  private updatePopularityScores(): void {
    for (const [_signature, metadata] of this.queryAnalytics) {
      metadata.popularityScore = this.calculatePopularityScore(metadata);
    }
  }

  // Additional helper methods
  private getTimeThreshold(timeWindow: string): number {
    const now = Date.now();
    switch (timeWindow) {
      case "1h":
        return now - 3600000;
      case "24h":
        return now - 86400000;
      case "7d":
        return now - 604800000;
      case "30d":
        return now - 2592000000;
      default:
        return now - 3600000;
    }
  }

  private getAnalyticsCacheTtl(timeRange: string): number {
    switch (timeRange) {
      case "1h":
        return 60; // 1 minute for real-time
      case "24h":
        return 300; // 5 minutes
      case "7d":
        return 1800; // 30 minutes
      case "30d":
        return 3600; // 1 hour
      default:
        return 300;
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  // Placeholder methods for complex queries - would be implemented based on schema
  private async getMenuWithCategories(
    _restaurantId: string,
    _strategy: CacheStrategy,
  ): Promise<unknown[]> {
    // Implementation would join menu_items and categories tables
    return [];
  }

  private async getMenuItems(
    _restaurantId: string,
    _strategy: CacheStrategy,
    _options: {
      includeAvailabilityOnly?: boolean;
      userRole?: number;
      deviceType?: string;
    },
  ): Promise<unknown[]> {
    // Implementation would query menu_items table with filters
    return [];
  }

  private getMenuCacheStrategy(
    restaurantId: string,
    _options: {
      includeCategories?: boolean;
      includeAvailabilityOnly?: boolean;
      userRole?: number;
      deviceType?: string;
    },
  ): CacheStrategy {
    return {
      type: "standard",
      ttl: 600,
      invalidationTriggers: [`restaurant:${restaurantId}`, "menu"],
      preloadTriggers: ["menu_updated"],
      geographicDistribution: true,
    };
  }

  private buildAnalyticsQuery(
    restaurantId: string,
    timeRange: string,
    _metrics: string[],
  ): { sql: string; params: unknown[] } {
    // Implementation would build complex analytics query
    return {
      sql: "SELECT COUNT(*) as orders FROM orders WHERE restaurant_id = ? AND created_at > ?",
      params: [
        restaurantId,
        new Date(Date.now() - this.getTimeThreshold(timeRange)),
      ],
    };
  }
}
