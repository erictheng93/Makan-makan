/**
 * Monitoring Feature Validation Schemas
 * Zod schemas for request validation and type safety
 */

import { z } from "zod";

// Decode HTML entities that the security middleware may have escaped
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&#x3D;/g, "=")
    .replace(/&amp;/g, "&");
}

// Operator schema that handles HTML-escaped values from security middleware
const operatorSchema = z
  .string()
  .transform(decodeHtmlEntities)
  .pipe(z.enum([">", "<", ">=", "<=", "="]));

// Alert rule creation schema
export const alertRuleSchema = z.object({
  name: z.string().min(1).max(100),
  condition: z.string().min(1).max(500).transform(decodeHtmlEntities),
  metric: z.string().min(1).max(100),
  operator: operatorSchema,
  threshold: z.number(),
  duration: z.number().int().positive().max(3600),
  config: z.object({
    type: z.enum(["email", "slack", "webhook", "sms"]),
    severity: z.enum(["info", "warning", "critical", "fatal"]),
    enabled: z.boolean(),
    interval: z.number().int().positive().optional(),
    recipients: z.array(z.string()).optional(),
    webhookUrl: z.url().optional(),
    template: z.string().optional(),
  }),
});

// Error recording schema
export const recordErrorSchema = z.object({
  type: z.string().min(1).max(50),
  message: z.string().min(1).max(1000),
  severity: z.enum(["info", "warning", "critical", "fatal"]),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Metrics query schema
export const metricsQuerySchema = z.object({
  period: z.enum(["1h", "6h", "24h", "7d", "30d"]).optional().default("24h"),
  granularity: z
    .enum(["1m", "5m", "15m", "1h", "6h"])
    .optional()
    .default("15m"),
});

/**
 * Overview query schema.
 *
 * `include=metrics` embeds the full SystemMetrics payload in the response.
 * /overview already loads it to derive keyMetrics and trends, so embedding
 * costs the API nothing and saves the caller a second round trip.
 */
export const overviewQuerySchema = z.object({
  include: z.enum(["metrics"]).optional(),
});

// Performance report query schema
export const performanceReportQuerySchema = z.object({
  days: z.string().regex(/^\d+$/).transform(Number).optional().prefault("7"),
});

// Test alert schema
export const testAlertSchema = z.object({
  type: z.enum(["slack", "webhook"]),
  severity: z.enum(["info", "warning", "critical", "fatal"]),
  webhookUrl: z.url().optional(),
});

// Alert rule update schema
export const updateAlertRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  condition: z.string().min(1).max(500).optional(),
  metric: z.string().min(1).max(100).optional(),
  operator: operatorSchema.optional(),
  threshold: z.number().optional(),
  duration: z.number().int().positive().max(3600).optional(),
  config: z
    .object({
      type: z.enum(["email", "slack", "webhook", "sms"]).optional(),
      severity: z.enum(["info", "warning", "critical", "fatal"]).optional(),
      enabled: z.boolean().optional(),
      interval: z.number().int().positive().optional(),
      recipients: z.array(z.string()).optional(),
      webhookUrl: z.url().optional(),
      template: z.string().optional(),
    })
    .optional(),
  isActive: z.boolean().optional(),
});

// Common query parameters
export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().prefault("1"),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional()
    .prefault("20")
    .refine((val) => val >= 1 && val <= 100, {
      message: "Limit must be between 1 and 100",
    }),
});

// Date range schema
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Monitoring configuration schema
export const monitoringConfigSchema = z.object({
  enableMetrics: z.boolean().default(true),
  enableAlerts: z.boolean().default(true),
  enablePerformanceTracking: z.boolean().default(true),
  metricsRetentionDays: z.number().int().positive().max(365).default(30),
  alertThrottleDuration: z.number().int().positive().default(300), // 5 minutes
  defaultSlackWebhook: z.url().optional(),
  enableDebugLogging: z.boolean().default(false),
});

// Export types derived from schemas
export type AlertRuleCreateRequest = z.infer<typeof alertRuleSchema>;
export type AlertRuleUpdateRequest = z.infer<typeof updateAlertRuleSchema>;
export type ErrorRecordRequest = z.infer<typeof recordErrorSchema>;
export type MetricsQueryParams = z.infer<typeof metricsQuerySchema>;
export type OverviewQueryParams = z.infer<typeof overviewQuerySchema>;
export type PerformanceReportQuery = z.infer<
  typeof performanceReportQuerySchema
>;
export type TestAlertRequest = z.infer<typeof testAlertSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;
export type DateRangeParams = z.infer<typeof dateRangeSchema>;
export type MonitoringConfig = z.infer<typeof monitoringConfigSchema>;
