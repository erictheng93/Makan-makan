import { Hono } from 'hono'
import { authMiddleware, blacklistToken } from '../middleware/auth'
import { AuthService } from '@makanmakan/database'
import { ErrorSanitizer, createSafeErrorResponse } from '../utils/errorSanitizer'
import type { Env } from '../types/env'

interface LoginRequest {
  username: string
  password: string
}

interface RegisterRequest {
  username: string
  fullName: string
  email?: string
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

    const authService = new AuthService(c.env.DB as any)
    
    const result = await authService.login({
      username,
      password,
      deviceInfo: {
        userAgent: c.req.header('User-Agent'),
        ipAddress: c.req.header('CF-Connecting-IP') || 'unknown'
      }
    })

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 401)
    }

    return c.json({
      success: true,
      data: {
        token: result.tokens?.accessToken,
        refreshToken: result.tokens?.refreshToken,
        expiresAt: result.tokens?.expiresAt,
        user: result.user
      }
    })

  } catch (error) {
    // SECURITY ENHANCEMENT: Use sanitized error handling
    const sanitized = ErrorSanitizer.logAndSanitize(error, 'AUTH_LOGIN')
    return c.json(createSafeErrorResponse(error, 500), 500)
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

    const { username, fullName, email, password, role, restaurantId }: RegisterRequest = await c.req.json()
    
    if (!username || !password || !fullName || role === undefined) {
      return c.json({
        success: false,
        error: 'Username, fullName, password and role are required'
      }, 400)
    }

    // 驗證角色權限
    if (currentUser.role === 1 && role < 2) {
      return c.json({
        success: false,
        error: 'Shop owners can only create staff accounts'
      }, 403)
    }

    const authService = new AuthService(c.env.DB as any)
    
    const result = await authService.register({
      username,
      fullName,
      email,
      password,
      role,
      restaurantId
    })

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, result.error?.includes('already exists') ? 409 : 400)
    }

    return c.json({
      success: true,
      data: result.user
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
authRouter.post('/refresh', async (c) => {
  try {
    const refreshToken = c.req.header('X-Refresh-Token')
    
    if (!refreshToken) {
      return c.json({
        success: false,
        error: 'Refresh token is required'
      }, 400)
    }

    const authService = new AuthService(c.env.DB as any)
    
    const result = await authService.refreshToken(refreshToken)

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 401)
    }

    return c.json({
      success: true,
      data: {
        token: result.tokens?.accessToken,
        refreshToken: result.tokens?.refreshToken,
        expiresAt: result.tokens?.expiresAt,
        user: result.user
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
    const authHeader = c.req.header('Authorization')
    
    let token: string | undefined
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
      
      // 將 token 加入黑名單
      try {
        await blacklistToken(c, token)
      } catch (error) {
        console.error('Failed to blacklist token:', error)
      }
    }

    const authService = new AuthService(c.env.DB as any)
    
    // 使用戶的 sessions 失效
    await authService.logout(user.id, token)

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
    const _user = c.get('user')
    const authService = new AuthService(c.env.DB as any)
    
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: 'Authorization token required'
      }, 401)
    }
    
    const token = authHeader.substring(7)
    const validation = await authService.validateToken(token)
    
    if (!validation.valid) {
      return c.json({
        success: false,
        error: validation.error || 'Invalid token'
      }, 401)
    }

    return c.json({
      success: true,
      data: validation.user
    })

  } catch (error) {
    // SECURITY ENHANCEMENT: Use sanitized error handling
    const sanitized = ErrorSanitizer.logAndSanitize(error, 'AUTH_USER_INFO')
    return c.json(createSafeErrorResponse(error, 500), 500)
  }
})

export default authRouter