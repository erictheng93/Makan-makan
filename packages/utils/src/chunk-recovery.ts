/**
 * Recovery for the one failure every code-split app shares: a deploy replaces
 * the hashed chunks, and a tab still holding the previous index.html asks for
 * filenames that are gone. Fetching the document again is the only cure — no
 * client-side routing can conjure a file the edge stopped serving.
 *
 * What differs between apps is not the detection but the giving up, so that is
 * the part left to the caller. A diner gets an error page, an unattended
 * kitchen screen keeps trying because nobody is there to press refresh, and an
 * admin at a desk needs neither.
 */

const CHUNK_FAILURE_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

/**
 * Walks `cause`, because an import failure rarely arrives bare — whatever
 * caught it wraps it, and the original text is the only marker there is: the
 * browsers disagree on wording and none of them set a code.
 */
export function isChunkLoadFailure(error: unknown, depth = 0): boolean {
  if (!error || depth > 4) return false;

  const message = error instanceof Error ? error.message : String(error);
  if (CHUNK_FAILURE_PATTERN.test(message)) return true;

  const cause = (error as { cause?: unknown }).cause;
  return cause ? isChunkLoadFailure(cause, depth + 1) : false;
}

export interface ChunkRecoveryOptions {
  /**
   * Distinct per app: two of these can share an origin, and one app's attempt
   * must not talk another out of its own.
   */
  storageKey: string;
  /**
   * How long before a path that already failed may be reloaded again. Omit to
   * try once and never again — right where a person is present to react.
   * An unattended screen wants a value here so it can heal itself.
   */
  retryAfterMs?: number;
}

interface ReloadMark {
  path: string;
  at: number;
}

/** Storage is unavailable in some kiosk and privacy modes; then there is no mark. */
function readMark(key: string): ReloadMark | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReloadMark>;
    return typeof parsed?.path === "string" && typeof parsed?.at === "number"
      ? { path: parsed.path, at: parsed.at }
      : null;
  } catch {
    return null;
  }
}

function writeMark(key: string, mark: ReloadMark): boolean {
  try {
    sessionStorage.setItem(key, JSON.stringify(mark));
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a predicate for a router's error handler. It answers "I am taking
 * this one" — true means the document is being fetched again and the handler
 * should stop. Everything else, including a chunk failure this has already
 * spent its attempt on, comes back false so the app can fall back to whatever
 * it shows a person.
 */
export function createChunkRecovery(options: ChunkRecoveryOptions) {
  const { storageKey, retryAfterMs } = options;

  return function recoverFromChunkFailure(
    error: unknown,
    to?: { fullPath?: string } | null,
  ): boolean {
    if (!isChunkLoadFailure(error)) return false;

    const target = to?.fullPath ?? window.location.pathname;
    const mark = readMark(storageKey);

    if (mark && mark.path === target) {
      const mayRetry =
        retryAfterMs !== undefined && Date.now() - mark.at >= retryAfterMs;
      // Reloading again now would be a spin rather than a recovery.
      if (!mayRetry) return false;
    }

    // Without somewhere to record the attempt there is no way to bound the
    // retries, and an unbounded reload loop is worse than a stalled page.
    if (!writeMark(storageKey, { path: target, at: Date.now() })) return false;

    window.location.assign(target);
    return true;
  };
}

/**
 * Call after a successful navigation: the stale build is behind us, so the
 * next deploy earns its own immediate attempt instead of inheriting a mark.
 */
export function clearChunkRecoveryMark(storageKey: string): void {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // Nothing was recorded to forget.
  }
}
