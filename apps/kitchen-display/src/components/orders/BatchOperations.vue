<template>
  <div class="batch-operations bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center space-x-3">
        <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <CheckSquareIcon class="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-900">批量操作</h3>
          <p class="text-sm text-gray-600">選擇多個訂單進行批量處理</p>
        </div>
      </div>

      <div class="flex items-center space-x-2">
        <!-- Selection Summary -->
        <div v-if="selectedOrdersCount > 0" class="text-sm text-gray-600">
          已選擇 <span class="font-semibold text-blue-600">{{ selectedOrdersCount }}</span> 個訂單
        </div>
        
        <!-- Clear Selection -->
        <button
          v-if="selectedOrdersCount > 0"
          @click="deselectAll"
          class="text-sm text-red-600 hover:text-red-700"
        >
          取消選擇
        </button>
      </div>
    </div>

    <!-- Quick Selection -->
    <div class="mb-4">
      <div class="flex items-center space-x-4 mb-3">
        <span class="text-sm font-medium text-gray-700">快速選擇：</span>
        <div class="flex space-x-2">
          <button
            @click="selectAllPending"
            class="text-sm px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
          >
            所有待處理 ({{ pendingCount }})
          </button>
          <button
            @click="selectAllPreparing"
            class="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
          >
            所有製作中 ({{ preparingCount }})
          </button>
          <button
            @click="selectAllReady"
            class="text-sm px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
          >
            所有已完成 ({{ readyCount }})
          </button>
          <button
            @click="selectAllUrgent"
            class="text-sm px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
          >
            所有緊急 ({{ urgentCount }})
          </button>
        </div>
      </div>
    </div>

    <!-- Batch Actions -->
    <div v-if="selectedOrdersCount > 0" class="space-y-4">
      <!-- Operation Summary -->
      <div class="bg-gray-50 rounded-lg p-4">
        <h4 class="font-medium text-gray-900 mb-3">操作預覽</h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div class="text-gray-500">總訂單數</div>
            <div class="font-semibold">{{ batchSummary.totalOrders }}</div>
          </div>
          <div>
            <div class="text-gray-500">總項目數</div>
            <div class="font-semibold">{{ batchSummary.totalItems }}</div>
          </div>
          <div>
            <div class="text-gray-500">可開始項目</div>
            <div class="font-semibold text-yellow-600">{{ batchSummary.pendingItems }}</div>
          </div>
          <div>
            <div class="text-gray-500">可完成項目</div>
            <div class="font-semibold text-blue-600">{{ batchSummary.preparingItems }}</div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap gap-3">
        <!-- Start Cooking -->
        <button
          v-if="canBatchStartCooking(selectedOrders)"
          @click="confirmBatchStart"
          :disabled="isProcessing"
          class="btn-kitchen-primary flex items-center space-x-2"
        >
          <PlayIcon class="w-4 h-4" />
          <span>批量開始製作</span>
          <span class="bg-white bg-opacity-20 px-2 py-1 rounded text-xs">
            {{ batchSummary.pendingItems }} 項
          </span>
        </button>

        <!-- Mark Ready -->
        <button
          v-if="canBatchMarkReady(selectedOrders)"
          @click="confirmBatchReady"
          :disabled="isProcessing"
          class="btn-kitchen-success flex items-center space-x-2"
        >
          <CheckIcon class="w-4 h-4" />
          <span>批量標記完成</span>
          <span class="bg-white bg-opacity-20 px-2 py-1 rounded text-xs">
            {{ batchSummary.preparingItems }} 項
          </span>
        </button>

        <!-- Priority Update -->
        <div class="relative">
          <button
            @click="showPriorityMenu = !showPriorityMenu"
            :disabled="isProcessing"
            class="btn-kitchen bg-orange-600 hover:bg-orange-700 text-white flex items-center space-x-2"
          >
            <ExclamationTriangleIcon class="w-4 h-4" />
            <span>調整優先級</span>
            <ChevronDownIcon class="w-4 h-4" />
          </button>
          
          <!-- Priority Dropdown -->
          <div
            v-if="showPriorityMenu"
            class="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10"
          >
            <button
              @click="setBatchPriority('urgent')"
              class="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-700 border-b"
            >
              設為緊急
            </button>
            <button
              @click="setBatchPriority('high')"
              class="w-full text-left px-4 py-2 text-sm hover:bg-orange-50 text-orange-700 border-b"
            >
              設為重要
            </button>
            <button
              @click="setBatchPriority('normal')"
              class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700"
            >
              設為普通
            </button>
          </div>
        </div>

        <!-- Export Selected -->
        <button
          @click="exportSelected"
          :disabled="isProcessing"
          class="btn-kitchen bg-gray-600 hover:bg-gray-700 text-white flex items-center space-x-2"
        >
          <DocumentArrowDownIcon class="w-4 h-4" />
          <span>導出選中</span>
        </button>
      </div>

      <!-- Processing Indicator -->
      <div v-if="isProcessing" class="flex items-center justify-center py-4">
        <div class="flex items-center space-x-2 text-blue-600">
          <div class="loading-spinner w-4 h-4"></div>
          <span class="text-sm">正在處理批量操作...</span>
        </div>
      </div>
    </div>

    <!-- No Selection State -->
    <div v-else class="text-center py-8 text-gray-500">
      <CheckSquareIcon class="w-12 h-12 mx-auto mb-3 text-gray-300" />
      <p class="text-lg font-medium mb-2">選擇訂單進行批量操作</p>
      <p class="text-sm">點擊訂單卡片上的複選框來選擇多個訂單</p>
    </div>
  </div>

  <!-- Confirmation Modal -->
  <div
    v-if="showConfirmation"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div class="bg-white rounded-xl p-6 max-w-md mx-4">
      <div class="text-center mb-4">
        <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <ExclamationTriangleIcon class="w-6 h-6 text-blue-600" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">確認批量操作</h3>
        <p class="text-sm text-gray-600">{{ confirmationMessage }}</p>
      </div>

      <div class="flex space-x-3">
        <button
          @click="cancelConfirmation"
          class="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
        >
          取消
        </button>
        <button
          @click="executeBatchOperation"
          class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          確認執行
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import {
  Squares2X2Icon as CheckSquareIcon,
  PlayIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  DocumentArrowDownIcon
} from '@heroicons/vue/24/outline'
import { useOrderManagementStore } from '@/stores/orderManagement'
import { useToast } from 'vue-toastification'
import { storeToRefs } from 'pinia'
import type { KitchenOrder } from '@/types'

// Props
interface Props {
  orders: KitchenOrder[]
  pendingOrders: KitchenOrder[]
  preparingOrders: KitchenOrder[]
  readyOrders: KitchenOrder[]
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'batch-start-cooking': [orderIds: number[]]
  'batch-mark-ready': [orderIds: number[]]
  'batch-priority-update': [orderIds: number[], priority: string]
  'batch-export': [orderIds: number[]]
}>()

const toast = useToast()

// Order Management Store
const orderManagementStore = useOrderManagementStore()
const { 
  selectedOrdersCount, 
  hasSelectedOrders
} = storeToRefs(orderManagementStore)

const { 
  getBatchOperationSummary,
  canBatchStartCooking,
  canBatchMarkReady,
  getSelectedOrdersData
} = orderManagementStore

const {
  selectAll,
  deselectAll,
  selectOrder
} = orderManagementStore

// Local State
const isProcessing = ref(false)
const showPriorityMenu = ref(false)
const showConfirmation = ref(false)
const confirmationMessage = ref('')
const pendingOperation = ref<(() => void) | null>(null)

// Computed
const pendingCount = computed(() => props.pendingOrders.length)
const preparingCount = computed(() => props.preparingOrders.length)
const readyCount = computed(() => props.readyOrders.length)
const urgentCount = computed(() => 
  props.orders.filter(order => order.priority === 'urgent').length
)

const selectedOrders = computed(() => getSelectedOrdersData(props.orders))
const batchSummary = computed(() => getBatchOperationSummary(selectedOrders.value))

// Methods
const selectAllPending = () => {
  selectAll(props.pendingOrders)
  toast.success(`已選擇 ${props.pendingOrders.length} 個待處理訂單`)
}

const selectAllPreparing = () => {
  selectAll(props.preparingOrders)
  toast.success(`已選擇 ${props.preparingOrders.length} 個製作中訂單`)
}

const selectAllReady = () => {
  selectAll(props.readyOrders)
  toast.success(`已選擇 ${props.readyOrders.length} 個已完成訂單`)
}

const selectAllUrgent = () => {
  const urgentOrders = props.orders.filter(order => order.priority === 'urgent')
  selectAll(urgentOrders)
  toast.success(`已選擇 ${urgentOrders.length} 個緊急訂單`)
}

const confirmBatchStart = () => {
  confirmationMessage.value = `確定要開始製作 ${selectedOrdersCount.value} 個訂單中的 ${batchSummary.value.pendingItems} 個待製作項目嗎？`
  pendingOperation.value = executeBatchStart
  showConfirmation.value = true
}

const confirmBatchReady = () => {
  confirmationMessage.value = `確定要標記 ${selectedOrdersCount.value} 個訂單中的 ${batchSummary.value.preparingItems} 個項目為完成嗎？`
  pendingOperation.value = executeBatchReady
  showConfirmation.value = true
}

const executeBatchStart = async () => {
  isProcessing.value = true
  showConfirmation.value = false
  
  try {
    const selectedOrderIds = selectedOrders.value.map(order => order.id)
    emit('batch-start-cooking', selectedOrderIds)
    
    toast.success(`成功開始製作 ${batchSummary.value.pendingItems} 個項目！`)
    deselectAll()
  } catch (error: any) {
    toast.error('批量開始製作失敗：' + error.message)
  } finally {
    isProcessing.value = false
    pendingOperation.value = null
  }
}

const executeBatchReady = async () => {
  isProcessing.value = true
  showConfirmation.value = false
  
  try {
    const selectedOrderIds = selectedOrders.value.map(order => order.id)
    emit('batch-mark-ready', selectedOrderIds)
    
    toast.success(`成功完成 ${batchSummary.value.preparingItems} 個項目！`)
    deselectAll()
  } catch (error: any) {
    toast.error('批量標記完成失敗：' + error.message)
  } finally {
    isProcessing.value = false
    pendingOperation.value = null
  }
}

const setBatchPriority = async (priority: 'urgent' | 'high' | 'normal') => {
  showPriorityMenu.value = false
  isProcessing.value = true
  
  try {
    const selectedOrderIds = selectedOrders.value.map(order => order.id)
    emit('batch-priority-update', selectedOrderIds, priority)
    
    const priorityText = { urgent: '緊急', high: '重要', normal: '普通' }[priority]
    toast.success(`已將 ${selectedOrderIds.length} 個訂單設為${priorityText}優先級`)
    deselectAll()
  } catch (error: any) {
    toast.error('批量調整優先級失敗：' + error.message)
  } finally {
    isProcessing.value = false
  }
}

const exportSelected = async () => {
  isProcessing.value = true
  
  try {
    const selectedOrderIds = selectedOrders.value.map(order => order.id)
    emit('batch-export', selectedOrderIds)
    
    toast.success(`已導出 ${selectedOrderIds.length} 個訂單的數據`)
  } catch (error: any) {
    toast.error('導出失敗：' + error.message)
  } finally {
    isProcessing.value = false
  }
}

const executeBatchOperation = () => {
  if (pendingOperation.value) {
    pendingOperation.value()
  }
}

const cancelConfirmation = () => {
  showConfirmation.value = false
  pendingOperation.value = null
}

// Close priority menu when clicking outside
const priorityMenuRef = ref<HTMLElement>()
onClickOutside(priorityMenuRef, () => {
  showPriorityMenu.value = false
})
</script>

<style scoped>
.loading-spinner {
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>