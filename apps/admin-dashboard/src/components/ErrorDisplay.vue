<template>
  <!-- 全局錯誤顯示組件 -->
  <Teleport to="body">
    <!-- 離線狀態橫幅 -->
    <div v-if="showOfflineBanner"
         class="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white p-2 text-center text-sm font-medium">
      <div class="flex items-center justify-center space-x-2">
        <WifiIcon class="w-4 h-4" />
        <span>{{ offlineMessage }}</span>
        <button v-if="pendingRequests > 0"
                @click="showPendingRequests = !showPendingRequests"
                class="text-yellow-100 hover:text-white underline">
          {{ pendingRequests }} 個待處理請求
        </button>
      </div>
    </div>

    <!-- 連接狀態指示器 -->
    <div v-if="showConnectionStatus"
         :class="[
           'fixed top-4 right-4 z-40 px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 text-sm font-medium transition-all duration-300',
           connectionStatusClass
         ]">
      <div :class="[
        'w-2 h-2 rounded-full',
        isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
      ]"></div>
      <span>{{ connectionStatusText }}</span>
      <button v-if="!isConnected && canReconnect"
              @click="handleReconnect"
              class="text-xs bg-white bg-opacity-20 px-2 py-1 rounded hover:bg-opacity-30">
        重連
      </button>
    </div>

    <!-- 待處理請求列表 -->
    <div v-if="showPendingRequests && pendingRequests > 0"
         class="fixed top-12 right-4 z-40 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
      <div class="p-4 bg-yellow-50 border-b border-yellow-200">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-gray-900">待處理請求</h3>
          <button @click="showPendingRequests = false"
                  class="text-gray-400 hover:text-gray-600">
            <XMarkIcon class="w-5 h-5" />
          </button>
        </div>
        <p class="text-sm text-gray-600 mt-1">
          這些請求將在網絡恢復後自動重試
        </p>
      </div>
      <div class="max-h-64 overflow-y-auto">
        <div v-for="(request, index) in pendingRequestsList" :key="index"
             class="p-3 border-b border-gray-100 last:border-b-0">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-900">{{ request.method }} {{ request.url }}</p>
              <p class="text-xs text-gray-500">{{ request.timestamp }}</p>
            </div>
            <div class="flex items-center space-x-2">
              <div class="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
              <span class="text-xs text-gray-500">等待中</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 錯誤快速恢復面板 -->
    <div v-if="showRecoveryPanel"
         class="fixed bottom-4 right-4 z-40 w-96 bg-white rounded-lg shadow-2xl border border-red-200 overflow-hidden">
      <div class="p-4 bg-red-50 border-b border-red-200">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <ExclamationTriangleIcon class="w-5 h-5 text-red-600" />
            <h3 class="font-semibold text-red-900">系統異常</h3>
          </div>
          <button @click="showRecoveryPanel = false"
                  class="text-red-400 hover:text-red-600">
            <XMarkIcon class="w-5 h-5" />
          </button>
        </div>
      </div>
      <div class="p-4">
        <p class="text-sm text-gray-700 mb-4">
          檢測到系統出現異常，您可以嘗試以下恢復操作：
        </p>
        <div class="space-y-2">
          <button @click="handleClearCache"
                  class="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-md">
            🗑️ 清理本地緩存
          </button>
          <button @click="handleRefreshPage"
                  class="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-md">
            🔄 刷新頁面
          </button>
          <button @click="handleResetSettings"
                  class="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-md">
            ⚙️ 重置設定
          </button>
          <button @click="handleReportProblem"
                  class="w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 rounded-md text-blue-700">
            📝 回報問題
          </button>
        </div>
      </div>
    </div>

    <!-- 錯誤統計面板（開發模式） -->
    <div v-if="isDevelopment && showErrorStats"
         class="fixed bottom-4 left-4 z-40 w-80 bg-gray-900 text-white rounded-lg shadow-2xl overflow-hidden">
      <div class="p-3 bg-gray-800 border-b border-gray-700">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-sm">錯誤統計 (開發模式)</h3>
          <button @click="showErrorStats = false"
                  class="text-gray-400 hover:text-gray-200">
            <XMarkIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
      <div class="p-3 text-xs space-y-2">
        <div v-for="(count, type) in errorStats" :key="type"
             class="flex justify-between">
          <span class="capitalize">{{ type }}:</span>
          <span class="font-mono">{{ count }}</span>
        </div>
        <hr class="border-gray-700">
        <div class="flex justify-between">
          <span>總計:</span>
          <span class="font-mono font-bold">{{ totalErrors }}</span>
        </div>
        <button @click="clearErrorStats"
                class="w-full mt-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">
          清除統計
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  WifiIcon,
  ExclamationTriangleIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import { errorHandler } from '@/utils/errorHandler'

// Props
interface Props {
  showConnectionIndicator?: boolean
  showOfflineSupport?: boolean
  enableRecoveryPanel?: boolean
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

const props = withDefaults(defineProps<Props>(), {
  showConnectionIndicator: true,
  showOfflineSupport: true,
  enableRecoveryPanel: true,
  position: 'top-right'
})

// 響應式狀態
const isConnected = ref(navigator.onLine)
const isSSEConnected = ref(false)
const showConnectionStatus = ref(false)
const showOfflineBanner = ref(false)
const showPendingRequests = ref(false)
const showRecoveryPanel = ref(false)
const showErrorStats = ref(false)
const pendingRequests = ref(0)
const pendingRequestsList = ref<Array<{
  method: string
  url: string
  timestamp: string
}>>([])

const errorStats = ref<Record<string, number>>({})
const isDevelopment = ref(import.meta.env.DEV)

// 計算屬性
const connectionStatusClass = computed(() => {
  if (isConnected.value && isSSEConnected.value) {
    return 'bg-green-500 text-white'
  } else if (isConnected.value) {
    return 'bg-yellow-500 text-white'
  } else {
    return 'bg-red-500 text-white'
  }
})

const connectionStatusText = computed(() => {
  if (isConnected.value && isSSEConnected.value) {
    return '連接正常'
  } else if (isConnected.value) {
    return '實時連接中斷'
  } else {
    return '網絡已斷開'
  }
})

const offlineMessage = computed(() => {
  if (pendingRequests.value > 0) {
    return `離線模式 - ${pendingRequests.value} 個請求等待處理`
  }
  return '離線模式 - 某些功能可能受限'
})

const canReconnect = computed(() => {
  return isConnected.value && !isSSEConnected.value
})

const totalErrors = computed(() => {
  return Object.values(errorStats.value).reduce((sum, count) => sum + count, 0)
})

// 方法
const handleReconnect = () => {
  // 觸發重連事件
  window.dispatchEvent(new CustomEvent('manual-reconnect'))
}

const handleClearCache = () => {
  try {
    // 清理 localStorage
    const keysToKeep = ['auth_token', 'user_preferences']
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key)
      }
    })
    
    // 清理 sessionStorage
    sessionStorage.clear()
    
    // 清理應用緩存
    errorHandler.clearCache && errorHandler.clearCache()
    
    alert('緩存已清理，請刷新頁面')
  } catch (error) {
    console.error('清理緩存失敗:', error)
    alert('清理緩存失敗')
  }
}

const handleRefreshPage = () => {
  window.location.reload()
}

const handleResetSettings = () => {
  if (confirm('確定要重置所有設定嗎？這將清除您的偏好設定但不會影響登入狀態。')) {
    const authToken = localStorage.getItem('auth_token')
    localStorage.clear()
    if (authToken) {
      localStorage.setItem('auth_token', authToken)
    }
    sessionStorage.clear()
    window.location.reload()
  }
}

const handleReportProblem = () => {
  const errorInfo = {
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    errorStats: errorStats.value,
    isOnline: isConnected.value,
    isSSEConnected: isSSEConnected.value
  }
  
  // 在實際應用中，這裡應該打開問題回報表單或發送錯誤報告
  console.log('錯誤報告信息:', errorInfo)
  alert('錯誤報告功能尚未實現。請聯繫技術支援。')
}

const clearErrorStats = () => {
  errorStats.value = {}
}

const updateErrorStats = (errorType: string) => {
  errorStats.value[errorType] = (errorStats.value[errorType] || 0) + 1
}

// 事件監聽器
const handleOnlineStatusChange = () => {
  const wasOffline = !isConnected.value
  isConnected.value = navigator.onLine
  
  if (wasOffline && isConnected.value) {
    // 從離線恢復到在線
    showOfflineBanner.value = false
    showConnectionStatus.value = true
    setTimeout(() => {
      showConnectionStatus.value = false
    }, 3000)
  } else if (!isConnected.value) {
    // 變為離線狀態
    showOfflineBanner.value = props.showOfflineSupport
  }
}

const handleSSEStatusChange = (event: CustomEvent) => {
  isSSEConnected.value = event.detail.connected
  
  if (props.showConnectionIndicator) {
    showConnectionStatus.value = true
    setTimeout(() => {
      if (isConnected.value && isSSEConnected.value) {
        showConnectionStatus.value = false
      }
    }, 3000)
  }
}

const handleErrorOccurred = (event: CustomEvent) => {
  const errorType = event.detail.type || 'unknown'
  updateErrorStats(errorType)
  
  // 如果錯誤比較嚴重，顯示恢復面板
  if (props.enableRecoveryPanel && 
      (errorType === 'critical' || totalErrors.value > 5)) {
    showRecoveryPanel.value = true
  }
}

const handlePendingRequestsChange = (event: CustomEvent) => {
  pendingRequests.value = event.detail.count
  pendingRequestsList.value = event.detail.requests || []
}

// 生命週期
onMounted(() => {
  // 監聽網絡狀態變化
  window.addEventListener('online', handleOnlineStatusChange)
  window.addEventListener('offline', handleOnlineStatusChange)
  
  // 監聽 SSE 狀態變化
  window.addEventListener('sse-status-change', handleSSEStatusChange as EventListener)
  
  // 監聽錯誤事件
  window.addEventListener('error-occurred', handleErrorOccurred as EventListener)
  
  // 監聽待處理請求變化
  window.addEventListener('pending-requests-change', handlePendingRequestsChange as EventListener)
  
  // 初始狀態檢查
  handleOnlineStatusChange()
  
  // 開發模式下顯示錯誤統計
  if (isDevelopment.value) {
    // 雙擊右下角顯示錯誤統計
    document.addEventListener('dblclick', (event) => {
      if (event.clientX > window.innerWidth - 100 && 
          event.clientY > window.innerHeight - 100) {
        showErrorStats.value = !showErrorStats.value
      }
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnlineStatusChange)
  window.removeEventListener('offline', handleOnlineStatusChange)
  window.removeEventListener('sse-status-change', handleSSEStatusChange as EventListener)
  window.removeEventListener('error-occurred', handleErrorOccurred as EventListener)
  window.removeEventListener('pending-requests-change', handlePendingRequestsChange as EventListener)
})
</script>