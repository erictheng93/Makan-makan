import { getTableConfig } from "drizzle-orm/sqlite-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

type Table = Parameters<typeof getTableConfig>[0];

function columnSqlType(table: Table, columnName: string): string | undefined {
  return getTableConfig(table)
    .columns.find((column) => column.name === columnName)
    ?.getSQLType();
}

function migration(name: string): string {
  return readFileSync(
    resolve(process.cwd(), "packages/database/migrations_fresh", name),
    "utf8",
  );
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
});
