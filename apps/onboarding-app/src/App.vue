<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-primary-50 to-white">
    <!-- Header -->
    <header class="bg-white shadow-sm">
      <div class="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <span class="text-2xl font-bold text-primary-600">MakanMakan</span>
            <span class="ml-2 text-sm text-gray-500">獨立部署</span>
          </div>
          <a
            href="https://makanmakan.app"
            target="_blank"
            class="text-sm text-gray-500 hover:text-gray-700"
          >
            返回首頁
          </a>
        </div>
      </div>
    </header>

    <!-- Main -->
    <main class="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <RouterView />
    </main>

    <!-- Footer -->
    <footer class="mt-auto py-8">
      <div class="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
        <p>&copy; 2024 MakanMakan. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>
