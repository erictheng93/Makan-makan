/**
 * 班次管理服務
 */

import { BaseService } from '../../../shared/services/BaseService'
import { getCurrentTimestamp } from '@makanmakan/database'
import type {
  CashShift,
  StartShiftRequest,
  EndShiftRequest
} from '../types'
import { startShiftSchema, endShiftSchema } from '../schemas'

export class ShiftService extends BaseService {
  constructor(db: any) {
    super(db)
  }

  /**
   * 開始班次
   */
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
      const startedAt = getCurrentTimestamp()

      await this.d1.prepare(`
        INSERT INTO cash_shifts (
          id, register_id, operator_id, start_amount, expected_amount,
          total_sales, total_refunds, cash_sales, card_sales, digital_sales,
          total_transactions, started_at, status, notes
        ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, ?, 'active', ?)
      `).bind(
        shiftId,
        validatedData.registerId,
        validatedData.operatorId,
        validatedData.startAmount,
        validatedData.startAmount,
        startedAt,
        validatedData.notes || null
      ).run()

      // 更新收銀機的當前班次
      await this.d1.prepare(
        'UPDATE cash_registers SET current_shift_id = ? WHERE id = ?'
      ).bind(shiftId, validatedData.registerId).run()

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

  /**
   * 結束班次
   */
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
      const endedAt = getCurrentTimestamp()
      await this.d1.prepare(`
        UPDATE cash_shifts
        SET end_amount = ?,
            actual_amount = ?,
            expected_amount = ?,
            difference_amount = ?,
            ended_at = ?,
            status = 'closed',
            closing_notes = ?
        WHERE id = ?
      `).bind(
        validatedData.actualAmount,
        validatedData.actualAmount,
        expectedAmount,
        differenceAmount,
        endedAt,
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
          }
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

  /**
   * 獲取當前班次
   */
  async getCurrentShift(
    registerId: string
  ): Promise<{ success: boolean; data?: CashShift; error?: string }> {
    try {
      const shift = await this.d1.prepare(`
        SELECT cs.*, u.full_name as operator_name
        FROM cash_shifts cs
        LEFT JOIN users u ON cs.operator_id = u.id
        WHERE cs.register_id = ? AND cs.status = 'active'
      `).bind(registerId).first() as any

      return {
        success: true,
        data: shift || null
      }

    } catch (error) {
      console.error('獲取當前班次失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '獲取當前班次失敗'
      }
    }
  }

  /**
   * 暫停班次
   */
  async suspendShift(
    shiftId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.d1.prepare(`
        UPDATE cash_shifts
        SET status = 'suspended',
            closing_notes = COALESCE(closing_notes, '') || ? || CHAR(10)
        WHERE id = ? AND status = 'active'
      `).bind(reason ? `暫停原因: ${reason}` : '班次已暫停', shiftId).run()

      return { success: true }

    } catch (error) {
      console.error('暫停班次失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '暫停班次失敗'
      }
    }
  }

  /**
   * 恢復班次
   */
  async resumeShift(
    shiftId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.d1.prepare(`
        UPDATE cash_shifts
        SET status = 'active'
        WHERE id = ? AND status = 'suspended'
      `).bind(shiftId).run()

      return { success: true }

    } catch (error) {
      console.error('恢復班次失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '恢復班次失敗'
      }
    }
  }

  /**
   * 記錄現金操作
   */
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

    const now = getCurrentTimestamp()
    await this.d1.prepare(`
      INSERT INTO cash_movements (
        id, shift_id, register_id, type, amount, description,
        reference_id, reference_type, payment_method, denomination_breakdown,
        recorded_by, approval_status, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', '{}', ?)
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
      movement.recordedBy,
      now
    ).run()
  }
}