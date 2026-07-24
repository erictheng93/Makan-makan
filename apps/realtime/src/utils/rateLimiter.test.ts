import { describe, expect, it } from "vitest";
import { checkRealtimeRateLimit, rateLimitResponse } from "./rateLimiter";
import type { Env } from "../types/env";

class MemoryKV {
  values = new Map<string, string>();
  ttls = new Map<string, number>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void> {
    if (options?.expirationTtl !== undefined && options.expirationTtl < 60) {
      throw new Error("KV expirationTtl must be at least 60 seconds");
    }
    this.values.set(key, value);
    if (options?.expirationTtl !== undefined) {
      this.ttls.set(key, options.expirationTtl);
    }
  }
}

function createEnv(kv: MemoryKV, enabled = "true"): Env {
  return {
    REALTIME_SESSION: {} as DurableObjectNamespace,
    DB: {} as D1Database,
    CACHE_KV: {} as KVNamespace,
    TOKEN_BLACKLIST: {} as KVNamespace,
    RATE_LIMIT_KV: kv as unknown as KVNamespace,
    JWT_SECRET: "x".repeat(32),
    ENVIRONMENT: "test",
    API_VERSION: "v1",
    RATE_LIMIT_ENABLED: enabled,
  };
}

describe("checkRealtimeRateLimit", () => {
  it("increments connection attempts per room and client address", async () => {
    const kv = new MemoryKV();
    const request = new Request("https://realtime.example/customer/t1", {
      headers: { "CF-Connecting-IP": "203.0.113.10" },
    });

    const decision = await checkRealtimeRateLimit(
      request,
      createEnv(kv),
      { roomType: "customer", roomId: "t1" },
      1_000,
    );

    expect(decision.allowed).toBe(true);
    expect(decision.count).toBe(1);
    expect(kv.values.get(decision.key)).toBe("1");
  });

  it("uses a Cloudflare KV-compatible minimum expiration TTL", async () => {
    const kv = new MemoryKV();
    const request = new Request("https://realtime.example/customer/t1", {
      headers: { "CF-Connecting-IP": "203.0.113.10" },
    });

    const decision = await checkRealtimeRateLimit(
      request,
      createEnv(kv),
      { roomType: "customer", roomId: "t1" },
      59_000,
    );

    expect(decision.allowed).toBe(true);
    expect(decision.retryAfterSeconds).toBe(1);
    expect(kv.ttls.get(decision.key)).toBe(60);
  });

  it("resets the attempt count when KV contains a malformed counter", async () => {
    const kv = new MemoryKV();
    const request = new Request("https://realtime.example/customer/t1", {
      headers: { "CF-Connecting-IP": "203.0.113.10" },
    });
    kv.values.set("ws-rate:customer:t1:203.0.113.10:0", "not-a-number");

    const decision = await checkRealtimeRateLimit(
      request,
      createEnv(kv),
      { roomType: "customer", roomId: "t1" },
      1_000,
    );

    expect(decision.allowed).toBe(true);
    expect(decision.count).toBe(1);
    expect(kv.values.get(decision.key)).toBe("1");
  });

  it("rejects customer websocket upgrades after the per-minute limit", async () => {
    const kv = new MemoryKV();
    const request = new Request("https://realtime.example/customer/t1", {
      headers: { "CF-Connecting-IP": "203.0.113.10" },
    });

    let decision = await checkRealtimeRateLimit(
      request,
      createEnv(kv),
      { roomType: "customer", roomId: "t1" },
      1_000,
    );

    for (let i = 0; i < 30; i++) {
      decision = await checkRealtimeRateLimit(
        request,
        createEnv(kv),
        { roomType: "customer", roomId: "t1" },
        1_000,
      );
    }

    expect(decision.allowed).toBe(false);
    expect(decision.count).toBe(31);
    expect(decision.limit).toBe(30);

    const response = rateLimitResponse(decision);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe(
      String(decision.retryAfterSeconds),
    );
  });

  it("allows all attempts when realtime rate limiting is disabled", async () => {
    const kv = new MemoryKV();
    const request = new Request("https://realtime.example/customer/t1");

    const decision = await checkRealtimeRateLimit(
      request,
      createEnv(kv, "false"),
      { roomType: "customer", roomId: "t1" },
      1_000,
    );

    expect(decision.allowed).toBe(true);
    expect(kv.values.size).toBe(0);
  });
});
