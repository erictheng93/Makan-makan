import { ref, onMounted, onUnmounted, watch } from 'vue'
import { createKitchenSSE, type KitchenSSEService } from '@/services/sseService'
import { useToast } from 'vue-toastification'
import type { KitchenSSEEvent, ConnectionStatus } from '@/types'

export interface UseKitchenSSEOptions {
  restaurantId: number
  onNewOrder?: (event: KitchenSSEEvent) => void
  onOrderUpdate?: (event: KitchenSSEEvent) => void
  onOrderCancelled?: (event: KitchenSSEEvent) => void
  onPriorityUpdate?: (event: KitchenSSEEvent) => void
  autoConnect?: boolean
}

export function useKitchenSSE(options: UseKitchenSSEOptions) {
  const toast = useToast()
  
  // State
  const connectionStatus = ref<ConnectionStatus>('disconnected')
  const isConnected = ref(false)
  const lastHeartbeat = ref<Date | null>(null)
  const reconnectAttempts = ref(0)
  const connectionStats = ref({
    reconnectAttempts: 0,
    lastHeartbeat: 0,
    isConnected: false,
    timeSinceLastHeartbeat: 0
  })

  // SSE 服務實例
  let sseService: KitchenSSEService | null = null

  /**
   * 處理 SSE 消息
   */
  const handleSSEMessage = (event: KitchenSSEEvent) => {
    console.log('Kitchen SSE event received:', event)

    switch (event.type) {
      case 'NEW_ORDER':
        options.onNewOrder?.(event)
        toast.info('收到新訂單！', {
          position: 'top-right' as any,
          timeout: 5000
        })
        break

      case 'ORDER_STATUS_UPDATE':
        options.onOrderUpdate?.(event)
        break

      case 'ORDER_CANCELLED':
        options.onOrderCancelled?.(event)
        toast.warning('訂單已取消', {
          position: 'top-right' as any,
          timeout: 3000
        })
        break

      case 'PRIORITY_UPDATE':
        options.onPriorityUpdate?.(event)
        toast.warning('訂單優先級已更新', {
          position: 'top-right' as any,
          timeout: 3000
        })
        break

      default:
        console.log('Unknown SSE event type:', event.type)
    }
  }

  /**
   * 處理連接狀態變化
   */
  const handleConnectionChange = (status: ConnectionStatus) => {
    console.log('Kitchen SSE connection status changed:', status)
    connectionStatus.value = status
    isConnected.value = status === 'connected'

    switch (status) {
      case 'connected':
        toast.success('廚房系統已連線', {
          position: 'bottom-right' as any,
          timeout: 2000
        })
        break

      case 'connecting':
        // 不顯示連接中的提示，避免過多通知
        break

      case 'disconnected':
        toast.warning('廚房系統已離線', {
          position: 'bottom-right' as any,
          timeout: 3000
        })
        break

      case 'error':
        toast.error('廚房系統連接異常', {
          position: 'bottom-right' as any,
          timeout: 5000
        })
        break
    }

    // 更新統計資訊
    updateConnectionStats()
  }

  /**
   * 處理 SSE 錯誤
   */
  const handleSSEError = (error: Event) => {
    console.error('Kitchen SSE error:', error)
    // 錯誤處理由連接狀態變化處理，這裡不重複顯示通知
  }

  /**
   * 更新連接統計資訊
   */
  const updateConnectionStats = () => {
    if (sseService) {
      connectionStats.value = sseService.getConnectionStats()
      reconnectAttempts.value = connectionStats.value.reconnectAttempts
      
      if (connectionStats.value.lastHeartbeat > 0) {
        lastHeartbeat.value = new Date(connectionStats.value.lastHeartbeat)
      }
    }
  }

  /**
   * 建立 SSE 連接
   */
  const connect = () => {
    if (sseService) {
      console.warn('SSE service already exists')
      return
    }

    console.log('Creating Kitchen SSE connection...')

    sseService = createKitchenSSE({
      restaurantId: options.restaurantId,
      onMessage: handleSSEMessage,
      onConnectionChange: handleConnectionChange,
      onError: handleSSEError,
      maxReconnectAttempts: 5,
      reconnectInterval: 3000
    })

    sseService.connect()

    // 定期更新統計資訊
    const statsInterval = setInterval(updateConnectionStats, 5000)
    
    // 清理函數
    onUnmounted(() => {
      clearInterval(statsInterval)
    })
  }

  /**
   * 斷開 SSE 連接
   */
  const disconnect = () => {
    if (sseService) {
      sseService.disconnect()
      sseService = null
    }
    
    connectionStatus.value = 'disconnected'
    isConnected.value = false
    reconnectAttempts.value = 0
    lastHeartbeat.value = null
  }

  /**
   * 重新連接
   */
  const reconnect = () => {
    disconnect()
    setTimeout(() => {
      connect()
    }, 1000)
  }

  /**
   * 獲取連接狀態
   */
  const getStatus = () => {
    return sseService?.getConnectionStatus() || 'disconnected'
  }

  /**
   * 獲取連接統計
   */
  const getStats = () => {
    return sseService?.getConnectionStats() || {
      reconnectAttempts: 0,
      lastHeartbeat: 0,
      isConnected: false,
      timeSinceLastHeartbeat: 0
    }
  }

  // 監聽餐廳 ID 變化，重新連接
  watch(() => options.restaurantId, (newRestaurantId, oldRestaurantId) => {
    if (newRestaurantId !== oldRestaurantId && sseService) {
      console.log('Restaurant ID changed, reconnecting SSE...')
      reconnect()
    }
  })

  // 生命週期處理
  onMounted(() => {
    if (options.autoConnect !== false) {
      connect()
    }
  })

  onUnmounted(() => {
    disconnect()
  })

  return {
    // State
    connectionStatus,
    isConnected,
    lastHeartbeat,
    reconnectAttempts,
    connectionStats,

    // Methods
    connect,
    disconnect,
    reconnect,
    getStatus,
    getStats
  }
}