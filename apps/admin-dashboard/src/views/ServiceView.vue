<template>
  <div class="service-view">
    <!-- 送菜員控制台標題 -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">送菜服務台</h1>
        <p class="text-gray-600">管理餐點配送和桌台服務</p>
      </div>
      <div class="flex items-center space-x-4">
        <!-- 個人績效 -->
        <div class="bg-green-100 px-4 py-2 rounded-lg">
          <p class="text-sm text-green-800 font-medium">今日配送: {{ todayDelivered }}單</p>
          <p class="text-xs text-green-600">效率: {{ deliveryEfficiency }}%</p>
        </div>
        
        <!-- 當前時間 -->
        <div class="text-right">
          <p class="text-sm text-gray-500">當前時間</p>
          <p class="text-lg font-semibold">{{ currentTime }}</p>
        </div>
        
        <!-- 刷新按鈕 -->
        <button
          @click="refreshOrders"
          class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowPathIcon class="h-4 w-4 mr-2" />
          刷新
        </button>
      </div>
    </div>

    <!-- 快速狀態總覽 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-orange-100 rounded-lg p-6 border-l-4 border-orange-500">
        <div class="flex items-center">
          <TruckIcon class="h-8 w-8 text-orange-600 mr-3" />
          <div>
            <p class="text-sm font-medium text-orange-800">待配送</p>
            <p class="text-2xl font-bold text-orange-900">{{ orderStats.readyForDelivery }}</p>
          </div>
        </div>
      </div>

      <div class="bg-blue-100 rounded-lg p-6 border-l-4 border-blue-500">
        <div class="flex items-center">
          <MapIcon class="h-8 w-8 text-blue-600 mr-3" />
          <div>
            <p class="text-sm font-medium text-blue-800">配送中</p>
            <p class="text-2xl font-bold text-blue-900">{{ orderStats.delivering }}</p>
          </div>
        </div>
      </div>

      <div class="bg-green-100 rounded-lg p-6 border-l-4 border-green-500">
        <div class="flex items-center">
          <CheckCircleIcon class="h-8 w-8 text-green-600 mr-3" />
          <div>
            <p class="text-sm font-medium text-green-800">已送達</p>
            <p class="text-2xl font-bold text-green-900">{{ orderStats.delivered }}</p>
          </div>
        </div>
      </div>

      <div class="bg-purple-100 rounded-lg p-6 border-l-4 border-purple-500">
        <div class="flex items-center">
          <ClockIcon class="h-8 w-8 text-purple-600 mr-3" />
          <div>
            <p class="text-sm font-medium text-purple-800">平均配送時間</p>
            <p class="text-2xl font-bold text-purple-900">{{ avgDeliveryTime }}分</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要工作區域 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- 左側：待配送訂單 -->
      <div class="lg:col-span-2">
        <div class="bg-white rounded-lg shadow">
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">待配送訂單</h2>
              <div class="flex items-center space-x-3">
                <!-- 桌台篩選 -->
                <select 
                  v-model="selectedTable" 
                  class="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">所有桌台</option>
                  <option v-for="table in availableTables" :key="table" :value="table">
                    桌號 {{ table }}
                  </option>
                </select>
                
                <!-- 優先級篩選 -->
                <select 
                  v-model="selectedPriority" 
                  class="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">所有優先級</option>
                  <option value="high">緊急</option>
                  <option value="normal">普通</option>
                </select>
              </div>
            </div>
          </div>

          <div class="divide-y divide-gray-200">
            <div
              v-for="order in filteredOrders"
              :key="order.id"
              class="p-6 hover:bg-gray-50 transition-colors"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <!-- 訂單標題 -->
                  <div class="flex items-center mb-3">
                    <div class="flex items-center">
                      <div :class="getStatusIconClass(order.status)" class="p-2 rounded-full mr-3">
                        <component :is="getStatusIcon(order.status)" class="h-5 w-5" />
                      </div>
                      <div>
                        <h3 class="text-lg font-bold text-gray-900">{{ order.orderNumber }}</h3>
                        <p class="text-sm text-gray-600">
                          {{ order.orderType === 'dine_in' ? `桌號 ${order.tableNumber}` : '外帶/外送' }}
                        </p>
                      </div>
                    </div>
                    <div class="ml-4 flex items-center space-x-2">
                      <span :class="getPriorityBadgeClass(order.priority)" class="px-2 py-1 rounded-full text-xs font-medium">
                        {{ getPriorityText(order.priority) }}
                      </span>
                      <span class="text-xs text-gray-500">{{ getTimeElapsed(order.readyAt) }}</span>
                    </div>
                  </div>

                  <!-- 訂單項目 -->
                  <div class="bg-gray-50 rounded-lg p-3 mb-3">
                    <div class="space-y-2">
                      <div
                        v-for="item in order.items"
                        :key="item.id"
                        class="flex items-center justify-between text-sm"
                      >
                        <div class="flex items-center">
                          <span class="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 rounded-full font-semibold text-xs mr-2">
                            {{ item.quantity }}
                          </span>
                          <span class="font-medium">{{ item.menuItemName }}</span>
                          <div v-if="item.specialInstructions" class="ml-2 text-orange-600">
                            <ExclamationTriangleIcon class="w-4 h-4 inline mr-1" />
                            <span class="text-xs">{{ item.specialInstructions }}</span>
                          </div>
                        </div>
                        <div v-if="item.customizations && Object.keys(item.customizations).length > 0" class="flex flex-wrap gap-1">
                          <span
                            v-for="(value, key) in item.customizations"
                            :key="key"
                            class="inline-block px-1 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded"
                          >
                            {{ key }}: {{ value }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 客戶信息 -->
                  <div v-if="order.customerInfo" class="text-sm text-gray-600 mb-3">
                    <div class="flex items-center">
                      <UserIcon class="w-4 h-4 mr-1" />
                      <span>{{ order.customerInfo.name }}</span>
                      <span v-if="order.customerInfo.phone" class="ml-2">
                        | 📱 {{ order.customerInfo.phone }}
                      </span>
                    </div>
                  </div>

                  <!-- 特殊要求 -->
                  <div v-if="order.deliveryNotes" class="bg-yellow-50 border border-yellow-200 rounded p-2 mb-3">
                    <div class="flex items-start">
                      <ExclamationCircleIcon class="w-4 h-4 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                      <p class="text-sm text-yellow-800">{{ order.deliveryNotes }}</p>
                    </div>
                  </div>
                </div>

                <!-- 操作按鈕 -->
                <div class="ml-6 flex flex-col space-y-2">
                  <button
                    v-if="order.status === 'ready'"
                    @click="startDelivery(order)"
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm whitespace-nowrap"
                  >
                    開始配送
                  </button>
                  <button
                    v-else-if="order.status === 'delivering'"
                    @click="completeDelivery(order)"
                    class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm whitespace-nowrap"
                  >
                    確認送達
                  </button>
                  
                  <!-- 輔助按鈕 -->
                  <button
                    @click="contactCustomer(order)"
                    class="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-xs"
                  >
                    聯絡客戶
                  </button>
                  <button
                    @click="reportIssue(order)"
                    class="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-xs"
                  >
                    回報問題
                  </button>
                </div>
              </div>
            </div>

            <!-- 空狀態 -->
            <div v-if="filteredOrders.length === 0" class="p-12 text-center">
              <CheckCircleIcon class="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 class="text-xl font-medium text-gray-900 mb-2">沒有待配送的訂單</h3>
              <p class="text-gray-500">所有餐點都已送達！</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 右側：今日配送記錄和個人統計 -->
      <div class="space-y-6">
        <!-- 配送中的訂單 -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
              我的配送中訂單 ({{ myActiveDeliveries.length }})
            </h3>
            
            <div v-if="myActiveDeliveries.length > 0" class="space-y-3">
              <div
                v-for="delivery in myActiveDeliveries"
                :key="delivery.id"
                class="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
              >
                <div>
                  <p class="font-medium text-gray-900">{{ delivery.orderNumber }}</p>
                  <p class="text-sm text-gray-600">桌號 {{ delivery.tableNumber }}</p>
                  <p class="text-xs text-blue-600">開始時間: {{ formatTime(delivery.deliveryStartTime) }}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-medium text-blue-800">
                    {{ getDeliveryDuration(delivery.deliveryStartTime) }}
                  </p>
                  <button
                    @click="completeDelivery(delivery)"
                    class="mt-1 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                  >
                    送達
                  </button>
                </div>
              </div>
            </div>
            
            <div v-else class="text-center py-6">
              <TruckIcon class="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p class="text-gray-500 text-sm">目前沒有配送中的訂單</p>
            </div>
          </div>
        </div>

        <!-- 今日個人績效 -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">今日個人績效</h3>
            
            <div class="space-y-4">
              <!-- 績效指標 -->
              <div class="grid grid-cols-2 gap-4">
                <div class="text-center p-3 bg-green-50 rounded">
                  <p class="text-sm text-green-600">完成配送</p>
                  <p class="text-2xl font-bold text-green-800">{{ todayStats.completed }}</p>
                </div>
                <div class="text-center p-3 bg-blue-50 rounded">
                  <p class="text-sm text-blue-600">平均時間</p>
                  <p class="text-2xl font-bold text-blue-800">{{ todayStats.avgTime }}分</p>
                </div>
                <div class="text-center p-3 bg-purple-50 rounded">
                  <p class="text-sm text-purple-600">準時率</p>
                  <p class="text-2xl font-bold text-purple-800">{{ todayStats.onTimeRate }}%</p>
                </div>
                <div class="text-center p-3 bg-yellow-50 rounded">
                  <p class="text-sm text-yellow-600">客戶評價</p>
                  <p class="text-2xl font-bold text-yellow-800">{{ todayStats.rating }}/5</p>
                </div>
              </div>
              
              <!-- 效率進度條 -->
              <div>
                <div class="flex justify-between text-sm mb-1">
                  <span class="text-gray-600">服務效率</span>
                  <span class="font-medium">{{ deliveryEfficiency }}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    class="h-2 rounded-full transition-all duration-300"
                    :class="deliveryEfficiency >= 90 ? 'bg-green-500' : deliveryEfficiency >= 70 ? 'bg-yellow-500' : 'bg-red-500'"
                    :style="{ width: `${deliveryEfficiency}%` }"
                  ></div>
                </div>
              </div>
            </div>
            
            <!-- 今日時間軸 -->
            <div class="mt-6">
              <h4 class="text-sm font-medium text-gray-900 mb-3">今日配送時間軸</h4>
              <div class="space-y-2 max-h-48 overflow-y-auto">
                <div
                  v-for="record in todayDeliveryRecords"
                  :key="record.id"
                  class="flex items-center text-sm"
                >
                  <div class="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  <span class="text-gray-600 text-xs">{{ formatTime(record.completedAt) }}</span>
                  <span class="ml-2 font-medium">{{ record.orderNumber }}</span>
                  <span class="ml-auto text-gray-500 text-xs">{{ record.duration }}分</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 聯絡客戶模態框 -->
    <div v-if="showContactDialog" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="fixed inset-0 bg-black opacity-30" @click="closeContactDialog"></div>
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">聯絡客戶</h3>
            <button @click="closeContactDialog" class="text-gray-400 hover:text-gray-600">
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>
          
          <div v-if="selectedOrderForContact" class="space-y-4">
            <div>
              <p class="text-sm text-gray-600">訂單編號</p>
              <p class="font-medium">{{ selectedOrderForContact.orderNumber }}</p>
            </div>
            
            <div v-if="selectedOrderForContact.customerInfo">
              <p class="text-sm text-gray-600">客戶信息</p>
              <p class="font-medium">{{ selectedOrderForContact.customerInfo.name }}</p>
              <p class="text-sm text-gray-500" v-if="selectedOrderForContact.customerInfo.phone">
                📱 {{ selectedOrderForContact.customerInfo.phone }}
              </p>
            </div>
            
            <div class="flex space-x-2">
              <button
                @click="makePhoneCall"
                class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                撥打電話
              </button>
              <button
                @click="sendMessage"
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                發送訊息
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 問題回報模態框 -->
    <div v-if="showIssueDialog" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="fixed inset-0 bg-black opacity-30" @click="closeIssueDialog"></div>
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">回報問題</h3>
            <button @click="closeIssueDialog" class="text-gray-400 hover:text-gray-600">
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">問題類型</label>
              <select 
                v-model="issueData.type"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">請選擇問題類型</option>
                <option value="wrong_order">訂單錯誤</option>
                <option value="missing_items">缺少餐點</option>
                <option value="quality_issue">餐點品質問題</option>
                <option value="customer_unavailable">客戶無法聯絡</option>
                <option value="access_issue">無法到達桌台</option>
                <option value="other">其他問題</option>
              </select>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">問題描述</label>
              <textarea
                v-model="issueData.description"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="請詳細描述遇到的問題..."
              ></textarea>
            </div>
            
            <div class="flex justify-end space-x-3">
              <button
                @click="closeIssueDialog"
                class="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                @click="submitIssue"
                :disabled="!issueData.type || !issueData.description"
                class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                回報問題
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  ArrowPathIcon,
  TruckIcon,
  MapIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  UserIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'

// 響應式數據
const currentTime = ref('')
const selectedTable = ref('')
const selectedPriority = ref('')
const todayDelivered = ref(12)
const deliveryEfficiency = ref(87)
const avgDeliveryTime = ref(8)

// 模態框狀態
const showContactDialog = ref(false)
const showIssueDialog = ref(false)
const selectedOrderForContact = ref(null)

// 問題回報數據
const issueData = ref({
  orderId: null,
  type: '',
  description: ''
})

let timeInterval = null

// 模擬訂單數據
const orders = ref([
  {
    id: 1,
    orderNumber: 'ORD-001',
    tableNumber: 'T01',
    orderType: 'dine_in',
    status: 'ready',
    priority: 'normal',
    readyAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    deliveryStartTime: null,
    customerInfo: {
      name: '張先生',
      phone: '012-345-6789'
    },
    deliveryNotes: '請小心，有小朋友',
    items: [
      {
        id: 1,
        menuItemName: '招牌炒飯',
        quantity: 2,
        specialInstructions: '不要蔥',
        customizations: { '辣度': '中辣' }
      },
      {
        id: 2,
        menuItemName: '冰奶茶',
        quantity: 1,
        specialInstructions: '',
        customizations: { '甜度': '半糖' }
      }
    ]
  },
  {
    id: 2,
    orderNumber: 'ORD-002',
    tableNumber: 'T03',
    orderType: 'dine_in',
    status: 'delivering',
    priority: 'high',
    readyAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    deliveryStartTime: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    assignedTo: 'current_user', // 假設當前用戶ID
    customerInfo: {
      name: '李小姐',
      phone: '016-789-0123'
    },
    items: [
      {
        id: 3,
        menuItemName: '春卷',
        quantity: 3,
        specialInstructions: '要蘸醬',
        customizations: {}
      }
    ]
  },
  {
    id: 3,
    orderNumber: 'ORD-003',
    tableNumber: 'T05',
    orderType: 'dine_in',
    status: 'ready',
    priority: 'normal',
    readyAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    customerInfo: {
      name: '王先生',
      phone: '019-456-7890'
    },
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

// 今日配送記錄
const todayDeliveryRecords = ref([
  { id: 1, orderNumber: 'ORD-010', completedAt: '10:30', duration: 6 },
  { id: 2, orderNumber: 'ORD-011', completedAt: '11:15', duration: 8 },
  { id: 3, orderNumber: 'ORD-012', completedAt: '12:05', duration: 7 },
  { id: 4, orderNumber: 'ORD-013', completedAt: '13:20', duration: 5 }
])

// 計算屬性
const orderStats = computed(() => ({
  readyForDelivery: orders.value.filter(o => o.status === 'ready').length,
  delivering: orders.value.filter(o => o.status === 'delivering').length,
  delivered: orders.value.filter(o => o.status === 'delivered').length
}))

const availableTables = computed(() => {
  const tables = new Set(orders.value.map(o => o.tableNumber).filter(Boolean))
  return Array.from(tables).sort()
})

const filteredOrders = computed(() => {
  let filtered = orders.value.filter(o => ['ready', 'delivering'].includes(o.status))

  if (selectedTable.value) {
    filtered = filtered.filter(o => o.tableNumber === selectedTable.value)
  }

  if (selectedPriority.value) {
    filtered = filtered.filter(o => o.priority === selectedPriority.value)
  }

  // 按優先級和時間排序
  return filtered.sort((a, b) => {
    // 優先級排序
    if (a.priority === 'high' && b.priority !== 'high') return -1
    if (b.priority === 'high' && a.priority !== 'high') return 1
    // 時間排序
    return new Date(a.readyAt).getTime() - new Date(b.readyAt).getTime()
  })
})

const myActiveDeliveries = computed(() => {
  return orders.value.filter(o => 
    o.status === 'delivering' && o.assignedTo === 'current_user'
  )
})

const todayStats = computed(() => ({
  completed: todayDelivered.value,
  avgTime: avgDeliveryTime.value,
  onTimeRate: 92,
  rating: 4.8
}))

// 方法
const updateCurrentTime = () => {
  currentTime.value = new Date().toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const refreshOrders = async () => {
  console.log('Refreshing service orders...')
  // 實際應用中會調用API獲取最新訂單
}

const startDelivery = async (order) => {
  try {
    const index = orders.value.findIndex(o => o.id === order.id)
    if (index > -1) {
      orders.value[index].status = 'delivering'
      orders.value[index].deliveryStartTime = new Date().toISOString()
      orders.value[index].assignedTo = 'current_user'
    }
  } catch (error) {
    console.error('Start delivery error:', error)
  }
}

const completeDelivery = async (order) => {
  try {
    const index = orders.value.findIndex(o => o.id === order.id)
    if (index > -1) {
      orders.value[index].status = 'delivered'
      orders.value[index].deliveredAt = new Date().toISOString()
      
      // 更新統計
      todayDelivered.value++
      
      // 添加到今日記錄
      const duration = Math.round((new Date().getTime() - new Date(order.deliveryStartTime).getTime()) / (1000 * 60))
      todayDeliveryRecords.value.unshift({
        id: Date.now(),
        orderNumber: order.orderNumber,
        completedAt: formatTime(new Date().toISOString()),
        duration
      })
    }
  } catch (error) {
    console.error('Complete delivery error:', error)
  }
}

const contactCustomer = (order) => {
  selectedOrderForContact.value = order
  showContactDialog.value = true
}

const reportIssue = (order) => {
  issueData.value.orderId = order.id
  showIssueDialog.value = true
}

const closeContactDialog = () => {
  showContactDialog.value = false
  selectedOrderForContact.value = null
}

const closeIssueDialog = () => {
  showIssueDialog.value = false
  issueData.value = {
    orderId: null,
    type: '',
    description: ''
  }
}

const makePhoneCall = () => {
  if (selectedOrderForContact.value?.customerInfo?.phone) {
    alert(`撥打電話給 ${selectedOrderForContact.value.customerInfo.name}: ${selectedOrderForContact.value.customerInfo.phone}`)
  }
  closeContactDialog()
}

const sendMessage = () => {
  if (selectedOrderForContact.value?.customerInfo?.phone) {
    alert(`發送簡訊給 ${selectedOrderForContact.value.customerInfo.name}`)
  }
  closeContactDialog()
}

const submitIssue = () => {
  if (!issueData.value.type || !issueData.value.description) return
  
  alert(`問題已回報：\n類型：${getIssueTypeText(issueData.value.type)}\n描述：${issueData.value.description}`)
  closeIssueDialog()
}

// 輔助方法
const getStatusIcon = (status: string) => {
  const icons = {
    'ready': TruckIcon,
    'delivering': MapIcon,
    'delivered': CheckCircleIcon
  }
  return icons[status] || TruckIcon
}

const getStatusIconClass = (status: string) => {
  const classes = {
    'ready': 'bg-orange-100 text-orange-600',
    'delivering': 'bg-blue-100 text-blue-600',
    'delivered': 'bg-green-100 text-green-600'
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

const getTimeElapsed = (dateTime: string) => {
  const now = new Date()
  const time = new Date(dateTime)
  const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) return '剛準備好'
  if (diffInMinutes < 60) return `${diffInMinutes} 分鐘前`
  const hours = Math.floor(diffInMinutes / 60)
  return `${hours} 小時前`
}

const getDeliveryDuration = (startTime: string) => {
  const now = new Date()
  const start = new Date(startTime)
  const diffInMinutes = Math.floor((now.getTime() - start.getTime()) / (1000 * 60))
  return `${diffInMinutes} 分鐘`
}

const formatTime = (dateTime: string | Date) => {
  const date = typeof dateTime === 'string' ? new Date(dateTime) : dateTime
  return date.toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getIssueTypeText = (type: string) => {
  const types = {
    'wrong_order': '訂單錯誤',
    'missing_items': '缺少餐點',
    'quality_issue': '餐點品質問題',
    'customer_unavailable': '客戶無法聯絡',
    'access_issue': '無法到達桌台',
    'other': '其他問題'
  }
  return types[type] || type
}

// 生命週期
onMounted(() => {
  updateCurrentTime()
  timeInterval = setInterval(updateCurrentTime, 1000)
})

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval)
})
</script>

<style scoped>
.service-view {
  padding: 1.5rem;
  min-height: 100vh;
  background-color: #f9fafb;
}

@media (max-width: 640px) {
  .service-view {
    padding: 1rem;
  }
}
</style>