<template>
  <div class="fixed bottom-4 left-4 z-50">
    <!-- Connection Status Card -->
    <div
      v-if="showDetails || connectionStatus !== 'connected'"
      :class="[
        'bg-white rounded-lg shadow-lg border p-4 transition-all duration-300',
        getConnectionBorderColor(),
        showDetails ? 'w-80' : 'w-auto',
      ]"
    >
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div
            :class="[
              'w-3 h-3 rounded-full',
              getConnectionDotColor(),
              connectionStatus === 'connecting' ? 'animate-pulse' : '',
            ]"
          />
          <div>
            <div class="text-sm font-medium text-gray-900">
              {{ getConnectionTitle() }}
            </div>
            <div class="text-xs text-gray-500">
              {{ getConnectionDescription() }}
            </div>
          </div>
        </div>

        <!-- Toggle Details Button -->
        <button
          class="w-6 h-6 text-gray-400 hover:text-gray-600 transition-colors"
          :title="showDetails ? '收起詳情' : '顯示詳情'"
          @click="showDetails = !showDetails"
        >
          <ChevronUpIcon v-if="showDetails" class="w-4 h-4" />
          <ChevronDownIcon v-else class="w-4 h-4" />
        </button>
      </div>

      <!-- Details Panel -->
      <div v-if="showDetails" class="mt-4 pt-4 border-t border-gray-100">
        <div class="space-y-3">
          <!-- Connection Stats -->
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div class="text-gray-500">重連次數</div>
              <div class="font-medium">
                {{ reconnectAttempts }}
              </div>
            </div>
            <div>
              <div class="text-gray-500">最後心跳</div>
              <div class="font-medium">
                {{ formatLastHeartbeat() }}
              </div>
            </div>
          </div>

          <!-- Connection Actions -->
          <div class="flex space-x-2">
            <button
              v-if="connectionStatus !== 'connected'"
              class="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-md transition-colors"
              @click="$emit('reconnect')"
            >
              重新連線
            </button>
            <button
              class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-3 py-2 rounded-md transition-colors"
              @click="$emit('refresh')"
            >
              刷新資料
            </button>
          </div>

          <!-- Connection History -->
          <div v-if="connectionHistory.length > 0">
            <div class="text-xs text-gray-500 mb-2">連線歷史</div>
            <div class="max-h-20 overflow-y-auto space-y-1">
              <div
                v-for="(entry, index) in connectionHistory.slice(-5)"
                :key="index"
                class="flex justify-between text-xs"
              >
                <span :class="getHistoryStatusColor(entry.status)">
                  {{ getHistoryStatusText(entry.status) }}
                </span>
                <span class="text-gray-500">{{
                  formatTime(entry.timestamp)
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Minimized Status Indicator -->
    <div
      v-if="!showDetails && connectionStatus === 'connected'"
      class="w-12 h-12 bg-white rounded-full shadow-lg border border-green-200 flex items-center justify-center cursor-pointer hover:shadow-xl transition-all duration-300"
      title="SSE 連線狀態 - 點擊查看詳情"
      @click="showDetails = true"
    >
      <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/vue/24/outline";
import type { ConnectionStatus } from "@/types";

// Props
interface Props {
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  reconnectAttempts: number;
  lastHeartbeat: Date | null;
}

const props = defineProps<Props>();

// Emits
defineEmits<{
  reconnect: [];
  refresh: [];
}>();

// State
const showDetails = ref(false);
const connectionHistory = ref<
  Array<{
    status: ConnectionStatus;
    timestamp: Date;
  }>
>([]);

// Watch connection status changes and log history
watch(
  () => props.connectionStatus,
  (newStatus, oldStatus) => {
    if (newStatus !== oldStatus) {
      connectionHistory.value.push({
        status: newStatus,
        timestamp: new Date(),
      });

      // Keep only last 20 entries
      if (connectionHistory.value.length > 20) {
        connectionHistory.value = connectionHistory.value.slice(-20);
      }
    }
  },
);

// Methods
const getConnectionTitle = () => {
  const titles = {
    connected: "SSE 已連線",
    connecting: "正在連線",
    disconnected: "SSE 離線",
    error: "連線錯誤",
  };
  return titles[props.connectionStatus] || "未知狀態";
};

const getConnectionDescription = () => {
  const descriptions = {
    connected: "即時訂單更新已啟用",
    connecting: "正在建立連線...",
    disconnected: "即時更新暫停",
    error: "連線發生錯誤",
  };
  return descriptions[props.connectionStatus] || "狀態未知";
};

const getConnectionDotColor = () => {
  const colors = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500",
    disconnected: "bg-red-500",
    error: "bg-red-500",
  };
  return colors[props.connectionStatus] || "bg-gray-500";
};

const getConnectionBorderColor = () => {
  const colors = {
    connected: "border-green-200",
    connecting: "border-yellow-200",
    disconnected: "border-red-200",
    error: "border-red-200",
  };
  return colors[props.connectionStatus] || "border-gray-200";
};

const getHistoryStatusColor = (status: ConnectionStatus) => {
  const colors = {
    connected: "text-green-600",
    connecting: "text-yellow-600",
    disconnected: "text-red-600",
    error: "text-red-600",
  };
  return colors[status] || "text-gray-600";
};

const getHistoryStatusText = (status: ConnectionStatus) => {
  const texts = {
    connected: "已連線",
    connecting: "連線中",
    disconnected: "離線",
    error: "錯誤",
  };
  return texts[status] || "未知";
};

const formatLastHeartbeat = () => {
  if (!props.lastHeartbeat) return "無";

  const now = new Date();
  const diff = now.getTime() - props.lastHeartbeat.getTime();

  if (diff < 60000) {
    // Less than 1 minute
    return `${Math.floor(diff / 1000)}秒前`;
  } else if (diff < 3600000) {
    // Less than 1 hour
    return `${Math.floor(diff / 60000)}分前`;
  } else {
    return props.lastHeartbeat.toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

// Auto-hide details when connected for more than 10 seconds
let hideTimer: NodeJS.Timeout | null = null;

watch(
  () => props.connectionStatus,
  (status) => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    if (status === "connected" && showDetails.value) {
      hideTimer = setTimeout(() => {
        showDetails.value = false;
      }, 10000); // Hide after 10 seconds when connected
    }
  },
);

// Show details automatically when there are connection issues
watch(
  () => props.connectionStatus,
  (status) => {
    if (status === "error" || status === "disconnected") {
      showDetails.value = true;
    }
  },
);

onMounted(() => {
  // Initial connection history entry
  connectionHistory.value.push({
    status: props.connectionStatus,
    timestamp: new Date(),
  });
});
</script>
