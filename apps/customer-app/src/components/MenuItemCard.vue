<template>
  <div 
    class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-200 hover:shadow-md"
    :class="{ 'ring-2 ring-indigo-500': isFeatured }"
  >
    <!-- 特色標籤 -->
    <div v-if="isFeatured" class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-medium px-3 py-1 text-center">
      ⭐ 招牌推薦
    </div>

    <div class="p-4">
      <div class="flex space-x-4">
        <!-- 菜品圖片 -->
        <div class="flex-shrink-0">
          <div 
            class="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 cursor-pointer transition-transform hover:scale-105"
            @click="$emit('view-details', item)"
          >
            <img
              v-if="item.imageUrl"
              v-lazy="{
                src: getImageUrl(item.imageVariants?.medium || item.imageUrl),
                placeholder: '/placeholder-food.jpg',
                quality: 85,
                progressive: true
              }"
              :alt="item.name"
              class="w-full h-full object-cover lazy-image"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <!-- 菜品資訊 -->
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between mb-1">
            <h3 
              class="text-base font-semibold text-gray-900 cursor-pointer hover:text-indigo-600 transition-colors"
              @click="$emit('view-details', item)"
            >
              {{ item.name }}
            </h3>
            <div class="flex items-center space-x-1 ml-2">
              <!-- 辣度指示器 -->
              <div v-if="item.spiceLevel > 0" class="flex items-center">
                <svg 
                  v-for="n in item.spiceLevel" 
                  :key="n"
                  class="w-3 h-3 text-red-500" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            </div>
          </div>

          <!-- 描述 -->
          <p 
            v-if="item.description" 
            class="text-sm text-gray-600 mb-2 line-clamp-2 cursor-pointer"
            @click="$emit('view-details', item)"
          >
            {{ item.description }}
          </p>

          <!-- 飲食資訊標籤 -->
          <div v-if="dietaryTags.length > 0" class="flex flex-wrap gap-1 mb-2">
            <span 
              v-for="tag in dietaryTags" 
              :key="tag.key"
              :class="[
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                tag.class
              ]"
            >
              {{ tag.label }}
            </span>
          </div>

          <!-- 價格和操作 -->
          <div class="flex items-center justify-between mt-3">
            <div class="flex items-baseline space-x-2">
              <span class="text-lg font-bold text-gray-900">
                ${{ formatPrice(item.price) }}
              </span>
              <!-- 原價（如果有折扣） -->
              <span v-if="originalPrice && originalPrice !== item.price" 
                    class="text-sm text-gray-500 line-through">
                ${{ formatPrice(originalPrice) }}
              </span>
            </div>

            <!-- 庫存狀態 -->
            <div v-if="!item.isAvailable || isOutOfStock" class="text-right">
              <span class="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {{ !item.isAvailable ? '暫不供應' : '售完' }}
              </span>
            </div>

            <!-- 添加按鈕 -->
            <button
              v-else-if="!hasCustomizations"
              @click="handleQuickAdd"
              :disabled="isOutOfStock"
              class="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>加入</span>
            </button>

            <!-- 客製化按鈕 -->
            <button
              v-else
              @click="handleCustomize"
              :disabled="isOutOfStock"
              class="bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 disabled:bg-gray-100 disabled:border-gray-300 disabled:text-gray-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              選擇規格
            </button>
          </div>

          <!-- 人氣指標 -->
          <div v-if="item.orderCount > 0" class="flex items-center mt-2 text-xs text-gray-500">
            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span>{{ item.orderCount }} 人點過</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatPrice } from '@/utils/format'
import type { MenuItem, SelectedCustomizations } from '@makanmakan/shared-types'

// Props
const props = defineProps<{
  item: MenuItem
  isFeatured?: boolean
}>()

// Emits
const emits = defineEmits<{
  'add-to-cart': [data: {
    item: MenuItem
    quantity: number
    customizations?: SelectedCustomizations
    notes?: string
  }]
  'view-details': [item: MenuItem]
}>()

// Computed
const isOutOfStock = computed(() => {
  return props.item.inventoryCount === 0
})

const hasCustomizations = computed(() => {
  const options = props.item.options
  return !!(options?.sizes?.length || options?.customizations?.length || options?.addOns?.length)
})

const dietaryTags = computed(() => {
  const tags: Array<{ key: string; label: string; class: string }> = []
  const dietary = props.item.dietaryInfo

  if (dietary?.vegetarian) {
    tags.push({
      key: 'vegetarian',
      label: '素食',
      class: 'bg-green-100 text-green-800'
    })
  }

  if (dietary?.vegan) {
    tags.push({
      key: 'vegan',
      label: '純素',
      class: 'bg-green-100 text-green-800'
    })
  }

  if (dietary?.halal) {
    tags.push({
      key: 'halal',
      label: '清真',
      class: 'bg-blue-100 text-blue-800'
    })
  }

  if (dietary?.glutenFree) {
    tags.push({
      key: 'gluten-free',
      label: '無麩質',
      class: 'bg-yellow-100 text-yellow-800'
    })
  }

  return tags
})

const originalPrice = computed(() => {
  // 這裡可以實作原價邏輯（如果有折扣活動）
  return null
})

// Methods
const getImageUrl = (url: string) => {
  // 如果是相對路徑，轉換為絕對路徑
  if (url.startsWith('/')) {
    return `${import.meta.env.VITE_IMAGE_BASE_URL || ''}${url}`
  }
  return url
}

const handleImageError = (event: Event) => {
  // 圖片載入失敗時的處理
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

const handleQuickAdd = () => {
  emits('add-to-cart', {
    item: props.item,
    quantity: 1
  })
}

const handleCustomize = () => {
  // 對於有客製化選項的商品，觸發詳情查看
  emits('view-details', props.item)
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>