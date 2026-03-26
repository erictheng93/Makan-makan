import { computed, type Ref } from "vue";
import type { LeaveRequest } from "@/services/leavesService";

export function useLeaveConflict(
  request: Ref<LeaveRequest>,
  teamLeaves: Ref<LeaveRequest[]>,
  scheduleCount: Ref<Record<string, number> | undefined>,
  staffingThreshold: Ref<number | undefined>,
) {
  const hasUnderstaffedDay = computed(() => {
    if (!scheduleCount.value || !staffingThreshold.value) return false;
    const start = new Date(request.value.startDate + "T00:00:00");
    const end = new Date(request.value.endDate + "T00:00:00");
    const cur = new Date(start);
    while (cur <= end) {
      const dateStr = cur.toISOString().split("T")[0];
      const count = scheduleCount.value[dateStr] ?? 0;
      if (count < staffingThreshold.value) return true;
      cur.setDate(cur.getDate() + 1);
    }
    return false;
  });

  const sameDayColleagues = computed(() => {
    const start = new Date(request.value.startDate + "T00:00:00");
    const end = new Date(request.value.endDate + "T00:00:00");
    return teamLeaves.value.filter((r) => {
      if (r.id === request.value.id) return false;
      if (r.status !== "approved") return false;
      const rStart = new Date(r.startDate + "T00:00:00");
      const rEnd = new Date(r.endDate + "T00:00:00");
      return rStart <= end && rEnd >= start;
    });
  });

  const urgencyLevel = computed<"understaffed" | "has_colleagues" | "clear">(
    () => {
      if (hasUnderstaffedDay.value) return "understaffed";
      if (sameDayColleagues.value.length > 0) return "has_colleagues";
      return "clear";
    },
  );

  const urgencyScore = computed(() => {
    if (hasUnderstaffedDay.value) return 0;
    if (sameDayColleagues.value.length > 0) return 1;
    return 2;
  });

  return { hasUnderstaffedDay, sameDayColleagues, urgencyLevel, urgencyScore };
}
