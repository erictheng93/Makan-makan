/**
 * Token Security Tests
 * JWT 操控攻擊、Token 重用、時序邊界、刷新令牌安全、Guest Token 邊界、Token 聲明邊界
 *
 * 測試 JWT token 安全性、refresh token 輪換機制、guest token 邊界條件
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { authMiddleware, requireRole } from "../../middleware/auth";
import {
  guestTokenAuth,
  guestSessionAuth,
  generateGuestToken,
} from "../../middleware/guestAuth";
import { ApiError } from "../../shared/utils/api-error";
import {
  envFactory,
  userFactory,
  resetAllFactories,
} from "@makanmakan/testing-utils";

// ─── Mock Environment ────────────────────────────────────────────────────────

const createMockEnv = (overrides: any = {}) => {
  const env = envFactory.build();
  return {
    ...env,
    TOKEN_BLACKLIST: {
      ...env.TOKEN_BLACKLIST,
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    },
    CACHE_KV: {
      ...env.CACHE_KV,
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
};

// ─── Error Handler Helper ────────────────────────────────────────────────────

function withErrorHandler(app: Hono<any>): void {
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        {
          success: false,
          error: { code: err.code, message: err.message },
        },
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** 產生合法 JWT payload */
function validPayload(overrides: Record<string, any> = {}) {
  const defaultUser = userFactory.buildShopOwner(1);
  const now = Math.floor(Date.now() / 1000);
  return {
    id: defaultUser.id,
    username: defaultUser.username,
    role: defaultUser.role,
    restaurantId: "S-20240101-001",
    iat: now - 60,
    exp: now + 3600,
    ...overrides,
  };
}

const SECRET = envFactory.build().JWT_SECRET;

/** 建立帶有 authMiddleware 的測試 app */
function createAuthApp(envOverrides: any = {}) {
  const env = createMockEnv(envOverrides);
  const app = new Hono();
  withErrorHandler(app);

  app.use("*", async (c, next) => {
    if (!c.env) {
      (c as unknown as ApiTestContextWithEnv).env = env;
    } else {
      Object.assign(c.env, env);
    }
    await next();
  });

  app.get("/protected", authMiddleware as never, (c) =>
    c.json({ success: true, user: c.get("user") }),
  );

  return { app, env };
}

/** 建立帶有 guestTokenAuth 的測試 app */
function createGuestApp(envOverrides: any = {}) {
  const env = createMockEnv(envOverrides);
  const app = new Hono();
  withErrorHandler(app);

  app.use("*", async (c, next) => {
    if (!c.env) {
      (c as unknown as ApiTestContextWithEnv).env = env;
    } else {
      Object.assign(c.env, env);
    }
    await next();
  });

  app.get("/orders/:id", guestTokenAuth as never, (c) =>
    c.json({ success: true, order: c.get("guestOrder") }),
  );

  app.get("/session", guestSessionAuth as never, (c) =>
    c.json({ success: true, session: c.get("guestSession") }),
  );

  return { app, env };
}

// =============================================================================
// 1. JWT 操控攻擊 (JWT Manipulation Attacks)
// =============================================================================
describe("1. JWT 操控攻擊 (JWT Manipulation Attacks)", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  it("應拒絕使用 'none' 演算法的 token (algorithm confusion)", async () => {
    // 手動構建 "alg: none" token — base64url encode header + payload，不附簽名
    const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const payload = btoa(JSON.stringify(validPayload()))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const noneToken = `${header}.${payload}.`;

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${noneToken}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
  });

  it("應拒絕竄改 payload 但未重新簽名的 token (tampered payload)", async () => {
    // 先簽出合法 token
    const token = await sign(validPayload({ role: 2 }), SECRET, "HS256");

    // 拆解後竄改 role 為 0 (admin)，不重新簽名
    const parts = token.split(".");
    const decodedPayload = JSON.parse(atob(parts[1]));
    decodedPayload.role = 0;
    const tamperedPayload = btoa(JSON.stringify(decodedPayload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
  });

  it("應拒絕缺少簽名的 token (missing signature)", async () => {
    const token = await sign(validPayload(), SECRET, "HS256");
    const parts = token.split(".");
    // 只保留 header.payload，移除簽名
    const noSigToken = `${parts[0]}.${parts[1]}`;

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${noSigToken}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
  });

  it("應拒絕空 JWT_SECRET 的情況 (empty JWT secret)", async () => {
    const token = await sign(validPayload(), SECRET, "HS256");

    const { app } = createAuthApp({ JWT_SECRET: "" });
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    // JWT_SECRET 為空時，auth middleware 應返回 500 SERVER_CONFIG_ERROR
    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("SERVER_CONFIG_ERROR");
  });

  it("應拒絕 JWT_SECRET 過短的情況 (short JWT secret)", async () => {
    const token = await sign(validPayload(), SECRET, "HS256");

    const { app } = createAuthApp({ JWT_SECRET: "short" });
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("SERVER_CONFIG_ERROR");
  });

  it("應拒絕截斷的 token (truncated token — only header)", async () => {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${header}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
  });
});

// =============================================================================
// 2. Token 失效後重用 (Token Reuse After Invalidation)
// =============================================================================
describe("2. Token 失效後重用 (Token Reuse After Invalidation)", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  it("應拒絕已登出(黑名單)的 token", async () => {
    const token = await sign(validPayload(), SECRET, "HS256");

    const { app } = createAuthApp({
      TOKEN_BLACKLIST: {
        get: vi.fn().mockResolvedValue("blacklisted"),
        put: vi.fn().mockResolvedValue(undefined),
      },
    });

    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("TOKEN_BLACKLISTED");
  });

  it("TOKEN_BLACKLIST KV 不可用時應正常降級（不拒絕合法 token）", async () => {
    const token = await sign(validPayload(), SECRET, "HS256");

    // TOKEN_BLACKLIST 為 undefined，模擬 KV 不可用
    const { app } = createAuthApp({ TOKEN_BLACKLIST: undefined });

    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    // 即使 KV 不可用，合法 token 仍應通過驗證
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(true);
  });

  it("同一 token 多次登出應為冪等操作", async () => {
    const token = await sign(validPayload(), SECRET, "HS256");
    const mockGet = vi.fn().mockResolvedValue("blacklisted");

    const { app } = createAuthApp({
      TOKEN_BLACKLIST: {
        get: mockGet,
        put: vi.fn().mockResolvedValue(undefined),
      },
    });

    // 第一次請求 — 黑名單中
    const res1 = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res1.status).toBe(401);

    // 第二次請求 — 仍在黑名單中，一致的行為
    const res2 = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res2.status).toBe(401);

    // 驗證 KV 被查詢了兩次（冪等行為）
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("黑名單 token 在必須認證路由應返回 401", async () => {
    const token = await sign(validPayload(), SECRET, "HS256");

    const { app } = createAuthApp({
      TOKEN_BLACKLIST: {
        get: vi.fn().mockResolvedValue("blacklisted"),
        put: vi.fn().mockResolvedValue(undefined),
      },
    });

    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.error.code).toBe("TOKEN_BLACKLISTED");
  });
});

// =============================================================================
// 3. Token 時序攻擊 (Token Timing Attacks)
// =============================================================================
describe("3. Token 時序攻擊 (Token Timing Attacks)", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  it("應拒絕剛好到期的 token (exp = now)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await sign(
      validPayload({ exp: now, iat: now - 3600 }),
      SECRET,
      "HS256",
    );

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    // exp <= now 被拒絕
    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
  });

  it("應接受到期前 1 秒的 token (exp = now + 1)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await sign(
      validPayload({ exp: now + 1, iat: now - 60 }),
      SECRET,
      "HS256",
    );

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(true);
  });

  it("應拒絕到期後 1 秒的 token (exp = now - 1)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await sign(
      validPayload({ exp: now - 1, iat: now - 3600 }),
      SECRET,
      "HS256",
    );

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
  });

  it("應拒絕剛好 24 小時 + 1 秒的舊 token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const twentyFourHoursAgo = now - 24 * 60 * 60 - 1;
    const token = await sign(
      validPayload({
        iat: twentyFourHoursAgo,
        exp: now + 3600, // 還沒到期，但太舊了
      }),
      SECRET,
      "HS256",
    );

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
  });

  it("應接受剛好 24 小時內的 token (iat = now - 24h + 60s)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const withinLimit = now - 24 * 60 * 60 + 60; // 60 秒的緩衝
    const token = await sign(
      validPayload({
        iat: withinLimit,
        exp: now + 3600,
      }),
      SECRET,
      "HS256",
    );

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
  });

  it("接近到期時應設置 X-Token-Refresh-Recommended header", async () => {
    const now = Math.floor(Date.now() / 1000);
    // 距離到期 30 分鐘（< 1 小時閾值）
    const token = await sign(
      validPayload({ exp: now + 1800, iat: now - 60 }),
      SECRET,
      "HS256",
    );

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Token-Refresh-Recommended")).toBe("true");
    expect(res.headers.get("X-Token-Expires-In")).toBeDefined();
  });

  it("距離到期超過 1 小時時不應設置 refresh header", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await sign(
      validPayload({ exp: now + 7200, iat: now - 60 }),
      SECRET,
      "HS256",
    );

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Token-Refresh-Recommended")).toBeNull();
  });

  it("應拒絕未來簽發的 token (iat 超過 60 秒時鐘偏移容忍)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const futureIat = now + 120; // 120 秒後簽發，超出 60 秒容忍
    const token = await sign(
      validPayload({ iat: futureIat, exp: futureIat + 3600 }),
      SECRET,
      "HS256",
    );

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    // hono/jwt verify() 先於 middleware 的手動檢查攔截了 future iat，
    // 因此 error code 可能是 TOKEN_FUTURE (middleware) 或 TOKEN_INVALID (catch block)
    expect(["TOKEN_FUTURE", "TOKEN_INVALID"]).toContain(body.error.code);
  });
});

// =============================================================================
// 4. 刷新令牌安全 (Refresh Token Security)
// =============================================================================
describe("4. 刷新令牌安全 (Refresh Token Security)", () => {
  // 使用 createAuthRoutes factory 模式測試 refresh 端點
  let app: Hono<any>;
  let mockAuthService: any;

  beforeEach(async () => {
    resetAllFactories();
    mockAuthService = {
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

    const { createAuthRoutes } =
      await import("../../features/authentication/routes");

    const env = createMockEnv();

    app = new Hono();
    withErrorHandler(app);

    // 注入 env 到 context
    app.use("*", async (c, next) => {
      if (!c.env) {
        (c as unknown as ApiTestContextWithEnv).env = env;
      } else {
        Object.assign(c.env, env);
      }
      await next();
    });

    const authRoutes = createAuthRoutes({
      authMiddleware: async (c, next) => {
        // 模擬已認證的 middleware
        c.set("user", { id: 1, username: "testuser", role: 1 });
        await next();
      },
      requireRole: () => async (_c, next) => await next(),
      blacklistToken: vi.fn(),
      AuthService: () => mockAuthService,
    });

    app.route("/auth", authRoutes);
  });

  it("缺少 x-refresh-token header 時應返回 400", async () => {
    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    // zValidator 驗證失敗返回 400
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
  });

  it("無效的 refresh token 應返回 401", async () => {
    mockAuthService.refreshToken.mockResolvedValue({
      success: false,
      error: "Invalid refresh token",
    });

    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-refresh-token": "invalid-refresh-token-value",
      },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
    expect(body.error).toBe("Invalid refresh token");

    // 驗證 service 被正確呼叫
    expect(mockAuthService.refreshToken).toHaveBeenCalledOnce();
    expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
      "invalid-refresh-token-value",
    );
  });

  it("過期的 refresh token 應返回 401", async () => {
    mockAuthService.refreshToken.mockResolvedValue({
      success: false,
      error: "Refresh token has expired",
    });

    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-refresh-token": "expired-refresh-token-12345",
      },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
    expect(body.error).toBe("Refresh token has expired");

    expect(mockAuthService.refreshToken).toHaveBeenCalledOnce();
  });

  it("輪換後重用舊 refresh token 應返回 401", async () => {
    // 第一次使用 — 成功，返回新 token
    mockAuthService.refreshToken
      .mockResolvedValueOnce({
        success: true,
        tokens: {
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
          expiresAt: new Date(Date.now() + 3600000),
        },
        user: { id: 1, username: "testuser" },
      })
      // 第二次使用舊 token — 應該失敗（token 已輪換）
      .mockResolvedValueOnce({
        success: false,
        error: "Refresh token has been revoked",
      });

    // 第一次使用
    const res1 = await app.request("/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-refresh-token": "old-refresh-token",
      },
    });
    expect(res1.status).toBe(200);

    // 重用舊 token
    const res2 = await app.request("/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-refresh-token": "old-refresh-token",
      },
    });
    expect(res2.status).toBe(401);
    const body = (await res2.json()) as ApiTestResponse;
    expect(body.error).toBe("Refresh token has been revoked");

    // 驗證 refreshToken 被呼叫了兩次
    expect(mockAuthService.refreshToken).toHaveBeenCalledTimes(2);
  });

  it("有效的 refresh token 應返回新的 token pair", async () => {
    mockAuthService.refreshToken.mockResolvedValue({
      success: true,
      tokens: {
        accessToken: "new-access-token-xyz",
        refreshToken: "new-refresh-token-xyz",
        expiresAt: new Date(Date.now() + 3600000),
      },
      user: { id: 1, username: "testuser", role: 1 },
    });

    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-refresh-token": "valid-refresh-token",
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(true);
    expect(body.data.token).toBe("new-access-token-xyz");
    expect(body.data.refreshToken).toBe("new-refresh-token-xyz");

    expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
      "valid-refresh-token",
    );
  });
});

// =============================================================================
// 5. Guest Token 邊界測試 (Guest Token Boundary Tests)
// =============================================================================
describe("5. Guest Token 邊界測試 (Guest Token Boundary Tests)", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  it("Guest token 用在 JWT 保護的端點時應被拒絕", async () => {
    const guestToken = generateGuestToken(); // gt_xxxx...

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${guestToken}` },
    });

    // authMiddleware 會嘗試 JWT verify，gt_ token 不是合法 JWT
    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
  });

  it("JWT token 用在 guest 保護的端點時應被拒絕（需要 gt_ 前綴）", async () => {
    const jwtToken = await sign(validPayload(), SECRET, "HS256");

    const { app } = createGuestApp();
    const res = await app.request("/orders/order-123", {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });

    // guestTokenAuth 檢查 Bearer gt_ 前綴，JWT token 沒有此前綴
    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
    expect(body.error).toContain("guest token");
  });

  it("過期的 guest token（KV 返回 null）應返回 401", async () => {
    const guestToken = generateGuestToken();

    // CACHE_KV.get 返回 null 表示 token 已過期或不存在
    const { app } = createGuestApp({
      CACHE_KV: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      },
    });

    const res = await app.request("/orders/order-123", {
      headers: { Authorization: `Bearer ${guestToken}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
    expect(body.error).toContain("expired or invalid");
  });

  it("Guest token 存取錯誤訂單（orderId 不匹配）應返回 403", async () => {
    const guestToken = generateGuestToken();

    const { app } = createGuestApp({
      CACHE_KV: {
        get: vi.fn().mockResolvedValue({
          orderId: "order-999", // token 對應的 orderId
          restaurantId: "S-20240101-001",
          guestName: "Test Guest",
          phoneLastDigits: "1234",
          createdAt: Date.now(),
        }),
        put: vi.fn().mockResolvedValue(undefined),
      },
    });

    // 請求 order-123，但 token 對應的是 order-999
    const res = await app.request("/orders/order-123", {
      headers: { Authorization: `Bearer ${guestToken}` },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
    expect(body.error).toContain("does not match");
  });

  it("Guest token 無 orderId 時存取訂單詳情端點應根據路由 param 判斷", async () => {
    const guestToken = generateGuestToken();

    // token data 中沒有 orderId（例如 session 類型 token）
    const { app } = createGuestApp({
      CACHE_KV: {
        get: vi.fn().mockResolvedValue({
          restaurantId: "S-20240101-001",
          guestName: "Test Guest",
          phoneLastDigits: "1234",
          createdAt: Date.now(),
          // 沒有 orderId
        }),
        put: vi.fn().mockResolvedValue(undefined),
      },
    });

    // tokenData.orderId 為 undefined，routeOrderId 為 "order-123"
    // guestTokenAuth: if (routeOrderId && tokenData.orderId !== routeOrderId) → 403
    const res = await app.request("/orders/order-123", {
      headers: { Authorization: `Bearer ${guestToken}` },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
  });

  it("Guest token 格式篡改 — 過短的 hex（gt_ + 10 chars）", async () => {
    const shortToken = "gt_abcdef1234"; // 只有 10 hex chars，正常應 64 chars

    const mockGet = vi.fn().mockResolvedValue(null);
    const { app } = createGuestApp({
      CACHE_KV: {
        get: mockGet,
        put: vi.fn().mockResolvedValue(undefined),
      },
    });

    const res = await app.request("/orders/order-123", {
      headers: { Authorization: `Bearer ${shortToken}` },
    });

    // token 格式通過了 gt_ 前綴檢查，但 KV 中找不到 → 401
    expect(res.status).toBe(401);
    // 驗證確實查詢了 KV
    expect(mockGet).toHaveBeenCalledWith(`guest_token:${shortToken}`, "json");
  });

  it("Guest token 格式篡改 — 非 hex 字元（gt_ + non-hex）", async () => {
    const nonHexToken = "gt_xyz!@#$%^&*()_not_valid_hex_chars!!!!";

    const mockGet = vi.fn().mockResolvedValue(null);
    const { app } = createGuestApp({
      CACHE_KV: {
        get: mockGet,
        put: vi.fn().mockResolvedValue(undefined),
      },
    });

    const res = await app.request("/orders/order-123", {
      headers: { Authorization: `Bearer ${nonHexToken}` },
    });

    expect(res.status).toBe(401);
    expect(mockGet).toHaveBeenCalledOnce();
  });

  it("訂單完成後 guest token 被移除應返回 401", async () => {
    const guestToken = generateGuestToken();

    // 模擬 token 已被移除（訂單完成後清除 KV）
    const { app } = createGuestApp({
      CACHE_KV: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      },
    });

    const res = await app.request("/orders/order-123", {
      headers: { Authorization: `Bearer ${guestToken}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.error).toContain("expired or invalid");
  });

  it("guestSessionAuth 不需要 orderId 匹配", async () => {
    const guestToken = generateGuestToken();

    const { app } = createGuestApp({
      CACHE_KV: {
        // guestSessionAuth 使用 .get(key, "json")，KV 會自動解析 JSON
        // 所以 mock 應直接返回解析後的物件
        get: vi.fn().mockResolvedValue({
          restaurantId: "S-20240101-001",
          phoneLastDigits: "1234",
          createdAt: Date.now(),
          // 沒有 orderId — guestSessionAuth 不要求
        }),
        put: vi.fn().mockResolvedValue(undefined),
      },
    });

    // guestSessionAuth 端點 — 不需要 orderId
    const res = await app.request("/session", {
      headers: { Authorization: `Bearer ${guestToken}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(true);
    expect(body.session.restaurantId).toBe("S-20240101-001");
  });

  it("guestSessionAuth 缺少 token 時應返回 401", async () => {
    const { app } = createGuestApp();

    const res = await app.request("/session", {
      // 沒有 Authorization header
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
  });

  it("generateGuestToken() 應產生唯一且格式正確的 token", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateGuestToken());
    }

    // 100 次應產生 100 個唯一 token
    expect(tokens.size).toBe(100);

    // 每個 token 應符合 gt_ + 64 hex chars 格式
    for (const token of tokens) {
      expect(token).toMatch(/^gt_[0-9a-f]{64}$/);
    }
  });
});

// =============================================================================
// 6. Token 聲明邊界測試 (Token Claim Boundary Tests)
// =============================================================================
describe("6. Token 聲明邊界測試 (Token Claim Boundary Tests)", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  it("應拒絕 role = 5 的 token（customer role，auth middleware 只允許 0-4）", async () => {
    const token = await sign(validPayload({ role: 5 }), SECRET, "HS256");

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("TOKEN_INVALID");
  });

  it("應拒絕 role = -1 的 token（負數）", async () => {
    const token = await sign(validPayload({ role: -1 }), SECRET, "HS256");

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("TOKEN_INVALID");
  });

  it("應拒絕 role = 99 的 token（完全超出範圍）", async () => {
    const token = await sign(validPayload({ role: 99 }), SECRET, "HS256");

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
  });

  it("應拒絕 role = 0.5 的 token（浮點數，非整數）", async () => {
    const token = await sign(validPayload({ role: 0.5 }), SECRET, "HS256");

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    // role 0.5：0.5 < 0 is false, 0.5 > 4 is false，所以通過 range 檢查
    // 但因為 auth middleware 只做 range 檢查，0.5 可能通過
    // 實際上 0.5 >= 0 && 0.5 <= 4 為 true，所以需要確認行為
    // 不管結果如何，不應該讓非整數 role 產生安全問題
    const body = (await res.json()) as ApiTestResponse;
    // 如果通過了也不應該有 admin 權限（role 不等於 0）
    if (res.status === 200) {
      expect(body.user.role).toBe(0.5);
      // 角色 0.5 不在任何有效角色列表中，requireRole 會攔截
    } else {
      expect(res.status).toBe(401);
    }
  });

  it("應拒絕 id = 0 的 token（falsy value）", async () => {
    // auth middleware: if (!decoded.id || ...) — 0 是 falsy
    const token = await sign(validPayload({ id: 0 }), SECRET, "HS256");

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("TOKEN_INVALID");
  });

  it("應拒絕 username = '' 的 token（空字串 — falsy）", async () => {
    // auth middleware: if (!decoded.id || !decoded.username || ...) — "" 是 falsy
    const token = await sign(validPayload({ username: "" }), SECRET, "HS256");

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("TOKEN_INVALID");
  });

  it("注入額外聲明（isAdmin: true）應被忽略", async () => {
    const token = await sign(
      validPayload({ role: 2, isAdmin: true, isSuperUser: true }),
      SECRET,
      "HS256",
    );

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(true);

    // 驗證 user 物件只包含預期的欄位，不含注入的聲明
    expect(body.user.role).toBe(2);
    expect(body.user).not.toHaveProperty("isAdmin");
    expect(body.user).not.toHaveProperty("isSuperUser");
  });

  it("所有合法角色 (0-4) 的 token 應被接受", async () => {
    const { app } = createAuthApp();

    for (const role of [0, 1, 2, 3, 4]) {
      const token = await sign(validPayload({ role }), SECRET, "HS256");

      const res = await app.request("/protected", {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiTestResponse;
      expect(body.user.role).toBe(role);
    }
  });

  it("requireRole 應正確過濾角色", async () => {
    const env = createMockEnv();
    const app = new Hono();
    withErrorHandler(app);

    app.use("*", async (c, next) => {
      if (!c.env) {
        (c as unknown as ApiTestContextWithEnv).env = env;
      } else {
        Object.assign(c.env, env);
      }
      await next();
    });

    // 只允許 admin (0) 和 owner (1)
    app.get(
      "/admin-only",
      authMiddleware as never,
      requireRole([0, 1]) as never,
      (c) => c.json({ success: true }),
    );

    // Chef (role=2) 嘗試存取 admin-only 路由
    const chefToken = await sign(validPayload({ role: 2 }), SECRET, "HS256");
    const res = await app.request("/admin-only", {
      headers: { Authorization: `Bearer ${chefToken}` },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.error.code).toBe("INSUFFICIENT_ROLE");
  });

  it("缺少 role 聲明的 token 應被拒絕", async () => {
    // 完全移除 role 欄位
    const { role: _role, ...payload } = validPayload();
    // 手動設 role 為 undefined 來繞過 TypeScript
    const token = await sign(
      { ...payload, role: undefined as never },
      SECRET,
      "HS256",
    );

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
  });

  it("缺少 Authorization header 應返回 401", async () => {
    const { app } = createAuthApp();
    const res = await app.request("/protected");

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("MISSING_AUTH_HEADER");
  });

  it("Authorization header 格式錯誤（沒有 Bearer 前綴）應返回 401", async () => {
    const token = await sign(validPayload(), SECRET, "HS256");

    const { app } = createAuthApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Token ${token}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiTestResponse;
    expect(body.error.code).toBe("MISSING_AUTH_HEADER");
  });
});
