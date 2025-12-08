/**
 * AI Analytics Routes
 * API endpoints for AI-powered business analytics
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../../../types/env';
import { AIAnalyticsService } from '../services/AIAnalyticsService';
import {
  configureAISchema,
  testProviderSchema,
  generateAnalyticsSchema,
  productQuerySchema,
  usageQuerySchema,
} from '../schemas/validation';

const routes = new Hono<{ Bindings: Env; Variables: { userId: string; userRole: number } }>();

/**
 * GET /config/:restaurantId
 * Get AI configuration for a restaurant
 */
routes.get('/config/:restaurantId', async (c) => {
  const restaurantId = c.req.param('restaurantId');
  const userRole = c.get('userRole');

  // Check permissions (Admin or Owner only)
  if (userRole !== 0 && userRole !== 1) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);
  const config = await service.getConfig(restaurantId);

  if (!config) {
    return c.json({
      success: true,
      config: null,
      availableProviders: ['anthropic', 'openai', 'google', 'deepseek', 'custom'],
    });
  }

  return c.json({
    success: true,
    config: {
      ...config,
      apiKeyEncrypted: '***', // Never return actual API key
    },
  });
});

/**
 * POST /config
 * Configure AI provider for a restaurant
 */
routes.post('/config', zValidator('json', configureAISchema), async (c) => {
  const data = c.req.valid('json');
  const userRole = c.get('userRole');

  // Check permissions
  if (userRole !== 0 && userRole !== 1) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);

    // Test the provider first
    const testResult = await service.testProvider({
      provider: data.provider,
      apiKey: data.apiKey,
      model: data.model,
      baseUrl: data.customBaseUrl,
    });

    if (!testResult.success) {
      return c.json({
        success: false,
        error: `Provider test failed: ${testResult.error}`,
      }, 400);
    }

    await service.saveConfig(data);

    return c.json({
      success: true,
      message: 'AI configuration saved successfully',
      testResult: {
        latency: testResult.latencyMs,
        model: testResult.model,
      },
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Configuration failed',
    }, 500);
  }
});

/**
 * POST /test-provider
 * Test an AI provider configuration
 */
routes.post('/test-provider', zValidator('json', testProviderSchema), async (c) => {
  const data = c.req.valid('json');

  try {
    const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);
    const result = await service.testProvider(data);
    return c.json(result);
  } catch (error) {
    return c.json({
      success: false,
      provider: data.provider,
      error: error instanceof Error ? error.message : 'Test failed',
    });
  }
});

/**
 * GET /models/:provider
 * Get available models for a provider
 */
routes.get('/models/:provider', (c) => {
  const provider = c.req.param('provider');
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
routes.post('/generate', zValidator('json', generateAnalyticsSchema), async (c) => {
  const data = c.req.valid('json');
  const userRole = c.get('userRole');

  // Check permissions
  if (userRole !== 0 && userRole !== 1) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);
    const report = await service.generateReport(
      data.restaurantId,
      data.timeRange,
      {
        includeForecasting: data.includeForecasting,
        refreshCache: data.refreshCache,
      }
    );

    return c.json({
      success: true,
      report,
      cached: false,
    });
  } catch (error) {
    console.error('Analytics generation error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate analytics',
    }, 500);
  }
});

/**
 * GET /products/traffic-drivers/:restaurantId
 * Get traffic driver products
 */
routes.get('/products/traffic-drivers/:restaurantId', zValidator('query', productQuerySchema), async (c) => {
  const restaurantId = c.req.param('restaurantId');
  const { timeRange, limit } = c.req.valid('query');

  try {
    const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);
    const products = await service.getTrafficDrivers(
      restaurantId,
      { range: timeRange as '7d' | '14d' | '30d' | '90d' | '180d' | '1y' | 'custom' },
      limit
    );

    return c.json({ success: true, products });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch traffic drivers',
    }, 500);
  }
});

/**
 * GET /products/bestsellers/:restaurantId
 * Get bestselling products
 */
routes.get('/products/bestsellers/:restaurantId', zValidator('query', productQuerySchema), async (c) => {
  const restaurantId = c.req.param('restaurantId');
  const { timeRange, limit } = c.req.valid('query');

  try {
    const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);
    const products = await service.getBestsellers(
      restaurantId,
      { range: timeRange as '7d' | '14d' | '30d' | '90d' | '180d' | '1y' | 'custom' },
      limit
    );

    return c.json({ success: true, products });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch bestsellers',
    }, 500);
  }
});

/**
 * GET /products/profit-leaders/:restaurantId
 * Get profit leader products
 */
routes.get('/products/profit-leaders/:restaurantId', zValidator('query', productQuerySchema), async (c) => {
  const restaurantId = c.req.param('restaurantId');
  const { timeRange, limit } = c.req.valid('query');

  try {
    const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);
    const products = await service.getProfitLeaders(
      restaurantId,
      { range: timeRange as '7d' | '14d' | '30d' | '90d' | '180d' | '1y' | 'custom' },
      limit
    );

    return c.json({ success: true, products });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch profit leaders',
    }, 500);
  }
});

/**
 * GET /products/analysis/:restaurantId
 * Get comprehensive product analysis
 */
routes.get('/products/analysis/:restaurantId', zValidator('query', productQuerySchema), async (c) => {
  const restaurantId = c.req.param('restaurantId');
  const { timeRange } = c.req.valid('query');

  try {
    const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);
    const products = await service.analyzeProducts(
      restaurantId,
      { range: timeRange as '7d' | '14d' | '30d' | '90d' | '180d' | '1y' | 'custom' }
    );

    return c.json({ success: true, products });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze products',
    }, 500);
  }
});

/**
 * GET /usage/:restaurantId
 * Get AI usage statistics
 */
routes.get('/usage/:restaurantId', zValidator('query', usageQuerySchema), async (c) => {
  const restaurantId = c.req.param('restaurantId');
  const { startDate, endDate } = c.req.valid('query');

  try {
    const service = new AIAnalyticsService(c.env.DB, c.env.ENCRYPTION_KEY);
    const usage = await service.getUsageStats(restaurantId, startDate, endDate);

    return c.json({
      success: true,
      usage,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch usage stats',
    }, 500);
  }
});

export default routes;
