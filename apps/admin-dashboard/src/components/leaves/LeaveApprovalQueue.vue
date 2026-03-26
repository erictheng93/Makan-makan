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
import { useLeaveConflict } from "@/composables/useLeaveConflict";
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

const sortedRequests = computed(() => {
  const pending = [...props.requests];
  const scores = new Map<number, number>();
  for (const r of pending) {
    const { urgencyScore } = useLeaveConflict(
      computed(() => r),
      computed(() => props.teamLeaves),
      computed(() => props.scheduleCount),
      computed(() => props.staffingThreshold),
    );
    scores.set(r.id, urgencyScore.value);
  }
  return pending.sort((a, b) => {
    const diff = (scores.get(a.id) ?? 2) - (scores.get(b.id) ?? 2);
    return diff !== 0 ? diff : a.startDate.localeCompare(b.startDate);
  });
});
</script>
