<template>
  <div class="users-view">
    <!-- 頁面標題和操作 -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">員工排班管理</h1>
        <p class="text-gray-600">管理員工工作班表、查看排班衝突、審核換班申請</p>
      </div>
      <div class="flex space-x-4">
        <button
          class="flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          :disabled="loading"
          @click="refreshData"
        >
          <ArrowPathIcon class="h-4 w-4 mr-2" />
          刷新
        </button>
        <button
          class="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          @click="showCreateTemplateModal"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          新增班別模板
        </button>
        <button
          class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          @click="showCreateScheduleModal"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          新增排班
        </button>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-blue-100 rounded-lg">
            <CalendarIcon class="h-6 w-6 text-blue-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-sm font-semibold text-gray-900">本月排班</h3>
            <p class="text-xl font-bold text-blue-600">{{ schedules.length }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 rounded-lg">
            <CalendarIcon class="h-6 w-6 text-green-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-sm font-semibold text-gray-900">班別模板</h3>
            <p class="text-xl font-bold text-green-600">{{ shiftTemplates.length }}</p>
          </div>
        </div>
      </div>

      <div v-if="conflicts.length > 0" class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-yellow-100 rounded-lg">
            <ExclamationTriangleIcon class="h-6 w-6 text-yellow-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-sm font-semibold text-gray-900">待處理衝突</h3>
            <p class="text-xl font-bold text-yellow-600">{{ conflicts.length }}</p>
          </div>
        </div>
      </div>

      <div v-if="swapRequests.length > 0" class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-purple-100 rounded-lg">
            <ArrowPathIcon class="h-6 w-6 text-purple-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-sm font-semibold text-gray-900">待審核換班</h3>
            <p class="text-xl font-bold text-purple-600">
              {{ swapRequests.filter(r => r.status === 'pending').length }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Banner -->
    <div
      v-if="error"
      class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center justify-between"
    >
      <div class="flex items-center">
        <ExclamationCircleIcon class="h-5 w-5 text-red-600 mr-3" />
        <span class="text-sm text-red-800 font-medium">{{ error }}</span>
      </div>
      <button
        class="text-red-600 hover:text-red-800"
        @click="error = null"
      >
        <XMarkIcon class="h-5 w-5" />
      </button>
    </div>

    <!-- Tab Navigation -->
    <div class="bg-white rounded-lg shadow mb-6">
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8 px-6" aria-label="Tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="[
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ]"
            @click="switchTab(tab.id)"
          >
            <component :is="getIconComponent(tab.icon)" class="h-5 w-5 mr-2" />
            {{ tab.label }}
            <span
              v-if="tab.badge"
              :class="[
                'ml-2 py-0.5 px-2 rounded-full text-xs font-medium',
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-600',
              ]"
            >
              {{ tab.badge }}
            </span>
          </button>
        </nav>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="bg-white rounded-lg shadow p-6">
      <!-- Calendar View -->
      <div v-if="activeTab === 'calendar'">
        <SchedulingCalendar
          :schedules="schedules"
          :loading="loading"
          @date-select="handleDateSelect"
          @schedule-click="handleScheduleClick"
        />
      </div>

      <!-- List View -->
      <div v-if="activeTab === 'list'">
        <SchedulingList
          :schedules="schedules"
          :loading="loading"
          @edit="handleEditSchedule"
          @delete="handleDeleteSchedule"
        />
      </div>

      <!-- Shift Templates -->
      <div v-if="activeTab === 'templates'">
        <ShiftTemplatesList
          :templates="shiftTemplates"
          :loading="loading"
          @edit="handleEditTemplate"
          @delete="handleDeleteTemplate"
        />
      </div>

      <!-- Conflicts -->
      <div v-if="activeTab === 'conflicts'">
        <SchedulingConflicts
          :conflicts="conflicts"
          :loading="loading"
          @resolve="handleResolveConflict"
        />
      </div>

      <!-- Swap Requests -->
      <div v-if="activeTab === 'swaps'">
        <SwapRequests
          :requests="swapRequests"
          :loading="loading"
          @approve="handleApproveSwap"
          @reject="handleRejectSwap"
        />
      </div>
    </div>

    <!-- Create/Edit Schedule Modal -->
    <ScheduleFormModal
      v-if="showScheduleModal"
      :schedule="selectedSchedule"
      :shift-templates="shiftTemplates"
      @save="handleSaveSchedule"
      @close="closeScheduleModal"
    />

    <!-- Create/Edit Shift Template Modal -->
    <ShiftTemplateFormModal
      v-model="showTemplateFormModal"
      :template="selectedTemplate"
      :restaurant-id="restaurantId"
      @save="handleSaveTemplate"
    />

    <!-- Loading Overlay -->
    <div
      v-if="loading"
      class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg p-8 flex flex-col items-center">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"
        ></div>
        <p class="mt-4 text-gray-700 font-medium">載入中...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { schedulingService } from '@/services/schedulingService'
import type {
  EmployeeSchedule,
  ShiftTemplate,
  SchedulingConflict,
  SwapRequest,
} from '@/types/scheduling'
import {
  CalendarIcon,
  PlusIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  ListBulletIcon,
} from '@heroicons/vue/24/outline'
import SchedulingCalendar from '@/components/scheduling/SchedulingCalendar.vue'
import SchedulingList from '@/components/scheduling/SchedulingList.vue'
import ShiftTemplatesList from '@/components/scheduling/ShiftTemplatesList.vue'
import SchedulingConflicts from '@/components/scheduling/SchedulingConflicts.vue'
import SwapRequests from '@/components/scheduling/SwapRequests.vue'
import ScheduleFormModal from '@/components/scheduling/ScheduleFormModal.vue'
import ShiftTemplateFormModal from '@/components/scheduling/ShiftTemplateFormModal.vue'

// Auth
const authStore = useAuthStore()

// State
const loading = ref(false)
const error = ref<string | null>(null)
const activeTab = ref('calendar')
const schedules = ref<EmployeeSchedule[]>([])
const shiftTemplates = ref<ShiftTemplate[]>([])
const conflicts = ref<SchedulingConflict[]>([])
const swapRequests = ref<SwapRequest[]>([])
const showScheduleModal = ref(false)
const selectedSchedule = ref<EmployeeSchedule | null>(null)
const showTemplateFormModal = ref(false)
const selectedTemplate = ref<ShiftTemplate | null>(null)

// Get restaurant ID from auth store
const restaurantId = computed(() => authStore.user?.restaurantId || 1)

// Icon mapping for tabs
const getIconComponent = (icon: string) => {
  const iconMap: Record<string, any> = {
    calendar: CalendarIcon,
    list: ListBulletIcon,
    templates: CalendarIcon,
    conflicts: ExclamationTriangleIcon,
    swaps: ArrowPathIcon,
  }
  return iconMap[icon] || CalendarIcon
}

// Tabs
const tabs = computed(() => [
  { id: 'calendar', label: '日曆視圖', icon: 'calendar', badge: null },
  { id: 'list', label: '清單視圖', icon: 'list', badge: schedules.value.length || null },
  { id: 'templates', label: '班別模板', icon: 'templates', badge: shiftTemplates.value.length || null },
  {
    id: 'conflicts',
    label: '衝突警告',
    icon: 'conflicts',
    badge: conflicts.value.filter((c) => c.severity === 'error').length || null,
  },
  {
    id: 'swaps',
    label: '換班申請',
    icon: 'swaps',
    badge: swapRequests.value.filter((r) => r.status === 'pending').length || null,
  },
])

// Methods
const switchTab = (tabId: string) => {
  activeTab.value = tabId
}

const refreshData = async () => {
  loading.value = true
  error.value = null

  try {
    await Promise.all([
      fetchSchedules(),
      fetchShiftTemplates(),
      fetchConflicts(),
      fetchSwapRequests(),
    ])
  } catch (err) {
    console.error('Failed to refresh data:', err)
    error.value = err instanceof Error ? err.message : 'Failed to load data'
  } finally {
    loading.value = false
  }
}

const fetchSchedules = async () => {
  try {
    // Get schedules for the next 30 days
    const today = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 30)

    const response = await schedulingService.getSchedules({
      restaurantId: restaurantId.value,
      startDate: formatDate(today),
      endDate: formatDate(endDate),
      limit: 100,
    })

    schedules.value = response.data
  } catch (err) {
    console.error('Failed to fetch schedules:', err)
    throw err
  }
}

const fetchShiftTemplates = async () => {
  try {
    shiftTemplates.value = await schedulingService.getShiftTemplates(
      restaurantId.value
    )
  } catch (err) {
    console.error('Failed to fetch shift templates:', err)
    throw err
  }
}

const fetchConflicts = async () => {
  try {
    const response = await schedulingService.getConflicts({
      restaurantId: restaurantId.value,
      status: 'unresolved',
      limit: 50,
    })
    conflicts.value = response.data
  } catch (err) {
    console.error('Failed to fetch conflicts:', err)
    // Don't throw - conflicts are optional
    conflicts.value = []
  }
}

const fetchSwapRequests = async () => {
  try {
    const response = await schedulingService.getSwapRequests({
      restaurantId: restaurantId.value,
      status: 'pending',
      limit: 50,
    })
    swapRequests.value = response.data
  } catch (err) {
    console.error('Failed to fetch swap requests:', err)
    // Don't throw - swap requests are optional
    swapRequests.value = []
  }
}

const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const showCreateScheduleModal = () => {
  selectedSchedule.value = null
  showScheduleModal.value = true
}

const closeScheduleModal = () => {
  showScheduleModal.value = false
  selectedSchedule.value = null
}

const handleDateSelect = (date: string) => {
  console.log('Date selected:', date)
  // TODO: Filter schedules by date or open create modal
}

const handleScheduleClick = (schedule: EmployeeSchedule) => {
  selectedSchedule.value = schedule
  showScheduleModal.value = true
}

const handleEditSchedule = (schedule: EmployeeSchedule) => {
  selectedSchedule.value = schedule
  showScheduleModal.value = true
}

const handleDeleteSchedule = async (schedule: EmployeeSchedule) => {
  if (confirm(`確定要刪除此排班嗎？`)) {
    try {
      loading.value = true
      await schedulingService.deleteSchedule(schedule.id)
      await refreshData()
      console.log('Schedule deleted successfully:', schedule.id)
    } catch (err) {
      console.error('Failed to delete schedule:', err)
      error.value = err instanceof Error ? err.message : 'Failed to delete schedule'
      alert('刪除排班失敗，請稍後再試')
    } finally {
      loading.value = false
    }
  }
}

const handleSaveSchedule = async (scheduleData: any) => {
  try {
    loading.value = true

    if (selectedSchedule.value?.id) {
      // Update existing schedule
      await schedulingService.updateSchedule(selectedSchedule.value.id, scheduleData)
    } else {
      // Create new schedule
      await schedulingService.createSchedule(restaurantId.value, scheduleData)
    }

    closeScheduleModal()
    await refreshData()
  } catch (err) {
    console.error('Failed to save schedule:', err)
    error.value = err instanceof Error ? err.message : 'Failed to save schedule'
    alert('儲存排班失敗，請稍後再試')
  } finally {
    loading.value = false
  }
}

const handleEditTemplate = (template: ShiftTemplate) => {
  selectedTemplate.value = template
  showTemplateFormModal.value = true
}

const showCreateTemplateModal = () => {
  selectedTemplate.value = null
  showTemplateFormModal.value = true
}

const handleSaveTemplate = async (templateData: any) => {
  try {
    loading.value = true

    if (selectedTemplate.value?.id) {
      // Update existing template
      await schedulingService.updateShiftTemplate(selectedTemplate.value.id, templateData)
    } else {
      // Create new template
      await schedulingService.createShiftTemplate(restaurantId.value, templateData)
    }

    showTemplateFormModal.value = false
    selectedTemplate.value = null
    await refreshData()
  } catch (err) {
    console.error('Failed to save template:', err)
    error.value = err instanceof Error ? err.message : 'Failed to save template'
    alert('儲存班別模板失敗，請稍後再試')
  } finally {
    loading.value = false
  }
}

const handleDeleteTemplate = async (template: ShiftTemplate) => {
  if (confirm(`確定要刪除班別模板「${template.name}」嗎？`)) {
    try {
      loading.value = true
      await schedulingService.deleteShiftTemplate(template.id)
      await refreshData()
      console.log('Template deleted successfully:', template.id)
    } catch (err) {
      console.error('Failed to delete template:', err)
      error.value = err instanceof Error ? err.message : 'Failed to delete template'
      alert('刪除班別模板失敗，請稍後再試')
    } finally {
      loading.value = false
    }
  }
}

const handleResolveConflict = async (conflict: SchedulingConflict) => {
  // Get current user ID from auth store
  const userId = authStore.user?.id
  if (!userId) {
    alert('無法取得使用者資訊')
    return
  }

  const resolutionNotes = prompt('請輸入解決方案說明：')
  if (resolutionNotes) {
    try {
      loading.value = true
      await schedulingService.resolveConflict(conflict.id, userId, resolutionNotes)
      await refreshData()
      console.log('Conflict resolved:', conflict.id)
    } catch (err) {
      console.error('Failed to resolve conflict:', err)
      error.value = err instanceof Error ? err.message : 'Failed to resolve conflict'
      alert('解決衝突失敗，請稍後再試')
    } finally {
      loading.value = false
    }
  }
}

const handleApproveSwap = async (request: SwapRequest) => {
  if (confirm(`確定要核准此換班申請嗎？`)) {
    // Get current manager ID from auth store
    const managerId = authStore.user?.id
    if (!managerId) {
      alert('無法取得管理員資訊')
      return
    }

    try {
      loading.value = true
      await schedulingService.approveSwapRequest(request.id, managerId)
      await refreshData()
      console.log('Swap request approved:', request.id)
    } catch (err) {
      console.error('Failed to approve swap request:', err)
      error.value = err instanceof Error ? err.message : 'Failed to approve swap'
      alert('核准換班申請失敗，請稍後再試')
    } finally {
      loading.value = false
    }
  }
}

const handleRejectSwap = async (request: SwapRequest) => {
  const reason = prompt('請輸入拒絕原因：')
  if (reason) {
    // Get current manager ID from auth store
    const managerId = authStore.user?.id
    if (!managerId) {
      alert('無法取得管理員資訊')
      return
    }

    try {
      loading.value = true
      await schedulingService.rejectSwapRequest(request.id, managerId, reason)
      await refreshData()
      console.log('Swap request rejected:', request.id)
    } catch (err) {
      console.error('Failed to reject swap request:', err)
      error.value = err instanceof Error ? err.message : 'Failed to reject swap'
      alert('拒絕換班申請失敗，請稍後再試')
    } finally {
      loading.value = false
    }
  }
}

// Lifecycle
onMounted(() => {
  refreshData()
})
</script>
