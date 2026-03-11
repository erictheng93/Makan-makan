<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 頂部導航 -->
    <nav class="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-md mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <button
            class="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors"
            @click="router.push(`/restaurant/${restaurantId}/table/${tableId}`)"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <div class="flex-1 text-center">
            <h1 class="text-lg font-semibold text-gray-900">
              {{ t("orderTracking.title") }}
            </h1>
            <p class="text-sm text-gray-500">
              {{ t("orderTracking.orderNumber") }} {{ order?.orderNumber }}
            </p>
          </div>

          <div class="w-8 h-8" />
          <!-- 占位符保持居中 -->
        </div>
      </div>
    </nav>

    <!-- 主要內容 -->
    <main class="max-w-md mx-auto">
      <!-- 載入狀態 -->
      <div v-if="isLoading" class="p-8 text-center">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"
        />
        <p class="text-gray-600">{{ t("orderTracking.loadingOrder") }}</p>
      </div>

      <!-- 錯誤狀態 -->
      <div v-else-if="error" class="p-8 text-center">
        <div
          class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">
          {{ t("orderTracking.loadFailed") }}
        </h3>
        <p class="text-gray-600 mb-4">
          {{ error }}
        </p>
        <button
          class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          @click="() => refetch()"
        >
          {{ t("orderTracking.reload") }}
        </button>
      </div>

      <!-- 訂單內容 -->
      <div v-else-if="order" class="px-4 py-6 space-y-6">
        <!-- 訂單狀態卡片 -->
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <!-- 狀態圖標和標題 -->
          <div class="text-center mb-6">
            <div
              :class="[
                'w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4',
                getStatusColor(order.status).bg,
              ]"
            >
              <component
                :is="getStatusIcon(order.status)"
                :class="['w-10 h-10', getStatusColor(order.status).text]"
              />
            </div>
            <h2 class="text-xl font-semibold text-gray-900 mb-2">
              {{ getStatusTitle(order.status) }}
            </h2>
            <p class="text-gray-600">
              {{ getStatusDescription(order.status) }}
            </p>
          </div>

          <!-- 進度條 -->
          <div class="mb-6">
            <div class="flex justify-between text-xs text-gray-500 mb-2">
              <span>{{ t("orderTracking.orderProgress") }}</span>
              <span>{{ getProgressPercentage(order.status) }}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                class="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                :style="{ width: `${getProgressPercentage(order.status)}%` }"
              />
            </div>
          </div>

          <!-- 預估時間 -->
          <div v-if="estimatedTime" class="text-center">
            <div
              class="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-50 rounded-full"
            >
              <svg
                class="w-4 h-4 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span class="text-sm font-medium text-indigo-900">
                {{
                  tWithParams("orderTracking.estimatedMinutes", {
                    minutes: estimatedTime,
                  })
                }}
              </span>
            </div>
          </div>
        </div>

        <!-- 時間軸 -->
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            {{ t("orderTracking.orderTimeline") }}
          </h3>

          <div class="space-y-4">
            <TimelineItem
              v-for="(step, index) in orderTimeline"
              :key="index"
              :title="step.title"
              :description="step.description"
              :status="
                step.completed
                  ? 'completed'
                  : index === 0
                    ? 'current'
                    : 'pending'
              "
              :timestamp="step.time"
              :is-last="index === orderTimeline.length - 1"
            />
          </div>
        </div>

        <!-- 訂單詳情 -->
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            {{ t("orderTracking.orderDetails") }}
          </h3>

          <!-- 基本資訊 -->
          <div class="space-y-3 mb-6">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">{{
                t("orderTracking.orderNumber")
              }}</span>
              <span class="font-medium text-gray-900">{{
                order.orderNumber
              }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">{{
                t("orderTracking.orderTime")
              }}</span>
              <span class="font-medium text-gray-900">{{
                formatDateTime(order.createdAt)
              }}</span>
            </div>
            <div v-if="order.customerName" class="flex justify-between text-sm">
              <span class="text-gray-600">{{
                t("orderTracking.customerName")
              }}</span>
              <span class="font-medium text-gray-900">{{
                order.customerName
              }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">{{
                t("orderTracking.tableNumber")
              }}</span>
              <span class="font-medium text-gray-900">{{ tableId }}</span>
            </div>
          </div>

          <!-- 餐點列表 -->
          <div class="border-t border-gray-100 pt-4">
            <h4 class="font-medium text-gray-900 mb-3">
              {{ t("orderTracking.orderedItems") }}
            </h4>
            <div class="space-y-3">
              <OrderItemCard
                v-for="item in order.items"
                :key="item.id"
                :item="item"
              />
            </div>
          </div>

          <!-- 訂單備註 -->
          <div v-if="order.notes" class="border-t border-gray-100 pt-4 mt-4">
            <h4 class="font-medium text-gray-900 mb-2">
              {{ t("orderTracking.orderNotes") }}
            </h4>
            <p class="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              {{ order.notes }}
            </p>
          </div>

          <!-- 價格摘要 -->
          <div class="border-t border-gray-100 pt-4 mt-4">
            <div class="space-y-2">
              <div class="flex justify-between text-sm text-gray-600">
                <span>小計</span>
                <span>${{ formatPrice(order.totalAmount) }}</span>
              </div>
              <div
                class="flex justify-between text-lg font-semibold text-gray-900"
              >
                <span>總計</span>
                <span>${{ formatPrice(order.totalAmount) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 操作按鈕 -->
        <div class="space-y-3">
          <!-- 取消訂單按鈕 (僅在可取消狀態顯示) -->
          <button
            v-if="canCancelOrder"
            class="w-full bg-white border-2 border-red-200 text-red-600 font-semibold py-3 px-4 rounded-xl hover:bg-red-50 hover:border-red-300 transition-colors"
            @click="showCancelConfirmation = true"
          >
            {{ t("orderTracking.cancelOrder") }}
          </button>

          <!-- 繼續點餐按鈕 -->
          <button
            class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            @click="router.push(`/restaurant/${restaurantId}/table/${tableId}`)"
          >
            {{ t("orderTracking.continueOrdering") }}
          </button>
        </div>
      </div>
    </main>

    <!-- 取消訂單確認對話框 -->
    <ConfirmationModal
      :show="showCancelConfirmation"
      :title="t('orderTracking.confirmCancel')"
      :message="t('orderTracking.confirmCancelMessage')"
      :confirm-text="t('orderTracking.confirmCancelBtn')"
      :cancel-text="t('orderTracking.keepOrder')"
      :is-destructive="true"
      @confirm="handleCancelOrder"
      @cancel="showCancelConfirmation = false"
    />

    <!-- 即時連接狀態指示器 -->
    <div
      v-if="connectionStatus !== 'connected'"
      class="fixed top-20 left-4 right-4 max-w-md mx-auto z-50"
    >
      <div
        class="bg-yellow-100 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg text-sm flex items-center space-x-2"
      >
        <div class="animate-pulse w-2 h-2 bg-yellow-500 rounded-full" />
        <span>{{ getConnectionMessage(connectionStatus) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useQuery, useMutation } from "@tanstack/vue-query";
import { useToast } from "vue-toastification";
import { useWebSocket } from "@/composables/useWebSocket";
import { useI18n } from "@/composables/useI18n";
import TimelineItem from "@/components/TimelineItem.vue";
import OrderItemCard from "@/components/OrderItemCard.vue";
import ConfirmationModal from "@/components/ConfirmationModal.vue";
import { orderApi } from "@/services/orderApi";
import { formatPrice, formatDateTime } from "@/utils/format";
import {
  ClockIcon,
  CheckCircleIcon,
  FireIcon,
  TruckIcon,
  XCircleIcon,
} from "@heroicons/vue/24/outline";
import type { OrderStatus, WebSocketMessage } from "@makanmakan/shared-types";

// Props
const props = defineProps<{
  restaurantId: string;
  tableId: number;
  orderId: number;
}>();

// Composables
const router = useRouter();
const toast = useToast();
const { t, tWithParams } = useI18n();

// State
const showCancelConfirmation = ref(false);

// WebSocket message handler
const handleWebSocketMessage = (message: WebSocketMessage) => {
  if (message.type === "ORDER_STATUS_UPDATE") {
    const orderMessage = message as any; // Type assertion for now
    if (orderMessage.orderId === props.orderId) {
      // 刷新訂單資料
      // Note: refetch will be defined later, this is a forward reference
      if (typeof refetch === "function") {
        refetch();
      }

      // 顯示狀態更新通知
      toast.info(`訂單狀態已更新：${getStatusTitle(orderMessage.status)}`);
    }
  }
};

// WebSocket連接
const { connectionStatus, connect, disconnect } = useWebSocket({
  restaurantId: props.restaurantId,
  onMessage: handleWebSocketMessage,
});

// API Queries
const {
  data: order,
  isLoading,
  error,
  refetch,
} = useQuery({
  queryKey: ["order", props.orderId],
  queryFn: () => {
    const hasCustomerToken = !!localStorage.getItem("customer_auth_token");
    const hasGuestToken = !!localStorage.getItem("guest_auth_token");

    // If guest, use guest tracking endpoint
    if (!hasCustomerToken && hasGuestToken) {
      return orderApi.getGuestOrder(props.orderId);
    }
    return orderApi.getOrder(props.orderId);
  },
  refetchInterval: 30 * 1000, // 30秒輪詢
  refetchOnWindowFocus: true,
});

// 取消訂單 Mutation
const { mutate: cancelOrder } = useMutation({
  mutationFn: () => orderApi.cancelOrder(props.orderId),
  onSuccess: () => {
    toast.success(t("toast.orderCancelled"));
    refetch();
  },
  onError: (error: any) => {
    toast.error(error?.message || t("toast.cancelOrderFailed"));
  },
});

// Computed
const canCancelOrder = computed(() => {
  return order.value?.status === 0 || order.value?.status === 1; // PENDING or CONFIRMED
});

const estimatedTime = computed(() => {
  if (!order.value || order.value.status >= 3) return null;
  return order.value.estimatedPrepTime || null;
});

const orderTimeline = computed(() => {
  if (!order.value) return [];

  const timeline = [
    {
      status: 0,
      title: t("orderTracking.timeline.created"),
      description: t("orderTracking.timeline.createdDesc"),
      time: order.value.createdAt,
      completed: true,
    },
    {
      status: 1,
      title: t("orderTracking.timeline.confirmed"),
      description: t("orderTracking.timeline.confirmedDesc"),
      time: order.value.confirmedAt,
      completed: order.value.status >= 1,
    },
    {
      status: 2,
      title: t("orderTracking.timeline.preparing"),
      description: t("orderTracking.timeline.preparingDesc"),
      time: null,
      completed: order.value.status >= 2,
    },
    {
      status: 3,
      title: t("orderTracking.timeline.ready"),
      description: t("orderTracking.timeline.readyDesc"),
      time: order.value.readyAt,
      completed: order.value.status >= 3,
    },
    {
      status: 4,
      title: t("orderTracking.timeline.served"),
      description: t("orderTracking.timeline.servedDesc"),
      time: order.value.deliveredAt,
      completed: order.value.status >= 4,
    },
  ];

  // 如果訂單被取消，添加取消狀態
  if (order.value.status === 6) {
    timeline.push({
      status: 6,
      title: t("orderTracking.timeline.cancelled"),
      description: t("orderTracking.timeline.cancelledDesc"),
      time: order.value.updatedAt,
      completed: true,
    });
  }

  return timeline;
});

// Status maps as computed for reactivity when language changes
const statusTitles = computed(() => ({
  0: t("orderTracking.status.pending"),
  1: t("orderTracking.status.confirmed"),
  2: t("orderTracking.status.preparing"),
  3: t("orderTracking.status.ready"),
  4: t("orderTracking.status.served"),
  5: t("orderTracking.status.paid"),
  6: t("orderTracking.status.cancelled"),
}));

const statusDescriptions = computed(() => ({
  0: t("orderTracking.statusDesc.pending"),
  1: t("orderTracking.statusDesc.confirmed"),
  2: t("orderTracking.statusDesc.preparing"),
  3: t("orderTracking.statusDesc.ready"),
  4: t("orderTracking.statusDesc.served"),
  5: t("orderTracking.statusDesc.paid"),
  6: t("orderTracking.statusDesc.cancelled"),
}));

// Methods
const getStatusIcon = (status: OrderStatus) => {
  const icons = {
    0: ClockIcon, // PENDING
    1: CheckCircleIcon, // CONFIRMED
    2: FireIcon, // PREPARING
    3: CheckCircleIcon, // READY
    4: TruckIcon, // DELIVERED
    5: CheckCircleIcon, // PAID
    6: XCircleIcon, // CANCELLED
  };
  return icons[status] || ClockIcon;
};

const getStatusColor = (status: OrderStatus) => {
  const colors = {
    0: { bg: "bg-yellow-100", text: "text-yellow-600" }, // PENDING
    1: { bg: "bg-blue-100", text: "text-blue-600" }, // CONFIRMED
    2: { bg: "bg-orange-100", text: "text-orange-600" }, // PREPARING
    3: { bg: "bg-green-100", text: "text-green-600" }, // READY
    4: { bg: "bg-green-100", text: "text-green-600" }, // DELIVERED
    5: { bg: "bg-green-100", text: "text-green-600" }, // PAID
    6: { bg: "bg-red-100", text: "text-red-600" }, // CANCELLED
  };
  return colors[status] || colors[0];
};

const getStatusTitle = (status: OrderStatus) => {
  return statusTitles.value[status] || t("orderTracking.status.unknown");
};

const getStatusDescription = (status: OrderStatus) => {
  return (
    statusDescriptions.value[status] || t("orderTracking.statusDesc.unknown")
  );
};

const getProgressPercentage = (status: OrderStatus) => {
  const percentages = {
    0: 20, // PENDING
    1: 40, // CONFIRMED
    2: 60, // PREPARING
    3: 80, // READY
    4: 100, // DELIVERED
    5: 100, // PAID
    6: 0, // CANCELLED
  };
  return percentages[status] || 0;
};

const getConnectionMessage = (status: string) => {
  const messages: Record<string, string> = {
    connecting: t("orderTracking.connecting"),
    disconnected: t("orderTracking.reconnecting"),
    error: t("orderTracking.connectionError"),
  };
  return messages[status] || t("orderTracking.connectionUnknown");
};

const handleCancelOrder = () => {
  showCancelConfirmation.value = false;
  cancelOrder();
};

// 生命週期
onMounted(() => {
  connect();
});

onUnmounted(() => {
  disconnect();
});
</script>
