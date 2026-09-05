<template>
  <div class="space-y-2">
    <!-- 7-day timeline row -->
    <div class="flex gap-1">
      <div
        v-for="day in days"
        :key="day.dateStr"
        class="flex-1 flex flex-col items-center gap-0.5 rounded-lg py-1.5 px-0.5 relative transition-all"
        :class="[
          day.isInRange
            ? 'bg-ios-orange/15 ring-1 ring-ios-orange/40'
            : 'bg-ios-bg',
        ]"
      >
        <!-- Day abbreviation -->
        <span class="text-[10px] font-medium text-ios-text/50 leading-none">
          {{ day.dayAbbr }}
        </span>
        <!-- Date number -->
        <span
          class="text-xs font-semibold leading-none"
          :class="day.isInRange ? 'text-ios-orange' : 'text-ios-text'"
        >
          {{ day.dateNum }}
        </span>
        <!-- Colleague leave dot -->
        <div
          v-if="day.hasColleagueLeave"
          class="w-1.5 h-1.5 rounded-full bg-ios-red"
        />
        <div v-else class="w-1.5 h-1.5" />
        <!-- Staffing count -->
        <span
          v-if="scheduleCount && scheduleCount[day.dateStr] !== undefined"
          class="text-[9px] font-medium leading-none mt-0.5"
          :class="
            staffingThreshold && scheduleCount[day.dateStr] < staffingThreshold
              ? 'text-ios-red'
              : 'text-ios-text/40'
          "
        >
          {{ scheduleCount[day.dateStr] }}人
        </span>
      </div>
    </div>

    <!-- Staffing warning if applicable -->
    <div
      v-if="staffingWarning"
      class="flex items-start gap-1.5 text-xs text-ios-red bg-ios-red/10 rounded-lg px-2.5 py-1.5"
    >
      <span class="shrink-0 mt-px">⚠</span>
      <span>{{ staffingWarning }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { LeaveRequest } from "@/services/leavesService";

const DAY_ABBRS = ["日", "一", "二", "三", "四", "五", "六"];

interface Props {
  centerDate: string; // YYYY-MM-DD
  leaveRequests: LeaveRequest[]; // team leaves (approved)
  currentRequestId: number;
  scheduleCount?: Record<string, number>;
  staffingThreshold?: number;
}

const props = defineProps<Props>();

// Build the 7-day window centered on centerDate (3 before, today, 3 after)
const days = computed(() => {
  const center = new Date(props.centerDate + "T00:00:00");
  // Find the start date of current request to highlight the range
  const currentReq = props.leaveRequests.find(
    (r) => r.id === props.currentRequestId,
  );
  const rangeStart = currentReq
    ? new Date(currentReq.startDate + "T00:00:00")
    : null;
  const rangeEnd = currentReq
    ? new Date(currentReq.endDate + "T00:00:00")
    : null;

  // Approved colleague leaves (not the current request)
  const colleagueLeaves = props.leaveRequests.filter(
    (r) => r.id !== props.currentRequestId && r.status === "approved",
  );

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(center);
    d.setDate(center.getDate() - 3 + i);
    const dateStr = d.toISOString().split("T")[0];

    const hasColleagueLeave = colleagueLeaves.some((r) => {
      const start = new Date(r.startDate + "T00:00:00");
      const end = new Date(r.endDate + "T00:00:00");
      return d >= start && d <= end;
    });

    const isInRange =
      rangeStart !== null &&
      rangeEnd !== null &&
      d >= rangeStart &&
      d <= rangeEnd;

    return {
      dateStr,
      dayAbbr: DAY_ABBRS[d.getDay()],
      dateNum: d.getDate(),
      hasColleagueLeave,
      isInRange,
    };
  });
});

const staffingWarning = computed(() => {
  if (!props.scheduleCount || !props.staffingThreshold) return null;
  const currentReq = props.leaveRequests.find(
    (r) => r.id === props.currentRequestId,
  );
  if (!currentReq) return null;

  const start = new Date(currentReq.startDate + "T00:00:00");
  const end = new Date(currentReq.endDate + "T00:00:00");

  for (const day of days.value) {
    const d = new Date(day.dateStr + "T00:00:00");
    if (d >= start && d <= end) {
      const count = props.scheduleCount[day.dateStr] ?? 0;
      if (count < props.staffingThreshold) {
        return `請假期間 ${day.dateStr.slice(5)} 排班人數 ${count}人，低於門檻 ${props.staffingThreshold}人`;
      }
    }
  }
  return null;
});
</script>
