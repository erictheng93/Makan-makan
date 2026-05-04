<template>
  <div class="leave-request-list">
    <!-- 過濾器 -->
    <div class="filters">
      <select v-model="statusFilter" class="filter-select">
        <option value="">{{ t("leaves.list.allStatus") }}</option>
        <option value="pending">{{ t("leaves.status.pending") }}</option>
        <option value="approved">{{ t("leaves.status.approved") }}</option>
        <option value="rejected">{{ t("leaves.status.rejected") }}</option>
        <option value="cancelled">{{ t("leaves.status.cancelled") }}</option>
      </select>

      <select v-model="typeFilter" class="filter-select">
        <option value="">{{ t("leaves.list.allTypes") }}</option>
        <option v-for="type in leaveTypes" :key="type.id" :value="type.id">
          {{ type.name }}
        </option>
      </select>

      <input
        v-model="searchQuery"
        type="search"
        class="search-input"
        :placeholder="t('leaves.list.search')"
      />
    </div>

    <!-- 請假列表 -->
    <div v-if="filteredRequests.length > 0" class="requests-container">
      <div
        v-for="request in filteredRequests"
        :key="request.id"
        class="request-card"
        :class="`status-${request.status}`"
      >
        <div class="card-header">
          <div class="request-info">
            <h3 class="leave-type">{{ request.leaveType?.name }}</h3>
            <span class="request-date">
              {{ formatDate(request.startDate) }} -
              {{ formatDate(request.endDate) }} ({{ request.daysCount }}
              {{ t("leaves.balance.days") }})
            </span>
          </div>
          <span :class="`status-badge status-${request.status}`">
            {{ t(`leaves.status.${request.status}`) }}
          </span>
        </div>

        <div class="card-content">
          <p class="reason">{{ request.reason }}</p>

          <div
            v-if="parseApprovalChain(request.approvalChain).length > 0"
            class="approval-chain"
          >
            <div
              v-for="(approval, index) in parseApprovalChain(
                request.approvalChain,
              )"
              :key="index"
              class="approval-step"
            >
              <span class="approver">{{
                approval.approverName || t("leaves.approval.reviewer")
              }}</span>
              <span :class="`approval-status ${approval.status || 'pending'}`">
                {{
                  t(`leaves.approval.${approval.status || "pending"}`) ||
                  t("leaves.approval.pending")
                }}
              </span>
            </div>
          </div>
        </div>

        <div class="card-actions">
          <button
            v-if="request.status === 'pending' && canCancel"
            class="btn-cancel"
            @click="$emit('cancel', request.id)"
          >
            {{ t("common.cancel") }}
          </button>
          <button
            class="btn-details"
            @click="$emit('view-details', request.id)"
          >
            {{ t("common.viewDetails") }}
          </button>
        </div>
      </div>
    </div>

    <!-- 空狀態 -->
    <div v-else class="empty-state">
      <svg class="empty-icon" viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"
          clip-rule="evenodd"
        />
      </svg>
      <p>{{ t("leaves.list.noRequests") }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "@/i18n";
import type { LeaveRequest, LeaveType } from "@makanmasak/shared-types";

const { t } = useI18n();

interface Props {
  requests: LeaveRequest[];
  leaveTypes: LeaveType[];
  canCancel?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  canCancel: true,
});

defineEmits<{
  cancel: [requestId: number];
  "view-details": [requestId: number];
}>();

const statusFilter = ref("");
const typeFilter = ref<number | string>("");
const searchQuery = ref("");

const filteredRequests = computed(() => {
  return props.requests.filter((request) => {
    if (statusFilter.value && request.status !== statusFilter.value)
      return false;
    if (typeFilter.value && request.leaveTypeId !== typeFilter.value)
      return false;
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      return (
        request.reason.toLowerCase().includes(query) ||
        request.leaveType?.name.toLowerCase().includes(query)
      );
    }
    return true;
  });
});

const parseApprovalChain = (
  chain: string | Array<any> | undefined,
): Array<any> => {
  if (!chain) return [];
  if (Array.isArray(chain)) return chain;
  try {
    const parsed = JSON.parse(chain);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
  });
};
</script>

<style scoped>
.leave-request-list {
  width: 100%;
}

.filters {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-select,
.search-input {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  background: white;
}

.filter-select {
  flex: 0 0 auto;
  min-width: 150px;
}

.search-input {
  flex: 1;
  min-width: 200px;
}

.requests-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.request-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s;
}

.request-card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.request-info {
  flex: 1;
}

.leave-type {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 4px 0;
}

.request-date {
  font-size: 14px;
  color: #6b7280;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.status-pending {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.status-approved {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.status-rejected {
  background: #fee2e2;
  color: #991b1b;
}

.card-content {
  margin-bottom: 16px;
}

.reason {
  font-size: 14px;
  color: #4b5563;
  margin-bottom: 12px;
}

.approval-chain {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.approval-step {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 8px;
  background: #f9fafb;
  border-radius: 6px;
}

.card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-cancel,
.btn-details {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-cancel {
  background: #fee2e2;
  color: #991b1b;
}

.btn-details {
  background: #dbeafe;
  color: #1e40af;
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
  .filters {
    flex-direction: column;
  }

  .filter-select,
  .search-input {
    width: 100%;
  }

  .card-header {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
