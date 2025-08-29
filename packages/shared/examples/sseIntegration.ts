/**
 * Example: SSE Integration in Kitchen View
 * 
 * This file demonstrates how to integrate the SSE connection pool
 * and composables into a Vue component for real-time updates.
 */

import { ref, onMounted, computed, watch } from 'vue'
import { useKitchenSSE } from '../composables/useSSE'
import { sseConnectionPool } from '../services/sseConnectionPool'

// Example: Kitchen View Component with SSE Integration
export function useKitchenViewWithSSE(restaurantId: string) {
  // Local state for orders
  const orders = ref([])
  const notifications = ref([])
  const kitchenStats = ref({
    pendingOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    averagePrepTime: 0
  })

  // SSE connection for real-time updates
  const {
    isConnected,
    status,
    error,
    latestOrderUpdate,
    latestNewOrder,
    latestCancelledOrder,
    connect,
    disconnect
  } = useKitchenSSE(restaurantId)

  // Connection status indicator
  const connectionStatus = computed(() => ({
    connected: isConnected.value,
    status: status.value,
    error: error.value,
    color: isConnected.value ? 'green' : error.value ? 'red' : 'yellow',
    text: isConnected.value ? '已連接' : error.value ? '連接錯誤' : '連接中...'
  }))

  /**
   * Handle new order notifications
   */
  watch(latestNewOrder, (newOrderMessage) => {
    if (!newOrderMessage) return

    const order = newOrderMessage.data
    
    // Add to orders list
    orders.value.unshift(order)
    
    // Add notification
    notifications.value.push({
      id: Date.now(),
      type: 'new-order',
      title: '新訂單',
      message: `桌號 ${order.tableNumber} - ${order.orderNumber}`,
      timestamp: Date.now(),
      order
    })

    // Play notification sound
    playNotificationSound('new-order')
    
    // Update stats
    updateKitchenStats()

    console.log('New order received:', order)
  })

  /**
   * Handle order status updates
   */
  watch(latestOrderUpdate, (updateMessage) => {
    if (!updateMessage) return

    const { orderId, status, updatedBy, timestamp } = updateMessage.data
    
    // Find and update order in local state
    const orderIndex = orders.value.findIndex(order => order.id === orderId)
    if (orderIndex !== -1) {
      orders.value[orderIndex] = {
        ...orders.value[orderIndex],
        status,
        updatedAt: timestamp,
        updatedBy
      }

      // Add status change notification
      notifications.value.push({
        id: Date.now(),
        type: 'status-update',
        title: '訂單狀態更新',
        message: `訂單 ${orders.value[orderIndex].orderNumber} 更新為 ${getStatusText(status)}`,
        timestamp: Date.now(),
        order: orders.value[orderIndex]
      })

      // Play appropriate sound based on status
      if (status === 'ready') {
        playNotificationSound('order-ready')
      } else {
        playNotificationSound('status-update')
      }

      updateKitchenStats()
    }

    console.log('Order status updated:', { orderId, status })
  })

  /**
   * Handle cancelled orders
   */
  watch(latestCancelledOrder, (cancelMessage) => {
    if (!cancelMessage) return

    const { orderId, reason, timestamp } = cancelMessage.data
    
    // Remove from orders list
    const orderIndex = orders.value.findIndex(order => order.id === orderId)
    if (orderIndex !== -1) {
      const order = orders.value[orderIndex]
      orders.value.splice(orderIndex, 1)

      // Add cancellation notification
      notifications.value.push({
        id: Date.now(),
        type: 'order-cancelled',
        title: '訂單取消',
        message: `訂單 ${order.orderNumber} 已取消 - ${reason || '無原因'}`,
        timestamp: Date.now(),
        order
      })

      playNotificationSound('order-cancelled')
      updateKitchenStats()
    }

    console.log('Order cancelled:', { orderId, reason })
  })

  /**
   * Update kitchen statistics
   */
  const updateKitchenStats = () => {
    const pending = orders.value.filter(o => o.status === 'pending').length
    const preparing = orders.value.filter(o => ['confirmed', 'preparing'].includes(o.status)).length
    const ready = orders.value.filter(o => o.status === 'ready').length

    kitchenStats.value = {
      pendingOrders: pending,
      preparingOrders: preparing,
      readyOrders: ready,
      averagePrepTime: calculateAveragePreparationTime()
    }
  }

  /**
   * Calculate average preparation time
   */
  const calculateAveragePreparationTime = () => {
    const completedOrders = orders.value.filter(o => 
      ['ready', 'served', 'completed'].includes(o.status) && 
      o.prepTimeMinutes
    )

    if (completedOrders.length === 0) return 0

    const totalTime = completedOrders.reduce((sum, order) => sum + order.prepTimeMinutes, 0)
    return Math.round(totalTime / completedOrders.length)
  }

  /**
   * Get status text in Chinese
   */
  const getStatusText = (status: string) => {
    const statusMap = {
      'pending': '待確認',
      'confirmed': '已確認',
      'preparing': '製作中',
      'ready': '待取餐',
      'served': '已送達',
      'completed': '已完成',
      'cancelled': '已取消'
    }
    return statusMap[status] || status
  }

  /**
   * Play notification sound
   */
  const playNotificationSound = (type: string) => {
    const soundMap = {
      'new-order': '/sounds/new-order.mp3',
      'order-ready': '/sounds/order-ready.mp3',
      'status-update': '/sounds/status-update.mp3',
      'order-cancelled': '/sounds/order-cancelled.mp3'
    }

    const soundUrl = soundMap[type]
    if (soundUrl) {
      const audio = new Audio(soundUrl)
      audio.volume = 0.7
      audio.play().catch(error => {
        console.warn('Could not play notification sound:', error)
      })
    }
  }

  /**
   * Mark order as confirmed
   */
  const confirmOrder = async (orderId: string) => {
    try {
      const response = await fetch(`/api/v1/kitchen/orders/${orderId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to confirm order')
      }

      // The SSE will handle the status update automatically
      console.log('Order confirmed:', orderId)
    } catch (error) {
      console.error('Error confirming order:', error)
      // Show error notification
      notifications.value.push({
        id: Date.now(),
        type: 'error',
        title: '操作失敗',
        message: '確認訂單失敗，請重試',
        timestamp: Date.now()
      })
    }
  }

  /**
   * Mark order as ready
   */
  const markOrderReady = async (orderId: string) => {
    try {
      const response = await fetch(`/api/v1/kitchen/orders/${orderId}/ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to mark order as ready')
      }

      console.log('Order marked as ready:', orderId)
    } catch (error) {
      console.error('Error marking order as ready:', error)
      notifications.value.push({
        id: Date.now(),
        type: 'error',
        title: '操作失敗',
        message: '標記訂單完成失敗，請重試',
        timestamp: Date.now()
      })
    }
  }

  /**
   * Clear old notifications
   */
  const clearOldNotifications = () => {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)
    notifications.value = notifications.value.filter(n => n.timestamp > fiveMinutesAgo)
  }

  /**
   * Get authentication token
   */
  const getAuthToken = () => {
    return localStorage.getItem('auth_token') || ''
  }

  /**
   * Initialize kitchen view
   */
  const initialize = async () => {
    try {
      // Load initial orders
      const response = await fetch(`/api/v1/kitchen/${restaurantId}/orders`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        orders.value = data.orders || []
        updateKitchenStats()
      }

      // Connect to SSE
      await connect()

      // Start cleanup interval for notifications
      setInterval(clearOldNotifications, 60000) // Every minute

    } catch (error) {
      console.error('Failed to initialize kitchen view:', error)
    }
  }

  // Auto-initialize on mount
  onMounted(() => {
    initialize()
  })

  return {
    // State
    orders: computed(() => orders.value),
    notifications: computed(() => notifications.value),
    kitchenStats: computed(() => kitchenStats.value),
    connectionStatus,

    // SSE state
    isConnected,
    status,
    error,

    // Actions
    confirmOrder,
    markOrderReady,
    connect,
    disconnect,
    initialize,

    // Utilities
    getStatusText,
    clearOldNotifications
  }
}

/**
 * Example: Connection Pool Monitoring Component
 */
export function useSSEConnectionMonitor() {
  const poolStats = ref({
    totalConnections: 0,
    activeConnections: 0,
    failedConnections: 0,
    totalMessagesReceived: 0,
    averageLatency: 0,
    uptime: 0
  })

  const connections = ref([])

  const updateStats = () => {
    poolStats.value = sseConnectionPool.getStats()
    connections.value = sseConnectionPool.getAllConnections()
  }

  // Update stats every 5 seconds
  const statsInterval = setInterval(updateStats, 5000)

  onMounted(() => {
    updateStats()
  })

  const cleanup = () => {
    clearInterval(statsInterval)
  }

  return {
    poolStats: computed(() => poolStats.value),
    connections: computed(() => connections.value),
    updateStats,
    cleanup
  }
}

/**
 * Example: Global SSE Error Handler
 */
export function useGlobalSSEErrorHandler() {
  const errors = ref([])

  const handleError = (event: any) => {
    const { connectionId, error, timestamp } = event.detail
    
    errors.value.push({
      id: Date.now(),
      connectionId,
      error: error?.message || 'Unknown error',
      timestamp,
      resolved: false
    })

    // Show toast notification
    console.error(`SSE Error on connection ${connectionId}:`, error)
    
    // Could integrate with toast notification system here
  }

  const markErrorResolved = (errorId: string) => {
    const error = errors.value.find(e => e.id === errorId)
    if (error) {
      error.resolved = true
    }
  }

  const clearResolvedErrors = () => {
    errors.value = errors.value.filter(e => !e.resolved)
  }

  onMounted(() => {
    sseConnectionPool.on('connection', (event) => {
      if (event.detail.eventType === 'error') {
        handleError(event)
      }
    })
  })

  return {
    errors: computed(() => errors.value),
    unresolvedErrors: computed(() => errors.value.filter(e => !e.resolved)),
    markErrorResolved,
    clearResolvedErrors
  }
}

export default {
  useKitchenViewWithSSE,
  useSSEConnectionMonitor,
  useGlobalSSEErrorHandler
}