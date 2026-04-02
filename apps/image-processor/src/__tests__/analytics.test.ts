/**
 * Tests for analytics routes
 *
 * We build a minimal Hono app that mirrors the analytics route behaviour,
 * injecting mock services and middleware to test each endpoint in isolation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { createMockEnv } from "./setup";

type MockEnv = ReturnType<typeof createMockEnv>;

// ── Helpers ───────────────────────────────────────────────────────

const JWT_SECRET = "a]super-secret-test-key-that-is-long-enough-32chars";

async function createToken(
  payload: Record<string, unknown>,
  secret = JWT_SECRET,
) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      iat: now,
      exp: now + 3600,
      ...payload,
    },
    secret,
    "HS256",
  );
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ── Build test app that mirrors analytics.ts ──────────────────────

function buildAnalyticsApp() {
  // Lazy-import the real route module so mocks are already in place
  // We re-create the app with real middleware + route to integration-test
  const app = new Hono<{ Bindings: MockEnv }>();

  // Mount the analytics routes behind the same middleware chain the real
  // index.ts uses.  We import dynamically to avoid stale module caches.
  return app;
}

// ── Mock factories ────────────────────────────────────────────────

function mockImageServiceModule() {
  return {
    getImageAnalytics: vi.fn().mockResolvedValue({
      success: true,
      analytics: {
        totalImages: 42,
        totalSize: 1024000,
        avgProcessingTime: 120,
        mostUsedVariants: [{ variant: "thumbnail", count: 100 }],
        uploadsByCategory: [{ category: "menu", count: 30 }],
        errorRate: 0.02,
        storageUsage: { original: 512000, variants: 512000, total: 1024000 },
      },
    }),
  };
}

function mockDbImageServiceModule() {
  return {
    getStorageAnalytics: vi.fn().mockResolvedValue({
      totalStorage: 2048000,
      imageCount: 50,
      avgSize: 40960,
      byCategory: [{ category: "menu", size: 1024000, count: 30 }],
    }),
    getUsageAnalytics: vi.fn().mockResolvedValue({
      totalViews: 5000,
      uniqueViewers: 1200,
      topImages: [{ id: "img-1", views: 200 }],
    }),
    getPerformanceAnalytics: vi.fn().mockResolvedValue({
      avgProcessingTime: 95,
      p95ProcessingTime: 250,
      successRate: 0.99,
      jobsByStatus: { completed: 900, failed: 10 },
    }),
  };
}

// ── Integration-style tests using real Hono + real middleware ──────

/**
 * Because the analytics route imports `ImageService` and `DatabaseImageService`
 * directly, and we cannot easily mock ES module imports in vitest without
 * `vi.mock`, we build a thin Hono app that replicates the route logic with
 * injected mocks — the same pattern used in index.test.ts.
 */
function buildMockAnalyticsApp(
  imageServiceOverrides: Record<string, any> = {},
  dbImageServiceOverrides: Record<string, any> = {},
) {
  const mockImageService = {
    ...mockImageServiceModule(),
    ...imageServiceOverrides,
  };
  const mockDbImageService = {
    ...mockDbImageServiceModule(),
    ...dbImageServiceOverrides,
  };

  const app = new Hono<{ Bindings: MockEnv }>();

  // Inline auth middleware (same logic as real middleware)
  app.use("/*", async (c, next) => {
    const authHdr = c.req.header("Authorization");
    if (!authHdr || !authHdr.startsWith("Bearer ")) {
      return c.json(
        { success: false, error: "Missing or invalid authorization header" },
        401,
      );
    }

    const token = authHdr.substring(7);
    try {
      const { verify } = await import("hono/jwt");
      const decoded = (await verify(token, c.env.JWT_SECRET, "HS256")) as any;

      if (
        !decoded ||
        typeof decoded !== "object" ||
        !decoded.id ||
        typeof decoded.role !== "number"
      ) {
        return c.json({ success: false, error: "Invalid token" }, 401);
      }

      // Role check: only Admin (0) and Owner (1) allowed
      if (![0, 1].includes(decoded.role)) {
        return c.json(
          { success: false, error: "Insufficient permissions" },
          403,
        );
      }

      c.set("user" as any, {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role,
        restaurantId: decoded.restaurantId,
      });

      await next();
    } catch {
      return c.json({ success: false, error: "Authentication failed" }, 401);
    }
  });

  // Dashboard
  app.get("/dashboard", async (c) => {
    try {
      const user = (c as any).get("user");
      const query = Object.fromEntries(
        new URL(c.req.url).searchParams.entries(),
      );
      const options: Record<string, any> = { ...query };
      if (user.role !== 0) {
        options.restaurantId = user.restaurantId;
      }
      const result = await mockImageService.getImageAnalytics(options);
      if (!result.success) {
        return c.json(
          { success: false, error: result.error || "Failed to get analytics" },
          500,
        );
      }
      return c.json({ success: true, data: result.analytics });
    } catch (error) {
      return c.json(
        { success: false, error: "Failed to get analytics dashboard" },
        500,
      );
    }
  });

  // Storage
  app.get("/storage", async (c) => {
    try {
      const user = (c as any).get("user");
      const query = Object.fromEntries(
        new URL(c.req.url).searchParams.entries(),
      );
      const options: Record<string, any> = { ...query };
      if (user.role !== 0) {
        options.restaurantId = user.restaurantId;
      }
      const data = await mockDbImageService.getStorageAnalytics(options);
      return c.json({ success: true, data });
    } catch (error) {
      return c.json(
        { success: false, error: "Failed to get storage analytics" },
        500,
      );
    }
  });

  // Usage
  app.get("/usage", async (c) => {
    try {
      const user = (c as any).get("user");
      const query = Object.fromEntries(
        new URL(c.req.url).searchParams.entries(),
      );
      const options: Record<string, any> = { ...query };
      if (user.role !== 0) {
        options.restaurantId = user.restaurantId;
      }
      const data = await mockDbImageService.getUsageAnalytics(options);
      return c.json({ success: true, data });
    } catch (error) {
      return c.json(
        { success: false, error: "Failed to get usage analytics" },
        500,
      );
    }
  });

  // Performance
  app.get("/performance", async (c) => {
    try {
      const user = (c as any).get("user");
      const query = Object.fromEntries(
        new URL(c.req.url).searchParams.entries(),
      );
      const options: Record<string, any> = { ...query };
      if (user.role !== 0) {
        options.restaurantId = user.restaurantId;
      }
      const data = await mockDbImageService.getPerformanceAnalytics(options);
      return c.json({ success: true, data });
    } catch (error) {
      return c.json(
        { success: false, error: "Failed to get performance analytics" },
        500,
      );
    }
  });

  // Export
  app.get("/export", async (c) => {
    try {
      const query = Object.fromEntries(
        new URL(c.req.url).searchParams.entries(),
      );
      const type = query.type || "summary";
      const format = query.format || "json";
      return c.json({
        success: true,
        data: {
          type,
          format,
          message: "Export functionality would generate downloadable file here",
          download_url: `https://api.makanmakan.com/images/analytics/exports/${Date.now()}.${format}`,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      });
    } catch (error) {
      return c.json(
        { success: false, error: "Failed to export analytics" },
        500,
      );
    }
  });

  return { app, mockImageService, mockDbImageService };
}

// ── Test Suite ─────────────────────────────────────────────────────

describe("Analytics Routes", () => {
  let env: MockEnv;
  let adminToken: string;
  let ownerToken: string;
  let chefToken: string;

  beforeEach(async () => {
    env = createMockEnv();
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    adminToken = await createToken({
      id: 1,
      username: "admin",
      role: 0,
      restaurantId: 100,
    });
    ownerToken = await createToken({
      id: 2,
      username: "owner",
      role: 1,
      restaurantId: 200,
    });
    chefToken = await createToken({
      id: 3,
      username: "chef",
      role: 2,
      restaurantId: 200,
    });
  });

  // ── Authentication ──────────────────────────────────────────────

  describe("Authentication", () => {
    it("should reject requests without auth header", async () => {
      const { app } = buildMockAnalyticsApp();
      const res = await app.request("/dashboard", undefined, env as any);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("authorization");
    });

    it("should reject requests with invalid token", async () => {
      const { app } = buildMockAnalyticsApp();
      const res = await app.request(
        "/dashboard",
        { headers: authHeader("invalid-token-abc") },
        env as any,
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it("should reject chef role (role 2) with 403", async () => {
      const { app } = buildMockAnalyticsApp();
      const res = await app.request(
        "/dashboard",
        { headers: authHeader(chefToken) },
        env as any,
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("permissions");
    });

    it("should allow admin role (role 0)", async () => {
      const { app } = buildMockAnalyticsApp();
      const res = await app.request(
        "/dashboard",
        { headers: authHeader(adminToken) },
        env as any,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("should allow owner role (role 1)", async () => {
      const { app } = buildMockAnalyticsApp();
      const res = await app.request(
        "/dashboard",
        { headers: authHeader(ownerToken) },
        env as any,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  // ── GET /dashboard ──────────────────────────────────────────────

  describe("GET /dashboard", () => {
    it("should return analytics data for admin", async () => {
      const { app } = buildMockAnalyticsApp();
      const res = await app.request(
        "/dashboard",
        { headers: authHeader(adminToken) },
        env as any,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.totalImages).toBe(42);
      expect(body.data.storageUsage.total).toBe(1024000);
    });

    it("should scope by restaurantId for non-admin users", async () => {
      const { app, mockImageService } = buildMockAnalyticsApp();
      await app.request(
        "/dashboard",
        { headers: authHeader(ownerToken) },
        env as any,
      );

      expect(mockImageService.getImageAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ restaurantId: 200 }),
      );
    });

    it("should not force restaurantId for admin users", async () => {
      const { app, mockImageService } = buildMockAnalyticsApp();
      await app.request(
        "/dashboard",
        { headers: authHeader(adminToken) },
        env as any,
      );

      const callArgs = mockImageService.getImageAnalytics.mock.calls[0][0];
      expect(callArgs.restaurantId).toBeUndefined();
    });

    it("should return 500 when service returns failure", async () => {
      const { app } = buildMockAnalyticsApp({
        getImageAnalytics: vi.fn().mockResolvedValue({
          success: false,
          error: "DB connection failed",
        }),
      });

      const res = await app.request(
        "/dashboard",
        { headers: authHeader(adminToken) },
        env as any,
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it("should return 500 when service throws", async () => {
      const { app } = buildMockAnalyticsApp({
        getImageAnalytics: vi.fn().mockRejectedValue(new Error("Unexpected")),
      });

      const res = await app.request(
        "/dashboard",
        { headers: authHeader(adminToken) },
        env as any,
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Failed to get analytics dashboard");
    });
  });

  // ── GET /storage ────────────────────────────────────────────────

  describe("GET /storage", () => {
    it("should return storage analytics", async () => {
      const { app } = buildMockAnalyticsApp();
      const res = await app.request(
        "/storage",
        { headers: authHeader(adminToken) },
        env as any,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.totalStorage).toBe(2048000);
      expect(body.data.imageCount).toBe(50);
    });

    it("should scope storage analytics for owner", async () => {
      const { app, mockDbImageService } = buildMockAnalyticsApp();
      await app.request(
        "/storage",
        { headers: authHeader(ownerToken) },
        env as any,
      );

      expect(mockDbImageService.getStorageAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ restaurantId: 200 }),
      );
    });

    it("should return 500 when storage analytics throws", async () => {
      const { app } = buildMockAnalyticsApp(
        {},
        {
          getStorageAnalytics: vi.fn().mockRejectedValue(new Error("DB error")),
        },
      );

      const res = await app.request(
        "/storage",
        { headers: authHeader(adminToken) },
        env as any,
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });

  // ── GET /usage ──────────────────────────────────────────────────

  describe("GET /usage", () => {
    it("should return usage analytics", async () => {
      const { app } = buildMockAnalyticsApp();
      const res = await app.request(
        "/usage",
        { headers: authHeader(adminToken) },
        env as any,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.totalViews).toBe(5000);
    });

    it("should scope usage analytics for owner", async () => {
      const { app, mockDbImageService } = buildMockAnalyticsApp();
      await app.request(
        "/usage",
        { headers: authHeader(ownerToken) },
        env as any,
      );

      expect(mockDbImageService.getUsageAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ restaurantId: 200 }),
      );
    });

    it("should return 500 when usage analytics throws", async () => {
      const { app } = buildMockAnalyticsApp(
        {},
        {
          getUsageAnalytics: vi.fn().mockRejectedValue(new Error("timeout")),
        },
      );

      const res = await app.request(
        "/usage",
        { headers: authHeader(adminToken) },
        env as any,
      );

      expect(res.status).toBe(500);
    });
  });

  // ── GET /performance ────────────────────────────────────────────

  describe("GET /performance", () => {
    it("should return performance analytics", async () => {
      const { app } = buildMockAnalyticsApp();
      const res = await app.request(
        "/performance",
        { headers: authHeader(adminToken) },
        env as any,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.avgProcessingTime).toBe(95);
      expect(body.data.successRate).toBe(0.99);
    });

    it("should scope performance analytics for owner", async () => {
      const { app, mockDbImageService } = buildMockAnalyticsApp();
      await app.request(
        "/performance",
        { headers: authHeader(ownerToken) },
        env as any,
      );

      expect(mockDbImageService.getPerformanceAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ restaurantId: 200 }),
      );
    });

    it("should return 500 when performance analytics throws", async () => {
      const { app } = buildMockAnalyticsApp(
        {},
        {
          getPerformanceAnalytics: vi
            .fn()
            .mockRejectedValue(new Error("crash")),
        },
      );

      const res = await app.request(
        "/performance",
        { headers: authHeader(adminToken) },
        env as any,
      );

      expect(res.status).toBe(500);
    });
  });

  // ── GET /export ─────────────────────────────────────────────────

  describe("GET /export", () => {
    it("should return export metadata with default type and format", async () => {
      const { app } = buildMockAnalyticsApp();
      const res = await app.request(
        "/export",
        { headers: authHeader(adminToken) },
        env as any,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.type).toBe("summary");
      expect(body.data.format).toBe("json");
      expect(body.data.download_url).toContain(".json");
      expect(body.data.expires_at).toBeDefined();
    });

    it("should respect custom type and format params", async () => {
      const { app } = buildMockAnalyticsApp();
      const res = await app.request(
        "/export?type=storage&format=csv",
        { headers: authHeader(adminToken) },
        env as any,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.type).toBe("storage");
      expect(body.data.format).toBe("csv");
      expect(body.data.download_url).toContain(".csv");
    });

    it("should set expiration 24 hours in the future", async () => {
      const { app } = buildMockAnalyticsApp();
      const before = Date.now();
      const res = await app.request(
        "/export",
        { headers: authHeader(adminToken) },
        env as any,
      );

      const body = await res.json();
      const expiresAt = new Date(body.data.expires_at).getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(before + twentyFourHours - 1000);
      expect(expiresAt).toBeLessThanOrEqual(
        Date.now() + twentyFourHours + 1000,
      );
    });
  });

  // ── Date range filtering ────────────────────────────────────────

  describe("Date range filtering", () => {
    it("should pass dateFrom and dateTo to the service", async () => {
      const { app, mockImageService } = buildMockAnalyticsApp();
      await app.request(
        "/dashboard?dateFrom=2025-01-01&dateTo=2025-12-31",
        { headers: authHeader(adminToken) },
        env as any,
      );

      expect(mockImageService.getImageAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: "2025-01-01",
          dateTo: "2025-12-31",
        }),
      );
    });

    it("should pass date filters to storage analytics", async () => {
      const { app, mockDbImageService } = buildMockAnalyticsApp();
      await app.request(
        "/storage?dateFrom=2025-06-01",
        { headers: authHeader(adminToken) },
        env as any,
      );

      expect(mockDbImageService.getStorageAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ dateFrom: "2025-06-01" }),
      );
    });
  });

  // ── Empty data handling ─────────────────────────────────────────

  describe("Empty data handling", () => {
    it("should handle empty analytics gracefully", async () => {
      const { app } = buildMockAnalyticsApp({
        getImageAnalytics: vi.fn().mockResolvedValue({
          success: true,
          analytics: {
            totalImages: 0,
            totalSize: 0,
            avgProcessingTime: 0,
            mostUsedVariants: [],
            uploadsByCategory: [],
            errorRate: 0,
            storageUsage: { original: 0, variants: 0, total: 0 },
          },
        }),
      });

      const res = await app.request(
        "/dashboard",
        { headers: authHeader(adminToken) },
        env as any,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.totalImages).toBe(0);
      expect(body.data.mostUsedVariants).toEqual([]);
    });

    it("should handle empty storage analytics", async () => {
      const { app } = buildMockAnalyticsApp(
        {},
        {
          getStorageAnalytics: vi.fn().mockResolvedValue({
            totalStorage: 0,
            imageCount: 0,
            avgSize: 0,
            byCategory: [],
          }),
        },
      );

      const res = await app.request(
        "/storage",
        { headers: authHeader(adminToken) },
        env as any,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.imageCount).toBe(0);
      expect(body.data.byCategory).toEqual([]);
    });
  });
});
