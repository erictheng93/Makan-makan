/**
 * 退款管理服務
 */

import { BaseService } from '../../../shared/services/BaseService'
import type {
  Refund,
  ProcessRefundRequest
} from '../types'
import { processRefundSchema } from '../schemas'

export class RefundService extends BaseService {
  constructor(db: any) {
    super(db)
  }

  /**
   * 處理退款
   */
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

      // 檢查是否已有退款記錄
      const existingRefund = await this.d1.prepare(
        'SELECT SUM(refund_amount) as total_refunded FROM refunds WHERE original_order_id = ? AND status IN ("completed", "processing")'
      ).bind(validatedData.originalOrderId).first() as any

      const totalRefunded = parseFloat(existingRefund?.total_refunded || '0')
      if (totalRefunded + validatedData.refundAmount > parseFloat(originalOrder.total_amount)) {
        return {
          success: false,
          error: '退款金額超過可退款額度'
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
        JSON.stringify(validatedData.itemsRefunded || []),
        processedBy,
        validatedData.customerSignature || null
      ).run()

      // 記錄現金流動（如果是現金退款）
      if (shiftId && validatedData.refundMethod === 'cash') {
        await this.recordCashMovement(shiftId, registerId, {
          type: 'refund',
          amount: -validatedData.refundAmount, // 負數表示流出
          description: `退款 - ${refundNumber}`,
          recordedBy: processedBy,
          referenceId: validatedData.originalOrderId,
          referenceType: 'refund'
        })
      }

      // 模擬退款處理完成
      this.processRefundCompletion(refundId)

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

  /**
   * 獲取退款記錄
   */
  async getRefunds(
    registerId: string,
    options?: {
      startDate?: string
      endDate?: string
      status?: string
      orderId?: number
      page?: number
      limit?: number
    }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { startDate, endDate, status, orderId, page = 1, limit = 20 } = options || {}
      const offset = (page - 1) * limit

      const filters = []
      const params = [registerId]

      if (startDate) {
        filters.push('DATE(r.processed_at) >= ?')
        params.push(startDate)
      }

      if (endDate) {
        filters.push('DATE(r.processed_at) <= ?')
        params.push(endDate)
      }

      if (status) {
        filters.push('r.status = ?')
        params.push(status)
      }

      if (orderId) {
        filters.push('r.original_order_id = ?')
        params.push(orderId.toString())
      }

      const whereClause = filters.length > 0 ? ` AND ${filters.join(' AND ')}` : ''

      const refunds = await this.d1.prepare(`
        SELECT
          r.*,
          o.order_number,
          o.customer_name,
          u.full_name as processed_by_name,
          ua.full_name as approved_by_name
        FROM refunds r
        LEFT JOIN orders o ON r.original_order_id = o.id
        LEFT JOIN users u ON r.processed_by = u.id
        LEFT JOIN users ua ON r.approved_by = ua.id
        WHERE r.register_id = ? ${whereClause}
        ORDER BY r.processed_at DESC
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all()

      return {
        success: true,
        data: {
          refunds: (refunds.results || []).map((refund: any) => ({
            ...refund,
            itemsRefunded: JSON.parse(refund.items_refunded || '[]'),
            metadata: JSON.parse(refund.metadata || '{}')
          })),
          pagination: {
            page,
            limit,
            hasMore: (refunds.results || []).length === limit
          }
        }
      }

    } catch (error) {
      console.error('獲取退款記錄失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '獲取退款記錄失敗'
      }
    }
  }

  /**
   * 獲取退款詳情
   */
  async getRefundDetail(
    refundId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const refund = await this.d1.prepare(`
        SELECT
          r.*,
          o.order_number,
          o.customer_name,
          o.total_amount as original_order_amount,
          u.full_name as processed_by_name,
          ua.full_name as approved_by_name,
          cr.name as register_name
        FROM refunds r
        LEFT JOIN orders o ON r.original_order_id = o.id
        LEFT JOIN users u ON r.processed_by = u.id
        LEFT JOIN users ua ON r.approved_by = ua.id
        LEFT JOIN cash_registers cr ON r.register_id = cr.id
        WHERE r.id = ?
      `).bind(refundId).first()

      if (!refund) {
        return {
          success: false,
          error: '退款記錄不存在'
        }
      }

      return {
        success: true,
        data: {
          ...refund,
          itemsRefunded: JSON.parse(refund.items_refunded || '[]'),
          metadata: JSON.parse(refund.metadata || '{}')
        }
      }

    } catch (error) {
      console.error('獲取退款詳情失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '獲取退款詳情失敗'
      }
    }
  }

  /**
   * 取消退款
   */
  async cancelRefund(
    refundId: string,
    cancelledBy: number,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const metadata = reason ? JSON.stringify({ cancellation_reason: reason }) : '{}'

      await this.d1.prepare(`
        UPDATE refunds
        SET status = 'cancelled',
            metadata = ?,
            approved_by = ?
        WHERE id = ? AND status IN ('pending', 'processing')
      `).bind(metadata, cancelledBy, refundId).run()

      return { success: true }

    } catch (error) {
      console.error('取消退款失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '取消退款失敗'
      }
    }
  }

  /**
   * 審核退款
   */
  async approveRefund(
    refundId: string,
    approvedBy: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.d1.prepare(`
        UPDATE refunds
        SET status = 'completed',
            approved_by = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'processing'
      `).bind(approvedBy, refundId).run()

      return { success: true }

    } catch (error) {
      console.error('審核退款失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '審核退款失敗'
      }
    }
  }

  /**
   * 拒絕退款
   */
  async rejectRefund(
    refundId: string,
    rejectedBy: number,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const metadata = reason ? JSON.stringify({ rejection_reason: reason }) : '{}'

      await this.d1.prepare(`
        UPDATE refunds
        SET status = 'failed',
            approved_by = ?,
            metadata = ?
        WHERE id = ? AND status = 'processing'
      `).bind(rejectedBy, metadata, refundId).run()

      return { success: true }

    } catch (error) {
      console.error('拒絕退款失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '拒絕退款失敗'
      }
    }
  }

  /**
   * 記錄現金流動
   */
  private async recordCashMovement(
    shiftId: string,
    registerId: string,
    movement: {
      type: string
      amount: number
      description: string
      recordedBy: number
      referenceId?: number
      referenceType?: string
    }
  ): Promise<void> {
    const movementId = crypto.randomUUID()

    await this.d1.prepare(`
      INSERT INTO cash_movements (
        id, shift_id, register_id, type, amount, description,
        reference_id, reference_type, denomination_breakdown,
        recorded_by, approval_status, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, 'approved', '{}', CURRENT_TIMESTAMP)
    `).bind(
      movementId,
      shiftId,
      registerId,
      movement.type,
      movement.amount,
      movement.description,
      movement.referenceId || null,
      movement.referenceType || null,
      movement.recordedBy
    ).run()
  }

  /**
   * 模擬退款處理完成
   */
  private processRefundCompletion(refundId: string): void {
    setTimeout(async () => {
      try {
        await this.d1.prepare(`
          UPDATE refunds
          SET status = 'completed', completed_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'processing'
        `).bind(refundId).run()
      } catch (error) {
        console.error('更新退款狀態失敗:', error)
        try {
          await this.d1.prepare(`
            UPDATE refunds
            SET status = 'failed'
            WHERE id = ? AND status = 'processing'
          `).bind(refundId).run()
        } catch (updateError) {
          console.error('更新失敗狀態失敗:', updateError)
        }
      }
    }, 5000) // 5秒後完成退款處理
  }
}