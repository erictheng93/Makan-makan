/**
 * AI Analytics Routes
 * API endpoints for AI-powered business analytics
 */

import { Hono } from "hono";
import type { Env } from "../../../types/env";
import { AIAnalyticsService } from "../services/AIAnalyticsService";
import {
  configureAISchema,
  testProviderSchema,
  generateAnalyticsSchema,
  productQuerySchema,
  usageQuerySchema,
} from "../schemas/validation";
import { validateBody, validateQuery } from "../../../middleware/validation";
import { forbidden, badRequest } from "../../../shared/utils/api-error";

const routes = new Hono<{
  Bindings: Env;
  Variables: { userId: string; userRole: number };
}>();

/**
 * GET /config/:restaurantId
 * Get AI configuration for a restaurant
 */
routes.get("/config/:restaurantId", async (c) => {
  const restaurantId = c.req.param("restaurantId");
  const userRole = c.get("userRole");

  // Check permissions (Admin or Owner only)
  if (userRole !== 0 && userRole !== 1) {
    throw forbidden("Unauthorized");
  }

  const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);
  const config = await service.getConfig(restaurantId);

  if (!config) {
    return c.json({
      success: true,
      config: null,
      availableProviders: [
        "anthropic",
        "openai",
        "google",
        "deepseek",
        "custom",
      ],
    });
  }

  return c.json({
    success: true,
    config: {
      ...config,
      apiKeyEncrypted: "***", // Never return actual API key
    },
  });
});

/**
 * POST /config
 * Configure AI provider for a restaurant
 */
routes.post("/config", validateBody(configureAISchema), async (c) => {
  const data = c.get("validatedBody");
  const userRole = c.get("userRole");

  // Check permissions
  if (userRole !== 0 && userRole !== 1) {
    throw forbidden("Unauthorized");
  }

  const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);

  // Test the provider first
  const testResult = await service.testProvider({
    provider: data.provider,
    apiKey: data.apiKey,
    model: data.model,
    baseUrl: data.customBaseUrl,
  });

  if (!testResult.success) {
    throw badRequest(`Provider test failed: ${testResult.error}`);
  }

  await service.saveConfig(data);

  return c.json({
    success: true,
    message: "AI configuration saved successfully",
    testResult: {
      latency: testResult.latencyMs,
      model: testResult.model,
    },
  });
});

/**
 * POST /test-provider
 * Test an AI provider configuration
 */
routes.post("/test-provider", validateBody(testProviderSchema), async (c) => {
  const data = c.get("validatedBody");
  const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);
  const result = await service.testProvider(data);
  return c.json(result);
});

/**
 * GET /models/:provider
 * Get available models for a provider
 */
routes.get("/models/:provider", (c) => {
  const provider = c.req.param("provider");
  const models = AIAnalyticsService.getAvailableModels(provider);
  const defaultModel = AIAnalyticsService.getDefaultModel(provider);

  return c.json({
    success: true,
    provider,
    models,
    defaultModel,
  });
});

/**
 * POST /generate
 * Generate AI analytics report
 */
routes.post("/generate", validateBody(generateAnalyticsSchema), async (c) => {
  const data = c.get("validatedBody");
  const userRole = c.get("userRole");

  // Check permissions
  if (userRole !== 0 && userRole !== 1) {
    throw forbidden("Unauthorized");
  }

  const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);
  const report = await service.generateReport(
    data.restaurantId,
    data.timeRange,
    {
      includeForecasting: data.includeForecasting,
      refreshCache: data.refreshCache,
    },
  );

  return c.json({
    success: true,
    report,
    cached: false,
  });
});

/**
 * GET /products/traffic-drivers/:restaurantId
 * Get traffic driver products
 */
routes.get(
  "/products/traffic-drivers/:restaurantId",
  validateQuery(productQuerySchema),
  async (c) => {
    const restaurantId = c.req.param("restaurantId");
    const { timeRange, limit } = c.get("validatedQuery");

    const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);
    const products = await service.getTrafficDrivers(
      restaurantId,
      {
        range: timeRange as
          | "7d"
          | "14d"
          | "30d"
          | "90d"
          | "180d"
          | "1y"
          | "custom",
      },
      limit,
    );

    return c.json({ success: true, products });
  },
);

/**
 * GET /products/bestsellers/:restaurantId
 * Get bestselling products
 */
routes.get(
  "/products/bestsellers/:restaurantId",
  validateQuery(productQuerySchema),
  async (c) => {
    const restaurantId = c.req.param("restaurantId");
    const { timeRange, limit } = c.get("validatedQuery");

    const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);
    const products = await service.getBestsellers(
      restaurantId,
      {
        range: timeRange as
          | "7d"
          | "14d"
          | "30d"
          | "90d"
          | "180d"
          | "1y"
          | "custom",
      },
      limit,
    );

    return c.json({ success: true, products });
  },
);

/**
 * GET /products/profit-leaders/:restaurantId
 * Get profit leader products
 */
routes.get(
  "/products/profit-leaders/:restaurantId",
  validateQuery(productQuerySchema),
  async (c) => {
    const restaurantId = c.req.param("restaurantId");
    const { timeRange, limit } = c.get("validatedQuery");

    const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);
    const products = await service.getProfitLeaders(
      restaurantId,
      {
        range: timeRange as
          | "7d"
          | "14d"
          | "30d"
          | "90d"
          | "180d"
          | "1y"
          | "custom",
      },
      limit,
    );

    return c.json({ success: true, products });
  },
);

/**
 * GET /products/analysis/:restaurantId
 * Get comprehensive product analysis
 */
routes.get(
  "/products/analysis/:restaurantId",
  validateQuery(productQuerySchema),
  async (c) => {
    const restaurantId = c.req.param("restaurantId");
    const { timeRange } = c.get("validatedQuery");

    const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);
    const products = await service.analyzeProducts(restaurantId, {
      range: timeRange as
        | "7d"
        | "14d"
        | "30d"
        | "90d"
        | "180d"
        | "1y"
        | "custom",
    });

    return c.json({ success: true, products });
  },
);

/**
 * GET /usage/:restaurantId
 * Get AI usage statistics
 */
routes.get(
  "/usage/:restaurantId",
  validateQuery(usageQuerySchema),
  async (c) => {
    const restaurantId = c.req.param("restaurantId");
    const { startDate, endDate } = c.get("validatedQuery");

    const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);
    const usage = await service.getUsageStats(restaurantId, startDate, endDate);

    return c.json({
      success: true,
      usage,
    });
  },
);

export default routes;
