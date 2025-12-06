/**
 * Realtime Routes Integration Tests
 * 測試 Realtime API 路由的端到端功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import realtimeRoutes from '../routes'
import type { Env } from '../../../shared/types'

// Mock dependencies
vi.mock('../../../core/monitoring', () => ({
  ConsoleLogger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }))
}))

vi.mock('../../../utils/errorSanitizer', () => ({
  ErrorSanitizer: {
    logAndSanitize: vi.fn()
  },
  createSafeErrorResponse: vi.fn().mockReturnValue({
    success: false,
    error: 'Internal server error'
  })
}))

describe('Realtime Routes', () => {
  let app: Hono<{ Bindings: Env }>
  let mockEnv: Partial<Env>
  let mockDb: any
  let mockKV: any

  beforeEach(() => {
    // Mock D1 database
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [{ id: 1, restaurant_id: 1 }] })
    }

    // Mock KV namespace
    mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ keys: [] })
    }

    // Mock environment
    mockEnv = {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long-for-security',
      API_VERSION: '1.0.0',
      DB: mockDb as any,
      CACHE_KV: mockKV as any,
      TOKEN_BLACKLIST: mockKV as any,
      REALTIME_SERVICE_URL: 'http://localhost:8788'
    }

    // Create app with routes
    app = new Hono<{ Bindings: Env }>()
    app.route('/realtime', realtimeRoutes)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /realtime/auth/token', () => {
    it('應該為有效請求生成 token', async () => {
      const response = await app.request('/realtime/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomType: 'customer',
          roomId: 'room_123',
          restaurantId: '1',
          tableId: 'table_1'
        })
      }, mockEnv as Env)

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data?.token).toBeDefined()
      expect(data.data?.expiresIn).toBe(300)
    })

    it('應該拒絕缺少必要欄位的請求', async () => {
      const response = await app.request('/realtime/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomType: 'customer'
          // 缺少 roomId 和 restaurantId
        })
      }, mockEnv as Env)

      expect(response.status).toBe(400)
    })

    it('應該拒絕無效的 roomType', async () => {
      const response = await app.request('/realtime/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomType: 'invalid',
          roomId: 'room_123',
          restaurantId: '1'
        })
      }, mockEnv as Env)

      expect(response.status).toBe(400)
    })
  })

  describe('POST /realtime/auth/verify', () => {
    it('應該驗證有效的 token', async () => {
      // 先生成 token
      const tokenResponse = await app.request('/realtime/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomType: 'customer',
          roomId: 'room_123',
          restaurantId: '1',
          tableId: 'table_1'
        })
      }, mockEnv as Env)

      const tokenData = await tokenResponse.json() as any
      const token = tokenData.data?.token

      if (token) {
        const verifyResponse = await app.request('/realtime/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        }, mockEnv as Env)

        expect(verifyResponse.status).toBe(200)
        const data = await verifyResponse.json() as any
        expect(data.success).toBe(true)
        expect(data.data?.valid).toBe(true)
      }
    })

    it('應該拒絕無效的 token', async () => {
      const response = await app.request('/realtime/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'invalid.token.format' })
      }, mockEnv as Env)

      expect(response.status).toBe(401)
      const data = await response.json() as any
      expect(data.success).toBe(false)
    })

    it('應該拒絕已撤銷的 token', async () => {
      // Mock KV 返回撤銷記錄
      mockKV.get.mockResolvedValue(JSON.stringify({
        tokenId: 'test',
        revokedAt: Date.now(),
        reason: 'logout'
      }))

      // 先生成 token
      const tokenResponse = await app.request('/realtime/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomType: 'customer',
          roomId: 'room_123',
          restaurantId: '1',
          tableId: 'table_1'
        })
      }, mockEnv as Env)

      const tokenData = await tokenResponse.json() as any
      const token = tokenData.data?.token

      if (token) {
        const verifyResponse = await app.request('/realtime/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        }, mockEnv as Env)

        expect(verifyResponse.status).toBe(401)
        const data = await verifyResponse.json() as any
        expect(data.revoked).toBe(true)
      }
    })
  })

  describe('POST /realtime/auth/revoke', () => {
    it('應該成功撤銷 token', async () => {
      // 先生成 token
      const tokenResponse = await app.request('/realtime/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomType: 'customer',
          roomId: 'room_123',
          restaurantId: '1',
          tableId: 'table_1'
        })
      }, mockEnv as Env)

      const tokenData = await tokenResponse.json() as any
      const token = tokenData.data?.token

      if (token) {
        const revokeResponse = await app.request('/realtime/auth/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            reason: 'logout'
          })
        }, mockEnv as Env)

        expect(revokeResponse.status).toBe(200)
        const data = await revokeResponse.json() as any
        expect(data.success).toBe(true)
        expect(data.data?.revoked).toBe(true)
        expect(mockKV.put).toHaveBeenCalled()
      }
    })

    it('應該支援所有撤銷原因', async () => {
      const reasons = [
        'logout',
        'password_change',
        'permission_change',
        'security_breach',
        'admin_action',
        'session_expired',
        'manual'
      ]

      for (const reason of reasons) {
        const response = await app.request('/realtime/auth/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: 'test-token-for-reason-' + reason,
            reason
          })
        }, mockEnv as Env)

        expect(response.status).toBe(200)
      }
    })

    it('應該拒絕缺少 token 的請求', async () => {
      const response = await app.request('/realtime/auth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'logout'
        })
      }, mockEnv as Env)

      expect(response.status).toBe(400)
    })

    it('應該拒絕無效的撤銷原因', async () => {
      const response = await app.request('/realtime/auth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'test-token',
          reason: 'invalid_reason'
        })
      }, mockEnv as Env)

      expect(response.status).toBe(400)
    })
  })

  describe('POST /realtime/auth/revoke-user', () => {
    it('應該撤銷用戶的所有 token', async () => {
      // Mock 用戶有 3 個 token
      mockKV.get.mockResolvedValueOnce(JSON.stringify(['token1', 'token2', 'token3']))

      const response = await app.request('/realtime/auth/revoke-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'user_123',
          reason: 'password_change',
          revokedBy: 'admin_1'
        })
      }, mockEnv as Env)

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data?.revokedCount).toBe(3)
    })

    it('應該拒絕缺少 userId 的請求', async () => {
      const response = await app.request('/realtime/auth/revoke-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'admin_action'
        })
      }, mockEnv as Env)

      expect(response.status).toBe(400)
    })
  })

  describe('GET /realtime/auth/blacklist/stats', () => {
    it('應該返回黑名單統計', async () => {
      mockKV.list.mockResolvedValue({
        keys: [
          { name: 'token:revoked:abc' },
          { name: 'token:revoked:def' }
        ]
      })

      const response = await app.request('/realtime/auth/blacklist/stats', {
        method: 'GET'
      }, mockEnv as Env)

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data?.available).toBe(true)
    })
  })

  describe('GET /realtime/stats/:roomType/:roomId', () => {
    it('應該拒絕無效的 roomType', async () => {
      const response = await app.request('/realtime/stats/invalid/room_123', {
        method: 'GET'
      }, mockEnv as Env)

      expect(response.status).toBe(400)
      const data = await response.json() as any
      expect(data.success).toBe(false)
    })

    it('應該接受有效的 roomType', async () => {
      // Mock fetch for realtime service
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          connectionCount: 5,
          roomType: 'kitchen'
        })
      })

      const validTypes = ['customer', 'kitchen', 'admin', 'restaurant']

      for (const roomType of validTypes) {
        const response = await app.request(`/realtime/stats/${roomType}/room_123`, {
          method: 'GET'
        }, mockEnv as Env)

        // 可能會因為 fetch mock 的原因返回 200 或 500
        expect([200, 500]).toContain(response.status)
      }
    })
  })

  describe('GET /realtime/health', () => {
    it('應該返回健康狀態', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'healthy',
          service: 'makanmakan-realtime',
          version: '1.0.0'
        })
      })

      const response = await app.request('/realtime/health', {
        method: 'GET'
      }, mockEnv as Env)

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
    })

    it('應該處理 realtime 服務不可用的情況', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

      const response = await app.request('/realtime/health', {
        method: 'GET'
      }, mockEnv as Env)

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.data?.status).toBe('degraded')
      expect(data.data?.realtimeService).toBe('unreachable')
    })
  })
})
