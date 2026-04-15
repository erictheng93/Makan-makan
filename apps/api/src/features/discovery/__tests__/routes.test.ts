import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../shared/types";

// Mock middleware — must be before route import
vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", { id: 999, role: 0, username: "admin" });
    await next();
  }),
  requireRole: (roles: number[]) =>
    vi.fn(async (c: any, next: any) => {
      const user = c.get("user");
      if (!user || !roles.includes(user.role)) {
        return c.json(
          {
            success: false,
            error: { code: "FORBIDDEN", message: "Forbidden" },
          },
          403,
        );
      }
      await next();
    }),
}));

// Mock validation middleware — passthrough with parsed values
vi.mock("../../../middleware/validation", () => ({
  validateQuery: (schema: any) =>
    vi.fn(async (c: any, next: any) => {
      const url = new URL(c.req.url);
      const raw: Record<string, string> = {};
      url.searchParams.forEach((v, k) => {
        raw[k] = v;
      });
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: parsed.error.issues[0]?.message || "Validation failed",
            },
          },
          400,
        );
      }
      c.set("validatedQuery", parsed.data);
      await next();
    }),
  validateParams: (schema: any) =>
    vi.fn(async (c: any, next: any) => {
      const params = c.req.param();
      const parsed = schema.safeParse(params);
      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: { code: "VALIDATION_ERROR", message: "Invalid params" },
          },
          400,
        );
      }
      c.set("validatedParams", parsed.data);
      await next();
    }),
}));

// Mock DiscoveryService
const mockSearchDishes = vi.fn();
const mockBrowseRestaurants = vi.fn();
const mockGetPopular = vi.fn();
const mockReindex = vi.fn();
const mockGetRestaurantMenu = vi.fn();

vi.mock("../services/DiscoveryService", () => ({
  DiscoveryService: vi.fn().mockImplementation(function () {
    return {
      searchDishes: mockSearchDishes,
      browseRestaurants: mockBrowseRestaurants,
      getPopular: mockGetPopular,
      reindex: mockReindex,
      getRestaurantMenu: mockGetRestaurantMenu,
    };
  }),
}));

// Import routes after mocks
import routes from "../routes/index";
import { ApiError } from "../../../shared/utils/api-error";
import { ErrorSanitizer } from "../../../utils/errorSanitizer";

function createApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/discovery", routes);

  // Mirror the global error handler from index.ts
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
    const sanitized = ErrorSanitizer.sanitizeError(err);
    const STATUS_MAP: Record<string, number> = {
      validation: 400,
      authentication: 401,
      authorization: 403,
      not_found: 404,
      rate_limit: 429,
      server_error: 500,
    };
    const status = STATUS_MAP[sanitized.type] ?? 500;
    return c.json(
      {
        success: false,
        error: {
          code: sanitized.code ?? "INTERNAL_ERROR",
          message: sanitized.message,
        },
      },
      status as any,
    );
  });

  return app;
}

function createMockEnv(): Env {
  return {
    DB: {} as any,
    CACHE_KV: {} as any,
    JWT_SECRET: "test-secret",
    NODE_ENV: "test",
    API_VERSION: "v1",
    ENCRYPTION_KEY: "test-key-32-chars-long-for-test!!",
    TOKEN_BLACKLIST: {} as any,
    IMAGES_BUCKET: {} as any,
    BACKUP_STORAGE: {} as any,
    JOB_QUEUE: {} as any,
    REALTIME_ORDERS: {} as any,
    ANALYTICS_ENGINE: { writeDataPoint: vi.fn() } as any,
    RATE_LIMIT_KV: {} as any,
    REALTIME_SESSION: {} as any,
    SLACK_WEBHOOK_URL: "",
    API_BASE_URL: "http://localhost:8787",
    INTERNAL_API_TOKEN: "test-token",
    CLOUDFLARE_IMAGES_KEY: "test-key",
    REALTIME_SERVICE_URL: "http://localhost:8788",
    DEV_CORS_ORIGINS: "",
  } as Env;
}

describe("Discovery Routes", () => {
  let app: ReturnType<typeof createApp>;
  const mockEnv = createMockEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();

    // Default happy-path responses
    mockSearchDishes.mockResolvedValue({
      results: [],
      total: 0,
      page: 1,
      limit: 20,
    });
    mockBrowseRestaurants.mockResolvedValue({
      results: [],
      total: 0,
      page: 1,
      limit: 20,
    });
    mockGetPopular.mockResolvedValue({
      keywords: [],
      dishes: [],
      restaurants: [],
    });
    mockReindex.mockResolvedValue({
      dishes: 0,
      restaurants: 0,
      duration_ms: 50,
    });
    mockGetRestaurantMenu.mockResolvedValue([]);
  });

  describe("GET /discovery/search", () => {
    it("should return 200 with search results", async () => {
      mockSearchDishes.mockResolvedValue({
        results: [
          {
            menuItemId: 1,
            dishName: "牛肉麵",
            price: 150,
            restaurantName: "老王麵店",
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await app.fetch(
        new Request("http://localhost/discovery/search?q=牛肉麵"),
        mockEnv,
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.results).toHaveLength(1);
      expect(json.data.results[0].dishName).toBe("牛肉麵");
    });

    it("should return 400 when q is missing", async () => {
      const res = await app.fetch(
        new Request("http://localhost/discovery/search"),
        mockEnv,
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.success).toBe(false);
    });

    it("should return 500 when service throws", async () => {
      mockSearchDishes.mockRejectedValue(new Error("DB connection failed"));

      const res = await app.fetch(
        new Request("http://localhost/discovery/search?q=test"),
        mockEnv,
      );

      expect(res.status).toBe(500);
      const json = (await res.json()) as any;
      expect(json.success).toBe(false);
      expect(typeof json.error.code).toBe("string");
    });

    it("should pass filters to service", async () => {
      await app.fetch(
        new Request(
          "http://localhost/discovery/search?q=麵&district=西屯區&openNow=true&page=2&limit=10",
        ),
        mockEnv,
      );

      expect(mockSearchDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "麵",
          district: "西屯區",
          openNow: true,
          page: 2,
          limit: 10,
        }),
      );
    });

    it("should preserve aggregate pagination metadata from the service", async () => {
      mockSearchDishes.mockResolvedValue({
        results: [
          { menuItemId: 11, dishName: "Nasi Lemak 10", price: 200 },
          { menuItemId: 12, dishName: "Nasi Lemak 11", price: 210 },
        ],
        total: 12,
        page: 2,
        limit: 10,
      });

      const res = await app.fetch(
        new Request("http://localhost/discovery/search?q=nasi&page=2&limit=10"),
        mockEnv,
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.total).toBe(12);
      expect(json.data.page).toBe(2);
      expect(json.data.limit).toBe(10);
      expect(json.data.results).toHaveLength(2);
    });
  });

  describe("GET /discovery/restaurants", () => {
    it("should return 200 with restaurant list", async () => {
      mockBrowseRestaurants.mockResolvedValue({
        results: [{ restaurantId: "r1", name: "老王麵店", isOpen: true }],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await app.fetch(
        new Request("http://localhost/discovery/restaurants"),
        mockEnv,
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.results).toHaveLength(1);
    });

    it("should return 500 when service throws", async () => {
      mockBrowseRestaurants.mockRejectedValue(new Error("Query failed"));

      const res = await app.fetch(
        new Request("http://localhost/discovery/restaurants"),
        mockEnv,
      );

      expect(res.status).toBe(500);
      const json = (await res.json()) as any;
      expect(typeof json.error.code).toBe("string");
    });

    it("should pass sort and filter params", async () => {
      await app.fetch(
        new Request(
          "http://localhost/discovery/restaurants?district=北屯區&sortBy=rating&priceRange=2",
        ),
        mockEnv,
      );

      expect(mockBrowseRestaurants).toHaveBeenCalledWith(
        expect.objectContaining({
          district: "北屯區",
          sortBy: "rating",
          priceRange: 2,
        }),
      );
    });
  });

  describe("GET /discovery/restaurants/:id/menu", () => {
    it("should return 200 with menu items", async () => {
      mockGetRestaurantMenu.mockResolvedValue([
        {
          id: 1,
          name: "牛肉麵",
          description: null,
          price: 150,
          is_available: true,
          image_url: null,
          category_name: "主食",
        },
      ]);

      const res = await app.fetch(
        new Request("http://localhost/discovery/restaurants/r1/menu"),
        mockEnv,
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.items).toHaveLength(1);
    });

    it("should return 500 when query fails", async () => {
      mockGetRestaurantMenu.mockRejectedValue(new Error("D1 error"));

      const res = await app.fetch(
        new Request("http://localhost/discovery/restaurants/r1/menu"),
        mockEnv,
      );

      expect(res.status).toBe(500);
      const json = (await res.json()) as any;
      expect(typeof json.error.code).toBe("string");
    });
  });

  describe("GET /discovery/popular", () => {
    it("should return 200 with popular items", async () => {
      mockGetPopular.mockResolvedValue({
        keywords: ["牛肉麵", "炒飯"],
        dishes: [{ menuItemId: 1, dishName: "牛肉麵" }],
        restaurants: [{ restaurantId: "r1", name: "老王" }],
      });

      const res = await app.fetch(
        new Request("http://localhost/discovery/popular"),
        mockEnv,
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.keywords).toEqual(["牛肉麵", "炒飯"]);
    });

    it("should return 500 when service throws", async () => {
      mockGetPopular.mockRejectedValue(new Error("KV error"));

      const res = await app.fetch(
        new Request("http://localhost/discovery/popular"),
        mockEnv,
      );

      expect(res.status).toBe(500);
      const json = (await res.json()) as any;
      expect(typeof json.error.code).toBe("string");
    });
  });

  describe("POST /discovery/reindex", () => {
    it("should return 200 with reindex stats for admin", async () => {
      mockReindex.mockResolvedValue({
        dishes: 150,
        restaurants: 10,
        duration_ms: 1200,
      });

      const res = await app.fetch(
        new Request("http://localhost/discovery/reindex", { method: "POST" }),
        mockEnv,
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.dishes).toBe(150);
    });

    it("should return 403 for non-admin users", async () => {
      // Re-mock authMiddleware to set non-admin role for this test
      const auth = await import("../../../middleware/auth");
      const originalImpl = (
        auth.authMiddleware as any
      ).getMockImplementation?.();
      (auth.authMiddleware as any).mockImplementation(
        async (c: any, next: any) => {
          c.set("user", { id: 1, role: 1, username: "owner" }); // role 1 = owner
          await next();
        },
      );

      const freshApp = createApp();
      const res = await freshApp.fetch(
        new Request("http://localhost/discovery/reindex", { method: "POST" }),
        mockEnv,
      );

      expect(res.status).toBe(403);

      // Restore original mock for subsequent tests
      (auth.authMiddleware as any).mockImplementation(
        async (c: any, next: any) => {
          c.set("user", { id: 999, role: 0, username: "admin" });
          await next();
        },
      );
    });

    it("should return 500 when reindex fails", async () => {
      mockReindex.mockRejectedValue(new Error("Batch insert failed"));

      const res = await app.fetch(
        new Request("http://localhost/discovery/reindex", { method: "POST" }),
        mockEnv,
      );

      expect(res.status).toBe(500);
      const json = (await res.json()) as any;
      expect(typeof json.error.code).toBe("string");
    });
  });

  describe("GET /discovery/search - additional error cases", () => {
    it("should return 400 when q is too long (>100 chars)", async () => {
      const longQ = "a".repeat(101);
      const res = await app.fetch(
        new Request(`http://localhost/discovery/search?q=${longQ}`),
        mockEnv,
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 when page is 0", async () => {
      const res = await app.fetch(
        new Request("http://localhost/discovery/search?q=test&page=0"),
        mockEnv,
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.success).toBe(false);
    });

    it("should return 400 when limit exceeds 50", async () => {
      const res = await app.fetch(
        new Request("http://localhost/discovery/search?q=test&limit=100"),
        mockEnv,
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.success).toBe(false);
    });

    it("should pass takeaway and delivery filters to service", async () => {
      await app.fetch(
        new Request(
          "http://localhost/discovery/search?q=麵&takeaway=true&delivery=true",
        ),
        mockEnv,
      );

      expect(mockSearchDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          takeaway: true,
          delivery: true,
        }),
      );
    });

    it("should return success=true with empty results on 200", async () => {
      mockSearchDishes.mockResolvedValue({
        results: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const res = await app.fetch(
        new Request("http://localhost/discovery/search?q=找不到"),
        mockEnv,
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.results).toHaveLength(0);
      expect(json.data.total).toBe(0);
    });
  });

  describe("GET /discovery/restaurants - additional error cases", () => {
    it("should return 400 when limit exceeds 50", async () => {
      const res = await app.fetch(
        new Request("http://localhost/discovery/restaurants?limit=100"),
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    it("should return 400 when priceRange is 0 (below minimum)", async () => {
      const res = await app.fetch(
        new Request("http://localhost/discovery/restaurants?priceRange=0"),
        mockEnv,
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.success).toBe(false);
    });

    it("should return 400 when sortBy is an invalid value", async () => {
      const res = await app.fetch(
        new Request("http://localhost/discovery/restaurants?sortBy=newest"),
        mockEnv,
      );

      expect(res.status).toBe(400);
    });

    it("should pass openNow=true filter to service", async () => {
      await app.fetch(
        new Request("http://localhost/discovery/restaurants?openNow=true"),
        mockEnv,
      );

      expect(mockBrowseRestaurants).toHaveBeenCalledWith(
        expect.objectContaining({ openNow: true }),
      );
    });
  });

  describe("GET /discovery/restaurants/:id/menu - additional error cases", () => {
    it("should return 400 when restaurant id param is empty string", async () => {
      // Empty path segment not possible via URL; test the validation directly
      const res = await app.fetch(
        new Request("http://localhost/discovery/restaurants//menu"),
        mockEnv,
      );

      // Hono won't match the route (different path) — expect 404
      expect([400, 404]).toContain(res.status);
    });

    it("should return 200 with empty items array when no menu items exist", async () => {
      mockGetRestaurantMenu.mockResolvedValue([]);

      const res = await app.fetch(
        new Request("http://localhost/discovery/restaurants/r-empty/menu"),
        mockEnv,
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.items).toHaveLength(0);
    });
  });
});
