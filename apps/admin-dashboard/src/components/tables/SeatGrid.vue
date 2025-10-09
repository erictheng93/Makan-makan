<template>
  <div class="seat-grid">
    <div class="flex justify-between items-center mb-6">
      <h3 class="text-lg font-semibold text-gray-900">座位視圖</h3>
      <div class="flex items-center space-x-4">
        <div class="flex items-center space-x-2">
          <div class="flex items-center">
            <div class="w-4 h-4 bg-green-500 rounded mr-2" />
            <span class="text-sm text-gray-600">可用</span>
          </div>
          <div class="flex items-center ml-4">
            <div class="w-4 h-4 bg-red-500 rounded mr-2" />
            <span class="text-sm text-gray-600">已佔用</span>
          </div>
          <div class="flex items-center ml-4">
            <div class="w-4 h-4 bg-gray-300 rounded mr-2" />
            <span class="text-sm text-gray-600">不可用</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 座位網格 -->
    <div
      class="grid gap-4"
      :style="gridStyle"
    >
      <div
        v-for="seat in seats"
        :key="seat.id"
        :class="getSeatClass(seat)"
        class="seat-item relative p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-lg"
        @click="handleSeatClick(seat)"
      >
        <!-- 座位號碼 -->
        <div class="text-center">
          <div class="text-lg font-bold text-gray-900">
            {{ seat.seatNumber }}
          </div>
          <div v-if="seat.seatName" class="text-xs text-gray-500 mt-1">
            {{ seat.seatName }}
          </div>
        </div>

        <!-- 佔用狀態 -->
        <div
          v-if="seat.isOccupied"
          class="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"
        />

        <!-- 不可用狀態 -->
        <div
          v-if="!seat.isActive"
          class="absolute inset-0 bg-gray-100 bg-opacity-75 rounded-lg flex items-center justify-center"
        >
          <XMarkIcon class="h-8 w-8 text-gray-400" />
        </div>

        <!-- 座位資訊 -->
        <div v-if="showDetails" class="mt-2 text-xs text-gray-500">
          <div v-if="seat.currentOrderId">訂單: #{{ seat.currentOrderId }}</div>
          <div v-if="seat.occupiedBy">用餐者: {{ seat.occupiedBy }}</div>
          <div>使用次數: {{ seat.totalUsage }}</div>
        </div>
      </div>
    </div>

    <!-- 空狀態 -->
    <div
      v-if="seats.length === 0"
      class="text-center py-12 bg-gray-50 rounded-lg"
    >
      <ChairIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900">暫無座位</h3>
      <p class="mt-1 text-sm text-gray-500">
        此桌台尚未配置座位
      </p>
    </div>

    <!-- 座位統計 -->
    <div v-if="seats.length > 0" class="mt-6 grid grid-cols-3 gap-4">
      <div class="bg-green-50 rounded-lg p-4">
        <div class="text-2xl font-bold text-green-600">
          {{ stats.available }}
        </div>
        <div class="text-sm text-gray-600">可用座位</div>
      </div>
      <div class="bg-red-50 rounded-lg p-4">
        <div class="text-2xl font-bold text-red-600">
          {{ stats.occupied }}
        </div>
        <div class="text-sm text-gray-600">已佔用</div>
      </div>
      <div class="bg-gray-50 rounded-lg p-4">
        <div class="text-2xl font-bold text-gray-600">
          {{ stats.inactive }}
        </div>
        <div class="text-sm text-gray-600">不可用</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'

interface Seat {
  id: number
  tableId: number
  seatNumber: string
  seatName?: string
  position?: string
  qrCode: string
  isOccupied: boolean
  isActive: boolean
  currentOrderId?: number
  occupiedBy?: string
  totalUsage: number
}

interface Props {
  seats: Seat[]
  columns?: number
  showDetails?: boolean
}

interface Emits {
  (e: 'seatClick', seat: Seat): void
}

const props = withDefaults(defineProps<Props>(), {
  columns: 4,
  showDetails: false
})

const emit = defineEmits<Emits>()

// 計算網格樣式
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.columns}, 1fr)`
}))

// 座位統計
const stats = computed(() => ({
  available: props.seats.filter(s => s.isActive && !s.isOccupied).length,
  occupied: props.seats.filter(s => s.isActive && s.isOccupied).length,
  inactive: props.seats.filter(s => !s.isActive).length
}))

// 獲取座位樣式類別
const getSeatClass = (seat: Seat) => {
  if (!seat.isActive) {
    return 'border-gray-300 bg-gray-50 opacity-50'
  }
  if (seat.isOccupied) {
    return 'border-red-500 bg-red-50 hover:border-red-600'
  }
  return 'border-green-500 bg-green-50 hover:border-green-600'
}

// 處理座位點擊
const handleSeatClick = (seat: Seat) => {
  emit('seatClick', seat)
}
</script>

<style scoped>
.seat-item {
  min-height: 100px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
