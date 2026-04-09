<script setup lang="ts">
import { RouterView } from "vue-router";
</script>

<template>
  <div class="min-h-screen bg-ios-bg">
    <!-- Header -->
    <header
      class="bg-white/80 backdrop-blur-md shadow-[0_1px_0_rgba(0,0,0,0.04)]"
    >
      <div class="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center">
          <span class="text-2xl font-bold text-primary-600">MakanMakan</span>
          <span class="ml-2 text-sm text-gray-500">獨立部署</span>
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
