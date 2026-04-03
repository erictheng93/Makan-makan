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

    <!-- Confirm action modal -->
    <div v-if="confirmAction" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black/30 backdrop-blur-sm"
          @click="cancelConfirm"
        />
        <div class="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full">
          <div class="p-6 text-center">
            <div
              class="mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4"
              :class="
                confirmAction.type === 'danger'
                  ? 'bg-ios-error/10'
                  : 'bg-ios-warning/10'
              "
            >
              <AlertTriangle
                class="h-6 w-6"
                :class="
                  confirmAction.type === 'danger'
                    ? 'text-ios-error'
                    : 'text-ios-warning'
                "
              />
            </div>
            <h3 class="text-[17px] font-bold text-[#1C1C1E] mb-2">
              {{ confirmAction.title }}
            </h3>
            <p class="text-[14px] text-[#8E8E93] mb-6">
              {{ confirmAction.message }}
            </p>
            <div class="flex gap-2.5 justify-center">
              <button
                class="px-5 py-2.5 text-[14px] font-semibold text-[#1C1C1E] bg-[#F2F2F7] rounded-full hover:bg-[#E5E5EA] transition-colors"
                @click="cancelConfirm"
              >
                {{ t("common.cancel") }}
              </button>
              <button
                class="px-5 py-2.5 text-[14px] font-semibold text-white rounded-full transition-colors"
                :class="
                  confirmAction.type === 'danger'
                    ? 'bg-ios-error hover:bg-ios-error/90 shadow-[0_2px_8px_rgba(255,59,48,0.25)]'
                    : 'bg-ios-warning hover:bg-ios-warning/90 shadow-[0_2px_8px_rgba(255,149,0,0.25)]'
                "
                @click="executeConfirm"
              >
                {{ confirmAction.confirmLabel }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "@/i18n";
import {
  useEmployeeDisplay,
  getInitials as getInitialsHelper,
  avatarClass,
  roleIcon,
  roleBadgeClass,
  statusBadgeClass,
} from "@/composables/useEmployeeDisplay";
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
  AlertTriangle,
} from "lucide-vue-next";

const props = defineProps<{
  usersWithStatus?: EmployeeWithStatus[];
  isLoading?: boolean;
}>();

const router = useRouter();
const { t } = useI18n();
const { roleText, statusText } = useEmployeeDisplay();

// Local filter state that operates on the passed-in prop
const searchQuery = ref("");
const roleFilter = ref("");
const statusFilter = ref("");

const filteredUsers = computed(() => {
  if (!props.usersWithStatus) return [];
  let filtered = props.usersWithStatus;
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) ||
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q),
    );
  }
  if (roleFilter.value) {
    filtered = filtered.filter((u) => u.role === Number(roleFilter.value));
  }
  if (statusFilter.value) {
    filtered = filtered.filter((u) => u.status === statusFilter.value);
  }
  return filtered;
});

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
const getInitials = (user: EmployeeWithStatus) => getInitialsHelper(user);

const formatDateTime = (dateTime: string) =>
  new Date(dateTime).toLocaleString("zh-TW");

const navigateToDetail = (id: number) => {
  router.push(`/dashboard/employees/${id}`);
};

const emit = defineEmits<{
  editUser: [user: Employee];
  refresh: [];
  resetPassword: [userId: number];
  toggleStatus: [user: EmployeeWithStatus];
}>();

// Confirm action modal state
const confirmAction = ref<{
  type: "danger" | "warning";
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
} | null>(null);

const cancelConfirm = () => {
  confirmAction.value = null;
};

const executeConfirm = () => {
  confirmAction.value?.onConfirm();
  confirmAction.value = null;
};

const handleResetPassword = (user: EmployeeWithStatus) => {
  confirmAction.value = {
    type: "warning",
    title: t("users.actions.resetPassword"),
    message: t("users.confirm.resetPassword", { username: user.username }),
    confirmLabel: t("users.actions.resetPassword"),
    onConfirm: () => emit("resetPassword", user.id),
  };
};

const handleToggleStatus = (user: EmployeeWithStatus) => {
  const isActive = user.status === "active";
  const action = isActive
    ? t("users.actions.disable")
    : t("users.actions.enable");
  confirmAction.value = {
    type: isActive ? "danger" : "warning",
    title: action,
    message: t("users.confirm.toggleStatus", {
      action,
      username: user.username,
    }),
    confirmLabel: action,
    onConfirm: () => emit("toggleStatus", user),
  };
};
</script>
