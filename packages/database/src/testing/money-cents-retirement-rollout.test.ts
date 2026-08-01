import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

interface ExpectedAuditSurface {
  tableName: string;
  columnName: string;
  checkName: string;
}

const expectedAuditSurfaces: ExpectedAuditSurface[] = [
  {
    tableName: "orders",
    columnName: "amounts",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "order_items",
    columnName: "amounts",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "menu_items",
    columnName: "amounts",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "coupons",
    columnName: "amounts",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "coupon_usage",
    columnName: "amounts",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "group_orders",
    columnName: "amounts",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "group_cart_items",
    columnName: "amounts",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "split_bills",
    columnName: "amounts",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "cash_shifts",
    columnName: "amounts",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "cash_movements",
    columnName: "amount",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "refunds",
    columnName: "amounts",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "dish_search_index",
    columnName: "price",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "ingredient_definitions",
    columnName: "cost_per_unit",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "shift_templates",
    columnName: "hourly_rate",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "partnerships",
    columnName: "amounts",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "partnership_plans",
    columnName: "amounts",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "partnership_usage_logs",
    columnName: "amounts",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "verified_members",
    columnName: "amounts",
    checkName: "real_cents_mismatch",
  },
  {
    tableName: "_all_money_tables",
    columnName: "legacy_real_amounts",
    checkName: "real_scale_over_two_decimals",
  },
];

const packageRoot = path.resolve(__dirname, "../..");
const freshMigrationsDir = path.join(packageRoot, "migrations_fresh");
const legacyMigrationsDir = path.join(packageRoot, "migrations");
const dualTrackPath = path.join(packageRoot, "migration-dual-track.json");
const retirementDocPath = path.resolve(
  packageRoot,
  "../../docs/migration/MONEY_CENTS_FIELD_RETIREMENT.md",
);

function findPercentageMigration(dir: string): string {
  const matches = fs
    .readdirSync(dir)
    .filter((file) => /^\d+_discount_percentage_bps\.sql$/.test(file))
    .sort();

  expect(matches).toHaveLength(1);
  return path.join(dir, matches[0]);
}

function findRolloutMigration(dir: string): string {
  const matches = fs
    .readdirSync(dir)
    .filter((file) =>
      /^\d+_money_cents_retirement_rollout_guard\.sql$/.test(file),
    )
    .sort();

  expect(matches).toHaveLength(1);
  return path.join(dir, matches[0]);
}

function findCutoverMigration(dir: string): string {
  const matches = fs
    .readdirSync(dir)
    .filter((file) => /^\d+_money_cents_cutover\.sql$/.test(file))
    .sort();

  expect(matches).toHaveLength(1);
  return path.join(dir, matches[0]);
}

function readSql(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function applySqlMigration(db: Database.Database, sql: string): void {
  for (const statement of sql
    .split("--> statement-breakpoint")
    .map((value) => value.trim())
    .filter(Boolean)) {
    db.exec(statement);
  }
}

function createAuditDb(options?: {
  omit?: string;
  violation?: { tableName: string; count: number };
}): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE data_integrity_audit (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      scope text NOT NULL,
      table_name text NOT NULL,
      column_name text NOT NULL,
      check_name text NOT NULL,
      severity text NOT NULL,
      violation_count integer DEFAULT 0 NOT NULL,
      sample_values text,
      details text,
      created_at_ms integer DEFAULT (unixepoch('now') * 1000) NOT NULL
    );

    CREATE UNIQUE INDEX data_integrity_audit_check_unique
      ON data_integrity_audit (scope, table_name, column_name, check_name);
  `);

  const insert = db.prepare(`
    INSERT INTO data_integrity_audit
      (scope, table_name, column_name, check_name, severity, violation_count, details)
    VALUES
      ('money_cents_retirement', @tableName, @columnName, @checkName, 'error', @violationCount, 'seeded test audit row')
  `);

  for (const surface of expectedAuditSurfaces) {
    if (surface.tableName === options?.omit) continue;
    insert.run({
      ...surface,
      violationCount:
        options?.violation?.tableName === surface.tableName
          ? options.violation.count
          : 0,
    });
  }

  return db;
}

describe("money cents retirement rollout migration", () => {
  it("pairs rollout, percentage, and cutover migrations across tracks", () => {
    const rolloutFresh = path.basename(
      findRolloutMigration(freshMigrationsDir),
    );
    const rolloutLegacy = path.basename(
      findRolloutMigration(legacyMigrationsDir),
    );
    const percentageFresh = path.basename(
      findPercentageMigration(freshMigrationsDir),
    );
    const percentageLegacy = path.basename(
      findPercentageMigration(legacyMigrationsDir),
    );
    const cutoverFresh = path.basename(
      findCutoverMigration(freshMigrationsDir),
    );
    const cutoverLegacy = path.basename(
      findCutoverMigration(legacyMigrationsDir),
    );
    const dualTrack = JSON.parse(fs.readFileSync(dualTrackPath, "utf8")) as {
      pairs?: Array<{ fresh: string; legacy: string; reason: string }>;
      reviewedThrough?: { fresh: string; legacy: string };
    };
    const latestPair = dualTrack.pairs?.at(-1);

    expect(latestPair).toBeDefined();
    expect(dualTrack.reviewedThrough).toEqual({
      fresh: latestPair?.fresh,
      legacy: latestPair?.legacy,
    });
    expect(dualTrack.pairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fresh: rolloutFresh,
          legacy: rolloutLegacy,
          reason: expect.stringContaining("Money cents retirement"),
        }),
        expect.objectContaining({
          fresh: percentageFresh,
          legacy: percentageLegacy,
          reason: expect.stringContaining("Percentage discount"),
        }),
        expect.objectContaining({
          fresh: cutoverFresh,
          legacy: cutoverLegacy,
          reason: expect.stringContaining("Money cents cutover"),
        }),
      ]),
    );
  });

  it.each([
    ["fresh", () => findRolloutMigration(freshMigrationsDir)],
    ["legacy", () => findRolloutMigration(legacyMigrationsDir)],
  ])(
    "%s guard fails when an audited money surface is missing",
    (_label, pathFor) => {
      const db = createAuditDb({ omit: "verified_members" });
      const sql = readSql(pathFor());

      expect(() => applySqlMigration(db, sql)).toThrow(
        /CHECK constraint failed/i,
      );
    },
  );

  it.each([
    ["fresh", () => findRolloutMigration(freshMigrationsDir)],
    ["legacy", () => findRolloutMigration(legacyMigrationsDir)],
  ])("%s guard fails when a money audit has violations", (_label, pathFor) => {
    const db = createAuditDb({
      violation: { tableName: "orders", count: 1 },
    });
    const sql = readSql(pathFor());

    expect(() => applySqlMigration(db, sql)).toThrow(
      /CHECK constraint failed/i,
    );
  });

  it.each([
    ["fresh", () => findRolloutMigration(freshMigrationsDir)],
    ["legacy", () => findRolloutMigration(legacyMigrationsDir)],
  ])(
    "%s guard records rollout readiness only after clean audit coverage",
    (_label, pathFor) => {
      const db = createAuditDb();
      const sql = readSql(pathFor());

      applySqlMigration(db, sql);

      const rows = db
        .prepare(
          `
          SELECT table_name, column_name, check_name, violation_count
          FROM data_integrity_audit
          WHERE scope = 'money_cents_retirement_rollout'
          ORDER BY check_name
        `,
        )
        .all();

      expect(rows).toEqual([
        {
          table_name: "_rollout",
          column_name: "audit_rows",
          check_name: "audit_coverage_present",
          violation_count: 0,
        },
        {
          table_name: "_rollout",
          column_name: "legacy_real_amounts",
          check_name: "preflight_zero_errors",
          violation_count: 0,
        },
      ]);
    },
  );

  it("keeps the rollout dedicated to money audit gating", () => {
    const sql = [
      readSql(findRolloutMigration(freshMigrationsDir)),
      readSql(findRolloutMigration(legacyMigrationsDir)),
    ].join("\n");

    expect(sql).toContain("money_cents_retirement_rollout");
    expect(sql).toContain("_migration_assert_money_cents_retirement_rollout");
    expect(sql).not.toMatch(
      /restaurant_fk|FOREIGN KEY|ALTER TABLE|CREATE TABLE [`"]orders/i,
    );
  });

  it("documents the executable D1 rollout phases", () => {
    const rolloutFresh = path.basename(
      findRolloutMigration(freshMigrationsDir),
    );
    const rolloutLegacy = path.basename(
      findRolloutMigration(legacyMigrationsDir),
    );
    const cutoverFresh = path.basename(
      findCutoverMigration(freshMigrationsDir),
    );
    const cutoverLegacy = path.basename(
      findCutoverMigration(legacyMigrationsDir),
    );
    const doc = fs.readFileSync(retirementDocPath, "utf8");

    expect(doc).toContain(rolloutFresh);
    expect(doc).toContain(rolloutLegacy);
    expect(doc).toContain(cutoverFresh);
    expect(doc).toContain(cutoverLegacy);
    expect(doc).toContain("pnpm db:migrate:prod");
    expect(doc).toContain("PRAGMA defer_foreign_keys = ON");
    expect(doc).toContain("money_cents_retirement_rollout");
  });

  it("requires percentage basis-point columns before discount value cutover", () => {
    const fresh = readSql(findPercentageMigration(freshMigrationsDir));
    const legacy = readSql(findPercentageMigration(legacyMigrationsDir));
    const doc = fs.readFileSync(retirementDocPath, "utf8");

    for (const sql of [fresh, legacy]) {
      expect(sql).toContain("discount_percentage_bps");
      expect(sql).toContain("default_discount_percentage_bps");
      expect(sql).toContain("percentage_bps_missing_or_mismatch");
      expect(sql).toContain("discount_type` = 'percentage'");
    }
    expect(doc).toContain("discount_percentage_bps");
    expect(doc).toContain("default_discount_percentage_bps");
    expect(doc).toContain("percentage_bps_missing_or_mismatch");
  });

  it.each([
    ["fresh", () => findCutoverMigration(freshMigrationsDir)],
    ["legacy", () => findCutoverMigration(legacyMigrationsDir)],
  ])(
    "%s cutover drops only after guards and removes legacy sync surfaces",
    (_label, pathFor) => {
      const sql = readSql(pathFor());

      expect(sql).toContain("_migration_assert_money_cents_cutover");
      expect(sql).toContain(
        "money_cents_retirement_rollout.preflight_zero_errors",
      );
      expect(sql).toContain(
        "money_cents_retirement.percentage_bps_zero_errors",
      );
      expect(sql).toContain("money_cents_cutover.row_counts_unchanged");
      expect(sql).toContain("money_cents_cutover.foreign_key_check");
      expect(sql).toContain("DROP TRIGGER IF EXISTS `orders_cents_sync_ai`");
      expect(sql).toContain(
        "DROP TRIGGER IF EXISTS `trg_partnership_usage_update_member_stats`",
      );
      expect(sql).toContain(
        "CREATE TRIGGER IF NOT EXISTS `trg_partnership_usage_update_member_stats`",
      );
      expect(sql).toContain(
        "ALTER TABLE `coupons` DROP COLUMN `discount_value`",
      );
      expect(sql).toContain(
        "ALTER TABLE `partnership_plans` DROP COLUMN `discount_value`",
      );
      expect(sql).toContain("CREATE INDEX `menu_items_price_range_idx`");
      expect(sql).toContain("CREATE INDEX `dish_search_price_available_idx`");
      expect(sql).not.toContain("DROP COLUMN `discount_percentage_bps`");
      expect(sql).not.toContain("DROP COLUMN `discount_value_cents`");
    },
  );
});
