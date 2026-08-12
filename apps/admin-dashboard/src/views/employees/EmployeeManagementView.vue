<template>
  <div class="min-h-screen bg-[#F2F2F7] p-6 space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-[#1C1C1E]">
          {{ t("employees.title") }}
        </h1>
        <p class="text-sm text-[#1C1C1E]/50 mt-1">
          {{ t("employees.subtitle") }}
        </p>
      </div>
      <button
        class="flex items-center px-5 py-2.5 rounded-full text-[13px] font-semibold bg-[#007AFF] text-white hover:bg-[#0066D6] transition-colors shadow-sm"
        @click="showModal = true"
      >
        <Plus class="w-4 h-4 mr-1.5" />
        {{ t("users.addEmployee") }}
      </button>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      <div
        v-for="stat in statCards"
        :key="stat.label"
        class="bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-transform hover:scale-[1.02]"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center"
            :class="stat.bgClass"
          >
            <component
              :is="stat.icon"
              class="w-5 h-5"
              :class="stat.iconClass"
            />
          </div>
          <div class="min-w-0">
            <p class="text-xs text-[#1C1C1E]/50 truncate">{{ stat.label }}</p>
            <p class="text-xl font-bold" :class="stat.valueClass">
              {{ stat.value }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <nav class="flex border-b border-[#F2F2F7] px-6">
        <router-link
          v-for="tab in tabs"
          :key="tab.name"
          :to="tab.path"
          class="flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors -mb-px"
          :class="
            isActiveTab(tab.path)
              ? 'border-[#007AFF] text-[#007AFF]'
              : 'border-transparent text-[#1C1C1E]/40 hover:text-[#1C1C1E]/70'
          "
          :data-active="isActiveTab(tab.path)"
        >
          <component :is="tab.icon" class="w-4 h-4" />
          {{ tab.label }}
          <span
            v-if="tab.badge !== undefined && tab.badge > 0"
            class="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#FF3B30] text-white"
          >
            {{ tab.badge }}
          </span>
        </router-link>
      </nav>

      <!-- Tab Content -->
      <div class="p-6">
        <router-view
          :users-with-status="employeeList.usersWithStatus.value"
          :is-loading="employeeList.isLoading.value"
          @edit-user="editUser"
          @refresh="employeeList.fetchAll"
          @reset-password="handleResetPassword"
          @toggle-status="handleToggleStatus"
        />
      </div>
    </div>

    <!-- Employee Form Modal -->
    <EmployeeFormModal
      :is-open="showModal"
      :employee="editingEmployee"
      @close="closeModal"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "@/i18n";
import { useToast } from "vue-toastification";
import { useEmployeeList } from "@/composables/useEmployeeList";
import { useAuthStore } from "@/stores/auth";
import { leavesService } from "@/services/leavesService";
import EmployeeFormModal from "@/components/employees/EmployeeFormModal.vue";
import type { Employee, EmployeeFormData } from "@/types/employee";
import {
  Users,
  Plus,
  Clock,
  CalendarOff,
  Crown,
  ChefHat,
  Truck,
  CreditCard,
  ClipboardCheck,
  Calendar,
  CalendarCheck,
} from "lucide-vue-next";

const route = useRoute();
const { t } = useI18n();
const toast = useToast();
const employeeList = useEmployeeList();
const authStore = useAuthStore();

const showModal = ref(false);
const editingEmployee = ref<Employee | null>(null);
const pendingLeaveCount = ref(0);

// Stats cards
const statCards = computed(() => [
  {
    label: t("users.stats.owner"),
    value: employeeList.stats.value.owner,
    icon: Crown,
    bgClass: "bg-purple-50",
    iconClass: "text-purple-600",
    valueClass: "text-purple-600",
  },
  {
    label: t("users.stats.chef"),
    value: employeeList.stats.value.chef,
    icon: ChefHat,
    bgClass: "bg-orange-50",
    iconClass: "text-orange-600",
    valueClass: "text-orange-600",
  },
  {
    label: t("users.stats.service"),
    value: employeeList.stats.value.service,
    icon: Truck,
    bgClass: "bg-green-50",
    iconClass: "text-green-600",
    valueClass: "text-green-600",
  },
  {
    label: t("users.stats.cashier"),
    value: employeeList.stats.value.cashier,
    icon: CreditCard,
    bgClass: "bg-blue-50",
    iconClass: "text-blue-600",
    valueClass: "text-blue-600",
  },
  {
    label: t("users.stats.total"),
    value: employeeList.stats.value.total,
    icon: Users,
    bgClass: "bg-gray-100",
    iconClass: "text-[#1C1C1E]/60",
    valueClass: "text-[#1C1C1E]",
  },
  {
    label: t("employees.stats.currentlyWorking"),
    value: employeeList.stats.value.currentlyWorking,
    icon: Clock,
    bgClass: "bg-emerald-50",
    iconClass: "text-emerald-600",
    valueClass: "text-emerald-600",
  },
  {
    label: t("employees.stats.onLeaveToday"),
    value: employeeList.stats.value.onLeaveToday,
    icon: CalendarOff,
    bgClass: "bg-amber-50",
    iconClass: "text-amber-600",
    valueClass: "text-amber-600",
  },
]);

// Tabs
const tabs = computed(() => [
  {
    name: "list",
    path: "/dashboard/employees",
    label: t("employees.tabs.list"),
    icon: Users,
    badge: undefined,
  },
  {
    name: "scheduling",
    path: "/dashboard/employees/scheduling",
    label: t("employees.tabs.scheduling"),
    icon: Calendar,
    badge: undefined,
  },
  {
    name: "leaves",
    path: "/dashboard/employees/leaves",
    label: t("employees.tabs.leaves"),
    icon: CalendarCheck,
    badge: pendingLeaveCount.value,
  },
  {
    name: "attendance",
    path: "/dashboard/employees/attendance",
    label: t("employees.tabs.attendance"),
    icon: ClipboardCheck,
    badge: undefined,
  },
]);

const isActiveTab = (path: string) => {
  // Exact match for list tab (don't match attendance or :id routes)
  if (path === "/dashboard/employees") {
    return route.path === "/dashboard/employees";
  }
  return route.path === path || route.path.startsWith(path + "/");
};

// Modal handlers
const editUser = (user: Employee) => {
  editingEmployee.value = user;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingEmployee.value = null;
};

const handleSave = async (form: EmployeeFormData, isEdit: boolean) => {
  try {
    if (isEdit && editingEmployee.value) {
      await employeeList.updateUser(editingEmployee.value.id, form);
    } else {
      await employeeList.createUser(form);
    }
    closeModal();
  } catch (error: any) {
    const rawError = error?.originalError || error;
    const apiError = rawError?.response?.data?.error;
    let errorMessage: string;
    if (apiError?.details && Array.isArray(apiError.details)) {
      errorMessage = apiError.details.map((d: any) => d.message).join("\n");
    } else if (apiError?.message) {
      errorMessage = apiError.message;
    } else {
      errorMessage = error?.message || t("users.errors.saveFailed");
    }
    toast.error(errorMessage);
  }
};

const handleResetPassword = async (userId: number) => {
  try {
    await employeeList.resetPassword(userId);
    toast.success(t("users.confirm.resetPasswordSuccess"));
  } catch (error: any) {
    toast.error(
      error.response?.data?.error?.message || t("users.errors.resetFailed"),
    );
  }
};

const handleToggleStatus = async (user: any) => {
  try {
    await employeeList.toggleUserStatus(user);
  } catch (error: any) {
    toast.error(
      error.response?.data?.error?.message || t("users.errors.toggleFailed"),
    );
  }
};

onMounted(async () => {
  employeeList.fetchAll();
  try {
    const restaurantId = authStore.restaurantId;
    if (restaurantId) {
      const pending = await leavesService.getRequests(String(restaurantId), {
        status: "pending",
      });
      pendingLeaveCount.value = Array.isArray(pending) ? pending.length : 0;
    }
  } catch {
    // silently ignore errors fetching leave count
  }
});
</script>
