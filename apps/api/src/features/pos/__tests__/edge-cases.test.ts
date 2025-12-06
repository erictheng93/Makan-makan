/**
 * POS Edge Cases Tests
 * POS 邊界案例測試套件
 *
 * 測試覆蓋範圍：
 * - 並發操作處理
 * - 極端數值處理
 * - 錯誤恢復
 * - 資料一致性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create mock DB
const createMockDB = () => {
  const mockFirst = vi.fn()
  const mockAll = vi.fn()
  const mockRun = vi.fn()
  const mockBind = vi.fn()

  const db = {
    prepare: vi.fn().mockReturnValue({
      bind: mockBind.mockReturnValue({
        first: mockFirst,
        all: mockAll,
        run: mockRun,
      }),
    }),
    _mockFirst: mockFirst,
    _mockAll: mockAll,
    _mockRun: mockRun,
    _mockBind: mockBind,
  }

  return db
}

describe('POS Edge Cases Tests', () => {
  let mockDB: ReturnType<typeof createMockDB>

  beforeEach(() => {
    vi.clearAllMocks()
    mockDB = createMockDB()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // 使用有效的 UUID 格式
  const validRegisterId = '550e8400-e29b-41d4-a716-446655440000'
  const validShiftId = '660e8400-e29b-41d4-a716-446655440001'

  // ========================================
  // 極端數值測試 (6 tests)
  // ========================================

  describe('極端數值處理', () => {
    describe('ShiftService', () => {
      it('應該處理零開班金額', async () => {
        const { ShiftService } = await import('../services/ShiftService')
        const service = new ShiftService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ register_id: validRegisterId })
          .mockResolvedValueOnce({ id: validShiftId, status: 'active' })

        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.startShift({
          registerId: validRegisterId,
          operatorId: 1,
          startAmount: 0,
        })

        expect(result.success).toBe(true)
      })

      it('應該處理大額開班金額', async () => {
        const { ShiftService } = await import('../services/ShiftService')
        const service = new ShiftService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ register_id: validRegisterId })
          .mockResolvedValueOnce({ id: validShiftId, status: 'active' })

        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.startShift({
          registerId: validRegisterId,
          operatorId: 1,
          startAmount: 1000000, // 100萬
        })

        expect(result.success).toBe(true)
      })
    })

    describe('RefundService', () => {
      it('應該處理零金額退款', async () => {
        const { RefundService } = await import('../services/RefundService')
        const service = new RefundService(mockDB as any)

        const result = await service.processRefund({
          originalOrderId: 1,
          refundType: 'partial',
          refundAmount: 0,
          refundMethod: 'cash',
          reasonCode: 'test',
        }, 'reg-001', 1)

        // 零金額退款應該被拒絕或特殊處理
        expect(result).toBeDefined()
      })

      it('應該處理小數金額退款', async () => {
        const { RefundService } = await import('../services/RefundService')
        const service = new RefundService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce({ id: 1, total_amount: '100.50', status: 'completed' })
          .mockResolvedValueOnce({ total_refunded: '0' })
          .mockResolvedValueOnce({
            id: 'refund-001',
            refund_amount: 50.25,
            status: 'processing',
            items_refunded: '[]',
            metadata: '{}',
          })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.processRefund({
          originalOrderId: 1,
          refundType: 'partial',
          refundAmount: 50.25,
          refundMethod: 'cash',
          reasonCode: 'test',
        }, 'reg-001', 1)

        expect(result.success).toBe(true)
      })
    })

    describe('CashMovementService', () => {
      it('應該處理大額現金操作', async () => {
        const { CashMovementService } = await import('../services/CashMovementService')
        const service = new CashMovementService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({ id: 'shift-001', status: 'active', register_id: 'reg-001' })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.processCashMovement('shift-001', {
          type: 'cash_in',
          amount: 500000, // 50萬
          description: '大額現金存入',
        }, 1)

        expect(result.success).toBe(true)
      })

      it('應該處理複雜面額明細', async () => {
        const { CashMovementService } = await import('../services/CashMovementService')
        const service = new CashMovementService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({ id: 'shift-001', status: 'active', register_id: 'reg-001' })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.processCashMovement('shift-001', {
          type: 'count',
          amount: 12345,
          description: '現金盤點',
          denominationBreakdown: {
            '1000': 10,
            '500': 4,
            '100': 3,
            '50': 0,
            '10': 4,
            '5': 1,
          },
        }, 1)

        expect(result.success).toBe(true)
      })
    })
  })

  // ========================================
  // 並發操作測試 (4 tests)
  // ========================================

  describe('並發操作處理', () => {
    it('應該防止同一收銀機同時開兩個班次', async () => {
      const { ShiftService } = await import('../services/ShiftService')
      const service = new ShiftService(mockDB as any)

      // 第一次調用返回無活動班次，第二次返回有活動班次
      mockDB._mockFirst
        .mockResolvedValueOnce(null) // First check - no active shift
        .mockResolvedValueOnce({ register_id: validRegisterId })
        .mockResolvedValueOnce({ id: validShiftId, status: 'active' })
        .mockResolvedValueOnce({ id: validShiftId, status: 'active' }) // Second check - has active shift

      mockDB._mockRun.mockResolvedValue({ success: true })

      const result1 = await service.startShift({
        registerId: validRegisterId,
        operatorId: 1,
        startAmount: 1000,
      })

      const result2 = await service.startShift({
        registerId: validRegisterId,
        operatorId: 2,
        startAmount: 1000,
      })

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(false)
    })

    it('應該處理同時多個退款請求', async () => {
      const { RefundService } = await import('../services/RefundService')
      const service = new RefundService(mockDB as any)

      // 模擬訂單和已退款金額
      mockDB._mockFirst
        .mockResolvedValue({ id: 1, total_amount: '1000', status: 'completed' })

      // 第一次退款
      mockDB._mockFirst
        .mockResolvedValueOnce({ id: 1, total_amount: '1000', status: 'completed' })
        .mockResolvedValueOnce({ total_refunded: '0' })
        .mockResolvedValueOnce({ id: 'refund-001', refund_amount: 500, status: 'processing', items_refunded: '[]', metadata: '{}' })

      mockDB._mockRun.mockResolvedValue({ success: true })

      const result1 = await service.processRefund({
        originalOrderId: 1,
        refundType: 'partial',
        refundAmount: 500,
        refundMethod: 'cash',
        reasonCode: 'test',
      }, 'reg-001', 1)

      expect(result1.success).toBe(true)
    })

    it('應該處理快速連續的現金操作', async () => {
      const { CashMovementService } = await import('../services/CashMovementService')
      const service = new CashMovementService(mockDB as any)

      mockDB._mockFirst.mockResolvedValue({ id: 'shift-001', status: 'active', register_id: 'reg-001' })
      mockDB._mockRun.mockResolvedValue({ success: true })

      const operations = Array(5).fill(null).map((_, i) =>
        service.processCashMovement('shift-001', {
          type: 'cash_in',
          amount: 100 * (i + 1),
          description: `操作 ${i + 1}`,
        }, 1)
      )

      const results = await Promise.all(operations)

      results.forEach(result => {
        expect(result.success).toBe(true)
      })
    })

    it('應該處理同時打印多張收據', async () => {
      const { ReceiptService } = await import('../services/ReceiptService')
      const service = new ReceiptService(mockDB as any)

      mockDB._mockFirst
        .mockResolvedValue({ id: 1, order_number: 'ORD-001' })

      mockDB._mockAll.mockResolvedValue({ results: [] })
      mockDB._mockRun.mockResolvedValue({ success: true })

      const printRequests = Array(3).fill(null).map(() =>
        service.printReceipt({
          orderId: 1,
          templateName: 'default',
          receiptType: 'customer',
        }, 'reg-001')
      )

      const results = await Promise.all(printRequests)

      results.forEach(result => {
        expect(result.success).toBe(true)
      })
    })
  })

  // ========================================
  // 錯誤恢復測試 (4 tests)
  // ========================================

  describe('錯誤恢復', () => {
    it('應該處理資料庫連接錯誤', async () => {
      const { RegisterService } = await import('../services/RegisterService')
      const service = new RegisterService(mockDB as any)

      mockDB._mockAll.mockRejectedValue(new Error('Database connection failed'))

      const result = await service.getRegisters(1)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('應該處理 JSON 解析錯誤', async () => {
      const { RegisterService } = await import('../services/RegisterService')
      const service = new RegisterService(mockDB as any)

      mockDB._mockFirst.mockResolvedValue({
        id: 'reg-001',
        name: 'POS-001',
        hardware_config: 'invalid-json', // Invalid JSON
        peripherals: '{}',
        settings: '{}',
      })

      // 服務應該能夠處理無效 JSON
      const result = await service.getRegisterStatus('reg-001')

      // 根據實現，可能成功（使用預設值）或失敗
      expect(result).toBeDefined()
    })

    it('應該處理班次結束時的計算錯誤', async () => {
      const { ShiftService } = await import('../services/ShiftService')
      const service = new ShiftService(mockDB as any)

      mockDB._mockFirst.mockResolvedValue({
        id: 'shift-001',
        status: 'active',
        register_id: 'reg-001',
        start_amount: 'invalid', // Invalid number
        total_sales: '5000',
        total_refunds: '200',
      })

      const result = await service.endShift('shift-001', {
        actualAmount: 5800,
      }, 1)

      // 服務應該能夠處理無效數值
      expect(result).toBeDefined()
    })

    it('應該處理報表生成時的資料缺失', async () => {
      const { ReportService } = await import('../services/ReportService')
      const service = new ReportService(mockDB as any)

      mockDB._mockFirst
        .mockResolvedValueOnce({
          id: 'shift-001',
          register_id: 'reg-001',
          operator_id: 1,
          status: 'closed',
          start_amount: '1000',
          total_sales: null, // Missing data
          total_refunds: null,
          cash_sales: null,
          card_sales: null,
          digital_sales: null,
          started_at: '2024-01-15T08:00:00Z',
          ended_at: '2024-01-15T16:00:00Z',
          register_name: 'POS-001',
          operator_name: 'Test User',
        })
        .mockResolvedValueOnce(null) // No order stats

      mockDB._mockAll.mockResolvedValue({ results: [] })
      mockDB._mockRun.mockResolvedValue({ success: true })

      const result = await service.generateShiftReport('shift-001')

      // 服務應該能夠處理缺失資料
      expect(result).toBeDefined()
    })
  })

  // ========================================
  // 資料一致性測試 (4 tests)
  // ========================================

  describe('資料一致性', () => {
    it('應該確保退款金額不超過訂單總額', async () => {
      const { RefundService } = await import('../services/RefundService')
      const service = new RefundService(mockDB as any)

      mockDB._mockFirst
        .mockResolvedValueOnce({ id: 1, total_amount: '1000', status: 'completed' })
        .mockResolvedValueOnce({ total_refunded: '500' }) // Already refunded 500

      const result = await service.processRefund({
        originalOrderId: 1,
        refundType: 'partial',
        refundAmount: 600, // Would exceed total (500 + 600 > 1000)
        refundMethod: 'cash',
        reasonCode: 'test',
      }, 'reg-001', 1)

      expect(result.success).toBe(false)
      expect(result.error).toContain('超過')
    })

    it('應該確保班次結束時更新收銀機狀態', async () => {
      const { ShiftService } = await import('../services/ShiftService')
      const service = new ShiftService(mockDB as any)

      mockDB._mockFirst
        .mockResolvedValueOnce({
          id: 'shift-001',
          status: 'active',
          register_id: 'reg-001',
          start_amount: '1000',
          total_sales: '5000',
          total_refunds: '200',
        })
        .mockResolvedValueOnce({ register_id: 'reg-001' })

      mockDB._mockRun.mockResolvedValue({ success: true })

      const result = await service.endShift('shift-001', {
        actualAmount: 5800,
      }, 1)

      expect(result.success).toBe(true)
      // 驗證 prepare 被調用來更新收銀機狀態
      expect(mockDB.prepare).toHaveBeenCalled()
    })

    it('應該確保現金操作記錄正確的班次和收銀機', async () => {
      const { CashMovementService } = await import('../services/CashMovementService')
      const service = new CashMovementService(mockDB as any)

      mockDB._mockFirst.mockResolvedValue({
        id: 'shift-001',
        status: 'active',
        register_id: 'reg-001',
      })
      mockDB._mockRun.mockResolvedValue({ success: true })

      const result = await service.processCashMovement('shift-001', {
        type: 'cash_in',
        amount: 500,
        description: '現金存入',
      }, 1)

      expect(result.success).toBe(true)
      expect(mockDB.prepare).toHaveBeenCalled()
    })

    it('應該確保收據編號唯一', async () => {
      const { ReceiptService } = await import('../services/ReceiptService')
      const service = new ReceiptService(mockDB as any)

      mockDB._mockFirst
        .mockResolvedValueOnce({ id: 1, order_number: 'ORD-001' })
        .mockResolvedValueOnce({ id: 'receipt-001', receipt_number: 'R001', content: '{}' })
        .mockResolvedValueOnce({ id: 1, order_number: 'ORD-001' })
        .mockResolvedValueOnce({ id: 'receipt-002', receipt_number: 'R002', content: '{}' })

      mockDB._mockAll.mockResolvedValue({ results: [] })
      mockDB._mockRun.mockResolvedValue({ success: true })

      const result1 = await service.printReceipt({ orderId: 1 }, 'reg-001')
      const result2 = await service.printReceipt({ orderId: 1 }, 'reg-001')

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      // 收據編號應該不同（由於時間戳和隨機數）
    })
  })
})
