import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  ARTIFACT_SCHEMA_VERSION,
  ORDER_DEPENDENCIES,
  assessRehearsalResult,
  buildDryRunSql,
  parseArgs,
  usage,
}: {
  ARTIFACT_SCHEMA_VERSION: number;
  ORDER_DEPENDENCIES: Array<{
    table: string;
    column: string;
    kind: string;
  }>;
  assessRehearsalResult: (
    result: {
      ordersBridge: {
        order_rows: number;
        missing_public_id: number;
        duplicate_public_id: number;
      } | null;
      dependencies: Array<{
        table: string;
        column: string;
        non_null_order_refs: number;
        mapped_order_refs: number;
        unmapped_order_refs: number;
        schemaObjects?: unknown[];
      }>;
      appCompatibility?: {
        legacy_lookup_rows: number;
        public_lookup_rows: number;
        lookup_mismatches: number;
        shadow_public_id_rows: number;
        shadow_public_id_missing: number;
        shadow_public_id_mismatches: number;
      };
      foreignKeyCheck: unknown[];
    },
    options?: {
      requireRepresentativeData?: boolean;
      requireCompleteSurfaceCoverage?: boolean;
    },
  ) => { exitCode: number; failures: string[] };
  buildDryRunSql: () => string;
  parseArgs: (argv: string[]) => {
    executeLocal: boolean;
    printSql: boolean;
    database: string;
    config: string;
    persistTo: string;
    jsonOutput: string | null;
    withFixture: boolean;
    requireRepresentativeData: boolean;
    requireCompleteSurfaceCoverage: boolean;
  };
  usage: () => string;
} = require("../../scripts/phase-c-orders-pk-dry-run.cjs");

describe("Phase C orders PK dry-run script", () => {
  it("uses the expected artifact schema contract version", () => {
    expect(ARTIFACT_SCHEMA_VERSION).toBe(1);
  });

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
        "--",
        "--execute-local",
        "--database",
        "local-db",
        "--config",
        "./worker.toml",
        "--persist-to",
        "./state",
        "--with-fixture",
        "--require-representative-data",
        "--require-complete-surface-coverage",
        "--json-output",
        "./artifacts/orders-pk.json",
      ]),
    ).toMatchObject({
      executeLocal: true,
      database: "local-db",
      config: "./worker.toml",
      persistTo: "./state",
      withFixture: true,
      requireRepresentativeData: true,
      requireCompleteSurfaceCoverage: true,
      jsonOutput: "./artifacts/orders-pk.json",
    });
  });

  it("labels fixture data as synthetic in CLI help", () => {
    expect(usage()).toContain("Insert synthetic order dependency rows");
    expect(usage()).not.toContain(
      "Insert representative order dependency rows",
    );
  });

  it("allows empty local rehearsals unless representative data is required", () => {
    const emptyResult = {
      ordersBridge: {
        order_rows: 0,
        missing_public_id: 0,
        duplicate_public_id: 0,
      },
      dependencies: [
        {
          table: "order_items",
          column: "order_id",
          non_null_order_refs: 0,
          mapped_order_refs: 0,
          unmapped_order_refs: 0,
          schemaObjects: [],
        },
      ],
      foreignKeyCheck: [],
    };

    expect(assessRehearsalResult(emptyResult)).toEqual({
      exitCode: 0,
      failures: [],
    });

    expect(
      assessRehearsalResult(emptyResult, {
        requireRepresentativeData: true,
      }),
    ).toEqual({
      exitCode: 1,
      failures: [
        "representative data required: orders table has no rows",
        "representative data required: no checked dependency has non-null order references",
      ],
    });
  });

  it("fails rehearsal assessment on bridge, mapping, and FK violations", () => {
    expect(
      assessRehearsalResult({
        ordersBridge: {
          order_rows: 3,
          missing_public_id: 1,
          duplicate_public_id: 1,
        },
        dependencies: [
          {
            table: "payment_transactions",
            column: "order_id",
            non_null_order_refs: 2,
            mapped_order_refs: 1,
            unmapped_order_refs: 1,
            schemaObjects: [],
          },
        ],
        foreignKeyCheck: [{ table: "order_items" }],
      }),
    ).toEqual({
      exitCode: 1,
      failures: [
        "orders.public_id bridge has missing values",
        "orders.public_id bridge has duplicate values",
        "payment_transactions.order_id has unmapped order references",
        "payment_transactions.order_id failed shadow-copy row-count parity",
        "PRAGMA foreign_key_check returned rows",
      ],
    });
  });

  it("fails strict assessment when surface coverage or schema metadata is incomplete", () => {
    expect(
      assessRehearsalResult(
        {
          ordersBridge: {
            order_rows: 2,
            missing_public_id: 0,
            duplicate_public_id: 0,
          },
          dependencies: [
            {
              table: "order_items",
              column: "order_id",
              non_null_order_refs: 1,
              mapped_order_refs: 1,
              unmapped_order_refs: 0,
              schemaObjects: [{ type: "index", name: "order_items_order_id" }],
            },
            {
              table: "payment_transactions",
              column: "order_id",
              non_null_order_refs: 0,
              mapped_order_refs: 0,
              unmapped_order_refs: 0,
            },
          ],
          appCompatibility: {
            legacy_lookup_rows: 1,
            public_lookup_rows: 1,
            lookup_mismatches: 0,
            shadow_public_id_rows: 1,
            shadow_public_id_missing: 0,
            shadow_public_id_mismatches: 0,
          },
          foreignKeyCheck: [],
        },
        { requireCompleteSurfaceCoverage: true },
      ),
    ).toEqual({
      exitCode: 1,
      failures: [
        "payment_transactions.order_id has no representative order references",
        "payment_transactions.order_id is missing schema object metadata",
      ],
    });
  });

  it("fails strict assessment when UUID bridge compatibility checks fail", () => {
    expect(
      assessRehearsalResult(
        {
          ordersBridge: {
            order_rows: 2,
            missing_public_id: 0,
            duplicate_public_id: 0,
          },
          dependencies: [
            {
              table: "order_items",
              column: "order_id",
              non_null_order_refs: 1,
              mapped_order_refs: 1,
              unmapped_order_refs: 0,
              schemaObjects: [{ type: "index", name: "order_items_order_id" }],
            },
          ],
          appCompatibility: {
            legacy_lookup_rows: 1,
            public_lookup_rows: 0,
            lookup_mismatches: 1,
            shadow_public_id_rows: 1,
            shadow_public_id_missing: 1,
            shadow_public_id_mismatches: 1,
          },
          foreignKeyCheck: [],
        },
        { requireCompleteSurfaceCoverage: true },
      ),
    ).toEqual({
      exitCode: 1,
      failures: [
        "orders UUID bridge public-id lookup returned no rows",
        "orders UUID bridge legacy/public lookup mismatch",
        "orders UUID bridge shadow copies contain missing public ids",
        "orders UUID bridge shadow public ids do not resolve back to source orders",
      ],
    });
  });
});
