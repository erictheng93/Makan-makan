import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  parseArgs,
  verifyPhaseCReadinessManifest,
}: {
  parseArgs: (argv: string[]) => {
    manifest: string | null;
    root: string;
    json: boolean;
    help: boolean;
  };
  verifyPhaseCReadinessManifest: (
    manifest: Record<string, unknown>,
    artifacts: {
      representative?: Record<string, unknown>;
      rollbackFixture?: Record<string, unknown>;
    },
  ) => { exitCode: number; failures: string[] };
} = require("../../scripts/verify-phase-c-orders-pk-readiness-manifest.cjs");

function orderSurface(overrides: Record<string, unknown> = {}) {
  return {
    table: "order_items",
    column: "order_id",
    kind: "fk",
    nullability: "not_null",
    onDelete: "cascade",
    writePaths: ["packages/database/src/services/order.ts"],
    non_null_order_refs: 3,
    mapped_order_refs: 3,
    unmapped_order_refs: 0,
    schemaObjects: [
      {
        type: "index",
        name: "order_items_order_status_idx",
        sql: "CREATE INDEX order_items_order_status_idx ON order_items(order_id, status)",
      },
    ],
    ...overrides,
  };
}

function validOrdersArtifact(overrides: Record<string, unknown> = {}) {
  return {
    artifactPhase: "orders",
    artifactSchemaVersion: 1,
    assessment: { exitCode: 0, failures: [] },
    rehearsalOptions: {
      requireRepresentativeData: true,
      requireCompleteSurfaceCoverage: true,
    },
    dataCoverage: { isRepresentative: true },
    ordersBridge: {
      order_rows: 3,
      missing_public_id: 0,
      duplicate_public_id: 0,
    },
    dependencies: [orderSurface()],
    appCompatibility: {
      public_lookup_rows: 3,
      shadow_public_id_rows: 3,
      lookup_mismatches: 0,
      shadow_public_id_missing: 0,
      shadow_public_id_mismatches: 0,
    },
    foreignKeyCheck: [],
    ...overrides,
  };
}

function validFixtureArtifact(overrides: Record<string, unknown> = {}) {
  return validOrdersArtifact({
    rehearsalOptions: {
      requireRepresentativeData: true,
      requireCompleteSurfaceCoverage: true,
      withFixture: true,
    },
    ...overrides,
  });
}

function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    manifestSchemaVersion: 1,
    readinessPhase: "phase-c-orders-pk",
    target: {
      artifactPhase: "orders",
      artifactSchemaVersion: 1,
    },
    artifacts: {
      representative: {
        path: "artifacts/pk/orders-representative.json",
        role: "representative",
        source: { kind: "restored-production", label: "prod-restore" },
      },
      rollbackFixture: {
        path: "artifacts/pk/orders-fixture.json",
        role: "fixture",
        source: { kind: "local", label: "miniflare" },
      },
    },
    ...overrides,
  };
}

describe("Phase C orders PK readiness manifest verifier", () => {
  it("parses direct and pnpm-forwarded CLI arguments", () => {
    expect(
      parseArgs([
        "--",
        "--manifest",
        "artifacts/pk/orders-readiness.json",
        "--root",
        "/repo",
        "--json",
      ]),
    ).toEqual({
      manifest: "artifacts/pk/orders-readiness.json",
      root: "/repo",
      json: true,
      help: false,
    });
  });

  it("accepts a manifest with representative and full-surface fixture artifacts", () => {
    expect(
      verifyPhaseCReadinessManifest(validManifest(), {
        representative: validOrdersArtifact(),
        rollbackFixture: validFixtureArtifact(),
      }),
    ).toEqual({ exitCode: 0, failures: [] });
  });

  it("rejects missing artifact roles and wrong evidence sources", () => {
    expect(
      verifyPhaseCReadinessManifest(
        validManifest({
          artifacts: {
            representative: {
              path: "artifacts/pk/orders-representative.json",
              role: "representative",
              source: { kind: "local" },
            },
          },
        }),
        { representative: validOrdersArtifact() },
      ),
    ).toEqual({
      exitCode: 1,
      failures: [
        "rollbackFixture artifact path is missing",
        "representative source kind must be staging or restored-production",
        "rollbackFixture artifact is missing",
      ],
    });
  });

  it("rejects a fixture artifact used as representative evidence", () => {
    expect(
      verifyPhaseCReadinessManifest(validManifest(), {
        representative: validFixtureArtifact(),
        rollbackFixture: validFixtureArtifact(),
      }),
    ).toEqual({
      exitCode: 1,
      failures: [
        "representative artifact failed validation: representative artifact must not be generated with fixture data",
      ],
    });
  });

  it("rejects dependency surface drift between representative and fixture evidence", () => {
    expect(
      verifyPhaseCReadinessManifest(validManifest(), {
        representative: validOrdersArtifact({
          dependencies: [
            orderSurface({ table: "payment_transactions", column: "order_id" }),
          ],
        }),
        rollbackFixture: validFixtureArtifact(),
      }),
    ).toEqual({
      exitCode: 1,
      failures: [
        "rollbackFixture is missing representative dependency surface payment_transactions.order_id",
        "rollbackFixture has dependency surface order_items.order_id not covered by representative",
      ],
    });
  });

  it("rejects schema metadata mismatch for matching dependency surfaces", () => {
    expect(
      verifyPhaseCReadinessManifest(validManifest(), {
        representative: validOrdersArtifact(),
        rollbackFixture: validFixtureArtifact({
          dependencies: [
            orderSurface({
              schemaObjects: [
                {
                  type: "index",
                  name: "order_items_order_status_idx",
                  sql: "CREATE INDEX different_sql ON order_items(order_id)",
                },
              ],
            }),
          ],
        }),
      }),
    ).toEqual({
      exitCode: 1,
      failures: ["schema metadata mismatch for order_items.order_id"],
    });
  });
});
