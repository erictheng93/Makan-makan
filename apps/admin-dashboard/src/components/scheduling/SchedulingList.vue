<template>
  <div class="scheduling-list">
    <!-- Enhanced Toolbar -->
    <div class="list-toolbar">
      <div class="toolbar-left">
        <!-- Search -->
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜尋員工姓名..."
            class="search-input"
          />
          <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">✕</button>
        </div>

        <!-- Date Range Filter -->
        <div class="date-filter">
          <span class="filter-icon">📅</span>
          <input v-model="startDate" type="date" class="date-input" />
          <span class="date-separator">至</span>
          <input v-model="endDate" type="date" class="date-input" />
        </div>
      </div>

      <div class="toolbar-right">
        <!-- Status Filter -->
        <select v-model="statusFilter" class="status-select">
          <option value="">全部狀態</option>
          <option value="scheduled">已排班</option>
          <option value="confirmed">已確認</option>
          <option value="completed">已完成</option>
          <option value="cancelled">已取消</option>
        </select>

        <!-- Batch Actions -->
        <div class="batch-container">
          <button
            class="batch-btn"
            :disabled="selectedItems.length === 0"
            @click="showBatchMenu = !showBatchMenu"
          >
            <span>📋</span>
            <span>批量操作 ({{ selectedItems.length }})</span>
          </button>

          <!-- Batch Menu -->
          <div v-if="showBatchMenu && selectedItems.length > 0" class="batch-menu">
            <button class="menu-item" @click="batchConfirm">
              <span>✓</span>
              <span>批量確認</span>
            </button>
            <button class="menu-item" @click="batchCancel">
              <span>✕</span>
              <span>批量取消</span>
            </button>
            <button class="menu-item" @click="batchExport">
              <span>📥</span>
              <span>匯出選中</span>
            </button>
          </div>
        </div>

        <!-- Export Button -->
        <button class="export-btn" @click="handleExport">
          <span>📥</span>
          <span>匯出報表</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner-small"></div>
      <p>載入排班清單中...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredSchedules.length === 0" class="empty-state">
      <div class="empty-icon">📅</div>
      <h3>尚無排班資料</h3>
      <p>點擊上方「新增排班」按鈕開始建立員工班表</p>
    </div>

    <!-- Schedules Table -->
    <div v-else class="schedules-table">
      <table>
        <thead>
          <tr>
            <th class="checkbox-col">
              <input
                type="checkbox"
                :checked="isAllSelected"
                @change="toggleSelectAll"
                class="checkbox-input"
              />
            </th>
            <th class="sortable" @click="toggleSort('workDate')">
              <div class="th-content">
                <span>日期</span>
                <span class="sort-icon" v-if="sortBy === 'workDate'">
                  {{ sortOrder === 'asc' ? '↑' : '↓' }}
                </span>
              </div>
            </th>
            <th class="sortable" @click="toggleSort('employeeName')">
              <div class="th-content">
                <span>員工</span>
                <span class="sort-icon" v-if="sortBy === 'employeeName'">
                  {{ sortOrder === 'asc' ? '↑' : '↓' }}
                </span>
              </div>
            </th>
            <th>班別</th>
            <th>時間</th>
            <th class="sortable" @click="toggleSort('scheduledHours')">
              <div class="th-content">
                <span>工時</span>
                <span class="sort-icon" v-if="sortBy === 'scheduledHours'">
                  {{ sortOrder === 'asc' ? '↑' : '↓' }}
                </span>
              </div>
            </th>
            <th>狀態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="schedule in paginatedSchedules"
            :key="schedule.id"
            :class="{ selected: isSelected(schedule.id) }"
          >
            <td class="checkbox-col">
              <input
                type="checkbox"
                :checked="isSelected(schedule.id)"
                @change="toggleSelect(schedule.id)"
                class="checkbox-input"
              />
            </td>
            <td>{{ formatDate(schedule.workDate) }}</td>
            <td>
              <div class="employee-cell">
                <span class="employee-name">{{ schedule.employeeName }}</span>
              </div>
            </td>
            <td>
              <span
                v-if="schedule.shiftTemplate"
                class="shift-badge"
                :style="{ backgroundColor: schedule.shiftTemplate.colorCode + '20', color: schedule.shiftTemplate.colorCode }"
              >
                {{ schedule.shiftTemplate.name }}
              </span>
              <span v-else class="text-muted">-</span>
            </td>
            <td>
              <span class="time-range">
                {{ schedule.startTime }} - {{ schedule.endTime }}
              </span>
            </td>
            <td>{{ schedule.scheduledHours }} 小時</td>
            <td>
              <span
                class="status-badge"
                :class="`status-${schedule.status}`"
              >
                {{ getStatusLabel(schedule.status) }}
              </span>
            </td>
            <td>
              <div class="action-buttons">
                <button class="btn-icon" @click="$emit('edit', schedule)" title="編輯">
                  ✏️
                </button>
                <button class="btn-icon" @click="$emit('delete', schedule)" title="刪除">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="pagination" v-if="totalPages > 1">
        <div class="pagination-info">
          顯示 {{ startIndex + 1 }}-{{ endIndex }} 共 {{ filteredSchedules.length }} 筆
        </div>
        <div class="pagination-controls">
          <button
            class="page-btn"
            :disabled="currentPage === 1"
            @click="goToPage(1)"
            title="第一頁"
          >
            ⏮
          </button>
          <button
            class="page-btn"
            :disabled="currentPage === 1"
            @click="goToPage(currentPage - 1)"
            title="上一頁"
          >
            ◀
          </button>

          <div class="page-numbers">
            <button
              v-for="page in visiblePages"
              :key="page"
              class="page-btn"
              :class="{ active: page === currentPage }"
              @click="goToPage(page)"
            >
              {{ page }}
            </button>
          </div>

          <button
            class="page-btn"
            :disabled="currentPage === totalPages"
            @click="goToPage(currentPage + 1)"
            title="下一頁"
          >
            ▶
          </button>
          <button
            class="page-btn"
            :disabled="currentPage === totalPages"
            @click="goToPage(totalPages)"
            title="最後一頁"
          >
            ⏭
          </button>
        </div>
        <div class="page-size-selector">
          <select v-model.number="pageSize" class="page-size-select">
            <option :value="10">10 筆/頁</option>
            <option :value="20">20 筆/頁</option>
            <option :value="50">50 筆/頁</option>
            <option :value="100">100 筆/頁</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { EmployeeSchedule } from '@/types/scheduling'

interface Props {
  schedules: EmployeeSchedule[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<{
  edit: [schedule: EmployeeSchedule]
  delete: [schedule: EmployeeSchedule]
  batchUpdate: [ids: string[], action: string]
}>()

// State
const searchQuery = ref('')
const statusFilter = ref('')
const startDate = ref('')
const endDate = ref('')
const showBatchMenu = ref(false)
const selectedItems = ref<string[]>([])

// Sorting
const sortBy = ref<'workDate' | 'employeeName' | 'scheduledHours'>('workDate')
const sortOrder = ref<'asc' | 'desc'>('desc')

// Pagination
const currentPage = ref(1)
const pageSize = ref(20)

// Computed - Filtered and Sorted
const filteredSchedules = computed(() => {
  let result = props.schedules

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(s =>
      s.employeeName?.toLowerCase().includes(query) ?? false
    )
  }

  // Status filter
  if (statusFilter.value) {
    result = result.filter(s => s.status === statusFilter.value)
  }

  // Date range filter
  if (startDate.value) {
    result = result.filter(s => new Date(s.workDate) >= new Date(startDate.value))
  }
  if (endDate.value) {
    result = result.filter(s => new Date(s.workDate) <= new Date(endDate.value))
  }

  // Sorting
  return result.sort((a, b) => {
    let compareValue = 0

    if (sortBy.value === 'workDate') {
      compareValue = new Date(a.workDate).getTime() - new Date(b.workDate).getTime()
    } else if (sortBy.value === 'employeeName') {
      compareValue = (a.employeeName || '').localeCompare(b.employeeName || '')
    } else if (sortBy.value === 'scheduledHours') {
      compareValue = (a.scheduledHours || 0) - (b.scheduledHours || 0)
    }

    return sortOrder.value === 'asc' ? compareValue : -compareValue
  })
})

// Computed - Pagination
const totalPages = computed(() => Math.ceil(filteredSchedules.value.length / pageSize.value))

const startIndex = computed(() => (currentPage.value - 1) * pageSize.value)
const endIndex = computed(() => Math.min(startIndex.value + pageSize.value, filteredSchedules.value.length))

const paginatedSchedules = computed(() => {
  return filteredSchedules.value.slice(startIndex.value, endIndex.value)
})

const visiblePages = computed(() => {
  const pages: number[] = []
  const maxVisible = 5
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages.value, start + maxVisible - 1)

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return pages
})

// Computed - Selection
const isAllSelected = computed(() => {
  return paginatedSchedules.value.length > 0 &&
    paginatedSchedules.value.every(s => selectedItems.value.includes(s.id))
})

// Watch - Reset page when filters change
watch([searchQuery, statusFilter, startDate, endDate, pageSize], () => {
  currentPage.value = 1
})

// Methods - Sorting
const toggleSort = (field: 'workDate' | 'employeeName' | 'scheduledHours') => {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'asc'
  }
}

// Methods - Selection
const toggleSelect = (id: string) => {
  const index = selectedItems.value.indexOf(id)
  if (index > -1) {
    selectedItems.value.splice(index, 1)
  } else {
    selectedItems.value.push(id)
  }
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    // Deselect all on current page
    const currentPageIds = paginatedSchedules.value.map(s => s.id)
    selectedItems.value = selectedItems.value.filter(id => !currentPageIds.includes(id))
  } else {
    // Select all on current page
    const currentPageIds = paginatedSchedules.value.map(s => s.id)
    const newIds = currentPageIds.filter(id => !selectedItems.value.includes(id))
    selectedItems.value.push(...newIds)
  }
}

const isSelected = (id: string): boolean => {
  return selectedItems.value.includes(id)
}

// Methods - Pagination
const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

// Methods - Batch Operations
const batchConfirm = () => {
  if (selectedItems.value.length === 0) return

  if (confirm(`確定要將 ${selectedItems.value.length} 筆排班標記為已確認嗎？`)) {
    emit('batchUpdate', selectedItems.value, 'confirm')
    selectedItems.value = []
    showBatchMenu.value = false
  }
}

const batchCancel = () => {
  if (selectedItems.value.length === 0) return

  if (confirm(`確定要取消 ${selectedItems.value.length} 筆排班嗎？`)) {
    emit('batchUpdate', selectedItems.value, 'cancel')
    selectedItems.value = []
    showBatchMenu.value = false
  }
}

const batchExport = () => {
  if (selectedItems.value.length === 0) return

  const selectedSchedules = props.schedules.filter(s => selectedItems.value.includes(s.id))
  exportToCSV(selectedSchedules, `排班資料_選中_${new Date().toISOString().split('T')[0]}.csv`)
  showBatchMenu.value = false
}

// Methods - Export
const handleExport = () => {
  exportToCSV(filteredSchedules.value, `排班資料_${new Date().toISOString().split('T')[0]}.csv`)
}

const exportToCSV = (data: EmployeeSchedule[], filename: string) => {
  if (data.length === 0) {
    alert('沒有資料可匯出')
    return
  }

  // CSV Header
  const headers = ['日期', '星期', '員工', '班別', '開始時間', '結束時間', '工時', '狀態']

  // CSV Rows
  const rows = data.map(schedule => {
    const date = new Date(schedule.workDate)
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']

    return [
      schedule.workDate,
      weekdays[date.getDay()],
      schedule.employeeName || '',
      schedule.shiftTemplate?.name || '-',
      schedule.startTime,
      schedule.endTime,
      schedule.scheduledHours?.toString() || '0',
      getStatusLabel(schedule.status)
    ]
  })

  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  // Add BOM for UTF-8
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })

  // Create download link
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Methods - Formatting
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const weekday = weekdays[date.getDay()]
  return `${month}/${day} (${weekday})`
}

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    scheduled: '已排班',
    confirmed: '已確認',
    completed: '已完成',
    cancelled: '已取消',
    no_show: '缺席'
  }
  return labels[status] || status
}
</script>

<style scoped>
.scheduling-list {
  width: 100%;
}

/* ==================== Enhanced Toolbar ==================== */
.list-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding: 20px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* Search Box */
.search-box {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 250px;
}

.search-icon {
  position: absolute;
  left: 12px;
  font-size: 16px;
  color: #6b7280;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 10px 40px 10px 40px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
  transition: all 0.3s ease;
  background: white;
}

.search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.clear-btn {
  position: absolute;
  right: 8px;
  padding: 4px 8px;
  border: none;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

/* Date Filter */
.date-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  transition: all 0.3s ease;
}

.date-filter:focus-within {
  border-color: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.filter-icon {
  font-size: 16px;
  color: #6b7280;
}

.date-input {
  border: none;
  outline: none;
  font-size: 13px;
  color: #374151;
  padding: 2px;
  min-width: 120px;
  cursor: pointer;
}

.date-separator {
  color: #9ca3af;
  font-size: 12px;
  font-weight: 600;
}

/* Status Select */
.status-select {
  padding: 10px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  background: white;
  outline: none;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 140px;
}

.status-select:hover {
  border-color: #d1d5db;
}

.status-select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

/* Batch Actions */
.batch-container {
  position: relative;
}

.batch-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 2px solid #3b82f6;
  background: white;
  color: #3b82f6;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.batch-btn:hover:not(:disabled) {
  background: #eff6ff;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);
}

.batch-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: #e5e7eb;
  color: #9ca3af;
}

.batch-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 100;
  min-width: 180px;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: white;
  color: #374151;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 1px solid #f3f4f6;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:hover {
  background: #f9fafb;
  color: #3b82f6;
}

/* Export Button */
.export-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 2px solid #10b981;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.export-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(16, 185, 129, 0.3);
}

/* ==================== Loading & Empty States ==================== */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #6b7280;
}

.spinner-small {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f4f6;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: #6b7280;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-state h3 {
  font-size: 20px;
  font-weight: 700;
  color: #374151;
  margin: 0 0 8px 0;
}

.empty-state p {
  font-size: 14px;
  margin: 0;
}

/* ==================== Table ==================== */
.schedules-table {
  overflow-x: auto;
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
}

th {
  padding: 14px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  border-bottom: 2px solid #e5e7eb;
}

.checkbox-col {
  width: 40px;
  text-align: center;
}

.sortable {
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}

.sortable:hover {
  background: rgba(59, 130, 246, 0.05);
  color: #3b82f6;
}

.th-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sort-icon {
  font-size: 14px;
  color: #3b82f6;
  font-weight: 700;
}

td {
  padding: 16px;
  border-top: 1px solid #e5e7eb;
  font-size: 14px;
  color: #374151;
  transition: all 0.2s;
}

tbody tr {
  transition: all 0.3s ease;
}

tbody tr:hover {
  background: #f9fafb;
}

tbody tr.selected {
  background: #eff6ff;
}

tbody tr.selected:hover {
  background: #dbeafe;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #3b82f6;
}

.employee-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.employee-name {
  font-weight: 600;
  color: #1a1a1a;
}

.shift-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid currentColor;
}

.time-range {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #4b5563;
  font-weight: 600;
}

.status-badge {
  display: inline-block;
  padding: 5px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid currentColor;
}

.status-scheduled {
  background: #dbeafe;
  color: #1e40af;
}

.status-confirmed {
  background: #d1fae5;
  color: #065f46;
}

.status-completed {
  background: #e0e7ff;
  color: #3730a3;
}

.status-cancelled {
  background: #fee2e2;
  color: #991b1b;
}

.status-no_show {
  background: #fef3c7;
  color: #92400e;
}

.text-muted {
  color: #9ca3af;
  font-style: italic;
}

.action-buttons {
  display: flex;
  gap: 6px;
}

.btn-icon {
  padding: 6px 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  border-radius: 6px;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: #f3f4f6;
  transform: scale(1.1);
}

/* ==================== Pagination ==================== */
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.pagination-info {
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  white-space: nowrap;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-numbers {
  display: flex;
  gap: 4px;
}

.page-btn {
  min-width: 36px;
  height: 36px;
  padding: 0 10px;
  border: 2px solid #e5e7eb;
  background: white;
  color: #6b7280;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-btn:hover:not(:disabled) {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
  transform: translateY(-1px);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-btn.active {
  border-color: #3b82f6;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
}

.page-size-selector {
  white-space: nowrap;
}

.page-size-select {
  padding: 8px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  background: white;
  outline: none;
  cursor: pointer;
  transition: all 0.3s ease;
}

.page-size-select:hover {
  border-color: #d1d5db;
}

.page-size-select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* ==================== Animations ==================== */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ==================== Responsive Design ==================== */
@media (max-width: 1024px) {
  .list-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-left,
  .toolbar-right {
    width: 100%;
    justify-content: space-between;
  }

  .search-box {
    min-width: auto;
    flex: 1;
  }
}

@media (max-width: 768px) {
  .list-toolbar {
    padding: 16px;
  }

  .toolbar-left,
  .toolbar-right {
    flex-direction: column;
    gap: 8px;
  }

  .search-box,
  .date-filter,
  .status-select,
  .batch-btn,
  .export-btn {
    width: 100%;
  }

  .pagination {
    flex-direction: column;
    gap: 12px;
  }

  .pagination-controls {
    flex-wrap: wrap;
    justify-content: center;
  }

  .page-numbers {
    flex-wrap: wrap;
    justify-content: center;
  }

  table {
    font-size: 13px;
  }

  th,
  td {
    padding: 10px 8px;
  }

  .th-content {
    flex-direction: column;
    gap: 2px;
  }
}

@media (max-width: 640px) {
  .date-filter {
    flex-direction: column;
    align-items: flex-start;
  }

  .date-input {
    width: 100%;
  }

  .pagination-info {
    text-align: center;
    width: 100%;
  }

  .page-btn {
    min-width: 32px;
    height: 32px;
    font-size: 12px;
  }
}
</style>
