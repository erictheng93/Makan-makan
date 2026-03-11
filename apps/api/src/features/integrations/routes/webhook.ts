import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import {
  platformIntegrations,
  platformWebhookLogs,
} from "@makanmakan/database";
import type { Env } from "../../../types/env";
import { getAdapter } from "../adapters/PlatformAdapter";
import { PlatformOrderService } from "../services/PlatformOrderService";
import { PlatformIntegrationService } from "../services/PlatformIntegrationService";
import { generateUUID } from "@makanmakan/utils";

const webhookRoutes = new Hono<{ Bindings: Env }>();

webhookRoutes.post("/uber-eats", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.text();
  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return c.json({ error: "Invalid JSON payload" }, 400);
  }

  const storePayload = payload as { store?: { id?: string } };
  const storeId = storePayload.store?.id;
  if (!storeId) {
    return c.json({ error: "Missing store.id in payload" }, 400);
  }

  // Look up integration by store_id
  const integrations = await db
    .select()
    .from(platformIntegrations)
    .where(
      and(
        eq(platformIntegrations.platform, "uber_eats"),
        eq(platformIntegrations.storeId, storeId),
        eq(platformIntegrations.isActive, true),
      ),
    )
    .limit(1);

  const integration = integrations[0];
  if (!integration) {
    return c.json({ error: "Unknown store" }, 404);
  }

  // Verify webhook signature
  const adapter = getAdapter("uber_eats");
  const integrationService = new PlatformIntegrationService(c.env);
  const creds = await integrationService.getDecryptedCredentials(
    integration.restaurantId,
    "uber_eats",
  );

  const webhookSecret = creds.webhookSecret ?? creds.clientSecret;
  const clonedRequest = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.raw.headers,
    body,
  });

  const isValid = await adapter.verifyWebhook(clonedRequest, webhookSecret);
  if (!isValid) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  // Log webhook receipt
  const logId = generateUUID();
  const now = new Date();

  await db.insert(platformWebhookLogs).values({
    id: logId,
    restaurantId: integration.restaurantId,
    platform: "uber_eats",
    eventType: (payload.event_type as string) ?? "order",
    payload: body,
    status: "received",
    createdAt: now,
  });

  // Process the order
  try {
    const orderService = new PlatformOrderService(c.env);
    const orderId = await orderService.processWebhook(
      "uber_eats",
      payload,
      integration.restaurantId,
    );

    await db
      .update(platformWebhookLogs)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(platformWebhookLogs.id, logId));

    return c.json({ success: true, orderId }, 200);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await db
      .update(platformWebhookLogs)
      .set({
        status: "failed",
        errorMessage,
        processedAt: new Date(),
      })
      .where(eq(platformWebhookLogs.id, logId));

    console.error("Webhook processing failed:", error);
    return c.json({ error: "Processing failed" }, 500);
  }
});

webhookRoutes.post("/foodpanda", async (c) => {
  return c.json({ error: "Foodpanda integration not yet implemented" }, 501);
});

export default webhookRoutes;
