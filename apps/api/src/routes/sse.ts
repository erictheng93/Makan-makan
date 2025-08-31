import { Hono } from 'hono'
import { streamSSE, type SSEStreamingApi } from 'hono/streaming'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// SSE 連接管理
const connections = new Map<string, {
  restaurantId: number
  userId: number
  userRole: number
  controller?: SSEStreamingApi
  lastHeartbeat: number
}>()

// 通用 SSE 事件類型
interface SSEEvent {
  id?: string
  event?: string
  data: {
    type: 'order_update' | 'menu_update' | 'system_notification' | 'user_notification' | 'heartbeat'
    payload?: any
    timestamp: string
    restaurantId: number
    targetRoles?: number[] // 限制特定角色接收
  }
}

// 廣播消息到特定餐廳的連接
function broadcastToRestaurant(restaurantId: number, event: SSEEvent, targetRoles?: number[]) {
  let sentCount = 0
  
  for (const [connectionId, connection] of connections.entries()) {
    if (connection.restaurantId === restaurantId && connection.controller) {
      // 如果指定了目標角色，檢查用戶角色
      if (targetRoles && !targetRoles.includes(connection.userRole)) {
        continue
      }
      
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
  
  console.log(`Broadcasted event to ${sentCount} connections for restaurant ${restaurantId}`)
  return sentCount
}

// 格式化 SSE 事件
function formatSSEEvent(event: SSEEvent): string {
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
  return `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
 * 通用 SSE 端點 - 餐廳事件流
 * GET /api/v1/sse/events
 */
app.get('/events', authMiddleware, async (c) => {
  const restaurantId = parseInt(c.req.query('restaurant_id') || '0')
  const user = c.get('user')
  
  // 驗證餐廳權限
  if (user.role !== 0 && user.restaurantId !== restaurantId) {
    return c.json({
      success: false,
      error: 'Access denied. Restaurant permission required.'
    }, 403)
  }
  
  console.log(`SSE connection requested for restaurant ${restaurantId} by user ${user.id} (role: ${user.role})`)
  
  return streamSSE(c, async (stream) => {
    const connectionId = generateConnectionId()
    
    // 註冊連接
    connections.set(connectionId, {
      restaurantId,
      userId: user.id,
      userRole: user.role,
      controller: stream,
      lastHeartbeat: Date.now()
    })
    
    console.log(`SSE connection established: ${connectionId}`)
    
    // 發送初始連接確認
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({
        type: 'heartbeat',
        connectionId,
        timestamp: new Date().toISOString(),
        restaurantId,
        message: 'SSE connected successfully',
        userRole: user.role
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
              type: 'heartbeat',
              timestamp: new Date().toISOString(),
              restaurantId,
              connectionCount: Array.from(connections.values())
                .filter(conn => conn.restaurantId === restaurantId).length,
              payload: {
                userId: user.id,
                userRole: user.role
              }
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
      console.log(`SSE connection closed: ${connectionId}`)
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
 * 廣播訂單更新事件
 * POST /api/v1/sse/broadcast/order-update
 */
app.post('/broadcast/order-update', authMiddleware, async (c) => {
  try {
    const { orderId, orderData, restaurantId, targetRoles } = await c.req.json()
    
    const event: SSEEvent = {
      id: `order_update_${Date.now()}_${orderId}`,
      event: 'order-update',
      data: {
        type: 'order_update',
        payload: {
          orderId,
          order: orderData
        },
        timestamp: new Date().toISOString(),
        restaurantId,
        targetRoles
      }
    }
    
    const sentCount = broadcastToRestaurant(restaurantId, event, targetRoles)
    
    return c.json({
      success: true,
      data: {
        event_type: 'order_update',
        orderId,
        restaurantId,
        broadcast_sent: sentCount,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error: any) {
    console.error('Failed to broadcast order update:', error)
    return c.json({
      success: false,
      error: 'Failed to broadcast order update'
    }, 500)
  }
})

/**
 * 廣播菜單更新事件
 * POST /api/v1/sse/broadcast/menu-update
 */
app.post('/broadcast/menu-update', authMiddleware, async (c) => {
  try {
    const { menuItemId, updateType, restaurantId, targetRoles } = await c.req.json()
    
    const event: SSEEvent = {
      id: `menu_update_${Date.now()}_${menuItemId}`,
      event: 'menu-update',
      data: {
        type: 'menu_update',
        payload: {
          menuItemId,
          updateType, // 'created', 'updated', 'deleted', 'availability_changed'
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString(),
        restaurantId,
        targetRoles
      }
    }
    
    const sentCount = broadcastToRestaurant(restaurantId, event, targetRoles)
    
    return c.json({
      success: true,
      data: {
        event_type: 'menu_update',
        menuItemId,
        updateType,
        restaurantId,
        broadcast_sent: sentCount,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error: any) {
    console.error('Failed to broadcast menu update:', error)
    return c.json({
      success: false,
      error: 'Failed to broadcast menu update'
    }, 500)
  }
})

/**
 * 廣播系統通知
 * POST /api/v1/sse/broadcast/system-notification
 */
app.post('/broadcast/system-notification', authMiddleware, async (c) => {
  try {
    const { title, message, level, persistent, restaurantId, targetRoles } = await c.req.json()
    
    const event: SSEEvent = {
      id: `system_notification_${Date.now()}`,
      event: 'system-notification',
      data: {
        type: 'system_notification',
        payload: {
          title,
          message,
          level, // 'info', 'warning', 'error', 'success'
          persistent,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString(),
        restaurantId,
        targetRoles
      }
    }
    
    const sentCount = broadcastToRestaurant(restaurantId, event, targetRoles)
    
    return c.json({
      success: true,
      data: {
        event_type: 'system_notification',
        title,
        level,
        restaurantId,
        broadcast_sent: sentCount,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error: any) {
    console.error('Failed to broadcast system notification:', error)
    return c.json({
      success: false,
      error: 'Failed to broadcast system notification'
    }, 500)
  }
})

/**
 * 獲取連接狀態
 * GET /api/v1/sse/connections
 */
app.get('/connections', authMiddleware, async (c) => {
  const restaurantId = parseInt(c.req.query('restaurant_id') || '0')
  const user = c.get('user')
  
  // 只有管理員和同餐廳的用戶可以查看
  if (user.role !== 0 && user.restaurantId !== restaurantId) {
    return c.json({
      success: false,
      error: 'Access denied'
    }, 403)
  }
  
  const restaurantConnections = Array.from(connections.entries())
    .filter(([_, conn]) => !restaurantId || conn.restaurantId === restaurantId)
    .map(([id, conn]) => ({
      id,
      userId: conn.userId,
      userRole: conn.userRole,
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

/**
 * 廣播測試端點 (開發用)
 * POST /api/v1/sse/broadcast-test
 */
app.post('/broadcast-test', authMiddleware, async (c) => {
  if (c.env.NODE_ENV === 'production') {
    return c.json({
      success: false,
      error: 'Test endpoint not available in production'
    }, 404)
  }
  
  try {
    const { type, payload, restaurantId, targetRoles } = await c.req.json()
    
    const testEvent: SSEEvent = {
      id: `test_${Date.now()}`,
      event: 'test-event',
      data: {
        type: type || 'system_notification',
        payload: payload || { message: 'Test broadcast event' },
        timestamp: new Date().toISOString(),
        restaurantId: restaurantId || 1,
        targetRoles
      }
    }
    
    const sentCount = broadcastToRestaurant(restaurantId || 1, testEvent, targetRoles)
    
    return c.json({
      success: true,
      message: `Test event broadcasted to ${sentCount} connections`,
      event: testEvent
    })
    
  } catch (error: any) {
    console.error('Test broadcast failed:', error)
    return c.json({
      success: false,
      error: 'Test broadcast failed'
    }, 500)
  }
})

export default app