/**
 * Composable for AI Analytics API
 * Clean, type-safe API interactions
 */

import { ref, type Ref } from "vue";
import type {
  LLMProvider,
  AIAnalyticsReport,
  ProductAnalysis,
  TimeRangeParams,
  ConfigureAIRequest,
  TestAIProviderRequest,
} from "@makanmakan/ai-analytics";

const API_BASE = "/api/v1/ai-analytics";

interface UseAIAnalyticsReturn {
  // State
  loading: Ref<boolean>;
  error: Ref<string | null>;

  // AI Configuration
  getConfig: (restaurantId: string) => Promise<any>;
  saveConfig: (
    data: ConfigureAIRequest,
  ) => Promise<{ success: boolean; message?: string }>;
  testProvider: (
    data: TestAIProviderRequest,
  ) => Promise<{ success: boolean; latency?: number; error?: string }>;
  getAvailableModels: (provider: LLMProvider) => Promise<string[]>;

  // AI Reports
  generateReport: (
    restaurantId: string,
    timeRange: TimeRangeParams,
    options?: { includeForecasting?: boolean; refreshCache?: boolean },
  ) => Promise<AIAnalyticsReport | null>;

  // Product Analytics
  getTrafficDrivers: (
    restaurantId: string,
    timeRange: string,
    limit?: number,
  ) => Promise<ProductAnalysis[]>;
  getBestsellers: (
    restaurantId: string,
    timeRange: string,
    limit?: number,
  ) => Promise<ProductAnalysis[]>;
  getProfitLeaders: (
    restaurantId: string,
    timeRange: string,
    limit?: number,
  ) => Promise<ProductAnalysis[]>;
  getAllProductAnalysis: (
    restaurantId: string,
    timeRange: string,
  ) => Promise<ProductAnalysis[]>;

  // Usage Stats
  getUsageStats: (
    restaurantId: string,
    startDate?: string,
    endDate?: string,
  ) => Promise<any[]>;
}

export function useAIAnalytics(): UseAIAnalyticsReturn {
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Helper function for API calls
  async function fetchAPI<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T | null> {
    loading.value = true;
    error.value = null;

    try {
      const token = localStorage.getItem("auth_token");
      const csrfToken = document.cookie.match(/csrf_token=([^;]+)/)?.[1];
      const method = (options.method || "GET").toUpperCase();
      const needsCsrf = ["POST", "PUT", "DELETE", "PATCH"].includes(method);

      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(needsCsrf && csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message ||
            errorData.message ||
            `HTTP ${response.status}: ${response.statusText}`,
        );
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      error.value = errorMessage;
      console.error("AI Analytics API Error:", {
        endpoint,
        error: err,
        message: errorMessage,
      });
      return null;
    } finally {
      loading.value = false;
    }
  }

  // AI Configuration APIs
  const getConfig = async (restaurantId: string) => {
    const data = await fetchAPI(`/config/${restaurantId}`, {
      method: "GET",
    });
    return data;
  };

  const saveConfig = async (configData: ConfigureAIRequest) => {
    const data = await fetchAPI<{ success: boolean; message?: string }>(
      "/config",
      {
        method: "POST",
        body: JSON.stringify(configData),
      },
    );
    return data || { success: false, message: "Failed to save configuration" };
  };

  const testProvider = async (testData: TestAIProviderRequest) => {
    const data = await fetchAPI<{
      success: boolean;
      latency?: number;
      error?: string;
    }>("/test-provider", {
      method: "POST",
      body: JSON.stringify(testData),
    });
    return data || { success: false, error: "Test failed" };
  };

  const getAvailableModels = async (provider: LLMProvider) => {
    const data = await fetchAPI<{ models: string[] }>(`/models/${provider}`, {
      method: "GET",
    });
    return data?.models || [];
  };

  // AI Report Generation
  const generateReport = async (
    restaurantId: string,
    timeRange: TimeRangeParams,
    options: { includeForecasting?: boolean; refreshCache?: boolean } = {},
  ): Promise<AIAnalyticsReport | null> => {
    const data = await fetchAPI<{
      success: boolean;
      report?: AIAnalyticsReport;
    }>("/generate", {
      method: "POST",
      body: JSON.stringify({
        restaurantId,
        timeRange,
        ...options,
      }),
    });
    return data?.report || null;
  };

  // Product Analytics APIs
  const getTrafficDrivers = async (
    restaurantId: string,
    timeRange: string = "30d",
    limit: number = 10,
  ): Promise<ProductAnalysis[]> => {
    const data = await fetchAPI<{
      success: boolean;
      products?: ProductAnalysis[];
    }>(
      `/products/traffic-drivers/${restaurantId}?timeRange=${timeRange}&limit=${limit}`,
      { method: "GET" },
    );
    return data?.products || [];
  };

  const getBestsellers = async (
    restaurantId: string,
    timeRange: string = "30d",
    limit: number = 10,
  ): Promise<ProductAnalysis[]> => {
    const data = await fetchAPI<{
      success: boolean;
      products?: ProductAnalysis[];
    }>(
      `/products/bestsellers/${restaurantId}?timeRange=${timeRange}&limit=${limit}`,
      { method: "GET" },
    );
    return data?.products || [];
  };

  const getProfitLeaders = async (
    restaurantId: string,
    timeRange: string = "30d",
    limit: number = 10,
  ): Promise<ProductAnalysis[]> => {
    const data = await fetchAPI<{
      success: boolean;
      products?: ProductAnalysis[];
    }>(
      `/products/profit-leaders/${restaurantId}?timeRange=${timeRange}&limit=${limit}`,
      { method: "GET" },
    );
    return data?.products || [];
  };

  const getAllProductAnalysis = async (
    restaurantId: string,
    timeRange: string = "30d",
  ): Promise<ProductAnalysis[]> => {
    const data = await fetchAPI<{
      success: boolean;
      products?: ProductAnalysis[];
    }>(`/products/analysis/${restaurantId}?timeRange=${timeRange}`, {
      method: "GET",
    });
    return data?.products || [];
  };

  // Usage Stats API
  const getUsageStats = async (
    restaurantId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any[]> => {
    let url = `/usage/${restaurantId}`;
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (params.toString()) url += `?${params.toString()}`;

    const data = await fetchAPI<{ success: boolean; usage?: any[] }>(url, {
      method: "GET",
    });
    return data?.usage || [];
  };

  return {
    loading,
    error,
    getConfig,
    saveConfig,
    testProvider,
    getAvailableModels,
    generateReport,
    getTrafficDrivers,
    getBestsellers,
    getProfitLeaders,
    getAllProductAnalysis,
    getUsageStats,
  };
}
