/**
 * Mock D1Database for Testing
 * Provides a complete D1Database interface mock for unit tests
 */

import { vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";

/**
 * Creates a mock D1Database with all required methods
 * This mock satisfies the D1Database interface expected by drizzle(d1)
 */
export function createMockD1Database(): D1Database {
  // Create mock prepared statement
  const createMockPreparedStatement = () => ({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({
      results: [],
      success: true,
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: 0,
      },
    }),
    run: vi.fn().mockResolvedValue({
      success: true,
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: 0,
        changes: 0,
        last_row_id: 0,
      },
    }),
    raw: vi.fn().mockResolvedValue([]),
  });

  // Create mock D1Database object
  const mockD1: Partial<D1Database> = {
    prepare: vi.fn(() => createMockPreparedStatement()),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({
      count: 0,
      duration: 0,
      results: [],
    }),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  };

  return mockD1 as D1Database;
}

/**
 * Creates a mock Cloudflare environment with KV store
 */
export function createMockEnv(overrides: Partial<any> = {}) {
  return {
    DB: createMockD1Database(),
    CACHE_KV: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ keys: [] }),
    },
    JWT_SECRET: "test-secret-key",
    NODE_ENV: "test",
    ...overrides,
  };
}

/**
 * Creates a chainable mock for query builder pattern
 * Supports: select().from().where().limit().offset().leftJoin().innerJoin().orderBy()
 *
 * @param finalResult - The final result to return (can be overridden by chaining)
 * @returns A chainable mock object that resolves to finalResult
 */
export function createQueryChain(finalResult: any = []) {
  // Create a mock that can be awaited
  const mock: any = vi.fn().mockResolvedValue(finalResult);

  // Add all chainable methods - each method returns the mock object itself
  // This ensures proper chaining like db.select().from().leftJoin().where()
  const returnMock = () => mock;

  mock.from = vi.fn(returnMock);
  mock.where = vi.fn(returnMock);
  mock.limit = vi.fn(returnMock);
  mock.offset = vi.fn(returnMock);
  mock.leftJoin = vi.fn(returnMock);
  mock.rightJoin = vi.fn(returnMock);
  mock.innerJoin = vi.fn(returnMock);
  mock.fullJoin = vi.fn(returnMock);
  mock.orderBy = vi.fn(returnMock);
  mock.groupBy = vi.fn(returnMock);
  mock.having = vi.fn(returnMock);
  mock.distinct = vi.fn(returnMock);
  mock.returning = vi.fn().mockResolvedValue(finalResult);
  mock.get = vi
    .fn()
    .mockResolvedValue(
      Array.isArray(finalResult) ? finalResult[0] || null : finalResult,
    );
  mock.all = vi
    .fn()
    .mockResolvedValue(
      Array.isArray(finalResult) ? finalResult : [finalResult],
    );

  // Make it awaitable - resolve to finalResult
  mock.then = (resolve: any, reject: any) => {
    return Promise.resolve(finalResult).then(resolve, reject);
  };
  mock.catch = (reject: any) => {
    return Promise.resolve(finalResult).catch(reject);
  };
  mock.finally = (onFinally: any) => {
    return Promise.resolve(finalResult).finally(onFinally);
  };

  return mock;
}

/**
 * Creates a complete mock database with full Drizzle ORM support
 */
export function createMockDatabase() {
  const mockDb: any = {
    // Query Builder API
    select: vi.fn((fields?: any) => createQueryChain([])),
    insert: vi.fn((table: any) => ({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
        onConflictDoNothing: vi.fn().mockResolvedValue([]),
        onConflictDoUpdate: vi.fn().mockResolvedValue([]),
      }),
    })),
    update: vi.fn((table: any) => ({
      set: vi.fn().mockReturnValue(createQueryChain([])),
    })),
    delete: vi.fn((table: any) => createQueryChain([])),

    // Relational Query API
    query: {
      coupons: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      users: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      restaurants: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      menuItems: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      categories: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      orders: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      sessions: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    },

    // Transaction support - passes the same mock db to callback so test mock setups are preserved
    transaction: vi.fn(async (callback: any) => callback(mockDb)),
  };

  return mockDb;
}

/**
 * Helper to setup mock database responses for common operations
 * This allows tests to quickly configure mock behavior for different query types
 *
 * @example
 * ```typescript
 * setupMockDbResponses(mockDb, {
 *   select: [{ id: 1, name: 'Test' }],
 *   insert: [{ id: 2, name: 'New' }]
 * })
 * ```
 */
export function setupMockDbResponses(
  db: any,
  responses: {
    select?: any[];
    insert?: any[];
    update?: any[];
    delete?: any[];
  },
) {
  if (responses.select) {
    db.select.mockReturnValue(createQueryChain(responses.select));
  }

  if (responses.insert) {
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(responses.insert),
      }),
    });
  }

  if (responses.update) {
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue(createQueryChain(responses.update)),
    });
  }

  if (responses.delete) {
    db.delete.mockReturnValue(createQueryChain(responses.delete));
  }
}
