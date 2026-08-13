import { Miniflare } from "miniflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  D1Database,
  KVNamespace,
  R2Bucket,
} from "@cloudflare/workers-types";
import * as schema from "../schema";
import {
  MIGRATIONS_DIR,
  runMigrations,
  listUserTables,
} from "./run-migrations";

export interface TestDatabaseBindings {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  TOKEN_BLACKLIST: KVNamespace;
  RATE_LIMIT_KV: KVNamespace;
  IMAGES_BUCKET: R2Bucket;
  BACKUP_STORAGE: R2Bucket;
}

export interface TestDatabase {
  db: D1Database;
  bindings: TestDatabaseBindings;
  drizzle: DrizzleD1Database<typeof schema>;
  truncateAll(): Promise<void>;
  dispose(): Promise<void>;
}

const REAL_D1_TEST_DATABASE_ID = "makanmakan-real-d1-test";
// Sized for a cold baseline build on the slowest platform we run on, not for a
// warm one. runMigrations replays 3402 statements from 80 files one at a time,
// and each is a separate workerd IPC round-trip, which costs far more on Windows
// than on Linux: ~170s there against comfortably under 60s in CI.
//
// The old 60s budget made that unbuildable, and not merely slow -- the abort
// fed the transient-error retry above, so a cold cache spent three doomed
// attempts and still never wrote a baseline, which left every later suite
// paying the same cost and failing the same way. The baseline is cached by
// migrations hash, so this ceiling is only ever reached once per migration
// change; ordinary runs copy it and never come near this.
const TEST_DATABASE_STAGE_TIMEOUT_MS = 300_000;
const TEST_DATABASE_DISPOSE_TIMEOUT_MS = 15_000;

// Capture real time primitives at module load so Vitest fake timers cannot
// freeze D1 diagnostic deadlines, baseline lock expiry, or retry backoff.
const realDateNow = Date.now.bind(Date);
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;

/**
 * Overall budget for obtaining a baseline: however long we spend waiting for
 * another process's build, plus our own build if that one dies. Two stage
 * budgets covers exactly that worst case.
 */
const BASELINE_TOTAL_TIMEOUT_MS = TEST_DATABASE_STAGE_TIMEOUT_MS * 2;

/**
 * How long a lock directory may sit untouched before we treat its owner as
 * dead and reclaim it. A process killed with SIGKILL never runs its `finally`,
 * so without this a single hard kill wedges the cache permanently.
 *
 * Must exceed the longest legitimate build, or we would reclaim a lock from a
 * process that is still working and end up with two builders.
 */
const BASELINE_LOCK_STALE_MS = TEST_DATABASE_STAGE_TIMEOUT_MS + 60_000;

const BASELINE_POLL_INTERVAL_MS = 250;

/**
 * Budget a `beforeAll` should give `createTestDatabase()`.
 *
 * This MUST stay larger than the harness's own internal budgets. When a test
 * file's hook timeout is the tighter of the two, vitest kills the hook first
 * and all you get is a generic "Hook timed out in Ns" — the harness's specific
 * diagnostic ("Timed out running real-D1 migrations after 300s", "…waiting for
 * real-D1 migrated baseline") never surfaces, and the in-flight baseline build
 * is aborted without writing `.ready`, so the next run starts cold again.
 *
 * Real tests should import this rather than hard-coding a number, so the two
 * budgets cannot drift apart again.
 */
export const REAL_D1_SETUP_TIMEOUT_MS = BASELINE_TOTAL_TIMEOUT_MS + 60_000;

export async function createTestDatabase(): Promise<TestDatabase> {
  if (shouldReuseTestDatabase()) {
    const baselinePath = await ensureMigratedBaseline();
    const workPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "makanmakan-real-d1-"),
    );
    fs.cpSync(baselinePath, workPath, { recursive: true });
    return createFreshTestDatabase({
      databaseId: REAL_D1_TEST_DATABASE_ID,
      migrated: true,
      persistPath: workPath,
      cleanupPath: workPath,
    });
  }

  return createFreshTestDatabase({
    databaseId: ":memory:",
    migrated: false,
  });
}

function shouldReuseTestDatabase(): boolean {
  return isTestDatabaseReuseEnabled(process.env);
}

export function isTestDatabaseReuseEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.MAKANMAKAN_REAL_D1_REUSE_DB !== "0";
}

async function createFreshTestDatabase(input: {
  databaseId: string;
  migrated: boolean;
  persistPath?: string;
  cleanupPath?: string;
}): Promise<TestDatabase> {
  // Miniflare's workerd IPC occasionally surfaces a `fetch failed` during
  // migration at ~5% rate (observed in 20× flake runs on macOS). The failure
  // poisons the miniflare instance, so retrying the same instance is useless
  // — we must dispose and spin up a fresh one. Retry up to 2 extra times.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const mf = new Miniflare({
      modules: true,
      script: "export default {};",
      d1Databases: { DB: input.databaseId },
      d1Persist: input.persistPath,
      kvNamespaces: ["CACHE_KV", "TOKEN_BLACKLIST", "RATE_LIMIT_KV"],
      r2Buckets: ["IMAGES_BUCKET", "BACKUP_STORAGE"],
    });
    try {
      const bindings = await withDiagnosticTimeout(
        mf.getBindings<TestDatabaseBindings>(),
        TEST_DATABASE_STAGE_TIMEOUT_MS,
        "starting Miniflare D1",
      );
      if (!input.migrated) {
        await withDiagnosticTimeout(
          runMigrations(bindings.DB),
          TEST_DATABASE_STAGE_TIMEOUT_MS,
          "running real-D1 migrations",
        );
      }
      return buildTestDatabase(mf, bindings, input);
    } catch (err) {
      try {
        await withDiagnosticTimeout(
          mf.dispose(),
          TEST_DATABASE_DISPOSE_TIMEOUT_MS,
          "disposing Miniflare D1",
        );
      } catch (disposeError) {
        console.warn(
          "[createTestDatabase] failed to dispose Miniflare after setup error:",
          disposeError,
        );
      }
      lastErr = err;
      if (!isTransientD1Error(err)) throw err;
      console.warn(
        `[createTestDatabase] transient miniflare fetch failed (attempt ${attempt + 1}/3), retrying...`,
      );
    }
  }
  throw lastErr;
}

function buildTestDatabase(
  mf: Miniflare,
  bindings: TestDatabaseBindings,
  options: { cleanupPath?: string },
): TestDatabase {
  const drizzleDb = drizzle(bindings.DB, { schema });

  return {
    db: bindings.DB,
    bindings,
    drizzle: drizzleDb,
    truncateAll: async () => {
      await retryTransientD1Error("truncateAll", async () => {
        const tables = await listUserTables(bindings.DB);
        // D1 ignores `PRAGMA foreign_keys = OFF` from user statements, so we
        // can't naively DELETE FROM each table in arbitrary order — sibling
        // FKs (e.g. menu_items → categories) trip SQLITE_CONSTRAINT.
        //
        // Workaround: run all DELETEs as a D1 batch. D1 batches execute inside
        // a single transaction, and with `PRAGMA defer_foreign_keys = ON`
        // injected first, FK checking is postponed to commit time — by which
        // point every referenced row is gone too.
        const stmts = [
          bindings.DB.prepare(`PRAGMA defer_foreign_keys = ON`),
          ...tables.map((t) => bindings.DB.prepare(`DELETE FROM "${t}"`)),
        ];
        await bindings.DB.batch(stmts);
        // sqlite_sequence only exists after first AUTOINCREMENT insert
        try {
          await bindings.DB.prepare(`DELETE FROM sqlite_sequence`).run();
        } catch {
          // sqlite_sequence table doesn't exist yet — no sequences to reset
        }
      });
    },
    dispose: async () => {
      await withDiagnosticTimeout(
        mf.dispose(),
        TEST_DATABASE_DISPOSE_TIMEOUT_MS,
        "disposing Miniflare D1",
      );
      if (options.cleanupPath) {
        fs.rmSync(options.cleanupPath, { recursive: true, force: true });
      }
    },
  };
}

export async function withDiagnosticTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  let timeout: ReturnType<typeof realSetTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = realSetTimeout(() => {
      reject(
        new Error(
          `Timed out ${operationName} after ${Math.ceil(timeoutMs / 1000)}s`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeout) realClearTimeout(timeout);
  }
}

export async function retryTransientD1Error<T>(
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientD1Error(err) || attempt === 2) throw err;
      console.warn(
        `[createTestDatabase] transient miniflare ${operation} failed (attempt ${
          attempt + 1
        }/3), retrying...`,
      );
      await new Promise((resolve) =>
        realSetTimeout(resolve, 100 * (attempt + 1)),
      );
    }
  }
  throw lastErr;
}

function isTransientD1Error(err: unknown): boolean {
  const error = err as { message?: string; cause?: { code?: string } };
  return (
    error.message?.includes("fetch failed") === true ||
    error.cause?.code === "ECONNRESET"
  );
}

/**
 * Obtain a migrated baseline directory, building it if no other process
 * already has.
 *
 * The contention model matters here. Waiting purely on `.ready` — which is
 * what this used to do — cannot recover when the process holding the lock
 * dies before writing it: the lock disappears, but every waiter is still
 * watching for a file that nobody is going to create, so they all spin until
 * their deadline and fail. One aborted build then poisons the entire run, and
 * because the cache is keyed by migrations hash, every later run repeats it.
 *
 * So each iteration re-checks BOTH conditions: the baseline may have appeared,
 * or the lock may have been freed and be ours to take.
 */
async function ensureMigratedBaseline(): Promise<string> {
  const cacheRoot = path.join(os.tmpdir(), "makanmakan-real-d1-cache");
  fs.mkdirSync(cacheRoot, { recursive: true });

  const cacheKey = migrationsHash();
  const baselinePath = path.join(cacheRoot, cacheKey);
  const readyFile = readyFileFor(baselinePath);
  const lockPath = `${baselinePath}.lock`;
  const deadline = realDateNow() + BASELINE_TOTAL_TIMEOUT_MS;

  for (;;) {
    if (fs.existsSync(readyFile)) return baselinePath;

    if (tryAcquireBaselineLock(lockPath)) {
      try {
        // We hold the lock, so no other process is mid-build for this key:
        // any `.tmp-*` sibling is debris from a build that was killed before
        // its cleanup ran. Each is a full D1 baseline, so leaving them around
        // quietly eats disk.
        sweepAbandonedBuilds(cacheRoot, cacheKey);
        await buildBaseline(baselinePath);
      } finally {
        fs.rmSync(lockPath, { recursive: true, force: true });
      }
      return baselinePath;
    }

    if (realDateNow() >= deadline) {
      throw new Error(
        `Timed out waiting for real-D1 migrated baseline after ${Math.ceil(
          BASELINE_TOTAL_TIMEOUT_MS / 1000,
        )}s (cache key ${cacheKey})`,
      );
    }

    await new Promise((resolve) =>
      realSetTimeout(resolve, BASELINE_POLL_INTERVAL_MS),
    );
  }
}

/**
 * Claim the build lock, reclaiming it first if its owner looks dead.
 * Returns false when another live process holds it.
 */
export function tryAcquireBaselineLock(
  lockPath: string,
  now: number = realDateNow(),
  staleAfterMs: number = BASELINE_LOCK_STALE_MS,
): boolean {
  try {
    fs.mkdirSync(lockPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }

  let age: number;
  try {
    age = now - fs.statSync(lockPath).mtimeMs;
  } catch {
    // Vanished between mkdir and stat — the owner just released it. Let the
    // caller loop round and try again rather than racing it here.
    return false;
  }

  if (age < staleAfterMs) return false;

  // Owner exceeded any plausible build time (or was SIGKILLed, so its `finally`
  // never ran). Drop the lock and try once more; if a third process wins the
  // race we simply wait for it.
  fs.rmSync(lockPath, { recursive: true, force: true });
  try {
    fs.mkdirSync(lockPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    return false;
  }
}

/**
 * Delete half-built baseline directories left behind for `cacheKey`.
 * Only safe to call while holding that key's lock.
 */
export function sweepAbandonedBuilds(
  cacheRoot: string,
  cacheKey: string,
): string[] {
  const prefix = `${cacheKey}.tmp-`;
  const removed: string[] = [];
  let entries: string[];
  try {
    entries = fs.readdirSync(cacheRoot);
  } catch {
    return removed;
  }

  for (const entry of entries) {
    if (!entry.startsWith(prefix)) continue;
    fs.rmSync(path.join(cacheRoot, entry), { recursive: true, force: true });
    removed.push(entry);
  }
  return removed;
}

async function buildBaseline(baselinePath: string): Promise<void> {
  const tmpPath = `${baselinePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.rmSync(tmpPath, { recursive: true, force: true });
    fs.rmSync(baselinePath, { recursive: true, force: true });
    const testDb = await createFreshTestDatabase({
      databaseId: REAL_D1_TEST_DATABASE_ID,
      migrated: false,
      persistPath: tmpPath,
    });
    await testDb.dispose();
    // `.ready` is written into the temp directory and only then renamed into
    // place, so the baseline becomes visible atomically — a reader can never
    // observe a half-migrated directory.
    fs.writeFileSync(readyFileFor(tmpPath), new Date().toISOString());
    fs.renameSync(tmpPath, baselinePath);
  } finally {
    fs.rmSync(tmpPath, { recursive: true, force: true });
  }
}

function migrationsHash(): string {
  const hash = crypto.createHash("sha256");
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(fs.readFileSync(path.join(MIGRATIONS_DIR, file)));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}

function readyFileFor(dir: string): string {
  return path.join(dir, ".ready");
}
