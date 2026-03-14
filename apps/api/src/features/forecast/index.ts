import { Hono } from "hono";
import type { Env, FeatureModule } from "../../shared/types";
import { ConsoleLogger } from "../../core/monitoring";
import routes from "./routes";

const FEATURE_NAME = "forecast";
const FEATURE_VERSION = "1.0.0";

class ForecastModule implements FeatureModule {
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
    this.routes.route("/", routes);
  }

  getHealthStatus() {
    return {
      name: this.name,
      version: this.version,
      status: "healthy",
      timestamp: new Date().toISOString(),
      features: {
        statisticalForecast: true,
        aiEnhanced: false, // Phase 2
        prepAlerts: true,
        accuracyTracking: true,
      },
    };
  }
}

export { ForecastModule };

let instance: ForecastModule | null = null;
export function createForecastModule(): ForecastModule {
  if (!instance) instance = new ForecastModule();
  return instance;
}

export default {
  get routes() {
    return createForecastModule().routes;
  },
  getHealthStatus: () => createForecastModule().getHealthStatus(),
};
