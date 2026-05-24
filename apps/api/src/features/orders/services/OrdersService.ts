/**
 * Orders Service
 * Comprehensive business logic for order management
 */

import {
  OrderService as BaseOrderService,
  CouponService,
} from "@makanmakan/database";
import {
  Order,
  OrderStatus,
  OrderPaymentStatus,
  OrderPaymentMethod,
  RealtimeEventType,
} from "@makanmakan/shared-types";
import {
  badRequest,
  notFound,
  forbidden,
  conflict,
} from "../../../shared/utils/api-error";
import type { Env } from "../../../shared/types";
import type { UserRole } from "../../../shared/constants";
import { ConsoleLogger } from "../../../core/monitoring";
import { RealtimeBroadcastService } from "@makanmakan/database";
import type {
  OrderCancelledEvent,
  OrderStatusUpdateEvent,
  NewOrderEvent,
} from "@makanmakan/shared-types";
import { ORDER_STATUS_TRANSITIONS, ROLE_STATUS_PERMISSIONS } from "../types";
import type {
  CreateOrderData,
  UpdateOrderData,
  OrderStatusUpdateData,
  OrderQueryFilters,
  OrderSearchParams,
  OrderAnalytics,
  OrderStats,
  CouponValidation,
  CouponPreviewRequest,
  OrderUpdateEvent,
  BulkOrderOperation,
  BulkOrderResult,
  OrderReceipt,
  PaymentIntegration,
  IOrdersService,
  CallerContext,
  SelectedCustomizations,
} from "../types";

// Minimal KV surface used by this service.
interface KVLike {
  get(key: string, type?: "json"): Promise<unknown>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}

export class OrdersService implements IOrdersService {
  private baseOrderService: BaseOrderService;
  private couponService: CouponService;
  private realtimeBroadcastService: RealtimeBroadcastService;
  // Loose KV interface; only the methods we actually call are typed.
  private cacheKV: KVLike;
  private logger: ConsoleLogger;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.baseOrderService = new BaseOrderService(env.DB, env);
    this.couponService = new CouponService(env.DB, env);
    this.realtimeBroadcastService = new RealtimeBroadcastService(env);
    this.cacheKV = env.CACHE_KV;
    this.logger = new ConsoleLogger("OrdersService");
  }

  // Core CRUD Operations
  async createOrder(data: CreateOrderData, userId?: number): Promise<Order> {
    try {
      this.logger.info("Creating new order", {
        restaurantId: data.restaurantId,
        userId,
      });

      // Defence-in-depth: validate inputs even though Zod schemas cover the route layer.
      // Guards against direct service calls bypassing route validation.

      // Validate restaurant ID
      if (!data.restaurantId) {
        throw badRequest("Invalid restaurant ID", "INVALID_RESTAURANT_ID");
      }

      // Validate items
      if (!data.items || data.items.length === 0) {
        throw badRequest(
          "Order must contain at least one item",
          "EMPTY_ORDER_ITEMS",
        );
      }
      if (data.items.length > 100) {
        throw badRequest(
          "Order cannot exceed 100 items",
          "TOO_MANY_ORDER_ITEMS",
        );
      }

      // Validate each item
      for (const item of data.items) {
        if (!item.menuItemId || item.menuItemId <= 0) {
          throw badRequest("Invalid menu item ID", "INVALID_MENU_ITEM_ID");
        }
        if (!item.quantity || item.quantity <= 0) {
          throw badRequest("Invalid item quantity", "INVALID_ITEM_QUANTITY");
        }
        if (item.quantity > 999) {
          throw badRequest(
            "Invalid item quantity: cannot exceed 999",
            "ITEM_QUANTITY_EXCEEDED",
          );
        }
      }

      // Validate phone format
      if (
        data.customerInfo?.phone &&
        !/^[\d\s\-+()]{7,20}$/.test(data.customerInfo.phone)
      ) {
        throw badRequest("Invalid phone number format", "INVALID_PHONE_FORMAT");
      }

      // Validate email format
      if (
        data.customerInfo?.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerInfo.email)
      ) {
        throw badRequest("Invalid email format", "INVALID_EMAIL_FORMAT");
      }

      // Validate notes length
      if (data.notes && data.notes.length > 1000) {
        throw badRequest(
          "Order notes cannot exceed 1000 characters",
          "NOTES_TOO_LONG",
        );
      }

      // Validate coupon code format
      if (data.couponCode && data.couponCode.length < 3) {
        throw badRequest(
          "Invalid coupon code format",
          "INVALID_COUPON_CODE_FORMAT",
        );
      }

      // Convert feature-specific data to base service format
      const baseOrderData = {
        restaurantId: String(data.restaurantId),
        tableId: data.tableId ?? undefined, // undefined for shop/takeaway orders (no table needed)
        customerId: data.customerId, // Keep as number
        customerInfo: data.customerInfo,
        items: data.items.map((item) => ({
          menuItemId: item.menuItemId, // Keep as number
          quantity: item.quantity,
          customizations: item.customizations as
            | SelectedCustomizations
            | undefined,
          notes: item.notes,
        })),
        notes: data.notes,
        couponCode: data.couponCode,
        clientMutationId: data.clientMutationId,
        orderSource: data.orderSource,
        deliveryInfo: data.deliveryInfo,
      };

      // Create order using base service
      const order = await this.baseOrderService.createOrder(baseOrderData);

      // Cache the order
      await Promise.all([
        this.cacheOrder(order),
        this.logOrderActivity(order.id, "ORDER_CREATED", userId, {
          restaurantId: data.restaurantId,
          itemCount: data.items.length,
          total: order.totalAmount,
        }),
        this.broadcastNewOrder(order),
      ]);

      this.logger.info("Order created successfully", {
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
      return order;
    } catch (error) {
      this.logger.error(
        "Failed to create order",
        error instanceof Error ? error : undefined,
        { data },
      );
      throw error;
    }
  }

  async getOrder(
    id: number,
    includeItems: boolean = true,
    caller?: CallerContext,
  ): Promise<Order | null> {
    try {
      // Try cache first
      const cacheKey = `order:${id}:${includeItems ? "full" : "basic"}`;
      const cached = (await this.cacheKV.get(cacheKey, "json")) as Order | null;
      if (cached) {
        this.assertRestaurantAccess(cached, caller);
        return cached;
      }

      // Get from base service
      const order = await this.baseOrderService.getOrder(id);
      if (!order) return null;

      // Defence-in-depth: verify caller has access to this order's restaurant
      this.assertRestaurantAccess(order, caller);

      // Cache the result
      await this.cacheKV.put(cacheKey, JSON.stringify(order), {
        expirationTtl: 300,
      }); // 5 minutes

      return order;
    } catch (error) {
      this.logger.error(
        "Failed to get order",
        error instanceof Error ? error : undefined,
        { orderId: id },
      );
      throw error;
    }
  }

  async getOrders(
    filters: OrderQueryFilters,
    userId?: number,
    userRole?: UserRole,
    caller?: CallerContext,
  ): Promise<{
    orders: Order[];
    total: number;
    pagination: { page: number; limit: number; totalPages: number };
  }> {
    try {
      // Apply permission-based filtering (defence-in-depth: overrides restaurantId for non-admin)
      const permissionFilters = await this.applyPermissionFilters(
        filters,
        userId,
        userRole,
        caller,
      );

      // Convert to base service format
      const baseFilters = this.convertToBaseFilters(permissionFilters);

      // Get orders from base service
      const result = await this.baseOrderService.getOrders(
        baseFilters,
        filters.page || 1,
        filters.limit || 20,
      );

      // Apply additional filtering and sorting
      let orders = result.orders;

      // Defence-in-depth: strip any orders that don't match the requested restaurant
      // Only filter orders that have a restaurantId field.
      if (permissionFilters.restaurantId) {
        orders = orders.filter(
          (o) =>
            !o.restaurantId ||
            o.restaurantId === permissionFilters.restaurantId,
        );
      }

      return {
        orders,
        total: result.pagination.total,
        pagination: result.pagination,
      };
    } catch (error) {
      this.logger.error(
        "Failed to get orders",
        error instanceof Error ? error : undefined,
        { filters },
      );
      throw error;
    }
  }

  async updateOrder(
    id: number,
    data: UpdateOrderData,
    userId?: number,
  ): Promise<Order | null> {
    try {
      this.logger.info("Updating order", { orderId: id, data, userId });

      const existingOrder = await this.getOrder(id);
      if (!existingOrder) return null;

      // Update using base service methods
      let updatedOrder = existingOrder;

      if (data.status !== undefined) {
        updatedOrder =
          (await this.baseOrderService.updateOrderStatus(id, {
            status: data.status,
            notes: data.notes,
          })) || updatedOrder;
      }

      // Handle payment status updates
      if (data.paymentStatus !== undefined) {
        const paymentUpdate = await this.updatePaymentStatus(
          id,
          data.paymentStatus,
          data.paymentMethod,
        );
        if (paymentUpdate) {
          updatedOrder = paymentUpdate;
        }
      }

      // Clear cache
      await this.invalidateOrderCache(id);

      // Log activity
      await this.logOrderActivity(id, "ORDER_UPDATED", userId, data);

      this.logger.info("Order updated successfully", { orderId: id });
      return updatedOrder;
    } catch (error) {
      this.logger.error(
        "Failed to update order",
        error instanceof Error ? error : undefined,
        { orderId: id },
      );
      throw error;
    }
  }

  async deleteOrder(id: number, userId?: number): Promise<boolean> {
    try {
      const order = await this.getOrder(id);
      if (!order) return false;

      // Only allow deletion of pending orders
      if (String(order.status) !== "pending") {
        throw conflict(
          "Only pending orders can be deleted",
          "ORDER_NOT_DELETABLE",
        );
      }

      // Use base service cancel method
      await this.baseOrderService.cancelOrder(id, "Order deleted");

      // Clear cache
      await this.invalidateOrderCache(id);

      // Log activity
      await this.logOrderActivity(id, "ORDER_DELETED", userId);

      return true;
    } catch (error) {
      this.logger.error(
        "Failed to delete order",
        error instanceof Error ? error : undefined,
        { orderId: id },
      );
      throw error;
    }
  }

  // Order Item Status
  async updateItemStatus(
    itemId: number,
    status: string,
    notes?: string,
  ): Promise<void> {
    try {
      await this.baseOrderService.updateOrderItemStatus(itemId, status, notes);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Order item status conflict")
      ) {
        throw conflict(
          "Order item was already updated. Reload before retrying.",
          "ORDER_ITEM_STATUS_CONFLICT",
        );
      }
      throw error;
    }
  }

  // Status Management
  async updateOrderStatus(
    id: number,
    statusData: OrderStatusUpdateData,
    userId?: number,
    userRole?: UserRole,
    caller?: CallerContext,
    /** Pre-fetched order to avoid redundant DB lookups */
    prefetchedOrder?: Order,
  ): Promise<Order | null> {
    try {
      const order = prefetchedOrder ?? (await this.getOrder(id));
      if (!order) return null;
      if (prefetchedOrder && prefetchedOrder.id !== id) {
        throw badRequest("Prefetched order ID mismatch", "ORDER_ID_MISMATCH");
      }

      this.assertRestaurantAccess(order, caller);

      // Validate status transition
      this.validateStatusTransition(order.status, statusData.status, userRole);

      // Update using base service
      let updatedOrder;
      try {
        updatedOrder = await this.baseOrderService.updateOrderStatus(id, {
          status: statusData.status,
          notes: statusData.notes,
          expectedVersion: order.version,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("Order version conflict")
        ) {
          throw conflict(
            "Order was updated by another actor. Reload before retrying.",
            "ORDER_VERSION_CONFLICT",
          );
        }
        throw error;
      }

      if (!updatedOrder) {
        throw new Error("Failed to update order status");
      }

      await Promise.all([
        this.invalidateOrderCache(id),
        this.broadcastOrderStatusUpdate(
          updatedOrder,
          order.status,
          statusData.status,
          userId || 0,
          statusData.notes,
          statusData.estimatedReadyTime,
        ),
      ]);

      return updatedOrder;
    } catch (error) {
      this.logger.error(
        "Failed to update order status",
        error instanceof Error ? error : undefined,
        { orderId: id },
      );
      throw error;
    }
  }

  async cancelOrder(
    id: number,
    reason: string,
    userId?: number,
    caller?: CallerContext,
    /** Pre-fetched order to avoid redundant DB lookups */
    prefetchedOrder?: Order,
  ): Promise<Order | null> {
    try {
      // Defence-in-depth: verify caller has access before cancelling
      if (caller) {
        const order = prefetchedOrder ?? (await this.getOrder(id));
        if (order) {
          this.assertRestaurantAccess(order, caller);
        }
      }

      const cancelledOrder = await this.baseOrderService.cancelOrder(
        id,
        reason,
      );

      if (cancelledOrder) {
        await Promise.all([
          this.invalidateOrderCache(id),
          this.logOrderActivity(id, "ORDER_CANCELLED", userId, { reason }),
          this.broadcastOrderCancelled(cancelledOrder, reason, userId || 0),
        ]);
      }

      return cancelledOrder;
    } catch (error) {
      this.logger.error(
        "Failed to cancel order",
        error instanceof Error ? error : undefined,
        { orderId: id },
      );
      throw error;
    }
  }

  async getOrderStatusHistory(id: number): Promise<
    Array<{
      status: OrderStatus;
      timestamp: Date;
      updatedBy?: number;
      notes?: string;
    }>
  > {
    try {
      // This would require implementing audit log tracking in base service
      // For now, return a basic implementation
      const order = await this.getOrder(id);
      if (!order) return [];

      return [
        {
          status: order.status,
          timestamp: new Date(order.updatedAt),
          notes: order.notes,
        },
      ];
    } catch (error) {
      this.logger.error(
        "Failed to get order status history",
        error instanceof Error ? error : undefined,
        { orderId: id },
      );
      return [];
    }
  }

  // Payment Operations
  async updatePaymentStatus(
    id: number,
    _paymentStatus: OrderPaymentStatus,
    _paymentMethod?: OrderPaymentMethod,
    _transactionData?: PaymentIntegration,
  ): Promise<Order | null> {
    try {
      // This would require extending base service or direct database access
      const order = await this.getOrder(id);
      if (!order) return null;

      // Update payment information
      // Implementation would depend on base service capabilities

      await this.invalidateOrderCache(id);

      return order;
    } catch (error) {
      this.logger.error(
        "Failed to update payment status",
        error instanceof Error ? error : undefined,
        { orderId: id },
      );
      throw error;
    }
  }

  // Analytics and Reporting
  async getOrderAnalytics(
    filters: OrderQueryFilters,
    _userId?: number,
    _caller?: CallerContext,
  ): Promise<OrderAnalytics> {
    try {
      const cacheKey = `analytics:${JSON.stringify(filters)}`;
      const cached = (await this.cacheKV.get(
        cacheKey,
        "json",
      )) as OrderAnalytics | null;
      if (cached) return cached;

      // Get basic stats from base service
      const restaurantId = filters.restaurantId;
      if (!restaurantId) {
        throw badRequest(
          "Restaurant ID required for analytics",
          "RESTAURANT_ID_REQUIRED",
        );
      }

      const dailyStats = await this.baseOrderService.getDailyOrderStats(
        String(restaurantId),
        new Date(),
      );

      // Build comprehensive analytics
      const analytics: OrderAnalytics = {
        summary: {
          totalOrders: dailyStats.totalOrders,
          totalRevenue: dailyStats.totalRevenue,
          averageOrderValue: dailyStats.avgOrderValue,
          averagePreparationTime: 0, // Add when available in base service
          orderCompletionRate: 0.95, // Calculate from actual data
          customerRetentionRate: 0.75, // Calculate from actual data
        },
        byStatus: [],
        byPaymentStatus: [],
        byOrderType: [],
        byTime: {
          hourly: [],
          daily: [],
          weekly: [],
          monthly: [],
        },
        topItems: [],
        customerAnalytics: {
          newCustomers: 0,
          returningCustomers: 0,
          averageOrdersPerCustomer: 0,
          customerLifetimeValue: 0,
        },
        performanceMetrics: {
          averageOrderProcessingTime: 0,
          peakHours: [],
          busyDays: [],
          orderAccuracy: 0.98,
          cancellationRate: 0.05,
        },
      };

      // Cache for 15 minutes
      await this.cacheKV.put(cacheKey, JSON.stringify(analytics), {
        expirationTtl: 900,
      });

      return analytics;
    } catch (error) {
      this.logger.error(
        "Failed to get order analytics",
        error instanceof Error ? error : undefined,
        {},
      );
      throw error;
    }
  }

  async getOrderStatistics(
    restaurantId: string,
    _filters?: OrderQueryFilters,
  ): Promise<OrderStats> {
    return this.getDailyStats(restaurantId, new Date());
  }

  async getActiveOrders(restaurantId: string): Promise<Order[]> {
    const filters: OrderQueryFilters = {
      restaurantId,
      // DB stores status as text — must use string literals matching the schema
      status: ["confirmed", "preparing", "ready"],
      limit: 100,
    };
    const result = await this.getOrders(filters);
    return result.orders;
  }

  async getDailyStats(restaurantId: string, date?: Date): Promise<OrderStats> {
    try {
      const baseStats = await this.baseOrderService.getDailyOrderStats(
        restaurantId,
        date || new Date(),
      );
      return {
        ...baseStats,
        preparingOrders: 0, // Add when available
        readyOrders: 0, // Add when available
        averageOrderValue: baseStats.avgOrderValue,
        averagePreparationTime: 0, // Add when available
      };
    } catch (error) {
      this.logger.error(
        "Failed to get daily stats",
        error instanceof Error ? error : undefined,
        { restaurantId },
      );
      throw error;
    }
  }

  async getPopularItems(
    restaurantId: string,
    timeRange?: string,
  ): Promise<
    Array<{
      menuItemId: number;
      name: string;
      quantity: number;
      revenue: number;
    }>
  > {
    try {
      const cacheKey = `popular-items:${restaurantId}:${timeRange || "month"}`;
      const cached = (await this.cacheKV.get(cacheKey, "json")) as Array<{
        menuItemId: number;
        name: string;
        quantity: number;
        revenue: number;
      }> | null;
      if (cached) return cached;

      // Implementation would require aggregating order items
      const results: Array<{
        menuItemId: number;
        name: string;
        quantity: number;
        revenue: number;
      }> = [];

      await this.cacheKV.put(cacheKey, JSON.stringify(results), {
        expirationTtl: 1800,
      }); // 30 minutes
      return results;
    } catch (error) {
      this.logger.error(
        "Failed to get popular items",
        error instanceof Error ? error : undefined,
        { restaurantId },
      );
      return [];
    }
  }

  // Search and Filter
  async searchOrders(
    searchParams: OrderSearchParams,
    filters?: OrderQueryFilters,
    userId?: number,
  ): Promise<Order[]> {
    try {
      // Combine search with filters
      const combinedFilters = { ...filters };

      if (searchParams.query) {
        // Add search logic to filters
        // Implementation would depend on search fields
      }

      const result = await this.getOrders(combinedFilters, userId);
      return result.orders;
    } catch (error) {
      this.logger.error(
        "Failed to search orders",
        error instanceof Error ? error : undefined,
        { searchParams },
      );
      return [];
    }
  }

  // Bulk Operations
  async bulkUpdateOrders(
    operation: BulkOrderOperation,
    userId?: number,
  ): Promise<BulkOrderResult> {
    try {
      const batchId =
        operation.batchId ||
        `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const result: BulkOrderResult = {
        batchId,
        totalOrders: operation.orderIds.length,
        successCount: 0,
        failedCount: 0,
        errors: [],
        results: [],
      };

      for (const orderId of operation.orderIds) {
        try {
          let success = false;
          let data: Order | null = null;

          switch (operation.action) {
            case "update_status":
              if (operation.data?.status) {
                const updated = await this.updateOrderStatus(
                  orderId,
                  {
                    status: operation.data.status,
                    notes: operation.data.notes,
                  },
                  userId,
                );
                success = !!updated;
                data = updated;
              }
              break;

            case "cancel": {
              const cancelled = await this.cancelOrder(
                orderId,
                operation.data?.reason || "Bulk cancellation",
                userId,
              );
              success = !!cancelled;
              data = cancelled;
              break;
            }

            default:
              throw badRequest(
                `Unsupported bulk operation: ${operation.action}`,
                "UNSUPPORTED_BULK_OPERATION",
              );
          }

          result.results.push({ orderId, success, data });
          if (success) result.successCount++;
        } catch (error) {
          result.failedCount++;
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          result.errors.push({ orderId, error: errorMessage });
          result.results.push({ orderId, success: false, error: errorMessage });
        }
      }

      this.logger.info("Bulk operation completed", { batchId, result });
      return result;
    } catch (error) {
      this.logger.error(
        "Failed to execute bulk operation",
        error instanceof Error ? error : undefined,
        { operation },
      );
      throw error;
    }
  }

  // Coupon and Discount Operations
  async previewCoupon(data: CouponPreviewRequest): Promise<CouponValidation> {
    return this.validateCoupon(data);
  }

  async validateCoupon(data: CouponPreviewRequest): Promise<CouponValidation> {
    try {
      const result = await this.couponService.validateCoupon(
        data.couponCode,
        data.restaurantId.toString(),
        data.orderAmount,
        data.userId,
        data.menuItems,
      );

      return {
        valid: result.valid,
        coupon: result.coupon
          ? {
              code: result.coupon.code,
              name: result.coupon.name,
              discountType: result.coupon.discountType as
                | "percentage"
                | "fixed_amount"
                | "free_item",
              discountValue: result.coupon.discountValue,
            }
          : undefined,
        originalAmount: data.orderAmount,
        discountAmount: result.discountAmount || 0,
        finalAmount: result.finalAmount || data.orderAmount,
        savings: result.discountAmount,
        error: result.error,
      };
    } catch (error) {
      this.logger.error(
        "Failed to validate coupon",
        error instanceof Error ? error : undefined,
        { data },
      );
      return {
        valid: false,
        originalAmount: data.orderAmount,
        discountAmount: 0,
        finalAmount: data.orderAmount,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Receipt and Export
  async generateReceipt(orderId: number): Promise<OrderReceipt> {
    try {
      const order = await this.getOrder(orderId, true);
      if (!order) throw notFound("Order not found", "ORDER_NOT_FOUND");

      // Build receipt data
      const receipt: OrderReceipt = {
        orderNumber: order.orderNumber,
        restaurantInfo: {
          id: Number(order.restaurantId),
          name: order.restaurant?.name || "Restaurant",
          address: order.restaurant?.address,
          phone: order.restaurant?.phone,
          email: order.restaurant?.email,
        },
        customerInfo: order.customerInfo || {},
        tableInfo: order.table
          ? {
              id: order.tableId,
              number: order.table.number || "N/A",
              seats: order.table.seats || 0,
            }
          : undefined,
        items:
          order.items?.map((item) => ({
            name: item.menuItem?.name || "Unknown Item",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            customizations: this.formatCustomizations(item.customizations),
            notes: item.notes,
          })) || [],
        summary: {
          subtotal: order.subtotal,
          tax: order.taxAmount,
          serviceCharge: order.serviceCharge,
          discount: order.discountAmount,
          total: order.totalAmount,
        },
        paymentInfo: {
          method: (order.paymentMethod as OrderPaymentMethod) || "cash",
          status: order.paymentStatus,
          paidAt: order.paidAt ? new Date(order.paidAt) : undefined,
        },
        timestamps: {
          orderedAt: new Date(order.createdAt),
          confirmedAt: order.confirmedAt
            ? new Date(order.confirmedAt)
            : undefined,
          readyAt: order.readyAt ? new Date(order.readyAt) : undefined,
          deliveredAt: order.deliveredAt
            ? new Date(order.deliveredAt)
            : undefined,
        },
      };

      return receipt;
    } catch (error) {
      this.logger.error(
        "Failed to generate receipt",
        error instanceof Error ? error : undefined,
        { orderId },
      );
      throw error;
    }
  }

  async exportOrders(
    filters: OrderQueryFilters,
    format: "csv" | "excel" | "pdf",
  ): Promise<Buffer> {
    try {
      // This would require implementing export logic
      // For now, return empty buffer
      return Buffer.from("");
    } catch (error) {
      this.logger.error(
        "Failed to export orders",
        error instanceof Error ? error : undefined,
        { filters, format },
      );
      throw error;
    }
  }

  // Real-time Updates
  /**
   * 廣播新訂單事件
   */
  private async broadcastNewOrder(order: Order): Promise<void> {
    try {
      const realtimeEvent: NewOrderEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: this.realtimeBroadcastService.generateEventId(),
        timestamp: Date.now(),
        restaurantId: String(order.restaurantId),
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber || `#${order.id}`,
          tableId: order.tableId ? String(order.tableId) : undefined,
          items: (order.items || []).map((item) => ({
            orderItemId: item.id,
            menuItemId: item.menuItemId,
            menuItemName: item.menuItem?.name || "",
            quantity: item.quantity,
            price: item.unitPrice,
            notes: item.notes,
          })),
          totalAmount: order.totalAmount,
          notes: order.notes,
          customer: order.customerInfo
            ? {
                name: order.customerInfo.name,
                phone: order.customerInfo.phone,
              }
            : undefined,
        },
      };

      const result =
        await this.realtimeBroadcastService.broadcastNewOrder(realtimeEvent);

      if (result.success) {
        this.logger.info("New order broadcasted successfully", {
          orderId: order.id,
          eventId: result.eventId,
          recipientCount: result.recipientCount,
        });
      }
    } catch (error) {
      this.logger.error(
        "Failed to broadcast new order",
        error instanceof Error ? error : undefined,
        {
          orderId: order.id,
        },
      );
    }
  }

  /**
   * Broadcast order status update — accepts Order directly to avoid re-fetching.
   */
  private async broadcastOrderStatusUpdate(
    order: Order,
    previousStatus: OrderStatus,
    newStatus: OrderStatus,
    updatedBy: number,
    notes?: string,
    estimatedReadyTime?: Date,
  ): Promise<void> {
    try {
      const realtimeEvent: OrderStatusUpdateEvent = {
        type: RealtimeEventType.ORDER_STATUS_UPDATE,
        eventId: this.realtimeBroadcastService.generateEventId(),
        timestamp: Date.now(),
        restaurantId: String(order.restaurantId),
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber || `#${order.id}`,
          status: newStatus,
          previousStatus: previousStatus,
          estimatedTime: estimatedReadyTime
            ? Math.floor(
                (new Date(estimatedReadyTime).getTime() - Date.now()) / 60000,
              )
            : undefined,
          message: notes,
          updatedBy: updatedBy
            ? { userId: updatedBy, userName: "System", role: "admin" }
            : undefined,
        },
      };

      const result =
        await this.realtimeBroadcastService.broadcastOrderStatusUpdate(
          realtimeEvent,
        );

      if (result.success) {
        this.logger.info("Order update broadcasted successfully", {
          orderId: order.id,
          eventId: result.eventId,
          recipientCount: result.recipientCount,
        });
      } else {
        this.logger.error(
          "Failed to broadcast order update",
          new Error(result.error),
          { orderId: order.id },
        );
      }
    } catch (error) {
      this.logger.error(
        "Failed to broadcast order update",
        error instanceof Error ? error : undefined,
        { orderId: order.id },
      );
    }
  }

  private async broadcastOrderCancelled(
    order: Order,
    reason: string,
    cancelledBy: number,
  ): Promise<void> {
    try {
      const realtimeEvent: OrderCancelledEvent = {
        type: RealtimeEventType.ORDER_CANCELLED,
        eventId: this.realtimeBroadcastService.generateEventId(),
        timestamp: Date.now(),
        restaurantId: String(order.restaurantId),
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber || `#${order.id}`,
          reason,
          cancelledBy: {
            userId: cancelledBy,
            userName: "System",
            role: "admin",
          },
        },
      };

      const result =
        await this.realtimeBroadcastService.broadcastOrderCancelled(
          realtimeEvent,
        );

      if (result.success) {
        this.logger.info("Order cancellation broadcasted successfully", {
          orderId: order.id,
          eventId: result.eventId,
          recipientCount: result.recipientCount,
        });
      } else {
        this.logger.error(
          "Failed to broadcast order cancellation",
          new Error(result.error),
          { orderId: order.id },
        );
      }
    } catch (error) {
      this.logger.error(
        "Failed to broadcast order cancellation",
        error instanceof Error ? error : undefined,
        { orderId: order.id },
      );
    }
  }

  /**
   * Public broadcastOrderUpdate — backward-compatible wrapper that fetches order if needed.
   * Prefer broadcastOrderStatusUpdate() when order data is already available.
   */
  async broadcastOrderUpdate(event: OrderUpdateEvent): Promise<void> {
    const order = await this.getOrder(event.orderId);
    if (!order) {
      this.logger.warn("Order not found for broadcast", {
        orderId: event.orderId,
      });
      return;
    }
    await this.broadcastOrderStatusUpdate(
      order,
      event.previousStatus!,
      event.newStatus,
      event.updatedBy,
      event.notes,
      event.estimatedReadyTime,
    );
  }

  async subscribeToOrderUpdates(
    restaurantId: string,
    roles: UserRole[],
  ): Promise<void> {
    try {
      // Implementation would depend on real-time service
      this.logger.info("Subscribing to order updates", { restaurantId, roles });
    } catch (error) {
      this.logger.error(
        "Failed to subscribe to order updates",
        error instanceof Error ? error : undefined,
        { restaurantId, roles },
      );
    }
  }

  // Private helper methods
  private async cacheOrder(order: Order): Promise<void> {
    const serialized = JSON.stringify(order);
    await Promise.all([
      this.cacheKV.put(`order:${order.id}:full`, serialized, {
        expirationTtl: 300,
      }),
      this.cacheKV.put(`order:${order.id}:basic`, serialized, {
        expirationTtl: 300,
      }),
    ]);
  }

  private async invalidateOrderCache(orderId: number): Promise<void> {
    await Promise.all([
      this.cacheKV.delete(`order:${orderId}:full`),
      this.cacheKV.delete(`order:${orderId}:basic`),
    ]);
  }

  private async logOrderActivity(
    orderId: number,
    action: string,
    userId?: number,
    metadata?: unknown,
  ): Promise<void> {
    // Implementation would log to audit system
    this.logger.info("Order activity logged", {
      orderId,
      action,
      userId,
      metadata,
    });
  }

  /**
   * Defence-in-depth: verify the caller has access to the order's restaurant.
   * Admin (role 0) is always allowed. Non-admin must match restaurantId.
   * When no caller context is provided, trust the route layer (backward compatible).
   */
  private assertRestaurantAccess(
    order: { restaurantId: string },
    caller?: CallerContext,
  ): void {
    if (!caller) return;
    if (caller.userRole === 0) return;
    if (
      caller.userRestaurantId &&
      caller.userRestaurantId !== order.restaurantId
    ) {
      throw forbidden(
        `Access denied: user restaurant ${caller.userRestaurantId} cannot access order from restaurant ${order.restaurantId}`,
        "FORBIDDEN",
      );
    }
  }

  private async applyPermissionFilters(
    filters: OrderQueryFilters,
    userId?: number,
    userRole?: UserRole,
    caller?: CallerContext,
  ): Promise<OrderQueryFilters> {
    const role = caller?.userRole ?? userRole;
    const restaurantId = caller?.userRestaurantId;

    if (role === 0 || role === undefined) {
      // Admin or unknown role — no additional filtering
      return filters;
    }

    if (role === 5) {
      // Customers must only see their own orders.
      return {
        ...filters,
        customerId: userId,
      };
    }

    // Non-admin users MUST be scoped to their restaurant
    if (restaurantId) {
      return { ...filters, restaurantId };
    }

    return filters;
  }

  private convertToBaseFilters(
    filters: OrderQueryFilters,
  ): import("@makanmakan/database").OrderFilters {
    return {
      restaurantId: filters.restaurantId,
      customerId: filters.customerId,
      status: filters.status,
      tableId: filters.tableId,
      dateRange:
        filters.dateFrom && filters.dateTo
          ? [new Date(filters.dateFrom), new Date(filters.dateTo)]
          : undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    };
  }

  private validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
    userRole?: UserRole,
  ): void {
    if (!ORDER_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus)) {
      throw conflict(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        "INVALID_STATUS_TRANSITION",
      );
    }

    if (
      userRole !== undefined &&
      !ROLE_STATUS_PERMISSIONS[userRole]?.includes(newStatus)
    ) {
      throw forbidden(
        `Insufficient permissions for status transition to ${newStatus}`,
        "FORBIDDEN",
      );
    }
  }

  private formatCustomizations(
    customizations: SelectedCustomizations | undefined | null,
  ): string[] {
    if (!customizations) return [];

    const formatted: string[] = [];

    if (customizations.size) {
      formatted.push(`Size: ${customizations.size.name}`);
    }

    if (customizations.options) {
      for (const option of customizations.options) {
        formatted.push(`${option.optionName}: ${option.choiceName}`);
      }
    }

    if (customizations.addOns) {
      for (const addOn of customizations.addOns) {
        formatted.push(`${addOn.name} x${addOn.quantity}`);
      }
    }

    return formatted;
  }
}
