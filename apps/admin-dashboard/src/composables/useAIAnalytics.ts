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
import { api } from "@/services/api";

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

  async function requestAI<T>(
    method: "GET" | "POST",
    endpoint: string,
    options: {
      data?: unknown;
      params?: Record<string, string | number | undefined>;
    } = {},
  ): Promise<T | null> {
    loading.value = true;
    error.value = null;

    try {
      const url = `/ai-analytics${endpoint}`;
      const response =
        method === "GET"
          ? await api.get<T>(
              url,
              options.params
                ? { params: cleanParams(options.params) }
                : undefined,
            )
          : await api.post<T>(url, options.data);

      return response.data as T;
    } catch (err) {
      const responseData = (err as any)?.response?.data;
      const errorMessage =
        responseData?.error?.message ||
        responseData?.message ||
        (err instanceof Error ? err.message : "Unknown error occurred");
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

  function cleanParams(
    params: Record<string, string | number | undefined>,
  ): Record<string, string | number> {
    return Object.fromEntries(
      Object.entries(params).filter(
        (entry): entry is [string, string | number] => entry[1] !== undefined,
      ),
    );
  }

  // AI Configuration APIs
  const getConfig = async (restaurantId: string) => {
    const data = await requestAI("GET", `/config/${restaurantId}`);
    return data;
  };

  const saveConfig = async (configData: ConfigureAIRequest) => {
    const data = await requestAI<{ success: boolean; message?: string }>(
      "POST",
      "/config",
      { data: configData },
    );
    return data || { success: false, message: "Failed to save configuration" };
  };

  const testProvider = async (testData: TestAIProviderRequest) => {
    const data = await requestAI<{
      success: boolean;
      latency?: number;
      error?: string;
    }>("POST", "/test-provider", { data: testData });
    return data || { success: false, error: "Test failed" };
  };

  const getAvailableModels = async (provider: LLMProvider) => {
    const data = await requestAI<{ models: string[] }>(
      "GET",
      `/models/${provider}`,
    );
    return data?.models || [];
  };

  // AI Report Generation
  const generateReport = async (
    restaurantId: string,
    timeRange: TimeRangeParams,
    options: { includeForecasting?: boolean; refreshCache?: boolean } = {},
  ): Promise<AIAnalyticsReport | null> => {
    const data = await requestAI<{
      success: boolean;
      report?: AIAnalyticsReport;
    }>("POST", "/generate", {
      data: {
        restaurantId,
        timeRange,
        ...options,
      },
    });
    return data?.report || null;
  };

  // Product Analytics APIs
  const getTrafficDrivers = async (
    restaurantId: string,
    timeRange: string = "30d",
    limit: number = 10,
  ): Promise<ProductAnalysis[]> => {
    const data = await requestAI<{
      success: boolean;
      products?: ProductAnalysis[];
    }>("GET", `/products/traffic-drivers/${restaurantId}`, {
      params: { timeRange, limit },
    });
    return data?.products || [];
  };

  const getBestsellers = async (
    restaurantId: string,
    timeRange: string = "30d",
    limit: number = 10,
  ): Promise<ProductAnalysis[]> => {
    const data = await requestAI<{
      success: boolean;
      products?: ProductAnalysis[];
    }>("GET", `/products/bestsellers/${restaurantId}`, {
      params: { timeRange, limit },
    });
    return data?.products || [];
  };

  const getProfitLeaders = async (
    restaurantId: string,
    timeRange: string = "30d",
    limit: number = 10,
  ): Promise<ProductAnalysis[]> => {
    const data = await requestAI<{
      success: boolean;
      products?: ProductAnalysis[];
    }>("GET", `/products/profit-leaders/${restaurantId}`, {
      params: { timeRange, limit },
    });
    return data?.products || [];
  };

  const getAllProductAnalysis = async (
    restaurantId: string,
    timeRange: string = "30d",
  ): Promise<ProductAnalysis[]> => {
    const data = await requestAI<{
      success: boolean;
      products?: ProductAnalysis[];
    }>("GET", `/products/analysis/${restaurantId}`, {
      params: { timeRange },
    });
    return data?.products || [];
  };

  // Usage Stats API
  const getUsageStats = async (
    restaurantId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any[]> => {
    const data = await requestAI<{ success: boolean; usage?: any[] }>(
      "GET",
      `/usage/${restaurantId}`,
      { params: { startDate, endDate } },
    );
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
