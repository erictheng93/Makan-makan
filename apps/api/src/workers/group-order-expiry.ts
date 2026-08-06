import { randomUUID } from "crypto";
import type { D1Database } from "@cloudflare/workers-types";
import type { GroupOrderSettings } from "@makanmakan/shared-types";
import { GroupOrdersService } from "../features/group-orders/services/GroupOrdersService";
import type { Env } from "../types/env";

export const GROUP_ORDER_EXPIRY_CRON = "*/5 * * * *";
export const GROUP_ORDER_EXPIRY_WARNING_MS = 5 * 60 * 1000;
export const GROUP_ORDER_FINALIZING_STALE_MS = 10 * 60 * 1000;

export interface GroupOrderExpirySweepResult {
  finalized: number;
  cancelled: number;
  warned: number;
  errors: string[];
}

type SweepGroupOrder = {
  id: string;
  share_code: string;
  expires_at_ms: number;
  settings: string | GroupOrderSettings | null;
};

interface SweepOptions {
  now?: Date;
  serviceFactory?: (env: Env) => Pick<GroupOrdersService, "finalizeGroupOrder">;
}

function parseSettings(
  settings: SweepGroupOrder["settings"],
): GroupOrderSettings & Record<string, unknown> {
  if (!settings) return {};
  if (typeof settings === "object") {
    return { ...settings };
  }

  try {
    const parsed = JSON.parse(settings);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function allGroupOrders(
  db: D1Database,
  sql: string,
  ...bindings: unknown[]
): Promise<SweepGroupOrder[]> {
  const result = await db
    .prepare(sql)
    .bind(...bindings)
    .all<SweepGroupOrder>();
  return result.results ?? [];
}

async function cancelExpiredGroupOrder(
  db: D1Database,
  groupOrder: SweepGroupOrder,
  now: Date,
): Promise<boolean> {
  const updated = await db
    .prepare(
      `
        UPDATE group_orders
        SET status = 'cancelled', updated_at_ms = ?
        WHERE id = ? AND status = 'active'
      `,
    )
    .bind(now.getTime(), groupOrder.id)
    .run();

  if ((updated.meta?.changes ?? 0) === 0) return false;

  await db
    .prepare(
      `
        INSERT INTO group_activity_logs
          (id, group_order_id, member_id, action, description, metadata, created_at_ms)
        VALUES (?, ?, NULL, 'group_expired', ?, ?, ?)
      `,
    )
    .bind(
      randomUUID(),
      groupOrder.id,
      "Group order expired and was cancelled",
      JSON.stringify({ expiredAt: groupOrder.expires_at_ms }),
      now.getTime(),
    )
    .run();

  return true;
}

async function invalidateGroupOrderCache(
  env: Env,
  groupOrder: SweepGroupOrder,
): Promise<void> {
  await env.CACHE_KV?.delete(`group_order:${groupOrder.id}`);
  await env.CACHE_KV?.delete(`group_order_summary:${groupOrder.id}`);
  await env.CACHE_KV?.delete(`share_code:${groupOrder.share_code}`);
}

export async function sweepExpiringGroupOrders(
  env: Env,
  options: SweepOptions = {},
): Promise<GroupOrderExpirySweepResult> {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const warningCutoffMs = nowMs + GROUP_ORDER_EXPIRY_WARNING_MS;
  const staleBeforeMs = nowMs - GROUP_ORDER_FINALIZING_STALE_MS;
  const result: GroupOrderExpirySweepResult = {
    finalized: 0,
    cancelled: 0,
    warned: 0,
    errors: [],
  };

  const serviceFactory =
    options.serviceFactory ??
    ((sweepEnv: Env) => new GroupOrdersService(sweepEnv.DB, sweepEnv.CACHE_KV));

  const expiringSoon = await allGroupOrders(
    env.DB,
    `
      SELECT id, share_code, expires_at_ms, settings
      FROM group_orders
      WHERE status = 'active'
        AND expires_at_ms > ?
        AND expires_at_ms <= ?
      LIMIT 500
    `,
    nowMs,
    warningCutoffMs,
  );

  for (const groupOrder of expiringSoon) {
    try {
      const settings = parseSettings(groupOrder.settings);
      if (settings.expiryWarningSentAt) continue;

      await env.DB.prepare(
        `
          UPDATE group_orders
          SET settings = ?, updated_at_ms = ?
          WHERE id = ? AND status = 'active'
        `,
      )
        .bind(
          JSON.stringify({
            ...settings,
            expiryWarningSentAt: now.toISOString(),
          }),
          nowMs,
          groupOrder.id,
        )
        .run();
      result.warned++;
    } catch (error) {
      result.errors.push(`${groupOrder.id}: ${(error as Error).message}`);
    }
  }

  const expired = await allGroupOrders(
    env.DB,
    `
      SELECT id, share_code, expires_at_ms, settings
      FROM group_orders
      WHERE status = 'active'
        AND expires_at_ms <= ?
      LIMIT 500
    `,
    nowMs,
  );

  for (const groupOrder of expired) {
    try {
      const settings = parseSettings(groupOrder.settings);
      if (settings.autoSubmitOnExpiry === false) {
        if (await cancelExpiredGroupOrder(env.DB, groupOrder, now)) {
          await invalidateGroupOrderCache(env, groupOrder);
          result.cancelled++;
        }
        continue;
      }

      const finalizeResult = await serviceFactory(env).finalizeGroupOrder(
        groupOrder.id,
      );
      if (!finalizeResult.success) {
        result.errors.push(
          `${groupOrder.id}: ${
            finalizeResult.error ?? "Failed to finalize group order"
          }`,
        );
        continue;
      }
      result.finalized++;
    } catch (error) {
      result.errors.push(`${groupOrder.id}: ${(error as Error).message}`);
    }
  }

  await env.DB.prepare(
    `
      UPDATE group_orders
      SET status = 'active', locked_at_ms = NULL, updated_at_ms = ?
      WHERE status = 'finalizing'
        AND master_order_id IS NULL
        AND locked_at_ms IS NOT NULL
        AND locked_at_ms < ?
    `,
  )
    .bind(nowMs, staleBeforeMs)
    .run();

  return result;
}
