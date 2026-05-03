import { describe, expect, it, vi } from "vitest";
import {
  BillingCycleService,
  DEFAULT_BILLING_CYCLE_MS,
  TrialReaperService,
} from "../BillingCycleService";
import type { Env } from "../../../../types/env";

function createStatement(sql: string, queryResults: unknown[] = []) {
  return {
    sql,
    args: [] as unknown[],
    bind: vi.fn(function (this: { args: unknown[] }, ...args: unknown[]) {
      this.args = args;
      return this;
    }),
    all: vi.fn().mockResolvedValue({ results: queryResults }),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  };
}

describe("BillingCycleService", () => {
  it("snapshots due cycles and advances the subscription cycle", async () => {
    const statements: ReturnType<typeof createStatement>[] = [];
    const prepare = vi.fn((sql: string) => {
      const statement = sql.includes("FROM shop_subscriptions")
        ? createStatement(sql, [
            {
              id: "sub-1",
              restaurant_id: "rest-1",
              plan_tier: "basic",
              module_overrides: JSON.stringify({ coupons: true }),
              billing_cycle_start_at_ms: 1_000,
              billing_cycle_end_at_ms: 2_000,
            },
          ])
        : sql.includes("FROM usage_meters")
          ? createStatement(sql, [
              { meter_key: "orders.created", total_quantity: 1_250 },
            ])
          : createStatement(sql);
      statements.push(statement);
      return statement;
    });
    const batch = vi.fn().mockResolvedValue([]);
    const env = { DB: { prepare, batch } } as unknown as Env;

    const result = await new BillingCycleService(env).closeDueCycles(3_000);

    expect(result).toEqual({ closed: 1 });
    expect(batch).toHaveBeenCalledOnce();
    const batched = batch.mock.calls[0][0] as Array<{
      sql: string;
      args: unknown[];
    }>;
    expect(batched[0].sql).toContain("INSERT OR IGNORE INTO cycle_snapshots");
    expect(batched[0].args).toEqual([
      expect.any(String),
      "rest-1",
      "sub-1",
      "basic",
      1_000,
      2_000,
      expect.stringContaining('"coupons":true'),
      expect.stringContaining('"overage":250'),
      3_000,
    ]);
    expect(batched[1].args).toEqual([
      2_000,
      2_000 + DEFAULT_BILLING_CYCLE_MS,
      3_000,
      "sub-1",
    ]);
    expect(batched[2].args).toContain("cycle_close");
  });
});

describe("TrialReaperService", () => {
  it("downgrades expired trials to basic and writes an audit row", async () => {
    const prepare = vi.fn((sql: string) =>
      sql.includes("FROM shop_subscriptions")
        ? createStatement(sql, [
            {
              id: "sub-1",
              restaurant_id: "rest-1",
              restaurant_name: "Demo Shop",
              email: "owner@example.com",
              trial_ends_at_ms: 1_000,
            },
          ])
        : createStatement(sql),
    );
    const batch = vi.fn().mockResolvedValue([]);
    const env = { DB: { prepare, batch } } as unknown as Env;

    const result = await new TrialReaperService(env).downgradeExpiredTrials(
      2_000,
    );

    expect(result).toEqual({ downgraded: 1 });
    const batched = batch.mock.calls[0][0] as Array<{
      sql: string;
      args: unknown[];
    }>;
    expect(batched[0].sql).toContain("SET plan_tier = 'basic'");
    expect(batched[0].args).toEqual([
      2_000,
      2_000 + DEFAULT_BILLING_CYCLE_MS,
      2_000,
      "sub-1",
    ]);
    expect(batched[1].args).toContain("trial_downgrade");
    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("notification_dispatch_log"),
    );
  });
});
