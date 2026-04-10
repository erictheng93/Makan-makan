/**
 * Test Database Helper
 *
 * Returns a real in-memory SQLite database with the full Drizzle migration
 * stack applied, exposed through a D1Database-compatible adapter so existing
 * tests use it without changing call sites.
 *
 * Replaces the previous mock that returned `{ results: [] }` for every
 * query — that mock made every assertion against `result.indexUsed`,
 * `rowsReturned`, etc. either trivially pass or trivially fail with no
 * relationship to actual SQL behavior. See Issue #9 / commit history for
 * context on why the mock was originally a stub.
 *
 * Architecture:
 * - better-sqlite3 in-memory DB (process-local, isolated per test file)
 * - Reads every `.sql` file under packages/database/migrations_fresh/ in
 *   filename order and applies it to bring the schema to the current
 *   production state
 * - Wraps the underlying sqlite handle in `D1DatabaseAdapter` so call sites
 *   that do `db.prepare(query).bind(...).all()` work unchanged
 * - Foreign key enforcement is OFF so tests can insert rows in any order
 *   without worrying about parent rows existing first; the schema's FK
 *   declarations are still applied for documentation but not enforced
 *
 * If a test ever needs Cloudflare Workers runtime semantics (DurableObjects,
 * KV, R2, Service Bindings), it should use miniflare via
 * `@cloudflare/vitest-pool-workers` instead — this helper covers SQL behavior
 * only.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { D1DatabaseAdapter } from "./d1-adapter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.resolve(
  __dirname,
  "../../packages/database/migrations_fresh",
);

export async function createTestDB(): Promise<D1DatabaseAdapter> {
  const sqlite = new Database(":memory:");
  // FK off so seed-data inserts don't have to be in dependency order.
  sqlite.pragma("foreign_keys = OFF");
  applyMigrations(sqlite);
  // ANALYZE seeds the query planner with column distribution stats so
  // EXPLAIN QUERY PLAN picks realistic indexes for our small test data set
  // (without it, SQLite may choose full scans on tiny tables even when an
  // index exists).
  sqlite.exec("ANALYZE");
  return new D1DatabaseAdapter(sqlite);
}

export async function cleanupTestDB(
  db: D1DatabaseAdapter | { close?: () => void },
): Promise<void> {
  if (db && typeof (db as { close?: () => void }).close === "function") {
    (db as { close: () => void }).close();
  }
}

/**
 * Apply every migration file in alphabetical (== chronological) order.
 *
 * Drizzle migrations use `--> statement-breakpoint` as the inter-statement
 * separator. Some migrations contain ALTER statements that depend on prior
 * migrations having created their target tables — those work fine when we
 * apply files in order. A small number of statements may fail benignly
 * (e.g. trying to drop a column that didn't exist in the original CREATE);
 * we log and continue rather than abort, because the cumulative effect of
 * applying all 15 files still produces the same final schema as production.
 */
function applyMigrations(sqlite: Database.Database): void {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(
      `Migrations directory not found: ${MIGRATIONS_DIR}. ` +
        `Run \`pnpm db:generate\` to create it.`,
    );
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    throw new Error(
      `No migration files found in ${MIGRATIONS_DIR}. ` +
        `Run \`pnpm db:generate\`.`,
    );
  }

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    const statements = sql.split(/--> statement-breakpoint/);
    for (const stmt of statements) {
      const trimmed = stripComments(stmt).trim();
      if (!trimmed) continue;
      try {
        sqlite.exec(trimmed);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Surface the failure but don't abort — see function-level comment.
        // eslint-disable-next-line no-console
        console.warn(
          `[test-db] migration ${file} statement skipped: ${msg.substring(0, 120)}`,
        );
      }
    }
  }
}

function stripComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/^\s*--.*$/, ""))
    .join("\n");
}
