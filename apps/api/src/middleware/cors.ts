import { Context, Next } from 'hono'
import type { Env } from '../types/env'

// CORS 中間件
export const corsMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
  // 設置 CORS headers
  const origin = c.req.header('Origin')
  
  // 明確定義允許的來源（移除開發環境的通配符允許）
  const allowedOrigins = [
    // 生產環境
    'https://customer.makanmakan.app',
    'https://admin.makanmakan.app', 
    'https://kitchen.makanmakan.app',
    'https://makanmakan.app',
    // 開發環境 - 明確指定而非通配符
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8000'
  ]

  // 只有在明確允許的來源列表中才設置 CORS header
  if (origin && allowedOrigins.includes(origin)) {
    c.res.headers.set('Access-Control-Allow-Origin', origin)
    c.res.headers.set('Access-Control-Allow-Credentials', 'true')
  } else if (origin) {
    // 記錄未授權的來源嘗試
    console.warn(`Blocked CORS request from unauthorized origin: ${origin}`)
  }

  // 安全的 HTTP 方法列表
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  
  // 嚴格控制允許的 headers
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token')
  
  // 暴露自定義 headers 給前端
  c.res.headers.set('Access-Control-Expose-Headers', 'X-Token-Refresh-Recommended, X-RateLimit-Remaining, X-RateLimit-Reset')
  
  // 減少 preflight 快取時間以提高安全性
  c.res.headers.set('Access-Control-Max-Age', '3600') // 1 hour instead of 24 hours

  // 添加安全 headers
  c.res.headers.set('X-Content-Type-Options', 'nosniff')
  c.res.headers.set('X-Frame-Options', 'DENY') 
  c.res.headers.set('X-XSS-Protection', '1; mode=block')
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

  // 處理 preflight 請求
  if (c.req.method === 'OPTIONS') {
    // 確保 OPTIONS 請求也有 CORS headers
    return new Response(null, { 
      status: 204,
      headers: c.res.headers 
    })
  }

  await next()
}