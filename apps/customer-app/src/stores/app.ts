import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Restaurant } from "@makanmakan/shared-types";

export const useAppStore = defineStore("app", () => {
  // State
  const isOnline = ref(navigator.onLine);
  const currentRestaurant = ref<Restaurant | null>(null);
  const currentTableId = ref<number | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const hasRestaurantContext = computed(() => {
    return currentRestaurant.value && currentTableId.value;
  });

  const isOfflineMode = computed(() => {
    return !isOnline.value;
  });

  // Actions
  const initialize = async () => {
    try {
      isLoading.value = true;

      // 監聽網路狀態變化
      window.addEventListener("online", () => {
        isOnline.value = true;
        console.log("網路連接恢復");
      });

      window.addEventListener("offline", () => {
        isOnline.value = false;
        console.log("網路連接中斷");
      });

      // 從 URL 或 localStorage 恢復餐廳上下文
      await restoreContext();
    } catch (err) {
      error.value = err instanceof Error ? err.message : "初始化失敗";
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const setRestaurantContext = (restaurant: Restaurant, tableId: number) => {
    currentRestaurant.value = restaurant;
    currentTableId.value = tableId;

    // 保存到 localStorage 以便恢復
    localStorage.setItem(
      "makanmakan_restaurant_context",
      JSON.stringify({
        restaurant,
        tableId,
        timestamp: Date.now(),
      }),
    );
  };

  const clearRestaurantContext = () => {
    currentRestaurant.value = null;
    currentTableId.value = null;
    localStorage.removeItem("makanmakan_restaurant_context");
  };

  const restoreContext = async () => {
    try {
      const saved = localStorage.getItem("makanmakan_restaurant_context");
      if (!saved) return;

      const { restaurant, tableId, timestamp } = JSON.parse(saved);

      // 檢查是否過期（24小時）
      if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
        clearRestaurantContext();
        return;
      }

      currentRestaurant.value = restaurant;
      currentTableId.value = tableId;
    } catch (err) {
      console.warn("恢復餐廳上下文失敗:", err);
      clearRestaurantContext();
    }
  };

  const setLoading = (loading: boolean) => {
    isLoading.value = loading;
  };

  const setError = (errorMessage: string | null) => {
    error.value = errorMessage;
  };

  const clearError = () => {
    error.value = null;
  };

  // PWA 相關
  const isInstallable = ref(false);
  const installPrompt = ref<any>(null);

  const handleInstallPrompt = (e: Event) => {
    e.preventDefault();
    installPrompt.value = e;
    isInstallable.value = true;
  };

  const installApp = async () => {
    if (!installPrompt.value) return;

    const result = await installPrompt.value.prompt();
    console.log("PWA 安裝結果:", result);

    installPrompt.value = null;
    isInstallable.value = false;
  };

  // 註冊 PWA 事件
  if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
  }

  return {
    // State
    isOnline,
    currentRestaurant,
    currentTableId,
    isLoading,
    error,
    isInstallable,

    // Getters
    hasRestaurantContext,
    isOfflineMode,

    // Actions
    initialize,
    setRestaurantContext,
    clearRestaurantContext,
    restoreContext,
    setLoading,
    setError,
    clearError,
    installApp,
  };
});
