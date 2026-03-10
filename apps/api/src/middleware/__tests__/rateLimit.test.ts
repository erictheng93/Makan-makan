/**
 * Rate Limit Middleware Tests
 * 速率限制中間件測試
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  rateLimitMiddleware,
  strictRateLimit,
  authRateLimit,
  apiRateLimit,
  publicRateLimit,
} from "../rateLimit";
import { mockEnv } from "../../__tests__/setup";

describe("Rate Limit Middleware", () => {
  let app: Hono<{ Bindings: typeof mockEnv }>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.CACHE_KV.get.mockResolvedValue(null);
    mockEnv.CACHE_KV.put.mockResolvedValue(undefined);

    app = new Hono<{ Bindings: typeof mockEnv }>();
    // Inject env into context properly
    app.use("*", async (c, next) => {
      // @ts-ignore - Inject env for testing
      c.env = mockEnv;
      await next();
    });
  });

  describe("Basic Rate Limiting", () => {
    it("should allow requests under the limit", async () => {
      app.use("*", rateLimitMiddleware({ maxRequests: 100, windowMs: 60000 }));
      app.get("/test", (c) => c.json({ success: true }));

      mockEnv.CACHE_KV.get.mockResolvedValue("5"); // 5 requests made

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "10.0.0.1" },
      });

      const res = await app.request(req, { env: mockEnv } as any);

      expect(res.status).toBe(200);
    });

    it("should block requests over the limit", async () => {
      app.use("*", rateLimitMiddleware({ maxRequests: 10, windowMs: 60000 }));
      app.get("/test", (c) => c.json({ success: true }));

      mockEnv.CACHE_KV.get.mockResolvedValue("10"); // At limit

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "10.0.0.1" },
      });

      const res = await app.request(req, { env: mockEnv } as any);
      const result = (await res.json()) as any;

      expect(res.status).toBe(429);
      expect(result.error).toBe("Too many requests");
    });

    it("should include rate limit headers", async () => {
      app.use("*", rateLimitMiddleware({ maxRequests: 100, windowMs: 60000 }));
      app.get("/test", (c) => c.json({ success: true }));

      mockEnv.CACHE_KV.get.mockResolvedValue("50");

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "10.0.0.1" },
      });

      const res = await app.request(req, { env: mockEnv } as any);

      expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("49");
      expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
    });

    it("should include Retry-After header when rate limited", async () => {
      app.use("*", rateLimitMiddleware({ maxRequests: 10, windowMs: 60000 }));
      app.get("/test", (c) => c.json({ success: true }));

      mockEnv.CACHE_KV.get.mockResolvedValue("10");

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "10.0.0.1" },
      });

      const res = await app.request(req, { env: mockEnv } as any);

      expect(res.headers.get("Retry-After")).toBeTruthy();
    });
  });

  describe("IP Detection", () => {
    it("should use cf-connecting-ip header", async () => {
      app.use("*", rateLimitMiddleware({ maxRequests: 100, windowMs: 60000 }));
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "10.0.0.100" },
      });

      await app.request(req, { env: mockEnv } as any);

      expect(mockEnv.CACHE_KV.get).toHaveBeenCalledWith(
        expect.stringContaining("10.0.0.100"),
      );
    });

    it("should fallback to x-forwarded-for header", async () => {
      app.use("*", rateLimitMiddleware({ maxRequests: 100, windowMs: 60000 }));
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test", {
        headers: { "x-forwarded-for": "10.0.0.200" },
      });

      await app.request(req, { env: mockEnv } as any);

      expect(mockEnv.CACHE_KV.get).toHaveBeenCalledWith(
        expect.stringContaining("10.0.0.200"),
      );
    });

    it("should skip rate limiting for localhost", async () => {
      app.use("*", rateLimitMiddleware({ maxRequests: 1, windowMs: 60000 }));
      app.get("/test", (c) => c.json({ success: true }));

      mockEnv.CACHE_KV.get.mockResolvedValue("100"); // Way over limit

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "127.0.0.1" },
      });

      const res = await app.request(req, { env: mockEnv } as any);

      expect(res.status).toBe(200); // Should not be rate limited
    });

    it("should skip rate limiting for ::1 (IPv6 localhost)", async () => {
      app.use("*", rateLimitMiddleware({ maxRequests: 1, windowMs: 60000 }));
      app.get("/test", (c) => c.json({ success: true }));

      mockEnv.CACHE_KV.get.mockResolvedValue("100");

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "::1" },
      });

      const res = await app.request(req, { env: mockEnv } as any);

      expect(res.status).toBe(200);
    });
  });

  describe("Custom Key Generator", () => {
    it("should use custom key generator", async () => {
      app.use(
        "*",
        rateLimitMiddleware({
          maxRequests: 100,
          windowMs: 60000,
          keyGenerator: (c) => c.req.header("X-API-Key") || "test-key",
        }),
      );
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test", {
        headers: { "X-API-Key": "my-api-key-123" },
      });

      await app.request(req, { env: mockEnv } as any);

      expect(mockEnv.CACHE_KV.get).toHaveBeenCalledWith(
        expect.stringContaining("my-api-key-123"),
      );
    });
  });

  describe("Skip Options", () => {
    it("should skip successful requests when configured", async () => {
      app.use(
        "*",
        rateLimitMiddleware({
          maxRequests: 100,
          windowMs: 60000,
          skipSuccessfulRequests: true,
        }),
      );
      app.get("/test", (c) => c.json({ success: true }));

      mockEnv.CACHE_KV.get.mockResolvedValue("50");

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "10.0.0.50" },
      });

      await app.request(req, { env: mockEnv } as any);

      // Should not increment counter for successful request
      expect(mockEnv.CACHE_KV.put).not.toHaveBeenCalled();
    });

    it("should skip failed requests when configured", async () => {
      app.use(
        "*",
        rateLimitMiddleware({
          maxRequests: 100,
          windowMs: 60000,
          skipFailedRequests: true,
        }),
      );
      app.get("/test", (c) => c.json({ error: "Not found" }, 404));

      mockEnv.CACHE_KV.get.mockResolvedValue("50");

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "10.0.0.51" },
      });

      await app.request(req, { env: mockEnv } as any);

      // Should not increment counter for failed request
      expect(mockEnv.CACHE_KV.put).not.toHaveBeenCalled();
    });
  });

  describe("KV Store Unavailable", () => {
    it("should return 503 when KV is unavailable", async () => {
      const envWithoutKV = { ...mockEnv, CACHE_KV: undefined };

      const appWithoutKV = new Hono<{ Bindings: typeof envWithoutKV }>();
      appWithoutKV.use("*", async (c, next) => {
        Object.assign(c.env || {}, envWithoutKV);
        await next();
      });
      appWithoutKV.use(
        "*",
        rateLimitMiddleware({ maxRequests: 100, windowMs: 60000 }),
      );
      appWithoutKV.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "10.0.0.60" },
      });

      const res = await appWithoutKV.request(req, { env: envWithoutKV } as any);

      expect(res.status).toBe(503);
    });

    it("should return 503 on KV error", async () => {
      app.use("*", rateLimitMiddleware({ maxRequests: 100, windowMs: 60000 }));
      app.get("/test", (c) => c.json({ success: true }));

      mockEnv.CACHE_KV.get.mockRejectedValue(new Error("KV error"));

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "10.0.0.61" },
      });

      const res = await app.request(req, { env: mockEnv } as any);

      expect(res.status).toBe(503);
    });
  });

  describe("Preset Configurations", () => {
    it("strictRateLimit should have low limit", async () => {
      app.use("*", strictRateLimit);
      app.get("/test", (c) => c.json({ success: true }));

      mockEnv.CACHE_KV.get.mockResolvedValue("5"); // At strict limit

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "10.0.0.70" },
      });

      const res = await app.request(req, { env: mockEnv } as any);

      expect(res.status).toBe(429);
    });

    it("authRateLimit should have moderate limit", async () => {
      app.use("*", authRateLimit);
      app.get("/test", (c) => c.json({ success: true }));

      mockEnv.CACHE_KV.get.mockResolvedValue("15");

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "10.0.0.71" },
      });

      const res = await app.request(req, { env: mockEnv } as any);

      expect(res.status).toBe(200); // Under 20 limit
    });

    it("apiRateLimit should have high limit", async () => {
      app.use("*", apiRateLimit);
      app.get("/test", (c) => c.json({ success: true }));

      mockEnv.CACHE_KV.get.mockResolvedValue("500");

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "10.0.0.72" },
      });

      const res = await app.request(req, { env: mockEnv } as any);

      expect(res.status).toBe(200); // Under 1000 limit
    });

    it("publicRateLimit should have medium limit", async () => {
      app.use("*", publicRateLimit);
      app.get("/test", (c) => c.json({ success: true }));

      mockEnv.CACHE_KV.get.mockResolvedValue("400");

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "10.0.0.73" },
      });

      const res = await app.request(req, { env: mockEnv } as any);

      expect(res.status).toBe(200); // Under 500 limit
    });
  });

  describe("Counter Increment", () => {
    it("should increment counter on request", async () => {
      app.use("*", rateLimitMiddleware({ maxRequests: 100, windowMs: 60000 }));
      app.get("/test", (c) => c.json({ success: true }));

      mockEnv.CACHE_KV.get.mockResolvedValue("5");

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "10.0.0.1" }, // Use non-localhost IP
      });

      await app.request(req, { env: mockEnv } as any);

      expect(mockEnv.CACHE_KV.put).toHaveBeenCalledWith(
        expect.any(String),
        "6",
        expect.objectContaining({ expirationTtl: expect.any(Number) }),
      );
    });

    it("should start counter at 1 for new IP", async () => {
      app.use("*", rateLimitMiddleware({ maxRequests: 100, windowMs: 60000 }));
      app.get("/test", (c) => c.json({ success: true }));

      mockEnv.CACHE_KV.get.mockResolvedValue(null); // No existing counter

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "10.0.0.2" }, // Use non-localhost IP
      });

      await app.request(req, { env: mockEnv } as any);

      expect(mockEnv.CACHE_KV.put).toHaveBeenCalledWith(
        expect.any(String),
        "1",
        expect.any(Object),
      );
    });
  });
});
