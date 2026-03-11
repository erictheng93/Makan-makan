import { Hono } from "hono";
import type { Env } from "../../../types/env";
import webhookRoutes from "./webhook";
import adminRoutes from "./admin";

const routes = new Hono<{ Bindings: Env }>();

routes.route("/webhooks", webhookRoutes);
routes.route("/", adminRoutes);

export default routes;
