<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <h1 class="text-2xl font-bold text-gray-900 mb-2">SSE 連接測試</h1>
        <p class="text-gray-600">測試廚房顯示系統的即時通信功能</p>
      </div>

      <!-- Connection Status -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">連接狀態</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="text-sm text-gray-500">狀態</div>
            <div :class="[
              'text-lg font-semibold',
              isConnected ? 'text-green-600' : 'text-red-600'
            ]">
              {{ getStatusText(connectionStatus) }}
            </div>
          </div>
          
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="text-sm text-gray-500">重連次數</div>
            <div class="text-lg font-semibold text-gray-900">{{ reconnectAttempts }}</div>
          </div>
          
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="text-sm text-gray-500">最後心跳</div>
            <div class="text-lg font-semibold text-gray-900">
              {{ lastHeartbeat ? formatTime(lastHeartbeat) : '無' }}
            </div>
          </div>
        </div>

        <div class="flex space-x-4">
          <button
            v-if="connectionStatus !== 'connected'"
            @click="connect"
            class="btn-kitchen-primary px-4 py-2"
          >
            連接 SSE
          </button>
          
          <button
            v-if="isConnected"
            @click="disconnect"
            class="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-xl transition-colors"
          >
            斷開連接
          </button>
          
          <button
            @click="reconnect"
            class="btn-kitchen-secondary px-4 py-2"
          >
            重新連接
          </button>
        </div>
      </div>

      <!-- Test Controls -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">測試控制</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            @click="sendTestEvent('NEW_ORDER')"
            class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            模擬新訂單
          </button>
          
          <button
            @click="sendTestEvent('ORDER_STATUS_UPDATE')"
            class="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            模擬狀態更新
          </button>
          
          <button
            @click="sendTestEvent('ORDER_CANCELLED')"
            class="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            模擬訂單取消
          </button>
          
          <button
            @click="sendTestEvent('PRIORITY_UPDATE')"
            class="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            模擬優先級更新
          </button>
        </div>
      </div>

      <!-- Event Log -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900">事件日誌</h2>
          <button
            @click="clearEvents"
            class="text-sm text-gray-500 hover:text-gray-700"
          >
            清除日誌
          </button>
        </div>
        
        <div class="max-h-96 overflow-y-auto">
          <div v-if="events.length === 0" class="text-center py-8 text-gray-500">
            暫無事件記錄
          </div>
          
          <div
            v-for="(event, index) in events"
            :key="index"
            class="border-b border-gray-100 last:border-b-0 py-3"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center space-x-2 mb-1">
                  <span :class="getEventTypeClass(event.type)">
                    {{ getEventTypeText(event.type) }}
                  </span>
                  <span class="text-xs text-gray-500">
                    {{ formatTime(event.timestamp) }}
                  </span>
                </div>
                
                <div class="text-sm text-gray-600">
                  {{ event.message }}
                </div>
                
                <div v-if="event.data" class="mt-2">
                  <details class="text-xs text-gray-500">
                    <summary class="cursor-pointer hover:text-gray-700">詳細數據</summary>
                    <pre class="mt-1 p-2 bg-gray-50 rounded overflow-x-auto">{{ JSON.stringify(event.data, null, 2) }}</pre>
                  </details>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useKitchenSSE } from '@/composables/useKitchenSSE'
import { kitchenApi } from '@/services/kitchenApi'
import { useToast } from 'vue-toastification'
import type { KitchenSSEEvent, ConnectionStatus } from '@/types'

const toast = useToast()

// Test restaurant ID
const TEST_RESTAURANT_ID = 1

// Event log
const events = ref<Array<{
  type: string
  message: string
  timestamp: Date
  data?: any
}>>([])

// SSE Connection
const {
  connectionStatus,
  isConnected,
  lastHeartbeat,
  reconnectAttempts,
  connect: connectSSE,
  disconnect: disconnectSSE,
  reconnect: reconnectSSE
} = useKitchenSSE({
  restaurantId: TEST_RESTAURANT_ID,
  onNewOrder: (event) => handleSSEEvent('NEW_ORDER', '收到新訂單', event),
  onOrderUpdate: (event) => handleSSEEvent('ORDER_UPDATE', '訂單狀態更新', event),
  onOrderCancelled: (event) => handleSSEEvent('ORDER_CANCELLED', '訂單已取消', event),
  onPriorityUpdate: (event) => handleSSEEvent('PRIORITY_UPDATE', '優先級已更新', event),
  autoConnect: false // 手動控制連接
})

// Methods
const handleSSEEvent = (type: string, message: string, data?: any) => {
  events.value.unshift({
    type,
    message,
    timestamp: new Date(),
    data
  })
  
  // Keep only last 100 events
  if (events.value.length > 100) {
    events.value = events.value.slice(0, 100)
  }
}

const connect = () => {
  connectSSE()
  addEvent('CONNECTION', '嘗試建立 SSE 連接')
}

const disconnect = () => {
  disconnectSSE()
  addEvent('CONNECTION', 'SSE 連接已斷開')
}

const reconnect = () => {
  reconnectSSE()
  addEvent('CONNECTION', '重新連接 SSE')
}

const sendTestEvent = async (eventType: string) => {
  try {
    const payload = {
      type: eventType,
      payload: {
        orderId: Math.floor(Math.random() * 1000) + 1,
        message: `測試事件：${eventType}`,
        timestamp: new Date().toISOString()
      }
    }
    
    const response = await kitchenApi.broadcastTest(TEST_RESTAURANT_ID, payload)
    
    if (response.success) {
      addEvent('TEST', `已發送測試事件：${eventType}`)
      toast.success('測試事件已發送')
    } else {
      throw new Error(response.error || '發送失敗')
    }
  } catch (error: any) {
    addEvent('ERROR', `發送測試事件失敗：${error.message}`)
    toast.error('發送測試事件失敗：' + error.message)
  }
}

const addEvent = (type: string, message: string, data?: any) => {
  events.value.unshift({
    type,
    message,
    timestamp: new Date(),
    data
  })
}

const clearEvents = () => {
  events.value = []
}

const getStatusText = (status: ConnectionStatus) => {
  const texts = {
    'connected': '已連線',
    'connecting': '連線中',
    'disconnected': '已斷線',
    'error': '連線錯誤'
  }
  return texts[status] || '未知'
}

const getEventTypeClass = (type: string) => {
  const classes = {
    'NEW_ORDER': 'px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs',
    'ORDER_UPDATE': 'px-2 py-1 bg-green-100 text-green-800 rounded text-xs',
    'ORDER_CANCELLED': 'px-2 py-1 bg-red-100 text-red-800 rounded text-xs',
    'PRIORITY_UPDATE': 'px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs',
    'CONNECTION': 'px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs',
    'TEST': 'px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs',
    'ERROR': 'px-2 py-1 bg-red-100 text-red-800 rounded text-xs'
  }
  return classes[type] || 'px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs'
}

const getEventTypeText = (type: string) => {
  const texts = {
    'NEW_ORDER': '新訂單',
    'ORDER_UPDATE': '狀態更新',
    'ORDER_CANCELLED': '訂單取消',
    'PRIORITY_UPDATE': '優先級更新',
    'CONNECTION': '連接',
    'TEST': '測試',
    'ERROR': '錯誤'
  }
  return texts[type] || type
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Lifecycle
onMounted(() => {
  addEvent('SYSTEM', 'SSE 測試頁面已載入')
})

onUnmounted(() => {
  if (isConnected.value) {
    disconnect()
  }
})
</script>