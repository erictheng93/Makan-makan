import { ref, onMounted, onUnmounted } from 'vue'
import { useToast, POSITION } from 'vue-toastification'

interface OrderUpdate {
  orderId: string
  status: string
  estimatedTime?: number
  message?: string
}

export function useRealtimeNotifications() {
  const isConnected = ref(false)
  const wsConnection = ref<WebSocket | null>(null)
  const toast = useToast()

  const connect = () => {
    const wsUrl = `${import.meta.env.VITE_REALTIME_WS_URL || 'wss://realtime.makanmakan.com'}/customer`
    
    try {
      wsConnection.value = new WebSocket(wsUrl)
      
      wsConnection.value.onopen = () => {
        isConnected.value = true
        console.log('Connected to realtime service')
      }
      
      wsConnection.value.onmessage = (event) => {
        try {
          const update: OrderUpdate = JSON.parse(event.data)
          handleOrderUpdate(update)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }
      
      wsConnection.value.onclose = () => {
        isConnected.value = false
        console.log('Disconnected from realtime service')
        // Attempt reconnection after 5 seconds
        setTimeout(() => {
          if (!isConnected.value) connect()
        }, 5000)
      }
      
      wsConnection.value.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
      
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error)
    }
  }

  const handleOrderUpdate = (update: OrderUpdate) => {
    const messages = {
      confirmed: '您的訂單已確認！',
      preparing: '廚房正在準備您的餐點',
      ready: '您的餐點已準備完成！',
      delivered: '餐點已送達，請享用！'
    }

    const message = messages[update.status as keyof typeof messages] || update.message
    
    if (message) {
      toast.info(message, {
        position: POSITION.TOP_CENTER,
        timeout: 5000
      })
    }
  }

  const disconnect = () => {
    if (wsConnection.value) {
      wsConnection.value.close()
      wsConnection.value = null
      isConnected.value = false
    }
  }

  onMounted(() => {
    connect()
  })

  onUnmounted(() => {
    disconnect()
  })

  return {
    isConnected,
    connect,
    disconnect
  }
}