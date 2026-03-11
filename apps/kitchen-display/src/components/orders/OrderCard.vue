<template>
  <div
    :class="[
      'order-card p-4 transition-all duration-200 hover:shadow-lg',
      getCardClass(statusType),
      { 'animate-pulse-fast': order.priority === 'urgent' },
    ]"
  >
    <!-- Order Header -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-2">
          <span class="text-lg font-bold text-gray-900">{{
            order.orderNumber
          }}</span>
          <span :class="getPriorityClass(order.priority)">
            {{ getPriorityText(order.priority) }}
          </span>
        </div>
        <div v-if="order.tableName" class="text-sm text-gray-500">
          桌號 {{ order.tableName }}
        </div>
        <span
          :class="[
            getOrderTypeBadge(order).bgClass,
            getOrderTypeBadge(order).textClass,
          ]"
          class="px-2 py-0.5 rounded-full text-xs font-semibold"
        >
          {{ getOrderTypeBadge(order).emoji }}
          {{ getOrderTypeBadge(order).label }}
        </span>
        <span
          v-if="order.orderSource && order.orderSource !== 'direct'"
          :class="[
            getPlatformBadge(order.orderSource).bgClass,
            getPlatformBadge(order.orderSource).textClass,
          ]"
          class="px-2 py-0.5 rounded-full text-xs font-semibold"
        >
          {{ getPlatformBadge(order.orderSource).emoji }}
          {{ getPlatformBadge(order.orderSource).label }}
        </span>
      </div>

      <div class="text-right">
        <div :class="getTimeClass(order.elapsedTime)">
          {{ formatElapsedTime(order.elapsedTime) }}
        </div>
        <div class="text-xs text-gray-500">
          {{ formatOrderTime(order.createdAt) }}
        </div>
      </div>
    </div>

    <!-- Customer Info -->
    <div v-if="order.customerName && showCustomerNames" class="mb-3">
      <div class="flex items-center space-x-2 text-sm text-gray-600">
        <UserIcon class="w-4 h-4" />
        <span>{{ order.customerName }}</span>
      </div>
    </div>

    <!-- Order Items -->
    <div class="space-y-2 mb-4">
      <div
        v-for="item in order.items"
        :key="item.id"
        class="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
      >
        <div class="flex-1">
          <div class="flex items-center space-x-2">
            <span class="font-medium text-gray-900">{{ item.name }}</span>
            <span class="text-sm text-gray-500">x{{ item.quantity }}</span>
            <component
              :is="getItemStatusIcon(item.status)"
              :class="getItemStatusClass(item.status)"
              class="w-4 h-4"
            />
          </div>

          <!-- Item Notes -->
          <div v-if="item.notes" class="text-sm text-orange-600 mt-1">
            <ExclamationTriangleIcon class="w-3 h-3 inline mr-1" />
            {{ item.notes }}
          </div>

          <!-- Customizations -->
          <div
            v-if="item.customizations && item.customizations.length"
            class="text-sm text-blue-600 mt-1"
          >
            <span class="font-medium">客製:</span>
            {{ item.customizations.join(", ") }}
          </div>
        </div>

        <!-- Item Actions -->
        <div class="flex items-center space-x-2 ml-4">
          <!-- Estimated Time -->
          <div
            v-if="item.estimatedTime && showEstimatedTime"
            class="text-sm text-gray-500 text-center"
          >
            <ClockIcon class="w-4 h-4 mx-auto" />
            <span>{{ item.estimatedTime }}分</span>
          </div>

          <!-- Item Action Buttons -->
          <div class="flex items-center space-x-1">
            <button
              v-if="item.status === 'pending'"
              class="btn-kitchen bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1"
              title="開始製作"
              @click="handleStartCooking(item.id)"
            >
              開始
            </button>

            <button
              v-else-if="item.status === 'preparing'"
              class="btn-kitchen bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1"
              title="標記完成"
              @click="handleMarkReady(item.id)"
            >
              完成
            </button>

            <span
              v-else-if="item.status === 'ready'"
              class="status-ready text-sm px-3 py-1"
            >
              已完成
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Order Notes -->
    <div
      v-if="order.notes"
      class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
    >
      <div class="flex items-start space-x-2">
        <ChatBubbleLeftEllipsisIcon class="w-4 h-4 text-yellow-600 mt-0.5" />
        <div class="text-sm text-yellow-800">
          <span class="font-medium">備註：</span>{{ order.notes }}
        </div>
      </div>
    </div>

    <!-- Delivery/Takeaway Info -->
    <div
      v-if="order.deliveryInfo?.type === 'delivery'"
      class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg"
    >
      <div class="text-sm text-blue-800 space-y-1">
        <div class="font-medium">&#x1F6F5; 外送資訊</div>
        <div v-if="order.deliveryInfo.address">
          &#x1F4CD; {{ order.deliveryInfo.address }}
        </div>
        <div v-if="order.deliveryInfo.phone">
          &#x1F4DE; {{ order.deliveryInfo.phone }}
        </div>
        <div
          v-if="order.deliveryInfo.instructions"
          class="text-blue-600 italic"
        >
          &#x1F4AC; {{ order.deliveryInfo.instructions }}
        </div>
      </div>
    </div>
    <div
      v-else-if="order.deliveryInfo?.type === 'takeaway'"
      class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg"
    >
      <div class="text-sm text-green-800 font-medium">
        &#x1F6CD;&#xFE0F; 外帶訂單 — 請準備打包
      </div>
    </div>

    <!-- Order Actions -->
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <!-- Quick Actions -->
        <button
          v-if="statusType === 'pending'"
          class="btn-kitchen-primary text-sm px-4 py-2"
          @click="handleStartAll"
        >
          <PlayIcon class="w-4 h-4 mr-1" />
          開始全部
        </button>

        <button
          v-if="statusType === 'preparing'"
          class="btn-kitchen-success text-sm px-4 py-2"
          @click="handleMarkAllReady"
        >
          <CheckIcon class="w-4 h-4 mr-1" />
          全部完成
        </button>
      </div>

      <div class="flex items-center space-x-2">
        <!-- View Details -->
        <button
          class="text-gray-500 hover:text-gray-700 transition-colors"
          title="查看詳情"
          @click="$emit('view-details', order)"
        >
          <EyeIcon class="w-4 h-4" />
        </button>

        <!-- Keyboard Shortcut Hint -->
        <div v-if="keyboardShortcuts" class="text-xs text-gray-400">
          <span class="keyboard-hint">Space</span>
        </div>
      </div>
    </div>

    <!-- Progress Bar (for preparing orders) -->
    <div v-if="statusType === 'preparing' && order.estimatedTime" class="mt-3">
      <div class="flex justify-between text-xs text-gray-500 mb-1">
        <span>進度</span>
        <span>{{ getProgressPercentage(order) }}%</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-1.5">
        <div
          class="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
          :style="{ width: `${getProgressPercentage(order)}%` }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  UserIcon,
  ClockIcon,
  ChatBubbleLeftEllipsisIcon,
  PlayIcon,
  CheckIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  FireIcon,
} from "@heroicons/vue/24/outline";
import { useSettingsStore } from "@/stores/settings";
import type { KitchenOrder } from "@/types";
import { storeToRefs } from "pinia";

// Props
interface Props {
  order: KitchenOrder;
  statusType: "pending" | "preparing" | "ready";
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  "start-cooking": [orderId: number, itemId: number];
  "mark-ready": [orderId: number, itemId: number];
  "view-details": [order: KitchenOrder];
}>();

// Settings
const settingsStore = useSettingsStore();
const {
  showEstimatedTime,
  showCustomerNames,
  keyboardShortcuts,
  urgentThreshold,
  warningThreshold,
} = storeToRefs(settingsStore);

// Order Type Badge
function getOrderTypeBadge(order: KitchenOrder) {
  const type = order.deliveryInfo?.type ?? "dine_in";
  const badges: Record<
    string,
    { label: string; emoji: string; bgClass: string; textClass: string }
  > = {
    dine_in: {
      label: "內用",
      emoji: "🪑",
      bgClass: "bg-blue-100",
      textClass: "text-blue-800",
    },
    takeaway: {
      label: "外帶",
      emoji: "🛍️",
      bgClass: "bg-green-100",
      textClass: "text-green-800",
    },
    delivery: {
      label: "外送",
      emoji: "🛵",
      bgClass: "bg-amber-100",
      textClass: "text-amber-800",
    },
  };
  return badges[type] || badges.dine_in;
}

// Platform Source Badge
function getPlatformBadge(source: string) {
  const badges: Record<
    string,
    { label: string; emoji: string; bgClass: string; textClass: string }
  > = {
    uber_eats: {
      label: "Uber Eats",
      emoji: "\uD83D\uDFE2",
      bgClass: "bg-green-100",
      textClass: "text-green-800",
    },
    foodpanda: {
      label: "Foodpanda",
      emoji: "\uD83E\uDE77",
      bgClass: "bg-pink-100",
      textClass: "text-pink-800",
    },
    grabfood: {
      label: "GrabFood",
      emoji: "\uD83D\uDFE0",
      bgClass: "bg-orange-100",
      textClass: "text-orange-800",
    },
  };
  return (
    badges[source] || {
      label: source,
      emoji: "\uD83D\uDCE6",
      bgClass: "bg-gray-100",
      textClass: "text-gray-800",
    }
  );
}

// Computed
const getCardClass = (status: string) => {
  const classes: Record<string, string> = {
    pending: "border-l-4 border-l-yellow-400 bg-yellow-50",
    preparing: "border-l-4 border-l-blue-500 bg-blue-50",
    ready: "border-l-4 border-l-green-500 bg-green-50",
  };
  return classes[status] || "";
};

const getPriorityClass = (priority: string) => {
  const classes: Record<string, string> = {
    normal: "status-badge bg-gray-100 text-gray-700",
    high: "status-badge bg-orange-100 text-orange-700",
    urgent: "status-badge bg-red-100 text-red-700 animate-pulse",
  };
  return classes[priority] || classes.normal;
};

const getPriorityText = (priority: string) => {
  const texts: Record<string, string> = {
    normal: "普通",
    high: "重要",
    urgent: "緊急",
  };
  return texts[priority] || "普通";
};

const getTimeClass = (elapsedMinutes: number) => {
  if (elapsedMinutes >= urgentThreshold.value) {
    return "time-critical text-sm font-bold";
  } else if (elapsedMinutes >= warningThreshold.value) {
    return "time-warning text-sm font-bold";
  }
  return "time-normal text-sm";
};

const getItemStatusIcon = (status: string) => {
  const icons: Record<string, any> = {
    pending: ClockIcon,
    preparing: FireIcon,
    ready: CheckCircleIcon,
    completed: CheckCircleIcon,
  };
  return icons[status] || ClockIcon;
};

const getItemStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    pending: "text-yellow-500",
    preparing: "text-blue-500",
    ready: "text-green-500",
    completed: "text-green-600",
  };
  return classes[status] || "text-gray-500";
};

const getProgressPercentage = (order: KitchenOrder) => {
  if (!order.estimatedTime) return 0;
  return Math.min(100, (order.elapsedTime / order.estimatedTime) * 100);
};

// Methods
const formatElapsedTime = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes}分鐘`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}時${remainingMinutes}分`;
};

const formatOrderTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const handleStartCooking = (itemId: number) => {
  emit("start-cooking", props.order.id, itemId);
};

const handleMarkReady = (itemId: number) => {
  emit("mark-ready", props.order.id, itemId);
};

const handleStartAll = () => {
  props.order.items
    .filter((item) => item.status === "pending")
    .forEach((item) => {
      emit("start-cooking", props.order.id, item.id);
    });
};

const handleMarkAllReady = () => {
  props.order.items
    .filter((item) => item.status === "preparing")
    .forEach((item) => {
      emit("mark-ready", props.order.id, item.id);
    });
};
</script>
