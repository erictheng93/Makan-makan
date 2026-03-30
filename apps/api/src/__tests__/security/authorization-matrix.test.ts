/**
 * Authorization Matrix Tests
 * 授權矩陣測試 - 驗證每個角色對所有端點的存取權限
 *
 * This test file validates the complete authorization matrix for the system.
 * It sets up a Hono app with representative routes for each permission pattern
 * and systematically verifies that every role (Admin=0, Owner=1, Chef=2,
 * Service=3, Cashier=4) plus unauthenticated users get the correct HTTP status.
 *
 * Patterns tested:
 * - Public endpoints (no auth required)
 * - Auth-required endpoints (any authenticated role 0-4)
 * - Admin-only endpoints (role 0)
 * - Admin+Owner endpoints (roles 0, 1)
 * - Admin+Chef endpoints (roles 0, 2)
 * - Restaurant-scoped endpoints (requireRestaurantAccess)
 * - Role escalation attempts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import {
  authMiddleware,
  requireRole,
  requireRestaurantAccess,
} from "../../middleware/auth";
import { ApiError } from "../../shared/utils/api-error";
import {
  envFactory,
  userFactory,
  restaurantFactory,
  resetAllFactories,
} from "@makanmakan/testing-utils";

// ── 輔助函式 ──────────────────────────────────────────────────────────

/** 添加全域錯誤處理器（模擬 production index.ts） */
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

/** 建立模擬環境 */
const createMockEnv = (overrides: any = {}) => {
  const env = envFactory.build();
  return {
    ...env,
    TOKEN_BLACKLIST: {
      ...env.TOKEN_BLACKLIST,
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
};

/** 建立 JWT token */
const createToken = async (
  payload: any,
  secret: string,
  expiresInSeconds: number = 3600,
) => {
  const now = Math.floor(Date.now() / 1000);
  return await sign(
    { ...payload, iat: now, exp: now + expiresInSeconds },
    secret,
  );
};

// ── 角色定義 ──────────────────────────────────────────────────────────

const ROLES = {
  ADMIN: 0,
  OWNER: 1,
  CHEF: 2,
  SERVICE: 3,
  CASHIER: 4,
} as const;

const ROLE_NAMES: Record<number, string> = {
  0: "Admin (管理員)",
  1: "Owner (店主)",
  2: "Chef (廚師)",
  3: "Service (送菜員)",
  4: "Cashier (收銀)",
};

const ALL_ROLES = [
  ROLES.ADMIN,
  ROLES.OWNER,
  ROLES.CHEF,
  ROLES.SERVICE,
  ROLES.CASHIER,
] as const;

const RESTAURANT_ID = String(restaurantFactory.build().id);

// ── 測試開始 ──────────────────────────────────────────────────────────

describe("Authorization Matrix (授權矩陣)", () => {
  let mockEnv: ReturnType<typeof createMockEnv>;

  /** 為指定角色和餐廳建立 Bearer token */
  const tokenForRole = async (role: number, restaurantId?: string) => {
    const user =
      role === 0
        ? userFactory.buildAdmin()
        : role === 1
          ? userFactory.buildShopOwner(Number(restaurantId) || 1)
          : role === 2
            ? userFactory.buildChef(Number(restaurantId) || 1)
            : role === 3
              ? userFactory.buildServiceCrew(Number(restaurantId) || 1)
              : userFactory.buildCashier(Number(restaurantId) || 1);
    return createToken(
      {
        id: user.id,
        username: user.username,
        role,
        ...(restaurantId !== undefined && { restaurantId }),
      },
      mockEnv.JWT_SECRET,
    );
  };

  /** 建立帶有認證 header 的 Request */
  const makeRequest = (url: string, method: string = "GET", token?: string) => {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return new Request(`http://localhost${url}`, { method, headers });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    mockEnv = createMockEnv();
  });

  // ════════════════════════════════════════════════════════════════════
  // 1. 公開端點 (Public Endpoints) — 無需認證
  // ════════════════════════════════════════════════════════════════════

  describe("公開端點 (Public Endpoints)", () => {
    let app: Hono<any>;

    beforeEach(() => {
      app = new Hono();
      withErrorHandler(app);
      app.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });

      // 公開路由 — 不使用 authMiddleware
      app.post("/auth/login", (c) =>
        c.json({ success: true, data: { token: "mock-token" } }),
      );
      app.post("/auth/register", (c) =>
        c.json({ success: true, data: { user: { id: 1 } } }, 201),
      );
    });

    const publicEndpoints = [
      { method: "POST", path: "/auth/login", description: "Login (登入)" },
      {
        method: "POST",
        path: "/auth/register",
        description: "Customer Registration (顧客註冊)",
      },
    ];

    describe.each(publicEndpoints)(
      "$method $path — $description",
      ({ method, path }) => {
        it("should allow unauthenticated access (200/201)", async () => {
          const req = makeRequest(path, method);
          const res = await app.request(req, undefined, mockEnv);

          expect([200, 201]).toContain(res.status);
        });

        it.each(ALL_ROLES)(
          `should allow role %i (${ROLE_NAMES[0]}..${ROLE_NAMES[4]}) access`,
          async (role) => {
            const token = await tokenForRole(role, RESTAURANT_ID);
            const req = makeRequest(path, method, token);
            const res = await app.request(req, undefined, mockEnv);

            expect([200, 201]).toContain(res.status);
          },
        );
      },
    );
  });

  // ════════════════════════════════════════════════════════════════════
  // 2. 認證端點 — 任何已認證角色 (0-4) 可存取
  // ════════════════════════════════════════════════════════════════════

  describe("認證端點 — 任何已認證角色 (Auth Required, Any Role 0-4)", () => {
    let app: Hono<any>;

    beforeEach(() => {
      app = new Hono();
      withErrorHandler(app);
      app.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });

      // 需要認證但不限角色
      app.use("/auth/logout", authMiddleware);
      app.post("/auth/logout", (c) =>
        c.json({ success: true, message: "Logged out" }),
      );

      app.use("/auth/me", authMiddleware);
      app.get("/auth/me", (c) => {
        const user = c.get("user");
        return c.json({ success: true, data: user });
      });

      app.use("/orders", authMiddleware);
      app.post("/orders", (c) =>
        c.json({ success: true, data: { id: 1 } }, 201),
      );
      app.get("/orders", (c) =>
        c.json({ success: true, data: { orders: [] } }),
      );
    });

    const authAnyRoleEndpoints = [
      { method: "POST", path: "/auth/logout", description: "Logout (登出)" },
      {
        method: "GET",
        path: "/auth/me",
        description: "Current User Info (目前使用者)",
      },
      {
        method: "POST",
        path: "/orders",
        description: "Create Order (建立訂單)",
      },
      {
        method: "GET",
        path: "/orders",
        description: "List Orders (訂單列表)",
      },
    ];

    describe.each(authAnyRoleEndpoints)(
      "$method $path — $description",
      ({ method, path }) => {
        it("should reject unauthenticated access with 401", async () => {
          const req = makeRequest(path, method);
          const res = await app.request(req, undefined, mockEnv);
          const body = (await res.json()) as any;

          expect(res.status).toBe(401);
          expect(body.success).toBe(false);
          expect(body.error.code).toBe("MISSING_AUTH_HEADER");
        });

        it.each(ALL_ROLES)(
          `should allow role %i access (200/201)`,
          async (role) => {
            const token = await tokenForRole(role, RESTAURANT_ID);
            const req = makeRequest(path, method, token);
            const res = await app.request(req, undefined, mockEnv);

            expect([200, 201]).toContain(res.status);
            const body = (await res.json()) as any;
            expect(body.success).toBe(true);
          },
        );
      },
    );
  });

  // ════════════════════════════════════════════════════════════════════
  // 3. 管理員專屬端點 (Admin Only — Role 0)
  // ════════════════════════════════════════════════════════════════════

  describe("管理員專屬端點 (Admin Only — Role 0)", () => {
    let app: Hono<any>;

    beforeEach(() => {
      app = new Hono();
      withErrorHandler(app);
      app.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });

      // Admin-only 端點
      app.use("/auth/stats", authMiddleware);
      app.use("/auth/stats", requireRole([0]));
      app.get("/auth/stats", (c) =>
        c.json({ success: true, data: { totalUsers: 100 } }),
      );

      app.use("/auth/security-events", authMiddleware);
      app.use("/auth/security-events", requireRole([0]));
      app.get("/auth/security-events", (c) =>
        c.json({ success: true, data: { events: [] } }),
      );
    });

    const adminOnlyEndpoints = [
      {
        method: "GET",
        path: "/auth/stats",
        description: "Auth Statistics (認證統計)",
      },
      {
        method: "GET",
        path: "/auth/security-events",
        description: "Security Events (安全事件)",
      },
    ];

    describe.each(adminOnlyEndpoints)(
      "$method $path — $description",
      ({ method, path }) => {
        it("should reject unauthenticated access with 401", async () => {
          const req = makeRequest(path, method);
          const res = await app.request(req, undefined, mockEnv);

          expect(res.status).toBe(401);
          const body = (await res.json()) as any;
          expect(body.success).toBe(false);
        });

        it("should allow Admin (role 0) with 200", async () => {
          const token = await tokenForRole(ROLES.ADMIN, RESTAURANT_ID);
          const req = makeRequest(path, method, token);
          const res = await app.request(req, undefined, mockEnv);

          expect(res.status).toBe(200);
          const body = (await res.json()) as any;
          expect(body.success).toBe(true);
        });

        it.each([ROLES.OWNER, ROLES.CHEF, ROLES.SERVICE, ROLES.CASHIER])(
          "should reject role %i with 403 INSUFFICIENT_ROLE",
          async (role) => {
            const token = await tokenForRole(role, RESTAURANT_ID);
            const req = makeRequest(path, method, token);
            const res = await app.request(req, undefined, mockEnv);

            expect(res.status).toBe(403);
            const body = (await res.json()) as any;
            expect(body.success).toBe(false);
            expect(body.error.code).toBe("INSUFFICIENT_ROLE");
            expect(body.error.message).toBe("Insufficient permissions");
          },
        );
      },
    );
  });

  // ════════════════════════════════════════════════════════════════════
  // 4. 管理員+店主端點 (Admin + Owner — Roles 0, 1)
  // ════════════════════════════════════════════════════════════════════

  describe("管理員+店主端點 (Admin + Owner — Roles 0, 1)", () => {
    let app: Hono<any>;

    beforeEach(() => {
      app = new Hono();
      withErrorHandler(app);
      app.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });

      // Admin + Owner 端點
      const adminOwner = requireRole([0, 1]);

      app.use("/auth/register-staff", authMiddleware);
      app.use("/auth/register-staff", adminOwner);
      app.post("/auth/register-staff", (c) =>
        c.json({ success: true, data: { userId: 1 } }, 201),
      );

      app.use("/orders/stats", authMiddleware);
      app.use("/orders/stats", adminOwner);
      app.get("/orders/stats", (c) =>
        c.json({ success: true, data: { todayOrders: 50 } }),
      );

      app.use("/orders/:id", authMiddleware);
      app.use("/orders/:id", adminOwner);
      app.delete("/orders/:id", (c) =>
        c.json({ success: true, message: "Order cancelled" }),
      );

      app.use("/users", authMiddleware);
      app.use("/users", adminOwner);
      app.get("/users", (c) => c.json({ success: true, data: { users: [] } }));
      app.post("/users", (c) =>
        c.json({ success: true, data: { id: 1 } }, 201),
      );

      app.use("/analytics/dashboard", authMiddleware);
      app.use("/analytics/dashboard", adminOwner);
      app.get("/analytics/dashboard", (c) =>
        c.json({ success: true, data: { revenue: 10000 } }),
      );
    });

    const adminOwnerEndpoints = [
      {
        method: "POST",
        path: "/auth/register-staff",
        description: "Staff Registration (員工註冊)",
      },
      {
        method: "GET",
        path: "/orders/stats",
        description: "Order Statistics (訂單統計)",
      },
      {
        method: "DELETE",
        path: "/orders/1",
        description: "Cancel Order (取消訂單)",
      },
      {
        method: "GET",
        path: "/users",
        description: "List Users (使用者列表)",
      },
      {
        method: "POST",
        path: "/users",
        description: "Create User (建立使用者)",
      },
      {
        method: "GET",
        path: "/analytics/dashboard",
        description: "Analytics Dashboard (分析儀表板)",
      },
    ];

    describe.each(adminOwnerEndpoints)(
      "$method $path — $description",
      ({ method, path }) => {
        it("should reject unauthenticated access with 401", async () => {
          const req = makeRequest(path, method);
          const res = await app.request(req, undefined, mockEnv);

          expect(res.status).toBe(401);
          const body = (await res.json()) as any;
          expect(body.success).toBe(false);
        });

        it("should allow Admin (role 0) access", async () => {
          const token = await tokenForRole(ROLES.ADMIN, RESTAURANT_ID);
          const req = makeRequest(path, method, token);
          const res = await app.request(req, undefined, mockEnv);

          expect([200, 201]).toContain(res.status);
          const body = (await res.json()) as any;
          expect(body.success).toBe(true);
        });

        it("should allow Owner (role 1) access", async () => {
          const token = await tokenForRole(ROLES.OWNER, RESTAURANT_ID);
          const req = makeRequest(path, method, token);
          const res = await app.request(req, undefined, mockEnv);

          expect([200, 201]).toContain(res.status);
          const body = (await res.json()) as any;
          expect(body.success).toBe(true);
        });

        it.each([ROLES.CHEF, ROLES.SERVICE, ROLES.CASHIER])(
          "should reject role %i with 403 INSUFFICIENT_ROLE",
          async (role) => {
            const token = await tokenForRole(role, RESTAURANT_ID);
            const req = makeRequest(path, method, token);
            const res = await app.request(req, undefined, mockEnv);

            expect(res.status).toBe(403);
            const body = (await res.json()) as any;
            expect(body.success).toBe(false);
            expect(body.error.code).toBe("INSUFFICIENT_ROLE");
          },
        );
      },
    );
  });

  // ════════════════════════════════════════════════════════════════════
  // 5. 管理員+廚師端點 (Admin + Chef — Roles 0, 2)
  // ════════════════════════════════════════════════════════════════════

  describe("管理員+廚師端點 (Admin + Chef — Roles 0, 2)", () => {
    let app: Hono<any>;

    beforeEach(() => {
      app = new Hono();
      withErrorHandler(app);
      app.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });

      // Admin + Chef 端點 (廚房相關)
      app.use(
        "/kitchen/:restaurantId/events",
        authMiddleware,
        requireRole([0, 2]),
      );
      app.get("/kitchen/:restaurantId/events", (c) =>
        c.json({ success: true, data: { events: [] } }),
      );
    });

    it("should reject unauthenticated access with 401", async () => {
      const req = makeRequest(`/kitchen/${RESTAURANT_ID}/events`);
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(401);
    });

    it("should allow Admin (role 0) access", async () => {
      const token = await tokenForRole(ROLES.ADMIN, RESTAURANT_ID);
      const req = makeRequest(`/kitchen/${RESTAURANT_ID}/events`, "GET", token);
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
    });

    it("should allow Chef (role 2) access", async () => {
      const token = await tokenForRole(ROLES.CHEF, RESTAURANT_ID);
      const req = makeRequest(`/kitchen/${RESTAURANT_ID}/events`, "GET", token);
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
    });

    it.each([ROLES.OWNER, ROLES.SERVICE, ROLES.CASHIER])(
      "should reject role %i with 403 INSUFFICIENT_ROLE",
      async (role) => {
        const token = await tokenForRole(role, RESTAURANT_ID);
        const req = makeRequest(
          `/kitchen/${RESTAURANT_ID}/events`,
          "GET",
          token,
        );
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(403);
        const body = (await res.json()) as any;
        expect(body.error.code).toBe("INSUFFICIENT_ROLE");
      },
    );
  });

  // ════════════════════════════════════════════════════════════════════
  // 6. 管理員+店主端點 — 餐廳範圍 (Restaurant-Scoped)
  // ════════════════════════════════════════════════════════════════════

  describe("餐廳範圍端點 (Restaurant-Scoped — Admin + Owner)", () => {
    let app: Hono<any>;

    beforeEach(() => {
      app = new Hono();
      withErrorHandler(app);
      app.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });

      // 餐廳範圍 + 角色限制
      app.use(
        "/forecast/:restaurantId/generate",
        authMiddleware,
        requireRole([0, 1]),
        requireRestaurantAccess(),
      );
      app.post("/forecast/:restaurantId/generate", (c) =>
        c.json({ success: true, data: { forecastId: "fc-1" } }),
      );
    });

    it("should reject unauthenticated access with 401", async () => {
      const req = makeRequest(`/forecast/${RESTAURANT_ID}/generate`, "POST");
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(401);
    });

    it("should allow Admin (role 0) access to any restaurant", async () => {
      // Admin 沒有 restaurantId — 應該仍可存取任何餐廳
      const token = await tokenForRole(ROLES.ADMIN);
      const req = makeRequest(
        `/forecast/${RESTAURANT_ID}/generate`,
        "POST",
        token,
      );
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
    });

    it("should allow Owner (role 1) access to their own restaurant", async () => {
      const token = await tokenForRole(ROLES.OWNER, RESTAURANT_ID);
      const req = makeRequest(
        `/forecast/${RESTAURANT_ID}/generate`,
        "POST",
        token,
      );
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
    });

    it("should reject Owner (role 1) access to a different restaurant", async () => {
      const token = await tokenForRole(ROLES.OWNER, "rest-999");
      const req = makeRequest(
        `/forecast/${RESTAURANT_ID}/generate`,
        "POST",
        token,
      );
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toBe("Access denied to this restaurant");
    });

    it.each([ROLES.CHEF, ROLES.SERVICE, ROLES.CASHIER])(
      "should reject role %i with 403 (insufficient role, before restaurant check)",
      async (role) => {
        const token = await tokenForRole(role, RESTAURANT_ID);
        const req = makeRequest(
          `/forecast/${RESTAURANT_ID}/generate`,
          "POST",
          token,
        );
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(403);
        const body = (await res.json()) as any;
        expect(body.error.code).toBe("INSUFFICIENT_ROLE");
      },
    );
  });

  // ════════════════════════════════════════════════════════════════════
  // 7. 全角色更新端點 (All Staff — Roles 0-4)
  // ════════════════════════════════════════════════════════════════════

  describe("全員工端點 (All Staff — Roles 0-4)", () => {
    let app: Hono<any>;

    beforeEach(() => {
      app = new Hono();
      withErrorHandler(app);
      app.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });

      app.use(
        "/orders/:id/status",
        authMiddleware,
        requireRole([0, 1, 2, 3, 4]),
      );
      app.put("/orders/:id/status", (c) =>
        c.json({ success: true, data: { status: "confirmed" } }),
      );
    });

    it("should reject unauthenticated access with 401", async () => {
      const req = makeRequest("/orders/1/status", "PUT");
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(401);
    });

    it.each(ALL_ROLES)(
      "should allow role %i to update order status",
      async (role) => {
        const token = await tokenForRole(role, RESTAURANT_ID);
        const req = makeRequest("/orders/1/status", "PUT", token);
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.success).toBe(true);
      },
    );
  });

  // ════════════════════════════════════════════════════════════════════
  // 8. 餐廳存取隔離 (Restaurant Access Isolation)
  // ════════════════════════════════════════════════════════════════════

  describe("餐廳存取隔離 (Restaurant Access Isolation)", () => {
    let app: Hono<any>;

    const RESTAURANT_A = "rest-A";
    const RESTAURANT_B = "rest-B";

    beforeEach(() => {
      app = new Hono();
      withErrorHandler(app);
      app.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });

      // 餐廳範圍端點 — 任何已認證角色 + requireRestaurantAccess
      app.use(
        "/restaurant/:restaurantId/menu",
        authMiddleware,
        requireRestaurantAccess(),
      );
      app.get("/restaurant/:restaurantId/menu", (c) =>
        c.json({ success: true, data: { items: [] } }),
      );

      app.use(
        "/restaurant/:restaurantId/orders",
        authMiddleware,
        requireRestaurantAccess(),
      );
      app.get("/restaurant/:restaurantId/orders", (c) =>
        c.json({ success: true, data: { orders: [] } }),
      );
    });

    describe("Admin (管理員) — 可存取任何餐廳", () => {
      it("should access Restaurant A without restaurantId in token", async () => {
        const token = await tokenForRole(ROLES.ADMIN);
        const req = makeRequest(
          `/restaurant/${RESTAURANT_A}/menu`,
          "GET",
          token,
        );
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(200);
      });

      it("should access Restaurant B without restaurantId in token", async () => {
        const token = await tokenForRole(ROLES.ADMIN);
        const req = makeRequest(
          `/restaurant/${RESTAURANT_B}/orders`,
          "GET",
          token,
        );
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(200);
      });

      it("should access any restaurant even with a different restaurantId in token", async () => {
        const token = await tokenForRole(ROLES.ADMIN, RESTAURANT_A);
        const req = makeRequest(
          `/restaurant/${RESTAURANT_B}/menu`,
          "GET",
          token,
        );
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(200);
      });
    });

    describe("Owner (店主) — 只能存取自己的餐廳", () => {
      it("should access own restaurant", async () => {
        const token = await tokenForRole(ROLES.OWNER, RESTAURANT_A);
        const req = makeRequest(
          `/restaurant/${RESTAURANT_A}/menu`,
          "GET",
          token,
        );
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(200);
      });

      it("should be denied access to another restaurant", async () => {
        const token = await tokenForRole(ROLES.OWNER, RESTAURANT_A);
        const req = makeRequest(
          `/restaurant/${RESTAURANT_B}/menu`,
          "GET",
          token,
        );
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(403);
        const body = (await res.json()) as any;
        expect(body.error.message).toBe("Access denied to this restaurant");
      });

      it("should be denied when no restaurantId in token", async () => {
        const token = await tokenForRole(ROLES.OWNER);
        const req = makeRequest(
          `/restaurant/${RESTAURANT_A}/menu`,
          "GET",
          token,
        );
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(403);
      });
    });

    describe("Staff roles (員工角色 2-4) — 只能存取所屬餐廳", () => {
      it.each([ROLES.CHEF, ROLES.SERVICE, ROLES.CASHIER])(
        "role %i should access own restaurant",
        async (role) => {
          const token = await tokenForRole(role, RESTAURANT_A);
          const req = makeRequest(
            `/restaurant/${RESTAURANT_A}/orders`,
            "GET",
            token,
          );
          const res = await app.request(req, undefined, mockEnv);

          expect(res.status).toBe(200);
        },
      );

      it.each([ROLES.CHEF, ROLES.SERVICE, ROLES.CASHIER])(
        "role %i should be denied access to another restaurant",
        async (role) => {
          const token = await tokenForRole(role, RESTAURANT_A);
          const req = makeRequest(
            `/restaurant/${RESTAURANT_B}/orders`,
            "GET",
            token,
          );
          const res = await app.request(req, undefined, mockEnv);

          expect(res.status).toBe(403);
          const body = (await res.json()) as any;
          expect(body.error.message).toBe("Access denied to this restaurant");
        },
      );

      it.each([ROLES.CHEF, ROLES.SERVICE, ROLES.CASHIER])(
        "role %i should be denied when no restaurantId in token",
        async (role) => {
          const token = await tokenForRole(role);
          const req = makeRequest(
            `/restaurant/${RESTAURANT_A}/menu`,
            "GET",
            token,
          );
          const res = await app.request(req, undefined, mockEnv);

          expect(res.status).toBe(403);
        },
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 9. 角色升權攻擊測試 (Role Escalation Attempts)
  // ════════════════════════════════════════════════════════════════════

  describe("角色升權攻擊測試 (Role Escalation Attempts)", () => {
    let app: Hono<any>;

    beforeEach(() => {
      app = new Hono();
      withErrorHandler(app);
      app.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });

      // Staff registration — Admin + Owner only
      app.use("/auth/register-staff", authMiddleware, requireRole([0, 1]));
      app.post("/auth/register-staff", (c) =>
        c.json({ success: true, data: { userId: 1 } }, 201),
      );

      // Admin-only endpoint
      app.use("/auth/stats", authMiddleware, requireRole([0]));
      app.get("/auth/stats", (c) =>
        c.json({ success: true, data: { stats: {} } }),
      );

      // Admin+Owner endpoint
      app.use("/users", authMiddleware, requireRole([0, 1]));
      app.get("/users", (c) => c.json({ success: true, data: { users: [] } }));
    });

    describe("Chef (廚師) 試圖存取管理員端點", () => {
      it("should be rejected from admin stats", async () => {
        const token = await tokenForRole(ROLES.CHEF, RESTAURANT_ID);
        const req = makeRequest("/auth/stats", "GET", token);
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(403);
        const body = (await res.json()) as any;
        expect(body.error.code).toBe("INSUFFICIENT_ROLE");
      });

      it("should be rejected from staff registration", async () => {
        const token = await tokenForRole(ROLES.CHEF, RESTAURANT_ID);
        const req = makeRequest("/auth/register-staff", "POST", token);
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(403);
      });

      it("should be rejected from user management", async () => {
        const token = await tokenForRole(ROLES.CHEF, RESTAURANT_ID);
        const req = makeRequest("/users", "GET", token);
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(403);
      });
    });

    describe("Service Crew (送菜員) 試圖存取管理端點", () => {
      it("should be rejected from admin stats", async () => {
        const token = await tokenForRole(ROLES.SERVICE, RESTAURANT_ID);
        const req = makeRequest("/auth/stats", "GET", token);
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(403);
      });

      it("should be rejected from staff registration", async () => {
        const token = await tokenForRole(ROLES.SERVICE, RESTAURANT_ID);
        const req = makeRequest("/auth/register-staff", "POST", token);
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(403);
      });
    });

    describe("Cashier (收銀) 試圖存取管理端點", () => {
      it("should be rejected from admin stats", async () => {
        const token = await tokenForRole(ROLES.CASHIER, RESTAURANT_ID);
        const req = makeRequest("/auth/stats", "GET", token);
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(403);
      });

      it("should be rejected from user management", async () => {
        const token = await tokenForRole(ROLES.CASHIER, RESTAURANT_ID);
        const req = makeRequest("/users", "GET", token);
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(403);
      });
    });

    describe("Owner (店主) 無法存取管理員專屬端點", () => {
      it("should be rejected from admin-only auth stats", async () => {
        const token = await tokenForRole(ROLES.OWNER, RESTAURANT_ID);
        const req = makeRequest("/auth/stats", "GET", token);
        const res = await app.request(req, undefined, mockEnv);

        expect(res.status).toBe(403);
        const body = (await res.json()) as any;
        expect(body.error.code).toBe("INSUFFICIENT_ROLE");
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 10. 完整授權矩陣表格驅動測試 (Full Matrix — Table-Driven)
  // ════════════════════════════════════════════════════════════════════

  describe("完整授權矩陣 (Full Authorization Matrix — Table-Driven)", () => {
    let app: Hono<any>;

    beforeEach(() => {
      app = new Hono();
      withErrorHandler(app);
      app.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });

      // ── 公開端點 ──
      app.post("/auth/login", (c) => c.json({ success: true }));
      app.post("/auth/register", (c) => c.json({ success: true }, 201));

      // ── 認證端點 (任何角色) ──
      app.use("/auth/logout", authMiddleware);
      app.post("/auth/logout", (c) => c.json({ success: true }));

      app.use("/auth/me", authMiddleware);
      app.get("/auth/me", (c) => c.json({ success: true }));

      app.use("/orders", authMiddleware);
      app.post("/orders", (c) => c.json({ success: true }, 201));
      app.get("/orders", (c) => c.json({ success: true }));

      // ── 全員工端點 (0-4) ──
      app.use(
        "/orders/:id/status",
        authMiddleware,
        requireRole([0, 1, 2, 3, 4]),
      );
      app.put("/orders/:id/status", (c) => c.json({ success: true }));

      // ── 管理員專屬 ──
      app.use("/auth/stats", authMiddleware, requireRole([0]));
      app.get("/auth/stats", (c) => c.json({ success: true }));

      app.use("/auth/security-events", authMiddleware, requireRole([0]));
      app.get("/auth/security-events", (c) => c.json({ success: true }));

      // ── 管理員+店主 ──
      app.use("/auth/register-staff", authMiddleware, requireRole([0, 1]));
      app.post("/auth/register-staff", (c) => c.json({ success: true }, 201));

      app.use("/orders/:id", authMiddleware, requireRole([0, 1]));
      app.delete("/orders/:id", (c) => c.json({ success: true }));

      app.use("/orders/stats", authMiddleware, requireRole([0, 1]));
      app.get("/orders/stats", (c) => c.json({ success: true }));

      app.use("/users", authMiddleware, requireRole([0, 1]));
      app.get("/users", (c) => c.json({ success: true }));
      app.post("/users", (c) => c.json({ success: true }, 201));

      app.use("/analytics/dashboard", authMiddleware, requireRole([0, 1]));
      app.get("/analytics/dashboard", (c) => c.json({ success: true }));

      // ── 管理員+廚師 ──
      app.use(
        "/kitchen/:restaurantId/events",
        authMiddleware,
        requireRole([0, 2]),
      );
      app.get("/kitchen/:restaurantId/events", (c) =>
        c.json({ success: true }),
      );

      // ── 管理員+店主 + 餐廳範圍 ──
      app.use(
        "/forecast/:restaurantId/generate",
        authMiddleware,
        requireRole([0, 1]),
        requireRestaurantAccess(),
      );
      app.post("/forecast/:restaurantId/generate", (c) =>
        c.json({ success: true }),
      );
    });

    /**
     * 授權矩陣定義
     * 每一行代表一個端點及其預期的存取結果
     *
     * expectedStatus:
     *   - null = 不需認證 (公開)
     *   - 允許的角色列表
     */
    interface MatrixEntry {
      method: string;
      path: string;
      description: string;
      authRequired: boolean;
      allowedRoles: number[]; // 空陣列 = 所有角色都可存取 (配合 authRequired)
    }

    const matrix: MatrixEntry[] = [
      // 公開端點
      {
        method: "POST",
        path: "/auth/login",
        description: "Login",
        authRequired: false,
        allowedRoles: [],
      },
      {
        method: "POST",
        path: "/auth/register",
        description: "Customer Registration",
        authRequired: false,
        allowedRoles: [],
      },

      // 認證端點 — 任何角色
      {
        method: "POST",
        path: "/auth/logout",
        description: "Logout",
        authRequired: true,
        allowedRoles: [0, 1, 2, 3, 4],
      },
      {
        method: "GET",
        path: "/auth/me",
        description: "Current User",
        authRequired: true,
        allowedRoles: [0, 1, 2, 3, 4],
      },
      {
        method: "POST",
        path: "/orders",
        description: "Create Order",
        authRequired: true,
        allowedRoles: [0, 1, 2, 3, 4],
      },
      {
        method: "GET",
        path: "/orders",
        description: "List Orders",
        authRequired: true,
        allowedRoles: [0, 1, 2, 3, 4],
      },
      {
        method: "PUT",
        path: "/orders/1/status",
        description: "Update Order Status",
        authRequired: true,
        allowedRoles: [0, 1, 2, 3, 4],
      },

      // 管理員專屬
      {
        method: "GET",
        path: "/auth/stats",
        description: "Auth Statistics",
        authRequired: true,
        allowedRoles: [0],
      },
      {
        method: "GET",
        path: "/auth/security-events",
        description: "Security Events",
        authRequired: true,
        allowedRoles: [0],
      },

      // 管理員+店主
      {
        method: "POST",
        path: "/auth/register-staff",
        description: "Staff Registration",
        authRequired: true,
        allowedRoles: [0, 1],
      },
      {
        method: "DELETE",
        path: "/orders/1",
        description: "Cancel Order",
        authRequired: true,
        allowedRoles: [0, 1],
      },
      {
        method: "GET",
        path: "/orders/stats",
        description: "Order Statistics",
        authRequired: true,
        allowedRoles: [0, 1],
      },
      {
        method: "GET",
        path: "/users",
        description: "List Users",
        authRequired: true,
        allowedRoles: [0, 1],
      },
      {
        method: "POST",
        path: "/users",
        description: "Create User",
        authRequired: true,
        allowedRoles: [0, 1],
      },
      {
        method: "GET",
        path: "/analytics/dashboard",
        description: "Analytics Dashboard",
        authRequired: true,
        allowedRoles: [0, 1],
      },

      // 管理員+廚師
      {
        method: "GET",
        path: `/kitchen/${RESTAURANT_ID}/events`,
        description: "Kitchen Events",
        authRequired: true,
        allowedRoles: [0, 2],
      },

      // 管理員+店主 + 餐廳範圍
      {
        method: "POST",
        path: `/forecast/${RESTAURANT_ID}/generate`,
        description: "Generate Forecast",
        authRequired: true,
        allowedRoles: [0, 1],
      },
    ];

    describe.each(matrix)(
      "$method $path ($description)",
      ({ method, path, authRequired, allowedRoles }) => {
        if (!authRequired) {
          // 公開端點 — 未認證也可存取
          it("should be accessible without authentication", async () => {
            const req = makeRequest(path, method);
            const res = await app.request(req, undefined, mockEnv);

            expect(res.status).toBeLessThan(400);
          });
        } else {
          // 需要認證的端點
          it("should return 401 for unauthenticated requests", async () => {
            const req = makeRequest(path, method);
            const res = await app.request(req, undefined, mockEnv);

            expect(res.status).toBe(401);
          });

          // 測試每個角色
          for (const role of ALL_ROLES) {
            const isAllowed = allowedRoles.includes(role);
            const roleName = ROLE_NAMES[role];

            if (isAllowed) {
              it(`should allow ${roleName} (role ${role})`, async () => {
                const token = await tokenForRole(role, RESTAURANT_ID);
                const req = makeRequest(path, method, token);
                const res = await app.request(req, undefined, mockEnv);

                expect(res.status).toBeLessThan(400);
                const body = (await res.json()) as any;
                expect(body.success).toBe(true);
              });
            } else {
              it(`should deny ${roleName} (role ${role}) with 403`, async () => {
                const token = await tokenForRole(role, RESTAURANT_ID);
                const req = makeRequest(path, method, token);
                const res = await app.request(req, undefined, mockEnv);

                expect(res.status).toBe(403);
                const body = (await res.json()) as any;
                expect(body.success).toBe(false);
                expect(body.error.code).toBe("INSUFFICIENT_ROLE");
              });
            }
          }
        }
      },
    );
  });

  // ════════════════════════════════════════════════════════════════════
  // 11. 邊界條件 (Edge Cases)
  // ════════════════════════════════════════════════════════════════════

  describe("邊界條件 (Edge Cases)", () => {
    let app: Hono<any>;

    beforeEach(() => {
      app = new Hono();
      withErrorHandler(app);
      app.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });

      app.use("/protected", authMiddleware, requireRole([0, 1]));
      app.get("/protected", (c) => c.json({ success: true }));
    });

    it("should reject token with role outside valid range (role=5)", async () => {
      // authMiddleware 會拒絕 role > 4
      const now = Math.floor(Date.now() / 1000);
      const token = await sign(
        { id: 1, username: "hacker", role: 5, iat: now, exp: now + 3600 },
        mockEnv.JWT_SECRET,
      );

      const req = makeRequest("/protected", "GET", token);
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.error.message).toBe("Invalid role in token");
    });

    it("should reject token with negative role (role=-1)", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await sign(
        { id: 1, username: "hacker", role: -1, iat: now, exp: now + 3600 },
        mockEnv.JWT_SECRET,
      );

      const req = makeRequest("/protected", "GET", token);
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.error.message).toBe("Invalid role in token");
    });

    it("should reject token with role as string", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await sign(
        { id: 1, username: "hacker", role: "0", iat: now, exp: now + 3600 },
        mockEnv.JWT_SECRET,
      );

      const req = makeRequest("/protected", "GET", token);
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.error.message).toBe("Invalid token claims");
    });

    it("should reject token with fractional role", async () => {
      // role = 0.5 — 在 0-4 範圍內但不是整數
      // authMiddleware 只檢查 range，requireRole 做 includes 檢查
      const now = Math.floor(Date.now() / 1000);
      const token = await sign(
        { id: 1, username: "hacker", role: 0.5, iat: now, exp: now + 3600 },
        mockEnv.JWT_SECRET,
      );

      const req = makeRequest("/protected", "GET", token);
      const res = await app.request(req, undefined, mockEnv);

      // authMiddleware 通過 (0 <= 0.5 <= 4)，但 requireRole([0,1]) 拒絕 0.5
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe("INSUFFICIENT_ROLE");
    });

    it("should reject request with malformed Bearer token", async () => {
      const req = new Request("http://localhost/protected", {
        headers: { Authorization: "Bearer not.a.valid.jwt.token" },
      });
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(401);
    });

    it("should reject request with Bearer prefix but no token", async () => {
      const req = new Request("http://localhost/protected", {
        headers: { Authorization: "Bearer " },
      });
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(401);
    });

    it("should reject token signed with wrong secret", async () => {
      const token = await createToken(
        { id: 1, username: "test", role: 0 },
        "wrong-secret-that-is-also-long-enough-32-chars",
      );

      const req = makeRequest("/protected", "GET", token);
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(401);
    });

    it("should reject expired token", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await sign(
        { id: 1, username: "admin", role: 0, iat: now - 7200, exp: now - 3600 },
        mockEnv.JWT_SECRET,
      );

      const req = makeRequest("/protected", "GET", token);
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(401);
    });

    it("should reject blacklisted token", async () => {
      const token = await createToken(
        { id: 1, username: "admin", role: 0 },
        mockEnv.JWT_SECRET,
      );

      mockEnv.TOKEN_BLACKLIST.get.mockResolvedValue("blacklisted");

      const req = makeRequest("/protected", "GET", token);
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.error.message).toBe("Token has been invalidated");
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 12. requireRestaurantAccess 配合自訂參數名 (Custom Param Name)
  // ════════════════════════════════════════════════════════════════════

  describe("requireRestaurantAccess 自訂參數名 (Custom restaurantIdParam)", () => {
    let app: Hono<any>;

    beforeEach(() => {
      app = new Hono();
      withErrorHandler(app);
      app.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });

      // 使用自訂參數名 'shopId' 而非預設 'restaurantId'
      app.use(
        "/shop/:shopId/menu",
        authMiddleware,
        requireRestaurantAccess("shopId"),
      );
      app.get("/shop/:shopId/menu", (c) => c.json({ success: true }));
    });

    it("should allow Admin access with custom param name", async () => {
      const token = await tokenForRole(ROLES.ADMIN);
      const req = makeRequest("/shop/shop-123/menu", "GET", token);
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(200);
    });

    it("should allow matching restaurantId with custom param name", async () => {
      const token = await tokenForRole(ROLES.OWNER, "shop-123");
      const req = makeRequest("/shop/shop-123/menu", "GET", token);
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(200);
    });

    it("should deny non-matching restaurantId with custom param name", async () => {
      const token = await tokenForRole(ROLES.OWNER, "shop-999");
      const req = makeRequest("/shop/shop-123/menu", "GET", token);
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(403);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 13. 中間件順序驗證 (Middleware Ordering)
  // ════════════════════════════════════════════════════════════════════

  describe("中間件順序驗證 (Middleware Ordering)", () => {
    it("requireRole should fail before requireRestaurantAccess", async () => {
      // 驗證中間件按正確順序執行：auth -> role -> restaurant
      const app = new Hono();
      withErrorHandler(app);
      app.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });

      app.use(
        "/resource/:restaurantId",
        authMiddleware,
        requireRole([0, 1]),
        requireRestaurantAccess(),
      );
      app.get("/resource/:restaurantId", (c) => c.json({ success: true }));

      // Chef (role 2) 嘗試存取 — 應該在 requireRole 就被拒絕
      // 即使 restaurantId 匹配也不應通過
      const token = await tokenForRole(ROLES.CHEF, RESTAURANT_ID);
      const req = makeRequest(`/resource/${RESTAURANT_ID}`, "GET", token);
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      // 確認是 INSUFFICIENT_ROLE 而非 FORBIDDEN (餐廳存取拒絕)
      expect(body.error.code).toBe("INSUFFICIENT_ROLE");
    });

    it("authMiddleware should fail before requireRole", async () => {
      const app = new Hono();
      withErrorHandler(app);
      app.use("*", async (c, next) => {
        (c as any).env = mockEnv;
        await next();
      });

      app.use("/admin", authMiddleware, requireRole([0]));
      app.get("/admin", (c) => c.json({ success: true }));

      // 未認證請求 — 應該在 authMiddleware 就被拒絕
      const req = makeRequest("/admin");
      const res = await app.request(req, undefined, mockEnv);

      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      // 確認是認證錯誤而非角色錯誤
      expect(body.error.code).toBe("MISSING_AUTH_HEADER");
    });
  });
});
