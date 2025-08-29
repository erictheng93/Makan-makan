<template>
  <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-900">廚房統計</h2>
      <button
        @click="$emit('refresh')"
        :disabled="loading"
        class="text-gray-500 hover:text-gray-700 transition-colors"
        title="刷新統計"
      >
        <ArrowPathIcon :class="['w-5 h-5', { 'animate-spin': loading }]" />
      </button>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <!-- Today's Completed Orders -->
      <div class="text-center p-4 bg-green-50 rounded-xl">
        <div class="text-2xl font-bold text-green-600 mb-1">{{ stats.completedToday }}</div>
        <div class="text-sm text-green-700 font-medium">今日完成</div>
      </div>

      <!-- Average Cooking Time -->
      <div class="text-center p-4 bg-blue-50 rounded-xl">
        <div class="text-2xl font-bold text-blue-600 mb-1">{{ stats.averageCookingTime }}分</div>
        <div class="text-sm text-blue-700 font-medium">平均製作</div>
      </div>

      <!-- Efficiency Rate -->
      <div class="text-center p-4 bg-purple-50 rounded-xl">
        <div class="text-2xl font-bold text-purple-600 mb-1">{{ stats.efficiency }}%</div>
        <div class="text-sm text-purple-700 font-medium">完成率</div>
      </div>

      <!-- Urgent Orders -->
      <div class="text-center p-4 bg-orange-50 rounded-xl">
        <div class="text-2xl font-bold text-orange-600 mb-1">{{ stats.urgentOrders }}</div>
        <div class="text-sm text-orange-700 font-medium">緊急訂單</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import type { KitchenStats } from '@/types'

interface Props {
  stats: KitchenStats
  loading?: boolean
}

defineProps<Props>()

defineEmits<{
  refresh: []
}>()
</script>