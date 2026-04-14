import type { D1Database } from "@cloudflare/workers-types";

export async function listUserTables(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`,
    )
    .all<{ name: string }>();
  return (result.results ?? []).map((r) => r.name);
}
