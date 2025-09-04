/**
 * 監控和警報管理 API
 * 提供系統監控、指標查詢和警報管理功能
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../middleware/auth'
import { validateBody, validateQuery } from '../middleware/validation'
import { createMonitoringService, DEFAULT_ALERT_RULES } from '../services/MonitoringService'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 驗證 schemas
const alertRuleSchema = z.object({
  name: z.string().min(1).max(100),
  condition: z.string().min(1).max(500),
  metric: z.string().min(1).max(100),
  operator: z.enum(['>', '<', '>=', '<=', '=']),
  threshold: z.number(),
  duration: z.number().int().positive().max(3600),
  config: z.object({
    type: z.enum(['email', 'slack', 'webhook', 'sms']),
    severity: z.enum(['info', 'warning', 'critical', 'fatal']),
    enabled: z.boolean(),
    interval: z.number().int().positive().optional(),
    recipients: z.array(z.string()).optional(),
    webhookUrl: z.string().url().optional(),
    template: z.string().optional()
  })
})

const recordErrorSchema = z.object({
  type: z.string().min(1).max(50),
  message: z.string().min(1).max(1000),
  severity: z.enum(['info', 'warning', 'critical', 'fatal']),
  metadata: z.record(z.any()).optional()
})

const metricsQuerySchema = z.object({
  period: z.enum(['1h', '6h', '24h', '7d', '30d']).optional().default('24h'),
  granularity: z.enum(['1m', '5m', '15m', '1h', '6h']).optional().default('15m')
})

// 獲取系統健康狀態
app.get('/health',
  async (c) => {
    try {
      const monitoringService = createMonitoringService(c.env.CACHE_KV)
      const healthStatus = await monitoringService.getHealthStatus()
      
      // 根據健康狀態設置響應碼
      let statusCode = 200
      if (healthStatus.overall === 'critical' || healthStatus.overall === 'down') {
        statusCode = 503
      } else if (healthStatus.overall === 'warning') {
        statusCode = 200 // 警告狀態仍可服務
      }
      
      return c.json(healthStatus, statusCode as any)
    } catch (error) {
      console.error('Health check error:', error)
      return c.json({
        overall: 'down',
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: Date.now()
      }, 503)
    }
  }
)

// 獲取系統指標（管理員專用）
app.get('/metrics',
  authMiddleware,
  requireRole([0]), // 僅管理員
  validateQuery(metricsQuerySchema),
  async (c) => {
    try {
      const { period, granularity } = c.get('validatedQuery')
      const monitoringService = createMonitoringService(c.env.CACHE_KV)
      const metrics = await monitoringService.getMetrics()
      
      // 添加時間範圍和粒度信息
      const enhancedMetrics = {
        ...metrics,
        query: {
          period,
          granularity,
          timestamp: Date.now()
        },
        summary: {
          totalRequestsLastHour: metrics.apiMetrics.totalRequests,
          errorRatePercentage: (metrics.apiMetrics.errorRate * 100).toFixed(2),
          averageResponseTimeMs: metrics.apiMetrics.averageResponseTime.toFixed(2),
          cacheHitRatePercentage: (metrics.cacheMetrics.hitRate * 100).toFixed(2),
          totalErrorsLastHour: metrics.errorMetrics.totalErrors
        }
      }
      
      return c.json({
        success: true,
        data: enhancedMetrics
      })
    } catch (error) {
      console.error('Get metrics error:', error)
      return c.json({
        success: false,
        error: 'Failed to retrieve metrics'
      }, 500)
    }
  }
)

// 重置系統指標（管理員專用）
app.delete('/metrics',
  authMiddleware,
  requireRole([0]), // 僅管理員
  async (c) => {
    try {
      const monitoringService = createMonitoringService(c.env.CACHE_KV)
      await monitoringService.resetMetrics()
      
      console.log('System metrics reset by admin')
      
      return c.json({
        success: true,
        message: 'System metrics reset successfully',
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('Reset metrics error:', error)
      return c.json({
        success: false,
        error: 'Failed to reset metrics'
      }, 500)
    }
  }
)

// 手動記錄錯誤（管理員和開發者專用）
app.post('/errors',
  authMiddleware,
  requireRole([0]), // 僅管理員
  validateBody(recordErrorSchema),
  async (c) => {
    try {
      const { type, message, severity, metadata } = c.get('validatedBody')
      const monitoringService = createMonitoringService(c.env.CACHE_KV)
      
      await monitoringService.recordError(type, message, severity)
      
      console.log(`Manual error recorded: [${severity.toUpperCase()}] ${type}: ${message}`)
      
      return c.json({
        success: true,
        data: {
          type,
          message,
          severity,
          metadata,
          timestamp: Date.now()
        }
      }, 201)
    } catch (error) {
      console.error('Record error failed:', error)
      return c.json({
        success: false,
        error: 'Failed to record error'
      }, 500)
    }
  }
)

// 創建警報規則（管理員專用）
app.post('/alerts/rules',
  authMiddleware,
  requireRole([0]), // 僅管理員
  validateBody(alertRuleSchema),
  async (c) => {
    try {
      const ruleData = c.get('validatedBody')
      const monitoringService = createMonitoringService(c.env.CACHE_KV)
      
      const ruleId = await monitoringService.createAlertRule(ruleData)
      
      console.log(`Alert rule created: ${ruleData.name} (${ruleId})`)
      
      return c.json({
        success: true,
        data: {
          id: ruleId,
          ...ruleData,
          created: Date.now()
        }
      }, 201)
    } catch (error) {
      console.error('Create alert rule error:', error)
      return c.json({
        success: false,
        error: 'Failed to create alert rule'
      }, 500)
    }
  }
)

// 獲取預設警報規則
app.get('/alerts/defaults',
  authMiddleware,
  requireRole([0]), // 僅管理員
  async (c) => {
    try {
      return c.json({
        success: true,
        data: {
          rules: DEFAULT_ALERT_RULES,
          count: DEFAULT_ALERT_RULES.length,
          description: 'Default alert rules for system monitoring'
        }
      })
    } catch (error) {
      console.error('Get default alert rules error:', error)
      return c.json({
        success: false,
        error: 'Failed to retrieve default alert rules'
      }, 500)
    }
  }
)

// 系統狀態概覽（管理員專用）
app.get('/overview',
  authMiddleware,
  requireRole([0]), // 僅管理員
  async (c) => {
    try {
      const monitoringService = createMonitoringService(c.env.CACHE_KV)
      const [healthStatus, metrics] = await Promise.all([
        monitoringService.getHealthStatus(),
        monitoringService.getMetrics()
      ])
      
      const overview = {
        status: healthStatus.overall,
        uptime: healthStatus.uptime,
        version: healthStatus.version,
        timestamp: Date.now(),
        
        // 關鍵指標摘要
        keyMetrics: {
          requestsPerMinute: Math.round(metrics.apiMetrics.requestsPerSecond * 60),
          errorRate: `${(metrics.apiMetrics.errorRate * 100).toFixed(2)}%`,
          averageResponseTime: `${metrics.apiMetrics.averageResponseTime.toFixed(0)}ms`,
          cacheHitRate: `${(metrics.cacheMetrics.hitRate * 100).toFixed(1)}%`,
          activeErrors: metrics.errorMetrics.totalErrors
        },
        
        // 組件狀態
        components: Object.entries(healthStatus.components).map(([name, component]) => ({
          name,
          status: component.status,
          latency: component.latency,
          issues: component.issues.length,
          lastCheck: component.lastCheck
        })),
        
        // 前5個錯誤類型
        topErrors: Object.entries(metrics.errorMetrics.errorsByType)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([type, count]) => ({ type, count })),
        
        // 性能趨勢（簡化）
        trends: {
          responseTime: {
            current: metrics.apiMetrics.averageResponseTime,
            p95: metrics.apiMetrics.p95ResponseTime,
            p99: metrics.apiMetrics.p99ResponseTime
          },
          throughput: {
            requestsPerSecond: metrics.apiMetrics.requestsPerSecond,
            totalRequests: metrics.apiMetrics.totalRequests
          }
        }
      }
      
      return c.json({
        success: true,
        data: overview
      })
    } catch (error) {
      console.error('Get monitoring overview error:', error)
      return c.json({
        success: false,
        error: 'Failed to retrieve monitoring overview'
      }, 500)
    }
  }
)

// 測試警報系統（管理員專用）
app.post('/alerts/test',
  authMiddleware,
  requireRole([0]), // 僅管理員
  validateBody(z.object({
    type: z.enum(['slack', 'webhook']),
    severity: z.enum(['info', 'warning', 'critical', 'fatal']),
    webhookUrl: z.string().url().optional()
  })),
  async (c) => {
    try {
      const { type, severity, webhookUrl } = c.get('validatedBody')
      const monitoringService = createMonitoringService(c.env.CACHE_KV)
      
      // 創建測試警報規則
      await monitoringService.createAlertRule({
        name: 'Test Alert',
        condition: 'manual_test',
        metric: 'test.value',
        operator: '>',
        threshold: 0,
        duration: 0,
        config: {
          type,
          severity,
          enabled: true,
          webhookUrl: webhookUrl || c.env.SLACK_WEBHOOK_URL
        }
      })
      
      // 觸發測試錯誤
      await monitoringService.recordError(
        'test_alert',
        `Test alert triggered - ${type} notification with ${severity} severity`,
        severity
      )
      
      return c.json({
        success: true,
        data: {
          message: 'Test alert sent successfully',
          type,
          severity,
          timestamp: Date.now()
        }
      })
    } catch (error) {
      console.error('Test alert error:', error)
      return c.json({
        success: false,
        error: 'Failed to send test alert'
      }, 500)
    }
  }
)

// 獲取系統性能報告（管理員專用）
app.get('/reports/performance',
  authMiddleware,
  requireRole([0]), // 僅管理員
  validateQuery(z.object({
    days: z.string().regex(/^\d+$/).transform(Number).optional().default('7')
  })),
  async (c) => {
    try {
      const { days } = c.get('validatedQuery')
      const monitoringService = createMonitoringService(c.env.CACHE_KV)
      const metrics = await monitoringService.getMetrics()
      
      const report = {
        period: `${days} days`,
        generatedAt: Date.now(),
        
        // API 性能摘要
        apiPerformance: {
          totalRequests: metrics.apiMetrics.totalRequests,
          averageResponseTime: metrics.apiMetrics.averageResponseTime,
          p95ResponseTime: metrics.apiMetrics.p95ResponseTime,
          p99ResponseTime: metrics.apiMetrics.p99ResponseTime,
          errorRate: (metrics.apiMetrics.errorRate * 100).toFixed(2) + '%',
          slowRequests: metrics.apiMetrics.slowRequestCount
        },
        
        // 數據庫性能
        databasePerformance: {
          totalQueries: metrics.databaseMetrics.queryCount,
          averageQueryTime: metrics.databaseMetrics.averageQueryTime,
          slowQueries: metrics.databaseMetrics.slowQueryCount,
          queryErrorRate: (metrics.databaseMetrics.errorCount / Math.max(metrics.databaseMetrics.queryCount, 1) * 100).toFixed(2) + '%'
        },
        
        // 快取性能
        cachePerformance: {
          hitRate: (metrics.cacheMetrics.hitRate * 100).toFixed(2) + '%',
          totalKeys: metrics.cacheMetrics.totalKeys,
          totalSize: `${(metrics.cacheMetrics.totalSize / 1024 / 1024).toFixed(2)} MB`,
          expiringKeys: metrics.cacheMetrics.expiringKeysCount
        },
        
        // 錯誤分析
        errorAnalysis: {
          totalErrors: metrics.errorMetrics.totalErrors,
          criticalErrors: metrics.errorMetrics.criticalErrors,
          warningsCount: metrics.errorMetrics.warningCount,
          errorsByType: Object.entries(metrics.errorMetrics.errorsByType)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([type, count]) => ({ type, count, percentage: ((count / metrics.errorMetrics.totalErrors) * 100).toFixed(1) + '%' }))
        },
        
        // 建議
        recommendations: generateRecommendations(metrics)
      }
      
      return c.json({
        success: true,
        data: report
      })
    } catch (error) {
      console.error('Generate performance report error:', error)
      return c.json({
        success: false,
        error: 'Failed to generate performance report'
      }, 500)
    }
  }
)

// 輔助函數

/**
 * 根據指標生成改進建議
 */
function generateRecommendations(metrics: any): string[] {
  const recommendations: string[] = []
  
  // API 性能建議
  if (metrics.apiMetrics.averageResponseTime > 1000) {
    recommendations.push('考慮優化 API 響應時間，目前平均響應時間較高')
  }
  
  if (metrics.apiMetrics.errorRate > 0.05) {
    recommendations.push('API 錯誤率較高，建議檢查錯誤日誌並修復常見問題')
  }
  
  // 數據庫建議
  if (metrics.databaseMetrics.averageQueryTime > 500) {
    recommendations.push('數據庫查詢時間較長，建議優化慢查詢或增加索引')
  }
  
  if (metrics.databaseMetrics.slowQueryCount > metrics.databaseMetrics.queryCount * 0.1) {
    recommendations.push('慢查詢比例較高，建議檢查並優化數據庫查詢')
  }
  
  // 快取建議
  if (metrics.cacheMetrics.hitRate < 0.6) {
    recommendations.push('快取命中率較低，建議檢查快取策略和 TTL 設置')
  }
  
  if (metrics.cacheMetrics.totalSize > 100 * 1024 * 1024) { // 100MB
    recommendations.push('快取大小較大，建議實施快取清理策略')
  }
  
  // 錯誤建議
  if (metrics.errorMetrics.criticalErrors > 0) {
    recommendations.push('存在嚴重錯誤，建議優先處理並設置監控警報')
  }
  
  if (recommendations.length === 0) {
    recommendations.push('系統運行良好，繼續保持當前的監控和維護實踐')
  }
  
  return recommendations
}

export default app