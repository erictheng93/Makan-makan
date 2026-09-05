<template>
  <div class="space-y-3">
    <!-- Filter controls -->
    <div class="flex flex-wrap gap-2">
      <select
        v-model="statusFilter"
        class="px-3 py-2 text-sm bg-white border-none rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] text-ios-text focus:shadow-[0_0_0_2px_rgba(0,122,255,0.25)] focus:outline-none transition-all"
      >
        <option value="">全部狀態</option>
        <option value="pending">待審核</option>
        <option value="approved">已批准</option>
        <option value="rejected">已拒絕</option>
        <option value="cancelled">已取消</option>
      </select>
      <select
        v-model="typeFilter"
        class="px-3 py-2 text-sm bg-white border-none rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] text-ios-text focus:shadow-[0_0_0_2px_rgba(0,122,255,0.25)] focus:outline-none transition-all"
      >
        <option value="">全部假別</option>
        <option v-for="lt in leaveTypes" :key="lt.id" :value="lt.id">
          {{ lt.name }}
        </option>
      </select>
    </div>

    <!-- Empty state -->
    <div
      v-if="filteredRequests.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <div
        class="w-12 h-12 rounded-full bg-ios-bg flex items-center justify-center mb-3"
      >
        <CalendarX class="w-6 h-6 text-ios-text/30" />
      </div>
      <p class="text-sm font-semibold text-ios-text/60">
        沒有符合條件的請假紀錄
      </p>
    </div>

    <!-- List -->
    <div
      v-else
      class="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden divide-y divide-ios-bg"
    >
      <div
        v-for="request in filteredRequests"
        :key="request.id"
        class="flex items-start gap-3 px-4 py-3.5"
      >
        <!-- Status dot -->
        <div
          class="mt-1.5 w-2 h-2 rounded-full shrink-0"
          :class="statusDotColor(request.status)"
        />

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-semibold text-ios-text">
              {{ request.employeeName || `員工${request.employeeId}` }}
            </span>
            <span
              class="text-xs px-2 py-0.5 rounded-full font-medium"
              :class="statusBadgeClass(request.status)"
            >
              {{ statusLabel(request.status) }}
            </span>
          </div>
          <div
            class="mt-0.5 flex items-center gap-2 text-xs text-ios-text/50 flex-wrap"
          >
            <span>{{ request.leaveTypeName || "請假" }}</span>
            <span>·</span>
            <span>{{
              formatDateRange(request.startDate, request.endDate)
            }}</span>
            <span>·</span>
            <span>{{ request.days }}天</span>
          </div>
          <div
            v-if="request.rejectionReason"
            class="mt-1 text-xs text-ios-red/70 italic"
          >
            原因：{{ request.rejectionReason }}
          </div>
        </div>

        <!-- Applied date -->
        <span class="text-xs text-ios-text/30 shrink-0 mt-0.5">
          {{ formatAppliedDate(request.createdAt) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { CalendarX } from "lucide-vue-next";
import type { LeaveRequest, LeaveType } from "@/services/leavesService";

interface Props {
  requests: LeaveRequest[];
  leaveTypes: LeaveType[];
}

const props = defineProps<Props>();

const statusFilter = ref("");
const typeFilter = ref<number | "">("");

const filteredRequests = computed(() => {
  return props.requests
    .filter((r) => {
      if (statusFilter.value && r.status !== statusFilter.value) return false;
      if (typeFilter.value !== "" && r.leaveTypeId !== typeFilter.value)
        return false;
      return true;
    })
    .sort((a, b) => {
      // Most recent first
      return b.createdAt.localeCompare(a.createdAt);
    });
});

const statusDotColor = (status: string): string => {
  switch (status) {
    case "approved":
      return "bg-ios-green";
    case "rejected":
      return "bg-ios-red";
    case "pending":
      return "bg-ios-orange";
    default:
      return "bg-ios-secondary";
  }
};

const statusBadgeClass = (status: string): string => {
  switch (status) {
    case "approved":
      return "bg-ios-green/10 text-ios-green";
    case "rejected":
      return "bg-ios-red/10 text-ios-red";
    case "pending":
      return "bg-ios-orange/10 text-ios-orange";
    default:
      return "bg-ios-secondary/10 text-ios-secondary";
  }
};

const statusLabel = (status: string): string => {
  switch (status) {
    case "approved":
      return "已批准";
    case "rejected":
      return "已拒絕";
    case "pending":
      return "待審核";
    case "cancelled":
      return "已取消";
    default:
      return status;
  }
};

const formatDateRange = (start: string, end: string): string => {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  if (start === end) return fmt(s);
  return `${fmt(s)}-${fmt(e)}`;
};

const formatAppliedDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} 申請`;
};
</script>
