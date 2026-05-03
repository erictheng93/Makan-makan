import type { Env } from "../types/env";
import { UsageService } from "../features/billing/services/UsageService";

export async function snapshotStorageUsage(env: Env) {
  const startedAt = Date.now();
  const result = await new UsageService(env.DB).emitStorageSnapshots(startedAt);

  console.log("storageSnapshot.batch", {
    emitted: result.emitted,
    durationMs: Date.now() - startedAt,
  });

  return result;
}
