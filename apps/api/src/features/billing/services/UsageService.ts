import {
  METER_KEYS,
  PLAN_QUOTAS,
  type MeterKey,
  type PlanTier,
} from "@makanmakan/database";
import type { D1Database } from "@makanmakan/database";
import { generateUUID } from "@makanmakan/utils";

interface SubscriptionRow {
  plan_tier: PlanTier;
  trial_ends_at_ms: number | null;
  billing_cycle_start_at_ms: number | null;
  billing_cycle_end_at_ms: number | null;
  created_at_ms: number;
}

interface UsageMeterRow {
  meter_key: MeterKey;
  total_quantity: number;
}

interface UsageEventRow {
  id: string;
  restaurant_id: string;
  meter_key: MeterKey;
  quantity: number;
  metadata: string | Record<string, unknown> | null;
  aggregated_at_ms: number | null;
  occurred_at_ms: number;
}

interface CycleRow {
  cycle_start_at_ms: number;
  cycle_end_at_ms: number;
  meter_key: MeterKey;
  total_quantity: number;
  last_aggregated_at_ms: number | null;
}

export interface UsageEventFilters {
  meterKey?: MeterKey;
  from?: number;
  to?: number;
  page?: number;
  limit?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const METER_KEYS_LIST = Object.values(METER_KEYS);

export class UsageService {
  constructor(private readonly db: D1Database) {}

  async getCurrentUsage(restaurantId: string, now = Date.now()) {
    const subscription = await this.getSubscription(restaurantId);
    const cycle = subscription
      ? this.resolveCycle(subscription, now)
      : this.fallbackMonthlyCycle(now);
    const planTier = subscription?.plan_tier ?? null;

    const meters = await this.getMeterTotals(
      restaurantId,
      cycle.startAt,
      cycle.endAt,
    );
    const pending = await this.getPendingTotals(
      restaurantId,
      cycle.startAt,
      cycle.endAt,
    );

    return {
      cycleStartAt: cycle.startAt,
      cycleEndAt: cycle.endAt,
      meters: METER_KEYS_LIST.map((meterKey) => {
        const total =
          (meters.get(meterKey) ?? 0) + (pending.get(meterKey) ?? 0);
        const quota = planTier ? PLAN_QUOTAS[planTier]?.[meterKey] : undefined;

        return {
          meterKey,
          total,
          softLimit: quota?.soft ?? null,
          hardLimit: quota?.hard ?? null,
          percentage: quota ? total / quota.hard : null,
        };
      }),
    };
  }

  async listCycleUsage(restaurantId: string, from?: number, to?: number) {
    const now = Date.now();
    const defaultFrom = now - 6 * 31 * DAY_MS;
    const rows = await this.db
      .prepare(
        `SELECT cycle_start_at_ms, cycle_end_at_ms, meter_key, total_quantity,
                last_aggregated_at_ms
           FROM usage_meters
          WHERE restaurant_id = ?
            AND cycle_start_at_ms >= ?
            AND cycle_start_at_ms <= ?
          ORDER BY cycle_start_at_ms DESC, meter_key ASC`,
      )
      .bind(restaurantId, from ?? defaultFrom, to ?? now)
      .all<CycleRow>();

    const cycles = new Map<
      number,
      {
        cycleStartAt: number;
        cycleEndAt: number;
        meters: Record<string, number>;
        lastAggregatedAt: number | null;
      }
    >();

    for (const row of rows.results ?? []) {
      const cycle = cycles.get(row.cycle_start_at_ms) ?? {
        cycleStartAt: row.cycle_start_at_ms,
        cycleEndAt: row.cycle_end_at_ms,
        meters: {},
        lastAggregatedAt: null,
      };

      cycle.meters[row.meter_key] = row.total_quantity;
      cycle.lastAggregatedAt = Math.max(
        cycle.lastAggregatedAt ?? 0,
        row.last_aggregated_at_ms ?? 0,
      );
      cycles.set(row.cycle_start_at_ms, cycle);
    }

    return Array.from(cycles.values());
  }

  async listUsageEvents(restaurantId: string, filters: UsageEventFilters = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
    const offset = (page - 1) * limit;
    const clauses = ["restaurant_id = ?"];
    const binds: Array<string | number> = [restaurantId];

    if (filters.meterKey) {
      clauses.push("meter_key = ?");
      binds.push(filters.meterKey);
    }
    if (filters.from !== undefined) {
      clauses.push("occurred_at_ms >= ?");
      binds.push(filters.from);
    }
    if (filters.to !== undefined) {
      clauses.push("occurred_at_ms <= ?");
      binds.push(filters.to);
    }

    const where = clauses.join(" AND ");
    const countRow = await this.db
      .prepare(`SELECT COUNT(*) AS total FROM usage_events WHERE ${where}`)
      .bind(...binds)
      .first<{ total: number }>();

    const rows = await this.db
      .prepare(
        `SELECT id, restaurant_id, meter_key, quantity, metadata,
                aggregated_at_ms, occurred_at_ms
           FROM usage_events
          WHERE ${where}
          ORDER BY occurred_at_ms DESC
          LIMIT ? OFFSET ?`,
      )
      .bind(...binds, limit, offset)
      .all<UsageEventRow>();

    return {
      page,
      limit,
      total: countRow?.total ?? 0,
      events: (rows.results ?? []).map((row) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        meterKey: row.meter_key,
        quantity: row.quantity,
        metadata: this.parseMetadata(row.metadata),
        aggregatedAt: row.aggregated_at_ms,
        occurredAt: row.occurred_at_ms,
      })),
    };
  }

  async emitStorageSnapshots(now = Date.now()) {
    const rows = await this.db
      .prepare(
        `SELECT restaurant_id, r2_bytes, images_count
           FROM storage_counters
          WHERE r2_bytes > 0 OR images_count > 0`,
      )
      .all<{
        restaurant_id: string;
        r2_bytes: number;
        images_count: number;
      }>();

    let emitted = 0;
    for (const row of rows.results ?? []) {
      await this.db
        .prepare(
          `INSERT INTO usage_events
             (id, restaurant_id, meter_key, quantity, metadata, occurred_at_ms)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          generateUUID(),
          row.restaurant_id,
          METER_KEYS.STORAGE_BYTES,
          row.r2_bytes,
          JSON.stringify({ imagesCount: row.images_count, source: "snapshot" }),
          now,
        )
        .run();
      emitted++;
    }

    return { emitted };
  }

  private async getSubscription(
    restaurantId: string,
  ): Promise<SubscriptionRow | null> {
    return await this.db
      .prepare(
        `SELECT plan_tier, trial_ends_at_ms, billing_cycle_start_at_ms,
                billing_cycle_end_at_ms, created_at_ms
           FROM shop_subscriptions
          WHERE restaurant_id = ?
          LIMIT 1`,
      )
      .bind(restaurantId)
      .first<SubscriptionRow>();
  }

  private async getMeterTotals(
    restaurantId: string,
    cycleStartAt: number,
    cycleEndAt: number,
  ) {
    const rows = await this.db
      .prepare(
        `SELECT meter_key, total_quantity
           FROM usage_meters
          WHERE restaurant_id = ?
            AND cycle_start_at_ms = ?
            AND cycle_end_at_ms = ?`,
      )
      .bind(restaurantId, cycleStartAt, cycleEndAt)
      .all<UsageMeterRow>();

    return new Map(
      (rows.results ?? []).map((row) => [row.meter_key, row.total_quantity]),
    );
  }

  private async getPendingTotals(
    restaurantId: string,
    cycleStartAt: number,
    cycleEndAt: number,
  ) {
    const rows = await this.db
      .prepare(
        `SELECT meter_key, COALESCE(SUM(quantity), 0) AS total_quantity
           FROM usage_events
          WHERE restaurant_id = ?
            AND aggregated_at_ms IS NULL
            AND occurred_at_ms >= ?
            AND occurred_at_ms < ?
          GROUP BY meter_key`,
      )
      .bind(restaurantId, cycleStartAt, cycleEndAt)
      .all<UsageMeterRow>();

    return new Map(
      (rows.results ?? []).map((row) => [row.meter_key, row.total_quantity]),
    );
  }

  private resolveCycle(subscription: SubscriptionRow, now: number) {
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

    return this.fallbackMonthlyCycle(now);
  }

  private fallbackMonthlyCycle(now: number) {
    const date = new Date(now);
    return {
      startAt: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
      endAt: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
    };
  }

  private parseMetadata(value: UsageEventRow["metadata"]) {
    if (typeof value !== "string") return value ?? {};
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
