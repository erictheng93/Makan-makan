import { Hono } from "hono";
import { sign } from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import {
  GeoIntelligentRateLimiter,
  geoIntelligentRateLimitMiddleware,
} from "./geo-rate-limiting";
import type { CustomRateLimit } from "./geo-rate-limiting";
import type { Env } from "../types/env";

const JWT_SECRET = "test-secret-for-rate-limit-identity-32b";

/**
 * `KVNamespace["get"]` is overloaded, and the bulk `string[]` overload is the
 * last one — which is the only signature `vi.mocked()` can see through
 * `env.RATE_LIMIT_KV.get`. Tests that inspect or drive the counter reads take
 * the mock from here instead, where it still carries the single-key signature
 * the rate limiter actually calls.
 */
type RateLimitKvGet = (
  key: string,
  options?: KVNamespaceGetOptions<undefined>,
) => Promise<string | null>;

function createRateLimitKv() {
  const get = vi.fn<RateLimitKvGet>(async () => null);
  const namespace = {
    get,
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: "" })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null })),
  } as unknown as KVNamespace;

  return { get, namespace };
}

function createEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: "production",
    RATE_LIMIT_KV: createRateLimitKv().namespace,
    ...overrides,
  } as Env;
}

class MemoryKV {
  store = new Map<string, string>();

  get = vi.fn(async (key: string, options?: { type?: string }) => {
    const value = this.store.get(key) ?? null;
    return options?.type === "json" && value ? JSON.parse(value) : value;
  });

  put = vi.fn(async (key: string, value: string) => {
    this.store.set(key, value);
  });

  delete = vi.fn(async (key: string) => {
    this.store.delete(key);
  });
}

function createMemoryEnv(kv = new MemoryKV()): Env {
  return createEnv({
    JWT_SECRET,
    RATE_LIMIT_KV: kv as unknown as KVNamespace,
  });
}

function createApp(env: Env) {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", geoIntelligentRateLimitMiddleware());
  app.get("/api/v1/menu", (c) => c.json({ ok: true }));
  return app;
}

function createExecutionContext(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    props: {},
  } as unknown as ExecutionContext;
}

function fetchWithContext(
  app: Hono<{ Bindings: Env }>,
  env: Env,
  path: string,
  init: RequestInit = {},
) {
  return app.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    createExecutionContext(),
  );
}

function createToken(sub: string, role = 0): string {
  return sign(
    {
      sub,
      username: `user-${sub.slice(-4)}`,
      role,
    },
    JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "1h",
    },
  );
}

function createRateLimitedApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.use(
    "*",
    geoIntelligentRateLimitMiddleware({
      customLimits: {
        "/api/v1/auth/login": {
          requests: 1,
          windowSeconds: 60,
          burstMultiplier: 1,
          blockDuration: 60,
        },
        "/api/v1/auth/register-staff": {
          requests: 1,
          windowSeconds: 60,
          burstMultiplier: 1,
          blockDuration: 60,
        },
      },
    }),
  );
  app.post("/api/v1/auth/login", (c) => c.json({ ok: true }));
  app.post("/api/v1/auth/register-staff", (c) => c.json({ ok: true }));
  return app;
}

function post(
  app: Hono<{ Bindings: Env }>,
  env: Env,
  path: string,
  token?: string,
) {
  return app.fetch(
    new Request(`https://api.test${path}`, {
      method: "POST",
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
        "CF-Connecting-IP": "203.0.113.10",
        "User-Agent": "vitest-rate-limit-client",
      },
    }),
    env,
    createExecutionContext(),
  );
}

describe("GeoIntelligentRateLimiter", () => {
  it("classifies staff registration as authenticated management writes", () => {
    const limiter = new GeoIntelligentRateLimiter(
      new MemoryKV() as unknown as KVNamespace,
      undefined,
      { waitUntil: vi.fn() },
      createMemoryEnv(),
    );

    const request = new Request("https://api.test/api/v1/auth/register-staff", {
      method: "POST",
      headers: { "User-Agent": "vitest-rate-limit-client" },
    });

    const limit = limiter.calculateDynamicRateLimit(
      request,
      "/api/v1/auth/register-staff",
    );

    expect(limit).toMatchObject({
      requests: 30,
      windowSeconds: 300,
      burstMultiplier: 1,
      blockDuration: 60,
    });
  });

  it("keeps anonymous registration on the stricter auth tier", () => {
    const limiter = new GeoIntelligentRateLimiter(
      new MemoryKV() as unknown as KVNamespace,
      undefined,
      { waitUntil: vi.fn() },
      createMemoryEnv(),
    );

    const request = new Request("https://api.test/api/v1/auth/register", {
      method: "POST",
      headers: { "User-Agent": "vitest-rate-limit-client" },
    });

    const limit = limiter.calculateDynamicRateLimit(
      request,
      "/api/v1/auth/register",
    );

    expect(limit).toMatchObject({
      requests: 2,
      windowSeconds: 60,
      burstMultiplier: 1.2,
      blockDuration: 300,
    });
  });
});

describe("geoIntelligentRateLimitMiddleware", () => {
  it("uses the native Rate Limit binding without KV operations", async () => {
    const nativeLimiter = {
      limit: vi.fn(async () => ({ success: true })),
    } as unknown as RateLimit;
    const env = createEnv({ GLOBAL_RATE_LIMITER: nativeLimiter });
    const response = await fetchWithContext(
      createApp(env),
      env,
      "/api/v1/menu",
      {
        headers: {
          "CF-Connecting-IP": "203.0.113.10",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(nativeLimiter.limit).toHaveBeenCalledWith({
      key: "ip:203.0.113.10:/api/v1/menu",
    });
    expect(env.RATE_LIMIT_KV.get).not.toHaveBeenCalled();
    expect(env.RATE_LIMIT_KV.put).not.toHaveBeenCalled();
  });

  it("falls back to KV rate limiting when no native binding is configured", async () => {
    const env = createEnv();
    const response = await fetchWithContext(
      createApp(env),
      env,
      "/api/v1/menu",
      {
        headers: {
          "CF-Connecting-IP": "203.0.113.10",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(env.RATE_LIMIT_KV.get).toHaveBeenCalled();
    expect(env.RATE_LIMIT_KV.put).toHaveBeenCalled();
  });

  it("keeps sensitive auth paths on the KV limiter", async () => {
    const nativeLimiter = {
      limit: vi.fn(async () => ({ success: true })),
    } as unknown as RateLimit;
    const env = createEnv({ GLOBAL_RATE_LIMITER: nativeLimiter });
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", geoIntelligentRateLimitMiddleware());
    app.post("/api/v1/auth/login", (c) => c.json({ ok: true }));

    const response = await fetchWithContext(app, env, "/api/v1/auth/login", {
      method: "POST",
      headers: {
        "CF-Connecting-IP": "203.0.113.10",
      },
    });

    expect(response.status).toBe(200);
    expect(nativeLimiter.limit).not.toHaveBeenCalled();
    expect(env.RATE_LIMIT_KV.get).toHaveBeenCalled();
    expect(env.RATE_LIMIT_KV.put).toHaveBeenCalled();
  });

  // Regression: the sliding window used to keep one KV key per second and read
  // every key in the window, so /api/v1/auth/login (a 60s window) cost 60 blocking
  // KV reads per request. The window is now two fixed buckets, so the read count
  // must stay flat no matter how long the window is.
  it("reads a bounded number of counter keys regardless of window length", async () => {
    const rateLimitKv = createRateLimitKv();
    const env = createEnv({ RATE_LIMIT_KV: rateLimitKv.namespace });
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", geoIntelligentRateLimitMiddleware());
    app.post("/api/v1/auth/login", (c) => c.json({ ok: true }));

    await fetchWithContext(app, env, "/api/v1/auth/login", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.10" },
    });

    const counterReads = rateLimitKv.get.mock.calls
      .map(([key]) => key)
      .filter((key) => key.startsWith("rl:"));

    expect(counterReads).toHaveLength(2);
    // The old per-second key shape must not come back.
    expect(counterReads.every((key) => key.startsWith("rl:"))).toBe(true);
  });

  it("weights the previous window so the limit still trips across a boundary", async () => {
    // login allows 100 requests with a 1.2 burst multiplier => burst limit 120.
    // Put 200 in the previous window and none in the current one. Even at the
    // very start of a window the interpolated total must exceed the limit.
    const rateLimitKv = createRateLimitKv();
    const env = createEnv({ RATE_LIMIT_KV: rateLimitKv.namespace });
    rateLimitKv.get.mockImplementation(async (key) => {
      if (!key.startsWith("rl:")) return null;
      const windowIndex = Number(key.split(":").pop());
      const currentIndex = Math.floor(Date.now() / 60_000);
      return windowIndex === currentIndex - 1 ? "200" : "0";
    });

    const app = new Hono<{ Bindings: Env }>();
    app.use("*", geoIntelligentRateLimitMiddleware());
    app.post("/api/v1/auth/login", (c) => c.json({ ok: true }));

    const response = await fetchWithContext(app, env, "/api/v1/auth/login", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.11" },
    });

    expect(response.status).toBe(429);
  });

  it("uses verified bearer-token identity before route auth runs", async () => {
    const env = createMemoryEnv();
    const app = createRateLimitedApp();
    const firstActor = createToken("01890f3a-1111-7111-8111-111111111111");
    const secondActor = createToken("01890f3a-2222-7222-8222-222222222222");

    expect(
      (await post(app, env, "/api/v1/auth/register-staff", firstActor)).status,
    ).toBe(200);
    expect(
      (await post(app, env, "/api/v1/auth/register-staff", firstActor)).status,
    ).toBe(429);
    expect(
      (await post(app, env, "/api/v1/auth/register-staff", secondActor)).status,
    ).toBe(200);
  });

  it("scopes KV fallback counters by endpoint path", async () => {
    const env = createMemoryEnv();
    const app = createRateLimitedApp();
    const token = createToken("01890f3a-3333-7333-8333-333333333333");

    expect((await post(app, env, "/api/v1/auth/login", token)).status).toBe(
      200,
    );
    expect(
      (await post(app, env, "/api/v1/auth/register-staff", token)).status,
    ).toBe(200);
  });
});

// #339: `customLimits` was a plain object lookup keyed by the full request
// path, so any key naming a mount prefix rather than a registered route could
// never fire. These pin the resolution rules that replaced it.
describe("geoIntelligentRateLimitMiddleware custom limit resolution", () => {
  const window = { windowSeconds: 60, burstMultiplier: 1, blockDuration: 60 };

  /**
   * `X-RateLimit-Limit` carries `rateLimit.requests` verbatim once a custom
   * limit is applied, so it is the observable for "which entry won". The
   * generic tier multiplies its base by geo/endpoint risk, hence the odd
   * request counts below — they cannot collide with a computed fallback.
   */
  async function limitHeaderFor(
    customLimits: Record<string, CustomRateLimit>,
    path: string,
    skipPaths?: string[],
  ): Promise<string | null> {
    const env = createEnv({
      GLOBAL_RATE_LIMITER: {
        limit: vi.fn(async () => ({ success: true })),
      } as unknown as RateLimit,
    });
    const app = new Hono<{ Bindings: Env }>();
    app.use(
      "*",
      geoIntelligentRateLimitMiddleware({ customLimits, skipPaths }),
    );
    app.all("*", (c) => c.json({ ok: true }));

    const response = await fetchWithContext(app, env, path, {
      headers: { "CF-Connecting-IP": "203.0.113.10" },
    });
    expect(response.status).toBe(200);
    return response.headers.get("X-RateLimit-Limit");
  }

  it("keeps an exact entry off sub-paths", async () => {
    const limits = { "/api/v1/orders": { requests: 37, ...window } };

    expect(await limitHeaderFor(limits, "/api/v1/orders")).toBe("37");
    expect(await limitHeaderFor(limits, "/api/v1/orders/o-1/status")).not.toBe(
      "37",
    );
  });

  it("applies a prefix entry to sub-paths", async () => {
    const limits = {
      "/api/v1/integrations/webhooks": {
        requests: 41,
        ...window,
        match: "prefix" as const,
      },
    };

    expect(
      await limitHeaderFor(limits, "/api/v1/integrations/webhooks/uber-eats"),
    ).toBe("41");
    expect(
      await limitHeaderFor(limits, "/api/v1/integrations/webhooks/foodpanda"),
    ).toBe("41");
    expect(await limitHeaderFor(limits, "/api/v1/integrations/webhooks")).toBe(
      "41",
    );
  });

  it("prefers the longest prefix key", async () => {
    const limits = {
      "/api/v1/orders": { requests: 37, ...window, match: "prefix" as const },
      "/api/v1/orders/group": {
        requests: 43,
        ...window,
        match: "prefix" as const,
      },
    };

    expect(await limitHeaderFor(limits, "/api/v1/orders/group/g-1")).toBe("43");
    expect(await limitHeaderFor(limits, "/api/v1/orders/o-1")).toBe("37");
  });

  it("prefers an exact entry over a covering prefix entry", async () => {
    const limits = {
      "/api/v1/orders": { requests: 37, ...window, match: "prefix" as const },
      "/api/v1/orders/stats": { requests: 43, ...window },
    };

    expect(await limitHeaderFor(limits, "/api/v1/orders/stats")).toBe("43");
  });

  it("matches a prefix only on a path-segment boundary", async () => {
    const limits = {
      "/api/v1/orders": { requests: 37, ...window, match: "prefix" as const },
    };

    expect(await limitHeaderFor(limits, "/api/v1/orders-archive")).not.toBe(
      "37",
    );
  });

  // The one the issue asked to pin hardest: health endpoints are polled by
  // dashboards and alerting, so nothing under /api/v1/system may inherit a
  // tight bucket. `skipPaths` is what guarantees it — the substring match on
  // "/health" short-circuits before the custom limit lookup runs.
  it("never rate limits health paths, even under a covering prefix entry", async () => {
    const env = createEnv({
      GLOBAL_RATE_LIMITER: {
        limit: vi.fn(async () => ({ success: true })),
      } as unknown as RateLimit,
    });
    const app = new Hono<{ Bindings: Env }>();
    app.use(
      "*",
      geoIntelligentRateLimitMiddleware({
        skipPaths: ["/health", "/info"],
        customLimits: {
          "/api/v1/system": { requests: 1, ...window, match: "prefix" },
        },
      }),
    );
    app.all("*", (c) => c.json({ ok: true }));

    for (const path of [
      "/api/v1/system/health",
      "/api/v1/system/health/ready",
      "/api/v1/monitoring/health",
    ]) {
      const response = await fetchWithContext(app, env, path, {
        headers: { "CF-Connecting-IP": "203.0.113.10" },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBeNull();
    }
    expect(env.GLOBAL_RATE_LIMITER?.limit).not.toHaveBeenCalled();
  });
});
