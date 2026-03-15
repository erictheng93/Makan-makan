/**
 * Group Orders Routes
 * HTTP routes for group ordering functionality
 */

import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../middleware/validation";
import { GroupOrdersService } from "../services/GroupOrdersService";
import { groupOrderSchemas } from "../schemas/validation";
import type { Env } from "../../../types/env";
import {
  notFound,
  forbidden,
  badRequest,
} from "../../../shared/utils/api-error";

const app = new Hono<{ Bindings: Env }>();

/**
 * Create group order
 * POST /api/v1/orders/group/create
 */
app.post(
  "/create",
  authMiddleware,
  requireRole([0, 1, 2, 3, 4]), // All authenticated users can create group orders
  validateBody(groupOrderSchemas.createGroupOrder),
  async (c) => {
    const data = c.get("validatedBody");
    const user = c.get("user");

    const groupOrderService = new GroupOrdersService(
      c.env.DB as any,
      c.env.CACHE_KV,
    );
    const result = await groupOrderService.createGroupOrder(data, user.id);

    if (!result.success) {
      throw badRequest(result.error ?? "Failed to create group order");
    }

    // Trigger real-time event
    try {
      await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/group-created`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${c.env.INTERNAL_API_TOKEN}`,
        },
        body: JSON.stringify({
          groupOrderId: result.data?.groupOrderId,
          restaurantId: data.restaurantId,
          tableId: data.tableId,
          shareCode: result.data?.shareCode,
        }),
      });
    } catch (broadcastError) {
      console.warn("Failed to broadcast group creation:", broadcastError);
    }

    return c.json({
      success: true,
      data: result.data,
    });
  },
);

/**
 * Join group order
 * POST /api/v1/orders/group/join/{shareCode}
 */
app.post(
  "/join/:shareCode",
  validateParams(groupOrderSchemas.shareCodeParam),
  validateBody(groupOrderSchemas.joinGroup),
  async (c) => {
    const { shareCode } = c.get("validatedParams");
    const memberData = c.get("validatedBody");

    const groupOrderService = new GroupOrdersService(
      c.env.DB as any,
      c.env.CACHE_KV,
    );
    const result = await groupOrderService.joinGroup(shareCode, memberData);

    if (!result.success) {
      throw badRequest(result.error ?? "Failed to join group");
    }

    // Trigger real-time event
    try {
      await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/member-joined`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${c.env.INTERNAL_API_TOKEN}`,
        },
        body: JSON.stringify({
          groupOrderId: result.data?.groupOrder.groupOrderId,
          member: result.data?.member,
        }),
      });
    } catch (broadcastError) {
      console.warn("Failed to broadcast member join:", broadcastError);
    }

    return c.json({
      success: true,
      data: result.data,
    });
  },
);

/**
 * Get group order statistics
 * GET /api/v1/orders/group/statistics
 * NOTE: This route MUST be defined BEFORE /:groupOrderId to avoid matching 'statistics' as a groupOrderId
 */
app.get(
  "/statistics",
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateQuery(groupOrderSchemas.statisticsQuery),
  async (c) => {
    const { restaurantId, timeRange } = c.get("validatedQuery");
    const user = c.get("user");

    // Permission check for owners
    if (user.role === 1 && restaurantId && user.restaurantId !== restaurantId) {
      throw forbidden("Access denied: can only view own restaurant statistics");
    }

    const groupOrderService = new GroupOrdersService(
      c.env.DB as any,
      c.env.CACHE_KV,
    );
    const statistics = await groupOrderService.getStatistics(
      restaurantId,
      timeRange,
    );

    return c.json({
      success: true,
      data: statistics,
    });
  },
);

/**
 * Get group order details
 * GET /api/v1/orders/group/{groupOrderId}
 */
app.get(
  "/:groupOrderId",
  validateParams(groupOrderSchemas.groupOrderIdParam),
  async (c) => {
    const { groupOrderId } = c.get("validatedParams");

    const groupOrderService = new GroupOrdersService(
      c.env.DB as any,
      c.env.CACHE_KV,
    );
    const groupOrder = await groupOrderService.getGroupOrder(groupOrderId);

    if (!groupOrder) {
      throw notFound("Group order not found");
    }

    return c.json({
      success: true,
      data: groupOrder,
    });
  },
);

/**
 * Add cart item
 * POST /api/v1/orders/group/{groupOrderId}/cart
 */
app.post(
  "/:groupOrderId/cart",
  validateParams(groupOrderSchemas.groupOrderIdParam),
  validateBody(groupOrderSchemas.addCartItem),
  async (c) => {
    const { groupOrderId } = c.get("validatedParams");
    const itemData = c.get("validatedBody");

    const groupOrderService = new GroupOrdersService(
      c.env.DB as any,
      c.env.CACHE_KV,
    );
    const result = await groupOrderService.addCartItem(groupOrderId, itemData);

    if (!result.success) {
      throw badRequest(result.error ?? "Failed to add cart item");
    }

    // Trigger real-time event
    try {
      await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/cart-updated`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${c.env.INTERNAL_API_TOKEN}`,
        },
        body: JSON.stringify({
          groupOrderId,
          action: "added",
          item: result.data,
        }),
      });
    } catch (broadcastError) {
      console.warn("Failed to broadcast cart update:", broadcastError);
    }

    return c.json({
      success: true,
      data: result.data,
    });
  },
);

/**
 * Update cart item
 * PUT /api/v1/orders/group/{groupOrderId}/cart/{itemId}
 */
app.put(
  "/:groupOrderId/cart/:itemId",
  validateParams(
    groupOrderSchemas.groupOrderIdParam.merge(groupOrderSchemas.itemIdParam),
  ),
  validateBody(groupOrderSchemas.updateCartItem),
  async (c) => {
    const { groupOrderId, itemId } = c.get("validatedParams");
    const updateData = c.get("validatedBody");

    const groupOrderService = new GroupOrdersService(
      c.env.DB as any,
      c.env.CACHE_KV,
    );
    const result = await groupOrderService.updateCartItem(
      groupOrderId,
      itemId,
      updateData,
    );

    if (!result.success) {
      throw badRequest(result.error ?? "Failed to update cart item");
    }

    // Trigger real-time event
    try {
      await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/cart-updated`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${c.env.INTERNAL_API_TOKEN}`,
        },
        body: JSON.stringify({
          groupOrderId,
          action: "updated",
          item: result.data,
        }),
      });
    } catch (broadcastError) {
      console.warn("Failed to broadcast cart update:", broadcastError);
    }

    return c.json({
      success: true,
      data: result.data,
    });
  },
);

/**
 * Remove cart item
 * DELETE /api/v1/orders/group/{groupOrderId}/cart/{itemId}
 */
app.delete(
  "/:groupOrderId/cart/:itemId",
  validateParams(
    groupOrderSchemas.groupOrderIdParam.merge(groupOrderSchemas.itemIdParam),
  ),
  validateBody(groupOrderSchemas.memberIdParam),
  async (c) => {
    const { groupOrderId, itemId } = c.get("validatedParams");
    const { memberId } = c.get("validatedBody");

    const groupOrderService = new GroupOrdersService(
      c.env.DB as any,
      c.env.CACHE_KV,
    );
    const result = await groupOrderService.removeCartItem(
      groupOrderId,
      itemId,
      memberId,
    );

    if (!result.success) {
      throw badRequest(result.error ?? "Failed to remove cart item");
    }

    // Trigger real-time event
    try {
      await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/cart-updated`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${c.env.INTERNAL_API_TOKEN}`,
        },
        body: JSON.stringify({
          groupOrderId,
          action: "removed",
          itemId,
        }),
      });
    } catch (broadcastError) {
      console.warn("Failed to broadcast cart update:", broadcastError);
    }

    return c.json({
      success: true,
      message: "Cart item removed successfully",
    });
  },
);

/**
 * Split bill
 * POST /api/v1/orders/group/{groupOrderId}/split
 */
app.post(
  "/:groupOrderId/split",
  validateParams(groupOrderSchemas.groupOrderIdParam),
  validateBody(groupOrderSchemas.splitBill),
  async (c) => {
    const { groupOrderId } = c.get("validatedParams");
    const splitData = c.get("validatedBody");

    const groupOrderService = new GroupOrdersService(
      c.env.DB as any,
      c.env.CACHE_KV,
    );
    const result = await groupOrderService.splitBill(groupOrderId, splitData);

    if (!result.success) {
      throw badRequest(result.error ?? "Failed to split bill");
    }

    return c.json({
      success: true,
      data: result.data,
    });
  },
);

/**
 * Process payment
 * POST /api/v1/orders/group/{groupOrderId}/payment/{memberId}
 */
app.post(
  "/:groupOrderId/payment/:memberId",
  validateParams(
    groupOrderSchemas.groupOrderIdParam.merge(groupOrderSchemas.memberIdParam),
  ),
  validateBody(groupOrderSchemas.processPayment),
  async (c) => {
    const { groupOrderId, memberId } = c.get("validatedParams");
    const paymentData = c.get("validatedBody");

    const groupOrderService = new GroupOrdersService(
      c.env.DB as any,
      c.env.CACHE_KV,
    );
    const result = await groupOrderService.processPayment(
      groupOrderId,
      memberId,
      paymentData,
    );

    if (!result.success) {
      throw badRequest(result.error ?? "Failed to process payment");
    }

    return c.json({
      success: true,
      data: result.data,
    });
  },
);

/**
 * Leave group
 * POST /api/v1/orders/group/{groupOrderId}/leave/{memberId}
 */
app.post(
  "/:groupOrderId/leave/:memberId",
  validateParams(
    groupOrderSchemas.groupOrderIdParam.merge(groupOrderSchemas.memberIdParam),
  ),
  async (c) => {
    const { groupOrderId, memberId } = c.get("validatedParams");

    const groupOrderService = new GroupOrdersService(
      c.env.DB as any,
      c.env.CACHE_KV,
    );
    const result = await groupOrderService.leaveGroup(groupOrderId, memberId);

    if (!result.success) {
      throw badRequest(result.error ?? "Failed to leave group");
    }

    return c.json({
      success: true,
      message: "Left group successfully",
    });
  },
);

/**
 * Get group activities
 * GET /api/v1/orders/group/{groupOrderId}/activities
 */
app.get(
  "/:groupOrderId/activities",
  validateParams(groupOrderSchemas.groupOrderIdParam),
  validateQuery(groupOrderSchemas.activitiesQuery),
  async (c) => {
    const { groupOrderId } = c.get("validatedParams");

    const groupOrderService = new GroupOrdersService(
      c.env.DB as any,
      c.env.CACHE_KV,
    );
    const activities = await groupOrderService.getActivities(groupOrderId);

    return c.json({
      success: true,
      data: activities,
    });
  },
);

/**
 * Cleanup expired groups
 * POST /api/v1/orders/group/cleanup/expired
 */
app.post(
  "/cleanup/expired",
  authMiddleware,
  requireRole([0]), // Admin only
  async (c) => {
    const groupOrderService = new GroupOrdersService(
      c.env.DB as any,
      c.env.CACHE_KV,
    );
    const result = await groupOrderService.cleanupExpiredGroups();

    return c.json({
      success: true,
      data: {
        cleaned: result.cleaned,
        errors: result.errors,
      },
    });
  },
);

export default app;
