/**
 * Analytics API OpenAPI Schemas
 * 數據分析 API Schema 定義
 */

import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';
import { errorResponses } from '../config';

// Define enums first to avoid circular reference
const TimePeriod = z.enum(['day', 'week', 'month', 'quarter', 'year', 'custom']);
const MetricType = z.enum([
  'revenue',
  'orders',
  'customers',
  'average_order_value',
  'items_sold',
  'conversion_rate',
]);
const MetricDataPoint = z.object({
  timestamp: z.string().datetime(),
  value: z.number(),
  label: z.string().optional(),
});

/**
 * Analytics API Schemas
 */
export const AnalyticsSchemas = {
  // Time Period
  TimePeriod,

  // Metric Type
  MetricType,

  // Analytics Query Request
  AnalyticsQueryRequest: z.object({
    restaurantId: z.string().uuid(),
    metrics: z.array(MetricType),
    period: TimePeriod,
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    groupBy: z.enum(['hour', 'day', 'week', 'month']).optional(),
  }),

  // Metric Data Point
  MetricDataPoint: z.object({
    timestamp: z.string().datetime(),
    value: z.number(),
    label: z.string().optional(),
  }),

  // Analytics Data
  AnalyticsData: z.object({
    metric: MetricType,
    data: z.array(MetricDataPoint),
    total: z.number(),
    average: z.number(),
    change: z.number().optional(), // Percentage change from previous period
    trend: z.enum(['up', 'down', 'stable']).optional(),
  }),

  // Analytics Response
  AnalyticsResponse: z.object({
    success: z.boolean(),
    data: z.array(z.any()),
    period: z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      type: TimePeriod,
    }),
  }),

  // Sales Report
  SalesReport: z.object({
    restaurantId: z.string().uuid(),
    totalRevenue: z.number().min(0),
    totalOrders: z.number().int().min(0),
    averageOrderValue: z.number().min(0),
    totalCustomers: z.number().int().min(0),
    topSellingItems: z.array(
      z.object({
        itemId: z.string().uuid(),
        itemName: z.string(),
        category: z.string(),
        quantitySold: z.number().int(),
        revenue: z.number(),
      })
    ),
    revenueByCategory: z.array(
      z.object({
        categoryId: z.string().uuid(),
        categoryName: z.string(),
        revenue: z.number(),
        percentage: z.number(),
      })
    ),
    salesByHour: z.array(
      z.object({
        hour: z.number().int().min(0).max(23),
        orders: z.number().int(),
        revenue: z.number(),
      })
    ),
    period: z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    }),
  }),

  // Customer Analytics
  CustomerAnalytics: z.object({
    restaurantId: z.string().uuid(),
    totalCustomers: z.number().int().min(0),
    newCustomers: z.number().int().min(0),
    returningCustomers: z.number().int().min(0),
    customerRetentionRate: z.number().min(0).max(1),
    averageOrdersPerCustomer: z.number().min(0),
    averageLifetimeValue: z.number().min(0),
    customerSegments: z.array(
      z.object({
        segment: z.string(),
        count: z.number().int(),
        percentage: z.number(),
        averageSpend: z.number(),
      })
    ),
    period: z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    }),
  }),

  // Performance Metrics
  PerformanceMetrics: z.object({
    restaurantId: z.string().uuid(),
    averagePreparationTime: z.number().min(0), // minutes
    averageWaitTime: z.number().min(0), // minutes
    orderAccuracy: z.number().min(0).max(1),
    tableUtilization: z.number().min(0).max(1),
    peakHours: z.array(
      z.object({
        hour: z.number().int().min(0).max(23),
        utilization: z.number().min(0).max(1),
      })
    ),
    staffEfficiency: z.object({
      ordersPerStaff: z.number().min(0),
      averageServiceTime: z.number().min(0),
    }),
    period: z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    }),
  }),

  // Inventory Analytics
  InventoryAnalytics: z.object({
    restaurantId: z.string().uuid(),
    lowStockItems: z.array(
      z.object({
        itemId: z.string().uuid(),
        itemName: z.string(),
        currentStock: z.number(),
        reorderLevel: z.number(),
      })
    ),
    wasteItems: z.array(
      z.object({
        itemId: z.string().uuid(),
        itemName: z.string(),
        wasteQuantity: z.number(),
        wasteValue: z.number(),
        wastePercentage: z.number(),
      })
    ),
    itemPerformance: z.array(
      z.object({
        itemId: z.string().uuid(),
        itemName: z.string(),
        salesVelocity: z.number(),
        turnoverRate: z.number(),
        stockDays: z.number(),
      })
    ),
    period: z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    }),
  }),

  // Export Format
  ExportFormat: z.enum(['csv', 'excel', 'pdf', 'json']),

  // Export Request
  ExportRequest: z.object({
    reportType: z.enum(['sales', 'customer', 'performance', 'inventory']),
    format: z.lazy(() => AnalyticsSchemas.ExportFormat),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    includeCharts: z.boolean().default(false),
  }),
};

/**
 * Analytics API Routes
 */

// Get Analytics Data
export const getAnalyticsRoute = createRoute({
  method: 'post',
  path: '/api/v1/analytics/query',
  tags: ['analytics'],
  summary: '查詢分析數據',
  description: '查詢指定時間段的業務分析數據',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: AnalyticsSchemas.AnalyticsQueryRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: '成功獲取分析數據',
      content: {
        'application/json': {
          schema: AnalyticsSchemas.AnalyticsResponse,
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Get Sales Report
export const getSalesReportRoute = createRoute({
  method: 'get',
  path: '/api/v1/analytics/:restaurantId/sales',
  tags: ['analytics'],
  summary: '獲取銷售報告',
  description: '獲取餐廳的詳細銷售報告',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    query: z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      includeTopItems: z.string().transform((val) => val === 'true').default('true'),
      includeHourlyBreakdown: z.string().transform((val) => val === 'true').default('true'),
    }),
  },
  responses: {
    200: {
      description: '成功獲取銷售報告',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: AnalyticsSchemas.SalesReport,
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});

// Get Customer Analytics
export const getCustomerAnalyticsRoute = createRoute({
  method: 'get',
  path: '/api/v1/analytics/:restaurantId/customers',
  tags: ['analytics'],
  summary: '獲取客戶分析',
  description: '獲取客戶行為和價值分析數據',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    query: z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      includeSegmentation: z.string().transform((val) => val === 'true').default('true'),
    }),
  },
  responses: {
    200: {
      description: '成功獲取客戶分析',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: AnalyticsSchemas.CustomerAnalytics,
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});

// Get Performance Metrics
export const getPerformanceMetricsRoute = createRoute({
  method: 'get',
  path: '/api/v1/analytics/:restaurantId/performance',
  tags: ['analytics'],
  summary: '獲取性能指標',
  description: '獲取餐廳運營效率和性能指標',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    query: z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    }),
  },
  responses: {
    200: {
      description: '成功獲取性能指標',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: AnalyticsSchemas.PerformanceMetrics,
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});

// Get Inventory Analytics
export const getInventoryAnalyticsRoute = createRoute({
  method: 'get',
  path: '/api/v1/analytics/:restaurantId/inventory',
  tags: ['analytics'],
  summary: '獲取庫存分析',
  description: '獲取庫存管理和優化建議',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    query: z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      includeLowStock: z.string().transform((val) => val === 'true').default('true'),
      includeWaste: z.string().transform((val) => val === 'true').default('true'),
    }),
  },
  responses: {
    200: {
      description: '成功獲取庫存分析',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: AnalyticsSchemas.InventoryAnalytics,
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});

// Export Report
export const exportReportRoute = createRoute({
  method: 'post',
  path: '/api/v1/analytics/:restaurantId/export',
  tags: ['analytics'],
  summary: '導出報告',
  description: '導出分析報告為指定格式（CSV、Excel、PDF）',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: AnalyticsSchemas.ExportRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: '報告導出成功',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              downloadUrl: z.string().url(),
              expiresAt: z.string().datetime(),
              format: AnalyticsSchemas.ExportFormat,
              fileSize: z.number().int(),
            }),
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403),
    ...errorResponses(404),
  },
});

// Get Dashboard Summary
export const getDashboardSummaryRoute = createRoute({
  method: 'get',
  path: '/api/v1/analytics/:restaurantId/dashboard',
  tags: ['analytics'],
  summary: '獲取儀表板摘要',
  description: '獲取適合儀表板顯示的關鍵指標摘要',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    query: z.object({
      period: AnalyticsSchemas.TimePeriod.default('day'),
    }),
  },
  responses: {
    200: {
      description: '成功獲取儀表板摘要',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              revenue: z.object({
                current: z.number(),
                previous: z.number(),
                change: z.number(),
              }),
              orders: z.object({
                current: z.number().int(),
                previous: z.number().int(),
                change: z.number(),
              }),
              customers: z.object({
                current: z.number().int(),
                previous: z.number().int(),
                change: z.number(),
              }),
              averageOrderValue: z.object({
                current: z.number(),
                previous: z.number(),
                change: z.number(),
              }),
              topItems: z.array(
                z.object({
                  itemId: z.string().uuid(),
                  itemName: z.string(),
                  revenue: z.number(),
                })
              ),
              recentOrders: z.array(z.any()),
            }),
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});
