import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, "../../../migrations_fresh");

// Keep this independent from Miniflare/D1 batch execution so FK inventory
// regressions remain visible even when an earlier migration breaks the runner.
const EXPECTED_RESTAURANT_ID_FK_TABLES = [
  "ai_configurations",
  "ai_usage_logs",
  "audit_logs",
  "backup_alerts",
  "backup_audit_logs",
  "backup_configurations",
  "backup_records",
  "backup_schedules",
  "cash_registers",
  "coupon_templates",
  "coupons",
  "dish_search_index",
  "employee_availability",
  "employee_leave_balances",
  "employee_schedules",
  "error_reports",
  "forecast_cache",
  "images",
  "ingredient_definitions",
  "leave_approval_rules",
  "leave_calendar_events",
  "leave_requests",
  "leave_types",
  "partnership_plans",
  "partnership_usage_logs",
  "payment_transactions",
  "platform_integrations",
  "platform_menu_mappings",
  "platform_orders",
  "platform_webhook_logs",
  "qr_batches",
  "refund_transactions",
  "reservation_slots",
  "reservations",
  "restore_operations",
  "schedule_swap_requests",
  "scheduling_conflicts",
  "scheduling_rules",
  "shift_templates",
  "shop_feedback",
  "shop_subscriptions",
  "system_alerts",
  "waiting_list",
];

const PENDING_RESTAURANT_ID_FK_TABLES = [
  "categories",
  "group_orders",
  "menu_items",
  "orders",
  "tables",
  "users",
];

type TableRow = {
  name: string;
};

type TableColumnRow = {
  name: string;
};

type ForeignKeyRow = {
  table: string;
  from: string;
  to: string;
};

type IntegrityAuditRow = {
  scope: string;
  checks: number;
  violations: number;
};

function migrationStatements(fileName: string): string[] {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, fileName), "utf-8");
  return sql
    .split(/--> statement-breakpoint/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function applyMigrationFile(db: Database.Database, fileName: string): void {
  const statements = migrationStatements(fileName);

  for (const statement of statements) {
    try {
      db.exec(statement);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `[migration inventory] failed in ${fileName}: ${message}`,
      );
    }
  }
}

function createMigratedSchema(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");

  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    applyMigrationFile(db, file);
  }

  return db;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function listUserTables(db: Database.Database): string[] {
  const rows = db
    .prepare(
      `SELECT name
         FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name`,
    )
    .all() as TableRow[];

  return rows.map((row) => row.name);
}

function listRestaurantIdFkTables(db: Database.Database): string[] {
  const tables = listUserTables(db);
  const fkTables: string[] = [];

  for (const tableName of tables) {
    const foreignKeys = db
      .prepare(`PRAGMA foreign_key_list(${quoteIdentifier(tableName)})`)
      .all() as ForeignKeyRow[];

    for (const foreignKey of foreignKeys) {
      if (
        foreignKey.table === "restaurants" &&
        foreignKey.from === "restaurant_id" &&
        foreignKey.to === "id"
      ) {
        fkTables.push(tableName);
      }
    }
  }

  return fkTables.sort();
}

function listRestaurantIdTables(db: Database.Database): string[] {
  return listUserTables(db)
    .filter((tableName) => {
      const columns = db
        .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
        .all() as TableColumnRow[];

      return columns.some((column) => column.name === "restaurant_id");
    })
    .sort();
}

describe("migration inventory", () => {
  let db: Database.Database | undefined;

  beforeAll(() => {
    db = createMigratedSchema();
  }, 60000);

  afterAll(() => {
    db?.close();
  });

  it("has the expected restaurant_id foreign key inventory", () => {
    const fkTables = listRestaurantIdFkTables(db!);

    expect(fkTables).toHaveLength(EXPECTED_RESTAURANT_ID_FK_TABLES.length);
    expect(fkTables).toEqual(EXPECTED_RESTAURANT_ID_FK_TABLES);
  });

  it("tracks restaurant_id tables still waiting for physical FK rebuilds", () => {
    const restaurantIdTables = listRestaurantIdTables(db!);
    const fkTables = new Set(listRestaurantIdFkTables(db!));
    const pendingTables = restaurantIdTables.filter(
      (tableName) => !fkTables.has(tableName),
    );

    expect(restaurantIdTables).toHaveLength(
      EXPECTED_RESTAURANT_ID_FK_TABLES.length +
        PENDING_RESTAURANT_ID_FK_TABLES.length,
    );
    expect(pendingTables).toEqual(PENDING_RESTAURANT_ID_FK_TABLES);
  });

  it("has no SQLite foreign key check violations", () => {
    const violations = db!.prepare(`PRAGMA foreign_key_check`).all();

    expect(violations).toEqual([]);
  });

  it("keeps integrity audit scopes clean on a fresh database", () => {
    const rows = db!
      .prepare(
        `SELECT scope,
                COUNT(*) AS checks,
                COALESCE(SUM(violation_count), 0) AS violations
           FROM data_integrity_audit
          WHERE scope IN (
            'money_cents_retirement',
            'restaurant_fk',
            'referential_integrity'
          )
          GROUP BY scope`,
      )
      .all() as IntegrityAuditRow[];

    const byScope = new Map(
      rows.map((row) => [
        row.scope,
        {
          checks: Number(row.checks),
          violations: Number(row.violations),
        },
      ]),
    );

    expect(
      byScope.get("money_cents_retirement")?.checks,
    ).toBeGreaterThanOrEqual(19);
    expect(byScope.get("restaurant_fk")?.checks).toBeGreaterThanOrEqual(76);
    expect(byScope.get("referential_integrity")?.checks).toBeGreaterThanOrEqual(
      2,
    );

    for (const scope of byScope.values()) {
      expect(scope.violations).toBe(0);
    }
  });

  it("does not leave restaurant FK rebuild temp tables behind", () => {
    const leftovers = db!
      .prepare(
        `SELECT name
           FROM sqlite_master
          WHERE type = 'table'
            AND (
              name LIKE '%__restaurant_fk_rebuild'
              OR name LIKE '%__component_rebuild_data'
              OR name LIKE '_migration_assert_%'
            )
          ORDER BY name`,
      )
      .all() as TableRow[];

    expect(leftovers.map((row) => row.name)).toEqual([]);
  });

  it("audits legacy REAL precision without flagging percentage discounts", () => {
    const now = Date.now();
    db!
      .prepare(
        `INSERT INTO restaurants (
        id, name, type, category, address, district, city, phone,
        is_available, is_active, created_at_ms, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "rest-money-audit",
        "Money Audit",
        "restaurant",
        "test",
        "1 Audit Rd",
        "Test",
        "Taipei",
        "0900000000",
        1,
        1,
        now,
        now,
      );

    db!
      .prepare(
        `INSERT INTO coupons (
        restaurant_id, code, name, discount_type, discount_value,
        min_order_amount, valid_from, valid_to, is_active, is_visible,
        created_at_ms, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "rest-money-audit",
        "PERCENT_PRECISION",
        "Percentage precision is allowed",
        "percentage",
        12.345,
        0,
        "2026-01-01",
        "2026-12-31",
        1,
        1,
        now,
        now,
      );

    db!
      .prepare(
        `INSERT INTO coupons (
        restaurant_id, code, name, discount_type, discount_value,
        min_order_amount, valid_from, valid_to, is_active, is_visible,
        created_at_ms, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "rest-money-audit",
        "FIXED_PRECISION",
        "Fixed precision is audited",
        "fixed",
        1.234,
        0,
        "2026-01-01",
        "2026-12-31",
        1,
        1,
        now,
        now,
      );

    applyMigrationFile(db!, "0027_money_cents_retirement_audit.sql");

    const precisionAudit = db!
      .prepare(
        `SELECT violation_count, sample_values
           FROM data_integrity_audit
          WHERE scope = 'money_cents_retirement'
            AND table_name = '_all_money_tables'
            AND check_name = 'real_scale_over_two_decimals'`,
      )
      .get() as { violation_count: number; sample_values: string | null };

    expect(Number(precisionAudit.violation_count)).toBe(1);
    expect(precisionAudit.sample_values).toContain("coupons:");

    const couponMismatchAudit = db!
      .prepare(
        `SELECT violation_count
           FROM data_integrity_audit
          WHERE scope = 'money_cents_retirement'
            AND table_name = 'coupons'
            AND check_name = 'real_cents_mismatch'`,
      )
      .get() as { violation_count: number };

    expect(Number(couponMismatchAudit.violation_count)).toBe(0);
  });
});
