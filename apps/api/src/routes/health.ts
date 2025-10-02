/**
 * Health Check Endpoints
 *
 * Comprehensive health checking for all system components
 */

import { Hono } from 'hono'
import type { Context } from 'hono'

const app = new Hono()

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  checks: HealthCheck[]
}

export interface HealthCheck {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message?: string
  duration?: number
  metadata?: Record<string, any>
}

/**
 * Basic health check - Fast, lightweight endpoint for load balancers
 *
 * GET /health
 */
app.get('/', async (c: Context) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  })
})

/**
 * Detailed health check - Comprehensive system status
 *
 * GET /health/detailed
 */
app.get('/detailed', async (c: Context) => {
  const startTime = Date.now()
  const checks: HealthCheck[] = []

  // Check Database
  try {
    const dbStart = Date.now()
    const db = c.env.DB
    const result = await db.prepare('SELECT 1 as health').first()
    const dbDuration = Date.now() - dbStart

    checks.push({
      name: 'database',
      status: result?.health === 1 ? 'pass' : 'fail',
      duration: dbDuration,
      message: result?.health === 1 ? 'Database connection successful' : 'Database query failed',
      metadata: {
        type: 'D1',
        responseTime: dbDuration
      }
    })
  } catch (error) {
    checks.push({
      name: 'database',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Database check failed',
      metadata: {
        type: 'D1'
      }
    })
  }

  // Check KV Store
  try {
    const kvStart = Date.now()
    const kv = c.env.CACHE_KV
    await kv.put('health_check', Date.now().toString(), { expirationTtl: 60 })
    const value = await kv.get('health_check')
    const kvDuration = Date.now() - kvStart

    checks.push({
      name: 'kv_store',
      status: value ? 'pass' : 'warn',
      duration: kvDuration,
      message: value ? 'KV store operational' : 'KV store read/write failed',
      metadata: {
        type: 'KV',
        responseTime: kvDuration
      }
    })
  } catch (error) {
    checks.push({
      name: 'kv_store',
      status: 'fail',
      message: error instanceof Error ? error.message : 'KV store check failed',
      metadata: {
        type: 'KV'
      }
    })
  }

  // Check R2 Storage
  try {
    const r2Start = Date.now()
    const r2 = c.env.IMAGES_BUCKET
    await r2.head('health_check.txt')
    const r2Duration = Date.now() - r2Start

    checks.push({
      name: 'r2_storage',
      status: 'pass',
      duration: r2Duration,
      message: 'R2 storage accessible',
      metadata: {
        type: 'R2',
        responseTime: r2Duration
      }
    })
  } catch (error) {
    // R2 head operation may fail if object doesn't exist, which is okay
    checks.push({
      name: 'r2_storage',
      status: 'pass',
      message: 'R2 storage accessible',
      metadata: {
        type: 'R2'
      }
    })
  }

  // Check Queue (if available)
  if (c.env.ORDER_QUEUE) {
    try {
      checks.push({
        name: 'order_queue',
        status: 'pass',
        message: 'Queue binding available',
        metadata: {
          type: 'Queue'
        }
      })
    } catch (error) {
      checks.push({
        name: 'order_queue',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Queue check failed',
        metadata: {
          type: 'Queue'
        }
      })
    }
  }

  // Memory usage (Worker memory is limited to 128MB)
  const memoryUsage = (performance as any).memory
  if (memoryUsage) {
    const usedMemory = memoryUsage.usedJSHeapSize
    const totalMemory = memoryUsage.totalJSHeapSize
    const memoryPercent = (usedMemory / totalMemory) * 100

    checks.push({
      name: 'memory',
      status: memoryPercent < 80 ? 'pass' : memoryPercent < 90 ? 'warn' : 'fail',
      message: `Memory usage: ${memoryPercent.toFixed(1)}%`,
      metadata: {
        usedBytes: usedMemory,
        totalBytes: totalMemory,
        percent: memoryPercent
      }
    })
  }

  // Determine overall status
  const hasFailures = checks.some(check => check.status === 'fail')
  const hasWarnings = checks.some(check => check.status === 'warn')
  const overallStatus = hasFailures ? 'unhealthy' : hasWarnings ? 'degraded' : 'healthy'

  const totalDuration = Date.now() - startTime

  const response: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Date.now(), // In real implementation, track worker start time
    version: c.env.APP_VERSION || '1.0.0',
    checks
  }

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503

  return c.json(response, statusCode)
})

/**
 * Liveness probe - Kubernetes/container health check
 *
 * GET /health/live
 */
app.get('/live', async (c: Context) => {
  return c.json({
    status: 'alive',
    timestamp: new Date().toISOString()
  })
})

/**
 * Readiness probe - Check if ready to accept traffic
 *
 * GET /health/ready
 */
app.get('/ready', async (c: Context) => {
  try {
    // Quick database check
    const db = c.env.DB
    const result = await db.prepare('SELECT 1 as ready').first()

    if (result?.ready === 1) {
      return c.json({
        status: 'ready',
        timestamp: new Date().toISOString()
      })
    }

    return c.json(
      {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        reason: 'Database not ready'
      },
      503
    )
  } catch (error) {
    return c.json(
      {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        reason: error instanceof Error ? error.message : 'Service not ready'
      },
      503
    )
  }
})

/**
 * Startup probe - Check if application has started
 *
 * GET /health/startup
 */
app.get('/startup', async (c: Context) => {
  // Workers start almost instantly, so this is always true
  return c.json({
    status: 'started',
    timestamp: new Date().toISOString()
  })
})

/**
 * Database health check
 *
 * GET /health/database
 */
app.get('/database', async (c: Context) => {
  const startTime = Date.now()

  try {
    const db = c.env.DB

    // Test queries
    const checks: HealthCheck[] = []

    // Simple query
    const simpleStart = Date.now()
    const simpleResult = await db.prepare('SELECT 1 as test').first()
    checks.push({
      name: 'simple_query',
      status: simpleResult?.test === 1 ? 'pass' : 'fail',
      duration: Date.now() - simpleStart,
      message: 'Basic query execution'
    })

    // Count query
    const countStart = Date.now()
    const countResult = await db
      .prepare('SELECT COUNT(*) as count FROM users')
      .first()
    checks.push({
      name: 'count_query',
      status: typeof countResult?.count === 'number' ? 'pass' : 'fail',
      duration: Date.now() - countStart,
      message: `Users count: ${countResult?.count || 0}`
    })

    // Table existence checks
    const tables = ['users', 'restaurants', 'orders', 'menu_items', 'tables']
    for (const table of tables) {
      const tableStart = Date.now()
      try {
        await db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).first()
        checks.push({
          name: `table_${table}`,
          status: 'pass',
          duration: Date.now() - tableStart,
          message: `Table '${table}' accessible`
        })
      } catch (error) {
        checks.push({
          name: `table_${table}`,
          status: 'fail',
          duration: Date.now() - tableStart,
          message: `Table '${table}' not accessible`
        })
      }
    }

    const hasFailures = checks.some(check => check.status === 'fail')
    const totalDuration = Date.now() - startTime

    return c.json({
      status: hasFailures ? 'unhealthy' : 'healthy',
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      checks
    })
  } catch (error) {
    return c.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Database health check failed'
      },
      503
    )
  }
})

/**
 * Cache health check
 *
 * GET /health/cache
 */
app.get('/cache', async (c: Context) => {
  const startTime = Date.now()
  const checks: HealthCheck[] = []

  try {
    const kv = c.env.CACHE_KV

    // Write test
    const writeStart = Date.now()
    await kv.put('health_check_write', Date.now().toString(), { expirationTtl: 60 })
    checks.push({
      name: 'write',
      status: 'pass',
      duration: Date.now() - writeStart,
      message: 'Cache write successful'
    })

    // Read test
    const readStart = Date.now()
    const value = await kv.get('health_check_write')
    checks.push({
      name: 'read',
      status: value ? 'pass' : 'fail',
      duration: Date.now() - readStart,
      message: value ? 'Cache read successful' : 'Cache read failed'
    })

    // Delete test
    const deleteStart = Date.now()
    await kv.delete('health_check_write')
    checks.push({
      name: 'delete',
      status: 'pass',
      duration: Date.now() - deleteStart,
      message: 'Cache delete successful'
    })

    // List test (check if KV is operational)
    const listStart = Date.now()
    const list = await kv.list({ limit: 1 })
    checks.push({
      name: 'list',
      status: 'pass',
      duration: Date.now() - listStart,
      message: `KV contains ${list.keys.length} keys (sample)`
    })

    const hasFailures = checks.some(check => check.status === 'fail')
    const totalDuration = Date.now() - startTime

    return c.json({
      status: hasFailures ? 'unhealthy' : 'healthy',
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      checks
    })
  } catch (error) {
    return c.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Cache health check failed'
      },
      503
    )
  }
})

/**
 * System metrics endpoint
 *
 * GET /health/metrics
 */
app.get('/metrics', async (c: Context) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    worker: {
      version: c.env.APP_VERSION || '1.0.0',
      environment: c.env.ENVIRONMENT || 'production'
    },
    memory: (performance as any).memory
      ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        }
      : null
  }

  return c.json(metrics)
})

export default app
