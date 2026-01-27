/**
 * SSE Service
 * Server-Sent Events business logic and connection management
 */

import type { Env } from '../../../types/env'
import { ConsoleLogger } from '../../../core/monitoring'
import type {
  SSEConnection,
  SSEEvent,
  BroadcastEvent,
  ConnectionStatus,
  BroadcastTestEvent,
  SSEService as ISSEService
} from '../types'

export class SSEService implements ISSEService {
  private connections = new Map<string, SSEConnection>()
  private logger: ConsoleLogger
  private env: Env
  private cleanupInitialized = false

  constructor(env: Env) {
    this.env = env
    this.logger = new ConsoleLogger('SSEService')
  }

  private initializeCleanup(): void {
    if (!this.cleanupInitialized) {
      this.cleanupInitialized = true
      // In Worker environment, use periodic cleanup strategy instead of global setInterval
      // Cleanup logic will be triggered on each request
    }
  }

  // Connection Management
  registerConnection(connectionId: string, connection: SSEConnection): void {
    // Initialize cleanup and trigger cleanup check
    this.initializeCleanup()
    this.cleanupExpiredConnections()

    this.connections.set(connectionId, connection)
    this.logger.info('SSE connection registered', {
      connectionId,
      restaurantId: connection.restaurantId,
      userId: connection.userId,
      role: connection.role
    })
  }

  removeConnection(connectionId: string): void {
    if (this.connections.delete(connectionId)) {
      this.logger.info('SSE connection removed', { connectionId })
    }
  }

  getConnectionsByRestaurant(restaurantId: string): SSEConnection[] {
    return Array.from(this.connections.values()).filter(
      conn => conn.restaurantId === restaurantId
    )
  }

  getConnectionsByRole(role: number): SSEConnection[] {
    return Array.from(this.connections.values()).filter(
      conn => conn.role === role
    )
  }

  // Broadcasting
  async broadcast(event: BroadcastEvent): Promise<void> {
    let targetConnections = Array.from(this.connections.values())

    // Filter by restaurant if specified
    if (event.restaurantId !== undefined) {
      targetConnections = targetConnections.filter(
        conn => conn.restaurantId === event.restaurantId
      )
    }

    // Filter by roles if specified
    if (event.targetRoles && event.targetRoles.length > 0) {
      targetConnections = targetConnections.filter(
        conn => event.targetRoles!.includes(conn.role)
      )
    }

    const sseEvent: SSEEvent = {
      id: Date.now().toString(),
      event: event.type,
      data: event.data
    }

    await this.sendToConnections(targetConnections, sseEvent)
  }

  async broadcastToRestaurant(restaurantId: string, event: SSEEvent): Promise<void> {
    const connections = this.getConnectionsByRestaurant(restaurantId)
    await this.sendToConnections(connections, event)
  }

  async broadcastToRole(role: number, event: SSEEvent): Promise<void> {
    const connections = this.getConnectionsByRole(role)
    await this.sendToConnections(connections, event)
  }

  private async sendToConnections(connections: SSEConnection[], event: SSEEvent): Promise<void> {
    const eventData = `id: ${event.id}\nevent: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`
    const encoder = new TextEncoder()
    const encodedData = encoder.encode(eventData)

    for (const connection of connections) {
      try {
        if (connection.controller) {
          connection.controller.enqueue(encodedData)
          connection.lastHeartbeat = Date.now()
          this.logger.debug('Event sent to connection', {
            connectionId: connection.id,
            event: event.event
          })
        }
      } catch (error) {
        this.logger.warn('Failed to send event to connection', {
          connectionId: connection.id,
          event: event.event,
          error: error instanceof Error ? error.message : String(error)
        })
        // Remove failed connection
        this.removeConnection(connection.id)
      }
    }
  }

  // Health & Status
  getConnectionStatus(): ConnectionStatus {
    const connections = Array.from(this.connections.values())

    const connectionsByRestaurant: Record<string, number> = {}
    const connectionsByRole: Record<number, number> = {}

    for (const conn of connections) {
      connectionsByRestaurant[conn.restaurantId] = (connectionsByRestaurant[conn.restaurantId] || 0) + 1
      connectionsByRole[conn.role] = (connectionsByRole[conn.role] || 0) + 1
    }

    return {
      totalConnections: connections.length,
      connectionsByRestaurant,
      connectionsByRole
    }
  }

  cleanupExpiredConnections(): void {
    const now = Date.now()
    const timeout = 5 * 60 * 1000 // 5 minutes

    // Convert to array to avoid iterator compatibility issues
    const connectionEntries = Array.from(this.connections.entries())
    for (const [connectionId, connection] of connectionEntries) {
      if (now - connection.lastHeartbeat > timeout) {
        this.logger.info('Cleaning up expired SSE connection', { connectionId })
        this.connections.delete(connectionId)
      }
    }
  }

  // Test & Debug
  async broadcastTest(data: BroadcastTestEvent): Promise<void> {
    const event: BroadcastEvent = {
      type: 'test',
      data: {
        ...data,
        timestamp: new Date().toISOString()
      }
    }

    await this.broadcast(event)
    this.logger.info('Test broadcast sent', { event: data.event })
  }
}