import type { Router } from "vue-router";

/**
 * A deploy replaces every hashed chunk, so a screen still holding the previous
 * index.html asks for filenames that are gone. Fetching the document again is
 * the only recovery — no amount of client-side routing can conjure a file that
 * the edge no longer serves.
 *
 * This display is unattended for a whole shift, which changes what "give up"
 * should mean. The customer app stops after one attempt and shows a diner an
 * error page; nobody is standing in front of this screen to read one, and a
 * kitchen that quietly stops receiving orders is the failure to avoid. So a
 * failing path is retried, just slowly: one reload per cooldown rather than a
 * spin, which lets a screen heal itself once a half-finished deploy settles.
 */
const RELOAD_MARK_KEY = "makanmasak_kds_chunk_reload";
const RETRY_COOLDOWN_MS = 60_000;

const CHUNK_FAILURE_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

interface ReloadMark {
  path: string;
  at: number;
}

/**
 * Walks `cause`, because an import failure rarely arrives bare — the loader
 * that caught it wraps it, and the original text is the only marker there is:
 * browsers disagree on the wording and none of them set a code.
 */
export function isChunkLoadFailure(error: unknown, depth = 0): boolean {
  if (!error || depth > 4) return false;

  const message = error instanceof Error ? error.message : String(error);
  if (CHUNK_FAILURE_PATTERN.test(message)) return true;

  const cause = (error as { cause?: unknown }).cause;
  return cause ? isChunkLoadFailure(cause, depth + 1) : false;
}

/** Storage is unavailable in some kiosk configurations; then there is no mark. */
function readMark(): ReloadMark | null {
  try {
    const raw = sessionStorage.getItem(RELOAD_MARK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReloadMark>;
    return typeof parsed?.path === "string" && typeof parsed?.at === "number"
      ? { path: parsed.path, at: parsed.at }
      : null;
  } catch {
    return null;
  }
}

function writeMark(mark: ReloadMark): boolean {
  try {
    sessionStorage.setItem(RELOAD_MARK_KEY, JSON.stringify(mark));
    return true;
  } catch {
    return false;
  }
}

function clearMark(): void {
  try {
    sessionStorage.removeItem(RELOAD_MARK_KEY);
  } catch {
    // Nothing was recorded to forget.
  }
}

export function installKitchenChunkRecovery(router: Router): void {
  router.onError((error, to) => {
    console.error("路由錯誤:", error);

    if (!isChunkLoadFailure(error)) return;

    const target = to?.fullPath ?? window.location.pathname;
    const mark = readMark();
    if (
      mark &&
      mark.path === target &&
      Date.now() - mark.at < RETRY_COOLDOWN_MS
    ) {
      // Already reloaded for this path a moment ago. Reloading again now would
      // be a spin; the cooldown will let the next attempt through.
      return;
    }

    if (!writeMark({ path: target, at: Date.now() })) return;
    window.location.assign(target);
  });

  router.afterEach(() => {
    // Navigation worked, so the stale build is behind us. Forgetting the mark
    // lets the next deploy earn its own immediate reload.
    clearMark();
  });
}
