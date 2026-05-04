import type { Hono } from "hono";
import { createApp } from "../../../app-factory";
import {
  createTestDatabase,
  type TestDatabase,
} from "@makanmasak/database/testing";
import type { Env } from "../../../types/env";
import { buildAuthHelper, type AuthHelper } from "./issue-test-jwt";
import { createDurableObjectStub } from "./durable-object-stub";

type TestCachesGlobal = typeof globalThis & {
  caches?: {
    default: {
      match: () => Promise<undefined>;
      put: () => Promise<void>;
      delete: () => Promise<boolean>;
    };
  };
};

// Workers Cache API global stub. The production middleware
// `cacheWarmingMiddleware` (apps/api/src/middleware/edge-cache.ts)
// fires `caches.default.delete(...)` after any successful POST/PUT/
// DELETE/PATCH whose path matches /menu, /coupons, or /restaurants.
// In a deployed Worker `caches` is a workerd global; in the Node-side
// vitest runner it is undefined, and the synchronous property access
// throws ReferenceError BEFORE the `await Promise.allSettled(...)` has
// a chance to catch it — leaving the handler to return 500 even
// though the D1 write already committed.
//
// Installing a tiny stub on globalThis makes every `caches.default.*`
// call a no-op in tests. The real cache-invalidation logic is covered
// by unit tests against edge-cache.ts; there is no value in exercising
// it in the real-integration layer, and the Node test runner has no
// Cache API to invalidate anyway.
const testGlobal = globalThis as TestCachesGlobal;
if (typeof testGlobal.caches === "undefined") {
  testGlobal.caches = {
    default: {
      match: async () => undefined,
      put: async () => {},
      delete: async () => false,
    },
  };
}

export interface RealIntegrationTestApp {
  app: Hono<{ Bindings: Env }>;
  testDb: TestDatabase;
  env: Env;
  authHelper: AuthHelper;
  dispose(): Promise<void>;
}

export async function createRealIntegrationTestApp(): Promise<RealIntegrationTestApp> {
  const testDb = await createTestDatabase();
  const env = buildTestEnv(testDb);
  const honoApp = createApp(env, {
    disableEdgeCache: true,
    disableObservability: true,
  });
  const authHelper = buildAuthHelper(env.DB);

  const testCtx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  // Hono's `fetch` signature in Cloudflare Workers is `fetch(req, env, ctx)`.
  // In tests we usually call `app.fetch(req)` with no env argument, which would
  // leave `c.env` undefined and break every middleware that reads bindings.
  // This proxy rebinds single-arg fetch calls with the test env + a stub ctx,
  // while still letting callers pass their own env/ctx if they want to.
  const app = new Proxy(honoApp, {
    get(target, prop, receiver) {
      if (prop === "fetch") {
        return async (req: Request, envArg?: Env, ctx?: ExecutionContext) => {
          return target.fetch(req, envArg ?? env, ctx ?? testCtx);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as typeof honoApp;

  return {
    app,
    testDb,
    env,
    authHelper,
    dispose: async () => {
      await testDb.dispose();
    },
  };
}

function buildTestEnv(testDb: TestDatabase): Env {
  return {
    // Intentionally "development", not "test". The
    // geoIntelligentRateLimitMiddleware skips rate limiting when
    // NODE_ENV === "development" (see geo-rate-limiting.ts:707) — its
    // comment explicitly names the integration test suite as the reason.
    // Setting this to "test" trips the rate limiter and returns 429 on
    // later tests in the same file, since miniflare's RATE_LIMIT_KV is
    // shared across tests and isn't reset by truncateAll().
    // The single production consumer that gates on NODE_ENV === "test"
    // (UnifiedQueueService MockDrizzle fallback) checks MOCK_DRIZZLE_DB
    // first, which we deliberately leave undefined below.
    NODE_ENV: "development",
    JWT_SECRET: "test-jwt-secret-do-not-use-in-prod",
    API_VERSION: "v1",
    ENCRYPTION_KEY: "test-encryption-key-32-bytes-long!!",
    DB: testDb.bindings.DB,
    CACHE_KV: testDb.bindings.CACHE_KV,
    TOKEN_BLACKLIST: testDb.bindings.TOKEN_BLACKLIST,
    RATE_LIMIT_KV: testDb.bindings.RATE_LIMIT_KV,
    IMAGES_BUCKET: testDb.bindings.IMAGES_BUCKET,
    BACKUP_STORAGE: testDb.bindings.BACKUP_STORAGE,
    JOB_QUEUE: { send: async () => {} } as never,
    PRELOAD_QUEUE: { send: async () => {} } as never,
    REVALIDATION_QUEUE: { send: async () => {} } as never,
    REALTIME_ORDERS: createDurableObjectStub(),
    REALTIME_SESSION: createDurableObjectStub(),
    ANALYTICS_ENGINE: { writeDataPoint: () => {} },
    // MOCK_DRIZZLE_DB deliberately omitted
  } as Env;
}
