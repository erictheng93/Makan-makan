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

export function isTestDatabaseReuseEnabled(env: {
  MAKANMAKAN_REAL_D1_REUSE_DB?: string;
}): boolean {
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
      const bindings = await mf.getBindings<TestDatabaseBindings>();
      if (!input.migrated) {
        await runMigrations(bindings.DB);
      }
      return buildTestDatabase(mf, bindings, input);
    } catch (err) {
      await mf.dispose();
      lastErr = err;
      const msg = (err as Error).message ?? "";
      const isTransient = msg.includes("fetch failed");
      if (!isTransient) throw err;
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
    },
    dispose: async () => {
      await mf.dispose();
      if (options.cleanupPath) {
        fs.rmSync(options.cleanupPath, { recursive: true, force: true });
      }
    },
  };
}

async function ensureMigratedBaseline(): Promise<string> {
  const cacheRoot = path.join(os.tmpdir(), "makanmakan-real-d1-cache");
  fs.mkdirSync(cacheRoot, { recursive: true });

  const cacheKey = migrationsHash();
  const baselinePath = path.join(cacheRoot, cacheKey);
  const readyFile = path.join(baselinePath, ".ready");
  if (fs.existsSync(readyFile)) return baselinePath;

  const lockPath = `${baselinePath}.lock`;
  try {
    fs.mkdirSync(lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    await waitForBaseline(readyFile);
    return baselinePath;
  }

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
    fs.writeFileSync(readyFileFor(tmpPath), new Date().toISOString());
    fs.renameSync(tmpPath, baselinePath);
  } finally {
    fs.rmSync(lockPath, { recursive: true, force: true });
    fs.rmSync(tmpPath, { recursive: true, force: true });
  }

  return baselinePath;
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

async function waitForBaseline(readyFile: string): Promise<void> {
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    if (fs.existsSync(readyFile)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for real-D1 migrated baseline");
}
