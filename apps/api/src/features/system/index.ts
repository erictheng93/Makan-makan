/**
 * System Feature Module
 * Consolidated system-level operations including error reporting, health checks, and maintenance
 */

import { Hono } from "hono";
import type { Env, FeatureModule } from "../../shared/types";
import { ConsoleLogger } from "../../core/monitoring";

// Import feature routes
import routes from "./routes";

// Feature metadata
const FEATURE_NAME = "system";
const FEATURE_VERSION = "1.0.0";

// Feature module implementation
class SystemModule implements FeatureModule {
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
        errorReporting: true,
        systemHealthCheck: true,
        errorStatistics: true,
        cleanupOperations: true,
      },
    };
  }
}

// Export the feature module class
export { SystemModule };

// Factory function for lazy initialization
let systemModuleInstance: SystemModule | null = null;
export function createSystemModule(): SystemModule {
  if (!systemModuleInstance) {
    systemModuleInstance = new SystemModule();
  }
  return systemModuleInstance;
}

// Default export — shorthand for `import x from "..."` consumers
export default {
  get routes() {
    return createSystemModule().routes;
  },
  getHealthStatus: () => createSystemModule().getHealthStatus(),
};

// Export types for external use
export type { ISystemService } from "./types";
export type {
  ErrorReportRequest,
  ErrorReportResponse,
  SystemHealthResponse,
  ErrorStats,
  CleanupResponse,
} from "./types";

// Export service for direct use
export { SystemService } from "./services/SystemService";
