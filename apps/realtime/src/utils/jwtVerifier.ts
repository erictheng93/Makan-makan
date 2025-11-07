/**
 * JWT 驗證工具
 * 用於驗證 WebSocket 連線的 JWT token
 */

import { verify } from 'jsonwebtoken'
import type { RealtimeAuthPayload } from '@makanmakan/shared-types'

export interface TokenVerificationResult {
  valid: boolean
  payload?: RealtimeAuthPayload
  error?: string
}

/**
 * 驗證 JWT token
 */
export async function verifyWebSocketToken(
  token: string,
  jwtSecret: string
): Promise<TokenVerificationResult> {
  try {
    if (!token) {
      return {
        valid: false,
        error: 'Token is required'
      }
    }

    if (!jwtSecret || jwtSecret.length < 32) {
      console.error('JWT_SECRET is not properly configured')
      return {
        valid: false,
        error: 'Server configuration error'
      }
    }

    // 驗證 JWT token
    const payload = verify(token, jwtSecret) as RealtimeAuthPayload

    // 檢查必要欄位
    if (!payload.roomType || !payload.roomId || !payload.restaurantId) {
      return {
        valid: false,
        error: 'Invalid token payload: missing required fields'
      }
    }

    // 檢查 token 是否過期（verify 已經會檢查，但我們再加一層保險）
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) {
      return {
        valid: false,
        error: 'Token has expired'
      }
    }

    return {
      valid: true,
      payload
    }

  } catch (error) {
    console.error('Token verification error:', error)

    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        return { valid: false, error: 'Token has expired' }
      }
      if (error.name === 'JsonWebTokenError') {
        return { valid: false, error: 'Invalid token format' }
      }
      if (error.name === 'NotBeforeError') {
        return { valid: false, error: 'Token not yet valid' }
      }
    }

    return {
      valid: false,
      error: 'Token verification failed'
    }
  }
}

/**
 * 從 URL 查詢參數中提取 token
 */
export function extractTokenFromUrl(url: URL): string | null {
  return url.searchParams.get('token')
}
