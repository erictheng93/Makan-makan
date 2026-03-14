import { Hono } from "hono";
import type { Env, FeatureModule } from "../../shared/types";
import { ConsoleLogger } from "../../core/monitoring";
import routes from "./routes";

const FEATURE_NAME = "discovery";
const FEATURE_VERSION = "1.0.0";

class DiscoveryModule implements FeatureModule {
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
        dishSearch: true,
        restaurantBrowse: true,
        popularItems: true,
        reindex: true,
      },
    };
  }
}

export { DiscoveryModule };

let instance: DiscoveryModule | null = null;
export function createDiscoveryModule(): DiscoveryModule {
  if (!instance) instance = new DiscoveryModule();
  return instance;
}

export default {
  get routes() {
    return createDiscoveryModule().routes;
  },
  getHealthStatus: () => createDiscoveryModule().getHealthStatus(),
};
