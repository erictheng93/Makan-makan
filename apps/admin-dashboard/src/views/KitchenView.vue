<template>
  <div class="kitchen-view">
    <!-- 廚房顯示屏標題 -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">廚房顯示系統</h1>
        <p class="text-gray-600">{{ currentTime }} | 待處理訂單: {{ pendingOrders.length }} 份</p>
      </div>
      <div class="flex items-center space-x-4">
        <button
          @click="refreshOrders"
          :disabled="isAutoRefresh"
          class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon :class="['h-4 w-4 mr-2', isAutoRefresh && 'animate-spin']" />
          {{ isAutoRefresh ? '自動刷新中' : '手動刷新' }}
        </button>
        
        <button
          @click="toggleSound"
          :class="[
            'flex items-center px-4 py-2 rounded-lg transition-colors',
            soundEnabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
          ]"
        >
          <SpeakerWaveIcon class="h-4 w-4 mr-2" />
          {{ soundEnabled ? '音效開啟' : '音效關閉' }}
        </button>
        <div class="flex items-center">
          <input
            id="auto-refresh"
            v-model="isAutoRefresh"
            type="checkbox"
            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label for="auto-refresh" class="ml-2 text-sm text-gray-700">自動刷新 (10秒)</label>
        </div>
      </div>
    </div>

    <!-- 廚房統計面板 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <!-- 訂單狀態統計 -->
      <div class="bg-yellow-100 rounded-lg p-6 border-l-4 border-yellow-500">
        <div class="flex items-center">
          <ClockIcon class="h-8 w-8 text-yellow-600 mr-3" />
          <div>
            <p class="text-sm font-medium text-yellow-800">待確認</p>
            <p class="text-2xl font-bold text-yellow-900">{{ orderStats.pending }}</p>
          </div>
        </div>
      </div>

      <div class="bg-blue-100 rounded-lg p-6 border-l-4 border-blue-500">
        <div class="flex items-center">
          <PlayIcon class="h-8 w-8 text-blue-600 mr-3" />
          <div>
            <p class="text-sm font-medium text-blue-800">製作中</p>
            <p class="text-2xl font-bold text-blue-900">{{ orderStats.preparing }}</p>
          </div>
        </div>
      </div>

      <div class="bg-green-100 rounded-lg p-6 border-l-4 border-green-500">
        <div class="flex items-center">
          <CheckCircleIcon class="h-8 w-8 text-green-600 mr-3" />
          <div>
            <p class="text-sm font-medium text-green-800">待取餐</p>
            <p class="text-2xl font-bold text-green-900">{{ orderStats.ready }}</p>
          </div>
        </div>
      </div>

      <div class="bg-purple-100 rounded-lg p-6 border-l-4 border-purple-500">
        <div class="flex items-center">
          <ChartBarIcon class="h-8 w-8 text-purple-600 mr-3" />
          <div>
            <p class="text-sm font-medium text-purple-800">平均完成時間</p>
            <p class="text-2xl font-bold text-purple-900">{{ avgCompletionTime }}分</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 廚房績效指標 -->
    <div class="bg-white rounded-lg shadow p-6 mb-8">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold text-gray-900">今日廚房績效</h2>
        <div class="flex items-center space-x-4">
          <div class="text-center">
            <p class="text-sm text-gray-600">效率評分</p>
            <p class="text-lg font-bold" :class="getEfficiencyColor(efficiencyScore)">{{ efficiencyScore }}%</p>
          </div>
          <div class="text-center">
            <p class="text-sm text-gray-600">準時率</p>
            <p class="text-lg font-bold" :class="getEfficiencyColor(onTimeRate)">{{ onTimeRate }}%</p>
          </div>
          <div class="text-center">
            <p class="text-sm text-gray-600">今日完成</p>
            <p class="text-lg font-bold text-green-600">{{ todayCompleted }}單</p>
          </div>
        </div>
      </div>
      
      <!-- 效率進度條 -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-600">製作速度</span>
            <span class="font-medium">{{ preparationSpeed }}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                 :style="{ width: `${preparationSpeed}%` }"></div>
          </div>
        </div>
        
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-600">品質評分</span>
            <span class="font-medium">{{ qualityScore }}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-green-500 h-2 rounded-full transition-all duration-300" 
                 :style="{ width: `${qualityScore}%` }"></div>
          </div>
        </div>
        
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-600">工作負載</span>
            <span class="font-medium">{{ workload }}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="h-2 rounded-full transition-all duration-300" 
                 :class="workload > 80 ? 'bg-red-500' : workload > 60 ? 'bg-yellow-500' : 'bg-green-500'"
                 :style="{ width: `${workload}%` }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 訂單卡片區域 -->
    <VirtualOrderGrid
      :orders="kitchenOrders"
      :item-height="320"
      :container-height="800"
      :columns-count="3"
      :buffer-size="2"
      :loading="isLoadingOrders"
      :has-more="hasMoreOrders"
      :load-more="loadMoreKitchenOrders"
      @load-more="onLoadMoreOrders"
    >
      <template #default="{ order }">
        <div
          :class="getOrderCardClass(order)"
          class="rounded-lg shadow-lg p-6 border-l-4 transition-all duration-300 h-full"
        >
        <!-- 訂單標題 -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center">
            <div :class="getStatusIconClass(order.status)" class="p-2 rounded-full mr-3">
              <component :is="getStatusIcon(order.status)" class="h-6 w-6" />
            </div>
            <div>
              <h3 class="text-lg font-bold text-gray-900">{{ order.orderNumber }}</h3>
              <p class="text-sm text-gray-600">桌號: {{ order.tableNumber || 'N/A' }}</p>
            </div>
          </div>
          <div class="text-right">
            <span :class="getPriorityBadgeClass(order.priority)" class="px-3 py-1 rounded-full text-xs font-medium">
              {{ getPriorityText(order.priority) }}
            </span>
            <p class="text-xs text-gray-500 mt-1">{{ getTimeElapsed(order.createdAt) }}</p>
          </div>
        </div>

        <!-- 菜品清單 -->
        <div class="space-y-3 mb-4">
          <div
            v-for="item in order.items"
            :key="item.id"
            class="flex items-center justify-between bg-gray-50 rounded-lg p-3"
          >
            <div class="flex items-center">
              <span class="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full font-semibold text-sm mr-3">
                {{ item.quantity }}
              </span>
              <div>
                <p class="font-medium text-gray-900">{{ item.menuItemName }}</p>
                <p v-if="item.specialInstructions" class="text-sm text-orange-600 mt-1">
                  <ExclamationTriangleIcon class="w-4 h-4 inline mr-1" />
                  {{ item.specialInstructions }}
                </p>
                <div v-if="item.customizations && Object.keys(item.customizations).length > 0" class="mt-1">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="(value, key) in item.customizations"
                      :key="key"
                      class="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full"
                    >
                      {{ key }}: {{ value }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 訂單操作按鈕 -->
        <div class="flex space-x-2">
          <button
            v-if="order.status === 'pending'"
            @click="confirmOrder(order)"
            class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            確認訂單
          </button>
          <button
            v-else-if="order.status === 'confirmed'"
            @click="startCooking(order)"
            class="flex-1 bg-yellow-600 text-white py-2 px-4 rounded-lg hover:bg-yellow-700 transition-colors font-medium"
          >
            開始製作
          </button>
          <button
            v-else-if="order.status === 'preparing'"
            @click="markReady(order)"
            class="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            製作完成
          </button>
          <button
            v-else-if="order.status === 'ready'"
            @click="markServed(order)"
            class="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            已送達
          </button>
          
          <!-- 緊急/延遲處理按鈕 -->
          <button
            v-if="['pending', 'confirmed', 'preparing'].includes(order.status)"
            @click="togglePriority(order)"
            :class="order.priority === 'high' ? 'bg-red-100 text-red-800 hover:bg-red-200' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'"
            class="px-3 py-2 rounded-lg transition-colors"
          >
            <ExclamationCircleIcon class="w-5 h-5" />
          </button>
        </div>

        <!-- 估計完成時間和進度 -->
        <div class="mt-4 pt-4 border-t border-gray-200">
          <div class="flex items-center justify-between text-sm mb-2">
            <div class="flex items-center">
              <ClockIcon class="w-4 h-4 text-gray-500 mr-2" />
              <span class="text-gray-600">預計還需: {{ calculateEstimatedTime(order) }}分鐘</span>
            </div>
            <div v-if="order.status === 'preparing'" class="flex items-center">
              <div class="w-20 bg-gray-200 rounded-full h-1 mr-2">
                <div class="bg-blue-500 h-1 rounded-full transition-all duration-300" 
                     :style="{ width: `${Math.min(100, (getTimeElapsed(order.createdAt).includes('分鐘前') ? parseInt(getTimeElapsed(order.createdAt)) : 0) / calculateEstimatedTime(order) * 100)}%` }"></div>
              </div>
              <span class="text-xs text-gray-500">{{ Math.min(100, Math.round((getTimeElapsed(order.createdAt).includes('分鐘前') ? parseInt(getTimeElapsed(order.createdAt)) : 0) / calculateEstimatedTime(order) * 100)) }}%</span>
            </div>
          </div>
          <div v-if="order.estimatedReadyTime" class="flex items-center text-xs text-gray-500">
            <span>目標完成時間: {{ formatTime(order.estimatedReadyTime) }}</span>
          </div>
        </div>
        </div>
      </template>
    </VirtualOrderGrid>

    <!-- 空狀態 -->
    <div v-if="kitchenOrders.length === 0" class="text-center py-12">
      <CheckCircleIcon class="mx-auto h-16 w-16 text-gray-400 mb-4" />
      <h3 class="text-xl font-medium text-gray-900 mb-2">太棒了！所有訂單都已完成</h3>
      <p class="text-gray-500">等待新的訂單...</p>
    </div>

    <!-- 通知音效 -->
    <audio ref="notificationSound" preload="auto">
      <source src="/notification.mp3" type="audio/mpeg">
    </audio>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useOrderStore } from '@/stores/order'
import VirtualOrderGrid from '../../../kitchen-display/src/components/VirtualOrderGrid.vue'
import {
  ArrowPathIcon,
  ClockIcon,
  PlayIcon,
  CheckCircleIcon,
  HandRaisedIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  ChartBarIcon,
  SpeakerWaveIcon
} from '@heroicons/vue/24/outline'

const orderStore = useOrderStore()

// 響應式數據
const currentTime = ref('')
const isAutoRefresh = ref(true)
const notificationSound = ref(null)
const soundEnabled = ref(true)
const isLoadingOrders = ref(false)
const hasMoreOrders = ref(false)
const currentOrderPage = ref(1)
const orderPageSize = ref(30)
let timeInterval = null
let refreshInterval = null

// 廚房績效數據
const kitchenStats = ref({
  avgCompletionTime: 18,
  efficiencyScore: 87,
  onTimeRate: 92,
  todayCompleted: 45,
  preparationSpeed: 85,
  qualityScore: 94,
  workload: 68
})

// 模擬廚房訂單數據
const orders = ref([
  {
    id: 1,
    orderNumber: 'ORD-001',
    tableNumber: 'T01',
    status: 'pending',
    priority: 'normal',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    estimatedReadyTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    items: [
      {
        id: 1,
        menuItemName: '招牌炒飯',
        quantity: 2,
        specialInstructions: '不要蔥',
        customizations: { '辣度': '中辣', '配菜': '加蛋' }
      },
      {
        id: 2,
        menuItemName: '冰奶茶',
        quantity: 1,
        specialInstructions: '',
        customizations: { '甜度': '半糖', '冰量': '正常冰' }
      }
    ]
  },
  {
    id: 2,
    orderNumber: 'ORD-002',
    tableNumber: 'T03',
    status: 'preparing',
    priority: 'high',
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    estimatedReadyTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    items: [
      {
        id: 3,
        menuItemName: '春卷',
        quantity: 1,
        specialInstructions: '要蘸醬',
        customizations: {}
      }
    ]
  },
  {
    id: 3,
    orderNumber: 'ORD-003',
    tableNumber: 'T05',
    status: 'ready',
    priority: 'normal',
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    estimatedReadyTime: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    items: [
      {
        id: 4,
        menuItemName: '南洋咖啡',
        quantity: 2,
        specialInstructions: '',
        customizations: { '甜度': '正常', '濃度': '濃' }
      }
    ]
  }
])

// 計算屬性
const pendingOrders = computed(() => orders.value.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status)))

const kitchenOrders = computed(() => {
  return orders.value
    .filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status))
    .sort((a, b) => {
      // 優先級排序
      if (a.priority === 'high' && b.priority !== 'high') return -1
      if (b.priority === 'high' && a.priority !== 'high') return 1
      // 時間排序
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
})

const orderStats = computed(() => ({
  pending: orders.value.filter(o => o.status === 'pending').length,
  preparing: orders.value.filter(o => ['confirmed', 'preparing'].includes(o.status)).length,
  ready: orders.value.filter(o => o.status === 'ready').length,
  served: orders.value.filter(o => o.status === 'served').length
}))

// 績效計算屬性
const avgCompletionTime = computed(() => kitchenStats.value.avgCompletionTime)
const efficiencyScore = computed(() => kitchenStats.value.efficiencyScore)
const onTimeRate = computed(() => kitchenStats.value.onTimeRate)
const todayCompleted = computed(() => kitchenStats.value.todayCompleted)
const preparationSpeed = computed(() => kitchenStats.value.preparationSpeed)
const qualityScore = computed(() => kitchenStats.value.qualityScore)
const workload = computed(() => kitchenStats.value.workload)

// 方法
const updateCurrentTime = () => {
  currentTime.value = new Date().toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const refreshOrders = async () => {
  isLoadingOrders.value = true
  try {
    // 模擬API調用
    console.log('Refreshing kitchen orders...')
    // 在實際應用中，這裡會調用 API 獲取最新訂單
    
    // Reset pagination
    currentOrderPage.value = 1
    hasMoreOrders.value = orders.value.length >= orderPageSize.value
  } finally {
    isLoadingOrders.value = false
  }
}

const loadMoreKitchenOrders = async () => {
  if (isLoadingOrders.value || !hasMoreOrders.value) return
  
  isLoadingOrders.value = true
  try {
    currentOrderPage.value++
    
    // 模擬載入更多訂單
    console.log(`Loading more kitchen orders - page ${currentOrderPage.value}`)
    
    // 模擬新增一些訂單
    const newOrders = Array.from({ length: 5 }, (_, i) => ({
      id: orders.value.length + i + 1,
      orderNumber: `ORD-${String(orders.value.length + i + 1).padStart(3, '0')}`,
      tableNumber: `T${String((orders.value.length + i) % 10 + 1).padStart(2, '0')}`,
      status: ['pending', 'confirmed', 'preparing', 'ready'][Math.floor(Math.random() * 4)],
      priority: Math.random() > 0.7 ? 'high' : 'normal',
      createdAt: new Date(Date.now() - Math.random() * 30 * 60 * 1000).toISOString(),
      estimatedReadyTime: new Date(Date.now() + Math.random() * 20 * 60 * 1000).toISOString(),
      items: [{
        id: orders.value.length + i + 1,
        menuItemName: ['招牌炒飯', '冰奶茶', '春卷', '南洋咖啡'][Math.floor(Math.random() * 4)],
        quantity: Math.floor(Math.random() * 3) + 1,
        specialInstructions: Math.random() > 0.5 ? '不要蔥' : '',
        customizations: Math.random() > 0.5 ? { '辣度': '中辣' } : {}
      }]
    }))
    
    orders.value.push(...newOrders)
    
    // Check if there are more items to load
    hasMoreOrders.value = newOrders.length >= 5
  } finally {
    isLoadingOrders.value = false
  }
}

const onLoadMoreOrders = () => {
  console.log('Kitchen orders load more event triggered')
}

const getOrderCardClass = (order) => {
  const baseClass = 'bg-white'
  const statusClasses = {
    'pending': 'border-yellow-400',
    'confirmed': 'border-blue-400',
    'preparing': 'border-orange-400',
    'ready': 'border-green-400'
  }
  const priorityClass = order.priority === 'high' ? 'ring-2 ring-red-300' : ''
  return `${baseClass} ${statusClasses[order.status] || 'border-gray-400'} ${priorityClass}`
}

const getStatusIcon = (status: string) => {
  const icons = {
    'pending': ClockIcon,
    'confirmed': PlayIcon,
    'preparing': PlayIcon,
    'ready': CheckCircleIcon
  }
  return icons[status] || ClockIcon
}

const getStatusIconClass = (status: string) => {
  const classes = {
    'pending': 'bg-yellow-100 text-yellow-600',
    'confirmed': 'bg-blue-100 text-blue-600',
    'preparing': 'bg-orange-100 text-orange-600',
    'ready': 'bg-green-100 text-green-600'
  }
  return classes[status] || 'bg-gray-100 text-gray-600'
}

const getPriorityBadgeClass = (priority: string) => {
  return priority === 'high' 
    ? 'bg-red-100 text-red-800'
    : 'bg-gray-100 text-gray-600'
}

const getPriorityText = (priority: string) => {
  return priority === 'high' ? '緊急' : '普通'
}

const getTimeElapsed = (createdAt: string) => {
  const now = new Date()
  const created = new Date(createdAt)
  const diffInMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) return '剛下單'
  if (diffInMinutes < 60) return `${diffInMinutes} 分鐘前`
  const hours = Math.floor(diffInMinutes / 60)
  return `${hours} 小時前`
}

const formatTime = (dateTime: string) => {
  return new Date(dateTime).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const confirmOrder = async (order) => {
  const index = orders.value.findIndex(o => o.id === order.id)
  if (index > -1) {
    orders.value[index].status = 'confirmed'
    playNotificationSound()
  }
}

const startCooking = async (order) => {
  const index = orders.value.findIndex(o => o.id === order.id)
  if (index > -1) {
    orders.value[index].status = 'preparing'
    // 設置預計完成時間（例如：15分鐘後）
    orders.value[index].estimatedReadyTime = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  }
}

const markReady = async (order) => {
  const index = orders.value.findIndex(o => o.id === order.id)
  if (index > -1) {
    orders.value[index].status = 'ready'
    playNotificationSound()
  }
}

const markServed = async (order) => {
  const index = orders.value.findIndex(o => o.id === order.id)
  if (index > -1) {
    orders.value[index].status = 'served'
  }
}

const togglePriority = (order) => {
  const index = orders.value.findIndex(o => o.id === order.id)
  if (index > -1) {
    orders.value[index].priority = orders.value[index].priority === 'high' ? 'normal' : 'high'
  }
}

const playNotificationSound = () => {
  if (!soundEnabled.value) return
  
  try {
    notificationSound.value?.play()
  } catch (error) {
    console.log('Could not play notification sound:', error)
  }
}

const getEfficiencyColor = (score: number) => {
  if (score >= 90) return 'text-green-600'
  if (score >= 80) return 'text-yellow-600'
  return 'text-red-600'
}

// 計算預計完成時間（基於歷史數據和當前負載）
const calculateEstimatedTime = (order) => {
  const baseTime = 15 // 基礎時間15分鐘
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const complexityFactor = itemCount * 2 // 每個菜品增加2分鐘
  const loadFactor = Math.max(0, (workload.value - 50) * 0.2) // 高負載時增加時間
  
  return Math.round(baseTime + complexityFactor + loadFactor)
}

// 更新廚房統計數據
const updateKitchenStats = () => {
  // 模擬統計數據更新
  const completedToday = orders.value.filter(o => o.status === 'served').length
  const totalProcessed = completedToday + orderStats.value.preparing + orderStats.value.ready
  
  kitchenStats.value = {
    ...kitchenStats.value,
    todayCompleted: completedToday,
    workload: Math.min(100, (orderStats.value.preparing / 8) * 100), // 假設最大並發8單
    onTimeRate: Math.max(80, 100 - (orderStats.value.pending * 2)) // 待處理越多，準時率越低
  }
}

const toggleSound = () => {
  soundEnabled.value = !soundEnabled.value
}

// 生命周期
onMounted(() => {
  updateCurrentTime()
  timeInterval = setInterval(updateCurrentTime, 1000)
  
  // 設置自動刷新
  refreshInterval = setInterval(() => {
    if (isAutoRefresh.value) {
      refreshOrders()
      updateKitchenStats()
    }
  }, 10000) // 每10秒刷新一次
  
  // 初始化統計數據
  updateKitchenStats()
})

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval)
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<style scoped>
.kitchen-view {
  padding: 1.5rem;
  min-height: 100vh;
  background-color: #f9fafb;
}

@keyframes pulse-ring {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.ring-pulse {
  animation: pulse-ring 2s infinite;
}

@media (max-width: 640px) {
  .kitchen-view {
    padding: 1rem;
  }
}
</style>