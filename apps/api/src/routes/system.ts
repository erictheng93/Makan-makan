import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../middleware/auth'
import { validateJSON } from '../middleware/validation'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 錯誤報告 schema
const errorReportSchema = z.object({
  errors: z.array(z.object({
    type: z.enum(['network', 'api', 'sse', 'validation', 'permission', 'unknown']),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    code: z.union([z.string(), z.number()]).optional(),
    message: z.string(),
    originalError: z.any().optional(),
    context: z.record(z.any()).optional(),
    timestamp: z.string().datetime(),
    userAgent: z.string().optional(),
    url: z.string().optional(),
    userId: z.union([z.number(), z.string()]).optional(),
    restaurantId: z.union([z.number(), z.string()]).optional()
  }))
})

/**
 * 錯誤報告端點
 * POST /api/v1/system/error-report
 */
app.post('/error-report',
  authMiddleware,
  validateJSON(errorReportSchema),
  async (c) => {
    try {
      const { errors } = c.get('validatedData')
      const user = c.get('user')
      
      console.log(`Received ${errors.length} error reports from user ${user.id}`)
      
      // 過濾掉低嚴重性的錯誤（可選）
      const significantErrors = errors.filter(error => 
        error.severity === 'high' || error.severity === 'critical'
      )
      
      // 存儲錯誤報告到數據庫
      const errorReports = errors.map(error => ({
        user_id: user.id,
        restaurant_id: user.restaurantId,
        error_type: error.type,
        severity: error.severity,
        error_code: error.code?.toString(),
        error_message: error.message,
        error_context: JSON.stringify(error.context || {}),
        original_error: JSON.stringify(error.originalError || {}),
        user_agent: error.userAgent || c.req.header('User-Agent'),
        url: error.url,
        timestamp: error.timestamp,
        created_at: new Date().toISOString()
      }))
      
      // 批量插入錯誤報告
      for (const report of errorReports) {
        await c.env.DB.prepare(`
          INSERT INTO error_reports (
            user_id, restaurant_id, error_type, severity, error_code,
            error_message, error_context, original_error, user_agent,
            url, timestamp, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          report.user_id,
          report.restaurant_id,
          report.error_type,
          report.severity,
          report.error_code,
          report.error_message,
          report.error_context,
          report.original_error,
          report.user_agent,
          report.url,
          report.timestamp,
          report.created_at
        ).run()
      }
      
      // 對於關鍵錯誤，發送即時通知
      if (significantErrors.length > 0) {
        await sendCriticalErrorNotification(significantErrors, user, c.env)
      }
      
      return c.json({
        success: true,
        message: `Successfully received ${errors.length} error reports`,
        data: {
          total_errors: errors.length,
          significant_errors: significantErrors.length,
          report_id: Date.now().toString()
        }
      })
      
    } catch (error) {
      console.error('Error report submission failed:', error)
      return c.json({
        success: false,
        error: {
          code: 'ERROR_REPORT_FAILED',
          message: 'Failed to submit error report'
        }
      }, 500)
    }
  }
)

/**
 * 系統健康檢查
 * GET /api/v1/system/health
 */
app.get('/health', async (c) => {
  try {
    const healthChecks = await Promise.allSettled([
      // 數據庫健康檢查
      c.env.DB.prepare('SELECT 1').first(),
      
      // KV 健康檢查
      c.env.CACHE_KV ? c.env.CACHE_KV.get('health-check') : Promise.resolve(null),
      
      // R2 健康檢查（如果配置了）
      // c.env.IMAGES_BUCKET ? c.env.IMAGES_BUCKET.head('health-check') : Promise.resolve(null)
    ])
    
    const dbStatus = healthChecks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy'
    const kvStatus = healthChecks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy'
    
    const overallStatus = dbStatus === 'healthy' && kvStatus === 'healthy' ? 'healthy' : 'degraded'
    
    return c.json({
      success: true,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: dbStatus,
          latency: 'N/A'
        },
        cache: {
          status: kvStatus,
          latency: 'N/A'
        },
        memory: {
          status: 'healthy',
          usage: 'N/A'
        }
      },
      version: '1.0.0',
      uptime: 'N/A' // Cloudflare Workers 沒有持續運行時間概念
    })
    
  } catch (error) {
    console.error('Health check failed:', error)
    return c.json({
      success: false,
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

/**
 * 獲取錯誤統計
 * GET /api/v1/system/error-stats
 */
app.get('/error-stats',
  authMiddleware,
  requireRole([0, 1]), // 管理員和店主
  async (c) => {
    try {
      const user = c.get('user')
      
      let whereConditions = ['1=1']
      let params: any[] = []
      
      // 店主只能看自己餐廳的錯誤統計
      if (user.role === 1) {
        whereConditions.push('restaurant_id = ?')
        params.push(user.restaurantId)
      }
      
      const whereClause = whereConditions.join(' AND ')
      
      // 獲取過去24小時的錯誤統計
      const last24hStats = await c.env.DB.prepare(`
        SELECT 
          error_type,
          severity,
          COUNT(*) as error_count,
          MAX(timestamp) as latest_error
        FROM error_reports 
        WHERE ${whereClause} AND timestamp >= datetime('now', '-24 hours')
        GROUP BY error_type, severity
        ORDER BY error_count DESC
      `).bind(...params).all()
      
      // 獲取過去7天的錯誤趨勢
      const weeklyTrend = await c.env.DB.prepare(`
        SELECT 
          DATE(timestamp) as error_date,
          error_type,
          COUNT(*) as error_count
        FROM error_reports 
        WHERE ${whereClause} AND timestamp >= datetime('now', '-7 days')
        GROUP BY DATE(timestamp), error_type
        ORDER BY error_date DESC, error_count DESC
      `).bind(...params).all()
      
      // 獲取最常見的錯誤
      const commonErrors = await c.env.DB.prepare(`
        SELECT 
          error_message,
          error_type,
          severity,
          COUNT(*) as occurrence_count,
          MAX(timestamp) as latest_occurrence
        FROM error_reports 
        WHERE ${whereClause} AND timestamp >= datetime('now', '-7 days')
        GROUP BY error_message, error_type, severity
        HAVING occurrence_count >= 3
        ORDER BY occurrence_count DESC
        LIMIT 10
      `).bind(...params).all()
      
      // 受影響用戶統計
      const affectedUsers = await c.env.DB.prepare(`
        SELECT 
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(*) as total_errors
        FROM error_reports 
        WHERE ${whereClause} AND timestamp >= datetime('now', '-24 hours')
      `).bind(...params).first()
      
      return c.json({
        success: true,
        data: {
          summary: {
            total_errors_24h: affectedUsers?.total_errors || 0,
            unique_users_affected: affectedUsers?.unique_users || 0,
            error_rate: 0 // 需要根據總請求數計算
          },
          stats_24h: last24hStats.results || [],
          weekly_trend: weeklyTrend.results || [],
          common_errors: commonErrors.results || []
        }
      })
      
    } catch (error) {
      console.error('Get error stats failed:', error)
      return c.json({
        success: false,
        error: {
          code: 'GET_ERROR_STATS_FAILED',
          message: 'Failed to get error statistics'
        }
      }, 500)
    }
  }
)

/**
 * 清理舊的錯誤報告
 * DELETE /api/v1/system/error-reports/cleanup
 */
app.delete('/error-reports/cleanup',
  authMiddleware,
  requireRole([0]), // 僅管理員
  async (c) => {
    try {
      // 刪除超過30天的錯誤報告
      const result = await c.env.DB.prepare(`
        DELETE FROM error_reports 
        WHERE created_at < datetime('now', '-30 days')
      `).run()
      
      return c.json({
        success: true,
        message: `Cleaned up ${result.changes} old error reports`,
        data: {
          deleted_count: result.changes
        }
      })
      
    } catch (error) {
      console.error('Error reports cleanup failed:', error)
      return c.json({
        success: false,
        error: {
          code: 'CLEANUP_FAILED',
          message: 'Failed to cleanup error reports'
        }
      }, 500)
    }
  }
)

// 輔助函數：發送關鍵錯誤通知
async function sendCriticalErrorNotification(errors: any[], user: any, env: Env) {
  try {
    // 這裡可以集成 Slack、Discord、Email 等通知服務
    const errorSummary = errors.map(error => 
      `[${error.severity.toUpperCase()}] ${error.type}: ${error.message}`
    ).join('\n')
    
    const notificationPayload = {
      text: `🚨 關鍵錯誤報告`,
      attachments: [
        {
          color: 'danger',
          fields: [
            {
              title: '用戶',
              value: `${user.username} (ID: ${user.id})`,
              short: true
            },
            {
              title: '餐廳',
              value: `ID: ${user.restaurantId}`,
              short: true
            },
            {
              title: '錯誤數量',
              value: errors.length.toString(),
              short: true
            },
            {
              title: '時間',
              value: new Date().toISOString(),
              short: true
            },
            {
              title: '錯誤詳情',
              value: errorSummary,
              short: false
            }
          ]
        }
      ]
    }
    
    // 如果配置了 Slack Webhook，發送通知
    if (env.SLACK_WEBHOOK_URL) {
      await fetch(env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationPayload)
      })
    }
    
    console.log('Critical error notification sent')
    
  } catch (error) {
    console.error('Failed to send critical error notification:', error)
  }
}

export default app