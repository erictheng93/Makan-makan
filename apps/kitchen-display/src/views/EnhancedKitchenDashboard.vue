<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Kitchen Header -->
    <KitchenHeader
      :restaurant-name="restaurantName"
      :current-time="currentTime"
      :stats="stats"
      :connection-status="connectionStatus"
      :is-connected="isConnected"
      @logout="handleLogout"
      @refresh="handleRefresh"
      @reconnect="reconnectSSE"
      @toggle-fullscreen="toggleFullscreen"
    />

    <!-- Main Content -->
    <main class="container mx-auto px-4 py-6">
      <!-- Stats Bar -->
      <div class="mb-6">
        <OrderStats
          :stats="stats"
          :loading="isLoading"
          @refresh="handleRefresh"
        />
      </div>

      <!-- Priority and Timing Management -->
      <PriorityTimingManager
        :orders="filteredOrders"
        @priority-updated="handlePriorityUpdate"
        @thresholds-updated="handleThresholdsUpdate"
      />

      <!-- Batch Operations -->
      <BatchOperations
        :orders="filteredOrders"
        :pending-orders="filteredPendingOrders"
        :preparing-orders="filteredPreparingOrders"
        :ready-orders="filteredReadyOrders"
        @batch-start-cooking="handleBatchStartCooking"
        @batch-mark-ready="handleBatchMarkReady"
        @batch-priority-update="handleBatchPriorityUpdate"
        @batch-export="handleBatchExport"
      />

      <!-- View Toggle -->
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <span class="text-sm font-medium text-gray-700">顯示模式：</span>
          <div class="flex bg-white border border-gray-300 rounded-lg">
            <button
              :class="[
                'px-4 py-2 text-sm font-medium rounded-l-lg transition-colors',
                viewMode === 'dragdrop'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50',
              ]"
              @click="setViewMode('dragdrop')"
            >
              拖拽模式
            </button>
            <button
              :class="[
                'px-4 py-2 text-sm font-medium rounded-r-lg border-l border-gray-300 transition-colors',
                viewMode === 'traditional'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50',
              ]"
              @click="setViewMode('traditional')"
            >
              傳統模式
            </button>
          </div>
        </div>

        <!-- Filter Toggle -->
        <OrderFilters
          v-if="showFilters"
          :orders="orders"
          :filtered-count="filteredOrders.length"
        />

        <button
          class="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          @click="showFilters = !showFilters"
        >
          <FunnelIcon class="w-4 h-4" />
          <span class="text-sm font-medium">篩選</span>
        </button>
      </div>

      <!-- Drag and Drop Board (New Mode) -->
      <DragDropOrderBoard
        v-if="viewMode === 'dragdrop'"
        :pending-orders="filteredPendingOrders"
        :preparing-orders="filteredPreparingOrders"
        :ready-orders="filteredReadyOrders"
        @start-cooking="handleStartCooking"
        @mark-ready="handleMarkReady"
        @view-details="handleViewDetails"
        @order-status-changed="handleOrderStatusChanged"
        @batch-start-order="handleBatchStartOrder"
        @batch-complete-order="handleBatchCompleteOrder"
      />

      <!-- Traditional Orders Grid (Original Mode) -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Pending Orders -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold text-gray-900 flex items-center">
              <ClockIcon class="w-6 h-6 mr-2 text-yellow-500" />
              待處理訂單
              <span
                class="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-sm"
              >
                {{ filteredPendingOrders.length }}
              </span>
            </h2>
          </div>

          <div class="space-y-3 max-h-96 overflow-y-auto">
            <OrderCard
              v-for="order in filteredPendingOrders"
              :key="order.id"
              :order="order"
              status-type="pending"
              @start-cooking="handleStartCooking"
              @mark-ready="handleMarkReady"
              @view-details="handleViewDetails"
            />

            <div
              v-if="filteredPendingOrders.length === 0"
              class="text-center py-8 text-gray-500"
            >
              <ClockIcon class="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>目前沒有待處理的訂單</p>
            </div>
          </div>
        </div>

        <!-- Preparing Orders -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold text-gray-900 flex items-center">
              <FireIcon class="w-6 h-6 mr-2 text-blue-500" />
              製作中訂單
              <span
                class="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm"
              >
                {{ filteredPreparingOrders.length }}
              </span>
            </h2>
          </div>

          <div class="space-y-3 max-h-96 overflow-y-auto">
            <OrderCard
              v-for="order in filteredPreparingOrders"
              :key="order.id"
              :order="order"
              status-type="preparing"
              @start-cooking="handleStartCooking"
              @mark-ready="handleMarkReady"
              @view-details="handleViewDetails"
            />

            <div
              v-if="filteredPreparingOrders.length === 0"
              class="text-center py-8 text-gray-500"
            >
              <FireIcon class="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>目前沒有正在製作的訂單</p>
            </div>
          </div>
        </div>

        <!-- Ready Orders -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold text-gray-900 flex items-center">
              <CheckCircleIcon class="w-6 h-6 mr-2 text-green-500" />
              準備完成
              <span
                class="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm"
              >
                {{ filteredReadyOrders.length }}
              </span>
            </h2>
          </div>

          <div class="space-y-3 max-h-96 overflow-y-auto">
            <OrderCard
              v-for="order in filteredReadyOrders"
              :key="order.id"
              :order="order"
              status-type="ready"
              @start-cooking="handleStartCooking"
              @mark-ready="handleMarkReady"
              @view-details="handleViewDetails"
            />

            <div
              v-if="filteredReadyOrders.length === 0"
              class="text-center py-8 text-gray-500"
            >
              <CheckCircleIcon class="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>目前沒有準備完成的訂單</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading Overlay -->
      <div
        v-if="isLoading && orders.length === 0"
        class="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50"
      >
        <div class="text-center">
          <div class="loading-spinner w-12 h-12 mx-auto mb-4" />
          <p class="text-lg text-gray-600">載入廚房訂單中...</p>
        </div>
      </div>
    </main>

    <!-- Order Details Modal -->
    <OrderDetailsModal
      v-if="selectedOrder"
      :order="selectedOrder"
      :show="showDetailsModal"
      @close="showDetailsModal = false"
      @update-status="handleUpdateOrderStatus"
    />

    <!-- Connection Status Monitor -->
    <ConnectionStatus
      :connection-status="connectionStatus"
      :is-connected="isConnected"
      :reconnect-attempts="reconnectAttempts"
      :last-heartbeat="lastHeartbeat"
      @reconnect="reconnectSSE"
      @refresh="handleRefresh"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import {
  ClockIcon,
  FireIcon,
  CheckCircleIcon,
  FunnelIcon,
} from "@heroicons/vue/24/outline";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { useOrdersStore } from "@/stores/orders";
import { useOrderManagementStore } from "@/stores/orderManagement";
import { useKitchenSSE } from "@/composables/useKitchenSSE";
import type { KitchenOrder } from "@/types";

// Components
import KitchenHeader from "@/components/layout/KitchenHeader.vue";
import OrderStats from "@/components/stats/OrderStats.vue";
import OrderCard from "@/components/orders/OrderCard.vue";
import OrderFilters from "@/components/orders/OrderFilters.vue";
import PriorityTimingManager from "@/components/orders/PriorityTimingManager.vue";
import BatchOperations from "@/components/orders/BatchOperations.vue";
import DragDropOrderBoard from "@/components/orders/DragDropOrderBoard.vue";
import OrderDetailsModal from "@/components/orders/OrderDetailsModal.vue";
import ConnectionStatus from "@/components/common/ConnectionStatus.vue";

// Props
const props = defineProps<{
  restaurantId: number;
}>();

// Composables
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const ordersStore = useOrdersStore();
const orderManagementStore = useOrderManagementStore();

// SSE 連接
const {
  connectionStatus,
  isConnected,
  lastHeartbeat,
  reconnectAttempts,
  connect: _connectSSE,
  disconnect: _disconnectSSE,
  reconnect: reconnectSSE,
} = useKitchenSSE({
  restaurantId: props.restaurantId,
  onNewOrder: (event) => {
    console.log("New order received via SSE:", event);
    ordersStore.handleSSEEvent(event);
  },
  onOrderUpdate: (event) => {
    console.log("Order update received via SSE:", event);
    ordersStore.handleSSEEvent(event);
  },
  onOrderCancelled: (event) => {
    console.log("Order cancelled received via SSE:", event);
    ordersStore.handleSSEEvent(event);
  },
  onPriorityUpdate: (event) => {
    console.log("Priority update received via SSE:", event);
    ordersStore.handleSSEEvent(event);
  },
  autoConnect: true,
});

// State
const currentTime = ref(new Date());
const selectedOrder = ref<KitchenOrder | null>(null);
const showDetailsModal = ref(false);
const showFilters = ref(false);
const viewMode = ref<"dragdrop" | "traditional">("dragdrop");

// Computed
const restaurantName = computed(() => authStore.user?.name || "廚房系統");

// 使用 store 中的 computed 值
const {
  orders,
  stats,
  loading: isLoading,
  error: ordersError,
} = storeToRefs(ordersStore);

// Order Management Store
const { filterOrders, sortOrders, updateOrderPriorities } =
  orderManagementStore;

// Filtered orders based on management store filters
const filteredOrders = computed(() => {
  let filtered = filterOrders(orders.value);
  filtered = sortOrders(filtered);
  return updateOrderPriorities(filtered);
});

const filteredPendingOrders = computed(() =>
  filteredOrders.value.filter((order) => order.status === 1),
);

const filteredPreparingOrders = computed(() =>
  filteredOrders.value.filter((order) => order.status === 2),
);

const filteredReadyOrders = computed(() =>
  filteredOrders.value.filter((order) => order.status === 3),
);

// Methods
const setViewMode = (mode: "dragdrop" | "traditional") => {
  viewMode.value = mode;
  // Save preference to localStorage
  localStorage.setItem("kitchen-view-mode", mode);
};

const fetchOrders = async () => {
  try {
    await ordersStore.fetchOrders(props.restaurantId);

    if (ordersError.value) {
      toast.error("載入訂單失敗：" + ordersError.value);
    }
  } catch (error: any) {
    console.error("Failed to fetch orders:", error);
    toast.error("載入訂單失敗：" + error.message);
  }
};

const handleStartCooking = async (orderId: number, itemId: number) => {
  try {
    await ordersStore.startCooking(props.restaurantId, orderId, itemId);
    toast.success("開始製作！");
  } catch (error: any) {
    toast.error("操作失敗：" + error.message);
  }
};

const handleMarkReady = async (orderId: number, itemId: number) => {
  try {
    await ordersStore.markReady(props.restaurantId, orderId, itemId);
    toast.success("餐點已完成！");
  } catch (error: any) {
    toast.error("操作失敗：" + error.message);
  }
};

const handleViewDetails = (order: KitchenOrder) => {
  selectedOrder.value = order;
  showDetailsModal.value = true;
};

const handleOrderStatusChanged = async (
  _orderId: number,
  _newStatus: "pending" | "preparing" | "ready",
) => {
  try {
    // This would call the actual API to update order status
    // For now, we'll refresh the orders to get the latest state
    await fetchOrders();
  } catch (error: any) {
    toast.error("狀態更新失敗：" + error.message);
  }
};

const handleBatchStartOrder = async (orderId: number) => {
  try {
    const order = orders.value.find((o) => o.id === orderId);
    if (!order) return;

    // Start all pending items in the order
    for (const item of order.items) {
      if (item.status === "pending") {
        await ordersStore.startCooking(props.restaurantId, orderId, item.id);
      }
    }

    await fetchOrders();
  } catch (error: any) {
    toast.error("批量開始製作失敗：" + error.message);
  }
};

const handleBatchCompleteOrder = async (orderId: number) => {
  try {
    const order = orders.value.find((o) => o.id === orderId);
    if (!order) return;

    // Complete all preparing items in the order
    for (const item of order.items) {
      if (item.status === "preparing") {
        await ordersStore.markReady(props.restaurantId, orderId, item.id);
      }
    }

    await fetchOrders();
  } catch (error: any) {
    toast.error("批量完成製作失敗：" + error.message);
  }
};

const handleBatchStartCooking = async (orderIds: number[]) => {
  try {
    for (const orderId of orderIds) {
      const order = orders.value.find((o) => o.id === orderId);
      if (!order) continue;

      // Start all pending items in each order
      for (const item of order.items) {
        if (item.status === "pending") {
          await ordersStore.startCooking(props.restaurantId, orderId, item.id);
        }
      }
    }

    await fetchOrders();
    toast.success(`已批量開始製作 ${orderIds.length} 個訂單！`);
  } catch (error: any) {
    toast.error("批量開始製作失敗：" + error.message);
  }
};

const handleBatchMarkReady = async (orderIds: number[]) => {
  try {
    for (const orderId of orderIds) {
      const order = orders.value.find((o) => o.id === orderId);
      if (!order) continue;

      // Mark all preparing items as ready in each order
      for (const item of order.items) {
        if (item.status === "preparing") {
          await ordersStore.markReady(props.restaurantId, orderId, item.id);
        }
      }
    }

    await fetchOrders();
    toast.success(`已批量完成 ${orderIds.length} 個訂單！`);
  } catch (error: any) {
    toast.error("批量標記完成失敗：" + error.message);
  }
};

const handleBatchPriorityUpdate = async (
  orderIds: number[],
  priority: string,
) => {
  try {
    // This would call API to update order priorities
    // For now, just show success message
    await fetchOrders();

    const priorityText = { urgent: "緊急", high: "重要", normal: "普通" }[
      priority
    ];
    toast.success(`已將 ${orderIds.length} 個訂單設為${priorityText}優先級！`);
  } catch (error: any) {
    toast.error("批量調整優先級失敗：" + error.message);
  }
};

const handleBatchExport = async (orderIds: number[]) => {
  try {
    const selectedOrders = orders.value.filter((order) =>
      orderIds.includes(order.id),
    );

    // Create CSV content
    const csvHeaders = [
      "訂單號",
      "桌號",
      "顧客姓名",
      "狀態",
      "優先級",
      "項目",
      "備註",
      "建立時間",
    ];
    const csvRows = selectedOrders.flatMap((order) =>
      order.items.map((item) => [
        order.orderNumber,
        order.tableName,
        order.customerName || "",
        order.status === 1
          ? "已確認"
          : order.status === 2
            ? "製作中"
            : "準備完成",
        order.priority === "urgent"
          ? "緊急"
          : order.priority === "high"
            ? "重要"
            : "普通",
        `${item.name} x${item.quantity}`,
        order.notes || "",
        new Date(order.createdAt).toLocaleString("zh-TW"),
      ]),
    );

    const csvContent = [csvHeaders, ...csvRows]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    // Download CSV file
    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `廚房訂單_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast.success(`已導出 ${orderIds.length} 個訂單的數據！`);
  } catch (error: any) {
    toast.error("導出失敗：" + error.message);
  }
};

const handlePriorityUpdate = async (orderId: number, priority: string) => {
  try {
    // This would call API to update order priority
    // For now, just refresh orders to simulate the update
    await fetchOrders();

    const priorityText = { urgent: "緊急", high: "重要", normal: "普通" }[
      priority
    ];
    toast.success(`訂單 ${orderId} 已設為${priorityText}優先級！`);
  } catch (error: any) {
    toast.error("更新優先級失敗：" + error.message);
  }
};

const handleThresholdsUpdate = async (
  warningThreshold: number,
  urgentThreshold: number,
) => {
  try {
    // Update settings store
    settingsStore.updateSetting("warningThreshold", warningThreshold);
    settingsStore.updateSetting("urgentThreshold", urgentThreshold);

    toast.success("時間閾值設置已更新！");
  } catch (error: any) {
    toast.error("更新設置失敗：" + error.message);
  }
};

const handleUpdateOrderStatus = async (_orderId: number, _status: any) => {
  try {
    await fetchOrders();
    showDetailsModal.value = false;
  } catch (error: any) {
    toast.error("更新狀態失敗：" + error.message);
  }
};

const handleLogout = async () => {
  try {
    await authStore.logout();
    await router.push("/login");
    toast.success("已登出");
  } catch (error: any) {
    toast.error("登出失敗：" + error.message);
  }
};

const handleRefresh = async () => {
  await fetchOrders();
};

const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
};

const updateCurrentTime = () => {
  currentTime.value = new Date();
};

// Auto-refresh logic
let refreshInterval: NodeJS.Timeout | null = null;

const startAutoRefresh = () => {
  if (settingsStore.autoRefresh && refreshInterval === null) {
    refreshInterval = setInterval(() => {
      fetchOrders();
    }, settingsStore.refreshInterval * 1000);
  }
};

const stopAutoRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
};

// Lifecycle
onMounted(async () => {
  // Check authentication
  if (!authStore.isAuthenticated || !authStore.isChef) {
    await router.push("/login");
    return;
  }

  // Check restaurant permissions
  if (authStore.restaurantId !== props.restaurantId) {
    await router.push("/unauthorized");
    return;
  }

  // Load saved view mode preference
  const savedViewMode = localStorage.getItem("kitchen-view-mode");
  if (savedViewMode === "traditional" || savedViewMode === "dragdrop") {
    viewMode.value = savedViewMode;
  }

  // Initial load
  await fetchOrders();

  // Start auto-refresh
  startAutoRefresh();

  // Start time updates
  const timeInterval = setInterval(updateCurrentTime, 1000);

  // Cleanup function
  onUnmounted(() => {
    stopAutoRefresh();
    clearInterval(timeInterval);
  });
});
</script>

<style scoped>
.loading-spinner {
  border: 4px solid #f3f4f6;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
