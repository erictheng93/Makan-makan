/**
 * Composable for AI Analytics API
 * Clean, type-safe API interactions
 */
import { type Ref } from 'vue';
import type { LLMProvider, AIAnalyticsReport, ProductAnalysis, TimeRangeParams, ConfigureAIRequest, TestAIProviderRequest } from '@makanmakan/ai-analytics';
interface UseAIAnalyticsReturn {
    loading: Ref<boolean>;
    error: Ref<string | null>;
    getConfig: (restaurantId: string) => Promise<any>;
    saveConfig: (data: ConfigureAIRequest) => Promise<{
        success: boolean;
        message?: string;
    }>;
    testProvider: (data: TestAIProviderRequest) => Promise<{
        success: boolean;
        latency?: number;
        error?: string;
    }>;
    getAvailableModels: (provider: LLMProvider) => Promise<string[]>;
    generateReport: (restaurantId: string, timeRange: TimeRangeParams, options?: {
        includeForecasting?: boolean;
        refreshCache?: boolean;
    }) => Promise<AIAnalyticsReport | null>;
    getTrafficDrivers: (restaurantId: string, timeRange: string, limit?: number) => Promise<ProductAnalysis[]>;
    getBestsellers: (restaurantId: string, timeRange: string, limit?: number) => Promise<ProductAnalysis[]>;
    getProfitLeaders: (restaurantId: string, timeRange: string, limit?: number) => Promise<ProductAnalysis[]>;
    getAllProductAnalysis: (restaurantId: string, timeRange: string) => Promise<ProductAnalysis[]>;
    getUsageStats: (restaurantId: string, startDate?: string, endDate?: string) => Promise<any[]>;
}
export declare function useAIAnalytics(): UseAIAnalyticsReturn;
export {};
