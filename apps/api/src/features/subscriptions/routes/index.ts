/**
 * Admin Subscription Routes
 *
 * All routes require admin authentication (role 0).
 * Mount at: /api/v1/admin/subscriptions
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../../../types/env";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { invalidateSubscriptionCache } from "../../../middleware/moduleGate";
import { SubscriptionService } from "../services/SubscriptionService";
import {
  createSubscriptionSchema,
  updateModulesSchema,
  changePlanSchema,
  setActiveSchema,
} from "../schemas";

const router = new Hono<{ Bindings: Env }>();

// All subscription management routes require admin access
router.use("*", authMiddleware, requireRole([0]));

// ─── List all subscriptions ───────────────────────────────────────────────────
router.get("/", async (c) => {
  const service = new SubscriptionService(c.env.DB);
  const subscriptions = await service.listAll();

  const withModules = subscriptions.map((sub) => ({
    ...sub,
    effectiveModules: service.getEffectiveModules(sub),
  }));

  return c.json({ success: true, data: withModules });
});

// ─── Get single subscription ──────────────────────────────────────────────────
router.get("/:restaurantId", async (c) => {
  const service = new SubscriptionService(c.env.DB);
  const sub = await service.getByRestaurantId(c.req.param("restaurantId"));

  if (!sub) {
    return c.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "Subscription not found" },
      },
      404,
    );
  }

  return c.json({
    success: true,
    data: { ...sub, effectiveModules: service.getEffectiveModules(sub) },
  });
});

// ─── Create subscription (client onboarding) ─────────────────────────────────
router.post("/", zValidator("json", createSubscriptionSchema), async (c) => {
  const body = c.req.valid("json");
  const service = new SubscriptionService(c.env.DB);

  const sub = await service.create({
    ...body,
    trialEndsAt: body.trialEndsAt ? new Date(body.trialEndsAt) : undefined,
    billingCycleStartAt: body.billingCycleStartAt
      ? new Date(body.billingCycleStartAt)
      : undefined,
    billingCycleEndAt: body.billingCycleEndAt
      ? new Date(body.billingCycleEndAt)
      : undefined,
  });

  return c.json({ success: true, data: sub }, 201);
});

// ─── Update module overrides ──────────────────────────────────────────────────
router.patch(
  "/:restaurantId/modules",
  zValidator("json", updateModulesSchema),
  async (c) => {
    const restaurantId = c.req.param("restaurantId");
    const body = c.req.valid("json");
    const service = new SubscriptionService(c.env.DB);

    const updated = await service.updateModules(restaurantId, {
      overrides: body.overrides as Record<string, boolean | undefined>,
    });

    // Invalidate KV cache so the change takes effect within seconds
    await invalidateSubscriptionCache(c, restaurantId);

    return c.json({
      success: true,
      data: {
        ...updated,
        effectiveModules: service.getEffectiveModules(updated),
      },
    });
  },
);

// ─── Change plan tier ─────────────────────────────────────────────────────────
router.patch(
  "/:restaurantId/plan",
  zValidator("json", changePlanSchema),
  async (c) => {
    const restaurantId = c.req.param("restaurantId");
    const { planTier } = c.req.valid("json");
    const service = new SubscriptionService(c.env.DB);

    const updated = await service.changePlan(restaurantId, planTier);
    await invalidateSubscriptionCache(c, restaurantId);

    return c.json({
      success: true,
      data: {
        ...updated,
        effectiveModules: service.getEffectiveModules(updated),
      },
    });
  },
);

// ─── Kill switch ──────────────────────────────────────────────────────────────
router.patch(
  "/:restaurantId/status",
  zValidator("json", setActiveSchema),
  async (c) => {
    const restaurantId = c.req.param("restaurantId");
    const { isActive } = c.req.valid("json");
    const service = new SubscriptionService(c.env.DB);

    const updated = await service.setActive(restaurantId, isActive);
    await invalidateSubscriptionCache(c, restaurantId);

    return c.json({ success: true, data: updated });
  },
);

export default router;
