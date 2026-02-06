import { vi, beforeEach } from "vitest";

/**
 * Create a complete D1 Database mock that matches Cloudflare D1 API
 * This ensures all database operations work correctly in tests
 */
export const createMockD1Database = () => {
  const createPreparedStatement = () => ({
    bind: vi.fn(function (this: any, ...params: any[]) {
      // Return a new bound statement
      return {
        run: vi.fn().mockResolvedValue({
          success: true,
          meta: { changes: 1, last_row_id: 1, duration: 0.1 },
        }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({
          results: [],
          success: true,
          meta: { duration: 0.1 },
        }),
        raw: vi.fn().mockResolvedValue([]),
      };
    }),
    run: vi.fn().mockResolvedValue({
      success: true,
      meta: { changes: 1, last_row_id: 1, duration: 0.1 },
    }),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({
      results: [],
      success: true,
      meta: { duration: 0.1 },
    }),
    raw: vi.fn().mockResolvedValue([]),
  });

  return {
    prepare: vi.fn((sql: string) => createPreparedStatement()),
    exec: vi.fn().mockResolvedValue({
      count: 0,
      duration: 0.1,
      results: [],
    }),
    batch: vi.fn().mockResolvedValue([
      {
        success: true,
        results: [],
        meta: { duration: 0.1 },
      },
    ]),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  };
};

// Mock Cloudflare D1 database instance
const mockDB = createMockD1Database();

// Mock Cloudflare KV
const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

// Mock environment with all required Env properties
export const mockEnv = {
  NODE_ENV: "development", // Use development mode to enable localhost CORS origins
  JWT_SECRET: "test-jwt-secret-key-for-testing-only",
  API_VERSION: "v1",
  ENCRYPTION_KEY: "test-encryption-key-for-testing-only-32chars", // For encrypting sensitive data
  DB: mockDB,
  CACHE_KV: mockKV,
  TOKEN_BLACKLIST: mockKV,
  IMAGES_BUCKET: {} as any,
  BACKUP_STORAGE: {} as any,
  JOB_QUEUE: {} as any,
  REALTIME_ORDERS: {} as any,
  ANALYTICS_ENGINE: {
    writeDataPoint: vi.fn(),
  } as any,
  RATE_LIMIT_KV: mockKV,
  REALTIME_SESSION: {} as any,
  SLACK_WEBHOOK_URL: "https://hooks.slack.com/test/webhook",
  API_BASE_URL: "http://localhost:8787",
  INTERNAL_API_TOKEN: "test-internal-token",
  CLOUDFLARE_IMAGES_KEY: "test-images-key",
  REALTIME_SERVICE_URL: "http://localhost:8788", // For realtime WebSocket service
  // CORS configuration for testing production-like origins
  DEV_CORS_ORIGINS:
    "https://customer.makanmakan.app,https://admin.makanmakan.app,https://kitchen.makanmakan.app,https://makanmakan.app",
};

// Mock Hono context
export const createMockContext = (overrides: Record<string, any> = {}) => ({
  env: mockEnv,
  req: {
    json: vi.fn(),
    query: vi.fn(),
    param: vi.fn(),
    header: vi.fn(),
    raw: {
      signal: null,
    },
  },
  json: vi.fn(),
  text: vi.fn(),
  html: vi.fn(),
  redirect: vi.fn(),
  header: vi.fn(),
  status: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  executionCtx: {
    waitUntil: vi.fn(),
  },
  ...overrides,
});

// Mock user for authenticated requests
export const mockUser = {
  id: 1,
  username: "testuser",
  role: 1, // Owner role
  restaurantId: "test-restaurant-1",
  email: "test@example.com",
};

// Mock admin user
export const mockAdminUser = {
  id: 999,
  username: "admin",
  role: 0, // Admin role
  restaurantId: undefined, // Admin has no specific restaurant (changed from null to undefined)
  email: "admin@example.com",
};

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
