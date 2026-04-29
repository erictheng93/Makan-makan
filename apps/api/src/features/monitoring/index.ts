/**
 * Monitoring Feature Module
 * System monitoring, alerting, and performance tracking functionality
 */

import { Hono } from "hono";
import type { Env, FeatureModule } from "../../shared/types";
import { ConsoleLogger } from "../../core/monitoring";

// Import feature routes
import routes from "./routes";

// Feature metadata
const FEATURE_NAME = "monitoring";
const FEATURE_VERSION = "1.0.0";

// Create feature logger
const logger = new ConsoleLogger(FEATURE_NAME);

// Feature module implementation
class MonitoringModule implements FeatureModule {
  public readonly name = FEATURE_NAME;
  public readonly version = FEATURE_VERSION;
  public readonly routes: Hono<{ Bindings: Env }>;

  constructor() {
    this.routes = new Hono<{ Bindings: Env }>();
    this.setupRoutes();
    logger.info(`${FEATURE_NAME} module initialized`, {
      version: FEATURE_VERSION,
    });
  }

  private setupRoutes() {
    // Mount feature routes
    this.routes.route("/", routes);

    // Feature-specific middleware for monitoring
    this.routes.use("*", async (c, next) => {
      const start = Date.now();
      await next();
      const duration = Date.now() - start;
      logger.debug(`${c.req.method} ${c.req.path} - ${duration}ms`);
    });
  }

  // Health check endpoint
  getHealthStatus() {
    return {
      name: this.name,
      version: this.version,
      status: "healthy",
      timestamp: new Date().toISOString(),
      features: [
        "system_metrics",
        "health_monitoring",
        "alert_management",
        "performance_tracking",
        "error_reporting",
        "cache_monitoring",
      ],
    };
  }
}

// Export the feature module class
export { MonitoringModule };

// Factory function for lazy initialization
let monitoringModuleInstance: MonitoringModule | null = null;
export function createMonitoringModule(): MonitoringModule {
  if (!monitoringModuleInstance) {
    monitoringModuleInstance = new MonitoringModule();
  }
  return monitoringModuleInstance;
}

// Default export — shorthand for `import x from "..."` consumers
export default {
  get routes() {
    return createMonitoringModule().routes;
  },
  getHealthStatus: () => createMonitoringModule().getHealthStatus(),
};

// Re-export key components for external use
export {
  createMonitoringService,
  DEFAULT_ALERT_RULES,
} from "./services/MonitoringService";
export type {
  SystemMetrics,
  AlertRule,
  AlertConfig,
  HealthStatus,
  ComponentHealth,
  MonitoringOverview,
  PerformanceReport,
} from "./types";
export type {
  AlertRuleCreateRequest,
  AlertRuleUpdateRequest,
  ErrorRecordRequest,
  MetricsQueryParams,
  PerformanceReportQuery,
  PaginationParams,
  DateRangeParams,
  MonitoringConfig,
} from "./schemas/validation";
