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

function buildRestaurantScopedUrl(
  path: string,
  restaurantId: string | number | null | undefined,
  params: Record<string, string | number | boolean> = {},
): string | null {
  if (!restaurantId) {
    return null;
  }

  const searchParams = new URLSearchParams(
    Object.entries({
      ...params,
      restaurantId,
    }).map(([key, value]) => [key, String(value)]),
  );

  return `${path}?${searchParams.toString()}`;
}

// Specific polling composables for common use cases
export function useOrderPolling(interval: number = 10000) {
  const authStore = useAuthStore();

  return usePolling(async () => {
    const path = buildRestaurantScopedUrl("/orders", authStore.restaurantId, {
      status: "pending,confirmed,preparing",
    });

    if (!path) return [];

    const response = await api.get(path);
    return response.data.data;
  }, interval);
}

export function useDashboardPolling(interval: number = 30000) {
  const authStore = useAuthStore();

  return usePolling(async () => {
    const path = buildRestaurantScopedUrl(
      "/analytics/dashboard",
      authStore.restaurantId,
    );

    if (!path) return null;

    const response = await api.get(path);
    return response.data.data;
  }, interval);
}
