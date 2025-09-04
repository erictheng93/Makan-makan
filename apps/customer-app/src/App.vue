<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <!-- 載入中指示器 -->
    <div
      v-if="isLoading"
      class="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50"
    >
      <div class="text-center">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"
        />
        <p class="mt-4 text-gray-600">載入中...</p>
      </div>
    </div>

    <!-- 錯誤邊界 -->
    <ErrorBoundary>
      <!-- 主要內容區域 -->
      <main class="flex-1">
        <RouterView />
      </main>
    </ErrorBoundary>

    <!-- 全域通知 -->
    <div id="toast-container" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onErrorCaptured } from "vue";
import { RouterView } from "vue-router";
import { useToast } from "vue-toastification";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();
const toast = useToast();
const isLoading = ref(true);

// 應用初始化
onMounted(async () => {
  try {
    await appStore.initialize();
  } catch (error) {
    console.error("應用初始化失敗:", error);
    toast.error("應用載入失敗，請刷新頁面重試");
  } finally {
    isLoading.value = false;
  }
});

// 全域錯誤處理
onErrorCaptured((error: Error) => {
  console.error("Vue錯誤:", error);
  toast.error("發生未預期的錯誤");
  return false;
});

// PWA 更新提示
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        console.log("Service Worker 註冊成功");
      })
      .catch(() => {
        console.log("Service Worker 註冊失敗");
      });
  });
}
</script>

<style>
/* 全域樣式重置 */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  font-family:
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    sans-serif;
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
}

#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* 自訂捲軸樣式 */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 頁面過渡動畫 */
.page-enter-active,
.page-leave-active {
  transition: all 0.3s ease;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* 手機端優化 */
@media (max-width: 768px) {
  html {
    font-size: 14px;
  }
}

/* 無障礙優化 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Focus 樣式 */
button:focus,
a:focus,
input:focus,
textarea:focus,
select:focus {
  outline: 2px solid #4f46e5;
  outline-offset: 2px;
}
</style>
