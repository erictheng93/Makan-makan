/**
 * Group Orders Routes
 * HTTP routes for group ordering functionality
 */

import { Hono } from "hono";
import {
  authMiddleware,
  optionalAuth,
  requireRole,
} from "../../../middleware/auth";
import { moduleGate } from "../../../middleware/moduleGate";
import { quotaGate } from "../../../middleware/quotaGate";
import {
  publicRateLimit,
  strictRateLimit,
} from "../../../middleware/rateLimit";
import { meterEmit } from "../../../shared/utils/meter";
import { toCsvRow } from "../../../shared/utils/csv";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../middleware/validation";
import { GroupOrdersService } from "../services/GroupOrdersService";
import { groupOrderSchemas } from "../schemas/validation";
import type { Env } from "../../../types/env";
import { RealtimeBroadcastService } from "@makanmakan/database";
import {
  isValidRealtimeEvent,
  RealtimeEventType,
} from "@makanmakan/shared-types";
import type { GroupOrderEvent } from "@makanmakan/shared-types";
import {
  notFound,
  forbidden,
  badRequest,
} from "../../../shared/utils/api-error";

const app = new Hono<{ Bindings: Env }>();

type GroupOrderRealtimePayload = Record<string, unknown> & {
  groupOrderId?: string;
  restaurantId?: string;
};

async function broadcastGroupOrderEvent(
  env: Env,
  eventType: GroupOrderEvent["type"],
  payload: GroupOrderRealtimePayload,
): Promise<void> {
  const groupOrderId = requireNonEmptyString(
    payload.groupOrderId,
    "groupOrderId",
  );
  const restaurantId = requireNonEmptyString(
    payload.restaurantId,
    "restaurantId",
  );

  const broadcaster = new RealtimeBroadcastService(env);
  const event: GroupOrderEvent = {
    type: eventType,
    eventId: broadcaster.generateEventId(),
    timestamp: Date.now(),
    restaurantId,
    data: { ...payload, groupOrderId, restaurantId },
  };

  if (!isValidRealtimeEvent(event)) {
    throw new Error(`Invalid realtime event produced for ${eventType}`);
  }

  // Clients join a group order through the `customer:{groupOrderId}` room
  // (see apps/customer-app useGroupOrder). Broadcasting to a `group_order`
  // room nobody connects to dropped every event (bug-inventory #2).
  try {
    await broadcaster.broadcastEvent("customer", groupOrderId, event);
  } catch (broadcastError) {
    console.warn(`Failed to broadcast ${eventType}:`, broadcastError);
  }
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Cannot broadcast group order event without ${field}`);
  }
  return value;
}

async function resolveRestaurantIdFromJsonBody(c: {
  req: { raw: Request };
}): Promise<string | undefined> {
  const body = await c.req.raw
    .clone()
    .json()
    .catch(() => {
      throw badRequest("Invalid JSON body", "INVALID_JSON");
    });
  if (!body || typeof body !== "object") return undefined;
  const restaurantId = (body as Record<string, unknown>).restaurantId;
  return typeof restaurantId === "string" || typeof restaurantId === "number"
    ? String(restaurantId)
    : undefined;
}

async function resolveGroupOrderRestaurantId(
  groupOrderService: GroupOrdersService,
  groupOrderId: string,
): Promise<string> {
  const summary = await groupOrderService.getGroupOrder(groupOrderId);
  const restaurantId =
    summary?.groupOrder?.restaurantId ??
    (
      summary as
        | {
            data?: { groupOrder?: { restaurantId?: unknown } };
          }
        | undefined
    )?.data?.groupOrder?.restaurantId;

  return requireNonEmptyString(restaurantId, "restaurantId");
}

/**
 * List group orders
 * GET /api/v1/orders/group
 */
app.get(
  "/",
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  moduleGate("online_ordering"),
  async (c) => {
    const restaurantId = c.req.query("restaurantId");
    const status = c.req.query("status");
    const user = c.get("user");

    const targetRestaurantId = restaurantId || String(user.restaurantId);

    // Permission check for owners
    if (
      user.role === 1 &&
      restaurantId &&
      String(user.restaurantId) !== String(restaurantId)
    ) {
      throw forbidden("Access denied: can only view own restaurant orders");
    }

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
    const orders = await groupOrderService.listGroupOrders(
      targetRestaurantId,
      status || undefined,
    );

    return c.json({
      success: true,
      data: orders,
    });
  },
);

/**
 * Generate share code (creates a group order and returns the share code)
 * POST /api/v1/orders/group/generate-code
 */
app.post(
  "/generate-code",
  authMiddleware,
  requireRole([0, 1, 2, 3, 4]),
  moduleGate("online_ordering"),
  quotaGate("orders.created"),
  async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const user = c.get("user");
    const restaurantId = body.restaurantId || String(user.restaurantId);

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
    const result = await groupOrderService.createGroupOrder(
      { restaurantId },
      user.id,
    );

    if (!result.success || !result.data) {
      throw badRequest(result.error ?? "Failed to generate share code");
    }
    await meterEmit(c, "orders.created", {
      restaurantId,
      metadata: {
        groupOrderId: result.data.groupOrderId,
        source: "group-generate-code",
      },
    });

    return c.json({
      success: true,
      data: {
        shareCode: result.data.shareCode,
        shareUrl: `/group/${result.data.shareCode}`,
        expiresAt: result.data.expiresAt,
      },
    });
  },
);

/**
 * Export group orders
 * GET /api/v1/orders/group/export
 */
app.get(
  "/export",
  authMiddleware,
  requireRole([0, 1]),
  moduleGate("online_ordering"),
  async (c) => {
    const restaurantId = c.req.query("restaurantId");
    const status = c.req.query("status");
    const user = c.get("user");

    const targetRestaurantId = restaurantId || String(user.restaurantId);

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
    const orders = await groupOrderService.listGroupOrders(
      targetRestaurantId,
      status || undefined,
    );

    // Generate CSV
    const headers = [
      "ID",
      "Share Code",
      "Status",
      "Host",
      "Members",
      "Items",
      "Total Amount",
      "Created At",
    ];
    const csvRows = [toCsvRow(headers)];
    for (const order of orders) {
      csvRows.push(
        toCsvRow([
          order.id,
          order.shareCode,
          order.status,
          order.hostName,
          order.memberCount,
          order.itemCount,
          order.totalAmount,
          order.createdAt,
        ]),
      );
    }

    return new Response(csvRows.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="group-orders-export.csv"',
      },
    });
  },
);

/**
 * Create group order
 * POST /api/v1/orders/group/create
 */
app.post(
  "/create",
  optionalAuth,
  moduleGate("online_ordering", resolveRestaurantIdFromJsonBody),
  quotaGate("orders.created", resolveRestaurantIdFromJsonBody),
  validateBody(groupOrderSchemas.createGroupOrder),
  async (c) => {
    const data = c.get("validatedBody");
    const user = c.get("user");

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
    const result = await groupOrderService.createGroupOrder(
      data,
      user?.id ?? null,
    );

    if (!result.success) {
      throw badRequest(result.error ?? "Failed to create group order");
    }
    await meterEmit(c, "orders.created", {
      restaurantId: data.restaurantId,
      metadata: { groupOrderId: result.data?.groupOrderId, source: "group" },
    });

    await broadcastGroupOrderEvent(
      c.env,
      RealtimeEventType.GROUP_ORDER_CREATED,
      {
        groupOrderId: result.data?.groupOrderId,
        restaurantId: data.restaurantId,
        tableId: data.tableId,
        shareCode: result.data?.shareCode,
      },
    );

    return c.json({
      success: true,
      data: result.data,
    });
  },
);

/**
 * Preview a group order before joining (no side effects)
 * GET /api/v1/orders/group/join/{shareCode}
 */
app.get(
  "/join/:shareCode",
  publicRateLimit,
  validateParams(groupOrderSchemas.shareCodeParam),
  async (c) => {
    const { shareCode } = c.get("validatedParams");

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
    const result = await groupOrderService.previewGroupByShareCode(shareCode);

    if (!result.found) {
      throw notFound(
        "Group order not found or expired",
        "GROUP_ORDER_NOT_FOUND",
      );
    }

    return c.json({ success: true, data: result.data });
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

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
    const result = await groupOrderService.joinGroup(shareCode, memberData);

    if (!result.success) {
      throw badRequest(result.error ?? "Failed to join group");
    }

    await broadcastGroupOrderEvent(
      c.env,
      RealtimeEventType.GROUP_MEMBER_JOINED,
      {
        groupOrderId: result.data?.groupOrder.groupOrderId,
        restaurantId: result.data?.groupOrder.restaurantId,
        member: result.data?.member,
      },
    );

    return c.json({
      success: true,
      data: result.data,
    });
  },
);

/**
 * Recover host control of a group order using the recovery code
 * POST /api/v1/orders/group/{groupOrderId}/recover
 */
app.post(
  "/:groupOrderId/recover",
  strictRateLimit,
  validateParams(groupOrderSchemas.groupOrderIdParam),
  validateBody(groupOrderSchemas.recoverHost),
  async (c) => {
    const { groupOrderId } = c.get("validatedParams");
    const { recoveryCode } = c.get("validatedBody");

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
    const result = await groupOrderService.recoverHost(
      groupOrderId,
      recoveryCode,
    );

    if (!result.success) {
      throw badRequest(result.error ?? "Failed to recover host session");
    }

    return c.json({ success: true, data: result.data });
  },
);

/**
 * Lock and finalize a group order
 * POST /api/v1/orders/group/{groupOrderId}/lock
 */
app.post(
  "/:groupOrderId/lock",
  publicRateLimit,
  validateParams(groupOrderSchemas.groupOrderIdParam),
  validateBody(groupOrderSchemas.lockGroupOrder),
  async (c) => {
    const { groupOrderId } = c.get("validatedParams");
    const { memberToken } = c.get("validatedBody");

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
    const isHost = await groupOrderService.isHostSession(
      groupOrderId,
      memberToken,
    );

    if (!isHost) {
      throw forbidden("Only the group host can lock this order");
    }

    const result = await groupOrderService.finalizeGroupOrder(groupOrderId);

    if (!result.success) {
      throw badRequest(result.error ?? "Failed to finalize group order");
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
  moduleGate("online_ordering"),
  validateQuery(groupOrderSchemas.statisticsQuery),
  async (c) => {
    const { restaurantId, timeRange } = c.get("validatedQuery");
    const user = c.get("user");

    // Permission check for owners
    if (
      user.role === 1 &&
      restaurantId &&
      String(user.restaurantId) !== String(restaurantId)
    ) {
      throw forbidden("Access denied: can only view own restaurant statistics");
    }

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
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

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
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

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
    const result = await groupOrderService.addCartItem(groupOrderId, itemData);

    if (!result.success) {
      throw badRequest(result.error ?? "Failed to add cart item");
    }

    await broadcastGroupOrderEvent(
      c.env,
      RealtimeEventType.GROUP_CART_ITEM_ADDED,
      {
        groupOrderId,
        restaurantId: await resolveGroupOrderRestaurantId(
          groupOrderService,
          groupOrderId,
        ),
        action: "added",
        item: result.data,
      },
    );

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

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
    const result = await groupOrderService.updateCartItem(
      groupOrderId,
      itemId,
      updateData,
    );

    if (!result.success) {
      throw badRequest(result.error ?? "Failed to update cart item");
    }

    await broadcastGroupOrderEvent(
      c.env,
      RealtimeEventType.GROUP_CART_ITEM_UPDATED,
      {
        groupOrderId,
        restaurantId: await resolveGroupOrderRestaurantId(
          groupOrderService,
          groupOrderId,
        ),
        action: "updated",
        item: result.data,
      },
    );

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

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
    const result = await groupOrderService.removeCartItem(
      groupOrderId,
      itemId,
      memberId,
    );

    if (!result.success) {
      throw badRequest(result.error ?? "Failed to remove cart item");
    }

    await broadcastGroupOrderEvent(
      c.env,
      RealtimeEventType.GROUP_CART_ITEM_REMOVED,
      {
        groupOrderId,
        restaurantId: await resolveGroupOrderRestaurantId(
          groupOrderService,
          groupOrderId,
        ),
        action: "removed",
        itemId,
      },
    );

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

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
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

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
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

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
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

    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
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
  moduleGate("online_ordering"),
  async (c) => {
    const groupOrderService = new GroupOrdersService(c.env.DB, c.env.CACHE_KV);
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
