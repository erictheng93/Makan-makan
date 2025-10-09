/**
 * AI Analytics Types
 * Comprehensive type definitions for AI-powered business analytics
 */

// ============================================
// LLM Provider Types
// ============================================

/**
 * Supported LLM providers
 */
export type LLMProvider = 'anthropic' | 'openai' | 'google' | 'deepseek' | 'custom';

/**
 * LLM provider configuration
 */
export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string; // For custom providers
  maxTokens?: number;
  temperature?: number;
}

/**
 * LLM request parameters
 */
export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'text' | 'json';
}

/**
 * LLM response
 */
export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Business Analytics Types
// ============================================

/**
 * Time range for analytics
 */
export type TimeRange = '7d' | '14d' | '30d' | '90d' | '180d' | '1y' | 'custom';

/**
 * Time range with custom dates
 */
export interface TimeRangeParams {
  range: TimeRange;
  startDate?: string; // ISO date string
  endDate?: string;   // ISO date string
}

/**
 * Product performance category
 */
export type ProductCategory = 'traffic-driver' | 'bestseller' | 'profit-leader' | 'underperformer';

/**
 * Product analysis metrics
 */
export interface ProductAnalysis {
  menuItemId: string;
  menuItemName: string;
  category: string;

  // 銷售指標
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;

  // 利潤指標
  unitCost?: number;
  unitPrice: number;
  profitMargin?: number;      // (price - cost) / price
  totalProfit?: number;        // (price - cost) * orders

  // 引流指標
  firstItemInOrderCount: number;  // 作為購物車首項的次數
  cartAdditionRate: number;       // 加入購物車 / 瀏覽次數
  conversionRate: number;         // 購買 / 加入購物車

  // 趨勢指標
  trendScore: number;         // -1 to 1, negative means declining
  growthRate: number;         // % change vs previous period

  // 排名
  salesRank: number;          // 銷量排名
  revenueRank: number;        // 營收排名
  profitRank?: number;        // 利潤排名

  // 分類標籤
  categories: ProductCategory[];

  // 時間序列數據
  dailyData?: {
    date: string;
    orders: number;
    revenue: number;
  }[];
}

/**
 * Aggregated business metrics
 */
export interface BusinessMetrics {
  restaurantId: string;
  timeRange: TimeRangeParams;
  generatedAt: string;

  // 總體指標
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalProfit?: number;
  profitMargin?: number;

  // 增長指標
  revenueGrowth: number;      // % vs previous period
  orderGrowth: number;

  // 客戶指標
  uniqueCustomers: number;
  repeatCustomerRate: number;
  averageOrdersPerCustomer: number;

  // 營運指標
  peakHours: {
    hour: number;
    orderCount: number;
    revenue: number;
  }[];
  peakDays: {
    dayOfWeek: number;
    orderCount: number;
    revenue: number;
  }[];

  // 產品表現
  topProducts: ProductAnalysis[];
  trafficDrivers: ProductAnalysis[];
  profitLeaders: ProductAnalysis[];
  underperformers: ProductAnalysis[];

  // 時間序列
  dailyMetrics: {
    date: string;
    revenue: number;
    orders: number;
    avgOrderValue: number;
    profit?: number;
  }[];
}

/**
 * AI-generated business insights
 */
export interface AIInsight {
  id: string;
  type: 'observation' | 'recommendation' | 'warning' | 'opportunity';
  category: 'sales' | 'profit' | 'customer' | 'operations' | 'product';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number; // 0-1
  actionable: boolean;
  suggestedActions?: string[];
  supportingData?: Record<string, unknown>;
}

/**
 * Complete AI analytics report
 */
export interface AIAnalyticsReport {
  id: string;
  restaurantId: string;
  generatedAt: string;
  timeRange: TimeRangeParams;

  // 業務指標
  metrics: BusinessMetrics;

  // AI 生成的洞察
  insights: AIInsight[];

  // 執行摘要（自然語言）
  executiveSummary: string;

  // 預測
  forecast?: {
    nextWeekRevenue: {
      predicted: number;
      confidenceLower: number;
      confidenceUpper: number;
    };
    nextWeekOrders: {
      predicted: number;
      confidenceLower: number;
      confidenceUpper: number;
    };
  };

  // 元數據
  metadata: {
    llmProvider: LLMProvider;
    llmModel: string;
    processingTimeMs: number;
    tokensUsed?: number;
  };
}

// ============================================
// Database Types
// ============================================

/**
 * AI configuration stored in database
 */
export interface AIConfiguration {
  id: string;
  restaurantId: string;
  provider: LLMProvider;
  apiKeyEncrypted: string;  // Encrypted API key
  model?: string;
  customBaseUrl?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * AI insights cache in database
 */
export interface AIInsightsCache {
  id: string;
  restaurantId: string;
  insightType: string;
  timeRange: string;
  data: string; // JSON string
  confidenceScore?: number;
  generatedAt: string;
  expiresAt: string;
}

/**
 * Product analytics cache
 */
export interface ProductAnalyticsCache {
  id: string;
  restaurantId: string;
  menuItemId: string;
  date: string;
  orderCount: number;
  revenue: number;
  profitMargin?: number;
  totalProfit?: number;
  firstItemCount: number;
  trendScore: number;
  salesRank: number;
  revenueRank: number;
  profitRank?: number;
  categories: string; // JSON array
  updatedAt: string;
}

// ============================================
// API Request/Response Types
// ============================================

/**
 * Request to generate AI analytics
 */
export interface GenerateAnalyticsRequest {
  restaurantId: string;
  timeRange: TimeRangeParams;
  includeForecasting?: boolean;
  refreshCache?: boolean;
}

/**
 * Response from analytics generation
 */
export interface GenerateAnalyticsResponse {
  success: boolean;
  report?: AIAnalyticsReport;
  error?: string;
  cached?: boolean;
}

/**
 * Request to configure AI provider
 */
export interface ConfigureAIRequest {
  restaurantId: string;
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  customBaseUrl?: string;
}

/**
 * Response from AI configuration
 */
export interface ConfigureAIResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Request to test AI provider
 */
export interface TestAIProviderRequest {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

/**
 * Response from AI provider test
 */
export interface TestAIProviderResponse {
  success: boolean;
  provider: LLMProvider;
  model?: string;
  latencyMs?: number;
  error?: string;
}

// ============================================
// Utility Types
// ============================================

/**
 * Result type for operations
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Async result type
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;
