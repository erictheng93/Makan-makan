import {
  eq,
  ne,
  and,
  asc,
  desc,
  count,
  sql,
  gte,
  lte,
  inArray,
} from "drizzle-orm";
import { BaseService } from "./base";
import {
  orders,
  orderItems,
  menuItems,
  restaurants,
  tables,
  ORDER_STATUS,
} from "../schema";
import type {
  Order,
  OrderItem,
  SelectedCustomizations,
} from "@makanmakan/shared-types";

export interface CreateOrderData {
  restaurantId: string;
  tableId?: number;
  customerId?: number;
  customerInfo?: { name?: string; phone?: string; email?: string };
  items: Array<{
    menuItemId: number;
    quantity: number;
    customizations?: SelectedCustomizations;
    notes?: string;
  }>;
  notes?: string;
  couponCode?: string;
  clientMutationId?: string;
  orderSource?: "direct" | "uber_eats" | "foodpanda" | "grabfood";
  deliveryInfo?: {
    type: "dine_in" | "takeaway" | "delivery";
    address?: string;
    phone?: string;
    instructions?: string;
    deliveryFee?: number;
  };
}

export interface UpdateOrderStatusData {
  status: string;
  notes?: string;
  expectedVersion?: number;
}

export interface OrderFilters {
  restaurantId?: string;
  tableId?: number;
  customerId?: number;
  status?: string | string[];
  dateRange?: [Date, Date];
  minAmount?: number;
  maxAmount?: number;
  sortBy?: "createdAt" | "totalAmount" | "status" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

const ORDER_SORT_COLUMNS = {
  createdAt: orders.createdAt,
  totalAmount: orders.totalAmount,
  status: orders.status,
  updatedAt: orders.updatedAt,
} as const;

// Drizzle's `timestamp_ms` mode returns `Date` objects. The wire contract for
// orders is Unix-ms integers, so convert before leaving the service boundary —
// otherwise `JSON.stringify` silently turns Dates into ISO strings and
// downstream arithmetic like `Date.now() - createdAt` coerces to NaN.
function toMillis(value: Date | number | null | undefined): number | null {
  if (value == null) return null;
  return value instanceof Date ? value.getTime() : value;
}

export class OrderService extends BaseService {
  // 獲取餐廳最低消費設定
  async getMinimumOrderAmount(
    restaurantId: string,
  ): Promise<{ minOrderAmount: number; enabled: boolean }> {
    try {
      const restaurant = await this.db.query.restaurants.findFirst({
        where: eq(restaurants.id, restaurantId),
        columns: {
          settings: true,
          isAvailable: true,
        },
      });

      if (!restaurant) {
        throw new Error("Restaurant not found");
      }

      const settings = restaurant.settings || {};
      const minOrderAmount = settings.minOrderAmount || 0;

      return {
        minOrderAmount,
        enabled: minOrderAmount > 0 && restaurant.isAvailable,
      };
    } catch (error) {
      this.handleError(error, "getMinimumOrderAmount");
    }
  }

  // 驗證訂單是否符合最低消費要求
  async validateMinimumOrder(
    restaurantId: string,
    orderAmount: number,
  ): Promise<{ valid: boolean; message?: string; shortfall?: number }> {
    try {
      const { minOrderAmount, enabled } =
        await this.getMinimumOrderAmount(restaurantId);

      if (!enabled) {
        return { valid: true };
      }

      if (orderAmount >= minOrderAmount) {
        return { valid: true };
      }

      const shortfall = minOrderAmount - orderAmount;
      return {
        valid: false,
        message: `訂單未達最低消費標準。最低消費：RM${minOrderAmount.toFixed(2)}，目前金額：RM${orderAmount.toFixed(2)}，還需：RM${shortfall.toFixed(2)}`,
        shortfall,
      };
    } catch (error) {
      this.handleError(error, "validateMinimumOrder");
    }
  }

  // 創建訂單
  async createOrder(data: CreateOrderData): Promise<Order> {
    try {
      // 驗證餐廳和桌子
      // Convert restaurantId to string for UUID comparison
      const restaurantIdStr = String(data.restaurantId);
      const restaurant = await this.db.query.restaurants.findFirst({
        where: eq(restaurants.id, restaurantIdStr),
      });

      if (!restaurant || !restaurant.isAvailable) {
        throw new Error("Restaurant is not available");
      }

      // Only validate table for dine-in orders (tableId provided)
      if (data.tableId) {
        const table = await this.db.query.tables.findFirst({
          where: eq(tables.id, data.tableId),
        });

        if (!table || !table.isActive) {
          throw new Error("Table is not available");
        }
      }

      // 計算訂單總金額
      let subtotal = 0;
      const orderItemsData = [];

      // Fetch all menu items in one query to avoid N+1 problem
      const menuItemIds = data.items.map((item) => item.menuItemId);
      const fetchedMenuItems = await this.db.query.menuItems.findMany({
        where: inArray(menuItems.id, menuItemIds),
      });

      // Create a map for quick lookup
      const menuItemMap = new Map(
        fetchedMenuItems.map((item) => [item.id, item]),
      );

      for (const item of data.items) {
        const menuItem = menuItemMap.get(item.menuItemId);

        if (!menuItem || !menuItem.isAvailable) {
          throw new Error(`Menu item ${item.menuItemId} is not available`);
        }

        // 檢查庫存
        if (
          menuItem.inventoryCount !== null &&
          menuItem.inventoryCount < item.quantity
        ) {
          throw new Error(`Insufficient inventory for ${menuItem.name}`);
        }

        // 計算單價（含客製化選項）
        let unitPrice = menuItem.price;

        if (item.customizations?.size?.priceAdjustment) {
          unitPrice += item.customizations.size.priceAdjustment;
        }

        if (item.customizations?.options) {
          for (const option of item.customizations.options) {
            unitPrice += option.priceAdjustment || 0;
          }
        }

        if (item.customizations?.addOns) {
          for (const addOn of item.customizations.addOns) {
            unitPrice += addOn.unitPrice * (addOn.quantity || 1);
          }
        }

        const totalPrice = unitPrice * item.quantity;
        subtotal += totalPrice;

        orderItemsData.push({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
          customizations: item.customizations,
          notes: item.notes,
          itemSnapshot: {
            name: menuItem.name,
            description: menuItem.description || undefined,
            imageUrl: menuItem.imageUrl || undefined,
            category: String(menuItem.categoryId),
            price: menuItem.price,
            unitPrice,
            customizations: item.customizations,
          },
        });
      }

      // 優惠券驗證和折扣計算
      let discountAmount = 0;
      let validatedCoupon = null;
      let couponService: InstanceType<
        typeof import("./coupon").CouponService
      > | null = null;

      if (data.couponCode) {
        const { CouponService } = await import("./coupon");
        couponService = new CouponService(this.d1, this.env);

        const validationResult = await couponService.validateCoupon(
          data.couponCode,
          data.restaurantId.toString(),
          subtotal,
          data.customerId,
          data.items,
        );

        if (validationResult.valid) {
          discountAmount = validationResult.discountAmount || 0;
          validatedCoupon = validationResult.coupon;
        } else {
          throw new Error(`優惠券驗證失敗: ${validationResult.error}`);
        }
      }

      // 驗證最低消費（在折扣後但在計算稅金前）
      const settings = restaurant.settings || {};
      const minOrderAmount = settings.minOrderAmount || 0;
      const orderAmountAfterDiscount = subtotal - discountAmount;

      if (minOrderAmount > 0 && orderAmountAfterDiscount < minOrderAmount) {
        const shortfall = minOrderAmount - orderAmountAfterDiscount;
        throw new Error(
          `訂單未達最低消費標準。最低消費：RM${minOrderAmount.toFixed(2)}，目前金額：RM${orderAmountAfterDiscount.toFixed(2)}，還需：RM${shortfall.toFixed(2)}`,
        );
      }

      // 計算稅金和服務費（考慮折扣）
      const taxRate = settings.taxRate || 0;
      const serviceChargeRate = settings.serviceChargeRate || 0;
      const { taxAmount, serviceCharge, totalAmount } =
        this.calculateOrderTotal(
          subtotal,
          taxRate,
          serviceChargeRate,
          discountAmount,
        );

      // 生成訂單號碼
      const orderNumber = this.generateOrderNumber(data.restaurantId);

      // 創建訂單
      const [order] = await this.db
        .insert(orders)
        .values({
          restaurantId: data.restaurantId,
          tableId: data.tableId,
          customerId: data.customerId,
          orderNumber,
          subtotal,
          taxAmount,
          serviceCharge,
          discountAmount,
          totalAmount,
          customerInfo: data.customerInfo,
          notes: data.notes,
          couponCode: data.couponCode,
          clientMutationId: data.clientMutationId,
          orderSource: data.orderSource || "direct",
          deliveryInfo: data.deliveryInfo,
          estimatedPrepTime: this.calculateEstimatedPrepTime(orderItemsData),
        })
        .returning();

      // 創建訂單項目
      const items = await this.db
        .insert(orderItems)
        .values(
          orderItemsData.map((item) => ({
            ...item,
            orderId: order.id,
          })),
        )
        .returning();

      // 記錄優惠券使用情況
      if (validatedCoupon && discountAmount > 0 && couponService) {
        await couponService.useCoupon({
          couponId: validatedCoupon.id,
          orderId: order.id,
          userId: data.customerId,
          discountAmount,
          originalAmount: subtotal,
          finalAmount: totalAmount,
        });
      }

      // 更新菜品訂購次數和庫存 (batch updates in parallel for better performance)
      const inventoryUpdates = data.items.map(({ menuItemId, quantity }) =>
        this.db
          .update(menuItems)
          .set({
            orderCount: sql`${menuItems.orderCount} + ${quantity}`,
            inventoryCount: menuItems.inventoryCount
              ? sql`${menuItems.inventoryCount} - ${quantity}`
              : null,
          })
          .where(eq(menuItems.id, menuItemId)),
      );

      // Execute all inventory updates and restaurant update in parallel
      await Promise.all([
        ...inventoryUpdates,
        this.db
          .update(restaurants)
          .set({
            totalOrders: sql`${restaurants.totalOrders} + 1`,
          })
          .where(eq(restaurants.id, data.restaurantId)),
      ]);

      // Re-fetch with full relations (menuItem name/image) so callers
      // and downstream caches get complete data. The insert().returning()
      // above only returns columns from the order_items table itself.
      const fullOrder = await this.getOrder(order.id);
      if (fullOrder) return fullOrder;

      // Fallback: should not happen, but safe to degrade gracefully
      return this.mapToOrder({ ...order, items });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Different SQLite / D1 surfaces quote the UNIQUE violation column
      // differently:
      //   - local miniflare:    "UNIQUE constraint failed: orders.restaurant_id, orders.client_mutation_id"
      //   - CI wrangler dev D1: "Failed query: insert into \"orders\" (..., \"client_mutation_id\", ...)"
      // Match on the column name alone so both formats map to the
      // same CLIENT_MUTATION_DUPLICATE path that the route translates
      // to 409.
      if (message.includes("client_mutation_id")) {
        throw new Error("CLIENT_MUTATION_DUPLICATE");
      }

      this.handleError(error, "createOrder");
    }
  }

  // 獲取訂單詳情
  async getOrder(id: number): Promise<Order | null> {
    try {
      const order = await this.db.query.orders.findFirst({
        where: eq(orders.id, id),
        with: {
          restaurant: {
            columns: {
              id: true,
              name: true,
              phone: true,
            },
          },
          table: {
            columns: {
              id: true,
              number: true,
            },
          },
          customer: {
            columns: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
          items: {
            with: {
              menuItem: {
                columns: {
                  id: true,
                  name: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      });

      return order ? this.mapToOrder(order) : null;
    } catch (error) {
      this.handleError(error, "getOrder");
    }
  }

  // 根據訂單號獲取訂單
  async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    try {
      const order = await this.db.query.orders.findFirst({
        where: eq(orders.orderNumber, orderNumber),
        with: {
          restaurant: true,
          table: true,
          customer: true,
          items: {
            with: {
              menuItem: true,
            },
          },
        },
      });

      return order ? this.mapToOrder(order) : null;
    } catch (error) {
      this.handleError(error, "getOrderByNumber");
    }
  }

  // 獲取訂單列表
  async getOrders(
    filters: OrderFilters = {},
    page: number = 1,
    limit: number = 20,
  ) {
    try {
      const { offset } = this.createPagination(page, limit);
      const conditions = [];

      if (filters.restaurantId) {
        conditions.push(eq(orders.restaurantId, filters.restaurantId));
      }

      if (filters.tableId) {
        conditions.push(eq(orders.tableId, filters.tableId));
      }

      if (filters.customerId) {
        conditions.push(eq(orders.customerId, filters.customerId));
      }

      if (filters.status !== undefined && filters.status !== null) {
        if (Array.isArray(filters.status)) {
          // Handle status array with inArray
          conditions.push(inArray(orders.status, filters.status));
        } else {
          // Handle single status with eq
          conditions.push(eq(orders.status, filters.status));
        }
      }

      if (filters.dateRange) {
        const [startDate, endDate] = filters.dateRange;
        conditions.push(
          and(gte(orders.createdAt, startDate), lte(orders.createdAt, endDate)),
        );
      }

      if (filters.minAmount) {
        conditions.push(gte(orders.totalAmount, filters.minAmount));
      }

      if (filters.maxAmount) {
        conditions.push(lte(orders.totalAmount, filters.maxAmount));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const sortDirection = filters.sortOrder === "asc" ? asc : desc;
      const sortColumn =
        ORDER_SORT_COLUMNS[filters.sortBy ?? "createdAt"] ?? orders.createdAt;

      const orderList = await this.db.query.orders.findMany({
        where: whereClause,
        with: {
          restaurant: {
            columns: { id: true, name: true },
          },
          table: {
            columns: { id: true, number: true },
          },
          items: {
            with: {
              menuItem: {
                columns: { id: true, name: true, imageUrl: true },
              },
            },
          },
        },
        orderBy: sortDirection(sortColumn),
        limit,
        offset,
      });

      const countResult = await this.db
        .select({ totalCount: count() })
        .from(orders)
        .where(whereClause);

      const totalCount = countResult?.[0]?.totalCount ?? 0;

      return {
        orders: orderList.map((order) => this.mapToOrder(order)),
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      this.handleError(error, "getOrders");
    }
  }

  // 更新訂單狀態
  async updateOrderStatus(
    id: number,
    data: UpdateOrderStatusData,
  ): Promise<Order> {
    try {
      const statusField = `${data.status}At`;
      const updateData: Record<string, unknown> = {
        status: data.status,
        version: sql`${orders.version} + 1`,
        updatedAt: new Date(),
      };

      // 設置狀態時間戳
      if (
        [
          "confirmed",
          "preparing",
          "ready",
          "delivered",
          "paid",
          "cancelled",
        ].includes(data.status)
      ) {
        updateData[statusField] = new Date();
      }

      // 添加備註
      if (data.notes) {
        updateData.internalNotes = data.notes;
      }

      const [order] = await this.db
        .update(orders)
        .set(updateData)
        .where(
          data.expectedVersion == null
            ? eq(orders.id, id)
            : and(eq(orders.id, id), eq(orders.version, data.expectedVersion)),
        )
        .returning();

      if (!order) {
        if (data.expectedVersion != null) {
          throw new Error("Order version conflict");
        }
        throw new Error("Order not found");
      }

      // 如果訂單完成，釋放桌子（僅限有桌號的訂單）
      if (
        (data.status === ORDER_STATUS.PAID ||
          data.status === ORDER_STATUS.DELIVERED) &&
        order.tableId
      ) {
        await this.db
          .update(tables)
          .set({
            isOccupied: false,
            currentOrderId: null,
            occupiedAt: null,
            occupiedBy: null,
          })
          .where(eq(tables.id, order.tableId));
      }

      return this.mapToOrder(order);
    } catch (error) {
      this.handleError(error, "updateOrderStatus");
    }
  }

  // 取消訂單
  async cancelOrder(id: number, reason?: string): Promise<Order> {
    try {
      const order = await this.getOrder(id);
      if (!order) {
        throw new Error("Order not found");
      }

      if (
        ![ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED].includes(
          order.status as any,
        )
      ) {
        throw new Error("Order cannot be cancelled");
      }

      // 恢復庫存 (batch updates in parallel)
      const inventoryRestores = (order.items || []).map((item) =>
        this.db
          .update(menuItems)
          .set({
            inventoryCount: menuItems.inventoryCount
              ? sql`${menuItems.inventoryCount} + ${item.quantity}`
              : null,
          })
          .where(eq(menuItems.id, item.menuItemId)),
      );

      await Promise.all(inventoryRestores);

      return await this.updateOrderStatus(id, {
        status: ORDER_STATUS.CANCELLED,
        notes: reason,
      });
    } catch (error) {
      this.handleError(error, "cancelOrder");
    }
  }

  // 獲取餐廳當日訂單統計
  async getDailyOrderStats(restaurantId: string, date: Date = new Date()) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const stats = await this.db
        .select({
          totalOrders: count(),
          totalRevenue: sql<number>`SUM(${orders.totalAmount})`,
          avgOrderValue: sql<number>`AVG(${orders.totalAmount})`,
          pendingOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'pending' THEN 1 ELSE 0 END)`,
          confirmedOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'confirmed' THEN 1 ELSE 0 END)`,
          completedOrders: sql<number>`SUM(CASE WHEN ${orders.status} IN ('delivered', 'paid') THEN 1 ELSE 0 END)`,
          cancelledOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'cancelled' THEN 1 ELSE 0 END)`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            gte(orders.createdAt, startOfDay),
            lte(orders.createdAt, endOfDay),
          ),
        );

      return (
        stats[0] || {
          totalOrders: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          pendingOrders: 0,
          confirmedOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
        }
      );
    } catch (error) {
      this.handleError(error, "getDailyOrderStats");
    }
  }

  // 更新訂單項目狀態 — Drizzle-based CAS: matches row only when the
  // current status differs from the target, preventing two chefs from
  // completing the same item in parallel (H2 release gate).
  async updateOrderItemStatus(
    itemId: number,
    status: string,
    notes?: string,
  ): Promise<void> {
    try {
      const now = new Date();
      const updateData: Partial<typeof orderItems.$inferInsert> = {
        status,
        updatedAt: now,
      };
      if (notes) {
        updateData.kitchenNotes = notes;
      }
      if (status === "ready" || status === "completed") {
        updateData.preparedAt = now;
      }
      if (status === "served") {
        updateData.servedAt = now;
      }
      if (status === "cancelled") {
        updateData.cancelledAt = now;
      }

      const updated = await this.db
        .update(orderItems)
        .set(updateData)
        .where(and(eq(orderItems.id, itemId), ne(orderItems.status, status)))
        .returning({ id: orderItems.id });

      if (updated.length === 0) {
        throw new Error("Order item status conflict");
      }
    } catch (error) {
      this.handleError(error, "updateOrderItemStatus");
    }
  }

  // 計算預估準備時間
  private calculateEstimatedPrepTime(orderItems: any[]): number {
    let maxPrepTime = 0;
    let totalComplexity = 0;

    for (const item of orderItems) {
      // 基礎準備時間（預設 15 分鐘）
      const basePrepTime = 15;

      // 根據客製化增加時間
      let itemComplexity = 1;
      if (item.customizations?.options?.length > 0) {
        itemComplexity += item.customizations.options.length * 0.2;
      }
      if (item.customizations?.addOns?.length > 0) {
        itemComplexity += item.customizations.addOns.length * 0.1;
      }

      const itemPrepTime = basePrepTime * itemComplexity * item.quantity;
      maxPrepTime = Math.max(maxPrepTime, itemPrepTime);
      totalComplexity += itemComplexity;
    }

    // 綜合計算：取最長時間和平均複雜度的平衡
    return Math.ceil(Math.max(maxPrepTime, totalComplexity * 10));
  }

  // 資料轉換
  private mapToOrder(order: any): Order {
    const mapOrderItem = (item: any) => {
      const snapshot = item.itemSnapshot;
      const snapshotMenuItem = snapshot
        ? {
            ...(item.menuItem || {}),
            name: snapshot.name,
            description: snapshot.description,
            imageUrl: snapshot.imageUrl,
            price: snapshot.price ?? item.unitPrice,
          }
        : item.menuItem;

      return {
        id: item.id,
        orderId: item.orderId,
        menuItemId: item.menuItemId,
        name: snapshot?.name ?? item.menuItem?.name,
        description: snapshot?.description ?? item.menuItem?.description,
        imageUrl: snapshot?.imageUrl ?? item.menuItem?.imageUrl,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        customizations: item.customizations,
        itemSnapshot: snapshot,
        notes: item.notes,
        status: item.status,
        menuItem: snapshotMenuItem,
        createdAt: toMillis(item.createdAt),
        updatedAt: toMillis(item.updatedAt),
      };
    };

    return {
      id: order.id,
      restaurantId: order.restaurantId,
      tableId: order.tableId,
      customerId: order.customerId,
      orderNumber: order.orderNumber,
      status: order.status,
      version: order.version,
      orderSource: order.orderSource,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      serviceCharge: order.serviceCharge,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      customerInfo: order.customerInfo,
      estimatedPrepTime: order.estimatedPrepTime,
      actualPrepTime: order.actualPrepTime,
      confirmedAt: toMillis(order.confirmedAt),
      preparingAt: toMillis(order.preparingAt),
      readyAt: toMillis(order.readyAt),
      deliveredAt: toMillis(order.deliveredAt),
      paidAt: toMillis(order.paidAt),
      cancelledAt: toMillis(order.cancelledAt),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      rating: order.rating,
      reviewComment: order.reviewComment,
      notes: order.notes,
      internalNotes: order.internalNotes,
      deliveryInfo: order.deliveryInfo,
      items: order.items?.map(mapOrderItem) || [],
      restaurant: order.restaurant,
      table: order.table,
      customer: order.customer,
      createdAt: toMillis(order.createdAt)!,
      updatedAt: toMillis(order.updatedAt)!,
    } as Order;
  }
}
