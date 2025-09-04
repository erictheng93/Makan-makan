import { defineStore } from "pinia";
import { ref, computed, readonly } from "vue";
import { api } from "@/services/api";
import { useAuthStore } from "./auth";
export const useDashboardStore = defineStore("dashboard", () => {
  const stats = ref(null);
  const isLoading = ref(false);
  const error = ref(null);
  const lastUpdated = ref(null);
  const authStore = useAuthStore();
  // Computed properties
  const todayOrders = computed(() => stats.value?.todayOrders || 0);
  const todayRevenue = computed(() => stats.value?.todayRevenue || 0);
  const averageOrderValue = computed(() => stats.value?.averageOrderValue || 0);
  const completionRate = computed(() => stats.value?.completionRate || 0);
  const topMenuItems = computed(() => stats.value?.topMenuItems || []);
  const revenueChart = computed(() => stats.value?.revenueChart || []);
  const ordersChart = computed(() => stats.value?.ordersChart || []);
  // Actions
  const fetchDashboardStats = async (dateRange) => {
    if (!authStore.restaurantId) {
      error.value = "餐廳 ID 不存在";
      return;
    }
    isLoading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams({
        restaurant_id: authStore.restaurantId.toString(),
      });
      if (dateRange) {
        params.append("from", dateRange.from);
        params.append("to", dateRange.to);
      }
      const response = await api.get(
        `/analytics/dashboard?${params.toString()}`,
      );
      if (response.data.success && response.data.data) {
        stats.value = response.data.data;
        lastUpdated.value = new Date();
      } else {
        error.value = response.data.error?.message || "獲取數據失敗";
      }
    } catch (err) {
      error.value = err.response?.data?.error?.message || "獲取儀表板數據失敗";
      console.error("Dashboard fetch error:", err);
    } finally {
      isLoading.value = false;
    }
  };
  const fetchRevenueAnalytics = async (period) => {
    if (!authStore.restaurantId) return [];
    try {
      const response = await api.get(
        `/analytics/revenue?restaurant_id=${authStore.restaurantId}&period=${period}`,
      );
      if (response.data.success) {
        return response.data.data;
      }
      return [];
    } catch (err) {
      console.error("Revenue analytics fetch error:", err);
      return [];
    }
  };
  const fetchOrderAnalytics = async (period) => {
    if (!authStore.restaurantId) return [];
    try {
      const response = await api.get(
        `/analytics/orders?restaurant_id=${authStore.restaurantId}&period=${period}`,
      );
      if (response.data.success) {
        return response.data.data;
      }
      return [];
    } catch (err) {
      console.error("Order analytics fetch error:", err);
      return [];
    }
  };
  const fetchTopMenuItems = async (limit = 10, period = "today") => {
    if (!authStore.restaurantId) return [];
    try {
      const response = await api.get(
        `/analytics/top-menu-items?restaurant_id=${authStore.restaurantId}&limit=${limit}&period=${period}`,
      );
      if (response.data.success) {
        return response.data.data;
      }
      return [];
    } catch (err) {
      console.error("Top menu items fetch error:", err);
      return [];
    }
  };
  const refreshStats = () => {
    return fetchDashboardStats();
  };
  const clearStats = () => {
    stats.value = null;
    error.value = null;
    lastUpdated.value = null;
  };
  // Helper functions for formatting
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
    }).format(amount);
  };
  const formatPercentage = (value) => {
    return `${(value * 100).toFixed(1)}%`;
  };
  const getGrowthIndicator = (current, previous) => {
    if (previous === 0) return { value: 0, isPositive: true };
    const growth = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(growth),
      isPositive: growth >= 0,
    };
  };
  // Auto-refresh functionality
  let refreshInterval = null;
  const startAutoRefresh = (intervalMs = 30000) => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    refreshInterval = window.setInterval(() => {
      if (authStore.isAuthenticated) {
        fetchDashboardStats();
      }
    }, intervalMs);
  };
  const stopAutoRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  };
  return {
    stats: readonly(stats),
    isLoading: readonly(isLoading),
    error: readonly(error),
    lastUpdated: readonly(lastUpdated),
    todayOrders,
    todayRevenue,
    averageOrderValue,
    completionRate,
    topMenuItems,
    revenueChart,
    ordersChart,
    fetchDashboardStats,
    fetchRevenueAnalytics,
    fetchOrderAnalytics,
    fetchTopMenuItems,
    refreshStats,
    clearStats,
    formatCurrency,
    formatPercentage,
    getGrowthIndicator,
    startAutoRefresh,
    stopAutoRefresh,
  };
});
