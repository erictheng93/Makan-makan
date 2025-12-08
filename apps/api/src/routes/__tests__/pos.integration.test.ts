/**
 * POS API Integration Tests
 * 測試 POS API 端點的集成功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import type { Env } from '../../types/env'

// Mock POSService before importing routes
// Method names must match those called in pos.ts routes
const mockPOSService = {
  createRegister: vi.fn(),
  getRegisters: vi.fn(),
  startShift: vi.fn(),
  endShift: vi.fn(),
  processCashMovement: vi.fn(),  // Route calls processCashMovement
  printReceipt: vi.fn(),
  processRefund: vi.fn(),
  generateShiftReport: vi.fn(),  // Route calls generateShiftReport
  getShiftStats: vi.fn(),        // Route calls getShiftStats
  getRegisterStatus: vi.fn(),
  getShiftMovements: vi.fn(),
}

vi.mock('@makanmakan/database', () => ({
  POSService: vi.fn().mockImplementation(() => mockPOSService),
  getCurrentTimestamp: vi.fn().mockReturnValue('2024-01-01T00:00:00Z'),
}))

import posRoutes from '../../features/pos/routes'

describe.skip('POS API Integration Tests', () => {
  let app: Hono<{ Bindings: Env }>
  let mockEnv: Env
  let mockDB: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // 創建 mock 環境
    mockDB = createMockDB()
    mockEnv = {
      DB: mockDB,
      JWT_SECRET: 'test-jwt-secret-for-pos-integration-tests-minimum-32-chars',
      CLOUDFLARE_IMAGES_KEY: 'test-key',
    } as Env

    // 設置默認 mock 返回值
    mockPOSService.createRegister.mockResolvedValue({
      success: true,
      data: { id: 'register-uuid-1', name: 'POS-001', restaurantId: 1 }
    })
    mockPOSService.getRegisters.mockResolvedValue({
      success: true,
      data: [{ id: 'register-uuid-1', name: 'POS-001', restaurantId: 1 }]
    })
    mockPOSService.startShift.mockResolvedValue({
      success: true,
      data: { id: 'shift-uuid-1', registerId: 'register-uuid-1', startAmount: 100, status: 'active' }
    })
    mockPOSService.endShift.mockResolvedValue({
      success: true,
      data: { shift: { id: 'shift-uuid-1', endTime: '2024-01-01T08:00:00Z', status: 'closed' } }
    })
    mockPOSService.processCashMovement.mockResolvedValue({
      success: true,
      data: { id: 1, type: 'cash_in', amount: 50 }
    })
    mockPOSService.printReceipt.mockResolvedValue({
      success: true,
      data: { receiptNumber: 'RCP-001', printed: true }
    })
    mockPOSService.processRefund.mockResolvedValue({
      success: true,
      data: { refundId: 1, status: 'completed', refundAmount: 1000 }
    })
    mockPOSService.generateShiftReport.mockResolvedValue({
      success: true,
      data: { shiftId: 'shift-uuid-1', totalSales: 1000, reportData: { items: [], summary: {} } }
    })
    mockPOSService.getShiftStats.mockResolvedValue({
      success: true,
      data: { totalShifts: 10, averageSales: 500 }
    })
    mockPOSService.getRegisterStatus.mockResolvedValue({
      success: true,
      data: { id: 'register-uuid-1', status: 'active' }
    })
    mockPOSService.getShiftMovements.mockResolvedValue({
      success: true,
      data: [{ id: 1, type: 'cash_in', amount: 50 }]
    })

    // 創建應用實例
    app = new Hono<{ Bindings: Env }>()

    // 注入 mockEnv 到請求上下文
    app.use('*', async (c, next) => {
      // Inject mock environment
      if (!c.env) {
        (c as any).env = {}
      }
      Object.assign(c.env, mockEnv)
      await next()
    })

    app.route('/api/v1/pos', posRoutes)
  })

  afterEach(() => {
    mockDB = null
  })

  // ==========================================
  // 收銀機管理端點測試
  // ==========================================

  describe('POST /api/v1/pos/registers - 創建收銀機', () => {
    it('應該成功創建收銀機（管理員）', async () => {
      const res = await app.request('/api/v1/pos/registers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await createTestToken({ role: 0 })}`,
        },
        body: JSON.stringify({
          name: 'POS-001',
          location: 'Front Counter',
          restaurantId: 1,
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('POS-001')
    })

    it('應該拒絕非管理員創建收銀機', async () => {
      const res = await app.request('/api/v1/pos/registers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await createTestToken({ role: 4 })}`, // Cashier
        },
        body: JSON.stringify({
          name: 'POS-001',
          restaurantId: 1,
        }),
      })

      expect(res.status).toBe(403)
    })

    it('應該驗證必填字段', async () => {
      const res = await app.request('/api/v1/pos/registers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await createTestToken({ role: 0 })}`,
        },
        body: JSON.stringify({
          // 缺少 name 和 restaurantId
          location: 'Test',
        }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/v1/pos/registers - 獲取收銀機列表', () => {
    it('應該返回餐廳的收銀機列表', async () => {
      // 先創建測試數據
      mockDB._mockData.registers.set('reg1', {
        id: 'reg1',
        name: 'POS-001',
        restaurantId: 1,
        isActive: true,
      })

      const res = await app.request('/api/v1/pos/registers?restaurantId=1', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${await createTestToken({ role: 1, restaurantId: 1 })}`,
        },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data)).toBe(true)
    })

    it('應該拒絕查看其他餐廳的收銀機（店主權限）', async () => {
      const res = await app.request('/api/v1/pos/registers?restaurantId=2', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${await createTestToken({ role: 1, restaurantId: 1 })}`,
        },
      })

      expect(res.status).toBe(403)
    })
  })

  // ==========================================
  // 班次管理端點測試
  // ==========================================

  describe('POST /api/v1/pos/shifts/start - 開始班次', () => {
    it('應該成功開始班次', async () => {
      const registerId = crypto.randomUUID()
      mockDB._mockData.registers.set(registerId, {
        id: registerId,
        name: 'POS-001',
        restaurantId: 1,
        isActive: true,
      })

      const res = await app.request('/api/v1/pos/shifts/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await createTestToken({ role: 4, id: 1 })}`, // Cashier
        },
        body: JSON.stringify({
          registerId,
          operatorId: 1,
          startAmount: 1000,
          notes: '早班開始',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('active')
    })

    it('應該拒絕為他人開班（非管理員）', async () => {
      const registerId = crypto.randomUUID()

      const res = await app.request('/api/v1/pos/shifts/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await createTestToken({ role: 4, id: 1 })}`,
        },
        body: JSON.stringify({
          registerId,
          operatorId: 2, // 不同的操作員
          startAmount: 1000,
        }),
      })

      expect(res.status).toBe(403)
    })
  })

  describe('POST /api/v1/pos/shifts/:shiftId/end - 結束班次', () => {
    it('應該成功結束班次', async () => {
      const shiftId = crypto.randomUUID()
      mockDB._mockData.shifts.set(shiftId, {
        id: shiftId,
        status: 'active',
        startAmount: 1000,
        totalSales: 5000,
        totalRefunds: 0,
      })
      mockDB._mockData.users.set(1, { id: 1, fullName: 'Test User' })

      const res = await app.request(`/api/v1/pos/shifts/${shiftId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await createTestToken({ role: 4, id: 1 })}`,
        },
        body: JSON.stringify({
          actualAmount: 6000,
          closingNotes: '今日結束',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.shift.status).toBe('closed')
    })
  })

  // ==========================================
  // 現金操作端點測試
  // ==========================================

  describe('POST /api/v1/pos/shifts/:shiftId/cash - 記錄現金操作', () => {
    it('應該成功記錄現金存入', async () => {
      const shiftId = crypto.randomUUID()
      mockDB._mockData.shifts.set(shiftId, {
        id: shiftId,
        status: 'active',
      })

      const res = await app.request(`/api/v1/pos/shifts/${shiftId}/cash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await createTestToken({ role: 4, id: 1 })}`,
        },
        body: JSON.stringify({
          type: 'cash_in',
          amount: 500,
          description: '現金存入',
          denominationBreakdown: { '100': 5 },
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })
  })

  // ==========================================
  // 收據管理端點測試
  // ==========================================

  describe('POST /api/v1/pos/receipts/print - 打印收據', () => {
    it('應該成功打印收據', async () => {
      const orderId = 1
      mockDB._mockData.orders.set(orderId, {
        id: orderId,
        orderNumber: 'ORD-001',
        totalAmount: 100,
      })

      const res = await app.request('/api/v1/pos/receipts/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await createTestToken({ role: 4 })}`,
          'X-Register-Id': crypto.randomUUID(),
        },
        body: JSON.stringify({
          orderId,
          receiptType: 'customer',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.receiptNumber).toBeDefined()
    })

    it('應該要求 X-Register-Id header', async () => {
      const res = await app.request('/api/v1/pos/receipts/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await createTestToken({ role: 4 })}`,
        },
        body: JSON.stringify({
          orderId: 1,
        }),
      })

      expect(res.status).toBe(400)
    })
  })

  // ==========================================
  // 退款處理端點測試
  // ==========================================

  describe('POST /api/v1/pos/refunds/create - 處理退款', () => {
    it('應該成功處理退款（管理員）', async () => {
      const orderId = 1
      mockDB._mockData.orders.set(orderId, {
        id: orderId,
        totalAmount: 1000,
      })

      const res = await app.request('/api/v1/pos/refunds/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await createTestToken({ role: 0 })}`,
          'X-Register-Id': crypto.randomUUID(),
        },
        body: JSON.stringify({
          originalOrderId: orderId,
          refundType: 'full',
          refundAmount: 1000,
          refundMethod: 'cash',
          reasonCode: 'customer_request',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.refundAmount).toBe(1000)
    })

    it('應該拒絕非管理員/店主處理退款', async () => {
      const res = await app.request('/api/v1/pos/refunds/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await createTestToken({ role: 4 })}`, // Cashier
          'X-Register-Id': crypto.randomUUID(),
        },
        body: JSON.stringify({
          originalOrderId: 1,
          refundType: 'full',
          refundAmount: 100,
          refundMethod: 'cash',
          reasonCode: 'test',
        }),
      })

      expect(res.status).toBe(403)
    })
  })

  // ==========================================
  // 報表端點測試
  // ==========================================

  describe('GET /api/v1/pos/shifts/:shiftId/report - 獲取班次報表', () => {
    it('應該成功獲取班次報表', async () => {
      const shiftId = crypto.randomUUID()
      mockDB._mockData.shifts.set(shiftId, {
        id: shiftId,
        registerId: crypto.randomUUID(),
        operatorId: 1,
        status: 'closed',
        startAmount: 1000,
        totalSales: 5000,
      })
      mockDB._mockData.users.set(1, { id: 1, fullName: 'Test User' })
      mockDB._mockData.registers.set('reg1', { id: 'reg1', name: 'POS-001' })

      const res = await app.request(`/api/v1/pos/shifts/${shiftId}/report`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${await createTestToken({ role: 4 })}`,
        },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.reportData).toBeDefined()
    })
  })

  describe('GET /api/v1/pos/stats/shifts - 獲取班次統計', () => {
    it('應該返回班次統計（管理員）', async () => {
      const res = await app.request(
        '/api/v1/pos/stats/shifts?restaurantId=1',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${await createTestToken({ role: 0 })}`,
          },
        }
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })

    it('應該支持日期範圍過濾', async () => {
      const res = await app.request(
        '/api/v1/pos/stats/shifts?restaurantId=1&dateFrom=2024-01-01T00:00:00Z&dateTo=2024-01-31T23:59:59Z',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${await createTestToken({ role: 1, restaurantId: 1 })}`,
          },
        }
      )

      expect(res.status).toBe(200)
    })
  })

  // ==========================================
  // 收銀機狀態端點測試
  // ==========================================

  describe('GET /api/v1/pos/registers/:registerId/status - 獲取收銀機狀態', () => {
    it('應該返回收銀機狀態', async () => {
      const registerId = crypto.randomUUID()
      // Route queries cash_registers table, not registers
      mockDB._mockData.cash_registers.set(registerId, {
        id: registerId,
        name: 'POS-001',
        is_active: true,
        hardware_config: '{}',
        peripherals: '{}',
        settings: '{}',
      })

      const res = await app.request(
        `/api/v1/pos/registers/${registerId}/status`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${await createTestToken({ role: 4 })}`,
          },
        }
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('POS-001')
    })
  })

  // ==========================================
  // 現金流動記錄端點測試
  // ==========================================

  describe('GET /api/v1/pos/shifts/:shiftId/movements - 獲取現金流動記錄', () => {
    it('應該返回班次的現金流動記錄', async () => {
      const shiftId = crypto.randomUUID()

      const res = await app.request(
        `/api/v1/pos/shifts/${shiftId}/movements?page=1&limit=20`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${await createTestToken({ role: 4 })}`,
          },
        }
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.movements).toBeDefined()
      expect(data.data.pagination).toBeDefined()
    })

    it('應該支持類型過濾', async () => {
      const shiftId = crypto.randomUUID()

      const res = await app.request(
        `/api/v1/pos/shifts/${shiftId}/movements?type=cash_in`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${await createTestToken({ role: 4 })}`,
          },
        }
      )

      expect(res.status).toBe(200)
    })
  })
})

// ==========================================
// Helper Functions
// ==========================================

import { sign } from 'hono/jwt'

// Must match the JWT_SECRET in mockEnv (32+ characters required)
const TEST_JWT_SECRET = 'test-jwt-secret-for-pos-integration-tests-minimum-32-chars'

function createMockDB() {
  const mockData = {
    registers: new Map(),
    cash_registers: new Map(),  // Route queries cash_registers table
    shifts: new Map(),
    cash_shifts: new Map(),     // Route queries cash_shifts table
    movements: new Map(),
    receipts: new Map(),
    refunds: new Map(),
    reports: new Map(),
    orders: new Map(),
    users: new Map(),
  }

  return {
    prepare: (query: string) => ({
      bind: (...args: any[]) => ({
        first: async () => {
          // 簡化實現：根據 mockData 返回
          const tableName = extractTableName(query)
          const data = mockData[tableName as keyof typeof mockData]
          if (data && data.size > 0) {
            return Array.from(data.values())[0]
          }
          return null
        },
        all: async () => ({
          results: Array.from(
            mockData[extractTableName(query) as keyof typeof mockData]
              ?.values() || []
          ),
        }),
        run: async () => ({ success: true }),
      }),
    }),
    _mockData: mockData,
  }
}

function extractTableName(query: string): string {
  const match = query.match(/FROM\s+(\w+)/i)
  return match ? match[1] : 'registers'
}

async function createTestToken(payload: {
  role?: number
  id?: number
  restaurantId?: number
}): Promise<string> {
  // 使用 Hono 的 JWT 簽名（與 auth middleware 相同）
  const now = Math.floor(Date.now() / 1000)
  const tokenPayload = {
    id: payload.id ?? 1,
    username: 'testuser',
    role: payload.role ?? 0,
    restaurantId: payload.restaurantId ?? 1,
    iat: now,
    exp: now + 3600, // 1 hour
  }
  return await sign(tokenPayload, TEST_JWT_SECRET)
}
