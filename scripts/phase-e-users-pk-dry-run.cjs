#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_D1_STATE_DIR =
  "apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject";

const USER_DEPENDENCIES = [
  ["sessions", "user_id", "fk", "not_null", "cascade"],
  ["password_reset_tokens", "user_id", "fk", "not_null", "cascade"],
  ["email_verification_tokens", "user_id", "fk", "not_null", "cascade"],
  ["phone_verification_tokens", "user_id", "fk", "not_null", "cascade"],
  ["password_change_logs", "user_id", "fk", "not_null", "cascade"],
  ["audit_logs", "user_id", "fk", "nullable", "no_action"],
  ["audit_logs", "on_behalf_of_user_id", "fk", "nullable", "no_action"],
  ["cash_shifts", "operator_id", "fk", "not_null", "no_action"],
  ["cash_movements", "recorded_by", "fk", "not_null", "no_action"],
  ["cash_movements", "approved_by", "fk", "nullable", "no_action"],
  ["refunds", "processed_by", "fk", "not_null", "no_action"],
  ["refunds", "approved_by", "fk", "nullable", "no_action"],
  ["shift_reports", "operator_id", "fk", "not_null", "no_action"],
  ["group_orders", "created_by", "fk", "not_null", "no_action"],
  ["group_members", "user_id", "fk", "nullable", "no_action"],
  ["share_codes", "created_by", "fk", "not_null", "no_action"],
  ["partnerships", "created_by", "fk", "nullable", "set_null"],
  ["partnership_plans", "created_by", "fk", "nullable", "set_null"],
  ["verified_members", "verified_by", "fk", "nullable", "set_null"],
  [
    "partnership_usage_logs",
    "verified_by_user_id",
    "fk",
    "nullable",
    "set_null",
  ],
  ["coupons", "created_by", "fk", "nullable", "set_null"],
  ["coupon_usage", "user_id", "fk", "nullable", "set_null"],
  ["coupon_distributions", "created_by", "fk", "nullable", "set_null"],
  ["coupon_templates", "created_by", "fk", "nullable", "set_null"],
  ["employee_availability", "employee_id", "fk", "not_null", "cascade"],
  ["employee_schedules", "employee_id", "fk", "not_null", "cascade"],
  ["employee_schedules", "confirmed_by", "fk", "nullable", "no_action"],
  ["employee_schedules", "created_by", "fk", "not_null", "no_action"],
  ["employee_schedules", "updated_by", "fk", "nullable", "no_action"],
  [
    "schedule_swap_requests",
    "requester_employee_id",
    "fk",
    "not_null",
    "cascade",
  ],
  ["schedule_swap_requests", "target_employee_id", "fk", "nullable", "cascade"],
  ["schedule_swap_requests", "accepted_by", "fk", "nullable", "no_action"],
  ["schedule_swap_requests", "approved_by", "fk", "nullable", "no_action"],
  ["schedule_swap_requests", "rejected_by", "fk", "nullable", "no_action"],
  ["shift_templates", "created_by", "fk", "nullable", "no_action"],
  ["shift_templates", "updated_by", "fk", "nullable", "no_action"],
  ["scheduling_rules", "created_by", "fk", "not_null", "no_action"],
  ["scheduling_rules", "updated_by", "fk", "nullable", "no_action"],
  ["scheduling_conflicts", "resolved_by", "fk", "nullable", "no_action"],
  ["employee_leave_balances", "employee_id", "fk", "not_null", "cascade"],
  ["employee_leave_balances", "adjusted_by", "fk", "nullable", "no_action"],
  ["employee_leave_balances", "last_updated_by", "fk", "nullable", "no_action"],
  ["leave_requests", "employee_id", "fk", "not_null", "cascade"],
  ["leave_requests", "final_approver_id", "fk", "nullable", "no_action"],
  ["leave_requests", "rejected_by", "fk", "nullable", "no_action"],
  ["leave_requests", "cancelled_by", "fk", "nullable", "no_action"],
  [
    "leave_approval_rules",
    "escalation_to_user_id",
    "fk",
    "nullable",
    "no_action",
  ],
  ["leave_approval_rules", "created_by", "fk", "not_null", "no_action"],
  ["leave_approval_rules", "updated_by", "fk", "nullable", "no_action"],
  ["leave_calendar_events", "created_by", "fk", "nullable", "no_action"],
  ["leave_types", "created_by", "fk", "nullable", "no_action"],
  ["leave_types", "updated_by", "fk", "nullable", "no_action"],
  ["service_bookings", "employee_id", "fk", "nullable", "set_null"],
  ["service_booking_waitlist", "employee_id", "fk", "nullable", "set_null"],
  ["shop_feedback", "user_id", "actor_pointer", "not_null", "none"],
  ["feedback_responses", "user_id", "actor_pointer", "not_null", "none"],
  ["error_reports", "user_id", "actor_pointer", "not_null", "none"],
  ["error_reports", "resolved_by", "actor_pointer", "nullable", "none"],
  ["qr_codes", "created_by", "legacy_fk", "nullable", "no_action"],
  ["qr_templates", "created_by", "legacy_fk", "nullable", "no_action"],
  ["qr_batches", "created_by", "legacy_fk", "not_null", "no_action"],
  ["qr_downloads", "user_id", "legacy_fk", "nullable", "no_action"],
  ["qr_scans", "user_id", "legacy_fk", "nullable", "no_action"],
  ["blacklisted_tokens", "user_id", "legacy_fk", "not_null", "cascade"],
  ["order_status_history", "changed_by", "legacy_fk", "not_null", "cascade"],
  ["customer_reviews", "user_id", "legacy_fk", "not_null", "cascade"],
  ["survey_responses", "user_id", "legacy_fk", "nullable", "no_action"],
].map(([table, column, kind, nullability, onDelete]) => ({
  table,
  column,
  kind,
  nullability,
  onDelete,
  writePaths: inferWritePaths(table),
}));

function inferWritePaths(table) {
  const byTable = {
    sessions: ["packages/database/src/services/auth.ts"],
    password_reset_tokens: [
      "packages/database/src/services/VerificationService.ts",
    ],
    email_verification_tokens: [
      "packages/database/src/services/VerificationService.ts",
    ],
    phone_verification_tokens: [
      "packages/database/src/services/VerificationService.ts",
    ],
    password_change_logs: [
      "packages/database/src/services/VerificationService.ts",
    ],
    audit_logs: [
      "apps/api/src/features/audit",
      "packages/database/src/schema/audit-logs.ts",
    ],
    cash_shifts: ["apps/api/src/features/pos/services/ShiftService.ts"],
    cash_movements: [
      "apps/api/src/features/pos/services/CashMovementService.ts",
    ],
    refunds: ["apps/api/src/features/pos/services/RefundService.ts"],
    shift_reports: ["apps/api/src/features/pos/services/ReportService.ts"],
    group_orders: [
      "apps/api/src/features/group-orders/services/GroupOrdersService.ts",
    ],
    group_members: [
      "apps/api/src/features/group-orders/services/GroupOrdersService.ts",
    ],
    share_codes: [
      "apps/api/src/features/group-orders/services/GroupOrdersService.ts",
    ],
    partnerships: ["packages/database/src/services/PartnershipService.ts"],
    partnership_plans: ["packages/database/src/services/PartnershipService.ts"],
    verified_members: ["packages/database/src/services/PartnershipService.ts"],
    partnership_usage_logs: [
      "packages/database/src/services/PartnershipService.ts",
    ],
    coupons: [
      "packages/database/src/services/coupon.ts",
      "apps/api/src/features/coupons",
    ],
    coupon_usage: [
      "packages/database/src/services/coupon.ts",
      "packages/database/src/services/order.ts",
    ],
    coupon_distributions: ["packages/database/src/services/coupon.ts"],
    coupon_templates: ["packages/database/src/services/coupon.ts"],
    employee_availability: [
      "packages/database/src/services/SchedulingService.ts",
    ],
    employee_schedules: ["packages/database/src/services/SchedulingService.ts"],
    schedule_swap_requests: [
      "packages/database/src/services/SchedulingService.ts",
    ],
    shift_templates: ["packages/database/src/services/SchedulingService.ts"],
    scheduling_rules: ["packages/database/src/services/SchedulingService.ts"],
    scheduling_conflicts: [
      "packages/database/src/services/SchedulingService.ts",
    ],
    employee_leave_balances: ["packages/database/src/services/LeaveService.ts"],
    leave_requests: ["packages/database/src/services/LeaveService.ts"],
    leave_approval_rules: ["packages/database/src/services/LeaveService.ts"],
    leave_calendar_events: ["packages/database/src/services/LeaveService.ts"],
    leave_types: ["packages/database/src/services/LeaveService.ts"],
    service_bookings: ["packages/database/src/schema/service-bookings.ts"],
    service_booking_waitlist: [
      "packages/database/src/schema/service-bookings.ts",
    ],
    shop_feedback: [
      "apps/api/src/features/feedback",
      "packages/database/src/schema/feedback.ts",
    ],
    feedback_responses: [
      "apps/api/src/features/feedback",
      "packages/database/src/schema/feedback.ts",
    ],
    error_reports: [
      "apps/api/src/features/system",
      "packages/database/src/schema/error-reports.ts",
    ],
    qr_codes: ["apps/api/src/features/qr-codes/services/QrCodesService.ts"],
    qr_templates: ["apps/api/src/features/qr-codes/services/QrCodesService.ts"],
    qr_batches: ["apps/api/src/features/qr-codes/services/QrCodesService.ts"],
    qr_downloads: ["apps/api/src/features/qr-codes/services/QrCodesService.ts"],
    qr_scans: ["apps/api/src/features/qr-codes/services/QrCodesService.ts"],
    blacklisted_tokens: [
      "packages/database/migrations/0009_additional_tables.sql",
    ],
    order_status_history: [
      "packages/database/migrations/0009_additional_tables.sql",
    ],
    customer_reviews: [
      "packages/database/migrations/0009_additional_tables.sql",
    ],
    survey_responses: [
      "packages/database/migrations/0009_additional_tables.sql",
    ],
  };
  return byTable[table] ?? ["unmapped write path"];
}

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
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

function parseArgs(argv) {
  const args = {
    executeLocal: false,
    printInventory: false,
    sqlitePath: null,
    jsonOutput: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--execute-local") args.executeLocal = true;
    else if (arg === "--print-inventory") args.printInventory = true;
    else if (arg === "--sqlite-path") args.sqlitePath = argv[++index];
    else if (arg === "--json-output") args.jsonOutput = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/phase-e-users-pk-dry-run.cjs --print-inventory
  node scripts/phase-e-users-pk-dry-run.cjs --execute-local

Options:
  --sqlite-path <path> Local Miniflare SQLite file. Auto-detected by default.
  --json-output <path> Write local users PK drill JSON evidence to a file.
`;
}

function existingTables(db) {
  return new Set(
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
      .map((row) => row.name),
  );
}

function tableColumns(db, tableName) {
  return new Set(
    db
      .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
      .all()
      .map((row) => row.name),
  );
}

function readIndexesAndTriggers(db, tableName) {
  return db
    .prepare(
      "SELECT type, name, sql FROM sqlite_master WHERE tbl_name = ? AND type IN ('index', 'trigger') ORDER BY type, name",
    )
    .all(tableName);
}

function discoverUserForeignKeys(db, tables = existingTables(db)) {
  const refs = [];
  for (const table of [...tables].sort()) {
    for (const row of db
      .prepare(`PRAGMA foreign_key_list(${quoteIdentifier(table)})`)
      .all()) {
      if (row.table === "users" && row.to === "id") {
        refs.push({
          table,
          column: row.from,
          onDelete: String(row.on_delete).toLowerCase(),
        });
      }
    }
  }
  return refs;
}

function inventoryKey(dependency) {
  return `${dependency.table}.${dependency.column}`;
}

function summarizeDataCoverage(result) {
  const userRows = Number(result.usersBridge?.user_rows ?? 0);
  const dependencyRefs = result.dependencies.reduce((total, dependency) => {
    return total + Number(dependency.non_null_user_refs ?? 0);
  }, 0);
  const dependenciesWithRefs = result.dependencies.filter(
    (dependency) => Number(dependency.non_null_user_refs) > 0,
  ).length;
  return {
    userRows,
    dependencyRefs,
    dependenciesWithRefs,
    dependencyCount: result.dependencies.length,
    isRepresentative: userRows > 0 && dependencyRefs > 0,
  };
}

function assessRehearsalResult(result) {
  const failures = [];
  if (Number(result.usersBridge?.missing_public_id ?? 0) > 0) {
    failures.push("users.public_id bridge has missing values");
  }
  if (Number(result.usersBridge?.duplicate_public_id ?? 0) > 0) {
    failures.push("users.public_id bridge has duplicate values");
  }
  if (Number(result.usersBridge?.malformed_public_id ?? 0) > 0) {
    failures.push("users.public_id bridge has malformed UUID-v7 values");
  }
  for (const dependency of result.dependencies) {
    if (Number(dependency.unmapped_user_refs) > 0) {
      failures.push(
        `${dependency.table}.${dependency.column} has unmapped user references`,
      );
    }
    if (
      Number(dependency.mapped_user_refs) !==
      Number(dependency.non_null_user_refs)
    ) {
      failures.push(
        `${dependency.table}.${dependency.column} failed shadow-copy row-count parity`,
      );
    }
  }
  if (result.uninventoriedUserForeignKeys.length > 0) {
    failures.push("SQLite has users(id) foreign keys missing from inventory");
  }
  if (result.foreignKeyCheck.length > 0) {
    failures.push("PRAGMA foreign_key_check returned rows");
  }
  return {
    exitCode: failures.length > 0 ? 1 : 0,
    failures,
  };
}

function runLocalRehearsal(options) {
  const Database = require("better-sqlite3");
  const sqlitePath = options.sqlitePath
    ? path.resolve(options.sqlitePath)
    : findLocalSqlitePath();
  const db = new Database(sqlitePath, { readonly: false });
  const tables = existingTables(db);
  const inventory = USER_DEPENDENCIES.filter((dependency) => {
    return (
      tables.has(dependency.table) &&
      tableColumns(db, dependency.table).has(dependency.column)
    );
  });
  const skipped = USER_DEPENDENCIES.filter(
    (dependency) => !inventory.includes(dependency),
  );
  const inventoryKeys = new Set(inventory.map(inventoryKey));
  const discoveredUserForeignKeys = discoverUserForeignKeys(db, tables);
  const uninventoriedUserForeignKeys = discoveredUserForeignKeys.filter(
    (dependency) => !inventoryKeys.has(inventoryKey(dependency)),
  );

  const result = {
    sqlitePath,
    dependencyCount: inventory.length,
    skippedDependencies: skipped.map(({ table, column, kind }) => ({
      table,
      column,
      kind,
    })),
    discoveredUserForeignKeys,
    uninventoriedUserForeignKeys,
    usersBridge: null,
    dependencies: [],
    foreignKeyCheck: [],
  };

  try {
    db.pragma("foreign_keys = ON");
    db.exec("BEGIN");
    try {
      result.usersBridge = db
        .prepare(
          `SELECT count(*) AS user_rows,
                  coalesce(sum(CASE WHEN public_id IS NULL THEN 1 ELSE 0 END), 0) AS missing_public_id,
                  count(public_id) - count(DISTINCT public_id) AS duplicate_public_id,
                  coalesce(sum(CASE
                    WHEN public_id IS NOT NULL
                     AND public_id NOT GLOB '????????-????-7???-[89ab][0-9a-f][0-9a-f][0-9a-f]-????????????'
                    THEN 1 ELSE 0 END), 0) AS malformed_public_id
             FROM users`,
        )
        .get();

      for (const dependency of inventory) {
        const table = quoteIdentifier(dependency.table);
        const column = quoteIdentifier(dependency.column);
        const shadow = quoteIdentifier(
          `__phase_e_shadow_${dependency.table}_${dependency.column}`,
        );
        db.exec(`CREATE TEMP TABLE ${shadow} AS
          SELECT child.rowid AS source_rowid,
                 child.${column} AS legacy_user_id,
                 users.public_id AS user_public_id
            FROM ${table} AS child
            JOIN users ON users.id = child.${column}
           WHERE child.${column} IS NOT NULL`);

        const counts = db
          .prepare(
            `SELECT
               (SELECT count(*) FROM ${table}) AS total_rows,
               (SELECT count(*) FROM ${table} WHERE ${column} IS NOT NULL) AS non_null_user_refs,
               (SELECT count(*) FROM ${shadow}) AS mapped_user_refs,
               (SELECT count(*) FROM ${table} AS child
                 WHERE child.${column} IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = child.${column})) AS unmapped_user_refs`,
          )
          .get();
        result.dependencies.push({
          ...dependency,
          ...counts,
          schemaObjects: readIndexesAndTriggers(db, dependency.table),
        });
      }
      result.foreignKeyCheck = db.prepare("PRAGMA foreign_key_check").all();
      result.dataCoverage = summarizeDataCoverage(result);
    } finally {
      db.exec("ROLLBACK");
    }
  } finally {
    db.close();
  }
  result.assessment = assessRehearsalResult(result);
  return result;
}

function executeLocal(options) {
  const result = runLocalRehearsal(options);
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
    console.log(JSON.stringify(USER_DEPENDENCIES, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exit(1);
  }
}

module.exports = {
  USER_DEPENDENCIES,
  assessRehearsalResult,
  discoverUserForeignKeys,
  parseArgs,
  runLocalRehearsal,
  summarizeDataCoverage,
};
