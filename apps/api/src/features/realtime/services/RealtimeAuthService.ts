/**
 * Realtime Authentication Service
 * 專門用於 WebSocket 連線的認證服務
 *
 * 功能:
 * - Token 生成與驗證
 * - Token 撤銷與黑名單管理
 * - 用戶 Token 追蹤
 */

import { sign, verify } from 'jsonwebtoken'
import type { Env } from '../../../shared/types'
import type { D1Database } from '@cloudflare/workers-types'
import { ConsoleLogger } from '../../../core/monitoring'
import type {
  RealtimeAuthPayload,
  RealtimeAuthTokenRequest,
  RealtimeAuthTokenResponse,
  RoomType
} from '@makanmakan/shared-types'
import { TokenBlacklistService, type RevokeReason } from './TokenBlacklistService'

/**
 * WebSocket Token 驗證結果
 */
export interface WebSocketTokenVerification {
  valid: boolean
  payload?: RealtimeAuthPayload
  error?: string
  revoked?: boolean  // 是否已被撤銷
}

/**
 * Realtime 認證服務
 */
export class RealtimeAuthService {
  private db: D1Database
  private logger: ConsoleLogger
  private env: Env
  private jwtSecret: string
  private blacklistService: TokenBlacklistService | null = null

  constructor(env: Env) {
    this.env = env
    this.db = env.DB  // 使用原生 D1Database
    this.logger = new ConsoleLogger('realtime-auth')
    this.jwtSecret = env.JWT_SECRET

    if (!this.jwtSecret || this.jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be set and at least 32 characters')
    }

    // 初始化黑名單服務（使用 TOKEN_BLACKLIST 或 CACHE_KV）
    const kvNamespace = (env as any).TOKEN_BLACKLIST || env.CACHE_KV
    if (kvNamespace) {
      this.blacklistService = new TokenBlacklistService(kvNamespace)
    }
  }

  /**
   * 生成 WebSocket 連線授權 Token
   */
  async generateWebSocketToken(
    request: RealtimeAuthTokenRequest
  ): Promise<RealtimeAuthTokenResponse | { error: string }> {
    try {
      const { roomType, roomId, restaurantId, tableId, seatId, sessionId } = request

      // 驗證餐廳是否存在（基本驗證）
      // 注意：這裡可以擴展更嚴格的驗證邏輯

      // 根據房間類型進行不同的驗證
      switch (roomType) {
        case 'customer':
          // 顧客房間需要驗證桌號或座位
          if (tableId) {
            const tableExists = await this.verifyTableExists(tableId, restaurantId)
            if (!tableExists) {
              return { error: 'Invalid table ID' }
            }
          }
          if (seatId) {
            const seatExists = await this.verifySeatExists(seatId, restaurantId)
            if (!seatExists) {
              return { error: 'Invalid seat ID' }
            }
          }
          break

        case 'kitchen':
        case 'admin':
        case 'restaurant':
          // 這些房間需要使用者認證
          if (!sessionId) {
            return { error: 'Session ID required for this room type' }
          }
          // 可以在這裡驗證 sessionId 的合法性
          break

        default:
          return { error: 'Invalid room type' }
      }

      // 生成 JWT payload
      const now = Date.now()
      const expiresIn = 5 * 60 // 5 分鐘
      const expiresAt = Math.floor(now / 1000) + expiresIn

      const payload: RealtimeAuthPayload = {
        roomType,
        roomId,
        restaurantId,
        role: this.determineRole(roomType, sessionId),
        tableId,
        seatId,
        exp: expiresAt,
        iat: Math.floor(now / 1000)
      }

      // 生成 JWT token (不需要 expiresIn 因為 payload 中已經有 exp)
      const token = sign(payload, this.jwtSecret)

      // 構建 WebSocket URL
      const wsUrl = this.buildWebSocketUrl(roomType, roomId, token)

      this.logger.info('WebSocket token generated', {
        roomType,
        roomId,
        restaurantId,
        expiresIn
      })

      return {
        token,
        expiresIn,
        wsUrl
      }

    } catch (error) {
      this.logger.error('Failed to generate WebSocket token', error as Error)
      return { error: 'Failed to generate token' }
    }
  }

  /**
   * 驗證 WebSocket Token
   */
  async verifyWebSocketToken(token: string): Promise<WebSocketTokenVerification> {
    try {
      // 🔒 首先檢查 token 是否在黑名單中
      if (this.blacklistService) {
        const isRevoked = await this.blacklistService.isTokenRevoked(token)
        if (isRevoked) {
          this.logger.warn('Token has been revoked')
          return {
            valid: false,
            error: 'Token has been revoked',
            revoked: true
          }
        }
      }

      // 驗證 JWT token
      const payload = verify(token, this.jwtSecret) as RealtimeAuthPayload

      // 檢查 payload 的必要欄位
      if (!payload.roomType || !payload.roomId || !payload.restaurantId) {
        return {
          valid: false,
          error: 'Invalid token payload'
        }
      }

      // 檢查 token 是否過期
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < now) {
        return {
          valid: false,
          error: 'Token expired'
        }
      }

      this.logger.info('WebSocket token verified', {
        roomType: payload.roomType,
        roomId: payload.roomId,
        restaurantId: payload.restaurantId
      })

      return {
        valid: true,
        payload
      }

    } catch (error) {
      this.logger.error('Token verification failed', error as Error)

      if (error instanceof Error) {
        if (error.name === 'TokenExpiredError') {
          return { valid: false, error: 'Token expired' }
        }
        if (error.name === 'JsonWebTokenError') {
          return { valid: false, error: 'Invalid token' }
        }
      }

      return {
        valid: false,
        error: 'Token verification failed'
      }
    }
  }

  /**
   * 撤銷 WebSocket Token
   */
  async revokeToken(
    token: string,
    reason: RevokeReason,
    revokedBy?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.blacklistService) {
      return {
        success: false,
        error: 'Token blacklist service not available'
      }
    }

    try {
      const result = await this.blacklistService.revokeToken(token, reason, {
        revokedBy
      })

      this.logger.info('Token revoked successfully', {
        tokenId: result.tokenId,
        reason,
        revokedBy
      })

      return { success: true }

    } catch (error) {
      this.logger.error('Failed to revoke token', error as Error)
      return {
        success: false,
        error: 'Failed to revoke token'
      }
    }
  }

  /**
   * 撤銷用戶的所有 Token
   */
  async revokeUserTokens(
    userId: string,
    reason: RevokeReason,
    revokedBy?: string
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    if (!this.blacklistService) {
      return {
        success: false,
        error: 'Token blacklist service not available'
      }
    }

    try {
      const result = await this.blacklistService.revokeUserTokens(
        userId,
        reason,
        revokedBy
      )

      this.logger.info('User tokens revoked', {
        userId,
        count: result.count,
        reason
      })

      return { success: true, count: result.count }

    } catch (error) {
      this.logger.error('Failed to revoke user tokens', error as Error)
      return {
        success: false,
        error: 'Failed to revoke user tokens'
      }
    }
  }

  /**
   * 檢查 Token 是否已被撤銷
   */
  async isTokenRevoked(token: string): Promise<boolean> {
    if (!this.blacklistService) {
      return false  // 如果沒有黑名單服務，假設 token 未被撤銷
    }

    return this.blacklistService.isTokenRevoked(token)
  }

  /**
   * 獲取黑名單統計信息
   */
  async getBlacklistStats(): Promise<{
    available: boolean
    estimatedCount?: number
    sampleRecords?: unknown[]
  }> {
    if (!this.blacklistService) {
      return { available: false }
    }

    const stats = await this.blacklistService.getStats()
    return {
      available: true,
      ...stats
    }
  }

  /**
   * 驗證桌號是否存在
   */
  private async verifyTableExists(tableId: string, restaurantId: string): Promise<boolean> {
    try {
      // 使用原生 SQL 查詢來驗證 - 支持 ID 或 QR code
      const stmt = this.db.prepare(
        `SELECT id, restaurant_id FROM tables WHERE (id = ? OR qr_code = ?) AND restaurant_id = ? AND is_active = 1 LIMIT 1`
      ).bind(tableId, tableId, restaurantId)

      const result: any = await stmt.all()

      return result.results && result.results.length > 0
    } catch (error) {
      this.logger.error('Failed to verify table', error as Error)
      return false
    }
  }

  /**
   * 驗證座位是否存在
   */
  private async verifySeatExists(seatId: string, restaurantId: string): Promise<boolean> {
    try {
      // 使用原生 SQL 查詢來驗證（需要 JOIN tables）
      const stmt = this.db.prepare(
        `SELECT s.id
         FROM seats s
         INNER JOIN tables t ON s.table_id = t.id
         WHERE s.qr_code = ? AND t.restaurant_id = ? AND s.is_active = 1
         LIMIT 1`
      ).bind(seatId, parseInt(restaurantId))

      const result: any = await stmt.all()

      return result.results && result.results.length > 0
    } catch (error) {
      this.logger.error('Failed to verify seat', error as Error)
      return false
    }
  }

  /**
   * 根據房間類型決定角色
   */
  private determineRole(
    roomType: RoomType,
    _sessionId?: string
  ): 'customer' | 'staff' | 'admin' {
    // 如果有 sessionId，可以查詢使用者角色
    // 目前簡化處理
    if (roomType === 'customer') {
      return 'customer'
    }
    if (roomType === 'kitchen') {
      return 'staff'
    }
    if (roomType === 'admin' || roomType === 'restaurant') {
      return 'admin'
    }
    return 'customer'
  }

  /**
   * 構建 WebSocket URL
   */
  private buildWebSocketUrl(roomType: RoomType, roomId: string, token: string): string {
    // 從環境變數或配置中取得 WebSocket 基礎 URL
    // 目前使用硬編碼，之後可以改為環境變數
    const baseUrl = (this.env as any).REALTIME_WS_URL || 'wss://realtime.makanmakan.workers.dev'
    return `${baseUrl}/${roomType}/${roomId}?token=${token}`
  }
}
