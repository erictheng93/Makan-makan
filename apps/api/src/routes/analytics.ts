import { Hono } from 'hono'
import { z } from 'zod'
import { AnalyticsService } from '@makanmakan/database'
import { authMiddleware, requireRole } from '../middleware/auth'
import { validateQuery } from '../middleware/validation'
import type { Env } from '../types/env'

// Database query result types
interface _DashboardMetrics {
  total_orders: number
  completed_orders: number
  cancelled_orders: number
  total_revenue: number
  avg_order_value: number
  unique_customers: number
}

interface _OrderStatusStats {
  status: string
  count: number
}

interface _OrderTypeStats {
  order_type: string
  count: number
  revenue: number
}

interface _PopularItem {
  name: string
  total_quantity: number
  total_revenue: number
  order_count: number
}

interface _HourlyStats {
  hour: string
  orders: number
  revenue: number
}

interface _RevenueData {
  period: string
  order_count: number
  total_revenue: number
  subtotal: number
  tax: number
  avg_order_value: number
  min_order_value: number
  max_order_value: number
}

const app = new Hono<{ Bindings: Env }>()

// 驗證 schemas
const analyticsQuerySchema = z.object({
  restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  groupBy: z.enum(['day', 'week', 'month', 'year']).default('day'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('30')
})

const revenueQuerySchema = analyticsQuerySchema.extend({
  includeComparison: z.string().transform(val => val === 'true').default('false')
})

const performanceQuerySchema = analyticsQuerySchema.extend({
  metric: z.enum(['orders', 'revenue', 'avg_order_value', 'customer_count']).default('orders')
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
function _getComparisonDateRange(dateFrom?: string, dateTo?: string): { compDateFrom: string; compDateTo: string } | null {
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
    period: z.enum(['today', 'week', 'month', 'year']).default('today')
  }) as any),
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
      const dateParams: any[] = []
      
      const _now = new Date()
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
      
      const whereConditions = [dateCondition]
      const params = [...dateParams]
      
      if (targetRestaurantId) {
        whereConditions.push('restaurant_id = ?')
        params.push(targetRestaurantId)
      }
      
      const _whereClause = whereConditions.join(' AND ')
      
      const analyticsService = new AnalyticsService(c.env.DB as any)
      
      // 獲取儀表板數據
      const dashboardData = await analyticsService.getDashboardData(targetRestaurantId!)
      
      return c.json({
        success: true,
        data: dashboardData,
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
  validateQuery(revenueQuerySchema as any),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      
      const whereConditions = ["status = 'completed'"]
      const params: any[] = []
      
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
      
      const _whereClause = whereConditions.join(' AND ')
      const _dateGroupBy = getDateGroupBySQL(query.groupBy)
      
      const analyticsService = new AnalyticsService(c.env.DB as any)
      
      // 獲取營收分析數據
      const revenueData = await analyticsService.getRevenueAnalytics({
        restaurantId: user.role === 1 ? user.restaurantId : query.restaurantId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        groupBy: query.groupBy,
        limit: query.limit,
        includeComparison: query.includeComparison
      })
      
      return c.json({
        success: true,
        data: revenueData
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
  validateQuery(analyticsQuerySchema as any),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      
      const whereConditions = ["o.status = 'completed'"]
      const params: any[] = []
      
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
      
      const _whereClause = whereConditions.join(' AND ')
      
      const analyticsService = new AnalyticsService(c.env.DB as any)
      
      // 獲取產品分析數據
      const productData = await analyticsService.getMenuAnalytics({
        restaurantId: user.role === 1 ? user.restaurantId : query.restaurantId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        groupBy: query.groupBy,
        limit: query.limit
      })
      
      return c.json({
        success: true,
        data: productData
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
  validateQuery(analyticsQuerySchema as any),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      
      const whereConditions = ["status = 'completed'"]
      const params: any[] = []
      
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
      
      const _whereClause = whereConditions.join(' AND ')
      
      const analyticsService = new AnalyticsService(c.env.DB as any)
      
      // 獲取客戶分析數據
      const customerData = await analyticsService.getCustomerAnalytics({
        restaurantId: user.role === 1 ? user.restaurantId : query.restaurantId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        groupBy: query.groupBy,
        limit: query.limit
      })
      
      return c.json({
        success: true,
        data: customerData
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
  validateQuery(performanceQuerySchema as any),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      
      const whereConditions = ['1=1']
      const params: any[] = []
      
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
      
      const _whereClause = whereConditions.join(' AND ')
      
      const analyticsService = new AnalyticsService(c.env.DB as any)
      
      // 獲取性能分析數據
      // TODO: Implement getPerformanceAnalytics method in AnalyticsService
      const performanceData = await analyticsService.getOrderAnalytics({
        restaurantId: user.role >= 1 ? user.restaurantId : query.restaurantId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        groupBy: query.groupBy,
        limit: query.limit,
        metric: query.metric
      })
      
      return c.json({
        success: true,
        data: performanceData
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
  }) as any),
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
  }) as any),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedQuery')
      const user = c.get('user')
      
      // 權限檢查
      let targetRestaurantId = restaurantId
      if (user.role >= 1) {
        targetRestaurantId = user.restaurantId
      }
      
      const whereConditions = ['1=1']
      const params: any[] = []
      
      if (targetRestaurantId) {
        whereConditions.push('restaurant_id = ?')
        params.push(targetRestaurantId)
      }
      
      const _whereClause = whereConditions.join(' AND ')
      
      const analyticsService = new AnalyticsService(c.env.DB as any)
      
      // 獲取實時統計面板數據
      // TODO: Implement getRealtimeDashboard method in AnalyticsService
      const realtimeData = await analyticsService.getDashboardData(targetRestaurantId!)
      
      return c.json({
        success: true,
        data: realtimeData,
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
    includeStaffMetrics: z.string().transform(val => val === 'true').default('false'),
    includeItemAnalysis: z.string().transform(val => val === 'true').default('false')
  }) as any),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      
      const whereConditions = ['1=1']
      const params: any[] = []
      
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
      
      const _whereClause = whereConditions.join(' AND ')
      
      const analyticsService = new AnalyticsService(c.env.DB as any)
      
      // 獲取詳細績效分析數據
      // TODO: Implement getDetailedPerformanceAnalytics method in AnalyticsService
      const detailedPerformanceData = await analyticsService.getOrderAnalytics({
        restaurantId: user.role >= 1 ? user.restaurantId : query.restaurantId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        groupBy: query.groupBy,
        limit: query.limit
        // TODO: Add support for includeStaffMetrics and includeItemAnalysis parameters
      })
      
      return c.json({
        success: true,
        data: detailedPerformanceData,
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
      const _lastEventId = c.req.query('lastEventId')
      
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
              
              const whereConditions = ['1=1']
              const params: any[] = []
              
              if (targetRestaurantId) {
                whereConditions.push('restaurant_id = ?')
                params.push(targetRestaurantId)
              }
              
              const _whereClause = whereConditions.join(' AND ')
              
              // 使用 AnalyticsService 獲取實時數據
              const analyticsService = new AnalyticsService(c.env.DB as any)
              // TODO: Implement getRealtimeDashboard method in AnalyticsService
              const realtimeData = await analyticsService.getDashboardData(targetRestaurantId!)
              
              const statisticsData = {
                ...realtimeData,
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
  }) as any),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedQuery')
      const user = c.get('user')
      
      // 權限檢查
      let targetRestaurantId = restaurantId
      if (user.role === 1) {
        targetRestaurantId = user.restaurantId
      }
      
      const whereConditions = ['1=1']
      const params: any[] = []
      
      if (targetRestaurantId) {
        whereConditions.push('restaurant_id = ?')
        params.push(targetRestaurantId)
      }
      
      const _whereClause = whereConditions.join(' AND ')
      
      const analyticsService = new AnalyticsService(c.env.DB as any)
      
      // 獲取店主管理面板數據
      // TODO: Implement getOwnerDashboard method in AnalyticsService
      const ownerDashboardData = await analyticsService.getDashboardData(targetRestaurantId!)
      
      return c.json({
        success: true,
        data: ownerDashboardData,
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
  }) as any),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      
      let targetRestaurantId = query.restaurantId
      if (user.role === 1) {
        targetRestaurantId = user.restaurantId
      }
      
      const whereConditions = ["status = 'completed'"]
      const params: any[] = []
      
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
      
      const _whereClause = whereConditions.join(' AND ')
      
      const analyticsService = new AnalyticsService(c.env.DB as any)
      
      // 獲取財務報表數據
      // TODO: Implement getFinancialReport method in AnalyticsService
      const financialReportData = await analyticsService.getRevenueAnalytics({
        restaurantId: targetRestaurantId,
        period: query.period,
        year: query.year,
        month: query.month
      })
      
      return c.json({
        success: true,
        data: financialReportData
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