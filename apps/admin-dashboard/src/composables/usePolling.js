import { ref, onUnmounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/services/api';
export function usePolling(fetchFunction, interval = 5000, immediate = true) {
    const data = ref(null);
    const isLoading = ref(false);
    const error = ref(null);
    const isActive = ref(false);
    let pollTimer = null;
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
        }
        catch (err) {
            error.value = err.message || 'Polling failed';
            console.error('Polling error:', err);
        }
        finally {
            isLoading.value = false;
        }
    };
    const start = () => {
        if (isActive.value || !authStore.isAuthenticated)
            return;
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
        refresh
    };
}
// Specific polling composables for common use cases
export function useOrderPolling(interval = 10000) {
    const authStore = useAuthStore();
    return usePolling(async () => {
        const response = await api.get(`/orders?restaurant_id=${authStore.restaurantId}&status=pending,confirmed,preparing`);
        return response.data.data;
    }, interval);
}
export function useDashboardPolling(interval = 30000) {
    const authStore = useAuthStore();
    return usePolling(async () => {
        const response = await api.get(`/analytics/dashboard?restaurant_id=${authStore.restaurantId}`);
        return response.data.data;
    }, interval);
}
