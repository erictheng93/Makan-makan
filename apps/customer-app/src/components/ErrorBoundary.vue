<template>
  <div
    v-if="hasError"
    class="min-h-screen bg-gray-50 flex items-center justify-center p-4"
  >
    <div class="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
      <!-- 錯誤圖標 -->
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

      <!-- 錯誤標題 -->
      <h1 class="text-xl font-bold text-gray-900 mb-2">
        {{ errorTitle }}
      </h1>

      <!-- 錯誤描述 -->
      <p class="text-gray-600 mb-6">
        {{ errorMessage }}
      </p>

      <!-- 操作按鈕 -->
      <div class="space-y-3">
        <button
          class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          @click="handleRetry"
        >
          重新載入
        </button>

        <button
          class="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-colors"
          @click="handleGoHome"
        >
          回到首頁
        </button>
      </div>

      <!-- 錯誤詳情（開發模式） -->
      <details v-if="isDevelopment && errorDetails" class="mt-6 text-left">
        <summary
          class="cursor-pointer text-sm text-gray-500 hover:text-gray-700"
        >
          顯示錯誤詳情
        </summary>
        <div class="mt-2 p-3 bg-gray-100 rounded-lg">
          <pre
            class="text-xs text-gray-700 whitespace-pre-wrap overflow-auto"
            >{{ errorDetails }}</pre
          >
        </div>
      </details>

      <!-- 回報問題 -->
      <div class="mt-6 pt-6 border-t border-gray-200">
        <p class="text-sm text-gray-500 mb-2">問題持續發生？</p>
        <button
          class="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
          @click="handleReportError"
        >
          回報問題
        </button>
      </div>
    </div>
  </div>

  <!-- 正常渲染子組件 -->
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, computed } from "vue";
import { useRouter } from "vue-router";

// Composables
const router = useRouter();

// State
const hasError = ref(false);
const error = ref<Error | null>(null);
const errorInfo = ref<any>(null);

// Computed
const isDevelopment = computed(() => import.meta.env.DEV);

const errorTitle = computed(() => {
  if (!error.value) return "發生錯誤";

  // 根據不同錯誤類型返回適當的標題
  if (error.value.name === "ChunkLoadError") {
    return "載入失敗";
  }

  if (error.value.name === "NetworkError") {
    return "網路連接問題";
  }

  if (error.value.message?.includes("Loading chunk")) {
    return "載入失敗";
  }

  return "應用程式錯誤";
});

const errorMessage = computed(() => {
  if (!error.value) return "發生未預期的錯誤，請重新載入頁面。";

  // 根據不同錯誤類型返回適當的訊息
  if (
    error.value.name === "ChunkLoadError" ||
    error.value.message?.includes("Loading chunk")
  ) {
    return "應用程式更新中，請重新載入頁面以取得最新版本。";
  }

  if (error.value.name === "NetworkError") {
    return "網路連接有問題，請檢查您的網路連接並重試。";
  }

  if (error.value.message?.includes("fetch")) {
    return "無法連接到伺服器，請檢查網路連接或稍後再試。";
  }

  // 生產環境不顯示具體錯誤訊息
  if (!isDevelopment.value) {
    return "發生未預期的錯誤，我們正在處理這個問題。";
  }

  return error.value.message || "未知錯誤";
});

const errorDetails = computed(() => {
  if (!error.value || !isDevelopment.value) return null;

  const details = {
    name: error.value.name,
    message: error.value.message,
    stack: error.value.stack,
    componentStack: errorInfo.value?.componentStack,
    timestamp: new Date().toISOString(),
  };

  return JSON.stringify(details, null, 2);
});

// Error handler
onErrorCaptured((err: Error, instance, info) => {
  console.error("ErrorBoundary captured an error:", err);
  console.error("Component stack:", info);

  error.value = err;
  errorInfo.value = { componentStack: info };
  hasError.value = true;

  // 回報錯誤到監控服務（如果有設定）
  if (import.meta.env.VITE_ERROR_REPORTING_ENDPOINT) {
    reportError(err, info);
  }

  return false; // 阻止錯誤繼續向上傳播
});

// Methods
const handleRetry = () => {
  // 重置錯誤狀態
  hasError.value = false;
  error.value = null;
  errorInfo.value = null;

  // 重新載入頁面
  window.location.reload();
};

const handleGoHome = () => {
  // 重置錯誤狀態
  hasError.value = false;
  error.value = null;
  errorInfo.value = null;

  // 導航到首頁
  router.push("/");
};

const handleReportError = () => {
  const errorReport = {
    error: {
      name: error.value?.name,
      message: error.value?.message,
      stack: error.value?.stack,
    },
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString(),
  };

  // 複製錯誤報告到剪貼板
  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(JSON.stringify(errorReport, null, 2))
      .then(() => {
        alert("錯誤報告已複製到剪貼板，請貼上至問題回報表單中。");
      })
      .catch(() => {
        // 降級處理
        prompt("請複製以下錯誤報告並回報給我們：", JSON.stringify(errorReport));
      });
  } else {
    prompt("請複製以下錯誤報告並回報給我們：", JSON.stringify(errorReport));
  }
};

const reportError = async (err: Error, componentStack: string) => {
  try {
    const endpoint = import.meta.env.VITE_ERROR_REPORTING_ENDPOINT;
    if (!endpoint) return;

    const errorReport = {
      name: err.name,
      message: err.message,
      stack: err.stack,
      componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      userId: localStorage.getItem("user_id") || "anonymous",
      sessionId: localStorage.getItem("session_id") || "unknown",
    };

    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(errorReport),
    });
  } catch (reportingError) {
    console.error("Failed to report error:", reportingError);
  }
};

// 全域錯誤處理
if (typeof window !== "undefined") {
  // 處理未捕獲的 Promise rejection
  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);

    const syntheticError = new Error(
      event.reason?.message || "Unhandled promise rejection",
    );
    syntheticError.name = "UnhandledPromiseRejection";
    syntheticError.stack = event.reason?.stack;

    error.value = syntheticError;
    hasError.value = true;

    event.preventDefault();
  });

  // 處理其他 JavaScript 錯誤
  window.addEventListener("error", (event) => {
    console.error("Global error:", event.error);

    error.value = event.error || new Error(event.message);
    hasError.value = true;
  });
}
</script>
