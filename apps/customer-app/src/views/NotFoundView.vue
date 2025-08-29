<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="max-w-md mx-auto text-center px-4">
      <div class="mb-8">
        <div class="text-9xl font-bold text-gray-300 mb-4">404</div>
        <svg class="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-3-1v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      
      <h1 class="text-2xl font-bold text-gray-900 mb-4">頁面不存在</h1>
      <p class="text-gray-600 mb-8">
        很抱歉，您要查找的頁面不存在或已被移除。
      </p>
      
      <div class="space-y-4">
        <button
          @click="goBack"
          class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          回到上一頁
        </button>
        
        <button
          @click="goHome"
          class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-6 rounded-lg transition-colors"
        >
          回到首頁
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goBack = () => {
  window.history.back()
}

const goHome = () => {
  router.push('/')
}
</script>