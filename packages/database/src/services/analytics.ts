import { eq, and, desc, asc, gte, lte, count, sum, avg, sql, between } from 'drizzle-orm'
import { BaseService } from './base'
import { orders, orderItems, menuItems, users, tables, restaurants, categories } from '../schema'

export interface DateRange {
  dateFrom?: string
  dateTo?: string
}

export interface AnalyticsFilters extends DateRange {
  restaurantId?: number
  groupBy?: 'day' | 'week' | 'month' | 'year'
  includeComparison?: boolean
  limit?: number
  metric?: 'orders' | 'revenue' | 'avg_order_value' | 'customer_count'
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  year?: string
  month?: string
}

export interface RevenueData {
  date: string
  revenue: number
  orderCount: number
  averageOrderValue: number
  comparison?: {
    previousRevenue: number
    growthRate: number
  }
}

export interface OrderAnalytics {
  totalOrders: number
  completedOrders: number
  cancelledOrders: number
  averageOrderValue: number
  totalRevenue: number
  conversionRate: number
  averagePreparationTime: number
  popularTimeSlots: Array<{ hour: number; orderCount: number }>
}

export interface MenuAnalytics {
  popularItems: Array<{
    itemId: number
    itemName: string
    categoryName: string
    quantity: number
    revenue: number
    growthRate?: number
  }>
  categoryPerformance: Array<{
    categoryId: number
    categoryName: string
    quantity: number
    revenue: number
    itemCount: number
  }>
  lowPerformingItems: Array<{
    itemId: number
    itemName: string
    quantity: number
    lastOrdered?: Date
  }>
}

export interface CustomerAnalytics {
  totalCustomers: number
  newCustomers: number
  returningCustomers: number
  averageOrdersPerCustomer: number
  customerLifetimeValue: number
  topCustomers: Array<{
    customerId: number
    customerName: string
    totalOrders: number
    totalSpent: number
  }>
}

export interface TableAnalytics {
  tableUtilization: Array<{
    tableId: number
    tableNumber: string
    utilizationRate: number
    averageOccupancyTime: number
    totalRevenue: number
  }>
  peakHours: Array<{ hour: number; occupancyRate: number }>
  averageTurnoverTime: number
}

export interface DashboardData {
  summary: {
    todayRevenue: number
    todayOrders: number
    monthRevenue: number
    monthOrders: number
    growthRates: {
      revenueGrowth: number
      orderGrowth: number
    }
  }
  recentOrders: any[]
  topSellingItems: any[]
  tableStatus: {
    occupied: number
    available: number
    total: number
  }
}

export class AnalyticsService extends BaseService {

  // 取得營收分析資料
  async getRevenueAnalytics(filters: AnalyticsFilters): Promise<RevenueData[]> {
    try {
      const { 
        restaurantId, 
        dateFrom, 
        dateTo, 
        groupBy = 'day', 
        includeComparison = false,
        limit = 30 
      } = filters

      // 建構日期條件
      const conditions = []
      if (restaurantId) {
        conditions.push(eq(orders.restaurantId, restaurantId))
      }
      if (dateFrom) {
        conditions.push(gte(orders.createdAt, new Date(dateFrom)))
      }
      if (dateTo) {
        conditions.push(lte(orders.createdAt, new Date(dateTo)))
      }

      // 添加已完成訂單條件
      conditions.push(eq(orders.status, 'completed'))

      // 生成日期分組 SQL
      const dateGroupSql = this.getDateGroupSQL(groupBy)

      // 查詢營收資料
      const revenueData = await this.db
        .select({
          date: sql<string>`${dateGroupSql}`,
          revenue: sum(orders.totalAmount),
          orderCount: count(orders.id),
          averageOrderValue: avg(orders.totalAmount)
        })
        .from(orders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(sql`${dateGroupSql}`)
        .orderBy(sql`${dateGroupSql}`)
        .limit(limit)

      // 如果需要對比資料
      if (includeComparison) {
        return await this.addComparisonData(revenueData, filters)
      }

      return revenueData.map(item => ({
        date: item.date,
        revenue: Number(item.revenue) || 0,
        orderCount: item.orderCount,
        averageOrderValue: Number(item.averageOrderValue) || 0
      }))

    } catch (error) {
      this.handleError(error, 'getRevenueAnalytics')
    }
  }

  // 取得訂單分析
  async getOrderAnalytics(filters: AnalyticsFilters): Promise<OrderAnalytics> {
    try {
      const { restaurantId, dateFrom, dateTo } = filters

      const conditions = []
      if (restaurantId) {
        conditions.push(eq(orders.restaurantId, restaurantId))
      }
      if (dateFrom) {
        conditions.push(gte(orders.createdAt, new Date(dateFrom)))
      }
      if (dateTo) {
        conditions.push(lte(orders.createdAt, new Date(dateTo)))
      }

      // 基本訂單統計
      const [orderStats] = await this.db
        .select({
          totalOrders: count(),
          totalRevenue: sum(orders.totalAmount),
          averageOrderValue: avg(orders.totalAmount)
        })
        .from(orders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)

      // 已完成訂單數
      const [{ completedOrders }] = await this.db
        .select({ completedOrders: count() })
        .from(orders)
        .where(and(...conditions, eq(orders.status, 'completed')))

      // 已取消訂單數
      const [{ cancelledOrders }] = await this.db
        .select({ cancelledOrders: count() })
        .from(orders)
        .where(and(...conditions, eq(orders.status, 'cancelled')))

      // 轉換率
      const conversionRate = orderStats.totalOrders > 0 
        ? (completedOrders / orderStats.totalOrders) * 100 
        : 0

      // 平均準備時間
      const [{ averagePreparationTime }] = await this.db
        .select({
          averagePreparationTime: avg(orders.actualPrepTime)
        })
        .from(orders)
        .where(
          and(
            ...conditions,
            eq(orders.status, 'completed'),
            sql`${orders.actualPrepTime} IS NOT NULL`
          )
        )

      // 熱門時段分析
      const popularTimeSlots = await this.db
        .select({
          hour: sql<number>`CAST(strftime('%H', ${orders.createdAt}) AS INTEGER)`,
          orderCount: count()
        })
        .from(orders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(sql`strftime('%H', ${orders.createdAt})`)
        .orderBy(desc(count()))

      return {
        totalOrders: orderStats.totalOrders,
        completedOrders,
        cancelledOrders,
        averageOrderValue: Number(orderStats.averageOrderValue) || 0,
        totalRevenue: Number(orderStats.totalRevenue) || 0,
        conversionRate: Math.round(conversionRate * 100) / 100,
        averagePreparationTime: Number(averagePreparationTime) || 0,
        popularTimeSlots: popularTimeSlots.map(slot => ({
          hour: slot.hour,
          orderCount: slot.orderCount
        }))
      }

    } catch (error) {
      this.handleError(error, 'getOrderAnalytics')
    }
  }

  // 取得菜單分析
  async getMenuAnalytics(filters: AnalyticsFilters): Promise<MenuAnalytics> {
    try {
      const { restaurantId, dateFrom, dateTo, limit = 10 } = filters

      const conditions = []
      if (restaurantId) {
        conditions.push(eq(orders.restaurantId, restaurantId))
      }
      if (dateFrom) {
        conditions.push(gte(orders.createdAt, new Date(dateFrom)))
      }
      if (dateTo) {
        conditions.push(lte(orders.createdAt, new Date(dateTo)))
      }
      conditions.push(eq(orders.status, 'completed'))

      // 熱門菜品
      const popularItems = await this.db
        .select({
          itemId: orderItems.menuItemId,
          itemName: menuItems.name,
          categoryName: categories.name,
          quantity: sum(orderItems.quantity),
          revenue: sum(orderItems.totalPrice)
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
        .leftJoin(categories, eq(menuItems.categoryId, categories.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(orderItems.menuItemId, menuItems.name, categories.name)
        .orderBy(desc(sum(orderItems.quantity)))
        .limit(limit)

      // 分類表現
      const categoryPerformance = await this.db
        .select({
          categoryId: categories.id,
          categoryName: categories.name,
          quantity: sum(orderItems.quantity),
          revenue: sum(orderItems.totalPrice),
          itemCount: count(sql`DISTINCT ${menuItems.id}`)
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
        .innerJoin(categories, eq(menuItems.categoryId, categories.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(categories.id, categories.name)
        .orderBy(desc(sum(orderItems.totalPrice)))

      // 表現差的菜品（近期很少被點）
      const lowPerformingItems = await this.db
        .select({
          itemId: menuItems.id,
          itemName: menuItems.name,
          quantity: sum(orderItems.quantity),
          lastOrdered: sql<Date>`MAX(${orders.createdAt})`
        })
        .from(menuItems)
        .leftJoin(orderItems, eq(menuItems.id, orderItems.menuItemId))
        .leftJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          restaurantId 
            ? eq(menuItems.restaurantId, restaurantId)
            : undefined
        )
        .groupBy(menuItems.id, menuItems.name)
        .having(sql`COALESCE(SUM(${orderItems.quantity}), 0) < 5`)
        .orderBy(asc(sql`COALESCE(SUM(${orderItems.quantity}), 0)`))
        .limit(limit)

      return {
        popularItems: popularItems.map(item => ({
          itemId: item.itemId,
          itemName: item.itemName,
          categoryName: item.categoryName || 'Uncategorized',
          quantity: Number(item.quantity) || 0,
          revenue: Number(item.revenue) || 0
        })),
        categoryPerformance: categoryPerformance.map(cat => ({
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          quantity: Number(cat.quantity) || 0,
          revenue: Number(cat.revenue) || 0,
          itemCount: cat.itemCount
        })),
        lowPerformingItems: lowPerformingItems.map(item => ({
          itemId: item.itemId,
          itemName: item.itemName,
          quantity: Number(item.quantity) || 0,
          lastOrdered: item.lastOrdered
        }))
      }

    } catch (error) {
      this.handleError(error, 'getMenuAnalytics')
    }
  }

  // 取得顧客分析
  async getCustomerAnalytics(filters: AnalyticsFilters): Promise<CustomerAnalytics> {
    try {
      const { restaurantId, dateFrom, dateTo, limit = 10 } = filters

      const conditions = []
      if (restaurantId) {
        conditions.push(eq(orders.restaurantId, restaurantId))
      }
      if (dateFrom) {
        conditions.push(gte(orders.createdAt, new Date(dateFrom)))
      }
      if (dateTo) {
        conditions.push(lte(orders.createdAt, new Date(dateTo)))
      }

      // 總顧客數（有註冊的）
      const [{ totalCustomers }] = await this.db
        .select({ totalCustomers: count() })
        .from(orders)
        .where(
          and(
            ...conditions,
            sql`${orders.customerId} IS NOT NULL`
          )
        )

      // 新顧客數（第一次下單）
      const newCustomers = await this.db
        .select({
          customerId: orders.customerId,
          firstOrder: sql<Date>`MIN(${orders.createdAt})`
        })
        .from(orders)
        .where(
          and(
            ...conditions,
            sql`${orders.customerId} IS NOT NULL`
          )
        )
        .groupBy(orders.customerId)
        .having(
          dateFrom 
            ? gte(sql<Date>`MIN(${orders.createdAt})`, new Date(dateFrom))
            : undefined
        )

      // 回頭客數
      const returningCustomers = totalCustomers - newCustomers.length

      // 平均每客戶訂單數
      const [{ averageOrdersPerCustomer }] = await this.db
        .select({
          averageOrdersPerCustomer: avg(sql<number>`customer_order_counts.order_count`)
        })
        .from(
          sql`(
            SELECT customer_id, COUNT(*) as order_count 
            FROM orders 
            WHERE customer_id IS NOT NULL 
            GROUP BY customer_id
          ) as customer_order_counts`
        )

      // 顧客終身價值
      const [{ customerLifetimeValue }] = await this.db
        .select({
          customerLifetimeValue: avg(sql<number>`customer_totals.total_spent`)
        })
        .from(
          sql`(
            SELECT customer_id, SUM(total_amount) as total_spent 
            FROM orders 
            WHERE customer_id IS NOT NULL AND status = 'completed'
            GROUP BY customer_id
          ) as customer_totals`
        )

      // 頂級客戶
      const topCustomers = await this.db
        .select({
          customerId: orders.customerId,
          customerName: users.fullName,
          totalOrders: count(),
          totalSpent: sum(orders.totalAmount)
        })
        .from(orders)
        .innerJoin(users, eq(orders.customerId, users.id))
        .where(
          and(
            ...conditions,
            eq(orders.status, 'completed')
          )
        )
        .groupBy(orders.customerId, users.fullName)
        .orderBy(desc(sum(orders.totalAmount)))
        .limit(limit)

      return {
        totalCustomers,
        newCustomers: newCustomers.length,
        returningCustomers,
        averageOrdersPerCustomer: Number(averageOrdersPerCustomer) || 0,
        customerLifetimeValue: Number(customerLifetimeValue) || 0,
        topCustomers: topCustomers.map(customer => ({
          customerId: customer.customerId!,
          customerName: customer.customerName,
          totalOrders: customer.totalOrders,
          totalSpent: Number(customer.totalSpent) || 0
        }))
      }

    } catch (error) {
      this.handleError(error, 'getCustomerAnalytics')
    }
  }

  // 取得桌子分析
  async getTableAnalytics(filters: AnalyticsFilters): Promise<TableAnalytics> {
    try {
      const { restaurantId, dateFrom, dateTo } = filters

      const conditions = []
      if (restaurantId) {
        conditions.push(eq(orders.restaurantId, restaurantId))
      }
      if (dateFrom) {
        conditions.push(gte(orders.createdAt, new Date(dateFrom)))
      }
      if (dateTo) {
        conditions.push(lte(orders.createdAt, new Date(dateTo)))
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
          totalRevenue: sum(orders.totalAmount)
        })
        .from(tables)
        .leftJoin(orders, eq(tables.id, orders.tableId))
        .where(
          restaurantId 
            ? eq(tables.restaurantId, restaurantId)
            : undefined
        )
        .groupBy(tables.id, tables.number, tables.averageOccupancyMinutes, tables.totalUsage)
        .orderBy(desc(sum(orders.totalAmount)))

      // 高峰時段
      const peakHours = await this.db
        .select({
          hour: sql<number>`CAST(strftime('%H', ${orders.createdAt}) AS INTEGER)`,
          occupancyRate: sql<number>`
            ROUND(
              COUNT(DISTINCT ${orders.tableId}) * 100.0 / 
              (SELECT COUNT(*) FROM tables WHERE restaurant_id = ${restaurantId}),
              2
            )
          `
        })
        .from(orders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(sql`strftime('%H', ${orders.createdAt})`)
        .orderBy(sql`CAST(strftime('%H', ${orders.createdAt}) AS INTEGER)`)

      // 平均翻台時間
      const [{ averageTurnoverTime }] = await this.db
        .select({
          averageTurnoverTime: avg(tables.averageOccupancyMinutes)
        })
        .from(tables)
        .where(
          restaurantId 
            ? eq(tables.restaurantId, restaurantId)
            : undefined
        )

      return {
        tableUtilization: tableUtilization.map(table => ({
          tableId: table.tableId,
          tableNumber: table.tableNumber,
          utilizationRate: Number(table.utilizationRate) || 0,
          averageOccupancyTime: table.averageOccupancyTime || 0,
          totalRevenue: Number(table.totalRevenue) || 0
        })),
        peakHours: peakHours.map(hour => ({
          hour: hour.hour,
          occupancyRate: Number(hour.occupancyRate) || 0
        })),
        averageTurnoverTime: Number(averageTurnoverTime) || 0
      }

    } catch (error) {
      this.handleError(error, 'getTableAnalytics')
    }
  }

  // 取得儀表板資料
  async getDashboardData(restaurantId: number): Promise<DashboardData> {
    try {
      const today = new Date()
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)

      // 今日營收和訂單數
      const [todayStats] = await this.db
        .select({
          revenue: sum(orders.totalAmount),
          orderCount: count()
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            gte(orders.createdAt, todayStart),
            eq(orders.status, 'completed')
          )
        )

      // 本月營收和訂單數
      const [monthStats] = await this.db
        .select({
          revenue: sum(orders.totalAmount),
          orderCount: count()
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            gte(orders.createdAt, monthStart),
            eq(orders.status, 'completed')
          )
        )

      // 上月資料（用於計算成長率）
      const [lastMonthStats] = await this.db
        .select({
          revenue: sum(orders.totalAmount),
          orderCount: count()
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            between(orders.createdAt, lastMonthStart, lastMonthEnd),
            eq(orders.status, 'completed')
          )
        )

      // 計算成長率
      const revenueGrowth = this.calculateGrowthRate(
        Number(monthStats.revenue) || 0,
        Number(lastMonthStats.revenue) || 0
      )
      const orderGrowth = this.calculateGrowthRate(
        monthStats.orderCount,
        lastMonthStats.orderCount
      )

      // 最近訂單
      const recentOrders = await this.db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          totalAmount: orders.totalAmount,
          customerInfo: orders.customerInfo,
          tableNumber: tables.number,
          createdAt: orders.createdAt
        })
        .from(orders)
        .leftJoin(tables, eq(orders.tableId, tables.id))
        .where(eq(orders.restaurantId, restaurantId))
        .orderBy(desc(orders.createdAt))
        .limit(10)

      // 熱銷商品
      const topSellingItems = await this.db
        .select({
          itemId: menuItems.id,
          itemName: menuItems.name,
          quantity: sum(orderItems.quantity),
          revenue: sum(orderItems.totalPrice)
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            gte(orders.createdAt, monthStart),
            eq(orders.status, 'completed')
          )
        )
        .groupBy(menuItems.id, menuItems.name)
        .orderBy(desc(sum(orderItems.quantity)))
        .limit(5)

      // 桌子狀態
      const [tableStatus] = await this.db
        .select({
          total: count(),
          occupied: sum(sql<number>`CASE WHEN ${tables.isOccupied} THEN 1 ELSE 0 END`),
          available: sum(sql<number>`CASE WHEN NOT ${tables.isOccupied} AND ${tables.isActive} THEN 1 ELSE 0 END`)
        })
        .from(tables)
        .where(eq(tables.restaurantId, restaurantId))

      return {
        summary: {
          todayRevenue: Number(todayStats.revenue) || 0,
          todayOrders: todayStats.orderCount,
          monthRevenue: Number(monthStats.revenue) || 0,
          monthOrders: monthStats.orderCount,
          growthRates: {
            revenueGrowth,
            orderGrowth
          }
        },
        recentOrders: recentOrders.map(order => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmount: order.totalAmount,
          customerInfo: order.customerInfo,
          tableNumber: order.tableNumber,
          createdAt: order.createdAt
        })),
        topSellingItems: topSellingItems.map(item => ({
          itemId: item.itemId,
          itemName: item.itemName,
          quantity: Number(item.quantity) || 0,
          revenue: Number(item.revenue) || 0
        })),
        tableStatus: {
          occupied: Number(tableStatus.occupied) || 0,
          available: Number(tableStatus.available) || 0,
          total: tableStatus.total
        }
      }

    } catch (error) {
      this.handleError(error, 'getDashboardData')
    }
  }

  // 輔助函數：生成日期分組 SQL
  private getDateGroupSQL(groupBy: string) {
    switch (groupBy) {
      case 'day':
        return sql`DATE(${orders.createdAt})`
      case 'week':
        return sql`strftime('%Y-W%W', ${orders.createdAt})`
      case 'month':
        return sql`strftime('%Y-%m', ${orders.createdAt})`
      case 'year':
        return sql`strftime('%Y', ${orders.createdAt})`
      default:
        return sql`DATE(${orders.createdAt})`
    }
  }

  // 輔助函數：計算成長率
  private calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100 * 100) / 100
  }

  // 輔助函數：添加對比資料
  private async addComparisonData(revenueData: any[], filters: AnalyticsFilters): Promise<RevenueData[]> {
    // 這裡可以實現對比資料的邏輯，比如同期對比
    return revenueData.map(item => ({
      date: item.date,
      revenue: Number(item.revenue) || 0,
      orderCount: item.orderCount,
      averageOrderValue: Number(item.averageOrderValue) || 0,
      comparison: {
        previousRevenue: 0, // 實現具體的對比邏輯
        growthRate: 0
      }
    }))
  }

  // 取得效能分析 (Referenced in API routes)
  async getPerformanceAnalytics(filters: AnalyticsFilters): Promise<{
    orderProcessingTime: number
    kitchenEfficiency: number
    tableUtilization: number
    customerSatisfaction: number
    trends: any[]
  }> {
    try {
      const { restaurantId, dateFrom, dateTo } = filters
      const conditions = []
      if (restaurantId) conditions.push(eq(orders.restaurantId, restaurantId))
      if (dateFrom) conditions.push(gte(orders.createdAt, new Date(dateFrom)))
      if (dateTo) conditions.push(lte(orders.createdAt, new Date(dateTo)))

      const performanceData = await this.getPerformanceReport(restaurantId!, { dateFrom, dateTo })
      
      return {
        ...performanceData,
        trends: [] // TODO: Implement trends calculation
      }
    } catch (error) {
      this.handleError(error, 'getPerformanceAnalytics')
    }
  }

  // 取得實時儀表板資料 (Referenced in API routes)
  async getRealtimeDashboard(restaurantId: number): Promise<{
    activeOrders: number
    kitchenQueue: number
    averageWaitTime: number
    occupiedTables: number
    todayRevenue: number
    alerts: any[]
  }> {
    try {
      const dashboardData = await this.getDashboardData(restaurantId)
      
      // 活躍訂單數
      const [{ activeOrders }] = await this.db
        .select({ activeOrders: count() })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            sql`${orders.status} IN ('confirmed', 'preparing', 'ready')`
          )
        )

      // 廚房隊列
      const [{ kitchenQueue }] = await this.db
        .select({ kitchenQueue: count() })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            eq(orders.status, 'preparing')
          )
        )

      // 平均等待時間 (基於最近完成的訂單)
      const [{ averageWaitTime }] = await this.db
        .select({
          averageWaitTime: avg(
            sql<number>`
              CASE 
                WHEN ${orders.readyAt} IS NOT NULL AND ${orders.createdAt} IS NOT NULL 
                THEN (julianday(${orders.readyAt}) - julianday(${orders.createdAt})) * 24 * 60
                ELSE NULL 
              END
            `
          )
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            eq(orders.status, 'completed'),
            gte(orders.createdAt, sql`datetime('now', '-2 hours')`)
          )
        )

      return {
        activeOrders,
        kitchenQueue,
        averageWaitTime: Number(averageWaitTime) || 0,
        occupiedTables: dashboardData.tableStatus.occupied,
        todayRevenue: dashboardData.summary.todayRevenue,
        alerts: [] // TODO: Implement alerts system
      }
    } catch (error) {
      this.handleError(error, 'getRealtimeDashboard')
    }
  }

  // 取得詳細效能分析 (Referenced in API routes)
  async getDetailedPerformanceAnalytics(filters: AnalyticsFilters): Promise<{
    overview: any
    kitchenMetrics: any
    serviceMetrics: any
    customerMetrics: any
    recommendations: string[]
  }> {
    try {
      const { restaurantId } = filters
      const performanceData = await this.getPerformanceReport(restaurantId!, filters)
      const orderAnalytics = await this.getOrderAnalytics(filters)
      const customerAnalytics = await this.getCustomerAnalytics(filters)
      
      return {
        overview: {
          totalOrders: orderAnalytics.totalOrders,
          completionRate: orderAnalytics.conversionRate,
          averageOrderValue: orderAnalytics.averageOrderValue
        },
        kitchenMetrics: {
          averagePreparationTime: orderAnalytics.averagePreparationTime,
          efficiency: performanceData.kitchenEfficiency
        },
        serviceMetrics: {
          orderProcessingTime: performanceData.orderProcessingTime,
          tableUtilization: performanceData.tableUtilization
        },
        customerMetrics: {
          satisfaction: performanceData.customerSatisfaction,
          totalCustomers: customerAnalytics.totalCustomers
        },
        recommendations: performanceData.recommendations
      }
    } catch (error) {
      this.handleError(error, 'getDetailedPerformanceAnalytics')
    }
  }

  // 取得店主儀表板資料 (Referenced in API routes)
  async getOwnerDashboard(restaurantId: number, filters: AnalyticsFilters): Promise<{
    financialSummary: any
    operationalMetrics: any
    staffPerformance: any
    customerInsights: any
    businessTrends: any[]
  }> {
    try {
      const dashboardData = await this.getDashboardData(restaurantId)
      const revenueData = await this.getRevenueAnalytics({ ...filters, restaurantId })
      const customerAnalytics = await this.getCustomerAnalytics({ ...filters, restaurantId })
      const tableAnalytics = await this.getTableAnalytics({ ...filters, restaurantId })
      
      return {
        financialSummary: {
          monthRevenue: dashboardData.summary.monthRevenue,
          todayRevenue: dashboardData.summary.todayRevenue,
          revenueGrowth: dashboardData.summary.growthRates.revenueGrowth,
          averageOrderValue: revenueData[0]?.averageOrderValue || 0
        },
        operationalMetrics: {
          totalOrders: dashboardData.summary.monthOrders,
          tableUtilization: tableAnalytics.averageTurnoverTime,
          occupiedTables: dashboardData.tableStatus.occupied,
          availableTables: dashboardData.tableStatus.available
        },
        staffPerformance: {
          // TODO: Implement staff performance metrics when staff tracking is added
          averageServiceTime: 0,
          staffEfficiency: 0
        },
        customerInsights: {
          totalCustomers: customerAnalytics.totalCustomers,
          newCustomers: customerAnalytics.newCustomers,
          returningCustomers: customerAnalytics.returningCustomers,
          customerLifetimeValue: customerAnalytics.customerLifetimeValue
        },
        businessTrends: revenueData.slice(0, 30) // Last 30 data points
      }
    } catch (error) {
      this.handleError(error, 'getOwnerDashboard')
    }
  }

  // 取得財務報告 (Referenced in API routes)
  async getFinancialReport(filters: AnalyticsFilters): Promise<{
    summary: any
    revenueBreakdown: any
    expenseAnalysis: any
    profitability: any
    projections: any[]
  }> {
    try {
      const { restaurantId } = filters
      const revenueData = await this.getRevenueAnalytics(filters)
      const orderAnalytics = await this.getOrderAnalytics(filters)
      const menuAnalytics = await this.getMenuAnalytics(filters)
      
      const totalRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0)
      const totalOrders = revenueData.reduce((sum, item) => sum + item.orderCount, 0)
      
      return {
        summary: {
          totalRevenue,
          totalOrders,
          averageOrderValue: totalRevenue / (totalOrders || 1),
          growthRate: 0 // TODO: Calculate period-over-period growth
        },
        revenueBreakdown: {
          byDay: revenueData,
          byCategory: menuAnalytics.categoryPerformance,
          topItems: menuAnalytics.popularItems.slice(0, 10)
        },
        expenseAnalysis: {
          // TODO: Implement expense tracking when expense management is added
          totalExpenses: 0,
          expenseCategories: []
        },
        profitability: {
          grossProfit: totalRevenue, // TODO: Subtract costs when available
          netProfit: totalRevenue, // TODO: Subtract expenses when available
          profitMargin: 0 // TODO: Calculate when costs are available
        },
        projections: [] // TODO: Implement revenue projections based on trends
      }
    } catch (error) {
      this.handleError(error, 'getFinancialReport')
    }
  }

  // 取得效能報告
  async getPerformanceReport(restaurantId: number, dateRange: DateRange): Promise<{
    orderProcessingTime: number
    kitchenEfficiency: number
    tableUtilization: number
    customerSatisfaction: number
    recommendations: string[]
  }> {
    try {
      const { dateFrom, dateTo } = dateRange
      const conditions = [eq(orders.restaurantId, restaurantId)]
      
      if (dateFrom) conditions.push(gte(orders.createdAt, new Date(dateFrom)))
      if (dateTo) conditions.push(lte(orders.createdAt, new Date(dateTo)))

      // 訂單處理時間
      const [{ avgProcessingTime }] = await this.db
        .select({
          avgProcessingTime: avg(
            sql<number>`
              CASE 
                WHEN ${orders.readyAt} IS NOT NULL AND ${orders.createdAt} IS NOT NULL 
                THEN (julianday(${orders.readyAt}) - julianday(${orders.createdAt})) * 24 * 60
                ELSE NULL 
              END
            `
          )
        })
        .from(orders)
        .where(and(...conditions, eq(orders.status, 'completed')))

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
            `
          )
        })
        .from(orders)
        .where(and(...conditions, eq(orders.status, 'completed')))

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
            `
          )
        })
        .from(tables)
        .where(eq(tables.restaurantId, restaurantId))

      // 顧客滿意度（基於評分）
      const [{ customerSatisfaction }] = await this.db
        .select({
          customerSatisfaction: avg(orders.rating)
        })
        .from(orders)
        .where(
          and(
            ...conditions,
            sql`${orders.rating} IS NOT NULL`
          )
        )

      // 生成建議
      const recommendations = []
      if ((Number(avgProcessingTime) || 0) > 30) {
        recommendations.push('Consider optimizing kitchen workflow to reduce order processing time')
      }
      if ((Number(kitchenEfficiency) || 100) < 80) {
        recommendations.push('Review preparation time estimates and kitchen processes')
      }
      if ((Number(tableUtilization) || 0) < 50) {
        recommendations.push('Improve table management to increase utilization rate')
      }
      if ((Number(customerSatisfaction) || 5) < 4) {
        recommendations.push('Focus on improving customer service and food quality')
      }

      return {
        orderProcessingTime: Number(avgProcessingTime) || 0,
        kitchenEfficiency: Number(kitchenEfficiency) || 100,
        tableUtilization: Number(tableUtilization) || 0,
        customerSatisfaction: Number(customerSatisfaction) || 0,
        recommendations
      }

    } catch (error) {
      this.handleError(error, 'getPerformanceReport')
    }
  }
}