/**
 * 報表統計服務
 */

import { BaseService } from '../../../shared/services/BaseService'
import { getCurrentTimestamp } from '@makanmakan/database'

export class ReportService extends BaseService {
  constructor(db: any) {
    super(db)
  }

  /**
   * 生成班次報表
   */
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

      // 獲取訂單統計
      const orderStats = await this.d1.prepare(`
        SELECT
          COUNT(*) as total_orders,
          SUM(total_amount) as total_sales,
          AVG(total_amount) as avg_order_value,
          COUNT(CASE WHEN payment_method = 'cash' THEN 1 END) as cash_orders,
          COUNT(CASE WHEN payment_method = 'card' THEN 1 END) as card_orders,
          COUNT(CASE WHEN payment_method = 'digital_wallet' THEN 1 END) as digital_orders
        FROM orders
        WHERE created_at >= ? AND created_at <= ?
      `).bind(
        shift.started_at,
        shift.ended_at || new Date().toISOString()
      ).first() as any

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
          totalSales: parseFloat(orderStats?.total_sales || '0'),
          totalRefunds: parseFloat(shift.total_refunds),
          netSales: parseFloat(orderStats?.total_sales || '0') - parseFloat(shift.total_refunds),
          expectedAmount: parseFloat(shift.expected_amount || '0'),
          actualAmount: parseFloat(shift.actual_amount || '0'),
          difference: parseFloat(shift.difference_amount || '0')
        },
        breakdown: {
          cashSales: parseFloat(shift.cash_sales),
          cardSales: parseFloat(shift.card_sales),
          digitalSales: parseFloat(shift.digital_sales)
        },
        orderStats: {
          totalOrders: parseInt(orderStats?.total_orders || '0'),
          avgOrderValue: parseFloat(orderStats?.avg_order_value || '0'),
          cashOrders: parseInt(orderStats?.cash_orders || '0'),
          cardOrders: parseInt(orderStats?.card_orders || '0'),
          digitalOrders: parseInt(orderStats?.digital_orders || '0')
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
      const generatedAt = getCurrentTimestamp()
      await this.d1.prepare(`
        INSERT INTO shift_reports (
          id, shift_id, register_id, operator_id, report_data,
          summary_data, generated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        reportId,
        shiftId,
        shift.register_id,
        shift.operator_id,
        JSON.stringify(reportData),
        JSON.stringify(reportData.summary),
        generatedAt
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

  /**
   * 獲取班次統計
   */
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

  /**
   * 獲取日營業報表
   */
  async getDailyReport(
    restaurantId: number,
    date: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // 獲取當日班次
      const shifts = await this.d1.prepare(`
        SELECT cs.*, cr.name as register_name, u.full_name as operator_name
        FROM cash_shifts cs
        JOIN cash_registers cr ON cs.register_id = cr.id
        JOIN users u ON cs.operator_id = u.id
        WHERE cr.restaurant_id = ? AND DATE(cs.started_at) = ?
        ORDER BY cs.started_at
      `).bind(restaurantId, date).all()

      // 獲取當日訂單統計
      const orderStats = await this.d1.prepare(`
        SELECT
          COUNT(*) as total_orders,
          SUM(total_amount) as total_sales,
          SUM(tax_amount) as total_tax,
          SUM(discount_amount) as total_discounts,
          AVG(total_amount) as avg_order_value,
          COUNT(CASE WHEN payment_method = 'cash' THEN 1 END) as cash_orders,
          COUNT(CASE WHEN payment_method = 'card' THEN 1 END) as card_orders,
          COUNT(CASE WHEN payment_method = 'digital_wallet' THEN 1 END) as digital_orders
        FROM orders
        WHERE restaurant_id = ? AND DATE(created_at) = ?
      `).bind(restaurantId, date).first() as any

      // 獲取退款統計
      const refundStats = await this.d1.prepare(`
        SELECT
          COUNT(*) as total_refunds,
          SUM(refund_amount) as total_refund_amount
        FROM refunds r
        JOIN cash_registers cr ON r.register_id = cr.id
        WHERE cr.restaurant_id = ? AND DATE(r.processed_at) = ? AND r.status = 'completed'
      `).bind(restaurantId, date).first() as any

      // 獲取熱門商品
      const topItems = await this.d1.prepare(`
        SELECT
          mi.name,
          SUM(oi.quantity) as total_quantity,
          SUM(oi.subtotal) as total_revenue
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.restaurant_id = ? AND DATE(o.created_at) = ?
        GROUP BY mi.id, mi.name
        ORDER BY total_quantity DESC
        LIMIT 10
      `).bind(restaurantId, date).all()

      const reportData = {
        date,
        shifts: shifts.results || [],
        summary: {
          totalOrders: parseInt(orderStats?.total_orders || '0'),
          totalSales: parseFloat(orderStats?.total_sales || '0'),
          totalTax: parseFloat(orderStats?.total_tax || '0'),
          totalDiscounts: parseFloat(orderStats?.total_discounts || '0'),
          totalRefunds: parseInt(refundStats?.total_refunds || '0'),
          totalRefundAmount: parseFloat(refundStats?.total_refund_amount || '0'),
          avgOrderValue: parseFloat(orderStats?.avg_order_value || '0'),
          netSales: parseFloat(orderStats?.total_sales || '0') - parseFloat(refundStats?.total_refund_amount || '0')
        },
        paymentBreakdown: {
          cashOrders: parseInt(orderStats?.cash_orders || '0'),
          cardOrders: parseInt(orderStats?.card_orders || '0'),
          digitalOrders: parseInt(orderStats?.digital_orders || '0')
        },
        topItems: topItems.results || []
      }

      return {
        success: true,
        data: reportData
      }

    } catch (error) {
      console.error('獲取日營業報表失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '獲取日營業報表失敗'
      }
    }
  }

  /**
   * 獲取收銀機使用統計
   */
  async getRegisterUsageStats(
    restaurantId: number,
    period: 'day' | 'week' | 'month' = 'day'
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      let dateFilter = ''
      let groupBy = ''

      switch (period) {
        case 'day':
          dateFilter = 'AND cs.started_at >= datetime("now", "-7 days")'
          groupBy = 'DATE(cs.started_at)'
          break
        case 'week':
          dateFilter = 'AND cs.started_at >= datetime("now", "-4 weeks")'
          groupBy = 'strftime("%Y-%W", cs.started_at)'
          break
        case 'month':
          dateFilter = 'AND cs.started_at >= datetime("now", "-12 months")'
          groupBy = 'strftime("%Y-%m", cs.started_at)'
          break
      }

      const stats = await this.d1.prepare(`
        SELECT
          cr.name as register_name,
          ${groupBy} as period,
          COUNT(cs.id) as shift_count,
          SUM(cs.total_sales) as total_sales,
          SUM(cs.total_transactions) as total_transactions,
          AVG(cs.total_sales) as avg_sales_per_shift
        FROM cash_registers cr
        LEFT JOIN cash_shifts cs ON cr.id = cs.register_id ${dateFilter}
        WHERE cr.restaurant_id = ?
        GROUP BY cr.id, ${groupBy}
        ORDER BY period DESC, cr.name
      `).bind(restaurantId).all()

      return {
        success: true,
        data: {
          period,
          stats: stats.results || []
        }
      }

    } catch (error) {
      console.error('獲取收銀機使用統計失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '獲取收銀機使用統計失敗'
      }
    }
  }
}