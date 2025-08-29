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
    const decoded = await verify(token, c.env.JWT_SECRET) as any

    if (!decoded || typeof decoded !== 'object') {
      return c.json({ error: 'Invalid token' }, 401)
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

// 可選認證中間件（用於公開 API）
export const optionalAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization')
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
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