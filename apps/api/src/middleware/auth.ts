import { Context, Next } from "hono";
import { verify } from "hono/jwt";
import type { Env } from "../types/env";
import { ApiError, unauthorized, forbidden } from "../shared/utils/api-error";

export interface AuthUser {
  id: number;
  username: string;
  role: number;
  restaurantId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

// JWT 認證中間件工廠。`maxRole` 界定最大可接受的角色值：
// staff/admin 路由使用 4，customer-facing 路由使用 5。
function createAuthMiddleware(maxRole: number) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    try {
      const authHeader = c.req.header("Authorization");

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw unauthorized(
          "Missing or invalid authorization header",
          "MISSING_AUTH_HEADER",
        );
      }

      const token = authHeader.substring(7); // 移除 "Bearer " 前綴

      // 檢查 JWT_SECRET 是否設置且符合安全要求
      if (!c.env.JWT_SECRET || c.env.JWT_SECRET.length < 32) {
        console.error(
          "JWT_SECRET is not set or too short (minimum 32 characters required)",
        );
        throw new ApiError(
          "SERVER_CONFIG_ERROR",
          "Server configuration error",
          500,
        );
      }

      // 檢查 token 是否在黑名單中 (如果 KV 可用)
      if (c.env.TOKEN_BLACKLIST) {
        const blacklisted = await c.env.TOKEN_BLACKLIST.get(`token:${token}`);
        if (blacklisted) {
          throw unauthorized("Token has been invalidated", "TOKEN_BLACKLISTED");
        }
      }

      const decoded = (await verify(token, c.env.JWT_SECRET, "HS256")) as any;

      if (!decoded || typeof decoded !== "object") {
        throw unauthorized("Invalid token", "TOKEN_INVALID");
      }

      const now = Math.floor(Date.now() / 1000);

      if (!decoded.exp || decoded.exp <= now) {
        throw unauthorized("Token has expired", "TOKEN_EXPIRED");
      }

      if (decoded.iat && decoded.iat > now + 60) {
        throw unauthorized("Token issued in future", "TOKEN_FUTURE");
      }

      if (decoded.nbf && decoded.nbf > now + 60) {
        throw unauthorized("Token not yet valid", "TOKEN_INVALID");
      }

      if (
        !decoded.id ||
        !decoded.username ||
        typeof decoded.role !== "number"
      ) {
        throw unauthorized("Invalid token claims", "TOKEN_INVALID");
      }

      if (decoded.role < 0 || decoded.role > maxRole) {
        throw unauthorized("Invalid role in token", "TOKEN_INVALID");
      }

      const tokenAge = now - (decoded.iat || 0);
      const maxTokenAge = 24 * 60 * 60;
      if (tokenAge > maxTokenAge) {
        throw unauthorized("Token too old, please refresh", "TOKEN_EXPIRED");
      }

      const timeUntilExpiry = decoded.exp - now;
      if (timeUntilExpiry < 3600) {
        c.header("X-Token-Refresh-Recommended", "true");
        c.header("X-Token-Expires-In", timeUntilExpiry.toString());
      }

      c.set("user", {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role,
        restaurantId: decoded.restaurantId,
      });

      await next();
    } catch (error) {
      if (error instanceof ApiError) throw error;

      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "JwtTokenExpired"
      ) {
        throw unauthorized("Token has expired", "TOKEN_EXPIRED");
      }
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "JwtTokenInvalid"
      ) {
        throw unauthorized("Invalid token format", "TOKEN_INVALID");
      }
      throw unauthorized("Authentication failed", "TOKEN_INVALID");
    }
  };
}

// Staff/admin 路由的 JWT 認證中間件（只接受 role 0-4）
export const authMiddleware = createAuthMiddleware(4);

// Customer-facing 路由的 JWT 認證中間件（接受 role 0-5，涵蓋顧客 role=5）
export const customerAuthMiddleware = createAuthMiddleware(5);

// SSE 認證中間件 — 接受 Authorization header 或 ?token= query param。
// 瀏覽器原生 EventSource 無法帶自訂 header，因此 SSE 客戶端必須走 query param。
export const sseAuthMiddleware = async (
  c: Context<{ Bindings: Env }>,
  next: Next,
) => {
  try {
    const authHeader = c.req.header("Authorization");
    let token: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else {
      token = c.req.query("token");
    }

    if (!token) {
      throw unauthorized("Missing authentication token", "MISSING_AUTH_TOKEN");
    }

    if (!c.env.JWT_SECRET || c.env.JWT_SECRET.length < 32) {
      console.error(
        "JWT_SECRET is not set or too short (minimum 32 characters required)",
      );
      throw new ApiError(
        "SERVER_CONFIG_ERROR",
        "Server configuration error",
        500,
      );
    }

    if (c.env.TOKEN_BLACKLIST) {
      const blacklisted = await c.env.TOKEN_BLACKLIST.get(`token:${token}`);
      if (blacklisted) {
        throw unauthorized("Token has been invalidated", "TOKEN_BLACKLISTED");
      }
    }

    const decoded = (await verify(token, c.env.JWT_SECRET, "HS256")) as any;

    if (!decoded || typeof decoded !== "object") {
      throw unauthorized("Invalid token", "TOKEN_INVALID");
    }

    const now = Math.floor(Date.now() / 1000);
    if (!decoded.exp || decoded.exp <= now) {
      throw unauthorized("Token has expired", "TOKEN_EXPIRED");
    }
    if (!decoded.id || !decoded.username || typeof decoded.role !== "number") {
      throw unauthorized("Invalid token claims", "TOKEN_INVALID");
    }

    c.set("user", {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      restaurantId: decoded.restaurantId,
    });

    await next();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      (error as { name: string }).name === "JwtTokenExpired"
    ) {
      throw unauthorized("Token has expired", "TOKEN_EXPIRED");
    }
    throw unauthorized("Authentication failed", "TOKEN_INVALID");
  }
};

// 角色權限檢查中間件
export const requireRole = (allowedRoles: number[]) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get("user");

    if (!user) {
      throw unauthorized("Authentication required", "UNAUTHORIZED");
    }

    if (!allowedRoles.includes(user.role)) {
      throw forbidden("Insufficient permissions", "INSUFFICIENT_ROLE");
    }

    await next();
  };
};

// 餐廳存取權限檢查
export const requireRestaurantAccess = (
  restaurantIdParam: string = "restaurantId",
) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get("user");
    const restaurantId = c.req.param(restaurantIdParam);

    if (!user) {
      throw unauthorized("Authentication required", "UNAUTHORIZED");
    }

    // 管理員可以存取所有餐廳
    if (user.role === 0) {
      await next();
      return;
    }

    // 檢查是否有餐廳存取權限
    if (!user.restaurantId || user.restaurantId !== restaurantId) {
      throw forbidden("Access denied to this restaurant", "FORBIDDEN");
    }

    await next();
  };
};

// Token 黑名單管理
export const blacklistToken = async (
  c: Context<{ Bindings: Env }>,
  token: string,
  expiryTime?: number,
) => {
  if (c.env.TOKEN_BLACKLIST) {
    // 計算 TTL - 使用 token 的剩餘過期時間
    let ttl: number | undefined;
    if (expiryTime) {
      const now = Math.floor(Date.now() / 1000);
      ttl = Math.max(0, expiryTime - now);
    }

    await c.env.TOKEN_BLACKLIST.put(
      `token:${token}`,
      "blacklisted",
      ttl ? { expirationTtl: ttl } : undefined,
    );
  }
};

// 可選認證中間件（用於公開 API）
export const optionalAuth = async (
  c: Context<{ Bindings: Env }>,
  next: Next,
) => {
  try {
    const authHeader = c.req.header("Authorization");

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      // 檢查黑名單
      if (c.env.TOKEN_BLACKLIST) {
        const blacklisted = await c.env.TOKEN_BLACKLIST.get(`token:${token}`);
        if (blacklisted) {
          // Token 已被加入黑名單，但這是可選認證，所以繼續執行
          await next();
          return;
        }
      }

      const decoded = (await verify(token, c.env.JWT_SECRET, "HS256")) as any;

      if (decoded && typeof decoded === "object") {
        c.set("user", {
          id: decoded.id,
          username: decoded.username,
          role: decoded.role,
          restaurantId: decoded.restaurantId,
        });
      }
    }

    await next();
  } catch {
    // 忽略認證錯誤，繼續執行
    await next();
  }
};

// 別名為了向後兼容
export const requireAuth = authMiddleware;
