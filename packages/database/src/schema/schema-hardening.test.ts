import { getTableConfig } from "drizzle-orm/sqlite-core";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  backupAlerts,
  backupAuditLogs,
  backupConfigurations,
  backupRecords,
  backupSchedules,
  marketCheckoutPayments,
  paymentTransactions,
  restoreOperations,
} from "./index";

// Migration fixtures are addressed repo-root-relative. Anchor on this
// file's own location rather than process.cwd() so the suite passes whether
// vitest runs from the workspace root or from packages/database, which is
// what `turbo run test` does.
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

type Table = Parameters<typeof getTableConfig>[0];

function columnSqlType(table: Table, columnName: string): string | undefined {
  return getTableConfig(table)
    .columns.find((column) => column.name === columnName)
    ?.getSQLType();
}

function migration(name: string): string {
  return readFileSync(
    resolve(REPO_ROOT, "packages/database/migrations_fresh", name),
    "utf8",
  );
}

function migrationPath(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), "utf8");
}

describe("schema hardening", () => {
  it("keeps nullable payment idempotency keys unique when present", () => {
    const paymentIndexes = getTableConfig(paymentTransactions).indexes;
    const marketIndexes = getTableConfig(marketCheckoutPayments).indexes;

    expect(
      paymentIndexes.some(
        (index) =>
          index.config.name === "payment_transactions_idempotency_unique_idx",
      ),
    ).toBe(true);
    expect(
      marketIndexes.some(
        (index) =>
          index.config.name ===
          "market_checkout_payments_idempotency_unique_idx",
      ),
    ).toBe(true);

    expect(
      migration(
        "0072_schema_hardening_payment_idempotency_backup_timestamps.sql",
      ),
    ).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_idempotency_unique_idx",
    );
    expect(
      migration(
        "0072_schema_hardening_payment_idempotency_backup_timestamps.sql",
      ),
    ).toContain("WHERE idempotency_key IS NOT NULL");
  });

  it("stores backup timestamps as integer millisecond timestamps", () => {
    const integerTimestampColumns: Array<[Table, string]> = [
      [backupRecords, "started_at_ms"],
      [backupRecords, "completed_at_ms"],
      [backupRecords, "updated_at_ms"],
      [backupSchedules, "last_run_at_ms"],
      [backupSchedules, "next_run_at_ms"],
      [backupSchedules, "created_at_ms"],
      [backupSchedules, "updated_at_ms"],
      [backupConfigurations, "created_at_ms"],
      [backupConfigurations, "updated_at_ms"],
      [backupAlerts, "triggered_at_ms"],
      [backupAlerts, "resolved_at_ms"],
      [backupAuditLogs, "timestamp_ms"],
      [restoreOperations, "started_at_ms"],
      [restoreOperations, "completed_at_ms"],
    ];

    for (const [table, column] of integerTimestampColumns) {
      expect(columnSqlType(table, column)).toBe("integer");
    }
  });

  it("converts ISO backup timestamps through the datetime branch", () => {
    const migrationSql = [
      migrationPath(
        "packages/database/migrations_fresh/0072_schema_hardening_payment_idempotency_backup_timestamps.sql",
      ),
      migrationPath(
        "packages/database/migrations/0089_schema_hardening_payment_idempotency_backup_timestamps.sql",
      ),
    ];
    const db = new Database(":memory:");
    const timestamp = "2026-06-07T03:04:05.000Z";

    for (const sql of migrationSql) {
      expect(sql).toContain("NOT GLOB '*[^0-9]*' THEN CAST");
      expect(sql).not.toContain("GLOB '[0-9]*' THEN CAST");
    }

    const converted = db
      .prepare(
        `
        SELECT CASE
          WHEN @timestamp IS NULL THEN NULL
          WHEN typeof(@timestamp) = 'integer' THEN @timestamp
          WHEN @timestamp NOT GLOB '*[^0-9]*' THEN CAST(@timestamp AS INTEGER)
          ELSE CAST(strftime('%s', @timestamp) AS INTEGER) * 1000
        END AS value
        `,
      )
      .get({ timestamp }) as { value: number };

    expect(converted.value).toBe(new Date(timestamp).getTime());
  });

  it("converts empty legacy backup timestamp strings to null", () => {
    const migrationSql = [
      migrationPath(
        "packages/database/migrations_fresh/0072_schema_hardening_payment_idempotency_backup_timestamps.sql",
      ),
      migrationPath(
        "packages/database/migrations/0089_schema_hardening_payment_idempotency_backup_timestamps.sql",
      ),
    ];
    const db = new Database(":memory:");

    for (const sql of migrationSql) {
      expect(sql).toContain("= '' THEN NULL");
    }

    const converted = db
      .prepare(
        `
        SELECT CASE
          WHEN @timestamp IS NULL OR @timestamp = '' THEN NULL
          WHEN typeof(@timestamp) = 'integer' THEN @timestamp
          WHEN @timestamp NOT GLOB '*[^0-9]*' THEN CAST(@timestamp AS INTEGER)
          ELSE CAST(strftime('%s', @timestamp) AS INTEGER) * 1000
        END AS value
        `,
      )
      .get({ timestamp: "" }) as { value: null };

    expect(converted.value).toBeNull();
  });
});
