/**
 * Restaurants Feature Module
 * Complete restaurant management functionality
 */

import { Hono } from "hono";
import type { Env, FeatureModule } from "../../shared/types";
import { ConsoleLogger } from "../../core/monitoring";

// Import feature routes
import routes from "./routes";

// Feature metadata
const FEATURE_NAME = "restaurants";
const FEATURE_VERSION = "1.0.0";

// Feature module implementation
class RestaurantsModule implements FeatureModule {
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
        restaurantListing: true,
        restaurantManagement: true,
        searchAndFiltering: true,
        statisticsTracking: true,
        nearbySearch: true,
        popularRestaurants: true,
        cacheOptimization: true,
        roleBasedAccess: true,
      },
    };
  }
}

// Export the feature module class
export { RestaurantsModule };

// Factory function for lazy initialization
let restaurantsModuleInstance: RestaurantsModule | null = null;
export function createRestaurantsModule(): RestaurantsModule {
  if (!restaurantsModuleInstance) {
    restaurantsModuleInstance = new RestaurantsModule();
  }
  return restaurantsModuleInstance;
}

// Default export — shorthand for `import x from "..."` consumers
export default {
  get routes() {
    return createRestaurantsModule().routes;
  },
  getHealthStatus: () => createRestaurantsModule().getHealthStatus(),
};
