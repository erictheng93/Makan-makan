import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
import type { D1Database } from "@cloudflare/workers-types";
import {
  categories,
  coupons,
  couponUsage,
  menuItems,
  orderItems,
  orders,
  restaurants,
  users,
} from "../schema";
import {
  createTestDatabase,
  type TestDatabase,
} from "../testing/create-test-database";
import { OrderService } from "./order";

const restaurantId = "restaurant-price-test";
const menuItemId = 101;
const couponUserId = "018f0000-0000-7000-8000-000000000077";

describe("OrderService order pricing", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, 180_000);

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
    await seedMenuItem(testDb);
  });

  it("prices selected customizations from the catalog instead of client prices", async () => {
    const service = new OrderService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });

    const order = await service.createOrder({
      restaurantId,
      items: [
        {
          menuItemId,
          quantity: 1,
          customizations: {
            size: {
              id: "large",
              name: "Large",
              priceAdjustment: -9.99,
            },
            options: [
              {
                id: "spice",
                optionName: "Spice",
                choiceId: "hot",
                choiceName: "Hot",
                priceAdjustment: -9.99,
              },
            ],
            addOns: [
              {
                id: "egg",
                name: "Egg",
                unitPrice: -9.99,
                quantity: 2,
                totalPrice: -19.98,
              },
            ],
          },
        },
      ],
    });

    expect(order.subtotal).toBe(15.5);
    expect(order.totalAmount).toBe(15.5);
    expect(order.items?.[0]).toMatchObject({
      unitPrice: 15.5,
      totalPrice: 15.5,
      customizations: {
        size: { id: "large", name: "Large", priceAdjustment: 2 },
        options: [
          {
            id: "spice",
            optionName: "Spice",
            choiceId: "hot",
            choiceName: "Hot",
            priceAdjustment: 1.5,
          },
        ],
        addOns: [
          {
            id: "egg",
            name: "Egg",
            unitPrice: 1,
            quantity: 2,
            totalPrice: 2,
          },
        ],
      },
    });
  });

  it("rejects unknown customization choices", async () => {
    const service = new OrderService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      await expect(
        service.createOrder({
          restaurantId,
          items: [
            {
              menuItemId,
              quantity: 1,
              customizations: {
                options: [
                  {
                    id: "spice",
                    optionName: "Spice",
                    choiceId: "not-on-menu",
                    choiceName: "Hidden discount",
                    priceAdjustment: -9.99,
                  },
                ],
              },
            },
          ],
        }),
      ).rejects.toThrow(
        "Unknown customization choice not-on-menu for menu item 101",
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});

const INJECTED_FAILURE = "injected D1 failure";

/**
 * Wraps a real D1 binding so that any statement whose SQL matches
 * `shouldFail` throws — simulating the transient write failures D1 can
 * surface in production. A failed db.batch() never partially commits
 * (D1 batches are transactional), so the wrapper also rejects whole
 * batches containing a matching statement.
 */
function withFailureInjection(
  db: D1Database,
  shouldFail: (sql: string) => boolean,
): D1Database {
  const wrapStatement = (stmt: any, sqlText: string): any => ({
    __sql: sqlText,
    __real: stmt,
    bind: (...args: unknown[]) => wrapStatement(stmt.bind(...args), sqlText),
    run: async (...args: unknown[]) => {
      if (shouldFail(sqlText)) throw new Error(INJECTED_FAILURE);
      return stmt.run(...args);
    },
    all: async (...args: unknown[]) => {
      if (shouldFail(sqlText)) throw new Error(INJECTED_FAILURE);
      return stmt.all(...args);
    },
    first: async (...args: unknown[]) => {
      if (shouldFail(sqlText)) throw new Error(INJECTED_FAILURE);
      return stmt.first(...args);
    },
    raw: async (...args: unknown[]) => {
      if (shouldFail(sqlText)) throw new Error(INJECTED_FAILURE);
      return stmt.raw(...args);
    },
  });

  return {
    prepare: (sqlText: string) => wrapStatement(db.prepare(sqlText), sqlText),
    batch: async (statements: any[]) => {
      if (statements.some((s) => s.__sql && shouldFail(s.__sql))) {
        throw new Error(INJECTED_FAILURE);
      }
      return db.batch(statements.map((s) => s.__real ?? s));
    },
    exec: (query: string) => (db as any).exec(query),
    dump: () => (db as any).dump?.(),
  } as unknown as D1Database;
}

describe("OrderService createOrder atomicity", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, 180_000);

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
    await seedMenuItem(testDb);
    await seedCoupon(testDb);
  });

  const couponOrder = {
    restaurantId,
    couponCode: "SAVE5",
    items: [{ menuItemId, quantity: 2 }],
  };

  it("persists order, items, coupon usage, and counters together on success", async () => {
    const service = new OrderService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });

    const order = await service.createOrder(couponOrder);

    expect(order.subtotal).toBe(20);
    expect(order.discountAmount).toBe(5);
    expect(order.totalAmount).toBe(15);
    expect(order.items).toHaveLength(1);

    const [usage] = await testDb.drizzle.select().from(couponUsage);
    expect(usage).toMatchObject({
      orderId: order.id,
      discountAmountCents: 500,
      status: "active",
    });

    const [coupon] = await testDb.drizzle.select().from(coupons);
    expect(coupon.usedCount).toBe(1);

    const [item] = await testDb.drizzle
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, menuItemId));
    expect(item.inventoryCount).toBe(8);
    expect(item.orderCount).toBe(2);

    const [restaurant] = await testDb.drizzle
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId));
    expect(restaurant.totalOrders).toBe(1);
  });

  it("enforces per-user coupon limits and records the coupon user", async () => {
    const service = new OrderService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    await testDb.drizzle
      .update(coupons)
      .set({ usageLimitPerUser: 1 })
      .where(eq(coupons.code, "SAVE5"));
    await testDb.drizzle.insert(users).values({
      id: couponUserId,
      username: "coupon-user-77",
      fullName: "Coupon User",
      passwordHash: "hash",
      role: 5,
      restaurantId,
      isActive: true,
      isVerified: true,
    });

    const firstOrder = await service.createOrder({
      ...couponOrder,
      couponUserId,
      clientMutationId: "coupon-user-first",
    });

    const [usage] = await testDb.drizzle.select().from(couponUsage);
    expect(usage).toMatchObject({
      orderId: firstOrder.id,
      userId: couponUserId,
      status: "active",
    });

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      await expect(
        service.createOrder({
          ...couponOrder,
          couponUserId,
          clientMutationId: "coupon-user-second",
        }),
      ).rejects.toThrow("您已達到此優惠券的使用次數上限");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("adds items to an existing order and updates totals and inventory", async () => {
    const service = new OrderService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const order = await service.createOrder({
      restaurantId,
      items: [{ menuItemId, quantity: 1 }],
    });

    const updated = await service.addItemsToOrder(order.id, [
      { menuItemId, quantity: 2, notes: "extra sambal" },
    ]);

    expect(updated.items).toHaveLength(2);
    expect(updated.subtotal).toBe(30);
    expect(updated.totalAmount).toBe(30);
    expect(updated.items?.[1]).toMatchObject({
      menuItemId,
      quantity: 2,
      totalPrice: 20,
      notes: "extra sambal",
    });

    const persistedItems = await testDb.drizzle.select().from(orderItems);
    expect(persistedItems).toHaveLength(2);

    const [item] = await testDb.drizzle
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, menuItemId));
    expect(item.inventoryCount).toBe(7);
    expect(item.orderCount).toBe(3);
  });

  it("rejects adding items to non-open orders", async () => {
    const service = new OrderService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const order = await service.createOrder({
      restaurantId,
      items: [{ menuItemId, quantity: 1 }],
    });
    await service.updateOrderStatus(order.id, { status: "ready" });

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      await expect(
        service.addItemsToOrder(order.id, [{ menuItemId, quantity: 1 }]),
      ).rejects.toThrow("Cannot add items to an order with status: ready");
    } finally {
      consoleError.mockRestore();
    }

    const persistedItems = await testDb.drizzle.select().from(orderItems);
    expect(persistedItems).toHaveLength(1);
  });

  it("rejects duplicate menu item lines that exceed available inventory together", async () => {
    const service = new OrderService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      await expect(
        service.createOrder({
          restaurantId,
          items: [
            { menuItemId, quantity: 6 },
            { menuItemId, quantity: 6 },
          ],
        }),
      ).rejects.toThrow("Insufficient inventory for Nasi Lemak");
    } finally {
      consoleError.mockRestore();
    }

    await expect(testDb.drizzle.select().from(orders)).resolves.toEqual([]);
    await expect(testDb.drizzle.select().from(orderItems)).resolves.toEqual([]);

    const [item] = await testDb.drizzle
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, menuItemId));
    expect(item.inventoryCount).toBe(10);
    expect(item.orderCount).toBe(0);
  });

  it.each([
    ["order items insert", /insert into\s+"?order_items"?/i],
    ["inventory update", /update\s+"?menu_items"?/i],
  ])(
    "leaves no partial writes when the %s fails",
    async (_label, failurePattern) => {
      const service = new OrderService(
        withFailureInjection(testDb.bindings.DB, (sqlText) =>
          failurePattern.test(sqlText),
        ),
        { JWT_SECRET: "test" },
      );
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      try {
        // The surfaced message varies (drizzle wraps injected errors as
        // "Failed query: ..."), so only the rejection itself is asserted —
        // the no-partial-write checks below are the actual contract.
        await expect(service.createOrder(couponOrder)).rejects.toThrow();
      } finally {
        consoleError.mockRestore();
      }

      // Nothing from the failed attempt may remain: no orphan order, no
      // items, no coupon consumption, no inventory drift.
      await expect(testDb.drizzle.select().from(orders)).resolves.toEqual([]);
      await expect(testDb.drizzle.select().from(orderItems)).resolves.toEqual(
        [],
      );
      await expect(testDb.drizzle.select().from(couponUsage)).resolves.toEqual(
        [],
      );

      const [coupon] = await testDb.drizzle.select().from(coupons);
      expect(coupon.usedCount).toBe(0);

      const [item] = await testDb.drizzle
        .select()
        .from(menuItems)
        .where(eq(menuItems.id, menuItemId));
      expect(item.inventoryCount).toBe(10);
      expect(item.orderCount).toBe(0);

      const [restaurant] = await testDb.drizzle
        .select()
        .from(restaurants)
        .where(eq(restaurants.id, restaurantId));
      expect(restaurant.totalOrders ?? 0).toBe(0);
    },
  );
});

describe("OrderService cancelOrder atomicity", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, 180_000);

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
    await seedMenuItem(testDb);
  });

  it("restores inventory only for the cancellation that changes order status", async () => {
    const service = new OrderService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const order = await service.createOrder({
      restaurantId,
      items: [{ menuItemId, quantity: 2 }],
    });

    const [afterCreate] = await testDb.drizzle
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, menuItemId));
    expect(afterCreate.inventoryCount).toBe(8);

    await expect(service.cancelOrder(order.id, "customer")).resolves.toEqual(
      expect.objectContaining({ status: "cancelled" }),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      await expect(service.cancelOrder(order.id, "duplicate")).rejects.toThrow(
        "Order cannot be cancelled",
      );
    } finally {
      consoleError.mockRestore();
    }

    const [afterDuplicateCancel] = await testDb.drizzle
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, menuItemId));
    expect(afterDuplicateCancel.inventoryCount).toBe(10);
  });

  it("does not double-restore inventory for concurrent duplicate cancellations", async () => {
    const service = new OrderService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const order = await service.createOrder({
      restaurantId,
      items: [{ menuItemId, quantity: 2 }],
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const results = await Promise.allSettled([
        service.cancelOrder(order.id, "customer"),
        service.cancelOrder(order.id, "duplicate"),
      ]);

      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const rejected = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toEqual(
        expect.objectContaining({ message: "Order cannot be cancelled" }),
      );
    } finally {
      consoleError.mockRestore();
    }

    const [afterConcurrentCancel] = await testDb.drizzle
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, menuItemId));
    expect(afterConcurrentCancel.inventoryCount).toBe(10);

    const [persistedOrder] = await testDb.drizzle
      .select()
      .from(orders)
      .where(eq(orders.id, order.id));
    expect(persistedOrder.status).toBe("cancelled");
  });
});

async function seedCoupon(testDb: TestDatabase) {
  await testDb.drizzle.insert(coupons).values({
    restaurantId,
    code: "SAVE5",
    name: "RM5 off",
    discountType: "fixed",
    discountValueCents: 500,
    usageLimit: 5,
    usedCount: 0,
    validFrom: "2020-01-01",
    validTo: "2099-12-31",
    isActive: true,
    isVisible: true,
  });
}

async function seedMenuItem(testDb: TestDatabase) {
  await testDb.drizzle.insert(restaurants).values({
    id: restaurantId,
    name: "Price Test Restaurant",
    type: "restaurant",
    category: "casual",
    address: "1 Test St",
    district: "Test District",
    city: "Test City",
    phone: "0912345678",
    isAvailable: true,
    settings: {
      taxRate: 0,
      serviceChargeRate: 0,
      minOrderAmount: 0,
    },
  });

  const [category] = await testDb.drizzle
    .insert(categories)
    .values({
      restaurantId,
      name: "Meals",
      sortOrder: 1,
    })
    .returning({ id: categories.id });

  await testDb.drizzle.insert(menuItems).values({
    id: menuItemId,
    restaurantId,
    categoryId: category.id,
    name: "Nasi Lemak",
    priceCents: 1000,
    isAvailable: true,
    inventoryCount: 10,
    options: {
      sizes: [
        {
          id: "large",
          name: "Large",
          priceAdjustment: 2,
        },
      ],
      customizations: [
        {
          id: "spice",
          name: "Spice",
          type: "single",
          required: false,
          choices: [
            {
              id: "hot",
              name: "Hot",
              priceAdjustment: 1.5,
            },
          ],
        },
      ],
      addOns: [
        {
          id: "egg",
          name: "Egg",
          price: 1,
          maxQuantity: 3,
        },
      ],
    },
  });
}
