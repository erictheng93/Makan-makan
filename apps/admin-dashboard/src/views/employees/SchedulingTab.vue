<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-3">
      <!-- Date navigation -->
      <div
        class="flex items-center gap-1 bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-2 py-1"
      >
        <button
          class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F2F2F7] transition-colors text-[#1C1C1E]/60 hover:text-[#1C1C1E]"
          @click="shiftRange(-1)"
        >
          <ChevronLeft class="w-4 h-4" />
        </button>
        <span
          class="text-sm font-semibold text-[#1C1C1E] min-w-[120px] text-center px-1"
        >
          {{ rangeLabel }}
        </span>
        <button
          class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F2F2F7] transition-colors text-[#1C1C1E]/60 hover:text-[#1C1C1E]"
          @click="shiftRange(1)"
        >
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>

      <!-- Today shortcut -->
      <button
        v-if="!isCurrentPeriod"
        class="px-3 py-1.5 text-xs font-medium rounded-full bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/20 transition-colors"
        @click="goToToday"
      >
        今天
      </button>

      <!-- View mode toggle -->
      <div class="flex bg-[#F2F2F7] rounded-full p-0.5">
        <button
          v-for="mode in ['week', 'month'] as const"
          :key="mode"
          class="px-3 py-1 text-xs font-semibold rounded-full transition-all"
          :class="
            viewMode === mode
              ? 'bg-white text-[#1C1C1E] shadow-sm'
              : 'text-[#1C1C1E]/50 hover:text-[#1C1C1E]/70'
          "
          @click="viewMode = mode"
        >
          {{ mode === "week" ? "週" : "月" }}
        </button>
      </div>

      <!-- Manage templates button -->
      <button
        class="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-[#007AFF] text-white hover:bg-[#0066D6] transition-colors shadow-sm"
        @click="showTemplateManager = true"
      >
        <Settings class="w-3.5 h-3.5" />
        管理模板
      </button>
    </div>

    <!-- Loading skeleton -->
    <div
      v-if="loading"
      class="flex items-center justify-center py-16 text-[#1C1C1E]/40"
    >
      <div class="flex flex-col items-center gap-3">
        <div
          class="w-8 h-8 border-2 border-[#007AFF]/30 border-t-[#007AFF] rounded-full animate-spin"
        />
        <p class="text-sm">載入排班中...</p>
      </div>
    </div>

    <!-- Error state -->
    <div
      v-else-if="loadError"
      class="bg-[#FF3B30]/5 border border-[#FF3B30]/20 rounded-2xl p-6 text-center"
    >
      <p class="text-sm text-[#FF3B30]">{{ loadError }}</p>
      <button
        class="mt-3 px-4 py-1.5 text-sm font-medium rounded-full bg-[#FF3B30]/10 text-[#FF3B30] hover:bg-[#FF3B30]/20 transition-colors"
        @click="loadAll"
      >
        重試
      </button>
    </div>

    <!-- Main grid + sidebar layout -->
    <template v-else>
      <!-- Conflict bar -->
      <SchedulingConflictBar :conflicts="conflicts" />

      <div class="flex gap-4 items-start">
        <!-- Calendar grid (takes remaining space) -->
        <div class="flex-1 min-w-0">
          <SchedulingCalendarGrid
            :schedules="schedules"
            :shift-templates="shiftTemplates"
            :date-range="dateRange"
            :view-mode="viewMode"
            @assign="handleAssign"
            @remove="handleRemove"
            @cell-click="handleCellClick"
          />
        </div>

        <!-- Right sidebar -->
        <div class="w-48 shrink-0">
          <UnassignedSidebar
            :employees="unassignedEmployees"
            :schedules="schedules"
            :leave-requests="leaveRequests"
            :selected-date="selectedDate"
            :shift-templates="shiftTemplates"
            :weekly-hours="weeklyHoursMap"
            @drag-start="onEmployeeDragStart"
          />
        </div>
      </div>
    </template>

    <!-- Assign confirmation modal (quick inline) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="pendingAssignment"
          class="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          @click.self="pendingAssignment = null"
        >
          <div
            class="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-6 w-72"
          >
            <h3 class="text-base font-bold text-[#1C1C1E] mb-1">確認排班</h3>
            <p class="text-sm text-[#1C1C1E]/60 mb-4">
              將
              <span class="font-semibold text-[#1C1C1E]">{{
                pendingAssignment.employeeName
              }}</span>
              排至 {{ pendingAssignment.date }}
              <span class="font-semibold text-[#1C1C1E]">{{
                pendingAssignment.templateName
              }}</span>
            </p>
            <div class="flex gap-2">
              <button
                class="flex-1 px-3 py-2 text-sm font-medium rounded-full bg-[#F2F2F7] text-[#1C1C1E]/60 hover:bg-[#E5E5EA] transition-colors"
                @click="pendingAssignment = null"
              >
                取消
              </button>
              <button
                class="flex-1 px-3 py-2 text-sm font-semibold rounded-full bg-[#007AFF] text-white hover:bg-[#0066D6] transition-colors disabled:opacity-50"
                :disabled="assigning"
                @click="confirmAssign"
              >
                {{ assigning ? "排班中..." : "確認" }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Shift template manager modal -->
    <ShiftTemplateManager
      :is-open="showTemplateManager"
      :templates="shiftTemplates"
      :restaurant-id="restaurantId"
      @close="showTemplateManager = false"
      @template-created="onTemplateCreated"
      @template-updated="onTemplateUpdated"
      @template-deleted="onTemplateDeleted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { ChevronLeft, ChevronRight, Settings } from "lucide-vue-next";
import { useAuthStore } from "@/stores/auth";
import { useEmployeeList } from "@/composables/useEmployeeList";
import { schedulingService } from "@/services/schedulingService";
import { leavesService } from "@/services/leavesService";
import type { ShiftTemplate, EmployeeSchedule } from "@/types/scheduling";
import type { LeaveRequest } from "@/services/leavesService";
import SchedulingCalendarGrid from "@/components/scheduling/SchedulingCalendarGrid.vue";
import UnassignedSidebar from "@/components/scheduling/UnassignedSidebar.vue";
import ShiftTemplateManager from "@/components/scheduling/ShiftTemplateManager.vue";
import SchedulingConflictBar from "@/components/scheduling/SchedulingConflictBar.vue";

// ── Auth / restaurant ────────────────────────────────────
const authStore = useAuthStore();
const restaurantId = computed(() => authStore.restaurantId ?? "");

// ── Employee list ────────────────────────────────────────
const { users, fetchUsers } = useEmployeeList();

// ── View mode & date range ───────────────────────────────
const viewMode = ref<"week" | "month">("week");

function getWeekStart(d: Date): Date {
  const copy = new Date(d);
  const dow = copy.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  copy.setDate(copy.getDate() + mondayOffset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getMonthEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

const anchorDate = ref(new Date()); // pivot date for navigation

const dateRange = computed<{ start: Date; end: Date }>(() => {
  if (viewMode.value === "week") {
    const start = getWeekStart(anchorDate.value);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  } else {
    const start = getMonthStart(anchorDate.value);
    const end = getMonthEnd(anchorDate.value);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
});

const rangeLabel = computed(() => {
  const { start, end } = dateRange.value;
  if (viewMode.value === "week") {
    const sm = start.getMonth() + 1;
    const sd = start.getDate();
    const em = end.getMonth() + 1;
    const ed = end.getDate();
    return sm === em ? `${sm}/${sd} - ${ed}` : `${sm}/${sd} - ${em}/${ed}`;
  } else {
    return `${start.getFullYear()}年${start.getMonth() + 1}月`;
  }
});

const isCurrentPeriod = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today >= dateRange.value.start && today <= dateRange.value.end;
});

function shiftRange(dir: 1 | -1) {
  const copy = new Date(anchorDate.value);
  if (viewMode.value === "week") {
    copy.setDate(copy.getDate() + dir * 7);
  } else {
    copy.setMonth(copy.getMonth() + dir);
  }
  anchorDate.value = copy;
}

function goToToday() {
  anchorDate.value = new Date();
}

// ── Data ─────────────────────────────────────────────────
const shiftTemplates = ref<ShiftTemplate[]>([]);
const schedules = ref<EmployeeSchedule[]>([]);
const leaveRequests = ref<LeaveRequest[]>([]);
const loading = ref(false);
const loadError = ref<string | null>(null);

const selectedDate = ref<string | null>(null);

async function loadAll() {
  if (!restaurantId.value) return;
  loading.value = true;
  loadError.value = null;
  try {
    const startDateStr = dateRange.value.start.toISOString().split("T")[0];
    const endDateStr = dateRange.value.end.toISOString().split("T")[0];

    const [templates, sched, leaves] = await Promise.all([
      schedulingService.getShiftTemplates(restaurantId.value),
      schedulingService.getSchedules({
        restaurantId: restaurantId.value,
        startDate: startDateStr,
        endDate: endDateStr,
      }),
      leavesService.getRequests(restaurantId.value, {
        status: "approved",
        startDate: startDateStr,
        endDate: endDateStr,
      }),
    ]);

    shiftTemplates.value = templates;
    schedules.value = sched?.data ?? (Array.isArray(sched) ? sched : []);
    leaveRequests.value = leaves ?? [];
  } catch (e: any) {
    loadError.value = e?.message || "無法載入排班資料";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await fetchUsers();
  await loadAll();
});

// Reload when date range changes
watch(dateRange, () => {
  loadAll();
});

// ── Computed: unassigned employees ───────────────────────
const unassignedEmployees = computed(() => {
  const startStr = dateRange.value.start.toISOString().split("T")[0];
  const endStr = dateRange.value.end.toISOString().split("T")[0];

  // Employees that have at least one schedule in this period
  const assignedIds = new Set(
    schedules.value
      .filter((s) => s.workDate >= startStr && s.workDate <= endStr)
      .map((s) => s.employeeId),
  );

  return users.value
    .filter((u) => !assignedIds.has(u.id))
    .map((u) => ({
      id: u.id,
      name: u.fullName || u.username,
      fullName: u.fullName,
      role: u.role,
    }));
});

// ── Computed: weekly hours per employee ──────────────────
const weeklyHoursMap = computed<Record<number, number>>(() => {
  const map: Record<number, number> = {};
  for (const s of schedules.value) {
    if (s.scheduledHours) {
      map[s.employeeId] = (map[s.employeeId] ?? 0) + s.scheduledHours;
    }
  }
  return map;
});

// ── Computed: conflicts ──────────────────────────────────
const conflicts = computed(() => {
  const list: Array<{
    type: string;
    message: string;
    severity: "warning" | "error";
  }> = [];

  const startStr = dateRange.value.start.toISOString().split("T")[0];
  const endStr = dateRange.value.end.toISOString().split("T")[0];

  // Compute scheduled days per employee
  const daysPerEmployee: Record<number, Set<string>> = {};
  for (const s of schedules.value) {
    if (s.workDate >= startStr && s.workDate <= endStr) {
      if (!daysPerEmployee[s.employeeId])
        daysPerEmployee[s.employeeId] = new Set();
      daysPerEmployee[s.employeeId].add(s.workDate);
    }
  }

  // Check for employees scheduled 6+ days
  for (const [empId, days] of Object.entries(daysPerEmployee)) {
    if (days.size >= 6) {
      const emp = users.value.find((u) => u.id === Number(empId));
      const name = emp?.fullName || emp?.username || `員工 ${empId}`;
      list.push({
        type: "consecutive_days",
        message: `${name} 本週已排 ${days.size} 天`,
        severity: "warning",
      });
    }
  }

  // Check for understaffed slots (template cells with 0 employees on weekdays)
  if (viewMode.value === "week") {
    const cursor = new Date(dateRange.value.start);
    while (cursor <= dateRange.value.end) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) {
        // weekday
        const dateStr = cursor.toISOString().split("T")[0];
        for (const tpl of shiftTemplates.value) {
          const assigned = schedules.value.filter(
            (s) => s.shiftTemplateId === tpl.id && s.workDate === dateStr,
          ).length;
          if (assigned < (tpl.minEmployees ?? 1)) {
            const dayLabel = ["日", "一", "二", "三", "四", "五", "六"][dow];
            list.push({
              type: "understaffed",
              message: `週${dayLabel} ${tpl.name} 缺人 (${assigned}/${tpl.minEmployees ?? 1})`,
              severity: "warning",
            });
          }
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // Limit to 8 most important
  return list.slice(0, 8);
});

// ── Drag-and-drop assign ─────────────────────────────────
interface PendingAssignment {
  templateId: number;
  templateName: string;
  date: string;
  employeeId: number;
  employeeName: string;
}

const pendingAssignment = ref<PendingAssignment | null>(null);
const assigning = ref(false);

function handleAssign(templateId: number, date: string, employeeId: number) {
  const template = shiftTemplates.value.find((t) => t.id === templateId);
  const employee = users.value.find((u) => u.id === employeeId);
  if (!template || !employee) return;

  pendingAssignment.value = {
    templateId,
    templateName: template.name,
    date,
    employeeId,
    employeeName: employee.fullName || employee.username,
  };
}

async function confirmAssign() {
  if (!pendingAssignment.value || !restaurantId.value) return;
  const { templateId, date, employeeId } = pendingAssignment.value;
  const template = shiftTemplates.value.find((t) => t.id === templateId);
  if (!template) return;

  assigning.value = true;
  try {
    const newSchedule = await schedulingService.createSchedule(
      restaurantId.value,
      {
        employeeId,
        shiftTemplateId: templateId,
        workDate: date,
        startTime: template.startTime,
        endTime: template.endTime,
        scheduledHours: template.durationMinutes / 60,
      },
    );
    schedules.value = [...schedules.value, newSchedule];
    pendingAssignment.value = null;
  } catch (e: any) {
    alert(e?.message || "排班失敗，請再試一次");
  } finally {
    assigning.value = false;
  }
}

async function handleRemove(scheduleId: number) {
  if (!confirm("確定要移除此排班？")) return;
  try {
    await schedulingService.deleteSchedule(scheduleId);
    schedules.value = schedules.value.filter((s) => s.id !== scheduleId);
  } catch (e: any) {
    alert(e?.message || "移除排班失敗，請再試一次");
  }
}

function handleCellClick(_templateId: number, date: string) {
  selectedDate.value = date;
  // Could open a quick-add modal; for now just set selectedDate for sidebar highlight
}

function onEmployeeDragStart(_employeeId: number) {
  // handled by dataTransfer in UnassignedSidebar
}

// ── Template manager callbacks ───────────────────────────
const showTemplateManager = ref(false);

function onTemplateCreated(template: ShiftTemplate) {
  shiftTemplates.value = [...shiftTemplates.value, template];
}

function onTemplateUpdated(template: ShiftTemplate) {
  shiftTemplates.value = shiftTemplates.value.map((t) =>
    t.id === template.id ? template : t,
  );
}

function onTemplateDeleted(id: number) {
  shiftTemplates.value = shiftTemplates.value.filter((t) => t.id !== id);
}
</script>
