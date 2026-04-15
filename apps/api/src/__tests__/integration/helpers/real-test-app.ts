import type { Hono } from "hono";
import { createApp } from "../../../app-factory";
import {
  createTestDatabase,
  type TestDatabase,
} from "@makanmakan/database/testing";
import type { Env } from "../../../types/env";
import { buildAuthHelper, type AuthHelper } from "./issue-test-jwt";
import { createDurableObjectStub } from "./durable-object-stub";

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
  const authHelper = buildAuthHelper();

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
    NODE_ENV: "test",
    JWT_SECRET: "test-jwt-secret-do-not-use-in-prod",
    API_VERSION: "v1",
    ENCRYPTION_KEY: "test-encryption-key-32-bytes-long!!",
    DB: testDb.bindings.DB,
    CACHE_KV: testDb.bindings.CACHE_KV,
    TOKEN_BLACKLIST: testDb.bindings.TOKEN_BLACKLIST,
    RATE_LIMIT_KV: testDb.bindings.RATE_LIMIT_KV,
    IMAGES_BUCKET: testDb.bindings.IMAGES_BUCKET,
    BACKUP_STORAGE: testDb.bindings.BACKUP_STORAGE,
    JOB_QUEUE: { send: async () => {} } as any,
    PRELOAD_QUEUE: { send: async () => {} } as any,
    REVALIDATION_QUEUE: { send: async () => {} } as any,
    REALTIME_ORDERS: createDurableObjectStub(),
    REALTIME_SESSION: createDurableObjectStub(),
    ANALYTICS_ENGINE: { writeDataPoint: () => {} },
    // MOCK_DRIZZLE_DB deliberately omitted
  } as Env;
}
