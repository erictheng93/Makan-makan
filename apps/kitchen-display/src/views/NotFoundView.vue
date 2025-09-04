<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="text-center">
      <div
        class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"
      >
        <ExclamationTriangleIcon class="w-10 h-10 text-red-600" />
      </div>

      <h1 class="text-4xl font-bold text-gray-900 mb-4">404</h1>
      <h2 class="text-xl font-semibold text-gray-700 mb-4">頁面不存在</h2>
      <p class="text-gray-600 mb-8 max-w-md mx-auto">
        抱歉，您訪問的頁面不存在或已被移除。請檢查網址是否正確。
      </p>

      <div class="space-y-3">
        <button
          class="btn-kitchen-secondary px-6 py-3 mr-4"
          @click="$router.go(-1)"
        >
          返回上頁
        </button>

        <button
          class="btn-kitchen-primary px-6 py-3"
          @click="$router.push('/login')"
        >
          返回登入
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ExclamationTriangleIcon } from "@heroicons/vue/24/outline";
</script>
