import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { timing } from 'hono/timing'
import { corsMiddleware } from './middleware/auth'
import imagesRouter from './routes/images'
import analyticsRouter from './routes/analytics'
import type { Env } from './types/env'
import { createDbConnection } from '@makanmakan/database'
import { sql, count } from 'drizzle-orm'
import { images, imageViews, imageProcessingJobs } from '@makanmakan/database'

// 創建主應用
const app = new Hono<{ Bindings: Env }>()

// 全域中間件
app.use('*', corsMiddleware)
app.use('*', logger())
app.use('*', timing())
app.use('*', prettyJSON())

// 錯誤處理中間件
app.onError((err, c) => {
  console.error('Global error handler:', err)
  
  // 發送錯誤通知到 Slack (如果配置了)
  if (c.env.SLACK_WEBHOOK_URL) {
    c.executionCtx.waitUntil(
      sendErrorNotification(c.env.SLACK_WEBHOOK_URL, err, c)
    )
  }
  
  // 開發環境顯示詳細錯誤
  if (c.env.NODE_ENV === 'development') {
    return c.json({
      success: false,
      error: err.message,
      stack: err.stack
    }, 500)
  }
  
  // 生產環境隱藏詳細錯誤
  return c.json({
    success: false,
    error: 'Internal server error'
  }, 500)
})

// 404 處理
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'API endpoint not found',
    path: c.req.path
  }, 404)
})

// 根路徑 - API 資訊
app.get('/', (c) => {
  return c.json({
    name: 'MakanMakan Image Processing Service',
    version: c.env.API_VERSION || 'v1',
    description: 'Cloudflare Workers-based image processing and optimization service',
    environment: c.env.NODE_ENV || 'development',
    features: [
      'Image upload and storage',
      'Automatic optimization',
      'Multiple format variants',
      'Real-time transformations', 
      'Advanced analytics',
      'Bulk operations',
      'Security scanning',
      'Access control'
    ],
    endpoints: {
      images: '/images',
      upload: '/images/upload',
      analytics: '/analytics',
      health: '/health',
      docs: '/docs'
    },
    limits: {
      maxFileSize: `${c.env.MAX_IMAGE_SIZE_MB || 10}MB`,
      allowedFormats: c.env.ALLOWED_MIME_TYPES?.split(',') || ['image/jpeg', 'image/png', 'image/webp'],
      maxUploadsPerMinute: c.env.MAX_UPLOADS_PER_MINUTE || 20,
      maxTransformsPerMinute: c.env.MAX_TRANSFORMS_PER_MINUTE || 100
    }
  })
})

// 健康檢查端點
app.get('/health', async (c) => {
  try {
    const startTime = Date.now()
    
    // 檢查資料庫連接
    let dbStatus = 'healthy'
    let dbResponseTime = 0
    
    try {
      const dbStart = Date.now()
      // Use Drizzle ORM for health check
      const db = createDbConnection(c.env.DB)
      const healthResult = await db.select({ test: sql<number>`1` }).limit(1)
      const isHealthy = healthResult[0]?.test === 1
      dbResponseTime = Date.now() - dbStart
    } catch (error) {
      dbStatus = 'unhealthy'
      console.error('Database health check failed:', error)
    }
    
    // 檢查 KV 存儲
    let kvStatus = 'healthy'
    let kvResponseTime = 0
    
    try {
      const kvStart = Date.now()
      const testKey = `health-${Date.now()}`
      await c.env.IMAGE_CACHE.put(testKey, 'test', { expirationTtl: 60 })
      const value = await c.env.IMAGE_CACHE.get(testKey)
      kvResponseTime = Date.now() - kvStart
      
      if (value !== 'test') {
        kvStatus = 'degraded'
      }
      
      // 清理測試數據
      await c.env.IMAGE_CACHE.delete(testKey)
    } catch (error) {
      kvStatus = 'unhealthy'
      console.error('KV health check failed:', error)
    }
    
    // 檢查 R2 存儲
    let r2Status = 'healthy'
    let r2ResponseTime = 0
    
    try {
      const r2Start = Date.now()
      await c.env.IMAGES_BUCKET.head('health-check-dummy-file')
      r2ResponseTime = Date.now() - r2Start
    } catch (error) {
      // 404 is expected for dummy file, other errors are concerning
      if (!error.message?.includes('404')) {
        r2Status = 'degraded'
        console.warn('R2 health check warning:', error)
      }
      r2ResponseTime = Date.now() - r2Start
    }
    
    const overallStatus = 
      dbStatus === 'unhealthy' || kvStatus === 'unhealthy' ? 'unhealthy' :
      dbStatus === 'degraded' || kvStatus === 'degraded' || r2Status === 'degraded' ? 'degraded' :
      'healthy'
    
    const totalResponseTime = Date.now() - startTime
    const statusCode = overallStatus === 'unhealthy' ? 503 : 200
    
    return c.json({
      success: overallStatus !== 'unhealthy',
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: c.env.API_VERSION || 'v1',
      environment: c.env.NODE_ENV || 'development',
      services: {
        database: {
          status: dbStatus,
          responseTime: `${dbResponseTime}ms`
        },
        cache: {
          status: kvStatus,
          responseTime: `${kvResponseTime}ms`
        },
        storage: {
          status: r2Status,
          responseTime: `${r2ResponseTime}ms`
        }
      },
      performance: {
        totalCheckTime: `${totalResponseTime}ms`,
        uptime: Date.now() - startTime // Simplified uptime
      }
    }, statusCode)
    
  } catch (error) {
    console.error('Health check error:', error)
    return c.json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed'
    }, 503)
  }
})

// API 版本資訊端點
app.get('/info', (c) => {
  return c.json({
    service: 'MakanMakan Image Processor',
    version: c.env.API_VERSION || 'v1',
    environment: c.env.NODE_ENV || 'development',
    buildTime: new Date().toISOString(),
    capabilities: {
      upload: true,
      transformation: true,
      optimization: true,
      variants: true,
      analytics: true,
      bulkOperations: true,
      securityScanning: true
    },
    supportedFormats: {
      input: c.env.ALLOWED_MIME_TYPES?.split(',') || ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      output: ['image/webp', 'image/jpeg', 'image/png', 'image/avif']
    },
    variants: {
      predefined: c.env.DEFAULT_VARIANTS?.split(',') || ['thumbnail', 'small', 'medium', 'large', 'original'],
      sizes: {
        thumbnail: c.env.THUMBNAIL_SIZE || '150x150',
        small: c.env.SMALL_SIZE || '300x300',
        medium: c.env.MEDIUM_SIZE || '600x600',
        large: c.env.LARGE_SIZE || '1200x1200'
      }
    },
    rateLimits: {
      uploads: `${c.env.MAX_UPLOADS_PER_MINUTE || 20}/minute`,
      transforms: `${c.env.MAX_TRANSFORMS_PER_MINUTE || 100}/minute`
    }
  })
})

// 路由註冊
app.route('/images', imagesRouter)
app.route('/analytics', analyticsRouter)

// 計畫任務處理器（用於清理和維護）
export default {
  fetch: app.fetch,
  
  // 計畫任務處理器
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    console.log('Scheduled task triggered:', event.cron)
    
    try {
      // 清理過期的處理作業記錄
      await cleanupExpiredJobs(env)
      
      // 清理舊的視圖記錄
      await cleanupOldViews(env)
      
      // 清理過期的快取
      await cleanupExpiredCache(env)
      
      // 發送每日使用統計（如果是每日任務）
      if (event.cron === '0 9 * * *') { // 每天上午 9 點
        await sendDailyStats(env)
      }
      
    } catch (error) {
      console.error('Scheduled task error:', error)
      
      if (env.SLACK_WEBHOOK_URL) {
        await sendErrorNotification(env.SLACK_WEBHOOK_URL, error as Error, null)
      }
    }
  }
}

// 清理過期的處理作業記錄（保留 7 天）
async function cleanupExpiredJobs(env: Env) {
  try {
    // Use Drizzle ORM for cleanup
    const db = createDbConnection(env.DB)
    const result = await db
      .delete(imageProcessingJobs)
      .where(sql`${imageProcessingJobs.createdAt} < datetime('now', '-7 days')`)
    
    console.log(`Cleaned up ${result.changes} expired processing jobs`)
  } catch (error) {
    console.error('Failed to cleanup expired jobs:', error)
  }
}

// 清理舊的視圖記錄（保留 30 天）
async function cleanupOldViews(env: Env) {
  try {
    // Use Drizzle ORM for cleanup
    const viewsResult = await db
      .delete(imageViews)
      .where(sql`${imageViews.viewedAt} < datetime('now', '-30 days')`)
    
    console.log(`Cleaned up ${result.changes} old view records`)
  } catch (error) {
    console.error('Failed to cleanup old views:', error)
  }
}

// 清理過期的快取項目
async function cleanupExpiredCache(env: Env) {
  try {
    // KV 會自動清理過期項目，但我們可以主動清理一些測試數據
    const keys = await env.IMAGE_CACHE.list({ prefix: 'health-' })
    
    for (const key of keys.keys) {
      if (key.name.startsWith('health-')) {
        await env.IMAGE_CACHE.delete(key.name)
      }
    }
    
    console.log(`Cleaned up ${keys.keys.length} temporary cache items`)
  } catch (error) {
    console.error('Failed to cleanup cache:', error)
  }
}

// 發送每日統計報告
async function sendDailyStats(env: Env) {
  try {
    // 獲取昨天的統計數據
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]
    
    // Use Drizzle ORM for daily statistics
    const db = createDbConnection(env.DB)
    const statsResult = await db
      .select({
        images_uploaded: count(),
        total_size: sql<number>`SUM(${images.size})`,
        active_restaurants: sql<number>`COUNT(DISTINCT ${images.restaurantId})`
      })
      .from(images)
      .where(sql`DATE(${images.uploadedAt}) = ${dateStr}`)
      .then(results => results[0])
    
    // Use Drizzle ORM for processing statistics
    const processingStatsResult = await db
      .select({
        jobs_processed: count(),
        jobs_completed: sql<number>`SUM(CASE WHEN ${imageProcessingJobs.status} = 'completed' THEN 1 ELSE 0 END)`,
        jobs_failed: sql<number>`SUM(CASE WHEN ${imageProcessingJobs.status} = 'failed' THEN 1 ELSE 0 END)`
      })
      .from(imageProcessingJobs)
      .where(sql`DATE(${imageProcessingJobs.createdAt}) = ${dateStr}`)
      .then(results => results[0])
    
    if (env.SLACK_WEBHOOK_URL) {
      await sendSlackMessage(env.SLACK_WEBHOOK_URL, {
        text: `📊 MakanMakan Image Service Daily Report - ${dateStr}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Daily Image Processing Report*\n*Date:* ${dateStr}`
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Images Uploaded:*\n${stats?.images_uploaded || 0}`
              },
              {
                type: 'mrkdwn',
                text: `*Storage Used:*\n${formatBytes(stats?.total_size || 0)}`
              },
              {
                type: 'mrkdwn',
                text: `*Active Restaurants:*\n${stats?.active_restaurants || 0}`
              },
              {
                type: 'mrkdwn',
                text: `*Processing Success Rate:*\n${processingStats?.jobs_processed > 0 ? 
                  Math.round(((processingStats.jobs_completed || 0) / processingStats.jobs_processed) * 100) : 0}%`
              }
            ]
          }
        ]
      })
    }
    
    console.log('Daily stats report sent successfully')
  } catch (error) {
    console.error('Failed to send daily stats:', error)
  }
}

// 發送錯誤通知到 Slack
async function sendErrorNotification(webhookUrl: string, error: Error, context: any) {
  try {
    const message = {
      text: '🚨 MakanMakan Image Service Error',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Error in Image Processing Service*\n\`\`\`${error.message}\`\`\``
          }
        }
      ]
    }
    
    if (error.stack) {
      message.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Stack Trace:*\n\`\`\`${error.stack.substring(0, 500)}\`\`\``
        }
      })
    }
    
    await sendSlackMessage(webhookUrl, message)
  } catch (notificationError) {
    console.error('Failed to send error notification:', notificationError)
  }
}

// 通用 Slack 消息發送函數
async function sendSlackMessage(webhookUrl: string, message: any) {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    })
  } catch (error) {
    console.error('Failed to send Slack message:', error)
  }
}

// 格式化位元組大小
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}