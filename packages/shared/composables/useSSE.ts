import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { sseConnectionPool } from '../services/sseConnectionPool'
import type { SSEConnectionOptions } from '../services/sseConnectionPool'

export interface UseSSEOptions extends Omit<SSEConnectionOptions, 'url'> {
  immediate?: boolean
  onConnected?: () => void
  onError?: (error: any) => void
  onDisconnected?: () => void
  onReconnecting?: () => void
}

export interface SSEMessage<T = any> {
  eventType: string
  data: T
  timestamp: number
  raw: MessageEvent
}

/**
 * Vue composable for Server-Sent Events with connection pooling
 */
export function useSSE<T = any>(
  url: string,
  options: UseSSEOptions = {}
) {
  const {
    immediate = true,
    events = ['message'],
    onConnected,
    onError,
    onDisconnected,
    onReconnecting,
    ...sseOptions
  } = options

  // Reactive state
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const isReconnecting = ref(false)
  const error = ref<string | null>(null)
  const lastMessage = ref<SSEMessage<T> | null>(null)
  const messages = ref<SSEMessage<T>[]>([])
  const connectionStats = ref({
    messagesReceived: 0,
    reconnectCount: 0,
    totalDowntime: 0,
    uptime: 0
  })

  // Generate unique connection ID
  const connectionId = `sse_${Math.random().toString(36).substr(2, 9)}`

  // Event listeners
  const listeners = new Map<string, EventListener>()

  // Connection management
  let connection: any = null

  /**
   * Connect to SSE
   */
  const connect = async () => {
    if (isConnected.value || isConnecting.value) {
      return
    }

    isConnecting.value = true
    error.value = null

    try {
      connection = await sseConnectionPool.connect(connectionId, {
        url,
        events,
        ...sseOptions
      })

      // Setup event listeners
      events.forEach(eventType => {
        const listener: EventListener = (event: any) => {
          const message: SSEMessage<T> = {
            eventType,
            data: event.parsedData || event.data,
            timestamp: Date.now(),
            raw: event
          }

          lastMessage.value = message
          messages.value.push(message)

          // Keep only last 100 messages to prevent memory leaks
          if (messages.value.length > 100) {
            messages.value.shift()
          }

          // Update stats
          connectionStats.value.messagesReceived++
        }

        listeners.set(eventType, listener)
        sseConnectionPool.addEventListener(connectionId, eventType, listener)
      })

      isConnecting.value = false
      isConnected.value = true
      onConnected?.()
    } catch (err) {
      isConnecting.value = false
      error.value = err instanceof Error ? err.message : String(err)
      onError?.(err)
    }
  }

  /**
   * Disconnect from SSE
   */
  const disconnect = () => {
    if (!connection) return

    // Remove event listeners
    listeners.forEach((listener, eventType) => {
      sseConnectionPool.removeEventListener(connectionId, eventType, listener)
    })
    listeners.clear()

    // Disconnect from pool
    sseConnectionPool.disconnect(connectionId)

    isConnected.value = false
    isConnecting.value = false
    isReconnecting.value = false
    connection = null

    onDisconnected?.()
  }

  /**
   * Clear message history
   */
  const clearMessages = () => {
    messages.value = []
    lastMessage.value = null
  }

  /**
   * Get messages by event type
   */
  const getMessagesByType = (eventType: string) => {
    return computed(() => messages.value.filter(msg => msg.eventType === eventType))
  }

  /**
   * Get latest message by event type
   */
  const getLatestMessage = (eventType: string) => {
    return computed(() => {
      const typeMessages = messages.value.filter(msg => msg.eventType === eventType)
      return typeMessages.length > 0 ? typeMessages[typeMessages.length - 1] : null
    })
  }

  /**
   * Add custom event listener
   */
  const addEventListener = (eventType: string, callback: (data: T) => void) => {
    if (!events.includes(eventType)) {
      events.push(eventType)
      
      // If already connected, add listener immediately
      if (isConnected.value) {
        const listener: EventListener = (event: any) => {
          callback(event.parsedData || event.data)
        }
        listeners.set(eventType, listener)
        sseConnectionPool.addEventListener(connectionId, eventType, listener)
      }
    }

    // Watch for messages of this type
    watch(
      () => getLatestMessage(eventType).value,
      (message) => {
        if (message) {
          callback(message.data)
        }
      }
    )
  }

  /**
   * Send message (for bi-directional SSE if supported)
   */
  const sendMessage = (data: any, eventType = 'message') => {
    // This would require WebSocket or similar for bi-directional communication
    // SSE is unidirectional from server to client
    console.warn('SSE is unidirectional. Use WebSocket for bi-directional communication.')
  }

  // Setup connection pool event listeners
  const setupConnectionPoolListeners = () => {
    const connectionListener: EventListener = (event: any) => {
      const { connectionId: eventConnectionId, eventType, status } = event.detail

      if (eventConnectionId !== connectionId) return

      switch (eventType) {
        case 'connected':
          isConnected.value = true
          isConnecting.value = false
          isReconnecting.value = false
          error.value = null
          break

        case 'error':
          isConnected.value = false
          isReconnecting.value = false
          error.value = 'Connection error'
          onError?.(event.detail.data?.error)
          break

        case 'disconnected':
          isConnected.value = false
          isConnecting.value = false
          isReconnecting.value = false
          onDisconnected?.()
          break

        case 'failed':
          isConnected.value = false
          isConnecting.value = false
          isReconnecting.value = false
          error.value = 'Connection failed'
          onError?.(event.detail.data?.error)
          break
      }

      // Handle reconnection status
      if (status === 'reconnecting') {
        isReconnecting.value = true
        onReconnecting?.()
      }
    }

    sseConnectionPool.on('connection', connectionListener)

    // Store listener for cleanup
    listeners.set('_connectionListener', connectionListener)
  }

  // Computed values
  const status = computed(() => {
    if (isConnected.value) return 'connected'
    if (isReconnecting.value) return 'reconnecting'
    if (isConnecting.value) return 'connecting'
    if (error.value) return 'error'
    return 'disconnected'
  })

  const hasError = computed(() => !!error.value)

  // Lifecycle hooks
  onMounted(() => {
    setupConnectionPoolListeners()

    if (immediate) {
      connect()
    }

    // Update connection stats periodically
    const statsInterval = setInterval(() => {
      const conn = sseConnectionPool.getConnection(connectionId)
      if (conn) {
        connectionStats.value = {
          messagesReceived: conn.statistics.messagesReceived,
          reconnectCount: conn.statistics.reconnectCount,
          totalDowntime: conn.statistics.totalDowntime,
          uptime: conn.connectionTime ? Date.now() - conn.connectionTime : 0
        }
      }
    }, 5000)

    // Cleanup interval on unmount
    onUnmounted(() => {
      clearInterval(statsInterval)
    })
  })

  onUnmounted(() => {
    disconnect()

    // Remove connection pool listeners
    const connectionListener = listeners.get('_connectionListener')
    if (connectionListener) {
      sseConnectionPool.off('connection', connectionListener)
    }
  })

  // Return reactive state and methods
  return {
    // State
    isConnected: computed(() => isConnected.value),
    isConnecting: computed(() => isConnecting.value),
    isReconnecting: computed(() => isReconnecting.value),
    status,
    error: computed(() => error.value),
    hasError,
    lastMessage: computed(() => lastMessage.value),
    messages: computed(() => messages.value),
    connectionStats: computed(() => connectionStats.value),

    // Methods
    connect,
    disconnect,
    clearMessages,
    addEventListener,
    sendMessage,
    getMessagesByType,
    getLatestMessage
  }
}

/**
 * Composable for kitchen order updates
 */
export function useKitchenSSE(restaurantId: string) {
  const {
    isConnected,
    lastMessage,
    messages,
    status,
    error,
    connect,
    disconnect,
    getLatestMessage
  } = useSSE(`/api/v1/kitchen/${restaurantId}/stream`, {
    events: ['order-new', 'order-updated', 'order-cancelled'],
    retry: {
      maxAttempts: 10,
      baseDelay: 2000,
      exponentialBackoff: true
    },
    heartbeat: {
      enabled: true,
      interval: 30000
    }
  })

  // Typed message getters
  const latestOrderUpdate = getLatestMessage('order-updated')
  const latestNewOrder = getLatestMessage('order-new')
  const latestCancelledOrder = getLatestMessage('order-cancelled')

  return {
    isConnected,
    status,
    error,
    lastMessage,
    messages,
    latestOrderUpdate,
    latestNewOrder,
    latestCancelledOrder,
    connect,
    disconnect
  }
}

/**
 * Composable for admin dashboard updates
 */
export function useAdminSSE(restaurantId: string) {
  return useSSE(`/api/v1/admin/${restaurantId}/stream`, {
    events: ['order-stats', 'revenue-update', 'table-status', 'system-alert'],
    retry: {
      maxAttempts: 5,
      baseDelay: 3000
    }
  })
}

/**
 * Composable for customer order tracking
 */
export function useOrderTrackingSSE(orderId: string) {
  return useSSE(`/api/v1/orders/${orderId}/stream`, {
    events: ['status-update', 'estimated-time', 'ready-notification'],
    retry: {
      maxAttempts: 3,
      baseDelay: 1000
    }
  })
}

export default useSSE