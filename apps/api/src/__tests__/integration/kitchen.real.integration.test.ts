import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
} from "@makanmakan/database/testing";
import { eq } from "drizzle-orm";
import {
  categories,
  menuItems,
  orderItems,
  orders,
  restaurants,
} from "@makanmakan/database";
import type { Env } from "../../types/env";
import { KitchenService } from "../../features/kitchen/services/KitchenService";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
});

afterAll(async () => {
  await testDb.dispose();
});

beforeEach(async () => {
  await testDb.truncateAll();
});

function buildEnv(): Env {
  return {
    DB: testDb.bindings.DB,
    CACHE_KV: testDb.bindings.CACHE_KV,
  } as Env;
}

describe("KitchenService real D1 integration", () => {
  it("updates an in-scope order item using the migrated orders schema", async () => {
    const now = new Date("2026-06-07T12:00:00.000Z");
    const restaurantId = "kitchen-real-restaurant";

    await testDb.drizzle.insert(restaurants).values({
      id: restaurantId,
      name: "Kitchen Real Restaurant",
      type: "restaurant",
      category: "casual",
      address: "1 Kitchen St",
      district: "Central",
      city: "Taipei",
      phone: "0200000000",
      settings: {},
      isAvailable: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    } as never);

    const [category] = await testDb.drizzle
      .insert(categories)
      .values({
        restaurantId,
        name: "Mains",
        sortOrder: 1,
        isActive: true,
        isVisible: true,
        createdAt: now,
        updatedAt: now,
      } as never)
      .returning();

    const [menuItem] = await testDb.drizzle
      .insert(menuItems)
      .values({
        restaurantId,
        categoryId: category.id,
        name: "Nasi Lemak",
        price: 120,
        priceCents: 12000,
        isAvailable: true,
        createdAt: now,
        updatedAt: now,
      } as never)
      .returning();

    const [order] = await testDb.drizzle
      .insert(orders)
      .values({
        restaurantId,
        orderNumber: "KIT-001",
        status: "confirmed",
        orderType: "table",
        orderSource: "direct",
        subtotal: 120,
        totalAmount: 120,
        subtotalCents: 12000,
        totalAmountCents: 12000,
        taxAmount: 0,
        taxAmountCents: 0,
        serviceCharge: 0,
        serviceChargeCents: 0,
        discountAmount: 0,
        discountAmountCents: 0,
        paymentStatus: "pending",
        customerInfo: {},
        promotionIds: [],
        createdAt: now,
        updatedAt: now,
      } as never)
      .returning();

    const [orderItem] = await testDb.drizzle
      .insert(orderItems)
      .values({
        orderId: order.id,
        menuItemId: menuItem.id,
        quantity: 1,
        unitPrice: 120,
        totalPrice: 120,
        unitPriceCents: 12000,
        totalPriceCents: 12000,
        status: "pending",
        itemSnapshot: { name: "Nasi Lemak", price: 120 },
        createdAt: now,
        updatedAt: now,
      } as never)
      .returning();

    await expect(
      new KitchenService(buildEnv()).updateOrderItemStatus(
        restaurantId,
        order.id,
        orderItem.id,
        { status: "ready", notes: "plated" },
        2,
      ),
    ).resolves.toMatchObject({
      orderId: order.id,
      itemId: orderItem.id,
      status: "ready",
    });

    const [updatedItem] = await testDb.drizzle
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, orderItem.id));
    expect(updatedItem.status).toBe("ready");
  });
});
