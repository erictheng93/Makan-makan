<template>
  <div class="space-y-6">
    <!-- Quick Stats -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div
        v-for="stat in attendanceStats"
        :key="stat.label"
        class="bg-[#F2F2F7] rounded-2xl p-4"
      >
        <p class="text-xs text-[#1C1C1E]/40 mb-1">{{ stat.label }}</p>
        <p class="text-2xl font-bold" :class="stat.valueClass">
          {{ stat.value }}
        </p>
      </div>
    </div>

    <!-- Currently Working -->
    <div>
      <h3
        class="text-sm font-semibold text-[#1C1C1E] mb-3 flex items-center gap-2"
      >
        <div class="w-2 h-2 rounded-full bg-[#34C759] animate-pulse" />
        {{ t("employees.attendance.working") }}
        <span class="text-[#1C1C1E]/30">({{ clockedInEmployees.length }})</span>
      </h3>
      <div
        v-if="clockedInLoading"
        class="flex items-center justify-center py-8"
      >
        <div
          class="w-6 h-6 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin"
        />
      </div>
      <div v-else-if="clockedInEmployees.length === 0" class="text-center py-8">
        <Clock class="mx-auto w-8 h-8 text-[#1C1C1E]/15 mb-2" />
        <p class="text-xs text-[#1C1C1E]/30">
          {{ t("employees.attendance.noOneWorking") }}
        </p>
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="emp in clockedInEmployees"
          :key="emp.id"
          class="flex items-center gap-3 p-3 bg-emerald-50/50 rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors"
          @click="navigateToDetail(emp.employeeId)"
        >
          <div class="relative">
            <div
              class="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-semibold text-emerald-700"
            >
              {{ getEmployeeInitials(emp) }}
            </div>
            <span
              class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#34C759] border-2 border-white rounded-full"
            >
              <span
                class="absolute inset-0 rounded-full bg-[#34C759] animate-ping opacity-40"
              />
            </span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-[#1C1C1E] truncate">
              {{ emp.employeeName || `Employee #${emp.employeeId}` }}
            </p>
            <p class="text-xs text-emerald-600">
              {{ emp.clockInTime ? formatTime(emp.clockInTime) : "" }}
              {{
                emp.startTime && emp.endTime
                  ? `(${emp.startTime} - ${emp.endTime})`
                  : ""
              }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- On Leave Today -->
    <div>
      <h3
        class="text-sm font-semibold text-[#1C1C1E] mb-3 flex items-center gap-2"
      >
        <div class="w-2 h-2 rounded-full bg-[#FF9500]" />
        {{ t("employees.attendance.onLeave") }}
        <span class="text-[#1C1C1E]/30">({{ onLeaveEmployees.length }})</span>
      </h3>
      <div v-if="leaveLoading" class="flex items-center justify-center py-8">
        <div
          class="w-6 h-6 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin"
        />
      </div>
      <div v-else-if="onLeaveEmployees.length === 0" class="text-center py-8">
        <CalendarOff class="mx-auto w-8 h-8 text-[#1C1C1E]/15 mb-2" />
        <p class="text-xs text-[#1C1C1E]/30">
          {{ t("employees.attendance.noOneOnLeave") }}
        </p>
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="emp in onLeaveEmployees"
          :key="emp.employeeId"
          class="flex items-center gap-3 p-3 bg-amber-50/50 rounded-xl"
        >
          <div
            class="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center"
          >
            <CalendarOff class="w-4 h-4 text-amber-700" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-[#1C1C1E] truncate">
              {{
                getEmployeeName(emp.employeeId) || `Employee #${emp.employeeId}`
              }}
            </p>
            <p class="text-xs text-amber-600">{{ emp.leaveTypeName }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "@/i18n";
import { useEmployeeList } from "@/composables/useEmployeeList";
import { Clock, CalendarOff } from "lucide-vue-next";
import type { EmployeeWithStatus } from "@/types/employee";

defineProps<{
  usersWithStatus?: EmployeeWithStatus[];
  isLoading?: boolean;
}>();

const router = useRouter();
const { t } = useI18n();
const employeeList = useEmployeeList();

const clockedInEmployees = employeeList.clockedInList;
const clockedInLoading = employeeList.clockedInLoading;
const leaveLoading = employeeList.leaveLoading;

const onLeaveEmployees = computed(() => {
  const users = employeeList.usersWithStatus.value;
  return users
    .filter((u) => u.leaveStatus?.isOnLeave)
    .map((u) => ({
      employeeId: u.id,
      leaveTypeName: u.leaveStatus?.leaveType || "Leave",
    }));
});

const attendanceStats = computed(() => {
  const total = employeeList.users.value.filter((u) => u.isActive).length;
  const working = employeeList.stats.value.currentlyWorking;
  const onLeave = employeeList.stats.value.onLeaveToday;
  const absent = Math.max(0, total - working - onLeave);
  const rate = total > 0 ? Math.round((working / total) * 100) : 0;

  return [
    {
      label: t("employees.attendance.totalActive"),
      value: total,
      valueClass: "text-[#1C1C1E]",
    },
    {
      label: t("employees.attendance.present"),
      value: working,
      valueClass: "text-emerald-600",
    },
    {
      label: t("employees.attendance.onLeave"),
      value: onLeave,
      valueClass: "text-amber-600",
    },
    {
      label: t("employees.attendance.absent"),
      value: absent,
      valueClass: "text-red-500",
    },
    {
      label: t("employees.attendance.rate"),
      value: `${rate}%`,
      valueClass: rate >= 80 ? "text-emerald-600" : "text-amber-600",
    },
  ];
});

const getEmployeeInitials = (schedule: any) => {
  const name = schedule.employeeName || "";
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const getEmployeeName = (employeeId: number) => {
  const user = employeeList.users.value.find((u) => u.id === employeeId);
  return user?.fullName || user?.username;
};

const formatTime = (time: string) => {
  try {
    const date = new Date(time);
    return date.toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return time;
  }
};

const navigateToDetail = (employeeId: number) => {
  router.push(`/dashboard/employees/${employeeId}`);
};

onMounted(() => {
  // Data already loaded by parent EmployeeManagementView
  // Refresh clocked-in data specifically
  employeeList.fetchClockedIn();
  employeeList.fetchTodayLeaves();
});
</script>
