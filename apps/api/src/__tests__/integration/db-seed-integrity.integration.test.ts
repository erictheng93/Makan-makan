/**
 * DB Seed Integrity Integration Tests
 *
 * Verifies that factory-generated seed data can be inserted into the test DB
 * and maintains referential integrity. No vi.mock() calls.
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  createIntegrationTestApp,
  type IntegrationTestApp,
} from "./helpers/extended-test-app";
import {
  seedCompleteRestaurant,
  seedRestaurant,
  seedUser,
  seedAdmin,
  seedCategory,
  seedMenuItem,
  seedTable,
  seedOrder,
  seedOrderItem,
  clearAllTables,
  type SeedContext,
} from "./helpers/seed-helper";

describe("DB Seed Integrity", () => {
  let ctx: SeedContext;

  beforeAll(async () => {
    const testApp = await createIntegrationTestApp();
    ctx = { db: testApp.db, dataStore: testApp.dataStore };
  });

  beforeEach(() => {
    clearAllTables(ctx);
  });

  // ─── 1. seedCompleteRestaurant() inserts all records ─────────────────────

  it("seedCompleteRestaurant() inserts all records — counts match summary", async () => {
    const result = await seedCompleteRestaurant(ctx);

    // Query actual counts from each table
    const restaurantRows = ctx.dataStore.query(
      "SELECT COUNT(*) as count FROM restaurants",
    );
    const userRows = ctx.dataStore.query("SELECT COUNT(*) as count FROM users");
    const categoryRows = ctx.dataStore.query(
      "SELECT COUNT(*) as count FROM categories",
    );
    const menuItemRows = ctx.dataStore.query(
      "SELECT COUNT(*) as count FROM menu_items",
    );

    expect(restaurantRows[0].count).toBe(result.summary.restaurantCount);

    // Users = employees + customers (both inserted into users table)
    const expectedUserCount =
      result.summary.employeeCount + result.summary.customerCount;
    expect(userRows[0].count).toBe(expectedUserCount);

    expect(categoryRows[0].count).toBe(result.summary.categoryCount);
    expect(menuItemRows[0].count).toBe(result.summary.menuItemCount);
  });

  // ─── 2. FK integrity: order → restaurant ─────────────────────────────────

  it("seeded order's restaurant_id exists in restaurants table", async () => {
    const restaurant = await seedRestaurant(ctx);
    const order = await seedOrder(ctx, restaurant.id);

    // Verify the order's restaurant_id points to an existing restaurant
    const restaurants = ctx.dataStore.select("restaurants", {
      id: restaurant.id,
    });
    expect(restaurants.length).toBe(1);

    // Verify the order was actually inserted with that restaurant_id
    const orders = ctx.dataStore.select("orders", { id: order.id });
    expect(orders.length).toBe(1);

    const orderRestaurantId = orders[0].restaurant_id;
    const matchingRestaurant = ctx.dataStore.select("restaurants", {
      id: orderRestaurantId,
    });
    expect(matchingRestaurant.length).toBe(1);
    expect(matchingRestaurant[0].id).toBe(restaurant.id);
  });

  // ─── 3. FK integrity: order_item → menu_item ────────────────────────────

  it("seeded order_item's menu_item_id exists in menu_items table", async () => {
    const restaurant = await seedRestaurant(ctx);
    const category = await seedCategory(ctx, restaurant.id);
    const menuItem = await seedMenuItem(ctx, restaurant.id, category.id);
    const order = await seedOrder(ctx, restaurant.id);
    const orderItem = await seedOrderItem(ctx, order.id, menuItem.id);

    // Verify the order_item was inserted
    const orderItems = ctx.dataStore.select("order_items", {
      id: orderItem.id,
    });
    expect(orderItems.length).toBe(1);

    // Verify the menu_item_id references a real menu item
    const orderItemMenuItemId = orderItems[0].menu_item_id;
    const matchingMenuItem = ctx.dataStore.select("menu_items", {
      id: orderItemMenuItemId,
    });
    expect(matchingMenuItem.length).toBe(1);
    expect(matchingMenuItem[0].id).toBe(menuItem.id);
  });

  // ─── 4. FK integrity: user → restaurant ──────────────────────────────────

  it("seeded user's restaurant_id exists in restaurants table", async () => {
    const restaurant = await seedRestaurant(ctx);
    const user = await seedAdmin(ctx, restaurant.id);

    // Verify the user was inserted
    const users = ctx.dataStore.select("users", { id: user.id });
    expect(users.length).toBe(1);

    // Verify the restaurant_id references a real restaurant
    const userRestaurantId = users[0].restaurant_id;
    const matchingRestaurant = ctx.dataStore.select("restaurants", {
      id: userRestaurantId,
    });
    expect(matchingRestaurant.length).toBe(1);
  });

  // ─── 5. Unique constraint: duplicate username throws ─────────────────────

  it("inserting duplicate username throws an error", async () => {
    const restaurant = await seedRestaurant(ctx);
    const fixedUsername = `unique-user-${Date.now()}`;
    await seedUser(ctx, restaurant.id, { username: fixedUsername });

    // Attempting to insert a second user with the same username should throw
    await expect(
      seedUser(ctx, restaurant.id, { username: fixedUsername }),
    ).rejects.toThrow();
  });

  // ─── 6. seedTable creates table with valid QR code ───────────────────────

  it("seedTable creates a table with a valid QR code", async () => {
    const restaurant = await seedRestaurant(ctx);
    const table = await seedTable(ctx, restaurant.id, { number: 7 });

    // Verify the table was inserted
    const tables = ctx.dataStore.select("tables", { id: table.id });
    expect(tables.length).toBe(1);

    // Verify QR code is present and non-empty
    const qrCode = tables[0].qr_code;
    expect(qrCode).toBeDefined();
    expect(typeof qrCode).toBe("string");
    expect(qrCode.length).toBeGreaterThan(0);

    // QR code follows the expected pattern: QR-{restaurantId}-T{tableNum}-{timestamp}
    expect(qrCode).toMatch(/^QR-\d+-T\d+-\d+$/);
  });
});
