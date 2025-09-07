/**
 * Order Completion Service - Integrates Payment, Printing, and Kitchen Systems
 * 
 * This service orchestrates the completion flow when payments are received:
 * 1. Payment confirmed → Order status updated → Kitchen notification sent → Receipt printed
 * 2. Group order payment complete → Individual receipt + Kitchen order 
 * 3. Regular order payment complete → Receipt + Kitchen notification
 */

import type { Env } from '../types/env'

interface OrderItem {
  id: string
  menuItemId: number
  menuItemName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  customizations?: Record<string, any>
  specialInstructions?: string
}

interface OrderCompletionData {
  orderId: string
  restaurantId: number
  tableId?: number
  customerId?: number
  customerName?: string
  items: OrderItem[]
  totalAmount: number
  paymentMethod: string
  transactionId: string
  orderType: 'regular' | 'group'
  groupOrderId?: string
  memberId?: string
}

export class OrderCompletionService {
  private env: Env

  constructor(env: Env) {
    this.env = env
  }

  /**
   * Main entry point - processes completed payment and triggers all downstream actions
   */
  async processCompletedPayment(data: OrderCompletionData): Promise<{
    success: boolean
    actions: string[]
    errors?: string[]
  }> {
    const actions: string[] = []
    const errors: string[] = []

    try {
      // 1. Update order status in database
      await this.updateOrderStatus(data)
      actions.push('order_status_updated')

      // 2. Send kitchen notification
      const kitchenResult = await this.notifyKitchen(data)
      if (kitchenResult.success) {
        actions.push('kitchen_notified')
      } else {
        errors.push(`Kitchen notification failed: ${kitchenResult.error}`)
      }

      // 3. Print receipt
      const printResult = await this.printReceipt(data)
      if (printResult.success) {
        actions.push('receipt_printed')
      } else {
        errors.push(`Receipt printing failed: ${printResult.error}`)
      }

      // 4. Send real-time updates to frontend
      await this.broadcastOrderUpdate(data)
      actions.push('realtime_update_sent')

      // 5. For group orders, check if all payments are complete
      if (data.orderType === 'group' && data.groupOrderId) {
        const groupResult = await this.checkGroupOrderCompletion(data.groupOrderId)
        if (groupResult.allComplete) {
          actions.push('group_order_completed')
          // Send group completion notification
          await this.notifyGroupCompletion(data.groupOrderId)
          actions.push('group_completion_notified')
        }
      }

      return {
        success: true,
        actions
      }

    } catch (error) {
      console.error('Order completion processing error:', error)
      return {
        success: false,
        actions,
        errors: [...errors, `Processing failed: ${error}`]
      }
    }
  }

  /**
   * Update order status in database
   */
  private async updateOrderStatus(data: OrderCompletionData): Promise<void> {
    const db = this.env.DB

    if (data.orderType === 'group') {
      // Update group member payment status
      await db.prepare(`
        UPDATE group_members 
        SET payment_status = 'completed',
            payment_method = ?,
            transaction_id = ?,
            paid_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(data.paymentMethod, data.transactionId, data.memberId).run()

      // Log group activity
      await db.prepare(`
        INSERT INTO group_activity_logs (
          group_order_id, member_id, action, metadata, created_at
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        data.groupOrderId,
        data.memberId,
        'payment_completed',
        JSON.stringify({
          amount: data.totalAmount,
          paymentMethod: data.paymentMethod,
          transactionId: data.transactionId
        })
      ).run()
    } else {
      // Update regular order
      await db.prepare(`
        UPDATE orders 
        SET status = 'paid',
            payment_method = ?,
            transaction_id = ?,
            paid_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(data.paymentMethod, data.transactionId, data.orderId).run()
    }
  }

  /**
   * Send notification to kitchen display system
   */
  private async notifyKitchen(data: OrderCompletionData): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const kitchenOrderData = {
        orderId: data.orderId,
        restaurantId: data.restaurantId,
        tableId: data.tableId,
        customerName: data.customerName || 'Customer',
        items: data.items.map(item => ({
          name: item.menuItemName,
          quantity: item.quantity,
          customizations: item.customizations,
          specialInstructions: item.specialInstructions
        })),
        orderType: data.orderType,
        priority: this.calculateKitchenPriority(data),
        estimatedPrepTime: this.estimatePrepTime(data.items),
        createdAt: new Date().toISOString()
      }

      // Send to kitchen display via SSE
      const response = await fetch(`${this.env.API_BASE_URL}/api/v1/sse/broadcast/kitchen-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.INTERNAL_API_TOKEN}`
        },
        body: JSON.stringify({
          restaurantId: data.restaurantId,
          targetRoles: [2], // Kitchen role
          orderData: kitchenOrderData
        })
      })

      if (!response.ok) {
        throw new Error(`Kitchen API responded with ${response.status}`)
      }

      return { success: true }

    } catch (error) {
      return {
        success: false,
        error: String(error)
      }
    }
  }

  /**
   * Print customer receipt
   */
  private async printReceipt(data: OrderCompletionData): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // Get restaurant info for receipt header
      const restaurant = await this.env.DB.prepare(
        'SELECT name, address, phone, tax_id FROM restaurants WHERE id = ?'
      ).bind(data.restaurantId).first()

      const receiptData = {
        restaurantInfo: restaurant,
        orderId: data.orderId,
        tableId: data.tableId,
        customerName: data.customerName,
        items: data.items,
        subtotal: data.totalAmount * 0.952381, // Assuming 5% tax
        tax: data.totalAmount * 0.047619,
        total: data.totalAmount,
        paymentMethod: data.paymentMethod,
        transactionId: data.transactionId,
        timestamp: new Date(),
        orderType: data.orderType
      }

      // Call print service
      const response = await fetch(`${this.env.API_BASE_URL}/api/v1/print/receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.INTERNAL_API_TOKEN}`
        },
        body: JSON.stringify({
          type: 'customer_receipt',
          priority: 'normal',
          data: receiptData
        })
      })

      if (!response.ok) {
        throw new Error(`Print service responded with ${response.status}`)
      }

      return { success: true }

    } catch (error) {
      return {
        success: false,
        error: String(error)
      }
    }
  }

  /**
   * Broadcast order update to connected clients
   */
  private async broadcastOrderUpdate(data: OrderCompletionData): Promise<void> {
    const updateData = {
      orderId: data.orderId,
      restaurantId: data.restaurantId,
      status: 'paid',
      paymentMethod: data.paymentMethod,
      paidAt: new Date().toISOString(),
      orderType: data.orderType
    }

    if (data.orderType === 'group') {
      // Broadcast group payment update
      await fetch(`${this.env.API_BASE_URL}/api/v1/sse/broadcast/payment-completed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.INTERNAL_API_TOKEN}`
        },
        body: JSON.stringify({
          groupOrderId: data.groupOrderId,
          memberId: data.memberId,
          amount: data.totalAmount,
          paymentMethod: data.paymentMethod
        })
      })
    } else {
      // Broadcast regular order update
      await fetch(`${this.env.API_BASE_URL}/api/v1/sse/broadcast/order-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.INTERNAL_API_TOKEN}`
        },
        body: JSON.stringify({
          orderId: data.orderId,
          orderData: updateData,
          restaurantId: data.restaurantId
        })
      })
    }
  }

  /**
   * Check if all group order payments are complete
   */
  private async checkGroupOrderCompletion(groupOrderId: string): Promise<{
    allComplete: boolean
    completedCount: number
    totalMembers: number
  }> {
    const result = await this.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_members,
        SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) as completed_payments
      FROM group_members 
      WHERE group_order_id = ?
    `).bind(groupOrderId).first()

    const totalMembers = result.total_members || 0
    const completedCount = result.completed_payments || 0

    return {
      allComplete: totalMembers > 0 && completedCount === totalMembers,
      completedCount,
      totalMembers
    }
  }

  /**
   * Notify all group members when group order is fully paid
   */
  private async notifyGroupCompletion(groupOrderId: string): Promise<void> {
    // Update group order status
    await this.env.DB.prepare(`
      UPDATE group_orders 
      SET status = 'completed', 
          completed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(groupOrderId).run()

    // Log completion activity
    await this.env.DB.prepare(`
      INSERT INTO group_activity_logs (
        group_order_id, action, metadata, created_at
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      groupOrderId,
      'order_completed',
      JSON.stringify({ completedAt: new Date().toISOString() })
    ).run()

    // Send completion notification via SSE
    await fetch(`${this.env.API_BASE_URL}/api/v1/sse/broadcast/group-order-completed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.env.INTERNAL_API_TOKEN}`
      },
      body: JSON.stringify({
        groupOrderId,
        completedAt: new Date().toISOString()
      })
    })
  }

  /**
   * Calculate kitchen priority based on order characteristics
   */
  private calculateKitchenPriority(data: OrderCompletionData): 'urgent' | 'high' | 'normal' | 'low' {
    // Group orders get higher priority
    if (data.orderType === 'group') {
      return 'high'
    }

    // Orders with many items get normal priority
    if (data.items.length > 5) {
      return 'normal'
    }

    // Simple orders get normal priority
    return 'normal'
  }

  /**
   * Estimate preparation time based on items
   */
  private estimatePrepTime(items: OrderItem[]): number {
    // Base time per item + complexity factor
    const baseTime = 5 // 5 minutes base
    const itemTime = items.length * 3 // 3 minutes per item
    const complexityTime = items.filter(item => 
      item.customizations && Object.keys(item.customizations).length > 0
    ).length * 2 // 2 extra minutes for customized items

    return Math.min(baseTime + itemTime + complexityTime, 45) // Max 45 minutes
  }
}