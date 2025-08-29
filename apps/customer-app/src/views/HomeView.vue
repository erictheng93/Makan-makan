<template>
  <div class="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
    <!-- 頂部導航 -->
    <nav class="bg-white shadow-sm border-b border-gray-100">
      <div class="max-w-md mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <span class="text-white font-bold text-lg">M</span>
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900">MakanMakan</h1>
              <p class="text-sm text-gray-500">{{ t('home.subtitle') }}</p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </div>
    </nav>

    <!-- 主要內容 -->
    <main class="max-w-md mx-auto px-4 py-8">
      <!-- 歡迎區塊 -->
      <div class="text-center mb-8">
        <div class="w-24 h-24 mx-auto mb-6 bg-indigo-100 rounded-2xl flex items-center justify-center">
          <svg class="w-12 h-12 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-900 mb-2">{{ t('home.title') }}</h2>
        <p class="text-gray-600 text-base">
          {{ t('home.subtitle') }}
        </p>
      </div>

      <!-- 主要操作按鈕 -->
      <div class="space-y-4">
        <!-- 掃描QR碼按鈕 -->
        <button
          @click="startQRScan"
          class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-6 rounded-2xl transition-colors duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 12h-4.01M12 12v4m6-4h.01M12 8h.01" />
          </svg>
          <span>{{ t('home.scanQR') }}</span>
        </button>

        <!-- 手動輸入按鈕 -->
        <button
          @click="showManualInput = true"
          class="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-4 px-6 rounded-2xl border-2 border-gray-200 transition-colors duration-200 flex items-center justify-center space-x-3"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>{{ t('home.manualInput') }}</span>
        </button>
      </div>

      <!-- 最近使用的餐廳 -->
      <div v-if="recentRestaurants.length > 0" class="mt-12">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ t('home.recentOrders') }}</h3>
        <div class="space-y-3">
          <button
            v-for="restaurant in recentRestaurants"
            :key="restaurant.id"
            @click="selectRecentRestaurant(restaurant)"
            class="w-full bg-white hover:bg-gray-50 p-4 rounded-xl border border-gray-200 transition-colors duration-200 text-left"
          >
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H7m2 0v-9m10 9v-9M9 8h6m-6 4h6" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium text-gray-900 truncate">{{ restaurant.name }}</p>
                <p class="text-sm text-gray-500 truncate">{{ restaurant.address }}</p>
              </div>
              <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      <!-- 功能介紹 -->
      <div class="mt-12 space-y-6">
        <h3 class="text-lg font-semibold text-gray-900">{{ t('home.features.title') }}</h3>
        
        <div class="grid gap-4">
          <div class="flex items-start space-x-4">
            <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">{{ t('home.features.qrOrder') }}</h4>
              <p class="text-sm text-gray-600">{{ t('home.features.qrOrderDesc') }}</p>
            </div>
          </div>

          <div class="flex items-start space-x-4">
            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">{{ t('home.features.realtime') }}</h4>
              <p class="text-sm text-gray-600">{{ t('home.features.realtimeDesc') }}</p>
            </div>
          </div>

          <div class="flex items-start space-x-4">
            <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">{{ t('home.features.payment') }}</h4>
              <p class="text-sm text-gray-600">{{ t('home.features.paymentDesc') }}</p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- PWA 安裝提示 -->
    <div
      v-if="appStore.isInstallable"
      class="fixed bottom-4 left-4 right-4 bg-indigo-600 text-white p-4 rounded-2xl shadow-lg max-w-md mx-auto"
    >
      <div class="flex items-center justify-between">
        <div class="flex-1 pr-4">
          <p class="font-medium">{{ t('common.home') }}</p>
          <p class="text-sm text-indigo-100">{{ t('common.loading') }}</p>
        </div>
        <button
          @click="appStore.installApp"
          class="bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium text-sm"
        >
          {{ t('common.apply') }}
        </button>
      </div>
    </div>

    <!-- 手動輸入對話框 -->
    <ManualInputModal 
      v-model:show="showManualInput"
      @restaurant-selected="handleRestaurantSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useI18n } from '@/composables/useI18n'
import { useAppStore } from '@/stores/app'
import ManualInputModal from '@/components/ManualInputModal.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import type { Restaurant } from '@makanmakan/shared-types'

const router = useRouter()
const toast = useToast()
const { t } = useI18n()
const appStore = useAppStore()

const showManualInput = ref(false)
const recentRestaurants = ref<Restaurant[]>([])

onMounted(() => {
  loadRecentRestaurants()
})

const startQRScan = () => {
  // 檢查設備支援
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast.error('您的設備不支援相機功能')
    return
  }

  router.push('/scan')
}

const selectRecentRestaurant = (restaurant: Restaurant) => {
  // 這裡應該要求用戶輸入桌號，或者從歷史記錄中取得
  showManualInput.value = true
}

const handleRestaurantSelected = ({ restaurantId, tableId }: { restaurantId: number; tableId: number }) => {
  router.push(`/restaurant/${restaurantId}/table/${tableId}`)
}

const loadRecentRestaurants = () => {
  try {
    const saved = localStorage.getItem('makanmakan_recent_restaurants')
    if (saved) {
      const parsed = JSON.parse(saved)
      // 只保留最近7天內的記錄
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      recentRestaurants.value = parsed
        .filter((item: any) => item.lastVisit > sevenDaysAgo)
        .slice(0, 3) // 只顯示最近3家
    }
  } catch (error) {
    console.warn('載入最近使用的餐廳失敗:', error)
  }
}
</script>