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
  /** Accounts whose balance disagrees with their ledger sum (should be 0). */
  driftAccounts: number;
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
  const service = new CreditService(env);
  const result = await service.expireStaleAccounts({
    nowMs: options.nowMs,
    limit: options.limit ?? DEFAULT_BATCH_LIMIT,
  });

  // Integrity sweep: surface any balance/ledger drift (the narrow crash window).
  const drift = await service.findBalanceLedgerDrift({ limit: 100 });
  if (drift.length > 0) {
    console.warn(
      "[CreditExpiry] balance/ledger drift detected",
      drift.slice(0, 20),
    );
  }

  return {
    ...result,
    driftAccounts: drift.length,
    durationMs: Date.now() - startedAt,
  };
}
