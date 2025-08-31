import type { Database as D1Database } from '@cloudflare/d1'
import { BaseService } from './base'
import { OrderService } from './order'

interface RealtimeMessage {
  type: 'order_update' | 'kitchen_status' | 'table_notification' | 'system_alert'
  data: any
  targetType?: 'customer' | 'admin' | 'kitchen'
  targetId?: string
  timestamp?: string
}

export class RealtimeService extends BaseService {
  private orderService: OrderService
  private cache?: any // KV namespace type not available
  private realtimeUrl: string
  
  constructor(
    db: D1Database,
    cache: any, // KVNamespace
    realtimeUrl: string
  ) {
    super(db)
    this.cache = cache
    this.realtimeUrl = realtimeUrl
    this.orderService = new OrderService(db)
  }

  // Broadcast message to specific room
  async broadcast(
    roomType: 'customer' | 'admin' | 'kitchen',
    roomId: string,
    message: RealtimeMessage
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.realtimeUrl}/broadcast/${roomType}/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...message,
          timestamp: message.timestamp || new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error(`Broadcast failed: ${response.status} ${response.statusText}`)
      }

      return true
    } catch (error) {
      console.error(`Failed to broadcast to ${roomType}:${roomId}:`, error)
      return false
    }
  }

  // Notify customer about order update
  async notifyCustomer(tableId: string, orderUpdate: {
    orderId: string
    status: string
    estimatedTime?: number
    message?: string
  }): Promise<boolean> {
    return this.broadcast('customer', tableId, {
      type: 'order_update',
      data: orderUpdate
    })
  }

  // Notify admin about new order or status changes
  async notifyAdmin(restaurantId: string, notification: {
    type: 'new_order' | 'order_update' | 'table_request'
    orderId?: string
    tableId?: string
    data: any
  }): Promise<boolean> {
    return this.broadcast('admin', restaurantId, {
      type: notification.type as any,
      data: {
        ...notification.data,
        orderId: notification.orderId,
        tableId: notification.tableId
      }
    })
  }

  // Notify kitchen about new orders or updates
  async notifyKitchen(restaurantId: string, kitchenUpdate: {
    orderId: string
    action: 'new_order' | 'cancel_order' | 'priority_change'
    orderData?: any
    priority?: 'low' | 'medium' | 'high'
  }): Promise<boolean> {
    return this.broadcast('kitchen', restaurantId, {
      type: 'kitchen_status',
      data: kitchenUpdate
    })
  }

  // Get connection statistics for monitoring
  async getConnectionStats(
    roomType: 'customer' | 'admin' | 'kitchen',
    roomId: string
  ): Promise<any> {
    try {
      const response = await fetch(`${this.realtimeUrl}/stats/${roomType}/${roomId}`)
      
      if (!response.ok) {
        throw new Error(`Stats request failed: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`Failed to get stats for ${roomType}:${roomId}:`, error)
      return null
    }
  }

  // Send system-wide alerts
  async sendSystemAlert(
    restaurantId: string,
    alert: {
      level: 'info' | 'warning' | 'error'
      title: string
      message: string
      actions?: Array<{ label: string; action: string }>
    }
  ): Promise<void> {
    // Send to all admin connections
    await this.broadcast('admin', restaurantId, {
      type: 'system_alert',
      data: alert
    })

    // Also send to kitchen if it's critical
    if (alert.level === 'error') {
      await this.broadcast('kitchen', restaurantId, {
        type: 'system_alert',
        data: alert
      })
    }
  }

  // Cache frequently accessed data for performance
  async cacheOrderStatus(orderId: string, status: {
    current: string
    estimatedTime?: number
    lastUpdated: string
  }): Promise<void> {
    const cacheKey = `order_status:${orderId}`
    await this.cache.put(cacheKey, JSON.stringify(status), {
      expirationTtl: 3600 // 1 hour
    })
  }

  async getCachedOrderStatus(orderId: string): Promise<any> {
    const cacheKey = `order_status:${orderId}`
    const cached = await this.cache.get(cacheKey)
    return cached ? JSON.parse(cached) : null
  }

  // Order status change workflow
  async updateOrderStatus(
    orderId: string,
    newStatus: string,
    restaurantId: string,
    tableId: string,
    estimatedTime?: number
  ): Promise<boolean> {
    try {
      // Update database using OrderService
      await this.orderService.updateOrderStatus(
        parseInt(orderId), 
        { status: newStatus as any }
      )

      // Cache the status
      await this.cacheOrderStatus(orderId, {
        current: newStatus,
        estimatedTime,
        lastUpdated: new Date().toISOString()
      })

      // Notify all relevant parties
      const updateData = {
        orderId,
        status: newStatus,
        estimatedTime,
        timestamp: new Date().toISOString()
      }

      // Notify customer
      await this.notifyCustomer(tableId, updateData)

      // Notify admin
      await this.notifyAdmin(restaurantId, {
        type: 'order_update',
        orderId,
        tableId,
        data: updateData
      })

      // Notify kitchen if relevant
      if (['confirmed', 'preparing', 'ready'].includes(newStatus)) {
        await this.notifyKitchen(restaurantId, {
          orderId,
          action: 'new_order', // This will be filtered by kitchen based on status
          orderData: updateData
        })
      }

      return true
    } catch (error) {
      console.error('Failed to update order status:', error)
      return false
    }
  }

  // New order notification workflow
  async processNewOrder(order: {
    id: string
    restaurantId: string
    tableId: string
    customerName?: string
    items: Array<any>
    totalAmount: number
  }): Promise<boolean> {
    try {
      // Notify admin about new order
      await this.notifyAdmin(order.restaurantId, {
        type: 'new_order',
        orderId: order.id,
        tableId: order.tableId,
        data: {
          orderId: order.id,
          tableId: order.tableId,
          customerName: order.customerName,
          items: order.items,
          totalAmount: order.totalAmount,
          timestamp: new Date().toISOString()
        }
      })

      // Notify kitchen about new order
      await this.notifyKitchen(order.restaurantId, {
        orderId: order.id,
        action: 'new_order',
        orderData: {
          orderId: order.id,
          tableId: order.tableId,
          items: order.items,
          timestamp: new Date().toISOString()
        }
      })

      // Confirm to customer
      await this.notifyCustomer(order.tableId, {
        orderId: order.id,
        status: 'confirmed',
        message: '您的訂單已確認，廚房開始準備中'
      })

      return true
    } catch (error) {
      console.error('Failed to process new order notifications:', error)
      return false
    }
  }

  // Health check for realtime service
  async healthCheck(): Promise<{ status: string; latency?: number }> {
    try {
      const start = Date.now()
      const response = await fetch(`${this.realtimeUrl}/health`)
      const latency = Date.now() - start

      if (response.ok) {
        return { status: 'healthy', latency }
      } else {
        return { status: 'unhealthy' }
      }
    } catch (error) {
      console.error('Realtime service health check failed:', error)
      return { status: 'down' }
    }
  }
}

// Factory function to create service instance
export function createRealtimeService(
  db: D1Database,
  cache: KVNamespace,
  realtimeUrl: string
): RealtimeService {
  return new RealtimeService(db, cache, realtimeUrl)
}