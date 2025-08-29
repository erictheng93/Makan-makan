import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../middleware/auth'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 健康檢查狀態
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  environment: string
}

interface ServiceCheck {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime?: number
  error?: string
  lastCheck: string
}

interface SystemMetrics {
  memory?: {
    used: number
    total: number
    percentage: number
  }
  cpu?: {
    usage: number
  }
  requests?: {
    total: number
    rps: number // requests per second
    errorRate: number
  }
}

// 模擬系統指標（在實際環境中會從實際系統獲取）
function getSystemMetrics(): SystemMetrics {
  return {
    memory: {
      used: Math.floor(Math.random() * 100) + 50, // MB
      total: 512, // MB
      percentage: Math.floor(Math.random() * 60) + 20
    },
    cpu: {
      usage: Math.floor(Math.random() * 50) + 10
    },
    requests: {
      total: Math.floor(Math.random() * 10000) + 1000,
      rps: Math.floor(Math.random() * 100) + 10,
      errorRate: Math.random() * 2 // 0-2%
    }
  }
}

/**
 * 基本健康檢查 (公開端點)
 * GET /api/v1/health
 */
app.get('/', async (c) => {
  try {
    const startTime = Date.now()
    
    // 檢查資料庫連接
    let dbStatus: ServiceCheck
    try {
      const result = await c.env.DB.prepare('SELECT 1 as test').first()
      const responseTime = Date.now() - startTime
      dbStatus = {
        name: 'database',
        status: result?.test === 1 ? 'healthy' : 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString()
      }
    } catch (error) {
      dbStatus = {
        name: 'database',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date().toISOString()
      }
    }
    
    // 檢查KV存儲
    let kvStatus: ServiceCheck
    try {
      const testKey = `health-check-${Date.now()}`
      await c.env.CACHE_KV.put(testKey, 'test', { expirationTtl: 60 })
      const testValue = await c.env.CACHE_KV.get(testKey)
      const responseTime = Date.now() - startTime
      
      kvStatus = {
        name: 'kv_storage',
        status: testValue === 'test' ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: new Date().toISOString()
      }
      
      // 清理測試數據
      await c.env.CACHE_KV.delete(testKey)
    } catch (error) {
      kvStatus = {
        name: 'kv_storage',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date().toISOString()
      }
    }
    
    // 確定整體狀態
    const services = [dbStatus, kvStatus]
    const unhealthyServices = services.filter(s => s.status === 'unhealthy')
    const degradedServices = services.filter(s => s.status === 'degraded')
    
    let overallStatus: HealthStatus['status'] = 'healthy'
    if (unhealthyServices.length > 0) {
      overallStatus = 'unhealthy'
    } else if (degradedServices.length > 0) {
      overallStatus = 'degraded'
    }
    
    const health: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - startTime, // 簡化的uptime計算
      version: c.env.API_VERSION || 'v1',
      environment: c.env.NODE_ENV || 'development'
    }
    
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503
    
    return c.json({
      success: overallStatus !== 'unhealthy',
      ...health,
      services,
      checks: {
        database: dbStatus.status === 'healthy',
        cache: kvStatus.status === 'healthy'
      }
    }, statusCode)
    
  } catch (error) {
    console.error('Health check error:', error)
    return c.json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 503)
  }
})

/**
 * 詳細系統健康檢查 (需要管理員權限)
 * GET /api/v1/health/detailed
 */
app.get('/detailed',
  authMiddleware,
  requireRole([0]), // 僅管理員
  async (c) => {
    try {
      const startTime = Date.now()
      
      // 執行基本健康檢查
      const basicHealth = await app.request('/health', {
        method: 'GET',
        headers: {
          'Authorization': c.req.header('Authorization') || ''
        }
      })
      const basicData = await basicHealth.json()
      
      // 獲取系統指標
      const metrics = getSystemMetrics()
      
      // 檢查資料庫性能
      const dbPerformanceStart = Date.now()
      const tableStats = await c.env.DB.prepare(`
        SELECT 
          'orders' as table_name,
          COUNT(*) as row_count
        FROM orders
        UNION ALL
        SELECT 
          'users' as table_name,
          COUNT(*) as row_count
        FROM users
        UNION ALL
        SELECT 
          'restaurants' as table_name,
          COUNT(*) as row_count
        FROM restaurants
      `).all()
      const dbPerformanceTime = Date.now() - dbPerformanceStart
      
      // 檢查最近的錯誤日誌
      const recentErrors = await c.env.DB.prepare(`
        SELECT action, resource, details, created_at
        FROM audit_logs 
        WHERE action LIKE '%error%' OR action LIKE '%fail%'
        ORDER BY created_at DESC 
        LIMIT 10
      `).all()
      
      // 檢查系統負載
      const currentTime = new Date()
      const oneHourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000)
      
      const systemLoad = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN created_at >= ? THEN 1 END) as recent_requests,
          COUNT(DISTINCT restaurant_id) as active_restaurants,
          AVG(total) as avg_order_value
        FROM orders
        WHERE created_at >= datetime('now', '-24 hours')
      `).bind(oneHourAgo.toISOString()).first()
      
      // API端點響應時間測試
      const endpointTests = [
        { name: 'restaurants', path: '/api/v1/restaurants?limit=1' },
        { name: 'menu', path: '/api/v1/menu/1' },
        { name: 'orders', path: '/api/v1/orders?limit=1' }
      ]
      
      const endpointHealth = []
      for (const endpoint of endpointTests) {
        const testStart = Date.now()
        try {
          const response = await fetch(`${c.req.url.split('/api')[0]}${endpoint.path}`, {
            method: 'GET',
            headers: {
              'Authorization': c.req.header('Authorization') || '',
              'Content-Type': 'application/json'
            }
          })
          
          const responseTime = Date.now() - testStart
          endpointHealth.push({
            ...endpoint,
            status: response.ok ? 'healthy' : 'degraded',
            responseTime,
            statusCode: response.status
          })
        } catch (error) {
          endpointHealth.push({
            ...endpoint,
            status: 'unhealthy',
            responseTime: Date.now() - testStart,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      // 計算整體系統健康分數 (0-100)
      let healthScore = 100
      
      // 基於各項指標扣分
      if (basicData.status === 'degraded') healthScore -= 20
      if (basicData.status === 'unhealthy') healthScore -= 50
      
      if (metrics.memory && metrics.memory.percentage > 80) healthScore -= 15
      if (metrics.cpu && metrics.cpu.usage > 80) healthScore -= 15
      if (metrics.requests && metrics.requests.errorRate > 5) healthScore -= 20
      
      if (dbPerformanceTime > 1000) healthScore -= 10 // 資料庫響應超過1秒
      
      const unhealthyEndpoints = endpointHealth.filter(e => e.status === 'unhealthy').length
      healthScore -= unhealthyEndpoints * 10
      
      healthScore = Math.max(0, Math.min(100, healthScore))
      
      return c.json({
        success: true,
        overview: basicData,
        metrics,
        performance: {
          database_response_time: dbPerformanceTime,
          table_statistics: tableStats.results || [],
          endpoint_health: endpointHealth
        },
        system_load: systemLoad,
        recent_errors: (recentErrors.results || []).slice(0, 5),
        health_score: Math.round(healthScore),
        recommendations: generateRecommendations(healthScore, metrics, endpointHealth),
        timestamp: new Date().toISOString(),
        total_check_time: Date.now() - startTime
      })
      
    } catch (error) {
      console.error('Detailed health check error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to perform detailed health check'
      }, 500)
    }
  }
)

/**
 * 系統指標端點 (需要管理員權限)
 * GET /api/v1/health/metrics
 */
app.get('/metrics',
  authMiddleware,
  requireRole([0]), // 僅管理員
  validateQuery(z.object({
    format: z.enum(['json', 'prometheus']).optional().default('json')
  })),
  async (c) => {
    try {
      const { format } = c.get('validatedQuery')
      const metrics = getSystemMetrics()
      
      // 獲取業務指標
      const businessMetrics = await c.env.DB.prepare(`
        SELECT 
          COUNT(CASE WHEN created_at >= datetime('now', '-1 hour') THEN 1 END) as orders_last_hour,
          COUNT(CASE WHEN created_at >= datetime('now', '-24 hours') THEN 1 END) as orders_last_24h,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
          COUNT(CASE WHEN status = 'preparing' THEN 1 END) as preparing_orders,
          COUNT(*) as total_orders
        FROM orders
        WHERE created_at >= datetime('now', '-7 days')
      `).first()
      
      if (format === 'prometheus') {
        // Prometheus格式輸出
        const prometheusMetrics = `
# HELP makanmakan_orders_total Total number of orders
# TYPE makanmakan_orders_total counter
makanmakan_orders_total ${businessMetrics?.total_orders || 0}

# HELP makanmakan_orders_pending Number of pending orders
# TYPE makanmakan_orders_pending gauge
makanmakan_orders_pending ${businessMetrics?.pending_orders || 0}

# HELP makanmakan_orders_preparing Number of orders being prepared
# TYPE makanmakan_orders_preparing gauge
makanmakan_orders_preparing ${businessMetrics?.preparing_orders || 0}

# HELP makanmakan_memory_usage_percent Memory usage percentage
# TYPE makanmakan_memory_usage_percent gauge
makanmakan_memory_usage_percent ${metrics.memory?.percentage || 0}

# HELP makanmakan_cpu_usage_percent CPU usage percentage
# TYPE makanmakan_cpu_usage_percent gauge
makanmakan_cpu_usage_percent ${metrics.cpu?.usage || 0}

# HELP makanmakan_requests_per_second Current requests per second
# TYPE makanmakan_requests_per_second gauge
makanmakan_requests_per_second ${metrics.requests?.rps || 0}

# HELP makanmakan_error_rate_percent Current error rate percentage
# TYPE makanmakan_error_rate_percent gauge
makanmakan_error_rate_percent ${metrics.requests?.errorRate || 0}
        `.trim()
        
        c.header('Content-Type', 'text/plain; charset=utf-8')
        return c.text(prometheusMetrics)
      }
      
      // JSON格式輸出
      return c.json({
        success: true,
        timestamp: new Date().toISOString(),
        system_metrics: metrics,
        business_metrics: businessMetrics,
        alert_thresholds: {
          memory_warning: 70,
          memory_critical: 85,
          cpu_warning: 70,
          cpu_critical: 90,
          error_rate_warning: 2,
          error_rate_critical: 5,
          response_time_warning: 1000,
          response_time_critical: 3000
        }
      })
      
    } catch (error) {
      console.error('Metrics error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch metrics'
      }, 500)
    }
  }
)

/**
 * 就緒檢查 (Kubernetes readiness probe)
 * GET /api/v1/health/ready
 */
app.get('/ready', async (c) => {
  try {
    // 檢查關鍵服務是否就緒
    const dbReady = await c.env.DB.prepare('SELECT 1').first()
    const kvReady = await c.env.CACHE_KV.get('health-check') !== undefined ? true : 
                    await c.env.CACHE_KV.put('ready-test', 'ok', { expirationTtl: 60 }) !== undefined
    
    const isReady = !!dbReady && kvReady
    
    if (isReady) {
      return c.json({
        success: true,
        status: 'ready',
        timestamp: new Date().toISOString()
      })
    } else {
      return c.json({
        success: false,
        status: 'not_ready',
        timestamp: new Date().toISOString()
      }, 503)
    }
  } catch (error) {
    return c.json({
      success: false,
      status: 'not_ready',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 503)
  }
})

/**
 * 存活檢查 (Kubernetes liveness probe)
 * GET /api/v1/health/live
 */
app.get('/live', (c) => {
  // 簡單的存活檢查 - 如果能回應就表示存活
  return c.json({
    success: true,
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime ? Math.floor(process.uptime()) : 0
  })
})

// 生成系統建議
function generateRecommendations(
  healthScore: number, 
  metrics: SystemMetrics, 
  endpointHealth: any[]
): string[] {
  const recommendations: string[] = []
  
  if (healthScore < 80) {
    recommendations.push('System health score is below optimal. Consider investigating issues.')
  }
  
  if (metrics.memory && metrics.memory.percentage > 80) {
    recommendations.push('Memory usage is high. Consider scaling up or optimizing memory usage.')
  }
  
  if (metrics.cpu && metrics.cpu.usage > 70) {
    recommendations.push('CPU usage is elevated. Monitor for sustained high usage.')
  }
  
  if (metrics.requests && metrics.requests.errorRate > 3) {
    recommendations.push('Error rate is above acceptable threshold. Check application logs.')
  }
  
  const slowEndpoints = endpointHealth.filter(e => e.responseTime && e.responseTime > 1000)
  if (slowEndpoints.length > 0) {
    recommendations.push(`Slow response times detected on: ${slowEndpoints.map(e => e.name).join(', ')}`)
  }
  
  const unhealthyEndpoints = endpointHealth.filter(e => e.status === 'unhealthy')
  if (unhealthyEndpoints.length > 0) {
    recommendations.push(`Unhealthy endpoints detected: ${unhealthyEndpoints.map(e => e.name).join(', ')}`)
  }
  
  if (recommendations.length === 0) {
    recommendations.push('System is operating normally. No immediate action required.')
  }
  
  return recommendations
}

// 中間件輔助函數
const validateQuery = (schema: z.ZodSchema) => {
  return async (c: any, next: any) => {
    try {
      const query = c.req.query()
      const validated = schema.parse(query)
      c.set('validatedQuery', validated)
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Invalid query parameters',
          details: error.errors
        }, 400)
      }
      throw error
    }
  }
}

export default app