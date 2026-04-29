/**
 * Analytics Feature Module
 * Consolidated analytics operations including dashboard, revenue, performance, and real-time data
 */

import { Hono } from "hono";
import type { Env, FeatureModule } from "../../shared/types";
import { ConsoleLogger } from "../../core/monitoring";

// Import feature routes
import routes from "./routes";

// Feature metadata
const FEATURE_NAME = "analytics";
const FEATURE_VERSION = "1.0.0";

// Feature module implementation
class AnalyticsModule implements FeatureModule {
  public readonly name = FEATURE_NAME;
  public readonly version = FEATURE_VERSION;
  public readonly routes: Hono<{ Bindings: Env }>;
  private logger: ConsoleLogger;

  constructor() {
    this.logger = new ConsoleLogger(FEATURE_NAME);
    this.routes = new Hono<{ Bindings: Env }>();
    this.setupRoutes();
    this.logger.info(`${FEATURE_NAME} module initialized`, {
      version: FEATURE_VERSION,
    });
  }

  private setupRoutes() {
    // Mount feature routes
    this.routes.route("/", routes);

    // Feature-specific middleware can be added here
    this.routes.use("*", async (c, next) => {
      const start = Date.now();
      await next();
      const duration = Date.now() - start;
      this.logger.debug(`${c.req.method} ${c.req.path} - ${duration}ms`);
    });
  }

  // Health check endpoint
  getHealthStatus() {
    return {
      name: this.name,
      version: this.version,
      status: "healthy",
      timestamp: new Date().toISOString(),
      features: {
        dashboardAnalytics: true,
        revenueAnalytics: true,
        productAnalytics: true,
        customerAnalytics: true,
        performanceAnalytics: true,
        realtimeData: true,
        exportFunctionality: true,
        sseStreaming: true,
      },
    };
  }
}

// Export the feature module class
export { AnalyticsModule };

// Factory function for lazy initialization
let analyticsModuleInstance: AnalyticsModule | null = null;
export function createAnalyticsModule(): AnalyticsModule {
  if (!analyticsModuleInstance) {
    analyticsModuleInstance = new AnalyticsModule();
  }
  return analyticsModuleInstance;
}

// Default export — shorthand for `import x from "..."` consumers
export default {
  get routes() {
    return createAnalyticsModule().routes;
  },
  getHealthStatus: () => createAnalyticsModule().getHealthStatus(),
};

// Export types for external use
export type { IAnalyticsService } from "./types";
export type * from "./types";

// Export service for direct use
export { AnalyticsService } from "./services/AnalyticsService";
