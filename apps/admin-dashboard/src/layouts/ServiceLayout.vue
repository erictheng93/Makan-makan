<template>
  <div class="service-layout min-h-screen bg-gray-100">
    <!-- 頂部導航欄 -->
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <!-- 左側 Logo 和標題 -->
          <div class="flex items-center">
            <div class="flex-shrink-0 flex items-center">
              <TruckIcon class="h-8 w-8 text-blue-600 mr-3" />
              <h1 class="text-xl font-bold text-gray-900">MakanMakan</h1>
              <span class="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                送菜員
              </span>
            </div>
            
            <!-- 快速狀態指示 -->
            <div class="hidden sm:flex ml-8 items-center space-x-4">
              <div class="flex items-center text-sm">
                <div class="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                <span class="text-gray-600">待配送: {{ pendingCount }}</span>
              </div>
              <div class="flex items-center text-sm">
                <div class="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                <span class="text-gray-600">配送中: {{ deliveringCount }}</span>
              </div>
            </div>
          </div>

          <!-- 右側用戶信息和操作 -->
          <div class="flex items-center space-x-4">
            <!-- 通知指示器 -->
            <button 
              @click="toggleNotifications" 
              class="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <BellIcon class="h-6 w-6" />
              <span v-if="unreadNotifications > 0" 
                    class="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {{ unreadNotifications }}
              </span>
            </button>

            <!-- 今日績效快顯 -->
            <div class="hidden sm:flex items-center bg-green-50 px-3 py-1 rounded-full">
              <TrophyIcon class="h-4 w-4 text-green-600 mr-1" />
              <span class="text-sm font-medium text-green-800">今日: {{ todayDelivered }}單</span>
            </div>

            <!-- 用戶下拉選單 -->
            <div class="relative">
              <button
                @click="toggleUserMenu"
                class="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div class="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserIcon class="h-5 w-5 text-blue-600" />
                </div>
                <span class="hidden sm:block ml-2 text-gray-700 font-medium">{{ currentUser.name }}</span>
                <ChevronDownIcon class="hidden sm:block ml-1 h-4 w-4 text-gray-500" />
              </button>

              <!-- 下拉選單 -->
              <div v-if="showUserMenu" 
                   class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                <div class="px-4 py-2 border-b border-gray-200">
                  <p class="text-sm font-medium text-gray-900">{{ currentUser.name }}</p>
                  <p class="text-sm text-gray-500">送菜員</p>
                </div>
                <button
                  @click="openProfile"
                  class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  個人資料
                </button>
                <button
                  @click="openSettings"
                  class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  設定
                </button>
                <div class="border-t border-gray-200"></div>
                <button
                  @click="logout"
                  class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  登出
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <!-- 主要內容區域 -->
    <main class="flex-1">
      <router-view />
    </main>

    <!-- 通知面板 -->
    <div v-if="showNotifications" 
         class="fixed inset-0 z-50 overflow-hidden">
      <div class="absolute inset-0 bg-black bg-opacity-25" @click="closeNotifications"></div>
      <div class="absolute right-0 top-0 h-full w-96 bg-white shadow-xl">
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">通知</h3>
          <button @click="closeNotifications" class="text-gray-400 hover:text-gray-500">
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>
        
        <div class="overflow-y-auto h-full pb-20">
          <div v-if="notifications.length === 0" class="p-8 text-center">
            <BellIcon class="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p class="text-gray-500">沒有新通知</p>
          </div>
          
          <div v-else class="divide-y divide-gray-200">
            <div
              v-for="notification in notifications"
              :key="notification.id"
              @click="handleNotificationClick(notification)"
              class="p-4 hover:bg-gray-50 cursor-pointer"
              :class="{ 'bg-blue-50': !notification.read }"
            >
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <component :is="getNotificationIcon(notification.type)" 
                           :class="getNotificationIconClass(notification.type)"
                           class="h-6 w-6" />
                </div>
                <div class="ml-3 flex-1">
                  <p class="text-sm font-medium text-gray-900">{{ notification.title }}</p>
                  <p class="text-sm text-gray-600 mt-1">{{ notification.message }}</p>
                  <p class="text-xs text-gray-500 mt-2">{{ formatNotificationTime(notification.createdAt) }}</p>
                </div>
                <div v-if="!notification.read" class="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <button
            @click="markAllAsRead"
            class="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            全部標記為已讀
          </button>
        </div>
      </div>
    </div>

    <!-- 緊急訂單提醒彈窗 -->
    <div v-if="urgentOrderAlert" 
         class="fixed bottom-4 right-4 z-40 max-w-sm bg-red-100 border border-red-400 rounded-lg shadow-lg p-4">
      <div class="flex items-start">
        <ExclamationTriangleIcon class="h-6 w-6 text-red-600 mr-3 flex-shrink-0" />
        <div class="flex-1">
          <h4 class="text-sm font-semibold text-red-800">緊急訂單提醒</h4>
          <p class="text-sm text-red-700 mt-1">{{ urgentOrderAlert.message }}</p>
          <div class="mt-3 flex space-x-2">
            <button
              @click="handleUrgentOrder"
              class="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
            >
              立即處理
            </button>
            <button
              @click="dismissUrgentAlert"
              class="px-3 py-1 bg-red-200 text-red-800 text-xs rounded hover:bg-red-300 transition-colors"
            >
              稍後提醒
            </button>
          </div>
        </div>
        <button @click="closeUrgentAlert" class="text-red-400 hover:text-red-600 ml-2">
          <XMarkIcon class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- 快速操作浮動按鈕 (移動端) -->
    <div class="sm:hidden fixed bottom-6 right-6 z-30">
      <button
        @click="toggleQuickActions"
        class="w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
      >
        <component :is="showQuickActions ? XMarkIcon : PlusIcon" class="h-6 w-6" />
      </button>
      
      <!-- 快速操作選單 -->
      <div v-if="showQuickActions" class="absolute bottom-16 right-0 space-y-2">
        <button
          @click="refreshData"
          class="flex items-center justify-center w-12 h-12 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-colors"
        >
          <ArrowPathIcon class="h-5 w-5" />
        </button>
        <button
          @click="openNotifications"
          class="flex items-center justify-center w-12 h-12 bg-yellow-600 text-white rounded-full shadow-lg hover:bg-yellow-700 transition-colors"
        >
          <BellIcon class="h-5 w-5" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  TruckIcon,
  BellIcon,
  UserIcon,
  ChevronDownIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ArrowPathIcon,
  TrophyIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const authStore = useAuthStore()

// 響應式狀態
const showUserMenu = ref(false)
const showNotifications = ref(false)
const showQuickActions = ref(false)
const urgentOrderAlert = ref(null)

// 模擬數據
const currentUser = ref({
  name: '李小明',
  role: 'service_crew'
})

const pendingCount = ref(3)
const deliveringCount = ref(2)
const todayDelivered = ref(12)
const unreadNotifications = ref(2)

const notifications = ref([
  {
    id: 1,
    type: 'urgent_order',
    title: '緊急訂單',
    message: '桌號T01的訂單已等待15分鐘，請儘速配送',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    read: false
  },
  {
    id: 2,
    type: 'new_order',
    title: '新訂單',
    message: '桌號T05有新的餐點準備完成',
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    read: false
  },
  {
    id: 3,
    type: 'achievement',
    title: '達成成就',
    message: '恭喜！您今日已完成10單配送',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    read: true
  }
])

// 方法
const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
  if (showUserMenu.value) {
    showNotifications.value = false
    showQuickActions.value = false
  }
}

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
  if (showNotifications.value) {
    showUserMenu.value = false
    showQuickActions.value = false
  }
}

const toggleQuickActions = () => {
  showQuickActions.value = !showQuickActions.value
  if (showQuickActions.value) {
    showUserMenu.value = false
    showNotifications.value = false
  }
}

const closeNotifications = () => {
  showNotifications.value = false
}

const openNotifications = () => {
  showNotifications.value = true
  showQuickActions.value = false
}

const openProfile = () => {
  showUserMenu.value = false
  alert('個人資料功能開發中...')
}

const openSettings = () => {
  showUserMenu.value = false
  alert('設定功能開發中...')
}

const logout = () => {
  showUserMenu.value = false
  if (confirm('確定要登出嗎？')) {
    authStore.logout()
    router.push('/login')
  }
}

const refreshData = () => {
  showQuickActions.value = false
  // 觸發數據刷新
  window.location.reload()
}

const handleNotificationClick = (notification) => {
  if (!notification.read) {
    notification.read = true
    unreadNotifications.value = Math.max(0, unreadNotifications.value - 1)
  }
  
  // 根據通知類型執行相應操作
  if (notification.type === 'urgent_order') {
    router.push('/service')
    closeNotifications()
  }
}

const markAllAsRead = () => {
  notifications.value.forEach(n => n.read = true)
  unreadNotifications.value = 0
}

const getNotificationIcon = (type: string) => {
  const icons = {
    urgent_order: ExclamationTriangleIcon,
    new_order: BellIcon,
    achievement: TrophyIcon
  }
  return icons[type] || BellIcon
}

const getNotificationIconClass = (type: string) => {
  const classes = {
    urgent_order: 'text-red-500',
    new_order: 'text-blue-500',
    achievement: 'text-green-500'
  }
  return classes[type] || 'text-gray-500'
}

const formatNotificationTime = (dateTime: string) => {
  const now = new Date()
  const time = new Date(dateTime)
  const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) return '剛剛'
  if (diffInMinutes < 60) return `${diffInMinutes} 分鐘前`
  const hours = Math.floor(diffInMinutes / 60)
  if (hours < 24) return `${hours} 小時前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

const handleUrgentOrder = () => {
  router.push('/service')
  closeUrgentAlert()
}

const dismissUrgentAlert = () => {
  // 5分鐘後再次提醒
  setTimeout(() => {
    if (!urgentOrderAlert.value) {
      showUrgentOrderAlert('訂單T01仍在等待配送，請儘快處理！')
    }
  }, 5 * 60 * 1000)
  closeUrgentAlert()
}

const closeUrgentAlert = () => {
  urgentOrderAlert.value = null
}

const showUrgentOrderAlert = (message: string) => {
  urgentOrderAlert.value = { message }
}

// 點擊外部關閉選單
const handleClickOutside = (event) => {
  if (!event.target.closest('.relative')) {
    showUserMenu.value = false
    showQuickActions.value = false
  }
}

// 生命週期
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  
  // 模擬緊急訂單提醒
  setTimeout(() => {
    showUrgentOrderAlert('桌號T01的訂單已等待超過15分鐘，請立即處理！')
  }, 3000)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.service-layout {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

/* 自定義滾動條 */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* 動畫效果 */
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes bounce {
  0%, 20%, 53%, 80%, 100% {
    transform: translate3d(0, 0, 0);
  }
  40%, 43% {
    transform: translate3d(0, -8px, 0);
  }
  70% {
    transform: translate3d(0, -4px, 0);
  }
  90% {
    transform: translate3d(0, -2px, 0);
  }
}

.bounce {
  animation: bounce 1s infinite;
}
</style>