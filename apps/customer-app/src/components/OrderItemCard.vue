<template>
  <div class="flex items-start space-x-3 py-3">
    <!-- 商品圖片 -->
    <div class="flex-shrink-0">
      <div class="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
        <img
          v-if="item.menuItem?.imageUrl"
          :src="getImageUrl(item.menuItem.imageVariants?.thumbnail || item.menuItem.imageUrl)"
          :alt="item.menuItem.name"
          class="w-full h-full object-cover"
          loading="lazy"
          @error="handleImageError"
        />
        <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
    </div>

    <!-- 商品資訊 -->
    <div class="flex-1 min-w-0">
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0 mr-2">
          <h4 class="text-sm font-medium text-gray-900">
            {{ item.menuItem?.name || '未知商品' }}
          </h4>
          
          <!-- 客製化資訊 -->
          <div v-if="customizationText" class="mt-1">
            <p class="text-xs text-gray-600">{{ customizationText }}</p>
          </div>

          <!-- 備註 -->
          <div v-if="item.notes" class="mt-1">
            <p class="text-xs text-gray-600">
              <span class="font-medium">備註：</span>{{ item.notes }}
            </p>
          </div>

          <!-- 狀態標籤 -->
          <div v-if="showStatus" class="mt-2">
            <span 
              :class="[
                'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                statusClasses
              ]"
            >
              <div 
                v-if="item.status === 1"
                class="w-2 h-2 bg-current rounded-full animate-pulse mr-1"
              ></div>
              {{ statusText }}
            </span>
          </div>
        </div>

        <!-- 數量和價格 -->
        <div class="text-right">
          <div class="text-sm text-gray-500">× {{ item.quantity }}</div>
          <div class="text-sm font-medium text-gray-900">
            ${{ formatPrice(itemTotal) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatPrice } from '@/utils/format'
import type { OrderItem } from '@makanmakan/shared-types'

// Props
const props = defineProps<{
  item: OrderItem
  showStatus?: boolean
}>()

// Computed
const itemTotal = computed(() => {
  return props.item.totalPrice
})

const customizationText = computed(() => {
  if (!props.item.customizations) return ''

  const parts: string[] = []
  const customizations = props.item.customizations

  // 尺寸
  if (customizations.size) {
    parts.push(customizations.size.name)
  }

  // 客製化選項
  if (customizations.options && customizations.options.length > 0) {
    const optionNames = customizations.options.map(opt => opt.choiceName)
    parts.push(...optionNames)
  }

  // 加購項目
  if (customizations.addOns && customizations.addOns.length > 0) {
    const addOnNames = customizations.addOns.map(addOn => `+${addOn.name}`)
    parts.push(...addOnNames)
  }

  return parts.join(', ')
})

const statusText = computed(() => {
  if (!props.showStatus || props.item.status === undefined) return ''

  const statusMap = {
    0: '待處理',
    1: '製作中',
    2: '準備完成',
    3: '已送達'
  }

  return statusMap[props.item.status as keyof typeof statusMap] || '未知'
})

const statusClasses = computed(() => {
  if (!props.showStatus || props.item.status === undefined) return ''

  const classMap = {
    0: 'bg-yellow-100 text-yellow-800',
    1: 'bg-orange-100 text-orange-800',
    2: 'bg-green-100 text-green-800',
    3: 'bg-gray-100 text-gray-800'
  }

  return classMap[props.item.status as keyof typeof classMap] || 'bg-gray-100 text-gray-800'
})

// Methods
const getImageUrl = (url: string) => {
  if (url.startsWith('/')) {
    return `${import.meta.env.VITE_IMAGE_BASE_URL || ''}${url}`
  }
  return url
}

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}
</script>