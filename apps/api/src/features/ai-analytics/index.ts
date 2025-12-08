/**
 * AI Analytics Feature Module
 *
 * This module handles AI-powered business analytics including:
 * - AI provider configuration (Anthropic, OpenAI, Google, DeepSeek, Custom)
 * - AI-powered report generation
 * - Product analysis (traffic drivers, bestsellers, profit leaders)
 * - Usage tracking and statistics
 */

import routes from './routes';
export { routes };
export { default as aiAnalyticsRoutes } from './routes';
export { AIAnalyticsService } from './services/AIAnalyticsService';
export * from './types';
// Note: schemas re-export types with same names, using explicit exports to avoid conflicts
export {
  timeRangeSchema,
  aiProviderSchema,
  configureAISchema,
  testProviderSchema,
  generateAnalyticsSchema,
  productQuerySchema,
  usageQuerySchema,
} from './schemas/validation';

export default {
  routes
};
