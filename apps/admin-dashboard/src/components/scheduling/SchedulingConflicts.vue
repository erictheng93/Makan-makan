<template>
  <div class="scheduling-conflicts">
    <!-- Header with Filters -->
    <div class="conflicts-header">
      <div class="header-info">
        <h3 class="conflicts-title">
          <span class="title-icon">⚠️</span>
          排班衝突警告
        </h3>
        <p class="conflicts-subtitle" v-if="!loading">
          共 {{ conflicts.length }} 個衝突需要處理
        </p>
      </div>
      <div class="header-filters">
        <button
          v-for="severity in severityFilters"
          :key="severity.value"
          class="filter-btn"
          :class="{ active: selectedSeverity === severity.value }"
          @click="selectedSeverity = severity.value"
        >
          <span>{{ severity.icon }}</span>
          <span>{{ severity.label }}</span>
          <span class="filter-count" v-if="getFilterCount(severity.value) > 0">
            {{ getFilterCount(severity.value) }}
          </span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>載入衝突資料中...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredConflicts.length === 0" class="empty-state">
      <div class="empty-icon">✅</div>
      <h3 class="empty-title">沒有排班衝突</h3>
      <p class="empty-text">
        {{ selectedSeverity === 'all' ? '所有排班都正常,沒有發現衝突' : `沒有 ${getSeverityLabel(selectedSeverity)} 級別的衝突` }}
      </p>
    </div>

    <!-- Conflicts List -->
    <div v-else class="conflicts-list">
      <transition-group name="list">
        <div
          v-for="conflict in filteredConflicts"
          :key="conflict.id"
          class="conflict-card"
          :class="`severity-${conflict.severity}`"
        >
          <!-- Card Header -->
          <div class="conflict-header">
            <div class="conflict-badge" :class="`badge-${conflict.severity}`">
              <span class="badge-icon">{{ getSeverityIcon(conflict.severity) }}</span>
              <span class="badge-text">{{ getSeverityLabel(conflict.severity) }}</span>
            </div>
            <div class="conflict-type">{{ getConflictTypeLabel(conflict.conflictType) }}</div>
          </div>

          <!-- Card Content -->
          <div class="conflict-content">
            <h4 class="conflict-message">{{ conflict.message }}</h4>
            <p v-if="conflict.details" class="conflict-details">{{ conflict.details }}</p>

            <!-- Affected Info -->
            <div class="conflict-meta">
              <div class="meta-item" v-if="conflict.employeeIds">
                <span class="meta-icon">👤</span>
                <span class="meta-text">影響員工: {{ conflict.employeeIds.split(',').length }} 人</span>
              </div>
              <div class="meta-item">
                <span class="meta-icon">📅</span>
                <span class="meta-text">檢測時間: {{ formatDate(conflict.detectedAt) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-icon">📋</span>
                <span class="meta-text">狀態: {{ getStatusLabel(conflict.status) }}</span>
              </div>
            </div>
          </div>

          <!-- Card Actions -->
          <div class="conflict-actions">
            <button
              class="action-btn btn-resolve"
              @click="handleResolve(conflict)"
              :disabled="conflict.status !== 'unresolved'"
            >
              <span>✓</span>
              <span>標記為已解決</span>
            </button>
            <button
              class="action-btn btn-ignore"
              @click="handleIgnore(conflict)"
              :disabled="conflict.status !== 'unresolved'"
            >
              <span>⊘</span>
              <span>忽略</span>
            </button>
            <button class="action-btn btn-details" @click="showDetails(conflict)">
              <span>ℹ</span>
              <span>查看詳情</span>
            </button>
          </div>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { SchedulingConflict } from '@/types/scheduling'

interface Props {
  conflicts: SchedulingConflict[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<{
  resolve: [conflict: SchedulingConflict]
}>()

// State
const selectedSeverity = ref<string>('all')

// Filters
const severityFilters = [
  { value: 'all', label: '全部', icon: '📊' },
  { value: 'error', label: '錯誤', icon: '🔴' },
  { value: 'warning', label: '警告', icon: '🟡' },
  { value: 'info', label: '資訊', icon: '🔵' }
]

// Computed
const filteredConflicts = computed(() => {
  if (selectedSeverity.value === 'all') {
    return props.conflicts
  }
  return props.conflicts.filter(c => c.severity === selectedSeverity.value)
})

const getFilterCount = (severity: string) => {
  if (severity === 'all') return props.conflicts.length
  return props.conflicts.filter(c => c.severity === severity).length
}

// Methods
const getSeverityIcon = (severity: string) => {
  const icons: Record<string, string> = {
    error: '🔴',
    warning: '🟡',
    info: '🔵'
  }
  return icons[severity] || '⚠️'
}

const getSeverityLabel = (severity: string) => {
  const labels: Record<string, string> = {
    error: '錯誤',
    warning: '警告',
    info: '資訊'
  }
  return labels[severity] || severity
}

const getConflictTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    overlapping_shifts: '班次重疊',
    insufficient_rest: '休息時間不足',
    max_hours_exceeded: '超時工作',
    consecutive_days_exceeded: '連續工作天數過多',
    skill_mismatch: '技能不匹配',
    leave_conflict: '請假衝突',
    availability_conflict: '可用性衝突'
  }
  return labels[type] || type
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    unresolved: '未解決',
    acknowledged: '已確認',
    resolved: '已解決',
    ignored: '已忽略'
  }
  return labels[status] || status
}

const formatDate = (dateString: string | Date) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const handleResolve = (conflict: SchedulingConflict) => {
  emit('resolve', conflict)
}

const handleIgnore = (conflict: SchedulingConflict) => {
  // TODO: Implement ignore functionality
  console.log('Ignore conflict:', conflict.id)
}

const showDetails = (conflict: SchedulingConflict) => {
  // TODO: Implement details modal
  console.log('Show conflict details:', conflict)
}
</script>

<style scoped>
.scheduling-conflicts {
  width: 100%;
}

/* Header */
.conflicts-header {
  margin-bottom: 24px;
}

.header-info {
  margin-bottom: 16px;
}

.conflicts-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.title-icon {
  font-size: 24px;
}

.conflicts-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

/* Filters */
.header-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 2px solid #e5e7eb;
  background: white;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.3s ease;
}

.filter-btn:hover {
  border-color: #d1d5db;
  background: #f9fafb;
}

.filter-btn.active {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #3b82f6;
}

.filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: #3b82f6;
  color: white;
  font-size: 11px;
  font-weight: 700;
  border-radius: 10px;
}

.filter-btn.active .filter-count {
  background: white;
  color: #3b82f6;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #6b7280;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f4f6;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 80px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.empty-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.empty-text {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

/* Conflicts List */
.conflicts-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* List Animation */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* Conflict Card */
.conflict-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  border-left: 4px solid transparent;
}

.conflict-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.conflict-card.severity-error {
  border-left-color: #ef4444;
  background: linear-gradient(135deg, #fff 0%, #fef2f2 100%);
}

.conflict-card.severity-warning {
  border-left-color: #f59e0b;
  background: linear-gradient(135deg, #fff 0%, #fef3c7 100%);
}

.conflict-card.severity-info {
  border-left-color: #3b82f6;
  background: linear-gradient(135deg, #fff 0%, #eff6ff 100%);
}

/* Card Header */
.conflict-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.conflict-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
}

.badge-error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.badge-warning {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.badge-info {
  background: #eff6ff;
  color: #1e40af;
  border: 1px solid #dbeafe;
}

.badge-icon {
  font-size: 14px;
}

.conflict-type {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  padding: 4px 10px;
  background: #f3f4f6;
  border-radius: 6px;
}

/* Card Content */
.conflict-content {
  margin-bottom: 16px;
}

.conflict-message {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.conflict-details {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.conflict-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #6b7280;
}

.meta-icon {
  font-size: 16px;
}

/* Card Actions */
.conflict-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-resolve {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.btn-resolve:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
}

.btn-ignore {
  background: #f3f4f6;
  color: #6b7280;
}

.btn-ignore:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-details {
  background: white;
  color: #3b82f6;
  border: 1px solid #3b82f6;
}

.btn-details:hover {
  background: #eff6ff;
}

/* Responsive */
@media (max-width: 768px) {
  .conflicts-header {
    margin-bottom: 16px;
  }

  .conflict-card {
    padding: 16px;
  }

  .conflict-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .conflict-meta {
    flex-direction: column;
    gap: 8px;
  }

  .conflict-actions {
    flex-direction: column;
  }

  .action-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
