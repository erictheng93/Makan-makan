<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow-sm border-b border-gray-200">
      <div class="container mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <button
              @click="$router.back()"
              class="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
            >
              <ArrowLeftIcon class="w-5 h-5 text-gray-600" />
            </button>
            <h1 class="text-xl font-bold text-gray-900">歷史記錄</h1>
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="container mx-auto px-4 py-6">
      <div class="text-center py-12">
        <ClockIcon class="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 class="text-lg font-semibold text-gray-900 mb-2">歷史記錄功能</h2>
        <p class="text-gray-600 mb-4">此功能將在後續版本中實現</p>
        <button
          @click="$router.back()"
          class="btn-kitchen-primary px-6 py-3"
        >
          返回廚房系統
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ArrowLeftIcon from '@heroicons/vue/24/outline/ArrowLeftIcon'
import ClockIcon from '@heroicons/vue/24/outline/ClockIcon'
</script>