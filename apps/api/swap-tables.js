// 直接操作 SQLite 資料庫來完成表交換
// 繞過 Wrangler 的事務限制問題

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require("better-sqlite3");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");

// 找到資料庫文件
const dbDir = path.join(
  __dirname,
  ".wrangler",
  "state",
  "v3",
  "d1",
  "miniflare-D1DatabaseObject",
);
let dbPath;

try {
  const dbFiles = fs.readdirSync(dbDir).filter((f) => f.endsWith(".sqlite"));
  if (dbFiles.length === 0) {
    console.error("找不到資料庫文件");
    process.exit(1);
  }
  dbPath = path.join(dbDir, dbFiles[0]);
} catch (err) {
  console.error("無法讀取資料庫目錄:", err.message);
  process.exit(1);
}

console.log(`操作資料庫: ${dbPath}`);

const db = new Database(dbPath);

try {
  // 開始事務
  db.exec("PRAGMA foreign_keys=OFF");
  db.exec("BEGIN TRANSACTION");

  console.log("\n步驟 1: DROP 舊表...");
  const tablesToDrop = [
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

  for (const table of tablesToDrop) {
    try {
      db.exec(`DROP TABLE IF EXISTS ${table}`);
      console.log(`  ✓ Dropped ${table}`);
    } catch (err) {
      console.log(`  ⚠ Failed to drop ${table}: ${err.message}`);
    }
  }

  console.log("\n步驟 2: RENAME _new 表...");
  const tablesToRename = [
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

  for (const table of tablesToRename) {
    try {
      db.exec(`ALTER TABLE ${table}_new RENAME TO ${table}`);
      console.log(`  ✓ Renamed ${table}_new → ${table}`);
    } catch (err) {
      console.log(`  ⚠ Failed to rename ${table}_new: ${err.message}`);
    }
  }

  // 提交事務
  db.exec("COMMIT");
  db.exec("PRAGMA foreign_keys=ON");

  console.log("\n✅ 表交換完成！");

  // 驗證
  console.log("\n驗證結果:");
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_new' ORDER BY name",
    )
    .all();
  console.log(`剩餘 _new 表數量: ${tables.length}`);
  if (tables.length > 0) {
    console.log("剩餘的 _new 表:", tables.map((t) => t.name).join(", "));
  }

  // 檢查 users 表的 restaurant_id 欄位類型
  const userSchema = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'",
    )
    .get();
  console.log("\nusers 表結構檢查:");
  if (userSchema && userSchema.sql.includes("restaurant_id TEXT")) {
    console.log("✅ restaurant_id 已經是 TEXT 類型");
  } else {
    console.log("⚠ restaurant_id 類型可能不正確");
  }

  // 檢查數據
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
  console.log(`\nusers 表記錄數: ${userCount.count}`);

  if (userCount.count > 0) {
    const samples = db
      .prepare("SELECT id, username, restaurant_id FROM users LIMIT 3")
      .all();
    console.log("範例數據:");
    samples.forEach((u) => {
      console.log(
        `  - id: ${u.id}, username: ${u.username}, restaurant_id: ${u.restaurant_id || "NULL"} (type: ${typeof u.restaurant_id})`,
      );
    });
  }
} catch (err) {
  console.error("❌ 錯誤:", err);
  try {
    db.exec("ROLLBACK");
  } catch {
    // ignore
  }
  process.exit(1);
} finally {
  db.close();
}
