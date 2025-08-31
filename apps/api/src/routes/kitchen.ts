import { Hono } from 'hono'
import { streamSSE, type SSEStreamingApi } from 'hono/streaming'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// SSE 連接管理
const connections = new Map<string, {
  restaurantId: number
  userId: number
  controller?: SSEStreamingApi
  lastHeartbeat: number
}>()

// 廚房專用類型定義
interface KitchenSSEEvent {
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

// 廣播消息到特定餐廳的所有廚房連接
function broadcastToKitchen(restaurantId: number, event: KitchenSSEEvent) {
  let sentCount = 0
  
  for (const [connectionId, connection] of connections.entries()) {
    if (connection.restaurantId === restaurantId && connection.controller) {
      try {
        const eventData = formatSSEEvent(event)
        connection.controller?.writeSSE({ data: eventData })
        sentCount++
      } catch (error) {
        console.error(`Failed to send event to connection ${connectionId}:`, error)
        // 移除失效的連接
        connections.delete(connectionId)
      }
    }
  }
  
  console.log(`Broadcasted event to ${sentCount} kitchen connections for restaurant ${restaurantId}`)
  return sentCount
}

// 格式化 SSE 事件
function formatSSEEvent(event: KitchenSSEEvent): string {
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

// 生成連接 ID
function generateConnectionId(): string {
  return `kitchen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 清理過期連接
function cleanupExpiredConnections() {
  const now = Date.now()
  const timeout = 5 * 60 * 1000 // 5分鐘超時
  
  for (const [connectionId, connection] of connections.entries()) {
    if (now - connection.lastHeartbeat > timeout) {
      console.log(`Cleaning up expired connection: ${connectionId}`)
      connections.delete(connectionId)
    }
  }
}

// 定期清理過期連接
setInterval(cleanupExpiredConnections, 60 * 1000) // 每分鐘清理一次

/**
 * SSE 端點 - 廚房事件流
 * GET /api/v1/kitchen/{restaurantId}/events
 */
app.get('/:restaurantId/events', authMiddleware, async (c) => {
  const restaurantId = parseInt(c.req.param('restaurantId'))
  const user = c.get('user')
  
  // 驗證用戶角色 (必須是廚師 role: 2)
  if (user.role !== 2) {
    return c.json({
      success: false,
      error: 'Access denied. Chef role required.'
    }, 403)
  }
  
  // 驗證餐廳權限
  if (user.restaurantId !== restaurantId) {
    return c.json({
      success: false,
      error: 'Access denied. Restaurant permission required.'
    }, 403)
  }
  
  console.log(`Kitchen SSE connection requested for restaurant ${restaurantId} by user ${user.id}`)
  
  return streamSSE(c, async (stream) => {
    const connectionId = generateConnectionId()
    
    // 註冊連接
    connections.set(connectionId, {
      restaurantId,
      userId: user.id,
      controller: stream,
      lastHeartbeat: Date.now()
    })
    
    console.log(`Kitchen SSE connection established: ${connectionId}`)
    
    // 發送初始連接確認
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({
        type: 'HEARTBEAT',
        connectionId,
        timestamp: new Date().toISOString(),
        restaurantId,
        message: 'Kitchen display connected successfully'
      }),
      id: `heartbeat_${Date.now()}`
    })
    
    // 設置心跳檢測
    const heartbeatInterval = setInterval(async () => {
      const connection = connections.get(connectionId)
      if (connection && connection.controller) {
        try {
          await stream.writeSSE({
            event: 'heartbeat',
            data: JSON.stringify({
              type: 'HEARTBEAT',
              timestamp: new Date().toISOString(),
              restaurantId,
              connectionCount: Array.from(connections.values())
                .filter(conn => conn.restaurantId === restaurantId).length
            }),
            id: `heartbeat_${Date.now()}`
          })
          
          // 更新心跳時間
          connection.lastHeartbeat = Date.now()
        } catch (error) {
          console.error(`Heartbeat failed for connection ${connectionId}:`, error)
          clearInterval(heartbeatInterval)
          connections.delete(connectionId)
        }
      } else {
        clearInterval(heartbeatInterval)
        connections.delete(connectionId)
      }
    }, 30000) // 30秒心跳
    
    // 監聽連接關閉
    c.req.raw.signal?.addEventListener('abort', () => {
      console.log(`Kitchen SSE connection closed: ${connectionId}`)
      clearInterval(heartbeatInterval)
      connections.delete(connectionId)
    })
    
    // 保持連接開啟
    return new Promise(() => {
      // 這個 Promise 永遠不會 resolve，保持 SSE 連接開啟
      // 連接會在客戶端斷開或心跳失敗時自動清理
    })
  })
})

/**
 * 獲取廚房訂單資料
 * GET /api/v1/kitchen/{restaurantId}/orders
 */
app.get('/:restaurantId/orders', authMiddleware, async (c) => {
  const restaurantId = parseInt(c.req.param('restaurantId'))
  const user = c.get('user')
  
  // 驗證權限
  if (user.role !== 2 || user.restaurantId !== restaurantId) {
    return c.json({
      success: false,
      error: 'Access denied'
    }, 403)
  }
  
  try {
    // TODO: 從資料庫獲取訂單資料
    // const orders = await getKitchenOrders(c.env.DB, restaurantId)
    
    // 模擬資料
    const mockOrders = [
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
    
    const stats = {
      pendingCount: mockOrders.filter(o => o.status === 1).length,
      preparingCount: mockOrders.filter(o => o.status === 2).length,
      readyCount: mockOrders.filter(o => o.status === 3).length,
      completedToday: 25,
      averageCookingTime: 18,
      averageWaitingTime: 5,
      efficiency: 92,
      urgentOrders: mockOrders.filter(o => o.priority === 'urgent').length
    }
    
    return c.json({
      success: true,
      data: {
        pending: mockOrders.filter(o => o.status === 1),
        preparing: mockOrders.filter(o => o.status === 2),
        ready: mockOrders.filter(o => o.status === 3),
        stats
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('Failed to fetch kitchen orders:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch orders'
    }, 500)
  }
})

/**
 * 更新訂單項目狀態
 * PUT /api/v1/kitchen/{restaurantId}/orders/{orderId}/items/{itemId}
 */
app.put('/:restaurantId/orders/:orderId/items/:itemId', authMiddleware, async (c) => {
  const restaurantId = parseInt(c.req.param('restaurantId'))
  const orderId = parseInt(c.req.param('orderId'))
  const itemId = parseInt(c.req.param('itemId'))
  const user = c.get('user')
  
  // 驗證權限
  if (user.role !== 2 || user.restaurantId !== restaurantId) {
    return c.json({
      success: false,
      error: 'Access denied'
    }, 403)
  }
  
  try {
    const { status, notes } = await c.req.json()
    
    // TODO: 更新資料庫
    // await updateOrderItemStatus(c.env.DB, orderId, itemId, status, user.id, notes)
    
    console.log(`Order item status updated: Order ${orderId}, Item ${itemId}, Status: ${status}, User: ${user.id}`)
    
    // 廣播狀態更新事件
    const event: KitchenSSEEvent = {
      id: `update_${Date.now()}_${orderId}_${itemId}`,
      event: 'order-update',
      data: {
        type: 'ORDER_STATUS_UPDATE',
        orderId,
        payload: {
          itemId,
          status,
          updatedBy: user.id,
          updatedAt: new Date().toISOString(),
          notes
        },
        timestamp: new Date().toISOString(),
        restaurantId
      }
    }
    
    const sentCount = broadcastToKitchen(restaurantId, event)
    
    return c.json({
      success: true,
      data: {
        orderId,
        itemId,
        status,
        updatedAt: new Date().toISOString(),
        broadcastSent: sentCount
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('Failed to update order item status:', error)
    return c.json({
      success: false,
      error: 'Failed to update order status'
    }, 500)
  }
})

/**
 * 廣播測試端點 (開發用)
 * POST /api/v1/kitchen/{restaurantId}/broadcast-test
 */
app.post('/:restaurantId/broadcast-test', authMiddleware, async (c) => {
  if (c.env.NODE_ENV === 'production') {
    return c.json({
      success: false,
      error: 'Test endpoint not available in production'
    }, 404)
  }
  
  const restaurantId = parseInt(c.req.param('restaurantId'))
  const { type, payload } = await c.req.json()
  
  const testEvent: KitchenSSEEvent = {
    id: `test_${Date.now()}`,
    event: 'test-event',
    data: {
      type: type || 'NEW_ORDER',
      orderId: 999,
      payload: payload || { message: 'Test broadcast event' },
      timestamp: new Date().toISOString(),
      restaurantId
    }
  }
  
  const sentCount = broadcastToKitchen(restaurantId, testEvent)
  
  return c.json({
    success: true,
    message: `Test event broadcasted to ${sentCount} connections`,
    event: testEvent
  })
})

/**
 * 獲取連接狀態
 * GET /api/v1/kitchen/{restaurantId}/connections
 */
app.get('/:restaurantId/connections', authMiddleware, async (c) => {
  const restaurantId = parseInt(c.req.param('restaurantId'))
  const user = c.get('user')
  
  // 只有管理員和同餐廳的廚師可以查看
  if (user.role !== 0 && (user.role !== 2 || user.restaurantId !== restaurantId)) {
    return c.json({
      success: false,
      error: 'Access denied'
    }, 403)
  }
  
  const restaurantConnections = Array.from(connections.entries())
    .filter(([_, conn]) => conn.restaurantId === restaurantId)
    .map(([id, conn]) => ({
      id,
      userId: conn.userId,
      restaurantId: conn.restaurantId,
      lastHeartbeat: new Date(conn.lastHeartbeat).toISOString(),
      connected: Date.now() - conn.lastHeartbeat < 60000 // 1分鐘內視為連接
    }))
  
  return c.json({
    success: true,
    data: {
      totalConnections: connections.size,
      restaurantConnections: restaurantConnections.length,
      connections: restaurantConnections
    },
    timestamp: new Date().toISOString()
  })
})

export default app