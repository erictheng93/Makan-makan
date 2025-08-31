<template>
  <div class="space-y-6">
    <!-- 尺寸選擇 -->
    <div v-if="item.options?.sizes?.length">
      <h4 class="text-base font-medium text-gray-900 mb-3">
        尺寸 <span class="text-red-500">*</span>
      </h4>
      <div class="grid grid-cols-2 gap-3">
        <label
          v-for="size in item.options.sizes"
          :key="size.id"
          class="relative flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-colors"
          :class="{
            'border-indigo-500 bg-indigo-50': selectedSize?.id === size.id,
            'border-gray-200 hover:border-gray-300': selectedSize?.id !== size.id
          }"
        >
          <input
            type="radio"
            :value="size.id"
            v-model="selectedSizeId"
            class="sr-only"
          />
          <div class="text-center">
            <div class="font-medium text-gray-900">{{ size.name }}</div>
            <div v-if="size.description" class="text-xs text-gray-600 mt-1">{{ size.description }}</div>
            <div v-if="(size.priceAdjustment || 0) !== 0" class="text-sm font-medium mt-1">
              <span v-if="(size.priceAdjustment || 0) > 0" class="text-orange-600">+${{ formatPrice(size.priceAdjustment || 0) }}</span>
              <span v-else class="text-green-600">-${{ formatPrice(Math.abs(size.priceAdjustment || 0)) }}</span>
            </div>
          </div>
          <!-- 選中指示器 -->
          <div 
            v-if="selectedSize?.id === size.id"
            class="absolute top-2 right-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center"
          >
            <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </div>
        </label>
      </div>
    </div>

    <!-- 客製化選項 -->
    <div v-if="item.options?.customizations?.length">
      <div v-for="option in item.options.customizations" :key="option.id" class="space-y-3">
        <h4 class="text-base font-medium text-gray-900">
          {{ option.name }}
          <span v-if="option.required" class="text-red-500">*</span>
        </h4>
        
        <!-- 單選選項 -->
        <div v-if="option.type === 'single'" class="space-y-2">
          <label
            v-for="choice in option.choices"
            :key="choice.id"
            class="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer transition-colors"
            :class="{
              'border-indigo-500 bg-indigo-50': selectedOptions[option.id] === choice.id,
              'hover:border-gray-300': selectedOptions[option.id] !== choice.id
            }"
          >
            <div class="flex items-center">
              <input
                type="radio"
                :value="choice.id"
                v-model="selectedOptions[option.id]"
                class="sr-only"
              />
              <div 
                class="w-4 h-4 rounded-full border-2 flex items-center justify-center mr-3"
                :class="{
                  'border-indigo-500 bg-indigo-500': selectedOptions[option.id] === choice.id,
                  'border-gray-300': selectedOptions[option.id] !== choice.id
                }"
              >
                <div 
                  v-if="selectedOptions[option.id] === choice.id"
                  class="w-2 h-2 rounded-full bg-white"
                ></div>
              </div>
              <span class="text-gray-900">{{ choice.name }}</span>
            </div>
            <span v-if="(choice.priceAdjustment || 0) > 0" class="text-sm font-medium text-orange-600">
              +${{ formatPrice(choice.priceAdjustment || 0) }}
            </span>
          </label>
        </div>

        <!-- 多選選項 -->
        <div v-else-if="option.type === 'multiple'" class="space-y-2">
          <label
            v-for="choice in option.choices"
            :key="choice.id"
            class="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer transition-colors"
            :class="{
              'border-indigo-500 bg-indigo-50': selectedMultipleOptions[option.id]?.includes(choice.id),
              'hover:border-gray-300': !selectedMultipleOptions[option.id]?.includes(choice.id)
            }"
          >
            <div class="flex items-center">
              <input
                type="checkbox"
                :value="choice.id"
                v-model="selectedMultipleOptions[option.id]"
                class="sr-only"
              />
              <div 
                class="w-4 h-4 rounded border-2 flex items-center justify-center mr-3"
                :class="{
                  'border-indigo-500 bg-indigo-500': selectedMultipleOptions[option.id]?.includes(choice.id),
                  'border-gray-300': !selectedMultipleOptions[option.id]?.includes(choice.id)
                }"
              >
                <svg 
                  v-if="selectedMultipleOptions[option.id]?.includes(choice.id)"
                  class="w-3 h-3 text-white" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
              </div>
              <span class="text-gray-900">{{ choice.name }}</span>
            </div>
            <span v-if="(choice.priceAdjustment || 0) > 0" class="text-sm font-medium text-orange-600">
              +${{ formatPrice(choice.priceAdjustment || 0) }}
            </span>
          </label>
        </div>
      </div>
    </div>

    <!-- 加購項目 -->
    <div v-if="item.options?.addOns?.length">
      <h4 class="text-base font-medium text-gray-900 mb-3">加購項目</h4>
      <div class="space-y-2">
        <label
          v-for="addOn in item.options.addOns"
          :key="addOn.id"
          class="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer transition-colors"
          :class="{
            'border-indigo-500 bg-indigo-50': selectedAddOns.includes(addOn.id || ''),
            'hover:border-gray-300': !selectedAddOns.includes(addOn.id || '')
          }"
        >
          <div class="flex items-center">
            <input
              type="checkbox"
              :value="addOn.id"
              v-model="selectedAddOns"
              class="sr-only"
            />
            <div 
              class="w-4 h-4 rounded border-2 flex items-center justify-center mr-3"
              :class="{
                'border-indigo-500 bg-indigo-500': selectedAddOns.includes(addOn.id || ''),
                'border-gray-300': !selectedAddOns.includes(addOn.id || '')
              }"
            >
              <svg 
                v-if="selectedAddOns.includes(addOn.id || '')"
                class="w-3 h-3 text-white" 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div>
              <div class="font-medium text-gray-900">{{ addOn.name }}</div>
              <div v-if="addOn.description" class="text-sm text-gray-600">{{ addOn.description }}</div>
            </div>
          </div>
          <div class="text-sm font-medium text-orange-600">
            +${{ formatPrice(addOn.price) }}
          </div>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { formatPrice } from '@/utils/format'
import type { MenuItem, SelectedCustomizations } from '@makanmakan/shared-types'

// Props
const props = defineProps<{
  item: MenuItem
  modelValue?: SelectedCustomizations
}>()

// Emits
const emits = defineEmits<{
  'update:modelValue': [value: SelectedCustomizations]
  'price-change': [price: number]
}>()

// State
const selectedSizeId = ref<string>()
const selectedOptions = ref<Record<string, string>>({})
const selectedMultipleOptions = ref<Record<string, string[]>>({})
const selectedAddOns = ref<string[]>([])

// Computed
const selectedSize = computed(() => {
  if (!selectedSizeId.value || !props.item.options?.sizes) return undefined
  return props.item.options.sizes.find(size => size.id === selectedSizeId.value)
})

const customizations = computed((): SelectedCustomizations => {
  const result: SelectedCustomizations = {}

  // 尺寸
  if (selectedSize.value) {
    result.size = {
      id: selectedSize.value.id,
      name: selectedSize.value.name,
      priceAdjustment: selectedSize.value.priceAdjustment || 0
    }
  }

  // 客製化選項
  const options: any[] = []
  
  if (props.item.options?.customizations) {
    for (const option of props.item.options.customizations) {
      if (option.type === 'single' && selectedOptions.value[option.id]) {
        const choice = option.choices.find(c => c.id === selectedOptions.value[option.id])
        if (choice) {
          options.push({
            id: choice.id,
            name: choice.name,
            priceAdjustment: choice.priceAdjustment || 0
          })
        }
      } else if (option.type === 'multiple' && selectedMultipleOptions.value[option.id]) {
        for (const choiceId of selectedMultipleOptions.value[option.id]) {
          const choice = option.choices.find(c => c.id === choiceId)
          if (choice) {
            options.push({
              id: choice.id,
              name: choice.name,
              priceAdjustment: choice.priceAdjustment || 0
            })
          }
        }
      }
    }
  }

  if (options.length > 0) {
    result.options = options
  }

  // 加購項目
  if (selectedAddOns.value.length > 0 && props.item.options?.addOns) {
    result.addOns = selectedAddOns.value.map(addOnId => {
      const addOn = props.item.options!.addOns!.find(a => a.id === addOnId)!
      return {
        id: addOn.id || '',
        name: addOn.name,
        unitPrice: addOn.price,
        quantity: 1,
        totalPrice: addOn.price
      }
    })
  }

  return result
})

const totalPriceAdjustment = computed(() => {
  let adjustment = 0

  // 尺寸調整
  if (selectedSize.value) {
    adjustment += selectedSize.value.priceAdjustment || 0
  }

  // 客製化選項調整
  if (props.item.options?.customizations) {
    for (const option of props.item.options.customizations) {
      if (option.type === 'single' && selectedOptions.value[option.id]) {
        const choice = option.choices.find(c => c.id === selectedOptions.value[option.id])
        if (choice) {
          adjustment += choice.priceAdjustment || 0
        }
      } else if (option.type === 'multiple' && selectedMultipleOptions.value[option.id]) {
        for (const choiceId of selectedMultipleOptions.value[option.id]) {
          const choice = option.choices.find(c => c.id === choiceId)
          if (choice) {
            adjustment += choice.priceAdjustment || 0
          }
        }
      }
    }
  }

  // 加購項目
  if (props.item.options?.addOns) {
    for (const addOnId of selectedAddOns.value) {
      const addOn = props.item.options.addOns.find(a => a.id === addOnId)
      if (addOn) {
        adjustment += addOn.price
      }
    }
  }

  return adjustment
})

// 監聽變化並觸發更新
watch([selectedSizeId, selectedOptions, selectedMultipleOptions, selectedAddOns], () => {
  emits('update:modelValue', customizations.value)
  emits('price-change', totalPriceAdjustment.value)
}, { deep: true })

// 初始化多選選項
if (props.item.options?.customizations) {
  for (const option of props.item.options.customizations) {
    if (option.type === 'multiple') {
      selectedMultipleOptions.value[option.id] = []
    }
  }
}
</script>