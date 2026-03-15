import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
  commonSchemas,
} from "../../../middleware/validation";
import { USER_ROLES } from "@makanmakan/database";
import type { Env } from "../../../types/env";
import { UsersService } from "../services/UsersService";
import {
  createUserSchema,
  updateUserSchema,
  updatePasswordSchema,
  userFilterSchema,
  userStatusSchema,
  resetPasswordSchema,
  userStatsSchema,
  userSearchSchema,
} from "../schemas/validation";
import { ApiError } from "../../../shared/utils/api-error";

const app = new Hono<{ Bindings: Env }>();

/**
 * Convert a service result object into a thrown ApiError when unsuccessful.
 * status defaults to 500 if not provided by the service.
 */
function assertResult(result: {
  success: boolean;
  error?: string;
  status?: number;
}): void {
  if (!result.success) {
    throw new ApiError(
      "SERVICE_ERROR",
      result.error || "Operation failed",
      result.status || 500,
    );
  }
}

/**
 * 獲取用戶列表
 * GET /api/v1/users
 */
app.get(
  "/",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateQuery(userFilterSchema as any),
  async (c) => {
    const query = c.get("validatedQuery");
    const currentUser = c.get("user");
    const usersService = new UsersService(c.env);

    const result = await usersService.getUsers(currentUser, query);

    return c.json(result);
  },
);

/**
 * 獲取單一用戶詳情
 * GET /api/v1/users/:id
 */
app.get(
  "/:id",
  authMiddleware,
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.CHEF,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
    USER_ROLES.CUSTOMER,
  ]),
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    const { id } = c.get("validatedParams");
    const currentUser = c.get("user");
    const usersService = new UsersService(c.env);

    const result = await usersService.getUserById(currentUser, parseInt(id));

    assertResult(result);

    return c.json({
      success: true,
      data: result.data,
    });
  },
);

/**
 * 創建用戶
 * POST /api/v1/users
 */
app.post(
  "/",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(createUserSchema as any),
  async (c) => {
    const data = c.get("validatedBody");
    const currentUser = c.get("user");
    const usersService = new UsersService(c.env);

    const result = await usersService.createUser(currentUser, data);

    assertResult(result);

    return c.json(
      {
        success: true,
        data: result.data,
      },
      (result.status as any) || 200,
    );
  },
);

/**
 * 更新用戶資料
 * PUT /api/v1/users/:id
 */
app.put(
  "/:id",
  authMiddleware,
  validateParams(commonSchemas.idParam as any),
  validateBody(updateUserSchema as any),
  async (c) => {
    const { id } = c.get("validatedParams");
    const data = c.get("validatedBody");
    const currentUser = c.get("user");
    const usersService = new UsersService(c.env);

    const result = await usersService.updateUser(
      currentUser,
      parseInt(id),
      data,
    );

    assertResult(result);

    return c.json({
      success: true,
      data: result.data,
    });
  },
);

/**
 * 修改密碼
 * POST /api/v1/users/:id/password
 */
app.post(
  "/:id/password",
  authMiddleware,
  validateParams(commonSchemas.idParam as any),
  validateBody(updatePasswordSchema as any),
  async (c) => {
    const { id } = c.get("validatedParams");
    const { currentPassword, newPassword } = c.get("validatedBody");
    const currentUser = c.get("user");
    const usersService = new UsersService(c.env);

    const result = await usersService.changePassword(
      currentUser,
      parseInt(id),
      currentPassword,
      newPassword,
    );

    assertResult(result);

    return c.json({
      success: true,
      message: result.message,
    });
  },
);

/**
 * 停用/啟用用戶
 * PATCH /api/v1/users/:id/status
 */
app.patch(
  "/:id/status",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam as any),
  validateBody(userStatusSchema as any),
  async (c) => {
    const { id } = c.get("validatedParams");
    const { isActive } = c.get("validatedBody");
    const currentUser = c.get("user");
    const usersService = new UsersService(c.env);

    const result = await usersService.updateUserStatus(
      currentUser,
      parseInt(id),
      isActive,
    );

    assertResult(result);

    return c.json({
      success: true,
      message: result.message,
    });
  },
);

/**
 * 驗證用戶
 * PATCH /api/v1/users/:id/verify
 */
app.patch(
  "/:id/verify",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    const { id } = c.get("validatedParams");
    const currentUser = c.get("user");
    const usersService = new UsersService(c.env);

    const result = await usersService.verifyUser(currentUser, parseInt(id));

    assertResult(result);

    return c.json({
      success: true,
      message: result.message,
    });
  },
);

/**
 * 重設用戶密碼
 * POST /api/v1/users/:id/reset-password
 */
app.post(
  "/:id/reset-password",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam as any),
  validateBody(resetPasswordSchema as any),
  async (c) => {
    const { id } = c.get("validatedParams");
    const { newPassword } = c.get("validatedBody");
    const currentUser = c.get("user");
    const usersService = new UsersService(c.env);

    const result = await usersService.resetPassword(
      currentUser,
      parseInt(id),
      newPassword,
    );

    assertResult(result);

    return c.json({
      success: true,
      message: result.message,
    });
  },
);

/**
 * 獲取用戶統計
 * GET /api/v1/users/stats
 */
app.get(
  "/stats",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateQuery(userStatsSchema as any),
  async (c) => {
    const { restaurantId } = c.get("validatedQuery");
    const currentUser = c.get("user");
    const usersService = new UsersService(c.env);

    const stats = await usersService.getUserStats(currentUser, restaurantId);

    return c.json({
      success: true,
      data: stats,
    });
  },
);

/**
 * 搜尋用戶
 * GET /api/v1/users/search
 */
app.get(
  "/search",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateQuery(userSearchSchema as any),
  async (c) => {
    const { query, restaurantId, limit } = c.get("validatedQuery");
    const currentUser = c.get("user");
    const usersService = new UsersService(c.env);

    const results = await usersService.searchUsers(
      currentUser,
      query,
      restaurantId,
      limit,
    );

    return c.json({
      success: true,
      data: results,
    });
  },
);

export default app;
