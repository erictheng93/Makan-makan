/**
 * 報表統計路由
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../../../middleware/auth'
import { validateQuery } from '../../../middleware/validation'
import { ReportService } from '../services/ReportService'
import type { Env } from '../../../types/env'

const app = new Hono<{ Bindings: Env }>()

/**
 * 獲取日營業報表
 * GET /reports/daily
 */
app.get('/daily',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateQuery(z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  })),
  async (c) => {
    try {
      const user = c.get('user')
      const { restaurantId, date } = c.get('validatedQuery')

      // 確定餐廳ID
      let finalRestaurantId: number
      if (restaurantId) {
        finalRestaurantId = restaurantId
        if (user.role === 1 && user.restaurantId !== restaurantId) {
          return c.json({
            success: false,
            error: '只能查看自己餐廳的報表'
          }, 403)
        }
      } else if (user.restaurantId) {
        finalRestaurantId = user.restaurantId
      } else {
        return c.json({
          success: false,
          error: '需要指定餐廳ID'
        }, 400)
      }

      const reportService = new ReportService(c.env.DB as any)
      const result = await reportService.getDailyReport(finalRestaurantId, date)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        data: result.data
      })

    } catch (error) {
      console.error('Get daily report error:', error)
      return c.json({
        success: false,
        error: '獲取日營業報表失敗'
      }, 500)
    }
  }
)

/**
 * 獲取收銀機使用統計
 * GET /reports/register-usage
 */
app.get('/register-usage',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateQuery(z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
    period: z.enum(['day', 'week', 'month']).optional().default('day')
  })),
  async (c) => {
    try {
      const user = c.get('user')
      const { restaurantId, period } = c.get('validatedQuery')

      // 確定餐廳ID
      let finalRestaurantId: number
      if (restaurantId) {
        finalRestaurantId = restaurantId
        if (user.role === 1 && user.restaurantId !== restaurantId) {
          return c.json({
            success: false,
            error: '只能查看自己餐廳的統計'
          }, 403)
        }
      } else if (user.restaurantId) {
        finalRestaurantId = user.restaurantId
      } else {
        return c.json({
          success: false,
          error: '需要指定餐廳ID'
        }, 400)
      }

      const reportService = new ReportService(c.env.DB as any)
      const result = await reportService.getRegisterUsageStats(finalRestaurantId, period)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        data: result.data
      })

    } catch (error) {
      console.error('Get register usage stats error:', error)
      return c.json({
        success: false,
        error: '獲取收銀機使用統計失敗'
      }, 500)
    }
  }
)

/**
 * 匯出報表
 * GET /reports/export
 */
app.get('/export',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateQuery(z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
    type: z.enum(['daily', 'shift', 'register-usage']),
    format: z.enum(['json', 'csv', 'pdf']).optional().default('json'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    shiftId: z.string().uuid().optional(),
    registerId: z.string().uuid().optional()
  })),
  async (c) => {
    try {
      const user = c.get('user')
      const { restaurantId, type, format, startDate, shiftId } = c.get('validatedQuery')

      // 確定餐廳ID
      let finalRestaurantId: number
      if (restaurantId) {
        finalRestaurantId = restaurantId
        if (user.role === 1 && user.restaurantId !== restaurantId) {
          return c.json({
            success: false,
            error: '只能匯出自己餐廳的報表'
          }, 403)
        }
      } else if (user.restaurantId) {
        finalRestaurantId = user.restaurantId
      } else {
        return c.json({
          success: false,
          error: '需要指定餐廳ID'
        }, 400)
      }

      const reportService = new ReportService(c.env.DB as any)
      let result: any

      switch (type) {
        case 'daily':
          if (!startDate) {
            return c.json({
              success: false,
              error: '日報表需要指定日期'
            }, 400)
          }
          result = await reportService.getDailyReport(finalRestaurantId, startDate)
          break

        case 'shift':
          if (!shiftId) {
            return c.json({
              success: false,
              error: '班次報表需要指定班次ID'
            }, 400)
          }
          result = await reportService.generateShiftReport(shiftId)
          break

        case 'register-usage':
          result = await reportService.getRegisterUsageStats(finalRestaurantId, 'day')
          break

        default:
          return c.json({
            success: false,
            error: '不支援的報表類型'
          }, 400)
      }

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      // 根據格式返回不同的響應
      switch (format) {
        case 'json':
          return c.json({
            success: true,
            data: result.data
          })

        case 'csv': {
          // 簡化的CSV格式（實際應用中需要更完整的CSV轉換）
          const csvData = convertToCSV(result.data, type)
          return new Response(csvData, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="${type}-report-${Date.now()}.csv"`
            }
          })
        }

        case 'pdf':
          // PDF生成（實際應用中需要PDF生成庫）
          return c.json({
            success: false,
            error: 'PDF格式暫未支援'
          }, 501)

        default:
          return c.json({
            success: false,
            error: '不支援的匯出格式'
          }, 400)
      }

    } catch (error) {
      console.error('Export report error:', error)
      return c.json({
        success: false,
        error: '匯出報表失敗'
      }, 500)
    }
  }
)

/**
 * 簡化的CSV轉換函數
 */
function convertToCSV(data: any, type: string): string {
  // 這是一個簡化的實現，實際應用中需要更完整的CSV轉換邏輯
  if (type === 'daily') {
    const headers = ['日期', '總訂單', '總營收', '總稅額', '總折扣', '退款次數', '退款金額', '淨營收']
    const row = [
      data.date,
      data.summary.totalOrders,
      data.summary.totalSales,
      data.summary.totalTax,
      data.summary.totalDiscounts,
      data.summary.totalRefunds,
      data.summary.totalRefundAmount,
      data.summary.netSales
    ]
    return [headers.join(','), row.join(',')].join('\n')
  }

  return 'CSV格式轉換暫未完整實現'
}

export default app