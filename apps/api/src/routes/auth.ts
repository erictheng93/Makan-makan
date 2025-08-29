import { Hono } from 'hono'
import { sign } from 'jsonwebtoken'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../types/env'

interface LoginRequest {
  username: string
  password: string
}

interface RegisterRequest {
  username: string
  password: string
  role: number
  restaurantId?: number
}

const authRouter = new Hono<{ Bindings: Env }>()

// 用戶登入
authRouter.post('/login', async (c) => {
  try {
    const { username, password }: LoginRequest = await c.req.json()
    
    if (!username || !password) {
      return c.json({
        success: false,
        error: 'Username and password are required'
      }, 400)
    }

    // 查詢用戶
    const user = await c.env.DB.prepare(`
      SELECT id, username, password, role, restaurant_id, status, created_at
      FROM users 
      WHERE username = ? AND status = 'active'
    `).bind(username).first()

    if (!user) {
      return c.json({
        success: false,
        error: 'Invalid username or password'
      }, 401)
    }

    // 驗證密碼 (實際項目中應該使用 bcrypt 或其他加密方法)
    if (user.password !== password) {
      return c.json({
        success: false,
        error: 'Invalid username or password'
      }, 401)
    }

    // 生成 JWT Token
    const token = sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        restaurantId: user.restaurant_id
      },
      c.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    // 記錄登入活動
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (user_id, action, resource, details, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(
      user.id,
      'login',
      'auth',
      JSON.stringify({ ip: c.req.header('CF-Connecting-IP') || 'unknown' })
    ).run()

    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          restaurantId: user.restaurant_id
        }
      }
    })

  } catch (error) {
    console.error('Login error:', error)
    return c.json({
      success: false,
      error: 'Login failed'
    }, 500)
  }
})

// 用戶註冊 (需要管理員權限)
authRouter.post('/register', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user')
    
    // 只有管理員或店主可以註冊新用戶
    if (currentUser.role !== 0 && currentUser.role !== 1) {
      return c.json({
        success: false,
        error: 'Insufficient permissions'
      }, 403)
    }

    const { username, password, role, restaurantId }: RegisterRequest = await c.req.json()
    
    if (!username || !password || role === undefined) {
      return c.json({
        success: false,
        error: 'Username, password and role are required'
      }, 400)
    }

    // 檢查用戶名是否已存在
    const existingUser = await c.env.DB.prepare(`
      SELECT id FROM users WHERE username = ?
    `).bind(username).first()

    if (existingUser) {
      return c.json({
        success: false,
        error: 'Username already exists'
      }, 409)
    }

    // 驗證角色權限
    if (currentUser.role === 1 && role < 2) {
      return c.json({
        success: false,
        error: 'Shop owners can only create staff accounts'
      }, 403)
    }

    // 插入新用戶
    const result = await c.env.DB.prepare(`
      INSERT INTO users (username, password, role, restaurant_id, status, created_at)
      VALUES (?, ?, ?, ?, 'active', datetime('now'))
    `).bind(username, password, role, restaurantId || null).run()

    // 記錄註冊活動
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (user_id, action, resource, details, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(
      currentUser.id,
      'create_user',
      'users',
      JSON.stringify({ newUserId: result.meta.last_row_id, username, role })
    ).run()

    return c.json({
      success: true,
      data: {
        id: result.meta.last_row_id,
        username,
        role,
        restaurantId
      }
    })

  } catch (error) {
    console.error('Registration error:', error)
    return c.json({
      success: false,
      error: 'Registration failed'
    }, 500)
  }
})

// 刷新 Token
authRouter.post('/refresh', authMiddleware, async (c) => {
  try {
    const user = c.get('user')

    // 重新驗證用戶狀態
    const currentUser = await c.env.DB.prepare(`
      SELECT id, username, role, restaurant_id, status
      FROM users 
      WHERE id = ? AND status = 'active'
    `).bind(user.id).first()

    if (!currentUser) {
      return c.json({
        success: false,
        error: 'User account not found or inactive'
      }, 401)
    }

    // 生成新的 JWT Token
    const token = sign(
      {
        id: currentUser.id,
        username: currentUser.username,
        role: currentUser.role,
        restaurantId: currentUser.restaurant_id
      },
      c.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: currentUser.id,
          username: currentUser.username,
          role: currentUser.role,
          restaurantId: currentUser.restaurant_id
        }
      }
    })

  } catch (error) {
    console.error('Token refresh error:', error)
    return c.json({
      success: false,
      error: 'Token refresh failed'
    }, 500)
  }
})

// 用戶登出
authRouter.post('/logout', authMiddleware, async (c) => {
  try {
    const user = c.get('user')

    // 記錄登出活動
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (user_id, action, resource, details, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(
      user.id,
      'logout',
      'auth',
      JSON.stringify({ ip: c.req.header('CF-Connecting-IP') || 'unknown' })
    ).run()

    return c.json({
      success: true,
      message: 'Logout successful'
    })

  } catch (error) {
    console.error('Logout error:', error)
    return c.json({
      success: false,
      error: 'Logout failed'
    }, 500)
  }
})

// 獲取當前用戶資訊
authRouter.get('/me', authMiddleware, async (c) => {
  try {
    const user = c.get('user')

    // 獲取完整的用戶資訊
    const userInfo = await c.env.DB.prepare(`
      SELECT u.id, u.username, u.role, u.restaurant_id, u.created_at,
             r.name as restaurant_name
      FROM users u
      LEFT JOIN restaurants r ON u.restaurant_id = r.id
      WHERE u.id = ? AND u.status = 'active'
    `).bind(user.id).first()

    if (!userInfo) {
      return c.json({
        success: false,
        error: 'User not found'
      }, 404)
    }

    return c.json({
      success: true,
      data: {
        id: userInfo.id,
        username: userInfo.username,
        role: userInfo.role,
        restaurantId: userInfo.restaurant_id,
        restaurantName: userInfo.restaurant_name,
        createdAt: userInfo.created_at
      }
    })

  } catch (error) {
    console.error('Get user info error:', error)
    return c.json({
      success: false,
      error: 'Failed to get user information'
    }, 500)
  }
})

export default authRouter