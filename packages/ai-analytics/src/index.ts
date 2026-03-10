/**
 * AI Analytics Package
 * Main entry point
 */

// Types
export * from "./types";

// Providers
export * from "./providers";

// Services
export { ProductAnalysisService } from "./services/ProductAnalysisService";
export { AIInsightsService } from "./services/AIInsightsService";

// Re-export commonly used functions
export {
  createProvider,
  testProvider,
  getDefaultModel,
  getAvailableModels,
} from "./providers";
