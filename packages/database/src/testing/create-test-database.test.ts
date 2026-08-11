import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isTestDatabaseReuseEnabled,
  REAL_D1_SETUP_TIMEOUT_MS,
  retryTransientD1Error,
  sweepAbandonedBuilds,
  tryAcquireBaselineLock,
  withDiagnosticTimeout,
} from "./create-test-database";

const realSetTimeout = globalThis.setTimeout;

function waitReal(ms: number): Promise<"timed-out"> {
  return new Promise((resolve) => {
    realSetTimeout(() => resolve("timed-out"), ms);
  });
}

describe("isTestDatabaseReuseEnabled", () => {
  it("uses migrated baseline reuse by default", () => {
    expect(isTestDatabaseReuseEnabled({})).toBe(true);
  });

  it("allows explicit opt-out for migration timing diagnostics", () => {
    expect(
      isTestDatabaseReuseEnabled({ MAKANMAKAN_REAL_D1_REUSE_DB: "0" }),
    ).toBe(false);
  });

  it("keeps the existing explicit opt-in value enabled", () => {
    expect(
      isTestDatabaseReuseEnabled({ MAKANMAKAN_REAL_D1_REUSE_DB: "1" }),
    ).toBe(true);
  });
});

describe("withDiagnosticTimeout", () => {
  it("returns the operation result before the deadline", async () => {
    await expect(
      withDiagnosticTimeout(Promise.resolve("ready"), 60_000, "startup"),
    ).resolves.toBe("ready");
  });

  it("rejects with an operation-specific message after the deadline", async () => {
    vi.useFakeTimers();
    try {
      const pending = new Promise<never>(() => {});
      const result = withDiagnosticTimeout(
        pending,
        10,
        "starting Miniflare D1",
      );

      await expect(result).rejects.toThrow(
        "Timed out starting Miniflare D1 after 1s",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("retryTransientD1Error", () => {
  it("backs off with real timers when Vitest fake timers are active", async () => {
    vi.useFakeTimers();
    try {
      const fn = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error("fetch failed"))
        .mockResolvedValueOnce("ready");

      const result = await Promise.race([
        retryTransientD1Error("truncateAll", fn),
        waitReal(250),
      ]);

      expect(result).toBe("ready");
      expect(fn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("tryAcquireBaselineLock", () => {
  const created: string[] = [];

  function lockPath(): string {
    const p = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "mm-baseline-lock-")),
      "baseline.lock",
    );
    created.push(path.dirname(p));
    return p;
  }

  afterEach(() => {
    while (created.length) {
      fs.rmSync(created.pop()!, { recursive: true, force: true });
    }
  });

  it("acquires a free lock", () => {
    const lock = lockPath();

    expect(tryAcquireBaselineLock(lock)).toBe(true);
    expect(fs.existsSync(lock)).toBe(true);
  });

  it("refuses a lock a live builder still holds", () => {
    const lock = lockPath();
    fs.mkdirSync(lock);

    expect(tryAcquireBaselineLock(lock)).toBe(false);
  });

  it("reclaims a lock whose owner died without releasing it", () => {
    // A SIGKILLed builder never runs its `finally`, so the lock outlives it.
    // Without reclamation the cache stays wedged for every later run.
    const lock = lockPath();
    fs.mkdirSync(lock);
    const staleAfterMs = 60_000;
    const now = fs.statSync(lock).mtimeMs + staleAfterMs + 1;

    expect(tryAcquireBaselineLock(lock, now, staleAfterMs)).toBe(true);
    expect(fs.existsSync(lock)).toBe(true);
  });

  it("keeps waiting while the owner is still inside its build budget", () => {
    const lock = lockPath();
    fs.mkdirSync(lock);
    const staleAfterMs = 60_000;
    const now = fs.statSync(lock).mtimeMs + staleAfterMs - 1;

    expect(tryAcquireBaselineLock(lock, now, staleAfterMs)).toBe(false);
  });

  it("treats a lock that vanished mid-check as still contended", () => {
    const lock = lockPath();
    const realStat = fs.statSync;
    const spy = vi.spyOn(fs, "statSync").mockImplementation(((
      target: string,
      ...rest: unknown[]
    ) => {
      if (target === lock) {
        const err = new Error("ENOENT") as NodeJS.ErrnoException;
        err.code = "ENOENT";
        throw err;
      }
      return (realStat as (...a: unknown[]) => unknown)(target, ...rest);
    }) as unknown as typeof fs.statSync);

    try {
      fs.mkdirSync(lock);
      expect(tryAcquireBaselineLock(lock)).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("sweepAbandonedBuilds", () => {
  it("removes only half-built directories for the given cache key", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mm-baseline-sweep-"));
    try {
      const key = "abc123";
      const debris = `${key}.tmp-6203-1786420901498`;
      const otherKeyDebris = "def456.tmp-99-1";
      for (const dir of [key, debris, otherKeyDebris, "def456"]) {
        fs.mkdirSync(path.join(root, dir));
      }

      expect(sweepAbandonedBuilds(root, key)).toEqual([debris]);
      expect(fs.readdirSync(root).sort()).toEqual([
        key,
        "def456",
        otherKeyDebris,
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("tolerates a cache root that does not exist yet", () => {
    expect(sweepAbandonedBuilds("/nonexistent-cache-root", "abc")).toEqual([]);
  });
});

describe("REAL_D1_SETUP_TIMEOUT_MS", () => {
  it("exceeds the helper's own baseline budget so its diagnostic wins", () => {
    // Two 300s stage budgets (wait for another builder, then build) plus
    // headroom. If a test file ever budgets less than this, vitest kills the
    // hook first and the aborted build leaves the cache cold for the next run.
    expect(REAL_D1_SETUP_TIMEOUT_MS).toBeGreaterThan(600_000);
  });
});
