/**
 * Kitchen Feature Module Types
 * Types for kitchen operations and SSE events
 */

export interface KitchenSSEEvent {
  id?: string
  event?: string
  data: {
    type: 'NEW_ORDER' | 'ORDER_STATUS_UPDATE' | 'ORDER_CANCELLED' | 'PRIORITY_UPDATE' | 'HEARTBEAT'
    orderId?: number
    payload?: any
    timestamp: string
    restaurantId: number
  }
}

export interface KitchenConnection {
  restaurantId: number
  userId: number
  controller?: any // SSEStreamingApi
  lastHeartbeat: number
}

export interface KitchenOrder {
  id: number
  orderNumber: string
  tableId: number
  tableName: string
  status: number // OrderStatus
  items: KitchenOrderItem[]
  customerName?: string
  notes?: string
  createdAt: string
  totalItems: number
  priority: 'normal' | 'high' | 'urgent'
  elapsedTime: number
}

export interface KitchenOrderItem {
  id: number
  name: string
  quantity: number
  status: 'pending' | 'preparing' | 'ready' | 'completed'
  notes?: string
  priority: 'normal' | 'high' | 'urgent'
  estimatedTime: number
  startedAt?: string
}

export interface KitchenStats {
  pendingCount: number
  preparingCount: number
  readyCount: number
  completedToday: number
  averageCookingTime: number
  averageWaitingTime: number
  efficiency: number
  urgentOrders: number
}

export interface KitchenOrdersResponse {
  pending: KitchenOrder[]
  preparing: KitchenOrder[]
  ready: KitchenOrder[]
  stats: KitchenStats
}

export interface OrderItemStatusUpdate {
  status: 'pending' | 'preparing' | 'ready' | 'completed'
  notes?: string
}

export interface ConnectionStatus {
  totalConnections: number
  restaurantConnections: number
  connections: Array<{
    id: string
    userId: number
    restaurantId: number
    lastHeartbeat: string
    connected: boolean
  }>
}

export interface BroadcastTestEvent {
  type?: 'NEW_ORDER' | 'ORDER_STATUS_UPDATE' | 'ORDER_CANCELLED' | 'PRIORITY_UPDATE'
  payload?: any
}

// Service Interface
export interface IKitchenService {
  // SSE Connection Management
  registerConnection(connectionId: string, connection: KitchenConnection): void
  removeConnection(connectionId: string): void
  broadcastToKitchen(restaurantId: number, event: KitchenSSEEvent): number
  cleanupExpiredConnections(): void
  getConnectionStatus(restaurantId: number): ConnectionStatus

  // Kitchen Operations
  getKitchenOrders(restaurantId: number, userId?: number): Promise<KitchenOrdersResponse>
  updateOrderItemStatus(
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
  }>

  // Development/Testing
  broadcastTestEvent(restaurantId: number, event: BroadcastTestEvent): number

  // Utilities
  generateConnectionId(): string
  formatSSEEvent(event: KitchenSSEEvent): string
  validateChefAccess(userId: number, userRole: number, restaurantId: number): boolean
}