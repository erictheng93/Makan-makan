<template>
  <div class="shift-templates-list">
    <!-- Header -->
    <div class="templates-header">
      <div class="header-left">
        <h2 class="header-title">
          <span class="title-icon">🏷️</span>
          班別模板管理
        </h2>
        <p class="header-subtitle" v-if="!loading">
          共 {{ templates.length }} 個班別模板
        </p>
      </div>
      <div class="header-right">
        <button class="add-btn" @click="$emit('add')">
          <span>➕</span>
          <span>新增模板</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>載入班別模板中...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="templates.length === 0" class="empty-state">
      <div class="empty-icon">🏷️</div>
      <h3 class="empty-title">尚無班別模板</h3>
      <p class="empty-text">點擊「新增模板」按鈕開始建立班別模板</p>
      <button class="empty-action-btn" @click="$emit('add')">
        <span>➕</span>
        <span>新增第一個模板</span>
      </button>
    </div>

    <!-- Templates Grid -->
    <div v-else class="templates-grid">
      <div
        v-for="template in templates"
        :key="template.id"
        class="template-card"
        :style="{ borderLeftColor: template.colorCode }"
      >
        <!-- Card Header -->
        <div class="card-header">
          <div class="template-badge" :style="{
            backgroundColor: template.colorCode + '15',
            color: template.colorCode,
            borderColor: template.colorCode
          }">
            <span class="badge-dot" :style="{ backgroundColor: template.colorCode }"></span>
            <span class="badge-text">{{ template.name }}</span>
          </div>
          <div class="card-actions">
            <button
              class="action-btn edit-btn"
              @click="$emit('edit', template)"
              title="編輯模板"
            >
              ✏️
            </button>
            <button
              class="action-btn delete-btn"
              @click="handleDelete(template)"
              title="刪除模板"
            >
              🗑️
            </button>
          </div>
        </div>

        <!-- Card Content -->
        <div class="card-content">
          <!-- Time Info -->
          <div class="info-section">
            <div class="info-item">
              <span class="info-icon">🕐</span>
              <div class="info-details">
                <span class="info-label">開始時間</span>
                <span class="info-value time-value">{{ template.startTime }}</span>
              </div>
            </div>
            <div class="info-item">
              <span class="info-icon">🕐</span>
              <div class="info-details">
                <span class="info-label">結束時間</span>
                <span class="info-value time-value">{{ template.endTime }}</span>
              </div>
            </div>
          </div>

          <!-- Duration -->
          <div class="duration-section">
            <div class="duration-bar">
              <div class="duration-fill" :style="{
                width: `${(calculateDuration(template.startTime, template.endTime) / 24) * 100}%`,
                backgroundColor: template.colorCode
              }"></div>
            </div>
            <div class="duration-text">
              <span class="duration-icon">⏱️</span>
              <span class="duration-value">{{ calculateDuration(template.startTime, template.endTime) }} 小時</span>
            </div>
          </div>

          <!-- Description -->
          <div class="description-section" v-if="template.description">
            <span class="description-icon">📝</span>
            <p class="description-text">{{ template.description }}</p>
          </div>

          <!-- Metadata -->
          <div class="metadata-section">
            <div class="metadata-item">
              <span class="metadata-icon">📊</span>
              <span class="metadata-text">使用中: {{ template.usageCount || 0 }} 次</span>
            </div>
            <div class="metadata-item" v-if="template.isDefault">
              <span class="default-badge">⭐ 預設模板</span>
            </div>
          </div>
        </div>

        <!-- Card Footer -->
        <div class="card-footer">
          <button
            class="use-btn"
            @click="$emit('use', template)"
            :style="{
              backgroundColor: template.colorCode + '15',
              color: template.colorCode,
              borderColor: template.colorCode
            }"
          >
            <span>✓</span>
            <span>使用此模板</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ShiftTemplate } from '@/types/scheduling'

interface Props {
  templates: ShiftTemplate[]
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<{
  add: []
  edit: [template: ShiftTemplate]
  delete: [template: ShiftTemplate]
  use: [template: ShiftTemplate]
}>()

// Methods
const calculateDuration = (startTime: string, endTime: string): number => {
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)

  const startMinutes = startHour * 60 + startMin
  let endMinutes = endHour * 60 + endMin

  // Handle overnight shifts
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60
  }

  const durationMinutes = endMinutes - startMinutes
  return Math.round((durationMinutes / 60) * 10) / 10 // Round to 1 decimal place
}

const handleDelete = (template: ShiftTemplate) => {
  if (confirm(`確定要刪除班別模板「${template.name}」嗎？此操作無法復原。`)) {
    emit('delete', template)
  }
}
</script>

<style scoped>
.shift-templates-list {
  width: 100%;
}

/* ==================== Header ==================== */
.templates-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  padding: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.header-left {
  flex: 1;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.title-icon {
  font-size: 28px;
}

.header-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.header-right {
  display: flex;
  gap: 12px;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: 2px solid #3b82f6;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(59, 130, 246, 0.3);
}

/* ==================== Loading State ==================== */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 20px;
  color: #6b7280;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #f3f4f6;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ==================== Empty State ==================== */
.empty-state {
  text-align: center;
  padding: 100px 20px;
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 24px;
  opacity: 0.5;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-15px);
  }
}

.empty-title {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 12px 0;
}

.empty-text {
  font-size: 15px;
  color: #6b7280;
  margin: 0 0 32px 0;
}

.empty-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 14px 32px;
  border: 2px solid #3b82f6;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.2);
}

.empty-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3);
}

/* ==================== Templates Grid ==================== */
.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 24px;
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ==================== Template Card ==================== */
.template-card {
  background: white;
  border-radius: 12px;
  border: 2px solid #e5e7eb;
  border-left-width: 5px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.template-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  border-color: currentColor;
}

/* Card Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
  border-bottom: 1px solid #e5e7eb;
}

.template-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  border: 2px solid;
}

.badge-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.2);
  }
}

.card-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 8px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  border-radius: 8px;
  transition: all 0.2s;
}

.action-btn:hover {
  transform: scale(1.15);
}

.edit-btn:hover {
  background: #eff6ff;
}

.delete-btn:hover {
  background: #fee2e2;
}

/* Card Content */
.card-content {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-section {
  display: flex;
  gap: 16px;
}

.info-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.info-icon {
  font-size: 20px;
}

.info-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
}

.time-value {
  font-family: 'Courier New', monospace;
  color: #3b82f6;
}

/* Duration Section */
.duration-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.duration-bar {
  width: 100%;
  height: 8px;
  background: #f3f4f6;
  border-radius: 10px;
  overflow: hidden;
}

.duration-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 10px;
  transition: width 0.3s ease;
}

.duration-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
}

.duration-icon {
  font-size: 16px;
}

.duration-value {
  color: #1a1a1a;
}

/* Description Section */
.description-section {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.description-icon {
  font-size: 16px;
  color: #6b7280;
}

.description-text {
  flex: 1;
  font-size: 13px;
  line-height: 1.6;
  color: #4b5563;
  margin: 0;
}

/* Metadata Section */
.metadata-section {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}

.metadata-icon {
  font-size: 14px;
}

.default-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid #fbbf24;
}

/* Card Footer */
.card-footer {
  padding: 16px 20px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.use-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  border: 2px solid;
  background: transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
}

.use-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

/* ==================== Responsive Design ==================== */
@media (max-width: 1024px) {
  .templates-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .templates-header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .header-right {
    width: 100%;
  }

  .add-btn {
    width: 100%;
    justify-content: center;
  }

  .templates-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .info-section {
    flex-direction: column;
    gap: 12px;
  }
}

@media (max-width: 640px) {
  .templates-header {
    padding: 16px;
  }

  .header-title {
    font-size: 20px;
  }

  .card-header {
    padding: 16px;
  }

  .card-content {
    padding: 16px;
    gap: 14px;
  }

  .card-footer {
    padding: 12px 16px;
  }
}
</style>
