/**
 * Kitchen Display Real-time Composable
 * 廚房顯示系統的實時功能整合
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useWebSocketService } from '@/services/websocketService'
import { useAuthStore } from '@/stores/auth'
import {
  RealtimeEventType,
  type NewOrderEvent,
  type OrderStatusUpdateEvent,
  type OrderItemStatusUpdateEvent,
  type OrderCancelledEvent,
  type KitchenItemStatusEvent,
  type KitchenQueueUpdateEvent,
  OrderStatus,
  OrderItemStatus,
} from '@makanmakan/shared-types'

// ============================================================================
// 類型定義
// ============================================================================

export interface KitchenOrder {
  orderId: number
  orderNumber: string
  tableId?: string
  tableName?: string
  items: KitchenOrderItem[]
  status: OrderStatus
  totalAmount: number
  notes?: string
  createdAt: number
  estimatedTime?: number
}

export interface KitchenOrderItem {
  orderItemId: number
  menuItemId: number
  menuItemName: string
  quantity: number
  status: 'pending' | 'cooking' | 'ready' | 'served'
  notes?: string
  priority?: 'normal' | 'high' | 'urgent'
  waitingTime?: number // 等待時間（分鐘）
}

export interface KitchenQueueStats {
  pendingCount: number
  cookingCount: number
  readyCount: number
  averageWaitTime: number
  oldestPendingMinutes?: number
  lastUpdated: number
}

// ============================================================================
// Composable 主體
// ============================================================================

export function useKitchenRealtime() {
  const wsService = useWebSocketService({
    maxReconnectAttempts: 5,
    reconnectDelay: 2000,
    heartbeatInterval: 20000,
    heartbeatTimeout: 8000,
  })

  const authStore = useAuthStore()

  // ========================================
  // 響應式狀態
  // ========================================

  const isConnected = computed(() => wsService.isConnected.value)
  const connectionStatus = computed(() => wsService.status.value)

  // 廚房訂單隊列
  const kitchenOrders = ref<KitchenOrder[]>([])

  // 待處理、烹飪中、已完成的訂單
  const pendingOrders = computed(() =>
    kitchenOrders.value.filter((o) => o.status === OrderStatus.PENDING || o.status === OrderStatus.CONFIRMED)
  )
  const cookingOrders = computed(() =>
    kitchenOrders.value.filter((o) => o.status === OrderStatus.PREPARING)
  )
  const readyOrders = computed(() =>
    kitchenOrders.value.filter((o) => o.status === OrderStatus.READY)
  )

  // 隊列統計
  const queueStats = ref<KitchenQueueStats>({
    pendingCount: 0,
    cookingCount: 0,
    readyCount: 0,
    averageWaitTime: 0,
    oldestPendingMinutes: 0,
    lastUpdated: Date.now(),
  })

  // 音效和警示
  const soundEnabled = ref(true)
  const notificationSound = ref<HTMLAudioElement | null>(null)
  const urgentSound = ref<HTMLAudioElement | null>(null)

  // 訂閱 ID
  const subscriptionIds = ref<string[]>([])

  // ========================================
  // 事件處理函數
  // ========================================

  /**
   * 處理新訂單
   */
  const handleNewOrder = (event: NewOrderEvent) => {
    const { orderId, orderNumber, tableId, tableName, items, totalAmount, notes } =
      event.data

    const order: KitchenOrder = {
      orderId,
      orderNumber,
      tableId,
      tableName,
      items: items.map((item) => ({
        orderItemId: item.orderItemId,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItemName,
        quantity: item.quantity,
        status: 'pending',
        notes: item.notes,
        priority: 'normal',
        waitingTime: 0,
      })),
      status: OrderStatus.PENDING,
      totalAmount,
      notes,
      createdAt: event.timestamp,
    }

    kitchenOrders.value.unshift(order)

    // 播放新訂單音效
    playNotificationSound()

    console.log('🆕 New kitchen order:', order)
  }

  /**
   * 處理訂單狀態更新
   */
  const handleOrderStatusUpdate = (event: OrderStatusUpdateEvent) => {
    const { orderId, status, previousStatus, estimatedTime } = event.data

    const order = kitchenOrders.value.find((o) => o.orderId === orderId)
    if (order) {
      order.status = status
      order.estimatedTime = estimatedTime

      console.log(
        `📦 Kitchen order ${orderId} status: ${previousStatus} → ${status}`
      )

      // 如果訂單已完成，移除它
      if (status === OrderStatus.DELIVERED || status === OrderStatus.CANCELLED) {
        kitchenOrders.value = kitchenOrders.value.filter(
          (o) => o.orderId !== orderId
        )
      }
    }
  }

  /**
   * 處理訂單項目狀態更新
   */
  const handleOrderItemStatusUpdate = (event: OrderItemStatusUpdateEvent) => {
    const { orderId, orderItemId, status, previousStatus } = event.data

    const order = kitchenOrders.value.find((o) => o.orderId === orderId)
    if (order) {
      const item = order.items.find((i) => i.orderItemId === orderItemId)
      if (item) {
        // Map OrderItemStatus enum to string literals
        const statusMap: Record<OrderItemStatus, 'pending' | 'cooking' | 'ready' | 'served'> = {
          [OrderItemStatus.PENDING]: 'pending',
          [OrderItemStatus.PREPARING]: 'cooking',
          [OrderItemStatus.READY]: 'ready',
          [OrderItemStatus.DELIVERED]: 'served',
        }
        item.status = statusMap[status] || 'pending'

        console.log(
          `🍳 Order item ${orderItemId} status: ${previousStatus} → ${status}`
        )

        // 如果項目完成，播放音效
        if (status === OrderItemStatus.READY) {
          playNotificationSound()
        }
      }
    }
  }

  /**
   * 處理廚房項目狀態
   */
  const handleKitchenItemStatus = (event: KitchenItemStatusEvent) => {
    const {
      orderId,
      orderItemId,
      status,
      priority,
      waitingTime,
    } = event.data

    const order = kitchenOrders.value.find((o) => o.orderId === orderId)
    if (order) {
      const item = order.items.find((i) => i.orderItemId === orderItemId)
      if (item) {
        item.status = status
        item.priority = priority || 'normal'
        item.waitingTime = waitingTime || 0

        // 如果是緊急項目，播放警示音
        if (priority === 'urgent') {
          playUrgentSound()
        }
      }
    }

    console.log('👨‍🍳 Kitchen item status:', event.data)
  }

  /**
   * 處理廚房隊列更新
   */
  const handleKitchenQueueUpdate = (event: KitchenQueueUpdateEvent) => {
    const {
      pendingCount,
      cookingCount,
      readyCount,
      averageWaitTime,
      oldestPendingMinutes,
    } = event.data

    queueStats.value = {
      pendingCount: pendingCount || 0,
      cookingCount: cookingCount || 0,
      readyCount: readyCount || 0,
      averageWaitTime: averageWaitTime || 0,
      oldestPendingMinutes: oldestPendingMinutes || 0,
      lastUpdated: Date.now(),
    }

    console.log('📊 Kitchen queue updated:', queueStats.value)

    // 如果平均等待時間過長，播放警示
    if (averageWaitTime > 30) {
      playUrgentSound()
    }
  }

  /**
   * 處理訂單取消
   */
  const handleOrderCancelled = (event: OrderCancelledEvent) => {
    const { orderId, reason } = event.data

    kitchenOrders.value = kitchenOrders.value.filter(
      (o) => o.orderId !== orderId
    )

    console.log(`❌ Order ${orderId} cancelled:`, reason)
  }

  // ========================================
  // 訂單操作方法
  // ========================================

  /**
   * 更新訂單項目狀態（通過 API）
   */
  const updateOrderItemStatus = async (
    orderId: number,
    orderItemId: number,
    status: string
  ): Promise<void> => {
    try {
      const token = localStorage.getItem('auth_token')
      const baseUrl = import.meta.env.VITE_API_URL || '/api'

      const response = await fetch(
        `${baseUrl}/v1/orders/${orderId}/items/${orderItemId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to update order item status')
      }

      console.log(`✅ Updated order item ${orderItemId} to ${status}`)
    } catch (error) {
      console.error('❌ Error updating order item status:', error)
      throw error
    }
  }

  /**
   * 確認訂單
   */
  const confirmOrder = async (orderId: number): Promise<void> => {
    try {
      const token = localStorage.getItem('auth_token')
      const baseUrl = import.meta.env.VITE_API_URL || '/api'

      const response = await fetch(
        `${baseUrl}/v1/orders/${orderId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: 'confirmed' }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to confirm order')
      }

      console.log(`✅ Confirmed order ${orderId}`)
    } catch (error) {
      console.error('❌ Error confirming order:', error)
      throw error
    }
  }

  /**
   * 完成訂單
   */
  const completeOrder = async (orderId: number): Promise<void> => {
    try {
      const token = localStorage.getItem('auth_token')
      const baseUrl = import.meta.env.VITE_API_URL || '/api'

      const response = await fetch(
        `${baseUrl}/v1/orders/${orderId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: 'ready' }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to complete order')
      }

      console.log(`✅ Completed order ${orderId}`)
    } catch (error) {
      console.error('❌ Error completing order:', error)
      throw error
    }
  }

  // ========================================
  // 音效管理
  // ========================================

  /**
   * 初始化音效
   */
  const initializeSounds = () => {
    notificationSound.value = new Audio('/sounds/kitchen-notification.mp3')
    notificationSound.value.volume = 0.6

    urgentSound.value = new Audio('/sounds/kitchen-urgent.mp3')
    urgentSound.value.volume = 0.8
  }

  /**
   * 播放通知音效
   */
  const playNotificationSound = () => {
    if (soundEnabled.value && notificationSound.value) {
      notificationSound.value.currentTime = 0
      notificationSound.value.play().catch((error) => {
        console.warn('Failed to play notification sound:', error)
      })
    }
  }

  /**
   * 播放緊急警示音
   */
  const playUrgentSound = () => {
    if (soundEnabled.value && urgentSound.value) {
      urgentSound.value.currentTime = 0
      urgentSound.value.play().catch((error) => {
        console.warn('Failed to play urgent sound:', error)
      })
    }
  }

  /**
   * 切換音效
   */
  const toggleSound = () => {
    soundEnabled.value = !soundEnabled.value
    localStorage.setItem('kitchen_sound_enabled', soundEnabled.value.toString())
  }

  // ========================================
  // 連接管理
  // ========================================

  /**
   * 開始監聽
   */
  const startListening = () => {
    if (!authStore.user?.restaurantId) {
      console.warn('No restaurant ID, cannot start kitchen realtime')
      return
    }

    // 訂閱訂單事件
    const orderSubId = wsService.subscribe(
      [
        RealtimeEventType.NEW_ORDER,
        RealtimeEventType.ORDER_STATUS_UPDATE,
        RealtimeEventType.ORDER_ITEM_STATUS_UPDATE,
        RealtimeEventType.ORDER_CANCELLED,
      ],
      (event) => {
        switch (event.type) {
          case RealtimeEventType.NEW_ORDER:
            handleNewOrder(event as NewOrderEvent)
            break
          case RealtimeEventType.ORDER_STATUS_UPDATE:
            handleOrderStatusUpdate(event as OrderStatusUpdateEvent)
            break
          case RealtimeEventType.ORDER_ITEM_STATUS_UPDATE:
            handleOrderItemStatusUpdate(event as OrderItemStatusUpdateEvent)
            break
          case RealtimeEventType.ORDER_CANCELLED:
            handleOrderCancelled(event as OrderCancelledEvent)
            break
        }
      }
    )

    // 訂閱廚房事件
    const kitchenSubId = wsService.subscribe(
      [
        RealtimeEventType.KITCHEN_ITEM_STATUS,
        RealtimeEventType.KITCHEN_QUEUE_UPDATE,
      ],
      (event) => {
        if (event.type === RealtimeEventType.KITCHEN_ITEM_STATUS) {
          handleKitchenItemStatus(event as KitchenItemStatusEvent)
        } else if (event.type === RealtimeEventType.KITCHEN_QUEUE_UPDATE) {
          handleKitchenQueueUpdate(event as KitchenQueueUpdateEvent)
        }
      }
    )

    subscriptionIds.value = [orderSubId, kitchenSubId]

    console.log('✅ Started listening to kitchen events')
  }

  /**
   * 停止監聽
   */
  const stopListening = () => {
    subscriptionIds.value.forEach((subId) => {
      wsService.unsubscribe(subId)
    })
    subscriptionIds.value = []
    console.log('🛑 Stopped listening to kitchen events')
  }

  /**
   * 連接到 WebSocket
   */
  const connect = async () => {
    if (!authStore.user?.restaurantId) {
      console.warn('No restaurant ID, cannot connect')
      return
    }

    try {
      await wsService.connect(authStore.user.restaurantId.toString())
      startListening()
    } catch (error) {
      console.error('Failed to connect to kitchen realtime:', error)
    }
  }

  /**
   * 斷開連接
   */
  const disconnect = () => {
    stopListening()
    wsService.disconnect()
  }

  // ========================================
  // 工具方法
  // ========================================

  /**
   * 計算訂單等待時間
   */
  const getOrderWaitingTime = (createdAt: number): number => {
    return Math.floor((Date.now() - createdAt) / 60000)
  }

  /**
   * 獲取優先級訂單
   */
  const getHighPriorityOrders = () => {
    return kitchenOrders.value.filter((order) =>
      order.items.some((item) => item.priority === 'high' || item.priority === 'urgent')
    )
  }

  /**
   * 獲取超時訂單（等待超過 30 分鐘）
   */
  const getOverdueOrders = () => {
    return kitchenOrders.value.filter(
      (order) => getOrderWaitingTime(order.createdAt) > 30
    )
  }

  // ========================================
  // 生命週期管理
  // ========================================

  onMounted(async () => {
    // 初始化音效
    initializeSounds()

    // 從 localStorage 讀取音效設置
    const savedSoundEnabled = localStorage.getItem('kitchen_sound_enabled')
    if (savedSoundEnabled !== null) {
      soundEnabled.value = savedSoundEnabled === 'true'
    }

    // 自動連接
    if (authStore.isAuthenticated && authStore.user?.restaurantId) {
      await connect()
    }

    // 監聽認證狀態變化
    watch(
      () => authStore.isAuthenticated,
      (isAuth) => {
        if (isAuth && authStore.user?.restaurantId) {
          connect()
        } else {
          disconnect()
        }
      }
    )
  })

  onUnmounted(() => {
    disconnect()
  })

  // ========================================
  // 返回 API
  // ========================================

  return {
    // 連接狀態
    isConnected,
    connectionStatus,

    // 訂單數據
    kitchenOrders,
    pendingOrders,
    cookingOrders,
    readyOrders,

    // 統計數據
    queueStats,

    // 音效控制
    soundEnabled,
    toggleSound,

    // 連接管理
    connect,
    disconnect,

    // 訂單操作
    updateOrderItemStatus,
    confirmOrder,
    completeOrder,

    // 工具方法
    getOrderWaitingTime,
    getHighPriorityOrders,
    getOverdueOrders,
  }
}

export default useKitchenRealtime
