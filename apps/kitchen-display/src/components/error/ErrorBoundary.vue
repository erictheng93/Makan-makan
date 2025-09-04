<template>
  <!-- Global Error Boundary Component -->
  <div
    v-if="hasError"
    class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8"
  >
    <div class="max-w-md w-full space-y-8">
      <div class="text-center">
        <div class="mx-auto h-12 w-12 text-red-500">
          <ExclamationTriangleIcon class="h-12 w-12" />
        </div>
        <h2 class="mt-6 text-3xl font-extrabold text-gray-900">系統發生錯誤</h2>
        <p class="mt-2 text-sm text-gray-600">
          {{ errorMessage }}
        </p>
      </div>

      <div class="bg-white shadow-lg rounded-lg p-6">
        <!-- Error Details (Developer Mode) -->
        <div v-if="isDevelopment && errorDetails" class="mb-6">
          <h3 class="text-lg font-medium text-gray-900 mb-3">錯誤詳情</h3>
          <div
            class="bg-gray-100 rounded p-3 text-sm font-mono text-gray-800 overflow-auto max-h-40"
          >
            {{ errorDetails }}
          </div>
        </div>

        <!-- Error Actions -->
        <div class="flex flex-col space-y-3">
          <button
            :disabled="retrying"
            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            @click="retryOperation"
          >
            <ArrowPathIcon
              v-if="retrying"
              class="animate-spin -ml-1 mr-2 h-4 w-4"
            />
            {{ retrying ? "重試中..." : "重試" }}
          </button>

          <button
            class="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            @click="reloadApplication"
          >
            <ArrowPathIcon class="-ml-1 mr-2 h-4 w-4" />
            重新載入應用
          </button>

          <button
            class="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            @click="reportError"
          >
            <BugAntIcon class="-ml-1 mr-2 h-4 w-4" />
            回報問題
          </button>
        </div>

        <!-- System Status -->
        <div class="mt-6 pt-6 border-t border-gray-200">
          <h4 class="text-sm font-medium text-gray-900 mb-2">系統狀態</h4>
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="flex items-center">
              <div
                :class="[
                  'w-2 h-2 rounded-full mr-2',
                  networkStatus === 'online' ? 'bg-green-500' : 'bg-red-500',
                ]"
              />
              網路連線: {{ networkStatus === "online" ? "正常" : "離線" }}
            </div>
            <div class="flex items-center">
              <div
                :class="[
                  'w-2 h-2 rounded-full mr-2',
                  storageAvailable ? 'bg-green-500' : 'bg-red-500',
                ]"
              />
              本地儲存: {{ storageAvailable ? "可用" : "錯誤" }}
            </div>
            <div class="flex items-center">
              <div
                :class="[
                  'w-2 h-2 rounded-full mr-2',
                  memoryStatus === 'normal' ? 'bg-green-500' : 'bg-yellow-500',
                ]"
              />
              記憶體: {{ memoryStatus === "normal" ? "正常" : "偏高" }}
            </div>
            <div class="flex items-center">
              <div class="w-2 h-2 rounded-full mr-2 bg-blue-500" />
              版本: {{ appVersion }}
            </div>
          </div>
        </div>

        <!-- Recovery Mode Toggle -->
        <div class="mt-4 pt-4 border-t border-gray-200">
          <label class="flex items-center">
            <input
              v-model="safeMode"
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span class="ml-2 text-sm text-gray-600"
              >啟用安全模式（停用進階功能）</span
            >
          </label>
        </div>
      </div>
    </div>
  </div>

  <!-- Normal content when no error -->
  <div v-else>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onErrorCaptured } from "vue";
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  BugAntIcon,
} from "@heroicons/vue/24/outline";
import { useToast } from "vue-toastification";
import { errorReportingService } from "@/services/errorReportingService";

// State
const hasError = ref(false);
const error = ref<Error | null>(null);
const errorMessage = ref("發生未預期的錯誤");
const errorDetails = ref("");
const retrying = ref(false);
const safeMode = ref(false);

// System status
const networkStatus = ref<"online" | "offline">("online");
const storageAvailable = ref(true);
const memoryStatus = ref<"normal" | "high">("normal");
const appVersion = ref(__APP_VERSION__ || "1.0.0");

// Environment
const isDevelopment = computed(() => import.meta.env.DEV);

const toast = useToast();

// Error capture
onErrorCaptured((err: Error, instance: any, info: string) => {
  console.error("ErrorBoundary caught error:", err);
  console.error("Error info:", info);
  console.error("Component instance:", instance);

  captureError(err, info);
  return false; // Prevent error from propagating
});

// Global error handlers
onMounted(() => {
  // Capture unhandled Promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
    captureError(new Error(event.reason), "unhandledrejection");
    event.preventDefault();
  });

  // Capture general errors
  window.addEventListener("error", (event) => {
    console.error("Global error:", event.error);
    captureError(event.error, "global");
  });

  // Monitor system status
  setupSystemMonitoring();
});

function captureError(err: Error, context: string) {
  hasError.value = true;
  error.value = err;
  errorMessage.value = err.message || "發生未知錯誤";
  errorDetails.value = err.stack || "";

  // Report error to service
  errorReportingService.reportError(err, {
    component: context,
    url: window.location.href,
    userAgent: navigator.userAgent,
  });

  // Show toast notification for non-critical errors
  if (!isCriticalError(err)) {
    toast.error("系統發生錯誤，請重試或重新載入頁面");
  }
}

function isCriticalError(err: Error): boolean {
  const criticalErrors = [
    "ChunkLoadError",
    "ReferenceError",
    "TypeError",
    "SyntaxError",
  ];

  return criticalErrors.some(
    (type) => err.name === type || err.message.includes(type),
  );
}

async function retryOperation() {
  retrying.value = true;

  try {
    // Wait a moment
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Clear error state
    hasError.value = false;
    error.value = null;
    errorMessage.value = "";
    errorDetails.value = "";

    toast.success("重試成功");
  } catch (err) {
    toast.error("重試失敗");
    console.error("Retry failed:", err);
  } finally {
    retrying.value = false;
  }
}

function reloadApplication() {
  // Save safe mode preference
  if (safeMode.value) {
    localStorage.setItem("kitchen-safe-mode", "true");
  }

  window.location.reload();
}

async function reportError() {
  if (!error.value) return;

  try {
    const report = {
      error: {
        name: error.value.name,
        message: error.value.message,
        stack: error.value.stack,
      },
      systemInfo: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        appVersion: appVersion.value,
      },
      systemStatus: {
        networkStatus: networkStatus.value,
        storageAvailable: storageAvailable.value,
        memoryStatus: memoryStatus.value,
      },
    };

    await errorReportingService.submitErrorReport(report);
    toast.success("錯誤報告已提交");
  } catch (err) {
    console.error("Failed to submit error report:", err);
    toast.error("提交錯誤報告失敗");
  }
}

function setupSystemMonitoring() {
  // Network status monitoring
  const updateNetworkStatus = () => {
    networkStatus.value = navigator.onLine ? "online" : "offline";
  };

  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  updateNetworkStatus();

  // Storage availability check
  try {
    localStorage.setItem("test", "test");
    localStorage.removeItem("test");
    storageAvailable.value = true;
  } catch {
    storageAvailable.value = false;
  }

  // Memory monitoring (if available)
  if ("memory" in performance) {
    const checkMemory = () => {
      const memory = (performance as any).memory;
      const usedMemory = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      memoryStatus.value = usedMemory > 0.8 ? "high" : "normal";
    };

    checkMemory();
    setInterval(checkMemory, 30000); // Check every 30 seconds
  }

  // Check for safe mode
  const safeModeEnabled = localStorage.getItem("kitchen-safe-mode");
  if (safeModeEnabled === "true") {
    safeMode.value = true;
    localStorage.removeItem("kitchen-safe-mode");
  }
}

// Recovery helpers
const resetErrorBoundary = () => {
  hasError.value = false;
  error.value = null;
  errorMessage.value = "";
  errorDetails.value = "";
};

const isInSafeMode = (): boolean => {
  return safeMode.value;
};

// Expose for testing
defineExpose({
  captureError,
  retryOperation,
  resetErrorBoundary,
  isInSafeMode,
});
</script>

<style scoped>
/* Animation for error boundary */
.error-boundary-enter-active {
  transition: opacity 0.3s ease-in-out;
}

.error-boundary-enter-from {
  opacity: 0;
}

/* Custom scrollbar for error details */
.overflow-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.overflow-auto::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 2px;
}

.overflow-auto::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
