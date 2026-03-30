/**
 * Business Logic Security Tests
 * 業務邏輯安全測試
 *
 * Tests for business logic vulnerabilities:
 * - IDOR (Insecure Direct Object Reference) — 不安全的直接物件引用
 * - Privilege Escalation — 權限提升攻擊
 * - Cross-Tenant Access — 跨租戶存取
 * - Session Hijacking Prevention — 防止會話劫持
 * - Guest Token Scope Escalation — 訪客 Token 範圍提升
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import type { Context, Next } from "hono";
import type { Env } from "../../shared/types";
import { ApiError } from "../../shared/utils/api-error";
import {
  createAuthRoutes,
  type AuthMiddleware,
  type RequireRoleFactory,
  type BlacklistTokenFn,
  type AuthServiceFactory,
} from "../../features/authentication/routes";
import { OrdersService } from "../../features/orders/services/OrdersService";
import { requireRestaurantAccess } from "../../middleware/auth";
import {
  envFactory,
  userFactory,
  restaurantFactory,
  resetAllFactories,
} from "@makanmakan/testing-utils";

// ── Mock dependencies ──────────────────────────────────────────────────

vi.mock("../../utils/errorSanitizer", () => ({
  ErrorSanitizer: { logAndSanitize: vi.fn() },
}));

vi.mock("../../core/database", () => ({
  getDatabaseConnection: vi.fn(() => ({})),
}));

vi.mock("../../core/cache", () => ({
  KVCacheService: vi.fn(function () {
    return { get: vi.fn(), set: vi.fn(), delete: vi.fn(), clear: vi.fn() };
  }),
}));

vi.mock("../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function () {
    return { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
  }),
  SimplePerformanceTracker: vi.fn(function () {
    return {
      startTimer: vi.fn(() => "timer"),
      endTimer: vi.fn(() => 100),
      recordMetric: vi.fn(),
    };
  }),
}));

vi.mock("@makanmakan/database", () => ({
  OrderService: vi.fn(function () {
    return {
      createOrder: vi.fn(),
      getOrder: vi.fn(),
      getOrders: vi.fn(),
      updateOrderStatus: vi.fn(),
      cancelOrder: vi.fn(),
      getDailyOrderStats: vi.fn(),
    };
  }),
  CouponService: vi.fn(function () {
    return { validateCoupon: vi.fn() };
  }),
}));

vi.mock("../../services/RealtimeBroadcastService", () => ({
  RealtimeBroadcastService: vi.fn(function () {
    return {
      broadcastNewOrder: vi.fn().mockResolvedValue({
        success: true,
        eventId: "evt-1",
        recipientCount: 1,
      }),
      broadcastOrderStatusUpdate: vi.fn().mockResolvedValue({
        success: true,
        eventId: "evt-2",
        recipientCount: 1,
      }),
      generateEventId: vi.fn(() => "evt-123"),
    };
  }),
}));

// ── Helpers ────────────────────────────────────────────────────────────

const JWT_SECRET = envFactory.build().JWT_SECRET;

const createMockEnv = (): Record<string, any> => {
  const env = envFactory.build();
  return {
    ...env,
    NODE_ENV: "test",
    TOKEN_BLACKLIST: {
      ...env.TOKEN_BLACKLIST,
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    },
    CACHE_KV: {
      ...env.CACHE_KV,
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
};

/** Sign a JWT with standard claims */
const createToken = async (
  payload: Record<string, any>,
  secret: string = JWT_SECRET,
) => {
  const now = Math.floor(Date.now() / 1000);
  return await sign({ ...payload, iat: now, exp: now + 3600 }, secret);
};

/** Attach global onError handler matching the production pattern */
function withErrorHandler(app: Hono<any>): void {
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
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

/** Create mock auth service with all required methods */
function createMockAuthService() {
  return {
    login: vi.fn(),
    register: vi.fn(),
    refreshToken: vi.fn(),
    logout: vi.fn(),
    validateToken: vi.fn(),
    changePassword: vi.fn(),
    getUserSessions: vi.fn(),
    terminateSession: vi.fn(),
    terminateAllSessions: vi.fn(),
    getUserProfile: vi.fn(),
    updateUserProfile: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    verifyEmail: vi.fn(),
    getAuthStatistics: vi.fn(),
    getSecurityEvents: vi.fn(),
  };
}

/** Standard mock auth middleware — sets c.set("user", ...) from JWT */
function createJwtAuthMiddleware(
  secret: string = envFactory.build().JWT_SECRET,
): AuthMiddleware {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }
    const token = authHeader.substring(7);
    try {
      const { verify } = await import("hono/jwt");
      const decoded = (await verify(token, secret, "HS256")) as any;
      c.set("user", {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role,
        restaurantId: decoded.restaurantId,
      });
      await next();
    } catch {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }
  };
}

/** Create mock order with restaurant ID */
const makeMockOrder = (
  id: number,
  restaurantId: string,
  status: string = "pending",
) => ({
  id,
  orderNumber: `ORD-${id}`,
  restaurantId,
  tableId: 1,
  totalAmount: 5000,
  status,
  notes: "",
  items: [{ menuItemId: 1, quantity: 1 }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// ======================================================================
// 1. IDOR (Insecure Direct Object Reference) — 不安全的直接物件引用
// ======================================================================

describe("IDOR — Profile Access (不安全的直接物件引用)", () => {
  let app: Hono<{ Bindings: Env }>;
  let mockService: ReturnType<typeof createMockAuthService>;
  let env: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    env = createMockEnv();
    mockService = createMockAuthService();

    const authMiddleware = createJwtAuthMiddleware();
    const requireRole: RequireRoleFactory = (roles: number[]) => {
      return async (c: Context<{ Bindings: Env }>, next: Next) => {
        const user = c.get("user");
        if (!user || !roles.includes(user.role)) {
          return c.json(
            { success: false, error: "Insufficient permissions" },
            403,
          );
        }
        await next();
      };
    };
    const blacklistToken: BlacklistTokenFn = vi
      .fn()
      .mockResolvedValue(undefined);
    const AuthService: AuthServiceFactory = () => mockService;

    const routes = createAuthRoutes({
      authMiddleware,
      requireRole,
      blacklistToken,
      AuthService,
    });

    app = new Hono<{ Bindings: Env }>();
    withErrorHandler(app);
    app.route("/auth", routes);
  });

  // 用戶A嘗試存取用戶B的個人資料 — 必須被拒絕
  it("should return 403 when User A (role=1, id=10) tries to GET /profile/20 (User B)", async () => {
    const ownerA = userFactory.buildShopOwner(1);
    const userB = userFactory.buildShopOwner(2);
    const tokenA = await createToken({
      id: ownerA.id,
      username: ownerA.username,
      role: ownerA.role,
      restaurantId: "rest-A",
    });

    const res = await app.request(
      `/auth/profile/${userB.id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenA}`,
          "Content-Type": "application/json",
        },
      },
      env,
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    // getUserProfile 不應該被呼叫 — 在權限檢查階段就被攔截
    expect(mockService.getUserProfile).not.toHaveBeenCalled();
  });

  // 用戶A嘗試修改用戶B的個人資料 — 必須被拒絕
  it("should return 403 when User A (role=1, id=10) tries to PUT /profile/20", async () => {
    const ownerA = userFactory.buildShopOwner(1);
    const userB = userFactory.buildShopOwner(2);
    const tokenA = await createToken({
      id: ownerA.id,
      username: ownerA.username,
      role: ownerA.role,
      restaurantId: "rest-A",
    });

    const res = await app.request(
      `/auth/profile/${userB.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokenA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fullName: "Hacked Name" }),
      },
      env,
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    // updateUserProfile 不應該被呼叫
    expect(mockService.updateUserProfile).not.toHaveBeenCalled();
  });

  // 管理員可以存取任何用戶的個人資料
  it("should return 200 when Admin (role=0) tries to GET /profile/20", async () => {
    const admin = userFactory.buildAdmin();
    const userB = userFactory.buildShopOwner(1);
    const adminToken = await createToken({
      id: admin.id,
      username: admin.username,
      role: admin.role,
    });

    mockService.getUserProfile.mockResolvedValue({
      id: userB.id,
      username: userB.username,
      fullName: userB.fullName,
      role: userB.role,
    });

    const res = await app.request(
      `/auth/profile/${userB.id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(userB.id);
    expect(mockService.getUserProfile).toHaveBeenCalledOnce();
    expect(mockService.getUserProfile).toHaveBeenCalledWith(userB.id);
  });

  // 用戶存取自己的個人資料 — 允許
  it("should return 200 when user accesses their own profile", async () => {
    const ownerA = userFactory.buildShopOwner(1);
    const token = await createToken({
      id: ownerA.id,
      username: ownerA.username,
      role: ownerA.role,
      restaurantId: "rest-A",
    });

    mockService.getUserProfile.mockResolvedValue({
      id: ownerA.id,
      username: ownerA.username,
      fullName: ownerA.fullName,
      role: ownerA.role,
    });

    const res = await app.request(
      `/auth/profile/${ownerA.id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ownerA.id);
    expect(mockService.getUserProfile).toHaveBeenCalledOnce();
  });
});

// ======================================================================
// 2. Privilege Escalation — Staff Registration (權限提升攻擊)
// ======================================================================

describe("Privilege Escalation — Staff Registration (權限提升攻擊)", () => {
  let app: Hono<{ Bindings: Env }>;
  let mockService: ReturnType<typeof createMockAuthService>;
  let env: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    env = createMockEnv();
    mockService = createMockAuthService();

    const authMiddleware = createJwtAuthMiddleware();
    const requireRole: RequireRoleFactory = (roles: number[]) => {
      return async (c: Context<{ Bindings: Env }>, next: Next) => {
        const user = c.get("user");
        if (!user || !roles.includes(user.role)) {
          return c.json(
            { success: false, error: "Insufficient permissions" },
            403,
          );
        }
        await next();
      };
    };
    const blacklistToken: BlacklistTokenFn = vi
      .fn()
      .mockResolvedValue(undefined);
    const AuthService: AuthServiceFactory = () => mockService;

    const routes = createAuthRoutes({
      authMiddleware,
      requireRole,
      blacklistToken,
      AuthService,
    });

    app = new Hono<{ Bindings: Env }>();
    withErrorHandler(app);
    app.route("/auth", routes);
  });

  const staffPayload = {
    username: "new-staff",
    fullName: "New Staff",
    email: "staff@test.com",
    phone: "+60123456789",
    password: "Test@1234",
    confirmPassword: "Test@1234",
    restaurantId: "S-20240101-001",
  };

  // 店主嘗試註冊管理員帳號 — 必須被拒絕（權限提升攻擊）
  it("should return 403 when Owner (role=1) tries to register admin (role=0)", async () => {
    const owner = userFactory.buildShopOwner(1);
    const ownerToken = await createToken({
      id: owner.id,
      username: owner.username,
      role: owner.role,
      restaurantId: "rest-A",
    });

    const res = await app.request(
      "/auth/register-staff",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...staffPayload,
          role: 0,
          restaurantId: "S-20240101-001",
        }),
      },
      env,
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toContain("Shop owners can only create staff accounts");
    // register 不應該被呼叫 — 在權限檢查階段就被攔截
    expect(mockService.register).not.toHaveBeenCalled();
  });

  // 店主嘗試註冊另一個店主帳號 — 必須被拒絕
  it("should return 403 when Owner (role=1) tries to register another owner (role=1)", async () => {
    const owner = userFactory.buildShopOwner(1);
    const ownerToken = await createToken({
      id: owner.id,
      username: owner.username,
      role: owner.role,
      restaurantId: "rest-A",
    });

    const res = await app.request(
      "/auth/register-staff",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...staffPayload,
          role: 1,
          restaurantId: "S-20240101-001",
        }),
      },
      env,
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toContain("Shop owners can only create staff accounts");
    expect(mockService.register).not.toHaveBeenCalled();
  });

  // 店主註冊廚師帳號 — 允許
  it("should succeed when Owner (role=1) registers a chef (role=2)", async () => {
    const owner = userFactory.buildShopOwner(1);
    const ownerToken = await createToken({
      id: owner.id,
      username: owner.username,
      role: owner.role,
      restaurantId: "rest-A",
    });

    mockService.register.mockResolvedValue({
      success: true,
      user: { id: 50, username: "new-staff", role: 2 },
    });

    const res = await app.request(
      "/auth/register-staff",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...staffPayload,
          role: 2,
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(mockService.register).toHaveBeenCalledOnce();
    // 驗證 createdBy 參數 — 傳入的是當前用戶 ID
    expect(mockService.register).toHaveBeenCalledWith(
      expect.objectContaining({ role: 2 }),
      owner.id, // createdBy = owner's ID
    );
  });

  // 廚師嘗試註冊任何員工 — 必須被拒絕（只有 role 0/1 可以註冊）
  it("should return 403 when Chef (role=2) tries to register staff", async () => {
    const chef = userFactory.buildChef(1);
    const chefToken = await createToken({
      id: chef.id,
      username: chef.username,
      role: chef.role,
      restaurantId: "rest-A",
    });

    const res = await app.request(
      "/auth/register-staff",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${chefToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...staffPayload,
          role: 3,
        }),
      },
      env,
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(mockService.register).not.toHaveBeenCalled();
  });

  // 收銀員嘗試註冊員工 — 必須被拒絕
  it("should return 403 when Cashier (role=4) tries to register staff", async () => {
    const cashier = userFactory.buildCashier(1);
    const cashierToken = await createToken({
      id: cashier.id,
      username: cashier.username,
      role: cashier.role,
      restaurantId: "rest-A",
    });

    const res = await app.request(
      "/auth/register-staff",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cashierToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...staffPayload,
          role: 3,
        }),
      },
      env,
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(mockService.register).not.toHaveBeenCalled();
  });

  // 管理員可以註冊任何角色的帳號
  it("should succeed when Admin (role=0) registers any role", async () => {
    const admin = userFactory.buildAdmin();
    const adminToken = await createToken({
      id: admin.id,
      username: admin.username,
      role: admin.role,
    });

    mockService.register.mockResolvedValue({
      success: true,
      user: { id: 60, username: "new-owner", role: 1 },
    });

    const res = await app.request(
      "/auth/register-staff",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...staffPayload,
          role: 1,
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(mockService.register).toHaveBeenCalledOnce();
  });
});

// ======================================================================
// 3. Cross-Tenant Order Access — Service Level (跨租戶訂單存取)
// ======================================================================

describe("Cross-Tenant Order Access — Service Level (跨租戶訂單存取)", () => {
  let service: OrdersService;
  let mockEnv: ReturnType<typeof createMockEnv>;
  let mockBaseOrderService: any;

  const RESTAURANT_A = String(restaurantFactory.build().id);
  const RESTAURANT_B = String(restaurantFactory.build().id);

  beforeEach(async () => {
    vi.clearAllMocks();
    resetAllFactories();
    mockEnv = createMockEnv();

    const { OrderService, CouponService } =
      await import("@makanmakan/database");

    mockBaseOrderService = {
      createOrder: vi.fn(),
      getOrder: vi.fn(),
      getOrders: vi.fn(),
      updateOrderStatus: vi.fn(),
      cancelOrder: vi.fn(),
      getDailyOrderStats: vi.fn(),
    };

    const mockCouponService = { validateCoupon: vi.fn() };

    (OrderService as any).mockImplementation(function () {
      return mockBaseOrderService;
    });
    (CouponService as any).mockImplementation(function () {
      return mockCouponService;
    });

    service = new OrdersService(mockEnv as any);
  });

  // 餐廳A的店主嘗試查看餐廳B的訂單 — 必須被拒絕
  it("should reject when Shop Owner from Restaurant A views Restaurant B's order", async () => {
    const orderFromB = makeMockOrder(99, RESTAURANT_B);
    mockBaseOrderService.getOrder.mockResolvedValue(orderFromB);

    const callerFromA = {
      userId: 10,
      userRole: 1,
      userRestaurantId: RESTAURANT_A,
    };

    await expect(service.getOrder(99, true, callerFromA)).rejects.toThrow(
      "Access denied",
    );
    expect(mockBaseOrderService.getOrder).toHaveBeenCalledWith(99);
  });

  // 餐廳A的店主嘗試更新餐廳B的訂單狀態 — 必須被拒絕
  it("should reject when Shop Owner from Restaurant A updates Restaurant B's order status", async () => {
    const orderFromB = makeMockOrder(99, RESTAURANT_B, "pending");
    mockBaseOrderService.getOrder.mockResolvedValue(orderFromB);

    const callerFromA = {
      userId: 10,
      userRole: 1,
      userRestaurantId: RESTAURANT_A,
    };

    await expect(
      service.updateOrderStatus(
        99,
        { status: "confirmed" as any, notes: "" },
        10,
        1 as any,
        callerFromA,
      ),
    ).rejects.toThrow("Access denied");

    // updateOrderStatus 在 base service 不應該被呼叫
    expect(mockBaseOrderService.updateOrderStatus).not.toHaveBeenCalled();
  });

  // 餐廳A的店主嘗試取消餐廳B的訂單 — 必須被拒絕
  it("should reject when Shop Owner from Restaurant A cancels Restaurant B's order", async () => {
    const orderFromB = makeMockOrder(99, RESTAURANT_B, "pending");
    mockBaseOrderService.getOrder.mockResolvedValue(orderFromB);

    const callerFromA = {
      userId: 10,
      userRole: 1,
      userRestaurantId: RESTAURANT_A,
    };

    await expect(
      service.cancelOrder(99, "Test cancel", 10, callerFromA),
    ).rejects.toThrow("Access denied");

    // cancelOrder 在 base service 不應該被呼叫
    expect(mockBaseOrderService.cancelOrder).not.toHaveBeenCalled();
  });

  // 管理員可以查看任何餐廳的訂單
  it("should allow Admin to view any restaurant's orders", async () => {
    const orderFromB = makeMockOrder(99, RESTAURANT_B);
    mockBaseOrderService.getOrder.mockResolvedValue(orderFromB);

    const adminCaller = {
      userId: 1,
      userRole: 0,
      userRestaurantId: undefined as string | undefined,
    };

    const result = await service.getOrder(99, true, adminCaller);
    expect(result).not.toBeNull();
    expect(result!.restaurantId).toBe(RESTAURANT_B);
    expect(mockBaseOrderService.getOrder).toHaveBeenCalledWith(99);
  });

  // CallerContext 覆蓋：用戶傳入 restaurantId=B 但 CallerContext 為 restaurantId=A
  // 過濾器必須被覆蓋為 A（防止用戶手動篡改 query 參數）
  it("should override restaurantId filter to caller's restaurant via CallerContext", async () => {
    const callerFromA = {
      userId: 10,
      userRole: 1,
      userRestaurantId: RESTAURANT_A,
    };

    mockBaseOrderService.getOrders.mockResolvedValue({
      orders: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    // 用戶嘗試傳入 restaurantId=B，但 CallerContext 為 A
    await service.getOrders(
      { restaurantId: RESTAURANT_B },
      10,
      1 as any,
      callerFromA,
    );

    // 驗證實際傳給 base service 的 restaurantId 是 A（CallerContext 覆蓋了用戶輸入）
    const calledFilters = mockBaseOrderService.getOrders.mock.calls[0][0];
    expect(calledFilters.restaurantId).toBe(RESTAURANT_A);
  });

  // 管理員使用 getOrders 時不受 CallerContext 限制
  it("should not override restaurantId filter for Admin in getOrders", async () => {
    const adminCaller = {
      userId: 1,
      userRole: 0,
      userRestaurantId: undefined as string | undefined,
    };

    mockBaseOrderService.getOrders.mockResolvedValue({
      orders: [makeMockOrder(1, RESTAURANT_B)],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    await service.getOrders(
      { restaurantId: RESTAURANT_B },
      1,
      0 as any,
      adminCaller,
    );

    const calledFilters = mockBaseOrderService.getOrders.mock.calls[0][0];
    expect(calledFilters.restaurantId).toBe(RESTAURANT_B);
  });
});

// ======================================================================
// 4. Cross-Tenant Restaurant Access — Middleware Level (跨租戶餐廳存取)
// ======================================================================

describe("Cross-Tenant Restaurant Access — Middleware Level (跨租戶餐廳存取)", () => {
  let app: Hono<{ Bindings: Env }>;
  let env: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    env = createMockEnv();

    app = new Hono<{ Bindings: Env }>();
    withErrorHandler(app);

    // 使用真正的 JWT 驗證中間件
    const authMw = createJwtAuthMiddleware();

    // 設置一個受保護的餐廳路由
    app.get(
      "/restaurant/:restaurantId/menu",
      authMw,
      requireRestaurantAccess("restaurantId"),
      async (c) => {
        return c.json({ success: true, data: { menu: [] } }, 200);
      },
    );
  });

  // 店主嘗試存取其他餐廳 — 必須被拒絕
  it("should return 403 when Owner with restaurantId='rest-A' accesses /restaurant/rest-B/menu", async () => {
    const owner = userFactory.buildShopOwner(1);
    const token = await createToken({
      id: owner.id,
      username: owner.username,
      role: owner.role,
      restaurantId: "rest-A",
    });

    const res = await app.request(
      "/restaurant/rest-B/menu",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      env,
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
  });

  // 店主存取自己的餐廳 — 允許
  it("should return 200 when Owner with restaurantId='rest-A' accesses /restaurant/rest-A/menu", async () => {
    const owner = userFactory.buildShopOwner(1);
    const token = await createToken({
      id: owner.id,
      username: owner.username,
      role: owner.role,
      restaurantId: "rest-A",
    });

    const res = await app.request(
      "/restaurant/rest-A/menu",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
  });

  // 沒有 restaurantId 的廚師嘗試存取任何餐廳 — 必須被拒絕
  it("should return 403 when Chef with no restaurantId accesses any restaurant", async () => {
    const chef = userFactory.buildChef(1);
    const token = await createToken({
      id: chef.id,
      username: chef.username,
      role: chef.role,
      // 故意不設定 restaurantId — 模擬異常狀態
    });

    const res = await app.request(
      "/restaurant/rest-A/menu",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      env,
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
  });

  // 管理員可以存取任何餐廳
  it("should return 200 when Admin accesses any restaurant", async () => {
    const admin = userFactory.buildAdmin();
    const adminToken = await createToken({
      id: admin.id,
      username: admin.username,
      role: admin.role,
    });

    const res = await app.request(
      "/restaurant/rest-B/menu",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
  });
});

// ======================================================================
// 5. Session Hijacking Prevention (防止會話劫持)
// ======================================================================

describe("Session Hijacking Prevention (防止會話劫持)", () => {
  let app: Hono<{ Bindings: Env }>;
  let mockService: ReturnType<typeof createMockAuthService>;
  let env: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    env = createMockEnv();
    mockService = createMockAuthService();

    const authMiddleware = createJwtAuthMiddleware();
    const requireRole: RequireRoleFactory = (roles: number[]) => {
      return async (c: Context<{ Bindings: Env }>, next: Next) => {
        const user = c.get("user");
        if (!user || !roles.includes(user.role)) {
          return c.json(
            { success: false, error: "Insufficient permissions" },
            403,
          );
        }
        await next();
      };
    };
    const blacklistToken: BlacklistTokenFn = vi
      .fn()
      .mockResolvedValue(undefined);
    const AuthService: AuthServiceFactory = () => mockService;

    const routes = createAuthRoutes({
      authMiddleware,
      requireRole,
      blacklistToken,
      AuthService,
    });

    app = new Hono<{ Bindings: Env }>();
    withErrorHandler(app);
    app.route("/auth", routes);
  });

  // 用戶A的 token 用於終止用戶B的會話 — 實際上 session 路由使用 JWT 中的 user.id
  // 所以即使用戶A嘗試，terminateSession 仍然使用用戶A的 ID
  it("should use JWT user.id (not URL param) for session termination — prevents hijacking", async () => {
    const userA = userFactory.buildShopOwner(1);
    const tokenA = await createToken({
      id: userA.id,
      username: userA.username,
      role: userA.role,
      restaurantId: "rest-A",
    });

    mockService.terminateSession.mockResolvedValue(true);

    // 用戶A嘗試終止某個 session（session 路由使用 user.id from JWT）
    const res = await app.request(
      "/auth/sessions/session-xyz",
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenA}` },
      },
      env,
    );

    expect(res.status).toBe(200);
    // 驗證 terminateSession 使用的是 JWT 中的 user.id，不是其他用戶的 ID
    expect(mockService.terminateSession).toHaveBeenCalledOnce();
    expect(mockService.terminateSession).toHaveBeenCalledWith(
      userA.id,
      "session-xyz",
    );
  });

  // 用戶A的 token 嘗試終止所有會話 — 只應終止自己的
  it("should use JWT user.id for terminate-all-sessions — prevents hijacking", async () => {
    const userA = userFactory.buildShopOwner(1);
    const tokenA = await createToken({
      id: userA.id,
      username: userA.username,
      role: userA.role,
      restaurantId: "rest-A",
    });

    mockService.terminateAllSessions.mockResolvedValue(true);

    const res = await app.request(
      "/auth/sessions",
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenA}` },
      },
      env,
    );

    expect(res.status).toBe(200);
    // 驗證 terminateAllSessions 使用的是 JWT 中的 user.id
    expect(mockService.terminateAllSessions).toHaveBeenCalledOnce();
    expect(mockService.terminateAllSessions).toHaveBeenCalledWith(userA.id);
  });

  // 用戶A的 token 用於更改密碼 — change-password 使用 JWT 中的 user.id
  it("should use JWT user.id for change-password — prevents changing another user's password", async () => {
    const userA = userFactory.buildShopOwner(1);
    const tokenA = await createToken({
      id: userA.id,
      username: userA.username,
      role: userA.role,
      restaurantId: "rest-A",
    });

    mockService.changePassword.mockResolvedValue({ success: true });

    const res = await app.request(
      "/auth/change-password",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "OldPass@123",
          newPassword: "NewPass@456",
          confirmPassword: "NewPass@456",
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    // 驗證 changePassword 使用的是 JWT 中的 user.id
    expect(mockService.changePassword).toHaveBeenCalledOnce();
    expect(mockService.changePassword).toHaveBeenCalledWith(
      userA.id, // JWT user.id — 不是通過 URL 參數傳入的
      "OldPass@123",
      "NewPass@456",
    );
  });

  // 用戶A查看會話列表 — 只應返回自己的會話
  it("should use JWT user.id for listing sessions — prevents viewing other users' sessions", async () => {
    const userA = userFactory.buildShopOwner(1);
    const tokenA = await createToken({
      id: userA.id,
      username: userA.username,
      role: userA.role,
      restaurantId: "rest-A",
    });

    mockService.getUserSessions.mockResolvedValue([
      { id: "sess-1", userId: userA.id, createdAt: Date.now() },
    ]);

    const res = await app.request(
      "/auth/sessions",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenA}` },
      },
      env,
    );

    expect(res.status).toBe(200);
    // 驗證 getUserSessions 使用的是 JWT 中的 user.id
    expect(mockService.getUserSessions).toHaveBeenCalledOnce();
    expect(mockService.getUserSessions).toHaveBeenCalledWith(userA.id);
  });
});

// ======================================================================
// 6. Guest Token Scope Escalation (訪客 Token 範圍提升)
// ======================================================================

describe("Guest Token Scope Escalation (訪客 Token 範圍提升)", () => {
  let app: Hono<{ Bindings: Env }>;
  let env: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    env = createMockEnv();
    app = new Hono<{ Bindings: Env }>();
    withErrorHandler(app);

    // 使用真正的 JWT 驗證中間件保護的端點
    const authMw = createJwtAuthMiddleware();

    app.get("/orders", authMw, async (c) => {
      return c.json({ success: true, data: { orders: [] } }, 200);
    });

    // 訪客 token 保護的端點 — 驗證 orderId 匹配
    app.get("/orders/guest/:id", async (c) => {
      const authHeader = c.req.header("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer gt_")) {
        return c.json(
          { success: false, error: "Missing or invalid guest token" },
          401,
        );
      }

      const token = authHeader.substring(7);
      const kvKey = `guest_token:${token}`;
      const tokenData = await c.env.CACHE_KV.get(kvKey, "json");

      if (!tokenData) {
        return c.json(
          { success: false, error: "Guest token expired or invalid" },
          401,
        );
      }

      // 驗證 orderId 匹配
      const routeOrderId = c.req.param("id");
      if (routeOrderId && (tokenData as any).orderId !== routeOrderId) {
        return c.json(
          { success: false, error: "Token does not match this order" },
          403,
        );
      }

      return c.json({ success: true, data: { order: tokenData } }, 200);
    });
  });

  // 訪客 token 嘗試存取 JWT 保護的端點 — 必須被拒絕
  it("should return 401 when guest token accesses JWT-protected endpoint", async () => {
    const guestToken =
      "gt_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    const res = await app.request(
      "/orders",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${guestToken}` },
      },
      env,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
  });

  // 訪客 token 存取錯誤的訂單 — 必須被拒絕
  it("should return 403 when guest token for order-1 accesses order-2", async () => {
    const guestToken =
      "gt_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    // 模擬 KV 中儲存的 guest token 資料 — 綁定到 order-1
    env.CACHE_KV.get = vi
      .fn()
      .mockImplementation(async (key: string, format?: string) => {
        if (key === `guest_token:${guestToken}`) {
          const data = {
            orderId: "order-1",
            restaurantId: "rest-A",
            guestName: "Guest",
            phoneLastDigits: "1234",
            createdAt: Date.now(),
          };
          return format === "json" ? data : JSON.stringify(data);
        }
        return null;
      });

    // 嘗試用 order-1 的 token 存取 order-2
    const res = await app.request(
      "/orders/guest/order-2",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${guestToken}` },
      },
      env,
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toContain("Token does not match this order");
  });

  // 訪客 token 存取正確的訂單 — 允許
  it("should return 200 when guest token accesses matching order", async () => {
    const guestToken =
      "gt_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    env.CACHE_KV.get = vi
      .fn()
      .mockImplementation(async (key: string, format?: string) => {
        if (key === `guest_token:${guestToken}`) {
          const data = {
            orderId: "order-1",
            restaurantId: "rest-A",
            guestName: "Guest",
            phoneLastDigits: "1234",
            createdAt: Date.now(),
          };
          return format === "json" ? data : JSON.stringify(data);
        }
        return null;
      });

    // 使用正確的 orderId
    const res = await app.request(
      "/orders/guest/order-1",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${guestToken}` },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
  });

  // 過期或無效的訪客 token — 必須被拒絕
  it("should return 401 when guest token is expired or not in KV", async () => {
    const expiredToken =
      "gt_expired1234567890expired1234567890expired1234567890expired12345";

    // KV 回傳 null — token 已過期或不存在
    env.CACHE_KV.get = vi.fn().mockResolvedValue(null);

    const res = await app.request(
      "/orders/guest/order-1",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${expiredToken}` },
      },
      env,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toContain("Guest token expired or invalid");
  });

  // 沒有 Authorization header 的訪客請求 — 必須被拒絕
  it("should return 401 when no Authorization header is provided for guest endpoint", async () => {
    const res = await app.request(
      "/orders/guest/order-1",
      {
        method: "GET",
      },
      env,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toContain("Missing or invalid guest token");
  });

  // JWT token（非訪客 token）嘗試存取訪客端點 — 必須被拒絕
  it("should return 401 when JWT token (not guest token) accesses guest endpoint", async () => {
    const owner = userFactory.buildShopOwner(1);
    const jwtToken = await createToken({
      id: owner.id,
      username: owner.username,
      role: owner.role,
      restaurantId: "rest-A",
    });

    const res = await app.request(
      "/orders/guest/order-1",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${jwtToken}` },
      },
      env,
    );

    // JWT token 不以 "gt_" 開頭，所以會被拒絕
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toContain("Missing or invalid guest token");
  });
});
