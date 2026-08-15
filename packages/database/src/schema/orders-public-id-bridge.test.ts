import { getTableConfig } from "drizzle-orm/sqlite-core";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { orders } from "./orders";
import { platformOrders } from "./platform-orders";

// Migration fixtures are addressed repo-root-relative. Anchor on this
// file's own location rather than process.cwd() so the suite passes whether
// vitest runs from the workspace root or from packages/database, which is
// what `turbo run test` does.
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

const bridgeMigrations = [
  "packages/database/migrations_fresh/0072_orders_public_id_bridge.sql",
  "packages/database/migrations/0089_orders_public_id_bridge.sql",
];
const auditGuardMigrations = [
  "packages/database/migrations_fresh/0073_orders_public_id_audit_guard.sql",
  "packages/database/migrations/0090_orders_public_id_audit_guard.sql",
];

describe("orders UUID-native primary key", () => {
  it("uses orders.id as the UUID text primary key without a public_id bridge", () => {
    const config = getTableConfig(orders);
    const idColumn = config.columns.find((column) => column.name === "id");
    const columnNames = config.columns.map((column) => column.name);
    const indexNames = config.indexes.map((index) => index.config.name);

    expect(idColumn?.columnType).toBe("SQLiteText");
    expect(columnNames).not.toContain("public_id");
    expect(indexNames).not.toContain("orders_public_id_unique");
  });

  it("uses UUID text foreign keys for platform order references", () => {
    const config = getTableConfig(platformOrders);
    const idColumn = config.columns.find((column) => column.name === "id");
    const orderIdColumn = config.columns.find(
      (column) => column.name === "order_id",
    );

    expect(idColumn?.columnType).toBe("SQLiteText");
    expect(orderIdColumn?.columnType).toBe("SQLiteText");
  });

  it("does not keep orders bridge migrations in either migration track", () => {
    for (const migrationPath of [
      ...bridgeMigrations,
      ...auditGuardMigrations,
    ]) {
      expect(existsSync(resolve(REPO_ROOT, migrationPath))).toBe(false);
    }

    const config = JSON.parse(
      readFileSync(
        resolve(REPO_ROOT, "packages/database/migration-dual-track.json"),
        "utf8",
      ),
    ) as {
      pairs: Array<{ fresh: string; legacy: string }>;
    };

    expect(config.pairs).not.toContainEqual(
      expect.objectContaining({ fresh: "0072_orders_public_id_bridge.sql" }),
    );
    expect(config.pairs).not.toContainEqual(
      expect.objectContaining({
        fresh: "0073_orders_public_id_audit_guard.sql",
      }),
    );
  });
});
