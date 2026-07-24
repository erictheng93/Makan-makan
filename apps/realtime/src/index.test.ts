import { describe, expect, it, vi } from "vitest";
import worker from "./index";
import type { Env } from "./types/env";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

function createEnv(input?: {
  corsOrigin?: string;
  durableFetch?: (request: Request) => Response | Promise<Response>;
  rateLimitValue?: string | null;
  rateLimitEnabled?: boolean;
  rateLimitGet?: () => Promise<string | null>;
}): Env {
  const durableObject = {
    fetch: vi.fn(
      input?.durableFetch ??
        (() => jsonResponse({ ok: true, fromDurableObject: true })),
    ),
  };

  return {
    ENVIRONMENT: "test",
    API_VERSION: "1",
    CORS_ORIGIN: input?.corsOrigin,
    JWT_SECRET: "secret",
    RATE_LIMIT_ENABLED: input?.rateLimitEnabled ? "true" : "false",
    REALTIME_SESSION: {
      idFromName: vi.fn((name: string) => ({ name })),
      get: vi.fn(() => durableObject),
    } as unknown as DurableObjectNamespace,
    RATE_LIMIT_KV: {
      get: vi.fn(
        input?.rateLimitGet ?? (async () => input?.rateLimitValue ?? null),
      ),
      put: vi.fn(async () => undefined),
    } as unknown as KVNamespace,
    CACHE_KV: {} as KVNamespace,
    TOKEN_BLACKLIST: {} as KVNamespace,
    DB: {} as D1Database,
  };
}

describe("realtime worker routes", () => {
  it("returns health metadata with the current environment", async () => {
    const response = await worker.fetch(
      new Request("https://realtime.test/health"),
      createEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "healthy",
      service: "makanmakan-realtime",
      environment: "test",
    });
  });

  it("allows CORS origins configured through env", async () => {
    const response = await worker.fetch(
      new Request("https://realtime.test/health", {
        headers: {
          Origin: "https://custom.example.com",
        },
      }),
      createEnv({
        corsOrigin:
          "https://makanmasak.com, https://custom.example.com,https://admin.makanmasak.com",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://custom.example.com",
    );
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
      "true",
    );
  });

  it("does not set CORS allow-origin for unconfigured origins", async () => {
    const response = await worker.fetch(
      new Request("https://realtime.test/health", {
        headers: {
          Origin: "https://blocked.example.com",
        },
      }),
      createEnv({
        corsOrigin: "https://makanmasak.com",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("forwards customer websocket requests to the room Durable Object", async () => {
    const env = createEnv();
    const response = await worker.fetch(
      new Request("https://realtime.test/customer/table-1"),
      env,
    );

    expect(response.status).toBe(200);
    expect(env.REALTIME_SESSION.idFromName).toHaveBeenCalledWith(
      "customer:table-1",
    );
    const durable = vi.mocked(env.REALTIME_SESSION.get).mock.results[0]
      .value as { fetch: ReturnType<typeof vi.fn> };
    expect(durable.fetch).toHaveBeenCalledWith(expect.any(Request));
  });

  it("forwards admin and kitchen websocket requests to matching Durable Objects", async () => {
    const adminEnv = createEnv();
    const adminResponse = await worker.fetch(
      new Request("https://realtime.test/admin/restaurant-1"),
      adminEnv,
    );

    expect(adminResponse.status).toBe(200);
    expect(adminEnv.REALTIME_SESSION.idFromName).toHaveBeenCalledWith(
      "admin:restaurant-1",
    );

    const kitchenEnv = createEnv();
    const kitchenResponse = await worker.fetch(
      new Request("https://realtime.test/kitchen/restaurant-1"),
      kitchenEnv,
    );

    expect(kitchenResponse.status).toBe(200);
    expect(kitchenEnv.REALTIME_SESSION.idFromName).toHaveBeenCalledWith(
      "kitchen:restaurant-1",
    );
  });

  it("enforces websocket rate limits before opening a Durable Object", async () => {
    const env = createEnv({
      rateLimitEnabled: true,
      rateLimitValue: "30",
    });
    const response = await worker.fetch(
      new Request("https://realtime.test/customer/table-1", {
        headers: {
          Upgrade: "websocket",
          "CF-Connecting-IP": "203.0.113.10",
        },
      }),
      env,
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(env.REALTIME_SESSION.get).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: "REALTIME_RATE_LIMITED",
      limit: 30,
    });
  });

  it("returns a 503 when websocket rate-limit storage is unavailable", async () => {
    const env = createEnv({
      rateLimitEnabled: true,
      rateLimitGet: async () => {
        throw new Error("kv unavailable");
      },
    });

    const response = await worker.fetch(
      new Request("https://realtime.test/kitchen/restaurant-1", {
        headers: {
          Upgrade: "websocket",
          "CF-Connecting-IP": "203.0.113.10",
        },
      }),
      env,
    );

    expect(response.status).toBe(503);
    expect(env.REALTIME_SESSION.get).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "Realtime rate limit unavailable",
      code: "REALTIME_RATE_LIMIT_UNAVAILABLE",
    });
  });

  it("does not expose public broadcast or stats Durable Object helpers", async () => {
    const env = createEnv();

    const broadcastResponse = await worker.fetch(
      new Request("https://realtime.test/broadcast/admin/restaurant-1", {
        method: "POST",
        body: JSON.stringify({ type: "NEW_ORDER" }),
      }),
      env,
    );
    const statsResponse = await worker.fetch(
      new Request("https://realtime.test/stats/kitchen/restaurant-1"),
      env,
    );

    expect(broadcastResponse.status).toBe(404);
    expect(statsResponse.status).toBe(404);
    expect(env.REALTIME_SESSION.idFromName).not.toHaveBeenCalled();
    expect(env.REALTIME_SESSION.get).not.toHaveBeenCalled();
  });

  it("returns a descriptive JSON 404 for unknown realtime endpoints", async () => {
    const response = await worker.fetch(
      new Request("https://realtime.test/missing"),
      createEnv(),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "Realtime endpoint not found",
      path: "/missing",
      availableEndpoints: [
        "/customer/:tableId",
        "/admin/:restaurantId",
        "/kitchen/:restaurantId",
        "/health",
      ],
    });
  });
});
