/**
 * Per-actor budget for unmasking a member's contact details (spec §9.2).
 *
 * Keyed on the staff user id, not the IP: the thing being bounded is how much
 * of a restaurant's customer list one account can copy out by hand, and a
 * shared restaurant WiFi would otherwise pool every terminal's budget into one
 * (the mistake that took out QR ordering in #163-#168). A legitimate owner
 * looking up a customer to call them back does that a handful of times a day;
 * 30 in an hour is a scrape, not a shift.
 *
 * Layered under the global per-IP limiter in geo-rate-limiting, not a
 * replacement for it.
 */

import { GeoIntelligentRateLimiter } from "../../../middleware/geo-rate-limiting";
import { ApiError } from "../../../shared/utils/api-error";
import type { Env } from "../../../types/env";

/** `burstMultiplier: 1` so the effective ceiling is exactly 30 per hour. */
export const PII_REVEAL_THROTTLE = {
  requests: 30,
  windowSeconds: 3600,
  burstMultiplier: 1,
  blockDuration: 3600,
} as const;

/**
 * Just the slice of Hono's Context this needs. Taking `Context<{Bindings: Env}>`
 * does not work here: the route's context also carries `Variables` (the
 * validated params), and Context is invariant in that position.
 */
interface ThrottleContext {
  env: Env;
  req: { raw: Request };
  executionCtx: { waitUntil(promise: Promise<unknown>): void };
}

function resolveWaitUntil(c: ThrottleContext): {
  waitUntil: (promise: Promise<unknown>) => void;
} {
  try {
    return c.executionCtx;
  } catch {
    return { waitUntil: () => undefined };
  }
}

export async function enforcePiiRevealThrottle(
  c: ThrottleContext,
  actorId: string,
): Promise<void> {
  const rateLimitKV = c.env.RATE_LIMIT_KV;
  // Same posture as applyRateLimit's own catch: availability beats enforcement
  // when the counter store is unreachable. The audit row is what makes an
  // unbounded burst detectable after the fact.
  if (!rateLimitKV) return;

  const limiter = new GeoIntelligentRateLimiter(
    rateLimitKV,
    c.env.ANALYTICS_ENGINE,
    resolveWaitUntil(c),
    c.env,
  );

  const result = await limiter.applyRateLimit(
    c.req.raw,
    { ...PII_REVEAL_THROTTLE },
    `pii-reveal:actor:${actorId}`,
  );

  if (!result.allowed) {
    throw new ApiError(
      "PII_REVEAL_RATE_LIMITED",
      "Too many contact reveals from this account. Please try again later.",
      429,
      { retryAfter: result.retryAfter ?? PII_REVEAL_THROTTLE.blockDuration },
    );
  }
}
