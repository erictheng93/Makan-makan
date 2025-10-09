<template>
  <div class="qr-mode-selector">
    <div class="mb-4">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        QR 碼管理模式 <span class="text-red-500">*</span>
      </label>
      <p class="text-xs text-gray-500 mb-4">
        選擇如何為此桌台生成 QR 碼
      </p>
    </div>

    <!-- 模式選擇 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <!-- 桌子模式 -->
      <div
        :class="[
          'mode-card relative rounded-lg border-2 p-6 cursor-pointer transition-all',
          modelValue === 'table'
            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
            : 'border-gray-300 hover:border-blue-300'
        ]"
        @click="selectMode('table')"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center">
            <div
              :class="[
                'w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center',
                modelValue === 'table'
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-gray-300'
              ]"
            >
              <div
                v-if="modelValue === 'table'"
                class="w-2 h-2 bg-white rounded-full"
              />
            </div>
            <h3 class="text-lg font-semibold text-gray-900">桌子模式</h3>
          </div>
          <TableCellsIcon class="h-8 w-8 text-gray-400" />
        </div>

        <p class="text-sm text-gray-600 mb-4">
          整張桌子共用一個 QR 碼，適合傳統用餐模式
        </p>

        <!-- 桌子模式圖示 -->
        <div class="bg-white rounded-lg p-4 border border-gray-200">
          <div class="flex items-center justify-center">
            <div class="text-center">
              <div class="w-24 h-24 mx-auto bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                <QRCodeIcon class="h-12 w-12 text-gray-400" />
              </div>
              <p class="text-xs text-gray-500 mt-2">一桌一碼</p>
            </div>
          </div>
        </div>

        <div class="mt-4 space-y-2">
          <div class="flex items-center text-xs text-gray-600">
            <CheckIcon class="h-4 w-4 text-green-500 mr-2" />
            簡單易管理
          </div>
          <div class="flex items-center text-xs text-gray-600">
            <CheckIcon class="h-4 w-4 text-green-500 mr-2" />
            適合家庭或團體用餐
          </div>
          <div class="flex items-center text-xs text-gray-600">
            <CheckIcon class="h-4 w-4 text-green-500 mr-2" />
            訂單統一管理
          </div>
        </div>
      </div>

      <!-- 座位模式 -->
      <div
        :class="[
          'mode-card relative rounded-lg border-2 p-6 cursor-pointer transition-all',
          modelValue === 'seat'
            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
            : 'border-gray-300 hover:border-blue-300'
        ]"
        @click="selectMode('seat')"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center">
            <div
              :class="[
                'w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center',
                modelValue === 'seat'
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-gray-300'
              ]"
            >
              <div
                v-if="modelValue === 'seat'"
                class="w-2 h-2 bg-white rounded-full"
              />
            </div>
            <h3 class="text-lg font-semibold text-gray-900">座位模式</h3>
          </div>
          <UserGroupIcon class="h-8 w-8 text-gray-400" />
        </div>

        <p class="text-sm text-gray-600 mb-4">
          每個座位有獨立 QR 碼，適合個人點餐模式
        </p>

        <!-- 座位模式圖示 -->
        <div class="bg-white rounded-lg p-4 border border-gray-200">
          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="i in 4"
              :key="i"
              class="w-full aspect-square bg-gray-100 rounded flex items-center justify-center border border-dashed border-gray-300"
            >
              <QRCodeIcon class="h-6 w-6 text-gray-400" />
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-2 text-center">一位一碼</p>
        </div>

        <div class="mt-4 space-y-2">
          <div class="flex items-center text-xs text-gray-600">
            <CheckIcon class="h-4 w-4 text-green-500 mr-2" />
            獨立點餐結帳
          </div>
          <div class="flex items-center text-xs text-gray-600">
            <CheckIcon class="h-4 w-4 text-green-500 mr-2" />
            適合陌生人併桌
          </div>
          <div class="flex items-center text-xs text-gray-600">
            <CheckIcon class="h-4 w-4 text-green-500 mr-2" />
            精確座位管理
          </div>
        </div>
      </div>
    </div>

    <!-- 座位模式配置 -->
    <div
      v-if="modelValue === 'seat'"
      class="bg-gray-50 rounded-lg p-6 border border-gray-200"
    >
      <h4 class="text-sm font-semibold text-gray-900 mb-4">座位配置</h4>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            座位數量 <span class="text-red-500">*</span>
          </label>
          <input
            :value="seatConfig.count"
            type="number"
            min="1"
            max="100"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            @input="updateSeatCount"
          />
          <p class="text-xs text-gray-500 mt-1">
            將創建 {{ seatConfig.count }} 個座位
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            編號風格 <span class="text-red-500">*</span>
          </label>
          <select
            :value="seatConfig.numberingStyle"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            @change="updateNumberingStyle"
          >
            <option value="numeric">數字 (01, 02, 03...)</option>
            <option value="alphabetic">字母 (A, B, C...)</option>
            <option value="custom">自訂編號</option>
          </select>
        </div>
      </div>

      <!-- 預覽 -->
      <div class="mt-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          座位編號預覽
        </label>
        <div class="bg-white rounded-lg p-4 border border-gray-200">
          <div class="flex flex-wrap gap-2">
            <span
              v-for="(number, index) in previewNumbers"
              :key="index"
              class="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
            >
              {{ number }}
            </span>
            <span
              v-if="seatConfig.count > 10"
              class="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm"
            >
              ...共 {{ seatConfig.count }} 個
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 提示資訊 -->
    <div class="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div class="flex">
        <ExclamationTriangleIcon class="h-5 w-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
        <div class="text-sm text-yellow-800">
          <p class="font-medium mb-1">注意事項</p>
          <ul class="list-disc list-inside space-y-1 text-xs">
            <li>切換模式將會影響 QR 碼的生成和訂單管理方式</li>
            <li>切換到座位模式後，將自動創建指定數量的座位</li>
            <li>已有訂單的桌台無法切換模式</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  TableCellsIcon,
  UserGroupIcon,
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/vue/24/outline'
import QRCodeIcon from '@heroicons/vue/24/outline/QrCodeIcon'

interface SeatConfig {
  count: number
  numberingStyle: 'numeric' | 'alphabetic' | 'custom'
}

interface Props {
  modelValue: 'table' | 'seat'
  seatConfig: SeatConfig
}

interface Emits {
  (e: 'update:modelValue', value: 'table' | 'seat'): void
  (e: 'update:seatConfig', value: SeatConfig): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 選擇模式
const selectMode = (mode: 'table' | 'seat') => {
  emit('update:modelValue', mode)
}

// 更新座位數量
const updateSeatCount = (event: Event) => {
  const target = event.target as HTMLInputElement
  const count = parseInt(target.value) || 1
  emit('update:seatConfig', {
    ...props.seatConfig,
    count
  })
}

// 更新編號風格
const updateNumberingStyle = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const numberingStyle = target.value as 'numeric' | 'alphabetic' | 'custom'
  emit('update:seatConfig', {
    ...props.seatConfig,
    numberingStyle
  })
}

// 生成座位編號預覽
const previewNumbers = computed(() => {
  const { count, numberingStyle } = props.seatConfig
  const previewCount = Math.min(count, 10)
  const numbers: string[] = []

  for (let i = 0; i < previewCount; i++) {
    if (numberingStyle === 'numeric') {
      numbers.push(String(i + 1).padStart(2, '0'))
    } else if (numberingStyle === 'alphabetic') {
      const letter = String.fromCharCode(65 + (i % 26))
      const repeat = Math.floor(i / 26) + 1
      numbers.push(letter.repeat(repeat))
    } else {
      numbers.push(`S${i + 1}`)
    }
  }

  return numbers
})
</script>

<style scoped>
.mode-card {
  min-height: 380px;
}
</style>
