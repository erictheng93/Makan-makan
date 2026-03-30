/**
 * Database Analytics Queries Integration Tests
 *
 * Tests Layer 2 analytics queries against real SQLite data.
 * Verifies that complex aggregation queries return correct results
 * when run against known seed data.
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  createIntegrationTestApp,
  type IntegrationTestApp,
} from "./helpers/extended-test-app";
import {
  seedRestaurant,
  seedAdmin,
  seedCategory,
  seedMenuItem,
  seedTable,
  seedOrder,
  seedOrderItem,
  clearAllTables,
  type SeedContext,
} from "./helpers/seed-helper";

describe("Database Analytics Queries Integration", () => {
  let ctx: SeedContext;
  let restaurantId: number;

  beforeAll(async () => {
    const testApp = await createIntegrationTestApp();
    ctx = { db: testApp.db, dataStore: testApp.dataStore };
  });

  beforeEach(async () => {
    clearAllTables(ctx);

    // Seed base data
    const restaurant = await seedRestaurant(ctx);
    restaurantId = restaurant.id;
    await seedAdmin(ctx, restaurantId);
  });

  describe("Order Aggregation Queries", () => {
    it("should count orders by status correctly", async () => {
      // Seed orders with known statuses
      await seedOrder(ctx, restaurantId, {
        status: "pending",
        orderNumber: "ORD-001",
      });
      await seedOrder(ctx, restaurantId, {
        status: "pending",
        orderNumber: "ORD-002",
      });
      await seedOrder(ctx, restaurantId, {
        status: "completed",
        orderNumber: "ORD-003",
      });
      await seedOrder(ctx, restaurantId, {
        status: "cancelled",
        orderNumber: "ORD-004",
      });

      const results = ctx.dataStore.query(
        `SELECT status, COUNT(*) as count FROM orders WHERE restaurant_id = ? GROUP BY status ORDER BY count DESC`,
        [restaurantId],
      );

      expect(results).toHaveLength(3);
      const statusMap = new Map(results.map((r: any) => [r.status, r.count]));
      expect(statusMap.get("pending")).toBe(2);
      expect(statusMap.get("completed")).toBe(1);
      expect(statusMap.get("cancelled")).toBe(1);
    });

    it("should calculate total revenue correctly", async () => {
      // Seed orders with known amounts
      await seedOrder(ctx, restaurantId, {
        status: "completed",
        totalAmount: 500,
        orderNumber: "ORD-R1",
      });
      await seedOrder(ctx, restaurantId, {
        status: "completed",
        totalAmount: 300,
        orderNumber: "ORD-R2",
      });
      await seedOrder(ctx, restaurantId, {
        status: "completed",
        totalAmount: 700,
        orderNumber: "ORD-R3",
      });
      // Cancelled order should not count
      await seedOrder(ctx, restaurantId, {
        status: "cancelled",
        totalAmount: 200,
        orderNumber: "ORD-R4",
      });

      const result = ctx.dataStore.queryOne(
        `SELECT SUM(total_amount) as revenue, COUNT(*) as order_count
         FROM orders
         WHERE restaurant_id = ? AND status = 'completed'`,
        [restaurantId],
      );

      expect(result.revenue).toBe(1500);
      expect(result.order_count).toBe(3);
    });

    it("should calculate average order value", async () => {
      await seedOrder(ctx, restaurantId, {
        status: "completed",
        totalAmount: 400,
        orderNumber: "ORD-A1",
      });
      await seedOrder(ctx, restaurantId, {
        status: "completed",
        totalAmount: 600,
        orderNumber: "ORD-A2",
      });
      await seedOrder(ctx, restaurantId, {
        status: "completed",
        totalAmount: 500,
        orderNumber: "ORD-A3",
      });

      const result = ctx.dataStore.queryOne(
        `SELECT AVG(total_amount) as avg_value FROM orders
         WHERE restaurant_id = ? AND status = 'completed'`,
        [restaurantId],
      );

      expect(result.avg_value).toBe(500);
    });
  });

  describe("Menu Item Analytics", () => {
    it("should rank top menu items by order count", async () => {
      const cat = await seedCategory(ctx, restaurantId, { name: "主菜" });
      const item1 = await seedMenuItem(ctx, restaurantId, cat.id, {
        name: "宮保雞丁",
        price: 200,
      });
      const item2 = await seedMenuItem(ctx, restaurantId, cat.id, {
        name: "糖醋排骨",
        price: 250,
      });
      const item3 = await seedMenuItem(ctx, restaurantId, cat.id, {
        name: "紅燒牛肉",
        price: 300,
      });

      // Create orders and items
      const table = await seedTable(ctx, restaurantId, { number: 1 });
      const order1 = await seedOrder(ctx, restaurantId, {
        status: "completed",
        tableId: table.id,
        orderNumber: "ORD-M1",
      });
      const order2 = await seedOrder(ctx, restaurantId, {
        status: "completed",
        tableId: table.id,
        orderNumber: "ORD-M2",
      });

      // item1 appears 3 times, item2 appears 2 times, item3 appears 1 time
      await seedOrderItem(ctx, order1.id, item1.id, { quantity: 2 });
      await seedOrderItem(ctx, order1.id, item2.id, { quantity: 1 });
      await seedOrderItem(ctx, order2.id, item1.id, { quantity: 1 });
      await seedOrderItem(ctx, order2.id, item2.id, { quantity: 1 });
      await seedOrderItem(ctx, order2.id, item3.id, { quantity: 1 });

      const results = ctx.dataStore.query(
        `SELECT mi.name, SUM(oi.quantity) as total_quantity, COUNT(oi.id) as order_count
         FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         GROUP BY mi.id
         ORDER BY total_quantity DESC`,
        [],
      );

      expect(results).toHaveLength(3);
      expect(results[0].name).toBe("宮保雞丁");
      expect(results[0].total_quantity).toBe(3);
      expect(results[1].name).toBe("糖醋排骨");
      expect(results[1].total_quantity).toBe(2);
      expect(results[2].name).toBe("紅燒牛肉");
      expect(results[2].total_quantity).toBe(1);
    });

    it("should calculate revenue per menu item", async () => {
      const cat = await seedCategory(ctx, restaurantId, { name: "飲料" });
      const item1 = await seedMenuItem(ctx, restaurantId, cat.id, {
        name: "咖啡",
        price: 120,
      });
      const item2 = await seedMenuItem(ctx, restaurantId, cat.id, {
        name: "奶茶",
        price: 80,
      });

      const table = await seedTable(ctx, restaurantId, { number: 2 });
      const order = await seedOrder(ctx, restaurantId, {
        status: "completed",
        tableId: table.id,
        orderNumber: "ORD-REV1",
      });

      await seedOrderItem(ctx, order.id, item1.id, {
        quantity: 3,
        unitPrice: 120,
        totalPrice: 360,
      });
      await seedOrderItem(ctx, order.id, item2.id, {
        quantity: 2,
        unitPrice: 80,
        totalPrice: 160,
      });

      const results = ctx.dataStore.query(
        `SELECT mi.name, SUM(oi.total_price) as revenue
         FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         GROUP BY mi.id
         ORDER BY revenue DESC`,
        [],
      );

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("咖啡");
      expect(results[0].revenue).toBe(360);
      expect(results[1].name).toBe("奶茶");
      expect(results[1].revenue).toBe(160);
    });
  });

  describe("Table Utilization Analytics", () => {
    it("should track table occupancy", async () => {
      // Create 3 tables: 2 occupied, 1 available
      await seedTable(ctx, restaurantId, {
        number: 10,
        isOccupied: true,
      });
      await seedTable(ctx, restaurantId, {
        number: 11,
        isOccupied: true,
      });
      await seedTable(ctx, restaurantId, {
        number: 12,
        isOccupied: false,
      });

      const result = ctx.dataStore.queryOne(
        `SELECT
          COUNT(*) as total_tables,
          SUM(CASE WHEN is_occupied = 1 THEN 1 ELSE 0 END) as occupied,
          SUM(CASE WHEN is_occupied = 0 THEN 1 ELSE 0 END) as available
         FROM tables
         WHERE restaurant_id = ?`,
        [restaurantId],
      );

      expect(result.total_tables).toBe(3);
      expect(result.occupied).toBe(2);
      expect(result.available).toBe(1);
    });
  });

  describe("Cross-Entity Analytics", () => {
    it("should join orders with menu items for category revenue breakdown", async () => {
      const cat1 = await seedCategory(ctx, restaurantId, { name: "主菜" });
      const cat2 = await seedCategory(ctx, restaurantId, { name: "飲料" });

      const mainDish = await seedMenuItem(ctx, restaurantId, cat1.id, {
        name: "牛排",
        price: 500,
      });
      const drink = await seedMenuItem(ctx, restaurantId, cat2.id, {
        name: "可樂",
        price: 50,
      });

      const table = await seedTable(ctx, restaurantId, { number: 20 });
      const order = await seedOrder(ctx, restaurantId, {
        status: "completed",
        tableId: table.id,
        orderNumber: "ORD-CAT1",
      });

      await seedOrderItem(ctx, order.id, mainDish.id, {
        quantity: 2,
        unitPrice: 500,
        totalPrice: 1000,
      });
      await seedOrderItem(ctx, order.id, drink.id, {
        quantity: 3,
        unitPrice: 50,
        totalPrice: 150,
      });

      const results = ctx.dataStore.query(
        `SELECT c.name as category, SUM(oi.total_price) as revenue
         FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         JOIN categories c ON mi.category_id = c.id
         GROUP BY c.id
         ORDER BY revenue DESC`,
        [],
      );

      expect(results).toHaveLength(2);
      expect(results[0].category).toBe("主菜");
      expect(results[0].revenue).toBe(1000);
      expect(results[1].category).toBe("飲料");
      expect(results[1].revenue).toBe(150);
    });

    it("should calculate customer order frequency", async () => {
      const table = await seedTable(ctx, restaurantId, { number: 30 });

      // Customer 1: 3 orders, Customer 2: 1 order
      await seedOrder(ctx, restaurantId, {
        customerId: 100,
        tableId: table.id,
        status: "completed",
        orderNumber: "ORD-F1",
      });
      await seedOrder(ctx, restaurantId, {
        customerId: 100,
        tableId: table.id,
        status: "completed",
        orderNumber: "ORD-F2",
      });
      await seedOrder(ctx, restaurantId, {
        customerId: 100,
        tableId: table.id,
        status: "completed",
        orderNumber: "ORD-F3",
      });
      await seedOrder(ctx, restaurantId, {
        customerId: 200,
        tableId: table.id,
        status: "completed",
        orderNumber: "ORD-F4",
      });

      const results = ctx.dataStore.query(
        `SELECT customer_id, COUNT(*) as order_count
         FROM orders
         WHERE restaurant_id = ? AND customer_id IS NOT NULL
         GROUP BY customer_id
         ORDER BY order_count DESC`,
        [restaurantId],
      );

      expect(results).toHaveLength(2);
      expect(results[0].customer_id).toBe(100);
      expect(results[0].order_count).toBe(3);
      expect(results[1].customer_id).toBe(200);
      expect(results[1].order_count).toBe(1);
    });
  });
});
