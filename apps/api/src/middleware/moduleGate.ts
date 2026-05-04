/**
 * Module Gate Middleware
 *
 * Enforces per-restaurant module access based on their subscription.
 * - Admin (role 0) bypasses the gate unconditionally.
 * - Results are cached in KV for 5 minutes to avoid DB round-trips on every request.
 * - The cache is invalidated when an admin updates a subscription.
 *
 * Usage:
 *   router.get('/kitchen', authMiddleware, moduleGate('kitchen_display'), handler)
 */

import { Context, Next } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { Env } from "../types/env";
import { forbidden } from "../shared/utils/api-error";
import {
  shopSubscriptions,
  PLAN_DEFAULT_MODULES,
  type ModuleKey,
  type ModuleMap,
  type PlanTier,
} from "@makanmasak/database";

// KV cache TTL: 5 minutes.  Short enough to make kill-switch effective quickly.
const CACHE_TTL_SECONDS = 300;

interface CachedSubscription {
  isActive: boolean;
  planTier: PlanTier;
  moduleOverrides: ModuleMap;
  trialEndsAt: number | null;
  deploymentMode?: "managed" | "byoc";
}

/** Returns the effective access state for a single module given the subscription. */
function resolveModule(sub: CachedSubscription, module: ModuleKey): boolean {
  if (!sub.isActive) return false;

  // Check trial expiry
  if (sub.planTier === "trial" && sub.trialEndsAt !== null) {
    if (Date.now() > sub.trialEndsAt) return false;
  }

  // Override takes priority over plan default
  const override = sub.moduleOverrides[module];
  if (override !== undefined) return override;

  // Fall back to plan default
  return PLAN_DEFAULT_MODULES[sub.planTier][module] ?? false;
}

/**
 * Fetch subscription from KV cache, falling back to DB.
 * Writes through to KV on a cache miss.
 */
async function getSubscription(
  c: Context<{ Bindings: Env }>,
  restaurantId: string,
): Promise<CachedSubscription | null> {
  const cacheKey = `subscription:${restaurantId}`;

  // Cache read
  const cached = await c.env.CACHE_KV.get<CachedSubscription>(cacheKey, "json");
  if (cached) return cached;

  // DB read
  const db = drizzle(c.env.DB);
  const [row] = await db
    .select({
      isActive: shopSubscriptions.isActive,
      planTier: shopSubscriptions.planTier,
      moduleOverrides: shopSubscriptions.moduleOverrides,
      trialEndsAt: shopSubscriptions.trialEndsAt,
      deploymentMode: shopSubscriptions.deploymentMode,
    })
    .from(shopSubscriptions)
    .where(eq(shopSubscriptions.restaurantId, restaurantId))
    .limit(1);

  if (!row) return null;

  const sub: CachedSubscription = {
    isActive: row.isActive,
    planTier: row.planTier as PlanTier,
    moduleOverrides: (row.moduleOverrides ?? {}) as ModuleMap,
    trialEndsAt: row.trialEndsAt ? row.trialEndsAt.getTime() : null,
    deploymentMode: row.deploymentMode,
  };

  // Cache write-through
  await c.env.CACHE_KV.put(cacheKey, JSON.stringify(sub), {
    expirationTtl: CACHE_TTL_SECONDS,
  });

  return sub;
}

/**
 * Invalidate the subscription cache for a restaurant.
 * Call this after any admin update to subscription/modules.
 */
export async function invalidateSubscriptionCache(
  c: Context<{ Bindings: Env }>,
  restaurantId: string,
): Promise<void> {
  await c.env.CACHE_KV.delete(`subscription:${restaurantId}`);
}

/**
 * Module gate middleware factory.
 *
 * @param module - The ModuleKey that the route requires
 *
 * @example
 *   router.get('/display', authMiddleware, moduleGate('kitchen_display'), handler)
 */
export function moduleGate(module: ModuleKey) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get("user");

    // Admins bypass all module gates
    if (user?.role === 0) {
      await next();
      return;
    }

    const restaurantId =
      user?.restaurantId == null ? undefined : String(user.restaurantId);

    if (!restaurantId) {
      throw forbidden(
        "No restaurant associated with this account",
        "NO_RESTAURANT",
      );
    }

    const sub = await getSubscription(c, restaurantId);

    if (!sub) {
      // No subscription record means the restaurant hasn't been onboarded yet
      throw forbidden(
        "Subscription not found. Please contact support.",
        "SUBSCRIPTION_NOT_FOUND",
      );
    }

    if (!resolveModule(sub, module)) {
      const isTrialExpired =
        sub.planTier === "trial" &&
        sub.trialEndsAt !== null &&
        Date.now() > sub.trialEndsAt;

      throw forbidden(
        isTrialExpired
          ? "Trial period has ended. Please upgrade your plan."
          : "This feature is not included in your current plan.",
        isTrialExpired ? "TRIAL_EXPIRED" : "MODULE_NOT_ENABLED",
      );
    }

    await next();
  };
}
