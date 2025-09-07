import { Context, Next } from 'hono'
import { verify } from 'hono/jwt'
import type { Env } from '../types/env'

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
      return c.json({ error: 'Missing or invalid authorization header' }, 401)
    }

    const token = authHeader.substring(7) // 移除 "Bearer " 前綴
    
    // 檢查 JWT_SECRET 是否設置且符合安全要求
    if (!c.env.JWT_SECRET || c.env.JWT_SECRET.length < 32) {
      console.error('JWT_SECRET is not set or too short (minimum 32 characters required)')
      return c.json({ error: 'Server configuration error' }, 500)
    }

    // 檢查 token 是否在黑名單中 (如果 KV 可用)
    if (c.env.TOKEN_BLACKLIST) {
      const blacklisted = await c.env.TOKEN_BLACKLIST.get(`token:${token}`)
      if (blacklisted) {
        return c.json({ error: 'Token has been invalidated' }, 401)
      }
    }

    const decoded = await verify(token, c.env.JWT_SECRET) as any

    if (!decoded || typeof decoded !== 'object') {
      return c.json({ error: 'Invalid token' }, 401)
    }

    // Enhanced JWT validation checks
    const now = Math.floor(Date.now() / 1000)
    
    // Check token expiration
    if (!decoded.exp || decoded.exp <= now) {
      return c.json({ error: 'Token has expired' }, 401)
    }
    
    // Check token issued at time (prevent future tokens)
    if (decoded.iat && decoded.iat > now + 60) { // Allow 60 second clock skew
      return c.json({ error: 'Token issued in future' }, 401)
    }
    
    // Check not before claim
    if (decoded.nbf && decoded.nbf > now + 60) { // Allow 60 second clock skew
      return c.json({ error: 'Token not yet valid' }, 401)
    }
    
    // Validate required claims
    if (!decoded.id || !decoded.username || typeof decoded.role !== 'number') {
      return c.json({ error: 'Invalid token claims' }, 401)
    }
    
    // Validate role is within expected range (0-4)
    if (decoded.role < 0 || decoded.role > 4) {
      return c.json({ error: 'Invalid role in token' }, 401)
    }
    
    // Check token age (reject tokens older than 24 hours without refresh)
    const tokenAge = now - (decoded.iat || 0)
    const maxTokenAge = 24 * 60 * 60 // 24 hours
    if (tokenAge > maxTokenAge) {
      return c.json({ error: 'Token too old, please refresh' }, 401)
    }
    
    // Check if token is about to expire (recommend refresh within 1 hour)
    const timeUntilExpiry = decoded.exp - now
    if (timeUntilExpiry < 3600) { // 1 hour
      c.header('X-Token-Refresh-Recommended', 'true')
      c.header('X-Token-Expires-In', timeUntilExpiry.toString())
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
    // 提供更詳細的錯誤資訊用於調試 (但不暴露給客戶端)
    if (error && typeof error === 'object' && 'name' in error && error.name === 'JwtTokenExpired') {
      return c.json({ error: 'Token has expired' }, 401)
    }
    if (error && typeof error === 'object' && 'name' in error && error.name === 'JwtTokenInvalid') {
      return c.json({ error: 'Invalid token format' }, 401)
    }
    return c.json({ error: 'Authentication failed' }, 401)
  }
}

// 角色權限檢查中間件
export const requireRole = (allowedRoles: number[]) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user')
    
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    await next()
  }
}

// 餐廳存取權限檢查
export const requireRestaurantAccess = (restaurantIdParam: string = 'restaurantId') => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user')
    const restaurantId = parseInt(c.req.param(restaurantIdParam))
    
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    // 管理員可以存取所有餐廳
    if (user.role === 0) {
      await next()
      return
    }

    // 檢查是否有餐廳存取權限
    if (!user.restaurantId || user.restaurantId !== restaurantId) {
      return c.json({ error: 'Access denied to this restaurant' }, 403)
    }

    await next()
  }
}

// Token 黑名單管理
export const blacklistToken = async (c: Context<{ Bindings: Env }>, token: string, expiryTime?: number) => {
  if (c.env.TOKEN_BLACKLIST) {
    // 計算 TTL - 使用 token 的剩餘過期時間
    let ttl: number | undefined
    if (expiryTime) {
      const now = Math.floor(Date.now() / 1000)
      ttl = Math.max(0, expiryTime - now)
    }
    
    await c.env.TOKEN_BLACKLIST.put(
      `token:${token}`, 
      'blacklisted', 
      ttl ? { expirationTtl: ttl } : undefined
    )
  }
}

// 可選認證中間件（用於公開 API）
export const optionalAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization')
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      
      // 檢查黑名單
      if (c.env.TOKEN_BLACKLIST) {
        const blacklisted = await c.env.TOKEN_BLACKLIST.get(`token:${token}`)
        if (blacklisted) {
          // Token 已被加入黑名單，但這是可選認證，所以繼續執行
          await next()
          return
        }
      }
      
      const decoded = await verify(token, c.env.JWT_SECRET) as any

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