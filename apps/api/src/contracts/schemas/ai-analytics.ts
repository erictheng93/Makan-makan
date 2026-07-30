/**
 * AI Analytics API Response Contracts
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const GetConfigResponse = z.object({
  success: z.literal(true),
  config: z.unknown(),
  availableProviders: z.array(z.string()).optional(),
});

export const SaveConfigResponse = z.object({
  success: z.literal(true),
  message: z.string(),
  testResult: z
    .object({
      latency: z.number().optional(),
      latencyMs: z.number().optional(),
      model: z.string().optional(),
    })
    .loose()
    .optional(),
});

export const TestProviderResponse = z
  .object({
    success: z.boolean().optional(),
    error: z.string().optional(),
    latencyMs: z.number().optional(),
    model: z.string().optional(),
  })
  .loose();

export const GenerateReportResponse = z.object({
  success: z.literal(true),
  report: z.unknown(),
  cached: z.boolean().optional(),
});

export const ProductAnalysisResponse = z.object({
  success: z.literal(true),
  products: z.array(z.unknown()),
});

export const UsageStatsResponse = z.object({
  success: z.literal(true),
  usage: z.unknown(),
});

export const ListModelsResponse = z.object({
  success: z.literal(true),
  provider: z.string(),
  models: z.array(z.unknown()),
  defaultModel: z.string().optional(),
});
