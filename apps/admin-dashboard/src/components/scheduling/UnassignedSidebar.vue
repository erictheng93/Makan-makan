<template>
  <div class="flex flex-col gap-4">
    <!-- Unassigned employees section -->
    <div class="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4">
      <h3 class="text-sm font-semibold text-ios-text mb-3">未分配員工</h3>

      <div
        v-if="employees.length === 0"
        class="text-center py-4 text-ios-text/40 text-xs"
      >
        所有員工已排班
      </div>

      <div v-else class="flex flex-col gap-2">
        <div
          v-for="emp in employeesWithStatus"
          :key="emp.id"
          draggable="true"
          class="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-grab active:cursor-grabbing transition-all hover:bg-ios-bg select-none"
          :class="emp.isOnLeave ? 'opacity-60' : ''"
          @dragstart="onDragStart($event, emp.id)"
        >
          <!-- Status dot -->
          <span class="text-sm shrink-0" :title="emp.statusLabel">
            {{ emp.statusDot }}
          </span>

          <!-- Name + info -->
          <div class="min-w-0 flex-1">
            <p class="text-xs font-medium text-ios-text truncate">
              {{ emp.fullName || emp.name }}
            </p>
            <p
              v-if="emp.statusLabel"
              class="text-[10px] text-ios-text/40 truncate"
            >
              {{ emp.statusLabel }}
            </p>
          </div>

          <!-- Role badge -->
          <span
            class="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            :class="roleClass(emp.role)"
          >
            {{ roleLabel(emp.role) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Shift templates legend -->
    <div class="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4">
      <h3 class="text-sm font-semibold text-ios-text mb-3">班次模板</h3>

      <div
        v-if="!shiftTemplates || shiftTemplates.length === 0"
        class="text-center py-2 text-ios-text/40 text-xs"
      >
        尚無班次模板
      </div>

      <div v-else class="flex flex-col gap-2">
        <div
          v-for="tpl in shiftTemplates ?? []"
          :key="tpl.id"
          class="flex items-center gap-2.5"
        >
          <span
            class="w-2.5 h-2.5 rounded-full shrink-0"
            :style="{ backgroundColor: tpl.colorCode || '#007AFF' }"
          />
          <div class="min-w-0 flex-1">
            <p class="text-xs font-medium text-ios-text">{{ tpl.name }}</p>
            <p class="text-[10px] text-ios-text/40">
              {{ tpl.startTime }}–{{ tpl.endTime }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ShiftTemplate } from "@/types/scheduling";
import type { LeaveRequest } from "@/services/leavesService";
import type { UserId } from "@/types/api-user";

interface EmployeeBasic {
  id: UserId;
  name?: string;
  fullName?: string;
  role: number;
}

const props = defineProps<{
  employees: EmployeeBasic[];
  schedules: Array<{ employeeId: UserId; workDate: string }>;
  leaveRequests: LeaveRequest[];
  selectedDate: string | null;
  shiftTemplates?: ShiftTemplate[];
  weeklyHours?: Record<UserId, number>;
}>();

const emit = defineEmits<{
  (e: "drag-start", employeeId: UserId): void;
}>();

const WEEKLY_HOURS_WARNING = 35;
const WEEKLY_HOURS_MAX = 40;

interface EmployeeWithStatus extends EmployeeBasic {
  statusDot: string;
  statusLabel: string;
  isOnLeave: boolean;
}

const employeesWithStatus = computed<EmployeeWithStatus[]>(() => {
  return props.employees.map((emp) => {
    const leaveReq = props.leaveRequests.find(
      (r) =>
        r.employeeId === emp.id &&
        r.status === "approved" &&
        (!props.selectedDate ||
          (r.startDate <= props.selectedDate &&
            r.endDate >= props.selectedDate)),
    );

    const hours = props.weeklyHours?.[emp.id] ?? 0;

    let statusDot = "🟢";
    let statusLabel = "";
    let isOnLeave = false;

    if (leaveReq) {
      statusDot = "⚫";
      statusLabel = `請假中 (${leaveReq.leaveType?.name || "假"})`;
      isOnLeave = true;
    } else if (hours >= WEEKLY_HOURS_MAX) {
      statusDot = "🔴";
      statusLabel = `本週 ${hours}h (已達上限)`;
    } else if (hours >= WEEKLY_HOURS_WARNING) {
      statusDot = "🟡";
      statusLabel = `本週 ${hours}h`;
    }

    return { ...emp, statusDot, statusLabel, isOnLeave };
  });
});

function onDragStart(event: DragEvent, employeeId: UserId) {
  event.dataTransfer?.setData("employeeId", String(employeeId));
  emit("drag-start", employeeId);
}

const ROLE_LABELS: Record<number, string> = {
  1: "店主",
  2: "廚師",
  3: "服務",
  4: "收銀",
};

const ROLE_CLASSES: Record<number, string> = {
  1: "bg-blue-100 text-blue-700",
  2: "bg-orange-100 text-orange-700",
  3: "bg-green-100 text-green-700",
  4: "bg-teal-100 text-teal-700",
};

function roleLabel(role: number): string {
  return ROLE_LABELS[role] ?? "員工";
}

function roleClass(role: number): string {
  return ROLE_CLASSES[role] ?? "bg-ios-bg text-ios-text/60";
}
</script>
