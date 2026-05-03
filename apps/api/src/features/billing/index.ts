import { Hono } from "hono";
import type { Env, FeatureModule } from "../../shared/types";
import routes from "./routes";

const FEATURE_NAME = "billing";
const FEATURE_VERSION = "1.0.0";

class BillingModule implements FeatureModule {
  public readonly name = FEATURE_NAME;
  public readonly version = FEATURE_VERSION;
  public readonly routes: Hono<{ Bindings: Env }>;

  constructor() {
    this.routes = new Hono<{ Bindings: Env }>();
    this.routes.route("/", routes);
  }

  async healthCheck() {
    return {
      status: "healthy" as const,
      message: "Billing module operational",
    };
  }
}

export default new BillingModule();
