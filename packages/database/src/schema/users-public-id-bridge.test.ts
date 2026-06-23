import { getTableConfig } from "drizzle-orm/sqlite-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { users } from "./users";

const bridgeMigrations = [
  "packages/database/migrations_fresh/0074_users_public_id_bridge.sql",
  "packages/database/migrations/0091_users_public_id_bridge.sql",
];
const auditGuardMigrations = [
  "packages/database/migrations_fresh/0075_users_public_id_audit_guard.sql",
  "packages/database/migrations/0092_users_public_id_audit_guard.sql",
];

describe("users public id bridge", () => {
  it("adds a transitional public_id column to the users schema", () => {
    const config = getTableConfig(users);
    const columnNames = config.columns.map((column) => column.name);
    const indexNames = config.indexes.map((index) => index.config.name);

    expect(columnNames).toContain("public_id");
    expect(indexNames).toContain("users_public_id_unique");
  });

  it.each(bridgeMigrations)(
    "backfills and indexes user public ids in %s",
    (migrationPath) => {
      const sql = readFileSync(resolve(process.cwd(), migrationPath), "utf8");

      expect(sql).toContain("ALTER TABLE `users` ADD COLUMN `public_id` text");
      expect(sql).toContain("UPDATE `users`");
      expect(sql).toContain("WHERE `public_id` IS NULL");
      expect(sql).toContain(
        "CREATE UNIQUE INDEX IF NOT EXISTS `users_public_id_unique`",
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
      pairs: Array<{ fresh: string; legacy: string; reason: string }>;
    };

    expect(config.reviewedThrough).toEqual({
      fresh: "0075_users_public_id_audit_guard.sql",
      legacy: "0092_users_public_id_audit_guard.sql",
    });
    expect(config.pairs).toContainEqual({
      fresh: "0074_users_public_id_bridge.sql",
      legacy: "0091_users_public_id_bridge.sql",
      reason:
        "Users gain a UUID v7 public_id bridge before staff JWT principal or dependent FK rebuild work.",
    });
    expect(config.pairs).toContainEqual({
      fresh: "0075_users_public_id_audit_guard.sql",
      legacy: "0092_users_public_id_audit_guard.sql",
      reason:
        "Users public_id audit guard blocks auth principal and PK rebuild work when bridge ids are missing, duplicated, or malformed.",
    });
  });

  it.each(auditGuardMigrations)(
    "audits user public id bridge integrity in %s",
    (migrationPath) => {
      const sql = readFileSync(resolve(process.cwd(), migrationPath), "utf8");

      expect(sql).toContain("'users_public_id_bridge'");
      expect(sql).toContain("'public_id_missing'");
      expect(sql).toContain("'public_id_duplicate'");
      expect(sql).toContain("'public_id_invalid_format'");
      expect(sql).toContain("`public_id` IS NULL");
      expect(sql).toContain("GROUP BY `public_id`");
      expect(sql).toContain(
        "CREATE TABLE `_migration_assert_users_public_id_audit_guard`",
      );
      expect(sql).toContain("CHECK (`violation_count` = 0)");
    },
  );
});
