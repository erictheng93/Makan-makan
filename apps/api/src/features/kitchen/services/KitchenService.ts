/**
 * Kitchen Service
 * Business logic for kitchen operations and real-time events
 */

import type { Env } from '../../../types/env'
import { ConsoleLogger } from '../../../core/monitoring'
import type {
  IKitchenService,
  KitchenConnection,
  KitchenSSEEvent,
  KitchenOrder,
  KitchenOrdersResponse,
  OrderItemStatusUpdate,
  ConnectionStatus,
  BroadcastTestEvent
} from '../types'

export class KitchenService implements IKitchenService {
  private connections = new Map<string, KitchenConnection>()
  private logger: ConsoleLogger
  private env: Env
  private cleanupInterval: NodeJS.Timeout | null = null
  private cleanupInitialized = false

  constructor(env: Env) {
    this.env = env
    this.logger = new ConsoleLogger('KitchenService')
    // Don't start cleanup interval in constructor - use lazy initialization
  }

  private initializeCleanup(): void {
    if (!this.cleanupInitialized) {
      this.cleanupInitialized = true
      // In Worker environment, use periodic cleanup strategy instead of global setInterval
      // Cleanup logic will be triggered on each request
    }
  }

  // Connection Management
  registerConnection(connectionId: string, connection: KitchenConnection): void {
    // Initialize cleanup and trigger cleanup check
    this.initializeCleanup()
    this.cleanupExpiredConnections()

    this.connections.set(connectionId, connection)
    this.logger.info('Kitchen SSE connection registered', {
      connectionId,
      restaurantId: connection.restaurantId,
      userId: connection.userId
    })
  }

  removeConnection(connectionId: string): void {
    if (this.connections.delete(connectionId)) {
      this.logger.info('Kitchen SSE connection removed', { connectionId })
    }
  }

  broadcastToKitchen(restaurantId: number, event: KitchenSSEEvent): number {
    let sentCount = 0

    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.restaurantId === restaurantId && connection.controller) {
        try {
          const eventData = this.formatSSEEvent(event)
          connection.controller?.writeSSE({ data: eventData })
          sentCount++
        } catch (error) {
          this.logger.error(`Failed to send event to connection ${connectionId}`, error instanceof Error ? error : undefined)
          // Remove failed connection
          this.connections.delete(connectionId)
        }
      }
    }

    this.logger.info(`Broadcasted event to ${sentCount} kitchen connections`, { restaurantId, eventType: event.data.type })
    return sentCount
  }

  cleanupExpiredConnections(): void {
    const now = Date.now()
    const timeout = 5 * 60 * 1000 // 5 minutes timeout

    for (const [connectionId, connection] of this.connections.entries()) {
      if (now - connection.lastHeartbeat > timeout) {
        this.logger.info('Cleaning up expired connection', { connectionId })
        this.connections.delete(connectionId)
      }
    }
  }

  getConnectionStatus(restaurantId: number): ConnectionStatus {
    const restaurantConnections = Array.from(this.connections.entries())
      .filter(([_, conn]) => conn.restaurantId === restaurantId)
      .map(([id, conn]) => ({
        id,
        userId: conn.userId,
        restaurantId: conn.restaurantId,
        lastHeartbeat: new Date(conn.lastHeartbeat).toISOString(),
        connected: Date.now() - conn.lastHeartbeat < 60000 // 1 minute threshold
      }))

    return {
      totalConnections: this.connections.size,
      restaurantConnections: restaurantConnections.length,
      connections: restaurantConnections
    }
  }

  // Kitchen Operations
  async getKitchenOrders(restaurantId: number, userId?: number): Promise<KitchenOrdersResponse> {
    try {
      this.logger.info('Fetching kitchen orders', { restaurantId, userId })

      // TODO: Replace with actual database queries
      // For now, return mock data similar to the original implementation
      const mockOrders: KitchenOrder[] = [
        {
          id: 1,
          orderNumber: 'ORDER-001',
          tableId: 3,
          tableName: '桌號 3',
          status: 1, // CONFIRMED
          items: [
            {
              id: 1,
              name: '蒜蓉炒麵',
              quantity: 2,
              status: 'pending',
              notes: '少油無蔥',
              priority: 'normal',
              estimatedTime: 15
            },
            {
              id: 2,
              name: '椒鹽排骨',
              quantity: 1,
              status: 'pending',
              notes: '辣一點',
              priority: 'high',
              estimatedTime: 20
            }
          ],
          customerName: '陳先生',
          notes: '打包帶走',
          createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
          totalItems: 3,
          priority: 'normal',
          elapsedTime: 10
        },
        {
          id: 2,
          orderNumber: 'ORDER-002',
          tableId: 7,
          tableName: '桌號 7',
          status: 2, // PREPARING
          items: [
            {
              id: 3,
              name: '牛肉河粉',
              quantity: 1,
              status: 'preparing',
              notes: '',
              priority: 'urgent',
              estimatedTime: 18,
              startedAt: new Date(Date.now() - 5 * 60000).toISOString()
            }
          ],
          customerName: '李小姐',
          createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
          totalItems: 1,
          priority: 'urgent',
          elapsedTime: 25
        }
      ]

      const pending = mockOrders.filter(o => o.status === 1)
      const preparing = mockOrders.filter(o => o.status === 2)
      const ready = mockOrders.filter(o => o.status === 3)

      const stats = {
        pendingCount: pending.length,
        preparingCount: preparing.length,
        readyCount: ready.length,
        completedToday: 25,
        averageCookingTime: 18,
        averageWaitingTime: 5,
        efficiency: 92,
        urgentOrders: mockOrders.filter(o => o.priority === 'urgent').length
      }

      return {
        pending,
        preparing,
        ready,
        stats
      }

    } catch (error) {
      this.logger.error('Failed to fetch kitchen orders', error instanceof Error ? error : undefined, { restaurantId })
      throw error
    }
  }

  async updateOrderItemStatus(
    restaurantId: number,
    orderId: number,
    itemId: number,
    statusUpdate: OrderItemStatusUpdate,
    userId: number
  ): Promise<{
    orderId: number
    itemId: number
    status: string
    updatedAt: string
    broadcastSent: number
  }> {
    try {
      this.logger.info('Updating order item status', {
        restaurantId, orderId, itemId, status: statusUpdate.status, userId
      })

      // TODO: Update database with actual order item status
      // await updateOrderItemStatus(this.env.DB, orderId, itemId, statusUpdate.status, userId, statusUpdate.notes)

      const updatedAt = new Date().toISOString()

      // Broadcast status update event
      const event: KitchenSSEEvent = {
        id: `update_${Date.now()}_${orderId}_${itemId}`,
        event: 'order-update',
        data: {
          type: 'ORDER_STATUS_UPDATE',
          orderId,
          payload: {
            itemId,
            status: statusUpdate.status,
            updatedBy: userId,
            updatedAt,
            notes: statusUpdate.notes
          },
          timestamp: updatedAt,
          restaurantId
        }
      }

      const sentCount = this.broadcastToKitchen(restaurantId, event)

      return {
        orderId,
        itemId,
        status: statusUpdate.status,
        updatedAt,
        broadcastSent: sentCount
      }

    } catch (error) {
      this.logger.error('Failed to update order item status', error instanceof Error ? error : undefined, {
        restaurantId, orderId, itemId
      })
      throw error
    }
  }

  // Development/Testing
  broadcastTestEvent(restaurantId: number, event: BroadcastTestEvent): number {
    const testEvent: KitchenSSEEvent = {
      id: `test_${Date.now()}`,
      event: 'test-event',
      data: {
        type: event.type || 'NEW_ORDER',
        orderId: 999,
        payload: event.payload || { message: 'Test broadcast event' },
        timestamp: new Date().toISOString(),
        restaurantId
      }
    }

    const sentCount = this.broadcastToKitchen(restaurantId, testEvent)
    this.logger.info('Test event broadcasted', { restaurantId, sentCount, event: testEvent })

    return sentCount
  }

  // Utilities
  generateConnectionId(): string {
    return `kitchen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  formatSSEEvent(event: KitchenSSEEvent): string {
    let result = ''

    if (event.id) {
      result += `id: ${event.id}\n`
    }

    if (event.event) {
      result += `event: ${event.event}\n`
    }

    result += `data: ${JSON.stringify(event.data)}\n`

    return result
  }

  validateChefAccess(userId: number, userRole: number, restaurantId: number): boolean {
    // Chef role validation (role: 2)
    if (userRole !== 2) {
      this.logger.warn('Access denied - not chef role', { userId, userRole, restaurantId })
      return false
    }

    // Additional restaurant validation would go here
    // For now, assuming user.restaurantId is validated elsewhere

    return true
  }

  // Cleanup method for service shutdown
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.connections.clear()
    this.logger.info('Kitchen service destroyed')
  }
}