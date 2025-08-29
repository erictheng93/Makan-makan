<template>
  <div class="h-screen bg-gray-900 text-white">
    <header class="bg-gray-800 px-6 py-4 border-b border-gray-700">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <h1 class="text-2xl font-bold text-primary-400">廚房顯示系統</h1>
          <div class="flex items-center space-x-2 text-sm text-gray-300">
            <Clock class="w-4 h-4" />
            <span>{{ currentTime }}</span>
          </div>
        </div>
        
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-2">
            <span class="text-sm text-gray-300">待處理訂單</span>
            <span class="bg-red-600 text-white px-3 py-1 rounded-full text-lg font-bold">
              {{ pendingOrdersCount }}
            </span>
          </div>
          
          <button 
            @click="$router.push('/dashboard')"
            class="btn-secondary"
          >
            返回管理介面
          </button>
        </div>
      </div>
    </header>
    
    <main class="h-full overflow-hidden p-6">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Clock } from 'lucide-vue-next'
import { useOrderStore } from '@/stores/order'
import { format } from 'date-fns'

const orderStore = useOrderStore()
const currentTime = ref('')
const pendingOrdersCount = computed(() => orderStore.pendingOrdersCount)

let timeInterval: number

const updateTime = () => {
  currentTime.value = format(new Date(), 'yyyy/MM/dd HH:mm:ss')
}

onMounted(() => {
  updateTime()
  timeInterval = setInterval(updateTime, 1000)
})

onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval)
  }
})
</script>