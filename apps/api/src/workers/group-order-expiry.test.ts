import { describe, expect, it, vi } from "vitest";
import {
  GROUP_ORDER_EXPIRY_WARNING_MS,
  GROUP_ORDER_FINALIZING_STALE_MS,
  sweepExpiringGroupOrders,
} from "./group-order-expiry";
import type { Env } from "../types/env";

type FakeGroupOrderRow = {
  id: string;
  share_code: string;
  expires_at_ms: number;
  settings: string;
  status: string;
  master_order_id?: string | null;
  locked_at_ms?: number | null;
};

function createFakeEnv(rows: FakeGroupOrderRow[]): Env & {
  rows: FakeGroupOrderRow[];
  activityLogs: unknown[];
  cacheDeletes: string[];
} {
  const activityLogs: unknown[] = [];
  const cacheDeletes: string[] = [];
  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: (...bindings: unknown[]) => ({
        all: vi.fn(async () => {
          if (sql.includes("expires_at_ms > ?")) {
            const [nowMs, warningCutoffMs] = bindings as [number, number];
            return {
              results: rows.filter(
                (row) =>
                  row.status === "active" &&
                  row.expires_at_ms > nowMs &&
                  row.expires_at_ms <= warningCutoffMs,
              ),
            };
          }

          if (sql.includes("expires_at_ms <= ?")) {
            const [nowMs] = bindings as [number];
            return {
              results: rows.filter(
                (row) => row.status === "active" && row.expires_at_ms <= nowMs,
              ),
            };
          }

          return { results: [] };
        }),
        run: vi.fn(async () => {
          if (sql.includes("SET settings = ?")) {
            const [settings, _updatedAt, id] = bindings as [
              string,
              number,
              string,
            ];
            const row = rows.find(
              (candidate) =>
                candidate.id === id && candidate.status === "active",
            );
            if (!row) return { meta: { changes: 0 } };
            row.settings = settings;
            return { meta: { changes: 1 } };
          }

          if (sql.includes("SET status = 'cancelled'")) {
            const [_updatedAt, id] = bindings as [number, string];
            const row = rows.find(
              (candidate) =>
                candidate.id === id && candidate.status === "active",
            );
            if (!row) return { meta: { changes: 0 } };
            row.status = "cancelled";
            return { meta: { changes: 1 } };
          }

          if (sql.includes("INSERT INTO group_activity_logs")) {
            activityLogs.push(bindings);
            return { meta: { changes: 1 } };
          }

          if (sql.includes("SET status = 'active', locked_at_ms = NULL")) {
            const [_updatedAt, staleBeforeMs] = bindings as [number, number];
            let changes = 0;
            for (const row of rows) {
              if (
                row.status === "finalizing" &&
                !row.master_order_id &&
                row.locked_at_ms != null &&
                row.locked_at_ms < staleBeforeMs
              ) {
                row.status = "active";
                row.locked_at_ms = null;
                changes++;
              }
            }
            return { meta: { changes } };
          }

          return { meta: { changes: 0 } };
        }),
      }),
    })),
  };

  return {
    DB: db,
    CACHE_KV: {
      delete: vi.fn(async (key: string) => {
        cacheDeletes.push(key);
      }),
    },
    rows,
    activityLogs,
    cacheDeletes,
  } as unknown as Env & {
    rows: FakeGroupOrderRow[];
    activityLogs: unknown[];
    cacheDeletes: string[];
  };
}

function row(
  id: string,
  status: string,
  expiresAtMs: number,
  settings: Record<string, unknown> = {},
): FakeGroupOrderRow {
  return {
    id,
    share_code: id.toUpperCase(),
    expires_at_ms: expiresAtMs,
    settings: JSON.stringify(settings),
    status,
    master_order_id: null,
    locked_at_ms: null,
  };
}

describe("sweepExpiringGroupOrders", () => {
  const now = new Date("2026-06-07T00:00:00.000Z");

  it("finalizes or cancels expired active groups and keeps processing after item failures", async () => {
    const env = createFakeEnv([
      row("finalize-1", "active", now.getTime() - 1, {
        autoSubmitOnExpiry: true,
      }),
      row("cancel-1", "active", now.getTime() - 1, {
        autoSubmitOnExpiry: false,
      }),
      row("finalize-fail", "active", now.getTime() - 1, {
        autoSubmitOnExpiry: true,
      }),
    ]);
    const finalizeGroupOrder = vi.fn(async (groupOrderId: string) => {
      if (groupOrderId === "finalize-fail") {
        return { success: false, error: "order service down" };
      }
      return {
        success: true,
        data: { masterOrderId: `order-${groupOrderId}`, status: "completed" },
      };
    });

    await expect(
      sweepExpiringGroupOrders(env, {
        now,
        serviceFactory: () => ({ finalizeGroupOrder }),
      }),
    ).resolves.toEqual({
      finalized: 1,
      cancelled: 1,
      warned: 0,
      errors: ["finalize-fail: order service down"],
    });
    expect(
      env.rows.find((candidate) => candidate.id === "cancel-1")?.status,
    ).toBe("cancelled");
    expect(env.activityLogs).toHaveLength(1);
    expect(env.cacheDeletes).toEqual([
      "group_order:cancel-1",
      "group_order_summary:cancel-1",
      "share_code:CANCEL-1",
    ]);
  });

  it("marks five-minute expiry warnings once in settings", async () => {
    const env = createFakeEnv([
      row("warn-1", "active", now.getTime() + GROUP_ORDER_EXPIRY_WARNING_MS),
    ]);

    await expect(sweepExpiringGroupOrders(env, { now })).resolves.toMatchObject(
      { warned: 1 },
    );
    expect(JSON.parse(env.rows[0].settings)).toMatchObject({
      expiryWarningSentAt: now.toISOString(),
    });

    await expect(sweepExpiringGroupOrders(env, { now })).resolves.toMatchObject(
      { warned: 0 },
    );
  });

  it("lets overlapping sweeps race through finalize without creating a second real order", async () => {
    const env = createFakeEnv([
      row("race-1", "active", now.getTime() - 1, {
        autoSubmitOnExpiry: true,
      }),
    ]);
    let createdOrders = 0;
    const finalizeGroupOrder = vi.fn(async (groupOrderId: string) => {
      const target = env.rows.find(
        (candidate) => candidate.id === groupOrderId,
      );
      if (!target || target.status !== "active") {
        return {
          success: false,
          error: "Group order is already being finalized",
        };
      }

      target.status = "finalizing";
      createdOrders++;
      await Promise.resolve();
      target.status = "completed";
      target.master_order_id = "order-race-1";
      return {
        success: true,
        data: { masterOrderId: "order-race-1", status: "completed" },
      };
    });

    const results = await Promise.all([
      sweepExpiringGroupOrders(env, {
        now,
        serviceFactory: () => ({ finalizeGroupOrder }),
      }),
      sweepExpiringGroupOrders(env, {
        now,
        serviceFactory: () => ({ finalizeGroupOrder }),
      }),
    ]);

    expect(createdOrders).toBe(1);
    expect(results.reduce((sum, result) => sum + result.finalized, 0)).toBe(1);
  });

  it("recovers only stale finalizing claims and leaves active claims plus finalizing_failed alone", async () => {
    const activeClaim = row("active-claim", "finalizing", now.getTime() - 1);
    activeClaim.locked_at_ms =
      now.getTime() - GROUP_ORDER_FINALIZING_STALE_MS + 1;
    const staleClaim = row("stale-claim", "finalizing", now.getTime() - 1);
    staleClaim.locked_at_ms =
      now.getTime() - GROUP_ORDER_FINALIZING_STALE_MS - 1;
    const failed = row("failed", "finalizing_failed", now.getTime() - 1);
    failed.locked_at_ms = now.getTime() - GROUP_ORDER_FINALIZING_STALE_MS - 1;
    const env = createFakeEnv([activeClaim, staleClaim, failed]);

    await sweepExpiringGroupOrders(env, { now });

    expect(activeClaim.status).toBe("finalizing");
    expect(staleClaim.status).toBe("active");
    expect(staleClaim.locked_at_ms).toBeNull();
    expect(failed.status).toBe("finalizing_failed");
  });
});
