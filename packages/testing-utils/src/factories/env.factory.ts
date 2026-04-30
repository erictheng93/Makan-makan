/**
 * Env Factory for Cloudflare Worker Environment Mocks
 *
 * 集中管理最常被重複使用的 mock：Cloudflare Worker Env 物件。
 * 不繼承 BaseFactory（因為 Env 不是資料模型，而是需要 vi.fn() 的基礎設施 mock）。
 */

import { vi } from "vitest";

// ---------------------------------------------------------------------------
// D1 Database Mock
// ---------------------------------------------------------------------------

/**
 * 建立 D1 Database mock，符合 Cloudflare D1 API
 *
 * 基於 `apps/api/src/__tests__/setup.ts` 中的模式，
 * 提供 prepare / exec / batch / dump 等完整操作。
 */
export const createMockD1Database = () => {
  const createPreparedStatement = () => ({
    bind: vi.fn(function (this: any, ..._params: any[]) {
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
    prepare: vi.fn((_sql: string) => createPreparedStatement()),
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

// ---------------------------------------------------------------------------
// KV Namespace Mock
// ---------------------------------------------------------------------------

/**
 * 建立 KV Namespace mock，提供 get / put / delete / list 操作
 */
export const createMockKV = () => ({
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
});

// ---------------------------------------------------------------------------
// Env Factory
// ---------------------------------------------------------------------------

/**
 * Cloudflare Worker Env 工廠
 *
 * 提供三種預設配置：
 * - `build()`        — 完整 Env mock（包含所有綁定與環境變數）
 * - `buildMinimal()` — 最小化 Env（僅 DB 與必要環境變數）
 * - `buildRealtime()` — 即時通訊服務專用 Env
 */
export const envFactory = {
  /**
   * 完整 Cloudflare Env mock
   *
   * 包含 DB、KV、R2、Durable Objects、Analytics Engine 等所有綁定。
   */
  build(overrides?: Record<string, any>) {
    const mockDB = createMockD1Database();
    const mockKV = createMockKV();

    return {
      NODE_ENV: "development",
      JWT_SECRET: "test-jwt-secret-key-for-testing-only",
      REALTIME_JWT_SECRET: "test-realtime-jwt-secret-key-for-testing",
      API_VERSION: "v1",
      ENCRYPTION_KEY: "test-encryption-key-for-testing-only-32chars",
      DB: mockDB,
      CACHE_KV: mockKV,
      TOKEN_BLACKLIST: mockKV,
      IMAGES_BUCKET: {},
      BACKUP_STORAGE: {},
      JOB_QUEUE: {},
      REALTIME_ORDERS: {},
      ANALYTICS_ENGINE: { writeDataPoint: vi.fn() },
      RATE_LIMIT_KV: mockKV,
      REALTIME_SESSION: {},
      SLACK_WEBHOOK_URL: "https://hooks.slack.com/test/webhook",
      API_BASE_URL: "http://localhost:8787",
      INTERNAL_API_TOKEN: "test-internal-token",
      CLOUDFLARE_IMAGES_KEY: "test-images-key",
      REALTIME_SERVICE_URL: "http://localhost:8788",
      DEV_CORS_ORIGINS:
        "https://customer.makanmakan.app,https://admin.makanmakan.app,https://kitchen.makanmakan.app,https://makanmakan.app",
      ...overrides,
    };
  },

  /**
   * 最小化 Env mock
   *
   * 僅包含 DB 與必要環境變數，適用於單元測試不需要完整綁定的場景。
   */
  buildMinimal(overrides?: Record<string, any>) {
    const mockDB = createMockD1Database();

    return {
      NODE_ENV: "test",
      JWT_SECRET: "test-jwt-secret-key-for-testing-only",
      REALTIME_JWT_SECRET: "test-realtime-jwt-secret-key-for-testing",
      API_VERSION: "v1",
      ENCRYPTION_KEY: "test-encryption-key-for-testing-only-32chars",
      DB: mockDB,
      ...overrides,
    };
  },

  /**
   * 即時通訊服務專用 Env mock
   *
   * 包含 WebSocket / Durable Objects 相關綁定與限流設定。
   */
  buildRealtime(overrides?: Record<string, any>) {
    const mockDB = createMockD1Database();
    const mockKV = createMockKV();

    return {
      REALTIME_SESSION: {},
      DB: mockDB,
      CACHE_KV: mockKV,
      TOKEN_BLACKLIST: mockKV,
      RATE_LIMIT_KV: mockKV,
      JWT_SECRET: "test-jwt-secret-key-for-testing-only",
      REALTIME_JWT_SECRET: "test-realtime-jwt-secret-key-for-testing",
      ENVIRONMENT: "test",
      API_VERSION: "v1",
      RATE_LIMIT_ENABLED: "false",
      ...overrides,
    };
  },
};

// ---------------------------------------------------------------------------
// Hono Context Mock
// ---------------------------------------------------------------------------

/**
 * 建立 Hono Context mock
 *
 * 預設使用 `envFactory.build()` 作為 env，可透過 overrides 覆寫任何屬性。
 */
export const createMockContext = (overrides: Record<string, any> = {}) => ({
  env: envFactory.build(),
  req: {
    json: vi.fn(),
    query: vi.fn(),
    param: vi.fn(),
    header: vi.fn(),
    raw: { signal: null },
  },
  json: vi.fn(),
  text: vi.fn(),
  html: vi.fn(),
  redirect: vi.fn(),
  header: vi.fn(),
  status: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  executionCtx: { waitUntil: vi.fn() },
  ...overrides,
});
