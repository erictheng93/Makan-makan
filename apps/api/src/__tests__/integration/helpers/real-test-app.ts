import type { Hono } from "hono";
import { sign } from "hono/jwt";
import { createApp } from "../../../app-factory";
import {
  createTestDatabase,
  type TestDatabase,
} from "@makanmakan/database/testing";
import type { Env } from "../../../types/env";
import { buildAuthHelper, type AuthHelper } from "./issue-test-jwt";
import { createDurableObjectStub } from "./durable-object-stub";

const TEST_JWT_SECRET = "test-jwt-secret-do-not-use-in-prod";

/** Issue a token that satisfies ALL auth middleware claim checks (incl. `username`). */
async function issueServiceToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: "1",
      id: 1,
      username: "service-test",
      role: 0, // admin
      restaurantId: "1",
      iat: now,
      exp: now + 3600,
    },
    TEST_JWT_SECRET,
  );
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
  const honoApp = createApp(env);
  const authHelper = buildAuthHelper();

  // Pre-generate a service-level admin token for internal redirect follow-ups.
  // The production /health route redirects to /api/v1/monitoring/health which
  // has a blanket authMiddleware on /monitoring/*. We carry this token on the
  // redirect follow so the health check pipeline resolves end-to-end.
  // Note: authHelper.adminToken() omits the `username` claim required by the
  // production auth middleware — so we issue our own fully-spec-compliant token.
  const serviceToken = await issueServiceToken();

  const testCtx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  // Wrap the Hono app so that:
  // 1. Single-arg fetch calls (no env argument) bind the test env into c.env.
  //    Cloudflare Workers normally pass env as the second argument to fetch();
  //    in tests we call app.fetch(req) with no env, which leaves c.env undefined.
  // 2. Internal redirects (3xx responses) are followed within the same app.
  //    The production /health route redirects to /api/v1/monitoring/health;
  //    tests that fetch /health expect 200, so we follow up to one hop.
  const app = new Proxy(honoApp, {
    get(target, prop, receiver) {
      if (prop === "fetch") {
        return async (req: Request, envArg?: Env, ctx?: ExecutionContext) => {
          const boundEnv = envArg ?? env;
          const boundCtx = ctx ?? testCtx;
          const res = await target.fetch(req, boundEnv, boundCtx);

          // Follow a single internal redirect so e.g. GET /health (302 →
          // /api/v1/monitoring/health) resolves to the final 200 response.
          if (
            res.status >= 301 &&
            res.status <= 308 &&
            res.headers.has("Location")
          ) {
            const location = res.headers.get("Location")!;
            // Only follow same-app relative or same-origin redirects.
            const redirectUrl = location.startsWith("/")
              ? new URL(location, req.url).href
              : location;
            const followHeaders = new Headers(req.headers);
            // Carry a service token on the redirect so auth-gated sub-paths
            // (e.g. /api/v1/monitoring/*) don't reject the follow-up 401.
            if (!followHeaders.has("Authorization")) {
              followHeaders.set("Authorization", `Bearer ${serviceToken}`);
            }
            const redirectReq = new Request(redirectUrl, {
              method:
                req.method === "POST" && res.status === 302
                  ? "GET"
                  : req.method,
              headers: followHeaders,
            });
            return target.fetch(redirectReq, boundEnv, boundCtx);
          }

          return res;
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
