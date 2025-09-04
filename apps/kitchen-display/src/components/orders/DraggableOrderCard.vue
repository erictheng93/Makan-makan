<template>
  <div
    :class="[
      'draggable-order-card p-4 transition-all duration-200 hover:shadow-lg cursor-move',
      getCardClass(statusType),
      { 'animate-pulse-fast': order.priority === 'urgent' },
      { 'opacity-50': isDragging },
      { 'transform rotate-2 scale-105 shadow-2xl z-50': isDragging },
      { 'ring-2 ring-blue-500 ring-opacity-50': isSelected },
    ]"
    :data-order-id="order.id"
    :data-status="statusType"
  >
    <!-- Selection Checkbox -->
    <div class="absolute top-2 left-2 z-10">
      <input
        :checked="isSelected"
        type="checkbox"
        class="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
        @change="$emit('toggle-selection', order.id)"
        @click.stop
      />
    </div>

    <!-- Drag Handle -->
    <div
      class="drag-handle absolute top-2 right-2 text-gray-400 hover:text-gray-600"
    >
      <svg
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 8h16M4 16h16"
        />
      </svg>
    </div>

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
        <div class="text-sm text-gray-500">桌號 {{ order.tableName }}</div>
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

        <!-- Status Indicator -->
        <div class="text-xs text-gray-400">拖拽到其他欄位改變狀態</div>
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

    <!-- Drop Zone Indicator -->
    <div
      v-show="isDragOver && !isDragging"
      class="absolute inset-0 bg-blue-500 bg-opacity-20 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center"
    >
      <div class="text-blue-700 font-medium">放置到此處</div>
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
  isDragging?: boolean;
  isDragOver?: boolean;
  isSelected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isDragging: false,
  isDragOver: false,
  isSelected: false,
});

// Emits
const emit = defineEmits<{
  "start-cooking": [orderId: number, itemId: number];
  "mark-ready": [orderId: number, itemId: number];
  "view-details": [order: KitchenOrder];
  "toggle-selection": [orderId: number];
}>();

// Settings
const settingsStore = useSettingsStore();
const {
  showEstimatedTime,
  showCustomerNames,
  urgentThreshold,
  warningThreshold,
} = storeToRefs(settingsStore);

// Computed
const getCardClass = (status: string) => {
  const classes: Record<string, string> = {
    pending: "border-l-4 border-l-yellow-400 bg-yellow-50 relative",
    preparing: "border-l-4 border-l-blue-500 bg-blue-50 relative",
    ready: "border-l-4 border-l-green-500 bg-green-50 relative",
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

<style scoped>
.draggable-order-card {
  position: relative;
}

.drag-handle {
  opacity: 0;
  transition: opacity 0.2s;
}

.draggable-order-card:hover .drag-handle {
  opacity: 1;
}

.animate-pulse-fast {
  animation: pulse-fast 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse-fast {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* Drag states */
.sortable-ghost {
  opacity: 0.5;
  background-color: rgb(59 130 246 / 0.1);
  border: 2px dashed rgb(59 130 246);
}

.sortable-drag {
  opacity: 1;
  transform: rotate(5deg);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}
</style>
