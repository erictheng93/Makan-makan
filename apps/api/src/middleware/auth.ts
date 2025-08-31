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

    // 檢查 token 是否即將過期 (剩餘時間少於1小時)
    const now = Math.floor(Date.now() / 1000)
    const timeUntilExpiry = decoded.exp - now
    if (timeUntilExpiry < 3600) { // 1 hour
      c.header('X-Token-Refresh-Recommended', 'true')
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