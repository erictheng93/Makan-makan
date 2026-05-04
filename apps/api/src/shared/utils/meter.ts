import type { Context } from "hono";
import type { MeterKey } from "@makanmakan/database";
import { generateUUID } from "@makanmakan/utils";
import type { Env } from "../../types/env";

export interface MeterEmitOptions {
  restaurantId?: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

interface UsageEventInput {
  restaurantId: string;
  meterKey: MeterKey;
  quantity: number;
  metadata: Record<string, unknown> | null;
}

export async function insertUsageEvent(
  db: Env["DB"],
  input: UsageEventInput,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO usage_events (
        id, restaurant_id, meter_key, quantity, metadata
      ) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      generateUUID(),
      input.restaurantId,
      input.meterKey,
      input.quantity,
      input.metadata === null ? null : JSON.stringify(input.metadata),
    )
    .run();
}

export async function meterEmit(
  c: Context<any>,
  meterKey: MeterKey,
  options: MeterEmitOptions = {},
): Promise<void> {
  const user = c.get("user") as
    | { restaurantId?: string | number | null }
    | undefined;
  const restaurantId =
    options.restaurantId ??
    (user?.restaurantId == null ? undefined : String(user.restaurantId));

  if (!restaurantId) return;

  const insertOp = insertUsageEvent((c.env as Env).DB, {
    restaurantId,
    meterKey,
    quantity: options.quantity ?? 1,
    metadata: options.metadata ?? null,
  }).catch((error) => {
    console.error("meterEmit.failed", { meterKey, restaurantId, error });
  });

  let waitUntil: ((promise: Promise<unknown>) => void) | undefined;
  try {
    waitUntil = c.executionCtx?.waitUntil?.bind(c.executionCtx);
  } catch {
    waitUntil = undefined;
  }

  if (waitUntil) {
    waitUntil(insertOp);
  } else {
    await insertOp;
  }
}
