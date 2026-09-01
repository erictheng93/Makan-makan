<template>
  <div class="backup-item" :class="statusClass">
    <div class="backup-main">
      <div class="backup-icon">
        <component :is="statusIcon" :class="iconClass" />
      </div>

      <div class="backup-info">
        <h3 class="backup-name">{{ backup.name }}</h3>
        <div class="backup-meta">
          <span class="backup-type">{{
            t(`backup.types.${backup.backup_type}`)
          }}</span>
          <span class="backup-separator">•</span>
          <span class="backup-date">{{ formatDate(backup.started_at) }}</span>
          <span class="backup-separator">•</span>
          <span class="backup-size">{{
            formatFileSize(backup.file_size)
          }}</span>
        </div>
        <div v-if="backup.status !== 'completed'" class="backup-status">
          <span class="status-badge" :class="`status-${backup.status}`">
            {{ t(`backup.status.${backup.status}`) }}
          </span>
          <span v-if="backup.error_message" class="error-message">
            {{ backup.error_message }}
          </span>
        </div>
      </div>
    </div>

    <div class="backup-actions">
      <!-- Progress indicator for in-progress backups -->
      <div v-if="backup.status === 'in_progress'" class="progress-indicator">
        <div class="spinner"></div>
        <span class="progress-text">{{ t("backup.status.processing") }}</span>
      </div>

      <!-- Duration for completed backups -->
      <div
        v-else-if="backup.status === 'completed' && backup.completed_at"
        class="duration-info"
      >
        <span class="duration">{{
          formatDuration(backup.started_at, backup.completed_at)
        }}</span>
      </div>

      <!-- Action buttons -->
      <div class="action-buttons">
        <!-- Download button (only for completed backups) -->
        <button
          v-if="backup.status === 'completed'"
          class="action-btn download-btn"
          :title="t('backup.actions.download')"
          @click="$emit('download', backup)"
        >
          <DownloadIcon />
        </button>

        <!-- Restore button (only for completed backups) -->
        <button
          v-if="backup.status === 'completed'"
          class="action-btn restore-btn"
          :title="t('backup.actions.restore')"
          @click="$emit('restore', backup)"
        >
          <ArrowPathIcon />
        </button>

        <!-- Info/Details button -->
        <button
          class="action-btn info-btn"
          :title="t('backup.actions.details')"
          @click="showDetails = !showDetails"
        >
          <InformationCircleIcon />
        </button>

        <!-- Delete button -->
        <button
          class="action-btn delete-btn"
          :title="t('backup.actions.delete')"
          @click="$emit('delete', backup)"
        >
          <TrashIcon />
        </button>
      </div>
    </div>

    <!-- Expandable details section -->
    <div v-if="showDetails" class="backup-details">
      <div class="details-grid">
        <div class="detail-item">
          <span class="detail-label">{{ t("backup.details.id") }}</span>
          <span class="detail-value">{{ backup.id }}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">{{
            t("backup.details.configuration")
          }}</span>
          <span class="detail-value">{{
            backup.configuration_id || t("backup.details.manual")
          }}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">{{
            t("backup.details.recordsCount")
          }}</span>
          <span class="detail-value">{{
            backup.records_count?.toLocaleString() || 0
          }}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">{{ t("backup.details.storage") }}</span>
          <span class="detail-value">{{
            backup.storage_provider.toUpperCase()
          }}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">{{ t("backup.details.encrypted") }}</span>
          <span class="detail-value">
            {{ backup.encryption_enabled ? t("common.yes") : t("common.no") }}
          </span>
        </div>

        <div class="detail-item">
          <span class="detail-label">{{ t("backup.details.checksum") }}</span>
          <span class="detail-value checksum">{{
            backup.checksum || "-"
          }}</span>
        </div>
      </div>

      <div v-if="backup.tables_included" class="tables-info">
        <span class="detail-label">{{ t("backup.details.tables") }}:</span>
        <div class="table-tags">
          <span
            v-for="table in backup.tables_included"
            :key="table"
            class="table-tag"
          >
            {{ table }}
          </span>
        </div>
      </div>

      <div v-if="backup.metadata?.performance_metrics" class="performance-info">
        <h4>{{ t("backup.details.performance") }}</h4>
        <div class="performance-grid">
          <div class="metric">
            <span class="metric-label">{{ t("backup.metrics.duration") }}</span>
            <span class="metric-value">
              {{
                Math.round(
                  backup.metadata.performance_metrics.backup_duration_ms / 1000,
                )
              }}s
            </span>
          </div>
          <div class="metric">
            <span class="metric-label">{{
              t("backup.metrics.compression")
            }}</span>
            <span class="metric-value">
              {{
                Math.round(
                  backup.metadata.performance_metrics.compression_ratio * 100,
                )
              }}%
            </span>
          </div>
          <div class="metric">
            <span class="metric-label">{{
              t("backup.metrics.uploadSpeed")
            }}</span>
            <span class="metric-value">
              {{
                backup.metadata.performance_metrics.upload_speed_mbps.toFixed(1)
              }}
              MB/s
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import type { BackupRecord } from "@makanmasak/shared-types";

// Icons (using placeholder components - replace with actual icons)
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon as DownloadIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  TrashIcon,
} from "@heroicons/vue/24/outline";

const props = defineProps<{
  backup: BackupRecord;
}>();

defineEmits<{
  download: [backup: BackupRecord];
  restore: [backup: BackupRecord];
  delete: [backup: BackupRecord];
}>();

const { t } = useI18n();
const showDetails = ref(false);

// Computed properties
const statusClass = computed(() => ({
  "status-completed": props.backup.status === "completed",
  "status-in_progress": props.backup.status === "in_progress",
  "status-failed": props.backup.status === "failed",
  "status-pending": props.backup.status === "pending",
  "status-cancelled": props.backup.status === "cancelled",
}));

const statusIcon = computed(() => {
  switch (props.backup.status) {
    case "completed":
      return CheckCircleIcon;
    case "failed":
      return XCircleIcon;
    case "in_progress":
      return ClockIcon;
    case "pending":
      return ClockIcon;
    case "cancelled":
      return XCircleIcon;
    default:
      return ExclamationTriangleIcon;
  }
});

const iconClass = computed(() => ({
  "text-green-500": props.backup.status === "completed",
  "text-red-500": props.backup.status === "failed",
  "text-blue-500": props.backup.status === "in_progress",
  "text-yellow-500": props.backup.status === "pending",
  "text-gray-500": props.backup.status === "cancelled",
}));

// Methods
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDuration = (startTime: string, endTime: string): string => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const duration = Math.round((end.getTime() - start.getTime()) / 1000);

  if (duration < 60) {
    return `${duration}s`;
  } else if (duration < 3600) {
    return `${Math.round(duration / 60)}m`;
  } else {
    return `${Math.round(duration / 3600)}h`;
  }
};
</script>

<style scoped>
.backup-item {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 1.5rem;
  background: white;
  transition: all 0.2s ease;
}

.backup-item:hover {
  border-color: #d1d5db;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.backup-main {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.backup-icon {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
}

.backup-info {
  flex: 1;
}

.backup-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 0.5rem 0;
}

.backup-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.backup-separator {
  color: #d1d5db;
}

.backup-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-completed {
  background: #dcfce7;
  color: #166534;
}

.status-in_progress {
  background: #dbeafe;
  color: #1d4ed8;
}

.status-failed {
  background: #fee2e2;
  color: #d0332b;
}

.status-pending {
  background: #fef3c7;
  color: #d07b04;
}

.status-cancelled {
  background: #f3f4f6;
  color: #6b7280;
}

.error-message {
  font-size: 0.875rem;
  color: #d0332b;
  font-style: italic;
}

.backup-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
}

.progress-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid #e5e7eb;
  border-top-color: #007aff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.progress-text {
  font-size: 0.875rem;
  color: #6b7280;
}

.duration-info {
  font-size: 0.875rem;
  color: #6b7280;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.download-btn {
  background: #f3f4f6;
  color: #6b7280;
}

.download-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.restore-btn {
  background: #dbeafe;
  color: #007aff;
}

.restore-btn:hover {
  background: #bfdbfe;
  color: #2563eb;
}

.info-btn {
  background: #f3f4f6;
  color: #6b7280;
}

.info-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.delete-btn {
  background: #fee2e2;
  color: #d0332b;
}

.delete-btn:hover {
  background: #fecaca;
  color: #b91c1c;
}

/* Details section */
.backup-details {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
}

.detail-value {
  font-size: 0.875rem;
  color: #1a1a1a;
}

.checksum {
  font-family: "Monaco", "Menlo", monospace;
  font-size: 0.75rem;
  word-break: break-all;
}

.tables-info {
  margin-bottom: 1.5rem;
}

.table-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.table-tag {
  padding: 0.25rem 0.5rem;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.performance-info h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 1rem 0;
}

.performance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 0.375rem;
}

.metric-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a1a;
}
</style>
