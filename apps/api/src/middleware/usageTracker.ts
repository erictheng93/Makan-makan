import type { Context, Next } from "hono";
import type { Env } from "../types/env";
import { meterEmit } from "../shared/utils/meter";

const EXCLUDED_PREFIXES = [
  "/api/v1/auth",
  "/api/v1/discovery",
  "/api/v1/qr",
  "/api/v1/webhooks",
  "/api/v1/integrations/webhooks",
];

const EXCLUDED_PATHS = new Set([
  "/",
  "/health",
  "/info",
  "/api/v1/health",
  "/api/v1/me/modules",
  "/api/v1/monitoring/health",
]);

function shouldSkip(c: Context<{ Bindings: Env }>): boolean {
  if (c.req.method === "OPTIONS") return true;

  const path = c.req.path;
  if (EXCLUDED_PATHS.has(path)) return true;
  return EXCLUDED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export async function usageTracker(c: Context<{ Bindings: Env }>, next: Next) {
  try {
    await next();
  } finally {
    if (!shouldSkip(c)) {
      try {
        await meterEmit(c, "api.requests", {
          metadata: {
            method: c.req.method,
            path: c.req.path,
            status: c.res.status,
          },
        });
      } catch (error) {
        console.error("usageTracker.failed", { path: c.req.path, error });
      }
    }
  }
}
