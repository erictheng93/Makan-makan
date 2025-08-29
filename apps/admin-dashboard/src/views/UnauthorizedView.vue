<template>
  <div class="unauthorized-view">
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8 text-center">
        <!-- 圖標 -->
        <div class="mx-auto">
          <ShieldExclamationIcon class="mx-auto h-24 w-24 text-red-400" />
        </div>
        
        <!-- 標題和描述 -->
        <div>
          <h2 class="mt-6 text-3xl font-bold text-gray-900">
            存取被拒絕
          </h2>
          <p class="mt-2 text-sm text-gray-600">
            抱歉，您沒有權限存取此頁面
          </p>
        </div>

        <!-- 錯誤詳情 -->
        <div class="bg-red-50 border border-red-200 rounded-md p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <ExclamationTriangleIcon class="h-5 w-5 text-red-400" />
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800">權限不足</h3>
              <div class="mt-2 text-sm text-red-700">
                <p>您目前的角色無法存取此功能。如需協助，請聯絡系統管理員。</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 用戶資訊 -->
        <div v-if="currentUser" class="bg-gray-100 rounded-md p-4">
          <h4 class="text-sm font-medium text-gray-900 mb-2">當前登入資訊</h4>
          <div class="text-sm text-gray-600 space-y-1">
            <div class="flex justify-between">
              <span>用戶名:</span>
              <span class="font-medium">{{ currentUser.username }}</span>
            </div>
            <div class="flex justify-between">
              <span>角色:</span>
              <span class="font-medium">{{ getRoleText(currentUser.role) }}</span>
            </div>
            <div v-if="currentUser.restaurantName" class="flex justify-between">
              <span>餐廳:</span>
              <span class="font-medium">{{ currentUser.restaurantName }}</span>
            </div>
          </div>
        </div>

        <!-- 可用功能提示 -->
        <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <InformationCircleIcon class="h-5 w-5 text-blue-400" />
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-blue-800">您可以使用的功能</h3>
              <div class="mt-2 text-sm text-blue-700">
                <ul class="list-disc list-inside space-y-1">
                  <li v-for="permission in availablePermissions" :key="permission">
                    {{ permission }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- 操作按鈕 -->
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            @click="goBack"
            class="flex-1 flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <ArrowLeftIcon class="h-4 w-4 mr-2" />
            返回上一頁
          </button>
          
          <button
            @click="goToDashboard"
            class="flex-1 flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <HomeIcon class="h-4 w-4 mr-2" />
            回到首頁
          </button>
        </div>

        <!-- 聯絡資訊 -->
        <div class="text-center">
          <p class="text-xs text-gray-500">
            如有疑問，請聯絡系統管理員
          </p>
          <p class="text-xs text-blue-600 mt-1">
            <a href="mailto:admin@makanmakan.com" class="hover:text-blue-800 transition-colors">
              admin@makanmakan.com
            </a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowLeftIcon,
  HomeIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const authStore = useAuthStore()

// 計算屬性
const currentUser = computed(() => authStore.user)

const availablePermissions = computed(() => {
  const role = currentUser.value?.role
  const permissions = {
    0: [ // Admin
      '系統管理',
      '用戶管理',
      '餐廳管理',
      '數據分析',
      '所有功能'
    ],
    1: [ // Owner
      '餐廳管理',
      '員工管理',
      '菜單管理',
      '訂單管理',
      '數據分析'
    ],
    2: [ // Chef
      '廚房顯示系統',
      '訂單處理',
      '菜單查看'
    ],
    3: [ // Service
      '訂單管理',
      '桌台管理',
      '送餐服務'
    ],
    4: [ // Cashier
      '收銀台',
      '訂單結帳',
      '付款處理'
    ]
  }
  return permissions[role] || ['基本功能']
})

// 方法
const getRoleText = (role: number) => {
  const roles = {
    0: '系統管理員',
    1: '店主',
    2: '廚師',
    3: '送菜員',
    4: '收銀員'
  }
  return roles[role] || '未知角色'
}

const goBack = () => {
  if (window.history.length > 1) {
    router.go(-1)
  } else {
    goToDashboard()
  }
}

const goToDashboard = () => {
  router.push('/dashboard')
}

// 生命周期
onMounted(() => {
  // 記錄未授權訪問嘗試
  console.warn('Unauthorized access attempt:', {
    user: currentUser.value?.username,
    role: currentUser.value?.role,
    timestamp: new Date().toISOString(),
    path: router.currentRoute.value.path
  })
})
</script>

<style scoped>
.unauthorized-view {
  min-height: 100vh;
}
</style>