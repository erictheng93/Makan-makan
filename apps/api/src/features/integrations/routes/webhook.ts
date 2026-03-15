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

  // Look up integration by platform — filter by enabled, then match storeId from credentials JSON
  const integrations = await db
    .select()
    .from(platformIntegrations)
    .where(
      and(
        eq(platformIntegrations.platform, "uber_eats"),
        eq(platformIntegrations.enabled, true),
      ),
    );

  // Find the integration whose credentials contain the matching storeId
  const integration = integrations.find((i) => {
    const creds = i.credentials as { storeId?: string } | null;
    return creds?.storeId === storeId;
  });

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

  const config = integration.config as { webhookSecret?: string } | null;
  const webhookSecret = config?.webhookSecret ?? creds.clientSecret ?? "";
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
  const now = new Date();

  const [insertedLog] = await db
    .insert(platformWebhookLogs)
    .values({
      restaurantId: integration.restaurantId,
      platform: "uber_eats",
      eventType: (payload.event_type as string) ?? "order",
      payload: body as unknown as Record<string, unknown>,
      status: "received",
      createdAt: now,
    })
    .returning({ id: platformWebhookLogs.id });

  const logId = insertedLog.id;

  // Process the order — keep internal try/catch to record failure in the log
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
        error: errorMessage,
        processedAt: new Date(),
      })
      .where(eq(platformWebhookLogs.id, logId));

    return c.json({ error: "Processing failed" }, 500);
  }
});

webhookRoutes.post("/foodpanda", async (c) => {
  return c.json({ error: "Foodpanda integration not yet implemented" }, 501);
});

export default webhookRoutes;
