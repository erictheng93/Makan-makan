<template>
  <div class="seat-management">
    <!-- 座位管理標題 -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-xl font-bold text-gray-900">座位管理</h2>
        <p class="text-sm text-gray-600">
          桌號: {{ tableNumber }} | 座位模式
        </p>
      </div>
      <div class="flex space-x-3">
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          @click="showBatchCreateModal = true"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          批量新增座位
        </button>
        <button
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
          @click="regenerateAllQR"
        >
          <QRCodeIcon class="h-4 w-4 mr-2" />
          重新生成 QR
        </button>
      </div>
    </div>

    <!-- 座位網格 -->
    <SeatGrid
      :seats="seats"
      :columns="gridColumns"
      :show-details="true"
      @seat-click="handleSeatClick"
    />

    <!-- 座位詳情 Modal -->
    <div v-if="showSeatModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="closeSeatModal"
        />
        <div class="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
          <div class="p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold">
                座位詳情: {{ selectedSeat?.seatNumber }}
              </h3>
              <button
                class="text-gray-400 hover:text-gray-600"
                @click="closeSeatModal"
              >
                <XMarkIcon class="h-6 w-6" />
              </button>
            </div>

            <!-- 座位資訊 -->
            <div class="space-y-4 mb-6">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    座位號碼
                  </label>
                  <input
                    v-model="seatForm.seatNumber"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    座位名稱
                  </label>
                  <input
                    v-model="seatForm.seatName"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  位置描述
                </label>
                <input
                  v-model="seatForm.position"
                  type="text"
                  placeholder="例如: 靠窗、走道旁"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div class="flex items-center">
                <input
                  id="isActive"
                  v-model="seatForm.isActive"
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label for="isActive" class="ml-2 text-sm text-gray-700">
                  啟用此座位
                </label>
              </div>

              <!-- 座位狀態資訊 -->
              <div class="bg-gray-50 rounded-lg p-4">
                <h4 class="text-sm font-medium text-gray-900 mb-2">座位狀態</h4>
                <div class="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span class="text-gray-600">狀態:</span>
                    <span
                      :class="selectedSeat?.isOccupied ? 'text-red-600' : 'text-green-600'"
                      class="ml-2 font-medium"
                    >
                      {{ selectedSeat?.isOccupied ? '已佔用' : '可用' }}
                    </span>
                  </div>
                  <div>
                    <span class="text-gray-600">使用次數:</span>
                    <span class="ml-2 font-medium">{{ selectedSeat?.totalUsage }}</span>
                  </div>
                  <div v-if="selectedSeat?.currentOrderId" class="col-span-2">
                    <span class="text-gray-600">當前訂單:</span>
                    <span class="ml-2 font-medium">#{{ selectedSeat.currentOrderId }}</span>
                  </div>
                  <div v-if="selectedSeat?.occupiedBy" class="col-span-2">
                    <span class="text-gray-600">使用者:</span>
                    <span class="ml-2 font-medium">{{ selectedSeat.occupiedBy }}</span>
                  </div>
                </div>
              </div>

              <!-- QR Code -->
              <div class="text-center bg-gray-50 rounded-lg p-4">
                <h4 class="text-sm font-medium text-gray-900 mb-2">QR Code</h4>
                <div class="inline-block p-3 bg-white rounded-lg border">
                  <div class="w-32 h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                    <QRCodeIcon class="h-16 w-16 text-gray-400" />
                  </div>
                </div>
                <div class="mt-2 text-xs text-gray-500 break-all">
                  {{ selectedSeat?.qrCode }}
                </div>
              </div>
            </div>

            <!-- 操作按鈕 -->
            <div class="flex justify-between">
              <div class="space-x-2">
                <button
                  v-if="selectedSeat?.isOccupied"
                  class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  @click="releaseSeat"
                >
                  釋放座位
                </button>
                <button
                  class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  @click="regenerateSeatQR"
                >
                  重新生成 QR
                </button>
              </div>
              <div class="space-x-2">
                <button
                  class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  @click="deleteSeat"
                >
                  刪除座位
                </button>
                <button
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  @click="updateSeat"
                >
                  更新座位
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 批量創建座位 Modal -->
    <div v-if="showBatchCreateModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="showBatchCreateModal = false"
        />
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <div class="p-6">
            <h3 class="text-lg font-semibold mb-4">批量新增座位</h3>

            <form @submit.prevent="batchCreateSeats">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    座位數量 <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model.number="batchForm.count"
                    type="number"
                    min="1"
                    max="100"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    編號風格 <span class="text-red-500">*</span>
                  </label>
                  <select
                    v-model="batchForm.numberingStyle"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="numeric">數字 (01, 02, 03...)</option>
                    <option value="alphabetic">字母 (A, B, C...)</option>
                    <option value="custom">自訂</option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    編號前綴
                  </label>
                  <input
                    v-model="batchForm.prefix"
                    type="text"
                    placeholder="例如: S"
                    maxlength="10"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    預覽: {{ batchForm.prefix }}01, {{ batchForm.prefix }}02...
                  </p>
                </div>
              </div>

              <div class="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  @click="showBatchCreateModal = false"
                >
                  取消
                </button>
                <button
                  type="submit"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  創建
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { PlusIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import QRCodeIcon from '@heroicons/vue/24/outline/QrCodeIcon'
import SeatGrid from './SeatGrid.vue'

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
  tableId: number
  tableNumber: string
  seats: Seat[]
  gridColumns?: number
}

interface Emits {
  (e: 'update'): void
  (e: 'seatUpdated', seat: Seat): void
  (e: 'seatDeleted', seatId: number): void
  (e: 'seatsCreated', seats: Seat[]): void
}

const props = withDefaults(defineProps<Props>(), {
  gridColumns: 4
})

const emit = defineEmits<Emits>()

// 響應式數據
const showSeatModal = ref(false)
const showBatchCreateModal = ref(false)
const selectedSeat = ref<Seat | null>(null)

const seatForm = ref({
  seatNumber: '',
  seatName: '',
  position: '',
  isActive: true
})

const batchForm = ref({
  count: 10,
  numberingStyle: 'numeric' as 'numeric' | 'alphabetic' | 'custom',
  prefix: ''
})

// 處理座位點擊
const handleSeatClick = (seat: Seat) => {
  selectedSeat.value = seat
  seatForm.value = {
    seatNumber: seat.seatNumber,
    seatName: seat.seatName || '',
    position: seat.position || '',
    isActive: seat.isActive
  }
  showSeatModal.value = true
}

// 關閉座位詳情 Modal
const closeSeatModal = () => {
  showSeatModal.value = false
  selectedSeat.value = null
  seatForm.value = {
    seatNumber: '',
    seatName: '',
    position: '',
    isActive: true
  }
}

// 更新座位
const updateSeat = async () => {
  if (!selectedSeat.value) return

  try {
    // TODO: 調用 API 更新座位
    console.log('Updating seat:', {
      id: selectedSeat.value.id,
      ...seatForm.value
    })

    emit('seatUpdated', {
      ...selectedSeat.value,
      ...seatForm.value
    })

    closeSeatModal()
    emit('update')
  } catch (error) {
    console.error('Failed to update seat:', error)
    alert('更新座位失敗')
  }
}

// 刪除座位
const deleteSeat = async () => {
  if (!selectedSeat.value) return

  if (selectedSeat.value.isOccupied) {
    alert('無法刪除正在使用的座位')
    return
  }

  if (!confirm(`確定要刪除座位 ${selectedSeat.value.seatNumber} 嗎？`)) {
    return
  }

  try {
    // TODO: 調用 API 刪除座位
    console.log('Deleting seat:', selectedSeat.value.id)

    emit('seatDeleted', selectedSeat.value.id)
    closeSeatModal()
    emit('update')
  } catch (error) {
    console.error('Failed to delete seat:', error)
    alert('刪除座位失敗')
  }
}

// 釋放座位
const releaseSeat = async () => {
  if (!selectedSeat.value) return

  if (!confirm(`確定要釋放座位 ${selectedSeat.value.seatNumber} 嗎？`)) {
    return
  }

  try {
    // TODO: 調用 API 釋放座位
    console.log('Releasing seat:', selectedSeat.value.id)

    emit('update')
    closeSeatModal()
  } catch (error) {
    console.error('Failed to release seat:', error)
    alert('釋放座位失敗')
  }
}

// 重新生成座位 QR
const regenerateSeatQR = async () => {
  if (!selectedSeat.value) return

  if (!confirm(`確定要重新生成座位 ${selectedSeat.value.seatNumber} 的 QR 碼嗎？`)) {
    return
  }

  try {
    // TODO: 調用 API 重新生成 QR
    console.log('Regenerating QR for seat:', selectedSeat.value.id)

    emit('update')
    alert('QR 碼已重新生成')
  } catch (error) {
    console.error('Failed to regenerate QR:', error)
    alert('重新生成 QR 碼失敗')
  }
}

// 批量創建座位
const batchCreateSeats = async () => {
  try {
    // TODO: 調用 API 批量創建座位
    console.log('Batch creating seats:', {
      tableId: props.tableId,
      ...batchForm.value
    })

    showBatchCreateModal.value = false
    emit('update')
    alert(`成功創建 ${batchForm.value.count} 個座位`)
  } catch (error) {
    console.error('Failed to batch create seats:', error)
    alert('批量創建座位失敗')
  }
}

// 重新生成所有 QR
const regenerateAllQR = async () => {
  if (!confirm('確定要重新生成所有座位的 QR 碼嗎？')) {
    return
  }

  try {
    // TODO: 調用 API 批量重新生成 QR
    console.log('Regenerating all QR codes for table:', props.tableId)

    emit('update')
    alert('所有 QR 碼已重新生成')
  } catch (error) {
    console.error('Failed to regenerate all QR codes:', error)
    alert('重新生成 QR 碼失敗')
  }
}
</script>

<style scoped>
.seat-management {
  /* 樣式 */
}
</style>
