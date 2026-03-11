import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import { platformWebhookLogs } from "@makanmakan/database";
import type {
  PlatformType,
  ConnectPlatformRequest,
  UpdatePlatformConfigRequest,
  PlatformOrdersFilter,
} from "@makanmakan/shared-types";
import type { Env } from "../../../types/env";
import { requireRole } from "../../../shared/middleware";
import { PlatformIntegrationService } from "../services/PlatformIntegrationService";
import { PlatformOrderService } from "../services/PlatformOrderService";
import { PlatformMenuSyncService } from "../services/PlatformMenuSyncService";

const adminRoutes = new Hono<{ Bindings: Env }>();

// All admin routes require admin (0) or shop owner (1) role
adminRoutes.use("/*", requireRole([0, 1]));

// GET /:restaurantId — list all integrations
adminRoutes.get("/:restaurantId", async (c) => {
  const restaurantId = c.req.param("restaurantId");
  const service = new PlatformIntegrationService(c.env);
  const integrations = await service.getIntegrations(restaurantId);
  return c.json({ data: integrations });
});

// GET /:restaurantId/:platform — get specific integration details
adminRoutes.get("/:restaurantId/:platform", async (c) => {
  const restaurantId = c.req.param("restaurantId");
  const platform = c.req.param("platform") as PlatformType;
  const service = new PlatformIntegrationService(c.env);

  const integration = await service.getIntegration(restaurantId, platform);
  if (!integration) {
    return c.json({ error: "Integration not found" }, 404);
  }

  return c.json({ data: integration });
});

// POST /:restaurantId/:platform/connect — connect platform
adminRoutes.post("/:restaurantId/:platform/connect", async (c) => {
  const restaurantId = c.req.param("restaurantId");
  const platform = c.req.param("platform") as PlatformType;
  const body = await c.req.json<ConnectPlatformRequest>();

  const service = new PlatformIntegrationService(c.env);
  const integration = await service.connect(restaurantId, platform, body);

  return c.json({ data: integration }, 201);
});

// PUT /:restaurantId/:platform — update config
adminRoutes.put("/:restaurantId/:platform", async (c) => {
  const restaurantId = c.req.param("restaurantId");
  const platform = c.req.param("platform") as PlatformType;
  const body = await c.req.json<UpdatePlatformConfigRequest>();

  const service = new PlatformIntegrationService(c.env);
  const integration = await service.updateConfig(restaurantId, platform, body);

  return c.json({ data: integration });
});

// DELETE /:restaurantId/:platform — disconnect
adminRoutes.delete("/:restaurantId/:platform", async (c) => {
  const restaurantId = c.req.param("restaurantId");
  const platform = c.req.param("platform") as PlatformType;

  const service = new PlatformIntegrationService(c.env);
  await service.disconnect(restaurantId, platform);

  return c.json({ success: true });
});

// POST /:restaurantId/:platform/menu-sync — trigger menu sync
adminRoutes.post("/:restaurantId/:platform/menu-sync", async (c) => {
  const restaurantId = c.req.param("restaurantId");
  const platform = c.req.param("platform") as PlatformType;

  const service = new PlatformMenuSyncService(c.env);

  try {
    await service.syncMenu(restaurantId, platform);
    return c.json({ success: true, message: "Menu sync completed" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: errorMessage }, 500);
  }
});

// GET /:restaurantId/:platform/orders — list platform orders
adminRoutes.get("/:restaurantId/:platform/orders", async (c) => {
  const restaurantId = c.req.param("restaurantId");
  const platform = c.req.param("platform") as PlatformType;

  const filters: PlatformOrdersFilter = {
    platform,
    platformStatus: c.req.query("status") ?? undefined,
    limit: c.req.query("limit") ? parseInt(c.req.query("limit")!) : 50,
    page: c.req.query("page") ? parseInt(c.req.query("page")!) : 1,
  };

  const service = new PlatformOrderService(c.env);
  const orders = await service.getPlatformOrders(restaurantId, filters);

  return c.json({ data: orders });
});

// GET /:restaurantId/webhook-logs — list webhook logs
adminRoutes.get("/:restaurantId/webhook-logs", async (c) => {
  const restaurantId = c.req.param("restaurantId");
  const platform = c.req.query("platform") as PlatformType | undefined;
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : 50;
  const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : 0;

  const db = drizzle(c.env.DB);

  const conditions = [eq(platformWebhookLogs.restaurantId, restaurantId)];
  if (platform) {
    conditions.push(eq(platformWebhookLogs.platform, platform));
  }

  const logs = await db
    .select()
    .from(platformWebhookLogs)
    .where(and(...conditions))
    .orderBy(desc(platformWebhookLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({ data: logs });
});

export default adminRoutes;
