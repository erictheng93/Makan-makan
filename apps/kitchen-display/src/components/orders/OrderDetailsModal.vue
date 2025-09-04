<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    @click="$emit('close')"
  >
    <div
      class="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-90vh overflow-y-auto"
      @click.stop
    >
      <!-- Modal Header -->
      <div
        class="sticky top-0 bg-white rounded-t-2xl border-b border-gray-200 p-6"
      >
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-gray-900">訂單詳情</h2>
            <p class="text-sm text-gray-500">
              {{ order.orderNumber }}
            </p>
          </div>
          <button
            class="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
            @click="$emit('close')"
          >
            <XMarkIcon class="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <!-- Modal Content -->
      <div class="p-6 space-y-6">
        <!-- Order Basic Info -->
        <div class="bg-gray-50 rounded-xl p-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-sm text-gray-500">桌號</div>
              <div class="font-medium">
                {{ order.tableName }}
              </div>
            </div>
            <div>
              <div class="text-sm text-gray-500">下單時間</div>
              <div class="font-medium">
                {{ formatDateTime(order.createdAt) }}
              </div>
            </div>
            <div v-if="order.customerName">
              <div class="text-sm text-gray-500">顾客姓名</div>
              <div class="font-medium">
                {{ order.customerName }}
              </div>
            </div>
            <div>
              <div class="text-sm text-gray-500">等待時間</div>
              <div :class="getTimeClass(order.elapsedTime)">
                {{ formatElapsedTime(order.elapsedTime) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Order Items -->
        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-3">餐點明細</h3>
          <div class="space-y-3">
            <div
              v-for="item in order.items"
              :key="item.id"
              class="border border-gray-200 rounded-xl p-4"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center space-x-3 mb-2">
                    <h4 class="font-medium text-gray-900">
                      {{ item.name }}
                    </h4>
                    <span class="text-sm text-gray-500"
                      >x{{ item.quantity }}</span
                    >
                    <span :class="getItemStatusClass(item.status)">
                      {{ getItemStatusText(item.status) }}
                    </span>
                  </div>

                  <!-- Item Details -->
                  <div class="space-y-2 text-sm">
                    <div v-if="item.notes" class="text-orange-600">
                      <ExclamationTriangleIcon class="w-4 h-4 inline mr-1" />
                      <span class="font-medium">備註:</span> {{ item.notes }}
                    </div>

                    <div
                      v-if="item.customizations && item.customizations.length"
                      class="text-blue-600"
                    >
                      <span class="font-medium">客製:</span>
                      {{ item.customizations.join(", ") }}
                    </div>

                    <div v-if="item.estimatedTime" class="text-gray-600">
                      <ClockIcon class="w-4 h-4 inline mr-1" />
                      預估時間: {{ item.estimatedTime }}分鐘
                    </div>

                    <div v-if="item.startedAt" class="text-gray-600">
                      開始時間: {{ formatTime(item.startedAt) }}
                    </div>

                    <div v-if="item.completedAt" class="text-green-600">
                      完成時間: {{ formatTime(item.completedAt) }}
                    </div>
                  </div>
                </div>

                <!-- Item Actions -->
                <div class="flex flex-col space-y-2 ml-4">
                  <button
                    v-if="item.status === 'pending'"
                    class="btn-kitchen bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2"
                    @click="updateItemStatus(item.id, 'preparing')"
                  >
                    開始製作
                  </button>

                  <button
                    v-else-if="item.status === 'preparing'"
                    class="btn-kitchen bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2"
                    @click="updateItemStatus(item.id, 'ready')"
                  >
                    標記完成
                  </button>

                  <span
                    v-else-if="item.status === 'ready'"
                    class="status-ready text-sm px-3 py-2 text-center"
                  >
                    已完成
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Order Notes -->
        <div v-if="order.notes">
          <h3 class="text-lg font-semibold text-gray-900 mb-3">訂單備註</h3>
          <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div class="flex items-start space-x-2">
              <ChatBubbleLeftEllipsisIcon
                class="w-5 h-5 text-yellow-600 mt-0.5"
              />
              <p class="text-yellow-800">
                {{ order.notes }}
              </p>
            </div>
          </div>
        </div>

        <!-- Order Timeline -->
        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-3">處理時間軸</h3>
          <div class="space-y-3">
            <div class="flex items-center space-x-3">
              <div class="w-3 h-3 bg-green-500 rounded-full" />
              <div class="flex-1">
                <div class="font-medium">訂單建立</div>
                <div class="text-sm text-gray-500">
                  {{ formatDateTime(order.createdAt) }}
                </div>
              </div>
            </div>
          </div>

          <div v-if="order.confirmedAt" class="flex items-center space-x-3">
            <div class="w-3 h-3 bg-blue-500 rounded-full" />
            <div class="flex-1">
              <div class="font-medium">訂單確認</div>
              <div class="text-sm text-gray-500">
                {{ formatDateTime(order.confirmedAt) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Footer -->
    <div
      class="sticky bottom-0 bg-white rounded-b-2xl border-t border-gray-200 p-6"
    >
      <div class="flex justify-between items-center">
        <div class="text-sm text-gray-500">
          最後更新: {{ formatDateTime(new Date().toISOString()) }}
        </div>

        <div class="flex space-x-3">
          <button
            class="btn-kitchen-secondary px-4 py-2"
            @click="$emit('close')"
          >
            關閉
          </button>

          <button
            v-if="hasUncompletedItems"
            class="btn-kitchen-success px-4 py-2"
            @click="markAllComplete"
          >
            全部完成
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ChatBubbleLeftEllipsisIcon,
} from "@heroicons/vue/24/outline";
import type { KitchenOrder, ItemStatus } from "@/types";

interface Props {
  order: KitchenOrder;
  show: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  "update-status": [orderId: number, itemId: number, status: ItemStatus];
}>();

// Computed
const hasUncompletedItems = computed(() => {
  return props.order.items.some(
    (item) => item.status !== "ready" && item.status !== "completed",
  );
});

// Methods
const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const formatElapsedTime = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes}分鐘`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}時${remainingMinutes}分`;
};

const getTimeClass = (elapsedMinutes: number) => {
  if (elapsedMinutes >= 15) {
    return "font-bold text-red-600";
  } else if (elapsedMinutes >= 10) {
    return "font-bold text-orange-600";
  }
  return "font-medium text-gray-900";
};

const getItemStatusClass = (status: ItemStatus) => {
  const classes = {
    pending: "status-pending",
    preparing: "status-badge bg-blue-100 text-blue-800",
    ready: "status-ready",
    completed: "status-badge bg-green-100 text-green-800",
  };
  return classes[status] || classes.pending;
};

const getItemStatusText = (status: ItemStatus) => {
  const texts = {
    pending: "待處理",
    preparing: "製作中",
    ready: "已完成",
    completed: "已送達",
  };
  return texts[status] || "未知";
};

const updateItemStatus = (itemId: number, status: ItemStatus) => {
  emit("update-status", props.order.id, itemId, status);
};

const markAllComplete = () => {
  props.order.items
    .filter((item) => item.status !== "ready" && item.status !== "completed")
    .forEach((item) => {
      emit("update-status", props.order.id, item.id, "ready");
    });
};
</script>
