/**
 * Liveness probes for the backing services.
 *
 * These actually touch D1 and KV. Health derived from in-process counters
 * cannot detect an outage — a Worker isolate that has served no traffic, or one
 * whose counters were never populated, reports perfect health while the
 * database is unreachable. A health check has to ask the dependency.
 */

import type { D1Database, KVNamespace } from "@cloudflare/workers-types";

export interface ProbeResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

/** Key read by probeCache. Never written — a miss still proves reachability. */
const CACHE_PROBE_KEY = "_health_probe";

export async function probeDatabase(db?: D1Database): Promise<ProbeResult> {
  const startedAt = Date.now();

  if (!db) {
    return { healthy: false, latencyMs: 0, error: "D1 binding not configured" };
  }

  try {
    const row = await db.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return {
      healthy: row?.ok === 1,
      latencyMs: Date.now() - startedAt,
      error: row?.ok === 1 ? undefined : "unexpected probe result",
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}

/**
 * Reads a sentinel key rather than writing one. A round trip is enough to prove
 * KV is reachable, and the health endpoint is public — writing on every call
 * would let anyone burn the account's KV write quota.
 */
export async function probeCache(kv?: KVNamespace): Promise<ProbeResult> {
  const startedAt = Date.now();

  if (!kv) {
    return { healthy: false, latencyMs: 0, error: "KV binding not configured" };
  }

  try {
    await kv.get(CACHE_PROBE_KEY);
    return { healthy: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}

/**
 * Whether a health request asked for the write-path probe (`?deep=1`).
 *
 * Lives beside the probes rather than in the route file because the auth layer
 * needs the same answer. `/api/v1/system/health` is exempt from bearer auth so
 * external monitors can poll it, and the exemption is matched on `c.req.path`,
 * which ignores the query string — so without this the `deep` flag would hand
 * anonymous callers the KV writes the read probe exists to avoid (#324).
 *
 * Presence means deep: `?deep`, `?deep=1` and `?deep=true` all opt in, while
 * `?deep=0` and `?deep=false` read as an explicit opt-out rather than as the
 * non-empty string they are.
 */
export function isDeepHealthRequest(url: string): boolean {
  let value: string | null;
  try {
    value = new URL(url).searchParams.get("deep");
  } catch {
    return false;
  }

  if (value === null) return false;
  return value !== "0" && value !== "false";
}
