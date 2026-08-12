import {
  and,
  asc,
  avg,
  between,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  ne,
  sql,
  sum,
  type SQL,
} from "drizzle-orm";
import {
  categories,
  customers,
  menuItems,
  orderItems,
  orders,
  tables,
} from "../schema";
import {
  avgMoneyAmount,
  moneyAmountExpression,
  sumMoneyAmount,
} from "../utils/money-sql";
import { unixMsDiffMinutes } from "../utils/sql-time";
import { BaseService } from "./base";

/**
 * Status values that represent a "successfully completed" order for analytics.
 * The orders.status column never contains the literal string "completed" — older
 * queries used `eq(status, "completed")` and silently matched zero rows. Use this
 * array with `inArray(orders.status, ...)` for revenue / fulfillment analytics.
 */
const FULFILLED_ORDER_STATUSES: readonly string[] = [
  "paid",
  "delivered",
  "served",
];

type RevenueDataRow = {
  date: string;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
};

export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

export interface AnalyticsFilters extends DateRange {
  restaurantId?: string;
  groupBy?: "day" | "week" | "month" | "year";
  includeComparison?: boolean;
  limit?: number;
  metric?: "orders" | "revenue" | "avg_order_value" | "customer_count";
  period?: "daily" | "weekly" | "monthly" | "yearly";
  year?: string;
  month?: string;
}

export interface RevenueData {
  date: string;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
  comparison?: {
    previousRevenue: number;
    growthRate: number;
  };
}

export interface OrderAnalytics {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  totalRevenue: number;
  conversionRate: number;
  averagePreparationTime: number;
  popularTimeSlots: Array<{ hour: number; orderCount: number }>;
}

export interface MenuAnalytics {
  popularItems: Array<{
    itemId: number;
    itemName: string;
    categoryName: string;
    quantity: number;
    revenue: number;
    growthRate?: number;
  }>;
  categoryPerformance: Array<{
    categoryId: number;
    categoryName: string;
    quantity: number;
    revenue: number;
    itemCount: number;
  }>;
  lowPerformingItems: Array<{
    itemId: number;
    itemName: string;
    quantity: number;
    lastOrdered?: Date;
  }>;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  averageOrdersPerCustomer: number;
  customerLifetimeValue: number;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    totalOrders: number;
    totalSpent: number;
  }>;
}

export interface TableAnalytics {
  tableUtilization: Array<{
    tableId: number;
    tableNumber: string;
    utilizationRate: number;
    averageOccupancyTime: number;
    totalRevenue: number;
  }>;
  peakHours: Array<{ hour: number; occupancyRate: number }>;
  averageTurnoverTime: number;
}

export interface DashboardData {
  summary: {
    todayRevenue: number;
    todayOrders: number;
    monthRevenue: number;
    monthOrders: number;
    growthRates: {
      revenueGrowth: number;
      orderGrowth: number;
    };
  };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    customerInfo: (typeof orders.$inferSelect)["customerInfo"];
    tableNumber: string | null;
    createdAt: Date;
  }>;
  topSellingItems: Array<{
    itemId: number;
    itemName: string;
    quantity: number;
    revenue: number;
  }>;
  tableStatus: {
    occupied: number;
    available: number;
    total: number;
  };
}

export class AnalyticsService extends BaseService {
  // 取得營收分析資料
  async getRevenueAnalytics(filters: AnalyticsFilters): Promise<RevenueData[]> {
    try {
      const {
        restaurantId,
        dateFrom,
        dateTo,
        groupBy = "day",
        includeComparison = false,
        limit = 30,
      } = filters;

      // 建構日期條件
      const conditions = [];
      if (restaurantId) {
        conditions.push(eq(orders.restaurantId, restaurantId));
      }
      if (dateFrom) {
        conditions.push(gte(orders.createdAt, new Date(dateFrom)));
      }
      if (dateTo) {
        conditions.push(lte(orders.createdAt, new Date(dateTo)));
      }

      // 排除已取消訂單（計入所有已確認、製作中、已完成的營收）
      conditions.push(sql`${orders.status} != 'cancelled'`);

      // 生成日期分組 SQL
      const dateGroupSql = this.getDateGroupSQL(groupBy);

      // 查詢營收資料
      const revenueData = await this.db
        .select({
          date: sql<string>`${dateGroupSql}`,
          revenue: sumMoneyAmount(orders.totalAmountCents),
          orderCount: count(orders.id),
          averageOrderValue: avgMoneyAmount(orders.totalAmountCents),
        })
        .from(orders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(sql`${dateGroupSql}`)
        .orderBy(sql`${dateGroupSql}`)
        .limit(limit);

      // 如果需要對比資料
      if (includeComparison) {
        return await this.addComparisonData(revenueData, filters);
      }

      return revenueData.map((item) => ({
        date: item.date,
        revenue: Number(item.revenue) || 0,
        orderCount: item.orderCount,
        averageOrderValue: Number(item.averageOrderValue) || 0,
      }));
    } catch (error) {
      this.handleError(error, "getRevenueAnalytics");
    }
  }

  // 取得訂單分析
  async getOrderAnalytics(filters: AnalyticsFilters): Promise<OrderAnalytics> {
    try {
      const { restaurantId, dateFrom, dateTo } = filters;

      const conditions = [];
      if (restaurantId) {
        conditions.push(eq(orders.restaurantId, restaurantId));
      }
      if (dateFrom) {
        conditions.push(gte(orders.createdAt, new Date(dateFrom)));
      }
      if (dateTo) {
        conditions.push(lte(orders.createdAt, new Date(dateTo)));
      }

      // 基本訂單統計
      const [orderStats] = await this.db
        .select({
          totalOrders: count(),
          totalRevenue: sumMoneyAmount(orders.totalAmountCents),
          averageOrderValue: avgMoneyAmount(orders.totalAmountCents),
        })
        .from(orders)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      // 已完成訂單數
      const [{ completedOrders }] = await this.db
        .select({ completedOrders: count() })
        .from(orders)
        .where(
          and(...conditions, inArray(orders.status, FULFILLED_ORDER_STATUSES)),
        );

      // 已取消訂單數
      const [{ cancelledOrders }] = await this.db
        .select({ cancelledOrders: count() })
        .from(orders)
        .where(and(...conditions, eq(orders.status, "cancelled")));

      // 轉換率
      const conversionRate =
        orderStats.totalOrders > 0
          ? (completedOrders / orderStats.totalOrders) * 100
          : 0;

      // 平均準備時間
      const [{ averagePreparationTime }] = await this.db
        .select({
          averagePreparationTime: avg(orders.actualPrepTime),
        })
        .from(orders)
        .where(
          and(
            ...conditions,
            inArray(orders.status, FULFILLED_ORDER_STATUSES),
            sql`${orders.actualPrepTime} IS NOT NULL`,
          ),
        );

      // 熱門時段分析 (createdAt is Unix ms, divide by 1000 for strftime)
      const popularTimeSlots = await this.db
        .select({
          hour: sql<number>`CAST(strftime('%H', ${orders.createdAt} / 1000, 'unixepoch') AS INTEGER)`,
          orderCount: count(),
        })
        .from(orders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(sql`strftime('%H', ${orders.createdAt} / 1000, 'unixepoch')`)
        .orderBy(desc(count()));

      return {
        totalOrders: orderStats.totalOrders,
        completedOrders,
        cancelledOrders,
        averageOrderValue: Number(orderStats.averageOrderValue) || 0,
        totalRevenue: Number(orderStats.totalRevenue) || 0,
        conversionRate: Math.round(conversionRate * 100) / 100,
        averagePreparationTime: Number(averagePreparationTime) || 0,
        popularTimeSlots: popularTimeSlots.map((slot) => ({
          hour: slot.hour,
          orderCount: slot.orderCount,
        })),
      };
    } catch (error) {
      this.handleError(error, "getOrderAnalytics");
    }
  }

  // 取得菜單分析
  async getMenuAnalytics(filters: AnalyticsFilters): Promise<MenuAnalytics> {
    try {
      const { restaurantId, dateFrom, dateTo, limit = 10 } = filters;

      const conditions = [];
      if (restaurantId) {
        conditions.push(eq(orders.restaurantId, restaurantId));
      }
      if (dateFrom) {
        conditions.push(gte(orders.createdAt, new Date(dateFrom)));
      }
      if (dateTo) {
        conditions.push(lte(orders.createdAt, new Date(dateTo)));
      }
      // 排除已取消訂單
      conditions.push(sql`${orders.status} != 'cancelled'`);

      // 熱門菜品
      const popularItems = await this.db
        .select({
          itemId: orderItems.menuItemId,
          itemName: menuItems.name,
          categoryName: categories.name,
          quantity: sum(orderItems.quantity),
          revenue: sumMoneyAmount(orderItems.totalPriceCents),
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
        .leftJoin(categories, eq(menuItems.categoryId, categories.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(orderItems.menuItemId, menuItems.name, categories.name)
        .orderBy(desc(sum(orderItems.quantity)))
        .limit(limit);

      // 分類表現
      const categoryPerformance = await this.db
        .select({
          categoryId: categories.id,
          categoryName: categories.name,
          quantity: sum(orderItems.quantity),
          revenue: sumMoneyAmount(orderItems.totalPriceCents),
          itemCount: count(sql`DISTINCT ${menuItems.id}`),
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
        .innerJoin(categories, eq(menuItems.categoryId, categories.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(categories.id, categories.name)
        .orderBy(desc(sumMoneyAmount(orderItems.totalPriceCents)));

      // 表現差的菜品（近期很少被點）
      const lowPerformingItems = await this.db
        .select({
          itemId: menuItems.id,
          itemName: menuItems.name,
          quantity: sum(orderItems.quantity),
          lastOrdered: sql<Date>`MAX(${orders.createdAt})`,
        })
        .from(menuItems)
        .leftJoin(orderItems, eq(menuItems.id, orderItems.menuItemId))
        .leftJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          restaurantId ? eq(menuItems.restaurantId, restaurantId) : undefined,
        )
        .groupBy(menuItems.id, menuItems.name)
        .having(sql`COALESCE(SUM(${orderItems.quantity}), 0) < 5`)
        .orderBy(asc(sql`COALESCE(SUM(${orderItems.quantity}), 0)`))
        .limit(limit);

      return {
        popularItems: popularItems.map((item) => ({
          itemId: item.itemId,
          itemName: item.itemName,
          categoryName: item.categoryName || "Uncategorized",
          quantity: Number(item.quantity) || 0,
          revenue: Number(item.revenue) || 0,
        })),
        categoryPerformance: categoryPerformance.map((cat) => ({
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          quantity: Number(cat.quantity) || 0,
          revenue: Number(cat.revenue) || 0,
          itemCount: cat.itemCount,
        })),
        lowPerformingItems: lowPerformingItems.map((item) => ({
          itemId: item.itemId,
          itemName: item.itemName,
          quantity: Number(item.quantity) || 0,
          lastOrdered: item.lastOrdered,
        })),
      };
    } catch (error) {
      this.handleError(error, "getMenuAnalytics");
    }
  }

  // 取得顧客分析
  async getCustomerAnalytics(
    filters: AnalyticsFilters,
  ): Promise<CustomerAnalytics> {
    try {
      const { restaurantId, dateFrom, dateTo, limit = 10 } = filters;

      const conditions = [];
      if (restaurantId) {
        conditions.push(eq(orders.restaurantId, restaurantId));
      }
      if (dateFrom) {
        conditions.push(gte(orders.createdAt, new Date(dateFrom)));
      }
      if (dateTo) {
        conditions.push(lte(orders.createdAt, new Date(dateTo)));
      }

      // 總顧客數（有註冊的）
      const [{ totalCustomers }] = await this.db
        .select({ totalCustomers: count() })
        .from(orders)
        .where(and(...conditions, sql`${orders.customerId} IS NOT NULL`));

      // 新顧客數（第一次下單）
      const newCustomers = await this.db
        .select({
          customerId: orders.customerId,
          firstOrder: sql<Date>`MIN(${orders.createdAt})`,
        })
        .from(orders)
        .where(and(...conditions, sql`${orders.customerId} IS NOT NULL`))
        .groupBy(orders.customerId)
        .having(
          dateFrom
            ? gte(sql<Date>`MIN(${orders.createdAt})`, new Date(dateFrom))
            : undefined,
        );

      // 回頭客數
      const returningCustomers = totalCustomers - newCustomers.length;

      // 平均每客戶訂單數
      const [{ averageOrdersPerCustomer }] = await this.db
        .select({
          averageOrdersPerCustomer: avg(
            sql<number>`customer_order_counts.order_count`,
          ),
        })
        .from(
          sql`(
            SELECT customer_id, COUNT(*) as order_count 
            FROM orders 
            WHERE customer_id IS NOT NULL 
            GROUP BY customer_id
          ) as customer_order_counts`,
        );

      // 顧客終身價值
      const [{ customerLifetimeValue }] = await this.db
        .select({
          customerLifetimeValue: avg(sql<number>`customer_totals.total_spent`),
        })
        .from(
          sql`(
            SELECT customer_id, SUM(COALESCE(total_amount_cents, 0)) / 100.0 as total_spent
            FROM orders 
            WHERE customer_id IS NOT NULL AND status IN ('paid', 'delivered', 'served')
            GROUP BY customer_id
          ) as customer_totals`,
        );

      // 頂級客戶
      const topCustomers = await this.db
        .select({
          customerId: orders.customerId,
          customerName: customers.displayName,
          totalOrders: count(),
          totalSpent: sumMoneyAmount(orders.totalAmountCents),
        })
        .from(orders)
        .innerJoin(customers, eq(orders.customerId, customers.id))
        .where(
          and(...conditions, inArray(orders.status, FULFILLED_ORDER_STATUSES)),
        )
        .groupBy(orders.customerId, customers.displayName)
        .orderBy(desc(sumMoneyAmount(orders.totalAmountCents)))
        .limit(limit);

      return {
        totalCustomers,
        newCustomers: newCustomers.length,
        returningCustomers,
        averageOrdersPerCustomer: Number(averageOrdersPerCustomer) || 0,
        customerLifetimeValue: Number(customerLifetimeValue) || 0,
        topCustomers: topCustomers.map((customer) => ({
          customerId: customer.customerId!,
          customerName: customer.customerName,
          totalOrders: customer.totalOrders,
          totalSpent: Number(customer.totalSpent) || 0,
        })),
      };
    } catch (error) {
      this.handleError(error, "getCustomerAnalytics");
    }
  }

  // 取得桌子分析
  async getTableAnalytics(filters: AnalyticsFilters): Promise<TableAnalytics> {
    try {
      const { restaurantId, dateFrom, dateTo } = filters;

      const conditions = [];
      if (restaurantId) {
        conditions.push(eq(orders.restaurantId, restaurantId));
      }
      if (dateFrom) {
        conditions.push(gte(orders.createdAt, new Date(dateFrom)));
      }
      if (dateTo) {
        conditions.push(lte(orders.createdAt, new Date(dateTo)));
      }

      // 桌子使用率
      const tableUtilization = await this.db
        .select({
          tableId: tables.id,
          tableNumber: tables.number,
          utilizationRate: sql<number>`
            CASE 
              WHEN ${tables.totalUsage} > 0 
              THEN ROUND((${tables.totalUsage} * ${tables.averageOccupancyMinutes}) / (24.0 * 60), 2)
              ELSE 0 
            END
          `,
          averageOccupancyTime: tables.averageOccupancyMinutes,
          totalRevenue: sumMoneyAmount(orders.totalAmountCents),
        })
        .from(tables)
        .leftJoin(orders, eq(tables.id, orders.tableId))
        .where(restaurantId ? eq(tables.restaurantId, restaurantId) : undefined)
        .groupBy(
          tables.id,
          tables.number,
          tables.averageOccupancyMinutes,
          tables.totalUsage,
        )
        .orderBy(desc(sumMoneyAmount(orders.totalAmountCents)));

      // 高峰時段 (createdAt is Unix ms, divide by 1000 for strftime)
      const peakHours = await this.db
        .select({
          hour: sql<number>`CAST(strftime('%H', ${orders.createdAt} / 1000, 'unixepoch') AS INTEGER)`,
          occupancyRate: sql<number>`
            ROUND(
              COUNT(DISTINCT ${orders.tableId}) * 100.0 /
              (SELECT COUNT(*) FROM tables WHERE restaurant_id = ${restaurantId}),
              2
            )
          `,
        })
        .from(orders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(sql`strftime('%H', ${orders.createdAt} / 1000, 'unixepoch')`)
        .orderBy(
          sql`CAST(strftime('%H', ${orders.createdAt} / 1000, 'unixepoch') AS INTEGER)`,
        );

      // 平均翻台時間
      const [{ averageTurnoverTime }] = await this.db
        .select({
          averageTurnoverTime: avg(tables.averageOccupancyMinutes),
        })
        .from(tables)
        .where(
          restaurantId ? eq(tables.restaurantId, restaurantId) : undefined,
        );

      return {
        tableUtilization: tableUtilization.map((table) => ({
          tableId: table.tableId,
          tableNumber: table.tableNumber,
          utilizationRate: Number(table.utilizationRate) || 0,
          averageOccupancyTime: table.averageOccupancyTime || 0,
          totalRevenue: Number(table.totalRevenue) || 0,
        })),
        peakHours: peakHours.map((hour) => ({
          hour: hour.hour,
          occupancyRate: Number(hour.occupancyRate) || 0,
        })),
        averageTurnoverTime: Number(averageTurnoverTime) || 0,
      };
    } catch (error) {
      this.handleError(error, "getTableAnalytics");
    }
  }

  // 取得儀表板資料
  async getDashboardData(restaurantId: string): Promise<DashboardData> {
    try {
      // If no restaurantId provided (e.g., system admin), return empty data
      if (!restaurantId) {
        return {
          summary: {
            todayRevenue: 0,
            todayOrders: 0,
            monthRevenue: 0,
            monthOrders: 0,
            growthRates: {
              revenueGrowth: 0,
              orderGrowth: 0,
            },
          },
          recentOrders: [],
          topSellingItems: [],
          tableStatus: {
            occupied: 0,
            available: 0,
            total: 0,
          },
        };
      }

      const today = new Date();
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const lastMonthStart = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1,
      );
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

      // 訂單數計非取消訂單；營收計已結帳訂單 (paid / delivered / served)
      // 先前用 eq(status, "completed") 一直過不了，因為 orders 表實際
      // 狀態是 pending/confirmed/preparing/ready/delivered/served/paid/cancelled，
      // 根本沒有 "completed"，所以 dashboard 永遠顯示 0。

      // 今日營收和訂單數
      const [todayStats] = await this.db
        .select({
          revenue: sumMoneyAmount(orders.totalAmountCents),
          orderCount: count(),
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            gte(orders.createdAt, todayStart),
            ne(orders.status, "cancelled"),
          ),
        );

      const [todayRevenueRow] = await this.db
        .select({
          revenue: sumMoneyAmount(orders.totalAmountCents),
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            gte(orders.createdAt, todayStart),
            inArray(orders.status, FULFILLED_ORDER_STATUSES),
          ),
        );

      // 本月營收和訂單數
      const [monthStats] = await this.db
        .select({
          revenue: sumMoneyAmount(orders.totalAmountCents),
          orderCount: count(),
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            gte(orders.createdAt, monthStart),
            ne(orders.status, "cancelled"),
          ),
        );

      const [monthRevenueRow] = await this.db
        .select({
          revenue: sumMoneyAmount(orders.totalAmountCents),
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            gte(orders.createdAt, monthStart),
            inArray(orders.status, FULFILLED_ORDER_STATUSES),
          ),
        );

      // 上月資料（用於計算成長率）
      const [lastMonthStats] = await this.db
        .select({
          revenue: sumMoneyAmount(orders.totalAmountCents),
          orderCount: count(),
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            between(orders.createdAt, lastMonthStart, lastMonthEnd),
            ne(orders.status, "cancelled"),
          ),
        );

      const [lastMonthRevenueRow] = await this.db
        .select({
          revenue: sumMoneyAmount(orders.totalAmountCents),
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            between(orders.createdAt, lastMonthStart, lastMonthEnd),
            inArray(orders.status, FULFILLED_ORDER_STATUSES),
          ),
        );

      // 計算成長率 — 營收成長率用已結帳的營收，訂單成長率用非取消訂單數
      const revenueGrowth = this.calculateGrowthRate(
        Number(monthRevenueRow?.revenue) || 0,
        Number(lastMonthRevenueRow?.revenue) || 0,
      );
      const orderGrowth = this.calculateGrowthRate(
        monthStats.orderCount,
        lastMonthStats.orderCount,
      );

      // 最近訂單
      const recentOrders = await this.db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          totalAmount: moneyAmountExpression(orders.totalAmountCents),
          customerInfo: orders.customerInfo,
          tableNumber: tables.number,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .leftJoin(tables, eq(orders.tableId, tables.id))
        .where(eq(orders.restaurantId, restaurantId))
        .orderBy(desc(orders.createdAt))
        .limit(10);

      // 熱銷商品 — 計非取消訂單即可（不限定 paid，否則剛出餐的熱賣品都會被排除）
      const topSellingItems = await this.db
        .select({
          itemId: menuItems.id,
          itemName: menuItems.name,
          quantity: sum(orderItems.quantity),
          revenue: sumMoneyAmount(orderItems.totalPriceCents),
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            gte(orders.createdAt, monthStart),
            ne(orders.status, "cancelled"),
          ),
        )
        .groupBy(menuItems.id, menuItems.name)
        .orderBy(desc(sum(orderItems.quantity)))
        .limit(5);

      // 桌子狀態
      const [tableStatus] = await this.db
        .select({
          total: count(),
          occupied: sum(
            sql<number>`CASE WHEN ${tables.isOccupied} THEN 1 ELSE 0 END`,
          ),
          available: sum(
            sql<number>`CASE WHEN NOT ${tables.isOccupied} AND ${tables.isActive} THEN 1 ELSE 0 END`,
          ),
        })
        .from(tables)
        .where(eq(tables.restaurantId, restaurantId));

      return {
        summary: {
          todayRevenue: Number(todayRevenueRow?.revenue) || 0,
          todayOrders: todayStats.orderCount,
          monthRevenue: Number(monthRevenueRow?.revenue) || 0,
          monthOrders: monthStats.orderCount,
          growthRates: {
            revenueGrowth,
            orderGrowth,
          },
        },
        recentOrders: recentOrders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmount: order.totalAmount,
          customerInfo: order.customerInfo,
          tableNumber: order.tableNumber,
          createdAt: order.createdAt,
        })),
        topSellingItems: topSellingItems.map((item) => ({
          itemId: item.itemId,
          itemName: item.itemName,
          quantity: Number(item.quantity) || 0,
          revenue: Number(item.revenue) || 0,
        })),
        tableStatus: {
          occupied: Number(tableStatus.occupied) || 0,
          available: Number(tableStatus.available) || 0,
          total: tableStatus.total,
        },
      };
    } catch (error) {
      this.handleError(error, "getDashboardData");
    }
  }

  // 輔助函數：生成日期分組 SQL
  private getDateGroupSQL(groupBy: string) {
    // orders.createdAt is stored as Unix ms (timestamp_ms mode), so divide by 1000 for SQLite date functions
    switch (groupBy) {
      case "day":
        return sql`DATE(${orders.createdAt} / 1000, 'unixepoch')`;
      case "week":
        return sql`strftime('%Y-W%W', ${orders.createdAt} / 1000, 'unixepoch')`;
      case "month":
        return sql`strftime('%Y-%m', ${orders.createdAt} / 1000, 'unixepoch')`;
      case "year":
        return sql`strftime('%Y', ${orders.createdAt} / 1000, 'unixepoch')`;
      default:
        return sql`DATE(${orders.createdAt} / 1000, 'unixepoch')`;
    }
  }

  // 輔助函數：計算成長率
  private calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100 * 100) / 100;
  }

  // 輔助函數：添加對比資料
  private async addComparisonData(
    revenueData: RevenueDataRow[],
    filters: AnalyticsFilters,
  ): Promise<RevenueData[]> {
    const comparisonByDate = await this.getComparisonRevenueByDate(
      filters,
      revenueData,
    );

    return revenueData.map((item) => ({
      date: item.date,
      revenue: Number(item.revenue) || 0,
      orderCount: item.orderCount,
      averageOrderValue: Number(item.averageOrderValue) || 0,
      comparison: {
        previousRevenue: comparisonByDate.get(item.date) ?? 0,
        growthRate: this.calculateGrowthRate(
          Number(item.revenue) || 0,
          comparisonByDate.get(item.date) ?? 0,
        ),
      },
    }));
  }

  private async getComparisonRevenueByDate(
    filters: AnalyticsFilters,
    revenueData: RevenueDataRow[],
  ): Promise<Map<string, number>> {
    if (revenueData.length === 0) return new Map();

    const {
      restaurantId,
      dateFrom,
      dateTo,
      groupBy = "day",
      limit = 30,
    } = filters;
    const conditions = [];
    if (restaurantId) {
      conditions.push(eq(orders.restaurantId, restaurantId));
    }
    conditions.push(sql`${orders.status} != 'cancelled'`);

    if (dateFrom && dateTo) {
      const dateRange = this.getPreviousDateRange(dateFrom, dateTo);
      if (dateRange) {
        conditions.push(gte(orders.createdAt, dateRange.dateFrom));
        conditions.push(lte(orders.createdAt, dateRange.dateTo));

        const comparisonData = await this.db
          .select({
            date: sql<string>`${this.getShiftedDateGroupSQL(
              groupBy,
              dateRange.spanMs,
            )}`,
            revenue: sumMoneyAmount(orders.totalAmountCents),
          })
          .from(orders)
          .where(and(...conditions))
          .groupBy(
            sql`${this.getShiftedDateGroupSQL(groupBy, dateRange.spanMs)}`,
          )
          .limit(limit);

        return new Map(
          comparisonData.map((item) => [item.date, Number(item.revenue) || 0]),
        );
      }
    }

    const dateGroupSql = this.getDateGroupSQL(groupBy);
    const priorBuckets = revenueData.map((item) =>
      this.getPreviousBucketDate(item.date, groupBy),
    );
    conditions.push(inArray(sql<string>`${dateGroupSql}`, priorBuckets));

    const comparisonData = await this.db
      .select({
        date: sql<string>`${dateGroupSql}`,
        revenue: sumMoneyAmount(orders.totalAmountCents),
      })
      .from(orders)
      .where(and(...conditions))
      .groupBy(sql`${dateGroupSql}`)
      .limit(limit);

    const priorRevenueByDate = new Map(
      comparisonData.map((item) => [item.date, Number(item.revenue) || 0]),
    );

    return new Map(
      revenueData.map((item) => [
        item.date,
        priorRevenueByDate.get(
          this.getPreviousBucketDate(item.date, groupBy),
        ) ?? 0,
      ]),
    );
  }

  private getPreviousDateRange(
    dateFrom: string,
    dateTo: string,
  ): { dateFrom: Date; dateTo: Date; spanMs: number } | undefined {
    const fromMs = new Date(dateFrom).getTime();
    const toMs = new Date(dateTo).getTime();
    const span = toMs - fromMs;
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || span < 0) {
      return undefined;
    }

    return {
      dateFrom: new Date(fromMs - span),
      dateTo: new Date(fromMs),
      spanMs: span,
    };
  }

  private getShiftedDateGroupSQL(
    groupBy: NonNullable<AnalyticsFilters["groupBy"]>,
    shiftMs: number,
  ): SQL {
    const shiftedDateSql = sql`((${orders.createdAt} + ${shiftMs}) / 1000)`;

    switch (groupBy) {
      case "day":
        return sql`DATE(${shiftedDateSql}, 'unixepoch')`;
      case "week":
        return sql`strftime('%Y-W%W', ${shiftedDateSql}, 'unixepoch')`;
      case "month":
        return sql`strftime('%Y-%m', ${shiftedDateSql}, 'unixepoch')`;
      case "year":
        return sql`strftime('%Y', ${shiftedDateSql}, 'unixepoch')`;
    }
  }

  private getPreviousBucketDate(
    value: string,
    groupBy: NonNullable<AnalyticsFilters["groupBy"]>,
  ): string {
    const date = this.parseAnalyticsDate(value);

    switch (groupBy) {
      case "day":
        date.setUTCDate(date.getUTCDate() - 1);
        break;
      case "week":
        date.setUTCDate(date.getUTCDate() - 7);
        break;
      case "month":
        date.setUTCMonth(date.getUTCMonth() - 1);
        break;
      case "year":
        date.setUTCFullYear(date.getUTCFullYear() - 1);
        break;
    }

    return this.formatAnalyticsDate(date, groupBy);
  }

  // 取得效能分析 (Referenced in API routes)
  async getPerformanceAnalytics(filters: AnalyticsFilters): Promise<{
    orderProcessingTime: number;
    kitchenEfficiency: number;
    tableUtilization: number;
    customerSatisfaction: number;
    trends: Array<{
      date: string;
      revenue: number;
      orderCount: number;
      averageOrderValue: number;
    }>;
  }> {
    try {
      const { restaurantId, dateFrom, dateTo } = filters;
      const conditions = [];
      if (restaurantId) conditions.push(eq(orders.restaurantId, restaurantId));
      if (dateFrom) conditions.push(gte(orders.createdAt, new Date(dateFrom)));
      if (dateTo) conditions.push(lte(orders.createdAt, new Date(dateTo)));

      const performanceData = await this.getPerformanceReport(restaurantId!, {
        dateFrom,
        dateTo,
      });
      const revenueData = await this.getRevenueAnalytics({
        ...filters,
        restaurantId,
        groupBy: filters.groupBy ?? "day",
      });

      return {
        ...performanceData,
        trends: revenueData.map((item) => ({
          date: item.date,
          revenue: item.revenue,
          orderCount: item.orderCount,
          averageOrderValue: item.averageOrderValue,
        })),
      };
    } catch (error) {
      this.handleError(error, "getPerformanceAnalytics");
    }
  }

  // 取得實時儀表板資料 (Referenced in API routes)
  async getRealtimeDashboard(restaurantId: string): Promise<{
    activeOrders: number;
    kitchenQueue: number;
    averageWaitTime: number;
    occupiedTables: number;
    todayRevenue: number;
    alerts: Array<{ type: string; severity: string; message: string }>;
  }> {
    try {
      const dashboardData = await this.getDashboardData(restaurantId);

      // 活躍訂單數
      const [{ activeOrders }] = await this.db
        .select({ activeOrders: count() })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            sql`${orders.status} IN ('confirmed', 'preparing', 'ready')`,
          ),
        );

      // 廚房隊列
      const [{ kitchenQueue }] = await this.db
        .select({ kitchenQueue: count() })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            eq(orders.status, "preparing"),
          ),
        );

      // 平均等待時間 (基於最近完成的訂單)
      const [{ averageWaitTime }] = await this.db
        .select({
          averageWaitTime: avg(
            sql<number>`
              CASE 
                WHEN ${orders.readyAt} IS NOT NULL AND ${orders.createdAt} IS NOT NULL 
                THEN ${unixMsDiffMinutes(orders.readyAt, orders.createdAt)}
                ELSE NULL 
              END
            `,
          ),
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            inArray(orders.status, FULFILLED_ORDER_STATUSES),
            gte(orders.createdAt, sql`(unixepoch('now', '-2 hours') * 1000)`),
          ),
        );

      return {
        activeOrders,
        kitchenQueue,
        averageWaitTime: Number(averageWaitTime) || 0,
        occupiedTables: dashboardData.tableStatus.occupied,
        todayRevenue: dashboardData.summary.todayRevenue,
        alerts: [
          ...(Number(averageWaitTime) > 30
            ? [
                {
                  type: "performance",
                  severity: "warning",
                  message: "Average wait time is above 30 minutes",
                },
              ]
            : []),
          ...(kitchenQueue > 10
            ? [
                {
                  type: "operations",
                  severity: "warning",
                  message: "Kitchen queue has more than 10 active orders",
                },
              ]
            : []),
          ...(dashboardData.tableStatus.total > 0 &&
          dashboardData.tableStatus.occupied / dashboardData.tableStatus.total >
            0.9
            ? [
                {
                  type: "capacity",
                  severity: "info",
                  message: "Table occupancy is above 90%",
                },
              ]
            : []),
        ],
      };
    } catch (error) {
      this.handleError(error, "getRealtimeDashboard");
    }
  }

  // 取得詳細效能分析 (Referenced in API routes)
  async getDetailedPerformanceAnalytics(filters: AnalyticsFilters): Promise<{
    overview: {
      totalOrders: number;
      completionRate: number;
      averageOrderValue: number;
    };
    kitchenMetrics: {
      averagePreparationTime: number;
      efficiency: number;
    };
    serviceMetrics: {
      orderProcessingTime: number;
      tableUtilization: number;
    };
    customerMetrics: {
      satisfaction: number;
      totalCustomers: number;
    };
    recommendations: string[];
  }> {
    try {
      const { restaurantId } = filters;
      const performanceData = await this.getPerformanceReport(
        restaurantId!,
        filters,
      );
      const orderAnalytics = await this.getOrderAnalytics(filters);
      const customerAnalytics = await this.getCustomerAnalytics(filters);

      return {
        overview: {
          totalOrders: orderAnalytics.totalOrders,
          completionRate: orderAnalytics.conversionRate,
          averageOrderValue: orderAnalytics.averageOrderValue,
        },
        kitchenMetrics: {
          averagePreparationTime: orderAnalytics.averagePreparationTime,
          efficiency: performanceData.kitchenEfficiency,
        },
        serviceMetrics: {
          orderProcessingTime: performanceData.orderProcessingTime,
          tableUtilization: performanceData.tableUtilization,
        },
        customerMetrics: {
          satisfaction: performanceData.customerSatisfaction,
          totalCustomers: customerAnalytics.totalCustomers,
        },
        recommendations: performanceData.recommendations,
      };
    } catch (error) {
      this.handleError(error, "getDetailedPerformanceAnalytics");
    }
  }

  // 取得店主儀表板資料 (Referenced in API routes)
  async getOwnerDashboard(
    restaurantId: string,
    filters: AnalyticsFilters,
  ): Promise<{
    financialSummary: {
      monthRevenue: number;
      todayRevenue: number;
      revenueGrowth: number;
      averageOrderValue: number;
    };
    operationalMetrics: {
      totalOrders: number;
      tableUtilization: number;
      occupiedTables: number;
      availableTables: number;
    };
    staffPerformance: {
      averageServiceTime: number;
      staffEfficiency: number;
    };
    customerInsights: {
      totalCustomers: number;
      newCustomers: number;
      returningCustomers: number;
      customerLifetimeValue: number;
    };
    businessTrends: RevenueData[];
  }> {
    try {
      const dashboardData = await this.getDashboardData(restaurantId);
      const revenueData = await this.getRevenueAnalytics({
        ...filters,
        restaurantId,
      });
      const customerAnalytics = await this.getCustomerAnalytics({
        ...filters,
        restaurantId,
      });
      const tableAnalytics = await this.getTableAnalytics({
        ...filters,
        restaurantId,
      });

      return {
        financialSummary: {
          monthRevenue: dashboardData.summary.monthRevenue,
          todayRevenue: dashboardData.summary.todayRevenue,
          revenueGrowth: dashboardData.summary.growthRates.revenueGrowth,
          averageOrderValue: revenueData[0]?.averageOrderValue || 0,
        },
        operationalMetrics: {
          totalOrders: dashboardData.summary.monthOrders,
          tableUtilization: tableAnalytics.averageTurnoverTime,
          occupiedTables: dashboardData.tableStatus.occupied,
          availableTables: dashboardData.tableStatus.available,
        },
        staffPerformance: {
          // Staff-level tracking is not present in the current schema.
          averageServiceTime: 0,
          staffEfficiency: 0,
        },
        customerInsights: {
          totalCustomers: customerAnalytics.totalCustomers,
          newCustomers: customerAnalytics.newCustomers,
          returningCustomers: customerAnalytics.returningCustomers,
          customerLifetimeValue: customerAnalytics.customerLifetimeValue,
        },
        businessTrends: revenueData.slice(0, 30), // Last 30 data points
      };
    } catch (error) {
      this.handleError(error, "getOwnerDashboard");
    }
  }

  // 取得財務報告 (Referenced in API routes)
  async getFinancialReport(filters: AnalyticsFilters): Promise<{
    summary: {
      totalRevenue: number;
      totalOrders: number;
      averageOrderValue: number;
      growthRate: number;
    };
    revenueBreakdown: {
      byDay: RevenueData[];
      byCategory: MenuAnalytics["categoryPerformance"];
      topItems: MenuAnalytics["popularItems"];
    };
    expenseAnalysis: {
      totalExpenses: number;
      expenseCategories: unknown[];
    };
    profitability: {
      grossProfit: number;
      netProfit: number;
      profitMargin: number;
    };
    projections: Array<{
      date: string;
      projectedRevenue: number;
      basis: string;
    }>;
  }> {
    try {
      const revenueData = await this.getRevenueAnalytics(filters);
      const menuAnalytics = await this.getMenuAnalytics(filters);

      const totalRevenue = revenueData.reduce(
        (sum, item) => sum + item.revenue,
        0,
      );
      const totalOrders = revenueData.reduce(
        (sum, item) => sum + item.orderCount,
        0,
      );
      const projections = this.buildRevenueProjections(revenueData);

      // Period-over-period growth: build a same-length prior window
      // immediately preceding the current one and compare revenue.
      let growthRate = 0;
      if (filters.dateFrom && filters.dateTo) {
        const fromMs = new Date(filters.dateFrom).getTime();
        const toMs = new Date(filters.dateTo).getTime();
        const span = toMs - fromMs;
        if (span > 0) {
          const priorRevenue = await this.getRevenueAnalytics({
            ...filters,
            dateFrom: new Date(fromMs - span).toISOString(),
            dateTo: new Date(fromMs).toISOString(),
          });
          const priorTotal = priorRevenue.reduce(
            (sum, item) => sum + item.revenue,
            0,
          );
          growthRate =
            priorTotal > 0
              ? ((totalRevenue - priorTotal) / priorTotal) * 100
              : 0;
        }
      }

      return {
        summary: {
          totalRevenue,
          totalOrders,
          averageOrderValue: totalRevenue / (totalOrders || 1),
          growthRate,
        },
        revenueBreakdown: {
          byDay: revenueData,
          byCategory: menuAnalytics.categoryPerformance,
          topItems: menuAnalytics.popularItems.slice(0, 10),
        },
        expenseAnalysis: {
          // Expense data is not modeled yet; keep this section explicit.
          totalExpenses: 0,
          expenseCategories: [],
        },
        profitability: {
          // TODO: Compute once cost/expense tracking is modeled. Leave at 0
          // rather than echoing revenue, which would imply a 100% margin.
          grossProfit: 0,
          netProfit: 0,
          profitMargin: 0,
        },
        projections,
      };
    } catch (error) {
      this.handleError(error, "getFinancialReport");
    }
  }

  private buildRevenueProjections(
    revenueData: RevenueData[],
  ): Array<{ date: string; projectedRevenue: number; basis: string }> {
    if (revenueData.length === 0) return [];

    const ordered = [...revenueData].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const recent = ordered.slice(-7);
    const averageRevenue =
      recent.reduce((sum, item) => sum + item.revenue, 0) / recent.length;
    const lastDate = this.parseAnalyticsDate(ordered[ordered.length - 1].date);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(lastDate);
      date.setDate(date.getDate() + index + 1);

      return {
        date: date.toISOString().slice(0, 10),
        projectedRevenue: Math.round(averageRevenue * 100) / 100,
        basis: `${recent.length}-period moving average`,
      };
    });
  }

  private parseAnalyticsDate(value: string): Date {
    const weekMatch = /^(?<year>\d{4})-W(?<week>\d{2})$/.exec(value);
    if (weekMatch?.groups) {
      return this.parseSqliteWeekDate(
        Number(weekMatch.groups.year),
        Number(weekMatch.groups.week),
      );
    }

    const normalized = /^\d{4}$/.test(value)
      ? `${value}-01-01`
      : /^\d{4}-\d{2}$/.test(value)
        ? `${value}-01`
        : value;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private parseSqliteWeekDate(year: number, week: number): Date {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    if (week === 0) return yearStart;

    const firstMonday = new Date(yearStart);
    const day = firstMonday.getUTCDay();
    firstMonday.setUTCDate(
      firstMonday.getUTCDate() + (day === 1 ? 0 : (8 - day) % 7),
    );
    firstMonday.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);
    return firstMonday;
  }

  private formatAnalyticsDate(
    date: Date,
    groupBy: NonNullable<AnalyticsFilters["groupBy"]>,
  ): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    switch (groupBy) {
      case "day":
        return `${year}-${month}-${day}`;
      case "week": {
        const week = this.getSqliteWeekNumber(date);
        return `${year}-W${String(week).padStart(2, "0")}`;
      }
      case "month":
        return `${year}-${month}`;
      case "year":
        return String(year);
    }
  }

  private getSqliteWeekNumber(date: Date): number {
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const firstMonday = new Date(yearStart);
    const day = firstMonday.getUTCDay();
    firstMonday.setUTCDate(
      firstMonday.getUTCDate() + (day === 1 ? 0 : (8 - day) % 7),
    );

    if (date < firstMonday) return 0;
    return (
      Math.floor(
        (date.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000),
      ) + 1
    );
  }

  // 取得效能報告
  async getPerformanceReport(
    restaurantId: string,
    dateRange: DateRange,
  ): Promise<{
    orderProcessingTime: number;
    kitchenEfficiency: number;
    tableUtilization: number;
    customerSatisfaction: number;
    recommendations: string[];
  }> {
    try {
      const { dateFrom, dateTo } = dateRange;
      const conditions = [eq(orders.restaurantId, restaurantId)];

      if (dateFrom) conditions.push(gte(orders.createdAt, new Date(dateFrom)));
      if (dateTo) conditions.push(lte(orders.createdAt, new Date(dateTo)));

      // 訂單處理時間
      const [{ avgProcessingTime }] = await this.db
        .select({
          avgProcessingTime: avg(
            sql<number>`
              CASE 
                WHEN ${orders.readyAt} IS NOT NULL AND ${orders.createdAt} IS NOT NULL 
                THEN ${unixMsDiffMinutes(orders.readyAt, orders.createdAt)}
                ELSE NULL 
              END
            `,
          ),
        })
        .from(orders)
        .where(
          and(...conditions, inArray(orders.status, FULFILLED_ORDER_STATUSES)),
        );

      // 廚房效率（實際準備時間 vs 預估準備時間）
      const [{ kitchenEfficiency }] = await this.db
        .select({
          kitchenEfficiency: avg(
            sql<number>`
              CASE 
                WHEN ${orders.actualPrepTime} > 0 AND ${orders.estimatedPrepTime} > 0
                THEN (${orders.estimatedPrepTime} * 100.0 / ${orders.actualPrepTime})
                ELSE NULL
              END
            `,
          ),
        })
        .from(orders)
        .where(
          and(...conditions, inArray(orders.status, FULFILLED_ORDER_STATUSES)),
        );

      // 桌子使用率
      const [{ tableUtilization }] = await this.db
        .select({
          tableUtilization: avg(
            sql<number>`
              CASE 
                WHEN ${tables.totalUsage} > 0 
                THEN (${tables.totalUsage} * ${tables.averageOccupancyMinutes}) / (24.0 * 60) * 100
                ELSE 0 
              END
            `,
          ),
        })
        .from(tables)
        .where(eq(tables.restaurantId, restaurantId));

      // 顧客滿意度（基於評分）
      const [{ customerSatisfaction }] = await this.db
        .select({
          customerSatisfaction: avg(orders.rating),
        })
        .from(orders)
        .where(and(...conditions, sql`${orders.rating} IS NOT NULL`));

      // 生成建議
      const recommendations = [];
      if ((Number(avgProcessingTime) || 0) > 30) {
        recommendations.push(
          "Consider optimizing kitchen workflow to reduce order processing time",
        );
      }
      if ((Number(kitchenEfficiency) || 100) < 80) {
        recommendations.push(
          "Review preparation time estimates and kitchen processes",
        );
      }
      if ((Number(tableUtilization) || 0) < 50) {
        recommendations.push(
          "Improve table management to increase utilization rate",
        );
      }
      if ((Number(customerSatisfaction) || 5) < 4) {
        recommendations.push(
          "Focus on improving customer service and food quality",
        );
      }

      return {
        orderProcessingTime: Number(avgProcessingTime) || 0,
        kitchenEfficiency: Number(kitchenEfficiency) || 100,
        tableUtilization: Number(tableUtilization) || 0,
        customerSatisfaction: Number(customerSatisfaction) || 0,
        recommendations,
      };
    } catch (error) {
      this.handleError(error, "getPerformanceReport");
    }
  }
}
