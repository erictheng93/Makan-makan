/**
 * Group Order Expiry Sweep
 *
 * Drives the three things a group order needs once nobody is looking at it:
 * a five-minute warning before it expires, auto-submit or cancel at expiry,
 * and recovery of a finalize claim whose isolate died mid-flight.
 *
 * Queries go through Drizzle rather than raw SQL. This worker runs unattended
 * and creates real orders, so a column or status rename has to fail at compile
 * time — a runtime failure here is one nobody is watching.
 */

import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, gt, isNotNull, isNull, lt, lte } from "drizzle-orm";
import { groupActivityLogs, groupOrders } from "@makanmakan/database";
import type { GroupOrderSettings } from "@makanmakan/shared-types";
import { GroupOrdersService } from "../features/group-orders/services/GroupOrdersService";
import type { GroupOrderStatus } from "../features/group-orders/types";
import type { Env } from "../types/env";

export const GROUP_ORDER_EXPIRY_CRON = "*/5 * * * *";
export const GROUP_ORDER_EXPIRY_WARNING_MS = 5 * 60 * 1000;
export const GROUP_ORDER_FINALIZING_STALE_MS = 10 * 60 * 1000;

// Typed rather than inlined so an invalid status is a compile error here, the
// same way it is everywhere else that touches group_orders.status.
const ACTIVE: GroupOrderStatus = "active";
const CANCELLED: GroupOrderStatus = "cancelled";
const FINALIZING: GroupOrderStatus = "finalizing";

export interface GroupOrderExpirySweepResult {
  finalized: number;
  cancelled: number;
  warned: number;
  errors: string[];
}

export type GroupOrderSweepDb = ReturnType<typeof drizzle>;

interface SweepOptions {
  now?: Date;
  /** Injectable for tests; defaults to a Drizzle instance over `env.DB`. */
  db?: GroupOrderSweepDb;
  serviceFactory?: (env: Env) => Pick<GroupOrdersService, "finalizeGroupOrder">;
}

const sweepColumns = {
  id: groupOrders.id,
  shareCode: groupOrders.shareCode,
  expiresAt: groupOrders.expiresAt,
  settings: groupOrders.settings,
};

type SweepGroupOrder = {
  id: string;
  shareCode: string;
  expiresAt: Date;
  settings: GroupOrderSettings | null;
};

/**
 * `settings` is a JSON column, so Drizzle hands back an object. The guard is
 * for rows written before that was true, and for a blob that somehow decoded
 * to a non-object — neither should take down a sweep over every other group.
 */
function readSettings(
  settings: SweepGroupOrder["settings"],
): GroupOrderSettings {
  if (!settings || typeof settings !== "object") return {};
  return { ...settings };
}

async function cancelExpiredGroupOrder(
  db: GroupOrderSweepDb,
  groupOrder: SweepGroupOrder,
  now: Date,
): Promise<boolean> {
  // Conditional update: another sweep or the host may have moved this group on
  // since it was selected. `returning` is how we learn whether we won.
  const cancelled = await db
    .update(groupOrders)
    .set({ status: CANCELLED, updatedAt: now })
    .where(
      and(eq(groupOrders.id, groupOrder.id), eq(groupOrders.status, ACTIVE)),
    )
    .returning({ id: groupOrders.id });

  if (cancelled.length === 0) return false;

  await db.insert(groupActivityLogs).values({
    id: randomUUID(),
    groupOrderId: groupOrder.id,
    memberId: null,
    action: "group_expired",
    description: "Group order expired and was cancelled",
    metadata: { expiredAt: groupOrder.expiresAt.getTime() },
    createdAt: now,
  });

  return true;
}

async function invalidateGroupOrderCache(
  env: Env,
  groupOrder: SweepGroupOrder,
): Promise<void> {
  await env.CACHE_KV?.delete(`group_order:${groupOrder.id}`);
  await env.CACHE_KV?.delete(`group_order_summary:${groupOrder.id}`);
  await env.CACHE_KV?.delete(`share_code:${groupOrder.shareCode}`);
}

export async function sweepExpiringGroupOrders(
  env: Env,
  options: SweepOptions = {},
): Promise<GroupOrderExpirySweepResult> {
  const now = options.now ?? new Date();
  const warningCutoff = new Date(now.getTime() + GROUP_ORDER_EXPIRY_WARNING_MS);
  const staleBefore = new Date(now.getTime() - GROUP_ORDER_FINALIZING_STALE_MS);
  const db = options.db ?? drizzle(env.DB);
  const result: GroupOrderExpirySweepResult = {
    finalized: 0,
    cancelled: 0,
    warned: 0,
    errors: [],
  };

  const serviceFactory =
    options.serviceFactory ??
    ((sweepEnv: Env) => new GroupOrdersService(sweepEnv.DB, sweepEnv.CACHE_KV));

  const expiringSoon = (await db
    .select(sweepColumns)
    .from(groupOrders)
    .where(
      and(
        eq(groupOrders.status, ACTIVE),
        gt(groupOrders.expiresAt, now),
        lte(groupOrders.expiresAt, warningCutoff),
      ),
    )
    .limit(500)) as SweepGroupOrder[];

  for (const groupOrder of expiringSoon) {
    try {
      const settings = readSettings(groupOrder.settings);
      if (settings.expiryWarningSentAt) continue;

      await db
        .update(groupOrders)
        .set({
          settings: { ...settings, expiryWarningSentAt: now.toISOString() },
          updatedAt: now,
        })
        .where(
          and(
            eq(groupOrders.id, groupOrder.id),
            eq(groupOrders.status, ACTIVE),
          ),
        );
      result.warned++;
    } catch (error) {
      result.errors.push(`${groupOrder.id}: ${(error as Error).message}`);
    }
  }

  const expired = (await db
    .select(sweepColumns)
    .from(groupOrders)
    .where(and(eq(groupOrders.status, ACTIVE), lte(groupOrders.expiresAt, now)))
    .limit(500)) as SweepGroupOrder[];

  for (const groupOrder of expired) {
    try {
      const settings = readSettings(groupOrder.settings);
      if (settings.autoSubmitOnExpiry === false) {
        if (await cancelExpiredGroupOrder(db, groupOrder, now)) {
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

  // Recover claims whose isolate died between taking the mutex and releasing
  // it. Guarded on masterOrderId being null so a group whose real order was
  // already created is never handed back to a second finalizer.
  // `finalizing_failed` is deliberately out of scope — that is a terminal
  // state awaiting a human, not a stuck claim.
  await db
    .update(groupOrders)
    .set({ status: ACTIVE, lockedAt: null, updatedAt: now })
    .where(
      and(
        eq(groupOrders.status, FINALIZING),
        isNull(groupOrders.masterOrderId),
        isNotNull(groupOrders.lockedAt),
        lt(groupOrders.lockedAt, staleBefore),
      ),
    );

  return result;
}
