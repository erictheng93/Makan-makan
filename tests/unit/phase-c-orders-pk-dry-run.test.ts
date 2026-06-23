import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  ORDER_DEPENDENCIES,
  buildDryRunSql,
  parseArgs,
}: {
  ORDER_DEPENDENCIES: Array<{
    table: string;
    column: string;
    kind: string;
  }>;
  buildDryRunSql: () => string;
  parseArgs: (argv: string[]) => {
    executeLocal: boolean;
    printSql: boolean;
    database: string;
    config: string;
    persistTo: string;
    jsonOutput: string | null;
    withFixture: boolean;
  };
} = require("../../scripts/phase-c-orders-pk-dry-run.cjs");

describe("Phase C orders PK dry-run script", () => {
  it("tracks the expected order FK and pointer surfaces", () => {
    expect(
      ORDER_DEPENDENCIES.map((dependency) => [
        dependency.table,
        dependency.column,
      ]),
    ).toEqual([
      ["order_items", "order_id"],
      ["payment_transactions", "order_id"],
      ["refund_transactions", "order_id"],
      ["receipts", "order_id"],
      ["refunds", "original_order_id"],
      ["platform_orders", "order_id"],
      ["partnership_usage_logs", "order_id"],
      ["coupon_usage", "order_id"],
      ["market_checkout_child_orders", "order_id"],
      ["group_orders", "master_order_id"],
      ["tables", "current_order_id"],
      ["seats", "current_order_id"],
      ["order_status_history", "order_id"],
      ["customer_reviews", "order_id"],
    ]);
  });

  it("generates a rollback-only rehearsal with temp shadow tables", () => {
    const sql = buildDryRunSql();
    const normalized = sql.toUpperCase();

    expect(sql).toContain("CREATE TEMP TABLE __phase_c_order_dependencies");
    expect(sql).toContain(
      'CREATE TEMP TABLE "__phase_c_shadow_order_items_order_id"',
    );
    expect(sql).toContain("pragma_foreign_key_check");
    expect(normalized).toContain("BEGIN;");
    expect(normalized).toContain("ROLLBACK;");
    expect(normalized).not.toMatch(/\bALTER\s+TABLE\b/);
    expect(normalized).not.toMatch(/\bDROP\s+TABLE\b/);
    expect(normalized).not.toMatch(/\bUPDATE\s+(?!__PHASE_C_)/);
    expect(normalized).not.toMatch(/\bDELETE\s+FROM\b/);
  });

  it("parses local execution options", () => {
    expect(
      parseArgs([
        "--execute-local",
        "--database",
        "local-db",
        "--config",
        "./worker.toml",
        "--persist-to",
        "./state",
        "--with-fixture",
        "--json-output",
        "./artifacts/orders-pk.json",
      ]),
    ).toMatchObject({
      executeLocal: true,
      database: "local-db",
      config: "./worker.toml",
      persistTo: "./state",
      withFixture: true,
      jsonOutput: "./artifacts/orders-pk.json",
    });
  });
});
