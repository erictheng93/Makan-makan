<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ schedule ? '編輯排班' : '新增排班' }}</h2>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <form @submit.prevent="handleSubmit">
          <!-- Employee Selection -->
          <div class="form-group">
            <label class="form-label">
              員工 <span class="required">*</span>
            </label>
            <select
              v-model="formData.employeeId"
              class="form-control"
              :disabled="loading || !!schedule"
              required
            >
              <option value="">請選擇員工</option>
              <option
                v-for="emp in availableEmployees"
                :key="emp.id"
                :value="emp.id"
              >
                {{ emp.fullName }}
              </option>
            </select>
            <p v-if="schedule" class="form-hint">編輯模式下無法更改員工</p>
          </div>

          <!-- Date Selection -->
          <div class="form-group">
            <label class="form-label">
              排班日期 <span class="required">*</span>
            </label>
            <input
              v-model="formData.workDate"
              type="date"
              class="form-control"
              required
              @change="handleDateChange"
            />
          </div>

          <!-- Shift Template Selection -->
          <div class="form-group">
            <label class="form-label">
              班別模板 <span class="optional">(選填)</span>
            </label>
            <select
              v-model="formData.shiftTemplateId"
              class="form-control"
              @change="handleTemplateChange"
            >
              <option value="">自訂時間</option>
              <option
                v-for="template in shiftTemplates"
                :key="template.id"
                :value="template.id"
              >
                {{ template.name }} ({{ template.startTime }} - {{ template.endTime }})
              </option>
            </select>
          </div>

          <!-- Time Range -->
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">
                開始時間 <span class="required">*</span>
              </label>
              <input
                v-model="formData.startTime"
                type="time"
                class="form-control"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label">
                結束時間 <span class="required">*</span>
              </label>
              <input
                v-model="formData.endTime"
                type="time"
                class="form-control"
                required
              />
            </div>
          </div>

          <!-- Break Duration -->
          <div class="form-group">
            <label class="form-label">
              休息時間（分鐘） <span class="optional">(選填)</span>
            </label>
            <input
              v-model.number="formData.breakDurationMinutes"
              type="number"
              class="form-control"
              min="0"
              max="240"
              step="15"
            />
          </div>

          <!-- Scheduled Hours (Auto-calculated) -->
          <div class="form-group">
            <label class="form-label">
              預計工時
            </label>
            <input
              :value="calculatedHours"
              type="text"
              class="form-control"
              disabled
            />
          </div>

          <!-- Notes -->
          <div class="form-group">
            <label class="form-label">
              備註 <span class="optional">(選填)</span>
            </label>
            <textarea
              v-model="formData.notes"
              class="form-control"
              rows="3"
              placeholder="排班備註..."
            ></textarea>
          </div>

          <!-- Manager Notes (Admin/Owner only) -->
          <div class="form-group">
            <label class="form-label">
              管理備註 <span class="optional">(選填)</span>
            </label>
            <textarea
              v-model="formData.managerNotes"
              class="form-control"
              rows="2"
              placeholder="管理員備註..."
            ></textarea>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="error-message">
            <i>⚠️</i>
            {{ error }}
          </div>
        </form>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" @click="$emit('close')">
          取消
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="loading"
          @click="handleSubmit"
        >
          {{ loading ? '儲存中...' : '儲存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { schedulingService } from '@/services/schedulingService'
import type {
  EmployeeSchedule,
  ShiftTemplate,
  AvailableEmployee,
  CreateScheduleData,
  UpdateScheduleData,
} from '@/types/scheduling'

const props = defineProps<{
  schedule?: EmployeeSchedule | null
  shiftTemplates: ShiftTemplate[]
}>()

const emit = defineEmits<{
  save: [data: CreateScheduleData | UpdateScheduleData]
  close: []
}>()

// Auth
const authStore = useAuthStore()
const restaurantId = computed(() => authStore.user?.restaurantId || 1)

// State
const loading = ref(false)
const error = ref<string | null>(null)
const availableEmployees = ref<AvailableEmployee[]>([])

// Form Data
const formData = reactive<any>({
  employeeId: '',
  workDate: '',
  shiftTemplateId: '',
  startTime: '',
  endTime: '',
  breakDurationMinutes: 0,
  scheduledHours: 0,
  notes: '',
  managerNotes: '',
})

// Calculated Hours
const calculatedHours = computed(() => {
  if (!formData.startTime || !formData.endTime) return '0.0'

  const [startHour, startMin] = formData.startTime.split(':').map(Number)
  const [endHour, endMin] = formData.endTime.split(':').map(Number)

  let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)

  // Handle overnight shifts
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60
  }

  // Subtract break time
  totalMinutes -= formData.breakDurationMinutes || 0

  return (totalMinutes / 60).toFixed(1)
})

// Sync calculated hours to formData
watch(calculatedHours, (hours) => {
  formData.scheduledHours = parseFloat(hours)
}, { immediate: true })

// Fetch available employees when date changes
const handleDateChange = async () => {
  if (!formData.workDate) return

  try {
    loading.value = true
    error.value = null

    availableEmployees.value = await schedulingService.getAvailableEmployees(
      restaurantId.value,
      formData.workDate,
      formData.shiftTemplateId || undefined
    )

    // Reset employee selection if current employee is not available
    if (
      formData.employeeId &&
      !availableEmployees.value.find(emp => emp.id === formData.employeeId)
    ) {
      formData.employeeId = ''
    }
  } catch (err) {
    console.error('Failed to fetch available employees:', err)
    error.value = '無法載入可用員工列表'
  } finally {
    loading.value = false
  }
}

// Auto-fill time when template is selected
const handleTemplateChange = () => {
  if (!formData.shiftTemplateId) return

  const template = props.shiftTemplates.find(
    t => t.id === parseInt(formData.shiftTemplateId)
  )

  if (template) {
    formData.startTime = template.startTime
    formData.endTime = template.endTime
    formData.breakDurationMinutes = template.breakDurationMinutes || 0
  }
}

// Form Validation
const validateForm = (): boolean => {
  error.value = null

  if (!formData.employeeId) {
    error.value = '請選擇員工'
    return false
  }

  if (!formData.workDate) {
    error.value = '請選擇排班日期'
    return false
  }

  if (!formData.startTime || !formData.endTime) {
    error.value = '請設定開始和結束時間'
    return false
  }

  if (formData.scheduledHours <= 0) {
    error.value = '預計工時必須大於 0'
    return false
  }

  return true
}

// Submit Form
const handleSubmit = async () => {
  if (!validateForm()) return

  try {
    loading.value = true

    const scheduleData: CreateScheduleData | UpdateScheduleData = {
      employeeId: parseInt(formData.employeeId),
      workDate: formData.workDate,
      shiftTemplateId: formData.shiftTemplateId ? parseInt(formData.shiftTemplateId) : undefined,
      startTime: formData.startTime,
      endTime: formData.endTime,
      breakDurationMinutes: formData.breakDurationMinutes || 0,
      scheduledHours: formData.scheduledHours,
      notes: formData.notes || undefined,
      managerNotes: formData.managerNotes || undefined,
    }

    emit('save', scheduleData)
  } catch (err) {
    console.error('Form submission error:', err)
    error.value = err instanceof Error ? err.message : '表單提交失敗'
  } finally {
    loading.value = false
  }
}

// Initialize form when editing
const initializeForm = () => {
  if (props.schedule) {
    formData.employeeId = props.schedule.employeeId
    formData.workDate = props.schedule.workDate
    formData.shiftTemplateId = props.schedule.shiftTemplateId || ''
    formData.startTime = props.schedule.startTime
    formData.endTime = props.schedule.endTime
    formData.breakDurationMinutes = props.schedule.breakDurationMinutes || 0
    formData.scheduledHours = props.schedule.scheduledHours
    formData.notes = props.schedule.notes || ''
    formData.managerNotes = props.schedule.managerNotes || ''
  } else {
    // Default to today for new schedules
    const today = new Date()
    formData.workDate = today.toISOString().split('T')[0]
  }
}

// Watch for schedule changes
watch(() => props.schedule, () => {
  initializeForm()
}, { immediate: true })

// Fetch available employees on mount if date is set
onMounted(() => {
  if (formData.workDate) {
    handleDateChange()
  }
})
</script>

<style scoped>
/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Modal Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 28px;
  border-bottom: 2px solid #f3f4f6;
  background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
  border-radius: 16px 16px 0 0;
}

.modal-header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-header h2::before {
  content: '📋';
  font-size: 24px;
}

.close-btn {
  padding: 8px;
  border: none;
  background: #f3f4f6;
  font-size: 20px;
  cursor: pointer;
  color: #6b7280;
  border-radius: 8px;
  transition: all 0.2s;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: #e5e7eb;
  color: #1f2937;
  transform: rotate(90deg);
}

/* Modal Body */
.modal-body {
  padding: 28px;
  overflow-y: auto;
  flex: 1;
}

.modal-body::-webkit-scrollbar {
  width: 8px;
}

.modal-body::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 4px;
}

.modal-body::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Form Groups */
.form-group {
  margin-bottom: 24px;
  animation: fadeIn 0.3s ease-out;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.form-label::before {
  content: '';
  width: 3px;
  height: 16px;
  background: #3b82f6;
  border-radius: 2px;
}

.required {
  color: #ef4444;
  font-weight: 700;
}

.optional {
  color: #9ca3af;
  font-weight: 400;
  font-size: 12px;
}

/* Form Controls */
.form-control {
  width: 100%;
  padding: 12px 14px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.3s ease;
  background: white;
}

.form-control:hover:not(:disabled) {
  border-color: #d1d5db;
}

.form-control:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-control:disabled {
  background: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
  border-style: dashed;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 4px;
}

.form-hint::before {
  content: 'ℹ️';
  font-size: 14px;
}

textarea.form-control {
  resize: vertical;
  font-family: inherit;
  min-height: 80px;
}

/* Error Message */
.error-message {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border: 2px solid #fecaca;
  border-radius: 10px;
  color: #dc2626;
  font-size: 14px;
  font-weight: 500;
  margin-top: 16px;
  animation: shake 0.5s ease-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

.error-message i {
  font-size: 20px;
  font-style: normal;
}

/* Modal Footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 28px;
  border-top: 2px solid #f3f4f6;
  background: #fafbfc;
  border-radius: 0 0 16px 16px;
}

/* Buttons */
.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
}

.btn:active:not(:disabled) {
  transform: translateY(0);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 2px solid #e5e7eb;
  box-shadow: none;
}

.btn-secondary:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #d1d5db;
}

/* Responsive */
@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    max-height: 95vh;
    border-radius: 12px;
  }

  .modal-header {
    padding: 20px;
  }

  .modal-header h2 {
    font-size: 18px;
  }

  .modal-body {
    padding: 20px;
  }

  .form-row {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .modal-footer {
    padding: 16px 20px;
    flex-direction: column-reverse;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }
}

/* Input Validation States */
.form-control.is-valid {
  border-color: #10b981;
}

.form-control.is-valid:focus {
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.form-control.is-invalid {
  border-color: #ef4444;
}

.form-control.is-invalid:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

/* Loading State */
.btn.loading {
  position: relative;
  pointer-events: none;
}

.btn.loading::after {
  content: '';
  position: absolute;
  right: 12px;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
