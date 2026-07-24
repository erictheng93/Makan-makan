import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { geoIntelligentRateLimitMiddleware } from "./geo-rate-limiting";
import type { Env } from "../types/env";

function createEnv(overrides: Partial<Env> = {}): Env {
  const rateLimitKv = {
    get: vi.fn(async () => null),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: "" })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null })),
  } as unknown as KVNamespace;

  return {
    NODE_ENV: "production",
    RATE_LIMIT_KV: rateLimitKv,
    ...overrides,
  } as Env;
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
  return app.fetch(new Request(`https://api.test${path}`, init), env, {
    executionCtx: createExecutionContext(),
  });
}

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
});
