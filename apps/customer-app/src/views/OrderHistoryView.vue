<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-6">
          <div class="flex items-center">
            <h1 class="text-2xl font-bold text-gray-900">我的訂單</h1>
          </div>
          <div class="flex items-center space-x-4">
            <router-link
              to="/profile"
              class="text-sm text-gray-600 hover:text-orange-600"
            >
              個人中心
            </router-link>
            <button
              class="text-sm text-gray-600 hover:text-red-600"
              @click="handleLogout"
            >
              登出
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Filters -->
      <div class="bg-white rounded-lg shadow p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Status Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              訂單狀態
            </label>
            <select
              v-model="filters.status"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              @change="loadOrders"
            >
              <option value="">全部狀態</option>
              <option value="0">待確認</option>
              <option value="1">已確認</option>
              <option value="2">準備中</option>
              <option value="3">已完成</option>
              <option value="4">已送達</option>
              <option value="5">已付款</option>
              <option value="6">已取消</option>
            </select>
          </div>

          <!-- Date From -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              開始日期
            </label>
            <input
              v-model="filters.dateFrom"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              @change="loadOrders"
            />
          </div>

          <!-- Date To -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              結束日期
            </label>
            <input
              v-model="filters.dateTo"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              @change="loadOrders"
            />
          </div>
        </div>

        <!-- Reset Button -->
        <div class="mt-4 flex justify-end">
          <button
            class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            @click="resetFilters"
          >
            重置篩選
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex justify-center items-center py-12">
        <div
          class="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"
        />
      </div>

      <!-- Empty State -->
      <div
        v-else-if="orders.length === 0"
        class="bg-white rounded-lg shadow p-12 text-center"
      >
        <svg
          class="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">暫無訂單</h3>
        <p class="mt-1 text-sm text-gray-500">您還沒有任何訂單記錄</p>
        <div class="mt-6">
          <router-link
            to="/menu"
            class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
          >
            開始點餐
          </router-link>
        </div>
      </div>

      <!-- Orders List -->
      <div v-else class="space-y-4">
        <div
          v-for="order in orders"
          :key="order.id"
          class="bg-white rounded-lg shadow hover:shadow-md transition cursor-pointer"
          @click="viewOrderDetail(order.id)"
        >
          <div class="p-6">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <!-- Order Number -->
                <div class="flex items-center space-x-2 mb-2">
                  <h3 class="text-lg font-semibold text-gray-900">
                    {{ order.orderNumber }}
                  </h3>
                  <span
                    class="px-2 py-1 text-xs font-medium rounded-full"
                    :class="getStatusClass(order.status)"
                  >
                    {{ getStatusText(order.status) }}
                  </span>
                </div>

                <!-- Restaurant Name -->
                <p v-if="order.restaurant" class="text-sm text-gray-600 mb-1">
                  <span class="font-medium">餐廳：</span>
                  {{ order.restaurant.name }}
                </p>

                <!-- Table Info -->
                <p v-if="order.table" class="text-sm text-gray-600 mb-1">
                  <span class="font-medium">桌號：</span>
                  {{ order.table.number }}
                </p>

                <!-- Order Date -->
                <p class="text-sm text-gray-500">
                  {{ formatDate(order.createdAt) }}
                </p>

                <!-- Items Count -->
                <p v-if="order.items" class="text-sm text-gray-500 mt-2">
                  共 {{ order.items.length }} 項商品
                </p>
              </div>

              <!-- Amount -->
              <div class="text-right">
                <p class="text-2xl font-bold text-orange-600">
                  ${{ formatPrice(order.totalAmount) }}
                </p>
                <p
                  v-if="order.paymentStatus === 1"
                  class="text-sm text-green-600 mt-1"
                >
                  已付款
                </p>
                <p v-else class="text-sm text-gray-500 mt-1">待付款</p>
              </div>
            </div>

            <!-- Action Buttons -->
            <div
              class="mt-4 pt-4 border-t border-gray-200 flex justify-end space-x-2"
            >
              <button
                class="px-4 py-2 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition"
                @click.stop="viewOrderDetail(order.id)"
              >
                查看詳情
              </button>
              <button
                v-if="order.status === 0"
                class="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                @click.stop="cancelOrder(order.id)"
              >
                取消訂單
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="pagination.totalPages > 1"
        class="bg-white rounded-lg shadow p-4 mt-6 flex justify-between items-center"
      >
        <button
          :disabled="pagination.page === 1"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="changePage(pagination.page - 1)"
        >
          上一頁
        </button>

        <span class="text-sm text-gray-700">
          第 {{ pagination.page }} / {{ pagination.totalPages }} 頁 （共
          {{ pagination.total }} 筆）
        </span>

        <button
          :disabled="pagination.page === pagination.totalPages"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="changePage(pagination.page + 1)"
        >
          下一頁
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { customerOrderApi } from "@/services/customerOrderApi";
import type { Order } from "@makanmakan/shared-types";

const router = useRouter();
const authStore = useAuthStore();

const orders = ref<Order[]>([]);
const isLoading = ref(false);
const filters = reactive({
  status: "",
  dateFrom: "",
  dateTo: "",
});

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
});

// 載入訂單
const loadOrders = async () => {
  isLoading.value = true;

  try {
    const params: any = {
      page: pagination.page,
      limit: pagination.limit,
    };

    if (filters.status) {
      params.status = filters.status;
    }
    if (filters.dateFrom) {
      params.dateFrom = filters.dateFrom;
    }
    if (filters.dateTo) {
      params.dateTo = filters.dateTo;
    }

    const response = await customerOrderApi.getMyOrders(params);
    orders.value = response.orders;
    pagination.page = response.pagination.page;
    pagination.total = response.pagination.total;
    pagination.totalPages = response.pagination.totalPages;
  } catch (error) {
    console.error("Failed to load orders:", error);
  } finally {
    isLoading.value = false;
  }
};

// 重置篩選
const resetFilters = () => {
  filters.status = "";
  filters.dateFrom = "";
  filters.dateTo = "";
  pagination.page = 1;
  loadOrders();
};

// 換頁
const changePage = (page: number) => {
  pagination.page = page;
  loadOrders();
};

// 查看訂單詳情
const viewOrderDetail = (orderId: number) => {
  router.push(`/orders/${orderId}`);
};

// 取消訂單
const cancelOrder = async (orderId: number) => {
  if (!confirm("確定要取消這個訂單嗎？")) return;

  try {
    await customerOrderApi.cancelOrder(orderId, "客戶主動取消");
    await loadOrders();
  } catch (error) {
    console.error("Failed to cancel order:", error);
    alert("取消訂單失敗，請稍後再試");
  }
};

// 登出
const handleLogout = async () => {
  if (!confirm("確定要登出嗎？")) return;

  await authStore.logout();
  router.push("/login");
};

// 獲取狀態樣式
const getStatusClass = (status: number) => {
  const classes: Record<number, string> = {
    0: "bg-yellow-100 text-yellow-800",
    1: "bg-blue-100 text-blue-800",
    2: "bg-purple-100 text-purple-800",
    3: "bg-green-100 text-green-800",
    4: "bg-green-100 text-green-800",
    5: "bg-green-100 text-green-800",
    6: "bg-red-100 text-red-800",
  };
  return classes[status] || "bg-gray-100 text-gray-800";
};

// 獲取狀態文字
const getStatusText = (status: number) => {
  const texts: Record<number, string> = {
    0: "待確認",
    1: "已確認",
    2: "準備中",
    3: "已完成",
    4: "已送達",
    5: "已付款",
    6: "已取消",
  };
  return texts[status] || "未知";
};

// 格式化金額
const formatPrice = (cents: number) => {
  return (cents / 100).toFixed(2);
};

// 格式化日期
const formatDate = (dateString?: string) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// 初始化
onMounted(async () => {
  // 檢查登入狀態
  if (!authStore.isAuthenticated) {
    router.push("/login");
    return;
  }

  const isValid = await authStore.checkAuth();
  if (!isValid) {
    router.push("/login");
    return;
  }

  await loadOrders();
});
</script>
