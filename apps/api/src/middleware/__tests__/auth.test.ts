/**
 * Auth Middleware Tests
 * 認證中間件測試
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import {
  authMiddleware,
  customerAuthMiddleware,
  requireRole,
  requireRestaurantAccess,
  blacklistToken,
  optionalAuth,
  requireAuth,
} from "../auth";
import { ApiError } from "../../shared/utils/api-error";

// Helper: add onError handler matching the global handler so thrown ApiErrors are formatted
function withErrorHandler(app: Hono<any>): void {
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            ...(err.details !== undefined && { details: err.details }),
          },
        },
        err.status as any,
      );
    }
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: err.message },
      },
      500,
    );
  });
}

// Mock environment
const createMockEnv = (overrides: any = {}) => ({
  JWT_SECRET: "test-secret-key-that-is-at-least-32-chars-long",
  TOKEN_BLACKLIST: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  ...overrides,
});

// Helper to create valid JWT token
const createToken = async (
  payload: any,
  secret: string,
  expiresInSeconds: number = 3600,
) => {
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };
  return await sign(tokenPayload, secret);
};

describe("Auth Middleware", () => {
  let app: Hono<{ Bindings: ReturnType<typeof createMockEnv> }>;
  let mockEnv: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    app = new Hono<{ Bindings: typeof mockEnv }>();
    withErrorHandler(app);

    // Inject env into context
    app.use("*", async (c, next) => {
      if (!c.env) {
        (c as any).env = mockEnv;
      } else {
        Object.assign(c.env, mockEnv);
      }
      await next();
    });
  });

  describe("authMiddleware", () => {
    beforeEach(() => {
      app.use("/protected/*", authMiddleware);
      app.get("/protected/test", (c) => {
        const user = c.get("user");
        return c.json({ success: true, user });
      });
    });

    describe("Authorization Header Validation", () => {
      it("should reject request without Authorization header", async () => {
        const req = new Request("http://localhost/protected/test");
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        expect(result.error.message).toBe(
          "Missing or invalid authorization header",
        );
      });

      it("should reject request with empty Authorization header", async () => {
        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: "" },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        expect(result.error.message).toBe(
          "Missing or invalid authorization header",
        );
      });

      it("should reject request without Bearer prefix", async () => {
        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: "Basic some-token" },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        expect(result.error.message).toBe(
          "Missing or invalid authorization header",
        );
      });

      it('should reject request with only "Bearer" without token', async () => {
        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: "Bearer" },
        });
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(401);
      });
    });

    describe("JWT Secret Validation", () => {
      it("should return 500 when JWT_SECRET is not set", async () => {
        mockEnv = createMockEnv({ JWT_SECRET: undefined });

        const token = await createToken(
          { id: 1, username: "test", role: 1 },
          "some-secret-key-that-is-long-enough",
        );

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Create app with no JWT_SECRET
        const appNoSecret = new Hono<{ Bindings: typeof mockEnv }>();
        withErrorHandler(appNoSecret);
        appNoSecret.use("*", async (c, next) => {
          (c as any).env = { ...mockEnv, JWT_SECRET: undefined };
          await next();
        });
        appNoSecret.use("/protected/*", authMiddleware);
        appNoSecret.get("/protected/test", (c) => c.json({ success: true }));

        const res = await appNoSecret.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(500);
        expect(result.error.message).toBe("Server configuration error");
      });

      it("should return 500 when JWT_SECRET is too short", async () => {
        const token = await createToken(
          { id: 1, username: "test", role: 1 },
          "short",
        );

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Create app with short JWT_SECRET
        const appShortSecret = new Hono<{ Bindings: typeof mockEnv }>();
        withErrorHandler(appShortSecret);
        appShortSecret.use("*", async (c, next) => {
          (c as any).env = { ...mockEnv, JWT_SECRET: "short" };
          await next();
        });
        appShortSecret.use("/protected/*", authMiddleware);
        appShortSecret.get("/protected/test", (c) => c.json({ success: true }));

        const res = await appShortSecret.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(500);
        expect(result.error.message).toBe("Server configuration error");
      });
    });

    describe("Token Blacklist", () => {
      it("should reject blacklisted token", async () => {
        const token = await createToken(
          { id: 1, username: "test", role: 1 },
          mockEnv.JWT_SECRET,
        );

        mockEnv.TOKEN_BLACKLIST.get.mockResolvedValue("blacklisted");

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        expect(result.error.message).toBe("Token has been invalidated");
        expect(mockEnv.TOKEN_BLACKLIST.get).toHaveBeenCalledWith(
          `token:${token}`,
        );
      });

      it("should continue without blacklist check when TOKEN_BLACKLIST not available", async () => {
        const token = await createToken(
          { id: 1, username: "test", role: 1 },
          mockEnv.JWT_SECRET,
        );

        // Create app without TOKEN_BLACKLIST
        const appNoBlacklist = new Hono<{ Bindings: typeof mockEnv }>();
        withErrorHandler(appNoBlacklist);
        appNoBlacklist.use("*", async (c, next) => {
          (c as any).env = { ...mockEnv, TOKEN_BLACKLIST: undefined };
          await next();
        });
        appNoBlacklist.use("/protected/*", authMiddleware);
        appNoBlacklist.get("/protected/test", (c) => c.json({ success: true }));

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await appNoBlacklist.request(req, undefined, mockEnv);

        expect(res.status).toBe(200);
      });
    });

    describe("Token Expiration", () => {
      it("should reject expired token", async () => {
        const now = Math.floor(Date.now() / 1000);
        const token = await sign(
          {
            id: 1,
            username: "test",
            role: 1,
            iat: now - 7200,
            exp: now - 3600,
          },
          mockEnv.JWT_SECRET,
        );

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        expect(result.error.message).toContain("expired");
      });

      it("should reject token without exp claim", async () => {
        const now = Math.floor(Date.now() / 1000);
        const token = await sign(
          { id: 1, username: "test", role: 1, iat: now },
          mockEnv.JWT_SECRET,
        );

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        // Without exp claim, the auth middleware will reject it in the manual check
        expect(result.error).toBeTruthy();
      });

      it("should reject token issued in future", async () => {
        const now = Math.floor(Date.now() / 1000);
        const token = await sign(
          { id: 1, username: "test", role: 1, iat: now + 600, exp: now + 7200 },
          mockEnv.JWT_SECRET,
        );

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        // hono/jwt verify() throws JwtTokenIssuedAt error for future iat, caught by catch block
        expect(result.error).toBeTruthy();
      });

      it("should reject token with nbf in future", async () => {
        const now = Math.floor(Date.now() / 1000);
        const token = await sign(
          {
            id: 1,
            username: "test",
            role: 1,
            iat: now,
            exp: now + 7200,
            nbf: now + 600,
          },
          mockEnv.JWT_SECRET,
        );

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        // hono/jwt verify() throws JwtTokenNotBefore error, caught by catch block
        expect(result.error).toBeTruthy();
      });

      it("should reject token older than 24 hours", async () => {
        const now = Math.floor(Date.now() / 1000);
        const token = await sign(
          {
            id: 1,
            username: "test",
            role: 1,
            iat: now - 25 * 60 * 60,
            exp: now + 3600,
          },
          mockEnv.JWT_SECRET,
        );

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        expect(result.error.message).toBe("Token too old, please refresh");
      });
    });

    describe("Token Claims Validation", () => {
      it("should reject token without id claim", async () => {
        const token = await createToken(
          { username: "test", role: 1 },
          mockEnv.JWT_SECRET,
        );

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        expect(result.error.message).toBe("Invalid token claims");
      });

      it("should reject token without username claim", async () => {
        const token = await createToken({ id: 1, role: 1 }, mockEnv.JWT_SECRET);

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        expect(result.error.message).toBe("Invalid token claims");
      });

      it("should reject token without role claim", async () => {
        const token = await createToken(
          { id: 1, username: "test" },
          mockEnv.JWT_SECRET,
        );

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        expect(result.error.message).toBe("Invalid token claims");
      });

      it("should reject token with role as string", async () => {
        const token = await createToken(
          { id: 1, username: "test", role: "1" },
          mockEnv.JWT_SECRET,
        );

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        expect(result.error.message).toBe("Invalid token claims");
      });

      it("should reject token with invalid role range (negative)", async () => {
        const token = await createToken(
          { id: 1, username: "test", role: -1 },
          mockEnv.JWT_SECRET,
        );

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        expect(result.error.message).toBe("Invalid role in token");
      });

      it("should reject token with invalid role range (too high)", async () => {
        const token = await createToken(
          { id: 1, username: "test", role: 6 },
          mockEnv.JWT_SECRET,
        );

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        expect(result.error.message).toBe("Invalid role in token");
      });
    });

    describe("Token Refresh Headers", () => {
      it("should add refresh recommendation header when token expires soon", async () => {
        const now = Math.floor(Date.now() / 1000);
        const token = await sign(
          { id: 1, username: "test", role: 1, iat: now, exp: now + 1800 }, // 30 minutes
          mockEnv.JWT_SECRET,
        );

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(200);
        expect(res.headers.get("X-Token-Refresh-Recommended")).toBe("true");
        expect(res.headers.get("X-Token-Expires-In")).toBeTruthy();
      });

      it("should not add refresh header when token has plenty of time", async () => {
        const token = await createToken(
          { id: 1, username: "test", role: 1 },
          mockEnv.JWT_SECRET,
          7200, // 2 hours
        );

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(200);
        expect(res.headers.get("X-Token-Refresh-Recommended")).toBeNull();
      });
    });

    describe("Successful Authentication", () => {
      it("should authenticate valid token and set user in context", async () => {
        const token = await createToken(
          { id: 123, username: "testuser", role: 2, restaurantId: 456 },
          mockEnv.JWT_SECRET,
        );

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(200);
        expect(result.success).toBe(true);
        expect(result.user).toEqual({
          id: 123,
          username: "testuser",
          role: 2,
          restaurantId: 456,
        });
      });

      it("should accept all valid staff/admin role values (0-4)", async () => {
        for (const role of [0, 1, 2, 3, 4]) {
          const token = await createToken(
            { id: 1, username: "test", role },
            mockEnv.JWT_SECRET,
          );

          const req = new Request("http://localhost/protected/test", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const res = await app.request(req, undefined, mockEnv);
          const result = (await res.json()) as any;

          expect(res.status).toBe(200);
          expect(result.user.role).toBe(role);
        }
      });
    });

    describe("Error Handling", () => {
      it("should handle invalid token format", async () => {
        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: "Bearer invalid-token-format" },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        expect(result.error).toBeTruthy();
      });

      it("should handle token signed with different secret", async () => {
        const token = await createToken(
          { id: 1, username: "test", role: 1 },
          "different-secret-key-that-is-also-long-enough",
        );

        const req = new Request("http://localhost/protected/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(401);
        expect(result.error).toBeTruthy();
      });
    });
  });

  describe("customerAuthMiddleware", () => {
    beforeEach(() => {
      app.use("/customer/*", customerAuthMiddleware);
      app.get("/customer/test", (c) => {
        const user = c.get("user");
        return c.json({ success: true, user });
      });
    });

    it("should accept customer role tokens", async () => {
      const token = await createToken(
        { id: 1, username: "customer", role: 5 },
        mockEnv.JWT_SECRET,
      );

      const req = new Request("http://localhost/customer/test", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await app.request(req, undefined, mockEnv);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.user.role).toBe(5);
    });

    it("should accept all valid role values (0-5)", async () => {
      for (const role of [0, 1, 2, 3, 4, 5]) {
        const token = await createToken(
          { id: 1, username: "test", role },
          mockEnv.JWT_SECRET,
        );

        const req = new Request("http://localhost/customer/test", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await app.request(req, undefined, mockEnv);
        const result = (await res.json()) as any;

        expect(res.status).toBe(200);
        expect(result.user.role).toBe(role);
      }
    });
  });

  describe("requireRole", () => {
    beforeEach(() => {
      app.use("/admin/*", authMiddleware);
      app.use("/admin/*", requireRole([0])); // Admin only
      app.get("/admin/dashboard", (c) => c.json({ success: true }));

      app.use("/staff/*", authMiddleware);
      app.use("/staff/*", requireRole([0, 1, 2])); // Admin, Owner, Chef
      app.get("/staff/orders", (c) => c.json({ success: true }));
    });

    it("should reject when no user in context", async () => {
      // Create app without authMiddleware to test requireRole directly
      const appNoAuth = new Hono<{ Bindings: typeof mockEnv }>();
      withErrorHandler(appNoAuth);
      appNoAuth.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });
      appNoAuth.use("/admin/*", requireRole([0]));
      appNoAuth.get("/admin/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/admin/test");
      const res = await appNoAuth.request(req, undefined, mockEnv);
      const result = (await res.json()) as any;

      expect(res.status).toBe(401);
      expect(result.error.message).toBe("Authentication required");
    });

    it("should reject when user role not in allowed roles", async () => {
      const token = await createToken(
        { id: 1, username: "chef", role: 2 }, // Chef
        mockEnv.JWT_SECRET,
      );

      const req = new Request("http://localhost/admin/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await app.request(req, undefined, mockEnv);
      const result = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(result.error.message).toBe("Insufficient permissions");
    });

    it("should allow when user role is in allowed roles", async () => {
      const token = await createToken(
        { id: 1, username: "admin", role: 0 }, // Admin
        mockEnv.JWT_SECRET,
      );

      const req = new Request("http://localhost/admin/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await app.request(req, undefined, mockEnv);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
    });

    it("should work with multiple allowed roles", async () => {
      const token = await createToken(
        { id: 1, username: "chef", role: 2 }, // Chef
        mockEnv.JWT_SECRET,
      );

      const req = new Request("http://localhost/staff/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await app.request(req, undefined, mockEnv);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
    });
  });

  describe("requireRestaurantAccess", () => {
    beforeEach(() => {
      app.use("/restaurant/:restaurantId/*", authMiddleware);
      app.use("/restaurant/:restaurantId/*", requireRestaurantAccess());
      app.get("/restaurant/:restaurantId/menu", (c) =>
        c.json({ success: true }),
      );
    });

    it("should reject when no user in context", async () => {
      const appNoAuth = new Hono<{ Bindings: typeof mockEnv }>();
      withErrorHandler(appNoAuth);
      appNoAuth.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });
      appNoAuth.use("/restaurant/:restaurantId/*", requireRestaurantAccess());
      appNoAuth.get("/restaurant/:restaurantId/menu", (c) =>
        c.json({ success: true }),
      );

      const req = new Request("http://localhost/restaurant/123/menu");
      const res = await appNoAuth.request(req, undefined, mockEnv);
      const result = (await res.json()) as any;

      expect(res.status).toBe(401);
      expect(result.error.message).toBe("Authentication required");
    });

    it("should allow admin access to any restaurant", async () => {
      const token = await createToken(
        { id: 1, username: "admin", role: 0 }, // Admin
        mockEnv.JWT_SECRET,
      );

      const req = new Request("http://localhost/restaurant/999/menu", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await app.request(req, undefined, mockEnv);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
    });

    it("should reject when user has no restaurantId", async () => {
      const token = await createToken(
        { id: 1, username: "owner", role: 1 }, // No restaurantId
        mockEnv.JWT_SECRET,
      );

      const req = new Request("http://localhost/restaurant/123/menu", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await app.request(req, undefined, mockEnv);
      const result = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(result.error.message).toBe("Access denied to this restaurant");
    });

    it("should reject when user restaurantId does not match", async () => {
      const token = await createToken(
        { id: 1, username: "owner", role: 1, restaurantId: 456 },
        mockEnv.JWT_SECRET,
      );

      const req = new Request("http://localhost/restaurant/123/menu", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await app.request(req, undefined, mockEnv);
      const result = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(result.error.message).toBe("Access denied to this restaurant");
    });

    it("should allow when user restaurantId matches", async () => {
      const token = await createToken(
        { id: 1, username: "owner", role: 1, restaurantId: "123" },
        mockEnv.JWT_SECRET,
      );

      const req = new Request("http://localhost/restaurant/123/menu", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await app.request(req, undefined, mockEnv);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
    });

    it("should work with custom restaurantIdParam", async () => {
      const appCustomParam = new Hono<{ Bindings: typeof mockEnv }>();
      withErrorHandler(appCustomParam);
      appCustomParam.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });
      appCustomParam.use("/shop/:shopId/*", authMiddleware);
      appCustomParam.use("/shop/:shopId/*", requireRestaurantAccess("shopId"));
      appCustomParam.get("/shop/:shopId/menu", (c) =>
        c.json({ success: true }),
      );

      const token = await createToken(
        { id: 1, username: "owner", role: 1, restaurantId: "789" },
        mockEnv.JWT_SECRET,
      );

      const req = new Request("http://localhost/shop/789/menu", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await appCustomParam.request(req, undefined, mockEnv);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
    });
  });

  describe("blacklistToken", () => {
    it("should add token to blacklist", async () => {
      const mockContext = {
        env: mockEnv,
      } as any;

      await blacklistToken(mockContext, "test-token");

      expect(mockEnv.TOKEN_BLACKLIST.put).toHaveBeenCalledWith(
        "token:test-token",
        "blacklisted",
        undefined,
      );
    });

    it("should add token to blacklist with TTL when expiryTime provided", async () => {
      const mockContext = {
        env: mockEnv,
      } as any;

      const now = Math.floor(Date.now() / 1000);
      const expiryTime = now + 3600; // 1 hour from now

      await blacklistToken(mockContext, "test-token", expiryTime);

      expect(mockEnv.TOKEN_BLACKLIST.put).toHaveBeenCalledWith(
        "token:test-token",
        "blacklisted",
        expect.objectContaining({ expirationTtl: expect.any(Number) }),
      );

      // Verify TTL is approximately correct (allow some time drift)
      const call = mockEnv.TOKEN_BLACKLIST.put.mock.calls[0];
      const ttl = call[2]?.expirationTtl;
      expect(ttl).toBeGreaterThan(3500);
      expect(ttl).toBeLessThanOrEqual(3600);
    });

    it("should handle expired token with TTL of 0", async () => {
      const mockContext = {
        env: mockEnv,
      } as any;

      const now = Math.floor(Date.now() / 1000);
      const expiryTime = now - 100; // Already expired

      await blacklistToken(mockContext, "test-token", expiryTime);

      // When TTL is 0, it's falsy so expirationTtl is not set
      // The code uses: ttl ? { expirationTtl: ttl } : undefined
      expect(mockEnv.TOKEN_BLACKLIST.put).toHaveBeenCalledWith(
        "token:test-token",
        "blacklisted",
        undefined,
      );
    });

    it("should skip when TOKEN_BLACKLIST not available", async () => {
      const mockContext = {
        env: { ...mockEnv, TOKEN_BLACKLIST: undefined },
      } as any;

      await blacklistToken(mockContext, "test-token");

      // Should not throw and should not call put
      expect(mockEnv.TOKEN_BLACKLIST.put).not.toHaveBeenCalled();
    });
  });

  describe("optionalAuth", () => {
    beforeEach(() => {
      app.use("/public/*", optionalAuth);
      app.get("/public/menu", (c) => {
        const user = c.get("user");
        return c.json({ success: true, user: user || null });
      });
    });

    it("should continue without token", async () => {
      const req = new Request("http://localhost/public/menu");
      const res = await app.request(req, undefined, mockEnv);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.user).toBeNull();
    });

    it("should set user when valid token provided", async () => {
      const token = await createToken(
        { id: 123, username: "testuser", role: 2, restaurantId: 456 },
        mockEnv.JWT_SECRET,
      );

      const req = new Request("http://localhost/public/menu", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await app.request(req, undefined, mockEnv);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.user).toEqual({
        id: 123,
        username: "testuser",
        role: 2,
        restaurantId: 456,
      });
    });

    it("should continue when token is blacklisted", async () => {
      const token = await createToken(
        { id: 1, username: "test", role: 1 },
        mockEnv.JWT_SECRET,
      );

      mockEnv.TOKEN_BLACKLIST.get.mockResolvedValue("blacklisted");

      const req = new Request("http://localhost/public/menu", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await app.request(req, undefined, mockEnv);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.user).toBeNull(); // User not set for blacklisted token
    });

    it("should continue when token is invalid", async () => {
      const req = new Request("http://localhost/public/menu", {
        headers: { Authorization: "Bearer invalid-token" },
      });
      const res = await app.request(req, undefined, mockEnv);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.user).toBeNull();
    });

    it("should continue when token verification fails", async () => {
      const token = await createToken(
        { id: 1, username: "test", role: 1 },
        "different-secret-that-is-long-enough-for-test",
      );

      const req = new Request("http://localhost/public/menu", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await app.request(req, undefined, mockEnv);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.user).toBeNull();
    });
  });

  describe("requireAuth alias", () => {
    it("should be same as authMiddleware", () => {
      expect(requireAuth).toBe(authMiddleware);
    });
  });
});
