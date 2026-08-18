<template>
  <div class="space-y-4">
    <!-- Sub-tab navigation -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all"
          :class="
            activeTab === tab.key
              ? 'bg-[#007AFF] text-white shadow-sm'
              : 'bg-[#F2F2F7] text-[#1C1C1E]/60 hover:text-[#1C1C1E] hover:bg-[#E5E5EA]'
          "
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <!-- Badge for pending count -->
          <span
            v-if="tab.key === 'queue' && pendingCount > 0"
            class="min-w-[18px] h-[18px] px-1 text-xs font-bold rounded-full flex items-center justify-center"
            :class="
              activeTab === 'queue'
                ? 'bg-white/25 text-white'
                : 'bg-[#FF3B30] text-white'
            "
          >
            {{ pendingCount }}
          </span>
        </button>
      </div>
      <button
        class="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-[#007AFF] text-white hover:bg-[#0066D6] transition-colors shadow-sm"
        @click="showRequestDialog = true"
      >
        <Plus class="w-3.5 h-3.5" />
        申請請假
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <div
        class="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin"
      />
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      class="bg-[#FF3B30]/8 rounded-2xl px-4 py-3 text-sm text-[#FF3B30]"
    >
      {{ error }}
      <button
        class="ml-2 underline text-[#FF3B30]/70 hover:text-[#FF3B30]"
        @click="loadData"
      >
        重試
      </button>
    </div>

    <template v-else>
      <!-- Tab: Approval Queue -->
      <LeaveApprovalQueue
        v-if="activeTab === 'queue'"
        :requests="pendingRequests"
        :balances="balances"
        :team-leaves="allRequests"
        :staffing-threshold="STAFFING_THRESHOLD"
        @approve="handleApprove"
        @reject="handleReject"
      />

      <!-- Tab: All Requests History -->
      <LeaveHistoryList
        v-else-if="activeTab === 'history'"
        :requests="allRequests"
        :leave-types="leaveTypes"
      />

      <!-- Tab: Balance Overview -->
      <LeaveBalanceOverview
        v-else-if="activeTab === 'balance'"
        :balances="balances"
        :employees="employeeList"
        @accrue="handleAccrue"
      />
    </template>

    <LeaveRequestDialog
      :is-open="showRequestDialog"
      :leave-types="leaveTypes"
      :balances="balances"
      @close="showRequestDialog = false"
      @submit="handleLeaveRequest"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Plus } from "lucide-vue-next";
import { useAuthStore } from "@/stores/auth";
import { t } from "@/i18n";
import { resolveUserFacingError } from "@makanmasak/shared/utils/user-facing-error";
import { leavesService } from "@/services/leavesService";
import { api as apiClient } from "@/services/api";
import { useEmployeeList } from "@/composables/useEmployeeList";
import LeaveApprovalQueue from "@/components/leaves/LeaveApprovalQueue.vue";
import LeaveHistoryList from "@/components/leaves/LeaveHistoryList.vue";
import LeaveBalanceOverview from "@/components/leaves/LeaveBalanceOverview.vue";
import LeaveRequestDialog from "@/components/leaves/LeaveRequestDialog.vue";
import type {
  LeaveRequest,
  LeaveBalance,
  LeaveType,
} from "@/services/leavesService";

const STAFFING_THRESHOLD = 3;

type TabKey = "queue" | "history" | "balance";
type LeavePeriod = "full" | "am" | "pm";

interface LeaveRequestFormData {
  leaveTypeId: number | string;
  startDate: string;
  endDate: string;
  startPeriod: LeavePeriod;
  reason: string;
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "queue", label: "待我處理" },
  { key: "history", label: "全部請假" },
  { key: "balance", label: "假期餘額" },
];

const authStore = useAuthStore();
const { users, fetchUsers } = useEmployeeList();

const activeTab = ref<TabKey>("queue");
const isLoading = ref(false);
const error = ref<string | null>(null);
const showRequestDialog = ref(false);

const leaveTypes = ref<LeaveType[]>([]);
const balances = ref<LeaveBalance[]>([]);
const allRequests = ref<LeaveRequest[]>([]);

const pendingRequests = computed(() =>
  allRequests.value.filter((r) => r.status === "pending"),
);

const pendingCount = computed(() => pendingRequests.value.length);

const employeeList = computed(() =>
  users.value.map((u) => ({
    id: u.id,
    name: u.fullName || u.username,
  })),
);

const loadData = async () => {
  const restaurantId = authStore.restaurantId;
  if (!restaurantId) return;

  isLoading.value = true;
  error.value = null;

  try {
    const [types, reqs, allBalances] = await Promise.all([
      leavesService.getLeaveTypes(restaurantId),
      leavesService.getRequests(restaurantId),
      leavesService.getRestaurantBalances(String(restaurantId)),
    ]);
    leaveTypes.value = types;
    allRequests.value = reqs;
    balances.value = allBalances;
  } catch (e) {
    error.value = resolveUserFacingError(e, t, {
      fallbackKey: "leaves.messages.loadFailed",
    }).message;
    console.error("Failed to load leaves data:", e);
  } finally {
    isLoading.value = false;
  }
};

const handleApprove = async (requestId: number) => {
  try {
    await leavesService.approveRequest(requestId);
    // Optimistically update status
    const req = allRequests.value.find((r) => r.id === requestId);
    if (req) req.status = "approved";
  } catch (e) {
    console.error("Failed to approve request:", e);
    error.value = resolveUserFacingError(e, t, {
      fallbackKey: "leaves.messages.approveFailed",
    }).message;
    await loadData(); // Refresh on error
  }
};

const handleReject = async (requestId: number, reason?: string) => {
  try {
    await leavesService.rejectRequest(requestId, reason);
    // Optimistically update status
    const req = allRequests.value.find((r) => r.id === requestId);
    if (req) {
      req.status = "rejected";
      if (reason) req.rejectionReason = reason;
    }
  } catch (e) {
    console.error("Failed to reject request:", e);
    error.value = resolveUserFacingError(e, t, {
      fallbackKey: "leaves.messages.rejectFailed",
    }).message;
    await loadData(); // Refresh on error
  }
};

const handleLeaveRequest = async (formData: LeaveRequestFormData) => {
  const restaurantId = authStore.restaurantId;
  if (!restaurantId) return;

  const leaveTypeId =
    typeof formData.leaveTypeId === "number"
      ? formData.leaveTypeId
      : Number(formData.leaveTypeId);
  if (!Number.isFinite(leaveTypeId)) {
    error.value = "請選擇有效的假別";
    return;
  }

  try {
    await leavesService.createRequest(String(restaurantId), {
      leaveTypeId,
      startDate: formData.startDate,
      endDate: formData.endDate,
      period: formData.startPeriod || "full",
      reason: formData.reason,
    });
    showRequestDialog.value = false;
    await loadData();
  } catch (e) {
    error.value = resolveUserFacingError(e, t, {
      fallbackKey: "leaves.messages.submitFailed",
    }).message;
  }
};

const handleAccrue = async () => {
  const restaurantId = authStore.restaurantId;
  if (!restaurantId) return;
  try {
    await apiClient.post(`/leaves/${restaurantId}/balances/accrue`, {
      year: new Date().getFullYear(),
    });
    await loadData();
  } catch (e) {
    error.value = resolveUserFacingError(e, t, {
      fallbackKey: "leaves.messages.initFailed",
    }).message;
  }
};

onMounted(() => {
  // Both can run concurrently — loadData no longer depends on users being loaded
  fetchUsers();
  loadData();
});
</script>
