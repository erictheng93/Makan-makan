<template>
  <div class="backup-alert" :class="severityClass">
    <div class="alert-icon">
      <span v-if="alert.severity === 'critical'">🚨</span>
      <span v-else-if="alert.severity === 'high'">⚠️</span>
      <span v-else-if="alert.severity === 'medium'">⚡</span>
      <span v-else>ℹ️</span>
    </div>
    <div class="alert-content">
      <h4>{{ alert.title }}</h4>
      <p>{{ alert.message }}</p>
      <span class="alert-time">{{ formatTime(alert.triggered_at) }}</span>
    </div>
    <div class="alert-actions">
      <button
        v-if="!alert.acknowledged"
        class="btn btn-sm"
        @click="emit('acknowledge', alert)"
      >
        {{ t("backup.alerts.acknowledge") }}
      </button>
      <button
        v-if="!alert.resolved"
        class="btn btn-sm btn-primary"
        @click="emit('resolve', alert)"
      >
        {{ t("backup.alerts.resolve") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

interface BackupAlert {
  id: string;
  restaurant_id: string;
  alert_type:
    | "backup_failed"
    | "storage_quota_exceeded"
    | "schedule_missed"
    | "restoration_completed"
    | "performance_degraded";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  related_backup_id?: string;
  triggered_at: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved: boolean;
  resolved_at?: string;
}

const props = defineProps<{
  alert: BackupAlert;
}>();

const emit = defineEmits<{
  acknowledge: [alert: BackupAlert];
  resolve: [alert: BackupAlert];
}>();

const { t } = useI18n();

const severityClass = computed(() => ({
  "alert-low": props.alert.severity === "low",
  "alert-medium": props.alert.severity === "medium",
  "alert-high": props.alert.severity === "high",
  "alert-critical": props.alert.severity === "critical",
}));

const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleString();
};
</script>

<style scoped>
.backup-alert {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 0.5rem;
}

.alert-low {
  background: var(--color-info-light, #e3f2fd);
  border-left: 4px solid var(--color-info, #2196f3);
}

.alert-medium {
  background: var(--color-warning-light, #fff3e0);
  border-left: 4px solid var(--color-warning, #ff9800);
}

.alert-high {
  background: var(--color-error-light, #ffebee);
  border-left: 4px solid var(--color-error, #f44336);
}

.alert-critical {
  background: var(--color-critical-light, #fce4ec);
  border-left: 4px solid var(--color-critical, #d32f2f);
}

.alert-icon {
  font-size: 1.5rem;
}

.alert-content {
  flex: 1;
}

.alert-content h4 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
}

.alert-content p {
  margin: 0 0 0.5rem 0;
  color: var(--color-text-secondary, #666);
}

.alert-time {
  font-size: 0.75rem;
  color: var(--color-text-muted, #999);
}

.alert-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}
</style>
