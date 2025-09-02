import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { timing } from 'hono/timing'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth'
import { rateLimitMiddleware } from './middleware/rateLimit'
import restaurantsRouter from './routes/restaurants'
import menuRouter from './routes/menu'
import authRouter from './routes/auth'
import kitchenRouter from './routes/kitchen'
import ordersRouter from './routes/orders'
import tablesRouter from './routes/tables'
import usersRouter from './routes/users'
import analyticsRouter from './routes/analytics'
import qrcodeRouter from './routes/qrcode'
import healthRouter from './routes/health'
import sseRouter from './routes/sse'
import systemRouter from './routes/system'
import type { Env } from './types/env'

// 創建主應用
const app = new Hono<{ Bindings: Env }>()

// 全域中間件
app.use('*', cors({
  origin: ['https://customer.makanmakan.com', 'https://admin.makanmakan.com', 'https://kitchen.makanmakan.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Request-ID'],
  credentials: true
}))
app.use('*', logger())
app.use('*', timing())
app.use('*', prettyJSON())
app.use('*', rateLimitMiddleware())

// 錯誤處理中間件
app.onError((err, c) => {
  console.error('Global error handler:', err)
  
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

// 基本健康檢查端點（向後兼容）
app.get('/health', (c) => c.redirect('/api/v1/health'))

// API 資訊端點
app.get('/info', (c) => {
  return c.json({
    name: 'MakanMakan API',
    version: c.env.API_VERSION || 'v1',
    description: 'RESTful API for MakanMakan restaurant management system',
    environment: c.env.NODE_ENV || 'development',
    features: [
      'Restaurant management',
      'Menu management',
      'Order processing',
      'Real-time updates',
      'Multi-language support',
      'Role-based access control'
    ],
    endpoints: {
      auth: '/api/v1/auth',
      restaurants: '/api/v1/restaurants',
      menu: '/api/v1/menu',
      orders: '/api/v1/orders',
      tables: '/api/v1/tables',
      users: '/api/v1/users',
      analytics: '/api/v1/analytics',
      kitchen: '/api/v1/kitchen',
      sse: '/api/v1/sse',
      system: '/api/v1/system',
      qr: '/api/v1/qr',
      health: '/health',
      docs: '/docs'
    }
  })
})

// 路由註冊
const apiV1 = new Hono<{ Bindings: Env }>()

// 公開路由（無需認證）
apiV1.route('/auth', authRouter)
apiV1.route('/health', healthRouter)
apiV1.route('/qr', qrcodeRouter)

// 受保護的路由（需要認證）
apiV1.use('/restaurants/*', authMiddleware)
apiV1.use('/menu/*', authMiddleware)
apiV1.use('/kitchen/*', authMiddleware)
apiV1.use('/orders/*', authMiddleware)
apiV1.use('/tables/*', authMiddleware)
apiV1.use('/users/*', authMiddleware)
apiV1.use('/analytics/*', authMiddleware)
apiV1.use('/sse/*', authMiddleware)
apiV1.use('/system/*', authMiddleware)

apiV1.route('/restaurants', restaurantsRouter)
apiV1.route('/menu', menuRouter)
apiV1.route('/kitchen', kitchenRouter)
apiV1.route('/orders', ordersRouter)
apiV1.route('/tables', tablesRouter)
apiV1.route('/users', usersRouter)
apiV1.route('/analytics', analyticsRouter)
apiV1.route('/sse', sseRouter)
apiV1.route('/system', systemRouter)

// 掛載 API 路由
app.route('/api/v1', apiV1)

// 根路徑重定向到 API 資訊
app.get('/', (c) => {
  return c.redirect('/info')
})

// 匯出應用
export default {
  fetch: app.fetch,
  
  // 計畫任務處理器
  scheduled: async (event: ScheduledEvent, _env: Env, _ctx: ExecutionContext) => {
    console.log('Scheduled event triggered:', event.cron)
    
    // 清理過期會話
    // await cleanupExpiredSessions(env.DB)
    
    // 清理過期快取
    // await cleanupExpiredCache(env.CACHE_KV)
    
    // 生成每日報表
    // await generateDailyReports(env.DB, env.JOB_QUEUE)
  }
}