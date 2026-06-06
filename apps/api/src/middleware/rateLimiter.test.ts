import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { rateLimitMiddleware } from "./rateLimiter";

function createKv() {
  const kv = new Map<string, string>();
  return {
    get: async (key: string, type?: "json") => {
      const value = kv.get(key);
      if (value == null) return null;
      return type === "json" ? JSON.parse(value) : value;
    },
    put: async (key: string, value: string) => {
      kv.set(key, value);
    },
    delete: async (key: string) => {
      kv.delete(key);
    },
    keys: () => Array.from(kv.keys()),
  };
}

function createApp(kv: ReturnType<typeof createKv>) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    const tenantId = c.req.header("x-test-tenant");
    if (tenantId) {
      c.set("tenant", {
        mode: "saas",
        tenantId,
        enforceSingleTenant: false,
      });
    }
    await next();
  });
  app.use(
    "*",
    rateLimitMiddleware({
      windowMs: 60_000,
      maxRequests: 1,
      keyPrefix: "tenant_test",
    }),
  );
  app.get("/", (c) => c.json({ success: true }));
  return app;
}

describe("rateLimitMiddleware", () => {
  it("limits by tenant identity before IP and isolates tenants sharing an IP", async () => {
    const kv = createKv();
    const app = createApp(kv);
    const env = { CACHE_KV: kv };

    const firstTenantA = await app.fetch(
      new Request("https://test/", {
        headers: { "x-test-tenant": "tenant-a" },
      }),
      env as never,
    );
    const secondTenantA = await app.fetch(
      new Request("https://test/", {
        headers: { "x-test-tenant": "tenant-a" },
      }),
      env as never,
    );
    const firstTenantB = await app.fetch(
      new Request("https://test/", {
        headers: { "x-test-tenant": "tenant-b" },
      }),
      env as never,
    );

    expect(firstTenantA.status).toBe(200);
    expect(secondTenantA.status).toBe(429);
    expect(firstTenantB.status).toBe(200);
    expect(kv.keys()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("tenant:tenant-a"),
        expect.stringContaining("tenant:tenant-b"),
      ]),
    );
  });
});
