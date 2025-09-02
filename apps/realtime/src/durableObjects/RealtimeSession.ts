import type { Env } from '../types/env'

interface WebSocketMessage {
  type: string
  data?: any
  timestamp?: string
}

interface ConnectionInfo {
  id: string
  type: 'customer' | 'admin' | 'kitchen'
  roomId: string
  connectedAt: number
  lastActivity: number
  metadata?: Record<string, any>
}

export class RealtimeSession implements DurableObject {
  private connections: Map<WebSocket, ConnectionInfo> = new Map()
  private env: Env
  private roomInfo: { type: string; id: string } | null = null

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
      lastActivity: Date.now()
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
      console.log(`Connection closed: ${connectionId}`)
    })

    server.addEventListener('error', (error) => {
      console.error(`WebSocket error for ${connectionId}:`, error)
      this.connections.delete(server)
    })

    // Send welcome message
    this.sendMessage(server, {
      type: 'connected',
      data: {
        connectionId,
        roomType,
        roomId,
        timestamp: new Date().toISOString()
      }
    })

    console.log(`New ${roomType} connection: ${connectionId}`)

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
      const message: WebSocketMessage = typeof data === 'string' 
        ? JSON.parse(data) 
        : JSON.parse(new TextDecoder().decode(data))

      // Update last activity
      connectionInfo.lastActivity = Date.now()

      console.log(`Received message from ${connectionInfo.id}:`, message)

      switch (message.type) {
        case 'ping':
          this.sendMessage(socket, { type: 'pong', timestamp: new Date().toISOString() })
          break

        case 'join_table':
          if (connectionInfo.type === 'customer') {
            connectionInfo.metadata = { 
              tableId: message.data?.tableId,
              customerName: message.data?.customerName 
            }
            this.broadcastToRoom('admin', {
              type: 'customer_joined',
              data: {
                tableId: message.data?.tableId,
                customerName: message.data?.customerName,
                timestamp: new Date().toISOString()
              }
            })
          }
          break

        case 'order_update':
          // Broadcast order updates to relevant connections
          this.broadcastOrderUpdate(message.data)
          break

        case 'kitchen_status':
          if (connectionInfo.type === 'kitchen') {
            this.broadcastToRoom('admin', message)
            this.broadcastToRoom('customer', {
              type: 'order_status_update',
              data: message.data
            })
          }
          break

        default:
          console.warn(`Unknown message type: ${message.type}`)
      }

    } catch (error) {
      console.error(`Error handling message from ${connectionInfo.id}:`, error)
      this.sendMessage(socket, {
        type: 'error',
        data: { message: 'Invalid message format' }
      })
    }
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    try {
      const message: WebSocketMessage = await request.json()
      
      // Broadcast to all connections in this room
      let sentCount = 0
      for (const [socket, connectionInfo] of this.connections) {
        if (socket.readyState === WebSocket.OPEN) {
          this.sendMessage(socket, message)
          sentCount++
        }
      }

      return Response.json({
        success: true,
        message: 'Broadcast sent',
        recipientCount: sentCount
      })

    } catch (error) {
      console.error('Broadcast error:', error)
      return Response.json(
        { success: false, error: 'Failed to broadcast message' },
        { status: 500 }
      )
    }
  }

  private async handleStats(request: Request): Promise<Response> {
    const stats = {
      roomInfo: this.roomInfo,
      connectionCount: this.connections.size,
      connections: Array.from(this.connections.values()).map(conn => ({
        id: conn.id,
        type: conn.type,
        connectedAt: new Date(conn.connectedAt).toISOString(),
        lastActivity: new Date(conn.lastActivity).toISOString(),
        metadata: conn.metadata
      })),
      uptime: Date.now() - (this.connections.size > 0 ? Math.min(...Array.from(this.connections.values()).map(c => c.connectedAt)) : Date.now())
    }

    return Response.json(stats)
  }

  private sendMessage(socket: WebSocket, message: WebSocketMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      const payload = {
        ...message,
        timestamp: message.timestamp || new Date().toISOString()
      }
      socket.send(JSON.stringify(payload))
    }
  }

  private broadcastToRoom(targetType: string, message: WebSocketMessage): void {
    for (const [socket, connectionInfo] of this.connections) {
      if (connectionInfo.type === targetType && socket.readyState === WebSocket.OPEN) {
        this.sendMessage(socket, message)
      }
    }
  }

  private broadcastOrderUpdate(orderData: any): void {
    const message: WebSocketMessage = {
      type: 'order_update',
      data: orderData,
      timestamp: new Date().toISOString()
    }

    // Send to all relevant connections
    for (const [socket, connectionInfo] of this.connections) {
      if (socket.readyState === WebSocket.OPEN) {
        // Customize message based on connection type
        let customizedMessage = { ...message }
        
        if (connectionInfo.type === 'customer') {
          // Only send updates for this customer's orders
          if (orderData.tableId === connectionInfo.metadata?.tableId) {
            customizedMessage.data = {
              orderId: orderData.orderId,
              status: orderData.status,
              estimatedTime: orderData.estimatedTime,
              message: this.getCustomerMessage(orderData.status)
            }
            this.sendMessage(socket, customizedMessage)
          }
        } else {
          // Send full data to admin and kitchen
          this.sendMessage(socket, customizedMessage)
        }
      }
    }
  }

  private getCustomerMessage(status: string): string {
    const messages: Record<string, string> = {
      'confirmed': '您的訂單已確認！',
      'preparing': '廚房正在準備您的餐點',
      'ready': '您的餐點已準備完成！',
      'served': '餐點已送達，請享用！'
    }
    
    return messages[status] || '訂單狀態已更新'
  }

  // Cleanup inactive connections
  private cleanupConnections(): void {
    const now = Date.now()
    const timeout = 30 * 60 * 1000 // 30 minutes

    for (const [socket, connectionInfo] of this.connections) {
      if (now - connectionInfo.lastActivity > timeout) {
        socket.close()
        this.connections.delete(socket)
        console.log(`Cleaned up inactive connection: ${connectionInfo.id}`)
      }
    }
  }

  // Periodic cleanup
  async alarm(): Promise<void> {
    this.cleanupConnections()
  }
}