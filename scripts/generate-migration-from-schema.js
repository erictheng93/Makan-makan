#!/usr/bin/env node

/**
 * 自動生成 Restaurant ID Migration SQL
 * 讀取實際表結構並生成正確的 migration 文件
 */

import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { join } from "path";

// 需要遷移的表列表（按順序）
const TABLES_BATCH_1 = [
  "users",
  "categories",
  "menu_items",
  "tables",
  "orders",
  "shift_templates",
  "employee_schedules",
  "scheduling_rules",
  "scheduling_conflicts",
  "schedule_swap_requests",
  "employee_availability",
  "leave_requests",
  "leave_approval_rules",
  "employee_leave_balances",
];

const TABLES_BATCH_2 = [
  "audit_logs",
  "error_reports",
  "system_alerts",
  "group_orders",
  "promotions",
  "customer_reviews",
  "inventory_items",
  "cash_registers",
  "printer_devices",
  "printer_configurations",
  "print_templates",
  "waiting_queue",
  "queue_settings",
  "queue_displays",
  "queue_events",
  "queue_statistics",
  "restaurant_settings",
  "restaurant_business_hours",
  "restaurant_special_hours",
  "table_reservations",
  "leave_calendar_events",
  "qr_batches",
  "qr_codes",
  "qr_templates",
];

const ALL_TABLES = [...TABLES_BATCH_1, ...TABLES_BATCH_2];

// 執行 wrangler 命令
function executeWrangler(command) {
  try {
    const result = execSync(
      `cd "C:\\Users\\minim\\OneDrive\\文档\\Code\\platform\\makanmakan\\apps\\api" && npx wrangler d1 execute makanmakan-local --local --command "${command}"`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
    );

    // 解析 JSON 輸出
    const lines = result.split("\n");
    const jsonStartIndex = lines.findIndex((line) =>
      line.trim().startsWith("["),
    );
    if (jsonStartIndex === -1) {
      throw new Error("No JSON found in output");
    }

    const jsonStr = lines.slice(jsonStartIndex).join("\n");
    const parsed = JSON.parse(jsonStr);

    return parsed[0].results;
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    console.error(error.message);
    return null;
  }
}

// 獲取表結構
function getTableSchema(tableName) {
  console.log(`  Fetching schema for ${tableName}...`);
  const result = executeWrangler(`PRAGMA table_info(${tableName})`);
  return result;
}

// 將 SQLite 類型映射到正確的 SQL 類型
function mapSqliteType(type) {
  const upperType = type.toUpperCase();
  if (upperType.includes("INT")) return "INTEGER";
  if (
    upperType.includes("TEXT") ||
    upperType.includes("CHAR") ||
    upperType.includes("CLOB")
  )
    return "TEXT";
  if (
    upperType.includes("REAL") ||
    upperType.includes("DOUBLE") ||
    upperType.includes("FLOAT")
  )
    return "REAL";
  if (upperType.includes("BLOB")) return "BLOB";
  if (upperType.includes("BOOL")) return "INTEGER"; // SQLite 使用 INTEGER 存儲 BOOLEAN
  if (
    upperType.includes("DATETIME") ||
    upperType.includes("DATE") ||
    upperType.includes("TIME")
  )
    return "TEXT"; // DATETIME → TEXT
  return upperType;
}

// 生成 CREATE TABLE 語句
function generateCreateTable(tableName, schema, isNew = false) {
  const newTableName = isNew ? `${tableName}_new` : tableName;
  let sql = `CREATE TABLE IF NOT EXISTS ${newTableName} (\n`;

  const columns = [];

  for (const col of schema) {
    let colDef = `    ${col.name} ${mapSqliteType(col.type)}`;

    // PRIMARY KEY
    if (col.pk === 1) {
      colDef += " PRIMARY KEY";
      if (col.name === "id" && mapSqliteType(col.type) === "INTEGER") {
        colDef += " AUTOINCREMENT";
      }
    }

    // NOT NULL
    if (col.notnull === 1 && col.pk !== 1) {
      colDef += " NOT NULL";
    }

    // DEFAULT
    if (
      col.dflt_value &&
      col.dflt_value !== "null" &&
      col.dflt_value !== "NULL"
    ) {
      // 處理特殊的 restaurant_id 欄位
      if (col.name === "restaurant_id" && isNew) {
        // 在 _new 表中，restaurant_id 改為 TEXT，移除 DEFAULT
        colDef = colDef.replace("INTEGER", "TEXT");
        // 不添加 DEFAULT，因為我們會在數據遷移時處理
      } else {
        // 如果 DEFAULT 值包含函數調用（如 strftime），需要用括號包裹
        if (
          col.dflt_value.includes("strftime") ||
          col.dflt_value.includes("(")
        ) {
          colDef += ` DEFAULT (${col.dflt_value})`;
        } else {
          colDef += ` DEFAULT ${col.dflt_value}`;
        }
      }
    } else if (col.name === "restaurant_id" && isNew) {
      // restaurant_id 在新表中改為 TEXT
      colDef = colDef.replace("INTEGER", "TEXT");
    }

    // UNIQUE
    // 注意：UNIQUE 約束通常在列定義中或通過 UNIQUE INDEX 實現
    // 這裡我們依賴原始表的 UNIQUE 約束

    columns.push(colDef);
  }

  sql += columns.join(",\n");

  // 添加外鍵約束（簡化版，實際需要從 schema 中提取）
  if (isNew) {
    // 如果有 restaurant_id，添加外鍵
    if (schema.find((col) => col.name === "restaurant_id")) {
      sql +=
        ",\n    FOREIGN KEY (restaurant_id) REFERENCES restaurants(public_id) ON DELETE CASCADE";
    }

    // 其他外鍵（需要根據實際情況調整）
    // 這裡我們簡化處理，實際應該從原表的 foreign_key_list 中獲取
  }

  sql += "\n);";

  return sql;
}

// 生成 INSERT INTO SELECT 語句
function generateDataMigration(tableName, schema) {
  const columns = schema.map((col) => col.name);
  const hasRestaurantId = schema.find((col) => col.name === "restaurant_id");
  const restaurantIdNotNull = hasRestaurantId && hasRestaurantId.notnull === 1;

  let sql = `INSERT INTO ${tableName}_new (\n`;
  sql += `    ${columns.join(", ")}\n`;
  sql += `) SELECT\n`;

  const selectCols = columns.map((col) => {
    if (col === "restaurant_id") {
      if (restaurantIdNotNull) {
        // NOT NULL 的 restaurant_id
        return `    r.public_id as restaurant_id`;
      } else {
        // nullable 的 restaurant_id
        return `    CASE\n        WHEN ${tableName[0]}.restaurant_id IS NOT NULL THEN r.public_id\n        ELSE NULL\n    END as restaurant_id`;
      }
    }
    return `    ${tableName[0]}.${col}`;
  });

  sql += selectCols.join(",\n");
  sql += `\nFROM ${tableName} ${tableName[0]}\n`;

  if (hasRestaurantId) {
    if (restaurantIdNotNull) {
      sql += `INNER JOIN restaurants r ON ${tableName[0]}.restaurant_id = r.id;`;
    } else {
      sql += `LEFT JOIN restaurants r ON ${tableName[0]}.restaurant_id = r.id;`;
    }
  } else {
    sql += ";";
  }

  return sql;
}

// 主函數
async function main() {
  console.log("🔍 Starting schema extraction...\n");

  const schemas = {};

  // 獲取所有表的結構
  console.log("📋 Fetching table schemas...");
  for (const tableName of ALL_TABLES) {
    const schema = getTableSchema(tableName);
    if (schema) {
      schemas[tableName] = schema;
      console.log(`  ✅ ${tableName} (${schema.length} columns)`);
    } else {
      console.log(`  ❌ ${tableName} - FAILED`);
    }
  }

  console.log(
    `\n✅ Fetched ${Object.keys(schemas).length}/${ALL_TABLES.length} table schemas\n`,
  );

  // 生成 0040 migration（表結構 - Batch 1）
  console.log("📝 Generating 0040 migration (table structures - batch 1)...");
  let migration0040 = `-- =====================================================
-- Migration: Restaurant ID 遷移 - 表結構 Part 1
-- Version: 0040 (自動生成)
-- Date: ${new Date().toISOString().split("T")[0]}
-- Description: 創建前 ${TABLES_BATCH_1.length} 張表的 _new 版本（使用 TEXT restaurant_id）
-- =====================================================

-- 禁用外鍵約束
PRAGMA foreign_keys=OFF;

-- =====================================================
-- 創建新表結構
-- =====================================================

`;

  for (const tableName of TABLES_BATCH_1) {
    if (schemas[tableName]) {
      migration0040 += `-- ${tableName} 表\n`;
      migration0040 += generateCreateTable(tableName, schemas[tableName], true);
      migration0040 += "\n\n";
    }
  }

  migration0040 += `-- 重新啟用外鍵約束\nPRAGMA foreign_keys=ON;\n`;

  writeFileSync(
    join(
      "C:\\Users\\minim\\OneDrive\\文档\\Code\\platform\\makanmakan\\packages\\database\\migrations",
      "0040_comprehensive_restaurant_id_migration.sql",
    ),
    migration0040,
  );
  console.log(
    "  ✅ Generated 0040_comprehensive_restaurant_id_migration.sql\n",
  );

  // 生成 0041 migration（表結構 - Batch 2）
  console.log("📝 Generating 0041 migration (table structures - batch 2)...");
  let migration0041 = `-- =====================================================
-- Migration: Restaurant ID 遷移 - 表結構 Part 2
-- Version: 0041 (自動生成)
-- Date: ${new Date().toISOString().split("T")[0]}
-- Description: 創建剩餘 ${TABLES_BATCH_2.length} 張表的 _new 版本（使用 TEXT restaurant_id）
-- =====================================================

-- 禁用外鍵約束
PRAGMA foreign_keys=OFF;

-- =====================================================
-- 創建新表結構
-- =====================================================

`;

  for (const tableName of TABLES_BATCH_2) {
    if (schemas[tableName]) {
      migration0041 += `-- ${tableName} 表\n`;
      migration0041 += generateCreateTable(tableName, schemas[tableName], true);
      migration0041 += "\n\n";
    }
  }

  migration0041 += `-- 重新啟用外鍵約束\nPRAGMA foreign_keys=ON;\n`;

  writeFileSync(
    join(
      "C:\\Users\\minim\\OneDrive\\文档\\Code\\platform\\makanmakan\\packages\\database\\migrations",
      "0041_remaining_tables_structure.sql",
    ),
    migration0041,
  );
  console.log("  ✅ Generated 0041_remaining_tables_structure.sql\n");

  // 生成 0042 migration（數據遷移 - Batch 1）
  console.log("📝 Generating 0042 migration (data migration - batch 1)...");
  let migration0042 = `-- =====================================================
-- Migration: Restaurant ID 遷移 - 數據遷移 Part 1
-- Version: 0042 (自動生成)
-- Date: ${new Date().toISOString().split("T")[0]}
-- Description: 遷移前 ${TABLES_BATCH_1.length} 張表的數據
-- =====================================================

-- 禁用外鍵約束
PRAGMA foreign_keys=OFF;

-- =====================================================
-- 數據遷移
-- =====================================================

`;

  for (const tableName of TABLES_BATCH_1) {
    if (schemas[tableName]) {
      migration0042 += `-- 遷移 ${tableName} 表數據\n`;
      migration0042 += generateDataMigration(tableName, schemas[tableName]);
      migration0042 += "\n\n";
    }
  }

  migration0042 += `-- 重新啟用外鍵約束\nPRAGMA foreign_keys=ON;\n`;

  writeFileSync(
    join(
      "C:\\Users\\minim\\OneDrive\\文档\\Code\\platform\\makanmakan\\packages\\database\\migrations",
      "0042_migrate_data_part1.sql",
    ),
    migration0042,
  );
  console.log("  ✅ Generated 0042_migrate_data_part1.sql\n");

  // 生成 0043 migration（數據遷移 - Batch 2）
  console.log("📝 Generating 0043 migration (data migration - batch 2)...");
  let migration0043 = `-- =====================================================
-- Migration: Restaurant ID 遷移 - 數據遷移 Part 2
-- Version: 0043 (自動生成)
-- Date: ${new Date().toISOString().split("T")[0]}
-- Description: 遷移剩餘 ${TABLES_BATCH_2.length} 張表的數據
-- =====================================================

-- 禁用外鍵約束
PRAGMA foreign_keys=OFF;

-- =====================================================
-- 數據遷移
-- =====================================================

`;

  for (const tableName of TABLES_BATCH_2) {
    if (schemas[tableName]) {
      migration0043 += `-- 遷移 ${tableName} 表數據\n`;
      migration0043 += generateDataMigration(tableName, schemas[tableName]);
      migration0043 += "\n\n";
    }
  }

  migration0043 += `-- 重新啟用外鍵約束\nPRAGMA foreign_keys=ON;\n`;

  writeFileSync(
    join(
      "C:\\Users\\minim\\OneDrive\\文档\\Code\\platform\\makanmakan\\packages\\database\\migrations",
      "0043_migrate_data_part2.sql",
    ),
    migration0043,
  );
  console.log("  ✅ Generated 0043_migrate_data_part2.sql\n");

  console.log("🎉 All migrations generated successfully!");
  console.log("\n📊 Summary:");
  console.log(`  - Batch 1: ${TABLES_BATCH_1.length} tables`);
  console.log(`  - Batch 2: ${TABLES_BATCH_2.length} tables`);
  console.log(`  - Total: ${ALL_TABLES.length} tables`);
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
