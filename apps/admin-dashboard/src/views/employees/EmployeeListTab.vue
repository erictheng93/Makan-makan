<template>
  <div class="space-y-4">
    <!-- Search & Filters -->
    <div class="flex flex-col sm:flex-row gap-3">
      <div class="relative flex-1">
        <Search
          class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1C1C1E]/30"
        />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('users.search.placeholder')"
          class="w-full pl-10 pr-4 py-2.5 bg-[#F2F2F7] border-none rounded-xl text-sm text-[#1C1C1E] placeholder-[#1C1C1E]/30 focus:shadow-[0_0_0_2px_rgba(0,122,255,0.25)] focus:bg-white transition-all"
        />
      </div>
      <select
        v-model="roleFilter"
        class="px-3.5 py-2.5 bg-[#F2F2F7] border-none rounded-xl text-sm text-[#1C1C1E] focus:shadow-[0_0_0_2px_rgba(0,122,255,0.25)] focus:bg-white transition-all"
      >
        <option value="">{{ t("users.search.allRoles") }}</option>
        <option value="1">{{ t("users.search.ownerRole") }}</option>
        <option value="2">{{ t("users.search.chefRole") }}</option>
        <option value="3">{{ t("users.search.serviceRole") }}</option>
        <option value="4">{{ t("users.search.cashierRole") }}</option>
      </select>
      <select
        v-model="statusFilter"
        class="px-3.5 py-2.5 bg-[#F2F2F7] border-none rounded-xl text-sm text-[#1C1C1E] focus:shadow-[0_0_0_2px_rgba(0,122,255,0.25)] focus:bg-white transition-all"
      >
        <option value="">{{ t("users.search.allStatuses") }}</option>
        <option value="active">{{ t("users.status.active") }}</option>
        <option value="inactive">{{ t("users.status.inactive") }}</option>
        <option value="suspended">{{ t("users.status.suspended") }}</option>
      </select>
    </div>

    <!-- Employee Table -->
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <div
        class="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin"
      />
    </div>

    <div v-else-if="filteredUsers.length === 0" class="text-center py-16">
      <Users class="mx-auto w-12 h-12 text-[#1C1C1E]/20 mb-3" />
      <h3 class="text-sm font-medium text-[#1C1C1E]/60">
        {{ t("users.empty.title") }}
      </h3>
      <p class="text-xs text-[#1C1C1E]/40 mt-1">
        {{ t("users.empty.description") }}
      </p>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="min-w-full">
        <thead>
          <tr class="border-b border-[#F2F2F7]">
            <th
              class="px-4 py-3 text-left text-xs font-medium text-[#1C1C1E]/40 uppercase tracking-wider"
            >
              {{ t("users.table.info") }}
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium text-[#1C1C1E]/40 uppercase tracking-wider"
            >
              {{ t("users.table.role") }}
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium text-[#1C1C1E]/40 uppercase tracking-wider"
            >
              {{ t("users.table.status") }}
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium text-[#1C1C1E]/40 uppercase tracking-wider"
            >
              {{ t("employees.table.workStatus") }}
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium text-[#1C1C1E]/40 uppercase tracking-wider"
            >
              {{ t("users.table.lastLogin") }}
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium text-[#1C1C1E]/40 uppercase tracking-wider"
            >
              {{ t("users.table.actions") }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#F2F2F7]">
          <tr
            v-for="user in paginatedUsers"
            :key="user.id"
            class="hover:bg-[#F2F2F7]/50 cursor-pointer transition-colors"
            @click="navigateToDetail(user.id)"
          >
            <!-- Employee Info -->
            <td class="px-4 py-3.5">
              <div class="flex items-center gap-3">
                <div class="relative">
                  <div
                    class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                    :class="avatarClass(user.role)"
                  >
                    {{ getInitials(user) }}
                  </div>
                  <!-- Clock-in dot -->
                  <span
                    v-if="user.clockInStatus?.isClockedIn"
                    class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#34C759] border-2 border-white rounded-full"
                  >
                    <span
                      class="absolute inset-0 rounded-full bg-[#34C759] animate-ping opacity-40"
                    />
                  </span>
                  <!-- On leave dot -->
                  <span
                    v-else-if="user.leaveStatus?.isOnLeave"
                    class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#FF9500] border-2 border-white rounded-full"
                  />
                </div>
                <div class="min-w-0">
                  <div class="text-sm font-medium text-[#1C1C1E] truncate">
                    {{ user.fullName || user.username }}
                  </div>
                  <div class="text-xs text-[#1C1C1E]/40 truncate">
                    {{ user.email || user.username }}
                  </div>
                </div>
              </div>
            </td>

            <!-- Role -->
            <td class="px-4 py-3.5">
              <span
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                :class="roleBadgeClass(user.role)"
              >
                <component :is="roleIcon(user.role)" class="w-3 h-3" />
                {{ roleText(user.role) }}
              </span>
            </td>

            <!-- Account Status -->
            <td class="px-4 py-3.5">
              <span
                class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                :class="statusBadgeClass(user.status)"
              >
                {{ statusText(user.status) }}
              </span>
            </td>

            <!-- Work Status -->
            <td class="px-4 py-3.5">
              <span
                v-if="user.clockInStatus?.isClockedIn"
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700"
              >
                <Clock class="w-3 h-3" />
                {{ t("employees.clockIn.working") }}
              </span>
              <span
                v-else-if="user.leaveStatus?.isOnLeave"
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700"
              >
                <CalendarOff class="w-3 h-3" />
                {{
                  user.leaveStatus.leaveType || t("employees.clockIn.onLeave")
                }}
              </span>
              <span v-else class="text-xs text-[#1C1C1E]/30">
                {{ t("employees.clockIn.off") }}
              </span>
            </td>

            <!-- Last Login -->
            <td class="px-4 py-3.5 text-xs text-[#1C1C1E]/50">
              {{
                user.lastLoginAt
                  ? formatDateTime(user.lastLoginAt)
                  : t("users.table.neverLoggedIn")
              }}
            </td>

            <!-- Actions -->
            <td class="px-4 py-3.5" @click.stop>
              <div class="flex items-center gap-2">
                <button
                  class="p-1.5 rounded-lg text-[#007AFF] hover:bg-[#007AFF]/10 transition-colors"
                  :title="t('users.actions.edit')"
                  @click="$emit('editUser', user)"
                >
                  <Pencil class="w-4 h-4" />
                </button>
                <button
                  class="p-1.5 rounded-lg text-[#FF9500] hover:bg-[#FF9500]/10 transition-colors"
                  :title="t('users.actions.resetPassword')"
                  @click="handleResetPassword(user)"
                >
                  <KeyRound class="w-4 h-4" />
                </button>
                <button
                  class="p-1.5 rounded-lg transition-colors"
                  :class="
                    user.status === 'active'
                      ? 'text-[#FF3B30] hover:bg-[#FF3B30]/10'
                      : 'text-[#34C759] hover:bg-[#34C759]/10'
                  "
                  :title="
                    user.status === 'active'
                      ? t('users.actions.disable')
                      : t('users.actions.enable')
                  "
                  @click="handleToggleStatus(user)"
                >
                  <UserX v-if="user.status === 'active'" class="w-4 h-4" />
                  <UserCheck v-else class="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between pt-4 border-t border-[#F2F2F7]"
      >
        <p class="text-xs text-[#1C1C1E]/40">
          {{
            t("employees.pagination.showing", {
              from: (currentPage - 1) * pageSize + 1,
              to: Math.min(currentPage * pageSize, filteredUsers.length),
              total: filteredUsers.length,
            })
          }}
        </p>
        <div class="flex gap-1">
          <button
            v-for="page in totalPages"
            :key="page"
            class="w-8 h-8 rounded-lg text-xs font-medium transition-colors"
            :class="
              page === currentPage
                ? 'bg-[#007AFF] text-white'
                : 'text-[#1C1C1E]/50 hover:bg-[#F2F2F7]'
            "
            @click="currentPage = page"
          >
            {{ page }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "@/i18n";
import { useEmployeeList } from "@/composables/useEmployeeList";
import type { Employee, EmployeeWithStatus } from "@/types/employee";
import {
  Search,
  Users,
  Clock,
  CalendarOff,
  Pencil,
  KeyRound,
  UserX,
  UserCheck,
  Crown,
  ChefHat,
  Truck,
  CreditCard,
  User,
} from "lucide-vue-next";

defineProps<{
  usersWithStatus?: EmployeeWithStatus[];
  isLoading?: boolean;
}>();

defineEmits<{
  editUser: [user: Employee];
  refresh: [];
}>();

const router = useRouter();
const { t } = useI18n();
const employeeList = useEmployeeList();

// Use composable filters directly
const searchQuery = employeeList.searchQuery;
const roleFilter = employeeList.roleFilter;
const statusFilter = employeeList.statusFilter;
const filteredUsers = employeeList.filteredUsers;

// Pagination
const currentPage = ref(1);
const pageSize = 15;

const totalPages = computed(() =>
  Math.ceil(filteredUsers.value.length / pageSize),
);

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredUsers.value.slice(start, start + pageSize);
});

// Reset to page 1 when filters change
watch([searchQuery, roleFilter, statusFilter], () => {
  currentPage.value = 1;
});

// Helpers
const getInitials = (user: EmployeeWithStatus) => {
  const name = user.fullName || user.username;
  return name
    .split(/\s+/)
    .map((w) => w[0])
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
  return icons[role] || User;
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

const formatDateTime = (dateTime: string) => {
  return new Date(dateTime).toLocaleString("zh-TW");
};

const navigateToDetail = (id: number) => {
  router.push(`/dashboard/employees/${id}`);
};

const handleResetPassword = async (user: EmployeeWithStatus) => {
  if (confirm(t("users.confirm.resetPassword", { username: user.username }))) {
    try {
      await employeeList.resetPassword(user.id);
      alert(t("users.confirm.resetPasswordSuccess"));
    } catch (error: any) {
      alert(
        error.response?.data?.error?.message || t("users.errors.resetFailed"),
      );
    }
  }
};

const handleToggleStatus = async (user: EmployeeWithStatus) => {
  const action =
    user.status === "active"
      ? t("users.actions.disable")
      : t("users.actions.enable");
  if (
    confirm(
      t("users.confirm.toggleStatus", { action, username: user.username }),
    )
  ) {
    try {
      await employeeList.toggleUserStatus(user);
    } catch (error: any) {
      alert(
        error.response?.data?.error?.message || t("users.errors.toggleFailed"),
      );
    }
  }
};
</script>
