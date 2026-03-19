<template>
  <!-- Global Error Boundary Component -->
  <div
    v-if="hasError"
    class="min-h-screen flex items-center justify-center bg-[#F2F2F7] py-12 px-4"
  >
    <div
      class="bg-white rounded-2xl shadow-card p-6 text-center max-w-md mx-auto mt-20 w-full"
    >
      <!-- Icon -->
      <AlertTriangle class="w-12 h-12 text-ios-red mx-auto" />

      <!-- Title -->
      <h2 class="text-lg font-bold text-ios-text mt-4">發生錯誤</h2>

      <!-- Message -->
      <p class="text-sm text-ios-secondary mt-2">
        {{ errorMessage }}
      </p>

      <!-- Error Details (Developer Mode) -->
      <div v-if="isDevelopment && errorDetails" class="mt-4 text-left">
        <div
          class="bg-gray-100 rounded-xl p-3 text-xs font-mono text-gray-700 overflow-auto max-h-40"
        >
          {{ errorDetails }}
        </div>
      </div>

      <!-- Retry Button -->
      <button
        :disabled="retrying"
        class="bg-ios-blue text-white rounded-full px-6 py-3 font-bold mt-6 min-h-[44px] w-full disabled:opacity-50 transition-opacity duration-200"
        @click="retryOperation"
      >
        <span class="flex items-center justify-center gap-2">
          <RefreshCw v-if="retrying" class="w-4 h-4 animate-spin" />
          {{ retrying ? "重試中..." : "重試" }}
        </span>
      </button>

      <!-- Secondary Actions -->
      <div class="flex flex-col gap-3 mt-3">
        <button
          class="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-full border border-gray-200 text-sm font-medium text-ios-text bg-white hover:bg-gray-50 min-h-[44px] transition-colors duration-200"
          @click="reloadApplication"
        >
          <RefreshCw class="w-4 h-4" />
          重新載入應用
        </button>

        <button
          class="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-full border border-gray-200 text-sm font-medium text-ios-text bg-white hover:bg-gray-50 min-h-[44px] transition-colors duration-200"
          @click="reportError"
        >
          <Bug class="w-4 h-4" />
          回報問題
        </button>
      </div>

      <!-- System Status -->
      <div class="mt-6 pt-5 border-t border-gray-100 text-left">
        <h4 class="text-sm font-semibold text-ios-text mb-3">系統狀態</h4>
        <div class="grid grid-cols-2 gap-2 text-xs text-ios-secondary">
          <div class="flex items-center gap-1.5">
            <div
              :class="[
                'w-2 h-2 rounded-full flex-shrink-0',
                networkStatus === 'online' ? 'bg-ios-green' : 'bg-ios-red',
              ]"
            />
            網路: {{ networkStatus === "online" ? "正常" : "離線" }}
          </div>
          <div class="flex items-center gap-1.5">
            <div
              :class="[
                'w-2 h-2 rounded-full flex-shrink-0',
                storageAvailable ? 'bg-ios-green' : 'bg-ios-red',
              ]"
            />
            儲存: {{ storageAvailable ? "可用" : "錯誤" }}
          </div>
          <div class="flex items-center gap-1.5">
            <div
              :class="[
                'w-2 h-2 rounded-full flex-shrink-0',
                memoryStatus === 'normal' ? 'bg-ios-green' : 'bg-ios-orange',
              ]"
            />
            記憶體: {{ memoryStatus === "normal" ? "正常" : "偏高" }}
          </div>
          <div class="flex items-center gap-1.5">
            <div class="w-2 h-2 rounded-full flex-shrink-0 bg-ios-blue" />
            版本: {{ appVersion }}
          </div>
        </div>
      </div>

      <!-- Recovery Mode Toggle -->
      <div class="mt-4 pt-4 border-t border-gray-100">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            v-model="safeMode"
            type="checkbox"
            class="rounded border-gray-300 text-ios-blue focus:ring-ios-blue"
          />
          <span class="text-sm text-ios-secondary"
            >啟用安全模式（停用進階功能）</span
          >
        </label>
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
import { AlertTriangle, RefreshCw, Bug } from "lucide-vue-next";
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
