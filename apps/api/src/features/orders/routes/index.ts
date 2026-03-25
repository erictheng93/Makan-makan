/**
 * Orders Routes
 * HTTP routes for order management matching existing orders.ts functionality
 */

import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../shared/middleware";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../shared/middleware";
import {
  guestSessionAuth,
  guestTokenAuth,
} from "../../../middleware/guestAuth";
import type { GuestSessionData } from "../../../middleware/guestAuth";
import { OrdersService } from "../services/OrdersService";
import { ConsoleLogger } from "../../../core/monitoring";
import type { Env } from "../../../shared/types";
import type { AuthUser } from "../../../middleware/auth";
import {
  OrderStatus,
  OrderPaymentStatus,
  OrderPaymentMethod,
  UserRole,
} from "@makanmakan/shared-types";
import {
  notFound,
  forbidden,
  badRequest,
} from "../../../shared/utils/api-error";
import type { CallerContext } from "../types";
import { ROLE_STATUS_PERMISSIONS } from "../types";

/** Convert auth user to CallerContext for service-layer defence-in-depth */
function toCallerContext(user: AuthUser): CallerContext {
  return {
    userId: user.id,
    userRole: user.role,
    userRestaurantId: user.restaurantId,
  };
}

// Helper function to convert string status to enum value
function stringToOrderStatus(status: string): OrderStatus {
  const statusMap = {
    pending: OrderStatus.PENDING,
    confirmed: OrderStatus.CONFIRMED,
    preparing: OrderStatus.PREPARING,
    ready: OrderStatus.READY,
    delivered: OrderStatus.DELIVERED,
    paid: OrderStatus.PAID,
    cancelled: OrderStatus.CANCELLED,
    completed: OrderStatus.DELIVERED, // Map 'completed' to DELIVERED
  };
  return statusMap[status as keyof typeof statusMap] ?? OrderStatus.PENDING;
}

// Helper function to convert status array
function convertStatusArray(
  status: string | string[] | undefined,
): OrderStatus[] | undefined {
  if (!status) return undefined;
  if (typeof status === "string") {
    return [stringToOrderStatus(status)];
  }
  return status.map((s) => stringToOrderStatus(s));
}

// Helper function to convert payment status
function stringToPaymentStatus(status: string): OrderPaymentStatus {
  const statusMap = {
    pending: OrderPaymentStatus.PENDING,
    paid: OrderPaymentStatus.PAID,
    failed: OrderPaymentStatus.FAILED,
  };
  return (
    statusMap[status as keyof typeof statusMap] ?? OrderPaymentStatus.PENDING
  );
}

// Helper function to convert payment status array
function convertPaymentStatusArray(
  status: string | string[] | undefined,
): OrderPaymentStatus[] | undefined {
  if (!status) return undefined;
  if (typeof status === "string") {
    return [stringToPaymentStatus(status)];
  }
  return status.map((s) => stringToPaymentStatus(s));
}

// Helper function to convert payment method array
function convertPaymentMethodArray(
  method: string | string[] | undefined,
): OrderPaymentMethod[] | undefined {
  if (!method) return undefined;
  if (typeof method === "string") {
    return [method as OrderPaymentMethod];
  }
  return method as OrderPaymentMethod[];
}

// Import validation schemas
import {
  orderSchemas,
  CreateOrderInput,
  UpdateOrderStatusInput,
  OrderFiltersInput,
  CouponPreviewInput,
  BulkOrderOperationInput,
  AnalyticsQueryInput,
  StatsQueryInput,
} from "../schemas/validation";

// Create router
const app = new Hono<{ Bindings: Env }>();
const logger = new ConsoleLogger("OrdersRoutes");

// Helper function for broadcasting order updates
async function broadcastOrderUpdate(
  env: Env,
  orderId: number,
  orderData: any,
  restaurantId: string,
  targetRoles?: number[],
): Promise<void> {
  try {
    const apiBaseUrl = env.API_BASE_URL || "http://localhost:8787";
    const internalToken = env.INTERNAL_API_TOKEN || "internal";

    const response = await fetch(
      `${apiBaseUrl}/api/v1/sse/broadcast/order-update`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalToken}`,
        },
        body: JSON.stringify({
          orderId,
          orderData,
          restaurantId,
          targetRoles,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`SSE broadcast failed: ${response.status}`);
    }

    logger.debug("Order update broadcasted successfully", {
      orderId,
      targetRoles,
    });
  } catch (error) {
    logger.error(
      "Failed to broadcast order update via SSE",
      error instanceof Error ? error : undefined,
      {},
    );
    // Don't throw error as this is non-critical functionality
  }
}

/**
 * Create guest order (no JWT required, uses guest token)
 * POST /api/v1/orders/guest
 */
app.post(
  "/guest",
  guestSessionAuth,
  validateBody(orderSchemas.createOrder),
  async (c) => {
    const guestSession: GuestSessionData = c.get("guestSession");
    const data: CreateOrderInput = c.get("validatedBody");
    const ordersService = new OrdersService(c.env);

    logger.info("Creating guest order", {
      restaurantId: data.restaurantId,
      phoneLastDigits: guestSession.phoneLastDigits,
    });

    // Verify restaurant matches token
    if (data.restaurantId !== guestSession.restaurantId) {
      throw forbidden("Restaurant mismatch");
    }

    // Build order data (no customerId for guests)
    const createOrderData: import("../types").CreateOrderData = {
      restaurantId: data.restaurantId,
      tableId: data.tableId,
      customerInfo: {
        name: data.customerName,
        phone: data.customerPhone,
      },
      items: data.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: item.price,
        customizations: item.customizations,
        notes: item.notes,
      })),
      notes: data.notes,
      orderType: data.orderType,
      isGuestOrder: true,
    };

    const order = await ordersService.createOrder(createOrderData);

    // Update KV token to include orderId for tracking
    const authHeader = c.req.header("Authorization")!;
    const token = authHeader.substring(7);
    await c.env.CACHE_KV.put(
      `guest_token:${token}`,
      JSON.stringify({
        ...guestSession,
        orderId: String(order.id),
      }),
      { expirationTtl: 14400 },
    );

    // Broadcast new order to kitchen and management
    c.executionCtx?.waitUntil(
      broadcastOrderUpdate(
        c.env,
        order.id,
        order,
        data.restaurantId,
        [0, 1, 2], // Admin, Owner, Chef
      ),
    );

    return c.json(
      {
        success: true,
        data: order,
        guestToken: token,
      },
      201,
    );
  },
);

/**
 * Get guest order status (uses guest token)
 * GET /api/v1/orders/guest/:id
 */
app.get("/guest/:id", guestTokenAuth, async (c) => {
  const ordersService = new OrdersService(c.env);
  const order = await ordersService.getOrder(parseInt(c.req.param("id")), true);

  if (!order) {
    throw notFound("Order not found");
  }

  return c.json({ success: true, data: order });
});

/**
 * Preview coupon discount effect (without creating order)
 * POST /api/v1/orders/preview-coupon
 */
app.post(
  "/preview-coupon",
  authMiddleware,
  validateBody(orderSchemas.couponPreview),
  async (c) => {
    const data: CouponPreviewInput = c.get("validatedBody");
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    logger.info("Previewing coupon", {
      couponCode: data.couponCode,
      userId: user.id,
    });

    const result = await ordersService.previewCoupon({
      restaurantId: data.restaurantId,
      couponCode: data.couponCode,
      orderAmount: data.orderAmount,
      userId: data.userId || user.id,
      menuItems: data.menuItems,
    });

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * Create new order (requires authentication)
 * POST /api/v1/orders
 */
app.post(
  "/",
  authMiddleware,
  validateBody(orderSchemas.createOrder),
  async (c) => {
    const data: CreateOrderInput = c.get("validatedBody");
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    logger.info("Creating new order", {
      restaurantId: data.restaurantId,
      userId: user.id,
    });

    // Security: Verify restaurant access if user has restaurant constraints
    if (user.restaurantId && user.restaurantId !== data.restaurantId) {
      throw forbidden("Access denied to this restaurant");
    }

    // Transform data for service
    const createOrderData = {
      restaurantId: data.restaurantId,
      tableId: data.tableId,
      customerId: user.id,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      items: data.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: item.price,
        customizations: item.customizations,
        notes: item.notes,
      })),
      notes: data.notes,
      orderType: data.orderType,
      deliveryInfo: data.deliveryInfo,
      scheduledTime: data.scheduledTime
        ? new Date(data.scheduledTime)
        : undefined,
      couponCode: data.couponCode,
    };

    const order = await ordersService.createOrder(createOrderData, user.id);

    // Broadcast new order to kitchen and management
    c.executionCtx?.waitUntil(
      broadcastOrderUpdate(
        c.env,
        order.id,
        order,
        data.restaurantId,
        [0, 1, 2], // Admin, Owner, Chef
      ),
    );

    return c.json(
      {
        success: true,
        data: order,
      },
      201,
    );
  },
);

/**
 * Get orders list with filtering and pagination
 * GET /api/v1/orders
 */
app.get(
  "/",
  authMiddleware,
  requireRole([0, 1, 2, 3, 4, 5]), // All roles including customers
  validateQuery(orderSchemas.orderFilters),
  async (c) => {
    const query: OrderFiltersInput = c.get("validatedQuery");
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    logger.debug("Getting orders", { filters: query, userId: user.id });

    // Apply role-based filtering and type conversions
    const filters = {
      ...query,
      status: convertStatusArray(query.status),
      paymentStatus: convertPaymentStatusArray(query.paymentStatus),
      paymentMethod: convertPaymentMethodArray(query.paymentMethod),
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      scheduledTimeFrom: query.scheduledTimeFrom
        ? new Date(query.scheduledTimeFrom)
        : undefined,
      scheduledTimeTo: query.scheduledTimeTo
        ? new Date(query.scheduledTimeTo)
        : undefined,
    };

    // Role-based filtering
    if (user.role === 5) {
      // Customers only see their own orders
      filters.customerId = user.id;
    } else if (user.role !== 0) {
      // Non-admin staff only sees their restaurant's orders
      filters.restaurantId = user.restaurantId;
    } else if (query.restaurantId) {
      // Admin can filter by restaurant
      filters.restaurantId = query.restaurantId;
    }

    const result = await ordersService.getOrders(
      filters,
      user.id,
      user.role as UserRole,
      toCallerContext(user),
    );

    return c.json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
    });
  },
);

/**
 * Get single order details
 * GET /api/v1/orders/:id
 */
app.get(
  "/:id",
  authMiddleware,
  requireRole([0, 1, 2, 3, 4, 5]), // All roles including customers
  validateParams(orderSchemas.params),
  async (c) => {
    const { id } = c.get("validatedParams");
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    logger.debug("Getting order details", { orderId: id, userId: user.id });

    const order = await ordersService.getOrder(
      parseInt(id),
      true,
      toCallerContext(user),
    );

    if (!order) {
      throw notFound("Order not found");
    }

    // Additional customer-specific check (customers can only see their own orders)
    if (user.role === 5 && order.customerId !== user.id) {
      throw forbidden("Access denied");
    }

    return c.json({
      success: true,
      data: order,
    });
  },
);

/**
 * Update order status
 * PUT /api/v1/orders/:id/status
 */
app.put(
  "/:id/status",
  authMiddleware,
  requireRole([0, 1, 2, 3, 4]),
  validateParams(orderSchemas.params),
  validateBody(orderSchemas.updateOrderStatus),
  async (c) => {
    const { id } = c.get("validatedParams");
    const data: UpdateOrderStatusInput = c.get("validatedBody");
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    logger.info("Updating order status", {
      orderId: id,
      newStatus: data.status,
      userId: user.id,
    });

    // Get existing order for permission checks
    const existingOrder = await ordersService.getOrder(parseInt(id));
    if (!existingOrder) {
      throw notFound("Order not found");
    }

    // Permission check
    if (user.role !== 0 && user.restaurantId !== existingOrder.restaurantId) {
      throw forbidden("Access denied");
    }

    // Role-based status transition validation (uses shared constant)
    if (!ROLE_STATUS_PERMISSIONS[user.role]?.includes(data.status)) {
      throw forbidden("Insufficient permissions for this status change");
    }

    const updatedOrder = await ordersService.updateOrderStatus(
      parseInt(id),
      {
        status: data.status as any, // Pass string directly, service will normalize
        notes: data.notes,
        estimatedReadyTime: data.estimatedReadyTime
          ? new Date(data.estimatedReadyTime)
          : undefined,
        updatedBy: user.id,
      },
      user.id,
      user.role as UserRole,
      toCallerContext(user),
    );

    if (!updatedOrder) {
      throw badRequest("Failed to update order status");
    }

    // Determine target roles for broadcast
    let targetRoles: number[] = [];
    switch (data.status) {
      case "confirmed":
        targetRoles = [0, 1, 2];
        break;
      case "preparing":
        targetRoles = [0, 1, 3];
        break;
      case "ready":
        targetRoles = [0, 1, 3];
        break;
      case "delivered":
        targetRoles = [0, 1];
        break;
      case "cancelled":
        targetRoles = [0, 1, 2, 3];
        break;
      default:
        targetRoles = [0, 1];
    }

    // Broadcast status update
    c.executionCtx?.waitUntil(
      broadcastOrderUpdate(
        c.env,
        parseInt(id),
        updatedOrder,
        existingOrder.restaurantId,
        targetRoles,
      ),
    );

    // Sync status to external platform if this is a platform order
    if (existingOrder.orderSource && existingOrder.orderSource !== "direct") {
      c.executionCtx?.waitUntil(
        (async () => {
          try {
            const { PlatformOrderService } =
              await import("../../integrations/services/PlatformOrderService");
            const platformService = new PlatformOrderService(c.env);
            await platformService.syncStatusToPlatform(
              parseInt(id),
              data.status,
            );
          } catch (err) {
            logger.error(
              "Failed to sync status to platform",
              err instanceof Error ? err : undefined,
              { orderId: id, status: data.status },
            );
          }
        })(),
      );
    }

    return c.json({
      success: true,
      data: updatedOrder,
    });
  },
);

/**
 * Cancel order
 * DELETE /api/v1/orders/:id
 */
app.delete(
  "/:id",
  authMiddleware,
  requireRole([0, 1]), // Admin and Owner only
  validateParams(orderSchemas.params),
  async (c) => {
    const { id } = c.get("validatedParams");
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    logger.info("Cancelling order", { orderId: id, userId: user.id });

    // Get order for permission check
    const order = await ordersService.getOrder(parseInt(id));
    if (!order) {
      throw notFound("Order not found");
    }

    // Permission check
    if (user.role !== 0 && user.restaurantId !== order.restaurantId) {
      throw forbidden("Access denied");
    }

    const cancelledOrder = await ordersService.cancelOrder(
      parseInt(id),
      "Cancelled by user",
      user.id,
      toCallerContext(user),
    );

    if (!cancelledOrder) {
      throw badRequest("Failed to cancel order");
    }

    // Broadcast cancellation
    c.executionCtx?.waitUntil(
      broadcastOrderUpdate(
        c.env,
        parseInt(id),
        cancelledOrder,
        order.restaurantId,
        [0, 1, 2, 3], // All relevant staff
      ),
    );

    return c.json({
      success: true,
      message: "Order cancelled successfully",
    });
  },
);

/**
 * Get order statistics
 * GET /api/v1/orders/stats
 */
app.get(
  "/stats",
  authMiddleware,
  requireRole([0, 1]), // Admin and Owner only
  validateQuery(orderSchemas.stats),
  async (c) => {
    const query: StatsQueryInput = c.get("validatedQuery");
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    logger.debug("Getting order statistics", { query, userId: user.id });

    // Determine restaurant ID
    let restaurantId: string | undefined;
    if (user.role === 1) {
      // Owner only sees their restaurant
      restaurantId = user.restaurantId;
    } else if (query.restaurantId) {
      restaurantId = query.restaurantId;
    }

    if (!restaurantId) {
      throw badRequest("Restaurant ID is required");
    }

    const statistics = await ordersService.getOrderStatistics(restaurantId);

    return c.json({
      success: true,
      data: statistics,
    });
  },
);

/**
 * Get order analytics
 * GET /api/v1/orders/analytics
 */
app.get(
  "/analytics",
  authMiddleware,
  requireRole([0, 1]), // Admin and Owner only
  validateQuery(orderSchemas.analytics),
  async (c) => {
    const query: AnalyticsQueryInput = c.get("validatedQuery");
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    logger.debug("Getting order analytics", { query, userId: user.id });

    // Apply role-based filtering and type conversions
    const filters = {
      ...query,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    };
    if (user.role === 1) {
      filters.restaurantId = user.restaurantId;
    }

    const analytics = await ordersService.getOrderAnalytics(
      filters,
      user.id,
      toCallerContext(user),
    );

    return c.json({
      success: true,
      data: analytics,
    });
  },
);

/**
 * Bulk order operations
 * POST /api/v1/orders/bulk
 */
app.post(
  "/bulk",
  authMiddleware,
  requireRole([0, 1]), // Admin and Owner only
  validateBody(orderSchemas.bulkOperation),
  async (c) => {
    const data: BulkOrderOperationInput = c.get("validatedBody");
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    logger.info("Executing bulk order operation", {
      action: data.action,
      orderCount: data.orderIds.length,
    });

    const result = await ordersService.bulkUpdateOrders(data, user.id);

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * Export orders
 * POST /api/v1/orders/export
 */
app.post(
  "/export",
  authMiddleware,
  requireRole([0, 1]), // Admin and Owner only
  validateBody(orderSchemas.export),
  async (c) => {
    const data = c.get("validatedBody");
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    logger.info("Exporting orders", { format: data.format, userId: user.id });

    // Apply role-based filtering
    const filters = data.filters || {};
    if (user.role === 1) {
      filters.restaurantId = user.restaurantId;
    }

    const exportData = await ordersService.exportOrders(filters, data.format);

    // Set appropriate headers
    const filename = `orders-${new Date().toISOString().split("T")[0]}.${data.format}`;
    let contentType = "application/octet-stream";

    switch (data.format) {
      case "csv":
        contentType = "text/csv";
        break;
      case "excel":
        contentType =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        break;
      case "pdf":
        contentType = "application/pdf";
        break;
    }

    return new Response(exportData, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  },
);

/**
 * Generate order receipt
 * GET /api/v1/orders/:id/receipt
 */
app.get(
  "/:id/receipt",
  authMiddleware,
  requireRole([0, 1, 2, 3, 4, 5]), // All roles including customers
  validateParams(orderSchemas.params),
  async (c) => {
    const { id } = c.get("validatedParams");
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    logger.debug("Generating order receipt", {
      orderId: id,
      userId: user.id,
    });

    // Get order first to check permissions
    const order = await ordersService.getOrder(parseInt(id));
    if (!order) {
      throw notFound("Order not found");
    }

    // Permission check
    if (user.role === 5) {
      // Customers can only view receipt for their own orders
      if (order.customerId !== user.id) {
        throw forbidden("Access denied");
      }
    } else if (user.role !== 0 && user.restaurantId !== order.restaurantId) {
      // Staff can only view receipts from their restaurant
      throw forbidden("Access denied");
    }

    const receipt = await ordersService.generateReceipt(parseInt(id));

    return c.json({
      success: true,
      data: receipt,
    });
  },
);

/**
 * Get active orders for restaurant
 * GET /api/v1/orders/active
 */
app.get(
  "/active",
  authMiddleware,
  requireRole([0, 1, 2, 3]), // All except cashier
  async (c) => {
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    const restaurantId =
      user.role === 0 ? c.req.query("restaurantId") || "" : user.restaurantId;

    if (!restaurantId) {
      throw badRequest("Restaurant ID is required");
    }

    logger.debug("Getting active orders", { restaurantId, userId: user.id });

    const orders = await ordersService.getActiveOrders(restaurantId);

    return c.json({
      success: true,
      data: orders,
    });
  },
);

export default app;
