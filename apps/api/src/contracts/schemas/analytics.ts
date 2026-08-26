/**
 * Analytics API Response Contracts
 */

import { z } from "zod";
import { successEnvelope } from "../helpers";

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

const DashboardSummarySchema = z.object({
  todayRevenue: z.number(),
  todayOrders: z.number(),
  monthRevenue: z.number(),
  monthOrders: z.number(),
  growthRates: z.object({
    revenueGrowth: z.number(),
    orderGrowth: z.number(),
  }),
});

const DashboardDataSchema = z.object({
  summary: DashboardSummarySchema,
  recentOrders: z.array(
    z.object({
      id: z.string(),
      orderNumber: z.string(),
      status: z.string(),
      totalAmount: z.number(),
      customerInfo: z.unknown(),
      tableNumber: z.string().nullable(),
      createdAt: z.union([z.string(), z.date(), z.number()]),
    }),
  ),
  topSellingItems: z.array(
    z.object({
      itemId: z.number(),
      itemName: z.string(),
      quantity: z.number(),
      revenue: z.number(),
    }),
  ),
  tableStatus: z.object({
    occupied: z.number(),
    available: z.number(),
    total: z.number(),
  }),
});

export const DashboardResponse = z.object({
  success: z.literal(true),
  data: DashboardDataSchema,
  timestamp: z.union([z.string(), z.number()]).optional(),
});

export const RevenueResponse = successEnvelope(z.unknown());
export const ProductAnalyticsResponse = successEnvelope(z.unknown());
export const CustomerAnalyticsResponse = successEnvelope(z.unknown());
export const PerformanceResponse = successEnvelope(z.unknown());

export const RealtimeDashboardResponse = z.object({
  success: z.literal(true),
  data: z.unknown(),
  timestamp: z.union([z.string(), z.number()]).optional(),
});

export const FinancialReportResponse = successEnvelope(z.unknown());
export const OwnerDashboardResponse = z.object({
  success: z.literal(true),
  data: z.unknown(),
  timestamp: z.union([z.string(), z.number()]).optional(),
});
