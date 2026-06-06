import type { Env } from "../types/env";
import { CreditService } from "../features/credits/services/CreditService";
import { AlertService } from "../services/AlertService";

const DEFAULT_BATCH_LIMIT = 200;
const DEFAULT_MAX_BATCHES = 50; // safety cap: up to maxBatches * limit per run

export interface CreditExpiryWorkerOptions {
  nowMs?: number;
  limit?: number;
  maxBatches?: number;
}

export interface CreditExpiryWorkerResult {
  scanned: number;
  expired: number;
  totalExpiredCents: number;
  failedAccounts: number;
  /** True if the batch cap was hit before draining — more may remain for the next run. */
  capped: boolean;
  /** Accounts whose balance disagrees with their ledger sum (should be 0). */
  driftAccounts: number;
  durationMs: number;
}

/**
 * Expire stored-value balances whose rolling expiry has lapsed (inactivity).
 * Scheduled daily; each lapsed account is zeroed and gets an `expire` ledger
 * entry (breakage). Drains in batches until no candidates remain (bounded by a
 * safety cap), isolates per-account failures, runs an integrity sweep, and
 * escalates drift / incomplete runs to ops. Safe to re-run.
 */
export async function expireStaleCredits(
  env: Env,
  options: CreditExpiryWorkerOptions = {},
): Promise<CreditExpiryWorkerResult> {
  const startedAt = Date.now();
  const service = new CreditService(env);
  const batchLimit = options.limit ?? DEFAULT_BATCH_LIMIT;
  const maxBatches = options.maxBatches ?? DEFAULT_MAX_BATCHES;

  let scanned = 0;
  let expired = 0;
  let totalExpiredCents = 0;
  const failures: Array<{ accountId: string; error: string }> = [];
  let capped = true; // until we observe a drained / no-progress batch

  for (let batch = 0; batch < maxBatches; batch++) {
    const r = await service.expireStaleAccounts({
      nowMs: options.nowMs,
      limit: batchLimit,
    });
    scanned += r.scanned;
    expired += r.expired;
    totalExpiredCents += r.totalExpiredCents;
    failures.push(...r.failures);
    // Drained (partial batch) or no forward progress (only failing/raced rows).
    if (r.scanned < batchLimit || r.expired === 0) {
      capped = false;
      break;
    }
  }

  // Integrity sweep: surface any balance/ledger drift (the narrow crash window).
  const drift = await service.findBalanceLedgerDrift({ limit: 100 });

  await emitAlerts(env, {
    driftAccounts: drift.length,
    driftSample: drift.slice(0, 20),
    failedAccounts: failures.length,
    failureSample: failures.slice(0, 20),
    capped,
  });

  return {
    scanned,
    expired,
    totalExpiredCents,
    failedAccounts: failures.length,
    capped,
    driftAccounts: drift.length,
    durationMs: Date.now() - startedAt,
  };
}

async function emitAlerts(
  env: Env,
  info: {
    driftAccounts: number;
    driftSample: unknown[];
    failedAccounts: number;
    failureSample: unknown[];
    capped: boolean;
  },
): Promise<void> {
  if (info.driftAccounts === 0 && info.failedAccounts === 0 && !info.capped) {
    return;
  }
  // Best-effort: alerting must never fail the cron run.
  try {
    const alerts = new AlertService(env);
    if (info.driftAccounts > 0) {
      await alerts.sendAlert({
        title: "Credit ledger drift detected",
        message: `${info.driftAccounts} stored-value account(s) have a balance that disagrees with their ledger sum (possible deduct-then-ledger crash window).`,
        severity: "error",
        metadata: {
          driftAccounts: info.driftAccounts,
          sample: info.driftSample,
        },
      });
    }
    if (info.failedAccounts > 0 || info.capped) {
      await alerts.sendAlert({
        title: "Credit expiry run incomplete",
        message: `Credit expiry had ${info.failedAccounts} failed account(s)${
          info.capped ? " and hit the batch cap (more may remain next run)" : ""
        }.`,
        severity: "warning",
        metadata: {
          failedAccounts: info.failedAccounts,
          capped: info.capped,
          sample: info.failureSample,
        },
      });
    }
  } catch (error) {
    console.error("[CreditExpiry] failed to emit alert", error);
  }
}
