import type { Env } from "../types/env";
import { CreditService } from "../features/credits/services/CreditService";

const DEFAULT_BATCH_LIMIT = 200;

export interface CreditExpiryWorkerOptions {
  nowMs?: number;
  limit?: number;
}

export interface CreditExpiryWorkerResult {
  scanned: number;
  expired: number;
  totalExpiredCents: number;
  durationMs: number;
}

/**
 * Expire stored-value balances whose rolling expiry has lapsed (inactivity).
 * Scheduled daily; each lapsed account is zeroed and gets an `expire` ledger
 * entry (breakage). Safe to re-run — already-zero balances are skipped.
 */
export async function expireStaleCredits(
  env: Env,
  options: CreditExpiryWorkerOptions = {},
): Promise<CreditExpiryWorkerResult> {
  const startedAt = Date.now();
  const result = await new CreditService(env).expireStaleAccounts({
    nowMs: options.nowMs,
    limit: options.limit ?? DEFAULT_BATCH_LIMIT,
  });
  return { ...result, durationMs: Date.now() - startedAt };
}
