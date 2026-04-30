/**
 * Admin Subscription Routes Integration Tests
 * 管理員訂閱路由整合測試
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";
import { sign } from "hono/jwt";

// ---------------------------------------------------------------------------
// Mock auth middleware — inject admin user so all admin routes pass
// ---------------------------------------------------------------------------

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", { id: 1, role: 0, restaurantId: null });
    await next();
  }),
  requireRole: vi.fn(
    (_roles: number[]) => async (c: any, next: any) => await next(),
  ),
}));

// ---------------------------------------------------------------------------
// Mock cache invalidation — must use vi.hoisted because vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockInvalidateCache } = vi.hoisted(() => ({
  mockInvalidateCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../middleware/moduleGate", () => ({
  invalidateSubscriptionCache: mockInvalidateCache,
}));

// ---------------------------------------------------------------------------
// Mock SubscriptionService
// ---------------------------------------------------------------------------

const mockSubRow = {
  id: "sub-1",
  restaurantId: "rest-1",
  planTier: "pro",
  moduleOverrides: {},
  isActive: true,
  trialEndsAt: null,
  billingCycleStartAt: null,
  billingCycleEndAt: null,
  notes: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockEffectiveModules = {
  menu_management: true,
  table_management: true,
  online_ordering: true,
  kitchen_display: true,
  receipt_printing: true,
  coupons: true,
  reservations: true,
  analytics: true,
  multi_branch: false,
  ai_analytics: false,
  platform_integration: false,
  loyalty: false,
};

const mockService = {
  listAll: vi.fn().mockResolvedValue([mockSubRow]),
  getByRestaurantId: vi.fn().mockResolvedValue(mockSubRow),
  create: vi.fn().mockResolvedValue(mockSubRow),
  updateModules: vi.fn().mockResolvedValue(mockSubRow),
  changePlan: vi.fn().mockResolvedValue(mockSubRow),
  setActive: vi.fn().mockResolvedValue(mockSubRow),
  getEffectiveModules: vi.fn().mockReturnValue(mockEffectiveModules),
};

vi.mock("../services/SubscriptionService", () => ({
  SubscriptionService: class MockSubscriptionService {
    constructor() {
      Object.assign(this, mockService);
    }
  },
}));

// ---------------------------------------------------------------------------
// App under test
// ---------------------------------------------------------------------------

import subscriptionRoutes from "../routes";

function buildApp() {
  const app = new Hono<any>();

  // Global error handler
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as never,
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

  // Inject a minimal env so Hono doesn't complain
  app.use("*", async (c, next) => {
    if (!c.env) {
      (c as unknown as ApiTestContextWithEnv).env = {
        DB: {},
        CACHE_KV: {},
      } as unknown as ApiTestEnv;
    }
    await next();
  });

  app.route("/", subscriptionRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Admin Subscription Routes", () => {
  let app: Hono<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-attach mocks after clearAllMocks
    mockService.listAll.mockResolvedValue([mockSubRow]);
    mockService.getByRestaurantId.mockResolvedValue(mockSubRow);
    mockService.create.mockResolvedValue(mockSubRow);
    mockService.updateModules.mockResolvedValue(mockSubRow);
    mockService.changePlan.mockResolvedValue(mockSubRow);
    mockService.setActive.mockResolvedValue(mockSubRow);
    mockService.getEffectiveModules.mockReturnValue(mockEffectiveModules);
    mockInvalidateCache.mockResolvedValue(undefined);
    app = buildApp();
  });

  // ── GET / — list all ────────────────────────────────────────────────────────

  describe("GET /", () => {
    it("returns all subscriptions with effectiveModules", async () => {
      const res = await app.request("http://localhost/");
      const body = (await res.json()) as ApiTestResponse;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        id: "sub-1",
        restaurantId: "rest-1",
        effectiveModules: mockEffectiveModules,
      });
      expect(mockService.listAll).toHaveBeenCalledOnce();
      expect(mockService.getEffectiveModules).toHaveBeenCalledOnce();
    });
  });

  // ── GET /:restaurantId — single ─────────────────────────────────────────────

  describe("GET /:restaurantId", () => {
    it("returns subscription with effectiveModules when found", async () => {
      const res = await app.request("http://localhost/rest-1");
      const body = (await res.json()) as ApiTestResponse;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        id: "sub-1",
        effectiveModules: mockEffectiveModules,
      });
      expect(mockService.getByRestaurantId).toHaveBeenCalledWith("rest-1");
    });

    it("returns 404 when subscription not found", async () => {
      mockService.getByRestaurantId.mockResolvedValue(null);

      const res = await app.request("http://localhost/nonexistent");
      const body = (await res.json()) as ApiTestResponse;

      expect(res.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // ── POST / — create ─────────────────────────────────────────────────────────

  describe("POST /", () => {
    const validPayload = {
      restaurantId: "rest-new",
      planTier: "trial",
      trialEndsAt: "2025-12-31T00:00:00.000Z",
    };

    it("creates a subscription and returns 201", async () => {
      const res = await app.request("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const body = (await res.json()) as ApiTestResponse;

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(mockService.create).toHaveBeenCalledOnce();
      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: "rest-new",
          planTier: "trial",
          trialEndsAt: expect.any(Date),
        }),
      );
    });

    it("returns 400 for missing required fields", async () => {
      const res = await app.request("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: "pro" }), // missing restaurantId
      });

      expect(res.status).toBe(400);
      expect(mockService.create).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid planTier", async () => {
      const res = await app.request("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: "r1", planTier: "platinum" }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ── PATCH /:restaurantId/modules ────────────────────────────────────────────

  describe("PATCH /:restaurantId/modules", () => {
    it("updates modules, invalidates cache, and returns effectiveModules", async () => {
      const res = await app.request("http://localhost/rest-1/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: { ai_analytics: true } }),
      });
      const body = (await res.json()) as ApiTestResponse;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty("effectiveModules");
      expect(mockService.updateModules).toHaveBeenCalledWith(
        "rest-1",
        expect.objectContaining({ overrides: expect.any(Object) }),
      );
      expect(mockInvalidateCache).toHaveBeenCalledOnce();
    });

    it("returns 400 for invalid payload", async () => {
      const res = await app.request("http://localhost/rest-1/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: { bad_module_key: "yes" } }),
      });

      // The zod schema uses moduleKeyEnum — unknown keys should fail validation
      expect(res.status).toBe(400);
    });
  });

  // ── PATCH /:restaurantId/plan ───────────────────────────────────────────────

  describe("PATCH /:restaurantId/plan", () => {
    it("changes the plan tier, invalidates cache, and returns effectiveModules", async () => {
      const res = await app.request("http://localhost/rest-1/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: "enterprise" }),
      });
      const body = (await res.json()) as ApiTestResponse;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockService.changePlan).toHaveBeenCalledWith(
        "rest-1",
        "enterprise",
      );
      expect(mockInvalidateCache).toHaveBeenCalledOnce();
    });

    it("returns 400 for an invalid plan tier", async () => {
      const res = await app.request("http://localhost/rest-1/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: "gold" }),
      });

      expect(res.status).toBe(400);
      expect(mockService.changePlan).not.toHaveBeenCalled();
    });
  });

  // ── PATCH /:restaurantId/status ─────────────────────────────────────────────

  describe("PATCH /:restaurantId/status", () => {
    it("deactivates a shop and invalidates cache (kill switch)", async () => {
      const res = await app.request("http://localhost/rest-1/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      const body = (await res.json()) as ApiTestResponse;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockService.setActive).toHaveBeenCalledWith("rest-1", false);
      expect(mockInvalidateCache).toHaveBeenCalledOnce();
    });

    it("reactivates a shop", async () => {
      const res = await app.request("http://localhost/rest-1/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });

      expect(res.status).toBe(200);
      expect(mockService.setActive).toHaveBeenCalledWith("rest-1", true);
    });

    it("returns 400 when isActive is not a boolean", async () => {
      const res = await app.request("http://localhost/rest-1/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: "yes" }),
      });

      expect(res.status).toBe(400);
      expect(mockService.setActive).not.toHaveBeenCalled();
    });
  });
});
