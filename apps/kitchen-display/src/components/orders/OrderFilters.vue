<template>
  <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
    <!-- Filter Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center space-x-2">
        <FunnelIcon class="w-5 h-5 text-gray-600" />
        <h3 class="font-semibold text-gray-900">篩選和搜索</h3>
        <span 
          v-if="hasActiveFilters" 
          class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
        >
          {{ activeFilterCount }} 個篩選
        </span>
      </div>
      
      <div class="flex items-center space-x-2">
        <!-- Toggle Filters -->
        <button
          @click="showFilters = !showFilters"
          class="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          :title="showFilters ? '收起篩選' : '展開篩選'"
        >
          <ChevronDownIcon v-if="!showFilters" class="w-4 h-4" />
          <ChevronUpIcon v-else class="w-4 h-4" />
        </button>
        
        <!-- Clear All Filters -->
        <button
          v-if="hasActiveFilters"
          @click="clearAllFilters"
          class="text-sm text-red-600 hover:text-red-700 font-medium"
        >
          清除所有
        </button>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="mb-4">
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" />
        </div>
        <input
          v-model="searchText"
          type="text"
          class="block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
          placeholder="搜索訂單編號、顧客姓名、桌號、餐點..."
          @input="updateSearch"
        >
        <div v-if="searchText" class="absolute inset-y-0 right-0 pr-3 flex items-center">
          <button
            @click="clearSearch"
            class="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Filters -->
    <div class="flex flex-wrap gap-2 mb-4">
      <button
        v-for="(filter, key) in quickFilters"
        :key="key"
        @click="applyQuickFilter(key)"
        :class="[
          'px-3 py-1 rounded-full text-sm font-medium transition-colors',
          filter.active
            ? 'bg-kitchen-100 text-kitchen-800 border border-kitchen-200'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        ]"
      >
        <component :is="filter.icon" class="w-4 h-4 inline mr-1" />
        {{ filter.label }}
      </button>
    </div>

    <!-- Detailed Filters -->
    <div v-if="showFilters" class="space-y-4">
      <!-- Status Filter -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">訂單狀態</label>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="status in statusOptions"
            :key="status.value"
            class="flex items-center space-x-2 cursor-pointer"
          >
            <input
              v-model="selectedStatuses"
              :value="status.value"
              type="checkbox"
              class="rounded border-gray-300 text-kitchen-600 focus:ring-kitchen-500"
            >
            <span class="text-sm text-gray-700">{{ status.label }}</span>
            <span :class="status.badgeClass">{{ status.count || 0 }}</span>
          </label>
        </div>
      </div>

      <!-- Priority Filter -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">優先級</label>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="priority in priorityOptions"
            :key="priority.value"
            class="flex items-center space-x-2 cursor-pointer"
          >
            <input
              v-model="selectedPriorities"
              :value="priority.value"
              type="checkbox"
              class="rounded border-gray-300 text-kitchen-600 focus:ring-kitchen-500"
            >
            <span class="text-sm text-gray-700">{{ priority.label }}</span>
            <span :class="priority.badgeClass">{{ priority.count || 0 }}</span>
          </label>
        </div>
      </div>

      <!-- Time Range Filter -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">最短等待時間</label>
          <div class="flex items-center space-x-2">
            <input
              v-model.number="minElapsedTime"
              type="number"
              min="0"
              max="120"
              class="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-kitchen-500"
            >
            <span class="text-sm text-gray-500">分鐘</span>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">最長等待時間</label>
          <div class="flex items-center space-x-2">
            <input
              v-model.number="maxElapsedTime"
              type="number"
              min="0"
              max="120"
              class="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-kitchen-500"
            >
            <span class="text-sm text-gray-500">分鐘</span>
          </div>
        </div>
      </div>

      <!-- Table Filter -->
      <div v-if="availableTables.length > 0">
        <label class="block text-sm font-medium text-gray-700 mb-2">桌號</label>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="table in availableTables"
            :key="table.id"
            class="flex items-center space-x-2 cursor-pointer"
          >
            <input
              v-model="selectedTables"
              :value="table.id"
              type="checkbox"
              class="rounded border-gray-300 text-kitchen-600 focus:ring-kitchen-500"
            >
            <span class="text-sm text-gray-700">{{ table.name }}</span>
            <span class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{{ table.count }}</span>
          </label>
        </div>
      </div>

      <!-- Additional Filters -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">其他篩選</label>
        <div class="space-y-2">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input
              v-model="hasNotesFilter"
              type="checkbox"
              class="rounded border-gray-300 text-kitchen-600 focus:ring-kitchen-500"
            >
            <span class="text-sm text-gray-700">有訂單備註</span>
          </label>
          <label class="flex items-center space-x-2 cursor-pointer">
            <input
              v-model="hasCustomizationsFilter"
              type="checkbox"
              class="rounded border-gray-300 text-kitchen-600 focus:ring-kitchen-500"
            >
            <span class="text-sm text-gray-700">有客製化要求</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Filter Summary -->
    <div v-if="hasActiveFilters" class="mt-4 pt-4 border-t border-gray-200">
      <div class="text-sm text-gray-600">
        符合條件的訂單：<span class="font-medium text-gray-900">{{ filteredCount }}</span> 個
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FireIcon,
  ChatBubbleLeftEllipsisIcon,
  Cog6ToothIcon
} from '@heroicons/vue/24/outline'
import { useOrderManagementStore } from '@/stores/orderManagement'
import { storeToRefs } from 'pinia'
import type { KitchenOrder } from '@/types'

// Props
interface Props {
  orders: KitchenOrder[]
  filteredCount: number
}

const props = defineProps<Props>()

// Store
const orderManagementStore = useOrderManagementStore()
const { filters, hasActiveFilters } = storeToRefs(orderManagementStore)

// Local state
const showFilters = ref(false)
const searchText = ref('')
const selectedStatuses = ref<number[]>([])
const selectedPriorities = ref<string[]>([])
const selectedTables = ref<number[]>([])
const minElapsedTime = ref<number>()
const maxElapsedTime = ref<number>()
const hasNotesFilter = ref(false)
const hasCustomizationsFilter = ref(false)

// Computed
const activeFilterCount = computed(() => {
  let count = 0
  if (searchText.value) count++
  if (selectedStatuses.value.length > 0) count++
  if (selectedPriorities.value.length > 0) count++
  if (selectedTables.value.length > 0) count++
  if (minElapsedTime.value !== undefined) count++
  if (maxElapsedTime.value !== undefined) count++
  if (hasNotesFilter.value) count++
  if (hasCustomizationsFilter.value) count++
  return count
})

const statusOptions = computed(() => [
  {
    value: 1,
    label: '已確認',
    count: props.orders.filter(o => o.status === 1).length,
    badgeClass: 'px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs'
  },
  {
    value: 2,
    label: '製作中',
    count: props.orders.filter(o => o.status === 2).length,
    badgeClass: 'px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs'
  },
  {
    value: 3,
    label: '準備完成',
    count: props.orders.filter(o => o.status === 3).length,
    badgeClass: 'px-2 py-1 bg-green-100 text-green-800 rounded text-xs'
  }
])

const priorityOptions = computed(() => [
  {
    value: 'normal',
    label: '普通',
    count: props.orders.filter(o => o.priority === 'normal').length,
    badgeClass: 'px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs'
  },
  {
    value: 'high',
    label: '重要',
    count: props.orders.filter(o => o.priority === 'high').length,
    badgeClass: 'px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs'
  },
  {
    value: 'urgent',
    label: '緊急',
    count: props.orders.filter(o => o.priority === 'urgent').length,
    badgeClass: 'px-2 py-1 bg-red-100 text-red-800 rounded text-xs'
  }
])

const availableTables = computed(() => {
  const tableMap = new Map<number, { id: number; name: string; count: number }>()
  
  props.orders.forEach(order => {
    const existing = tableMap.get(order.tableId)
    if (existing) {
      existing.count++
    } else {
      tableMap.set(order.tableId, {
        id: order.tableId,
        name: order.tableName,
        count: 1
      })
    }
  })
  
  return Array.from(tableMap.values()).sort((a, b) => a.id - b.id)
})

const quickFilters = computed(() => ({
  urgent: {
    label: '緊急訂單',
    icon: ExclamationTriangleIcon,
    active: selectedPriorities.value.includes('urgent')
  },
  preparing: {
    label: '製作中',
    icon: FireIcon,
    active: selectedStatuses.value.includes(2)
  },
  overdue: {
    label: '超時訂單',
    icon: ClockIcon,
    active: minElapsedTime.value === 15
  },
  withNotes: {
    label: '有備註',
    icon: ChatBubbleLeftEllipsisIcon,
    active: hasNotesFilter.value
  },
  customized: {
    label: '客製化',
    icon: Cog6ToothIcon,
    active: hasCustomizationsFilter.value
  }
}))

// Methods
const updateSearch = () => {
  orderManagementStore.setFilter('searchText', searchText.value)
}

const clearSearch = () => {
  searchText.value = ''
  updateSearch()
}

const applyQuickFilter = (filterKey: string) => {
  switch (filterKey) {
    case 'urgent':
      if (selectedPriorities.value.includes('urgent')) {
        selectedPriorities.value = selectedPriorities.value.filter(p => p !== 'urgent')
      } else {
        selectedPriorities.value = ['urgent']
      }
      break
    case 'preparing':
      if (selectedStatuses.value.includes(2)) {
        selectedStatuses.value = selectedStatuses.value.filter(s => s !== 2)
      } else {
        selectedStatuses.value = [2]
      }
      break
    case 'overdue':
      if (minElapsedTime.value === 15) {
        minElapsedTime.value = undefined
      } else {
        minElapsedTime.value = 15
      }
      break
    case 'withNotes':
      hasNotesFilter.value = !hasNotesFilter.value
      break
    case 'customized':
      hasCustomizationsFilter.value = !hasCustomizationsFilter.value
      break
  }
}

const clearAllFilters = () => {
  searchText.value = ''
  selectedStatuses.value = []
  selectedPriorities.value = []
  selectedTables.value = []
  minElapsedTime.value = undefined
  maxElapsedTime.value = undefined
  hasNotesFilter.value = false
  hasCustomizationsFilter.value = false
  orderManagementStore.clearFilters()
}

// Watch for changes and update store
watch(selectedStatuses, (newValue) => {
  orderManagementStore.setFilter('status', newValue.length > 0 ? newValue : undefined)
})

watch(selectedPriorities, (newValue) => {
  orderManagementStore.setFilter('priority', newValue.length > 0 ? newValue : undefined)
})

watch(selectedTables, (newValue) => {
  orderManagementStore.setFilter('tableIds', newValue.length > 0 ? newValue : undefined)
})

watch(minElapsedTime, (newValue) => {
  orderManagementStore.setFilter('minElapsedTime', newValue)
})

watch(maxElapsedTime, (newValue) => {
  orderManagementStore.setFilter('maxElapsedTime', newValue)
})

watch(hasNotesFilter, (newValue) => {
  orderManagementStore.setFilter('hasNotes', newValue ? true : undefined)
})

watch(hasCustomizationsFilter, (newValue) => {
  orderManagementStore.setFilter('hasCustomizations', newValue ? true : undefined)
})
</script>