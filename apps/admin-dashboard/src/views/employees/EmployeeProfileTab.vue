<template>
  <div class="space-y-6">
    <!-- Quick Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="bg-[#F2F2F7] rounded-2xl p-4">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"
          >
            <Clock class="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p class="text-xs text-[#1C1C1E]/40">
              {{ t("employees.profile.upcomingShifts") }}
            </p>
            <p class="text-xl font-bold text-[#1C1C1E]">
              {{ upcomingShiftsCount }}
            </p>
          </div>
        </div>
      </div>
      <div class="bg-[#F2F2F7] rounded-2xl p-4">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"
          >
            <CalendarCheck class="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p class="text-xs text-[#1C1C1E]/40">
              {{ t("employees.profile.completedShifts") }}
            </p>
            <p class="text-xl font-bold text-emerald-600">
              {{ completedShiftsCount }}
            </p>
          </div>
        </div>
      </div>
      <div class="bg-[#F2F2F7] rounded-2xl p-4">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"
          >
            <CalendarOff class="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p class="text-xs text-[#1C1C1E]/40">
              {{ t("employees.profile.pendingLeave") }}
            </p>
            <p class="text-xl font-bold text-amber-600">
              {{ pendingLeaveCount }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Basic Info Card -->
    <div>
      <h3 class="text-sm font-semibold text-[#1C1C1E] mb-3">
        {{ t("employees.profile.basicInfo") }}
      </h3>
      <div class="bg-[#F2F2F7] rounded-2xl divide-y divide-white/80">
        <div class="flex justify-between items-center px-4 py-3">
          <span class="text-sm text-[#1C1C1E]/50">{{
            t("users.modal.usernameLabel")
          }}</span>
          <span class="text-sm font-medium text-[#1C1C1E]">{{
            employee?.username
          }}</span>
        </div>
        <div class="flex justify-between items-center px-4 py-3">
          <span class="text-sm text-[#1C1C1E]/50">{{
            t("users.modal.fullNameLabel")
          }}</span>
          <span class="text-sm font-medium text-[#1C1C1E]">{{
            employee?.fullName || "-"
          }}</span>
        </div>
        <div class="flex justify-between items-center px-4 py-3">
          <span class="text-sm text-[#1C1C1E]/50">Email</span>
          <span class="text-sm font-medium text-[#1C1C1E]">{{
            employee?.email || "-"
          }}</span>
        </div>
        <div class="flex justify-between items-center px-4 py-3">
          <span class="text-sm text-[#1C1C1E]/50">{{
            t("users.table.joinDate")
          }}</span>
          <span class="text-sm font-medium text-[#1C1C1E]">{{
            employee?.createdAt ? formatDate(employee.createdAt) : "-"
          }}</span>
        </div>
        <div class="flex justify-between items-center px-4 py-3">
          <span class="text-sm text-[#1C1C1E]/50">{{
            t("users.table.lastLogin")
          }}</span>
          <span class="text-sm font-medium text-[#1C1C1E]">{{
            employee?.lastLoginAt
              ? formatDateTime(employee.lastLoginAt)
              : t("users.table.neverLoggedIn")
          }}</span>
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div>
      <h3 class="text-sm font-semibold text-[#1C1C1E] mb-3">
        {{ t("employees.profile.recentActivity") }}
      </h3>
      <div
        v-if="schedulesLoading || leavesLoading"
        class="flex items-center justify-center py-8"
      >
        <div
          class="w-6 h-6 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin"
        />
      </div>
      <div v-else-if="recentActivity.length === 0" class="text-center py-8">
        <Activity class="mx-auto w-8 h-8 text-[#1C1C1E]/15 mb-2" />
        <p class="text-xs text-[#1C1C1E]/30">
          {{ t("employees.profile.noActivity") }}
        </p>
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="(item, idx) in recentActivity"
          :key="idx"
          class="flex items-center gap-3 p-3 bg-[#F2F2F7] rounded-xl"
        >
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            :class="item.bgClass"
          >
            <component
              :is="item.icon"
              class="w-4 h-4"
              :class="item.iconClass"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm text-[#1C1C1E]">{{ item.title }}</p>
            <p class="text-xs text-[#1C1C1E]/40">{{ item.subtitle }}</p>
          </div>
          <span
            class="px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0"
            :class="item.badgeClass"
          >
            {{ item.badge }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "@/i18n";
import type { Employee, LeaveBalance, LeaveRequest } from "@/types/employee";
import type { EmployeeSchedule } from "@/types/scheduling";
import { Clock, CalendarCheck, CalendarOff, Activity } from "lucide-vue-next";

const props = defineProps<{
  employee?: Employee | null;
  schedules?: EmployeeSchedule[];
  leaveBalances?: LeaveBalance[];
  leaveRequests?: LeaveRequest[];
  schedulesLoading?: boolean;
  leavesLoading?: boolean;
}>();

const { t } = useI18n();

const upcomingShiftsCount = computed(() => {
  const now = new Date();
  return (props.schedules || []).filter((s) => {
    const workDate = new Date(s.workDate);
    return workDate >= now && s.status !== "cancelled";
  }).length;
});

const completedShiftsCount = computed(() => {
  return (props.schedules || []).filter((s) => s.status === "completed").length;
});

const pendingLeaveCount = computed(() => {
  return (props.leaveRequests || []).filter((r) => r.status === "pending")
    .length;
});

const recentActivity = computed(() => {
  const items: Array<{
    title: string;
    subtitle: string;
    badge: string;
    badgeClass: string;
    icon: any;
    bgClass: string;
    iconClass: string;
    date: Date;
  }> = [];

  // Recent schedules
  for (const s of (props.schedules || []).slice(0, 5)) {
    const statusMap: Record<string, { badge: string; badgeClass: string }> = {
      completed: {
        badge: t("employees.activity.completed"),
        badgeClass: "bg-emerald-50 text-emerald-700",
      },
      scheduled: {
        badge: t("employees.activity.scheduled"),
        badgeClass: "bg-blue-50 text-blue-700",
      },
      confirmed: {
        badge: t("employees.activity.confirmed"),
        badgeClass: "bg-indigo-50 text-indigo-700",
      },
      cancelled: {
        badge: t("employees.activity.cancelled"),
        badgeClass: "bg-red-50 text-red-700",
      },
    };
    const status = statusMap[s.status] || {
      badge: s.status,
      badgeClass: "bg-gray-50 text-gray-700",
    };
    items.push({
      title: `${t("employees.activity.shift")} ${s.startTime || ""} - ${s.endTime || ""}`,
      subtitle: formatDate(s.workDate),
      ...status,
      icon: Clock,
      bgClass: "bg-blue-50",
      iconClass: "text-blue-600",
      date: new Date(s.workDate),
    });
  }

  // Recent leave requests
  for (const r of (props.leaveRequests || []).slice(0, 5)) {
    const statusMap: Record<string, { badge: string; badgeClass: string }> = {
      pending: {
        badge: t("employees.activity.pending"),
        badgeClass: "bg-amber-50 text-amber-700",
      },
      approved: {
        badge: t("employees.activity.approved"),
        badgeClass: "bg-emerald-50 text-emerald-700",
      },
      rejected: {
        badge: t("employees.activity.rejected"),
        badgeClass: "bg-red-50 text-red-700",
      },
      cancelled: {
        badge: t("employees.activity.cancelled"),
        badgeClass: "bg-gray-50 text-gray-700",
      },
    };
    const status = statusMap[r.status] || {
      badge: r.status,
      badgeClass: "bg-gray-50 text-gray-700",
    };
    items.push({
      title: `${t("employees.activity.leave")} ${r.leaveType?.name || ""}`,
      subtitle: `${formatDate(r.startDate)} - ${formatDate(r.endDate)}`,
      ...status,
      icon: CalendarOff,
      bgClass: "bg-amber-50",
      iconClass: "text-amber-600",
      date: new Date(r.createdAt),
    });
  }

  // Sort by date desc and take top 8
  return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
});

const formatDate = (dt: string) => new Date(dt).toLocaleDateString("zh-TW");
const formatDateTime = (dt: string) => new Date(dt).toLocaleString("zh-TW");
</script>
