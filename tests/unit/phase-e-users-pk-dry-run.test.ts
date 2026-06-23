import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  USER_DEPENDENCIES,
  assessRehearsalResult,
  parseArgs,
  summarizeDataCoverage,
}: {
  USER_DEPENDENCIES: Array<{
    table: string;
    column: string;
    kind: string;
  }>;
  assessRehearsalResult: (result: {
    usersBridge: {
      missing_public_id: number;
      duplicate_public_id: number;
      malformed_public_id: number;
    } | null;
    dependencies: Array<{
      table: string;
      column: string;
      non_null_user_refs: number;
      mapped_user_refs: number;
      unmapped_user_refs: number;
    }>;
    uninventoriedUserForeignKeys: unknown[];
    foreignKeyCheck: unknown[];
  }) => { exitCode: number; failures: string[] };
  parseArgs: (argv: string[]) => {
    executeLocal: boolean;
    printInventory: boolean;
    sqlitePath: string | null;
    jsonOutput: string | null;
  };
  summarizeDataCoverage: (result: {
    usersBridge: { user_rows: number } | null;
    dependencies: Array<{ non_null_user_refs: number }>;
  }) => {
    userRows: number;
    dependencyRefs: number;
    dependenciesWithRefs: number;
    dependencyCount: number;
    isRepresentative: boolean;
  };
} = require("../../scripts/phase-e-users-pk-dry-run.cjs");

describe("Phase E users PK dry-run script", () => {
  it("tracks critical staff user FK and actor pointer surfaces", () => {
    expect(
      USER_DEPENDENCIES.map((dependency) => [
        dependency.table,
        dependency.column,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ["sessions", "user_id"],
        ["password_reset_tokens", "user_id"],
        ["audit_logs", "user_id"],
        ["audit_logs", "on_behalf_of_user_id"],
        ["cash_shifts", "operator_id"],
        ["cash_movements", "recorded_by"],
        ["refunds", "processed_by"],
        ["group_orders", "created_by"],
        ["partnership_usage_logs", "verified_by_user_id"],
        ["employee_schedules", "employee_id"],
        ["schedule_swap_requests", "requester_employee_id"],
        ["leave_requests", "employee_id"],
        ["shop_feedback", "user_id"],
        ["error_reports", "user_id"],
      ]),
    );
  });

  it("parses local execution options", () => {
    expect(
      parseArgs([
        "--execute-local",
        "--sqlite-path",
        "./local.sqlite",
        "--json-output",
        "./artifacts/users-pk.json",
      ]),
    ).toMatchObject({
      executeLocal: true,
      sqlitePath: "./local.sqlite",
      jsonOutput: "./artifacts/users-pk.json",
    });

    expect(parseArgs(["--print-inventory"])).toMatchObject({
      printInventory: true,
    });
  });

  it("summarizes representative data coverage", () => {
    expect(
      summarizeDataCoverage({
        usersBridge: { user_rows: 2 },
        dependencies: [
          { non_null_user_refs: 0 },
          { non_null_user_refs: 3 },
          { non_null_user_refs: 4 },
        ],
      }),
    ).toEqual({
      userRows: 2,
      dependencyRefs: 7,
      dependenciesWithRefs: 2,
      dependencyCount: 3,
      isRepresentative: true,
    });
  });

  it("fails assessment on bridge, mapping, FK, and inventory drift", () => {
    expect(
      assessRehearsalResult({
        usersBridge: {
          missing_public_id: 1,
          duplicate_public_id: 1,
          malformed_public_id: 1,
        },
        dependencies: [
          {
            table: "sessions",
            column: "user_id",
            non_null_user_refs: 2,
            mapped_user_refs: 1,
            unmapped_user_refs: 1,
          },
        ],
        uninventoriedUserForeignKeys: [{ table: "new_table" }],
        foreignKeyCheck: [{ table: "sessions" }],
      }),
    ).toEqual({
      exitCode: 1,
      failures: [
        "users.public_id bridge has missing values",
        "users.public_id bridge has duplicate values",
        "users.public_id bridge has malformed UUID-v7 values",
        "sessions.user_id has unmapped user references",
        "sessions.user_id failed shadow-copy row-count parity",
        "SQLite has users(id) foreign keys missing from inventory",
        "PRAGMA foreign_key_check returned rows",
      ],
    });
  });
});
