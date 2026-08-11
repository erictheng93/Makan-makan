#!/usr/bin/env npx tsx
/**
 * MakanMasak Database Migrations v2.0 - Test Execution Script
 * Cross-platform TypeScript version
 *
 * Usage: npx tsx scripts/test-migrations-v2.ts
 * Purpose: Execute all 16 migrations to a test database and verify structure
 */

import { spawnSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

// ANSI colors for terminal output
const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
};

// Configuration
const DB_NAME = "makanmakan-test-v2";
const MIGRATIONS_DIR = "packages/database/migrations_v2";
const LOG_DIR = "logs";
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const LOG_FILE = join(LOG_DIR, `migration-test-${TIMESTAMP}.log`);

// Migration files
const MIGRATIONS = [
  "01_tenants_and_settings.sql",
  "02_authentication.sql",
  "03_audit_system.sql",
  "04_product_catalog.sql",
  "05_order_management.sql",
  "06_customer_management.sql",
  "07_table_and_seating.sql",
  "08_qr_code_system.sql",
  "09_shift_scheduling.sql",
  "10_leave_management.sql",
  "11_attendance_tracking.sql",
  "12_business_analytics.sql",
  "13_ai_insights.sql",
  "14_inventory_management.sql",
  "15_promotions_and_coupons.sql",
  "16_loyalty_program.sql",
];

// Expected counts
const EXPECTED = {
  tables: 67,
  indexes: 461,
  views: 60,
  triggers: 108,
};

let logBuffer = "";

function log(message: string) {
  console.log(message);
  logBuffer += message + "\n";
}

function runNpx(
  args: string[],
  silent = false,
): { success: boolean; output: string } {
  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(npxCmd, args, {
    encoding: "utf-8",
    stdio: silent ? "pipe" : "inherit",
    shell: false,
  });

  return {
    success: result.status === 0,
    output: result.stdout || "",
  };
}

function runWrangler(
  args: string[],
  silent = false,
): { success: boolean; output: string } {
  return runNpx(["wrangler", ...args], silent);
}

function getCount(query: string): number {
  const result = runWrangler(
    ["d1", "execute", DB_NAME, "--local", "--command", query, "--json"],
    true,
  );

  if (!result.success) return 0;

  const match = result.output.match(/"count":\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

async function main() {
  log(colors.blue("════════════════════════════════════════════════════════"));
  log(colors.blue("  MakanMasak Database Migrations v2.0 - Test Execution"));
  log(colors.blue("════════════════════════════════════════════════════════"));
  log("");

  // Create log directory
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }

  // Step 1: Check wrangler CLI
  log(colors.yellow("[1/6] Checking wrangler CLI..."));
  const whoami = runWrangler(["whoami"], true);
  if (whoami.success) {
    log(colors.green("✓ wrangler CLI is ready"));
  } else {
    log(colors.yellow("! wrangler not logged in, using local mode"));
  }
  log("");

  // Step 2: Prepare test database
  log(colors.yellow("[2/6] Preparing test database..."));
  log(`${colors.blue("Database name:")} ${DB_NAME}`);

  const dbList = runWrangler(["d1", "list"], true);
  const dbExists = dbList.output.includes(DB_NAME);

  if (!dbExists) {
    log("Creating new test database...");
    runWrangler(["d1", "create", DB_NAME]);
    log(colors.green("✓ Test database created"));
  } else {
    log(
      colors.yellow("! Test database already exists, using existing database"),
    );
  }
  log("");

  // Step 3: Execute migrations
  log(colors.yellow("[3/6] Executing all migrations..."));

  const failedMigrations: string[] = [];
  let successCount = 0;

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const migration = MIGRATIONS[i];
    const migrationFile = join(MIGRATIONS_DIR, migration);

    log(
      `${colors.blue(`[${i + 1}/${MIGRATIONS.length}]`)} Executing ${migration}...`,
    );

    if (!existsSync(migrationFile)) {
      log(colors.red(`  ✗ Migration file not found: ${migrationFile}`));
      failedMigrations.push(migration);
      continue;
    }

    const result = runWrangler(
      ["d1", "execute", DB_NAME, "--local", "--file", migrationFile],
      true,
    );

    if (result.success) {
      log(colors.green(`  ✓ ${migration} executed successfully`));
      successCount++;
    } else {
      log(colors.red(`  ✗ ${migration} execution failed`));
      failedMigrations.push(migration);
    }
  }

  log("");
  log(colors.green("✓ Migrations execution completed"));
  log(`  Success: ${successCount}/${MIGRATIONS.length}`);
  if (failedMigrations.length > 0) {
    log(colors.red(`  Failed: ${failedMigrations.length}`));
    log(colors.red(`  Failed migrations: ${failedMigrations.join(", ")}`));
  }
  log("");

  // Step 4: Verify database structure
  log(colors.yellow("[4/6] Verifying database structure..."));

  const tableCount = getCount(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  const indexCount = getCount(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'",
  );
  const viewCount = getCount(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='view'",
  );
  const triggerCount = getCount(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger'",
  );

  const verify = (label: string, expected: number, actual: number) => {
    log(`${colors.blue(`Checking ${label}...`)}`);
    log(`  Expected: ${expected}`);
    log(`  Actual: ${actual}`);
    if (actual === expected) {
      log(colors.green(`  ✓ ${label} count correct`));
      return true;
    } else {
      log(colors.yellow(`  ! ${label} count does not match expected`));
      return false;
    }
  };

  const tableOk = verify("tables", EXPECTED.tables, tableCount);
  const indexOk = verify("indexes", EXPECTED.indexes, indexCount);
  const viewOk = verify("views", EXPECTED.views, viewCount);
  const triggerOk = verify("triggers", EXPECTED.triggers, triggerCount);

  log("");
  log(colors.green("✓ Database structure verification completed"));
  log("");

  // Step 5: List all tables
  log(colors.yellow("[5/6] Listing all tables..."));
  const tablesResult = runWrangler(
    [
      "d1",
      "execute",
      DB_NAME,
      "--local",
      "--command",
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ],
    true,
  );
  if (tablesResult.output) {
    log(tablesResult.output);
  }
  log("");

  // Step 6: Generate test report
  log(colors.yellow("[6/6] Generating test report..."));

  const reportDir = "docs/migrations_v2";
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  const reportFile = join(reportDir, `TEST_REPORT_${TIMESTAMP}.md`);
  const allPassed =
    failedMigrations.length === 0 && tableOk && indexOk && viewOk && triggerOk;

  const reportContent = `# MakanMasak Migrations v2.0 - Test Report

**Test Date**: ${new Date().toISOString()}
**Test Database**: ${DB_NAME}

---

## Test Results Summary

| Item | Expected | Actual | Status |
|------|----------|--------|--------|
| Migrations Executed | ${MIGRATIONS.length} | ${successCount} | ${failedMigrations.length === 0 ? "✅" : "⚠️"} |
| Table Count | ${EXPECTED.tables} | ${tableCount} | ${tableOk ? "✅" : "⚠️"} |
| Index Count | ${EXPECTED.indexes} | ${indexCount} | ${indexOk ? "✅" : "⚠️"} |
| View Count | ${EXPECTED.views} | ${viewCount} | ${viewOk ? "✅" : "⚠️"} |
| Trigger Count | ${EXPECTED.triggers} | ${triggerCount} | ${triggerOk ? "✅" : "⚠️"} |

---

## Migration Execution Details

Success: ${successCount}/${MIGRATIONS.length}

${failedMigrations.length > 0 ? `Failed Migrations:\n${failedMigrations.map((m) => `- ${m}`).join("\n")}` : "All migrations executed successfully ✅"}

---

## Detailed Log

Full log available at: \`${LOG_FILE}\`

---

${allPassed ? "✅ **All tests passed!**" : "⚠️ **Some tests did not pass, please check the log**"}
`;

  writeFileSync(reportFile, reportContent);
  writeFileSync(LOG_FILE, logBuffer);

  log(colors.green(`✓ Test report generated: ${reportFile}`));
  log("");

  // Final summary
  log(colors.blue("════════════════════════════════════════════════════════"));
  log(colors.green("  Test execution completed!"));
  log(colors.blue("════════════════════════════════════════════════════════"));
  log("");
  log(`Test Report: ${reportFile}`);
  log(`Detailed Log: ${LOG_FILE}`);
  log("");

  if (allPassed) {
    log(colors.green("✅ All tests passed!"));
    process.exit(0);
  } else {
    log(colors.yellow("⚠️  Some tests did not pass, please check the log"));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(colors.red("Test execution failed:"), error.message);
  process.exit(1);
});
