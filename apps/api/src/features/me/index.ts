import { Hono } from "hono";
import type { Env, FeatureModule } from "../../shared/types";
import routes from "./routes";

class MeModule implements FeatureModule {
  public readonly name = "me";
  public readonly version = "1.0.0";
  public readonly routes: Hono<{ Bindings: Env }>;

  constructor() {
    this.routes = new Hono<{ Bindings: Env }>();
    this.routes.route("/", routes);
  }

  async healthCheck() {
    return {
      status: "healthy" as const,
      message: "Me module operational",
    };
  }
}

export default new MeModule();
