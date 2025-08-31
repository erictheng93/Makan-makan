import { eq, and, desc, lt, gt, count, sql } from 'drizzle-orm'
import { BaseService } from './base'
import { sessions, users } from '../schema'

export interface SessionCreateData {
  id?: string
  userId: number
  token: string
  refreshToken?: string
  userAgent?: string
  ipAddress?: string
  deviceInfo?: {
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
  expiresAt: Date
}

export interface SessionUpdateData {
  token?: string
  lastAccessedAt?: Date
  expiresAt?: Date
  location?: any
}

export interface SessionFilters {
  userId?: number
  isActive?: boolean
  platform?: string
  deviceType?: string
  ipAddress?: string
  page?: number
  limit?: number
}

export interface SessionStats {
  totalSessions: number
  activeSessions: number
  expiredSessions: number
  byPlatform: Record<string, number>
  byDeviceType: Record<string, number>
  recentLogins: number // 最近24小時
}

export class SessionService extends BaseService {

  // 創建新 session
  async createSession(data: SessionCreateData): Promise<any> {
    try {
      const sessionId = data.id || crypto.randomUUID()

      const [newSession] = await this.db
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
        .returning()

      return newSession

    } catch (error) {
      this.handleError(error, 'createSession')
    }
  }

  // 根據 token 取得 session
  async getSessionByToken(token: string): Promise<any> {
    try {
      const session = await this.db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.token, token),
            eq(sessions.isActive, true)
          )
        )
        .get()

      return session

    } catch (error) {
      this.handleError(error, 'getSessionByToken')
    }
  }

  // 根據 refresh token 取得 session  
  async getSessionByRefreshToken(refreshToken: string): Promise<any> {
    try {
      const session = await this.db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.refreshToken, refreshToken),
            eq(sessions.isActive, true),
            gt(sessions.expiresAt, new Date())
          )
        )
        .get()

      return session

    } catch (error) {
      this.handleError(error, 'getSessionByRefreshToken')
    }
  }

  // 取得 session 詳情（包含用戶資訊）
  async getSessionById(id: string): Promise<any> {
    try {
      const sessionWithUser = await this.db
        .select({
          id: sessions.id,
          userId: sessions.userId,
          token: sessions.token,
          userAgent: sessions.userAgent,
          ipAddress: sessions.ipAddress,
          deviceInfo: sessions.deviceInfo,
          location: sessions.location,
          isActive: sessions.isActive,
          lastAccessedAt: sessions.lastAccessedAt,
          expiresAt: sessions.expiresAt,
          createdAt: sessions.createdAt,
          // 用戶資訊
          username: users.username,
          fullName: users.fullName,
          role: users.role,
          restaurantId: users.restaurantId
        })
        .from(sessions)
        .leftJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.id, id))
        .get()

      return sessionWithUser

    } catch (error) {
      this.handleError(error, 'getSessionById')
    }
  }

  // 更新 session 資訊
  async updateSession(id: string, data: SessionUpdateData): Promise<any> {
    try {
      const [updatedSession] = await this.db
        .update(sessions)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(sessions.id, id))
        .returning()

      return updatedSession

    } catch (error) {
      this.handleError(error, 'updateSession')
    }
  }

  // 更新 session 最後訪問時間
  async updateLastAccessed(token: string): Promise<boolean> {
    try {
      const result = await this.db
        .update(sessions)
        .set({
          lastAccessedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(sessions.token, token))

      return true // TODO: Drizzle ORM doesn't return changes count directly

    } catch (error) {
      console.error('Update last accessed error:', error)
      return false
    }
  }

  // 使 session 失效
  async invalidateSession(sessionId: string): Promise<boolean> {
    try {
      const result = await this.db
        .update(sessions)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(sessions.id, sessionId))

      return true // TODO: Drizzle ORM doesn't return changes count directly

    } catch (error) {
      console.error('Invalidate session error:', error)
      return false
    }
  }

  // 根據 token 使 session 失效
  async invalidateSessionByToken(token: string): Promise<boolean> {
    try {
      const result = await this.db
        .update(sessions)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(sessions.token, token))

      return true // TODO: Drizzle ORM doesn't return changes count directly

    } catch (error) {
      console.error('Invalidate session by token error:', error)
      return false
    }
  }

  // 使用戶的所有 sessions 失效
  async invalidateUserSessions(userId: number, excludeSessionId?: string): Promise<number> {
    try {
      const conditions = [eq(sessions.userId, userId)]
      
      if (excludeSessionId) {
        conditions.push(sql`${sessions.id} != ${excludeSessionId}`)
      }

      const result = await this.db
        .update(sessions)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(and(...conditions))

      return 0 // TODO: Drizzle ORM doesn't return changes count directly

    } catch (error) {
      console.error('Invalidate user sessions error:', error)
      return 0
    }
  }

  // 清理過期的 sessions
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await this.db
        .delete(sessions)
        .where(lt(sessions.expiresAt, new Date()))

      return 0 // TODO: Drizzle ORM doesn't return changes count directly

    } catch (error) {
      console.error('Cleanup expired sessions error:', error)
      return 0
    }
  }

  // 清理不活躍的 sessions（超過指定天數未訪問）
  async cleanupInactiveSessions(daysInactive = 30): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysInactive)

      const result = await this.db
        .delete(sessions)
        .where(lt(sessions.lastAccessedAt, cutoffDate))

      return 0 // TODO: Drizzle ORM doesn't return changes count directly

    } catch (error) {
      console.error('Cleanup inactive sessions error:', error)
      return 0
    }
  }

  // 取得用戶的活躍 sessions
  async getUserSessions(userId: number, includeExpired = false): Promise<any[]> {
    try {
      const conditions = [eq(sessions.userId, userId)]
      
      if (!includeExpired) {
        conditions.push(eq(sessions.isActive, true))
        conditions.push(gt(sessions.expiresAt, new Date()))
      }

      const userSessions = await this.db
        .select({
          id: sessions.id,
          userAgent: sessions.userAgent,
          ipAddress: sessions.ipAddress,
          deviceInfo: sessions.deviceInfo,
          location: sessions.location,
          isActive: sessions.isActive,
          lastAccessedAt: sessions.lastAccessedAt,
          expiresAt: sessions.expiresAt,
          createdAt: sessions.createdAt
        })
        .from(sessions)
        .where(and(...conditions))
        .orderBy(desc(sessions.lastAccessedAt))

      return userSessions

    } catch (error) {
      this.handleError(error, 'getUserSessions')
    }
  }

  // 取得所有活躍 sessions（管理員功能）
  async getActiveSessions(filters: SessionFilters = {}): Promise<{
    sessions: any[]
    total: number
    pagination: { page: number; limit: number; totalPages: number }
  }> {
    try {
      const { 
        page = 1, 
        limit = 20, 
        userId, 
        isActive = true, 
        platform, 
        deviceType, 
        ipAddress 
      } = filters
      const { offset } = this.createPagination(page, limit)

      // 建構查詢條件
      const conditions = []

      if (userId) {
        conditions.push(eq(sessions.userId, userId))
      }

      if (isActive !== undefined) {
        conditions.push(eq(sessions.isActive, isActive))
      }

      if (platform) {
        conditions.push(sql`json_extract(${sessions.deviceInfo}, '$.platform') = ${platform}`)
      }

      if (deviceType) {
        conditions.push(sql`json_extract(${sessions.deviceInfo}, '$.deviceType') = ${deviceType}`)
      }

      if (ipAddress) {
        conditions.push(eq(sessions.ipAddress, ipAddress))
      }

      // 如果只要活躍 sessions，排除過期的
      if (isActive) {
        conditions.push(gt(sessions.expiresAt, new Date()))
      }

      // 查詢 sessions 列表（包含用戶資訊）
      const sessionsList = await this.db
        .select({
          id: sessions.id,
          userId: sessions.userId,
          userAgent: sessions.userAgent,
          ipAddress: sessions.ipAddress,
          deviceInfo: sessions.deviceInfo,
          location: sessions.location,
          isActive: sessions.isActive,
          lastAccessedAt: sessions.lastAccessedAt,
          expiresAt: sessions.expiresAt,
          createdAt: sessions.createdAt,
          // 用戶資訊
          username: users.username,
          fullName: users.fullName,
          role: users.role
        })
        .from(sessions)
        .leftJoin(users, eq(sessions.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(sessions.lastAccessedAt))
        .limit(limit)
        .offset(offset)

      // 計算總數
      const [{ total }] = await this.db
        .select({ total: count() })
        .from(sessions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)

      const totalPages = Math.ceil(total / limit)

      return {
        sessions: sessionsList,
        total,
        pagination: { page, limit, totalPages }
      }

    } catch (error) {
      this.handleError(error, 'getActiveSessions')
    }
  }

  // 取得 session 統計資訊
  async getSessionStats(): Promise<SessionStats> {
    try {
      // 總 sessions 數
      const [{ totalSessions }] = await this.db
        .select({ totalSessions: count() })
        .from(sessions)

      // 活躍 sessions 數
      const [{ activeSessions }] = await this.db
        .select({ activeSessions: count() })
        .from(sessions)
        .where(
          and(
            eq(sessions.isActive, true),
            gt(sessions.expiresAt, new Date())
          )
        )

      // 過期 sessions 數
      const [{ expiredSessions }] = await this.db
        .select({ expiredSessions: count() })
        .from(sessions)
        .where(lt(sessions.expiresAt, new Date()))

      // 按平台統計
      const platformStats = await this.db
        .select({
          platform: sql<string>`json_extract(${sessions.deviceInfo}, '$.platform')`,
          count: count()
        })
        .from(sessions)
        .where(eq(sessions.isActive, true))
        .groupBy(sql`json_extract(${sessions.deviceInfo}, '$.platform')`)

      const byPlatform: Record<string, number> = {}
      platformStats.forEach(stat => {
        if (stat.platform) {
          byPlatform[stat.platform] = stat.count
        }
      })

      // 按設備類型統計
      const deviceStats = await this.db
        .select({
          deviceType: sql<string>`json_extract(${sessions.deviceInfo}, '$.deviceType')`,
          count: count()
        })
        .from(sessions)
        .where(eq(sessions.isActive, true))
        .groupBy(sql`json_extract(${sessions.deviceInfo}, '$.deviceType')`)

      const byDeviceType: Record<string, number> = {}
      deviceStats.forEach(stat => {
        if (stat.deviceType) {
          byDeviceType[stat.deviceType] = stat.count
        }
      })

      // 最近24小時登入次數
      const oneDayAgo = new Date()
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)

      const [{ recentLogins }] = await this.db
        .select({ recentLogins: count() })
        .from(sessions)
        .where(gt(sessions.createdAt, oneDayAgo))

      return {
        totalSessions,
        activeSessions,
        expiredSessions,
        byPlatform,
        byDeviceType,
        recentLogins
      }

    } catch (error) {
      this.handleError(error, 'getSessionStats')
    }
  }

  // 延長 session 有效期
  async extendSession(sessionId: string, additionalHours = 24): Promise<boolean> {
    try {
      const session = await this.db
        .select({ expiresAt: sessions.expiresAt })
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .get()

      if (!session) {
        return false
      }

      const newExpiresAt = new Date(session.expiresAt)
      newExpiresAt.setHours(newExpiresAt.getHours() + additionalHours)

      const result = await this.db
        .update(sessions)
        .set({
          expiresAt: newExpiresAt,
          updatedAt: new Date()
        })
        .where(eq(sessions.id, sessionId))

      return true // TODO: Drizzle ORM doesn't return changes count directly

    } catch (error) {
      console.error('Extend session error:', error)
      return false
    }
  }

  // 檢查 session 是否有效
  async isSessionValid(token: string): Promise<boolean> {
    try {
      const session = await this.db
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.token, token),
            eq(sessions.isActive, true),
            gt(sessions.expiresAt, new Date())
          )
        )
        .get()

      return !!session

    } catch (error) {
      console.error('Check session validity error:', error)
      return false
    }
  }

  // 取得特定 IP 的 sessions（安全監控）
  async getSessionsByIP(ipAddress: string, limit = 10): Promise<any[]> {
    try {
      const sessionsList = await this.db
        .select({
          id: sessions.id,
          userId: sessions.userId,
          userAgent: sessions.userAgent,
          deviceInfo: sessions.deviceInfo,
          isActive: sessions.isActive,
          lastAccessedAt: sessions.lastAccessedAt,
          createdAt: sessions.createdAt,
          // 用戶資訊
          username: users.username,
          fullName: users.fullName
        })
        .from(sessions)
        .leftJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.ipAddress, ipAddress))
        .orderBy(desc(sessions.createdAt))
        .limit(limit)

      return sessionsList

    } catch (error) {
      this.handleError(error, 'getSessionsByIP')
    }
  }
}