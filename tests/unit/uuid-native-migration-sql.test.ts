import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationFiles = [
  "packages/database/migrations_fresh/0000_loose_skin.sql",
  "packages/database/migrations_fresh/0008_platform-integrations.sql",
  "packages/database/migrations_fresh/0036_restaurant_fk_rebuild_ordering_core_component.sql",
  "packages/database/migrations_fresh/0038_restaurant_fk_rebuild_users_root_apply.sql",
  "packages/database/migrations_fresh/0039_restaurant_fk_rebuild_users_root_finalize.sql",
  "packages/database/migrations/0000_rich_mulholland_black.sql",
  "packages/database/migrations/0001_initial_schema.sql",
];

function readMigration(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("UUID-native migration SQL", () => {
  it.each(migrationFiles)(
    "does not define legacy integer order/user identity columns in %s",
    (migrationPath) => {
      const sql = readMigration(migrationPath);

      expect(sql).not.toMatch(
        /[`"]?(order_id|user_id|created_by|updated_by|employee_id|approved_by|operator_id|processed_by|resolved_by|verified_by_user_id|current_order_id|original_order_id)[`"]?\s+integer\b/i,
      );
    },
  );

  it("creates users and orders as text primary keys in the fresh baseline", () => {
    const sql = readMigration(
      "packages/database/migrations_fresh/0000_loose_skin.sql",
    );

    expect(sql).toMatch(/CREATE TABLE `users`\s*\(\s*`id` TEXT PRIMARY KEY/);
    expect(sql).toMatch(/CREATE TABLE `orders`\s*\(\s*`id` TEXT PRIMARY KEY/);
  });

  it("creates platform orders as a text primary key with a text order foreign key", () => {
    const sql = readMigration(
      "packages/database/migrations_fresh/0008_platform-integrations.sql",
    );

    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS platform_orders\s*\(\s*id TEXT PRIMARY KEY/,
    );
    expect(sql).toMatch(/order_id TEXT NOT NULL REFERENCES orders\(id\)/);
  });
});
