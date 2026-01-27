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
 * Preview coupon discount effect (without creating order)
 * POST /api/v1/orders/preview-coupon
 */
app.post(
  "/preview-coupon",
  authMiddleware,
  validateBody(orderSchemas.couponPreview),
  async (c) => {
    try {
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
    } catch (error) {
      logger.error(
        "Coupon preview error",
        error instanceof Error ? error : undefined,
        {},
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to preview coupon",
        },
        500,
      );
    }
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
    try {
      const data: CreateOrderInput = c.get("validatedBody");
      const user: AuthUser = c.get("user");
      const ordersService = new OrdersService(c.env);

      logger.info("Creating new order", {
        restaurantId: data.restaurantId,
        userId: user.id,
      });

      // Security: Verify restaurant access if user has restaurant constraints
      if (user.restaurantId && user.restaurantId !== data.restaurantId) {
        return c.json(
          {
            success: false,
            error: "Access denied to this restaurant",
          },
          403,
        );
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
    } catch (error) {
      logger.error(
        "Create order error",
        error instanceof Error ? error : undefined,
        {},
      );

      // Determine if this is a client error (400) or server error (500)
      const isClientError =
        error instanceof Error &&
        (error.message.includes("not available") ||
          error.message.includes("not found") ||
          error.message.includes("not exist") ||
          error.message.includes("Invalid") ||
          error.message.includes("already exists") ||
          error.message.includes("required"));

      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to create order",
        },
        isClientError ? 400 : 500,
      );
    }
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
    try {
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
      );

      return c.json({
        success: true,
        data: result.orders,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error(
        "Get orders error",
        error instanceof Error ? error : undefined,
        {},
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch orders",
        },
        500,
      );
    }
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
    try {
      const { id } = c.get("validatedParams");
      const user: AuthUser = c.get("user");
      const ordersService = new OrdersService(c.env);

      logger.debug("Getting order details", { orderId: id, userId: user.id });

      const order = await ordersService.getOrder(parseInt(id), true);

      if (!order) {
        return c.json(
          {
            success: false,
            error: "Order not found",
          },
          404,
        );
      }

      // Permission check
      if (user.role === 5) {
        // Customers can only view their own orders
        if (order.customerId !== user.id) {
          return c.json(
            {
              success: false,
              error: "Access denied",
            },
            403,
          );
        }
      } else if (user.role !== 0 && user.restaurantId !== order.restaurantId) {
        // Staff can only view orders from their restaurant
        return c.json(
          {
            success: false,
            error: "Access denied",
          },
          403,
        );
      }

      return c.json({
        success: true,
        data: order,
      });
    } catch (error) {
      logger.error(
        "Get order error",
        error instanceof Error ? error : undefined,
        {},
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch order",
        },
        500,
      );
    }
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
    try {
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
        return c.json(
          {
            success: false,
            error: "Order not found",
          },
          404,
        );
      }

      // Permission check
      if (user.role !== 0 && user.restaurantId !== existingOrder.restaurantId) {
        return c.json(
          {
            success: false,
            error: "Access denied",
          },
          403,
        );
      }

      // Role-based status transition validation
      const statusTransitions: Record<number, string[]> = {
        0: [
          "pending",
          "confirmed",
          "preparing",
          "ready",
          "delivered",
          "cancelled",
        ], // Admin
        1: ["confirmed", "cancelled"], // Owner
        2: ["preparing", "ready"], // Chef
        3: ["delivered"], // Service
        4: ["confirmed"], // Cashier
      };

      if (!statusTransitions[user.role]?.includes(data.status)) {
        return c.json(
          {
            success: false,
            error: "Insufficient permissions for this status change",
          },
          403,
        );
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
      );

      if (!updatedOrder) {
        return c.json(
          {
            success: false,
            error: "Failed to update order status",
          },
          500,
        );
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

      return c.json({
        success: true,
        data: updatedOrder,
      });
    } catch (error) {
      logger.error(
        "Update order status error",
        error instanceof Error ? error : undefined,
        {},
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to update order status",
        },
        500,
      );
    }
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
    try {
      const { id } = c.get("validatedParams");
      const user: AuthUser = c.get("user");
      const ordersService = new OrdersService(c.env);

      logger.info("Cancelling order", { orderId: id, userId: user.id });

      // Get order for permission check
      const order = await ordersService.getOrder(parseInt(id));
      if (!order) {
        return c.json(
          {
            success: false,
            error: "Order not found",
          },
          404,
        );
      }

      // Permission check
      if (user.role !== 0 && user.restaurantId !== order.restaurantId) {
        return c.json(
          {
            success: false,
            error: "Access denied",
          },
          403,
        );
      }

      const cancelledOrder = await ordersService.cancelOrder(
        parseInt(id),
        "Cancelled by user",
        user.id,
      );

      if (!cancelledOrder) {
        return c.json(
          {
            success: false,
            error: "Failed to cancel order",
          },
          500,
        );
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
    } catch (error) {
      logger.error(
        "Cancel order error",
        error instanceof Error ? error : undefined,
        {},
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to cancel order",
        },
        500,
      );
    }
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
    try {
      const query: StatsQueryInput = c.get("validatedQuery");
      const user: AuthUser = c.get("user");
      const ordersService = new OrdersService(c.env);

      logger.debug("Getting order statistics", { query, userId: user.id });

      // Determine restaurant ID
      let restaurantId: number | undefined;
      if (user.role === 1) {
        // Owner only sees their restaurant
        restaurantId = user.restaurantId;
      } else if (query.restaurantId) {
        restaurantId = query.restaurantId;
      }

      if (!restaurantId) {
        return c.json(
          {
            success: false,
            error: "Restaurant ID is required",
          },
          400,
        );
      }

      const _dateFrom = query.dateFrom
        ? new Date(query.dateFrom)
        : new Date(new Date().setDate(new Date().getDate() - 30));
      const _dateTo = query.dateTo ? new Date(query.dateTo) : new Date();

      const statistics = await ordersService.getOrderStatistics(restaurantId);

      return c.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      logger.error(
        "Get order stats error",
        error instanceof Error ? error : undefined,
        {},
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch order statistics",
        },
        500,
      );
    }
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
    try {
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

      const analytics = await ordersService.getOrderAnalytics(filters, user.id);

      return c.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error(
        "Get order analytics error",
        error instanceof Error ? error : undefined,
        {},
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch order analytics",
        },
        500,
      );
    }
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
    try {
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
    } catch (error) {
      logger.error(
        "Bulk order operation error",
        error instanceof Error ? error : undefined,
        {},
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to execute bulk operation",
        },
        500,
      );
    }
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
    try {
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
    } catch (error) {
      logger.error(
        "Export orders error",
        error instanceof Error ? error : undefined,
        {},
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to export orders",
        },
        500,
      );
    }
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
    try {
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
        return c.json(
          {
            success: false,
            error: "Order not found",
          },
          404,
        );
      }

      // Permission check
      if (user.role === 5) {
        // Customers can only view receipt for their own orders
        if (order.customerId !== user.id) {
          return c.json(
            {
              success: false,
              error: "Access denied",
            },
            403,
          );
        }
      } else if (user.role !== 0 && user.restaurantId !== order.restaurantId) {
        // Staff can only view receipts from their restaurant
        return c.json(
          {
            success: false,
            error: "Access denied",
          },
          403,
        );
      }

      const receipt = await ordersService.generateReceipt(parseInt(id));

      return c.json({
        success: true,
        data: receipt,
      });
    } catch (error) {
      logger.error(
        "Generate receipt error",
        error instanceof Error ? error : undefined,
        {},
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate receipt",
        },
        500,
      );
    }
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
    try {
      const user: AuthUser = c.get("user");
      const ordersService = new OrdersService(c.env);

      const restaurantId =
        user.role === 0
          ? parseInt(c.req.query("restaurantId") || "0")
          : user.restaurantId;

      if (!restaurantId) {
        return c.json(
          {
            success: false,
            error: "Restaurant ID is required",
          },
          400,
        );
      }

      logger.debug("Getting active orders", { restaurantId, userId: user.id });

      const orders = await ordersService.getActiveOrders(restaurantId);

      return c.json({
        success: true,
        data: orders,
      });
    } catch (error) {
      logger.error(
        "Get active orders error",
        error instanceof Error ? error : undefined,
        {},
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch active orders",
        },
        500,
      );
    }
  },
);

export default app;
