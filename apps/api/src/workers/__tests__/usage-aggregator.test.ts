import { beforeEach, describe, expect, it, vi } from "vitest";
import { aggregateUsageMeters } from "../usage-aggregator";
import type { Env } from "../../types/env";

function statement(result: unknown) {
  const run = vi.fn().mockResolvedValue(result);
  const first = vi.fn().mockResolvedValue(result);
  const all = vi.fn().mockResolvedValue(result);
  const bind = vi.fn(() => ({ run, first, all }));
  return { bind, run, first, all };
}

describe("aggregateUsageMeters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts pending usage into the active subscription cycle", async () => {
    const pending = statement({
      results: [
        {
          restaurant_id: "rest-1",
          meter_key: "orders.created",
          delta: 2,
          first_occurred_at_ms: 1_700_000_000_000,
          last_occurred_at_ms: 1_700_000_010_000,
        },
      ],
    });
    const subscription = statement({
      plan_tier: "pro",
      trial_ends_at_ms: null,
      billing_cycle_start_at_ms: 1_699_000_000_000,
      billing_cycle_end_at_ms: 1_701_000_000_000,
      created_at_ms: 1_698_000_000_000,
    });
    const upsert = statement({ success: true });
    const markAggregated = statement({ meta: { changes: 2 } });
    const prepare = vi
      .fn()
      .mockReturnValueOnce(pending)
      .mockReturnValueOnce(subscription)
      .mockReturnValueOnce(upsert)
      .mockReturnValueOnce(markAggregated);

    const result = await aggregateUsageMeters({
      DB: { prepare },
    } as unknown as Env);

    expect(result.processed).toBe(2);
    expect(result.restaurants).toBe(1);
    expect(upsert.bind).toHaveBeenCalledWith(
      expect.any(String),
      "rest-1",
      "orders.created",
      1_699_000_000_000,
      1_701_000_000_000,
      2,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
    expect(markAggregated.bind).toHaveBeenCalledWith(
      expect.any(Number),
      "rest-1",
      "orders.created",
      1_700_000_010_000,
    );
  });
});
