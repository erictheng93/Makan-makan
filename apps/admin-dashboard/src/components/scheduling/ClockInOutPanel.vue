<template>
  <div class="clock-panel">
    <!-- Header -->
    <div class="panel-header">
      <h3 class="panel-title">
        <span class="title-icon">⏰</span>
        <span>打卡系統</span>
      </h3>
      <div class="current-time">
        <span class="time-icon">🕒</span>
        <span class="time-text">{{ currentTime }}</span>
      </div>
    </div>

    <!-- Today's Schedule Card -->
    <div v-if="todaySchedule" class="schedule-card">
      <div class="schedule-header">
        <div class="schedule-badge" :class="`status-${todaySchedule.status}`">
          {{ getStatusLabel(todaySchedule.status) }}
        </div>
        <div class="schedule-date">
          今天 {{ formatDate(todaySchedule.workDate) }}
        </div>
      </div>

      <div class="schedule-details">
        <div class="detail-row">
          <span class="detail-label">排班時間:</span>
          <span class="detail-value">
            {{ todaySchedule.startTime }} - {{ todaySchedule.endTime }}
          </span>
        </div>
        <div v-if="todaySchedule.shiftTemplate" class="detail-row">
          <span class="detail-label">班別:</span>
          <span class="detail-value">
            <span
              class="shift-badge"
              :style="{
                backgroundColor: todaySchedule.shiftTemplate.colorCode + '20',
                color: todaySchedule.shiftTemplate.colorCode,
                borderColor: todaySchedule.shiftTemplate.colorCode,
              }"
            >
              {{ todaySchedule.shiftTemplate.name }}
            </span>
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">預計工時:</span>
          <span class="detail-value"
            >{{ todaySchedule.scheduledHours }} 小時</span
          >
        </div>
      </div>

      <!-- Clock Status -->
      <div
        v-if="todaySchedule.actualStartTime || todaySchedule.actualEndTime"
        class="clock-status"
      >
        <div v-if="todaySchedule.actualStartTime" class="status-row">
          <span class="status-icon">✓</span>
          <span class="status-label">上班打卡:</span>
          <span class="status-time">{{ todaySchedule.actualStartTime }}</span>
        </div>
        <div v-if="todaySchedule.actualEndTime" class="status-row">
          <span class="status-icon">✓</span>
          <span class="status-label">下班打卡:</span>
          <span class="status-time">{{ todaySchedule.actualEndTime }}</span>
        </div>
        <div v-if="todaySchedule.actualHours" class="status-row">
          <span class="status-icon">📊</span>
          <span class="status-label">實際工時:</span>
          <span class="status-time">{{ todaySchedule.actualHours }} 小時</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button
          v-if="!todaySchedule.actualStartTime"
          class="btn btn-clock-in"
          :disabled="loading"
          @click="handleClockIn"
        >
          <span class="btn-icon">🟢</span>
          <span>上班打卡</span>
        </button>

        <button
          v-else-if="!todaySchedule.actualEndTime"
          class="btn btn-clock-out"
          :disabled="loading"
          @click="handleClockOut"
        >
          <span class="btn-icon">🔴</span>
          <span>下班打卡</span>
        </button>

        <div v-else class="completed-message">
          <span class="completed-icon">✅</span>
          <span>今日班次已完成</span>
        </div>
      </div>

      <!-- Notes Input -->
      <div v-if="showNotesInput" class="notes-input">
        <label class="notes-label">備註 (選填):</label>
        <textarea
          v-model="notes"
          class="notes-textarea"
          placeholder="輸入打卡備註..."
          rows="2"
          maxlength="200"
        ></textarea>
        <div class="notes-actions">
          <button class="btn-cancel" @click="cancelNotes">取消</button>
          <button class="btn-confirm" @click="confirmClock">確認</button>
        </div>
      </div>
    </div>

    <!-- No Schedule Card -->
    <div v-else-if="!loading" class="no-schedule-card">
      <div class="no-schedule-icon">📭</div>
      <h4>今天沒有排班</h4>
      <p>你今天沒有安排工作班次</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>處理中...</p>
    </div>

    <!-- Error Message -->
    <transition name="fade">
      <div v-if="error" class="error-message">
        <span class="error-icon">⚠️</span>
        <span>{{ error }}</span>
        <button class="error-close" @click="error = null">✕</button>
      </div>
    </transition>

    <!-- Success Message -->
    <transition name="fade">
      <div v-if="success" class="success-message">
        <span class="success-icon">✅</span>
        <span>{{ success }}</span>
      </div>
    </transition>

    <!-- Recent Clock Records -->
    <div v-if="recentRecords.length > 0" class="recent-records">
      <h4 class="records-title">最近打卡記錄</h4>
      <div class="records-list">
        <div
          v-for="record in recentRecords"
          :key="record.id"
          class="record-item"
        >
          <div class="record-date">{{ formatDate(record.workDate) }}</div>
          <div class="record-times">
            <span v-if="record.actualStartTime">
              上班: {{ record.actualStartTime }}
            </span>
            <span v-if="record.actualEndTime">
              下班: {{ record.actualEndTime }}
            </span>
          </div>
          <div class="record-hours">{{ record.actualHours || 0 }}h</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { schedulingService } from "@/services/schedulingService";
import type { EmployeeSchedule } from "@/types/scheduling";

interface Props {
  employeeId?: number;
  restaurantId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  clockIn: [schedule: EmployeeSchedule];
  clockOut: [schedule: EmployeeSchedule];
}>();

// Auth
const authStore = useAuthStore();

// State
const loading = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const todaySchedule = ref<EmployeeSchedule | null>(null);
const recentRecords = ref<EmployeeSchedule[]>([]);
const currentTime = ref("");
const showNotesInput = ref(false);
const notes = ref("");
const pendingAction = ref<"clock-in" | "clock-out" | null>(null);

// Timer for current time
let timeInterval: number | null = null;

// Computed
const effectiveEmployeeId = computed(
  () => props.employeeId || authStore.user?.id,
);

// Methods
const updateCurrentTime = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  currentTime.value = `${hours}:${minutes}:${seconds}`;
};

const fetchTodaySchedule = async () => {
  try {
    loading.value = true;
    error.value = null;

    const today = formatDateISO(new Date());
    const response = await schedulingService.getSchedules({
      restaurantId: props.restaurantId,
      employeeId: effectiveEmployeeId.value,
      startDate: today,
      endDate: today,
      limit: 1,
    });

    if (response.data.length > 0) {
      todaySchedule.value = response.data[0];
    } else {
      todaySchedule.value = null;
    }
  } catch (err) {
    console.error("Failed to fetch today schedule:", err);
    error.value = "無法載入今日排班資料";
  } finally {
    loading.value = false;
  }
};

const fetchRecentRecords = async () => {
  try {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const response = await schedulingService.getSchedules({
      restaurantId: props.restaurantId,
      employeeId: effectiveEmployeeId.value,
      startDate: formatDateISO(sevenDaysAgo),
      endDate: formatDateISO(today),
      status: "completed",
      limit: 5,
    });

    recentRecords.value = response.data.filter(
      (r) => r.actualStartTime || r.actualEndTime,
    );
  } catch (err) {
    console.error("Failed to fetch recent records:", err);
  }
};

const handleClockIn = () => {
  pendingAction.value = "clock-in";
  showNotesInput.value = true;
};

const handleClockOut = () => {
  pendingAction.value = "clock-out";
  showNotesInput.value = true;
};

const cancelNotes = () => {
  showNotesInput.value = false;
  notes.value = "";
  pendingAction.value = null;
};

const confirmClock = async () => {
  if (!todaySchedule.value) return;

  try {
    loading.value = true;
    error.value = null;

    const clockData = {
      scheduleId: todaySchedule.value.id,
      employeeId: effectiveEmployeeId.value!,
      notes: notes.value || undefined,
    };

    if (pendingAction.value === "clock-in") {
      const updated = await schedulingService.clockIn(
        todaySchedule.value.id,
        clockData,
      );
      todaySchedule.value = updated;
      success.value = "上班打卡成功！";
      emit("clockIn", updated);
    } else if (pendingAction.value === "clock-out") {
      const updated = await schedulingService.clockOut(
        todaySchedule.value.id,
        clockData,
      );
      todaySchedule.value = updated;
      success.value = "下班打卡成功！";
      emit("clockOut", updated);
      fetchRecentRecords(); // Refresh recent records
    }

    // Clear success message after 3 seconds
    setTimeout(() => {
      success.value = null;
    }, 3000);

    cancelNotes();
  } catch (err) {
    console.error("Clock action failed:", err);
    error.value = err instanceof Error ? err.message : "打卡失敗，請稍後再試";
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const weekday = weekdays[date.getDay()];
  return `${month}/${day} (${weekday})`;
};

const formatDateISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    scheduled: "已排班",
    confirmed: "已確認",
    completed: "已完成",
    cancelled: "已取消",
    no_show: "缺席",
  };
  return labels[status] || status;
};

// Lifecycle
onMounted(() => {
  updateCurrentTime();
  timeInterval = window.setInterval(updateCurrentTime, 1000);
  fetchTodaySchedule();
  fetchRecentRecords();
});

onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval);
  }
});

// Expose refresh method
defineExpose({
  refresh: fetchTodaySchedule,
});
</script>

<style scoped>
.clock-panel {
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
}

/* Header */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.title-icon {
  font-size: 24px;
}

.current-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 18px;
  font-weight: 700;
  font-family: "Courier New", monospace;
}

.time-icon {
  font-size: 20px;
}

/* Schedule Card */
.schedule-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.schedule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #f3f4f6;
}

.schedule-badge {
  padding: 4px 12px;
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

.schedule-date {
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
}

.schedule-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}

.detail-value {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.shift-badge {
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid;
}

/* Clock Status */
.clock-status {
  background: linear-gradient(135deg, #f0fdf4 0%, #d1fae5 100%);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 16px;
  border-left: 4px solid #10b981;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;
}

.status-row:last-child {
  margin-bottom: 0;
}

.status-icon {
  font-size: 14px;
}

.status-label {
  color: #6b7280;
  font-weight: 500;
}

.status-time {
  font-weight: 700;
  color: #059669;
  font-family: "Courier New", monospace;
  margin-left: auto;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 12px;
}

.btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 20px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-icon {
  font-size: 18px;
}

.btn-clock-in {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.btn-clock-out {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

.completed-message {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 20px;
  background: #f0fdf4;
  color: #059669;
  border-radius: 10px;
  font-weight: 700;
  font-size: 15px;
}

.completed-icon {
  font-size: 18px;
}

/* Notes Input */
.notes-input {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 2px solid #f3f4f6;
}

.notes-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.notes-textarea {
  width: 100%;
  padding: 10px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  outline: none;
  transition: border-color 0.3s;
}

.notes-textarea:focus {
  border-color: #3b82f6;
}

.notes-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-cancel {
  background: #f3f4f6;
  color: #374151;
}

.btn-cancel:hover {
  background: #e5e7eb;
}

.btn-confirm {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.btn-confirm:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
}

/* No Schedule Card */
.no-schedule-card {
  background: white;
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.no-schedule-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.7;
}

.no-schedule-card h4 {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.no-schedule-card p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

/* Loading */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #6b7280;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f4f6;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Messages */
.error-message,
.success-message {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 16px;
}

.error-message {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.success-message {
  background: #d1fae5;
  color: #059669;
  border: 1px solid #a7f3d0;
}

.error-icon,
.success-icon {
  font-size: 18px;
}

.error-close {
  margin-left: auto;
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: #dc2626;
  font-size: 16px;
  cursor: pointer;
  border-radius: 4px;
}

.error-close:hover {
  background: rgba(220, 38, 38, 0.1);
}

/* Recent Records */
.recent-records {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.records-title {
  font-size: 15px;
  font-weight: 700;
  color: #374151;
  margin: 0 0 12px 0;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.record-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  background: #f9fafb;
  border-radius: 8px;
  font-size: 13px;
}

.record-date {
  font-weight: 600;
  color: #374151;
  min-width: 80px;
}

.record-times {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: #6b7280;
}

.record-hours {
  font-weight: 700;
  color: #3b82f6;
  font-family: "Courier New", monospace;
}

/* Animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 640px) {
  .clock-panel {
    max-width: 100%;
  }

  .panel-header {
    padding: 12px;
  }

  .panel-title {
    font-size: 16px;
  }

  .current-time {
    font-size: 16px;
  }

  .schedule-card {
    padding: 16px;
  }

  .btn {
    padding: 12px 16px;
    font-size: 14px;
  }
}
</style>
