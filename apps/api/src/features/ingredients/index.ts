import { Hono } from "hono";
import type { Env, FeatureModule } from "../../shared/types";
import { ConsoleLogger } from "../../core/monitoring";
import routes from "./routes";

const FEATURE_NAME = "ingredients";
const FEATURE_VERSION = "1.0.0";

class IngredientsModule implements FeatureModule {
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
        ingredientCrud: true,
        recipeCrud: true,
        bulkImport: true,
        stockTracking: true,
      },
    };
  }
}

export { IngredientsModule };

let instance: IngredientsModule | null = null;
export function createIngredientsModule(): IngredientsModule {
  if (!instance) instance = new IngredientsModule();
  return instance;
}

export default {
  get routes() {
    return createIngredientsModule().routes;
  },
  getHealthStatus: () => createIngredientsModule().getHealthStatus(),
};
