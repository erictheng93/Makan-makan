/**
 * AI Analytics API OpenAPI Schemas
 * AI 分析 API Schema 定義
 */

import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';
import { errorResponses } from '../config';

/**
 * AI Analytics API Schemas
 */
export const AIAnalyticsSchemas = {
  // LLM Provider
  LLMProvider: z.enum(['openai', 'anthropic', 'gemini', 'local']),

  // Insight Type
  InsightType: z.enum([
    'sales_trend',
    'customer_behavior',
    'menu_optimization',
    'inventory_forecast',
    'staffing_recommendation',
    'revenue_prediction',
  ]),

  // Insight Priority
  InsightPriority: z.enum(['low', 'medium', 'high', 'critical']),

  // AI Configuration
  AIConfiguration: z.object({
    id: z.string().uuid(),
    restaurantId: z.string().uuid(),
    provider: z.lazy(() => AIAnalyticsSchemas.LLMProvider),
    model: z.string(),
    apiKey: z.string().optional(), // Encrypted, not returned in responses
    enabled: z.boolean(),
    settings: z.object({
      temperature: z.number().min(0).max(2).default(0.7),
      maxTokens: z.number().int().min(100).max(100000).default(2000),
      topP: z.number().min(0).max(1).default(1),
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),

  // Create/Update AI Configuration Request
  ConfigureAIRequest: z.object({
    provider: z.lazy(() => AIAnalyticsSchemas.LLMProvider),
    model: z.string().min(1, 'Model is required'),
    apiKey: z.string().min(1, 'API key is required'),
    enabled: z.boolean().default(true),
    settings: z
      .object({
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().int().min(100).max(100000).optional(),
        topP: z.number().min(0).max(1).optional(),
      })
      .optional(),
  }),

  // AI Insight
  AIInsight: z.object({
    id: z.string().uuid(),
    restaurantId: z.string().uuid(),
    type: z.lazy(() => AIAnalyticsSchemas.InsightType),
    priority: z.lazy(() => AIAnalyticsSchemas.InsightPriority),
    title: z.string(),
    summary: z.string(),
    details: z.string(),
    recommendations: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    dataPoints: z.record(z.any()),
    metrics: z.object({
      potentialRevenue: z.number().optional(),
      potentialSavings: z.number().optional(),
      impactScore: z.number().min(0).max(100).optional(),
    }),
    status: z.enum(['new', 'acknowledged', 'actioned', 'dismissed']),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime().optional(),
  }),

  // Generate Insights Request
  GenerateInsightsRequest: z.object({
    types: z.array(z.lazy(() => AIAnalyticsSchemas.InsightType)).optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    includeHistorical: z.boolean().default(false),
    minConfidence: z.number().min(0).max(1).default(0.7),
  }),

  // Generate Insights Response
  GenerateInsightsResponse: z.object({
    success: z.boolean(),
    data: z.array(z.lazy(() => AIAnalyticsSchemas.AIInsight)),
    meta: z.object({
      totalGenerated: z.number().int(),
      processingTime: z.number(), // milliseconds
      provider: z.lazy(() => AIAnalyticsSchemas.LLMProvider),
      model: z.string(),
    }),
  }),

  // Ask AI Question Request
  AskAIRequest: z.object({
    question: z.string().min(1, 'Question is required'),
    context: z
      .object({
        timeRange: z
          .object({
            startDate: z.string().datetime(),
            endDate: z.string().datetime(),
          })
          .optional(),
        includeMetrics: z.array(z.string()).optional(),
        focusArea: z.string().optional(),
      })
      .optional(),
  }),

  // Ask AI Response
  AskAIResponse: z.object({
    success: z.boolean(),
    answer: z.string(),
    relatedInsights: z.array(z.string().uuid()).optional(),
    confidence: z.number().min(0).max(1),
    sources: z.array(z.string()).optional(),
    recommendations: z.array(z.string()).optional(),
  }),

  // AI Usage Log
  AIUsageLog: z.object({
    id: z.string().uuid(),
    restaurantId: z.string().uuid(),
    provider: z.lazy(() => AIAnalyticsSchemas.LLMProvider),
    requestType: z.enum(['insight_generation', 'question_answer', 'prediction', 'analysis']),
    tokensUsed: z.number().int(),
    cost: z.number().nonnegative(),
    responseTime: z.number(), // milliseconds
    success: z.boolean(),
    createdAt: z.string().datetime(),
  }),

  // Product Analytics
  ProductAnalytics: z.object({
    itemId: z.string().uuid(),
    itemName: z.string(),
    analysis: z.object({
      salesVelocity: z.number(),
      profitMargin: z.number(),
      popularityScore: z.number().min(0).max(100),
      customerSatisfaction: z.number().min(0).max(5).optional(),
      recommendations: z.array(z.string()),
    }),
    trends: z.array(
      z.object({
        period: z.string(),
        sales: z.number().int(),
        revenue: z.number(),
        growth: z.number(),
      })
    ),
    insights: z.array(z.string()),
  }),
};

/**
 * AI Analytics API Routes
 */

// Get AI Configuration
export const getAIConfigRoute = createRoute({
  method: 'get',
  path: '/api/v1/ai-analytics/:restaurantId/config',
  tags: ['ai-analytics'],
  summary: '獲取 AI 配置',
  description: '獲取餐廳的 AI 分析配置（不包含 API keys）',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: '成功獲取 AI 配置',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: AIAnalyticsSchemas.AIConfiguration.omit({ apiKey: true }),
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});

// Configure AI
export const configureAIRoute = createRoute({
  method: 'post',
  path: '/api/v1/ai-analytics/:restaurantId/config',
  tags: ['ai-analytics'],
  summary: '配置 AI 設置',
  description: '配置或更新 AI 分析的 LLM 提供商和設置',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: AIAnalyticsSchemas.ConfigureAIRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'AI 配置成功',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: AIAnalyticsSchemas.AIConfiguration.omit({ apiKey: true }),
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Generate AI Insights
export const generateInsightsRoute = createRoute({
  method: 'post',
  path: '/api/v1/ai-analytics/:restaurantId/insights/generate',
  tags: ['ai-analytics'],
  summary: '生成 AI 洞察',
  description: '使用 AI 分析歷史數據並生成業務洞察和建議',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: AIAnalyticsSchemas.GenerateInsightsRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: '洞察生成成功',
      content: {
        'application/json': {
          schema: AIAnalyticsSchemas.GenerateInsightsResponse,
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Get AI Insights
export const getInsightsRoute = createRoute({
  method: 'get',
  path: '/api/v1/ai-analytics/:restaurantId/insights',
  tags: ['ai-analytics'],
  summary: '獲取 AI 洞察列表',
  description: '獲取餐廳的 AI 生成洞察，支持過濾和排序',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    query: z.object({
      type: AIAnalyticsSchemas.InsightType.optional(),
      priority: AIAnalyticsSchemas.InsightPriority.optional(),
      status: z.enum(['new', 'acknowledged', 'actioned', 'dismissed']).optional(),
      minConfidence: z.string().transform(Number).optional(),
      page: z.string().regex(/^\d+$/).transform(Number).default('1'),
      pageSize: z.string().regex(/^\d+$/).transform(Number).default('20'),
    }),
  },
  responses: {
    200: {
      description: '成功獲取洞察列表',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(AIAnalyticsSchemas.AIInsight),
            meta: z.object({
              total: z.number(),
              page: z.number(),
              pageSize: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Update Insight Status
export const updateInsightStatusRoute = createRoute({
  method: 'patch',
  path: '/api/v1/ai-analytics/insights/:insightId/status',
  tags: ['ai-analytics'],
  summary: '更新洞察狀態',
  description: '更新 AI 洞察的處理狀態',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      insightId: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.enum(['new', 'acknowledged', 'actioned', 'dismissed']),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '狀態更新成功',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: AIAnalyticsSchemas.AIInsight,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 404),
  },
});

// Ask AI Question
export const askAIRoute = createRoute({
  method: 'post',
  path: '/api/v1/ai-analytics/:restaurantId/ask',
  tags: ['ai-analytics'],
  summary: '詢問 AI',
  description: '向 AI 詢問關於餐廳數據的問題',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: AIAnalyticsSchemas.AskAIRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'AI 回答成功',
      content: {
        'application/json': {
          schema: AIAnalyticsSchemas.AskAIResponse,
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Get AI Usage
export const getAIUsageRoute = createRoute({
  method: 'get',
  path: '/api/v1/ai-analytics/:restaurantId/usage',
  tags: ['ai-analytics'],
  summary: '獲取 AI 使用記錄',
  description: '獲取 AI 服務的使用統計和成本',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    query: z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      provider: AIAnalyticsSchemas.LLMProvider.optional(),
    }),
  },
  responses: {
    200: {
      description: '成功獲取使用記錄',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(AIAnalyticsSchemas.AIUsageLog),
            summary: z.object({
              totalRequests: z.number().int(),
              totalTokens: z.number().int(),
              totalCost: z.number(),
              averageResponseTime: z.number(),
              successRate: z.number().min(0).max(1),
            }),
          }),
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Get Product Analytics
export const getProductAnalyticsRoute = createRoute({
  method: 'get',
  path: '/api/v1/ai-analytics/:restaurantId/products/:itemId',
  tags: ['ai-analytics'],
  summary: '獲取產品 AI 分析',
  description: '獲取特定菜品的 AI 深度分析和建議',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
      itemId: z.string().uuid(),
    }),
    query: z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    }),
  },
  responses: {
    200: {
      description: '成功獲取產品分析',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: AIAnalyticsSchemas.ProductAnalytics,
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});
