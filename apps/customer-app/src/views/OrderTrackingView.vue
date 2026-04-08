<template>
  <div class="min-h-screen bg-ios-bg">
    <!-- 頂部導航 -->
    <nav class="sticky top-0 z-40 bg-white/80 backdrop-blur-xl shadow-card-sm">
      <div class="max-w-md mx-auto px-5 py-4">
        <div class="flex items-center justify-between">
          <button
            class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-ios-text active:scale-95 transition-transform duration-150"
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
            <h1 class="text-lg font-semibold text-ios-text">
              {{ t("orderTracking.title") }}
            </h1>
            <p class="text-sm text-ios-secondary">
              {{ t("orderTracking.orderNumber") }} {{ order?.orderNumber }}
            </p>
          </div>

          <div class="w-10 h-10" />
          <!-- 占位符保持居中 -->
        </div>
      </div>
    </nav>

    <!-- 主要內容 -->
    <main class="max-w-md mx-auto">
      <!-- 載入狀態 -->
      <div v-if="isLoading" class="p-8 text-center">
        <div
          class="animate-spin rounded-full h-12 w-12 border-2 border-ios-blue/20 border-t-ios-blue mx-auto mb-4"
        />
        <p class="text-ios-secondary">{{ t("orderTracking.loadingOrder") }}</p>
      </div>

      <!-- 錯誤狀態 -->
      <div v-else-if="error" class="p-8 text-center">
        <div
          class="w-16 h-16 bg-ios-red/15 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-8 h-8 text-ios-red"
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
        <h3 class="text-lg font-medium text-ios-text mb-2">
          {{ t("orderTracking.loadFailed") }}
        </h3>
        <p class="text-ios-secondary mb-4">
          {{ error }}
        </p>
        <button
          class="px-4 py-2 bg-ios-blue text-white rounded-full active:scale-[0.98] transition-transform duration-150"
          @click="() => refetch()"
        >
          {{ t("orderTracking.reload") }}
        </button>
      </div>

      <!-- 訂單內容 -->
      <div v-else-if="order" class="px-4 py-6 space-y-6">
        <!-- 訂單狀態卡片 -->
        <div class="bg-white rounded-2xl p-6 shadow-card">
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
            <h2 class="text-xl font-semibold text-ios-text mb-2">
              {{ getStatusTitle(order.status) }}
            </h2>
            <p class="text-ios-secondary">
              {{ getStatusDescription(order.status) }}
            </p>
          </div>

          <!-- 進度條 -->
          <div class="mb-6">
            <div class="flex justify-between text-xs text-ios-secondary mb-2">
              <span>{{ t("orderTracking.orderProgress") }}</span>
              <span>{{ getProgressPercentage(order.status) }}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-1.5">
              <div
                class="bg-ios-blue h-1.5 rounded-full transition-all duration-500"
                :style="{ width: `${getProgressPercentage(order.status)}%` }"
              />
            </div>
          </div>

          <!-- 預估時間 -->
          <div v-if="estimatedTime" class="text-center">
            <div
              class="inline-flex items-center space-x-2 px-4 py-2 bg-ios-blue/10 rounded-full"
            >
              <svg
                class="w-4 h-4 text-ios-blue"
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
              <span class="text-sm font-medium text-ios-blue">
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
        <div
          data-testid="order-timeline"
          class="bg-white rounded-2xl p-6 shadow-card"
        >
          <h3 class="text-lg font-semibold text-ios-text mb-4">
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
        <div class="bg-white rounded-2xl p-6 shadow-card">
          <h3 class="text-lg font-semibold text-ios-text mb-4">
            {{ t("orderTracking.orderDetails") }}
          </h3>

          <!-- 基本資訊 -->
          <div class="space-y-3 mb-6">
            <div class="flex justify-between text-sm">
              <span class="text-ios-secondary">{{
                t("orderTracking.orderNumber")
              }}</span>
              <span class="font-medium text-ios-text">{{
                order.orderNumber
              }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-ios-secondary">{{
                t("orderTracking.orderTime")
              }}</span>
              <span class="font-medium text-ios-text">{{
                formatDateTime(order.createdAt)
              }}</span>
            </div>
            <div v-if="order.pickupNumber" class="flex justify-between text-sm">
              <span class="text-ios-secondary">{{
                t("orderTracking.pickupNumber")
              }}</span>
              <span
                data-testid="pickup-number"
                class="font-bold text-ios-blue text-base"
                >{{ order.pickupNumber }}</span
              >
            </div>
            <div v-if="order.customerName" class="flex justify-between text-sm">
              <span class="text-ios-secondary">{{
                t("orderTracking.customerName")
              }}</span>
              <span class="font-medium text-ios-text">{{
                order.customerName
              }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-ios-secondary">{{
                t("orderTracking.tableNumber")
              }}</span>
              <span class="font-medium text-ios-text">{{ tableId }}</span>
            </div>
          </div>

          <!-- 餐點列表 -->
          <div class="border-t border-ios-separator pt-4">
            <h4 class="font-medium text-ios-text mb-3">
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
          <div
            v-if="order.notes"
            class="border-t border-ios-separator pt-4 mt-4"
          >
            <h4 class="font-medium text-ios-text mb-2">
              {{ t("orderTracking.orderNotes") }}
            </h4>
            <p class="text-sm text-ios-secondary bg-gray-100 rounded-xl p-3.5">
              {{ order.notes }}
            </p>
          </div>

          <!-- 價格摘要 -->
          <div class="border-t border-ios-separator pt-4 mt-4">
            <div class="space-y-2">
              <div class="flex justify-between text-sm text-ios-secondary">
                <span>{{ t("common.subtotal") }}</span>
                <span>{{ formatPrice(order.totalAmount) }}</span>
              </div>
              <div
                class="flex justify-between text-lg font-semibold text-ios-text"
              >
                <span>{{ t("common.total") }}</span>
                <span>{{ formatPrice(order.totalAmount) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 操作按鈕 -->
        <div class="space-y-3">
          <!-- 取消訂單按鈕 (僅在可取消狀態顯示) -->
          <button
            v-if="canCancelOrder"
            class="w-full bg-ios-red/10 text-ios-red font-semibold py-3.5 px-4 rounded-full active:bg-ios-red/20 active:scale-[0.98] transition-transform duration-150"
            @click="showCancelConfirmation = true"
          >
            {{ t("orderTracking.cancelOrder") }}
          </button>

          <!-- 繼續點餐按鈕 -->
          <button
            class="w-full bg-ios-blue text-white font-semibold py-3.5 px-4 rounded-full active:scale-[0.98] transition-transform duration-150"
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
        class="bg-ios-orange/15 text-ios-orange px-4 py-2.5 rounded-2xl shadow-card-sm text-sm font-medium flex items-center space-x-2"
      >
        <div class="animate-pulse w-2 h-2 bg-ios-orange rounded-full" />
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
import { formatDateTime } from "@/utils/format";
import { useCurrency } from "@/composables/useCurrency";
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
const { formatPrice } = useCurrency();

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
      toast.info(
        tWithParams("toast.orderStatusUpdated", {
          status: getStatusTitle(orderMessage.status),
        }),
      );
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
    0: { bg: "bg-ios-orange/15", text: "text-ios-orange" },
    1: { bg: "bg-ios-blue/15", text: "text-ios-blue" },
    2: { bg: "bg-ios-orange/15", text: "text-ios-orange" },
    3: { bg: "bg-ios-green/15", text: "text-ios-green" },
    4: { bg: "bg-ios-green/15", text: "text-ios-green" },
    5: { bg: "bg-ios-green/15", text: "text-ios-green" },
    6: { bg: "bg-ios-red/15", text: "text-ios-red" },
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
