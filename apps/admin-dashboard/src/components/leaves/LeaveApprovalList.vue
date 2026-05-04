<template>
  <div class="leave-approval-list">
    <div class="approval-header">
      <h2 class="title">{{ t("leaves.approval.pendingRequests") }}</h2>
      <span class="count-badge">{{ pendingRequests.length }}</span>
    </div>

    <div v-if="pendingRequests.length > 0" class="requests-container">
      <div
        v-for="request in pendingRequests"
        :key="request.id"
        class="approval-card"
      >
        <div class="employee-info">
          <div class="avatar">{{ getInitials(getEmployeeName(request)) }}</div>
          <div class="details">
            <h3 class="name">{{ getEmployeeName(request) }}</h3>
            <span class="type">{{ request.leaveType?.name }}</span>
          </div>
        </div>

        <div class="request-details">
          <div class="detail-row">
            <span class="label">{{ t("leaves.request.period") }}:</span>
            <span class="value">
              {{ formatDate(request.startDate) }} -
              {{ formatDate(request.endDate) }} ({{ request.daysCount }}
              {{ t("leaves.balance.days") }})
            </span>
          </div>
          <div class="detail-row">
            <span class="label">{{ t("leaves.request.reason") }}:</span>
            <span class="value">{{ request.reason }}</span>
          </div>
          <div
            v-if="request.attachments && request.attachments.length > 0"
            class="detail-row"
          >
            <span class="label">{{ t("leaves.request.attachments") }}:</span>
            <div class="attachments">
              <a
                v-for="(file, index) in request.attachments"
                :key="index"
                :href="file.url"
                target="_blank"
                class="attachment-link"
              >
                📎 {{ file.name }}
              </a>
            </div>
          </div>
        </div>

        <div class="approval-actions">
          <button class="btn-reject" @click="$emit('reject', request.id)">
            <svg class="icon" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
            {{ t("leaves.approval.reject") }}
          </button>
          <button class="btn-approve" @click="$emit('approve', request.id)">
            <svg class="icon" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            {{ t("leaves.approval.approve") }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <svg class="empty-icon" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path
          fill-rule="evenodd"
          d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clip-rule="evenodd"
        />
      </svg>
      <p>{{ t("leaves.approval.noPending") }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "@/i18n";
import { getInitials } from "@/composables/useEmployeeDisplay";
import type { LeaveRequest } from "@makanmasak/shared-types";

const { t } = useI18n();

interface Props {
  requests: LeaveRequest[];
}

const props = defineProps<Props>();

defineEmits<{
  approve: [requestId: number];
  reject: [requestId: number];
}>();

const pendingRequests = computed(() => {
  return props.requests.filter((r) => r.status === "pending");
});

const getEmployeeName = (request: any): string => {
  return (
    request.employeeName ||
    request.employee?.fullName ||
    request.employee?.username ||
    t("leaves.approval.unknownEmployee")
  );
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
  });
};
</script>

<style scoped>
.leave-approval-list {
  width: 100%;
}

.approval-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.count-badge {
  background: #ef4444;
  color: white;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 600;
}

.requests-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.approval-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #f59e0b;
}

.employee-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
}

.details {
  flex: 1;
}

.name {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 4px 0;
}

.type {
  font-size: 14px;
  color: #6b7280;
}

.request-details {
  margin-bottom: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.detail-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 14px;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.label {
  font-weight: 500;
  color: #6b7280;
  flex-shrink: 0;
}

.value {
  color: #1f2937;
}

.attachments {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.attachment-link {
  color: #3b82f6;
  text-decoration: none;
}

.attachment-link:hover {
  text-decoration: underline;
}

.approval-actions {
  display: flex;
  gap: 12px;
}

.btn-reject,
.btn-approve {
  flex: 1;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-reject {
  background: #fee2e2;
  color: #991b1b;
}

.btn-reject:hover {
  background: #fca5a5;
}

.btn-approve {
  background: #d1fae5;
  color: #065f46;
}

.btn-approve:hover {
  background: #6ee7b7;
}

.icon {
  width: 20px;
  height: 20px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  color: #d1d5db;
  margin: 0 auto 16px;
}

.empty-state p {
  font-size: 16px;
  color: #6b7280;
}

@media (max-width: 640px) {
  .approval-actions {
    flex-direction: column;
  }
}
</style>
