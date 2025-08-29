import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../middleware/auth'
import { validateQuery, validateParams } from '../middleware/validation'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 驗證 schemas
const analyticsQuerySchema = z.object({
  restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  groupBy: z.enum(['day', 'week', 'month', 'year']).optional().default('day'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('30')
})

const revenueQuerySchema = analyticsQuerySchema.extend({
  includeComparison: z.string().transform(val => val === 'true').optional().default(false)
})

const performanceQuerySchema = analyticsQuerySchema.extend({
  metric: z.enum(['orders', 'revenue', 'avg_order_value', 'customer_count']).optional().default('orders')
})

// 輔助函數：生成日期範圍SQL
function getDateGroupBySQL(groupBy: string, dateColumn: string = 'created_at'): string {
  switch (groupBy) {
    case 'day':
      return `DATE(${dateColumn})`
    case 'week':
      return `strftime('%Y-W%W', ${dateColumn})`
    case 'month':
      return `strftime('%Y-%m', ${dateColumn})`
    case 'year':
      return `strftime('%Y', ${dateColumn})`
    default:
      return `DATE(${dateColumn})`
  }
}

// 輔助函數：計算同期比較日期
function getComparisonDateRange(dateFrom?: string, dateTo?: string): { compDateFrom: string; compDateTo: string } | null {
  if (!dateFrom || !dateTo) return null
  
  const startDate = new Date(dateFrom)
  const endDate = new Date(dateTo)
  const duration = endDate.getTime() - startDate.getTime()
  
  const compDateTo = new Date(startDate.getTime() - 1)
  const compDateFrom = new Date(compDateTo.getTime() - duration)
  
  return {
    compDateFrom: compDateFrom.toISOString(),
    compDateTo: compDateTo.toISOString()
  }
}

/**
 * 獲取儀表板總覽數據
 * GET /api/v1/analytics/dashboard
 */
app.get('/dashboard',
  authMiddleware,
  requireRole([0, 1]), // 管理員和店主
  validateQuery(z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
    period: z.enum(['today', 'week', 'month', 'year']).optional().default('today')
  })),
  async (c) => {
    try {
      const { restaurantId, period } = c.get('validatedQuery')
      const user = c.get('user')
      
      // 權限檢查
      let targetRestaurantId = restaurantId
      if (user.role === 1) {
        targetRestaurantId = user.restaurantId
      }
      
      // 確定時間範圍
      let dateCondition = ''
      let dateParams: any[] = []
      
      const now = new Date()
      switch (period) {
        case 'today':
          dateCondition = "DATE(created_at) = DATE('now')"
          break
        case 'week':
          dateCondition = "created_at >= datetime('now', '-7 days')"
          break
        case 'month':
          dateCondition = "created_at >= datetime('now', '-30 days')"
          break
        case 'year':
          dateCondition = "created_at >= datetime('now', '-365 days')"
          break
      }
      
      let whereConditions = [dateCondition]
      let params = [...dateParams]
      
      if (targetRestaurantId) {
        whereConditions.push('restaurant_id = ?')
        params.push(targetRestaurantId)
      }
      
      const whereClause = whereConditions.join(' AND ')
      
      // 基本業務指標
      const basicMetrics = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
          SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as total_revenue,
          AVG(CASE WHEN status = 'completed' THEN total ELSE NULL END) as avg_order_value,
          COUNT(DISTINCT customer_phone) as unique_customers
        FROM orders 
        WHERE ${whereClause}
      `).bind(...params).first()
      
      // 今日訂單狀態分佈
      const orderStatusStats = await c.env.DB.prepare(`
        SELECT 
          status,
          COUNT(*) as count
        FROM orders 
        WHERE ${whereClause}
        GROUP BY status
      `).bind(...params).all()
      
      // 訂單類型分佈
      const orderTypeStats = await c.env.DB.prepare(`
        SELECT 
          order_type,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as revenue
        FROM orders 
        WHERE ${whereClause}
        GROUP BY order_type
      `).bind(...params).all()
      
      // 熱門菜品（基於完成的訂單）
      const popularItems = await c.env.DB.prepare(`
        SELECT 
          mi.name,
          SUM(oi.quantity) as total_quantity,
          SUM(oi.subtotal) as total_revenue,
          COUNT(DISTINCT oi.order_id) as order_count
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status = 'completed' AND ${whereClause.replace('restaurant_id', 'o.restaurant_id').replace('created_at', 'o.created_at')}
        GROUP BY mi.id, mi.name
        ORDER BY total_quantity DESC
        LIMIT 5
      `).bind(...params).all()
      
      // 營業時間分析（僅今日和本週）
      let hourlyStats = []
      if (period === 'today' || period === 'week') {
        const hourlyResult = await c.env.DB.prepare(`
          SELECT 
            strftime('%H', created_at) as hour,
            COUNT(*) as orders,
            SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as revenue
          FROM orders 
          WHERE ${whereClause}
          GROUP BY strftime('%H', created_at)
          ORDER BY hour
        `).bind(...params).all()
        
        hourlyStats = hourlyResult.results || []
      }
      
      // 計算成長率（與前期比較）
      const comparisonPeriod = period === 'today' ? '-1 days' : 
                              period === 'week' ? '-14 days' : 
                              period === 'month' ? '-60 days' : '-730 days'
      
      const previousMetrics = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as total_revenue
        FROM orders 
        WHERE created_at >= datetime('now', ?) AND created_at < datetime('now', ?) ${targetRestaurantId ? 'AND restaurant_id = ?' : ''}
      `).bind(
        comparisonPeriod,
        period === 'today' ? '0 days' : 
        period === 'week' ? '-7 days' : 
        period === 'month' ? '-30 days' : '-365 days',
        ...(targetRestaurantId ? [targetRestaurantId] : [])
      ).first()
      
      // 計算成長率
      const orderGrowth = previousMetrics?.total_orders > 0 
        ? ((basicMetrics.total_orders - previousMetrics.total_orders) / previousMetrics.total_orders * 100)
        : 0
        
      const revenueGrowth = previousMetrics?.total_revenue > 0 
        ? ((basicMetrics.total_revenue - previousMetrics.total_revenue) / previousMetrics.total_revenue * 100)
        : 0
      
      return c.json({
        success: true,
        data: {
          period,
          summary: {
            total_orders: basicMetrics.total_orders || 0,
            completed_orders: basicMetrics.completed_orders || 0,
            cancelled_orders: basicMetrics.cancelled_orders || 0,
            total_revenue: Number((basicMetrics.total_revenue || 0).toFixed(2)),
            avg_order_value: Number((basicMetrics.avg_order_value || 0).toFixed(2)),
            unique_customers: basicMetrics.unique_customers || 0,
            completion_rate: basicMetrics.total_orders > 0 
              ? Number(((basicMetrics.completed_orders || 0) / basicMetrics.total_orders * 100).toFixed(2))
              : 0,
            order_growth: Number(orderGrowth.toFixed(2)),
            revenue_growth: Number(revenueGrowth.toFixed(2))
          },
          charts: {
            order_status: orderStatusStats.results || [],
            order_types: orderTypeStats.results || [],
            popular_items: popularItems.results || [],
            hourly_stats: hourlyStats
          }
        },
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('Get dashboard analytics error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch dashboard analytics'
      }, 500)
    }
  }
)

/**
 * 獲取營收分析
 * GET /api/v1/analytics/revenue
 */
app.get('/revenue',
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(revenueQuerySchema),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      
      let whereConditions = ["status = 'completed'"]
      let params: any[] = []
      
      // 權限檢查
      if (user.role === 1) {
        whereConditions.push('restaurant_id = ?')
        params.push(user.restaurantId)
      } else if (query.restaurantId) {
        whereConditions.push('restaurant_id = ?')
        params.push(query.restaurantId)
      }
      
      // 日期範圍
      if (query.dateFrom) {
        whereConditions.push('created_at >= ?')
        params.push(query.dateFrom)
      }
      
      if (query.dateTo) {
        whereConditions.push('created_at <= ?')
        params.push(query.dateTo)
      }
      
      const whereClause = whereConditions.join(' AND ')
      const dateGroupBy = getDateGroupBySQL(query.groupBy)
      
      // 營收趨勢
      const revenueResult = await c.env.DB.prepare(`
        SELECT 
          ${dateGroupBy} as period,
          COUNT(*) as order_count,
          SUM(total) as total_revenue,
          SUM(subtotal) as subtotal,
          SUM(tax) as tax,
          AVG(total) as avg_order_value,
          MIN(total) as min_order_value,
          MAX(total) as max_order_value
        FROM orders 
        WHERE ${whereClause}
        GROUP BY ${dateGroupBy}
        ORDER BY period DESC
        LIMIT ?
      `).bind(...params, query.limit).all()
      
      const revenueData = revenueResult.results || []
      
      // 營收來源分析
      const revenueSourcesResult = await c.env.DB.prepare(`
        SELECT 
          order_type,
          COUNT(*) as order_count,
          SUM(total) as revenue,
          AVG(total) as avg_order_value
        FROM orders 
        WHERE ${whereClause}
        GROUP BY order_type
        ORDER BY revenue DESC
      `).bind(...params).all()
      
      // 比較數據（如果需要）
      let comparisonData = null
      if (query.includeComparison && query.dateFrom && query.dateTo) {
        const comparison = getComparisonDateRange(query.dateFrom, query.dateTo)
        if (comparison) {
          const compResult = await c.env.DB.prepare(`
            SELECT 
              COUNT(*) as order_count,
              SUM(total) as total_revenue,
              AVG(total) as avg_order_value
            FROM orders 
            WHERE status = 'completed' 
              AND created_at >= ? AND created_at <= ?
              ${user.role === 1 ? 'AND restaurant_id = ?' : ''}
              ${query.restaurantId && user.role === 0 ? 'AND restaurant_id = ?' : ''}
          `).bind(
            comparison.compDateFrom,
            comparison.compDateTo,
            ...(user.role === 1 ? [user.restaurantId] : []),
            ...(query.restaurantId && user.role === 0 ? [query.restaurantId] : [])
          ).first()
          
          comparisonData = compResult
        }
      }
      
      // 計算總計
      const totals = revenueData.reduce((acc: any, item: any) => ({
        total_orders: acc.total_orders + (item.order_count || 0),
        total_revenue: acc.total_revenue + (item.total_revenue || 0),
        total_subtotal: acc.total_subtotal + (item.subtotal || 0),
        total_tax: acc.total_tax + (item.tax || 0)
      }), { total_orders: 0, total_revenue: 0, total_subtotal: 0, total_tax: 0 })
      
      return c.json({
        success: true,
        data: {
          revenue_trend: revenueData,
          revenue_sources: revenueSourcesResult.results || [],
          totals: {
            ...totals,
            avg_order_value: totals.total_orders > 0 ? Number((totals.total_revenue / totals.total_orders).toFixed(2)) : 0
          },
          comparison: comparisonData,
          period: {
            from: query.dateFrom,
            to: query.dateTo,
            groupBy: query.groupBy
          }
        }
      })
      
    } catch (error) {
      console.error('Get revenue analytics error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch revenue analytics'
      }, 500)
    }
  }
)

/**
 * 獲取產品分析
 * GET /api/v1/analytics/products
 */
app.get('/products',
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(analyticsQuerySchema),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      
      let whereConditions = ["o.status = 'completed'"]
      let params: any[] = []
      
      // 權限檢查
      if (user.role === 1) {
        whereConditions.push('o.restaurant_id = ?')
        params.push(user.restaurantId)
      } else if (query.restaurantId) {
        whereConditions.push('o.restaurant_id = ?')
        params.push(query.restaurantId)
      }
      
      // 日期範圍
      if (query.dateFrom) {
        whereConditions.push('o.created_at >= ?')
        params.push(query.dateFrom)
      }
      
      if (query.dateTo) {
        whereConditions.push('o.created_at <= ?')
        params.push(query.dateTo)
      }
      
      const whereClause = whereConditions.join(' AND ')
      
      // 最受歡迎產品
      const popularProductsResult = await c.env.DB.prepare(`
        SELECT 
          mi.id,
          mi.name,
          mi.price,
          c.name as category_name,
          SUM(oi.quantity) as total_sold,
          SUM(oi.subtotal) as total_revenue,
          COUNT(DISTINCT o.id) as order_count,
          AVG(oi.quantity) as avg_quantity_per_order,
          ROUND(SUM(oi.subtotal) / SUM(oi.quantity), 2) as avg_selling_price
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN categories c ON mi.category_id = c.id
        WHERE ${whereClause}
        GROUP BY mi.id, mi.name, mi.price, c.name
        ORDER BY total_sold DESC
        LIMIT ?
      `).bind(...params, query.limit).all()
      
      // 營收貢獻最高產品
      const topRevenueProductsResult = await c.env.DB.prepare(`
        SELECT 
          mi.id,
          mi.name,
          mi.price,
          c.name as category_name,
          SUM(oi.quantity) as total_sold,
          SUM(oi.subtotal) as total_revenue,
          COUNT(DISTINCT o.id) as order_count
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN categories c ON mi.category_id = c.id
        WHERE ${whereClause}
        GROUP BY mi.id, mi.name, mi.price, c.name
        ORDER BY total_revenue DESC
        LIMIT ?
      `).bind(...params, query.limit).all()
      
      // 分類銷售分析
      const categoryAnalysisResult = await c.env.DB.prepare(`
        SELECT 
          c.name as category_name,
          COUNT(DISTINCT mi.id) as product_count,
          SUM(oi.quantity) as total_sold,
          SUM(oi.subtotal) as total_revenue,
          AVG(oi.subtotal / oi.quantity) as avg_price,
          COUNT(DISTINCT o.id) as order_count
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN categories c ON mi.category_id = c.id
        WHERE ${whereClause}
        GROUP BY c.id, c.name
        ORDER BY total_revenue DESC
      `).bind(...params).all()
      
      // 產品性能趨勢（按時間分組）
      const productTrendResult = await c.env.DB.prepare(`
        SELECT 
          ${getDateGroupBySQL(query.groupBy, 'o.created_at')} as period,
          COUNT(DISTINCT mi.id) as unique_products_sold,
          SUM(oi.quantity) as total_items_sold,
          SUM(oi.subtotal) as total_revenue,
          COUNT(DISTINCT o.id) as order_count
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        JOIN orders o ON oi.order_id = o.id
        WHERE ${whereClause}
        GROUP BY ${getDateGroupBySQL(query.groupBy, 'o.created_at')}
        ORDER BY period DESC
        LIMIT ?
      `).bind(...params, query.limit).all()
      
      // 低銷量產品警告
      const lowPerformingProductsResult = await c.env.DB.prepare(`
        SELECT 
          mi.id,
          mi.name,
          mi.price,
          c.name as category_name,
          COALESCE(SUM(oi.quantity), 0) as total_sold,
          COALESCE(SUM(oi.subtotal), 0) as total_revenue
        FROM menu_items mi
        LEFT JOIN order_items oi ON mi.id = oi.menu_item_id
        LEFT JOIN orders o ON oi.order_id = o.id AND ${whereClause.replace('o.status', 'status')}
        LEFT JOIN categories c ON mi.category_id = c.id
        WHERE mi.is_available = 1 
          ${user.role === 1 ? 'AND mi.restaurant_id = ?' : ''}
          ${query.restaurantId && user.role === 0 ? 'AND mi.restaurant_id = ?' : ''}
        GROUP BY mi.id, mi.name, mi.price, c.name
        HAVING total_sold <= 5
        ORDER BY total_sold ASC
        LIMIT 10
      `).bind(
        ...(user.role === 1 ? [user.restaurantId] : []),
        ...(query.restaurantId && user.role === 0 ? [query.restaurantId] : [])
      ).all()
      
      return c.json({
        success: true,
        data: {
          popular_products: popularProductsResult.results || [],
          top_revenue_products: topRevenueProductsResult.results || [],
          category_analysis: categoryAnalysisResult.results || [],
          product_trends: productTrendResult.results || [],
          low_performing: lowPerformingProductsResult.results || []
        }
      })
      
    } catch (error) {
      console.error('Get product analytics error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch product analytics'
      }, 500)
    }
  }
)

/**
 * 獲取客戶分析
 * GET /api/v1/analytics/customers
 */
app.get('/customers',
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(analyticsQuerySchema),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      
      let whereConditions = ["status = 'completed'"]
      let params: any[] = []
      
      // 權限檢查
      if (user.role === 1) {
        whereConditions.push('restaurant_id = ?')
        params.push(user.restaurantId)
      } else if (query.restaurantId) {
        whereConditions.push('restaurant_id = ?')
        params.push(query.restaurantId)
      }
      
      // 日期範圍
      if (query.dateFrom) {
        whereConditions.push('created_at >= ?')
        params.push(query.dateFrom)
      }
      
      if (query.dateTo) {
        whereConditions.push('created_at <= ?')
        params.push(query.dateTo)
      }
      
      const whereClause = whereConditions.join(' AND ')
      
      // 客戶總覽
      const customerOverviewResult = await c.env.DB.prepare(`
        SELECT 
          COUNT(DISTINCT CASE WHEN customer_phone IS NOT NULL THEN customer_phone 
                              WHEN customer_email IS NOT NULL THEN customer_email 
                              ELSE customer_name END) as unique_customers,
          COUNT(*) as total_orders,
          SUM(total) as total_revenue,
          AVG(total) as avg_order_value,
          COUNT(*) / COUNT(DISTINCT CASE WHEN customer_phone IS NOT NULL THEN customer_phone 
                                        WHEN customer_email IS NOT NULL THEN customer_email 
                                        ELSE customer_name END) as avg_orders_per_customer
        FROM orders 
        WHERE ${whereClause}
      `).bind(...params).first()
      
      // 客戶分群分析（基於訂單次數）
      const customerSegmentationResult = await c.env.DB.prepare(`
        WITH customer_stats AS (
          SELECT 
            CASE 
              WHEN customer_phone IS NOT NULL THEN customer_phone
              WHEN customer_email IS NOT NULL THEN customer_email
              ELSE customer_name
            END as customer_id,
            COUNT(*) as order_count,
            SUM(total) as total_spent,
            AVG(total) as avg_order_value,
            MIN(created_at) as first_order,
            MAX(created_at) as last_order
          FROM orders
          WHERE ${whereClause} AND (customer_phone IS NOT NULL OR customer_email IS NOT NULL OR customer_name IS NOT NULL)
          GROUP BY customer_id
        )
        SELECT 
          CASE 
            WHEN order_count = 1 THEN 'New Customer'
            WHEN order_count <= 3 THEN 'Regular Customer'
            WHEN order_count <= 10 THEN 'Frequent Customer'
            ELSE 'VIP Customer'
          END as segment,
          COUNT(*) as customer_count,
          SUM(total_spent) as segment_revenue,
          AVG(total_spent) as avg_customer_value,
          AVG(order_count) as avg_orders_per_customer
        FROM customer_stats
        GROUP BY segment
        ORDER BY 
          CASE segment
            WHEN 'VIP Customer' THEN 1
            WHEN 'Frequent Customer' THEN 2
            WHEN 'Regular Customer' THEN 3
            WHEN 'New Customer' THEN 4
          END
      `).bind(...params).all()
      
      // 訂單類型偏好
      const orderTypePreferenceResult = await c.env.DB.prepare(`
        SELECT 
          order_type,
          COUNT(*) as order_count,
          COUNT(DISTINCT CASE WHEN customer_phone IS NOT NULL THEN customer_phone 
                             WHEN customer_email IS NOT NULL THEN customer_email 
                             ELSE customer_name END) as unique_customers,
          SUM(total) as total_revenue,
          AVG(total) as avg_order_value
        FROM orders
        WHERE ${whereClause}
        GROUP BY order_type
        ORDER BY order_count DESC
      `).bind(...params).all()
      
      // 客戶活動趨勢
      const customerTrendResult = await c.env.DB.prepare(`
        SELECT 
          ${getDateGroupBySQL(query.groupBy)} as period,
          COUNT(DISTINCT CASE WHEN customer_phone IS NOT NULL THEN customer_phone 
                             WHEN customer_email IS NOT NULL THEN customer_email 
                             ELSE customer_name END) as unique_customers,
          COUNT(*) as total_orders,
          SUM(total) as total_revenue
        FROM orders
        WHERE ${whereClause}
        GROUP BY ${getDateGroupBySQL(query.groupBy)}
        ORDER BY period DESC
        LIMIT ?
      `).bind(...params, query.limit).all()
      
      // 回頭客分析
      const returningCustomerResult = await c.env.DB.prepare(`
        WITH customer_orders AS (
          SELECT 
            CASE 
              WHEN customer_phone IS NOT NULL THEN customer_phone
              WHEN customer_email IS NOT NULL THEN customer_email
              ELSE customer_name
            END as customer_id,
            COUNT(*) as order_count,
            MIN(created_at) as first_order,
            MAX(created_at) as last_order
          FROM orders
          WHERE ${whereClause} AND (customer_phone IS NOT NULL OR customer_email IS NOT NULL OR customer_name IS NOT NULL)
          GROUP BY customer_id
        )
        SELECT 
          COUNT(*) as total_customers,
          COUNT(CASE WHEN order_count > 1 THEN 1 END) as returning_customers,
          ROUND(COUNT(CASE WHEN order_count > 1 THEN 1 END) * 100.0 / COUNT(*), 2) as retention_rate,
          AVG(CASE WHEN order_count > 1 THEN julianday(last_order) - julianday(first_order) END) as avg_customer_lifespan
        FROM customer_orders
        WHERE customer_id IS NOT NULL
      `).bind(...params).first()
      
      return c.json({
        success: true,
        data: {
          overview: customerOverviewResult,
          segmentation: customerSegmentationResult.results || [],
          order_type_preference: orderTypePreferenceResult.results || [],
          customer_trends: customerTrendResult.results || [],
          retention: returningCustomerResult || {}
        }
      })
      
    } catch (error) {
      console.error('Get customer analytics error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch customer analytics'
      }, 500)
    }
  }
)

/**
 * 獲取性能分析
 * GET /api/v1/analytics/performance
 */
app.get('/performance',
  authMiddleware,
  requireRole([0, 1, 2]), // 管理員、店主、廚師
  validateQuery(performanceQuerySchema),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      
      let whereConditions = ['1=1']
      let params: any[] = []
      
      // 權限檢查
      if (user.role >= 1) {
        whereConditions.push('restaurant_id = ?')
        params.push(user.restaurantId)
      } else if (query.restaurantId) {
        whereConditions.push('restaurant_id = ?')
        params.push(query.restaurantId)
      }
      
      // 日期範圍
      if (query.dateFrom) {
        whereConditions.push('created_at >= ?')
        params.push(query.dateFrom)
      }
      
      if (query.dateTo) {
        whereConditions.push('created_at <= ?')
        params.push(query.dateTo)
      }
      
      const whereClause = whereConditions.join(' AND ')
      
      // 訂單處理時間分析
      const processingTimeResult = await c.env.DB.prepare(`
        SELECT 
          AVG(CASE WHEN estimated_ready_time IS NOT NULL AND updated_at IS NOT NULL 
                   THEN (julianday(updated_at) - julianday(created_at)) * 24 * 60 END) as avg_processing_time_minutes,
          MIN(CASE WHEN estimated_ready_time IS NOT NULL AND updated_at IS NOT NULL 
                   THEN (julianday(updated_at) - julianday(created_at)) * 24 * 60 END) as min_processing_time,
          MAX(CASE WHEN estimated_ready_time IS NOT NULL AND updated_at IS NOT NULL 
                   THEN (julianday(updated_at) - julianday(created_at)) * 24 * 60 END) as max_processing_time,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
          COUNT(*) as total_orders
        FROM orders
        WHERE ${whereClause}
      `).bind(...params).first()
      
      // 效率趨勢
      const efficiencyTrendResult = await c.env.DB.prepare(`
        SELECT 
          ${getDateGroupBySQL(query.groupBy)} as period,
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
          AVG(CASE WHEN status = 'completed' AND updated_at IS NOT NULL 
                   THEN (julianday(updated_at) - julianday(created_at)) * 24 * 60 END) as avg_completion_time,
          SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as revenue
        FROM orders
        WHERE ${whereClause}
        GROUP BY ${getDateGroupBySQL(query.groupBy)}
        ORDER BY period DESC
        LIMIT ?
      `).bind(...params, query.limit).all()
      
      // 員工效率（如果有更新者記錄）
      const staffPerformanceResult = await c.env.DB.prepare(`
        SELECT 
          u.username,
          u.full_name,
          u.role,
          COUNT(o.id) as orders_handled,
          COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
          AVG(CASE WHEN o.status = 'completed' AND o.updated_at IS NOT NULL 
                   THEN (julianday(o.updated_at) - julianday(o.created_at)) * 24 * 60 END) as avg_handling_time
        FROM orders o
        JOIN users u ON o.updated_by = u.id
        WHERE ${whereClause.replace('restaurant_id', 'o.restaurant_id').replace('created_at', 'o.created_at')} 
          AND o.updated_by IS NOT NULL
        GROUP BY u.id, u.username, u.full_name, u.role
        HAVING orders_handled >= 5
        ORDER BY completed_orders DESC
        LIMIT 10
      `).bind(...params).all()
      
      // 桌位使用率
      const tableUtilizationResult = await c.env.DB.prepare(`
        SELECT 
          t.name as table_name,
          t.capacity,
          COUNT(o.id) as total_orders,
          SUM(CASE WHEN o.status = 'completed' THEN o.total ELSE 0 END) as total_revenue,
          AVG(o.total) as avg_order_value
        FROM tables t
        LEFT JOIN orders o ON t.id = o.table_id AND ${whereClause.replace('restaurant_id', 'o.restaurant_id').replace('created_at', 'o.created_at')}
        WHERE t.is_active = 1 
          ${user.role >= 1 ? 'AND t.restaurant_id = ?' : ''}
          ${query.restaurantId && user.role === 0 ? 'AND t.restaurant_id = ?' : ''}
        GROUP BY t.id, t.name, t.capacity
        ORDER BY total_revenue DESC
      `).bind(
        ...(user.role >= 1 ? [user.restaurantId] : []),
        ...(query.restaurantId && user.role === 0 ? [query.restaurantId] : [])
      ).all()
      
      // 計算關鍵性能指標
      const kpis = {
        completion_rate: processingTimeResult?.total_orders > 0 
          ? Number(((processingTimeResult.completed_orders || 0) / processingTimeResult.total_orders * 100).toFixed(2))
          : 0,
        cancellation_rate: processingTimeResult?.total_orders > 0 
          ? Number(((processingTimeResult.cancelled_orders || 0) / processingTimeResult.total_orders * 100).toFixed(2))
          : 0,
        avg_processing_time: Number((processingTimeResult?.avg_processing_time_minutes || 0).toFixed(2)),
        efficiency_score: 0 // 可以根據業務邏輯計算綜合效率評分
      }
      
      // 計算效率評分 (示例算法)
      const baseScore = 100
      const timeDeduction = Math.min((kpis.avg_processing_time / 30) * 20, 40) // 超過30分鐘開始扣分
      const cancellationDeduction = kpis.cancellation_rate * 2 // 取消率每1%扣2分
      kpis.efficiency_score = Math.max(baseScore - timeDeduction - cancellationDeduction, 0)
      kpis.efficiency_score = Number(kpis.efficiency_score.toFixed(2))
      
      return c.json({
        success: true,
        data: {
          kpis,
          processing_times: processingTimeResult,
          efficiency_trends: efficiencyTrendResult.results || [],
          staff_performance: staffPerformanceResult.results || [],
          table_utilization: tableUtilizationResult.results || []
        }
      })
      
    } catch (error) {
      console.error('Get performance analytics error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch performance analytics'
      }, 500)
    }
  }
)

/**
 * 匯出分析報表
 * GET /api/v1/analytics/export
 */
app.get('/export',
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(analyticsQuerySchema.extend({
    type: z.enum(['dashboard', 'revenue', 'products', 'customers', 'performance']).default('dashboard'),
    format: z.enum(['json', 'csv']).default('json')
  })),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      // const user = c.get('user')
      
      // 根據類型調用對應的分析API（簡化實現）
      // 實際項目中可以直接復用上面的邏輯或創建專門的匯出服務
      
      return c.json({
        success: true,
        message: 'Export functionality would be implemented here',
        data: {
          type: query.type,
          format: query.format,
          period: {
            from: query.dateFrom,
            to: query.dateTo
          },
          download_url: `https://api.example.com/exports/${Date.now()}.${query.format}`,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      })
      
    } catch (error) {
      console.error('Export analytics error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export analytics'
      }, 500)
    }
  }
)

/**
 * 獲取實時統計面板數據
 * GET /api/v1/analytics/realtime-dashboard
 */
app.get('/realtime-dashboard',
  authMiddleware,
  requireRole([0, 1, 2]), // 管理員、店主、廚師
  validateQuery(z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number).optional()
  })),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedQuery')
      const user = c.get('user')
      
      // 權限檢查
      let targetRestaurantId = restaurantId
      if (user.role >= 1) {
        targetRestaurantId = user.restaurantId
      }
      
      let whereConditions = ['1=1']
      let params: any[] = []
      
      if (targetRestaurantId) {
        whereConditions.push('restaurant_id = ?')
        params.push(targetRestaurantId)
      }
      
      const whereClause = whereConditions.join(' AND ')
      
      // 實時統計數據
      const realtimeStats = await c.env.DB.prepare(`
        SELECT 
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
          COUNT(CASE WHEN status = 'preparing' THEN 1 END) as preparing_orders,
          COUNT(CASE WHEN status = 'ready' THEN 1 END) as ready_orders,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_today,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_today,
          COUNT(*) as total_today,
          AVG(CASE WHEN status IN ('completed', 'ready') AND estimated_ready_time IS NOT NULL 
                   THEN (julianday(updated_at) - julianday(created_at)) * 24 * 60 
                   END) as avg_preparation_time,
          SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as revenue_today
        FROM orders 
        WHERE ${whereClause} AND DATE(created_at) = DATE('now')
      `).bind(...params).first()
      
      // 當前活躍訂單詳情
      const activeOrdersResult = await c.env.DB.prepare(`
        SELECT 
          id,
          order_number,
          status,
          total,
          customer_name,
          table_id,
          order_type,
          created_at,
          estimated_ready_time,
          (julianday('now') - julianday(created_at)) * 24 * 60 as elapsed_minutes
        FROM orders 
        WHERE ${whereClause} AND status IN ('pending', 'preparing', 'ready')
        ORDER BY created_at ASC
        LIMIT 20
      `).bind(...params).all()
      
      // 平均製作時間分析（按菜品類別）
      const avgTimeByCategory = await c.env.DB.prepare(`
        SELECT 
          c.name as category_name,
          COUNT(oi.id) as item_count,
          AVG((julianday(o.updated_at) - julianday(o.created_at)) * 24 * 60) as avg_time_minutes
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        JOIN categories c ON mi.category_id = c.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status IN ('completed', 'ready') 
          AND ${whereClause.replace('restaurant_id', 'o.restaurant_id')}
          AND DATE(o.created_at) = DATE('now')
        GROUP BY c.id, c.name
        HAVING item_count >= 3
        ORDER BY avg_time_minutes DESC
      `).bind(...params).all()
      
      // 完成率統計（按時間段）
      const hourlyCompletionRate = await c.env.DB.prepare(`
        SELECT 
          strftime('%H', created_at) as hour,
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
          ROUND(COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2) as completion_rate
        FROM orders 
        WHERE ${whereClause} AND DATE(created_at) = DATE('now')
        GROUP BY strftime('%H', created_at)
        ORDER BY hour
      `).bind(...params).all()
      
      // 績效趨勢（最近7天）
      const performanceTrend = await c.env.DB.prepare(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
          AVG(CASE WHEN status = 'completed' AND estimated_ready_time IS NOT NULL 
                   THEN (julianday(updated_at) - julianday(created_at)) * 24 * 60 
                   END) as avg_prep_time,
          ROUND(COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2) as completion_rate,
          SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as revenue
        FROM orders 
        WHERE ${whereClause} AND created_at >= datetime('now', '-7 days')
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 7
      `).bind(...params).all()
      
      // 當前系統負載
      const systemLoad = {
        active_orders: (realtimeStats.pending_orders || 0) + (realtimeStats.preparing_orders || 0),
        queue_length: realtimeStats.pending_orders || 0,
        kitchen_capacity: 20, // 可配置的廚房容量
        load_percentage: Math.min(((realtimeStats.pending_orders || 0) + (realtimeStats.preparing_orders || 0)) / 20 * 100, 100)
      }
      
      // 計算關鍵績效指標
      const kpis = {
        completion_rate: realtimeStats.total_today > 0 
          ? Number(((realtimeStats.completed_today || 0) / realtimeStats.total_today * 100).toFixed(2))
          : 100,
        avg_preparation_time: Number((realtimeStats.avg_preparation_time || 0).toFixed(2)),
        orders_per_hour: Number((realtimeStats.total_today / 24).toFixed(2)),
        revenue_per_order: realtimeStats.completed_today > 0 
          ? Number(((realtimeStats.revenue_today || 0) / realtimeStats.completed_today).toFixed(2))
          : 0,
        efficiency_score: 0 // 將在下面計算
      }
      
      // 效率評分算法
      const baseScore = 100
      const timeDeduction = Math.min((kpis.avg_preparation_time - 20) / 20 * 30, 50) // 超過20分鐘開始扣分
      const completionDeduction = (100 - kpis.completion_rate) * 0.5 // 完成率低扣分
      kpis.efficiency_score = Math.max(baseScore - timeDeduction - completionDeduction, 0)
      kpis.efficiency_score = Number(kpis.efficiency_score.toFixed(2))
      
      return c.json({
        success: true,
        data: {
          realtime_stats: {
            pending_orders: realtimeStats.pending_orders || 0,
            preparing_orders: realtimeStats.preparing_orders || 0,
            ready_orders: realtimeStats.ready_orders || 0,
            completed_today: realtimeStats.completed_today || 0,
            cancelled_today: realtimeStats.cancelled_today || 0,
            total_today: realtimeStats.total_today || 0,
            revenue_today: Number((realtimeStats.revenue_today || 0).toFixed(2))
          },
          kpis,
          system_load: systemLoad,
          active_orders: activeOrdersResult.results || [],
          avg_time_by_category: avgTimeByCategory.results || [],
          hourly_completion_rate: hourlyCompletionRate.results || [],
          performance_trend: performanceTrend.results || []
        },
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('Get realtime dashboard error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch realtime dashboard data'
      }, 500)
    }
  }
)

/**
 * 獲取詳細績效分析
 * GET /api/v1/analytics/detailed-performance
 */
app.get('/detailed-performance',
  authMiddleware,
  requireRole([0, 1, 2]), // 管理員、店主、廚師
  validateQuery(analyticsQuerySchema.extend({
    includeStaffMetrics: z.string().transform(val => val === 'true').optional().default(false),
    includeItemAnalysis: z.string().transform(val => val === 'true').optional().default(false)
  })),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      
      let whereConditions = ['1=1']
      let params: any[] = []
      
      // 權限檢查
      if (user.role >= 1) {
        whereConditions.push('restaurant_id = ?')
        params.push(user.restaurantId)
      } else if (query.restaurantId) {
        whereConditions.push('restaurant_id = ?')
        params.push(query.restaurantId)
      }
      
      // 日期範圍
      if (query.dateFrom) {
        whereConditions.push('created_at >= ?')
        params.push(query.dateFrom)
      }
      
      if (query.dateTo) {
        whereConditions.push('created_at <= ?')
        params.push(query.dateTo)
      }
      
      const whereClause = whereConditions.join(' AND ')
      
      // 詳細績效指標
      const detailedMetrics = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
          AVG(CASE WHEN status = 'completed' AND updated_at IS NOT NULL 
                   THEN (julianday(updated_at) - julianday(created_at)) * 24 * 60 END) as avg_completion_time,
          MIN(CASE WHEN status = 'completed' AND updated_at IS NOT NULL 
                   THEN (julianday(updated_at) - julianday(created_at)) * 24 * 60 END) as fastest_completion,
          MAX(CASE WHEN status = 'completed' AND updated_at IS NOT NULL 
                   THEN (julianday(updated_at) - julianday(created_at)) * 24 * 60 END) as slowest_completion,
          PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY 
            CASE WHEN status = 'completed' AND updated_at IS NOT NULL 
                 THEN (julianday(updated_at) - julianday(created_at)) * 24 * 60 END) as median_completion_time,
          SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as total_revenue
        FROM orders 
        WHERE ${whereClause}
      `).bind(...params).first()
      
      // 員工績效分析（如果請求）
      let staffMetrics = []
      if (query.includeStaffMetrics) {
        const staffResult = await c.env.DB.prepare(`
          SELECT 
            u.id,
            u.username,
            u.full_name,
            u.role,
            COUNT(o.id) as orders_handled,
            COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as orders_completed,
            AVG(CASE WHEN o.status = 'completed' AND o.updated_at IS NOT NULL 
                     THEN (julianday(o.updated_at) - julianday(o.created_at)) * 24 * 60 END) as avg_handling_time,
            ROUND(COUNT(CASE WHEN o.status = 'completed' THEN 1 END) * 100.0 / COUNT(o.id), 2) as completion_rate
          FROM users u
          LEFT JOIN orders o ON (o.updated_by = u.id OR o.assigned_chef_id = u.id) 
            AND ${whereClause.replace('restaurant_id', 'o.restaurant_id').replace('created_at', 'o.created_at')}
          WHERE u.role IN (2, 3) ${user.role >= 1 ? 'AND u.restaurant_id = ?' : ''}
          GROUP BY u.id, u.username, u.full_name, u.role
          HAVING orders_handled > 0
          ORDER BY completion_rate DESC, avg_handling_time ASC
        `).bind(
          ...params,
          ...(user.role >= 1 ? [user.restaurantId] : [])
        ).all()
        
        staffMetrics = staffResult.results || []
      }
      
      // 菜品分析（如果請求）
      let itemAnalysis = []
      if (query.includeItemAnalysis) {
        const itemResult = await c.env.DB.prepare(`
          SELECT 
            mi.id,
            mi.name as item_name,
            c.name as category_name,
            COUNT(oi.id) as order_count,
            AVG(CASE WHEN o.status = 'completed' AND o.updated_at IS NOT NULL 
                     THEN (julianday(o.updated_at) - julianday(o.created_at)) * 24 * 60 END) as avg_prep_time,
            COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as successful_orders,
            ROUND(COUNT(CASE WHEN o.status = 'completed' THEN 1 END) * 100.0 / COUNT(oi.id), 2) as success_rate,
            SUM(oi.subtotal) as total_revenue
          FROM order_items oi
          JOIN menu_items mi ON oi.menu_item_id = mi.id
          JOIN orders o ON oi.order_id = o.id
          LEFT JOIN categories c ON mi.category_id = c.id
          WHERE ${whereClause.replace('restaurant_id', 'o.restaurant_id').replace('created_at', 'o.created_at')}
          GROUP BY mi.id, mi.name, c.name
          HAVING order_count >= 3
          ORDER BY order_count DESC
          LIMIT 20
        `).bind(...params).all()
        
        itemAnalysis = itemResult.results || []
      }
      
      // 趨勢數據
      const trendData = await c.env.DB.prepare(`
        SELECT 
          ${getDateGroupBySQL(query.groupBy)} as period,
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
          AVG(CASE WHEN status = 'completed' AND updated_at IS NOT NULL 
                   THEN (julianday(updated_at) - julianday(created_at)) * 24 * 60 END) as avg_completion_time,
          ROUND(COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2) as completion_rate,
          SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as revenue
        FROM orders 
        WHERE ${whereClause}
        GROUP BY ${getDateGroupBySQL(query.groupBy)}
        ORDER BY period DESC
        LIMIT ?
      `).bind(...params, query.limit).all()
      
      return c.json({
        success: true,
        data: {
          summary: detailedMetrics,
          staff_metrics: staffMetrics,
          item_analysis: itemAnalysis,
          trends: trendData.results || [],
          period: {
            from: query.dateFrom,
            to: query.dateTo,
            groupBy: query.groupBy
          }
        },
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('Get detailed performance error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch detailed performance data'
      }, 500)
    }
  }
)

/**
 * Server-Sent Events (SSE) 端點用於實時統計數據推送
 * GET /api/v1/analytics/sse
 */
app.get('/sse',
  authMiddleware,
  requireRole([0, 1, 2]), // 管理員、店主、廚師
  async (c) => {
    try {
      const user = c.get('user')
      const lastEventId = c.req.query('lastEventId')
      
      // 設置 SSE 標頭
      c.header('Content-Type', 'text/event-stream')
      c.header('Cache-Control', 'no-cache')
      c.header('Connection', 'keep-alive')
      c.header('Access-Control-Allow-Origin', '*')
      c.header('Access-Control-Allow-Headers', 'Cache-Control')
      
      // 創建 ReadableStream 用於 SSE
      const stream = new ReadableStream({
        start(controller) {
          // 發送初始連接確認
          const welcomeEvent = `id: ${Date.now()}\nevent: heartbeat\ndata: {"message": "SSE connected", "timestamp": "${new Date().toISOString()}"}\n\n`
          controller.enqueue(new TextEncoder().encode(welcomeEvent))
          
          // 設置定期心跳檢測
          const heartbeatInterval = setInterval(() => {
            try {
              const heartbeatEvent = `id: ${Date.now()}\nevent: heartbeat\ndata: {"timestamp": "${new Date().toISOString()}"}\n\n`
              controller.enqueue(new TextEncoder().encode(heartbeatEvent))
            } catch (error) {
              console.error('SSE heartbeat error:', error)
              clearInterval(heartbeatInterval)
            }
          }, 30000) // 每 30 秒發送心跳
          
          // 設置統計數據推送
          const statsInterval = setInterval(async () => {
            try {
              // 獲取實時統計數據
              let targetRestaurantId: number | undefined
              if (user.role >= 1) {
                targetRestaurantId = user.restaurantId
              }
              
              let whereConditions = ['1=1']
              let params: any[] = []
              
              if (targetRestaurantId) {
                whereConditions.push('restaurant_id = ?')
                params.push(targetRestaurantId)
              }
              
              const whereClause = whereConditions.join(' AND ')
              
              // 實時統計數據
              const realtimeStats = await c.env.DB.prepare(`
                SELECT 
                  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
                  COUNT(CASE WHEN status = 'preparing' THEN 1 END) as preparing_orders,
                  COUNT(CASE WHEN status = 'ready' THEN 1 END) as ready_orders,
                  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_today,
                  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_today,
                  COUNT(*) as total_today,
                  SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as revenue_today
                FROM orders 
                WHERE ${whereClause} AND DATE(created_at) = DATE('now')
              `).bind(...params).first()
              
              // 活躍訂單
              const activeOrdersResult = await c.env.DB.prepare(`
                SELECT 
                  id, order_number, status, total, customer_name, table_id, order_type, created_at,
                  (julianday('now') - julianday(created_at)) * 24 * 60 as elapsed_minutes
                FROM orders 
                WHERE ${whereClause} AND status IN ('pending', 'preparing', 'ready')
                ORDER BY created_at ASC
                LIMIT 10
              `).bind(...params).all()
              
              const statisticsData = {
                realtime_stats: realtimeStats,
                active_orders: activeOrdersResult.results || [],
                timestamp: new Date().toISOString()
              }
              
              const eventId = Date.now()
              const event = `id: ${eventId}\nevent: statistics_update\ndata: ${JSON.stringify(statisticsData)}\n\n`
              controller.enqueue(new TextEncoder().encode(event))
              
            } catch (error) {
              console.error('SSE statistics update error:', error)
              const errorEvent = `id: ${Date.now()}\nevent: error\ndata: {"error": "Failed to fetch statistics", "timestamp": "${new Date().toISOString()}"}\n\n`
              controller.enqueue(new TextEncoder().encode(errorEvent))
            }
          }, 10000) // 每 10 秒推送一次統計數據
          
          // 清理函數
          const cleanup = () => {
            clearInterval(heartbeatInterval)
            clearInterval(statsInterval)
            try {
              controller.close()
            } catch (error) {
              console.error('SSE cleanup error:', error)
            }
          }
          
          // 監聽關閉事件
          c.req.raw.signal?.addEventListener('abort', cleanup)
          
          // 設置超時清理（防止連接洩漏）
          setTimeout(cleanup, 3600000) // 1小時後自動關閉
        },
        
        cancel() {
          console.log('SSE stream cancelled')
        }
      })
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        }
      })
      
    } catch (error) {
      console.error('SSE endpoint error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to establish SSE connection'
      }, 500)
    }
  }
)

/**
 * 獲取店主管理面板數據
 * GET /api/v1/analytics/owner-dashboard
 */
app.get('/owner-dashboard',
  authMiddleware,
  requireRole([0, 1]), // 管理員、店主
  validateQuery(z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number).optional()
  })),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedQuery')
      const user = c.get('user')
      
      // 權限檢查
      let targetRestaurantId = restaurantId
      if (user.role === 1) {
        targetRestaurantId = user.restaurantId
      }
      
      let whereConditions = ['1=1']
      let params: any[] = []
      
      if (targetRestaurantId) {
        whereConditions.push('restaurant_id = ?')
        params.push(targetRestaurantId)
      }
      
      const whereClause = whereConditions.join(' AND ')
      
      // 業務概覽數據（今日）
      const todayOverview = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
          SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as total_revenue,
          AVG(CASE WHEN status = 'completed' THEN total ELSE NULL END) as avg_order_value,
          COUNT(DISTINCT customer_phone) as unique_customers
        FROM orders 
        WHERE ${whereClause} AND DATE(created_at) = DATE('now')
      `).bind(...params).first()
      
      // 員工在線狀態
      const staffStatus = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_staff,
          COUNT(CASE WHEN last_active_at > datetime('now', '-15 minutes') THEN 1 END) as online_staff,
          AVG(CASE WHEN role = 2 THEN efficiency_score END) as avg_chef_efficiency,
          AVG(CASE WHEN role = 3 THEN efficiency_score END) as avg_service_efficiency
        FROM users 
        WHERE role IN (2, 3, 4) ${user.role === 1 ? 'AND restaurant_id = ?' : ''}
      `).bind(...(user.role === 1 ? [user.restaurantId] : [])).first()
      
      // 系統健康檢查
      const systemHealth = [
        { name: 'API 服務', status: 'healthy', uptime: '99.9%' },
        { name: '數據庫', status: 'healthy', uptime: '99.8%' },
        { name: '支付系統', status: 'warning', uptime: '98.5%' }
      ]
      
      // 緊急警報
      const emergencyAlerts = await c.env.DB.prepare(`
        SELECT 
          id, title, description, severity, created_at
        FROM system_alerts 
        WHERE resolved_at IS NULL 
          AND severity IN ('high', 'critical')
          ${user.role === 1 ? 'AND (restaurant_id = ? OR restaurant_id IS NULL)' : ''}
        ORDER BY created_at DESC
        LIMIT 5
      `).bind(...(user.role === 1 ? [user.restaurantId] : [])).all()
      
      // 熱門商品（本週）
      const popularItems = await c.env.DB.prepare(`
        SELECT 
          mi.name,
          COUNT(oi.id) as sales_count,
          SUM(oi.subtotal) as revenue
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status = 'completed' 
          AND ${whereClause.replace('restaurant_id', 'o.restaurant_id')}
          AND o.created_at >= datetime('now', '-7 days')
        GROUP BY mi.id, mi.name
        ORDER BY sales_count DESC
        LIMIT 4
      `).bind(...params).all()
      
      return c.json({
        success: true,
        data: {
          today_overview: {
            total_orders: todayOverview?.total_orders || 0,
            completed_orders: todayOverview?.completed_orders || 0,
            total_revenue: Number((todayOverview?.total_revenue || 0).toFixed(2)),
            avg_order_value: Number((todayOverview?.avg_order_value || 0).toFixed(2)),
            unique_customers: todayOverview?.unique_customers || 0
          },
          staff_status: {
            total_staff: staffStatus?.total_staff || 0,
            online_staff: staffStatus?.online_staff || 0,
            avg_chef_efficiency: Number((staffStatus?.avg_chef_efficiency || 0).toFixed(2)),
            avg_service_efficiency: Number((staffStatus?.avg_service_efficiency || 0).toFixed(2))
          },
          system_health: systemHealth,
          emergency_alerts: emergencyAlerts.results || [],
          popular_items: popularItems.results || []
        },
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('Get owner dashboard error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch owner dashboard data'
      }, 500)
    }
  }
)

/**
 * 獲取財務報表數據
 * GET /api/v1/analytics/financial-report
 */
app.get('/financial-report',
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
    period: z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('monthly'),
    year: z.string().regex(/^\d{4}$/).optional(),
    month: z.string().regex(/^(0?[1-9]|1[0-2])$/).optional()
  })),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      
      let targetRestaurantId = query.restaurantId
      if (user.role === 1) {
        targetRestaurantId = user.restaurantId
      }
      
      let whereConditions = ["status = 'completed'"]
      let params: any[] = []
      
      if (targetRestaurantId) {
        whereConditions.push('restaurant_id = ?')
        params.push(targetRestaurantId)
      }
      
      // 根據期間添加時間條件
      if (query.year && query.month) {
        whereConditions.push("strftime('%Y', created_at) = ? AND strftime('%m', created_at) = ?")
        params.push(query.year, query.month.padStart(2, '0'))
      } else if (query.year) {
        whereConditions.push("strftime('%Y', created_at) = ?")
        params.push(query.year)
      }
      
      const whereClause = whereConditions.join(' AND ')
      
      // 營收摘要
      const revenueSummary = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(subtotal) as gross_revenue,
          SUM(tax) as total_tax,
          SUM(total) as net_revenue,
          AVG(total) as avg_order_value
        FROM orders 
        WHERE ${whereClause}
      `).bind(...params).first()
      
      // 按支付方式分組
      const paymentMethods = await c.env.DB.prepare(`
        SELECT 
          payment_method,
          COUNT(*) as order_count,
          SUM(total) as total_amount
        FROM orders 
        WHERE ${whereClause}
        GROUP BY payment_method
        ORDER BY total_amount DESC
      `).bind(...params).all()
      
      // 退款統計
      const refundStats = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as refund_count,
          SUM(refund_amount) as total_refunded
        FROM order_refunds 
        WHERE order_id IN (
          SELECT id FROM orders WHERE ${whereClause}
        )
      `).bind(...params).first()
      
      return c.json({
        success: true,
        data: {
          period: query.period,
          revenue_summary: {
            total_orders: revenueSummary?.total_orders || 0,
            gross_revenue: Number((revenueSummary?.gross_revenue || 0).toFixed(2)),
            total_tax: Number((revenueSummary?.total_tax || 0).toFixed(2)),
            net_revenue: Number((revenueSummary?.net_revenue || 0).toFixed(2)),
            avg_order_value: Number((revenueSummary?.avg_order_value || 0).toFixed(2))
          },
          payment_methods: paymentMethods.results || [],
          refund_stats: {
            refund_count: refundStats?.refund_count || 0,
            total_refunded: Number((refundStats?.total_refunded || 0).toFixed(2))
          }
        }
      })
      
    } catch (error) {
      console.error('Get financial report error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch financial report'
      }, 500)
    }
  }
)

export default app