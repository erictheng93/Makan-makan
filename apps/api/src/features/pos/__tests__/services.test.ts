/**
 * POS Services Unit Tests
 * POS 服務單元測試套件
 *
 * 測試覆蓋範圍：
 * - RegisterService (收銀機管理)
 * - ShiftService (班次管理)
 * - CashMovementService (現金操作)
 * - ReceiptService (收據管理)
 * - RefundService (退款管理)
 * - ReportService (報表統計)
 *
 * 預估測試案例：60-80 個
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create mock DB that returns proper structure
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

describe('POS Services Unit Tests', () => {
  let mockDB: ReturnType<typeof createMockDB>

  beforeEach(() => {
    vi.clearAllMocks()
    mockDB = createMockDB()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ========================================
  // RegisterService Tests (12 tests)
  // ========================================

  describe('RegisterService', () => {
    describe('createRegister', () => {
      it('應該成功創建收銀機', async () => {
        const { RegisterService } = await import('../services/RegisterService')
        const service = new RegisterService(mockDB as any)

        mockDB._mockRun.mockResolvedValue({ success: true })
        mockDB._mockFirst.mockResolvedValue({
          id: 'reg-001',
          name: 'POS-001',
          is_active: true,
          hardware_config: '{}',
          peripherals: '{}',
          settings: '{}',
        })

        const result = await service.createRegister({
          name: 'POS-001',
          restaurantId: 1,
          location: '一樓大廳',
        }, 1)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
      })

      it('應該拒絕無效的收銀機名稱', async () => {
        const { RegisterService } = await import('../services/RegisterService')
        const service = new RegisterService(mockDB as any)

        const result = await service.createRegister({
          name: '',
          restaurantId: 1,
        }, 1)

        expect(result.success).toBe(false)
      })
    })

    describe('getRegisters', () => {
      it('應該返回餐廳的收銀機列表', async () => {
        const { RegisterService } = await import('../services/RegisterService')
        const service = new RegisterService(mockDB as any)

        mockDB._mockAll.mockResolvedValue({
          results: [
            { id: 'reg-001', name: 'POS-001', is_active: true, hardware_config: '{}', peripherals: '{}', settings: '{}' },
            { id: 'reg-002', name: 'POS-002', is_active: true, hardware_config: '{}', peripherals: '{}', settings: '{}' },
          ],
        })

        const result = await service.getRegisters(1)

        expect(result.success).toBe(true)
        expect(result.data).toHaveLength(2)
      })

      it('應該處理空結果', async () => {
        const { RegisterService } = await import('../services/RegisterService')
        const service = new RegisterService(mockDB as any)

        mockDB._mockAll.mockResolvedValue({ results: [] })

        const result = await service.getRegisters(1)

        expect(result.success).toBe(true)
        expect(result.data).toHaveLength(0)
      })

      it('應該處理資料庫錯誤', async () => {
        const { RegisterService } = await import('../services/RegisterService')
        const service = new RegisterService(mockDB as any)

        mockDB._mockAll.mockRejectedValue(new Error('Database error'))

        const result = await service.getRegisters(1)

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      })
    })

    describe('getRegisterStatus', () => {
      it('應該返回收銀機狀態', async () => {
        const { RegisterService } = await import('../services/RegisterService')
        const service = new RegisterService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({
          id: 'reg-001',
          name: 'POS-001',
          is_active: true,
          hardware_config: '{}',
          peripherals: '{}',
          settings: '{}',
        })

        const result = await service.getRegisterStatus('reg-001')

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
      })

      it('應該處理不存在的收銀機', async () => {
        const { RegisterService } = await import('../services/RegisterService')
        const service = new RegisterService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue(null)

        const result = await service.getRegisterStatus('non-existent')

        expect(result.success).toBe(false)
        expect(result.error).toContain('不存在')
      })
    })

    describe('updateRegister', () => {
      it('應該成功更新收銀機設定', async () => {
        const { RegisterService } = await import('../services/RegisterService')
        const service = new RegisterService(mockDB as any)

        mockDB._mockRun.mockResolvedValue({ success: true })
        mockDB._mockFirst.mockResolvedValue({
          id: 'reg-001',
          name: 'POS-001-Updated',
          hardware_config: '{}',
          peripherals: '{}',
          settings: '{}',
        })

        const result = await service.updateRegister('reg-001', { name: 'POS-001-Updated' })

        expect(result.success).toBe(true)
      })

      it('應該拒絕空更新', async () => {
        const { RegisterService } = await import('../services/RegisterService')
        const service = new RegisterService(mockDB as any)

        const result = await service.updateRegister('reg-001', {})

        expect(result.success).toBe(false)
        expect(result.error).toContain('沒有需要更新')
      })
    })

    describe('toggleRegisterStatus', () => {
      it('應該成功啟用收銀機', async () => {
        const { RegisterService } = await import('../services/RegisterService')
        const service = new RegisterService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({ id: 'reg-001', is_active: false })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.toggleRegisterStatus('reg-001', true)

        expect(result.success).toBe(true)
      })

      it('應該成功停用收銀機', async () => {
        const { RegisterService } = await import('../services/RegisterService')
        const service = new RegisterService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({ id: 'reg-001', is_active: true })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.toggleRegisterStatus('reg-001', false)

        expect(result.success).toBe(true)
      })
    })

    describe('deleteRegister', () => {
      it('應該成功刪除無活躍班次的收銀機', async () => {
        const { RegisterService } = await import('../services/RegisterService')
        const service = new RegisterService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue(null) // No active shift
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.deleteRegister('reg-001')

        expect(result.success).toBe(true)
      })

      it('應該拒絕刪除有活躍班次的收銀機', async () => {
        const { RegisterService } = await import('../services/RegisterService')
        const service = new RegisterService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({ id: 'shift-001' }) // Has active shift

        const result = await service.deleteRegister('reg-001')

        expect(result.success).toBe(false)
        expect(result.error).toContain('活躍班次')
      })
    })
  })


  // ========================================
  // ShiftService Tests (14 tests)
  // ========================================

  describe('ShiftService', () => {
    // 使用有效的 UUID 格式
    const validRegisterId = '550e8400-e29b-41d4-a716-446655440000'

    describe('startShift', () => {
      it('應該成功開始新班次', async () => {
        const { ShiftService } = await import('../services/ShiftService')
        const service = new ShiftService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce(null) // No existing active shift
          .mockResolvedValueOnce({ register_id: validRegisterId }) // For cash movement
          .mockResolvedValueOnce({ id: 'shift-001', status: 'active' }) // Created shift

        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.startShift({
          registerId: validRegisterId,
          operatorId: 1,
          startAmount: 1000,
        })

        expect(result.success).toBe(true)
      })

      it('應該拒絕在已有活動班次時開班', async () => {
        const { ShiftService } = await import('../services/ShiftService')
        const service = new ShiftService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({ id: 'existing-shift', status: 'active' })

        const result = await service.startShift({
          registerId: validRegisterId,
          operatorId: 1,
          startAmount: 1000,
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('已有活躍班次')
      })

      it('應該拒絕負數開班金額', async () => {
        const { ShiftService } = await import('../services/ShiftService')
        const service = new ShiftService(mockDB as any)

        const result = await service.startShift({
          registerId: validRegisterId,
          operatorId: 1,
          startAmount: -100,
        })

        expect(result.success).toBe(false)
      })

      it('應該支援開班備註', async () => {
        const { ShiftService } = await import('../services/ShiftService')
        const service = new ShiftService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ register_id: validRegisterId })
          .mockResolvedValueOnce({ id: 'shift-001', status: 'active', notes: '早班' })

        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.startShift({
          registerId: validRegisterId,
          operatorId: 1,
          startAmount: 1000,
          notes: '早班',
        })

        expect(result.success).toBe(true)
      })
    })

    describe('endShift', () => {
      it('應該成功結束班次', async () => {
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
        expect(result.data?.shift).toBeDefined()
      })

      it('應該拒絕結束不存在的班次', async () => {
        const { ShiftService } = await import('../services/ShiftService')
        const service = new ShiftService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue(null)

        const result = await service.endShift('shift-001', {
          actualAmount: 5000,
        }, 1)

        expect(result.success).toBe(false)
        expect(result.error).toContain('找不到')
      })

      it('應該計算現金差額', async () => {
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
          actualAmount: 5700, // Expected: 1000 + 5000 - 200 = 5800
        }, 1)

        expect(result.success).toBe(true)
        expect(result.data?.shift.differenceAmount).toBe(-100)
      })

      it('應該支援結班備註', async () => {
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
          closingNotes: '一切正常',
        }, 1)

        expect(result.success).toBe(true)
      })
    })

    describe('getCurrentShift', () => {
      it('應該返回當前活動班次', async () => {
        const { ShiftService } = await import('../services/ShiftService')
        const service = new ShiftService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({
          id: 'shift-001',
          status: 'active',
          start_amount: 1000,
        })

        const result = await service.getCurrentShift('reg-001')

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
      })

      it('應該返回 null 當沒有活動班次', async () => {
        const { ShiftService } = await import('../services/ShiftService')
        const service = new ShiftService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue(null)

        const result = await service.getCurrentShift('reg-001')

        expect(result.success).toBe(true)
        expect(result.data).toBeNull()
      })
    })

    describe('suspendShift', () => {
      it('應該成功暫停班次', async () => {
        const { ShiftService } = await import('../services/ShiftService')
        const service = new ShiftService(mockDB as any)

        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.suspendShift('shift-001', '午休')

        expect(result.success).toBe(true)
      })

      it('應該支援無原因暫停', async () => {
        const { ShiftService } = await import('../services/ShiftService')
        const service = new ShiftService(mockDB as any)

        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.suspendShift('shift-001')

        expect(result.success).toBe(true)
      })
    })

    describe('resumeShift', () => {
      it('應該成功恢復班次', async () => {
        const { ShiftService } = await import('../services/ShiftService')
        const service = new ShiftService(mockDB as any)

        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.resumeShift('shift-001')

        expect(result.success).toBe(true)
      })
    })
  })


  // ========================================
  // CashMovementService Tests (10 tests)
  // ========================================

  describe('CashMovementService', () => {
    describe('processCashMovement', () => {
      it('應該成功記錄現金存入', async () => {
        const { CashMovementService } = await import('../services/CashMovementService')
        const service = new CashMovementService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({ id: 'shift-001', status: 'active', register_id: 'reg-001' })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.processCashMovement('shift-001', {
          type: 'cash_in',
          amount: 500,
          description: '現金存入',
        }, 1)

        expect(result.success).toBe(true)
      })

      it('應該成功記錄現金取出', async () => {
        const { CashMovementService } = await import('../services/CashMovementService')
        const service = new CashMovementService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({ id: 'shift-001', status: 'active', register_id: 'reg-001' })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.processCashMovement('shift-001', {
          type: 'cash_out',
          amount: 200,
          description: '找零補充',
        }, 1)

        expect(result.success).toBe(true)
      })

      it('應該拒絕在非活動班次記錄', async () => {
        const { CashMovementService } = await import('../services/CashMovementService')
        const service = new CashMovementService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({ id: 'shift-001', status: 'closed' })

        const result = await service.processCashMovement('shift-001', {
          type: 'cash_in',
          amount: 500,
          description: '現金存入',
        }, 1)

        expect(result.success).toBe(false)
        expect(result.error).toContain('已結束')
      })

      it('應該拒絕不存在的班次', async () => {
        const { CashMovementService } = await import('../services/CashMovementService')
        const service = new CashMovementService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue(null)

        const result = await service.processCashMovement('non-existent', {
          type: 'cash_in',
          amount: 500,
          description: '現金存入',
        }, 1)

        expect(result.success).toBe(false)
      })

      it('應該支援面額明細', async () => {
        const { CashMovementService } = await import('../services/CashMovementService')
        const service = new CashMovementService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({ id: 'shift-001', status: 'active', register_id: 'reg-001' })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.processCashMovement('shift-001', {
          type: 'count',
          amount: 5000,
          description: '現金盤點',
          denominationBreakdown: { '1000': 3, '500': 2, '100': 10 },
        }, 1)

        expect(result.success).toBe(true)
      })
    })

    describe('getCashMovements', () => {
      it('應該返回現金流動記錄', async () => {
        const { CashMovementService } = await import('../services/CashMovementService')
        const service = new CashMovementService(mockDB as any)

        mockDB._mockAll.mockResolvedValue({
          results: [
            { id: 'mov-001', type: 'cash_in', amount: 500, denomination_breakdown: '{}', metadata: '{}' },
            { id: 'mov-002', type: 'cash_out', amount: 200, denomination_breakdown: '{}', metadata: '{}' },
          ],
        })

        const result = await service.getCashMovements('shift-001', {})

        expect(result.success).toBe(true)
        expect(result.data.movements).toHaveLength(2)
      })

      it('應該支援類型過濾', async () => {
        const { CashMovementService } = await import('../services/CashMovementService')
        const service = new CashMovementService(mockDB as any)

        mockDB._mockAll.mockResolvedValue({
          results: [
            { id: 'mov-001', type: 'cash_in', amount: 500, denomination_breakdown: '{}', metadata: '{}' },
          ],
        })

        const result = await service.getCashMovements('shift-001', { type: 'cash_in' })

        expect(result.success).toBe(true)
      })

      it('應該支援分頁', async () => {
        const { CashMovementService } = await import('../services/CashMovementService')
        const service = new CashMovementService(mockDB as any)

        mockDB._mockAll.mockResolvedValue({ results: [] })

        const result = await service.getCashMovements('shift-001', { page: 2, limit: 10 })

        expect(result.success).toBe(true)
        expect(result.data.pagination.page).toBe(2)
      })
    })

    describe('approveCashMovement', () => {
      it('應該成功審核現金操作', async () => {
        const { CashMovementService } = await import('../services/CashMovementService')
        const service = new CashMovementService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({ id: 'mov-001', approval_status: 'pending' })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.approveCashMovement('mov-001', 1)

        expect(result.success).toBe(true)
      })
    })

    describe('rejectCashMovement', () => {
      it('應該成功拒絕現金操作', async () => {
        const { CashMovementService } = await import('../services/CashMovementService')
        const service = new CashMovementService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({ id: 'mov-001', approval_status: 'pending' })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.rejectCashMovement('mov-001', 1, '金額不符')

        expect(result.success).toBe(true)
      })
    })
  })


  // ========================================
  // ReceiptService Tests (12 tests)
  // ========================================

  describe('ReceiptService', () => {
    describe('printReceipt', () => {
      it('應該成功打印收據', async () => {
        const { ReceiptService } = await import('../services/ReceiptService')
        const service = new ReceiptService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce({ id: 1, order_number: 'ORD-001', total_amount: 1000 }) // Order exists
          .mockResolvedValueOnce({ id: 'receipt-001', content: '{}' }) // Created receipt

        mockDB._mockAll.mockResolvedValue({ results: [] }) // Order items
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.printReceipt({
          orderId: 1,
          templateName: 'default',
          receiptType: 'customer',
        }, 'reg-001', 'shift-001')

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
      })

      it('應該拒絕不存在的訂單', async () => {
        const { ReceiptService } = await import('../services/ReceiptService')
        const service = new ReceiptService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue(null)

        const result = await service.printReceipt({
          orderId: 999,
          templateName: 'default',
          receiptType: 'customer',
        }, 'reg-001')

        expect(result.success).toBe(false)
        expect(result.error).toContain('不存在')
      })

      it('應該支援不同收據類型', async () => {
        const { ReceiptService } = await import('../services/ReceiptService')
        const service = new ReceiptService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce({ id: 1, order_number: 'ORD-001' })
          .mockResolvedValueOnce({ id: 'receipt-001', content: '{}' })

        mockDB._mockAll.mockResolvedValue({ results: [] })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.printReceipt({
          orderId: 1,
          templateName: 'kitchen',
          receiptType: 'kitchen',
        }, 'reg-001')

        expect(result.success).toBe(true)
      })

      it('應該支援多份打印', async () => {
        const { ReceiptService } = await import('../services/ReceiptService')
        const service = new ReceiptService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce({ id: 1, order_number: 'ORD-001' })
          .mockResolvedValueOnce({ id: 'receipt-001', content: '{}' })

        mockDB._mockAll.mockResolvedValue({ results: [] })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.printReceipt({
          orderId: 1,
          copies: 3,
        }, 'reg-001')

        expect(result.success).toBe(true)
      })
    })

    describe('reprintReceipt', () => {
      it('應該成功重打收據', async () => {
        const { ReceiptService } = await import('../services/ReceiptService')
        const service = new ReceiptService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({ id: 'receipt-001', reprinted_count: 0 })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.reprintReceipt('receipt-001')

        expect(result.success).toBe(true)
      })

      it('應該拒絕不存在的收據', async () => {
        const { ReceiptService } = await import('../services/ReceiptService')
        const service = new ReceiptService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue(null)

        const result = await service.reprintReceipt('non-existent')

        expect(result.success).toBe(false)
        expect(result.error).toContain('不存在')
      })
    })

    describe('getReceipts', () => {
      it('應該返回收據列表', async () => {
        const { ReceiptService } = await import('../services/ReceiptService')
        const service = new ReceiptService(mockDB as any)

        mockDB._mockAll.mockResolvedValue({
          results: [
            { id: 'receipt-001', receipt_number: 'R001', content: '{}' },
            { id: 'receipt-002', receipt_number: 'R002', content: '{}' },
          ],
        })

        const result = await service.getReceipts('reg-001')

        expect(result.success).toBe(true)
        expect(result.data.receipts).toHaveLength(2)
      })

      it('應該支援日期過濾', async () => {
        const { ReceiptService } = await import('../services/ReceiptService')
        const service = new ReceiptService(mockDB as any)

        mockDB._mockAll.mockResolvedValue({ results: [] })

        const result = await service.getReceipts('reg-001', {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        })

        expect(result.success).toBe(true)
      })

      it('應該支援類型過濾', async () => {
        const { ReceiptService } = await import('../services/ReceiptService')
        const service = new ReceiptService(mockDB as any)

        mockDB._mockAll.mockResolvedValue({ results: [] })

        const result = await service.getReceipts('reg-001', {
          receiptType: 'customer',
        })

        expect(result.success).toBe(true)
      })
    })

    describe('getReceiptDetail', () => {
      it('應該返回收據詳情', async () => {
        const { ReceiptService } = await import('../services/ReceiptService')
        const service = new ReceiptService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({
          id: 'receipt-001',
          receipt_number: 'R001',
          content: '{"items": []}',
        })

        const result = await service.getReceiptDetail('receipt-001')

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
      })

      it('應該處理不存在的收據', async () => {
        const { ReceiptService } = await import('../services/ReceiptService')
        const service = new ReceiptService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue(null)

        const result = await service.getReceiptDetail('non-existent')

        expect(result.success).toBe(false)
      })
    })

    describe('cancelPrint', () => {
      it('應該成功取消打印', async () => {
        const { ReceiptService } = await import('../services/ReceiptService')
        const service = new ReceiptService(mockDB as any)

        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.cancelPrint('receipt-001')

        expect(result.success).toBe(true)
      })
    })
  })


  // ========================================
  // RefundService Tests (14 tests)
  // ========================================

  describe('RefundService', () => {
    describe('processRefund', () => {
      it('應該成功處理全額退款', async () => {
        const { RefundService } = await import('../services/RefundService')
        const service = new RefundService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce({ id: 1, total_amount: '1000', status: 'completed' })
          .mockResolvedValueOnce({ total_refunded: '0' })
          .mockResolvedValueOnce({
            id: 'refund-001',
            refund_amount: 1000,
            status: 'processing',
            items_refunded: '[]',
            metadata: '{}',
          })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.processRefund({
          originalOrderId: 1,
          refundType: 'full',
          refundAmount: 1000,
          refundMethod: 'cash',
          reasonCode: 'customer_request',
        }, 'reg-001', 1)

        expect(result.success).toBe(true)
      })

      it('應該成功處理部分退款', async () => {
        const { RefundService } = await import('../services/RefundService')
        const service = new RefundService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce({ id: 1, total_amount: '1000', status: 'completed' })
          .mockResolvedValueOnce({ total_refunded: '0' })
          .mockResolvedValueOnce({
            id: 'refund-001',
            refund_amount: 500,
            status: 'processing',
            items_refunded: '[]',
            metadata: '{}',
          })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.processRefund({
          originalOrderId: 1,
          refundType: 'partial',
          refundAmount: 500,
          refundMethod: 'cash',
          reasonCode: 'item_issue',
        }, 'reg-001', 1)

        expect(result.success).toBe(true)
      })

      it('應該拒絕超過訂單金額的退款', async () => {
        const { RefundService } = await import('../services/RefundService')
        const service = new RefundService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({ id: 1, total_amount: '1000', status: 'completed' })

        const result = await service.processRefund({
          originalOrderId: 1,
          refundType: 'partial',
          refundAmount: 1500,
          refundMethod: 'cash',
          reasonCode: 'test',
        }, 'reg-001', 1)

        expect(result.success).toBe(false)
        expect(result.error).toContain('超過')
      })

      it('應該拒絕對不存在訂單的退款', async () => {
        const { RefundService } = await import('../services/RefundService')
        const service = new RefundService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue(null)

        const result = await service.processRefund({
          originalOrderId: 999,
          refundType: 'full',
          refundAmount: 1000,
          refundMethod: 'cash',
          reasonCode: 'test',
        }, 'reg-001', 1)

        expect(result.success).toBe(false)
        expect(result.error).toContain('不存在')
      })

      it('應該拒絕超過可退款額度的退款', async () => {
        const { RefundService } = await import('../services/RefundService')
        const service = new RefundService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce({ id: 1, total_amount: '1000', status: 'completed' })
          .mockResolvedValueOnce({ total_refunded: '800' }) // Already refunded 800

        const result = await service.processRefund({
          originalOrderId: 1,
          refundType: 'partial',
          refundAmount: 300, // Would exceed total
          refundMethod: 'cash',
          reasonCode: 'test',
        }, 'reg-001', 1)

        expect(result.success).toBe(false)
        expect(result.error).toContain('超過')
      })

      it('應該支援卡片退款', async () => {
        const { RefundService } = await import('../services/RefundService')
        const service = new RefundService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce({ id: 1, total_amount: '1000', status: 'completed' })
          .mockResolvedValueOnce({ total_refunded: '0' })
          .mockResolvedValueOnce({
            id: 'refund-001',
            refund_amount: 1000,
            status: 'processing',
            items_refunded: '[]',
            metadata: '{}',
          })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.processRefund({
          originalOrderId: 1,
          refundType: 'full',
          refundAmount: 1000,
          refundMethod: 'card',
          reasonCode: 'customer_request',
        }, 'reg-001', 1)

        expect(result.success).toBe(true)
      })

      it('應該支援項目退款', async () => {
        const { RefundService } = await import('../services/RefundService')
        const service = new RefundService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce({ id: 1, total_amount: '1000', status: 'completed' })
          .mockResolvedValueOnce({ total_refunded: '0' })
          .mockResolvedValueOnce({
            id: 'refund-001',
            refund_amount: 300,
            status: 'processing',
            items_refunded: '[{"itemId": 1, "quantity": 1}]',
            metadata: '{}',
          })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.processRefund({
          originalOrderId: 1,
          refundType: 'item',
          refundAmount: 300,
          refundMethod: 'cash',
          reasonCode: 'item_defect',
          itemsRefunded: [{ itemId: 1, quantity: 1 }],
        }, 'reg-001', 1)

        expect(result.success).toBe(true)
      })
    })

    describe('getRefunds', () => {
      it('應該返回退款記錄列表', async () => {
        const { RefundService } = await import('../services/RefundService')
        const service = new RefundService(mockDB as any)

        mockDB._mockAll.mockResolvedValue({
          results: [
            { id: 'refund-001', refund_amount: 500, status: 'completed', items_refunded: '[]', metadata: '{}' },
            { id: 'refund-002', refund_amount: 300, status: 'pending', items_refunded: '[]', metadata: '{}' },
          ],
        })

        const result = await service.getRefunds('reg-001', {})

        expect(result.success).toBe(true)
        expect(result.data.refunds).toHaveLength(2)
      })

      it('應該支援狀態過濾', async () => {
        const { RefundService } = await import('../services/RefundService')
        const service = new RefundService(mockDB as any)

        mockDB._mockAll.mockResolvedValue({ results: [] })

        const result = await service.getRefunds('reg-001', { status: 'completed' })

        expect(result.success).toBe(true)
      })

      it('應該支援訂單過濾', async () => {
        const { RefundService } = await import('../services/RefundService')
        const service = new RefundService(mockDB as any)

        mockDB._mockAll.mockResolvedValue({ results: [] })

        const result = await service.getRefunds('reg-001', { orderId: 1 })

        expect(result.success).toBe(true)
      })
    })

    describe('approveRefund', () => {
      it('應該成功審核退款', async () => {
        const { RefundService } = await import('../services/RefundService')
        const service = new RefundService(mockDB as any)

        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.approveRefund('refund-001', 1)

        expect(result.success).toBe(true)
      })
    })

    describe('rejectRefund', () => {
      it('應該成功拒絕退款', async () => {
        const { RefundService } = await import('../services/RefundService')
        const service = new RefundService(mockDB as any)

        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.rejectRefund('refund-001', 1, '不符合退款條件')

        expect(result.success).toBe(true)
      })
    })

    describe('cancelRefund', () => {
      it('應該成功取消退款', async () => {
        const { RefundService } = await import('../services/RefundService')
        const service = new RefundService(mockDB as any)

        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.cancelRefund('refund-001', 1, '客戶取消')

        expect(result.success).toBe(true)
      })
    })
  })


  // ========================================
  // ReportService Tests (10 tests)
  // ========================================

  describe('ReportService', () => {
    describe('generateShiftReport', () => {
      it('應該成功生成班次報表', async () => {
        const { ReportService } = await import('../services/ReportService')
        const service = new ReportService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce({
            id: 'shift-001',
            register_id: 'reg-001',
            operator_id: 1,
            status: 'closed',
            start_amount: '1000',
            end_amount: '5800',
            total_sales: '5000',
            total_refunds: '200',
            cash_sales: '3000',
            card_sales: '1500',
            digital_sales: '500',
            expected_amount: '5800',
            actual_amount: '5800',
            difference_amount: '0',
            started_at: '2024-01-15T08:00:00Z',
            ended_at: '2024-01-15T16:00:00Z',
            register_name: 'POS-001',
            operator_name: 'Test User',
          })
          .mockResolvedValueOnce({ total_orders: 50, total_sales: '5000', avg_order_value: '100' })

        mockDB._mockAll.mockResolvedValue({ results: [] })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.generateShiftReport('shift-001')

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data.reportData).toBeDefined()
      })

      it('應該處理不存在的班次', async () => {
        const { ReportService } = await import('../services/ReportService')
        const service = new ReportService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue(null)

        const result = await service.generateShiftReport('non-existent')

        expect(result.success).toBe(false)
        expect(result.error).toContain('不存在')
      })

      it('應該計算班次時長', async () => {
        const { ReportService } = await import('../services/ReportService')
        const service = new ReportService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce({
            id: 'shift-001',
            register_id: 'reg-001',
            operator_id: 1,
            status: 'closed',
            start_amount: '1000',
            total_sales: '5000',
            total_refunds: '200',
            cash_sales: '3000',
            card_sales: '1500',
            digital_sales: '500',
            started_at: '2024-01-15T08:00:00Z',
            ended_at: '2024-01-15T16:00:00Z',
            register_name: 'POS-001',
            operator_name: 'Test User',
          })
          .mockResolvedValueOnce({ total_orders: 50 })

        mockDB._mockAll.mockResolvedValue({ results: [] })
        mockDB._mockRun.mockResolvedValue({ success: true })

        const result = await service.generateShiftReport('shift-001')

        expect(result.success).toBe(true)
        expect(result.data.reportData.shift.duration).toBe(480) // 8 hours = 480 minutes
      })
    })

    describe('getDailyReport', () => {
      it('應該成功生成日報表', async () => {
        const { ReportService } = await import('../services/ReportService')
        const service = new ReportService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce({
            total_orders: 50,
            total_sales: '15000',
            total_tax: '750',
            total_discounts: '500',
            avg_order_value: '300',
            cash_orders: 30,
            card_orders: 15,
            digital_orders: 5,
          })
          .mockResolvedValueOnce({
            total_refunds: 2,
            total_refund_amount: '300',
          })

        mockDB._mockAll.mockResolvedValue({
          results: [
            { id: 'shift-001' },
            { name: 'Item 1', total_quantity: 100, total_revenue: '5000' },
          ],
        })

        const result = await service.getDailyReport(1, '2024-01-15')

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data.summary.totalOrders).toBe(50)
      })

      it('應該計算淨銷售額', async () => {
        const { ReportService } = await import('../services/ReportService')
        const service = new ReportService(mockDB as any)

        mockDB._mockFirst
          .mockResolvedValueOnce({
            total_orders: 50,
            total_sales: '15000',
            total_tax: '750',
            total_discounts: '500',
          })
          .mockResolvedValueOnce({
            total_refunds: 2,
            total_refund_amount: '300',
          })

        mockDB._mockAll.mockResolvedValue({ results: [] })

        const result = await service.getDailyReport(1, '2024-01-15')

        expect(result.success).toBe(true)
        expect(result.data.summary.netSales).toBe(14700) // 15000 - 300
      })
    })

    describe('getShiftStats', () => {
      it('應該返回班次統計', async () => {
        const { ReportService } = await import('../services/ReportService')
        const service = new ReportService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({
          total_shifts: 30,
          total_sales: '150000',
          total_refunds: '5000',
          avg_sales_per_shift: '5000',
          total_cash_sales: '90000',
          total_card_sales: '45000',
          total_digital_sales: '15000',
          closed_shifts: 28,
          avg_cash_difference: '50',
        })

        const result = await service.getShiftStats(1)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
      })

      it('應該支援日期範圍過濾', async () => {
        const { ReportService } = await import('../services/ReportService')
        const service = new ReportService(mockDB as any)

        mockDB._mockFirst.mockResolvedValue({
          total_shifts: 10,
          total_sales: '50000',
        })

        const result = await service.getShiftStats(1, {
          from: new Date('2024-01-01'),
          to: new Date('2024-01-31'),
        })

        expect(result.success).toBe(true)
      })
    })

    describe('getRegisterUsageStats', () => {
      it('應該返回收銀機使用統計 - 日', async () => {
        const { ReportService } = await import('../services/ReportService')
        const service = new ReportService(mockDB as any)

        mockDB._mockAll.mockResolvedValue({
          results: [
            { register_name: 'POS-001', period: '2024-01-15', shift_count: 2, total_sales: '10000' },
          ],
        })

        const result = await service.getRegisterUsageStats(1, 'day')

        expect(result.success).toBe(true)
        expect(result.data.period).toBe('day')
      })

      it('應該返回收銀機使用統計 - 週', async () => {
        const { ReportService } = await import('../services/ReportService')
        const service = new ReportService(mockDB as any)

        mockDB._mockAll.mockResolvedValue({ results: [] })

        const result = await service.getRegisterUsageStats(1, 'week')

        expect(result.success).toBe(true)
        expect(result.data.period).toBe('week')
      })

      it('應該返回收銀機使用統計 - 月', async () => {
        const { ReportService } = await import('../services/ReportService')
        const service = new ReportService(mockDB as any)

        mockDB._mockAll.mockResolvedValue({ results: [] })

        const result = await service.getRegisterUsageStats(1, 'month')

        expect(result.success).toBe(true)
        expect(result.data.period).toBe('month')
      })
    })
  })
})
