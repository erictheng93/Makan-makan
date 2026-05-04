import { Miniflare } from "miniflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import type {
  D1Database,
  KVNamespace,
  R2Bucket,
} from "@cloudflare/workers-types";
import * as schema from "../schema";
import { runMigrations, listUserTables } from "./run-migrations";

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

export async function createTestDatabase(): Promise<TestDatabase> {
  // Miniflare's workerd IPC occasionally surfaces a `fetch failed` during
  // migration at ~5% rate (observed in 20× flake runs on macOS). The failure
  // poisons the miniflare instance, so retrying the same instance is useless
  // — we must dispose and spin up a fresh one. Retry up to 2 extra times.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const mf = new Miniflare({
      modules: true,
      script: "export default {};",
      d1Databases: { DB: ":memory:" },
      kvNamespaces: ["CACHE_KV", "TOKEN_BLACKLIST", "RATE_LIMIT_KV"],
      r2Buckets: ["IMAGES_BUCKET", "BACKUP_STORAGE"],
    });
    try {
      const bindings = await mf.getBindings<TestDatabaseBindings>();
      await runMigrations(bindings.DB);
      return buildTestDatabase(mf, bindings);
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
    },
  };
}
