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

const app = new Hono<{ Bindings: Env }>();

/**
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

    return c.json({ success: true, ...result });
  },
);

/**
 * GET /api/v1/users/:id
 */
app.get(
  "/:id",
  authMiddleware,
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    const { id } = c.get("validatedParams");
    const currentUser = c.get("user");
    const usersService = new UsersService(c.env);

    const user = await usersService.getUserById(currentUser, parseInt(id));

    return c.json({ success: true, data: user });
  },
);

/**
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

    const user = await usersService.createUser(currentUser, data);

    return c.json({ success: true, data: user }, 201);
  },
);

/**
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

    const user = await usersService.updateUser(currentUser, parseInt(id), data);

    return c.json({ success: true, data: user });
  },
);

/**
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

    await usersService.changePassword(
      currentUser,
      parseInt(id),
      currentPassword,
      newPassword,
    );

    return c.json({ success: true, message: "Password updated successfully" });
  },
);

/**
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

    const message = await usersService.updateUserStatus(
      currentUser,
      parseInt(id),
      isActive,
    );

    return c.json({ success: true, message });
  },
);

/**
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

    await usersService.verifyUser(currentUser, parseInt(id));

    return c.json({ success: true, message: "User verified successfully" });
  },
);

/**
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

    await usersService.resetPassword(currentUser, parseInt(id), newPassword);

    return c.json({ success: true, message: "Password reset successfully" });
  },
);

/**
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

    return c.json({ success: true, data: stats });
  },
);

/**
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

    return c.json({ success: true, data: results });
  },
);

export default app;
