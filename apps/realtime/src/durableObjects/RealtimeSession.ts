import type { Env } from '../types/env'
import type {
  RealtimeAuthPayload,
  RealtimeEvent,
  ClientMessage,
  ConnectionAckEvent,
  HeartbeatEvent,
  ErrorEvent
} from '@makanmakan/shared-types'
import { RealtimeEventType } from '@makanmakan/shared-types'
import { verifyWebSocketToken, extractTokenFromUrl } from '../utils/jwtVerifier'

interface ConnectionInfo {
  id: string
  type: 'customer' | 'admin' | 'kitchen'
  roomId: string
  connectedAt: number
  lastActivity: number
  auth?: RealtimeAuthPayload  // 認證資訊
  metadata?: Record<string, any>
  // 離線重連支援
  lastEventId?: string  // 最後接收的事件 ID
  missedEvents?: RealtimeEvent[]  // 離線期間錯過的事件
}

export class RealtimeSession implements DurableObject {
  private connections: Map<WebSocket, ConnectionInfo> = new Map()
  private env: Env
  private roomInfo: { type: string; id: string } | null = null
  // 事件歷史記錄（用於離線重連）
  private eventHistory: RealtimeEvent[] = []
  private readonly MAX_EVENT_HISTORY = 100  // 最多保留 100 個事件
  private readonly MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000  // 最多保留 24 小時的事件

  constructor(env: Env) {
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const upgradeHeader = request.headers.get('Upgrade')
    
    // Handle WebSocket upgrade
    if (upgradeHeader === 'websocket') {
      return this.handleWebSocketUpgrade(request)
    }
    
    // Handle HTTP requests
    switch (url.pathname) {
      case '/broadcast':
        return this.handleBroadcast(request)
      case '/stats':
        return this.handleStats(request)
      case '/history':
        return this.handleHistoryRequest(request)
      default:
        return new Response('Not found', { status: 404 })
    }
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const [, roomType, roomId] = url.pathname.split('/')

    if (!roomType || !roomId) {
      return new Response('Invalid room parameters', { status: 400 })
    }

    // 🔒 認證：提取並驗證 JWT token
    const token = extractTokenFromUrl(url)
    if (!token) {
      console.warn('WebSocket connection rejected: No token provided')
      return new Response('Unauthorized: Token required', { status: 401 })
    }

    // 驗證 token
    const jwtSecret = this.env.JWT_SECRET
    const verification = await verifyWebSocketToken(token, jwtSecret)

    if (!verification.valid) {
      console.warn('WebSocket connection rejected: Invalid token', verification.error)
      return new Response(`Unauthorized: ${verification.error}`, { status: 401 })
    }

    const authPayload = verification.payload!

    // ========== ROOM ACCESS VALIDATION ==========

    // 1. 驗證 roomId 與 token 是否匹配
    if (authPayload.roomId !== roomId) {
      console.warn('WebSocket connection rejected: Room ID mismatch', {
        tokenRoomId: authPayload.roomId,
        requestedRoomId: roomId
      })
      return new Response('Forbidden: Room ID does not match token', { status: 403 })
    }

    // 2. 驗證 roomType 與 token 是否匹配
    if (authPayload.roomType !== roomType) {
      console.warn('WebSocket connection rejected: Room type mismatch', {
        tokenRoomType: authPayload.roomType,
        requestedRoomType: roomType
      })
      return new Response('Forbidden: Room type does not match token', { status: 403 })
    }

    // 3. 驗證用戶角色與房間類型的權限匹配
    const roleRoomValidation = this.validateRoleRoomAccess(authPayload.role, roomType)
    if (!roleRoomValidation.valid) {
      console.warn('WebSocket connection rejected: Role-room mismatch', {
        role: authPayload.role,
        roomType,
        reason: roleRoomValidation.error
      })
      return new Response(`Forbidden: ${roleRoomValidation.error}`, { status: 403 })
    }

    // 4. 驗證餐廳訪問權限（對於staff和admin）
    if (authPayload.role !== 'customer') {
      const restaurantValidation = await this.validateRestaurantAccess(authPayload)
      if (!restaurantValidation.valid) {
        console.warn('WebSocket connection rejected: Restaurant access denied', {
          userId: authPayload.userId,
          restaurantId: authPayload.restaurantId,
          reason: restaurantValidation.error
        })
        return new Response(`Forbidden: ${restaurantValidation.error}`, { status: 403 })
      }
    }

    // 5. 驗證桌號/座位訪問權限（對於customer房間）
    if (roomType === 'customer') {
      const tableValidation = await this.validateTableAccess(authPayload)
      if (!tableValidation.valid) {
        console.warn('WebSocket connection rejected: Table/seat access denied', {
          tableId: authPayload.tableId,
          seatId: authPayload.seatId,
          restaurantId: authPayload.restaurantId,
          reason: tableValidation.error
        })
        return new Response(`Forbidden: ${tableValidation.error}`, { status: 403 })
      }
    }

    // Set room info if not already set
    if (!this.roomInfo) {
      this.roomInfo = { type: roomType, id: roomId }
    }

    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    // Generate unique connection ID
    const connectionId = `${roomType}_${roomId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const connectionInfo: ConnectionInfo = {
      id: connectionId,
      type: roomType as 'customer' | 'admin' | 'kitchen',
      roomId: roomId,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      auth: authPayload  // 儲存認證資訊
    }

    // Store connection
    this.connections.set(server, connectionInfo)

    // Set up event handlers
    server.accept()
    
    server.addEventListener('message', (event) => {
      this.handleMessage(server, event.data, connectionInfo)
    })

    server.addEventListener('close', () => {
      this.connections.delete(server)
      // Connection closed - cleanup handled automatically
    })

    server.addEventListener('error', (error) => {
      console.error(`WebSocket error for ${connectionId}:`, error)
      this.connections.delete(server)
    })

    // Send connection acknowledgment with auth info
    const ackEvent: ConnectionAckEvent = {
      type: RealtimeEventType.CONNECTION_ACK,
      eventId: this.generateEventId(),
      timestamp: Date.now(),
      restaurantId: authPayload.restaurantId,
      data: {
        connectionId,
        roomType: authPayload.roomType,
        roomId: authPayload.roomId,
        connectedAt: Date.now(),
        activeConnections: this.connections.size
      }
    }
    this.sendEvent(server, ackEvent)

    // Successfully established authenticated connection
    // Connection acknowledged with connectionId: ${connectionId}

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  private async handleMessage(
    socket: WebSocket,
    data: string | ArrayBuffer,
    connectionInfo: ConnectionInfo
  ): Promise<void> {
    try {
      const message: ClientMessage = typeof data === 'string'
        ? JSON.parse(data)
        : JSON.parse(new TextDecoder().decode(data))

      // Update last activity
      connectionInfo.lastActivity = Date.now()

      // Message received and validated

      switch (message.type) {
        case 'ping':
          // 心跳響應
          const heartbeatEvent: HeartbeatEvent = {
            type: RealtimeEventType.HEARTBEAT,
            eventId: this.generateEventId(),
            timestamp: Date.now(),
            restaurantId: connectionInfo.auth?.restaurantId || '',
            data: {
              serverTime: Date.now()
            }
          }
          this.sendEvent(socket, heartbeatEvent)
          break

        case 'subscribe':
          // 訂閱特定事件類型（未來擴展）
          // Subscription processed
          break

        case 'unsubscribe':
          // 取消訂閱（未來擴展）
          // Unsubscription processed
          break

        default:
          console.warn(`Unknown message type: ${message.type}`)
          this.sendErrorEvent(socket, connectionInfo, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`)
      }

    } catch (error) {
      console.error(`Error handling message from ${connectionInfo.id}:`, error)
      this.sendErrorEvent(socket, connectionInfo, 'MESSAGE_PARSE_ERROR', 'Failed to parse message')
    }
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    try {
      const event: RealtimeEvent = await request.json()

      // 驗證事件格式
      if (!event.type || !event.eventId || !event.timestamp || !event.restaurantId) {
        return Response.json(
          { success: false, error: 'Invalid event format' },
          { status: 400 }
        )
      }

      // 添加到事件歷史記錄
      this.addToEventHistory(event)

      // 路由事件到相關的連線
      const sentCount = this.routeEvent(event)

      // Event successfully routed to connections

      return Response.json({
        success: true,
        message: 'Event broadcast',
        eventId: event.eventId,
        recipientCount: sentCount
      })

    } catch (error) {
      console.error('Broadcast error:', error)
      return Response.json(
        { success: false, error: 'Failed to broadcast event' },
        { status: 500 }
      )
    }
  }

  private async handleStats(_request: Request): Promise<Response> {
    const stats = {
      roomInfo: this.roomInfo,
      connectionCount: this.connections.size,
      connections: Array.from(this.connections.values()).map(conn => ({
        id: conn.id,
        type: conn.type,
        role: conn.auth?.role,
        connectedAt: new Date(conn.connectedAt).toISOString(),
        lastActivity: new Date(conn.lastActivity).toISOString(),
        lastEventId: conn.lastEventId
      })),
      eventHistorySize: this.eventHistory.length,
      uptime: Date.now() - (this.connections.size > 0 ? Math.min(...Array.from(this.connections.values()).map(c => c.connectedAt)) : Date.now())
    }

    return Response.json(stats)
  }

  /**
   * 處理歷史事件請求（用於離線重連）
   */
  private async handleHistoryRequest(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url)
      const sinceEventId = url.searchParams.get('since')

      if (!sinceEventId) {
        // 返回所有歷史事件
        return Response.json({
          success: true,
          events: this.eventHistory,
          count: this.eventHistory.length
        })
      }

      // 找到指定事件 ID 之後的所有事件
      const sinceIndex = this.eventHistory.findIndex(e => e.eventId === sinceEventId)

      if (sinceIndex === -1) {
        // 找不到指定的事件 ID，返回所有事件
        return Response.json({
          success: true,
          events: this.eventHistory,
          count: this.eventHistory.length,
          note: 'Event ID not found, returning all available events'
        })
      }

      // 返回指定事件之後的所有事件
      const missedEvents = this.eventHistory.slice(sinceIndex + 1)

      return Response.json({
        success: true,
        events: missedEvents,
        count: missedEvents.length
      })

    } catch (error) {
      console.error('History request error:', error)
      return Response.json(
        { success: false, error: 'Failed to retrieve event history' },
        { status: 500 }
      )
    }
  }

  /**
   * 發送事件到指定的 WebSocket
   */
  private sendEvent(socket: WebSocket, event: RealtimeEvent): void {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(event))
      } catch (error) {
        console.error('Failed to send event:', error)
      }
    }
  }

  /**
   * 發送錯誤事件
   */
  private sendErrorEvent(
    socket: WebSocket,
    connectionInfo: ConnectionInfo,
    code: string,
    message: string
  ): void {
    const errorEvent: ErrorEvent = {
      type: RealtimeEventType.ERROR,
      eventId: this.generateEventId(),
      timestamp: Date.now(),
      restaurantId: connectionInfo.auth?.restaurantId || '',
      data: {
        code,
        message,
        details: {}
      }
    }
    this.sendEvent(socket, errorEvent)
  }

  /**
   * 路由事件到相關的連線（核心路由邏輯）
   */
  private routeEvent(event: RealtimeEvent): number {
    let sentCount = 0

    for (const [socket, connectionInfo] of this.connections) {
      if (socket.readyState !== WebSocket.OPEN) continue

      // 檢查是否應該發送此事件到此連線
      if (this.shouldSendEventToConnection(event, connectionInfo)) {
        this.sendEvent(socket, event)
        // 更新最後接收的事件 ID
        connectionInfo.lastEventId = event.eventId
        sentCount++
      }
    }

    return sentCount
  }

  /**
   * 判斷是否應該發送事件到特定連線（訊息路由核心邏輯）
   */
  private shouldSendEventToConnection(
    event: RealtimeEvent,
    connectionInfo: ConnectionInfo
  ): boolean {
    // 驗證餐廳 ID 匹配
    if (event.restaurantId !== connectionInfo.auth?.restaurantId) {
      return false
    }

    const eventType = event.type
    const role = connectionInfo.auth?.role || 'customer'

    // 根據事件類型和連線角色決定是否發送
    switch (eventType) {
      // 訂單事件 - 所有角色都接收
      case RealtimeEventType.NEW_ORDER:
        return true

      case RealtimeEventType.ORDER_STATUS_UPDATE:
      case RealtimeEventType.ORDER_ITEM_STATUS_UPDATE:
        // 顧客只接收與自己相關的訂單更新
        if (role === 'customer') {
          // 這裡需要檢查訂單是否屬於該顧客的桌號/座位
          // 暫時允許所有顧客接收（之後可以優化）
          return true
        }
        // 廚房和管理員接收所有訂單更新
        return role === 'staff' || role === 'admin'

      case RealtimeEventType.ORDER_CANCELLED:
        return true

      // 廚房事件 - 只有廚房和管理員接收
      case RealtimeEventType.KITCHEN_ITEM_STATUS:
      case RealtimeEventType.KITCHEN_QUEUE_UPDATE:
        return role === 'staff' || role === 'admin'

      // 桌台事件 - 所有角色接收
      case RealtimeEventType.TABLE_STATUS_UPDATE:
      case RealtimeEventType.TABLE_CALL_SERVICE:
        return true

      // 菜單事件 - 所有角色接收
      case RealtimeEventType.MENU_AVAILABILITY_UPDATE:
      case RealtimeEventType.MENU_ITEM_UPDATE:
        return true

      // 系統事件 - 所有角色接收
      case RealtimeEventType.SYSTEM_NOTIFICATION:
      case RealtimeEventType.RESTAURANT_STATUS_UPDATE:
        return true

      // 連線和心跳事件 - 不通過 broadcast（直接發送）
      case RealtimeEventType.CONNECTION_ACK:
      case RealtimeEventType.HEARTBEAT:
      case RealtimeEventType.ERROR:
        return false

      default:
        // 未知事件類型 - 只發送給管理員
        return role === 'admin'
    }
  }

  /**
   * 添加事件到歷史記錄
   */
  private addToEventHistory(event: RealtimeEvent): void {
    this.eventHistory.push(event)

    // 1. 基於大小的清理：保持歷史記錄在限制範圍內
    if (this.eventHistory.length > this.MAX_EVENT_HISTORY) {
      this.eventHistory.shift()  // 移除最舊的事件
    }

    // 2. 基於時間的清理：移除超過 24 小時的舊事件
    const now = Date.now()
    const cutoffTime = now - this.MAX_EVENT_AGE_MS
    this.eventHistory = this.eventHistory.filter(e => e.timestamp > cutoffTime)
  }

  /**
   * 生成唯一的事件 ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 驗證用戶角色與房間類型的權限匹配
   */
  private validateRoleRoomAccess(
    role: 'customer' | 'staff' | 'admin',
    roomType: string
  ): { valid: boolean; error?: string } {
    // 定義角色允許訪問的房間類型
    const roleRoomMap: Record<string, string[]> = {
      customer: ['customer'],
      staff: ['kitchen'],
      admin: ['admin', 'kitchen', 'restaurant']
    }

    const allowedRooms = roleRoomMap[role] || []
    if (!allowedRooms.includes(roomType)) {
      return {
        valid: false,
        error: `Role "${role}" is not authorized to access "${roomType}" rooms`
      }
    }

    return { valid: true }
  }

  /**
   * 驗證餐廳訪問權限（對於staff和admin）
   */
  private async validateRestaurantAccess(
    authPayload: RealtimeAuthPayload
  ): Promise<{ valid: boolean; error?: string }> {
    // 必須提供 userId
    if (!authPayload.userId) {
      return {
        valid: false,
        error: 'User ID is required for staff/admin access'
      }
    }

    // 驗證用戶是否屬於該餐廳
    try {
      // 查詢數據庫驗證用戶的 restaurantId
      const stmt = this.env.DB.prepare(
        'SELECT restaurant_id FROM users WHERE id = ? AND is_active = 1'
      )
      const result = await stmt.bind(authPayload.userId).first() as { restaurant_id: string } | null

      if (!result) {
        return {
          valid: false,
          error: 'User not found or inactive'
        }
      }

      // 驗證 restaurantId 匹配
      if (result.restaurant_id !== authPayload.restaurantId) {
        return {
          valid: false,
          error: 'User does not belong to this restaurant'
        }
      }

      return { valid: true }
    } catch (error) {
      console.error('Restaurant access validation error:', error)
      return {
        valid: false,
        error: 'Failed to validate restaurant access'
      }
    }
  }

  /**
   * 驗證桌號/座位訪問權限（對於customer房間）
   */
  private async validateTableAccess(
    authPayload: RealtimeAuthPayload
  ): Promise<{ valid: boolean; error?: string }> {
    // 如果沒有提供 tableId，則假設是店鋪級別訂單（shop mode）
    if (!authPayload.tableId) {
      return { valid: true }
    }

    try {
      // 驗證桌號是否屬於該餐廳
      const stmt = this.env.DB.prepare(
        'SELECT id, restaurant_id FROM tables WHERE id = ? AND is_active = 1'
      )
      const table = await stmt.bind(authPayload.tableId).first() as { id: number; restaurant_id: string } | null

      if (!table) {
        return {
          valid: false,
          error: 'Table not found or inactive'
        }
      }

      if (table.restaurant_id !== authPayload.restaurantId) {
        return {
          valid: false,
          error: 'Table does not belong to this restaurant'
        }
      }

      // 如果提供了 seatId，驗證座位
      if (authPayload.seatId) {
        const seatStmt = this.env.DB.prepare(
          'SELECT id, table_id FROM seats WHERE id = ? AND is_active = 1'
        )
        const seat = await seatStmt.bind(authPayload.seatId).first() as { id: number; table_id: number } | null

        if (!seat) {
          return {
            valid: false,
            error: 'Seat not found or inactive'
          }
        }

        if (seat.table_id !== table.id) {
          return {
            valid: false,
            error: 'Seat does not belong to this table'
          }
        }
      }

      return { valid: true }
    } catch (error) {
      console.error('Table access validation error:', error)
      return {
        valid: false,
        error: 'Failed to validate table access'
      }
    }
  }

  // Cleanup inactive connections and expired events
  private cleanupConnections(): void {
    const now = Date.now()
    const timeout = 30 * 60 * 1000 // 30 minutes

    // 1. 清理不活躍的連線
    for (const [socket, connectionInfo] of this.connections) {
      if (now - connectionInfo.lastActivity > timeout) {
        socket.close()
        this.connections.delete(socket)
        // Inactive connection cleanup completed
      }
    }

    // 2. 清理過期的事件歷史記錄
    const cutoffTime = now - this.MAX_EVENT_AGE_MS
    const beforeCount = this.eventHistory.length
    this.eventHistory = this.eventHistory.filter(e => e.timestamp > cutoffTime)
    const afterCount = this.eventHistory.length

    // 記錄清理情況（僅在有清理時）
    if (beforeCount > afterCount) {
      // Cleaned up ${beforeCount - afterCount} expired events
    }
  }

  // Periodic cleanup
  async alarm(): Promise<void> {
    this.cleanupConnections()
  }
}