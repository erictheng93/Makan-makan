/**
 * Query Performance Benchmark Tests
 *
 * Comprehensive performance tests for critical database queries
 * Tests cover:
 * - Menu item queries (most frequent)
 * - Order queries (business critical)
 * - Table management queries
 * - User/authentication queries
 * - Analytics queries
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DatabasePerformanceTester } from "./db-performance-tester";
import { createTestDB, cleanupTestDB } from "../../helpers/test-db";

describe("Database Query Performance Benchmarks", () => {
  let db: any;
  let tester: DatabasePerformanceTester;
  let testRestaurantId: number;
  const PERFORMANCE_THRESHOLD_MS = 100; // Queries should complete within 100ms

  beforeAll(async () => {
    // Setup test database
    db = await createTestDB();
    tester = new DatabasePerformanceTester(db);

    // Create test data
    testRestaurantId = await setupTestData(db);
  });

  afterAll(async () => {
    await cleanupTestDB(db);
  });

  describe("Menu Item Queries", () => {
    it("should fetch menu items by restaurant efficiently", async () => {
      const query = `
        SELECT * FROM menu_items
        WHERE restaurant_id = ? AND is_available = true
        ORDER BY sort_order
        LIMIT 50
      `;

      const result = await tester.benchmarkQuery(query, [testRestaurantId], 10);

      console.log(`📊 Menu Items Query Performance:`);
      console.log(`   Average: ${result.avgTime.toFixed(2)}ms`);
      console.log(`   P95: ${result.p95Time.toFixed(2)}ms`);
      console.log(`   P99: ${result.p99Time.toFixed(2)}ms`);

      // Performance assertions
      expect(result.avgTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(result.p95Time).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 1.5);
      expect(result.stdDev).toBeLessThan(20); // Low variance
    });

    it("should validate index usage for menu items query", async () => {
      const query = `
        SELECT * FROM menu_items
        WHERE restaurant_id = ? AND is_available = true
        ORDER BY sort_order
      `;

      const result = await tester.validateIndexUsage(query, [testRestaurantId]);

      console.log(`🔍 Menu Items Index Validation:`);
      console.log(`   Index Used: ${result.indexUsed ? "✅" : "❌"}`);
      console.log(`   Execution Time: ${result.executionTime.toFixed(2)}ms`);
      console.log(`   ${result.recommendation}`);

      // Should use index for better performance
      expect(result.indexUsed).toBe(true);
      expect(result.executionTime).toBeLessThan(50);
    });

    it("should handle menu item search efficiently", async () => {
      const query = `
        SELECT * FROM menu_items
        WHERE restaurant_id = ?
          AND is_available = true
          AND (name LIKE ? OR name_en LIKE ?)
        LIMIT 20
      `;

      const searchTerm = "%beef%";
      const result = await tester.benchmarkQuery(
        query,
        [testRestaurantId, searchTerm, searchTerm],
        10,
      );

      console.log(`📊 Menu Search Performance:`);
      console.log(`   Average: ${result.avgTime.toFixed(2)}ms`);
      console.log(`   P95: ${result.p95Time.toFixed(2)}ms`);

      expect(result.avgTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it("should fetch menu items with category JOIN efficiently", async () => {
      const query = `
        SELECT mi.*, c.name as category_name
        FROM menu_items mi
        LEFT JOIN categories c ON mi.category_id = c.id
        WHERE mi.restaurant_id = ? AND mi.is_available = true
        ORDER BY c.display_order, mi.sort_order
        LIMIT 50
      `;

      const result = await tester.benchmarkQuery(query, [testRestaurantId], 10);

      console.log(`📊 Menu with Category JOIN Performance:`);
      console.log(`   Average: ${result.avgTime.toFixed(2)}ms`);
      console.log(`   P95: ${result.p95Time.toFixed(2)}ms`);

      expect(result.avgTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 1.5); // JOINs can be slower
    });
  });

  describe("Order Queries", () => {
    it("should fetch orders list efficiently", async () => {
      const query = `
        SELECT * FROM orders
        WHERE restaurant_id = ?
        ORDER BY created_at DESC
        LIMIT 20
      `;

      const result = await tester.benchmarkQuery(query, [testRestaurantId], 10);

      console.log(`📊 Orders List Performance:`);
      console.log(`   Average: ${result.avgTime.toFixed(2)}ms`);
      console.log(`   P95: ${result.p95Time.toFixed(2)}ms`);

      expect(result.avgTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(result.p95Time).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 1.5);
    });

    it("should validate index usage for orders query", async () => {
      const query = `
        SELECT * FROM orders
        WHERE restaurant_id = ? AND status = ?
        ORDER BY created_at DESC
      `;

      const result = await tester.validateIndexUsage(query, [
        testRestaurantId,
        "pending",
      ]);

      console.log(`🔍 Orders Index Validation:`);
      console.log(`   Index Used: ${result.indexUsed ? "✅" : "❌"}`);
      console.log(`   ${result.recommendation}`);

      expect(result.indexUsed).toBe(true);
    });

    it("should fetch order with items efficiently (avoid N+1)", async () => {
      // This should be done in a single query with JOIN
      const query = `
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
      `;

      const result = await tester.benchmarkQuery(query, [1], 10);

      console.log(`📊 Order with Items (JOIN) Performance:`);
      console.log(`   Average: ${result.avgTime.toFixed(2)}ms`);
      console.log(`   P95: ${result.p95Time.toFixed(2)}ms`);

      expect(result.avgTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2); // More complex query
    });

    it("should handle order status updates efficiently", async () => {
      const query = `
        UPDATE orders
        SET status = ?, updated_at = ?
        WHERE id = ?
      `;

      const result = await tester.benchmarkQuery(
        query,
        ["confirmed", new Date().toISOString(), 1],
        10,
      );

      console.log(`📊 Order Status Update Performance:`);
      console.log(`   Average: ${result.avgTime.toFixed(2)}ms`);

      expect(result.avgTime).toBeLessThan(50); // Updates should be very fast
    });
  });

  describe("Table Management Queries", () => {
    it("should fetch tables list efficiently", async () => {
      const query = `
        SELECT * FROM tables
        WHERE restaurant_id = ? AND is_active = true
        ORDER BY number
      `;

      const result = await tester.benchmarkQuery(query, [testRestaurantId], 10);

      console.log(`📊 Tables List Performance:`);
      console.log(`   Average: ${result.avgTime.toFixed(2)}ms`);

      expect(result.avgTime).toBeLessThan(50); // Should be very fast
    });

    it("should validate table availability check performance", async () => {
      const query = `
        SELECT t.*,
          CASE WHEN EXISTS (
            SELECT 1 FROM orders o
            WHERE o.table_id = t.id
              AND o.status IN ('pending', 'confirmed', 'preparing')
          ) THEN 1 ELSE 0 END as is_occupied
        FROM tables t
        WHERE t.restaurant_id = ? AND t.is_active = true
      `;

      const result = await tester.benchmarkQuery(query, [testRestaurantId], 10);

      console.log(`📊 Table Availability Check Performance:`);
      console.log(`   Average: ${result.avgTime.toFixed(2)}ms`);
      console.log(`   P95: ${result.p95Time.toFixed(2)}ms`);

      expect(result.avgTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });
  });

  describe("User/Authentication Queries", () => {
    it("should fetch user by username efficiently", async () => {
      const query = `
        SELECT * FROM users
        WHERE username = ? AND is_active = true
        LIMIT 1
      `;

      const result = await tester.benchmarkQuery(query, ["testuser"], 10);

      console.log(`📊 User Lookup Performance:`);
      console.log(`   Average: ${result.avgTime.toFixed(2)}ms`);

      expect(result.avgTime).toBeLessThan(30); // Should be very fast
    });

    it("should validate index on username", async () => {
      const query = `SELECT * FROM users WHERE username = ?`;

      const result = await tester.validateIndexUsage(query, ["testuser"]);

      console.log(`🔍 Username Index Validation:`);
      console.log(`   Index Used: ${result.indexUsed ? "✅" : "❌"}`);

      expect(result.indexUsed).toBe(true);
    });
  });

  describe("Analytics Queries", () => {
    it("should calculate daily revenue efficiently", async () => {
      const query = `
        SELECT
          DATE(created_at) as date,
          COUNT(*) as order_count,
          SUM(total_amount) as revenue
        FROM orders
        WHERE restaurant_id = ?
          AND created_at >= DATE('now', '-30 days')
          AND status = 'completed'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;

      const result = await tester.benchmarkQuery(query, [testRestaurantId], 10);

      console.log(`📊 Daily Revenue Analytics Performance:`);
      console.log(`   Average: ${result.avgTime.toFixed(2)}ms`);
      console.log(`   P95: ${result.p95Time.toFixed(2)}ms`);

      expect(result.avgTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2); // Analytics can be slower
    });

    it("should calculate popular menu items efficiently", async () => {
      const query = `
        SELECT
          mi.id,
          mi.name,
          COUNT(oi.id) as order_count,
          SUM(oi.quantity) as total_quantity
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.restaurant_id = ?
          AND o.created_at >= DATE('now', '-7 days')
        GROUP BY mi.id, mi.name
        ORDER BY total_quantity DESC
        LIMIT 10
      `;

      const result = await tester.benchmarkQuery(query, [testRestaurantId], 10);

      console.log(`📊 Popular Items Analytics Performance:`);
      console.log(`   Average: ${result.avgTime.toFixed(2)}ms`);

      expect(result.avgTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2);
    });
  });

  describe("Concurrent Load Testing", () => {
    it("should handle 10 concurrent menu queries", async () => {
      const query = `
        SELECT * FROM menu_items
        WHERE restaurant_id = ? AND is_available = true
        LIMIT 50
      `;

      const result = await tester.benchmarkConcurrent(
        query,
        [testRestaurantId],
        10,
      );

      console.log(`📊 Concurrent Load Test (10 queries):`);
      console.log(`   Total Time: ${result.totalTime.toFixed(2)}ms`);
      console.log(`   Avg Query Time: ${result.avgQueryTime.toFixed(2)}ms`);
      console.log(
        `   Success Rate: ${((result.successCount / result.concurrency) * 100).toFixed(1)}%`,
      );

      expect(result.successCount).toBe(10);
      expect(result.errorCount).toBe(0);
      expect(result.avgQueryTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2);
    });

    it("should handle 50 concurrent order queries", async () => {
      const query = `SELECT * FROM orders WHERE restaurant_id = ? LIMIT 20`;

      const result = await tester.benchmarkConcurrent(
        query,
        [testRestaurantId],
        50,
      );

      console.log(`📊 High Concurrent Load Test (50 queries):`);
      console.log(`   Total Time: ${result.totalTime.toFixed(2)}ms`);
      console.log(
        `   Success Rate: ${((result.successCount / result.concurrency) * 100).toFixed(1)}%`,
      );

      expect(result.successCount).toBeGreaterThan(45); // Allow some failures under high load
      expect(result.avgQueryTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 3);
    });
  });

  describe("Stress Testing", () => {
    it("should maintain performance under sustained load", async () => {
      const query = `
        SELECT * FROM menu_items
        WHERE restaurant_id = ? AND is_available = true
        LIMIT 20
      `;

      const result = await tester.stressTest(query, [testRestaurantId], 5000); // 5 seconds

      console.log(`📊 Stress Test (5 seconds):`);
      console.log(`   Total Queries: ${result.totalQueries}`);
      console.log(`   QPS: ${result.queriesPerSecond.toFixed(2)}`);
      console.log(`   Avg Time: ${result.avgTime.toFixed(2)}ms`);
      console.log(`   Max Time: ${result.maxTime.toFixed(2)}ms`);
      console.log(
        `   Success Rate: ${((result.successfulQueries / result.totalQueries) * 100).toFixed(1)}%`,
      );

      expect(result.queriesPerSecond).toBeGreaterThan(10); // At least 10 QPS
      expect(result.successfulQueries / result.totalQueries).toBeGreaterThan(
        0.95,
      ); // 95% success
      expect(result.avgTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });
  });
});

/**
 * Helper: Setup test data
 */
async function setupTestData(db: any): Promise<number> {
  const restaurantId = 1;

  // Create restaurant
  await db
    .prepare(
      `
    INSERT OR IGNORE INTO restaurants (id, name, type, category, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    )
    .bind(
      restaurantId,
      "Performance Test Restaurant",
      "Casual Dining",
      "Restaurant",
      new Date().toISOString(),
      new Date().toISOString(),
    )
    .run();

  // Create categories (10)
  for (let i = 1; i <= 10; i++) {
    await db
      .prepare(
        `
      INSERT OR IGNORE INTO categories (id, restaurant_id, name, name_en, display_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        i,
        restaurantId,
        `分類 ${i}`,
        `Category ${i}`,
        i,
        1,
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();
  }

  // Create menu items (100)
  for (let i = 1; i <= 100; i++) {
    await db
      .prepare(
        `
      INSERT OR IGNORE INTO menu_items (
        id, restaurant_id, category_id, name, name_en,
        price, is_available, sort_order, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        i,
        restaurantId,
        (i % 10) + 1, // Distribute across categories
        `菜品 ${i}`,
        `Item ${i}`,
        Math.floor(Math.random() * 200) + 50, // 50-250
        1,
        i,
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();
  }

  // Create tables (20)
  for (let i = 1; i <= 20; i++) {
    await db
      .prepare(
        `
      INSERT OR IGNORE INTO tables (
        id, restaurant_id, number, capacity, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        i,
        restaurantId,
        `T${i}`,
        Math.floor(Math.random() * 6) + 2, // 2-8 seats
        1,
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();
  }

  // Create users (5)
  for (let i = 1; i <= 5; i++) {
    await db
      .prepare(
        `
      INSERT OR IGNORE INTO users (
        id, restaurant_id, username, email, full_name, password_hash,
        role, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        i,
        restaurantId,
        `testuser${i}`,
        `test${i}@example.com`,
        `Test User ${i}`,
        "hashedpassword",
        i % 5, // Different roles
        1,
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();
  }

  // Create orders (50)
  for (let i = 1; i <= 50; i++) {
    await db
      .prepare(
        `
      INSERT OR IGNORE INTO orders (
        id, restaurant_id, table_id, status, total_amount,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        i,
        restaurantId,
        (i % 20) + 1, // Distribute across tables
        ["pending", "confirmed", "preparing", "completed"][i % 4],
        Math.floor(Math.random() * 500) + 100, // 100-600
        new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
        ).toISOString(), // Last 30 days
        new Date().toISOString(),
      )
      .run();

    // Create order items (2-5 per order)
    const itemCount = Math.floor(Math.random() * 4) + 2;
    for (let j = 1; j <= itemCount; j++) {
      await db
        .prepare(
          `
        INSERT OR IGNORE INTO order_items (
          order_id, menu_item_id, quantity, unit_price, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        )
        .bind(
          i,
          Math.floor(Math.random() * 100) + 1,
          Math.floor(Math.random() * 3) + 1,
          Math.floor(Math.random() * 200) + 50,
          new Date().toISOString(),
          new Date().toISOString(),
        )
        .run();
    }
  }

  return restaurantId;
}
