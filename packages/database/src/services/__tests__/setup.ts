/**
 * Test Setup for Database Services
 * Mocks drizzle-orm to work with test mocks
 */

import { vi, beforeEach } from "vitest";

// Mock drizzle-orm/d1 module
vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn((d1: any) => {
    // Return the mock database object as-is
    // This allows tests to directly control the database behavior
    return d1;
  }),
}));

// Mock connection manager
vi.mock("../../utils/connection-manager", () => ({
  getConnectionManager: vi.fn(() => ({
    getConnection: vi.fn(),
    releaseConnection: vi.fn(),
    closeAll: vi.fn(),
    executeQuery: vi.fn((queryFn: () => Promise<any>) => queryFn()),
    getMetrics: vi.fn(() => ({
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageResponseTime: 0,
    })),
  })),
}));

// Mock query cache - Must be a proper class mock
// QueryCache is used with 'new QueryCache(env.CACHE_KV)' in BaseService
vi.mock("../../utils/query-cache", () => {
  // Create a proper ES6 class mock that can be instantiated with 'new'
  class MockQueryCache {
    constructor(_kv: any) {
      // Constructor - accepts KV namespace
    }

    async getOrExecute<T>(
      _cacheKey: string,
      queryFn: () => Promise<T>,
      _options: any,
    ): Promise<T> {
      // Execute the query function directly (bypass cache in tests)
      return await queryFn();
    }

    async invalidate(
      _keyOrTags: string | string[],
      _type: "key" | "tag" = "key",
    ): Promise<void> {
      // No-op in tests
    }

    async getStats(): Promise<{
      total_keys: number;
      hit_rate: number;
      popular_queries: Array<{ key: string; hits: number }>;
    }> {
      return { total_keys: 0, hit_rate: 0, popular_queries: [] };
    }
  }

  return {
    QueryCache: MockQueryCache,
    buildCacheKey: (
      _resource: string,
      _identifier: string | number,
      _suffix?: string,
    ) => {
      const key = `query:${_resource}:${_identifier}`;
      return _suffix ? `${key}:${_suffix}` : key;
    },
  };
});

// Clear all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
