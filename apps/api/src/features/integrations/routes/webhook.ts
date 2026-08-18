import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import {
  platformIntegrations,
  platformWebhookLogs,
} from "@makanmasak/database";
import type { Env } from "../../../types/env";
import { getAdapter } from "../adapters/PlatformAdapter";
import { PlatformOrderService } from "../services/PlatformOrderService";
import { PlatformIntegrationService } from "../services/PlatformIntegrationService";
import { idempotencyMiddleware } from "../../../middleware/idempotency";

const webhookRoutes = new Hono<{ Bindings: Env }>();

// Webhook error bodies are an external platform contract. Uber Eats and
// Foodpanda determine delivery success from the HTTP status, so these routes
// intentionally retain their established `{ error: string }` responses rather
// than adopting the internal API error envelope.

webhookRoutes.post(
  "/uber-eats",
  idempotencyMiddleware({
    scope: "webhook",
    keyResolver: (c, rawBody) => {
      const headerKey = c.req.header("Idempotency-Key");
      if (headerKey) return headerKey;

      try {
        const payload = JSON.parse(rawBody) as {
          event_id?: string;
          eventId?: string;
        };
        return payload.event_id ?? payload.eventId ?? null;
      } catch {
        return null;
      }
    },
    effectId: async (_c, response) => {
      const body = (await response.clone().json()) as {
        orderId?: number;
        data?: { orderId?: number };
      };
      const orderId = body.data?.orderId ?? body.orderId;
      return orderId == null ? null : String(orderId);
    },
  }),
  async (c) => {
    const db = drizzle(c.env.DB);
    const body = await c.req.text();
    let payload: Record<string, unknown>;

    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return c.json(
        {
          success: false,
          error: { code: "INVALID_JSON", message: "Invalid JSON payload" },
        },
        400,
      );
    }

    const storePayload = payload as { store?: { id?: string } };
    const storeId = storePayload.store?.id;
    if (!storeId) {
      return c.json(
        {
          success: false,
          error: {
            code: "MISSING_PARAM",
            message: "Missing store.id in payload",
          },
        },
        400,
      );
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

    const integrationService = new PlatformIntegrationService(c.env);
    let matchedCredentials: { clientSecret?: string; webhookSecret?: string } =
      {};
    const integration =
      (
        await Promise.all(
          integrations.map(async (candidate) => {
            const creds = await integrationService.readStoredCredentials(
              candidate.credentials,
            );
            return creds.storeId === storeId
              ? { integration: candidate, credentials: creds }
              : null;
          }),
        )
      ).find((match) => match !== null) ?? null;

    if (!integration) {
      return c.json(
        {
          success: false,
          error: { code: "INTEGRATION_NOT_FOUND", message: "Unknown store" },
        },
        404,
      );
    }

    // Verify webhook signature
    const adapter = getAdapter("uber_eats");

    matchedCredentials = integration.credentials;
    const config = integration.integration.config as {
      webhookSecret?: string;
    } | null;
    const webhookSecret =
      matchedCredentials.webhookSecret ??
      config?.webhookSecret ??
      matchedCredentials.clientSecret ??
      "";

    const clonedRequest = new Request(c.req.url, {
      method: c.req.method,
      headers: c.req.raw.headers,
      body,
    });

    const isValid = await adapter.verifyWebhook(clonedRequest, webhookSecret);
    if (!isValid) {
      return c.json(
        {
          success: false,
          error: { code: "INVALID_SIGNATURE", message: "Invalid signature" },
        },
        401,
      );
    }

    // Log webhook receipt
    const now = new Date();
    const eventType = (payload.event_type as string) ?? "order";

    const [insertedLog] = await db
      .insert(platformWebhookLogs)
      .values({
        restaurantId: integration.integration.restaurantId,
        platform: "uber_eats",
        eventType,
        payload: body as unknown as Record<string, unknown>,
        status: "received",
        createdAt: now,
      })
      .returning({ id: platformWebhookLogs.id });

    const logId = insertedLog.id;

    // Payment-related callbacks (`payment.succeeded`, `payment.failed`, etc.)
    // are acknowledged here but do not flow through order parsing. They are
    // reconciled by the payments idempotency layer; the webhook just records
    // receipt and the replay contract comes from idempotencyMiddleware.
    if (eventType.startsWith("payment.")) {
      await db
        .update(platformWebhookLogs)
        .set({ status: "processed", processedAt: new Date() })
        .where(eq(platformWebhookLogs.id, logId));

      return c.json(
        {
          success: true,
          data: {
            acknowledged: true,
            eventType,
          },
        },
        200,
      );
    }

    // Process the order — keep internal try/catch to record failure in the log
    try {
      const orderService = new PlatformOrderService(c.env);
      const orderId = await orderService.processWebhook(
        "uber_eats",
        payload,
        integration.integration.restaurantId,
      );

      await db
        .update(platformWebhookLogs)
        .set({ status: "processed", processedAt: new Date() })
        .where(eq(platformWebhookLogs.id, logId));

      return c.json({ success: true, orderId }, 200);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await db
        .update(platformWebhookLogs)
        .set({
          status: "failed",
          error: errorMessage,
          processedAt: new Date(),
        })
        .where(eq(platformWebhookLogs.id, logId));

      return c.json(
        {
          success: false,
          error: {
            code: "WEBHOOK_PROCESSING_FAILED",
            message: "Processing failed",
          },
        },
        500,
      );
    }
  },
);

webhookRoutes.post("/foodpanda", async (c) => {
  return c.json(
    {
      success: false,
      error: {
        code: "INTEGRATION_NOT_AVAILABLE",
        message: "Foodpanda integration not yet implemented",
      },
    },
    501,
  );
});

export default webhookRoutes;
