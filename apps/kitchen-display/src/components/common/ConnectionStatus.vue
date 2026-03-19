<template>
  <div class="flex items-center gap-1.5">
    <div
      :class="[
        'w-2 h-2 rounded-full',
        dotClass,
        connectionStatus === 'connecting' ? 'animate-pulse' : '',
      ]"
    />
    <span :class="['text-xs font-semibold', textClass]">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from "vue";
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

// Computed style helpers
const dotClass = computed(() => {
  const map: Record<ConnectionStatus, string> = {
    connected: "bg-ios-green",
    connecting: "bg-ios-orange",
    disconnected: "bg-ios-red",
    error: "bg-ios-red",
  };
  return map[props.connectionStatus] ?? "bg-ios-secondary";
});

const textClass = computed(() => {
  const map: Record<ConnectionStatus, string> = {
    connected: "text-ios-green",
    connecting: "text-ios-orange",
    disconnected: "text-ios-red",
    error: "text-ios-red",
  };
  return map[props.connectionStatus] ?? "text-ios-secondary";
});

const label = computed(() => {
  const map: Record<ConnectionStatus, string> = {
    connected: "已連線",
    connecting: "連線中...",
    disconnected: "已斷線",
    error: "已斷線",
  };
  return map[props.connectionStatus] ?? "未知狀態";
});

// Utility methods kept for external use / history tracking
const formatLastHeartbeat = () => {
  if (!props.lastHeartbeat) return "無";

  const now = new Date();
  const diff = now.getTime() - props.lastHeartbeat.getTime();

  if (diff < 60000) {
    return `${Math.floor(diff / 1000)}秒前`;
  } else if (diff < 3600000) {
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

onMounted(() => {
  // Initial connection history entry
  connectionHistory.value.push({
    status: props.connectionStatus,
    timestamp: new Date(),
  });
});

defineExpose({ formatLastHeartbeat, formatTime, connectionHistory });
</script>
