<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="text-center">
      <div class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <ShieldExclamationIcon class="w-10 h-10 text-red-600" />
      </div>
      
      <h1 class="text-4xl font-bold text-gray-900 mb-4">權限不足</h1>
      <h2 class="text-xl font-semibold text-gray-700 mb-4">無法訪問廚房系統</h2>
      <p class="text-gray-600 mb-8 max-w-md mx-auto">
        您的帳號沒有廚房系統的使用權限。請使用廚師帳號登入，或聯繫系統管理員。
      </p>
      
      <div class="space-y-3">
        <button
          @click="handleLogout"
          class="btn-kitchen-primary px-6 py-3"
        >
          重新登入
        </button>
      </div>
      
      <div class="mt-8 text-sm text-gray-500">
        <p>需要協助？請聯繫系統管理員</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ShieldExclamationIcon } from '@heroicons/vue/24/outline'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const handleLogout = async () => {
  await authStore.logout()
  await router.push('/login')
}
</script>