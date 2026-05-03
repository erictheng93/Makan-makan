import type { Env } from "../types/env";

export const USAGE_EVENTS_TTL_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function cleanupExpiredUsageEvents(
  env: Env,
  now = Date.now(),
  ttlDays = USAGE_EVENTS_TTL_DAYS,
) {
  const cutoff = now - ttlDays * DAY_MS;
  const result = await env.DB.prepare(
    `DELETE FROM usage_events
      WHERE occurred_at_ms < ?
        AND aggregated_at_ms IS NOT NULL`,
  )
    .bind(cutoff)
    .run();

  return { deleted: result.meta?.changes ?? 0, cutoff };
}
