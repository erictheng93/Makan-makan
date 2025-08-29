<template>
  <div
    v-if="show && item"
    class="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-50"
    @click.self="$emit('close')"
  >
    <div 
      class="bg-white rounded-t-3xl shadow-xl w-full max-w-md max-h-[85vh] overflow-hidden"
      @click.stop
    >
      <!-- 頂部把手 -->
      <div class="flex justify-center py-2">
        <div class="w-8 h-1 bg-gray-300 rounded-full"></div>
      </div>

      <div class="overflow-y-auto max-h-full">
        <!-- 商品圖片 -->
        <div class="relative h-64 bg-gray-100">
          <img
            v-if="item.imageUrl"
            :src="getImageUrl(item.imageVariants?.large || item.imageUrl)"
            :alt="item.name"
            class="w-full h-full object-cover"
            @error="handleImageError"
          />
          <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
            <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>

          <!-- 關閉按鈕 -->
          <button
            @click="$emit('close')"
            class="absolute top-4 right-4 w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- 特色標籤 -->
          <div v-if="item.isFeatured" class="absolute top-4 left-4">
            <span class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-medium px-3 py-1 rounded-full">
              ⭐ 招牌推薦
            </span>
          </div>
        </div>

        <!-- 商品資訊 -->
        <div class="p-6 space-y-4">
          <!-- 基本資訊 -->
          <div>
            <div class="flex items-start justify-between mb-2">
              <h2 class="text-xl font-bold text-gray-900">{{ item.name }}</h2>
              <div class="flex items-center space-x-1">
                <!-- 辣度指示器 -->
                <div v-if="item.spiceLevel > 0" class="flex items-center">
                  <svg 
                    v-for="n in item.spiceLevel" 
                    :key="n"
                    class="w-4 h-4 text-red-500" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
              </div>
            </div>

            <p v-if="item.description" class="text-gray-600 leading-relaxed">
              {{ item.description }}
            </p>

            <!-- 飲食資訊標籤 -->
            <div v-if="dietaryTags.length > 0" class="flex flex-wrap gap-2 mt-3">
              <span 
                v-for="tag in dietaryTags" 
                :key="tag.key"
                :class="[
                  'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                  tag.class
                ]"
              >
                {{ tag.label }}
              </span>
            </div>
          </div>

          <!-- 價格 -->
          <div class="text-2xl font-bold text-gray-900">
            ${{ formatPrice(currentPrice) }}
          </div>

          <!-- 客製化選項 -->
          <div v-if="hasCustomizations">
            <CustomizationOptions
              :item="item"
              v-model="selectedCustomizations"
              @price-change="handlePriceChange"
            />
          </div>

          <!-- 數量選擇 -->
          <div class="flex items-center justify-between py-4">
            <span class="text-base font-medium text-gray-900">數量</span>
            <div class="flex items-center space-x-3">
              <button
                @click="quantity = Math.max(1, quantity - 1)"
                :disabled="quantity <= 1"
                class="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                </svg>
              </button>

              <span class="text-lg font-medium text-gray-900 min-w-[3rem] text-center">
                {{ quantity }}
              </span>

              <button
                @click="quantity = Math.min(99, quantity + 1)"
                :disabled="quantity >= 99"
                class="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 備註 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              備註（選填）
            </label>
            <textarea
              v-model="notes"
              rows="3"
              placeholder="有什麼特別需求嗎？例如：不要辣、少冰等..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- 底部按鈕 -->
      <div class="sticky bottom-0 bg-white border-t border-gray-200 p-6">
        <button
          @click="handleAddToCart"
          :disabled="!item.isAvailable || isOutOfStock"
          class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-2xl transition-colors"
        >
          {{ buttonText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { formatPrice } from '@/utils/format'
import type { MenuItem, SelectedCustomizations } from '@makanmakan/shared-types'
import CustomizationOptions from './CustomizationOptions.vue'

// Props
const props = defineProps<{
  show: boolean
  item?: MenuItem
}>()

// Emits
const emits = defineEmits<{
  'close': []
  'add-to-cart': [data: {
    item: MenuItem
    quantity: number
    customizations?: SelectedCustomizations
    notes?: string
  }]
}>()

// State
const quantity = ref(1)
const notes = ref('')
const selectedCustomizations = ref<SelectedCustomizations>({})
const customizationPrice = ref(0)

// Computed
const isOutOfStock = computed(() => {
  return props.item?.inventoryCount === 0
})

const hasCustomizations = computed(() => {
  if (!props.item) return false
  const options = props.item.options
  return !!(options?.sizes?.length || options?.customizations?.length || options?.addOns?.length)
})

const dietaryTags = computed(() => {
  if (!props.item) return []
  
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

const currentPrice = computed(() => {
  return (props.item?.price || 0) + customizationPrice.value
})

const buttonText = computed(() => {
  if (!props.item?.isAvailable) return '暫不供應'
  if (isOutOfStock.value) return '售完'
  
  const total = currentPrice.value * quantity.value
  return `加入購物車 · $${formatPrice(total)}`
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

const handlePriceChange = (price: number) => {
  customizationPrice.value = price
}

const handleAddToCart = () => {
  if (!props.item) return

  emits('add-to-cart', {
    item: props.item,
    quantity: quantity.value,
    customizations: Object.keys(selectedCustomizations.value).length > 0 
      ? selectedCustomizations.value 
      : undefined,
    notes: notes.value.trim() || undefined
  })

  // 重置狀態
  resetForm()
  emits('close')
}

const resetForm = () => {
  quantity.value = 1
  notes.value = ''
  selectedCustomizations.value = {}
  customizationPrice.value = 0
}

// 監聽 show 屬性變化，重置表單
watch(() => props.show, (newShow) => {
  if (!newShow) {
    resetForm()
  }
})
</script>