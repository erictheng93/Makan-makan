<template>
  <div class="relative flex items-start space-x-3">
    <!-- 時間線圓點 -->
    <div class="flex-shrink-0 relative">
      <div 
        :class="[
          'w-8 h-8 rounded-full border-2 flex items-center justify-center',
          statusClasses.dot
        ]"
      >
        <div 
          v-if="status === 'completed'"
          class="w-4 h-4 text-white"
        >
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div
          v-else-if="status === 'current'"
          class="w-3 h-3 bg-white rounded-full animate-pulse"
        ></div>
        <div
          v-else
          class="w-3 h-3 bg-gray-300 rounded-full"
        ></div>
      </div>

      <!-- 時間線連接線 -->
      <div 
        v-if="!isLast"
        :class="[
          'absolute top-8 left-1/2 w-0.5 h-16 transform -translate-x-1/2',
          status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
        ]"
      ></div>
    </div>

    <!-- 內容區域 -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between">
        <h4 :class="statusClasses.title">
          {{ title }}
        </h4>
        <div v-if="timestamp" class="flex items-center space-x-1 text-sm text-gray-500">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ formattedTimestamp }}</span>
        </div>
      </div>

      <p v-if="description" :class="statusClasses.description">
        {{ description }}
      </p>

      <!-- 額外內容插槽 -->
      <div v-if="$slots.default" class="mt-2">
        <slot />
      </div>

      <!-- 預估時間 -->
      <div v-if="estimatedTime && status === 'current'" class="mt-2">
        <div class="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
          <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          預估 {{ estimatedTime }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDateTime } from '@/utils/format'

// Props
const props = defineProps<{
  title: string
  description?: string
  status: 'completed' | 'current' | 'pending'
  timestamp?: string | Date | null
  estimatedTime?: string
  isLast?: boolean
}>()

// Computed
const formattedTimestamp = computed(() => {
  if (!props.timestamp) return ''
  return formatDateTime(props.timestamp, 'HH:mm')
})

const statusClasses = computed(() => {
  switch (props.status) {
    case 'completed':
      return {
        dot: 'bg-green-500 border-green-500',
        title: 'text-sm font-medium text-green-900',
        description: 'text-sm text-green-700'
      }
    case 'current':
      return {
        dot: 'bg-blue-500 border-blue-500',
        title: 'text-sm font-medium text-blue-900',
        description: 'text-sm text-blue-700'
      }
    case 'pending':
      return {
        dot: 'bg-white border-gray-300',
        title: 'text-sm font-medium text-gray-500',
        description: 'text-sm text-gray-500'
      }
    default:
      return {
        dot: 'bg-white border-gray-300',
        title: 'text-sm font-medium text-gray-500',
        description: 'text-sm text-gray-500'
      }
  }
})
</script>