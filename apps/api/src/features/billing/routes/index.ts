import { Hono } from "hono";
import type { Env } from "../../../types/env";
import { ApiError } from "../../../shared/utils/api-error";
import { BillingWebhookService } from "../services/BillingWebhookService";

const router = new Hono<{ Bindings: Env }>();

router.post("/webhooks/:provider", async (c) => {
  const provider = c.req.param("provider").toLowerCase();
  const rawBody = await c.req.text();

  let result;
  try {
    result = await new BillingWebhookService(c.env).handle(
      provider,
      rawBody,
      c.req.raw.headers,
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ApiError("WEBHOOK_INVALID_JSON", "Invalid webhook JSON", 400);
    }
    throw new ApiError(
      "WEBHOOK_SIGNATURE_INVALID",
      error instanceof Error ? error.message : "Invalid webhook signature",
      401,
    );
  }

  return c.json({
    success: true,
    data: result,
  });
});

export default router;
