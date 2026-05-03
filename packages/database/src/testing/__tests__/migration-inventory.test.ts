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
  "categories",
  "coupon_templates",
  "coupons",
  "cycle_snapshots",
  "dish_search_index",
  "employee_availability",
  "employee_leave_balances",
  "employee_schedules",
  "error_reports",
  "forecast_cache",
  "group_orders",
  "images",
  "ingredient_definitions",
  "leave_approval_rules",
  "leave_calendar_events",
  "leave_requests",
  "leave_types",
  "menu_items",
  "notification_dispatch_log",
  "orders",
  "partnership_plans",
  "partnership_usage_logs",
  "payment_audit_log",
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
  "storage_counters",
  "system_alerts",
  "tables",
  "usage_events",
  "usage_meters",
  "users",
  "waiting_list",
];

const PENDING_RESTAURANT_ID_FK_TABLES: string[] = [];

const EXPECTED_MONEY_CENTS_COLUMNS = {
  cash_movements: [["amount", "amount_cents"]],
  cash_shifts: [
    ["start_amount", "start_amount_cents"],
    ["end_amount", "end_amount_cents"],
    ["expected_amount", "expected_amount_cents"],
    ["actual_amount", "actual_amount_cents"],
    ["difference_amount", "difference_amount_cents"],
    ["total_sales", "total_sales_cents"],
    ["total_refunds", "total_refunds_cents"],
    ["cash_sales", "cash_sales_cents"],
    ["card_sales", "card_sales_cents"],
    ["digital_sales", "digital_sales_cents"],
  ],
  coupon_usage: [
    ["discount_amount", "discount_amount_cents"],
    ["original_amount", "original_amount_cents"],
    ["final_amount", "final_amount_cents"],
  ],
  coupons: [
    ["discount_value", "discount_value_cents"],
    ["max_discount_amount", "max_discount_amount_cents"],
    ["min_order_amount", "min_order_amount_cents"],
  ],
  dish_search_index: [["price", "price_cents"]],
  group_cart_items: [
    ["unit_price", "unit_price_cents"],
    ["total_price", "total_price_cents"],
  ],
  group_orders: [
    ["total_amount", "total_amount_cents"],
    ["tax_amount", "tax_amount_cents"],
    ["service_charge", "service_charge_cents"],
    ["final_amount", "final_amount_cents"],
  ],
  ingredient_definitions: [["cost_per_unit", "cost_per_unit_cents"]],
  menu_items: [
    ["price", "price_cents"],
    ["original_price", "original_price_cents"],
    ["cost_price", "cost_price_cents"],
  ],
  order_items: [
    ["unit_price", "unit_price_cents"],
    ["total_price", "total_price_cents"],
  ],
  orders: [
    ["subtotal", "subtotal_cents"],
    ["tax_amount", "tax_amount_cents"],
    ["service_charge", "service_charge_cents"],
    ["discount_amount", "discount_amount_cents"],
    ["total_amount", "total_amount_cents"],
    ["refund_amount", "refund_amount_cents"],
  ],
  partnership_plans: [
    ["discount_value", "discount_value_cents"],
    ["max_discount_amount", "max_discount_amount_cents"],
    ["min_order_amount", "min_order_amount_cents"],
    ["max_order_amount", "max_order_amount_cents"],
    ["total_discount_given", "total_discount_given_cents"],
    ["total_revenue", "total_revenue_cents"],
  ],
  partnership_usage_logs: [
    ["discount_value", "discount_value_cents"],
    ["discount_amount", "discount_amount_cents"],
    ["original_amount", "original_amount_cents"],
    ["final_amount", "final_amount_cents"],
  ],
  partnerships: [
    ["default_discount_value", "default_discount_value_cents"],
    ["total_discount_given", "total_discount_given_cents"],
    ["total_revenue", "total_revenue_cents"],
  ],
  refunds: [
    ["original_amount", "original_amount_cents"],
    ["refund_amount", "refund_amount_cents"],
  ],
  shift_templates: [["hourly_rate", "hourly_rate_cents"]],
  split_bills: [
    ["subtotal", "subtotal_cents"],
    ["tax_amount", "tax_amount_cents"],
    ["service_charge", "service_charge_cents"],
    ["discount_amount", "discount_amount_cents"],
    ["tip_amount", "tip_amount_cents"],
    ["total_amount", "total_amount_cents"],
  ],
  verified_members: [
    ["total_discount_received", "total_discount_received_cents"],
    ["total_spending", "total_spending_cents"],
  ],
} as const;

const CENTS_NATIVE_COLUMNS = [
  "cycle_snapshots.total_overage_cents",
  "payment_transactions.amount_cents",
  "refund_transactions.amount_cents",
] as const;

type TableRow = {
  name: string;
};

type TableColumnRow = {
  name: string;
  type: string;
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

type IndexRow = {
  name: string;
  unique: number;
  partial: number;
};

type IndexColumnRow = {
  name: string;
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

function listTableColumns(
  db: Database.Database,
  tableName: string,
): TableColumnRow[] {
  return db
    .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
    .all() as TableColumnRow[];
}

function expectedMoneyCentsColumnNames(): string[] {
  return Object.entries(EXPECTED_MONEY_CENTS_COLUMNS)
    .flatMap(([tableName, pairs]) =>
      pairs.map(([, centsColumn]) => `${tableName}.${centsColumn}`),
    )
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

  it("includes the shop subscription deployment mode column", () => {
    const columns = new Map(
      listTableColumns(db!, "shop_subscriptions").map((column) => [
        column.name,
        column,
      ]),
    );

    expect(columns.get("deployment_mode")?.type.toUpperCase()).toContain(
      "TEXT",
    );
  });

  it("keeps payment audit webhook provider events idempotent", () => {
    const indexes = db!
      .prepare(`PRAGMA index_list(payment_audit_log)`)
      .all() as IndexRow[];
    const providerEventIndex = indexes.find(
      (index) => index.name === "payment_audit_provider_event_idx",
    );

    expect(providerEventIndex).toMatchObject({ unique: 1, partial: 1 });

    const indexColumns = db!
      .prepare(`PRAGMA index_info(payment_audit_provider_event_idx)`)
      .all() as IndexColumnRow[];

    expect(indexColumns.map((column) => column.name)).toEqual([
      "provider",
      "provider_event_id",
    ]);
  });

  it("keeps cycle snapshots idempotent per restaurant cycle", () => {
    const indexes = db!
      .prepare(`PRAGMA index_list(cycle_snapshots)`)
      .all() as IndexRow[];
    const cycleIndex = indexes.find(
      (index) => index.name === "cycle_snapshots_restaurant_cycle_idx",
    );

    expect(cycleIndex).toMatchObject({ unique: 1 });

    const indexColumns = db!
      .prepare(`PRAGMA index_info(cycle_snapshots_restaurant_cycle_idx)`)
      .all() as IndexColumnRow[];

    expect(indexColumns.map((column) => column.name)).toEqual([
      "restaurant_id",
      "cycle_start_at_ms",
    ]);
  });

  it("keeps billing notifications deduplicated by channel", () => {
    const indexes = db!
      .prepare(`PRAGMA index_list(notification_dispatch_log)`)
      .all() as IndexRow[];
    const dedupIndex = indexes.find(
      (index) => index.name === "notification_dispatch_dedup_idx",
    );

    expect(dedupIndex).toMatchObject({ unique: 1 });

    const indexColumns = db!
      .prepare(`PRAGMA index_info(notification_dispatch_dedup_idx)`)
      .all() as IndexColumnRow[];

    expect(indexColumns.map((column) => column.name)).toEqual([
      "restaurant_id",
      "kind",
      "dedup_key",
      "channel",
    ]);
  });

  it("keeps enterprise subscription backfill in the fresh migration chain", () => {
    const sql = fs.readFileSync(
      path.join(MIGRATIONS_DIR, "0046_backfill-enterprise-subscriptions.sql"),
      "utf-8",
    );

    expect(sql).toContain("INSERT INTO shop_subscriptions");
    expect(sql).toContain("'enterprise'");
    expect(sql).toContain("WHERE NOT EXISTS");
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

  it("tracks every transitional money REAL column with an integer cents column", () => {
    for (const [tableName, pairs] of Object.entries(
      EXPECTED_MONEY_CENTS_COLUMNS,
    )) {
      const columns = new Map(
        listTableColumns(db!, tableName).map((column) => [column.name, column]),
      );

      for (const [legacyColumn, centsColumn] of pairs) {
        expect(columns.get(legacyColumn)?.type.toUpperCase()).toContain("REAL");
        expect(columns.get(centsColumn)?.type.toUpperCase()).toContain(
          "INTEGER",
        );
      }
    }

    const trackedCentsColumns = new Set([
      ...expectedMoneyCentsColumnNames(),
      ...CENTS_NATIVE_COLUMNS,
    ]);
    const actualCentsColumns = listUserTables(db!)
      .flatMap((tableName) =>
        listTableColumns(db!, tableName)
          .filter((column) => column.name.endsWith("_cents"))
          .map((column) => `${tableName}.${column.name}`),
      )
      .sort();

    expect(actualCentsColumns).toEqual([...trackedCentsColumns].sort());
  });

  it("keeps money cents retirement audit coverage aligned with tracked tables", () => {
    const expectedAuditTables = [
      ...Object.keys(EXPECTED_MONEY_CENTS_COLUMNS),
      "_all_money_tables",
    ].sort();
    const rows = db!
      .prepare(
        `SELECT DISTINCT table_name AS name
           FROM data_integrity_audit
          WHERE scope = 'money_cents_retirement'
          ORDER BY table_name`,
      )
      .all() as TableRow[];

    expect(rows.map((row) => row.name)).toEqual(expectedAuditTables);
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
