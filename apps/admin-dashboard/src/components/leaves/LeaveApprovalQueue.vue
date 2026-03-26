<template>
  <div class="space-y-3">
    <!-- Empty state -->
    <div
      v-if="sortedRequests.length === 0"
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <div
        class="w-16 h-16 rounded-full bg-[#34C759]/10 flex items-center justify-center mb-4"
      >
        <CheckCircle class="w-8 h-8 text-[#34C759]" />
      </div>
      <p class="text-sm font-semibold text-[#1C1C1E]/60">
        目前沒有待審核的請假申請
      </p>
      <p class="text-xs text-[#1C1C1E]/40 mt-1">所有請假申請均已處理完畢</p>
    </div>

    <!-- Decision cards sorted by urgency -->
    <LeaveDecisionCard
      v-for="request in sortedRequests"
      :key="request.id"
      :request="request"
      :balance="getBalance(request)"
      :team-leaves="teamLeaves"
      :schedule-count="scheduleCount"
      :staffing-threshold="staffingThreshold"
      @approve="(id) => emit('approve', id)"
      @reject="(id, reason) => emit('reject', id, reason)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { CheckCircle } from "lucide-vue-next";
import LeaveDecisionCard from "./LeaveDecisionCard.vue";
import type { LeaveRequest, LeaveBalance } from "@/services/leavesService";

interface Props {
  requests: LeaveRequest[]; // pending only
  balances: LeaveBalance[];
  teamLeaves: LeaveRequest[];
  scheduleCount?: Record<string, number>;
  staffingThreshold?: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  approve: [requestId: number];
  reject: [requestId: number, reason?: string];
}>();

const getBalance = (request: LeaveRequest): LeaveBalance | null => {
  return (
    props.balances.find(
      (b) =>
        b.employeeId === request.employeeId &&
        b.leaveTypeId === request.leaveTypeId,
    ) ?? null
  );
};

// Check if a request has understaffed days
const isUnderstaffed = (request: LeaveRequest): boolean => {
  if (!props.scheduleCount || !props.staffingThreshold) return false;
  const start = new Date(request.startDate + "T00:00:00");
  const end = new Date(request.endDate + "T00:00:00");
  const cur = new Date(start);
  while (cur <= end) {
    const dateStr = cur.toISOString().split("T")[0];
    const count = props.scheduleCount[dateStr] ?? 0;
    if (count < props.staffingThreshold) return true;
    cur.setDate(cur.getDate() + 1);
  }
  return false;
};

// Check if a request has colleague leave overlaps
const hasColleagueOverlap = (request: LeaveRequest): boolean => {
  const start = new Date(request.startDate + "T00:00:00");
  const end = new Date(request.endDate + "T00:00:00");
  return props.teamLeaves.some((r) => {
    if (r.id === request.id) return false;
    if (r.status !== "approved") return false;
    const rStart = new Date(r.startDate + "T00:00:00");
    const rEnd = new Date(r.endDate + "T00:00:00");
    return rStart <= end && rEnd >= start;
  });
};

// Urgency score: understaffed=0, has colleagues=1, clear=2
const urgencyScore = (request: LeaveRequest): number => {
  if (isUnderstaffed(request)) return 0;
  if (hasColleagueOverlap(request)) return 1;
  return 2;
};

const sortedRequests = computed(() => {
  return [...props.requests]
    .filter((r) => r.status === "pending")
    .sort((a, b) => {
      const diff = urgencyScore(a) - urgencyScore(b);
      if (diff !== 0) return diff;
      // Secondary sort: by start date ascending
      return a.startDate.localeCompare(b.startDate);
    });
});
</script>
