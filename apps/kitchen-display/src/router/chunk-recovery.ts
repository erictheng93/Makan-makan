import type { Router } from "vue-router";
import {
  clearChunkRecoveryMark,
  createChunkRecovery,
} from "@makanmasak/utils/chunk-recovery";

/**
 * This display is unattended for a whole shift, which decides the retry policy.
 * The customer app reloads once and then shows a diner an error page; nobody is
 * standing in front of this screen to read one, and a kitchen that quietly
 * stops receiving orders is the failure worth avoiding. So a failing path keeps
 * being retried, just slowly — one reload per minute rather than a spin — which
 * lets a screen heal itself once a half-finished deploy settles.
 */
const RELOAD_MARK_KEY = "makanmasak_kds_chunk_reload";
const RETRY_COOLDOWN_MS = 60_000;

const recoverFromChunkFailure = createChunkRecovery({
  storageKey: RELOAD_MARK_KEY,
  retryAfterMs: RETRY_COOLDOWN_MS,
});

export function installKitchenChunkRecovery(router: Router): void {
  router.onError((error, to) => {
    console.error("路由錯誤:", error);
    // Nothing else to do with it: this app has no error view, and a stalled
    // screen with a logged reason beats one that reloads forever.
    recoverFromChunkFailure(error, to);
  });

  router.afterEach(() => {
    // Navigation worked, so the stale build is behind us. Forgetting the mark
    // lets the next deploy earn its own immediate reload.
    clearChunkRecoveryMark(RELOAD_MARK_KEY);
  });
}
