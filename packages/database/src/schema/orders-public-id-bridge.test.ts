import { getTableConfig } from "drizzle-orm/sqlite-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { orders } from "./orders";

const bridgeMigrations = [
  "packages/database/migrations_fresh/0072_orders_public_id_bridge.sql",
  "packages/database/migrations/0089_orders_public_id_bridge.sql",
];
const auditGuardMigrations = [
  "packages/database/migrations_fresh/0073_orders_public_id_audit_guard.sql",
  "packages/database/migrations/0090_orders_public_id_audit_guard.sql",
];

describe("orders public id bridge", () => {
  it("adds a transitional public_id column to the orders schema", () => {
    const config = getTableConfig(orders);
    const columnNames = config.columns.map((column) => column.name);
    const indexNames = config.indexes.map((index) => index.config.name);

    expect(columnNames).toContain("public_id");
    expect(indexNames).toContain("orders_public_id_unique");
  });

  it.each(bridgeMigrations)(
    "backfills and indexes order public ids in %s",
    (migrationPath) => {
      const sql = readFileSync(resolve(process.cwd(), migrationPath), "utf8");

      expect(sql).toContain("ALTER TABLE `orders` ADD COLUMN `public_id` text");
      expect(sql).toContain("UPDATE `orders`");
      expect(sql).toContain("WHERE `public_id` IS NULL");
      expect(sql).toContain(
        "CREATE UNIQUE INDEX IF NOT EXISTS `orders_public_id_unique`",
      );
      expect(sql).toContain("public_id_backfill_missing");
      expect(sql).toContain("public_id_backfill_duplicates");
    },
  );

  it("tracks the bridge migration in the dual-track registry", () => {
    const config = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "packages/database/migration-dual-track.json"),
        "utf8",
      ),
    ) as {
      reviewedThrough: { fresh: string; legacy: string };
      pairs: Array<{ fresh: string; legacy: string }>;
    };

    expect(config.reviewedThrough).toEqual({
      fresh: "0073_orders_public_id_audit_guard.sql",
      legacy: "0090_orders_public_id_audit_guard.sql",
    });
    expect(config.pairs).toContainEqual({
      fresh: "0072_orders_public_id_bridge.sql",
      legacy: "0089_orders_public_id_bridge.sql",
      reason:
        "Orders gain a UUID v7 public_id bridge before any integer primary-key or dependent FK rebuild.",
    });
    expect(config.pairs).toContainEqual({
      fresh: "0073_orders_public_id_audit_guard.sql",
      legacy: "0090_orders_public_id_audit_guard.sql",
      reason:
        "Orders public_id audit guard blocks later not-null or PK rebuild work when bridge ids are missing, duplicated, or malformed.",
    });
  });

  it.each(auditGuardMigrations)(
    "audits order public id bridge integrity in %s",
    (migrationPath) => {
      const sql = readFileSync(resolve(process.cwd(), migrationPath), "utf8");

      expect(sql).toContain("'orders_public_id_bridge'");
      expect(sql).toContain("'public_id_missing'");
      expect(sql).toContain("'public_id_duplicate'");
      expect(sql).toContain("'public_id_invalid_format'");
      expect(sql).toContain("`public_id` IS NULL");
      expect(sql).toContain("GROUP BY `public_id`");
      expect(sql).toContain(
        "CREATE TABLE `_migration_assert_orders_public_id_audit_guard`",
      );
      expect(sql).toContain("CHECK (`violation_count` = 0)");
    },
  );
});
