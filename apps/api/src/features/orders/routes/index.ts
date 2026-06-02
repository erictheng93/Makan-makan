/**
 * Orders Routes
 * HTTP routes for order management matching existing orders.ts functionality
 */

import { Hono } from "hono";
import { z } from "zod";
import {
  customerAuthMiddleware,
  requireRole,
} from "../../../shared/middleware";
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
import { moduleGate } from "../../../middleware/moduleGate";
import { enforceQuota, quotaGate } from "../../../middleware/quotaGate";
import { meterEmit } from "../../../shared/utils/meter";
import type { CallerContext } from "../types";
import { ROLE_STATUS_PERMISSIONS } from "../types";

const ORDER_TIMESTAMP_FIELDS = [
  "createdAt",
  "updatedAt",
  "confirmedAt",
  "preparingAt",
  "readyAt",
  "deliveredAt",
  "paidAt",
  "cancelledAt",
] as const;

function toWireTimestamp(value: unknown): unknown {
  if (value == null || typeof value === "number") {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : value;
  }
  return value;
}

function serializeOrderForWire<T>(order: T): T {
  if (!order || typeof order !== "object") {
    return order;
  }

  const serialized = { ...(order as Record<string, unknown>) };
  for (const field of ORDER_TIMESTAMP_FIELDS) {
    serialized[field] = toWireTimestamp(serialized[field]);
  }

  return serialized as T;
}

function serializeOrdersForWire<T>(orders: T[]): T[] {
  return orders.map((order) => serializeOrderForWire(order));
}

/** Convert auth user to CallerContext for service-layer defence-in-depth */
function toCallerContext(user: AuthUser): CallerContext {
  return {
    userId: user.id,
    userRole: user.role,
    userRestaurantId:
      user.restaurantId == null ? undefined : String(user.restaurantId),
  };
}

// Map a wire status string onto the canonical OrderStatus union. The
// only non-identity hop is `completed` → `delivered`, kept so realtime
// clients that still emit the older event vocabulary keep working.
function stringToOrderStatus(status: string): OrderStatus {
  if (status === "completed") return "delivered";
  return (status as OrderStatus) || "pending";
}

// Normalise the status query parameter into an OrderStatus array.
// Each entry has already been validated by orderStatusSchema upstream,
// so this is a structural-only conversion (string | string[] → array).
function convertStatusArray(
  status: string | string[] | undefined,
): OrderStatus[] | undefined {
  if (!status) return undefined;
  return (typeof status === "string" ? [status] : status) as OrderStatus[];
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
const orderBatchSyncSchema = z.object({}).passthrough();

function createBatchSyncId(payload: Record<string, unknown>): string {
  if (typeof payload.sync_id === "string" && payload.sync_id.trim()) {
    return encodeURIComponent(payload.sync_id);
  }
  return `${Date.now()}`;
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
    await enforceQuota(c, "orders.created", {
      restaurantId: data.restaurantId,
    });

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
    await meterEmit(c, "orders.created", {
      restaurantId: data.restaurantId,
      metadata: { orderId: order.id, source: "guest" },
    });

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

    return c.json(
      {
        success: true,
        data: serializeOrderForWire(order),
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
  const idParam = c.req.param("id");
  if (!idParam) throw badRequest("Missing id parameter", "MISSING_PARAM");
  const ordersService = new OrdersService(c.env);
  const order = await ordersService.getOrder(parseInt(idParam), true);

  if (!order) {
    throw notFound("Order not found");
  }

  return c.json({ success: true, data: serializeOrderForWire(order) });
});

/**
 * Preview coupon discount effect (without creating order)
 * POST /api/v1/orders/preview-coupon
 */
app.post(
  "/preview-coupon",
  customerAuthMiddleware,
  moduleGate("online_ordering"),
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
 * Batch order sync compatibility endpoint
 * POST /api/v1/orders/batch-sync
 */
app.post(
  "/batch-sync",
  customerAuthMiddleware,
  validateBody(orderBatchSyncSchema),
  async (c) => {
    const user: AuthUser = c.get("user");
    const payload = c.get("validatedBody") as Record<string, unknown>;
    const now = new Date().toISOString();
    const syncId = createBatchSyncId(payload);
    const restaurantId =
      user.restaurantId == null ? "global" : String(user.restaurantId);
    const scope = encodeURIComponent(restaurantId);
    const record = {
      userId: user.id,
      restaurantId:
        user.restaurantId == null ? null : String(user.restaurantId),
      payload,
      syncedAt: now,
    };

    await c.env.CACHE_KV.put(
      `orders:batch-sync:${scope}:${user.id}:${syncId}`,
      JSON.stringify(record),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
    await c.env.CACHE_KV.put(
      `orders:batch-sync:${scope}:${user.id}:latest`,
      JSON.stringify(record),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );

    return c.json({
      success: true,
      data: {
        syncId,
        synced: true,
        itemCount: Array.isArray(payload.orders) ? payload.orders.length : 0,
        restaurantId: record.restaurantId,
        syncedAt: now,
      },
    });
  },
);

/**
 * Create new order (requires authentication)
 * POST /api/v1/orders
 */
app.post(
  "/",
  customerAuthMiddleware,
  moduleGate("online_ordering"),
  quotaGate("orders.created"),
  validateBody(orderSchemas.createOrder),
  async (c) => {
    const data: CreateOrderInput = c.get("validatedBody");
    const user: AuthUser = c.get("user");
    const customer = c.get("customer") as { id: string } | undefined;
    const ordersService = new OrdersService(c.env);

    logger.info("Creating new order", {
      restaurantId: data.restaurantId,
      userId: user.id,
    });

    // Security: Verify restaurant access if user has restaurant constraints
    if (
      user.restaurantId != null &&
      String(user.restaurantId) !== data.restaurantId
    ) {
      throw forbidden("Access denied to this restaurant");
    }

    // Transform data for service
    const createOrderData = {
      restaurantId: data.restaurantId,
      tableId: data.tableId,
      customerId: customer?.id ?? String(user.id),
      waitingListId: data.waitingListId,
      waitingListCustomerPhone: data.customerPhone,
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
    await meterEmit(c, "orders.created", {
      restaurantId: data.restaurantId,
      metadata: { orderId: order.id },
    });

    return c.json(
      {
        success: true,
        data: serializeOrderForWire(order),
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
  customerAuthMiddleware,
  requireRole([0, 1, 2, 3, 4, 5]), // All roles including customers
  moduleGate("online_ordering"),
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
      filters.customerId = String(user.id);
    } else if (user.role !== 0) {
      // Non-admin staff only sees their restaurant's orders
      filters.restaurantId =
        user.restaurantId == null ? undefined : String(user.restaurantId);
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
      data: serializeOrdersForWire(result.orders),
      pagination: result.pagination,
    });
  },
);

/**
 * Get order statistics
 * GET /api/v1/orders/stats
 */
app.get(
  "/stats",
  customerAuthMiddleware,
  requireRole([0, 1]), // Admin and Owner only
  moduleGate("analytics"),
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
      restaurantId =
        user.restaurantId == null ? undefined : String(user.restaurantId);
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
  customerAuthMiddleware,
  requireRole([0, 1]), // Admin and Owner only
  moduleGate("analytics"),
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
      filters.restaurantId =
        user.restaurantId == null ? undefined : String(user.restaurantId);
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
 * Get active orders for restaurant
 * GET /api/v1/orders/active
 */
app.get(
  "/active",
  customerAuthMiddleware,
  requireRole([0, 1, 2, 3]), // All except cashier
  moduleGate("online_ordering"),
  async (c) => {
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    const restaurantId =
      user.role === 0
        ? c.req.query("restaurantId") || ""
        : user.restaurantId == null
          ? ""
          : String(user.restaurantId);

    if (!restaurantId) {
      throw badRequest("Restaurant ID is required");
    }

    logger.debug("Getting active orders", { restaurantId, userId: user.id });

    const orders = await ordersService.getActiveOrders(restaurantId);

    return c.json({
      success: true,
      data: serializeOrdersForWire(orders),
    });
  },
);

/**
 * Get single order details
 * GET /api/v1/orders/:id
 */
app.get(
  "/:id",
  customerAuthMiddleware,
  requireRole([0, 1, 2, 3, 4, 5]), // All roles including customers
  moduleGate("online_ordering"),
  validateParams(orderSchemas.params),
  async (c) => {
    const { id } = c.get("validatedParams");
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    logger.debug("Getting order details", { orderId: id, userId: user.id });

    const order = await ordersService.getOrder(id, true, toCallerContext(user));

    if (!order) {
      throw notFound("Order not found");
    }

    // Additional customer-specific check (customers can only see their own orders)
    if (user.role === 5 && order.customerId !== String(user.id)) {
      throw forbidden("Access denied");
    }

    return c.json({
      success: true,
      data: serializeOrderForWire(order),
    });
  },
);

/**
 * Update order status
 * PUT /api/v1/orders/:id/status
 */
app.put(
  "/:id/status",
  customerAuthMiddleware,
  requireRole([0, 1, 2, 3, 4]),
  moduleGate("online_ordering"),
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
    const existingOrder = await ordersService.getOrder(id);
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
      id,
      {
        status: stringToOrderStatus(data.status),
        notes: data.notes,
        estimatedReadyTime: data.estimatedReadyTime
          ? new Date(data.estimatedReadyTime)
          : undefined,
        updatedBy: user.id,
      },
      user.id,
      user.role as UserRole,
      toCallerContext(user),
      existingOrder, // Pass pre-fetched order to avoid redundant DB lookup
    );

    if (!updatedOrder) {
      throw badRequest("Failed to update order status");
    }

    // Sync status to external platform if this is a platform order
    if (existingOrder.orderSource && existingOrder.orderSource !== "direct") {
      c.executionCtx?.waitUntil(
        (async () => {
          try {
            const { PlatformOrderService } =
              await import("../../integrations/services/PlatformOrderService");
            const platformService = new PlatformOrderService(c.env);
            await platformService.syncStatusToPlatform(id, data.status);
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
      data: serializeOrderForWire(updatedOrder),
    });
  },
);

/**
 * Cancel order
 * DELETE /api/v1/orders/:id
 */
app.delete(
  "/:id",
  customerAuthMiddleware,
  requireRole([0, 1]), // Admin and Owner only
  moduleGate("online_ordering"),
  validateParams(orderSchemas.params),
  async (c) => {
    const { id } = c.get("validatedParams");
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    logger.info("Cancelling order", { orderId: id, userId: user.id });

    // Get order for permission check
    const order = await ordersService.getOrder(id);
    if (!order) {
      throw notFound("Order not found");
    }

    // Permission check
    if (user.role !== 0 && user.restaurantId !== order.restaurantId) {
      throw forbidden("Access denied");
    }

    const cancelledOrder = await ordersService.cancelOrder(
      id,
      "Cancelled by user",
      user.id,
      toCallerContext(user),
      order, // Pass pre-fetched order to avoid redundant DB lookup
    );

    if (!cancelledOrder) {
      throw badRequest("Failed to cancel order");
    }

    // Clear the guest-order active-order KV key (if any) so the phoneLastDigits
    // slot is freed for the next guest. The reverse mapping is written by the
    // guest-orders create route as `guest_active_lookup:{orderId}` and points
    // back to the actual `guest_active:{restaurantId}:{phoneDigits}` key.
    try {
      const lookupKey = `guest_active_lookup:${id}`;
      const activeOrderKey = await c.env.CACHE_KV.get(lookupKey);
      if (activeOrderKey) {
        await Promise.allSettled([
          c.env.CACHE_KV.delete(activeOrderKey),
          c.env.CACHE_KV.delete(lookupKey),
        ]);
      }
    } catch (err) {
      logger.warn("Failed to clear guest_active KV on admin cancel", {
        orderId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return c.json({
      success: true,
      message: "Order cancelled successfully",
    });
  },
);

/**
 * Bulk order operations
 * POST /api/v1/orders/bulk
 */
app.post(
  "/bulk",
  customerAuthMiddleware,
  requireRole([0, 1]), // Admin and Owner only
  moduleGate("online_ordering"),
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
  customerAuthMiddleware,
  requireRole([0, 1]), // Admin and Owner only
  moduleGate("online_ordering"),
  validateBody(orderSchemas.export),
  async (c) => {
    const data = c.get("validatedBody");
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    logger.info("Exporting orders", { format: data.format, userId: user.id });

    // Apply role-based filtering — exportOrdersSchema spreads orderFilterSchema flat,
    // so filter fields live alongside `format`/`includeItems`/etc on `data`.
    const {
      format,
      includeItems,
      includeCustomerInfo,
      columns,
      ...filterFields
    } = data;
    void includeItems;
    void includeCustomerInfo;
    void columns;
    const filters: Record<string, unknown> = { ...filterFields };
    if (user.role === 1) {
      filters.restaurantId =
        user.restaurantId == null ? undefined : String(user.restaurantId);
    }

    const exportData = await ordersService.exportOrders(filters, format);

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
  customerAuthMiddleware,
  requireRole([0, 1, 2, 3, 4, 5]), // All roles including customers
  moduleGate("receipt_printing"),
  quotaGate("print.jobs"),
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
    const order = await ordersService.getOrder(id);
    if (!order) {
      throw notFound("Order not found");
    }

    // Permission check
    if (user.role === 5) {
      // Customers can only view receipt for their own orders
      if (order.customerId !== String(user.id)) {
        throw forbidden("Access denied");
      }
    } else if (user.role !== 0 && user.restaurantId !== order.restaurantId) {
      // Staff can only view receipts from their restaurant
      throw forbidden("Access denied");
    }

    const receipt = await ordersService.generateReceipt(id);
    await meterEmit(c, "print.jobs", {
      restaurantId: String(order.restaurantId),
      metadata: { orderId: id },
    });

    return c.json({
      success: true,
      data: receipt,
    });
  },
);

export default app;
