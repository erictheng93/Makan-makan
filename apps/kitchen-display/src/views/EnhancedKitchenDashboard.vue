<template>
  <div class="bg-ios-bg min-h-screen">
    <!-- Kitchen Header (fixed top) -->
    <KitchenHeader
      :restaurant-name="restaurantName"
      :current-time="currentTime"
      :stats="stats"
      :connection-status="connectionStatus"
      :is-connected="isConnected"
      :view-mode="viewMode"
      @logout="handleLogout"
      @refresh="handleRefresh"
      @reconnect="reconnectSSE"
      @toggle-fullscreen="toggleFullscreen"
      @open-settings="handleOpenSettings"
      @update:view-mode="setViewMode"
    />

    <!-- Main Content (offset for fixed header) -->
    <main class="pt-20 px-5 pb-6">
      <!-- Stats Bar -->
      <div class="mb-5">
        <OrderStats
          :stats="stats"
          :loading="isLoading"
          @refresh="handleRefresh"
        />
      </div>

      <!-- Kanban Mode: KanbanBoard -->
      <KanbanBoard
        v-if="viewMode === 'kanban'"
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

      <!-- Grid Mode: Filters + Responsive Card Grid -->
      <template v-else>
        <div class="mb-4">
          <OrderFilters
            :orders="orders"
            :filtered-count="filteredOrders.length"
          />
        </div>

        <!-- Empty State -->
        <div
          v-if="filteredOrders.length === 0 && !isLoading"
          class="flex flex-col items-center justify-center py-20 text-center"
        >
          <div
            class="w-16 h-16 bg-white rounded-full shadow-card flex items-center justify-center mb-4"
          >
            <ClipboardList class="w-8 h-8 text-ios-secondary" />
          </div>
          <p class="text-ios-text font-semibold text-lg mb-1">目前沒有訂單</p>
          <p class="text-ios-secondary text-sm">新訂單將在這裡顯示</p>
        </div>

        <!-- Order Cards Grid -->
        <div
          v-else
          class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3"
        >
          <OrderCard
            v-for="order in filteredOrders"
            :key="order.id"
            :order="order"
            :status-type="getOrderStatusType(order.status)"
            @start-cooking="handleStartCooking"
            @mark-ready="handleMarkReady"
            @view-details="handleViewDetails"
          />
        </div>
      </template>

      <!-- Loading Overlay -->
      <div
        v-if="isLoading && orders.length === 0"
        class="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50"
      >
        <div class="text-center">
          <div class="loading-spinner w-12 h-12 mx-auto mb-4" />
          <p class="text-base font-medium text-ios-secondary">
            載入廚房訂單中…
          </p>
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
import { ClipboardList } from "lucide-vue-next";
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
import KanbanBoard from "@/components/orders/KanbanBoard.vue";
import OrderDetailsModal from "@/components/orders/OrderDetailsModal.vue";
import ConnectionStatus from "@/components/common/ConnectionStatus.vue";

// Props
const props = defineProps<{
  restaurantId: string;
}>();

// Numeric restaurantId (router params are always strings)
// restaurantId is a UUID string — keep as string for comparison
const restaurantIdNum = computed(() => props.restaurantId);

// Composables
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const ordersStore = useOrdersStore();
const orderManagementStore = useOrderManagementStore();

// SSE connection
const {
  connectionStatus,
  isConnected,
  lastHeartbeat,
  reconnectAttempts,
  connect: _connectSSE,
  disconnect: _disconnectSSE,
  reconnect: reconnectSSE,
} = useKitchenSSE({
  restaurantId: restaurantIdNum.value,
  onNewOrder: (event) => {
    ordersStore.handleSSEEvent(event);
  },
  onOrderUpdate: (event) => {
    ordersStore.handleSSEEvent(event);
  },
  onOrderCancelled: (event) => {
    ordersStore.handleSSEEvent(event);
  },
  onPriorityUpdate: (event) => {
    ordersStore.handleSSEEvent(event);
  },
  autoConnect: true,
});

// State
const currentTime = ref(new Date());
const selectedOrder = ref<KitchenOrder | null>(null);
const showDetailsModal = ref(false);
const viewMode = ref<"kanban" | "grid">("kanban");

// Computed
const restaurantName = computed(() => authStore.user?.name || "廚房系統");

const {
  orders,
  stats,
  loading: isLoading,
  error: ordersError,
} = storeToRefs(ordersStore);

const { filterOrders, sortOrders, updateOrderPriorities } =
  orderManagementStore;

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

// Helpers
const getOrderStatusType = (
  status: number,
): "pending" | "preparing" | "ready" => {
  if (status === 2) return "preparing";
  if (status === 3) return "ready";
  return "pending";
};

// Methods
const setViewMode = (mode: "kanban" | "grid") => {
  viewMode.value = mode;
  localStorage.setItem("kitchen-view-mode", mode);
};

const fetchOrders = async () => {
  try {
    await ordersStore.fetchOrders(restaurantIdNum.value);
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
    await ordersStore.startCooking(restaurantIdNum.value, orderId, itemId);
    toast.success("開始製作！");
  } catch (error: any) {
    toast.error("操作失敗：" + error.message);
  }
};

const handleMarkReady = async (orderId: number, itemId: number) => {
  try {
    await ordersStore.markReady(restaurantIdNum.value, orderId, itemId);
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
    await fetchOrders();
  } catch (error: any) {
    toast.error("狀態更新失敗：" + error.message);
  }
};

const handleBatchStartOrder = async (orderId: number) => {
  try {
    const order = orders.value.find((o) => o.id === orderId);
    if (!order) return;
    for (const item of order.items) {
      if (item.status === "pending") {
        await ordersStore.startCooking(restaurantIdNum.value, orderId, item.id);
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
    for (const item of order.items) {
      if (item.status === "preparing") {
        await ordersStore.markReady(restaurantIdNum.value, orderId, item.id);
      }
    }
    await fetchOrders();
  } catch (error: any) {
    toast.error("批量完成製作失敗：" + error.message);
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

const handleOpenSettings = async () => {
  await router.push("/settings");
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
let refreshInterval: ReturnType<typeof setInterval> | null = null;

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
  if (authStore.restaurantId !== restaurantIdNum.value) {
    await router.push("/unauthorized");
    return;
  }

  // Load saved view mode preference
  const savedViewMode = localStorage.getItem("kitchen-view-mode");
  if (savedViewMode === "kanban" || savedViewMode === "grid") {
    viewMode.value = savedViewMode;
  }

  // Initial load
  await fetchOrders();

  // Start auto-refresh
  startAutoRefresh();

  // Start time updates
  const timeInterval = setInterval(updateCurrentTime, 1000);

  // Cleanup
  onUnmounted(() => {
    stopAutoRefresh();
    clearInterval(timeInterval);
  });
});
</script>

<style scoped>
.loading-spinner {
  border: 3px solid #f2f2f7;
  border-top: 3px solid #007aff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
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
