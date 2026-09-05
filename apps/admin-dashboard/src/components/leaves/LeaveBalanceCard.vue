<template>
  <div class="leave-balance-card">
    <!-- 卡片標題 -->
    <div class="card-header">
      <div class="leave-type-info">
        <div
          class="color-indicator"
          :style="{ backgroundColor: balance.leaveType?.color || '#007aff' }"
        />
        <div class="type-details">
          <h3 class="type-name">
            {{ balance.leaveType?.name || t("leaves.balance.unknownType") }}
          </h3>
          <p class="type-code">{{ balance.leaveType?.code }}</p>
        </div>
      </div>

      <div class="balance-summary">
        <span class="remaining-days">
          {{ formatDays(balance.remainingDays) }}
        </span>
        <span class="days-label">{{ t("leaves.balance.daysRemaining") }}</span>
      </div>
    </div>

    <!-- 進度條 -->
    <div class="progress-section">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{
            width: `${progressPercentage}%`,
            backgroundColor: getProgressColor(),
          }"
        />
      </div>
      <div class="progress-labels">
        <span class="label-used">
          {{ t("leaves.balance.used") }}: {{ formatDays(balance.usedDays) }}
        </span>
        <span class="label-total">
          {{ t("leaves.balance.total") }}: {{ formatDays(balance.totalDays) }}
        </span>
      </div>
    </div>

    <!-- 詳細資訊 -->
    <div v-if="showDetails" class="details-section">
      <div class="detail-row">
        <span class="detail-label">{{ t("leaves.balance.pending") }}:</span>
        <span class="detail-value">{{ formatDays(balance.pendingDays) }}</span>
      </div>
      <!-- The balance join projects seven leave_types columns and no
           carryover flag, so this row keys off the balance's own figure.
           It used to read leaveType.allowCarryover and balance.carryoverDays,
           neither of which is a column: the block never rendered (#330). -->
      <div v-if="balance.carryoverFromPrevious" class="detail-row">
        <span class="detail-label">{{ t("leaves.balance.carryover") }}:</span>
        <span class="detail-value">
          {{ formatDays(balance.carryoverFromPrevious) }}
          <span v-if="balance.carryoverExpiresAt" class="expiry-note">
            ({{ t("leaves.balance.expiresOn") }}:
            {{ formatDate(balance.carryoverExpiresAt) }})
          </span>
        </span>
      </div>
    </div>

    <!-- 操作按鈕 -->
    <div class="card-actions">
      <button
        v-if="canRequestLeave"
        class="btn-primary"
        @click="$emit('request-leave', balance.leaveType)"
      >
        <svg class="icon" viewBox="0 0 20 20" fill="currentColor">
          <path
            d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
          />
        </svg>
        {{ t("leaves.balance.requestLeave") }}
      </button>

      <button class="btn-secondary" @click="showDetails = !showDetails">
        {{ showDetails ? t("common.hideDetails") : t("common.showDetails") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "@/i18n";
import { useDateFormatter } from "@/composables/useDateFormatter";
import type { LeaveBalance } from "@makanmasak/shared-types";

const { t } = useI18n();
const { formatDate } = useDateFormatter();

interface Props {
  balance: LeaveBalance;
  canRequestLeave?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  canRequestLeave: true,
});

defineEmits<{
  "request-leave": [leaveType: LeaveBalance["leaveType"]];
}>();

const showDetails = ref(false);

// 計算進度百分比
const progressPercentage = computed(() => {
  if (!props.balance.totalDays) return 0;
  return Math.min(
    100,
    (props.balance.usedDays / props.balance.totalDays) * 100,
  );
});

// 根據使用比例返回顏色
const getProgressColor = () => {
  const percentage = progressPercentage.value;
  if (percentage >= 90) return "#ff3b30"; // 紅色：接近用完
  if (percentage >= 70) return "#ff9500"; // 橙色：警告
  return "#34c759"; // 綠色：充足
};

// 格式化天數
const formatDays = (days: number): string => {
  if (days === 0) return "0";
  if (Number.isInteger(days)) return days.toString();
  return days.toFixed(1);
};
</script>

<style scoped>
.leave-balance-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.leave-balance-card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

/* 卡片標題 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.leave-type-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-indicator {
  width: 4px;
  height: 48px;
  border-radius: 2px;
}

.type-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.type-name {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.type-code {
  font-size: 12px;
  color: #6b7280;
  margin: 0;
  text-transform: uppercase;
}

.balance-summary {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.remaining-days {
  font-size: 32px;
  font-weight: 700;
  color: #007aff;
  line-height: 1;
}

.days-label {
  font-size: 12px;
  color: #6b7280;
}

/* 進度條 */
.progress-section {
  margin-bottom: 16px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  transition:
    width 0.3s ease,
    background-color 0.3s ease;
  border-radius: 4px;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #6b7280;
}

/* 詳細資訊 */
.details-section {
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
  margin-bottom: 16px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.detail-label {
  font-size: 14px;
  color: #6b7280;
}

.detail-value {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.expiry-note {
  font-size: 12px;
  color: #ff9500;
  font-weight: 400;
}

/* 操作按鈕 */
.card-actions {
  display: flex;
  gap: 8px;
}

.btn-primary,
.btn-secondary {
  flex: 1;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
}

.btn-primary {
  background: #007aff;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-primary:active {
  background: #1d4ed8;
}

.btn-secondary {
  background: #f3f4f6;
  color: #4b5563;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-secondary:active {
  background: #d1d5db;
}

.icon {
  width: 16px;
  height: 16px;
}

/* 響應式設計 */
@media (max-width: 640px) {
  .leave-balance-card {
    padding: 16px;
  }

  .type-name {
    font-size: 16px;
  }

  .remaining-days {
    font-size: 28px;
  }

  .card-actions {
    flex-direction: column;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>
