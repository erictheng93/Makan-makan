import { ref, computed, onMounted, onUnmounted } from 'vue'

interface KitchenOrder {
  orderId: string
  tableNumber: string
  items: Array<{
    id: string
    name: string
    quantity: number
    specialInstructions?: string
    category: string
    priority: 'low' | 'medium' | 'high'
  }>
  status: 'pending' | 'preparing' | 'ready'
  orderTime: string
  estimatedTime?: number
  customerNotes?: string
}

interface KitchenNotification {
  type: 'new_order' | 'order_cancel' | 'priority_update'
  order?: KitchenOrder
  orderId?: string
  message?: string
}

export function useRealtimeKitchen() {
  const isConnected = ref(false)
  const wsConnection = ref<WebSocket | null>(null)
  const kitchenOrders = ref<Map<string, KitchenOrder>>(new Map())
  const audioEnabled = ref(true)

  const ordersArray = computed(() => 
    Array.from(kitchenOrders.value.values())
      .sort((a, b) => new Date(a.orderTime).getTime() - new Date(b.orderTime).getTime())
  )

  const preparingOrders = computed(() =>
    ordersArray.value.filter(order => order.status === 'preparing')
  )

  const pendingOrders = computed(() =>
    ordersArray.value.filter(order => order.status === 'pending')
  )

  const readyOrders = computed(() =>
    ordersArray.value.filter(order => order.status === 'ready')
  )

  const connect = (restaurantId: string) => {
    const wsUrl = `${import.meta.env.VITE_REALTIME_WS_URL || 'wss://realtime.makanmakan.com'}/kitchen/${restaurantId}`
    
    try {
      wsConnection.value = new WebSocket(wsUrl)
      
      wsConnection.value.onopen = () => {
        isConnected.value = true
        console.log('Connected to kitchen realtime service')
      }
      
      wsConnection.value.onmessage = (event) => {
        try {
          const notification: KitchenNotification = JSON.parse(event.data)
          handleKitchenNotification(notification)
        } catch (error) {
          console.error('Failed to parse kitchen WebSocket message:', error)
        }
      }
      
      wsConnection.value.onclose = () => {
        isConnected.value = false
        console.log('Disconnected from kitchen realtime service')
        // Auto-reconnect
        setTimeout(() => {
          if (!isConnected.value) connect(restaurantId)
        }, 5000)
      }
      
      wsConnection.value.onerror = (error) => {
        console.error('Kitchen WebSocket error:', error)
      }
      
    } catch (error) {
      console.error('Failed to connect to kitchen WebSocket:', error)
    }
  }

  const handleKitchenNotification = (notification: KitchenNotification) => {
    switch (notification.type) {
      case 'new_order':
        if (notification.order) {
          kitchenOrders.value.set(notification.order.orderId, notification.order)
          playNewOrderSound()
        }
        break
        
      case 'order_cancel':
        if (notification.orderId) {
          kitchenOrders.value.delete(notification.orderId)
        }
        break
        
      case 'priority_update':
        if (notification.order) {
          kitchenOrders.value.set(notification.order.orderId, notification.order)
        }
        break
    }
  }

  const updateOrderStatus = (orderId: string, status: KitchenOrder['status']) => {
    const order = kitchenOrders.value.get(orderId)
    if (order) {
      const updatedOrder = { ...order, status }
      kitchenOrders.value.set(orderId, updatedOrder)
      
      // Send status update to server
      if (wsConnection.value && wsConnection.value.readyState === WebSocket.OPEN) {
        wsConnection.value.send(JSON.stringify({
          type: 'status_update',
          orderId,
          status
        }))
      }

      // Remove completed orders after delay
      if (status === 'ready') {
        setTimeout(() => {
          kitchenOrders.value.delete(orderId)
        }, 300000) // 5 minutes
      }
    }
  }

  const markItemComplete = (orderId: string, itemId: string) => {
    const order = kitchenOrders.value.get(orderId)
    if (order) {
      const updatedItems = order.items.map(item => 
        item.id === itemId ? { ...item, completed: true } : item
      )
      
      const updatedOrder = { ...order, items: updatedItems }
      kitchenOrders.value.set(orderId, updatedOrder)
      
      // Check if all items are complete
      const allComplete = updatedItems.every(item => (item as any).completed)
      if (allComplete) {
        updateOrderStatus(orderId, 'ready')
      }
    }
  }

  const playNewOrderSound = () => {
    if (audioEnabled.value) {
      const audio = new Audio('/kitchen-bell.mp3')
      audio.play().catch(e => console.log('Could not play kitchen sound:', e))
    }
  }

  const toggleAudio = () => {
    audioEnabled.value = !audioEnabled.value
    localStorage.setItem('kitchen-audio-enabled', audioEnabled.value.toString())
  }

  const disconnect = () => {
    if (wsConnection.value) {
      wsConnection.value.close()
      wsConnection.value = null
      isConnected.value = false
    }
  }

  onMounted(() => {
    // Restore audio preference
    const savedAudioPref = localStorage.getItem('kitchen-audio-enabled')
    if (savedAudioPref !== null) {
      audioEnabled.value = savedAudioPref === 'true'
    }
  })

  onUnmounted(() => {
    disconnect()
  })

  return {
    isConnected,
    ordersArray,
    preparingOrders,
    pendingOrders,
    readyOrders,
    audioEnabled,
    connect,
    disconnect,
    updateOrderStatus,
    markItemComplete,
    toggleAudio
  }
}