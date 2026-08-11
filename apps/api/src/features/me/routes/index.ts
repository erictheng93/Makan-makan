import { Hono } from "hono";
import type { Env } from "../../../types/env";
import { staffOrUserCustomerAuthMiddleware } from "../../../middleware/auth";
import {
  CACHE_TTL_SECONDS,
  subscriptionCacheKey,
  type CachedSubscription,
} from "../../../middleware/moduleGate";
import { SubscriptionService } from "../../subscriptions/services/SubscriptionService";
import { UsageService } from "../../billing/services/UsageService";
import type { ModuleKey } from "@makanmasak/database";

const router = new Hono<{ Bindings: Env }>();

router.use("*", staffOrUserCustomerAuthMiddleware);

router.get("/modules", async (c) => {
  const user = c.get("user");

  if (user?.role === 5) {
    return c.json({
      success: true,
      data: emptyModuleAccess(null),
    });
  }

  const requestedRestaurantId = c.req.query("restaurantId")?.trim() || null;
  const tokenRestaurantId =
    user?.restaurantId == null ? null : String(user.restaurantId);
  const restaurantId =
    user?.role === 0
      ? (requestedRestaurantId ?? tokenRestaurantId)
      : tokenRestaurantId;

  if (!restaurantId) {
    return c.json({
      success: true,
      data: emptyModuleAccess(null),
    });
  }

  const service = new SubscriptionService(c.env.DB);
  const cached = await readCachedSubscription(c.env.CACHE_KV, restaurantId);

  if (cached) {
    return c.json({
      success: true,
      data: {
        restaurantId,
        planTier: cached.planTier,
        isActive: cached.isActive,
        trialEndsAt: cached.trialEndsAt,
        effectiveModules: service.getEffectiveModules({
          planTier: cached.planTier,
          moduleOverrides: cached.moduleOverrides,
        } as Parameters<typeof service.getEffectiveModules>[0]),
      },
    });
  }

  const sub = await service.getByRestaurantId(restaurantId);

  if (!sub) {
    return c.json({
      success: true,
      data: emptyModuleAccess(restaurantId),
    });
  }

  const trialEndsAt = sub.trialEndsAt ? sub.trialEndsAt.getTime() : null;

  await c.env.CACHE_KV.put(
    subscriptionCacheKey(restaurantId),
    JSON.stringify({
      isActive: sub.isActive,
      planTier: sub.planTier,
      moduleOverrides: sub.moduleOverrides ?? {},
      trialEndsAt,
    } satisfies CachedSubscription),
    { expirationTtl: CACHE_TTL_SECONDS },
  );

  return c.json({
    success: true,
    data: {
      restaurantId,
      planTier: sub.planTier,
      isActive: sub.isActive,
      trialEndsAt,
      effectiveModules: service.getEffectiveModules(sub),
    },
  });
});

router.get("/usage", async (c) => {
  const user = c.get("user");
  const restaurantId =
    user?.role === 5 || user?.restaurantId == null
      ? null
      : String(user.restaurantId);

  if (!restaurantId) {
    return c.json({
      success: true,
      data: {
        cycleStartAt: null,
        cycleEndAt: null,
        meters: [],
      },
    });
  }

  const usage = await new UsageService(c.env.DB).getCurrentUsage(restaurantId);
  return c.json({ success: true, data: usage });
});

async function readCachedSubscription(
  cache: KVNamespace,
  restaurantId: string,
): Promise<CachedSubscription | null> {
  return cache.get<CachedSubscription>(
    subscriptionCacheKey(restaurantId),
    "json",
  );
}

function emptyModuleAccess(restaurantId: string | null) {
  return {
    restaurantId,
    planTier: null,
    isActive: false,
    trialEndsAt: null,
    effectiveModules: {} as Record<ModuleKey, boolean>,
  };
}

export default router;
