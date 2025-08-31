<template>
  <div v-if="showOfflineIndicator" class="offline-status-container">
    <!-- Offline Banner -->
    <div 
      :class="[
        'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
        isOffline ? 'translate-y-0' : '-translate-y-full'
      ]"
    >
      <div class="bg-yellow-500 text-white px-4 py-2 text-center text-sm font-medium">
        <div class="flex items-center justify-center space-x-2">
          <WifiIcon class="w-4 h-4 text-yellow-200" />
          <span>離線模式 - 數據將在網路恢復時同步</span>
          <span v-if="pendingCount > 0" class="bg-yellow-600 px-2 py-1 rounded text-xs">
            {{ pendingCount }} 個待同步操作
          </span>
        </div>
      </div>
    </div>

    <!-- Floating Status Widget -->
    <div 
      v-if="showFloatingWidget"
      class="fixed bottom-4 right-4 z-50"
    >
      <div 
        :class="[
          'bg-white rounded-xl shadow-lg border-2 p-3 transition-all duration-200 cursor-pointer',
          getStatusBorderClass(),
          showDetails ? 'w-80' : 'w-16 h-16'
        ]"
        @click="toggleDetails"
      >
        <!-- Collapsed State -->
        <div v-if="!showDetails" class="flex items-center justify-center h-full">
          <div class="relative">
            <component :is="getStatusIcon()" :class="getStatusIconClass()" class="w-6 h-6" />
            <div 
              v-if="pendingCount > 0"
              class="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
            >
              {{ pendingCount > 9 ? '9+' : pendingCount }}
            </div>
          </div>
        </div>

        <!-- Expanded State -->
        <div v-else class="space-y-3">
          <!-- Header -->
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <component :is="getStatusIcon()" :class="getStatusIconClass()" class="w-5 h-5" />
              <span class="font-medium text-gray-900">{{ getStatusText() }}</span>
            </div>
            <button 
              @click.stop="toggleDetails"
              class="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon class="w-4 h-4" />
            </button>
          </div>

          <!-- Status Details -->
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">網路狀態:</span>
              <span :class="isOnline ? 'text-green-600' : 'text-red-600'">
                {{ isOnline ? '已連線' : '已斷線' }}
              </span>
            </div>
            
            <div class="flex justify-between">
              <span class="text-gray-600">待同步操作:</span>
              <span class="font-medium">{{ pendingCount }}</span>
            </div>
            
            <div v-if="conflictCount > 0" class="flex justify-between">
              <span class="text-gray-600">衝突數量:</span>
              <span class="text-orange-600 font-medium">{{ conflictCount }}</span>
            </div>
            
            <div v-if="lastSyncTime" class="flex justify-between">
              <span class="text-gray-600">最後同步:</span>
              <span class="text-gray-900">{{ formatSyncTime(lastSyncTime) }}</span>
            </div>
          </div>

          <!-- Sync Status -->
          <div v-if="syncInProgress" class="flex items-center space-x-2 text-blue-600 text-sm">
            <div class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>正在同步...</span>
          </div>

          <!-- Action Buttons -->
          <div class="flex space-x-2 pt-2 border-t border-gray-200">
            <button
              v-if="pendingCount > 0 && isOnline && !syncInProgress"
              @click="forcSync"
              class="flex-1 px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
            >
              立即同步
            </button>
            
            <button
              v-if="conflictCount > 0"
              @click="showConflictModal = true"
              class="flex-1 px-3 py-2 bg-orange-600 text-white text-xs rounded-lg hover:bg-orange-700"
            >
              解決衝突
            </button>
            
            <button
              @click="showDetailModal = true"
              class="px-3 py-2 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700"
            >
              詳細
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Detailed Status Modal -->
    <div
      v-if="showDetailModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="showDetailModal = false"
    >
      <div 
        class="bg-white rounded-xl max-w-2xl max-h-[80vh] overflow-hidden mx-4"
        @click.stop
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-200">
          <div class="flex items-center space-x-3">
            <component :is="getStatusIcon()" :class="getStatusIconClass()" class="w-6 h-6" />
            <div>
              <h2 class="text-xl font-semibold text-gray-900">離線狀態詳情</h2>
              <p class="text-sm text-gray-600">數據同步和離線操作管理</p>
            </div>
          </div>
          <button 
            @click="showDetailModal = false"
            class="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon class="w-5 h-5" />
          </button>
        </div>

        <!-- Modal Content -->
        <div class="overflow-y-auto max-h-[60vh] p-6">
          <!-- Statistics -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-blue-50 rounded-lg p-3 text-center">
              <div class="text-2xl font-bold text-blue-600">{{ pendingCount }}</div>
              <div class="text-sm text-blue-600">待同步操作</div>
            </div>
            
            <div class="bg-green-50 rounded-lg p-3 text-center">
              <div class="text-2xl font-bold text-green-600">{{ syncedCount }}</div>
              <div class="text-sm text-green-600">已同步操作</div>
            </div>
            
            <div class="bg-red-50 rounded-lg p-3 text-center">
              <div class="text-2xl font-bold text-red-600">{{ failedCount }}</div>
              <div class="text-sm text-red-600">同步失敗</div>
            </div>
            
            <div class="bg-orange-50 rounded-lg p-3 text-center">
              <div class="text-2xl font-bold text-orange-600">{{ conflictCount }}</div>
              <div class="text-sm text-orange-600">待解決衝突</div>
            </div>
          </div>

          <!-- Pending Actions -->
          <div v-if="pendingActions.length > 0" class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-3">待同步操作</h3>
            <div class="space-y-2 max-h-48 overflow-y-auto">
              <div
                v-for="action in pendingActions"
                :key="action.id"
                class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <div class="font-medium text-gray-900">{{ getActionTypeText(action.type) }}</div>
                  <div class="text-sm text-gray-600">
                    訂單 #{{ action.orderId }} • {{ formatActionTime(action.timestamp) }}
                  </div>
                  <div v-if="action.error" class="text-sm text-red-600 mt-1">
                    錯誤: {{ action.error }}
                  </div>
                </div>
                
                <div class="text-sm text-gray-500">
                  重試 {{ action.retryCount }}/5
                </div>
              </div>
            </div>
          </div>

          <!-- Data Integrity -->
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-3">數據完整性</h3>
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-gray-600">快取數據狀態:</span>
                <span class="text-green-600 font-medium">正常</span>
              </div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-gray-600">數據驗證:</span>
                <button 
                  @click="validateData"
                  class="text-blue-600 hover:text-blue-700 text-sm"
                >
                  執行驗證
                </button>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-gray-600">修復數據:</span>
                <button 
                  @click="repairData"
                  class="text-orange-600 hover:text-orange-700 text-sm"
                >
                  執行修復
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div class="flex space-x-3">
            <button
              v-if="pendingCount > 0 && isOnline"
              @click="forcSync"
              :disabled="syncInProgress"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {{ syncInProgress ? '同步中...' : '立即同步' }}
            </button>
            
            <button
              @click="clearOfflineData"
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              清除離線數據
            </button>
          </div>
          
          <button
            @click="showDetailModal = false"
            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            關閉
          </button>
        </div>
      </div>
    </div>

    <!-- Conflict Resolution Modal -->
    <div
      v-if="showConflictModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="showConflictModal = false"
    >
      <div 
        class="bg-white rounded-xl max-w-lg mx-4"
        @click.stop
      >
        <div class="p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">解決數據衝突</h3>
          <p class="text-gray-600 mb-4">
            檢測到 {{ conflictCount }} 個數據衝突，請選擇解決方式：
          </p>
          
          <div class="space-y-3">
            <button
              @click="resolveAllConflicts('server')"
              class="w-full p-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <div class="font-medium">使用伺服器版本</div>
              <div class="text-sm text-gray-600">放棄本機更改，使用伺服器最新數據</div>
            </button>
            
            <button
              @click="resolveAllConflicts('local')"
              class="w-full p-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <div class="font-medium">保持本機版本</div>
              <div class="text-sm text-gray-600">保留本機更改，覆蓋伺服器數據</div>
            </button>
            
            <button
              @click="resolveAllConflicts('merge')"
              class="w-full p-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <div class="font-medium">智能合併</div>
              <div class="text-sm text-gray-600">嘗試合併本機和伺服器的更改</div>
            </button>
          </div>
          
          <div class="flex justify-end space-x-3 mt-6">
            <button
              @click="showConflictModal = false"
              class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  WifiIcon,
  SignalSlashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  CloudArrowUpIcon
} from '@heroicons/vue/24/outline'
import { useToast } from 'vue-toastification'
import { offlineService } from '@/services/offlineService'

const toast = useToast()

// Props
interface Props {
  show?: boolean
  autoHide?: boolean
  showFloatingWidget?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: true,
  autoHide: false,
  showFloatingWidget: true
})

// State
const showDetails = ref(false)
const showDetailModal = ref(false)
const showConflictModal = ref(false)

// Computed from offline service
const isOnline = computed(() => offlineService.isOnline.value)
const isOffline = computed(() => !offlineService.isOnline.value)
const pendingActions = computed(() => offlineService.pendingActions.value)
const syncConflicts = computed(() => offlineService.syncConflicts.value)
const syncInProgress = computed(() => offlineService.syncInProgress.value)
const lastSyncTime = computed(() => offlineService.lastSyncTime.value)

const pendingCount = computed(() => pendingActions.value.length)
const conflictCount = computed(() => syncConflicts.value.length)
const syncedCount = computed(() => {
  // This would be tracked separately in a real implementation
  return 0
})
const failedCount = computed(() => 
  pendingActions.value.filter(a => a.error).length
)

const showOfflineIndicator = computed(() => 
  props.show && (isOffline.value || pendingCount.value > 0 || conflictCount.value > 0)
)

// Methods
const getStatusIcon = () => {
  if (conflictCount.value > 0) return ExclamationTriangleIcon
  if (syncInProgress.value) return CloudArrowUpIcon
  if (isOffline.value) return SignalSlashIcon
  if (pendingCount.value > 0) return WifiIcon
  return CheckCircleIcon
}

const getStatusIconClass = () => {
  if (conflictCount.value > 0) return 'text-orange-500'
  if (syncInProgress.value) return 'text-blue-500 animate-pulse'
  if (isOffline.value) return 'text-red-500'
  if (pendingCount.value > 0) return 'text-yellow-500'
  return 'text-green-500'
}

const getStatusBorderClass = () => {
  if (conflictCount.value > 0) return 'border-orange-300'
  if (syncInProgress.value) return 'border-blue-300'
  if (isOffline.value) return 'border-red-300'
  if (pendingCount.value > 0) return 'border-yellow-300'
  return 'border-green-300'
}

const getStatusText = () => {
  if (conflictCount.value > 0) return '數據衝突'
  if (syncInProgress.value) return '同步中'
  if (isOffline.value) return '離線模式'
  if (pendingCount.value > 0) return '等待同步'
  return '已同步'
}

const getActionTypeText = (type: string) => {
  const texts: Record<string, string> = {
    start_cooking: '開始製作',
    mark_ready: '標記完成',
    update_status: '更新狀態',
    priority_change: '調整優先級',
    batch_operation: '批量操作'
  }
  return texts[type] || type
}

const formatSyncTime = (timestamp: number) => {
  const now = Date.now()
  const diff = now - timestamp
  
  if (diff < 60000) return '剛剛'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分鐘前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小時前`
  return new Date(timestamp).toLocaleString('zh-TW')
}

const formatActionTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const toggleDetails = () => {
  showDetails.value = !showDetails.value
}

const forcSync = async () => {
  try {
    await offlineService.forcSync()
    toast.success('數據同步完成')
  } catch (error: any) {
    toast.error('同步失敗: ' + error.message)
  }
}

const validateData = () => {
  const isValid = offlineService.validateCachedData()
  if (isValid) {
    toast.success('數據驗證通過')
  } else {
    toast.warning('數據驗證失敗，建議執行修復')
  }
}

const repairData = () => {
  const repaired = offlineService.repairData()
  if (repaired) {
    toast.success('數據修復完成')
  } else {
    toast.info('數據無需修復')
  }
}

const clearOfflineData = () => {
  offlineService.clearOfflineData()
  toast.success('離線數據已清除')
  showDetailModal.value = false
}

const resolveAllConflicts = (resolution: 'local' | 'server' | 'merge') => {
  syncConflicts.value.forEach(conflict => {
    offlineService.resolveConflict(conflict.id, resolution)
  })
  
  const resolutionText = {
    local: '保持本機版本',
    server: '使用伺服器版本', 
    merge: '智能合併'
  }[resolution]
  
  toast.success(`已使用「${resolutionText}」解決所有衝突`)
  showConflictModal.value = false
}

// Auto-hide floating widget when online and no pending actions
let hideTimeout: NodeJS.Timeout | null = null

const scheduleAutoHide = () => {
  if (!props.autoHide) return
  
  if (hideTimeout) {
    clearTimeout(hideTimeout)
  }
  
  if (isOnline.value && pendingCount.value === 0 && conflictCount.value === 0) {
    hideTimeout = setTimeout(() => {
      showDetails.value = false
    }, 5000) // Hide after 5 seconds
  }
}

onMounted(() => {
  scheduleAutoHide()
})

onUnmounted(() => {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
  }
})

// Watch for status changes to schedule auto-hide
computed(() => {
  if (props.autoHide) {
    scheduleAutoHide()
  }
})
</script>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .5; }
}

/* Scrollbar styling */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>