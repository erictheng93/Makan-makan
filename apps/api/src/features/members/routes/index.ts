import { TenantMemberDirectoryService } from "@makanmasak/database";
import { Hono } from "hono";
import {
  authMiddleware,
  requireRestaurantAccess,
  requireRole,
} from "../../../middleware/auth";
import { validateParams, validateQuery } from "../../../middleware/validation";
import { notFound } from "../../../shared/utils/api-error";
import type { Env } from "../../../types/env";
import {
  memberListQuerySchema,
  memberOrdersQuerySchema,
  memberParamSchema,
  restaurantIdParamSchema,
} from "../schemas/validation";

const routes = new Hono<{ Bindings: Env }>();

function directory(env: Env) {
  return new TenantMemberDirectoryService(env.DB, env);
}

// The first user-controlled id is path-bound by requireRestaurantAccess. The
// member id is then resolved under that same scope in every handler below.
routes.get(
  "/:restaurantId/members",
  authMiddleware,
  requireRole([0, 1]),
  requireRestaurantAccess("restaurantId"),
  validateParams(restaurantIdParamSchema),
  validateQuery(memberListQuerySchema),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const filters = c.get("validatedQuery");
    const result = await directory(c.env).list({ restaurantId }, filters);
    return c.json({
      success: true,
      data: result.members,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    });
  },
);

routes.get(
  "/:restaurantId/members/stats",
  authMiddleware,
  requireRole([0, 1]),
  requireRestaurantAccess("restaurantId"),
  validateParams(restaurantIdParamSchema),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    return c.json({
      success: true,
      data: await directory(c.env).stats({ restaurantId }),
    });
  },
);

routes.get(
  "/:restaurantId/members/:memberId",
  authMiddleware,
  requireRole([0, 1]),
  requireRestaurantAccess("restaurantId"),
  validateParams(memberParamSchema),
  async (c) => {
    const { restaurantId, memberId } = c.get("validatedParams");
    const member = await directory(c.env).get({ restaurantId }, memberId);
    if (!member) throw notFound("Member not found", "MEMBER_NOT_FOUND");
    return c.json({ success: true, data: member });
  },
);

routes.get(
  "/:restaurantId/members/:memberId/orders",
  authMiddleware,
  requireRole([0, 1]),
  requireRestaurantAccess("restaurantId"),
  validateParams(memberParamSchema),
  validateQuery(memberOrdersQuerySchema),
  async (c) => {
    const { restaurantId, memberId } = c.get("validatedParams");
    const { page, limit } = c.get("validatedQuery");
    const result = await directory(c.env).listOrders(
      { restaurantId },
      memberId,
      page,
      limit,
    );
    if (!result) throw notFound("Member not found", "MEMBER_NOT_FOUND");
    return c.json({
      success: true,
      data: result.orders,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    });
  },
);

export default routes;
