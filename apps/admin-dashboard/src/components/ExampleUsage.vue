<template>
  <div class="space-y-4 p-6">
    <h2 class="text-xl font-bold">錯誤處理系統示例</h2>
    
    <!-- ErrorDisplay 組件自動處理全局錯誤 -->
    <ErrorDisplay 
      :show-connection-indicator="true"
      :show-offline-support="true"
      :enable-recovery-panel="true"
      position="top-right"
    />
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- API 錯誤測試 -->
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="font-semibold mb-3">API 錯誤處理測試</h3>
        <div class="space-y-2">
          <button @click="testNetworkError" 
                  class="w-full px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600">
            測試網絡錯誤
          </button>
          <button @click="testAPIError" 
                  class="w-full px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600">
            測試 API 錯誤
          </button>
          <button @click="testAuthError" 
                  class="w-full px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600">
            測試認證錯誤
          </button>
        </div>
      </div>
      
      <!-- SSE 連接測試 -->
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="font-semibold mb-3">SSE 連接測試</h3>
        <div class="space-y-2">
          <div class="flex items-center space-x-2">
            <div :class="[
              'w-3 h-3 rounded-full',
              sseStatus.isConnected ? 'bg-green-500' : 'bg-red-500'
            ]"></div>
            <span class="text-sm">
              {{ sseStatus.isConnected ? '已連接' : '已斷開' }}
            </span>
          </div>
          <button @click="toggleSSE" 
                  class="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            {{ sseStatus.isConnected ? '斷開 SSE' : '連接 SSE' }}
          </button>
          <button @click="forceSSEReconnect" 
                  class="w-full px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">
            強制重連 SSE
          </button>
        </div>
      </div>
      
      <!-- 離線模式測試 -->
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="font-semibold mb-3">離線模式測試</h3>
        <div class="space-y-2">
          <div class="flex items-center space-x-2">
            <div :class="[
              'w-3 h-3 rounded-full',
              isOnline ? 'bg-green-500' : 'bg-red-500'
            ]"></div>
            <span class="text-sm">
              {{ isOnline ? '在線' : '離線' }}
            </span>
          </div>
          <button @click="simulateOffline" 
                  class="w-full px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
            模擬離線狀態
          </button>
          <button @click="testOfflineRequest" 
                  class="w-full px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600">
            測試離線請求
          </button>
        </div>
      </div>
    </div>
    
    <!-- 錯誤日誌顯示 -->
    <div class="bg-gray-50 rounded-lg p-4">
      <h3 class="font-semibold mb-3">錯誤日誌</h3>
      <div class="max-h-64 overflow-y-auto space-y-1">
        <div v-for="(log, index) in errorLogs" :key="index"
             class="text-xs font-mono p-2 bg-white rounded border-l-4"
             :class="{
               'border-red-500': log.severity === 'high' || log.severity === 'critical',
               'border-yellow-500': log.severity === 'medium',
               'border-blue-500': log.severity === 'low'
             }">
          <div class="flex justify-between items-start">
            <span class="font-semibold">{{ log.type }}</span>
            <span class="text-gray-500">{{ formatTime(log.timestamp) }}</span>
          </div>
          <div class="text-gray-700">{{ log.message }}</div>
        </div>
        
        <div v-if="errorLogs.length === 0" class="text-gray-500 text-center py-4">
          暫無錯誤日誌
        </div>
      </div>
      
      <button @click="clearErrorLogs" 
              class="mt-2 px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm">
        清空日誌
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { KitchenErrorHandler } from '@/utils/errorHandler'
import { useStatisticsSSE } from '@/composables/useStatisticsSSE'
import { api } from '@/services/api'

// SSE 連接狀態
const sse = useStatisticsSSE({ autoConnect: false })
const sseStatus = ref({
  isConnected: false
})

// 網絡狀態
const isOnline = ref(navigator.onLine)

// 錯誤日誌
const errorLogs = ref<Array<{
  type: string
  severity: string
  message: string
  timestamp: Date
}>>([])

// API 錯誤測試方法
const testNetworkError = async () => {
  try {
    // 模擬網絡錯誤
    const error = new Error('Network connection failed')
    error.name = 'NetworkError'
    throw error
  } catch (error) {
    KitchenErrorHandler.handleAPIError(error, { context: 'Manual network error test' })
    addErrorLog('network', 'high', '網絡連接失敗')
  }
}

const testAPIError = async () => {
  try {
    // 發送一個會失敗的 API 請求
    await api.get('/non-existent-endpoint')
  } catch (error) {
    addErrorLog('api', 'medium', 'API 端點不存在')
  }
}

const testAuthError = async () => {
  try {
    // 模擬認證錯誤
    const error = new Error('Authentication failed')
    Object.assign(error, { 
      response: { 
        status: 401, 
        data: { error: { message: 'Token expired' } } 
      } 
    })
    throw error
  } catch (error) {
    KitchenErrorHandler.handleAPIError(error, { context: 'Manual auth error test' })
    addErrorLog('permission', 'high', '認證令牌已過期')
  }
}

// SSE 測試方法
const toggleSSE = () => {
  if (sseStatus.value.isConnected) {
    sse.disconnect()
    sseStatus.value.isConnected = false
  } else {
    sse.connect()
    sseStatus.value.isConnected = true
  }
}

const forceSSEReconnect = () => {
  sse.reconnect()
  addErrorLog('sse', 'low', 'SSE 強制重連')
}

// 離線模式測試
const simulateOffline = () => {
  // 模擬離線狀態（僅用於演示）
  isOnline.value = !isOnline.value
  
  // 觸發離線/在線事件
  if (isOnline.value) {
    window.dispatchEvent(new Event('online'))
  } else {
    window.dispatchEvent(new Event('offline'))
  }
  
  addErrorLog('network', 'medium', isOnline.value ? '網絡已恢復' : '網絡已斷開')
}

const testOfflineRequest = async () => {
  if (!isOnline.value) {
    try {
      // 在離線狀態下嘗試 API 請求
      await api.get('/analytics/dashboard', { 
        offlineStrategy: 'queue' 
      } as any)
    } catch (error) {
      addErrorLog('network', 'medium', '離線請求已排隊')
    }
  } else {
    addErrorLog('info', 'low', '當前處於在線狀態')
  }
}

// 工具方法
const addErrorLog = (type: string, severity: string, message: string) => {
  errorLogs.value.unshift({
    type,
    severity,
    message,
    timestamp: new Date()
  })
  
  // 限制日誌數量
  if (errorLogs.value.length > 50) {
    errorLogs.value = errorLogs.value.slice(0, 50)
  }
}

const clearErrorLogs = () => {
  errorLogs.value = []
}

const formatTime = (timestamp: Date) => {
  return timestamp.toLocaleTimeString()
}

// 監聽網絡狀態變化
const handleOnlineStatusChange = () => {
  isOnline.value = navigator.onLine
}

// 監聽 SSE 狀態變化
const handleSSEStatusChange = () => {
  sseStatus.value.isConnected = sse.isConnected.value
}

onMounted(() => {
  // 監聽網絡狀態
  window.addEventListener('online', handleOnlineStatusChange)
  window.addEventListener('offline', handleOnlineStatusChange)
  
  // 監聽 SSE 狀態變化
  setInterval(handleSSEStatusChange, 1000)
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnlineStatusChange)
  window.removeEventListener('offline', handleOnlineStatusChange)
})
</script>