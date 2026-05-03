import type { Context, Next } from "hono";
import { ApiError } from "../shared/utils/api-error";
import type { Env } from "../types/env";
import {
  PLAN_QUOTAS,
  type MeterKey,
  type MeterQuota,
  type PlanTier,
} from "@makanmakan/database";

interface SubscriptionRow {
  plan_tier: PlanTier;
  trial_ends_at_ms: number | null;
  billing_cycle_start_at_ms: number | null;
  billing_cycle_end_at_ms: number | null;
  created_at_ms: number;
}

interface QuotaCheckOptions {
  restaurantId?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_SECONDS = 30;

function getMode(env: Env): "disabled" | "warn" | "enforce" {
  return env.QUOTA_ENFORCEMENT_MODE ?? "disabled";
}

function fallbackMonthlyCycle(now: number) {
  const date = new Date(now);
  return {
    startAt: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
    endAt: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
  };
}

function resolveCycle(subscription: SubscriptionRow, now: number) {
  if (
    subscription.plan_tier !== "trial" &&
    subscription.billing_cycle_start_at_ms !== null &&
    subscription.billing_cycle_end_at_ms !== null
  ) {
    return {
      startAt: subscription.billing_cycle_start_at_ms,
      endAt: subscription.billing_cycle_end_at_ms,
    };
  }

  if (subscription.plan_tier === "trial") {
    return {
      startAt: subscription.created_at_ms,
      endAt:
        subscription.trial_ends_at_ms ??
        subscription.created_at_ms + 14 * DAY_MS,
    };
  }

  return fallbackMonthlyCycle(now);
}

async function getSubscription(
  c: Context<any>,
  restaurantId: string,
): Promise<SubscriptionRow | null> {
  return await (c.env as Env).DB.prepare(
    `SELECT plan_tier, trial_ends_at_ms, billing_cycle_start_at_ms,
            billing_cycle_end_at_ms, created_at_ms
       FROM shop_subscriptions
      WHERE restaurant_id = ?
      LIMIT 1`,
  )
    .bind(restaurantId)
    .first<SubscriptionRow>();
}

async function getAggregatedCount(
  c: Context<any>,
  restaurantId: string,
  meterKey: MeterKey,
  cycleStartAt: number,
): Promise<number> {
  const cacheKey = `quota:${restaurantId}:${meterKey}:${cycleStartAt}`;
  const kv = (c.env as Env).CACHE_KV;
  const cached = await kv.get<number>(cacheKey, "json").catch(() => null);
  if (typeof cached === "number") return cached;

  const row = await (c.env as Env).DB.prepare(
    `SELECT total_quantity
       FROM usage_meters
      WHERE restaurant_id = ?
        AND meter_key = ?
        AND cycle_start_at_ms = ?
      LIMIT 1`,
  )
    .bind(restaurantId, meterKey, cycleStartAt)
    .first<{ total_quantity: number }>();

  const total = row?.total_quantity ?? 0;
  await kv
    .put(cacheKey, JSON.stringify(total), {
      expirationTtl: CACHE_TTL_SECONDS,
    })
    .catch(() => undefined);
  return total;
}

async function getPendingCount(
  c: Context<any>,
  restaurantId: string,
  meterKey: MeterKey,
): Promise<number> {
  const row = await (c.env as Env).DB.prepare(
    `SELECT COALESCE(SUM(quantity), 0) AS total
       FROM usage_events
      WHERE aggregated_at_ms IS NULL
        AND restaurant_id = ?
        AND meter_key = ?`,
  )
    .bind(restaurantId, meterKey)
    .first<{ total: number }>();

  return row?.total ?? 0;
}

function setQuotaWarning(
  c: Context<any>,
  meterKey: MeterKey,
  count: number,
  quota: MeterQuota,
) {
  const pct = Math.min(100, Math.floor((count / quota.hard) * 100));
  c.header("X-Quota-Warning", `${meterKey} ${pct}%`);
}

export async function enforceQuota(
  c: Context<any>,
  meterKey: MeterKey,
  options: QuotaCheckOptions = {},
): Promise<void> {
  const mode = getMode(c.env as Env);
  if (mode === "disabled") return;

  const user = c.get("user") as
    | { role?: number; restaurantId?: string | number | null }
    | undefined;
  if (user?.role === 0) return;

  const restaurantId =
    options.restaurantId ??
    (user?.restaurantId == null ? undefined : String(user.restaurantId));
  if (!restaurantId) return;

  const subscription = await getSubscription(c, restaurantId);
  if (!subscription) return;

  const quota = PLAN_QUOTAS[subscription.plan_tier]?.[meterKey];
  if (!quota) return;

  const cycle = resolveCycle(subscription, Date.now());
  const aggregated = await getAggregatedCount(
    c,
    restaurantId,
    meterKey,
    cycle.startAt,
  );
  const pending = await getPendingCount(c, restaurantId, meterKey);
  const effectiveCount = aggregated + pending;

  if (effectiveCount >= quota.hard) {
    setQuotaWarning(c, meterKey, effectiveCount, quota);
    if (mode === "enforce") {
      throw new ApiError(
        "QUOTA_EXCEEDED",
        `Quota exceeded for ${meterKey}`,
        429,
        { meterKey, limit: quota.hard, current: effectiveCount },
      );
    }
    return;
  }

  if (effectiveCount >= quota.soft) {
    setQuotaWarning(c, meterKey, effectiveCount, quota);
  }
}

export function quotaGate(meterKey: MeterKey) {
  return async (c: Context<any>, next: Next) => {
    await enforceQuota(c, meterKey);
    await next();
  };
}
