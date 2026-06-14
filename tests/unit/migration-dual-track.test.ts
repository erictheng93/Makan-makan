import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  checkMigrationDualTrack,
  migrationRank,
}: {
  checkMigrationDualTrack: (options: { root: string; configPath: string }) => {
    ok: boolean;
    errors: string[];
  };
  migrationRank: (filename: string) => number | null;
} = require("../../scripts/check-migration-dual-track.cjs");

describe("migration dual-track guard", () => {
  it("ranks numeric and dated migration filenames", () => {
    expect(migrationRank("0067_new_feature.sql")).toBe(67);
    expect(migrationRank("20251001_performance_indexes.sql")).toBe(20251001);
    expect(migrationRank("dev-only")).toBeNull();
  });

  it("fails when a new post-checkpoint migration is not tracked", () => {
    const fixture = createFixture();
    writeSql(fixture, "migrations_fresh/0066_checkpoint.sql");
    writeSql(fixture, "migrations/0084_checkpoint.sql");
    writeSql(fixture, "migrations_fresh/0067_new_feature.sql");
    writeConfig(fixture, {
      freshDir: "migrations_fresh",
      legacyDir: "migrations",
      reviewedThrough: {
        fresh: "0066_checkpoint.sql",
        legacy: "0084_checkpoint.sql",
      },
      pairs: [],
      freshOnly: [],
      legacyOnly: [],
    });

    const result = checkMigrationDualTrack({
      root: fixture,
      configPath: "migration-dual-track.json",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("0067_new_feature.sql");
  });

  it("passes when new migrations are paired or explicitly one-sided", () => {
    const fixture = createFixture();
    writeSql(fixture, "migrations_fresh/0066_checkpoint.sql");
    writeSql(fixture, "migrations/0084_checkpoint.sql");
    writeSql(fixture, "migrations_fresh/0067_new_feature.sql");
    writeSql(fixture, "migrations/0085_new_feature.sql");
    writeSql(fixture, "migrations/20251001_operational_index.sql");
    writeConfig(fixture, {
      freshDir: "migrations_fresh",
      legacyDir: "migrations",
      reviewedThrough: {
        fresh: "0066_checkpoint.sql",
        legacy: "0084_checkpoint.sql",
      },
      pairs: [
        {
          fresh: "0067_new_feature.sql",
          legacy: "0085_new_feature.sql",
          reason: "same schema change in both tracks",
        },
      ],
      freshOnly: [],
      legacyOnly: [
        {
          legacy: "20251001_operational_index.sql",
          reason: "legacy-only operational index",
        },
      ],
    });

    const result = checkMigrationDualTrack({
      root: fixture,
      configPath: "migration-dual-track.json",
    });

    expect(result).toMatchObject({ ok: true, errors: [] });
  });

  it.each([
    [
      "fresh",
      "packages/database/migrations_fresh/0070_money_cents_cutover.sql",
    ],
    ["legacy", "packages/database/migrations/0087_money_cents_cutover.sql"],
  ])(
    "%s cutover drops partnership views before removing partnership money columns",
    (_track, migrationPath) => {
      const migration = fs.readFileSync(
        path.resolve(process.cwd(), migrationPath),
        "utf8",
      );
      const firstPartnershipMoneyDrop = migration.indexOf(
        "ALTER TABLE `partnerships` DROP COLUMN `default_discount_value`",
      );

      expect(firstPartnershipMoneyDrop).toBeGreaterThan(-1);
      for (const viewName of [
        "vw_active_partnership_plans",
        "vw_member_usage_summary",
        "vw_partnership_statistics",
      ]) {
        const dropView = migration.indexOf(
          `DROP VIEW IF EXISTS \`${viewName}\``,
        );
        expect(dropView).toBeGreaterThan(-1);
        expect(dropView).toBeLessThan(firstPartnershipMoneyDrop);
      }
    },
  );
});

function createFixture() {
  const fixture = fs.mkdtempSync(
    path.join(os.tmpdir(), "migration-dual-track-"),
  );
  fs.mkdirSync(path.join(fixture, "migrations_fresh"));
  fs.mkdirSync(path.join(fixture, "migrations"));
  return fixture;
}

function writeSql(root: string, relativePath: string) {
  fs.writeFileSync(path.join(root, relativePath), "SELECT 1;\n");
}

function writeConfig(root: string, config: unknown) {
  fs.writeFileSync(
    path.join(root, "migration-dual-track.json"),
    `${JSON.stringify(config, null, 2)}\n`,
  );
}
