/**
 * AI Analytics Feature Types
 * Type definitions for AI-powered business analytics
 */

export interface TimeRange {
  range: '7d' | '14d' | '30d' | '90d' | '180d' | '1y' | 'custom';
  startDate?: string;
  endDate?: string;
}

export interface AIConfigInput {
  restaurantId: string;
  provider: AIProvider;
  apiKey: string;
  model?: string;
  customBaseUrl?: string;
}

export type AIProvider = 'anthropic' | 'openai' | 'google' | 'deepseek' | 'custom';

export interface TestProviderInput {
  provider: AIProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface GenerateAnalyticsInput {
  restaurantId: string;
  timeRange: TimeRange;
  includeForecasting?: boolean;
  refreshCache?: boolean;
}

export interface AIConfiguration {
  id: number;
  restaurantId: string;
  provider: AIProvider;
  apiKeyEncrypted: string;
  model: string | null;
  customBaseUrl: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIUsageLog {
  id: number;
  restaurantId: string;
  provider: AIProvider;
  model: string;
  operation: string;
  tokensUsed: number;
  latencyMs: number;
  success: boolean;
  createdAt: string;
}

export interface AIUsageStats {
  provider: AIProvider;
  model: string;
  operation: string;
  requestCount: number;
  totalTokens: number;
  avgLatencyMs: number;
  successfulRequests: number;
}

export interface ProductAnalysis {
  id: string;
  name: string;
  category: string;
  salesCount: number;
  revenue: number;
  profit: number;
  profitMargin: number;
  rank: number;
}

export interface AnalyticsReport {
  summary: string;
  insights: string[];
  recommendations: string[];
  metadata: {
    generatedAt: string;
    processingTimeMs: number;
    tokensUsed?: number;
    model: string;
  };
}

export interface IAIAnalyticsService {
  getConfig(restaurantId: string): Promise<AIConfiguration | null>;
  saveConfig(input: AIConfigInput): Promise<void>;
  testProvider(input: TestProviderInput): Promise<{ success: boolean; latencyMs?: number; model?: string; error?: string }>;
  generateReport(restaurantId: string, timeRange: TimeRange, options?: { includeForecasting?: boolean; refreshCache?: boolean }): Promise<AnalyticsReport>;
  getTrafficDrivers(restaurantId: string, timeRange: TimeRange, limit?: number): Promise<ProductAnalysis[]>;
  getBestsellers(restaurantId: string, timeRange: TimeRange, limit?: number): Promise<ProductAnalysis[]>;
  getProfitLeaders(restaurantId: string, timeRange: TimeRange, limit?: number): Promise<ProductAnalysis[]>;
  analyzeProducts(restaurantId: string, timeRange: TimeRange): Promise<ProductAnalysis[]>;
  getUsageStats(restaurantId: string, startDate?: string, endDate?: string): Promise<AIUsageStats[]>;
}
