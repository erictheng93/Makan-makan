import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  parseArgs,
  validateArtifact,
}: {
  parseArgs: (argv: string[]) => {
    phase: string | null;
    artifact: string | null;
    help: boolean;
  };
  validateArtifact: (
    phase: "orders" | "users",
    artifact: Record<string, unknown>,
  ) => { exitCode: number; failures: string[] };
} = require("../../scripts/validate-pk-rehearsal-artifact.cjs");

describe("PK rehearsal artifact validator", () => {
  it("parses direct and pnpm-forwarded CLI arguments", () => {
    expect(
      parseArgs([
        "--",
        "--phase",
        "orders",
        "--artifact",
        "/tmp/orders-pk.json",
      ]),
    ).toEqual({
      phase: "orders",
      artifact: "/tmp/orders-pk.json",
      help: false,
    });
  });

  it("accepts a Phase C orders artifact that satisfies the conversion gate", () => {
    expect(
      validateArtifact("orders", {
        assessment: { exitCode: 0, failures: [] },
        dataCoverage: { isRepresentative: true },
        ordersBridge: {
          order_rows: 3,
          missing_public_id: 0,
          duplicate_public_id: 0,
        },
        dependencies: [
          {
            table: "order_items",
            column: "order_id",
            non_null_order_refs: 3,
            mapped_order_refs: 3,
            unmapped_order_refs: 0,
            schemaObjects: [{ type: "index", name: "order_items_order_id" }],
          },
        ],
        appCompatibility: {
          public_lookup_rows: 3,
          shadow_public_id_rows: 3,
          lookup_mismatches: 0,
          shadow_public_id_missing: 0,
          shadow_public_id_mismatches: 0,
        },
        foreignKeyCheck: [],
      }),
    ).toEqual({ exitCode: 0, failures: [] });
  });

  it("rejects a Phase C orders artifact that is not migration-ready", () => {
    expect(
      validateArtifact("orders", {
        assessment: { exitCode: 1, failures: ["representative data required"] },
        dataCoverage: { isRepresentative: false },
        ordersBridge: {
          order_rows: 0,
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
          },
        ],
        appCompatibility: {
          public_lookup_rows: 0,
          shadow_public_id_rows: 0,
          lookup_mismatches: 1,
          shadow_public_id_missing: 1,
          shadow_public_id_mismatches: 1,
        },
        foreignKeyCheck: [{ table: "orders" }],
      }),
    ).toEqual({
      exitCode: 1,
      failures: [
        "artifact assessment exitCode is not 0",
        "artifact dataCoverage is not representative",
        "orders artifact has no order rows",
        "orders.public_id bridge has missing values",
        "orders.public_id bridge has duplicate values",
        "payment_transactions.order_id has unmapped order references",
        "payment_transactions.order_id failed shadow-copy row-count parity",
        "payment_transactions.order_id is missing schema object metadata",
        "orders appCompatibility public lookup has no coverage",
        "orders appCompatibility has no shadow public-id coverage",
        "orders appCompatibility has legacy/public lookup mismatches",
        "orders appCompatibility has missing shadow public ids",
        "orders appCompatibility has shadow public-id resolution mismatches",
        "PRAGMA foreign_key_check returned rows",
      ],
    });
  });

  it("rejects a Phase C orders artifact with forged representative coverage", () => {
    expect(
      validateArtifact("orders", {
        assessment: { exitCode: 0, failures: [] },
        dataCoverage: { isRepresentative: true },
        ordersBridge: {
          order_rows: 0,
          missing_public_id: 0,
          duplicate_public_id: 0,
        },
        dependencies: [],
        appCompatibility: {
          public_lookup_rows: 1,
          lookup_mismatches: 0,
          shadow_public_id_missing: 0,
          shadow_public_id_mismatches: 0,
        },
        foreignKeyCheck: [],
      }),
    ).toEqual({
      exitCode: 1,
      failures: [
        "orders artifact has no order rows",
        "orders artifact has no dependency surfaces",
        "orders artifact has no non-null dependency references",
        "orders appCompatibility has no shadow public-id coverage",
      ],
    });
  });

  it("rejects a Phase C orders artifact with dependency refs but no order rows", () => {
    expect(
      validateArtifact("orders", {
        assessment: { exitCode: 0, failures: [] },
        dataCoverage: { isRepresentative: true },
        ordersBridge: {
          order_rows: 0,
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
          public_lookup_rows: 1,
          shadow_public_id_rows: 1,
          lookup_mismatches: 0,
          shadow_public_id_missing: 0,
          shadow_public_id_mismatches: 0,
        },
        foreignKeyCheck: [],
      }),
    ).toEqual({
      exitCode: 1,
      failures: ["orders artifact has no order rows"],
    });
  });

  it("accepts a Phase E users artifact that satisfies the conversion gate", () => {
    expect(
      validateArtifact("users", {
        assessment: { exitCode: 0, failures: [] },
        dataCoverage: { isRepresentative: true },
        usersBridge: {
          user_rows: 4,
          missing_public_id: 0,
          duplicate_public_id: 0,
          malformed_public_id: 0,
        },
        dependencies: [
          {
            table: "sessions",
            column: "user_id",
            non_null_user_refs: 4,
            mapped_user_refs: 4,
            unmapped_user_refs: 0,
            schemaObjects: [{ type: "index", name: "sessions_user_id_idx" }],
          },
        ],
        uninventoriedUserForeignKeys: [],
        foreignKeyCheck: [],
      }),
    ).toEqual({ exitCode: 0, failures: [] });
  });

  it("rejects a Phase E users artifact that is not migration-ready", () => {
    expect(
      validateArtifact("users", {
        assessment: { exitCode: 0, failures: [] },
        dataCoverage: { isRepresentative: false },
        usersBridge: {
          user_rows: 0,
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
        "artifact dataCoverage is not representative",
        "users artifact has no user rows",
        "users.public_id bridge has missing values",
        "users.public_id bridge has duplicate values",
        "users.public_id bridge has malformed UUID-v7 values",
        "sessions.user_id has unmapped user references",
        "sessions.user_id failed shadow-copy row-count parity",
        "sessions.user_id is missing schema object metadata",
        "users artifact has uninventoried users(id) foreign keys",
        "PRAGMA foreign_key_check returned rows",
      ],
    });
  });

  it("rejects a Phase E users artifact with forged representative coverage", () => {
    expect(
      validateArtifact("users", {
        assessment: { exitCode: 0, failures: [] },
        dataCoverage: { isRepresentative: true },
        usersBridge: {
          user_rows: 0,
          missing_public_id: 0,
          duplicate_public_id: 0,
          malformed_public_id: 0,
        },
        dependencies: [
          {
            table: "sessions",
            column: "user_id",
            non_null_user_refs: 0,
            mapped_user_refs: 0,
            unmapped_user_refs: 0,
            schemaObjects: [],
          },
        ],
        uninventoriedUserForeignKeys: [],
        foreignKeyCheck: [],
      }),
    ).toEqual({
      exitCode: 1,
      failures: [
        "users artifact has no user rows",
        "users artifact has no non-null dependency references",
      ],
    });
  });

  it("rejects a Phase E users artifact with dependency refs but no user rows", () => {
    expect(
      validateArtifact("users", {
        assessment: { exitCode: 0, failures: [] },
        dataCoverage: { isRepresentative: true },
        usersBridge: {
          user_rows: 0,
          missing_public_id: 0,
          duplicate_public_id: 0,
          malformed_public_id: 0,
        },
        dependencies: [
          {
            table: "sessions",
            column: "user_id",
            non_null_user_refs: 1,
            mapped_user_refs: 1,
            unmapped_user_refs: 0,
            schemaObjects: [{ type: "index", name: "sessions_user_id_idx" }],
          },
        ],
        uninventoriedUserForeignKeys: [],
        foreignKeyCheck: [],
      }),
    ).toEqual({
      exitCode: 1,
      failures: ["users artifact has no user rows"],
    });
  });
});
