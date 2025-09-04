import { ref, onUnmounted, type Ref } from "vue";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/services/api";

interface UsePollingReturn<T> {
  data: Ref<T | null>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  isActive: Ref<boolean>;
  start: () => void;
  stop: () => void;
  refresh: () => void;
}

export function usePolling<T>(
  fetchFunction: () => Promise<T>,
  interval: number = 5000,
  immediate: boolean = true,
): UsePollingReturn<T> {
  const data = ref<T | null>(null) as Ref<T | null>;
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isActive = ref(false);

  let pollTimer: number | null = null;

  const authStore = useAuthStore();

  const poll = async () => {
    if (!authStore.isAuthenticated) {
      stop();
      return;
    }

    try {
      isLoading.value = true;
      error.value = null;
      const result = await fetchFunction();
      data.value = result;
    } catch (err: any) {
      error.value = err.message || "Polling failed";
      console.error("Polling error:", err);
    } finally {
      isLoading.value = false;
    }
  };

  const start = () => {
    if (isActive.value || !authStore.isAuthenticated) return;

    isActive.value = true;

    if (immediate) {
      poll();
    }

    pollTimer = window.setInterval(poll, interval);
  };

  const stop = () => {
    isActive.value = false;

    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const refresh = () => {
    poll();
  };

  onUnmounted(() => {
    stop();
  });

  return {
    data,
    isLoading,
    error,
    isActive,
    start,
    stop,
    refresh,
  };
}

// Specific polling composables for common use cases
export function useOrderPolling(interval: number = 10000) {
  const authStore = useAuthStore();

  return usePolling(async () => {
    const response = await api.get(
      `/orders?restaurant_id=${authStore.restaurantId}&status=pending,confirmed,preparing`,
    );
    return response.data.data;
  }, interval);
}

export function useDashboardPolling(interval: number = 30000) {
  const authStore = useAuthStore();

  return usePolling(async () => {
    const response = await api.get(
      `/analytics/dashboard?restaurant_id=${authStore.restaurantId}`,
    );
    return response.data.data;
  }, interval);
}
