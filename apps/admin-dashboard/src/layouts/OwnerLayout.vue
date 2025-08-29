<template>
  <div class="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
    <!-- 頂部導航 -->
    <header class="bg-white shadow-lg border-b border-purple-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo 和標題 -->
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <BuildingStorefrontIcon class="h-8 w-8 text-purple-600" />
            </div>
            <div class="ml-4">
              <h1 class="text-xl font-bold text-gray-900">店主管理中心</h1>
              <p class="text-sm text-gray-600">{{ currentRestaurant?.name || 'MakanMakan' }}</p>
            </div>
          </div>

          <!-- 快速功能 -->
          <div class="flex items-center space-x-4">
            <!-- 通知 -->
            <button @click="showNotifications = !showNotifications" 
                    class="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-lg">
              <BellIcon class="h-6 w-6" />
              <span v-if="unreadNotifications > 0" 
                    class="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">
                {{ unreadNotifications }}
              </span>
            </button>

            <!-- 即時狀態 -->
            <div class="flex items-center space-x-2 px-3 py-1 bg-green-100 rounded-full">
              <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span class="text-sm font-medium text-green-800">營業中</span>
            </div>

            <!-- 用戶資訊 -->
            <div class="flex items-center">
              <div class="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                <span class="text-sm font-medium text-white">店</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- 主要導航選項卡 -->
    <nav class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex space-x-8">
          <button v-for="tab in tabs" :key="tab.key"
                  @click="activeTab = tab.key"
                  :class="[
                    'flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors duration-200',
                    activeTab === tab.key
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  ]">
            <component :is="tab.icon" class="w-5 h-5 mr-2" />
            {{ tab.label }}
          </button>
        </div>
      </div>
    </nav>

    <!-- 主要內容區域 -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <router-view :key="$route.fullPath" />
    </main>

    <!-- 通知面板 -->
    <Teleport to="body">
      <div v-if="showNotifications" 
           class="fixed inset-0 bg-black bg-opacity-25 z-50"
           @click="showNotifications = false">
        <div class="absolute right-0 top-16 w-96 max-h-96 bg-white shadow-2xl rounded-bl-lg overflow-hidden"
             @click.stop>
          <div class="p-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900">系統通知</h3>
          </div>
          <div class="overflow-y-auto max-h-80">
            <div v-for="notification in notifications" :key="notification.id"
                 class="p-4 border-b border-gray-100 hover:bg-gray-50">
              <div class="flex items-start">
                <div :class="[
                  'flex-shrink-0 w-2 h-2 mt-2 rounded-full',
                  notification.type === 'urgent' ? 'bg-red-500' :
                  notification.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                ]"></div>
                <div class="ml-3 flex-1">
                  <p class="text-sm text-gray-900">{{ notification.message }}</p>
                  <p class="text-xs text-gray-500 mt-1">{{ notification.time }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 緊急狀況浮動按鈕 -->
    <div class="fixed bottom-6 right-6">
      <button @click="handleEmergency"
              class="w-14 h-14 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors duration-200">
        <ExclamationTriangleIcon class="w-6 h-6" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  BuildingStorefrontIcon,
  BellIcon,
  ChartBarIcon,
  UsersIcon,
  Cog6ToothIcon,
  CurrencyDollarIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  ChartPieIcon
} from '@heroicons/vue/24/outline'

const activeTab = ref('overview')
const showNotifications = ref(false)
const unreadNotifications = ref(3)
const currentRestaurant = ref({ name: 'MakanMakan 旗艦店' })

const tabs = [
  { key: 'overview', label: '總覽儀表板', icon: ChartPieIcon },
  { key: 'analytics', label: '營運分析', icon: ChartBarIcon },
  { key: 'staff', label: '員工管理', icon: UsersIcon },
  { key: 'finance', label: '財務報表', icon: CurrencyDollarIcon },
  { key: 'operations', label: '營運管理', icon: ClipboardDocumentListIcon },
  { key: 'settings', label: '店鋪設定', icon: Cog6ToothIcon }
]

const notifications = ref([
  {
    id: 1,
    type: 'urgent',
    message: '廚房設備異常，需要立即處理',
    time: '2 分鐘前'
  },
  {
    id: 2,
    type: 'warning', 
    message: '庫存不足：牛肉剩餘 5 份',
    time: '15 分鐘前'
  },
  {
    id: 3,
    type: 'info',
    message: '今日營業額已達 85% 目標',
    time: '1 小時前'
  }
])

const handleEmergency = () => {
  // 處理緊急狀況
  console.log('Emergency button clicked')
}

onMounted(() => {
  // 初始化數據
})
</script>