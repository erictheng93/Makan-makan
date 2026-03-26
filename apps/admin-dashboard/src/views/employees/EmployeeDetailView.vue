<template>
  <div class="min-h-screen bg-[#F2F2F7] p-6 space-y-6">
    <!-- Back Button -->
    <button
      class="flex items-center gap-1.5 text-sm text-[#007AFF] hover:text-[#0066D6] transition-colors"
      @click="router.push('/dashboard/employees')"
    >
      <ChevronLeft class="w-4 h-4" />
      {{ t("employees.detail.back") }}
    </button>

    <!-- Employee Header Card -->
    <div class="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-6">
      <div v-if="employeeLoading" class="flex items-center justify-center py-8">
        <div
          class="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin"
        />
      </div>
      <div
        v-else-if="employee"
        class="flex flex-col sm:flex-row items-start sm:items-center gap-5"
      >
        <!-- Avatar -->
        <div class="relative">
          <div
            class="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold"
            :class="avatarClass(employee.role)"
          >
            {{ getInitials(employee) }}
          </div>
          <span
            v-if="clockedIn"
            class="absolute -bottom-1 -right-1 w-4 h-4 bg-[#34C759] border-2 border-white rounded-full"
          />
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <h1 class="text-xl font-bold text-[#1C1C1E]">
            {{ employee.fullName || employee.username }}
          </h1>
          <p class="text-sm text-[#1C1C1E]/50 mt-0.5">
            @{{ employee.username }}
          </p>
          <div class="flex flex-wrap items-center gap-2 mt-2">
            <span
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
              :class="roleBadgeClass(employee.role)"
            >
              <component :is="roleIcon(employee.role)" class="w-3 h-3" />
              {{ roleText(employee.role) }}
            </span>
            <span
              class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              :class="statusBadgeClass(employee.status)"
            >
              {{ statusText(employee.status) }}
            </span>
          </div>
        </div>

        <!-- Quick Info -->
        <div class="flex flex-col gap-1.5 text-xs text-[#1C1C1E]/40">
          <div v-if="employee.email" class="flex items-center gap-1.5">
            <Mail class="w-3.5 h-3.5" />
            {{ employee.email }}
          </div>
          <div class="flex items-center gap-1.5">
            <Calendar class="w-3.5 h-3.5" />
            {{ t("employees.detail.joined") }}
            {{ formatDate(employee.createdAt) }}
          </div>
          <div v-if="employee.lastLoginAt" class="flex items-center gap-1.5">
            <Clock class="w-3.5 h-3.5" />
            {{ t("employees.detail.lastLogin") }}
            {{ formatDateTime(employee.lastLoginAt) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Sub-tab Navigation -->
    <div class="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <nav class="flex border-b border-[#F2F2F7] px-6">
        <router-link
          v-for="tab in subTabs"
          :key="tab.name"
          :to="tab.path"
          class="flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors -mb-px"
          :class="
            isActiveTab(tab.path)
              ? 'border-[#007AFF] text-[#007AFF]'
              : 'border-transparent text-[#1C1C1E]/40 hover:text-[#1C1C1E]/70'
          "
        >
          <component :is="tab.icon" class="w-4 h-4" />
          {{ tab.label }}
        </router-link>
      </nav>

      <div class="p-6">
        <router-view
          :employee="employee"
          :schedules="schedules"
          :leave-balances="leaveBalances"
          :leave-requests="leaveRequests"
          :schedules-loading="schedulesLoading"
          :leaves-loading="leavesLoading"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "@/i18n";
import { useEmployeeData } from "@/composables/useEmployeeData";
import {
  ChevronLeft,
  User as UserIcon,
  Calendar,
  CalendarDays,
  CalendarOff,
  Clock,
  Mail,
  Crown,
  ChefHat,
  Truck,
  CreditCard,
} from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const employeeId = () => {
  const id = route.params.id;
  return id ? Number(id) : undefined;
};

const {
  employee,
  schedules,
  leaveBalances,
  leaveRequests,
  employeeLoading,
  schedulesLoading,
  leavesLoading,
} = useEmployeeData(employeeId);

const clockedIn = computed(() => false); // Could enhance later with real-time check

const subTabs = computed(() => {
  const id = route.params.id;
  return [
    {
      name: "profile",
      path: `/dashboard/employees/${id}`,
      label: t("employees.detail.tabs.profile"),
      icon: UserIcon,
    },
    {
      name: "schedule",
      path: `/dashboard/employees/${id}/schedule`,
      label: t("employees.detail.tabs.schedule"),
      icon: CalendarDays,
    },
    {
      name: "leave",
      path: `/dashboard/employees/${id}/leave`,
      label: t("employees.detail.tabs.leave"),
      icon: CalendarOff,
    },
  ];
});

const isActiveTab = (path: string) => {
  if (path === `/dashboard/employees/${route.params.id}`) {
    return route.path === path;
  }
  return route.path === path || route.path.startsWith(path + "/");
};

// Helpers
const getInitials = (emp: any) => {
  const name = emp.fullName || emp.username || "";
  return name
    .split(/\s+/)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const avatarClass = (role: number) => {
  const classes: Record<number, string> = {
    1: "bg-purple-100 text-purple-700",
    2: "bg-orange-100 text-orange-700",
    3: "bg-green-100 text-green-700",
    4: "bg-blue-100 text-blue-700",
  };
  return classes[role] || "bg-gray-100 text-gray-700";
};

const roleIcon = (role: number) => {
  const icons: Record<number, any> = {
    1: Crown,
    2: ChefHat,
    3: Truck,
    4: CreditCard,
  };
  return icons[role] || UserIcon;
};

const roleBadgeClass = (role: number) => {
  const classes: Record<number, string> = {
    1: "bg-purple-50 text-purple-700",
    2: "bg-orange-50 text-orange-700",
    3: "bg-green-50 text-green-700",
    4: "bg-blue-50 text-blue-700",
  };
  return classes[role] || "bg-gray-50 text-gray-700";
};

const roleText = (role: number) => {
  const keys: Record<number, string> = {
    1: "users.roles.owner",
    2: "users.roles.chef",
    3: "users.roles.service",
    4: "users.roles.cashier",
  };
  return keys[role] ? t(keys[role]) : t("users.roles.unknown");
};

const statusBadgeClass = (status: string) => {
  const classes: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700",
    inactive: "bg-red-50 text-red-700",
    suspended: "bg-amber-50 text-amber-700",
  };
  return classes[status] || "bg-gray-50 text-gray-700";
};

const statusText = (status: string) => {
  const keys: Record<string, string> = {
    active: "users.status.active",
    inactive: "users.status.inactive",
    suspended: "users.status.suspended",
  };
  return keys[status] ? t(keys[status]) : status;
};

const formatDate = (dt: string) => new Date(dt).toLocaleDateString("zh-TW");
const formatDateTime = (dt: string) => new Date(dt).toLocaleString("zh-TW");
</script>
