import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PAYMENT_AUDIT_EVENT_TYPES,
  PLAN_DEFAULT_MODULES,
} from "@makanmakan/database";
import type { Env } from "../../../types/env";
import {
  BillingCycleService,
  DEFAULT_BILLING_CYCLE_MS,
  TrialReaperService,
} from "./BillingCycleService";

vi.mock("@makanmakan/utils", () => ({
  generateUUID: vi.fn(() => "generated-id"),
}));

interface PreparedStatement {
  sql: string;
  values: unknown[];
  bind: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
}

interface FakeDbOptions {
  dueRows?: unknown[];
  trialRows?: unknown[];
  usageRows?: unknown[];
  duplicateNotification?: boolean;
}

function createDb(options: FakeDbOptions = {}) {
  const statements: PreparedStatement[] = [];
  const batches: PreparedStatement[][] = [];

  const db = {
    prepare: vi.fn((sql: string) => {
      const statement: PreparedStatement = {
        sql,
        values: [],
        bind: vi.fn((...values: unknown[]) => {
          statement.values = values;
          return statement;
        }),
        all: vi.fn(async () => {
          if (sql.includes("FROM usage_meters")) {
            return { results: options.usageRows ?? [] };
          }
          if (sql.includes("s.plan_tier = 'trial'")) {
            return { results: options.trialRows ?? [] };
          }
          return { results: options.dueRows ?? [] };
        }),
        first: vi.fn(async () =>
          sql.includes("SELECT id") && options.duplicateNotification
            ? { id: "existing-notification" }
            : null,
        ),
        run: vi.fn(async () => ({ success: true })),
      };
      statements.push(statement);
      return statement;
    }),
    batch: vi.fn(async (batchStatements: PreparedStatement[]) => {
      batches.push(batchStatements);
      return batchStatements.map(() => ({ success: true }));
    }),
  };

  return { db, statements, batches };
}

function createCacheKv() {
  return {
    delete: vi.fn(async (_key: string) => undefined),
  };
}

function env(overrides: Partial<Env> = {}) {
  return {
    DB: createDb().db,
    CACHE_KV: createCacheKv(),
    ...overrides,
  } as Env;
}

function findStatement(statements: PreparedStatement[], pattern: string) {
  return statements.find((statement) => statement.sql.includes(pattern));
}

describe("BillingCycleService", () => {
  const now = Date.parse("2026-06-07T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero when no paid billing cycles are due", async () => {
    const { db, statements } = createDb();

    await expect(
      new BillingCycleService(env({ DB: db as never })).closeDueCycles(now),
    ).resolves.toEqual({ closed: 0 });

    expect(db.batch).not.toHaveBeenCalled();
    expect(statements).toHaveLength(1);
    expect(statements[0].values).toEqual([now]);
  });

  it("closes paid cycles with module overrides and usage overages", async () => {
    const cycleStart = Date.parse("2026-05-01T00:00:00.000Z");
    const cycleEnd = Date.parse("2026-06-01T00:00:00.000Z");
    const { db, batches } = createDb({
      dueRows: [
        {
          id: "subscription-1",
          restaurant_id: "restaurant-1",
          plan_tier: "pro",
          module_overrides: JSON.stringify({
            online_ordering: false,
            ai_analytics: true,
          }),
          billing_cycle_start_at_ms: cycleStart,
          billing_cycle_end_at_ms: cycleEnd,
        },
      ],
      usageRows: [
        { meter_key: "orders.created", total_quantity: 10005 },
        { meter_key: "custom.meter", total_quantity: 12 },
      ],
    });

    await expect(
      new BillingCycleService(env({ DB: db as never })).closeDueCycles(now),
    ).resolves.toEqual({ closed: 1 });

    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(batches[0]).toHaveLength(3);

    const snapshot = batches[0][0].values;
    expect(snapshot.slice(0, 6)).toEqual([
      "generated-id",
      "restaurant-1",
      "subscription-1",
      "pro",
      cycleStart,
      cycleEnd,
    ]);
    expect(JSON.parse(snapshot[6] as string)).toEqual({
      ...PLAN_DEFAULT_MODULES.pro,
      online_ordering: false,
      ai_analytics: true,
    });
    expect(JSON.parse(snapshot[7] as string)).toEqual({
      "orders.created": {
        total: 10005,
        softLimit: 8000,
        hardLimit: 10000,
        overage: 5,
      },
      "custom.meter": {
        total: 12,
        softLimit: null,
        hardLimit: null,
        overage: 0,
      },
    });
    expect(snapshot[8]).toBe(now);

    expect(batches[0][1].values).toEqual([
      cycleEnd,
      cycleEnd + DEFAULT_BILLING_CYCLE_MS,
      now,
      "subscription-1",
    ]);
    expect(batches[0][2].values).toEqual([
      "generated-id",
      "restaurant-1",
      "subscription-1",
      PAYMENT_AUDIT_EVENT_TYPES.CYCLE_CLOSE,
      JSON.stringify({
        cycleStartAt: cycleStart,
        cycleEndAt: cycleEnd,
        nextCycleStartAt: cycleEnd,
        nextCycleEndAt: cycleEnd + DEFAULT_BILLING_CYCLE_MS,
      }),
      now,
    ]);
  });
});

describe("TrialReaperService", () => {
  const now = Date.parse("2026-06-07T12:00:00.000Z");
  const trialEndsAt = Date.parse("2026-06-01T00:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("downgrades expired trials, invalidates the cache, and records the trial-ended notification", async () => {
    const { db, statements, batches } = createDb({
      trialRows: [
        {
          id: "subscription-1",
          restaurant_id: "restaurant-1",
          restaurant_name: "Tasty Shop",
          email: "owner@example.test",
          trial_ends_at_ms: trialEndsAt,
        },
      ],
    });
    const cacheKv = createCacheKv();

    await expect(
      new TrialReaperService(
        env({ DB: db as never, CACHE_KV: cacheKv as never }),
      ).downgradeExpiredTrials(now),
    ).resolves.toEqual({ downgraded: 1 });

    // The pro/enterprise -> basic downgrade must take effect immediately:
    // this runs from a cron job, so nothing else can invalidate it.
    expect(cacheKv.delete).toHaveBeenCalledOnce();
    expect(cacheKv.delete).toHaveBeenCalledWith("subscription:restaurant-1");

    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(batches[0][0].values).toEqual([
      now,
      now + DEFAULT_BILLING_CYCLE_MS,
      now,
      "subscription-1",
    ]);
    expect(batches[0][1].values).toEqual([
      "generated-id",
      "restaurant-1",
      "subscription-1",
      PAYMENT_AUDIT_EVENT_TYPES.TRIAL_DOWNGRADE,
      JSON.stringify({ trialEndsAt }),
      now,
    ]);

    const notificationLookup = findStatement(statements, "SELECT id")?.values;
    expect(notificationLookup).toEqual([
      "restaurant-1",
      "trial_0d",
      `trial_0d:restaurant-1:${trialEndsAt}`,
      "email",
    ]);

    expect(fetch).not.toHaveBeenCalled();
    expect(
      findStatement(
        statements,
        "INSERT OR IGNORE INTO notification_dispatch_log",
      )?.values,
    ).toEqual([
      "generated-id",
      "restaurant-1",
      "trial_0d",
      `trial_0d:restaurant-1:${trialEndsAt}`,
      "email",
      "skipped_provider_unconfigured",
      "owner@example.test",
      null,
      null,
      JSON.stringify({ trialEndsAt }),
      now,
    ]);
  });

  it("invalidates the cache for each affected restaurant, not just the first", async () => {
    const { db } = createDb({
      trialRows: [
        {
          id: "subscription-1",
          restaurant_id: "restaurant-1",
          restaurant_name: "Tasty Shop",
          email: "owner@example.test",
          trial_ends_at_ms: trialEndsAt,
        },
        {
          id: "subscription-2",
          restaurant_id: "restaurant-2",
          restaurant_name: "Noodle House",
          email: "owner2@example.test",
          trial_ends_at_ms: trialEndsAt,
        },
      ],
    });
    const cacheKv = createCacheKv();

    await expect(
      new TrialReaperService(
        env({ DB: db as never, CACHE_KV: cacheKv as never }),
      ).downgradeExpiredTrials(now),
    ).resolves.toEqual({ downgraded: 2 });

    expect(cacheKv.delete).toHaveBeenCalledTimes(2);
    expect(cacheKv.delete).toHaveBeenNthCalledWith(
      1,
      "subscription:restaurant-1",
    );
    expect(cacheKv.delete).toHaveBeenNthCalledWith(
      2,
      "subscription:restaurant-2",
    );
  });
});
