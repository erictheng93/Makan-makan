/**
 * SSE Feature Types
 * Type definitions for Server-Sent Events functionality
 */

export interface SSEConnection {
  id: string
  restaurantId: string
  userId: number
  role: number
  lastHeartbeat: number
  controller?: ReadableStreamDefaultController
}

export interface SSEEvent {
  id: string
  event: string
  data: any
  retry?: number
}

export interface BroadcastEvent {
  type: string
  data: any
  restaurantId?: string
  targetRoles?: number[]
}

export interface ConnectionStatus {
  totalConnections: number
  connectionsByRestaurant: Record<string, number>
  connectionsByRole: Record<number, number>
}

export interface BroadcastTestEvent {
  event: string
  message: string
  timestamp: string
  connectionId: string
}

export interface SSEService {
  // Connection Management
  registerConnection(connectionId: string, connection: SSEConnection): void
  removeConnection(connectionId: string): void
  getConnectionsByRestaurant(restaurantId: string): SSEConnection[]
  getConnectionsByRole(role: number): SSEConnection[]

  // Broadcasting
  broadcast(event: BroadcastEvent): Promise<void>
  broadcastToRestaurant(restaurantId: string, event: SSEEvent): Promise<void>
  broadcastToRole(role: number, event: SSEEvent): Promise<void>

  // Health & Status
  getConnectionStatus(): ConnectionStatus
  cleanupExpiredConnections(): void

  // Test & Debug
  broadcastTest(data: BroadcastTestEvent): Promise<void>
}