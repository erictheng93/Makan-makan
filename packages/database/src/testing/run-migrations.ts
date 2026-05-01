import fs from "node:fs";
import path from "node:path";
import type { D1Database } from "@cloudflare/workers-types";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations_fresh");

export async function runMigrations(db: D1Database): Promise<void> {
  const label = `[runMigrations:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}]`;
  console.time(label);
  try {
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      const statements = sql
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);

      for (const [index, statement] of statements.entries()) {
        try {
          await db.prepare(statement).run();
        } catch (err) {
          throw new Error(
            `[runMigrations] failed in ${file} statement ${index + 1}/${
              statements.length
            }: ${(err as Error).message}`,
          );
        }
      }
    }
  } finally {
    console.timeEnd(label);
  }
}

export async function listUserTables(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`,
    )
    .all<{ name: string }>();
  return (result.results ?? []).map((r) => r.name);
}
