import type { D1Database } from "@makanmakan/database";
import { generateUUID } from "@makanmakan/utils";
import type { Env } from "../types/env";

interface PendingUsageGroup {
  restaurant_id: string;
  meter_key: string;
  delta: number;
  first_occurred_at_ms: number;
  last_occurred_at_ms: number;
}

interface SubscriptionCycleRow {
  plan_tier: string;
  trial_ends_at_ms: number | null;
  billing_cycle_start_at_ms: number | null;
  billing_cycle_end_at_ms: number | null;
  created_at_ms: number;
}

interface UsageCycle {
  startAt: number;
  endAt: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function fallbackMonthlyCycle(occurredAt: number): UsageCycle {
  const occurred = new Date(occurredAt);
  const startAt = Date.UTC(
    occurred.getUTCFullYear(),
    occurred.getUTCMonth(),
    1,
  );
  const endAt = Date.UTC(
    occurred.getUTCFullYear(),
    occurred.getUTCMonth() + 1,
    1,
  );
  return { startAt, endAt };
}

function resolveUsageCycle(
  subscription: SubscriptionCycleRow | null,
  occurredAt: number,
): UsageCycle {
  if (!subscription) {
    return fallbackMonthlyCycle(occurredAt);
  }

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

  return fallbackMonthlyCycle(occurredAt);
}

async function getSubscriptionCycle(
  db: D1Database,
  restaurantId: string,
): Promise<SubscriptionCycleRow | null> {
  return await db
    .prepare(
      `SELECT plan_tier, trial_ends_at_ms, billing_cycle_start_at_ms,
              billing_cycle_end_at_ms, created_at_ms
         FROM shop_subscriptions
        WHERE restaurant_id = ?
        LIMIT 1`,
    )
    .bind(restaurantId)
    .first<SubscriptionCycleRow>();
}

async function listPendingGroups(db: D1Database): Promise<PendingUsageGroup[]> {
  const result = await db
    .prepare(
      `SELECT restaurant_id,
              meter_key,
              SUM(quantity) AS delta,
              MIN(occurred_at_ms) AS first_occurred_at_ms,
              MAX(occurred_at_ms) AS last_occurred_at_ms
         FROM usage_events
        WHERE aggregated_at_ms IS NULL
        GROUP BY restaurant_id, meter_key
        LIMIT 5000`,
    )
    .all<PendingUsageGroup>();

  return result.results ?? [];
}

export async function aggregateUsageMeters(env: Env) {
  const startedAt = Date.now();
  const groups = await listPendingGroups(env.DB);
  const now = Date.now();
  let processed = 0;
  const restaurants = new Set<string>();

  for (const group of groups) {
    const subscription = await getSubscriptionCycle(
      env.DB,
      group.restaurant_id,
    );
    const cycle = resolveUsageCycle(subscription, group.first_occurred_at_ms);

    await env.DB.prepare(
      `INSERT INTO usage_meters (
          id, restaurant_id, meter_key, cycle_start_at_ms, cycle_end_at_ms,
          total_quantity, last_aggregated_at_ms, created_at_ms, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (restaurant_id, meter_key, cycle_start_at_ms)
        DO UPDATE SET
          total_quantity = total_quantity + excluded.total_quantity,
          last_aggregated_at_ms = excluded.last_aggregated_at_ms,
          updated_at_ms = excluded.updated_at_ms`,
    )
      .bind(
        generateUUID(),
        group.restaurant_id,
        group.meter_key,
        cycle.startAt,
        cycle.endAt,
        group.delta,
        now,
        now,
        now,
      )
      .run();

    const updated = await env.DB.prepare(
      `UPDATE usage_events
          SET aggregated_at_ms = ?
        WHERE aggregated_at_ms IS NULL
          AND restaurant_id = ?
          AND meter_key = ?
          AND occurred_at_ms <= ?`,
    )
      .bind(
        now,
        group.restaurant_id,
        group.meter_key,
        group.last_occurred_at_ms,
      )
      .run();

    processed += updated.meta.changes ?? 0;
    restaurants.add(group.restaurant_id);
  }

  const durationMs = Date.now() - startedAt;
  console.log("usageAggregator.batch", {
    processed,
    restaurants: restaurants.size,
    durationMs,
  });

  return {
    processed,
    restaurants: restaurants.size,
    durationMs,
  };
}
