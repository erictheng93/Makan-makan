/**
 * 監控中間件
 * 自動收集 API 請求指標和效能數據
 */

import { Context, Next } from 'hono'
import { createMonitoringService } from '../services/MonitoringService'
import type { Env } from '../types/env'

// 請求指標收集中間件
export function metricsMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const startTime = Date.now()
    const monitoringService = createMonitoringService(c.env.CACHE_KV)
    
    try {
      await next()
    } catch (error) {
      // 記錄錯誤
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await monitoringService.recordError('api_exception', errorMessage, 'critical')
      throw error
    } finally {
      try {
        const endTime = Date.now()
        const responseTime = endTime - startTime
        const statusCode = c.res.status
        const endpoint = c.req.path
        
        // 記錄 API 請求指標
        await monitoringService.recordApiRequest(responseTime, statusCode, endpoint)
        
        // 添加監控響應頭
        c.header('X-Response-Time', responseTime.toString())
        c.header('X-Request-ID', generateRequestId())
        
        // 如果響應時間過長，記錄警告
        if (responseTime > 2000) {
          await monitoringService.recordError(
            'slow_request',
            `Slow request: ${endpoint} took ${responseTime}ms`,
            'warning'
          )
        }
      } catch (metricError) {
        console.error('Metrics collection error:', metricError)
      }
    }
  }
}

// 數據庫監控中間件
export function databaseMonitoringMiddleware() {
  return async (_c: Context<{ Bindings: Env }>, next: Next) => {
    // 簡化數據庫監控 - 避免複雜的方法重載包裝
    // 在實際應用中，可以使用外部監控工具如 Sentry 或 Cloudflare Analytics
    // 這裡提供一個基本的計時示例
    console.log('Database monitoring middleware active')
    
    await next()
  }
}

// 錯誤監控中間件
export function errorMonitoringMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    try {
      await next()
    } catch (error) {
      const monitoringService = createMonitoringService(c.env.CACHE_KV)
      
      // 根據錯誤類型和狀態碼確定嚴重程度
      const statusCode = c.res.status || 500
      let severity: 'info' | 'warning' | 'critical' | 'fatal' = 'warning'
      
      if (statusCode >= 500) {
        severity = 'critical'
      } else if (statusCode >= 400) {
        severity = 'warning'
      }
      
      // 特殊錯誤類型處理
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
          severity = 'critical'
        } else if (error.message.includes('database') || error.message.includes('DATABASE')) {
          severity = 'critical'
        } else if (error.message.includes('auth') || error.message.includes('permission')) {
          severity = 'warning'
        }
      }
      
      const errorType = getErrorType(error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      await monitoringService.recordError(errorType, errorMessage, severity)
      
      // 重新拋出錯誤讓全域錯誤處理器處理
      throw error
    }
  }
}

// 健康檢查中間件
export function healthCheckMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    // 只對健康檢查端點應用
    if (!c.req.path.includes('/health')) {
      return await next()
    }
    
    const monitoringService = createMonitoringService(c.env.CACHE_KV)
    
    try {
      // 獲取系統健康狀態
      const healthStatus = await monitoringService.getHealthStatus()
      
      // 設置適當的 HTTP 狀態碼
      let httpStatus = 200
      switch (healthStatus.overall) {
        case 'warning':
          httpStatus = 200 // 仍然可服務，但有警告
          break
        case 'critical':
          httpStatus = 503 // 服務不可用
          break
        case 'down':
          httpStatus = 503 // 服務完全停止
          break
        default:
          httpStatus = 200
      }
      
      // 將健康狀態附加到上下文
      (c as any).set('healthStatus', healthStatus)
      c.status(httpStatus as any)
      
      await next()
    } catch (error) {
      await monitoringService.recordError('health_check', 'Health check failed', 'critical')
      throw error
    }
  }
}

// 性能監控中間件
export function performanceMonitoringMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const monitoringService = createMonitoringService(c.env.CACHE_KV)
    
    // 收集請求開始時的資源使用情況
    const startMemory = process.memoryUsage?.()?.heapUsed || 0
    const startTime = process.hrtime?.() || [0, 0]
    
    try {
      await next()
    } finally {
      try {
        // 計算資源使用變化
        const endMemory = process.memoryUsage?.()?.heapUsed || 0
        const endTime = process.hrtime?.(startTime) || [0, 0]
        const cpuTime = endTime[0] * 1000 + endTime[1] * 1e-6 // 轉換為毫秒
        
        const memoryDelta = endMemory - startMemory
        
        // 記錄資源使用異常
        if (memoryDelta > 50 * 1024 * 1024) { // 超過50MB
          await monitoringService.recordError(
            'memory_leak',
            `High memory usage: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`,
            'warning'
          )
        }
        
        if (cpuTime > 1000) { // 超過1秒CPU時間
          await monitoringService.recordError(
            'cpu_intensive',
            `High CPU usage: ${cpuTime.toFixed(2)}ms`,
            'warning'
          )
        }
      } catch (perfError) {
        console.error('Performance monitoring error:', perfError)
      }
    }
  }
}

// 快取監控增強
export function cacheMonitoringMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const monitoringService = createMonitoringService(c.env.CACHE_KV)
    
    // 監控快取操作
    const originalGet = c.env.CACHE_KV.get.bind(c.env.CACHE_KV)
    const originalPut = c.env.CACHE_KV.put.bind(c.env.CACHE_KV)
    const originalDelete = c.env.CACHE_KV.delete.bind(c.env.CACHE_KV)
    
    let cacheHits = 0
    let cacheMisses = 0;
    
    (c.env.CACHE_KV as any).get = async (key: string, options?: any) => {
      const result = await originalGet(key, options)
      if (result !== null) {
        cacheHits++
      } else {
        cacheMisses++
      }
      return result
    }
    
    (c.env.CACHE_KV as any).put = async (key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: any) => {
      const result = await originalPut(key, value, options)
      return result
    }
    
    (c.env.CACHE_KV as any).delete = async (key: string) => {
      const result = await originalDelete(key)
      return result
    }
    
    await next()
    
    // 記錄快取統計
    if (cacheHits + cacheMisses > 0) {
      const hitRate = cacheHits / (cacheHits + cacheMisses)
      
      try {
        const list = await c.env.CACHE_KV.list({ limit: 1 })
        const totalKeys = list.keys.length
        
        await monitoringService.recordCacheMetrics(hitRate, totalKeys, 0)
      } catch (error) {
        console.error('Cache monitoring error:', error)
      }
    }
  }
}

// 輔助函數

/**
 * 生成請求 ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 根據錯誤確定類型
 */
function getErrorType(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    
    if (message.includes('database') || message.includes('sql')) {
      return 'database_error'
    } else if (message.includes('auth') || message.includes('unauthorized')) {
      return 'auth_error'
    } else if (message.includes('validation') || message.includes('invalid')) {
      return 'validation_error'
    } else if (message.includes('timeout')) {
      return 'timeout_error'
    } else if (message.includes('network') || message.includes('fetch')) {
      return 'network_error'
    }
  }
  
  return 'unknown_error'
}

// 監控統計輔助中間件
export function monitoringStatsMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    await next()
    
    // 在響應頭中添加監控統計（僅開發環境）
    if (c.env.NODE_ENV === 'development') {
      try {
        const monitoringService = createMonitoringService(c.env.CACHE_KV)
        const metrics = await monitoringService.getMetrics()
        
        c.header('X-Monitoring-Requests', metrics.apiMetrics.totalRequests.toString())
        c.header('X-Monitoring-Errors', metrics.errorMetrics.totalErrors.toString())
        c.header('X-Monitoring-Avg-Response', metrics.apiMetrics.averageResponseTime.toFixed(2))
        c.header('X-Monitoring-Cache-Hit-Rate', (metrics.cacheMetrics.hitRate * 100).toFixed(2))
      } catch (error) {
        console.error('Monitoring stats error:', error)
      }
    }
  }
}