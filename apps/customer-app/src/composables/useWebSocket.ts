import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { WebSocketMessage } from '@makanmakan/shared-types'

interface UseWebSocketOptions {
  url?: string
  protocols?: string | string[]
  reconnectAttempts?: number
  reconnectInterval?: number
  heartbeatInterval?: number
  restaurantId?: number
  onMessage?: (data: any) => void
  onError?: (error: Event) => void
  onOpen?: (event: Event) => void
  onClose?: (event: CloseEvent) => void
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = '',
    protocols,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    heartbeatInterval = 30000,
    onMessage,
    onError,
    onOpen,
    onClose
  } = options

  // State
  const ws = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const lastError = ref<Event | null>(null)
  const reconnectCount = ref(0)
  
  // Connection status computed
  const connectionStatus = ref<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')

  // Timers
  let reconnectTimer: NodeJS.Timeout | null = null
  let heartbeatTimer: NodeJS.Timeout | null = null

  /**
   * 建立 WebSocket 連接
   */
  const connect = (wsUrl?: string) => {
    if (ws.value?.readyState === WebSocket.CONNECTING || 
        ws.value?.readyState === WebSocket.OPEN) {
      return
    }

    const targetUrl = wsUrl || url
    if (!targetUrl) {
      console.error('WebSocket URL is required')
      return
    }

    isConnecting.value = true
    lastError.value = null

    try {
      ws.value = new WebSocket(targetUrl, protocols)

      ws.value.onopen = (event) => {
        isConnected.value = true
        isConnecting.value = false
        reconnectCount.value = 0
        
        // 開始心跳檢測
        startHeartbeat()
        
        onOpen?.(event)
        console.log('WebSocket connected')
      }

      ws.value.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage
          
          // 處理心跳響應
          if (data.type === 'pong') {
            return
          }
          
          onMessage?.(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.value.onclose = (event) => {
        isConnected.value = false
        isConnecting.value = false
        
        // 停止心跳
        stopHeartbeat()
        
        onClose?.(event)
        
        // 如果不是主動關閉且還有重連次數，則嘗試重連
        if (!event.wasClean && reconnectCount.value < reconnectAttempts) {
          scheduleReconnect()
        }
        
        console.log('WebSocket disconnected', event)
      }

      ws.value.onerror = (event) => {
        lastError.value = event
        isConnecting.value = false
        
        onError?.(event)
        console.error('WebSocket error:', event)
      }

    } catch (error) {
      isConnecting.value = false
      console.error('Failed to create WebSocket connection:', error)
    }
  }

  /**
   * 斷開連接
   */
  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    
    stopHeartbeat()
    
    if (ws.value) {
      ws.value.close(1000, 'Manual disconnect')
      ws.value = null
    }
    
    isConnected.value = false
    isConnecting.value = false
    reconnectCount.value = 0
  }

  /**
   * 發送消息
   */
  const send = (data: any) => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected')
      return false
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data)
      ws.value.send(message)
      return true
    } catch (error) {
      console.error('Failed to send WebSocket message:', error)
      return false
    }
  }

  /**
   * 發送訂閱消息
   */
  const subscribe = (channel: string, data?: any) => {
    return send({
      type: 'subscribe',
      channel,
      data
    })
  }

  /**
   * 發送取消訂閱消息
   */
  const unsubscribe = (channel: string) => {
    return send({
      type: 'unsubscribe',
      channel
    })
  }

  /**
   * 安排重連
   */
  const scheduleReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }

    reconnectCount.value++
    console.log(`Scheduling reconnect attempt ${reconnectCount.value}/${reconnectAttempts}`)

    reconnectTimer = setTimeout(() => {
      connect()
    }, reconnectInterval)
  }

  /**
   * 開始心跳檢測
   */
  const startHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
    }

    heartbeatTimer = setInterval(() => {
      if (ws.value?.readyState === WebSocket.OPEN) {
        send({ type: 'ping' })
      }
    }, heartbeatInterval)
  }

  /**
   * 停止心跳檢測
   */
  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  /**
   * 手動重連
   */
  const reconnect = () => {
    disconnect()
    reconnectCount.value = 0
    connect()
  }

  // 監聽連接狀態變化
  watch(isConnected, (connected) => {
    if (connected) {
      console.log('WebSocket connection established')
    } else {
      console.log('WebSocket connection lost')
    }
  })

  // 組件卸載時清理
  onUnmounted(() => {
    disconnect()
  })

  return {
    // State
    ws,
    isConnected,
    isConnecting,
    lastError,
    reconnectCount,
    connectionStatus,

    // Methods
    connect,
    disconnect,
    reconnect,
    send,
    subscribe,
    unsubscribe
  }
}

/**
 * 訂單追蹤 WebSocket Hook
 */
export function useOrderTracking(orderId: number) {
  const orderUpdates = ref<any[]>([])
  const currentStatus = ref<string>('')

  const { 
    isConnected, 
    isConnecting, 
    connect, 
    disconnect, 
    subscribe, 
    unsubscribe 
  } = useWebSocket({
    url: `${import.meta.env.VITE_WS_BASE_URL}/orders/${orderId}/tracking`,
    onMessage: (data: WebSocketMessage) => {
      if (data.type === 'order_update' && data.data) {
        orderUpdates.value.push(data.data)
        if (data.data.status !== undefined) {
          currentStatus.value = String(data.data.status)
        }
      }
    },
    onOpen: () => {
      // 訂閱訂單更新
      subscribe(`order:${orderId}`)
    }
  })

  onMounted(() => {
    if (orderId) {
      connect()
    }
  })

  onUnmounted(() => {
    if (orderId) {
      unsubscribe(`order:${orderId}`)
      disconnect()
    }
  })

  return {
    orderUpdates,
    currentStatus,
    isConnected,
    isConnecting,
    reconnect: () => connect()
  }
}

/**
 * 餐廳狀態 WebSocket Hook
 */
export function useRestaurantStatus(restaurantId: number, tableId?: number) {
  const restaurantStatus = ref<any>({})
  const notifications = ref<any[]>([])

  const { 
    isConnected, 
    isConnecting, 
    connect, 
    disconnect, 
    subscribe, 
    unsubscribe 
  } = useWebSocket({
    url: `${import.meta.env.VITE_WS_BASE_URL}/restaurants/${restaurantId}/status`,
    onMessage: (data: WebSocketMessage) => {
      switch (data.type) {
        case 'restaurant_status_update':
          restaurantStatus.value = { ...restaurantStatus.value, ...data.data }
          break
        case 'notification':
          notifications.value.push(data.data)
          break
        case 'menu_update':
          // 處理菜單更新
          break
      }
    },
    onOpen: () => {
      // 訂閱餐廳狀態
      subscribe(`restaurant:${restaurantId}`)
      if (tableId) {
        subscribe(`table:${restaurantId}:${tableId}`)
      }
    }
  })

  const clearNotification = (index: number) => {
    notifications.value.splice(index, 1)
  }

  onMounted(() => {
    if (restaurantId) {
      connect()
    }
  })

  onUnmounted(() => {
    unsubscribe(`restaurant:${restaurantId}`)
    if (tableId) {
      unsubscribe(`table:${restaurantId}:${tableId}`)
    }
    disconnect()
  })

  return {
    restaurantStatus,
    notifications,
    isConnected,
    isConnecting,
    clearNotification,
    reconnect: () => connect()
  }
}

export default useWebSocket