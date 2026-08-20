import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The fresh track was squashed into a single baseline, which is a stronger
// target than the five migrations it replaced: those only showed the shape at
// the point each was written, the baseline is the shape that ships.
const FRESH_BASELINE =
  "packages/database/migrations_fresh/0000_baseline_strict.sql";

const migrationFiles = [
  FRESH_BASELINE,
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

  // Quoting and case are not stable across the baseline: SQLite rewrites a
  // table's stored DDL when ALTER TABLE touches it, so `users` becomes
  // "users". Match the structure, not the punctuation.
  const createsTextPk = (table: string) =>
    new RegExp(
      String.raw`CREATE TABLE ["\`]?${table}["\`]?\s*\(\s*["\`]?id["\`]? TEXT PRIMARY KEY`,
      "i",
    );

  it("creates users and orders as text primary keys in the fresh baseline", () => {
    const sql = readMigration(FRESH_BASELINE);

    expect(sql).toMatch(createsTextPk("users"));
    expect(sql).toMatch(createsTextPk("orders"));
  });

  it("creates platform orders as a text primary key with a text order foreign key", () => {
    const sql = readMigration(FRESH_BASELINE);

    expect(sql).toMatch(createsTextPk("platform_orders"));
    expect(sql).toMatch(/order_id TEXT NOT NULL REFERENCES orders\(id\)/);
  });
});
