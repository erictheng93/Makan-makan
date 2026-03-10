<script setup lang="ts">
import { RouterLink } from "vue-router";
import { HomeIcon } from "@heroicons/vue/24/outline";
</script>

<template>
  <div class="min-h-[60vh] flex items-center justify-center">
    <div class="text-center">
      <p class="text-6xl font-bold text-primary-600">404</p>
      <h1 class="mt-4 text-2xl font-bold text-gray-900">頁面不存在</h1>
      <p class="mt-2 text-gray-500">您訪問的頁面可能已被移除或暫時無法使用</p>
      <RouterLink to="/" class="mt-6 btn btn-primary inline-flex">
        <HomeIcon class="h-5 w-5 mr-2" />
        返回首頁
      </RouterLink>
    </div>
  </div>
</template>
