import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import {
  inputSanitizationMiddleware,
  securityAwareRateLimitMiddleware,
} from "./security";
import type { Env } from "../types/env";

describe("inputSanitizationMiddleware", () => {
  it("leaves JSON body strings unchanged", async () => {
    const body = {
      token: "abc=def",
      url: "https://example.test/pay?sig=a=b",
      note: "<b>raw</b>",
    };
    const c = {
      req: {
        json: vi.fn(async () => body),
        header: vi.fn(() => "application/json"),
      },
    };
    const next = vi.fn(async () => undefined);

    await inputSanitizationMiddleware(c as never, next);

    await expect(c.req.json()).resolves.toEqual(body);
    expect(next).toHaveBeenCalledOnce();
  });
});

// This middleware is not currently registered (app-factory uses the
// geo-intelligent limiter), but it is exported, so its counters need to be
// correct for whoever turns it back on.
describe("securityAwareRateLimitMiddleware", () => {
  function createEnv() {
    const store = new Map<string, string>();
    return {
      NODE_ENV: "production",
      CACHE_KV: {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put: vi.fn(async (key: string, value: string) => {
          store.set(key, value);
        }),
      },
    } as unknown as Env;
  }

  function createApp() {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", securityAwareRateLimitMiddleware);
    app.get("/api/v1/menu", (c) => c.json({ ok: true }));
    app.post("/api/v1/auth/refresh", (c) => c.json({ ok: true }));
    return app;
  }

  function call(app: Hono<{ Bindings: Env }>, env: Env, path: string) {
    return app.fetch(
      new Request(`https://api.test${path}`, {
        method: path.includes("/auth/") ? "POST" : "GET",
        headers: { "CF-Connecting-IP": "203.0.113.10" },
      }),
      env,
    );
  }

  // Regression: the counter key used path.split("/")[1], so every /api/* route
  // shared one bucket while the limit still dropped to 10 on /auth/ paths.
  // Ordinary browsing therefore burned the auth allowance.
  it("does not let ordinary API traffic exhaust the sensitive-endpoint budget", async () => {
    const env = createEnv();
    const app = createApp();

    for (let i = 0; i < 15; i++) {
      const response = await call(app, env, "/api/v1/menu");
      expect(response.status).toBe(200);
    }

    const response = await call(app, env, "/api/v1/auth/refresh");
    expect(response.status).toBe(200);
  });

  it("still enforces the stricter limit within the sensitive bucket", async () => {
    const env = createEnv();
    const app = createApp();

    for (let i = 0; i < 10; i++) {
      const response = await call(app, env, "/api/v1/auth/refresh");
      expect(response.status).toBe(200);
    }

    const response = await call(app, env, "/api/v1/auth/refresh");
    expect(response.status).toBe(429);
  });

  it("scopes counters to a window so they reset instead of only climbing", async () => {
    const env = createEnv();
    const app = createApp();

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-28T00:00:00.000Z"));
      for (let i = 0; i < 10; i++) {
        await call(app, env, "/api/v1/auth/refresh");
      }
      expect((await call(app, env, "/api/v1/auth/refresh")).status).toBe(429);

      // Next minute: a fresh counter, not the previous one with its TTL pushed
      // forward by every write.
      vi.setSystemTime(new Date("2026-07-28T00:01:00.000Z"));
      expect((await call(app, env, "/api/v1/auth/refresh")).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });
});
