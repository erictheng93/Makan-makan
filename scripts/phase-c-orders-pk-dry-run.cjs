#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_DATABASE = "makanmakan-local";
const DEFAULT_CONFIG = "./apps/api/wrangler.toml";
const DEFAULT_PERSIST_TO = "./apps/api/.wrangler/state";
const DEFAULT_D1_STATE_DIR =
  "apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const ARTIFACT_SCHEMA_VERSION = 1;

const ORDER_DEPENDENCIES = [
  {
    table: "order_items",
    column: "order_id",
    kind: "fk",
    nullability: "not_null",
    onDelete: "cascade",
    writePaths: ["packages/database/src/services/order.ts"],
  },
  {
    table: "payment_transactions",
    column: "order_id",
    kind: "fk",
    nullability: "not_null",
    onDelete: "cascade",
    writePaths: [
      "apps/api/src/features/payments/services/PaymentService.ts",
      "apps/api/src/features/payments/services/refundPayment.ts",
      "apps/api/src/features/pos/services/MarketCheckoutPOSPaymentService.ts",
    ],
  },
  {
    table: "refund_transactions",
    column: "order_id",
    kind: "fk",
    nullability: "not_null",
    onDelete: "cascade",
    writePaths: ["apps/api/src/features/payments/services/refundPayment.ts"],
  },
  {
    table: "receipts",
    column: "order_id",
    kind: "fk",
    nullability: "not_null",
    onDelete: "no_action",
    writePaths: [
      "apps/api/src/features/pos/services/ReceiptService.ts",
      "packages/database/src/services/POSService.ts",
    ],
  },
  {
    table: "refunds",
    column: "original_order_id",
    kind: "fk",
    nullability: "not_null",
    onDelete: "no_action",
    writePaths: [
      "apps/api/src/features/pos/services/RefundService.ts",
      "packages/database/src/services/POSService.ts",
    ],
  },
  {
    table: "platform_orders",
    column: "order_id",
    kind: "fk",
    nullability: "not_null",
    onDelete: "cascade",
    writePaths: [
      "apps/api/src/features/integrations/services/PlatformOrderService.ts",
    ],
  },
  {
    table: "partnership_usage_logs",
    column: "order_id",
    kind: "fk",
    nullability: "not_null",
    onDelete: "cascade",
    writePaths: ["packages/database/src/services/PartnershipService.ts"],
  },
  {
    table: "coupon_usage",
    column: "order_id",
    kind: "fk",
    nullability: "not_null",
    onDelete: "cascade",
    writePaths: [
      "packages/database/src/services/order.ts",
      "packages/database/src/services/coupon.ts",
      "apps/api/src/features/market-checkouts/services/MarketCheckoutVoucherService.ts",
    ],
  },
  {
    table: "market_checkout_child_orders",
    column: "order_id",
    kind: "runtime_pointer",
    nullability: "not_null",
    onDelete: "none",
    writePaths: ["apps/api/src/features/market-checkouts"],
  },
  {
    table: "group_orders",
    column: "master_order_id",
    kind: "runtime_pointer",
    nullability: "nullable",
    onDelete: "legacy_cascade",
    writePaths: [
      "apps/api/src/features/group-orders/services/GroupOrdersService.ts",
    ],
  },
  {
    table: "tables",
    column: "current_order_id",
    kind: "runtime_pointer",
    nullability: "nullable",
    onDelete: "none",
    writePaths: [
      "packages/database/src/services/table.ts",
      "apps/api/src/features/payments/services/PaymentService.ts",
    ],
  },
  {
    table: "seats",
    column: "current_order_id",
    kind: "runtime_pointer",
    nullability: "nullable",
    onDelete: "none",
    writePaths: ["packages/database/src/services/seat.ts"],
  },
  {
    table: "order_status_history",
    column: "order_id",
    kind: "legacy_migration_fk",
    nullability: "not_null",
    onDelete: "cascade",
    writePaths: ["packages/database/migrations/0009_additional_tables.sql"],
  },
  {
    table: "customer_reviews",
    column: "order_id",
    kind: "legacy_migration_fk",
    nullability: "not_null",
    onDelete: "cascade",
    writePaths: ["packages/database/migrations/0009_additional_tables.sql"],
  },
];

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function shadowTableName(dependency) {
  return `__phase_c_shadow_${dependency.table}_${dependency.column}`;
}

function dependencyValuesRows(dependencies) {
  return dependencies
    .map((dependency, index) => {
      return [
        index + 1,
        dependency.table,
        dependency.column,
        dependency.kind,
        dependency.nullability,
        dependency.onDelete,
        dependency.writePaths.join(", "),
      ]
        .map((value) => (typeof value === "number" ? value : sqlString(value)))
        .join(", ");
    })
    .map((row) => `  (${row})`)
    .join(",\n");
}

function existingTablePredicate(tableName) {
  return `EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ${sqlString(tableName)})`;
}

function buildExistingTableSelect(dependency, expression) {
  return `SELECT ${sqlString(dependency.table)} AS table_name, ${sqlString(dependency.column)} AS column_name, ${expression}
WHERE ${existingTablePredicate(dependency.table)}`;
}

function buildShadowStatements(dependency) {
  const table = quoteIdentifier(dependency.table);
  const column = quoteIdentifier(dependency.column);
  const shadow = quoteIdentifier(shadowTableName(dependency));

  return [
    `CREATE TEMP TABLE ${shadow} AS
SELECT child.rowid AS source_rowid,
       child.${column} AS legacy_order_id,
       orders.public_id AS order_public_id
  FROM ${table} AS child
  JOIN orders ON orders.id = child.${column}
 WHERE child.${column} IS NOT NULL
   AND ${existingTablePredicate(dependency.table)};`,
    buildExistingTableSelect(
      dependency,
      `(SELECT count(*) FROM ${table}) AS total_rows,
       (SELECT count(*) FROM ${table} WHERE ${column} IS NOT NULL) AS non_null_order_refs,
       (SELECT count(*) FROM ${shadow}) AS mapped_order_refs,
       (SELECT count(*) FROM ${table} AS child
         WHERE child.${column} IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM orders WHERE orders.id = child.${column})) AS unmapped_order_refs`,
    ),
  ].join("\n");
}

function buildDryRunSql(dependencies = ORDER_DEPENDENCIES) {
  const dependencyMapRows = dependencyValuesRows(dependencies);
  const rowCountSelects = dependencies
    .map((dependency) =>
      buildExistingTableSelect(
        dependency,
        `(SELECT count(*) FROM ${quoteIdentifier(dependency.table)}) AS row_count`,
      ),
    )
    .join("\nUNION ALL\n");
  const schemaSelects = dependencies
    .map((dependency) =>
      buildExistingTableSelect(
        dependency,
        `(
         SELECT group_concat(name, ', ')
           FROM sqlite_master
          WHERE type = 'index'
            AND tbl_name = ${sqlString(dependency.table)}
       ) AS index_names,
       (
         SELECT group_concat(name, ', ')
           FROM sqlite_master
          WHERE type = 'trigger'
            AND tbl_name = ${sqlString(dependency.table)}
       ) AS trigger_names`,
      ),
    )
    .join("\nUNION ALL\n");
  const shadowStatements = dependencies.map(buildShadowStatements).join("\n\n");

  return `-- Phase C orders UUID primary-key dry run.
-- This script creates TEMP shadow tables only and ends with ROLLBACK.
PRAGMA foreign_keys = ON;
BEGIN;

CREATE TEMP TABLE __phase_c_order_dependencies (
  dependency_order INTEGER PRIMARY KEY,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  relation_kind TEXT NOT NULL,
  nullability TEXT NOT NULL,
  on_delete TEXT NOT NULL,
  write_paths TEXT NOT NULL
);

INSERT INTO __phase_c_order_dependencies (
  dependency_order,
  table_name,
  column_name,
  relation_kind,
  nullability,
  on_delete,
  write_paths
) VALUES
${dependencyMapRows};

SELECT 'dependency_map' AS section, *
  FROM __phase_c_order_dependencies
 ORDER BY dependency_order;

SELECT 'orders_bridge' AS section,
       count(*) AS order_rows,
       coalesce(sum(CASE WHEN public_id IS NULL THEN 1 ELSE 0 END), 0) AS missing_public_id,
       count(public_id) - count(DISTINCT public_id) AS duplicate_public_id
  FROM orders;

${rowCountSelects};

${schemaSelects};

${shadowStatements}

SELECT 'foreign_key_check' AS section, *
  FROM pragma_foreign_key_check;

ROLLBACK;
`;
}

function parseArgs(argv) {
  const args = {
    executeLocal: false,
    printSql: false,
    database: DEFAULT_DATABASE,
    config: DEFAULT_CONFIG,
    persistTo: DEFAULT_PERSIST_TO,
    sqlitePath: null,
    withFixture: false,
    jsonOutput: null,
    requireRepresentativeData: false,
    requireCompleteSurfaceCoverage: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--execute-local") args.executeLocal = true;
    else if (arg === "--print-sql") args.printSql = true;
    else if (arg === "--database") args.database = argv[++index];
    else if (arg === "--config") args.config = argv[++index];
    else if (arg === "--persist-to") args.persistTo = argv[++index];
    else if (arg === "--sqlite-path") args.sqlitePath = argv[++index];
    else if (arg === "--with-fixture") args.withFixture = true;
    else if (arg === "--require-representative-data") {
      args.requireRepresentativeData = true;
    } else if (arg === "--require-complete-surface-coverage") {
      args.requireCompleteSurfaceCoverage = true;
    } else if (arg === "--json-output") args.jsonOutput = argv[++index];
    else if (arg === "--help") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function usage() {
  return `Usage:
  node scripts/phase-c-orders-pk-dry-run.cjs --print-sql
  node scripts/phase-c-orders-pk-dry-run.cjs --execute-local

Options:
  --database <name>    D1 database binding name (default: ${DEFAULT_DATABASE})
  --config <path>      Wrangler config path (default: ${DEFAULT_CONFIG})
  --persist-to <path>  Local D1 state path (default: ${DEFAULT_PERSIST_TO})
  --sqlite-path <path> Local Miniflare SQLite file. Auto-detected by default.
  --with-fixture       Insert representative order dependency rows inside the rollback transaction.
  --require-representative-data
                       Fail if the rehearsal has no orders or no non-null order dependency refs.
  --require-complete-surface-coverage
                       Fail if any checked dependency has no representative refs or schema metadata.
  --json-output <path> Write local rehearsal JSON evidence to a file.
`;
}

function findLocalSqlitePath(root = process.cwd()) {
  const stateDir = path.resolve(root, DEFAULT_D1_STATE_DIR);
  if (!fs.existsSync(stateDir)) {
    throw new Error(`Local D1 state directory not found: ${stateDir}`);
  }

  const candidates = fs
    .readdirSync(stateDir)
    .filter((file) => file.endsWith(".sqlite") && file !== "metadata.sqlite")
    .map((file) => path.join(stateDir, file))
    .sort();

  if (candidates.length === 0) {
    throw new Error(`No local D1 SQLite database found in ${stateDir}`);
  }
  if (candidates.length > 1) {
    throw new Error(
      `Multiple local D1 SQLite databases found; pass --sqlite-path:\n${candidates.join("\n")}`,
    );
  }

  return candidates[0];
}

function existingDependencies(db, dependencies = ORDER_DEPENDENCIES) {
  const exists = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
  );
  return dependencies.filter((dependency) => exists.get(dependency.table));
}

function readIndexesAndTriggers(db, tableName) {
  return db
    .prepare(
      "SELECT type, name, sql FROM sqlite_master WHERE tbl_name = ? AND type IN ('index', 'trigger') ORDER BY type, name",
    )
    .all(tableName);
}

function summarizeAppCompatibility(db, dependencies) {
  const lookup = db
    .prepare(
      `SELECT
         (SELECT count(*) FROM orders WHERE public_id IS NOT NULL) AS legacy_lookup_rows,
         (SELECT count(*)
            FROM orders AS legacy
            JOIN orders AS by_public
              ON by_public.public_id = legacy.public_id
           WHERE legacy.public_id IS NOT NULL) AS public_lookup_rows,
         (SELECT count(*)
            FROM orders AS legacy
           WHERE legacy.public_id IS NOT NULL
             AND NOT EXISTS (
               SELECT 1
                 FROM orders AS by_public
                WHERE by_public.public_id = legacy.public_id
                  AND by_public.id = legacy.id
             )) AS lookup_mismatches`,
    )
    .get();

  const shadow = dependencies.reduce(
    (summary, dependency) => {
      const shadowTable = quoteIdentifier(shadowTableName(dependency));
      const row = db
        .prepare(
          `SELECT
             count(*) AS rows,
             coalesce(sum(CASE WHEN order_public_id IS NULL THEN 1 ELSE 0 END), 0) AS missing,
             coalesce(sum(CASE
               WHEN NOT EXISTS (
                 SELECT 1
                   FROM orders
                  WHERE orders.id = ${shadowTable}.legacy_order_id
                    AND orders.public_id = ${shadowTable}.order_public_id
               )
               THEN 1
               ELSE 0
             END), 0) AS mismatches
             FROM ${shadowTable}`,
        )
        .get();
      return {
        rows: summary.rows + Number(row.rows ?? 0),
        missing: summary.missing + Number(row.missing ?? 0),
        mismatches: summary.mismatches + Number(row.mismatches ?? 0),
      };
    },
    { rows: 0, missing: 0, mismatches: 0 },
  );

  return {
    legacy_lookup_rows: Number(lookup.legacy_lookup_rows ?? 0),
    public_lookup_rows: Number(lookup.public_lookup_rows ?? 0),
    lookup_mismatches: Number(lookup.lookup_mismatches ?? 0),
    shadow_public_id_rows: shadow.rows,
    shadow_public_id_missing: shadow.missing,
    shadow_public_id_mismatches: shadow.mismatches,
  };
}

function run(db, sql, params = []) {
  db.prepare(sql).run(...params);
}

function insertRepresentativeFixture(db) {
  const now = Date.now();
  const orderId = -910001;
  const userId = -910001;
  const tableId = -910001;
  const seatId = -910001;
  const categoryId = -910001;
  const menuItemId = -910001;
  const couponId = -910001;
  const prefix = "phase-c-orders-pk";
  const restaurantId = `${prefix}-restaurant`;
  const registerId = `${prefix}-register`;
  const shiftId = `${prefix}-shift`;
  const marketId = `${prefix}-market`;
  const checkoutId = `${prefix}-checkout`;
  const partnershipId = `${prefix}-partnership`;
  const planId = `${prefix}-plan`;
  const memberId = `${prefix}-member`;
  const paymentTransactionId = `${prefix}-payment`;

  run(
    db,
    `INSERT INTO restaurants (
      id, name, type, category, address, district, phone, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      restaurantId,
      "Phase C Drill Restaurant",
      "restaurant",
      "test",
      "Phase C Address",
      "Phase C District",
      "0000000000",
      now,
      now,
    ],
  );
  run(
    db,
    `INSERT INTO users (
      id, username, full_name, password_hash, role, restaurant_id, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      `${prefix}-owner`,
      "Phase C Owner",
      "not-a-real-password-hash",
      1,
      restaurantId,
      now,
      now,
    ],
  );
  run(
    db,
    `INSERT INTO tables (
      id, restaurant_id, number, qr_code, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [tableId, restaurantId, "PC-1", `${prefix}-table-qr`, now, now],
  );
  run(
    db,
    `INSERT INTO seats (
      id, table_id, seat_number, qr_code, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [seatId, tableId, "S1", `${prefix}-seat-qr`, now, now],
  );
  run(
    db,
    `INSERT INTO orders (
      id, public_id, restaurant_id, table_id, order_number, status,
      subtotal_cents, tax_amount_cents, service_charge_cents,
      discount_amount_cents, total_amount_cents, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId,
      "018f0000-0000-7000-8000-00000000c001",
      restaurantId,
      tableId,
      `${prefix}-order`,
      "paid",
      1000,
      0,
      0,
      0,
      1000,
      now,
      now,
    ],
  );
  run(db, "UPDATE tables SET current_order_id = ? WHERE id = ?", [
    orderId,
    tableId,
  ]);
  run(db, "UPDATE seats SET current_order_id = ? WHERE id = ?", [
    orderId,
    seatId,
  ]);
  run(
    db,
    `INSERT INTO categories (
      id, restaurant_id, name, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?)`,
    [categoryId, restaurantId, "Phase C Category", now, now],
  );
  run(
    db,
    `INSERT INTO menu_items (
      id, restaurant_id, category_id, name, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [menuItemId, restaurantId, categoryId, "Phase C Item", now, now],
  );
  run(
    db,
    `INSERT INTO order_items (
      order_id, menu_item_id, quantity, unit_price_cents, total_price_cents,
      created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [orderId, menuItemId, 1, 1000, 1000, now, now],
  );
  run(
    db,
    `INSERT INTO payment_transactions (
      transaction_id, order_id, restaurant_id, amount_cents, payment_method,
      status, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      paymentTransactionId,
      orderId,
      restaurantId,
      1000,
      "cash",
      "paid",
      now,
      now,
    ],
  );
  run(
    db,
    `INSERT INTO refund_transactions (
      refund_id, payment_transaction_id, order_id, restaurant_id, amount_cents,
      status, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `${prefix}-refund-transaction`,
      paymentTransactionId,
      orderId,
      restaurantId,
      100,
      "completed",
      now,
      now,
    ],
  );
  run(
    db,
    `INSERT INTO cash_registers (
      id, name, restaurant_id, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?)`,
    [registerId, "Phase C Register", restaurantId, now, now],
  );
  run(
    db,
    `INSERT INTO cash_shifts (
      id, register_id, operator_id, started_at_ms
    ) VALUES (?, ?, ?, ?)`,
    [shiftId, registerId, userId, now],
  );
  run(
    db,
    `INSERT INTO receipts (
      id, order_id, register_id, shift_id, receipt_number, receipt_type,
      content, created_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `${prefix}-receipt`,
      orderId,
      registerId,
      shiftId,
      `${prefix}-receipt-no`,
      "customer",
      "{}",
      now,
    ],
  );
  run(
    db,
    `INSERT INTO refunds (
      id, original_order_id, register_id, shift_id, refund_number,
      refund_type, refund_amount_cents, refund_method, reason_code,
      processed_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `${prefix}-refund`,
      orderId,
      registerId,
      shiftId,
      `${prefix}-refund-no`,
      "partial",
      100,
      "cash",
      "phase_c",
      userId,
    ],
  );
  run(
    db,
    `INSERT INTO platform_orders (
      order_id, platform, platform_order_id, restaurant_id, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [orderId, "uber_eats", `${prefix}-platform-order`, restaurantId, now, now],
  );
  run(
    db,
    `INSERT INTO coupons (
      id, code, name, discount_type, valid_from, valid_to,
      restaurant_id, created_by, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      couponId,
      `${prefix}-coupon`,
      "Phase C Coupon",
      "fixed_amount",
      "2026-01-01",
      "2026-12-31",
      restaurantId,
      userId,
      now,
      now,
    ],
  );
  run(
    db,
    `INSERT INTO coupon_usage (
      coupon_id, order_id, user_id, discount_amount_cents,
      used_at_ms, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [couponId, orderId, userId, 100, now, now, now],
  );
  run(
    db,
    `INSERT INTO markets (
      id, slug, name, type, city, district, address, latitude, longitude,
      created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      marketId,
      `${prefix}-market`,
      "Phase C Market",
      "market",
      "Taipei",
      "Phase C District",
      "Phase C Market Address",
      0,
      0,
      now,
      now,
    ],
  );
  run(
    db,
    `INSERT INTO market_checkout_sessions (
      id, market_id, market_slug, market_name, subtotal_cents,
      created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      checkoutId,
      marketId,
      `${prefix}-market`,
      "Phase C Market",
      1000,
      now,
      now,
    ],
  );
  run(
    db,
    `INSERT INTO market_checkout_child_orders (
      checkout_id, restaurant_id, restaurant_name, order_id, order_number,
      total_amount_cents, token_expires_at_ms, created_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      checkoutId,
      restaurantId,
      "Phase C Drill Restaurant",
      orderId,
      `${prefix}-order`,
      1000,
      now + 3600000,
      now,
    ],
  );
  run(
    db,
    `INSERT INTO group_orders (
      id, share_code, master_order_id, created_by, restaurant_id, table_id,
      expires_at_ms, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `${prefix}-group`,
      `${prefix}-share`,
      orderId,
      userId,
      restaurantId,
      tableId,
      now + 3600000,
      now,
      now,
    ],
  );
  run(
    db,
    `INSERT INTO partnerships (
      id, partner_code, partner_name, partner_type, contact_person,
      contact_phone, contact_email, contract_start_date_ms, contract_end_date_ms,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      partnershipId,
      `${prefix}-partner-code`,
      "Phase C Partner",
      "corporate",
      "Phase C Contact",
      "0000000000",
      "phase-c@example.test",
      now,
      now + 86400000,
      userId,
    ],
  );
  run(
    db,
    `INSERT INTO partnership_plans (
      id, partnership_id, restaurant_id, plan_code, plan_name, discount_type,
      valid_from_ms, valid_to_ms, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      planId,
      partnershipId,
      restaurantId,
      `${prefix}-plan-code`,
      "Phase C Plan",
      "percentage",
      now,
      now + 86400000,
      userId,
    ],
  );
  run(
    db,
    `INSERT INTO verified_members (
      id, partnership_id, member_id, member_type, full_name, verification_method,
      verified_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      memberId,
      partnershipId,
      `${prefix}-member-code`,
      "employee",
      "Phase C Member",
      "manual",
      userId,
    ],
  );
  run(
    db,
    `INSERT INTO partnership_usage_logs (
      id, partnership_id, plan_id, member_id, order_id, restaurant_id,
      discount_type, status, verified_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `${prefix}-usage`,
      partnershipId,
      planId,
      memberId,
      orderId,
      restaurantId,
      "percentage",
      "pending",
      userId,
    ],
  );
}

function runLocalRehearsal(options) {
  const Database = require("better-sqlite3");
  const sqlitePath = options.sqlitePath
    ? path.resolve(options.sqlitePath)
    : findLocalSqlitePath();
  const db = new Database(sqlitePath, { readonly: false });
  const dependencies = existingDependencies(db);
  const skipped = ORDER_DEPENDENCIES.filter(
    (dependency) => !dependencies.includes(dependency),
  );
  const result = {
    artifactPhase: "orders",
    artifactSchemaVersion: ARTIFACT_SCHEMA_VERSION,
    sqlitePath,
    rehearsalOptions: {
      withFixture: Boolean(options.withFixture),
      requireRepresentativeData: Boolean(options.requireRepresentativeData),
      requireCompleteSurfaceCoverage: Boolean(
        options.requireCompleteSurfaceCoverage,
      ),
    },
    dependencyCount: dependencies.length,
    skippedDependencies: skipped.map((dependency) => ({
      table: dependency.table,
      column: dependency.column,
    })),
    ordersBridge: null,
    dependencies: [],
    appCompatibility: null,
    foreignKeyCheck: [],
  };

  try {
    db.pragma("foreign_keys = ON");
    db.exec("BEGIN");
    try {
      if (options.withFixture) {
        insertRepresentativeFixture(db);
        result.fixture = { inserted: true };
      } else {
        result.fixture = { inserted: false };
      }

      db.exec(`CREATE TEMP TABLE __phase_c_order_dependencies (
        dependency_order INTEGER PRIMARY KEY,
        table_name TEXT NOT NULL,
        column_name TEXT NOT NULL,
        relation_kind TEXT NOT NULL,
        nullability TEXT NOT NULL,
        on_delete TEXT NOT NULL,
        write_paths TEXT NOT NULL
      )`);

      const insertDependency = db.prepare(
        `INSERT INTO __phase_c_order_dependencies (
          dependency_order,
          table_name,
          column_name,
          relation_kind,
          nullability,
          on_delete,
          write_paths
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );

      dependencies.forEach((dependency, index) => {
        insertDependency.run(
          index + 1,
          dependency.table,
          dependency.column,
          dependency.kind,
          dependency.nullability,
          dependency.onDelete,
          dependency.writePaths.join(", "),
        );
      });

      result.ordersBridge = db
        .prepare(
          `SELECT count(*) AS order_rows,
                  coalesce(sum(CASE WHEN public_id IS NULL THEN 1 ELSE 0 END), 0) AS missing_public_id,
                  count(public_id) - count(DISTINCT public_id) AS duplicate_public_id
             FROM orders`,
        )
        .get();

      for (const dependency of dependencies) {
        const table = quoteIdentifier(dependency.table);
        const column = quoteIdentifier(dependency.column);
        const shadow = quoteIdentifier(shadowTableName(dependency));

        db.exec(`CREATE TEMP TABLE ${shadow} AS
          SELECT child.rowid AS source_rowid,
                 child.${column} AS legacy_order_id,
                 orders.public_id AS order_public_id
            FROM ${table} AS child
            JOIN orders ON orders.id = child.${column}
           WHERE child.${column} IS NOT NULL`);

        const counts = db
          .prepare(
            `SELECT
               (SELECT count(*) FROM ${table}) AS total_rows,
               (SELECT count(*) FROM ${table} WHERE ${column} IS NOT NULL) AS non_null_order_refs,
               (SELECT count(*) FROM ${shadow}) AS mapped_order_refs,
               (SELECT count(*) FROM ${table} AS child
                 WHERE child.${column} IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM orders WHERE orders.id = child.${column})) AS unmapped_order_refs`,
          )
          .get();

        result.dependencies.push({
          table: dependency.table,
          column: dependency.column,
          kind: dependency.kind,
          nullability: dependency.nullability,
          onDelete: dependency.onDelete,
          writePaths: dependency.writePaths,
          ...counts,
          schemaObjects: readIndexesAndTriggers(db, dependency.table),
        });
      }

      result.appCompatibility = summarizeAppCompatibility(db, dependencies);
      result.foreignKeyCheck = db.prepare("PRAGMA foreign_key_check").all();
      result.dataCoverage = summarizeDataCoverage(result);
    } finally {
      db.exec("ROLLBACK");
    }
  } finally {
    db.close();
  }

  return result;
}

function summarizeDataCoverage(result) {
  const orderRows = Number(result.ordersBridge?.order_rows ?? 0);
  const dependenciesWithRefs = result.dependencies.filter(
    (dependency) => Number(dependency.non_null_order_refs) > 0,
  );
  const dependencyRefs = result.dependencies.reduce((total, dependency) => {
    return total + Number(dependency.non_null_order_refs ?? 0);
  }, 0);
  return {
    orderRows,
    dependencyRefs,
    dependenciesWithRefs: dependenciesWithRefs.length,
    dependencyCount: result.dependencies.length,
    isRepresentative: orderRows > 0 && dependencyRefs > 0,
  };
}

function assessRehearsalResult(result, options = {}) {
  const failures = [];
  if (Number(result.ordersBridge?.missing_public_id ?? 0) > 0) {
    failures.push("orders.public_id bridge has missing values");
  }
  if (Number(result.ordersBridge?.duplicate_public_id ?? 0) > 0) {
    failures.push("orders.public_id bridge has duplicate values");
  }

  for (const dependency of result.dependencies) {
    if (Number(dependency.unmapped_order_refs) > 0) {
      failures.push(
        `${dependency.table}.${dependency.column} has unmapped order references`,
      );
    }
    if (
      Number(dependency.mapped_order_refs) !==
      Number(dependency.non_null_order_refs)
    ) {
      failures.push(
        `${dependency.table}.${dependency.column} failed shadow-copy row-count parity`,
      );
    }
  }

  if (result.foreignKeyCheck.length > 0) {
    failures.push("PRAGMA foreign_key_check returned rows");
  }

  if (options.requireRepresentativeData) {
    const coverage = result.dataCoverage ?? summarizeDataCoverage(result);
    if (coverage.orderRows === 0) {
      failures.push("representative data required: orders table has no rows");
    }
    if (coverage.dependencyRefs === 0) {
      failures.push(
        "representative data required: no checked dependency has non-null order references",
      );
    }
  }

  if (options.requireCompleteSurfaceCoverage) {
    if (!result.appCompatibility) {
      failures.push("orders UUID bridge compatibility summary is missing");
    } else {
      if (Number(result.appCompatibility.public_lookup_rows ?? 0) === 0) {
        failures.push("orders UUID bridge public-id lookup returned no rows");
      }
      if (Number(result.appCompatibility.lookup_mismatches ?? 0) > 0) {
        failures.push("orders UUID bridge legacy/public lookup mismatch");
      }
      if (Number(result.appCompatibility.shadow_public_id_missing ?? 0) > 0) {
        failures.push(
          "orders UUID bridge shadow copies contain missing public ids",
        );
      }
      if (
        Number(result.appCompatibility.shadow_public_id_mismatches ?? 0) > 0
      ) {
        failures.push(
          "orders UUID bridge shadow public ids do not resolve back to source orders",
        );
      }
    }

    for (const dependency of result.dependencies) {
      if (Number(dependency.non_null_order_refs ?? 0) === 0) {
        failures.push(
          `${dependency.table}.${dependency.column} has no representative order references`,
        );
      }
      if (!Array.isArray(dependency.schemaObjects)) {
        failures.push(
          `${dependency.table}.${dependency.column} is missing schema object metadata`,
        );
      }
    }
  }

  return {
    exitCode: failures.length > 0 ? 1 : 0,
    failures,
  };
}

function executeLocal(options) {
  const result = runLocalRehearsal(options);
  result.assessment = assessRehearsalResult(result, {
    requireRepresentativeData: options.requireRepresentativeData,
    requireCompleteSurfaceCoverage: options.requireCompleteSurfaceCoverage,
  });
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (options.jsonOutput) {
    const outputPath = path.resolve(options.jsonOutput);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, json, "utf8");
  }
  process.stdout.write(json);
  return result.assessment.exitCode;
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
      process.exit(0);
    }

    if (args.executeLocal) {
      process.exit(executeLocal(args));
    }

    console.log(buildDryRunSql());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exit(1);
  }
}

module.exports = {
  ARTIFACT_SCHEMA_VERSION,
  ORDER_DEPENDENCIES,
  assessRehearsalResult,
  buildDryRunSql,
  findLocalSqlitePath,
  parseArgs,
  runLocalRehearsal,
  summarizeAppCompatibility,
  summarizeDataCoverage,
};
