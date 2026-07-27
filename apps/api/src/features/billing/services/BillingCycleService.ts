import {
  PAYMENT_AUDIT_EVENT_TYPES,
  PLAN_DEFAULT_MODULES,
  PLAN_QUOTAS,
  type ModuleMap,
  type PlanTier,
} from "@makanmakan/database";
import { generateUUID } from "@makanmakan/utils";
import type { Env } from "../../../types/env";
import { invalidateSubscriptionCacheForEnv } from "../../../middleware/moduleGate";
import {
  BILLING_NOTIFICATION_KINDS,
  BillingNotificationService,
  NOTIFICATION_CHANNELS,
} from "./BillingNotificationService";

export const DEFAULT_BILLING_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

interface DueSubscriptionRow {
  id: string;
  restaurant_id: string;
  plan_tier: PlanTier;
  module_overrides: string | ModuleMap | null;
  billing_cycle_start_at_ms: number;
  billing_cycle_end_at_ms: number;
}

interface TrialSubscriptionRow {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  email: string | null;
  trial_ends_at_ms: number;
}

interface UsageMeterRow {
  meter_key: string;
  total_quantity: number;
}

function parseJsonMap(value: string | ModuleMap | null): ModuleMap {
  if (!value) return {};
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as ModuleMap;
  } catch {
    return {};
  }
}

function effectiveModules(
  planTier: PlanTier,
  overridesValue: string | ModuleMap | null,
) {
  return {
    ...(PLAN_DEFAULT_MODULES[planTier] ?? {}),
    ...parseJsonMap(overridesValue),
  };
}

function buildUsageSnapshot(planTier: PlanTier, rows: UsageMeterRow[]) {
  const quotas = PLAN_QUOTAS[planTier] ?? {};
  return Object.fromEntries(
    rows.map((row) => {
      const quota = quotas[row.meter_key as keyof typeof quotas];
      const hardLimit = quota?.hard ?? null;
      const overage =
        hardLimit === null ? 0 : Math.max(0, row.total_quantity - hardLimit);

      return [
        row.meter_key,
        {
          total: row.total_quantity,
          softLimit: quota?.soft ?? null,
          hardLimit,
          overage,
        },
      ];
    }),
  );
}

export class BillingCycleService {
  constructor(private readonly env: Env) {}

  async closeDueCycles(now = Date.now()) {
    const rows = await this.env.DB.prepare(
      `SELECT id, restaurant_id, plan_tier, module_overrides,
              billing_cycle_start_at_ms, billing_cycle_end_at_ms
         FROM shop_subscriptions
        WHERE is_active = 1
          AND plan_tier != 'trial'
          AND billing_cycle_start_at_ms IS NOT NULL
          AND billing_cycle_end_at_ms IS NOT NULL
          AND billing_cycle_end_at_ms <= ?
        LIMIT 250`,
    )
      .bind(now)
      .all<DueSubscriptionRow>();

    let closed = 0;
    for (const row of rows.results ?? []) {
      await this.closeCycle(row, now);
      closed++;
    }

    return { closed };
  }

  private async closeCycle(row: DueSubscriptionRow, now: number) {
    const usageRows = await this.env.DB.prepare(
      `SELECT meter_key, total_quantity
         FROM usage_meters
        WHERE restaurant_id = ?
          AND cycle_start_at_ms = ?
          AND cycle_end_at_ms = ?
        ORDER BY meter_key ASC`,
    )
      .bind(
        row.restaurant_id,
        row.billing_cycle_start_at_ms,
        row.billing_cycle_end_at_ms,
      )
      .all<UsageMeterRow>();

    const modules = effectiveModules(row.plan_tier, row.module_overrides);
    const usage = buildUsageSnapshot(row.plan_tier, usageRows.results ?? []);
    const nextCycleStartAt = row.billing_cycle_end_at_ms;
    const nextCycleEndAt = nextCycleStartAt + DEFAULT_BILLING_CYCLE_MS;

    await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT OR IGNORE INTO cycle_snapshots (
            id, restaurant_id, subscription_id, plan_tier, cycle_start_at_ms,
            cycle_end_at_ms, modules, usage, total_overage_cents, currency,
            created_at_ms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'TWD', ?)`,
      ).bind(
        generateUUID(),
        row.restaurant_id,
        row.id,
        row.plan_tier,
        row.billing_cycle_start_at_ms,
        row.billing_cycle_end_at_ms,
        JSON.stringify(modules),
        JSON.stringify(usage),
        now,
      ),
      this.env.DB.prepare(
        `UPDATE shop_subscriptions
            SET billing_cycle_start_at_ms = ?,
                billing_cycle_end_at_ms = ?,
                updated_at_ms = ?
          WHERE id = ?`,
      ).bind(nextCycleStartAt, nextCycleEndAt, now, row.id),
      this.env.DB.prepare(
        `INSERT INTO payment_audit_log (
            id, restaurant_id, subscription_id, event_type, raw_payload,
            occurred_at_ms
          ) VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(
        generateUUID(),
        row.restaurant_id,
        row.id,
        PAYMENT_AUDIT_EVENT_TYPES.CYCLE_CLOSE,
        JSON.stringify({
          cycleStartAt: row.billing_cycle_start_at_ms,
          cycleEndAt: row.billing_cycle_end_at_ms,
          nextCycleStartAt,
          nextCycleEndAt,
        }),
        now,
      ),
    ]);
  }
}

export class TrialReaperService {
  constructor(private readonly env: Env) {}

  async downgradeExpiredTrials(now = Date.now()) {
    const rows = await this.env.DB.prepare(
      `SELECT s.id, s.restaurant_id, r.name AS restaurant_name, r.email,
              s.trial_ends_at_ms
         FROM shop_subscriptions s
         JOIN restaurants r ON r.id = s.restaurant_id
        WHERE s.is_active = 1
          AND s.plan_tier = 'trial'
          AND s.trial_ends_at_ms IS NOT NULL
          AND s.trial_ends_at_ms <= ?
        LIMIT 250`,
    )
      .bind(now)
      .all<TrialSubscriptionRow>();

    let downgraded = 0;
    for (const row of rows.results ?? []) {
      await this.env.DB.batch([
        this.env.DB.prepare(
          `UPDATE shop_subscriptions
              SET plan_tier = 'basic',
                  module_overrides = '{}',
                  billing_cycle_start_at_ms = ?,
                  billing_cycle_end_at_ms = ?,
                  updated_at_ms = ?
            WHERE id = ?`,
        ).bind(now, now + DEFAULT_BILLING_CYCLE_MS, now, row.id),
        this.env.DB.prepare(
          `INSERT INTO payment_audit_log (
              id, restaurant_id, subscription_id, event_type, raw_payload,
              occurred_at_ms
            ) VALUES (?, ?, ?, ?, ?, ?)`,
        ).bind(
          generateUUID(),
          row.restaurant_id,
          row.id,
          PAYMENT_AUDIT_EVENT_TYPES.TRIAL_DOWNGRADE,
          JSON.stringify({ trialEndsAt: row.trial_ends_at_ms }),
          now,
        ),
      ]);
      await new BillingNotificationService(this.env).send({
        restaurantId: row.restaurant_id,
        kind: BILLING_NOTIFICATION_KINDS.TRIAL_0D,
        dedupKey: `trial_0d:${row.restaurant_id}:${row.trial_ends_at_ms}`,
        channel: NOTIFICATION_CHANNELS.EMAIL,
        recipient: row.email,
        subject: "Your MakanMasak trial has ended",
        text: `The MakanMasak trial for ${row.restaurant_name} has ended. The subscription has moved to the basic plan.`,
        payload: { trialEndsAt: row.trial_ends_at_ms },
      });
      // The DB write above (plan_tier -> basic, module_overrides -> {}) must
      // take effect immediately: this runs from a cron job, not a request,
      // so it cannot reach the Context-based invalidateSubscriptionCache.
      await invalidateSubscriptionCacheForEnv(this.env, row.restaurant_id);
      downgraded++;
    }

    return { downgraded };
  }
}
