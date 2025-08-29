<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Kitchen Header -->
    <KitchenHeader 
      :restaurant-name="restaurantName"
      :current-time="currentTime"
      :stats="stats"
      :connection-status="connectionStatus"
      :is-connected="isConnected"
      @logout="handleLogout"
      @refresh="handleRefresh"
      @reconnect="reconnectSSE"
      @toggle-fullscreen="toggleFullscreen"
    />

    <!-- Main Content -->
    <main class="container mx-auto px-4 py-6">
      <!-- Stats Bar -->
      <div class="mb-6">
        <OrderStats 
          :stats="stats"
          :loading="isLoading"
          @refresh="handleRefresh"
        />
      </div>

      <!-- Orders Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Pending Orders -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold text-gray-900 flex items-center">
              <ClockIcon class="w-6 h-6 mr-2 text-yellow-500" />
              待處理訂單
              <span class="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-sm">
                {{ pendingOrders.length }}
              </span>
            </h2>
          </div>
          
          <div class="space-y-3 max-h-96 overflow-y-auto">
            <OrderCard
              v-for="order in pendingOrders"
              :key="order.id"
              :order="order"
              status-type="pending"
              @start-cooking="handleStartCooking"
              @mark-ready="handleMarkReady"
              @view-details="handleViewDetails"
            />
            
            <div v-if="pendingOrders.length === 0" class="text-center py-8 text-gray-500">
              <ClockIcon class="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>目前沒有待處理的訂單</p>
            </div>
          </div>
        </div>

        <!-- Preparing Orders -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold text-gray-900 flex items-center">
              <FireIcon class="w-6 h-6 mr-2 text-blue-500" />
              製作中訂單
              <span class="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                {{ preparingOrders.length }}
              </span>
            </h2>
          </div>
          
          <div class="space-y-3 max-h-96 overflow-y-auto">
            <OrderCard
              v-for="order in preparingOrders"
              :key="order.id"
              :order="order"
              status-type="preparing"
              @start-cooking="handleStartCooking"
              @mark-ready="handleMarkReady"
              @view-details="handleViewDetails"
            />
            
            <div v-if="preparingOrders.length === 0" class="text-center py-8 text-gray-500">
              <FireIcon class="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>目前沒有正在製作的訂單</p>
            </div>
          </div>
        </div>

        <!-- Ready Orders -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold text-gray-900 flex items-center">
              <CheckCircleIcon class="w-6 h-6 mr-2 text-green-500" />
              準備完成
              <span class="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">
                {{ readyOrders.length }}
              </span>
            </h2>
          </div>
          
          <div class="space-y-3 max-h-96 overflow-y-auto">
            <OrderCard
              v-for="order in readyOrders"
              :key="order.id"
              :order="order"
              status-type="ready"
              @start-cooking="handleStartCooking"
              @mark-ready="handleMarkReady"
              @view-details="handleViewDetails"
            />
            
            <div v-if="readyOrders.length === 0" class="text-center py-8 text-gray-500">
              <CheckCircleIcon class="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>目前沒有準備完成的訂單</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading Overlay -->
      <div
        v-if="isLoading && orders.length === 0"
        class="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50"
      >
        <div class="text-center">
          <div class="loading-spinner w-12 h-12 mx-auto mb-4"></div>
          <p class="text-lg text-gray-600">載入廚房訂單中...</p>
        </div>
      </div>
    </main>

    <!-- Order Details Modal -->
    <OrderDetailsModal
      v-if="selectedOrder"
      :order="selectedOrder"
      :show="showDetailsModal"
      @close="showDetailsModal = false"
      @update-status="handleUpdateOrderStatus"
    />

    <!-- Connection Status Monitor -->
    <ConnectionStatus
      :connection-status="connectionStatus"
      :is-connected="isConnected"
      :reconnect-attempts="reconnectAttempts"
      :last-heartbeat="lastHeartbeat"
      @reconnect="reconnectSSE"
      @refresh="handleRefresh"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { 
  ClockIcon, 
  FireIcon, 
  CheckCircleIcon 
} from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useOrdersStore } from '@/stores/orders'
import { useKitchenSSE } from '@/composables/useKitchenSSE'
import type { KitchenOrder, KitchenStats } from '@/types'

// Components (will be created)
import KitchenHeader from '@/components/layout/KitchenHeader.vue'
import OrderStats from '@/components/stats/OrderStats.vue'
import OrderCard from '@/components/orders/OrderCard.vue'
import OrderDetailsModal from '@/components/orders/OrderDetailsModal.vue'
import ConnectionStatus from '@/components/common/ConnectionStatus.vue'

// Props
const props = defineProps<{
  restaurantId: number
}>()

// Composables
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const ordersStore = useOrdersStore()

// SSE 連接
const {
  connectionStatus,
  isConnected,
  lastHeartbeat,
  reconnectAttempts,
  connect: connectSSE,
  disconnect: disconnectSSE,
  reconnect: reconnectSSE
} = useKitchenSSE({
  restaurantId: props.restaurantId,
  onNewOrder: (event) => {
    console.log('New order received via SSE:', event)
    ordersStore.handleSSEEvent(event)
  },
  onOrderUpdate: (event) => {
    console.log('Order update received via SSE:', event)
    ordersStore.handleSSEEvent(event)
  },
  onOrderCancelled: (event) => {
    console.log('Order cancelled received via SSE:', event)
    ordersStore.handleSSEEvent(event)
  },
  onPriorityUpdate: (event) => {
    console.log('Priority update received via SSE:', event)
    ordersStore.handleSSEEvent(event)
  },
  autoConnect: true
})

// State
const currentTime = ref(new Date())
const selectedOrder = ref<KitchenOrder | null>(null)
const showDetailsModal = ref(false)

// Computed
const restaurantName = computed(() => authStore.user?.name || '廚房系統')

// 使用 store 中的 computed 值
const { 
  orders, 
  stats, 
  loading: isLoading, 
  error: ordersError,
  pendingOrders, 
  preparingOrders, 
  readyOrders 
} = storeToRefs(ordersStore)

// Methods
const fetchOrders = async () => {
  try {
    await ordersStore.fetchOrders(props.restaurantId)
    
    if (ordersError.value) {
      toast.error('載入訂單失敗：' + ordersError.value)
    }
  } catch (error: any) {
    console.error('Failed to fetch orders:', error)
    toast.error('載入訂單失敗：' + error.message)
  }
}

const handleStartCooking = async (orderId: number, itemId: number) => {
  try {
    await ordersStore.startCooking(props.restaurantId, orderId, itemId)
    toast.success('開始製作！')
  } catch (error: any) {
    toast.error('操作失敗：' + error.message)
  }
}

const handleMarkReady = async (orderId: number, itemId: number) => {
  try {
    await ordersStore.markReady(props.restaurantId, orderId, itemId)
    toast.success('餐點已完成！')
  } catch (error: any) {
    toast.error('操作失敗：' + error.message)
  }
}

const handleViewDetails = (order: KitchenOrder) => {
  selectedOrder.value = order
  showDetailsModal.value = true
}

const handleUpdateOrderStatus = async (orderId: number, status: any) => {
  try {
    // TODO: API 調用
    await fetchOrders()
    showDetailsModal.value = false
  } catch (error: any) {
    toast.error('更新狀態失敗：' + error.message)
  }
}

const handleLogout = async () => {
  try {
    await authStore.logout()
    await router.push('/login')
    toast.success('已登出')
  } catch (error: any) {
    toast.error('登出失敗：' + error.message)
  }
}

const handleRefresh = async () => {
  await fetchOrders()
}

const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    document.documentElement.requestFullscreen()
  }
}

const updateCurrentTime = () => {
  currentTime.value = new Date()
}

// Auto-refresh logic
let refreshInterval: NodeJS.Timeout | null = null

const startAutoRefresh = () => {
  if (settingsStore.autoRefresh && refreshInterval === null) {
    refreshInterval = setInterval(() => {
      fetchOrders()
    }, settingsStore.refreshInterval * 1000)
  }
}

const stopAutoRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}

// 生命週期
onMounted(async () => {
  // 檢查認證
  if (!authStore.isAuthenticated || !authStore.isChef) {
    await router.push('/login')
    return
  }

  // 檢查餐廳權限
  if (authStore.restaurantId !== props.restaurantId) {
    await router.push('/unauthorized')
    return
  }

  // 初始載入
  await fetchOrders()
  
  // 開始自動刷新
  startAutoRefresh()
  
  // 開始時間更新
  const timeInterval = setInterval(updateCurrentTime, 1000)
  
  // 清理函數
  onUnmounted(() => {
    stopAutoRefresh()
    clearInterval(timeInterval)
  })
})
</script>