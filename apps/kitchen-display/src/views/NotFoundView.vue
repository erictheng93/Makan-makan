<template>
  <div class="bg-ios-bg min-h-screen flex items-center justify-center">
    <div class="text-center">
      <SearchX class="w-12 h-12 text-ios-tertiary mx-auto" />
      <h1 class="text-[22px] font-bold text-ios-text mt-4">找不到頁面</h1>
      <p class="text-sm text-ios-secondary mt-2">請確認網址是否正確</p>
      <button
        class="bg-ios-blue text-white rounded-full px-6 py-3 font-bold mt-6 min-h-[44px]"
        @click="$router.push('/login')"
      >
        返回廚房
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SearchX } from "lucide-vue-next";
</script>
