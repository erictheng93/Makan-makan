<template>
  <div class="space-y-4 p-6">
    <h2 class="text-xl font-bold">{{ t("exampleUsage.title") }}</h2>

    <!-- ErrorDisplay 組件自動處理全局錯誤 -->
    <ErrorDisplay
      :show-connection-indicator="true"
      :show-offline-support="true"
      :enable-recovery-panel="true"
      position="top-right"
    />

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- API 錯誤測試 -->
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="font-semibold mb-3">{{ t("exampleUsage.apiErrorTest") }}</h3>
        <div class="space-y-2">
          <button
            class="w-full px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            @click="testNetworkError"
          >
            {{ t("exampleUsage.testNetworkError") }}
          </button>
          <button
            class="w-full px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
            @click="testAPIError"
          >
            {{ t("exampleUsage.testAPIError") }}
          </button>
          <button
            class="w-full px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            @click="testAuthError"
          >
            {{ t("exampleUsage.testAuthError") }}
          </button>
        </div>
      </div>

      <!-- SSE 連接測試 -->
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="font-semibold mb-3">
          {{ t("exampleUsage.sseConnectionTest") }}
        </h3>
        <div class="space-y-2">
          <div class="flex items-center space-x-2">
            <div
              :class="[
                'w-3 h-3 rounded-full',
                sseStatus.isConnected ? 'bg-green-500' : 'bg-red-500',
              ]"
            />
            <span class="text-sm">
              {{
                sseStatus.isConnected
                  ? t("exampleUsage.connected")
                  : t("exampleUsage.disconnected")
              }}
            </span>
          </div>
          <button
            class="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            @click="toggleSSE"
          >
            {{
              sseStatus.isConnected
                ? t("exampleUsage.disconnectSSE")
                : t("exampleUsage.connectSSE")
            }}
          </button>
          <button
            class="w-full px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            @click="forceSSEReconnect"
          >
            {{ t("exampleUsage.forceReconnectSSE") }}
          </button>
        </div>
      </div>

      <!-- 離線模式測試 -->
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="font-semibold mb-3">
          {{ t("exampleUsage.offlineModeTest") }}
        </h3>
        <div class="space-y-2">
          <div class="flex items-center space-x-2">
            <div
              :class="[
                'w-3 h-3 rounded-full',
                isOnline ? 'bg-green-500' : 'bg-red-500',
              ]"
            />
            <span class="text-sm">
              {{
                isOnline ? t("exampleUsage.online") : t("exampleUsage.offline")
              }}
            </span>
          </div>
          <button
            class="w-full px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            @click="simulateOffline"
          >
            {{ t("exampleUsage.simulateOffline") }}
          </button>
          <button
            class="w-full px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
            @click="testOfflineRequest"
          >
            {{ t("exampleUsage.testOfflineRequest") }}
          </button>
        </div>
      </div>
    </div>

    <!-- 錯誤日誌顯示 -->
    <div class="bg-gray-50 rounded-lg p-4">
      <h3 class="font-semibold mb-3">{{ t("exampleUsage.errorLogs") }}</h3>
      <div class="max-h-64 overflow-y-auto space-y-1">
        <div
          v-for="(log, index) in errorLogs"
          :key="index"
          class="text-xs font-mono p-2 bg-white rounded border-l-4"
          :class="{
            'border-red-500':
              log.severity === 'high' || log.severity === 'critical',
            'border-yellow-500': log.severity === 'medium',
            'border-blue-500': log.severity === 'low',
          }"
        >
          <div class="flex justify-between items-start">
            <span class="font-semibold">{{ log.type }}</span>
            <span class="text-gray-500">{{ formatTime(log.timestamp) }}</span>
          </div>
          <div class="text-gray-700">
            {{ log.message }}
          </div>
        </div>

        <div
          v-if="errorLogs.length === 0"
          class="text-gray-500 text-center py-4"
        >
          {{ t("exampleUsage.noErrorLogs") }}
        </div>
      </div>

      <button
        class="mt-2 px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
        @click="clearErrorLogs"
      >
        {{ t("exampleUsage.clearLogs") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "@/i18n";
import { KitchenErrorHandler } from "@/utils/errorHandler";
import { useStatisticsSSE } from "@/composables/useStatisticsSSE";
import { api } from "@/services/api";

const { t } = useI18n();

// SSE 連接狀態
const sse = useStatisticsSSE({ autoConnect: false });
const sseStatus = ref({
  isConnected: false,
});

// 網絡狀態
const isOnline = ref(navigator.onLine);

// 錯誤日誌
const errorLogs = ref<
  Array<{
    type: string;
    severity: string;
    message: string;
    timestamp: Date;
  }>
>([]);

// API 錯誤測試方法
const testNetworkError = async () => {
  try {
    // 模擬網絡錯誤
    const error = new Error("Network connection failed");
    error.name = "NetworkError";
    throw error;
  } catch (error) {
    KitchenErrorHandler.handleAPIError(error, {
      context: "Manual network error test",
    });
    addErrorLog("network", "high", t("exampleUsage.networkFailed"));
  }
};

const testAPIError = async () => {
  try {
    // 發送一個會失敗的 API 請求
    await api.get("/non-existent-endpoint");
  } catch {
    addErrorLog("api", "medium", t("exampleUsage.apiEndpointNotFound"));
  }
};

const testAuthError = async () => {
  try {
    // 模擬認證錯誤
    const error = new Error("Authentication failed");
    Object.assign(error, {
      response: {
        status: 401,
        data: { error: { message: "Token expired" } },
      },
    });
    throw error;
  } catch (error) {
    KitchenErrorHandler.handleAPIError(error, {
      context: "Manual auth error test",
    });
    addErrorLog("permission", "high", t("exampleUsage.tokenExpired"));
  }
};

// SSE 測試方法
const toggleSSE = () => {
  if (sseStatus.value.isConnected) {
    sse.disconnect();
    sseStatus.value.isConnected = false;
  } else {
    sse.connect();
    sseStatus.value.isConnected = true;
  }
};

const forceSSEReconnect = () => {
  sse.reconnect();
  addErrorLog("sse", "low", t("exampleUsage.sseForceReconnect"));
};

// 離線模式測試
const simulateOffline = () => {
  // 模擬離線狀態（僅用於演示）
  isOnline.value = !isOnline.value;

  // 觸發離線/在線事件
  if (isOnline.value) {
    window.dispatchEvent(new Event("online"));
  } else {
    window.dispatchEvent(new Event("offline"));
  }

  addErrorLog(
    "network",
    "medium",
    isOnline.value
      ? t("exampleUsage.networkRestored")
      : t("exampleUsage.networkDisconnected"),
  );
};

const testOfflineRequest = async () => {
  if (!isOnline.value) {
    try {
      // 在離線狀態下嘗試 API 請求
      await api.get("/analytics/dashboard", {
        offlineStrategy: "queue",
      } as any);
    } catch {
      addErrorLog("network", "medium", t("exampleUsage.offlineRequestQueued"));
    }
  } else {
    addErrorLog("info", "low", t("exampleUsage.currentlyOnline"));
  }
};

// 工具方法
const addErrorLog = (type: string, severity: string, message: string) => {
  errorLogs.value.unshift({
    type,
    severity,
    message,
    timestamp: new Date(),
  });

  // 限制日誌數量
  if (errorLogs.value.length > 50) {
    errorLogs.value = errorLogs.value.slice(0, 50);
  }
};

const clearErrorLogs = () => {
  errorLogs.value = [];
};

const formatTime = (timestamp: Date) => {
  return timestamp.toLocaleTimeString();
};

// 監聽網絡狀態變化
const handleOnlineStatusChange = () => {
  isOnline.value = navigator.onLine;
};

// 監聽 SSE 狀態變化
const handleSSEStatusChange = () => {
  sseStatus.value.isConnected = sse.isConnected.value;
};

onMounted(() => {
  // 監聽網絡狀態
  window.addEventListener("online", handleOnlineStatusChange);
  window.addEventListener("offline", handleOnlineStatusChange);

  // 監聽 SSE 狀態變化
  setInterval(handleSSEStatusChange, 1000);
});

onUnmounted(() => {
  window.removeEventListener("online", handleOnlineStatusChange);
  window.removeEventListener("offline", handleOnlineStatusChange);
});
</script>
