<template>
  <div class="leave-view">
    <!-- 頁面標題 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t("leaves.title") }}</h1>
        <p class="page-subtitle">{{ t("leaves.subtitle") }}</p>
      </div>
      <button class="btn-request-leave" @click="openRequestDialog">
        <svg class="icon" viewBox="0 0 20 20" fill="currentColor">
          <path
            d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
          />
        </svg>
        {{ t("leaves.request.new") }}
      </button>
    </div>

    <!-- 標籤頁 -->
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="tab"
        :class="{ active: currentTab === tab.value }"
        @click="currentTab = tab.value"
      >
        {{ t(tab.label) }}
        <span v-if="tab.count" class="tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <!-- 內容區域 -->
    <div class="tab-content">
      <!-- 我的請假 -->
      <div v-show="currentTab === 'my-leaves'">
        <!-- 餘額卡片 -->
        <div class="balances-section">
          <h3 class="section-title">{{ t("leaves.balance.title") }}</h3>
          <div class="balance-grid">
            <LeaveBalanceCard
              v-for="balance in balances"
              :key="balance.id"
              :balance="balance"
              @request-leave="handleRequestLeave"
            />
          </div>
        </div>

        <!-- 請假記錄 -->
        <div class="requests-section">
          <h3 class="section-title">{{ t("leaves.request.myRequests") }}</h3>
          <LeaveRequestList
            :requests="myRequests"
            :leave-types="leaveTypes"
            @cancel="handleCancelRequest"
            @view-details="handleViewDetails"
          />
        </div>
      </div>

      <!-- 審批管理 (僅管理者) -->
      <div v-show="currentTab === 'approvals'" class="approvals-section">
        <LeaveApprovalList
          :requests="allRequests"
          @approve="handleApproveRequest"
          @reject="handleRejectRequest"
        />
      </div>

      <!-- 日曆視圖 -->
      <div v-show="currentTab === 'calendar'" class="calendar-section">
        <LeaveCalendar
          :leave-requests="allRequests"
          :leave-types="leaveTypes"
        />
      </div>
    </div>

    <!-- 請假申請對話框 -->
    <LeaveRequestDialog
      :is-open="isRequestDialogOpen"
      :leave-types="leaveTypes"
      :balances="balances"
      :preselected-type-id="preselectedTypeId"
      @close="closeRequestDialog"
      @submit="handleSubmitRequest"
    />

    <!-- 載入中 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "@/i18n";
import { useToast } from "vue-toastification";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/services/api";
import { useConfirmModal } from "@/composables/useConfirmModal";
import LeaveBalanceCard from "@/components/leaves/LeaveBalanceCard.vue";
import LeaveRequestDialog from "@/components/leaves/LeaveRequestDialog.vue";
import type { LeaveRequestFormData } from "@/components/leaves/LeaveRequestDialog.vue";
import LeaveRequestList from "@/components/leaves/LeaveRequestList.vue";
import LeaveApprovalList from "@/components/leaves/LeaveApprovalList.vue";
import LeaveCalendar from "@/components/leaves/LeaveCalendar.vue";
import type {
  LeaveBalance,
  LeaveType,
  LeaveTypeBalanceSummary,
  LeaveRequest,
} from "@makanmasak/shared-types";

const { t } = useI18n();
const toast = useToast();
const router = useRouter();
const { confirm: confirmModal } = useConfirmModal();
const authStore = useAuthStore();

// 狀態
const isLoading = ref(false);
const currentTab = ref("my-leaves");
const isRequestDialogOpen = ref(false);
const preselectedTypeId = ref<number | undefined>();

// 資料
const balances = ref<LeaveBalance[]>([]);
const leaveTypes = ref<LeaveType[]>([]);
const myRequests = ref<LeaveRequest[]>([]);
const allRequests = ref<LeaveRequest[]>([]);

// 標籤頁配置
const tabs = computed(() => [
  {
    value: "my-leaves",
    label: "leaves.tabs.myLeaves",
    count: null,
  },
  {
    value: "approvals",
    label: "leaves.tabs.approvals",
    count: allRequests.value.filter((r: LeaveRequest) => r.status === "pending")
      .length,
  },
  {
    value: "calendar",
    label: "leaves.tabs.calendar",
    count: null,
  },
]);

// 載入資料
const loadData = async () => {
  isLoading.value = true;
  try {
    const restaurantId = authStore.restaurantId;
    if (!restaurantId) return;

    // 載入請假類型
    const typesResponse = await api.get<LeaveType[]>(
      `/leaves/${restaurantId}/types`,
    );
    if (typesResponse.data?.data) {
      leaveTypes.value = typesResponse.data.data;
    }

    // 載入我的餘額
    const userId = authStore.user?.id;
    if (userId) {
      const balancesResponse = await api.get<LeaveBalance[]>(
        `/leaves/balances`,
        { employeeId: userId, year: new Date().getFullYear() },
      );
      if (balancesResponse.data?.data) {
        balances.value = balancesResponse.data.data;
      }
    }

    // 載入請假申請
    const role = authStore.user?.role;
    const isManager = role === 0 || role === 1;

    if (isManager) {
      // 管理者：分別載入自己的和所有員工的申請
      const [myRes, allRes] = await Promise.all([
        api.get<LeaveRequest[]>(`/leaves/${restaurantId}/requests`, {
          employeeId: userId,
        }),
        api.get<LeaveRequest[]>(`/leaves/${restaurantId}/requests`),
      ]);
      if (myRes.data?.data) {
        myRequests.value = myRes.data.data;
      }
      if (allRes.data?.data) {
        allRequests.value = allRes.data.data;
      }
    } else {
      // 一般員工：只載入自己的申請
      const myRequestsResponse = await api.get<LeaveRequest[]>(
        `/leaves/${restaurantId}/requests`,
      );
      if (myRequestsResponse.data?.data) {
        myRequests.value = myRequestsResponse.data.data;
      }
    }
  } catch (error) {
    console.error("Failed to load leave data:", error);
  } finally {
    isLoading.value = false;
  }
};

// 開啟請假申請對話框
const openRequestDialog = () => {
  preselectedTypeId.value = undefined;
  isRequestDialogOpen.value = true;
};

// 關閉請假申請對話框
const closeRequestDialog = () => {
  isRequestDialogOpen.value = false;
  preselectedTypeId.value = undefined;
};

// 處理請假申請
// The balance card emits its balance's embedded leave type, which is the
// join's projection rather than a whole row (#330).
const handleRequestLeave = (leaveType: LeaveTypeBalanceSummary | undefined) => {
  if (!leaveType) return;
  preselectedTypeId.value = leaveType.id;
  isRequestDialogOpen.value = true;
};

// 提交請假申請
const handleSubmitRequest = async (formData: LeaveRequestFormData) => {
  try {
    const restaurantId = authStore.restaurantId;
    if (!restaurantId) return;

    await api.post(`/leaves/${restaurantId}/requests`, {
      ...formData,
      employeeId: authStore.user?.id,
    });
    await loadData();
    closeRequestDialog();
    toast.success(t("leaveActions.submitSuccess"));
  } catch (error) {
    console.error("Failed to submit leave request:", error);
    toast.error(t("leaveActions.submitFailed"));
  }
};

// 取消請假申請
const handleCancelRequest = async (requestId: number) => {
  const confirmed = await confirmModal({
    type: "danger",
    title: t("leaveActions.cancelConfirm"),
    message: t("leaveActions.cancelConfirm"),
    confirmLabel: t("common.cancel"),
  });
  if (!confirmed) return;

  try {
    const restaurantId = authStore.restaurantId;
    if (!restaurantId) return;

    const reason = prompt(
      t("leaveActions.cancelReasonPrompt") || "請輸入取消原因",
    );
    if (!reason) return;

    await api.post(`/leaves/requests/${requestId}/cancel`, {
      userId: authStore.user?.id,
      reason,
    });
    await loadData();
    toast.success(t("leaveActions.cancelSuccess"));
  } catch (error) {
    console.error("Failed to cancel request:", error);
    toast.error(t("leaveActions.cancelFailed"));
  }
};

// 批准請假申請
const handleApproveRequest = async (requestId: number) => {
  const confirmed = await confirmModal({
    type: "warning",
    title: t("leaveActions.approveConfirm"),
    message: t("leaveActions.approveConfirm"),
    confirmLabel: t("leaveActions.approve"),
  });
  if (!confirmed) return;

  try {
    const restaurantId = authStore.restaurantId;
    if (!restaurantId) return;

    await api.post(`/leaves/requests/${requestId}/approve`, {
      approverId: authStore.user?.id,
    });
    await loadData();
    toast.success(t("leaveActions.approveSuccess"));
  } catch (error) {
    console.error("Failed to approve request:", error);
    toast.error(t("leaveActions.approveFailed"));
  }
};

// 拒絕請假申請
const handleRejectRequest = async (requestId: number) => {
  const reason = prompt(t("leaveActions.rejectPrompt"));
  if (!reason) return;

  try {
    const restaurantId = authStore.restaurantId;
    if (!restaurantId) return;

    await api.post(`/leaves/requests/${requestId}/reject`, {
      approverId: authStore.user?.id,
      reason,
    });
    await loadData();
    toast.success(t("leaveActions.rejectSuccess"));
  } catch (error) {
    console.error("Failed to reject request:", error);
    toast.error(t("leaveActions.rejectFailed"));
  }
};

// 查看詳情
const handleViewDetails = (requestId: number) => {
  router.push(`/dashboard/leaves/${requestId}`);
};

// 初始化
onMounted(() => {
  loadData();
});
</script>

<style scoped>
.leave-view {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
}

.page-title {
  font-size: 32px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.page-subtitle {
  font-size: 16px;
  color: #6b7280;
  margin: 0;
}

.btn-request-leave {
  padding: 12px 24px;
  background: #007aff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-request-leave:hover {
  background: #2563eb;
}

.btn-request-leave .icon {
  width: 20px;
  height: 20px;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  border-bottom: 2px solid #e5e7eb;
}

.tab {
  padding: 12px 24px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: -2px;
}

.tab:hover {
  color: #007aff;
}

.tab.active {
  color: #007aff;
  border-bottom-color: #007aff;
}

.tab-count {
  padding: 2px 8px;
  background: #ff3b30;
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.tab-content {
  min-height: 400px;
}

.balances-section,
.requests-section,
.approvals-section,
.calendar-section {
  margin-bottom: 40px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 20px 0;
}

.balance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: #007aff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .leave-view {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    gap: 16px;
  }

  .btn-request-leave {
    width: 100%;
    justify-content: center;
  }

  .tabs {
    overflow-x: auto;
  }

  .tab {
    flex-shrink: 0;
  }

  .balance-grid {
    grid-template-columns: 1fr;
  }
}
</style>
