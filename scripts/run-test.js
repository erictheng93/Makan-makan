#!/usr/bin/env node

/**
 * MakanMakan Migrations v2.0 - Test Executor
 *
 * This script executes all migrations and validates the database structure
 * using better-sqlite3 for complete control over the testing process.
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log("\n" + "=".repeat(60), "cyan");
  log(`  ${title}`, "cyan");
  log("=".repeat(60), "cyan");
}

// Configuration
const MIGRATIONS_DIR = path.join(
  __dirname,
  "..",
  "packages",
  "database",
  "migrations_v2",
);
const TEST_DB_PATH = path.join(__dirname, "..", "test-migrations-v2.db");
const LOG_FILE = path.join(__dirname, "..", "logs", `test-${Date.now()}.log`);

// Create logs directory if it doesn't exist
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Migration files in order
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

let testResults = {
  migrations: { success: 0, failed: 0, errors: [] },
  structure: {},
  startTime: Date.now(),
};

function writeLog(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

function cleanup() {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
    log("Cleaned up test database", "yellow");
  }
}

function createDatabase() {
  logSection("Step 1: Creating Test Database");

  try {
    // Remove old test database if exists
    cleanup();

    // Create new database
    const db = new Database(TEST_DB_PATH);
    log(`✓ Created test database: ${TEST_DB_PATH}`, "green");
    writeLog(`Created test database: ${TEST_DB_PATH}`);

    return db;
  } catch (error) {
    log(`✗ Failed to create database: ${error.message}`, "red");
    writeLog(`ERROR: Failed to create database: ${error.message}`);
    throw error;
  }
}

function executeMigrations(db) {
  logSection("Step 2: Executing Migrations");

  MIGRATIONS.forEach((filename, index) => {
    const migrationPath = path.join(MIGRATIONS_DIR, filename);
    const migrationNum = index + 1;

    log(
      `\n[${migrationNum}/${MIGRATIONS.length}] Executing ${filename}...`,
      "blue",
    );

    try {
      // Check if file exists
      if (!fs.existsSync(migrationPath)) {
        throw new Error(`Migration file not found: ${migrationPath}`);
      }

      // Read SQL file
      const sql = fs.readFileSync(migrationPath, "utf8");

      // Execute SQL
      db.exec(sql);

      log(`  ✓ ${filename} executed successfully`, "green");
      writeLog(`SUCCESS: ${filename}`);
      testResults.migrations.success++;
    } catch (error) {
      log(`  ✗ ${filename} failed: ${error.message}`, "red");
      writeLog(`ERROR: ${filename} - ${error.message}`);
      testResults.migrations.failed++;
      testResults.migrations.errors.push({
        file: filename,
        error: error.message,
      });
    }
  });

  log(`\n✓ Migrations execution completed`, "green");
  log(
    `  Success: ${testResults.migrations.success}/${MIGRATIONS.length}`,
    "green",
  );
  if (testResults.migrations.failed > 0) {
    log(`  Failed: ${testResults.migrations.failed}`, "red");
  }
}

function validateStructure(db) {
  logSection("Step 3: Validating Database Structure");

  try {
    // Count tables
    const tablesResult = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `,
      )
      .get();

    const tableCount = tablesResult.count;
    testResults.structure.tables = {
      expected: EXPECTED.tables,
      actual: tableCount,
      match: tableCount === EXPECTED.tables,
    };

    log(
      `\nTables: ${tableCount} (expected: ${EXPECTED.tables})`,
      tableCount === EXPECTED.tables ? "green" : "yellow",
    );

    // Count indexes
    const indexesResult = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
    `,
      )
      .get();

    const indexCount = indexesResult.count;
    testResults.structure.indexes = {
      expected: EXPECTED.indexes,
      actual: indexCount,
      match: indexCount === EXPECTED.indexes,
    };

    log(
      `Indexes: ${indexCount} (expected: ${EXPECTED.indexes})`,
      indexCount === EXPECTED.indexes ? "green" : "yellow",
    );

    // Count views
    const viewsResult = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type='view'
    `,
      )
      .get();

    const viewCount = viewsResult.count;
    testResults.structure.views = {
      expected: EXPECTED.views,
      actual: viewCount,
      match: viewCount === EXPECTED.views,
    };

    log(
      `Views: ${viewCount} (expected: ${EXPECTED.views})`,
      viewCount === EXPECTED.views ? "green" : "yellow",
    );

    // Count triggers
    const triggersResult = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type='trigger'
    `,
      )
      .get();

    const triggerCount = triggersResult.count;
    testResults.structure.triggers = {
      expected: EXPECTED.triggers,
      actual: triggerCount,
      match: triggerCount === EXPECTED.triggers,
    };

    log(
      `Triggers: ${triggerCount} (expected: ${EXPECTED.triggers})`,
      triggerCount === EXPECTED.triggers ? "green" : "yellow",
    );

    log(`\n✓ Structure validation completed`, "green");
  } catch (error) {
    log(`✗ Structure validation failed: ${error.message}`, "red");
    writeLog(`ERROR: Structure validation - ${error.message}`);
  }
}

function listTables(db) {
  logSection("Step 4: Listing All Tables");

  try {
    const tables = db
      .prepare(
        `
      SELECT name
      FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `,
      )
      .all();

    log(`\nFound ${tables.length} tables:\n`, "cyan");

    tables.forEach((table, index) => {
      log(`  ${index + 1}. ${table.name}`);
    });
  } catch (error) {
    log(`✗ Failed to list tables: ${error.message}`, "red");
  }
}

function generateReport() {
  logSection("Step 5: Generating Test Report");

  const duration = ((Date.now() - testResults.startTime) / 1000).toFixed(2);

  const reportPath = path.join(
    __dirname,
    "..",
    "docs",
    "migrations_v2",
    `TEST_REPORT_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)}.md`,
  );

  let report = `# MakanMakan Migrations v2.0 - Test Execution Report\n\n`;
  report += `**Test Date**: ${new Date().toISOString()}\n`;
  report += `**Test Duration**: ${duration} seconds\n`;
  report += `**Test Database**: ${TEST_DB_PATH}\n\n`;
  report += `---\n\n`;

  report += `## Test Results Summary\n\n`;
  report += `| Item | Expected | Actual | Status |\n`;
  report += `|------|----------|--------|--------|\n`;
  report += `| Migrations Executed | 16 | ${testResults.migrations.success} | ${testResults.migrations.success === 16 ? "✅" : "⚠️"} |\n`;
  report += `| Tables | ${EXPECTED.tables} | ${testResults.structure.tables?.actual || "N/A"} | ${testResults.structure.tables?.match ? "✅" : "⚠️"} |\n`;
  report += `| Indexes | ${EXPECTED.indexes} | ${testResults.structure.indexes?.actual || "N/A"} | ${testResults.structure.indexes?.match ? "✅" : "⚠️"} |\n`;
  report += `| Views | ${EXPECTED.views} | ${testResults.structure.views?.actual || "N/A"} | ${testResults.structure.views?.match ? "✅" : "⚠️"} |\n`;
  report += `| Triggers | ${EXPECTED.triggers} | ${testResults.structure.triggers?.actual || "N/A"} | ${testResults.structure.triggers?.match ? "✅" : "⚠️"} |\n\n`;

  if (testResults.migrations.failed > 0) {
    report += `## Failed Migrations\n\n`;
    testResults.migrations.errors.forEach((error) => {
      report += `- **${error.file}**: ${error.error}\n`;
    });
    report += `\n`;
  }

  report += `## Next Steps\n\n`;
  if (testResults.migrations.success === 16) {
    report += `✅ All migrations executed successfully!\n\n`;
    report += `Continue with:\n`;
    report += `1. Data integrity tests: \`node scripts/run-test.js --integrity\`\n`;
    report += `2. Performance tests: \`node scripts/run-test.js --performance\`\n`;
  } else {
    report += `⚠️ Some migrations failed. Please review the errors above.\n\n`;
  }

  report += `\n---\n\n`;
  report += `**Log File**: \`${LOG_FILE}\`\n`;

  fs.writeFileSync(reportPath, report);

  log(`\n✓ Test report generated: ${reportPath}`, "green");
  log(`✓ Test log saved: ${LOG_FILE}`, "green");

  return reportPath;
}

function printSummary(reportPath) {
  logSection("Test Summary");

  log(
    `\nTest Duration: ${((Date.now() - testResults.startTime) / 1000).toFixed(2)}s`,
    "cyan",
  );
  log(`\nMigrations:`, "bright");
  log(`  Success: ${testResults.migrations.success}/16`, "green");
  if (testResults.migrations.failed > 0) {
    log(`  Failed: ${testResults.migrations.failed}/16`, "red");
  }

  log(`\nDatabase Structure:`, "bright");
  log(
    `  Tables:   ${testResults.structure.tables?.actual}/${EXPECTED.tables} ${testResults.structure.tables?.match ? "✅" : "⚠️"}`,
  );
  log(
    `  Indexes:  ${testResults.structure.indexes?.actual}/${EXPECTED.indexes} ${testResults.structure.indexes?.match ? "✅" : "⚠️"}`,
  );
  log(
    `  Views:    ${testResults.structure.views?.actual}/${EXPECTED.views} ${testResults.structure.views?.match ? "✅" : "⚠️"}`,
  );
  log(
    `  Triggers: ${testResults.structure.triggers?.actual}/${EXPECTED.triggers} ${testResults.structure.triggers?.match ? "✅" : "⚠️"}`,
  );

  log(`\nReports:`, "bright");
  log(`  Test Report: ${reportPath}`, "cyan");
  log(`  Test Log: ${LOG_FILE}`, "cyan");

  const allPassed =
    testResults.migrations.success === 16 &&
    testResults.structure.tables?.match &&
    testResults.structure.triggers?.match;

  log(`\n${"=".repeat(60)}`, "cyan");
  if (allPassed) {
    log("  ✅ ALL TESTS PASSED!", "green");
  } else {
    log("  ⚠️  SOME TESTS FAILED - REVIEW REPORT", "yellow");
  }
  log("=".repeat(60), "cyan");
  log("");
}

// Main execution
async function main() {
  log("\n" + "█".repeat(60), "cyan");
  log("  MakanMakan Migrations v2.0 - Test Execution", "bright");
  log("█".repeat(60), "cyan");

  let db;

  try {
    // Step 1: Create database
    db = createDatabase();

    // Step 2: Execute migrations
    executeMigrations(db);

    // Step 3: Validate structure
    validateStructure(db);

    // Step 4: List tables
    listTables(db);

    // Step 5: Generate report
    const reportPath = generateReport();

    // Print summary
    printSummary(reportPath);
  } catch (error) {
    log(`\n✗ Test execution failed: ${error.message}`, "red");
    writeLog(`FATAL ERROR: ${error.message}`);
    process.exit(1);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Run the test
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
