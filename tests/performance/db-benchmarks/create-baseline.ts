/**
 * Create Performance Baseline Script
 *
 * Runs all database performance benchmarks and saves the results as a baseline
 * Usage: ts-node create-baseline.ts [version]
 */

import {
  DatabasePerformanceTester,
  PerformanceBaselineManager,
} from "./db-performance-tester";
import { createTestDB, cleanupTestDB } from "../../helpers/test-db";
import { fileURLToPath } from "node:url";

export interface BenchmarkQuery {
  name: string;
  query: string;
  params: any[];
  category: "menu" | "orders" | "tables" | "users" | "analytics";
}

export const BENCHMARK_QUERIES: BenchmarkQuery[] = [
  // Menu queries
  {
    name: "menu_items_by_restaurant",
    query:
      "SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = true ORDER BY sort_order LIMIT 50",
    params: ["perf_test_r1"],
    category: "menu",
  },
  {
    name: "menu_items_with_category",
    query: `
      SELECT mi.*, c.name as category_name
      FROM menu_items mi
      LEFT JOIN categories c ON mi.category_id = c.id
      WHERE mi.restaurant_id = ? AND mi.is_available = true
      ORDER BY c.sort_order, mi.sort_order
      LIMIT 50
    `,
    params: ["perf_test_r1"],
    category: "menu",
  },
  {
    name: "menu_search",
    query: `
      SELECT * FROM menu_items
      WHERE restaurant_id = ?
        AND is_available = true
        AND name LIKE ?
      LIMIT 20
    `,
    params: ["perf_test_r1", "%beef%"],
    category: "menu",
  },

  // Order queries
  {
    name: "orders_list",
    query:
      "SELECT * FROM orders WHERE restaurant_id = ? ORDER BY created_at_ms DESC LIMIT 20",
    params: ["perf_test_r1"],
    category: "orders",
  },
  {
    name: "orders_by_status",
    query:
      "SELECT * FROM orders WHERE restaurant_id = ? AND status = ? ORDER BY created_at_ms DESC",
    params: ["perf_test_r1", "pending"],
    category: "orders",
  },
  {
    name: "order_with_items",
    query: `
      SELECT
        o.*,
        json_group_array(
          json_object(
            'id', oi.id,
            'menu_item_id', oi.menu_item_id,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'item_name', mi.name
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.id = ?
      GROUP BY o.id
    `,
    params: [1],
    category: "orders",
  },

  // Table queries
  {
    name: "tables_list",
    query:
      "SELECT * FROM tables WHERE restaurant_id = ? AND is_active = true ORDER BY number",
    params: ["perf_test_r1"],
    category: "tables",
  },
  {
    name: "table_availability",
    query: `
      SELECT t.*,
        CASE WHEN EXISTS (
          SELECT 1 FROM orders o
          WHERE o.table_id = t.id
            AND o.status IN ('pending', 'confirmed', 'preparing')
        ) THEN 1 ELSE 0 END as is_occupied
      FROM tables t
      WHERE t.restaurant_id = ? AND t.is_active = true
    `,
    params: ["perf_test_r1"],
    category: "tables",
  },

  // User queries
  {
    name: "user_by_username",
    query:
      "SELECT * FROM users WHERE username = ? AND is_active = true LIMIT 1",
    params: ["testuser"],
    category: "users",
  },
  {
    name: "users_by_restaurant",
    query:
      "SELECT * FROM users WHERE restaurant_id = ? AND is_active = true ORDER BY created_at_ms DESC",
    params: ["perf_test_r1"],
    category: "users",
  },

  // Analytics queries
  {
    name: "daily_revenue",
    query: `
      SELECT
        DATE(created_at_ms / 1000, 'unixepoch') as date,
        COUNT(*) as order_count,
        SUM(total_amount) as revenue
      FROM orders
      WHERE restaurant_id = ?
        AND created_at_ms >= (unixepoch('now', '-30 days') * 1000)
        AND status = 'delivered'
      GROUP BY DATE(created_at_ms / 1000, 'unixepoch')
      ORDER BY date DESC
    `,
    params: ["perf_test_r1"],
    category: "analytics",
  },
  {
    name: "popular_items",
    query: `
      SELECT
        mi.id,
        mi.name,
        COUNT(oi.id) as order_count,
        SUM(oi.quantity) as total_quantity
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.restaurant_id = ?
        AND o.created_at_ms >= (unixepoch('now', '-7 days') * 1000)
      GROUP BY mi.id, mi.name
      ORDER BY total_quantity DESC
      LIMIT 10
    `,
    params: ["perf_test_r1"],
    category: "analytics",
  },
];

async function createBaseline(version: string = "v1.0.0") {
  console.log("🚀 Creating Performance Baseline...\n");
  console.log(`Version: ${version}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  // Setup
  const db = await createTestDB();
  await seedBenchmarkData(db);
  const tester = new DatabasePerformanceTester(db);
  const baselineManager = new PerformanceBaselineManager();

  // Run benchmarks
  const results: Record<string, any> = {};

  console.log("📊 Running Benchmarks...\n");

  for (const benchmark of BENCHMARK_QUERIES) {
    process.stdout.write(`  [${benchmark.category}] ${benchmark.name}... `);

    try {
      const result = await tester.benchmarkQuery(
        benchmark.query,
        benchmark.params,
        10, // 10 iterations
      );

      // Validate index usage
      const indexValidation = await tester.validateIndexUsage(
        benchmark.query,
        benchmark.params,
      );

      results[benchmark.name] = {
        avgTime: Math.round(result.avgTime * 100) / 100,
        p95Time: Math.round(result.p95Time * 100) / 100,
        p99Time: Math.round(result.p99Time * 100) / 100,
        indexUsed: indexValidation.indexUsed,
        category: benchmark.category,
      };

      console.log(
        `✅ ${result.avgTime.toFixed(2)}ms (P95: ${result.p95Time.toFixed(2)}ms)`,
      );
    } catch (error: any) {
      console.log(`❌ ${error.message}`);
      results[benchmark.name] = {
        avgTime: -1,
        p95Time: -1,
        p99Time: -1,
        indexUsed: false,
        category: benchmark.category,
        error: error.message,
      };
    }
  }

  // Create baseline
  const baseline = baselineManager.createBaseline(version, results);

  // Save baseline
  await baselineManager.saveBaseline(baseline);

  // Summary
  console.log("\n📈 Performance Summary:\n");

  const categories = ["menu", "orders", "tables", "users", "analytics"];
  for (const category of categories) {
    const categoryResults = Object.entries(results).filter(
      ([_, r]: [string, any]) => r.category === category,
    );

    if (categoryResults.length === 0) continue;

    const avgTimes = categoryResults
      .map(([_, r]: [string, any]) => r.avgTime)
      .filter((t) => t > 0);
    const categoryAvg = avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length;

    console.log(`  ${category.toUpperCase()}:`);
    console.log(`    Average: ${categoryAvg.toFixed(2)}ms`);
    console.log(`    Queries: ${categoryResults.length}`);

    categoryResults.forEach(([name, result]) => {
      const status =
        result.avgTime < 50 ? "🟢" : result.avgTime < 100 ? "🟡" : "🔴";
      const indexStatus = result.indexUsed ? "📑" : "⚠️";
      console.log(
        `      ${status} ${indexStatus} ${name}: ${result.avgTime.toFixed(2)}ms`,
      );
    });
    console.log();
  }

  // Performance grades
  console.log("🎯 Performance Grades:\n");

  const allAvgTimes = Object.values(results)
    .map((r: any) => r.avgTime)
    .filter((t) => t > 0);

  const overallAvg =
    allAvgTimes.reduce((a, b) => a + b, 0) / allAvgTimes.length;
  const fastQueries = allAvgTimes.filter((t) => t < 50).length;
  const mediumQueries = allAvgTimes.filter((t) => t >= 50 && t < 100).length;
  const slowQueries = allAvgTimes.filter((t) => t >= 100).length;

  console.log(`  Overall Average: ${overallAvg.toFixed(2)}ms`);
  console.log(`  Fast (<50ms): ${fastQueries} queries`);
  console.log(`  Medium (50-100ms): ${mediumQueries} queries`);
  console.log(`  Slow (>100ms): ${slowQueries} queries`);
  console.log();

  // Grade
  let grade = "A";
  if (overallAvg > 100) grade = "D";
  else if (overallAvg > 75) grade = "C";
  else if (overallAvg > 50) grade = "B";

  console.log(`  📊 Overall Grade: ${grade}`);
  console.log();

  // Recommendations
  if (slowQueries > 0) {
    console.log("⚠️  Recommendations:");
    console.log("  • Consider adding indexes for slow queries");
    console.log("  • Review query execution plans");
    console.log("  • Check for N+1 query problems");
    console.log();
  }

  // Cleanup
  await cleanupTestDB(db);

  console.log(
    `✅ Baseline saved to: tests/performance/baselines/db-baseline.json`,
  );
  console.log();
}

export async function seedBenchmarkData(db: {
  prepare(sql: string): {
    bind(...args: unknown[]): { run(): Promise<unknown> };
  };
}): Promise<void> {
  const restaurantId = "perf_test_r1";
  const now = Date.now();

  await db
    .prepare(
      `INSERT OR IGNORE INTO restaurants (
        id, name, type, category, address, district, phone,
        created_at_ms, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      restaurantId,
      "Performance Baseline Restaurant",
      "Casual Dining",
      "Restaurant",
      "123 Baseline Road",
      "西區",
      "04-0000-0000",
      now,
      now,
    )
    .run();

  for (let i = 1; i <= 5; i++) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO categories (
          id, restaurant_id, name, sort_order, is_active,
          created_at_ms, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(i, restaurantId, `Baseline Category ${i}`, i, 1, now, now)
      .run();
  }

  for (let i = 1; i <= 50; i++) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO menu_items (
          id, restaurant_id, category_id, name, price, is_available, sort_order,
          created_at_ms, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        i,
        restaurantId,
        (i % 5) + 1,
        i % 7 === 0 ? `beef item ${i}` : `Baseline Item ${i}`,
        100 + i,
        1,
        i,
        now,
        now,
      )
      .run();
  }

  for (let i = 1; i <= 10; i++) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO tables (
          id, restaurant_id, number, capacity, qr_code, is_active,
          created_at_ms, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(i, restaurantId, `B${i}`, 4, `qr_${restaurantId}_${i}`, 1, now, now)
      .run();
  }

  for (let i = 1; i <= 3; i++) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO users (
          id, username, email, password_hash, full_name, restaurant_id,
          role, is_active, created_at_ms, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        i,
        i === 1 ? "testuser" : `baseline_user_${i}`,
        `baseline${i}@example.com`,
        "hashed-password",
        `Baseline User ${i}`,
        restaurantId,
        2,
        1,
        now,
        now,
      )
      .run();
  }

  for (let i = 1; i <= 20; i++) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO orders (
          id, restaurant_id, table_id, order_number, status, subtotal, total_amount,
          created_at_ms, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        i,
        restaurantId,
        (i % 10) + 1,
        `BASE-${i}`,
        i % 4 === 0 ? "delivered" : "pending",
        200,
        200,
        now - i * 1000,
        now,
      )
      .run();

    await db
      .prepare(
        `INSERT OR IGNORE INTO order_items (
          id, order_id, menu_item_id, quantity, unit_price, total_price,
          created_at_ms, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(i, i, (i % 50) + 1, 1, 100, 100, now, now)
      .run();
  }
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) ===
    fileURLToPath(new URL(process.argv[1], "file:"));

if (isMain) {
  const version = process.argv[2] || "v1.0.0";
  createBaseline(version).catch((error) => {
    console.error("❌ Error creating baseline:", error);
    process.exit(1);
  });
}

export { createBaseline };
