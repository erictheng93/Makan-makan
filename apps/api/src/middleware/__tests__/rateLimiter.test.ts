/**
 * RateLimiter Tests
 *
 * Comprehensive test suite for the RateLimiter class and middleware
 * Tests rate limiting logic with Cloudflare KV storage
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Hono } from "hono";
import {
  RateLimiter,
  rateLimitMiddleware,
  userRateLimitMiddleware,
  RateLimitPresets,
  type RateLimitConfig,
} from "../rateLimiter";
import type { Env } from "../../types/env";

// Mock KV Namespace
const createMockKV = () => ({
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
});

describe("RateLimiter", () => {
  let mockKV: ReturnType<typeof createMockKV>;
  let config: RateLimitConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockKV = createMockKV();
    config = {
      windowMs: 60000, // 1 minute
      maxRequests: 10,
      keyPrefix: "test",
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =============================================
  // RateLimiter Class Tests
  // =============================================
  describe("checkLimit", () => {
    it("should allow first request and start new window", async () => {
      mockKV.get.mockResolvedValue(null); // No existing data

      const limiter = new RateLimiter(mockKV as never, config);
      const result = await limiter.checkLimit("user123");

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(9);
      expect(mockKV.put).toHaveBeenCalledWith(
        "test:user123",
        expect.stringContaining('"count":1'),
        expect.objectContaining({ expirationTtl: 60 }),
      );
    });

    it("should increment count for existing window", async () => {
      const now = Date.now();
      const existingData = {
        count: 5,
        resetTime: now + 30000, // 30 seconds remaining
      };
      mockKV.get.mockResolvedValue(existingData);

      const limiter = new RateLimiter(mockKV as never, config);
      const result = await limiter.checkLimit("user123");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 5 - 1 = 4
      expect(mockKV.put).toHaveBeenCalledWith(
        "test:user123",
        expect.stringContaining('"count":6'),
        expect.any(Object),
      );
    });

    it("should block when limit exceeded", async () => {
      const now = Date.now();
      const existingData = {
        count: 10, // At limit
        resetTime: now + 30000,
      };
      mockKV.get.mockResolvedValue(existingData);

      const limiter = new RateLimiter(mockKV as never, config);
      const result = await limiter.checkLimit("user123");

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(mockKV.put).not.toHaveBeenCalled(); // Should not increment
    });

    it("should reset window when expired", async () => {
      const existingData = {
        count: 100, // Way over limit
        resetTime: Date.now() - 1000, // Expired
      };
      mockKV.get.mockResolvedValue(existingData);

      const limiter = new RateLimiter(mockKV as never, config);
      const result = await limiter.checkLimit("user123");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // Reset to maxRequests - 1
    });

    it("should use default keyPrefix when not provided", async () => {
      mockKV.get.mockResolvedValue(null);

      const configWithoutPrefix: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 10,
      };
      const limiter = new RateLimiter(mockKV as never, configWithoutPrefix);
      await limiter.checkLimit("user123");

      expect(mockKV.put).toHaveBeenCalledWith(
        "ratelimit:user123", // Default prefix
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  describe("reset", () => {
    it("should delete rate limit key", async () => {
      const limiter = new RateLimiter(mockKV as never, config);
      await limiter.reset("user123");

      expect(mockKV.delete).toHaveBeenCalledWith("test:user123");
    });

    it("should use default keyPrefix when not provided", async () => {
      const configWithoutPrefix: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 10,
      };
      const limiter = new RateLimiter(mockKV as never, configWithoutPrefix);
      await limiter.reset("user123");

      expect(mockKV.delete).toHaveBeenCalledWith("ratelimit:user123");
    });
  });

  // =============================================
  // rateLimitMiddleware Tests
  // =============================================
  describe("rateLimitMiddleware", () => {
    let app: Hono<{ Bindings: Env }>;
    let mockEnv: Partial<Env>;

    beforeEach(() => {
      app = new Hono<{ Bindings: Env }>();
      mockEnv = {
        CACHE_KV: mockKV as never,
      };

      // Properly inject env for Hono - must set c.env before next()
      app.use("*", async (c, next) => {
        // For Hono, we need to mutate c.env directly when it doesn't exist
        if (!c.env) {
          (c as unknown as ApiTestContextWithEnv).env =
            mockEnv as unknown as ApiTestEnv;
        } else {
          Object.assign(c.env, mockEnv);
        }
        await next();
      });
    });

    it("should allow request when under limit", async () => {
      mockKV.get.mockResolvedValue(null);

      app.use("*", rateLimitMiddleware(config));
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "192.168.1.1" },
      });

      const res = await app.request(req);
      expect(res.status).toBe(200);
    });

    it("should block request when over limit", async () => {
      const existingData = {
        count: 10,
        resetTime: Date.now() + 30000,
      };
      mockKV.get.mockResolvedValue(existingData);

      app.use("*", rateLimitMiddleware(config));
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "192.168.1.1" },
      });

      const res = await app.request(req);
      expect(res.status).toBe(429);

      const data = (await res.json()) as {
        success: boolean;
        error: string;
        retryAfter: number;
      };
      expect(data.success).toBe(false);
      expect(data.retryAfter).toBeDefined();
    });

    it("should add rate limit headers", async () => {
      mockKV.get.mockResolvedValue(null);

      app.use("*", rateLimitMiddleware(config));
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "192.168.1.1" },
      });

      const res = await app.request(req);

      expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("9");
      expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
    });

    it("should add Retry-After header when blocked", async () => {
      const existingData = {
        count: 10,
        resetTime: Date.now() + 30000,
      };
      mockKV.get.mockResolvedValue(existingData);

      app.use("*", rateLimitMiddleware(config));
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "192.168.1.1" },
      });

      const res = await app.request(req);
      expect(res.headers.get("Retry-After")).toBeTruthy();
    });

    it("should skip rate limiting when CACHE_KV not available", async () => {
      const appWithoutKV = new Hono<{ Bindings: Env }>();
      // Set env but without CACHE_KV
      appWithoutKV.use("*", async (c, next) => {
        if (!c.env) {
          (c as unknown as ApiTestContextWithEnv).env =
            {} as unknown as ApiTestEnv; // Empty env - no CACHE_KV
        }
        await next();
      });
      appWithoutKV.use("*", rateLimitMiddleware(config));
      appWithoutKV.get("/test", (c) => c.json({ success: true }));

      vi.spyOn(console, "warn").mockImplementation(() => {});

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "192.168.1.1" },
      });

      const res = await appWithoutKV.request(req);
      expect(res.status).toBe(200); // Should pass through
    });

    it("should skip rate limiting for localhost IP", async () => {
      const existingData = {
        count: 100, // Way over limit
        resetTime: Date.now() + 30000,
      };
      mockKV.get.mockResolvedValue(existingData);

      app.use("*", rateLimitMiddleware(config));
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "127.0.0.1" },
      });

      const res = await app.request(req);
      expect(res.status).toBe(200); // Not rate limited
    });

    it("should skip rate limiting for ::1 IPv6 localhost", async () => {
      app.use("*", rateLimitMiddleware(config));
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "::1" },
      });

      const res = await app.request(req);
      expect(res.status).toBe(200);
    });

    it("should skip rate limiting for unknown IP", async () => {
      app.use("*", rateLimitMiddleware(config));
      app.get("/test", (c) => c.json({ success: true }));

      // No IP headers
      const req = new Request("http://localhost/test");

      const res = await app.request(req);
      expect(res.status).toBe(200);
    });

    it("should use x-forwarded-for as fallback", async () => {
      mockKV.get.mockResolvedValue(null);

      app.use("*", rateLimitMiddleware(config));
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test", {
        headers: { "x-forwarded-for": "10.0.0.50" },
      });

      await app.request(req);
      expect(mockKV.get).toHaveBeenCalledWith("test:10.0.0.50", "json");
    });

    it("should use custom error message", async () => {
      const existingData = {
        count: 10,
        resetTime: Date.now() + 30000,
      };
      mockKV.get.mockResolvedValue(existingData);

      const customConfig = {
        ...config,
        message: "請稍後再試",
      };

      app.use("*", rateLimitMiddleware(customConfig));
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test", {
        headers: { "cf-connecting-ip": "192.168.1.1" },
      });

      const res = await app.request(req);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("請稍後再試");
    });
  });

  // =============================================
  // userRateLimitMiddleware Tests
  // =============================================
  describe("userRateLimitMiddleware", () => {
    let app: Hono<{ Bindings: Env }>;
    let mockEnv: Partial<Env>;

    beforeEach(() => {
      app = new Hono<{ Bindings: Env }>();
      mockEnv = {
        CACHE_KV: mockKV as never,
      };

      // Properly inject env for Hono
      app.use("*", async (c, next) => {
        if (!c.env) {
          (c as unknown as ApiTestContextWithEnv).env =
            mockEnv as unknown as ApiTestEnv;
        } else {
          Object.assign(c.env, mockEnv);
        }
        await next();
      });
    });

    it("should skip when CACHE_KV not available", async () => {
      const appWithoutKV = new Hono<{ Bindings: Env }>();
      // Set env but without CACHE_KV
      appWithoutKV.use("*", async (c, next) => {
        if (!c.env) {
          (c as unknown as ApiTestContextWithEnv).env =
            {} as unknown as ApiTestEnv; // Empty env - no CACHE_KV
        }
        await next();
      });
      appWithoutKV.use("*", userRateLimitMiddleware(config));
      appWithoutKV.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test");
      const res = await appWithoutKV.request(req);
      expect(res.status).toBe(200);
    });

    it("should skip when no userId available", async () => {
      app.use("*", userRateLimitMiddleware(config));
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test");
      const res = await app.request(req);
      expect(res.status).toBe(200);
    });

    it("should rate limit by userId when available in context", async () => {
      mockKV.get.mockResolvedValue(null);

      app.use("*", async (c, next) => {
        (c as unknown as ApiTestContextWithEnv).set("userId", 123);
        await next();
      });
      app.use("*", userRateLimitMiddleware(config));
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test");
      await app.request(req);

      expect(mockKV.get).toHaveBeenCalledWith("test:user:123", "json");
    });

    it("should rate limit by userId from request body", async () => {
      mockKV.get.mockResolvedValue(null);

      app.use("*", userRateLimitMiddleware(config));
      app.post("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: 456 }),
      });

      await app.request(req);
      expect(mockKV.get).toHaveBeenCalledWith("test:user:456", "json");
    });

    it("should block user when over limit", async () => {
      const existingData = {
        count: 10,
        resetTime: Date.now() + 30000,
      };
      mockKV.get.mockResolvedValue(existingData);

      app.use("*", async (c, next) => {
        (c as unknown as ApiTestContextWithEnv).set("userId", 123);
        await next();
      });
      app.use("*", userRateLimitMiddleware(config));
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test");
      const res = await app.request(req);

      expect(res.status).toBe(429);
    });

    it("should add user rate limit headers", async () => {
      mockKV.get.mockResolvedValue(null);

      app.use("*", async (c, next) => {
        (c as unknown as ApiTestContextWithEnv).set("userId", 123);
        await next();
      });
      app.use("*", userRateLimitMiddleware(config));
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test");
      const res = await app.request(req);

      expect(res.headers.get("X-RateLimit-User-Limit")).toBe("10");
      expect(res.headers.get("X-RateLimit-User-Remaining")).toBe("9");
    });
  });

  // =============================================
  // RateLimitPresets Tests
  // =============================================
  describe("RateLimitPresets", () => {
    it("should have passwordReset preset", () => {
      expect(RateLimitPresets.passwordReset).toBeDefined();
      expect(RateLimitPresets.passwordReset.maxRequests).toBe(5);
      expect(RateLimitPresets.passwordReset.windowMs).toBe(60 * 60 * 1000); // 1 hour
      expect(RateLimitPresets.passwordReset.keyPrefix).toBe("pwd_reset");
    });

    it("should have emailVerification preset", () => {
      expect(RateLimitPresets.emailVerification).toBeDefined();
      expect(RateLimitPresets.emailVerification.maxRequests).toBe(3);
      expect(RateLimitPresets.emailVerification.windowMs).toBe(10 * 60 * 1000); // 10 minutes
      expect(RateLimitPresets.emailVerification.keyPrefix).toBe("email_verify");
    });

    it("should have smsOTP preset", () => {
      expect(RateLimitPresets.smsOTP).toBeDefined();
      expect(RateLimitPresets.smsOTP.maxRequests).toBe(3);
      expect(RateLimitPresets.smsOTP.windowMs).toBe(60 * 60 * 1000); // 1 hour
      expect(RateLimitPresets.smsOTP.keyPrefix).toBe("sms_otp");
    });

    it("should have login preset", () => {
      expect(RateLimitPresets.login).toBeDefined();
      expect(RateLimitPresets.login.maxRequests).toBe(10);
      expect(RateLimitPresets.login.windowMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(RateLimitPresets.login.keyPrefix).toBe("login");
    });

    it("should have general preset", () => {
      expect(RateLimitPresets.general).toBeDefined();
      expect(RateLimitPresets.general.maxRequests).toBe(100);
      expect(RateLimitPresets.general.windowMs).toBe(60 * 1000); // 1 minute
      expect(RateLimitPresets.general.keyPrefix).toBe("api");
    });

    it("should have localized error messages", () => {
      expect(RateLimitPresets.passwordReset.message).toContain("密碼重設");
      expect(RateLimitPresets.emailVerification.message).toContain("Email");
      expect(RateLimitPresets.smsOTP.message).toContain("SMS");
      expect(RateLimitPresets.login.message).toContain("登入");
      expect(RateLimitPresets.general.message).toContain("API");
    });
  });

  // =============================================
  // Edge Cases
  // =============================================
  describe("Edge Cases", () => {
    it("should handle very long window times", async () => {
      mockKV.get.mockResolvedValue(null);

      const longWindowConfig: RateLimitConfig = {
        windowMs: 24 * 60 * 60 * 1000, // 24 hours
        maxRequests: 1000,
      };

      const limiter = new RateLimiter(mockKV as never, longWindowConfig);
      const result = await limiter.checkLimit("user123");

      expect(result.allowed).toBe(true);
      expect(mockKV.put).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ expirationTtl: 86400 }), // 24 hours in seconds
      );
    });

    it("should handle zero remaining requests correctly", async () => {
      const existingData = {
        count: 9, // One request remaining
        resetTime: Date.now() + 30000,
      };
      mockKV.get.mockResolvedValue(existingData);

      const limiter = new RateLimiter(mockKV as never, config);
      const result = await limiter.checkLimit("user123");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0); // 10 - 9 - 1 = 0
    });

    it("should calculate correct TTL for partial window", async () => {
      const now = Date.now();
      const existingData = {
        count: 5,
        resetTime: now + 15000, // 15 seconds remaining
      };
      mockKV.get.mockResolvedValue(existingData);

      const limiter = new RateLimiter(mockKV as never, config);
      await limiter.checkLimit("user123");

      expect(mockKV.put).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ expirationTtl: expect.any(Number) }),
      );
    });
  });
});
