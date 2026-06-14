/**
 * N+1 Query Detection Tests
 *
 * Automatically detects N+1 query problems by monitoring query patterns
 * during typical application workflows
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DatabasePerformanceTester } from "./db-performance-tester";
import { createTestDB, cleanupTestDB } from "../../helpers/test-db";

// Restaurants use a text public_id as primary key (see migration 0006).
// All child tables (`menu_items`, `categories`, `orders`, ...) reference it
// via their own `restaurant_id text NOT NULL` column. Tests must bind a
// matching string, not an integer.
const TEST_RESTAURANT_ID = "n1_test_r1";

describe("N+1 Query Detection", () => {
  let db: any;
  let tester: DatabasePerformanceTester;

  beforeAll(async () => {
    db = await createTestDB();
    tester = new DatabasePerformanceTester(db);
    await setupTestData(db);
  });

  afterAll(async () => {
    await cleanupTestDB(db);
  });

  describe("Order Listing Endpoint Simulation", () => {
    it("should detect N+1 problem in naive order listing", async () => {
      // Simulate WRONG way: Loading orders, then loading items for each order separately
      tester.startQueryLogging();

      // Step 1: Load orders
      const ordersQuery = `SELECT * FROM orders WHERE restaurant_id = ? LIMIT 10`;
      const ordersResult = await db
        .prepare(ordersQuery)
        .bind(TEST_RESTAURANT_ID)
        .all();
      await tester.measureQuery(ordersQuery, [TEST_RESTAURANT_ID]);

      // Step 2: Load items for each order (N+1 problem!)
      for (const order of ordersResult.results) {
        const itemsQuery = `SELECT * FROM order_items WHERE order_id = ?`;
        await tester.measureQuery(itemsQuery, [order.id]);
      }

      const analysis = tester.stopQueryLogging();

      console.log(`🔴 N+1 Detection - Naive Approach:`);
      console.log(`   Total Queries: ${analysis.totalQueries}`);
      console.log(`   Unique Queries: ${analysis.uniqueQueries}`);
      console.log(
        `   Has N+1 Problem: ${analysis.hasN1Problem ? "❌ YES" : "✅ NO"}`,
      );
      console.log(`   Suggestions:`);
      analysis.suggestions.forEach((s) => console.log(`   ${s}`));

      // Should detect N+1 problem
      expect(analysis.hasN1Problem).toBe(true);
      expect(analysis.totalQueries).toBeGreaterThan(10);
      expect(analysis.repeatedQueries.length).toBeGreaterThan(0);
    });

    it("should NOT detect N+1 when using JOIN", async () => {
      // Simulate CORRECT way: Using JOIN to load everything in one query
      tester.startQueryLogging();

      const query = `
        SELECT
          o.*,
          json_group_array(
            json_object(
              'id', oi.id,
              'menu_item_id', oi.menu_item_id,
              'quantity', oi.quantity
            )
          ) as items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.restaurant_id = ?
        GROUP BY o.id
        LIMIT 10
      `;

      await tester.measureQuery(query, [TEST_RESTAURANT_ID]);

      const analysis = tester.stopQueryLogging();

      console.log(`✅ N+1 Detection - Optimized Approach:`);
      console.log(`   Total Queries: ${analysis.totalQueries}`);
      console.log(
        `   Has N+1 Problem: ${analysis.hasN1Problem ? "❌ YES" : "✅ NO"}`,
      );

      // Should NOT detect N+1 problem
      expect(analysis.hasN1Problem).toBe(false);
      expect(analysis.totalQueries).toBe(1);
    });
  });

  describe("Menu with Categories Simulation", () => {
    it("should detect N+1 when loading categories separately", async () => {
      tester.startQueryLogging();

      // Load menu items
      const itemsQuery = `SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = true LIMIT 20`;
      const itemsResult = await db
        .prepare(itemsQuery)
        .bind(TEST_RESTAURANT_ID)
        .all();
      await tester.measureQuery(itemsQuery, [TEST_RESTAURANT_ID]);

      // Load category for each item (true N+1: one query per item, no
      // dedup). The previous version deduped via a Set so total queries
      // capped at the number of distinct category_ids — with only 5
      // categories that gives 5 calls, which is exactly equal to (not
      // greater than) the analyzer's threshold of 5 and so does not
      // register as N+1. Removing the dedup matches the realistic naive
      // pattern this test is supposed to represent: a sloppy ORM hydrating
      // category for every row.
      const categoryQuery = `SELECT * FROM categories WHERE id = ?`;
      for (const item of itemsResult.results) {
        await tester.measureQuery(categoryQuery, [item.category_id]);
      }

      const analysis = tester.stopQueryLogging();

      console.log(`🔴 N+1 Detection - Menu Categories:`);
      console.log(`   Total Queries: ${analysis.totalQueries}`);
      console.log(
        `   Has N+1 Problem: ${analysis.hasN1Problem ? "❌ YES" : "✅ NO"}`,
      );

      expect(analysis.hasN1Problem).toBe(true);
    });

    it("should NOT detect N+1 when using JOIN for categories", async () => {
      tester.startQueryLogging();

      // Real schema uses `sort_order` (no `display_order` column).
      const query = `
        SELECT mi.*, c.name as category_name, c.sort_order as category_order
        FROM menu_items mi
        LEFT JOIN categories c ON mi.category_id = c.id
        WHERE mi.restaurant_id = ? AND mi.is_available = true
        ORDER BY c.sort_order, mi.sort_order
        LIMIT 20
      `;

      await tester.measureQuery(query, [TEST_RESTAURANT_ID]);

      const analysis = tester.stopQueryLogging();

      console.log(`✅ N+1 Detection - Optimized Categories:`);
      console.log(`   Total Queries: ${analysis.totalQueries}`);

      expect(analysis.hasN1Problem).toBe(false);
      expect(analysis.totalQueries).toBe(1);
    });
  });

  describe("User Permissions Check Simulation", () => {
    it("should detect N+1 when checking permissions for each user", async () => {
      tester.startQueryLogging();

      // Load users
      const usersQuery = `SELECT * FROM users WHERE restaurant_id = ? LIMIT 10`;
      const usersResult = await db
        .prepare(usersQuery)
        .bind(TEST_RESTAURANT_ID)
        .all();
      await tester.measureQuery(usersQuery, [TEST_RESTAURANT_ID]);

      // Check permissions for each user (simulated)
      for (const user of usersResult.results) {
        const permQuery = `SELECT * FROM users WHERE id = ? AND is_active = true`;
        await tester.measureQuery(permQuery, [user.id]);
      }

      const analysis = tester.stopQueryLogging();

      console.log(`🔴 N+1 Detection - User Permissions:`);
      console.log(`   Total Queries: ${analysis.totalQueries}`);
      console.log(
        `   Has N+1 Problem: ${analysis.hasN1Problem ? "❌ YES" : "✅ NO"}`,
      );

      expect(analysis.hasN1Problem).toBe(true);
    });
  });

  describe("Batch Loading Detection", () => {
    it("should detect when batch loading would be beneficial", async () => {
      tester.startQueryLogging();

      // Simulate loading menu items one by one
      const itemIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      for (const id of itemIds) {
        const query = `SELECT * FROM menu_items WHERE id = ?`;
        await tester.measureQuery(query, [id]);
      }

      const analysis = tester.stopQueryLogging();

      console.log(`🔴 Batch Loading Detection:`);
      console.log(`   Total Queries: ${analysis.totalQueries}`);
      console.log(
        `   Should use batch loading: ${analysis.totalQueries > 5 ? "✅ YES" : "❌ NO"}`,
      );

      expect(analysis.totalQueries).toBe(10);
      expect(analysis.uniqueQueries).toBe(1); // All same query pattern
    });

    it("should validate batch loading optimization", async () => {
      tester.startQueryLogging();

      // Optimized: Load all items in one query
      const itemIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const placeholders = itemIds.map(() => "?").join(",");
      const query = `SELECT * FROM menu_items WHERE id IN (${placeholders})`;
      await tester.measureQuery(query, itemIds);

      const analysis = tester.stopQueryLogging();

      console.log(`✅ Batch Loading Optimized:`);
      console.log(`   Total Queries: ${analysis.totalQueries}`);

      expect(analysis.totalQueries).toBe(1);
      expect(analysis.hasN1Problem).toBe(false);
    });
  });

  describe("Complex Workflow Simulation", () => {
    it("should detect N+1 in complete order creation workflow", async () => {
      tester.startQueryLogging();

      // Simulate order creation workflow
      // 1. Validate restaurant exists (restaurants.id is text PK)
      await tester.measureQuery(`SELECT * FROM restaurants WHERE id = ?`, [
        TEST_RESTAURANT_ID,
      ]);

      // 2. Validate table exists (tables.id is integer PK)
      await tester.measureQuery(`SELECT * FROM tables WHERE id = ?`, [1]);

      // 3. Validate each menu item (N+1 problem!)
      // 6 items so the per-item query count exceeds the analyzer's
      // strict-greater-than-5 N+1 threshold.
      const menuItemIds = [1, 2, 3, 4, 5, 6];
      for (const itemId of menuItemIds) {
        await tester.measureQuery(
          `SELECT * FROM menu_items WHERE id = ? AND is_available = true`,
          [itemId],
        );
      }

      // 4. Create order — using a parseable no-op SELECT keyed by a
      // distinctive comment so the query log groups it as a single repeated
      // pattern. Real INSERT would have side effects across iterations and
      // require unique order_numbers; for query-counting purposes the
      // string identity is what matters.
      await tester.measureQuery(
        `SELECT 'INSERT INTO orders (...) VALUES (...)' AS _stub`,
        [],
      );

      // 5. Create order items (multiple inserts) — same no-op stub.
      for (const _itemId of menuItemIds) {
        await tester.measureQuery(
          `SELECT 'INSERT INTO order_items (...) VALUES (...)' AS _stub`,
          [],
        );
      }

      const analysis = tester.stopQueryLogging();

      console.log(`🔴 Complex Workflow Analysis:`);
      console.log(`   Total Queries: ${analysis.totalQueries}`);
      console.log(`   Unique Queries: ${analysis.uniqueQueries}`);
      console.log(
        `   Has N+1 Problem: ${analysis.hasN1Problem ? "❌ YES" : "✅ NO"}`,
      );
      console.log(`\n   Optimization Suggestions:`);
      analysis.suggestions.forEach((s) => console.log(`   ${s}`));

      expect(analysis.totalQueries).toBeGreaterThan(10);
      expect(analysis.hasN1Problem).toBe(true);
    });

    it("should validate optimized order creation workflow", async () => {
      tester.startQueryLogging();

      // Optimized workflow
      // 1. Validate restaurant, table, and all menu items in fewer queries
      await tester.measureQuery(`SELECT * FROM restaurants WHERE id = ?`, [
        TEST_RESTAURANT_ID,
      ]);
      await tester.measureQuery(`SELECT * FROM tables WHERE id = ?`, [1]);

      // 2. Batch validate menu items
      const menuItemIds = [1, 2, 3, 4, 5];
      const placeholders = menuItemIds.map(() => "?").join(",");
      await tester.measureQuery(
        `SELECT * FROM menu_items WHERE id IN (${placeholders}) AND is_available = true`,
        menuItemIds,
      );

      // 3. Create order — parseable no-op stub (see comment above for the
      // naive workflow on why we use a SELECT here instead of a real
      // INSERT).
      await tester.measureQuery(
        `SELECT 'INSERT INTO orders (...) VALUES (...)' AS _stub`,
        [],
      );

      // 4. Batch insert order items (if supported, or use transaction)
      await tester.measureQuery(
        `SELECT 'INSERT INTO order_items (...) VALUES (...), (...), (...)' AS _stub`,
        [],
      );

      const analysis = tester.stopQueryLogging();

      console.log(`✅ Optimized Workflow Analysis:`);
      console.log(`   Total Queries: ${analysis.totalQueries}`);
      console.log(
        `   Has N+1 Problem: ${analysis.hasN1Problem ? "❌ YES" : "✅ NO"}`,
      );

      expect(analysis.totalQueries).toBeLessThan(10);
      expect(analysis.hasN1Problem).toBe(false);
    });
  });

  describe("Real-world Endpoint Simulations", () => {
    it("GET /api/v1/orders - should detect N+1 in naive implementation", async () => {
      tester.startQueryLogging();

      // Naive implementation
      const orders = await db
        .prepare(`SELECT * FROM orders WHERE restaurant_id = ? LIMIT 20`)
        .bind(TEST_RESTAURANT_ID)
        .all();
      await tester.measureQuery(
        `SELECT * FROM orders WHERE restaurant_id = ? LIMIT 20`,
        [TEST_RESTAURANT_ID],
      );

      for (const order of orders.results) {
        await tester.measureQuery(
          `SELECT * FROM order_items WHERE order_id = ?`,
          [order.id],
        );
        await tester.measureQuery(`SELECT * FROM tables WHERE id = ?`, [
          order.table_id,
        ]);
      }

      const analysis = tester.stopQueryLogging();
      analysis.endpoint = "GET /api/v1/orders";

      console.log(`\n🔴 Endpoint: GET /api/v1/orders (Naive)`);
      console.log(`   Total Queries: ${analysis.totalQueries}`);
      console.log(`   Has N+1: ${analysis.hasN1Problem ? "❌ YES" : "✅ NO"}`);

      expect(analysis.hasN1Problem).toBe(true);
    });

    it("GET /api/v1/kitchen/:id/orders - should be optimized", async () => {
      tester.startQueryLogging();

      // Optimized with JOINs
      const query = `
        SELECT
          o.*,
          t.number as table_number,
          json_group_array(
            json_object(
              'id', oi.id,
              'item_name', mi.name,
              'quantity', oi.quantity
            )
          ) as items
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE o.restaurant_id = ?
          AND o.status IN ('confirmed', 'preparing')
        GROUP BY o.id
        ORDER BY o.created_at_ms ASC
      `;

      await tester.measureQuery(query, [TEST_RESTAURANT_ID]);

      const analysis = tester.stopQueryLogging();
      analysis.endpoint = "GET /api/v1/kitchen/:id/orders";

      console.log(`\n✅ Endpoint: GET /api/v1/kitchen/:id/orders (Optimized)`);
      console.log(`   Total Queries: ${analysis.totalQueries}`);
      console.log(`   Has N+1: ${analysis.hasN1Problem ? "❌ YES" : "✅ NO"}`);

      expect(analysis.hasN1Problem).toBe(false);
      expect(analysis.totalQueries).toBe(1);
    });
  });
});

/**
 * Helper: Seed deterministic test data
 *
 * See the equivalent function in `query-performance.test.ts` for the full
 * rationale on why every column name, type, and required-NOT-NULL field is
 * the way it is. This version uses smaller row counts (5 categories, 30
 * menu items, 10 tables, 15 orders, 10 users) since N+1 detection only
 * needs enough data to demonstrate query patterns.
 */
async function setupTestData(db: any): Promise<void> {
  const restaurantId = TEST_RESTAURANT_ID;
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
      "N+1 Test Restaurant",
      "Casual",
      "Restaurant",
      "123 Test Road",
      "西區",
      "04-1234-5678",
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
      .bind(i, restaurantId, `Category ${i}`, i, 1, now, now)
      .run();
  }

  for (let i = 1; i <= 30; i++) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO menu_items (
          id, restaurant_id, category_id, name, price_cents, is_available, sort_order,
          created_at_ms, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(i, restaurantId, (i % 5) + 1, `Item ${i}`, 10000, 1, i, now, now)
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
      .bind(
        i,
        restaurantId,
        `T${i}`,
        4,
        `qr_${restaurantId}_t${i}`,
        1,
        now,
        now,
      )
      .run();
  }

  const statuses = ["pending", "confirmed", "preparing"] as const;
  for (let i = 1; i <= 15; i++) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO orders (
          id, restaurant_id, table_id, order_number, status, subtotal_cents, total_amount_cents,
          created_at_ms, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        i,
        restaurantId,
        (i % 10) + 1,
        `N1-${i.toString().padStart(6, "0")}`,
        statuses[i % statuses.length],
        20000,
        20000,
        now,
        now,
      )
      .run();

    for (let j = 1; j <= 3; j++) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO order_items (
            order_id, menu_item_id, quantity, unit_price_cents, total_price_cents,
            created_at_ms, updated_at_ms
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(i, ((i + j) % 30) + 1, j, 10000, j * 10000, now, now)
        .run();
    }
  }

  for (let i = 1; i <= 10; i++) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO users (
          id, restaurant_id, username, email, full_name, password_hash,
          role, is_active, created_at_ms, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        i,
        restaurantId,
        `user${i}`,
        `user${i}@test.com`,
        `User ${i}`,
        "hash",
        i % 5,
        1,
        now,
        now,
      )
      .run();
  }

  // Refresh planner stats after seeding (mirrors createTestDB's initial
  // ANALYZE so subsequent EXPLAIN QUERY PLAN runs see realistic stats).
  await db.prepare("ANALYZE").bind().run();
}
