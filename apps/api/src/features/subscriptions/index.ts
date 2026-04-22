/**
 * Subscriptions Feature Module
 * Admin-only module management and shop subscription lifecycle.
 */

import { Hono } from "hono";
import type { Env, FeatureModule } from "../../shared/types";
import routes from "./routes";

const FEATURE_NAME = "subscriptions";
const FEATURE_VERSION = "1.0.0";

class SubscriptionsModule implements FeatureModule {
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
      message: "Subscriptions module operational",
    };
  }
}

export default new SubscriptionsModule();
