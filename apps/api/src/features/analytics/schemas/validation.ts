/**
 * Analytics Validation Schemas
 * Zod schemas for input validation in the analytics feature
 */

import { z } from 'zod'

// Base analytics query schema
export const analyticsQuerySchema = z.object({
  restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  groupBy: z.enum(['day', 'week', 'month', 'year']).default('day'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('30')
})

// Dashboard query schema
export const dashboardQuerySchema = z.object({
  restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
  period: z.enum(['today', 'week', 'month', 'year']).default('today')
})

// Revenue analytics query schema
export const revenueQuerySchema = analyticsQuerySchema.extend({
  includeComparison: z.string().transform(val => val === 'true').default('false')
})

// Performance analytics query schema
export const performanceQuerySchema = analyticsQuerySchema.extend({
  metric: z.enum(['orders', 'revenue', 'avg_order_value', 'customer_count']).default('orders')
})

// Export query schema
export const exportQuerySchema = analyticsQuerySchema.extend({
  type: z.enum(['dashboard', 'revenue', 'products', 'customers', 'performance']).default('dashboard'),
  format: z.enum(['json', 'csv']).default('json')
})

// Real-time dashboard query schema
export const realtimeDashboardQuerySchema = z.object({
  restaurantId: z.string().regex(/^\d+$/).transform(Number).optional()
})

// Detailed performance query schema
export const detailedPerformanceQuerySchema = analyticsQuerySchema.extend({
  includeStaffMetrics: z.string().transform(val => val === 'true').default('false'),
  includeItemAnalysis: z.string().transform(val => val === 'true').default('false')
})

// Owner dashboard query schema
export const ownerDashboardQuerySchema = z.object({
  restaurantId: z.string().regex(/^\d+$/).transform(Number).optional()
})

// Financial report query schema
export const financialReportQuerySchema = z.object({
  restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('monthly'),
  year: z.string().regex(/^\d{4}$/).optional(),
  month: z.string().regex(/^(0?[1-9]|1[0-2])$/).optional()
})

// SSE query schema
export const sseQuerySchema = z.object({
  lastEventId: z.string().optional()
})

// Date range validation helper
export const dateRangeSchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime()
}).refine(
  (data) => new Date(data.dateFrom) <= new Date(data.dateTo),
  {
    message: "dateFrom must be before or equal to dateTo",
    path: ["dateFrom"]
  }
)

// Export type inference for TypeScript
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>
export type RevenueQuery = z.infer<typeof revenueQuerySchema>
export type PerformanceQuery = z.infer<typeof performanceQuerySchema>
export type ExportQuery = z.infer<typeof exportQuerySchema>
export type RealtimeDashboardQuery = z.infer<typeof realtimeDashboardQuerySchema>
export type DetailedPerformanceQuery = z.infer<typeof detailedPerformanceQuerySchema>
export type OwnerDashboardQuery = z.infer<typeof ownerDashboardQuerySchema>
export type FinancialReportQuery = z.infer<typeof financialReportQuerySchema>
export type SSEQuery = z.infer<typeof sseQuerySchema>
export type DateRange = z.infer<typeof dateRangeSchema>