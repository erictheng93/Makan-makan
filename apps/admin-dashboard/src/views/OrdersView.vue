<template>
  <div class="orders-view">
    <!-- 訂單統計卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-yellow-100 rounded-lg">
            <ClockIcon class="h-6 w-6 text-yellow-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">待確認</h3>
            <p class="text-2xl font-bold text-yellow-600">
              {{ stats.pending }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-blue-100 rounded-lg">
            <CookingPotIcon class="h-6 w-6 text-blue-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">製作中</h3>
            <p class="text-2xl font-bold text-blue-600">
              {{ stats.preparing }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 rounded-lg">
            <CheckCircleIcon class="h-6 w-6 text-green-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">已完成</h3>
            <p class="text-2xl font-bold text-green-600">
              {{ stats.completed }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-red-100 rounded-lg">
            <XCircleIcon class="h-6 w-6 text-red-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">已取消</h3>
            <p class="text-2xl font-bold text-red-600">
              {{ stats.cancelled }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 訂單篩選和搜索 -->
    <div class="bg-white rounded-lg shadow mb-6">
      <div class="p-6">
        <div
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div class="flex flex-col sm:flex-row gap-4">
            <div class="relative">
              <MagnifyingGlassIcon
                class="absolute left-3 top-3 h-4 w-4 text-gray-400"
              />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索訂單編號或客戶姓名"
                class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <select
              v-model="statusFilter"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">所有狀態</option>
              <option value="pending">待確認</option>
              <option value="confirmed">已確認</option>
              <option value="preparing">製作中</option>
              <option value="ready">待取餐</option>
              <option value="served">已送達</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>

            <select
              v-model="typeFilter"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">所有類型</option>
              <option value="dine_in">內用</option>
              <option value="takeaway">外帶</option>
              <option value="delivery">外送</option>
            </select>
          </div>

          <button
            class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            @click="refreshOrders"
          >
            <ArrowPathIcon class="h-4 w-4 mr-2" />
            刷新
          </button>
        </div>
      </div>
    </div>

    <!-- 訂單列表 -->
    <div class="bg-white rounded-lg shadow">
      <div class="p-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-6">訂單列表</h2>

        <!-- 表格標題 -->
        <div
          class="grid grid-cols-8 gap-4 px-6 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider mb-4 rounded-t-lg"
        >
          <div>訂單編號</div>
          <div>桌號</div>
          <div>客戶</div>
          <div>類型</div>
          <div>狀態</div>
          <div>總金額</div>
          <div>下單時間</div>
          <div>操作</div>
        </div>

        <!-- 簡化的訂單列表 (不使用虛擬滾動以避免TypeScript類型問題) -->
        <div
          v-if="filteredOrders.length > 0"
          class="max-h-[500px] overflow-y-auto"
        >
          <div
            v-for="order in filteredOrders"
            :key="order.id"
            class="grid grid-cols-8 gap-4 px-6 py-4 hover:bg-gray-50 border-b border-gray-200 items-center"
          >
            <div class="text-sm font-medium text-gray-900">
              {{ getOrderNumber(order) }}
            </div>
            <div class="text-sm text-gray-500">
              {{ getTableNumber(order) }}
            </div>
            <div class="text-sm text-gray-500">
              {{ getCustomerName(order) }}
            </div>
            <div>
              <span
                :class="getTypeClass(getOrderType(order))"
                class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
              >
                {{ getTypeText(getOrderType(order)) }}
              </span>
            </div>
            <div>
              <span
                :class="getStatusClass(order.status)"
                class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
              >
                {{ getStatusText(order.status) }}
              </span>
            </div>
            <div class="text-sm text-gray-500">RM{{ order.totalAmount }}</div>
            <div class="text-sm text-gray-500">
              {{ formatDateTime(order.createdAt) }}
            </div>
            <div class="text-sm font-medium">
              <div class="flex items-center space-x-2">
                <button
                  class="text-blue-600 hover:text-blue-900"
                  @click="viewOrderDetails(order)"
                >
                  查看
                </button>
                <button
                  v-if="canUpdateStatus(order.status)"
                  class="text-green-600 hover:text-green-900"
                  @click="updateOrderStatus(order)"
                >
                  更新
                </button>
                <button
                  v-if="canCancel(order.status)"
                  class="text-red-600 hover:text-red-900"
                  @click="cancelOrder(order)"
                >
                  取消
                </button>
              </div>
            </div>
          </div>

          <!-- 載入更多按鈕 -->
          <div v-if="hasMore" class="p-4 text-center">
            <button
              :disabled="isLoading"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              @click="loadMoreOrders"
            >
              <span v-if="isLoading">載入中...</span>
              <span v-else>載入更多</span>
            </button>
          </div>
        </div>

        <!-- 空狀態 -->
        <div v-if="filteredOrders.length === 0" class="text-center py-12">
          <ShoppingBagIcon class="mx-auto h-12 w-12 text-gray-400" />
          <h3 class="mt-2 text-sm font-medium text-gray-900">暫無訂單</h3>
          <p class="mt-1 text-sm text-gray-500">等待客戶下單</p>
        </div>
      </div>
    </div>

    <!-- 訂單詳情模態框 -->
    <div v-if="selectedOrder" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="selectedOrder = null"
        />
        <div class="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold">
                訂單詳情 - {{ getOrderNumber(selectedOrder) }}
              </h3>
              <button
                class="text-gray-400 hover:text-gray-600"
                @click="selectedOrder = null"
              >
                <XMarkIcon class="h-6 w-6" />
              </button>
            </div>

            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700"
                    >桌號</label
                  >
                  <p class="text-sm text-gray-900">
                    {{ getTableNumber(selectedOrder) }}
                  </p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700"
                    >客戶姓名</label
                  >
                  <p class="text-sm text-gray-900">
                    {{ getCustomerName(selectedOrder) }}
                  </p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700"
                    >訂單類型</label
                  >
                  <p class="text-sm text-gray-900">
                    {{ getTypeText(getOrderType(selectedOrder)) }}
                  </p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700"
                    >訂單狀態</label
                  >
                  <p class="text-sm text-gray-900">
                    {{ getStatusText(selectedOrder.status) }}
                  </p>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"
                  >訂單項目</label
                >
                <div class="border rounded-lg divide-y">
                  <div
                    v-for="item in selectedOrder.items"
                    :key="item.id"
                    class="p-3"
                  >
                    <div class="flex justify-between">
                      <div>
                        <p class="font-medium">
                          {{ getMenuItemName(item) }}
                        </p>
                        <p class="text-sm text-gray-500">
                          數量: {{ item.quantity }}
                        </p>
                      </div>
                      <p class="font-medium">RM{{ getItemTotalPrice(item) }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="border-t pt-4">
                <div class="flex justify-between text-lg font-semibold">
                  <span>總金額</span>
                  <span>RM{{ selectedOrder.totalAmount }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useOrderStore } from "@/stores/order";
import type { Order } from "@/types";
import { OrderStatus } from "@/types";
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ShoppingBagIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";
import { CookingPotIcon } from "@heroicons/vue/24/solid";

const orderStore = useOrderStore();

// 響應式數據
const searchQuery = ref("");
const statusFilter = ref("");
const typeFilter = ref("");
const selectedOrder = ref<Order | null>(null);
const isLoading = ref(false);
const hasMore = ref(false);
const currentPage = ref(1);
const pageSize = ref(50);

// Helper functions for missing properties
const getOrderNumber = (order: Order) =>
  `ORD-${order.id.toString().padStart(6, "0")}`;
const getTableNumber = (order: Order) =>
  order.tableId ? `T${order.tableId.toString().padStart(2, "0")}` : "外帶";
const getCustomerName = (order: Order) => order.customerInfo?.name || "客人";
const getOrderType = (order: Order) => (order.tableId ? "dine_in" : "takeaway");
const getMenuItemName = (item: any) => `菜品 #${item.menuItemId}`; // In real app, would lookup from menu
const getItemTotalPrice = (item: any) =>
  (item.unitPrice * item.quantity).toFixed(2);

// 計算屬性
const stats = computed(() => ({
  pending: orderStore.orders.filter((o) => o.status === OrderStatus.PENDING)
    .length,
  preparing: orderStore.orders.filter((o) =>
    [OrderStatus.CONFIRMED, OrderStatus.PREPARING].includes(o.status),
  ).length,
  completed: orderStore.orders.filter((o) => o.status === OrderStatus.COMPLETED)
    .length,
  cancelled: orderStore.orders.filter((o) => o.status === OrderStatus.CANCELLED)
    .length,
}));

const filteredOrders = computed(() => {
  let filtered = [...orderStore.orders] as Order[];

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (order) =>
        getOrderNumber(order).toLowerCase().includes(query) ||
        getCustomerName(order).toLowerCase().includes(query),
    );
  }

  if (statusFilter.value) {
    filtered = filtered.filter((order) => order.status === statusFilter.value);
  }

  if (typeFilter.value) {
    filtered = filtered.filter(
      (order) => getOrderType(order) === typeFilter.value,
    );
  }

  return filtered.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
});

// 方法
const refreshOrders = async () => {
  isLoading.value = true;
  try {
    await orderStore.fetchOrders();
    // Reset pagination
    currentPage.value = 1;
    hasMore.value = orderStore.orders.length >= pageSize.value;
  } finally {
    isLoading.value = false;
  }
};

const loadMoreOrders = async () => {
  if (isLoading.value || !hasMore.value) return;

  isLoading.value = true;
  try {
    currentPage.value++;
    // In a real implementation, this would fetch the next page
    await orderStore.fetchOrders({
      page: currentPage.value,
      limit: pageSize.value,
    });

    // Check if there are more items to load
    hasMore.value = orderStore.orders.length % pageSize.value === 0;
  } finally {
    isLoading.value = false;
  }
};

// Removed onLoadMore function since we're using a simple button approach instead of virtual scroll events

const viewOrderDetails = (order: Order) => {
  selectedOrder.value = order;
};

const updateOrderStatus = async (order: Order) => {
  const nextStatus = getNextStatus(order.status as string);
  if (nextStatus) {
    await orderStore.updateOrderStatus(order.id, nextStatus as OrderStatus);
  }
};

const cancelOrder = async (order: Order) => {
  if (confirm(`確定要取消訂單 ${getOrderNumber(order)} 嗎？`)) {
    await orderStore.updateOrderStatus(order.id, OrderStatus.CANCELLED);
  }
};

const canUpdateStatus = (status: string) => {
  return !["completed", "cancelled"].includes(status);
};

const canCancel = (status: string) => {
  return ["pending", "confirmed"].includes(status);
};

const getNextStatus = (currentStatus: string) => {
  const statusFlow: Record<string, string> = {
    pending: "confirmed",
    confirmed: "preparing",
    preparing: "ready",
    ready: "served",
    served: "completed",
  };
  return statusFlow[currentStatus] || null;
};

const getStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    preparing: "bg-purple-100 text-purple-800",
    ready: "bg-orange-100 text-orange-800",
    served: "bg-green-100 text-green-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };
  return classes[status] || "bg-gray-100 text-gray-800";
};

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    pending: "待確認",
    confirmed: "已確認",
    preparing: "製作中",
    ready: "待取餐",
    served: "已送達",
    completed: "已完成",
    cancelled: "已取消",
  };
  return texts[status] || status;
};

const getTypeClass = (type: string) => {
  const classes: Record<string, string> = {
    dine_in: "bg-blue-100 text-blue-800",
    takeaway: "bg-green-100 text-green-800",
    delivery: "bg-purple-100 text-purple-800",
  };
  return classes[type] || "bg-gray-100 text-gray-800";
};

const getTypeText = (type: string) => {
  const texts: Record<string, string> = {
    dine_in: "內用",
    takeaway: "外帶",
    delivery: "外送",
  };
  return texts[type] || type;
};

const formatDateTime = (dateTime: string) => {
  return new Date(dateTime).toLocaleString("zh-TW");
};

// 生命周期
onMounted(() => {
  refreshOrders();
});
</script>

<style scoped>
.orders-view {
  padding: 1.5rem;
}

@media (max-width: 640px) {
  .orders-view {
    padding: 1rem;
  }
}
</style>
