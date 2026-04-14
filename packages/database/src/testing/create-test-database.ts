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
  const mf = new Miniflare({
    modules: true,
    script: "export default {};",
    d1Databases: { DB: ":memory:" },
    kvNamespaces: ["CACHE_KV", "TOKEN_BLACKLIST", "RATE_LIMIT_KV"],
    r2Buckets: ["IMAGES_BUCKET", "BACKUP_STORAGE"],
  });

  let bindings: TestDatabaseBindings;
  try {
    bindings = await mf.getBindings<TestDatabaseBindings>();
    await runMigrations(bindings.DB);
  } catch (err) {
    // Ensure miniflare is released if construction fails mid-way to avoid leaking
    // workerd subprocess handles across the error boundary.
    await mf.dispose();
    throw err;
  }

  const drizzleDb = drizzle(bindings.DB, { schema });

  return {
    db: bindings.DB,
    bindings,
    drizzle: drizzleDb,
    truncateAll: async () => {
      const tables = await listUserTables(bindings.DB);
      for (const t of tables) {
        await bindings.DB.prepare(`DELETE FROM "${t}"`).run();
      }
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
