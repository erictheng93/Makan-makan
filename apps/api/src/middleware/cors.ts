import { Context, Next } from 'hono'
import type { Env } from '../types/env'

// CORS 中間件
export const corsMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
  // 設置 CORS headers
  const origin = c.req.header('Origin')
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://customer.makanmakan.app',
    'https://admin.makanmakan.app',
    'https://makanmakan.app'
  ]

  if (origin && (allowedOrigins.includes(origin) || c.env.NODE_ENV === 'development')) {
    c.res.headers.set('Access-Control-Allow-Origin', origin)
  }

  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  c.res.headers.set('Access-Control-Allow-Credentials', 'true')
  c.res.headers.set('Access-Control-Max-Age', '86400')

  // 處理 preflight 請求
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: c.res.headers 
    })
  }

  await next()
}