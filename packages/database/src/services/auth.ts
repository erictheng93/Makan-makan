import { eq, and, desc, lt } from 'drizzle-orm'
import { BaseService } from './base'
import { users, sessions } from '../schema'
import * as bcrypt from 'bcryptjs'
import { sign, verify } from 'jsonwebtoken'

export interface LoginData {
  username: string
  password: string
  deviceInfo?: {
    userAgent?: string
    ipAddress?: string
    platform?: string
    deviceType?: string
    browser?: string
    version?: string
  }
  location?: {
    country?: string
    city?: string
    coordinates?: { lat: number; lng: number }
  }
}

export interface RegisterData {
  username: string
  email?: string
  phone?: string
  fullName: string
  password: string
  role: number
  restaurantId?: number
}

export interface SessionData {
  userId: number
  token: string
  refreshToken?: string
  userAgent?: string
  ipAddress?: string
  deviceInfo?: any
  location?: any
  expiresAt: Date
}

export interface AuthResult {
  success: boolean
  user?: {
    id: number
    username: string
    fullName: string
    role: number
    restaurantId?: number | null
    isActive: boolean
  }
  tokens?: {
    accessToken: string
    refreshToken: string
    expiresAt: Date
  }
  error?: string
}

export class AuthService extends BaseService {
  
  // 用戶登入
  async login(data: LoginData): Promise<AuthResult> {
    try {
      // 查詢活躍用戶
      const user = await this.db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          passwordHash: users.passwordHash,
          role: users.role,
          restaurantId: users.restaurantId,
          isActive: users.isActive,
          isVerified: users.isVerified
        })
        .from(users)
        .where(
          and(
            eq(users.username, data.username),
            eq(users.isActive, true)
          )
        )
        .get()

      if (!user) {
        return {
          success: false,
          error: 'Invalid username or password'
        }
      }

      // 驗證密碼
      const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash)
      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Invalid username or password'
        }
      }

      // 生成 JWT tokens
      const jwtSecret = process.env.JWT_SECRET || 'fallback-secret'
      const accessTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小時
      const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天

      const accessToken = sign(
        { 
          userId: user.id, 
          username: user.username, 
          role: user.role,
          restaurantId: user.restaurantId
        },
        jwtSecret,
        { expiresIn: '24h' }
      )

      const refreshToken = sign(
        { userId: user.id, type: 'refresh' },
        jwtSecret,
        { expiresIn: '7d' }
      )

      // 創建 session 記錄
      const sessionData: SessionData = {
        userId: user.id,
        token: accessToken,
        refreshToken,
        userAgent: data.deviceInfo?.userAgent,
        ipAddress: data.deviceInfo?.ipAddress,
        deviceInfo: data.deviceInfo,
        location: data.location,
        expiresAt: accessTokenExpiry
      }

      await this.createSession(sessionData)

      // 更新最後登入時間
      await this.db
        .update(users)
        .set({ 
          lastLoginAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id))

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          restaurantId: user.restaurantId,
          isActive: user.isActive
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresAt: accessTokenExpiry
        }
      }

    } catch (error) {
      this.handleError(error, 'login')
    }
  }

  // 用戶註冊
  async register(data: RegisterData): Promise<AuthResult> {
    try {
      // 檢查用戶名是否已存在
      const existingUser = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, data.username))
        .get()

      if (existingUser) {
        return {
          success: false,
          error: 'Username already exists'
        }
      }

      // 加密密碼
      const saltRounds = 10
      const passwordHash = await bcrypt.hash(data.password, saltRounds)

      // 創建新用戶
      const [newUser] = await this.db
        .insert(users)
        .values({
          username: data.username,
          email: data.email,
          phone: data.phone,
          fullName: data.fullName,
          passwordHash,
          role: data.role,
          restaurantId: data.restaurantId,
          isActive: true,
          isVerified: false
        })
        .returning({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          role: users.role,
          restaurantId: users.restaurantId
        })

      return {
        success: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          fullName: newUser.fullName,
          role: newUser.role,
          restaurantId: newUser.restaurantId,
          isActive: true
        }
      }

    } catch (error) {
      this.handleError(error, 'register')
    }
  }

  // 刷新 token
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      const jwtSecret = process.env.JWT_SECRET || 'fallback-secret'
      
      // 驗證 refresh token
      const decoded = verify(refreshToken, jwtSecret) as any
      
      if (decoded.type !== 'refresh') {
        return {
          success: false,
          error: 'Invalid refresh token'
        }
      }

      // 查詢 session
      const session = await this.db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.userId, decoded.userId),
            eq(sessions.refreshToken, refreshToken),
            eq(sessions.isActive, true)
          )
        )
        .get()

      if (!session) {
        return {
          success: false,
          error: 'Session not found or expired'
        }
      }

      // 查詢用戶資訊
      const user = await this.db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          role: users.role,
          restaurantId: users.restaurantId,
          isActive: users.isActive
        })
        .from(users)
        .where(
          and(
            eq(users.id, decoded.userId),
            eq(users.isActive, true)
          )
        )
        .get()

      if (!user) {
        return {
          success: false,
          error: 'User not found or inactive'
        }
      }

      // 生成新的 access token
      const accessTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const accessToken = sign(
        { 
          userId: user.id, 
          username: user.username, 
          role: user.role,
          restaurantId: user.restaurantId
        },
        jwtSecret,
        { expiresIn: '24h' }
      )

      // 更新 session
      await this.db
        .update(sessions)
        .set({
          token: accessToken,
          lastAccessedAt: new Date(),
          expiresAt: accessTokenExpiry,
          updatedAt: new Date()
        })
        .where(eq(sessions.id, session.id))

      return {
        success: true,
        user,
        tokens: {
          accessToken,
          refreshToken,
          expiresAt: accessTokenExpiry
        }
      }

    } catch (error) {
      return {
        success: false,
        error: 'Invalid refresh token'
      }
    }
  }

  // 創建 session
  async createSession(data: SessionData): Promise<void> {
    try {
      // 清理該用戶的過期 sessions
      await this.cleanupExpiredSessions(data.userId)

      // 生成 session ID
      const sessionId = crypto.randomUUID()

      await this.db
        .insert(sessions)
        .values({
          id: sessionId,
          userId: data.userId,
          token: data.token,
          refreshToken: data.refreshToken,
          userAgent: data.userAgent,
          ipAddress: data.ipAddress,
          deviceInfo: data.deviceInfo,
          location: data.location,
          expiresAt: data.expiresAt,
          isActive: true
        })

    } catch (error) {
      this.handleError(error, 'createSession')
    }
  }

  // 登出（使 session 失效）
  async logout(userId: number, token?: string): Promise<boolean> {
    try {
      const conditions = [eq(sessions.userId, userId)]
      if (token) {
        conditions.push(eq(sessions.token, token))
      }

      await this.db
        .update(sessions)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(and(...conditions))

      return true

    } catch (error) {
      console.error('Logout error:', error)
      return false
    }
  }

  // 驗證 token 並取得用戶資訊
  async validateToken(token: string): Promise<{ valid: boolean; user?: any; error?: string }> {
    try {
      const jwtSecret = process.env.JWT_SECRET || 'fallback-secret'
      
      // 驗證 JWT
      const decoded = verify(token, jwtSecret) as any

      // 查詢 session 是否有效
      const session = await this.db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.token, token),
            eq(sessions.isActive, true),
            lt(sessions.expiresAt, new Date())
          )
        )
        .get()

      if (!session) {
        return { valid: false, error: 'Session expired or invalid' }
      }

      // 查詢用戶
      const user = await this.db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          role: users.role,
          restaurantId: users.restaurantId,
          isActive: users.isActive
        })
        .from(users)
        .where(
          and(
            eq(users.id, decoded.userId),
            eq(users.isActive, true)
          )
        )
        .get()

      if (!user) {
        return { valid: false, error: 'User not found or inactive' }
      }

      // 更新最後訪問時間
      await this.db
        .update(sessions)
        .set({
          lastAccessedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(sessions.id, session.id))

      return { valid: true, user }

    } catch (error) {
      return { valid: false, error: 'Invalid token' }
    }
  }

  // 清理過期的 sessions
  async cleanupExpiredSessions(userId?: number): Promise<number> {
    try {
      const conditions = [lt(sessions.expiresAt, new Date())]
      if (userId) {
        conditions.push(eq(sessions.userId, userId))
      }

      const result = await this.db
        .delete(sessions)
        .where(and(...conditions))

      return 0 // TODO: Drizzle ORM doesn't return changes count directly

    } catch (error) {
      console.error('Cleanup sessions error:', error)
      return 0
    }
  }

  // 取得用戶的活躍 sessions
  async getUserSessions(userId: number): Promise<any[]> {
    try {
      return await this.db
        .select({
          id: sessions.id,
          deviceInfo: sessions.deviceInfo,
          ipAddress: sessions.ipAddress,
          location: sessions.location,
          lastAccessedAt: sessions.lastAccessedAt,
          expiresAt: sessions.expiresAt,
          createdAt: sessions.createdAt
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.userId, userId),
            eq(sessions.isActive, true)
          )
        )
        .orderBy(desc(sessions.lastAccessedAt))

    } catch (error) {
      this.handleError(error, 'getUserSessions')
    }
  }

  // 更改密碼
  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 取得用戶當前密碼
      const user = await this.db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, userId))
        .get()

      if (!user) {
        return { success: false, error: 'User not found' }
      }

      // 驗證舊密碼
      const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash)
      if (!isOldPasswordValid) {
        return { success: false, error: 'Current password is incorrect' }
      }

      // 加密新密碼
      const saltRounds = 10
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds)

      // 更新密碼
      await this.db
        .update(users)
        .set({
          passwordHash: newPasswordHash,
          passwordChangedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))

      // 使所有該用戶的 sessions 失效（除了當前操作的 session）
      await this.db
        .update(sessions)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(sessions.userId, userId))

      return { success: true }

    } catch (error) {
      return { success: false, error: 'Failed to change password' }
    }
  }
}