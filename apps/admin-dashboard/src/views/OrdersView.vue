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
            <ShoppingBagIcon class="h-6 w-6 text-blue-600" />
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

            <select
              v-model="sourceFilter"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">所有來源</option>
              <option value="direct">自家訂單</option>
              <option value="uber_eats">Uber Eats</option>
              <option value="foodpanda">Foodpanda</option>
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
          class="grid grid-cols-9 gap-4 px-6 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider mb-4 rounded-t-lg"
        >
          <div>訂單編號</div>
          <div>桌號</div>
          <div>客戶</div>
          <div>類型</div>
          <div>來源</div>
          <div>狀態</div>
          <div>總金額</div>
          <div>下單時間</div>
          <div>操作</div>
        </div>

        <!-- 虛擬滾動訂單列表 (已修復 TypeScript 類型問題) -->
        <div
          v-if="filteredOrders.length > 0"
          ref="containerRef"
          class="overflow-y-auto"
          :style="{ height: CONTAINER_HEIGHT + 'px' }"
          @scroll="handleScroll"
        >
          <!-- 虛擬滾動容器 -->
          <div
            class="relative"
            :style="{ height: totalHeight + 'px', minHeight: '100%' }"
          >
            <!-- 偏移定位的可見項目 -->
            <div
              :style="{
                transform: `translateY(${offsetY}px)`,
                willChange: 'transform',
              }"
            >
              <div
                v-for="{ item: order } in visibleItems"
                :key="order.id"
                class="grid grid-cols-9 gap-4 px-6 py-4 hover:bg-gray-50 border-b border-gray-200 items-center"
                :style="{ height: ITEM_HEIGHT + 'px' }"
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
                    v-if="order.orderSource && order.orderSource !== 'direct'"
                    :class="getSourceClass(order.orderSource)"
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                  >
                    {{ getSourceText(order.orderSource) }}
                  </span>
                  <span v-else class="text-xs text-gray-400">自家</span>
                </div>
                <div>
                  <span
                    :class="getStatusClass(order.status)"
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                  >
                    {{ getStatusText(order.status) }}
                  </span>
                </div>
                <div class="text-sm text-gray-500">
                  RM{{ order.totalAmount }}
                </div>
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
            </div>
          </div>

          <!-- 載入指示器 -->
          <div
            v-if="isLoading"
            class="absolute bottom-0 left-0 right-0 p-4 bg-white text-center"
          >
            <div class="flex items-center justify-center">
              <div
                class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"
              />
              <span class="ml-2 text-sm text-gray-600">載入中...</span>
            </div>
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
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-semibold">
                  訂單詳情 - {{ getOrderNumber(selectedOrder) }}
                </h3>
                <span
                  v-if="
                    selectedOrder?.deliveryInfo?.type &&
                    selectedOrder.deliveryInfo.type !== 'dine_in'
                  "
                  :class="[
                    'px-2 py-1 rounded-full text-xs font-semibold',
                    selectedOrder.deliveryInfo.type === 'delivery'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-green-100 text-green-800',
                  ]"
                >
                  {{
                    selectedOrder.deliveryInfo.type === "delivery"
                      ? "🛵 外送"
                      : "🛍️ 外帶"
                  }}
                </span>
              </div>
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

              <!-- Delivery Info Section -->
              <div
                v-if="
                  selectedOrder?.deliveryInfo &&
                  selectedOrder.deliveryInfo.type !== 'dine_in'
                "
                class="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl"
              >
                <h4
                  class="font-semibold text-amber-800 mb-3 flex items-center gap-1"
                >
                  <span>📦</span> 外送資訊
                </h4>
                <div class="grid grid-cols-[80px_1fr] gap-y-2 text-sm">
                  <span class="text-gray-500">類型</span>
                  <span class="font-medium">
                    {{
                      selectedOrder.deliveryInfo.type === "delivery"
                        ? "🛵 外送"
                        : "🛍️ 外帶"
                    }}
                  </span>
                  <template v-if="selectedOrder.deliveryInfo.address">
                    <span class="text-gray-500">地址</span>
                    <span>{{ selectedOrder.deliveryInfo.address }}</span>
                  </template>
                  <template v-if="selectedOrder.deliveryInfo.phone">
                    <span class="text-gray-500">電話</span>
                    <span>{{ selectedOrder.deliveryInfo.phone }}</span>
                  </template>
                  <template v-if="selectedOrder.deliveryInfo.instructions">
                    <span class="text-gray-500">備註</span>
                    <span>{{ selectedOrder.deliveryInfo.instructions }}</span>
                  </template>
                  <template v-if="selectedOrder.deliveryInfo.deliveryFee">
                    <span class="text-gray-500">外送費</span>
                    <span class="font-semibold"
                      >NT$ {{ selectedOrder.deliveryInfo.deliveryFee }}</span
                    >
                  </template>
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
                <div
                  v-if="selectedOrder?.deliveryInfo?.deliveryFee"
                  class="flex justify-between text-sm text-gray-500 mb-2"
                >
                  <span>外送費</span>
                  <span>NT$ {{ selectedOrder.deliveryInfo.deliveryFee }}</span>
                </div>
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
import { useVirtualScroll } from "@/composables/useVirtualScroll";
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

const orderStore = useOrderStore();

// 響應式數據
const searchQuery = ref("");
const statusFilter = ref("");
const typeFilter = ref("");
const sourceFilter = ref("");
const selectedOrder = ref<Order | null>(null);
const isLoading = ref(false);

// Helper functions for missing properties
const getOrderNumber = (order: Order) =>
  `ORD-${order.id.toString().padStart(6, "0")}`;
const getTableNumber = (order: Order) =>
  order.tableId ? `T${order.tableId.toString().padStart(2, "0")}` : "外帶";
const getCustomerName = (order: Order) => order.customerInfo?.name || "客人";
const getOrderType = (order: Order) => (order.tableId ? "dine_in" : "takeaway");

const getSourceClass = (source: string) => {
  const classes: Record<string, string> = {
    uber_eats: "bg-green-100 text-green-800",
    foodpanda: "bg-pink-100 text-pink-800",
    grabfood: "bg-orange-100 text-orange-800",
  };
  return classes[source] || "bg-gray-100 text-gray-800";
};

const getSourceText = (source: string) => {
  const texts: Record<string, string> = {
    uber_eats: "Uber Eats",
    foodpanda: "Foodpanda",
    grabfood: "GrabFood",
    direct: "自家",
  };
  return texts[source] || source;
};
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

  if (sourceFilter.value) {
    filtered = filtered.filter(
      (order) => (order.orderSource || "direct") === sourceFilter.value,
    );
  }

  return filtered.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
});

// 虛擬滾動配置
const ITEM_HEIGHT = 60; // 每個訂單行的固定高度 (px)
const CONTAINER_HEIGHT = 500; // 容器高度 (px)

const {
  containerRef: _containerRef,
  visibleItems,
  totalHeight,
  offsetY,
  handleScroll,
} = useVirtualScroll<Order>(filteredOrders, {
  itemHeight: ITEM_HEIGHT,
  buffer: 5,
  containerHeight: CONTAINER_HEIGHT,
});

// 方法
const refreshOrders = async () => {
  isLoading.value = true;
  try {
    await orderStore.fetchOrders();
  } finally {
    isLoading.value = false;
  }
};

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
