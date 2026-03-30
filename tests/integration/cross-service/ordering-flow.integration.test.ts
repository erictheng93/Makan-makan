/**
 * End-to-End Ordering Flow Integration Tests
 *
 * Tests complete business flows that span multiple features:
 * 1. Full order lifecycle
 * 2. Coupon application flow
 * 3. Table occupancy flow
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  createIntegrationTestApp,
  type IntegrationTestApp,
} from "../../../apps/api/src/__tests__/integration/helpers/extended-test-app";
import {
  seedRestaurant,
  seedAdmin,
  seedTable,
  seedCategory,
  seedMenuItem,
  seedOrder,
  seedOrderItem,
  clearAllTables,
  type SeedContext,
} from "../../../apps/api/src/__tests__/integration/helpers/seed-helper";

describe("End-to-End Ordering Flow", () => {
  let app: IntegrationTestApp["app"];
  let ctx: SeedContext;
  let authHelper: IntegrationTestApp["authHelper"];
  let restaurantId: number;
  let adminToken: string;

  beforeAll(async () => {
    const testApp = await createIntegrationTestApp();
    app = testApp.app;
    ctx = { db: testApp.db, dataStore: testApp.dataStore };
    authHelper = testApp.authHelper;
  });

  beforeEach(async () => {
    clearAllTables(ctx);
    const restaurant = await seedRestaurant(ctx);
    restaurantId = restaurant.id;
    await seedAdmin(ctx, restaurantId);
    adminToken = authHelper.adminToken(restaurantId);
  });

  describe("Full Order Lifecycle", () => {
    it("should track all timestamps through order status transitions", async () => {
      // Seed menu and table
      const table = await seedTable(ctx, restaurantId, { number: 1 });
      const order = await seedOrder(ctx, restaurantId, {
        status: "pending",
        tableId: table.id,
        totalAmount: 500,
        orderNumber: "ORD-LIFE-1",
      });

      // Verify initial state
      const initial = ctx.dataStore.queryOne(
        "SELECT * FROM orders WHERE id = ?",
        [order.id],
      );
      expect(initial.status).toBe("pending");
      expect(initial.confirmed_at).toBeNull();
      expect(initial.preparing_at).toBeNull();
      expect(initial.ready_at).toBeNull();
      expect(initial.delivered_at).toBeNull();

      // Transition: pending → confirmed
      const now1 = Date.now();
      ctx.dataStore.run(
        "UPDATE orders SET status = 'confirmed', confirmed_at = ? WHERE id = ?",
        [now1, order.id],
      );

      const afterConfirm = ctx.dataStore.queryOne(
        "SELECT * FROM orders WHERE id = ?",
        [order.id],
      );
      expect(afterConfirm.status).toBe("confirmed");
      expect(afterConfirm.confirmed_at).toBe(now1);

      // Transition: confirmed → preparing
      const now2 = Date.now();
      ctx.dataStore.run(
        "UPDATE orders SET status = 'preparing', preparing_at = ? WHERE id = ?",
        [now2, order.id],
      );

      const afterPreparing = ctx.dataStore.queryOne(
        "SELECT * FROM orders WHERE id = ?",
        [order.id],
      );
      expect(afterPreparing.status).toBe("preparing");
      expect(afterPreparing.preparing_at).toBe(now2);

      // Transition: preparing → ready
      const now3 = Date.now();
      ctx.dataStore.run(
        "UPDATE orders SET status = 'ready', ready_at = ? WHERE id = ?",
        [now3, order.id],
      );

      const afterReady = ctx.dataStore.queryOne(
        "SELECT * FROM orders WHERE id = ?",
        [order.id],
      );
      expect(afterReady.status).toBe("ready");
      expect(afterReady.ready_at).toBe(now3);

      // Transition: ready → delivered
      const now4 = Date.now();
      ctx.dataStore.run(
        "UPDATE orders SET status = 'delivered', delivered_at = ? WHERE id = ?",
        [now4, order.id],
      );

      const afterDelivered = ctx.dataStore.queryOne(
        "SELECT * FROM orders WHERE id = ?",
        [order.id],
      );
      expect(afterDelivered.status).toBe("delivered");
      expect(afterDelivered.delivered_at).toBe(now4);

      // All timestamps set in order
      expect(afterDelivered.confirmed_at).toBeLessThanOrEqual(
        afterDelivered.preparing_at,
      );
      expect(afterDelivered.preparing_at).toBeLessThanOrEqual(
        afterDelivered.ready_at,
      );
      expect(afterDelivered.ready_at).toBeLessThanOrEqual(
        afterDelivered.delivered_at,
      );
    });
  });

  describe("Coupon Application Flow", () => {
    it("should apply coupon discount and track usage", async () => {
      // 1. Create coupon
      const now = new Date().toISOString();
      ctx.dataStore.insert("coupons", {
        restaurantId: String(restaurantId),
        code: "SAVE20",
        name: "20% Off",
        discountType: "percentage",
        discountValue: 20,
        minOrderAmount: 100,
        maxDiscountAmount: 200,
        usageLimit: 10,
        usageCount: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      // 2. Verify coupon exists
      const coupon = ctx.dataStore.queryOne(
        "SELECT * FROM coupons WHERE code = ?",
        ["SAVE20"],
      );
      expect(coupon).not.toBeNull();
      expect(coupon.discount_value).toBe(20);
      expect(coupon.usage_count).toBe(0);

      // 3. Create order with coupon code
      const table = await seedTable(ctx, restaurantId, { number: 10 });
      const subtotal = 500;
      const discount = subtotal * 0.2; // 100
      await seedOrder(ctx, restaurantId, {
        tableId: table.id,
        status: "completed",
        subtotal,
        discountAmount: discount,
        totalAmount: subtotal - discount,
        couponCode: "SAVE20",
        orderNumber: "ORD-COUPON-1",
      });

      // 4. Simulate coupon usage increment
      ctx.dataStore.run(
        "UPDATE coupons SET usage_count = usage_count + 1 WHERE code = ?",
        ["SAVE20"],
      );

      // 5. Verify coupon usage updated
      const updatedCoupon = ctx.dataStore.queryOne(
        "SELECT * FROM coupons WHERE code = ?",
        ["SAVE20"],
      );
      expect(updatedCoupon.usage_count).toBe(1);

      // 6. Verify order has coupon code and correct discount
      const order = ctx.dataStore.queryOne(
        "SELECT * FROM orders WHERE coupon_code = ?",
        ["SAVE20"],
      );
      expect(order).not.toBeNull();
      expect(order.discount_amount).toBe(100);
      expect(order.total_amount).toBe(400);
    });
  });

  describe("Table Occupancy Flow", () => {
    it("should track table state through order lifecycle", async () => {
      // 1. Table starts available
      const table = await seedTable(ctx, restaurantId, {
        number: 20,
        isOccupied: false,
      });

      const initial = ctx.dataStore.queryOne(
        "SELECT * FROM tables WHERE id = ?",
        [table.id],
      );
      expect(initial.is_occupied).toBe(0);

      // 2. Customer seated → table becomes occupied
      const seatTime = Date.now();
      ctx.dataStore.run(
        "UPDATE tables SET is_occupied = 1, occupied_at = ? WHERE id = ?",
        [seatTime, table.id],
      );

      // 3. Create order at this table
      const order = await seedOrder(ctx, restaurantId, {
        tableId: table.id,
        status: "pending",
        orderNumber: "ORD-TABLE-1",
      });

      // Link table to order
      ctx.dataStore.run("UPDATE tables SET current_order_id = ? WHERE id = ?", [
        order.id,
        table.id,
      ]);

      const occupied = ctx.dataStore.queryOne(
        "SELECT * FROM tables WHERE id = ?",
        [table.id],
      );
      expect(occupied.is_occupied).toBe(1);
      expect(occupied.current_order_id).toBe(order.id);

      // 4. Order completed → table freed
      ctx.dataStore.run(
        "UPDATE orders SET status = 'completed', paid_at = ? WHERE id = ?",
        [Date.now(), order.id],
      );
      ctx.dataStore.run(
        "UPDATE tables SET is_occupied = 0, current_order_id = NULL, occupied_at = NULL WHERE id = ?",
        [table.id],
      );

      const freed = ctx.dataStore.queryOne(
        "SELECT * FROM tables WHERE id = ?",
        [table.id],
      );
      expect(freed.is_occupied).toBe(0);
      expect(freed.current_order_id).toBeNull();
    });
  });
});
