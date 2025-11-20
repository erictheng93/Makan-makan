<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckIcon,
} from '@heroicons/vue/24/outline'
import BookmarkIcon from '@heroicons/vue/24/outline/BookmarkIcon'
import type {
  MonitoringFilter,
  SavedFilter,
  FilterPreset,
  TimeRange,
  ComponentType,
  SeverityLevel,
  AlertStatus,
} from '@/types/monitoring-filters'
import {
  DEFAULT_FILTER,
  FILTER_PRESETS,
  validateFilter,
} from '@/types/monitoring-filters'

// Props
interface Props {
  modelValue: MonitoringFilter
  savedFilters?: SavedFilter[]
}

const props = withDefaults(defineProps<Props>(), {
  savedFilters: () => [],
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [filter: MonitoringFilter]
  apply: [filter: MonitoringFilter]
  reset: []
  save: [name: string, filter: MonitoringFilter]
  load: [filterId: string]
  delete: [filterId: string]
}>()

// I18n
const { t } = useI18n()

// Local state
const localFilter = ref<MonitoringFilter>({ ...props.modelValue })
const showAdvanced = ref(false)
const showSaveDialog = ref(false)
const filterName = ref('')
const filterDescription = ref('')
const selectedPreset = ref<string>('')

// Computed
const isFilterModified = computed(() => {
  return JSON.stringify(localFilter.value) !== JSON.stringify(DEFAULT_FILTER)
})

const isValidFilter = computed(() => {
  return validateFilter(localFilter.value)
})

const activeFiltersCount = computed(() => {
  let count = 0
  if (localFilter.value.timeRange !== 'last24hours') count++
  if (localFilter.value.components.some(c => c !== 'all')) count++
  if (localFilter.value.severity.some(s => s !== 'all')) count++
  if (localFilter.value.status.some(s => s !== 'all')) count++
  if (localFilter.value.searchKeyword) count++
  return count
})

// Time range options
const timeRangeOptions: Array<{ value: TimeRange; label: string }> = [
  { value: 'last15minutes', label: t('monitoring.performance.last15Minutes') },
  { value: 'last1hour', label: t('monitoring.performance.lastHour') },
  { value: 'last6hours', label: '最近 6 小時' },
  { value: 'last24hours', label: t('monitoring.performance.last24Hours') },
  { value: 'last7days', label: t('monitoring.performance.last7Days') },
  { value: 'last30days', label: '最近 30 天' },
  { value: 'custom', label: t('monitoring.performance.custom') },
]

// Component type options
const componentOptions: Array<{ value: ComponentType; label: string }> = [
  { value: 'all', label: '全部組件' },
  { value: 'api', label: t('monitoring.components.api') },
  { value: 'database', label: t('monitoring.components.database') },
  { value: 'cache', label: t('monitoring.components.cache') },
  { value: 'storage', label: t('monitoring.components.storage') },
  { value: 'websocket', label: t('monitoring.components.websocket') },
  { value: 'queue', label: t('monitoring.components.queue') },
  { value: 'external', label: t('monitoring.components.external') },
]

// Severity options
const severityOptions: Array<{ value: SeverityLevel; label: string; color: string }> = [
  { value: 'all', label: '全部級別', color: 'gray' },
  { value: 'info', label: t('monitoring.alerts.severity.info'), color: 'blue' },
  { value: 'warning', label: t('monitoring.alerts.severity.warning'), color: 'yellow' },
  { value: 'critical', label: t('monitoring.alerts.severity.critical'), color: 'red' },
  { value: 'fatal', label: t('monitoring.alerts.severity.fatal'), color: 'purple' },
]

// Status options
const statusOptions: Array<{ value: AlertStatus; label: string }> = [
  { value: 'all', label: '全部狀態' },
  { value: 'active', label: t('monitoring.alerts.status.active') },
  { value: 'acknowledged', label: t('monitoring.alerts.status.acknowledged') },
  { value: 'resolved', label: t('monitoring.alerts.status.resolved') },
  { value: 'muted', label: t('monitoring.alerts.status.muted') },
]

// Watch for prop changes
watch(() => props.modelValue, (newValue) => {
  localFilter.value = { ...newValue }
}, { deep: true })

// Methods
function handleApply() {
  if (!isValidFilter.value) {
    return
  }
  emit('update:modelValue', localFilter.value)
  emit('apply', localFilter.value)
}

function handleReset() {
  localFilter.value = { ...DEFAULT_FILTER }
  selectedPreset.value = ''
  emit('reset')
  handleApply()
}

function applyPreset(preset: FilterPreset) {
  selectedPreset.value = preset.id
  localFilter.value = {
    ...DEFAULT_FILTER,
    ...preset.filter,
  }
  handleApply()
}

function handleSave() {
  if (!filterName.value.trim()) {
    return
  }
  emit('save', filterName.value, localFilter.value)
  showSaveDialog.value = false
  filterName.value = ''
  filterDescription.value = ''
}

// Reserved for future use: load a saved filter configuration
// function loadSavedFilter(filter: SavedFilter) {
//   localFilter.value = { ...filter.filter }
//   handleApply()
// }

function toggleComponent(component: ComponentType) {
  const index = localFilter.value.components.indexOf(component)
  if (index > -1) {
    localFilter.value.components.splice(index, 1)
  } else {
    localFilter.value.components.push(component)
  }
  // 如果選擇了 'all'，清除其他選項
  if (component === 'all') {
    localFilter.value.components = ['all']
  } else {
    // 如果選擇了其他選項，移除 'all'
    const allIndex = localFilter.value.components.indexOf('all')
    if (allIndex > -1) {
      localFilter.value.components.splice(allIndex, 1)
    }
  }
}

function toggleSeverity(severity: SeverityLevel) {
  const index = localFilter.value.severity.indexOf(severity)
  if (index > -1) {
    localFilter.value.severity.splice(index, 1)
  } else {
    localFilter.value.severity.push(severity)
  }
  if (severity === 'all') {
    localFilter.value.severity = ['all']
  } else {
    const allIndex = localFilter.value.severity.indexOf('all')
    if (allIndex > -1) {
      localFilter.value.severity.splice(allIndex, 1)
    }
  }
}

function toggleStatus(status: AlertStatus) {
  const index = localFilter.value.status.indexOf(status)
  if (index > -1) {
    localFilter.value.status.splice(index, 1)
  } else {
    localFilter.value.status.push(status)
  }
  if (status === 'all') {
    localFilter.value.status = ['all']
  } else {
    const allIndex = localFilter.value.status.indexOf('all')
    if (allIndex > -1) {
      localFilter.value.status.splice(allIndex, 1)
    }
  }
}
</script>

<template>
  <div class="advanced-filter-panel bg-white rounded-lg shadow-sm border border-gray-200">
    <!-- 快速篩選器 -->
    <div class="p-4 border-b border-gray-200">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <FunnelIcon class="w-5 h-5 text-gray-500" />
          <h3 class="text-sm font-medium text-gray-900">快速篩選</h3>
          <span
            v-if="activeFiltersCount > 0"
            class="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
          >
            {{ activeFiltersCount }}
          </span>
        </div>
        <button
          v-if="isFilterModified"
          @click="handleReset"
          class="text-sm text-gray-600 hover:text-gray-900"
        >
          重置篩選
        </button>
      </div>

      <!-- 預設篩選器 -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="preset in FILTER_PRESETS"
          :key="preset.id"
          @click="applyPreset(preset)"
          :class="[
            'px-3 py-1.5 text-sm rounded-lg border transition-colors',
            selectedPreset === preset.id
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50',
          ]"
        >
          {{ preset.name }}
        </button>
      </div>
    </div>

    <!-- 主要篩選器 -->
    <div class="p-4 space-y-4">
      <!-- 搜索框 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          <MagnifyingGlassIcon class="w-4 h-4 inline mr-1" />
          關鍵字搜索
        </label>
        <input
          v-model="localFilter.searchKeyword"
          type="text"
          placeholder="搜索警報訊息、組件名稱或 ID..."
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <!-- 時間範圍 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          時間範圍
        </label>
        <select
          v-model="localFilter.timeRange"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option
            v-for="option in timeRangeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>

        <!-- 自定義時間範圍 -->
        <div
          v-if="localFilter.timeRange === 'custom'"
          class="mt-2 grid grid-cols-2 gap-2"
        >
          <input
            type="datetime-local"
            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="開始時間"
          />
          <input
            type="datetime-local"
            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="結束時間"
          />
        </div>
      </div>

      <!-- 組件篩選 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          組件類型
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="option in componentOptions"
            :key="option.value"
            @click="toggleComponent(option.value)"
            :class="[
              'px-3 py-1.5 text-sm rounded-lg border transition-colors',
              localFilter.components.includes(option.value)
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50',
            ]"
          >
            <CheckIcon
              v-if="localFilter.components.includes(option.value)"
              class="w-4 h-4 inline mr-1"
            />
            {{ option.label }}
          </button>
        </div>
      </div>

      <!-- 嚴重程度 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          嚴重程度
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="option in severityOptions"
            :key="option.value"
            @click="toggleSeverity(option.value)"
            :class="[
              'px-3 py-1.5 text-sm rounded-lg border transition-colors',
              localFilter.severity.includes(option.value)
                ? `bg-${option.color}-50 border-${option.color}-300 text-${option.color}-700`
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50',
            ]"
          >
            <CheckIcon
              v-if="localFilter.severity.includes(option.value)"
              class="w-4 h-4 inline mr-1"
            />
            {{ option.label }}
          </button>
        </div>
      </div>

      <!-- 狀態篩選 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          警報狀態
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="option in statusOptions"
            :key="option.value"
            @click="toggleStatus(option.value)"
            :class="[
              'px-3 py-1.5 text-sm rounded-lg border transition-colors',
              localFilter.status.includes(option.value)
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50',
            ]"
          >
            <CheckIcon
              v-if="localFilter.status.includes(option.value)"
              class="w-4 h-4 inline mr-1"
            />
            {{ option.label }}
          </button>
        </div>
      </div>

      <!-- 高級選項 Toggle -->
      <button
        @click="showAdvanced = !showAdvanced"
        class="text-sm text-blue-600 hover:text-blue-800"
      >
        {{ showAdvanced ? '隱藏' : '顯示' }}高級選項
      </button>

      <!-- 高級選項 -->
      <div v-if="showAdvanced" class="space-y-4 pt-4 border-t border-gray-200">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              最小響應時間 (ms)
            </label>
            <input
              v-model.number="localFilter.minResponseTime"
              type="number"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              最大響應時間 (ms)
            </label>
            <input
              v-model.number="localFilter.maxResponseTime"
              type="number"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="space-y-2">
          <label class="flex items-center">
            <input
              v-model="localFilter.includeResolved"
              type="checkbox"
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span class="ml-2 text-sm text-gray-700">包含已解決的警報</span>
          </label>
          <label class="flex items-center">
            <input
              v-model="localFilter.includeMuted"
              type="checkbox"
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span class="ml-2 text-sm text-gray-700">包含已靜音的警報</span>
          </label>
          <label class="flex items-center">
            <input
              v-model="localFilter.groupByComponent"
              type="checkbox"
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span class="ml-2 text-sm text-gray-700">按組件分組</span>
          </label>
        </div>
      </div>
    </div>

    <!-- 操作按鈕 -->
    <div class="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
      <button
        @click="showSaveDialog = true"
        class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
      >
        <BookmarkIcon class="w-4 h-4" />
        保存篩選器
      </button>

      <div class="flex gap-2">
        <button
          @click="handleReset"
          class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          重置
        </button>
        <button
          @click="handleApply"
          :disabled="!isValidFilter"
          :class="[
            'px-4 py-2 text-sm text-white rounded-lg',
            isValidFilter
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-300 cursor-not-allowed',
          ]"
        >
          應用篩選
        </button>
      </div>
    </div>

    <!-- 保存篩選器對話框 -->
    <div
      v-if="showSaveDialog"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="showSaveDialog = false"
    >
      <div class="bg-white rounded-lg p-6 w-96">
        <h3 class="text-lg font-medium text-gray-900 mb-4">保存篩選器</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              篩選器名稱 *
            </label>
            <input
              v-model="filterName"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="例如：嚴重 API 錯誤"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              描述（可選）
            </label>
            <textarea
              v-model="filterDescription"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="說明此篩選器的用途..."
            />
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button
            @click="showSaveDialog = false"
            class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            @click="handleSave"
            :disabled="!filterName.trim()"
            :class="[
              'px-4 py-2 text-sm text-white rounded-lg',
              filterName.trim()
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-300 cursor-not-allowed',
            ]"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.advanced-filter-panel {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}
</style>
