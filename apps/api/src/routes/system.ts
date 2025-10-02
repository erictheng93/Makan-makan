import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../middleware/auth'
import { validateBody } from '../middleware/validation'
import { createDatabase, ErrorReportingService, sql, type CreateErrorReportData } from '@makanmakan/database'
import type { Env } from '../types/env'
import type { TrackedError, PerformanceReport } from '@makanmakan/utils'

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
  validateBody(errorReportSchema),
  async (c) => {
    try {
      const { errors } = c.get('validatedBody')
      const user = c.get('user')
      
      console.log(`Received ${errors.length} error reports from user ${user.id}`)
      
      // 過濾掉低嚴重性的錯誤（可選）
      const significantErrors = errors.filter((error: any) => 
        error.severity === 'high' || error.severity === 'critical'
      )
      
      const errorReportingService = new ErrorReportingService(c.env.DB as any, c.env)
      
      // 準備錯誤報告資料
      const errorReportsData: CreateErrorReportData[] = errors.map((error: any) => ({
        userId: user.id,
        restaurantId: user.restaurantId,
        errorType: error.type,
        severity: error.severity,
        errorCode: error.code?.toString(),
        errorMessage: error.message,
        errorContext: error.context,
        originalError: error.originalError,
        userAgent: error.userAgent || c.req.header('User-Agent'),
        url: error.url,
        timestamp: error.timestamp
      }))
      
      // 批量創建錯誤報告
      await errorReportingService.createBulkErrorReports(errorReportsData)
      
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
      (async () => {
        const db = createDatabase(c.env.DB)
        const result = await db.select({ test: sql<number>`1` }).from(sql`(SELECT 1)`).limit(1)
        return result[0]
      })(),
      
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
      
      const errorReportingService = new ErrorReportingService(c.env.DB as any, c.env)
      
      // 確定範圍
      const now = new Date()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      
      // 獲取統計資料
      const stats = await errorReportingService.getErrorStats(
        user.role === 1 ? user.restaurantId : undefined,
        [yesterday, now]
      )
      
      // 獲取最常見的錯誤
      const commonErrors = await errorReportingService.getCommonErrors(
        user.role === 1 ? user.restaurantId : undefined,
        10
      )
      
      return c.json({
        success: true,
        data: {
          summary: {
            total_errors_24h: stats.totalErrors,
            unique_users_affected: stats.uniqueUsers,
            error_rate: 0 // 需要根據總請求數計算
          },
          stats_24h: Object.entries(stats.errorsByType).map(([type, count]) => ({
            error_type: type,
            error_count: count
          })),
          weekly_trend: stats.errorTrend,
          common_errors: commonErrors || []
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
      const errorReportingService = new ErrorReportingService(c.env.DB as any, c.env)
      
      // 清理舉30天的錯誤報告
      const deletedCount = await errorReportingService.cleanupOldErrorReports(30)
      
      return c.json({
        success: true,
        message: `Cleaned up ${deletedCount} old error reports`,
        data: {
          deleted_count: deletedCount
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

/**
 * Enhanced error tracking endpoint (new format)
 * POST /api/v1/system/errors
 */
app.post('/errors', async (c) => {
  try {
    const error: TrackedError = await c.req.json()

    console.log(`[ErrorTracker] Received error: ${error.id} (${error.severity})`)

    // Store in KV for quick access
    const kv = c.env.CACHE_KV
    if (kv) {
      const key = `error:${error.id}`
      await kv.put(key, JSON.stringify(error), {
        expirationTtl: 60 * 60 * 24 * 7 // 7 days
      })
    }

    // Store in D1 for long-term storage
    const db = c.env.DB
    if (db) {
      try {
        await db.prepare(`
          INSERT INTO error_reports (
            error_id, severity, category, message, stack,
            context, breadcrumbs, occurrence_count, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          error.id,
          error.severity,
          error.category,
          error.message,
          error.stack || '',
          JSON.stringify(error.context),
          JSON.stringify(error.breadcrumbs),
          error.occurrenceCount,
          new Date(error.timestamp).toISOString()
        ).run()
      } catch (dbError) {
        console.error('[ErrorTracker] Failed to store in D1:', dbError)
      }
    }

    // Send critical error notifications
    if (error.severity === 'critical') {
      await sendErrorNotification(error, c.env)
    }

    return c.json({ success: true, errorId: error.id })
  } catch (error) {
    console.error('[ErrorTracker] Failed to process error:', error)
    return c.json({ success: false, error: 'Failed to process error' }, 500)
  }
})

/**
 * Performance monitoring endpoint
 * POST /api/v1/system/performance
 */
app.post('/performance', async (c) => {
  try {
    const report: PerformanceReport = await c.req.json()

    console.log(`[PerformanceMonitor] Received report from ${report.url}`)

    // Store in KV for quick access
    const kv = c.env.CACHE_KV
    if (kv) {
      const key = `perf:${report.timestamp}`
      await kv.put(key, JSON.stringify(report), {
        expirationTtl: 60 * 60 * 24 // 24 hours
      })
    }

    // Store aggregated metrics in D1
    const db = c.env.DB
    if (db) {
      try {
        // Store web vitals
        if (report.webVitals) {
          await db.prepare(`
            INSERT INTO performance_metrics (
              url, user_agent, lcp, fid, cls, fcp, ttfb, tti, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            report.url,
            report.userAgent,
            report.webVitals.LCP || null,
            report.webVitals.FID || null,
            report.webVitals.CLS || null,
            report.webVitals.FCP || null,
            report.webVitals.TTFB || null,
            report.webVitals.TTI || null,
            new Date(report.timestamp).toISOString()
          ).run()
        }
      } catch (dbError) {
        console.error('[PerformanceMonitor] Failed to store in D1:', dbError)
      }
    }

    return c.json({ success: true, timestamp: report.timestamp })
  } catch (error) {
    console.error('[PerformanceMonitor] Failed to process report:', error)
    return c.json({ success: false, error: 'Failed to process report' }, 500)
  }
})

/**
 * Get recent errors
 * GET /api/v1/system/errors
 */
app.get('/errors',
  authMiddleware,
  requireRole([0, 1]), // Admin and Owner
  async (c) => {
    try {
      const limit = Number(c.req.query('limit')) || 50

      const db = c.env.DB
      const result = await db.prepare(`
        SELECT * FROM error_reports
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(limit).all()

      return c.json({
        success: true,
        data: result.results || [],
        count: result.results?.length || 0
      })
    } catch (error) {
      console.error('[ErrorTracker] Failed to get errors:', error)
      return c.json({ success: false, error: 'Failed to get errors' }, 500)
    }
  }
)

/**
 * Get performance metrics
 * GET /api/v1/system/performance
 */
app.get('/performance',
  authMiddleware,
  requireRole([0, 1]), // Admin and Owner
  async (c) => {
    try {
      const hours = Number(c.req.query('hours')) || 24
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

      const db = c.env.DB
      const result = await db.prepare(`
        SELECT
          AVG(lcp) as avg_lcp,
          AVG(fid) as avg_fid,
          AVG(cls) as avg_cls,
          AVG(fcp) as avg_fcp,
          AVG(ttfb) as avg_ttfb,
          AVG(tti) as avg_tti,
          COUNT(*) as sample_count
        FROM performance_metrics
        WHERE timestamp > ?
      `).bind(since).first()

      return c.json({
        success: true,
        data: result || {},
        period: `${hours} hours`
      })
    } catch (error) {
      console.error('[PerformanceMonitor] Failed to get metrics:', error)
      return c.json({ success: false, error: 'Failed to get metrics' }, 500)
    }
  }
)

// Send error notification helper
async function sendErrorNotification(error: TrackedError, env: Env): Promise<void> {
  try {
    if (env.SLACK_WEBHOOK_URL) {
      await fetch(env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Critical Error Detected`,
          attachments: [{
            color: 'danger',
            fields: [
              { title: 'Error ID', value: error.id, short: true },
              { title: 'Severity', value: error.severity, short: true },
              { title: 'Category', value: error.category, short: true },
              { title: 'Occurrences', value: error.occurrenceCount.toString(), short: true },
              { title: 'Message', value: error.message, short: false },
              { title: 'Stack', value: error.stack?.substring(0, 500) || 'N/A', short: false }
            ]
          }]
        })
      })
    }
  } catch (notifyError) {
    console.error('[ErrorTracker] Failed to send notification:', notifyError)
  }
}

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