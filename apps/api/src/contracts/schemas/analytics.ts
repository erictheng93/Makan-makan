/**
 * Analytics API Response Contracts
 */

import { z } from "zod";
import { successEnvelope } from "../helpers";

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const DashboardResponse = z.object({
  success: z.literal(true),
  data: z.unknown(),
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
