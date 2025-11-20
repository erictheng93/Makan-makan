/**
 * AI Analytics API Routes
 * Endpoints for AI-powered business analytics
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  AIInsightsService,
  ProductAnalysisService,
  testProvider,
  getDefaultModel,
  getAvailableModels,
} from '@makanmakan/ai-analytics';
import { getCurrentTimestamp } from '@makanmakan/database';
import type {
  LLMConfig,
} from '@makanmakan/ai-analytics';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string; // For encrypting API keys
};

const app = new Hono<{ Bindings: Env; Variables: { userId: string; userRole: number } }>();

// ============================================
// Validation Schemas
// ============================================

const timeRangeSchema = z.object({
  range: z.enum(['7d', '14d', '30d', '90d', '180d', '1y', 'custom']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const configureAISchema = z.object({
  restaurantId: z.string(),
  provider: z.enum(['anthropic', 'openai', 'google', 'deepseek', 'custom']),
  apiKey: z.string().min(10),
  model: z.string().optional(),
  customBaseUrl: z.string().url().optional(),
});

const testProviderSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'google', 'deepseek', 'custom']),
  apiKey: z.string().min(10),
  model: z.string().optional(),
  baseUrl: z.string().url().optional(),
});

const generateAnalyticsSchema = z.object({
  restaurantId: z.string(),
  timeRange: timeRangeSchema,
  includeForecasting: z.boolean().optional(),
  refreshCache: z.boolean().optional(),
});

// ============================================
// Helper Functions
// ============================================

/**
 * Simple AES-256 encryption for API keys
 * Note: In production, use a proper encryption library
 */
async function encryptApiKey(apiKey: string, _key: string): Promise<string> {
  // For now, use base64 encoding
  // TODO: Implement proper AES-256 encryption
  return btoa(apiKey);
}

async function decryptApiKey(encryptedKey: string, _key: string): Promise<string> {
  // For now, use base64 decoding
  // TODO: Implement proper AES-256 decryption
  return atob(encryptedKey);
}

async function getLLMConfig(db: D1Database, restaurantId: string, encryptionKey: string): Promise<LLMConfig | null> {
  const query = `
    SELECT provider, api_key_encrypted, model, custom_base_url
    FROM ai_configurations
    WHERE restaurant_id = ?
      AND enabled = 1
    LIMIT 1
  `;

  const result = await db.prepare(query).bind(restaurantId).first<{
    provider: string;
    api_key_encrypted: string;
    model: string | null;
    custom_base_url: string | null;
  }>();

  if (!result) return null;

  const apiKey = await decryptApiKey(result.api_key_encrypted, encryptionKey);

  return {
    provider: result.provider as any,
    apiKey,
    model: result.model || undefined,
    baseUrl: result.custom_base_url || undefined,
  };
}

// ============================================
// Routes
// ============================================

/**
 * GET /ai-analytics/config/:restaurantId
 * Get AI configuration for a restaurant
 */
app.get('/config/:restaurantId', async (c) => {
  const restaurantId = c.req.param('restaurantId');
  const userRole = c.get('userRole');

  // Check permissions (Admin or Owner only)
  if (userRole !== 0 && userRole !== 1) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  const query = `
    SELECT id, provider, model, custom_base_url, enabled, created_at, updated_at
    FROM ai_configurations
    WHERE restaurant_id = ?
  `;

  const config = await c.env.DB.prepare(query).bind(restaurantId).first();

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
      apiKey: '***', // Never return actual API key
    },
  });
});

/**
 * POST /ai-analytics/config
 * Configure AI provider for a restaurant
 */
app.post('/config', zValidator('json', configureAISchema), async (c) => {
  const data = c.req.valid('json');
  const userRole = c.get('userRole');

  // Check permissions
  if (userRole !== 0 && userRole !== 1) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    // Encrypt API key
    const encryptedKey = await encryptApiKey(data.apiKey, c.env.ENCRYPTION_KEY);

    // Test the provider first
    const testResult = await testProvider({
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

    // Save configuration
    const now = getCurrentTimestamp();
    const query = `
      INSERT INTO ai_configurations (
        restaurant_id, provider, api_key_encrypted, model, custom_base_url, enabled, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT (restaurant_id)
      DO UPDATE SET
        provider = excluded.provider,
        api_key_encrypted = excluded.api_key_encrypted,
        model = excluded.model,
        custom_base_url = excluded.custom_base_url,
        enabled = 1,
        updated_at = excluded.updated_at
    `;

    await c.env.DB.prepare(query)
      .bind(
        data.restaurantId,
        data.provider,
        encryptedKey,
        data.model || null,
        data.customBaseUrl || null,
        now
      )
      .run();

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
 * POST /ai-analytics/test-provider
 * Test an AI provider configuration
 */
app.post('/test-provider', zValidator('json', testProviderSchema), async (c) => {
  const data = c.req.valid('json');

  try {
    const result = await testProvider({
      provider: data.provider,
      apiKey: data.apiKey,
      model: data.model,
      baseUrl: data.baseUrl,
    });

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
 * GET /ai-analytics/models/:provider
 * Get available models for a provider
 */
app.get('/models/:provider', (c) => {
  const provider = c.req.param('provider') as any;
  const models = getAvailableModels(provider);
  const defaultModel = getDefaultModel(provider);

  return c.json({
    success: true,
    provider,
    models,
    defaultModel,
  });
});

/**
 * POST /ai-analytics/generate
 * Generate AI analytics report
 */
app.post('/generate', zValidator('json', generateAnalyticsSchema), async (c) => {
  const data = c.req.valid('json');
  const userRole = c.get('userRole');

  // Check permissions
  if (userRole !== 0 && userRole !== 1) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    // Get LLM configuration
    const llmConfig = await getLLMConfig(c.env.DB, data.restaurantId, c.env.ENCRYPTION_KEY);

    if (!llmConfig) {
      return c.json({
        success: false,
        error: 'AI provider not configured. Please configure an AI provider first.',
      }, 400);
    }

    // Generate report
    const service = new AIInsightsService(c.env.DB);
    const report = await service.generateReport(
      data.restaurantId,
      llmConfig,
      data.timeRange,
      {
        includeForecasting: data.includeForecasting,
        refreshCache: data.refreshCache,
      }
    );

    // Log usage
    await c.env.DB.prepare(`
      INSERT INTO ai_usage_logs (
        restaurant_id, provider, model, operation, tokens_used, latency_ms, success
      ) VALUES (?, ?, ?, ?, ?, ?, 1)
    `).bind(
      data.restaurantId,
      llmConfig.provider,
      llmConfig.model || getDefaultModel(llmConfig.provider),
      'generate_report',
      report.metadata.tokensUsed || 0,
      report.metadata.processingTimeMs
    ).run();

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
 * GET /ai-analytics/products/traffic-drivers/:restaurantId
 * Get traffic driver products (引流產品)
 */
app.get('/products/traffic-drivers/:restaurantId', zValidator('query', z.object({
  timeRange: z.string().default('30d'),
  limit: z.string().transform(Number).default('10'),
})), async (c) => {
  const restaurantId = c.req.param('restaurantId');
  const { timeRange, limit } = c.req.valid('query');

  try {
    const service = new ProductAnalysisService(c.env.DB);
    const products = await service.getTrafficDrivers(
      restaurantId,
      { range: timeRange as any },
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
 * GET /ai-analytics/products/bestsellers/:restaurantId
 * Get bestselling products (熱銷產品)
 */
app.get('/products/bestsellers/:restaurantId', zValidator('query', z.object({
  timeRange: z.string().default('30d'),
  limit: z.string().transform(Number).default('10'),
})), async (c) => {
  const restaurantId = c.req.param('restaurantId');
  const { timeRange, limit } = c.req.valid('query');

  try {
    const service = new ProductAnalysisService(c.env.DB);
    const products = await service.getBestsellers(
      restaurantId,
      { range: timeRange as any },
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
 * GET /ai-analytics/products/profit-leaders/:restaurantId
 * Get profit leader products (利潤最大產品)
 */
app.get('/products/profit-leaders/:restaurantId', zValidator('query', z.object({
  timeRange: z.string().default('30d'),
  limit: z.string().transform(Number).default('10'),
})), async (c) => {
  const restaurantId = c.req.param('restaurantId');
  const { timeRange, limit } = c.req.valid('query');

  try {
    const service = new ProductAnalysisService(c.env.DB);
    const products = await service.getProfitLeaders(
      restaurantId,
      { range: timeRange as any },
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
 * GET /ai-analytics/products/analysis/:restaurantId
 * Get comprehensive product analysis
 */
app.get('/products/analysis/:restaurantId', zValidator('query', z.object({
  timeRange: z.string().default('30d'),
})), async (c) => {
  const restaurantId = c.req.param('restaurantId');
  const { timeRange } = c.req.valid('query');

  try {
    const service = new ProductAnalysisService(c.env.DB);
    const products = await service.analyzeProducts(
      restaurantId,
      { range: timeRange as any }
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
 * GET /ai-analytics/usage/:restaurantId
 * Get AI usage statistics
 */
app.get('/usage/:restaurantId', zValidator('query', z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})), async (c) => {
  const restaurantId = c.req.param('restaurantId');
  const { startDate, endDate } = c.req.valid('query');

  const query = `
    SELECT
      provider,
      model,
      operation,
      COUNT(*) AS request_count,
      SUM(tokens_used) AS total_tokens,
      AVG(latency_ms) AS avg_latency_ms,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successful_requests
    FROM ai_usage_logs
    WHERE restaurant_id = ?
      ${startDate ? 'AND DATE(created_at) >= ?' : ''}
      ${endDate ? 'AND DATE(created_at) <= ?' : ''}
    GROUP BY provider, model, operation
    ORDER BY created_at DESC
  `;

  const bindings = [restaurantId];
  if (startDate) bindings.push(startDate);
  if (endDate) bindings.push(endDate);

  const result = await c.env.DB.prepare(query).bind(...bindings).all();

  return c.json({
    success: true,
    usage: result.results || [],
  });
});

export default app;
