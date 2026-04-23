/**
 * Realtime Routes
 * HTTP routes for realtime authentication
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../../shared/types";
import { HTTP_STATUS } from "../../../shared/constants";

import { ConsoleLogger } from "../../../core/monitoring";
import { validateBody } from "../../../middleware/validation";
import { rateLimitMiddleware } from "../../../middleware/rateLimiter";
import {
  ApiError,
  badRequest,
  unauthorized,
} from "../../../shared/utils/api-error";

// Import service and validation schemas
import { RealtimeAuthService } from "../services/RealtimeAuthService";
import { realtimeSchemas } from "../schemas/validation";

// Create feature logger
const logger = new ConsoleLogger("realtime-routes");

// Create router
const realtimeRoutes = new Hono<{ Bindings: Env }>();

/**
 * 請求 WebSocket 授權 Token
 * POST /auth/token
 *
 * 此端點用於取得 WebSocket 連線所需的授權 token
 */
realtimeRoutes.post(
  "/auth/token",
  validateBody(realtimeSchemas.webSocketTokenRequest),
  async (c) => {
    const requestData = c.get("validatedBody");

    // 初始化認證服務
    const authService = new RealtimeAuthService(c.env);

    // 生成 WebSocket token
    const result = await authService.generateWebSocketToken(requestData);

    // 檢查是否有錯誤
    if ("error" in result) {
      logger.warn("Failed to generate WebSocket token", {
        error: result.error,
        request: requestData,
      });

      throw badRequest(result.error);
    }

    logger.info("WebSocket token generated successfully", {
      roomType: requestData.roomType,
      roomId: requestData.roomId,
      restaurantId: requestData.restaurantId,
    });

    return c.json(
      {
        success: true,
        data: result,
      },
      HTTP_STATUS.OK,
    );
  },
);

realtimeRoutes.post(
  "/auth/guest-token",
  rateLimitMiddleware({
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: "realtime_guest_token",
    message: "Too many guest realtime token requests",
  }),
  validateBody(realtimeSchemas.guestRealtimeTokenRequest),
  async (c) => {
    const requestData = c.get("validatedBody");
    const authService = new RealtimeAuthService(c.env);
    const result = await authService.generateGuestToken(requestData);

    if ("error" in result) {
      logger.warn("Failed to generate guest realtime token", {
        error: result.error,
        restaurantId: requestData.restaurantId,
        tableId: requestData.tableId,
      });
      throw badRequest(result.error);
    }

    return c.json(
      {
        success: true,
        data: result,
      },
      HTTP_STATUS.OK,
    );
  },
);

/**
 * 驗證 WebSocket Token (用於測試)
 * POST /auth/verify
 */
realtimeRoutes.post(
  "/auth/verify",
  validateBody(
    z.object({
      token: z.string().min(1, "Token is required"),
      channel: z.string().min(1, "Channel is required").optional(),
    }),
  ),
  async (c) => {
    const { token, channel } = c.get("validatedBody");

    const authService = new RealtimeAuthService(c.env);
    const verification = await authService.verifyWebSocketToken(token);

    if (!verification.valid) {
      throw unauthorized(verification.error || "Invalid token");
    }

    if (channel && verification.payload) {
      const channelAccess = authService.verifyChannelAccess(
        verification.payload,
        channel,
      );

      if (!channelAccess.allowed) {
        throw unauthorized(channelAccess.error || "Channel access denied");
      }
    }

    return c.json(
      {
        success: true,
        data: {
          valid: true,
          payload: verification.payload,
        },
      },
      HTTP_STATUS.OK,
    );
  },
);

/**
 * 撤銷 WebSocket Token
 * POST /auth/revoke
 *
 * 用於主動撤銷 token（例如：用戶登出、權限變更）
 */
realtimeRoutes.post(
  "/auth/revoke",
  validateBody(
    z.object({
      token: z.string().min(1, "Token is required"),
      reason: z
        .enum([
          "logout",
          "password_change",
          "permission_change",
          "security_breach",
          "admin_action",
          "session_expired",
          "manual",
        ])
        .default("manual"),
      revokedBy: z.string().optional(),
    }),
  ),
  async (c) => {
    const { token, reason, revokedBy } = c.get("validatedBody");

    const authService = new RealtimeAuthService(c.env);
    const result = await authService.revokeToken(token, reason, revokedBy);

    if (!result.success) {
      throw new ApiError(
        "INTERNAL_ERROR",
        result.error || "Failed to revoke token",
        500,
      );
    }

    logger.info("Token revoked via API", { reason, revokedBy });

    return c.json(
      {
        success: true,
        data: {
          revoked: true,
          reason,
        },
      },
      HTTP_STATUS.OK,
    );
  },
);

/**
 * 撤銷用戶的所有 WebSocket Token
 * POST /auth/revoke-user
 *
 * 用於批量撤銷特定用戶的所有 token（例如：用戶被停權）
 */
realtimeRoutes.post(
  "/auth/revoke-user",
  validateBody(
    z.object({
      userId: z.string().min(1, "User ID is required"),
      reason: z
        .enum([
          "logout",
          "password_change",
          "permission_change",
          "security_breach",
          "admin_action",
          "session_expired",
          "manual",
        ])
        .default("admin_action"),
      revokedBy: z.string().optional(),
    }),
  ),
  async (c) => {
    const { userId, reason, revokedBy } = c.get("validatedBody");

    const authService = new RealtimeAuthService(c.env);
    const result = await authService.revokeUserTokens(
      userId,
      reason,
      revokedBy,
    );

    if (!result.success) {
      throw new ApiError(
        "INTERNAL_ERROR",
        result.error || "Failed to revoke user tokens",
        500,
      );
    }

    logger.info("User tokens revoked via API", {
      userId,
      count: result.count,
      reason,
    });

    return c.json(
      {
        success: true,
        data: {
          userId,
          revokedCount: result.count,
          reason,
        },
      },
      HTTP_STATUS.OK,
    );
  },
);

/**
 * 獲取 Token 黑名單統計
 * GET /auth/blacklist/stats
 */
realtimeRoutes.get("/auth/blacklist/stats", async (c) => {
  const authService = new RealtimeAuthService(c.env);
  const stats = await authService.getBlacklistStats();

  return c.json(
    {
      success: true,
      data: stats,
    },
    HTTP_STATUS.OK,
  );
});

/**
 * 獲取特定房間的 WebSocket 連接統計
 * GET /stats/:roomType/:roomId
 */
realtimeRoutes.get("/stats/:roomType/:roomId", async (c) => {
  const roomType = c.req.param("roomType");
  const roomId = c.req.param("roomId");

  // 驗證 roomType
  const validRoomTypes = ["customer", "kitchen", "admin", "restaurant"];
  if (!validRoomTypes.includes(roomType)) {
    throw badRequest(
      `Invalid room type. Must be one of: ${validRoomTypes.join(", ")}`,
    );
  }

  // 調用 Realtime 服務獲取統計
  const realtimeUrl = c.env.REALTIME_SERVICE_URL || "http://localhost:8788";
  const response = await fetch(`${realtimeUrl}/stats/${roomType}/${roomId}`);

  if (!response.ok) {
    logger.warn("Failed to fetch realtime stats", {
      roomType,
      roomId,
      status: response.status,
    });
    throw new ApiError(
      "REALTIME_SERVICE_ERROR",
      "Failed to fetch realtime statistics",
      response.status as 400 | 404 | 500,
    );
  }

  const stats = await response.json();

  return c.json(
    {
      success: true,
      data: stats,
    },
    HTTP_STATUS.OK,
  );
});

/**
 * 獲取 Realtime 服務監控概覽
 * GET /stats/overview
 *
 * 返回所有活躍房間的聚合統計信息
 */
realtimeRoutes.get("/stats/overview", async (c) => {
  const restaurantId = c.req.query("restaurantId");

  if (!restaurantId) {
    throw badRequest("Restaurant ID is required");
  }

  const realtimeUrl = c.env.REALTIME_SERVICE_URL || "http://localhost:8788";

  // 並行獲取各房間類型的統計
  const roomTypes = ["kitchen", "admin", "customer"];
  const statsPromises = roomTypes.map(async (roomType) => {
    try {
      const response = await fetch(
        `${realtimeUrl}/stats/${roomType}/${restaurantId}`,
      );
      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        return { roomType, ...data, status: "active" };
      }
      return { roomType, connectionCount: 0, status: "inactive" };
    } catch {
      return { roomType, connectionCount: 0, status: "error" };
    }
  });

  const roomStats = await Promise.all(statsPromises);

  // 計算總計
  const totalConnections = roomStats.reduce((sum, room) => {
    const count =
      typeof room.connectionCount === "number" ? room.connectionCount : 0;
    return sum + count;
  }, 0);

  const overview = {
    restaurantId,
    timestamp: new Date().toISOString(),
    totalConnections,
    roomStats,
    health: {
      status: totalConnections > 0 ? "healthy" : "idle",
      lastChecked: new Date().toISOString(),
    },
  };

  logger.info("Realtime overview fetched", {
    restaurantId,
    totalConnections,
  });

  return c.json(
    {
      success: true,
      data: overview,
    },
    HTTP_STATUS.OK,
  );
});

/**
 * 健康檢查端點
 * GET /health
 */
realtimeRoutes.get("/health", async (c) => {
  try {
    const realtimeUrl = c.env.REALTIME_SERVICE_URL || "http://localhost:8788";

    // 檢查 Realtime 服務健康狀態
    const response = await fetch(`${realtimeUrl}/health`);

    if (!response.ok) {
      return c.json(
        {
          success: false,
          data: {
            status: "unhealthy",
            realtimeService: "down",
            timestamp: new Date().toISOString(),
          },
        },
        HTTP_STATUS.OK,
      );
    }

    const healthData = (await response.json()) as Record<string, unknown>;

    return c.json(
      {
        success: true,
        data: {
          status: "healthy",
          realtimeService: "up",
          ...(typeof healthData === "object" && healthData !== null
            ? healthData
            : {}),
          timestamp: new Date().toISOString(),
        },
      },
      HTTP_STATUS.OK,
    );
  } catch {
    return c.json(
      {
        success: true,
        data: {
          status: "degraded",
          realtimeService: "unreachable",
          error: "Cannot connect to realtime service",
          timestamp: new Date().toISOString(),
        },
      },
      HTTP_STATUS.OK,
    );
  }
});

export default realtimeRoutes;
