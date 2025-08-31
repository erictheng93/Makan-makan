import { Context, Next } from 'hono'
import { verify } from 'jsonwebtoken'
import type { Env } from '../types/env'
import { createDbConnection } from '@makanmakan/database'
import { eq } from 'drizzle-orm'
import { images } from '@makanmakan/database'

export interface AuthUser {
  id: number
  username: string
  role: number
  restaurantId?: number
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
  }
}

// JWT 認證中間件
export const authMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        success: false,
        error: 'Missing or invalid authorization header' 
      }, 401)
    }

    const token = authHeader.substring(7) // 移除 "Bearer " 前綴
    const decoded = verify(token, c.env.JWT_SECRET) as any

    if (!decoded || typeof decoded !== 'object') {
      return c.json({ 
        success: false,
        error: 'Invalid token' 
      }, 401)
    }

    // 設置用戶資訊到 context
    c.set('user', {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      restaurantId: decoded.restaurantId
    })

    await next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return c.json({ 
      success: false,
      error: 'Authentication failed' 
    }, 401)
  }
}

// 可選認證中間件（用於公開API）
export const optionalAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization')
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const decoded = verify(token, c.env.JWT_SECRET) as any

      if (decoded && typeof decoded === 'object') {
        c.set('user', {
          id: decoded.id,
          username: decoded.username,
          role: decoded.role,
          restaurantId: decoded.restaurantId
        })
      }
    }

    await next()
  } catch (error) {
    // 忽略認證錯誤，繼續執行
    await next()
  }
}

// 角色權限檢查中間件
export const requireRole = (allowedRoles: number[]) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user')
    
    if (!user) {
      return c.json({ 
        success: false,
        error: 'Authentication required' 
      }, 401)
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json({ 
        success: false,
        error: 'Insufficient permissions' 
      }, 403)
    }

    await next()
  }
}

// API Key 認證中間件（用於服務間通信）
export const apiKeyAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
  try {
    const apiKey = c.req.header('X-API-Key')
    
    if (!apiKey) {
      return c.json({
        success: false,
        error: 'API key required'
      }, 401)
    }

    // 在實際應用中，應該從數據庫或配置中驗證API key
    // 這裡使用環境變量作為示例
    const validApiKey = c.env.API_KEY || 'default-api-key'
    
    if (apiKey !== validApiKey) {
      return c.json({
        success: false,
        error: 'Invalid API key'
      }, 401)
    }

    await next()
  } catch (error) {
    console.error('API key auth error:', error)
    return c.json({
      success: false,
      error: 'API key authentication failed'
    }, 401)
  }
}

// 圖片存取權限檢查
export const checkImageAccess = async (c: Context<{ Bindings: Env }>, next: Next) => {
  try {
    const user = c.get('user')
    const imageId = c.req.param('imageId') || c.req.param('id')
    
    if (!imageId) {
      return c.json({
        success: false,
        error: 'Image ID required'
      }, 400)
    }

    // 如果用戶是管理員，允許存取所有圖片
    if (user && user.role === 0) {
      await next()
      return
    }

    // 檢查圖片是否屬於用戶的餐廳 - Use Drizzle ORM
    const db = createDbConnection(c.env.DB)
    const imageResults = await db
      .select({
        restaurant_id: images.restaurantId,
        uploaded_by: images.uploadedBy
      })
      .from(images)
      .where(eq(images.id, imageId))
      .limit(1)
    
    const imageResult = imageResults[0] || null

    if (!imageResult) {
      return c.json({
        success: false,
        error: 'Image not found'
      }, 404)
    }

    // 如果沒有認證用戶，只允許存取公開圖片（restaurant_id 為 null）
    if (!user) {
      if (imageResult.restaurant_id !== null) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      await next()
      return
    }

    // 檢查權限
    const hasAccess = 
      imageResult.uploaded_by === user.id || // 上傳者
      (imageResult.restaurant_id && imageResult.restaurant_id === user.restaurantId) || // 同餐廳
      imageResult.restaurant_id === null // 公開圖片

    if (!hasAccess) {
      return c.json({
        success: false,
        error: 'Access denied'
      }, 403)
    }

    await next()
  } catch (error) {
    console.error('Image access check error:', error)
    return c.json({
      success: false,
      error: 'Access check failed'
    }, 500)
  }
}

// 速率限制中間件
export const rateLimiter = (maxRequests: number, windowMs: number) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    try {
      const clientIP = c.req.header('CF-Connecting-IP') || 'unknown'
      const windowStart = Math.floor(Date.now() / windowMs)
      const key = `rate_limit:${clientIP}:${windowStart}`

      // 獲取當前請求計數
      const current = await c.env.IMAGE_CACHE.get(key)
      const count = current ? parseInt(current) : 0

      if (count >= maxRequests) {
        return c.json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil(windowMs / 1000)
        }, 429)
      }

      // 增加請求計數
      await c.env.IMAGE_CACHE.put(
        key,
        String(count + 1),
        { expirationTtl: Math.ceil(windowMs / 1000) }
      )

      await next()
    } catch (error) {
      console.error('Rate limiter error:', error)
      // 如果速率限制檢查失敗，允許請求繼續（fail open）
      await next()
    }
  }
}

// 上傳速率限制
export const uploadRateLimit = (env: Env) => {
  const maxUploads = parseInt(env.MAX_UPLOADS_PER_MINUTE) || 10
  return rateLimiter(maxUploads, 60 * 1000) // 1 minute window
}

// 轉換速率限制
export const transformRateLimit = (env: Env) => {
  const maxTransforms = parseInt(env.MAX_TRANSFORMS_PER_MINUTE) || 50
  return rateLimiter(maxTransforms, 60 * 1000) // 1 minute window
}

// CORS 中間件
export const corsMiddleware = async (c: Context, next: Next) => {
  // 設置 CORS headers
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key')
  c.header('Access-Control-Max-Age', '86400')

  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return c.text('', 204)
  }

  await next()
}

// 圖片檔案大小檢查中間件
export const checkFileSize = (maxSizeMB: number) => {
  return async (c: Context, next: Next) => {
    try {
      const contentLength = c.req.header('Content-Length')
      
      if (contentLength) {
        const sizeBytes = parseInt(contentLength)
        const maxSizeBytes = maxSizeMB * 1024 * 1024

        if (sizeBytes > maxSizeBytes) {
          return c.json({
            success: false,
            error: `File too large. Maximum size: ${maxSizeMB}MB`,
            maxSize: maxSizeMB
          }, 413)
        }
      }

      await next()
    } catch (error) {
      console.error('File size check error:', error)
      await next()
    }
  }
}