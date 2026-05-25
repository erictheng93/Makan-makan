import type { Env } from "../types/env";

export interface RealtimeRateLimitSubject {
  roomType: "customer" | "admin" | "kitchen";
  roomId: string;
}

export interface RealtimeRateLimitDecision {
  allowed: boolean;
  key: string;
  count: number;
  limit: number;
  retryAfterSeconds: number;
}

const WINDOW_SECONDS = 60;
const DEFAULT_LIMITS: Record<RealtimeRateLimitSubject["roomType"], number> = {
  customer: 30,
  admin: 60,
  kitchen: 60,
};

function getClientAddress(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function isEnabled(env: Env): boolean {
  return env.RATE_LIMIT_ENABLED === "true" && Boolean(env.RATE_LIMIT_KV);
}

export async function checkRealtimeRateLimit(
  request: Request,
  env: Env,
  subject: RealtimeRateLimitSubject,
  now = Date.now(),
): Promise<RealtimeRateLimitDecision> {
  const clientAddress = getClientAddress(request);
  const limit = DEFAULT_LIMITS[subject.roomType];
  const windowId = Math.floor(now / (WINDOW_SECONDS * 1000));
  const key = `ws-rate:${subject.roomType}:${subject.roomId}:${clientAddress}:${windowId}`;

  if (!isEnabled(env)) {
    return {
      allowed: true,
      key,
      count: 0,
      limit,
      retryAfterSeconds: 0,
    };
  }

  const currentValue = await env.RATE_LIMIT_KV.get(key);
  const currentCount = currentValue ? Number.parseInt(currentValue, 10) : 0;
  const count = Number.isFinite(currentCount) ? currentCount + 1 : 1;
  const retryAfterSeconds =
    WINDOW_SECONDS - Math.floor((now % (WINDOW_SECONDS * 1000)) / 1000);

  if (count > limit) {
    return {
      allowed: false,
      key,
      count,
      limit,
      retryAfterSeconds,
    };
  }

  await env.RATE_LIMIT_KV.put(key, String(count), {
    expirationTtl: retryAfterSeconds,
  });

  return {
    allowed: true,
    key,
    count,
    limit,
    retryAfterSeconds,
  };
}

export function rateLimitResponse(
  decision: RealtimeRateLimitDecision,
): Response {
  return Response.json(
    {
      error: "Too many realtime connection attempts",
      code: "REALTIME_RATE_LIMITED",
      limit: decision.limit,
      retryAfterSeconds: decision.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(decision.retryAfterSeconds),
      },
    },
  );
}
