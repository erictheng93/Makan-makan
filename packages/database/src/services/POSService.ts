import { z } from 'zod'
import { BaseService, CloudflareEnv } from './base'

// 類型定義
export interface CashRegister {
  id: string
  name: string
  location?: string
  restaurantId: number
  isActive: boolean
  currentShiftId?: string
  hardwareConfig: Record<string, any>
  peripherals: Record<string, any>
  settings: Record<string, any>
  lastMaintenanceAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface CashShift {
  id: string
  registerId: string
  operatorId: number
  startAmount: number
  endAmount?: number
  expectedAmount: number
  actualAmount?: number
  differenceAmount: number
  totalSales: number
  totalRefunds: number
  cashSales: number
  cardSales: number
  digitalSales: number
  totalTransactions: number
  startedAt: Date
  endedAt?: Date
  status: 'active' | 'closed' | 'suspended'
  notes?: string
  closingNotes?: string
}

export interface CashMovement {
  id: string
  shiftId: string
  registerId: string
  type: 'sale' | 'refund' | 'cash_in' | 'cash_out' | 'count' | 'opening' | 'closing' | 'adjustment' | 'payout' | 'deposit'
  amount: number
  description?: string
  referenceId?: number
  referenceType?: string
  paymentMethod?: string
  denominationBreakdown: Record<string, number>
  recordedBy: number
  approvedBy?: number
  approvalStatus: 'pending' | 'approved' | 'rejected'
  receiptNumber?: string
  metadata: Record<string, any>
  createdAt: Date
}

export interface Receipt {
  id: string
  orderId: number
  registerId: string
  shiftId?: string
  receiptNumber: string
  receiptType: 'customer' | 'kitchen' | 'merchant' | 'duplicate'
  templateName: string
  content: string
  rawContent?: string
  printStatus: 'pending' | 'printing' | 'printed' | 'failed' | 'cancelled'
  printAttempts: number
  printerName?: string
  printerResponse?: string
  printedAt?: Date
  reprintedCount: number
  lastReprintAt?: Date
  createdAt: Date
}

export interface Refund {
  id: string
  originalOrderId: number
  registerId: string
  shiftId?: string
  refundNumber: string
  refundType: 'full' | 'partial' | 'item' | 'service'
  originalAmount: number
  refundAmount: number
  refundMethod: string
  reasonCode: string
  reasonDescription?: string
  itemsRefunded: any[]
  processedBy: number
  approvedBy?: number
  customerSignature?: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  processedAt?: Date
  completedAt?: Date
  metadata: Record<string, any>
}

// 請求/回應類型
export interface CreateRegisterRequest {
  name: string
  location?: string
  restaurantId: number
  hardwareConfig?: Record<string, any>
  peripherals?: Record<string, any>
  settings?: Record<string, any>
}

export interface StartShiftRequest {
  registerId: string
  operatorId: number
  startAmount: number
  notes?: string
}

export interface EndShiftRequest {
  actualAmount: number
  closingNotes?: string
}

export interface CashMovementRequest {
  type: 'cash_in' | 'cash_out' | 'count' | 'adjustment' | 'payout' | 'deposit'
  amount: number
  description: string
  denominationBreakdown?: Record<string, number>
  referenceId?: number
  referenceType?: string
}

export interface PrintReceiptRequest {
  orderId: number
  templateName?: string
  receiptType?: 'customer' | 'kitchen' | 'merchant'
  copies?: number
}

export interface ProcessRefundRequest {
  originalOrderId: number
  refundType: 'full' | 'partial' | 'item' | 'service'
  refundAmount: number
  refundMethod: string
  reasonCode: string
  reasonDescription?: string
  itemsRefunded?: any[]
  customerSignature?: string
}

// 驗證 schemas
const createRegisterSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().max(100).optional(),
  restaurantId: z.number().int().positive(),
  hardwareConfig: z.record(z.any()).optional().default({}),
  peripherals: z.record(z.any()).optional().default({}),
  settings: z.record(z.any()).optional().default({})
})

const startShiftSchema = z.object({
  registerId: z.string().uuid(),
  operatorId: z.number().int().positive(),
  startAmount: z.number().min(0),
  notes: z.string().max(500).optional()
})

const endShiftSchema = z.object({
  actualAmount: z.number().min(0),
  closingNotes: z.string().max(500).optional()
})

const cashMovementSchema = z.object({
  type: z.enum(['cash_in', 'cash_out', 'count', 'adjustment', 'payout', 'deposit']),
  amount: z.number(),
  description: z.string().min(1).max(200),
  denominationBreakdown: z.record(z.number()).optional().default({}),
  referenceId: z.number().int().positive().optional(),
  referenceType: z.string().optional()
})

const printReceiptSchema = z.object({
  orderId: z.number().int().positive(),
  templateName: z.string().optional().default('standard'),
  receiptType: z.enum(['customer', 'kitchen', 'merchant']).optional().default('customer'),
  copies: z.number().int().min(1).max(5).optional().default(1)
})

const processRefundSchema = z.object({
  originalOrderId: z.number().int().positive(),
  refundType: z.enum(['full', 'partial', 'item', 'service']),
  refundAmount: z.number().positive(),
  refundMethod: z.string().min(1).max(50),
  reasonCode: z.string().min(1).max(50),
  reasonDescription: z.string().max(500).optional(),
  itemsRefunded: z.array(z.any()).optional().default([]),
  customerSignature: z.string().optional()
})

export class POSService extends BaseService {
  constructor(db: any, env: CloudflareEnv) {
    super(db, env)
  }

  // 收銀機管理
  async createRegister(
    data: CreateRegisterRequest,
    createdBy: number
  ): Promise<{ success: boolean; data?: CashRegister; error?: string }> {
    try {
      const validatedData = createRegisterSchema.parse(data)
      const registerId = crypto.randomUUID()

      await this.d1.prepare(`
        INSERT INTO cash_registers (
          id, name, location, restaurant_id, is_active, 
          hardware_config, peripherals, settings, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        registerId,
        validatedData.name,
        validatedData.location || null,
        validatedData.restaurantId,
        JSON.stringify(validatedData.hardwareConfig),
        JSON.stringify(validatedData.peripherals),
        JSON.stringify(validatedData.settings)
      ).run()

      const register = await this.d1.prepare(
        'SELECT * FROM cash_registers WHERE id = ?'
      ).bind(registerId).first() as any

      return {
        success: true,
        data: {
          ...register,
          hardwareConfig: JSON.parse(register.hardware_config || '{}'),
          peripherals: JSON.parse(register.peripherals || '{}'),
          settings: JSON.parse(register.settings || '{}')
        }
      }

    } catch (error) {
      console.error('創建收銀機失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '創建收銀機失敗'
      }
    }
  }

  async getRegisters(
    restaurantId: number
  ): Promise<{ success: boolean; data?: CashRegister[]; error?: string }> {
    try {
      const result = await this.d1.prepare(`
        SELECT cr.*, cs.id as current_shift_status
        FROM cash_registers cr
        LEFT JOIN cash_shifts cs ON cr.current_shift_id = cs.id AND cs.status = 'active'
        WHERE cr.restaurant_id = ?
        ORDER BY cr.name
      `).bind(restaurantId).all()

      const registers = (result.results || []).map((register: any) => ({
        ...register,
        hardwareConfig: JSON.parse(register.hardware_config || '{}'),
        peripherals: JSON.parse(register.peripherals || '{}'),
        settings: JSON.parse(register.settings || '{}')
      })) as CashRegister[]

      return {
        success: true,
        data: registers
      }

    } catch (error) {
      console.error('獲取收銀機列表失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '獲取收銀機列表失敗'
      }
    }
  }

  // 班次管理
  async startShift(
    data: StartShiftRequest
  ): Promise<{ success: boolean; data?: CashShift; error?: string }> {
    try {
      const validatedData = startShiftSchema.parse(data)

      // 檢查收銀機是否已有活躍班次
      const existingShift = await this.d1.prepare(`
        SELECT id FROM cash_shifts 
        WHERE register_id = ? AND status = 'active'
      `).bind(validatedData.registerId).first()

      if (existingShift) {
        return {
          success: false,
          error: '此收銀機已有活躍班次'
        }
      }

      const shiftId = crypto.randomUUID()
      
      await this.d1.prepare(`
        INSERT INTO cash_shifts (
          id, register_id, operator_id, start_amount, expected_amount,
          total_sales, total_refunds, cash_sales, card_sales, digital_sales,
          total_transactions, started_at, status, notes
        ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, CURRENT_TIMESTAMP, 'active', ?)
      `).bind(
        shiftId,
        validatedData.registerId,
        validatedData.operatorId,
        validatedData.startAmount,
        validatedData.startAmount,
        validatedData.notes || null
      ).run()

      // 記錄開班現金操作
      await this.recordCashMovement(shiftId, {
        type: 'opening',
        amount: validatedData.startAmount,
        description: '開班現金',
        recordedBy: validatedData.operatorId
      })

      const shift = await this.d1.prepare(
        'SELECT * FROM cash_shifts WHERE id = ?'
      ).bind(shiftId).first() as any

      return {
        success: true,
        data: shift
      }

    } catch (error) {
      console.error('開班失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '開班失敗'
      }
    }
  }

  async endShift(
    shiftId: string,
    data: EndShiftRequest,
    operatorId: number
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const validatedData = endShiftSchema.parse(data)

      // 獲取班次資訊
      const shift = await this.d1.prepare(
        'SELECT * FROM cash_shifts WHERE id = ? AND status = "active"'
      ).bind(shiftId).first() as any

      if (!shift) {
        return {
          success: false,
          error: '找不到活躍班次'
        }
      }

      // 計算預期金額
      const expectedAmount = parseFloat(shift.start_amount) + parseFloat(shift.total_sales) - parseFloat(shift.total_refunds)
      const differenceAmount = validatedData.actualAmount - expectedAmount

      // 更新班次狀態
      await this.d1.prepare(`
        UPDATE cash_shifts 
        SET end_amount = ?, 
            actual_amount = ?,
            expected_amount = ?,
            difference_amount = ?,
            ended_at = CURRENT_TIMESTAMP,
            status = 'closed',
            closing_notes = ?
        WHERE id = ?
      `).bind(
        validatedData.actualAmount,
        validatedData.actualAmount,
        expectedAmount,
        differenceAmount,
        validatedData.closingNotes || null,
        shiftId
      ).run()

      // 記錄結班現金操作
      await this.recordCashMovement(shiftId, {
        type: 'closing',
        amount: validatedData.actualAmount,
        description: `結班現金 (差額: ${differenceAmount >= 0 ? '+' : ''}${differenceAmount})`,
        recordedBy: operatorId
      })

      // 清除收銀機的當前班次
      await this.d1.prepare(
        'UPDATE cash_registers SET current_shift_id = NULL WHERE id = ?'
      ).bind(shift.register_id).run()

      // 生成班次報表
      const report = await this.generateShiftReport(shiftId)

      return {
        success: true,
        data: {
          shift: {
            ...shift,
            endAmount: validatedData.actualAmount,
            actualAmount: validatedData.actualAmount,
            expectedAmount,
            differenceAmount,
            status: 'closed'
          },
          report: report.data
        }
      }

    } catch (error) {
      console.error('結班失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '結班失敗'
      }
    }
  }

  // 現金操作記錄
  private async recordCashMovement(
    shiftId: string,
    movement: {
      type: string
      amount: number
      description: string
      recordedBy: number
      referenceId?: number
      referenceType?: string
      paymentMethod?: string
      denominationBreakdown?: Record<string, number>
    }
  ): Promise<void> {
    const movementId = crypto.randomUUID()
    
    const shift = await this.d1.prepare(
      'SELECT register_id FROM cash_shifts WHERE id = ?'
    ).bind(shiftId).first() as any

    await this.d1.prepare(`
      INSERT INTO cash_movements (
        id, shift_id, register_id, type, amount, description,
        reference_id, reference_type, payment_method, denomination_breakdown,
        recorded_by, approval_status, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', '{}', CURRENT_TIMESTAMP)
    `).bind(
      movementId,
      shiftId,
      shift.register_id,
      movement.type,
      movement.amount,
      movement.description,
      movement.referenceId || null,
      movement.referenceType || null,
      movement.paymentMethod || null,
      JSON.stringify(movement.denominationBreakdown || {}),
      movement.recordedBy
    ).run()
  }

  async processCashMovement(
    shiftId: string,
    data: CashMovementRequest,
    operatorId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const validatedData = cashMovementSchema.parse(data)

      // 檢查班次狀態
      const shift = await this.d1.prepare(
        'SELECT status FROM cash_shifts WHERE id = ?'
      ).bind(shiftId).first() as any

      if (!shift || shift.status !== 'active') {
        return {
          success: false,
          error: '班次不存在或已結束'
        }
      }

      await this.recordCashMovement(shiftId, {
        ...validatedData,
        recordedBy: operatorId
      })

      return { success: true }

    } catch (error) {
      console.error('現金操作記錄失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '現金操作記錄失敗'
      }
    }
  }

  // 收據管理
  async printReceipt(
    data: PrintReceiptRequest,
    registerId: string,
    shiftId?: string
  ): Promise<{ success: boolean; data?: Receipt; error?: string }> {
    try {
      const validatedData = printReceiptSchema.parse(data)

      // 檢查訂單是否存在
      const order = await this.d1.prepare(
        'SELECT * FROM orders WHERE id = ?'
      ).bind(validatedData.orderId).first()

      if (!order) {
        return {
          success: false,
          error: '訂單不存在'
        }
      }

      const receiptId = crypto.randomUUID()
      const receiptNumber = `R${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`

      // 生成收據內容（這裡簡化處理，實際應用會有複雜的模板系統）
      const receiptContent = this.generateReceiptContent(order as any, validatedData.templateName)

      await this.d1.prepare(`
        INSERT INTO receipts (
          id, order_id, register_id, shift_id, receipt_number, receipt_type,
          template_name, content, print_status, print_attempts, reprinted_count,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, CURRENT_TIMESTAMP)
      `).bind(
        receiptId,
        validatedData.orderId,
        registerId,
        shiftId || null,
        receiptNumber,
        validatedData.receiptType,
        validatedData.templateName,
        JSON.stringify(receiptContent)
      ).run()

      // 模擬打印過程
      await this.simulatePrinting(receiptId)

      const receipt = await this.d1.prepare(
        'SELECT * FROM receipts WHERE id = ?'
      ).bind(receiptId).first() as any

      return {
        success: true,
        data: {
          ...receipt,
          content: JSON.parse(receipt.content || '{}')
        }
      }

    } catch (error) {
      console.error('打印收據失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '打印收據失敗'
      }
    }
  }

  private generateReceiptContent(order: any, templateName: string): any {
    // 簡化的收據模板生成邏輯
    return {
      template: templateName,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      items: [], // 實際會查詢 order_items
      subtotal: order.subtotal,
      tax: order.tax_amount,
      total: order.total_amount,
      paymentMethod: order.payment_method,
      timestamp: new Date().toISOString(),
      footer: '謝謝光臨 MakanMakan'
    }
  }

  private async simulatePrinting(receiptId: string): Promise<void> {
    // 模擬打印延遲和狀態更新
    setTimeout(async () => {
      try {
        await this.d1.prepare(`
          UPDATE receipts 
          SET print_status = 'printed', printed_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).bind(receiptId).run()
      } catch (error) {
        console.error('更新打印狀態失敗:', error)
      }
    }, 2000)
  }

  // 退款處理
  async processRefund(
    data: ProcessRefundRequest,
    registerId: string,
    processedBy: number,
    shiftId?: string
  ): Promise<{ success: boolean; data?: Refund; error?: string }> {
    try {
      const validatedData = processRefundSchema.parse(data)

      // 檢查原訂單
      const originalOrder = await this.d1.prepare(
        'SELECT * FROM orders WHERE id = ?'
      ).bind(validatedData.originalOrderId).first() as any

      if (!originalOrder) {
        return {
          success: false,
          error: '原訂單不存在'
        }
      }

      // 檢查退款金額是否合理
      if (validatedData.refundAmount > parseFloat(originalOrder.total_amount)) {
        return {
          success: false,
          error: '退款金額不能超過原訂單金額'
        }
      }

      const refundId = crypto.randomUUID()
      const refundNumber = `RF${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`

      await this.d1.prepare(`
        INSERT INTO refunds (
          id, original_order_id, register_id, shift_id, refund_number,
          refund_type, original_amount, refund_amount, refund_method,
          reason_code, reason_description, items_refunded, processed_by,
          customer_signature, status, metadata, processed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', '{}', CURRENT_TIMESTAMP)
      `).bind(
        refundId,
        validatedData.originalOrderId,
        registerId,
        shiftId || null,
        refundNumber,
        validatedData.refundType,
        parseFloat(originalOrder.total_amount),
        validatedData.refundAmount,
        validatedData.refundMethod,
        validatedData.reasonCode,
        validatedData.reasonDescription || null,
        JSON.stringify(validatedData.itemsRefunded),
        processedBy,
        validatedData.customerSignature || null
      ).run()

      // 記錄現金流動（如果是現金退款）
      if (shiftId && validatedData.refundMethod === 'cash') {
        await this.recordCashMovement(shiftId, {
          type: 'refund',
          amount: -validatedData.refundAmount, // 負數表示流出
          description: `退款 - ${refundNumber}`,
          recordedBy: processedBy,
          referenceId: validatedData.originalOrderId,
          referenceType: 'refund'
        })
      }

      // 模擬退款處理完成
      setTimeout(async () => {
        try {
          await this.d1.prepare(`
            UPDATE refunds 
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).bind(refundId).run()
        } catch (error) {
          console.error('更新退款狀態失敗:', error)
        }
      }, 5000)

      const refund = await this.d1.prepare(
        'SELECT * FROM refunds WHERE id = ?'
      ).bind(refundId).first() as any

      return {
        success: true,
        data: {
          ...refund,
          itemsRefunded: JSON.parse(refund.items_refunded || '[]'),
          metadata: JSON.parse(refund.metadata || '{}')
        }
      }

    } catch (error) {
      console.error('處理退款失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '處理退款失敗'
      }
    }
  }

  // 生成班次報表
  async generateShiftReport(
    shiftId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // 獲取班次基本資訊
      const shift = await this.d1.prepare(`
        SELECT cs.*, cr.name as register_name, u.full_name as operator_name
        FROM cash_shifts cs
        JOIN cash_registers cr ON cs.register_id = cr.id
        JOIN users u ON cs.operator_id = u.id
        WHERE cs.id = ?
      `).bind(shiftId).first() as any

      if (!shift) {
        return {
          success: false,
          error: '班次不存在'
        }
      }

      // 獲取現金流動記錄
      const movements = await this.d1.prepare(`
        SELECT * FROM cash_movements 
        WHERE shift_id = ? 
        ORDER BY created_at
      `).bind(shiftId).all()

      // 獲取收據記錄
      const receipts = await this.d1.prepare(`
        SELECT COUNT(*) as total_receipts, 
               COUNT(CASE WHEN print_status = 'printed' THEN 1 END) as printed_receipts
        FROM receipts 
        WHERE shift_id = ?
      `).bind(shiftId).first() as any

      // 生成報表數據
      const reportData = {
        shift: {
          ...shift,
          duration: shift.ended_at ? 
            Math.floor((new Date(shift.ended_at).getTime() - new Date(shift.started_at).getTime()) / 60000) : 
            null
        },
        summary: {
          startAmount: parseFloat(shift.start_amount),
          endAmount: parseFloat(shift.end_amount || '0'),
          totalSales: parseFloat(shift.total_sales),
          totalRefunds: parseFloat(shift.total_refunds),
          netSales: parseFloat(shift.total_sales) - parseFloat(shift.total_refunds),
          expectedAmount: parseFloat(shift.expected_amount || '0'),
          actualAmount: parseFloat(shift.actual_amount || '0'),
          difference: parseFloat(shift.difference_amount || '0')
        },
        breakdown: {
          cashSales: parseFloat(shift.cash_sales),
          cardSales: parseFloat(shift.card_sales),
          digitalSales: parseFloat(shift.digital_sales)
        },
        movements: (movements.results || []).map((movement: any) => ({
          ...movement,
          denominationBreakdown: JSON.parse(movement.denomination_breakdown || '{}'),
          metadata: JSON.parse(movement.metadata || '{}')
        })),
        receipts: receipts || { total_receipts: 0, printed_receipts: 0 }
      }

      // 保存報表
      const reportId = crypto.randomUUID()
      await this.d1.prepare(`
        INSERT INTO shift_reports (
          id, shift_id, register_id, operator_id, report_data, 
          summary_data, generated_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        reportId,
        shiftId,
        shift.register_id,
        shift.operator_id,
        JSON.stringify(reportData),
        JSON.stringify(reportData.summary)
      ).run()

      return {
        success: true,
        data: {
          reportId,
          reportData
        }
      }

    } catch (error) {
      console.error('生成班次報表失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '生成班次報表失敗'
      }
    }
  }

  // 獲取班次統計
  async getShiftStats(
    restaurantId: number,
    dateRange?: { from: Date; to: Date }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      let dateFilter = ''
      const params = [restaurantId.toString()]

      if (dateRange) {
        dateFilter = ' AND cs.started_at >= ? AND cs.started_at <= ?'
        params.push(dateRange.from.toISOString(), dateRange.to.toISOString())
      }

      const stats = await this.d1.prepare(`
        SELECT 
          COUNT(*) as total_shifts,
          SUM(cs.total_sales) as total_sales,
          SUM(cs.total_refunds) as total_refunds,
          AVG(cs.total_sales) as avg_sales_per_shift,
          SUM(cs.cash_sales) as total_cash_sales,
          SUM(cs.card_sales) as total_card_sales,
          SUM(cs.digital_sales) as total_digital_sales,
          COUNT(CASE WHEN cs.status = 'closed' THEN 1 END) as closed_shifts,
          AVG(ABS(cs.difference_amount)) as avg_cash_difference
        FROM cash_shifts cs
        JOIN cash_registers cr ON cs.register_id = cr.id
        WHERE cr.restaurant_id = ? ${dateFilter}
      `).bind(...params).first()

      return {
        success: true,
        data: stats
      }

    } catch (error) {
      console.error('獲取班次統計失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '獲取班次統計失敗'
      }
    }
  }
}