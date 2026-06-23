import { getTableConfig } from "drizzle-orm/sqlite-core";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
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

describe("users UUID-native primary key", () => {
  it("uses users.id as the UUID text primary key without a public_id bridge", () => {
    const config = getTableConfig(users);
    const idColumn = config.columns.find((column) => column.name === "id");
    const columnNames = config.columns.map((column) => column.name);
    const indexNames = config.indexes.map((index) => index.config.name);

    expect(idColumn?.columnType).toBe("SQLiteText");
    expect(columnNames).not.toContain("public_id");
    expect(indexNames).not.toContain("users_public_id_unique");
  });

  it("does not keep users bridge migrations in either migration track", () => {
    for (const migrationPath of [
      ...bridgeMigrations,
      ...auditGuardMigrations,
    ]) {
      expect(existsSync(resolve(process.cwd(), migrationPath))).toBe(false);
    }

    const config = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "packages/database/migration-dual-track.json"),
        "utf8",
      ),
    ) as {
      reviewedThrough: { fresh: string; legacy: string };
      pairs: Array<{ fresh: string; legacy: string; reason: string }>;
    };

    expect(config.reviewedThrough).not.toEqual({
      fresh: "0075_users_public_id_audit_guard.sql",
      legacy: "0092_users_public_id_audit_guard.sql",
    });
    expect(config.pairs).not.toContainEqual(
      expect.objectContaining({ fresh: "0074_users_public_id_bridge.sql" }),
    );
    expect(config.pairs).not.toContainEqual(
      expect.objectContaining({
        fresh: "0075_users_public_id_audit_guard.sql",
      }),
    );
  });
});
