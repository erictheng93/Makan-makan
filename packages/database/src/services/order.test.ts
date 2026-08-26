import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq, getTableColumns } from "drizzle-orm";
import type { D1Database } from "@cloudflare/workers-types";
import {
  categories,
  coupons,
  couponUsage,
  menuItems,
  menuItemOptionGroups,
  optionChoices,
  optionGroups,
  orderItems,
  orders,
  restaurants,
  users,
} from "../schema";
import {
  createTestDatabase,
  REAL_D1_SETUP_TIMEOUT_MS,
  type TestDatabase,
} from "../testing/create-test-database";
import { orderMenuItemSummaryColumns, OrderService } from "./order";

const restaurantId = "restaurant-price-test";
const menuItemId = 101;
const couponUserId = "018f0000-0000-7000-8000-000000000077";

function findUncoveredProjectionColumns(
  tableColumns: string[],
  projectedColumns: Iterable<string>,
  exemptColumns: Iterable<string>,
): string[] {
  const projected = new Set(projectedColumns);
  const exempt = new Set(exemptColumns);
  return tableColumns.filter(
    (column) => !projected.has(column) && !exempt.has(column),
  );
}

describe("OrderService projection drift guards", () => {
  const menuItemColumns = Object.keys(getTableColumns(menuItems));
  const orderMenuItemSummaryExemptColumns = [
    "restaurantId",
    "categoryId",
    "catalogType",
    "description",
    "ingredients",
    "priceCents",
    "originalPriceCents",
    "costPriceCents",
    "imageVariants",
    "imageId",
    "isAvailable",
    "isFeatured",
    "isPopular",
    "sortOrder",
    "inventoryCount",
    "minInventoryAlert",
    "spiceLevel",
    "preparationTime",
    "calories",
    "dietaryInfo",
    "allergens",
    "options",
    "availableHours",
    "orderCount",
    "rating",
    "reviewCount",
    "viewCount",
    "tags",
    "keywords",
    "createdAt",
    "updatedAt",
    "deletedAt",
  ];

  it("keeps order menu item summaries explicit about included/exempt fields", () => {
    expect(
      findUncoveredProjectionColumns(
        menuItemColumns,
        Object.keys(orderMenuItemSummaryColumns),
        orderMenuItemSummaryExemptColumns,
      ),
    ).toEqual([]);
  });

  it("fails closed when a new menu item column is neither projected nor exempted", () => {
    const futureColumn = "__futureColumn";

    expect(
      findUncoveredProjectionColumns(
        [...menuItemColumns, futureColumn],
        Object.keys(orderMenuItemSummaryColumns),
        orderMenuItemSummaryExemptColumns,
      ),
    ).toContain(futureColumn);
  });
});

describe("OrderService order pricing", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, REAL_D1_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
    await seedMenuItem(testDb);
  });

  // The customer app enforces these by disabling controls. A request that never
  // went through that UI has to meet the same rules, or "required" and
  // "maxSelections" are decorations the owner sets and nothing keeps.
  describe("customization group rules", () => {
    const service = () =>
      new OrderService(testDb.bindings.DB, { JWT_SECRET: "test" });

    async function seedGroups(
      groups: NonNullable<
        NonNullable<typeof menuItems.$inferInsert.options>["customizations"]
      >,
    ) {
      await testDb.drizzle
        .update(menuItems)
        .set({ options: { customizations: groups } })
        .where(eq(menuItems.id, menuItemId));
    }

    it("refuses an order that skips a required group", async () => {
      await seedGroups([
        {
          id: "spice",
          name: "Spice",
          type: "single",
          required: true,
          choices: [{ id: "hot", name: "Hot", priceAdjustment: 0 }],
        },
      ]);

      await expect(
        service().createOrder({
          restaurantId,
          items: [{ menuItemId, quantity: 1 }],
        }),
      ).rejects.toThrow(/Invalid customization: group spice is required/);
    });

    it("refuses two choices from a single-choice group", async () => {
      await seedGroups([
        {
          id: "spice",
          name: "Spice",
          type: "single",
          required: false,
          choices: [
            { id: "hot", name: "Hot", priceAdjustment: 0 },
            { id: "mild", name: "Mild", priceAdjustment: 0 },
          ],
        },
      ]);

      await expect(
        service().createOrder({
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
                    choiceId: "hot",
                    choiceName: "Hot",
                  },
                  {
                    id: "spice",
                    optionName: "Spice",
                    choiceId: "mild",
                    choiceName: "Mild",
                  },
                ],
              },
            },
          ],
        }),
      ).rejects.toThrow(
        /Invalid customization: group spice accepts a single choice/,
      );
    });

    it("refuses more choices than maxSelections allows", async () => {
      await seedGroups([
        {
          id: "toppings",
          name: "Toppings",
          type: "multiple",
          required: false,
          maxSelections: 1,
          choices: [
            { id: "pearl", name: "Pearl", priceAdjustment: 0 },
            { id: "jelly", name: "Jelly", priceAdjustment: 0 },
          ],
        },
      ]);

      await expect(
        service().createOrder({
          restaurantId,
          items: [
            {
              menuItemId,
              quantity: 1,
              customizations: {
                options: [
                  {
                    id: "toppings",
                    optionName: "Toppings",
                    choiceId: "pearl",
                    choiceName: "Pearl",
                  },
                  {
                    id: "toppings",
                    optionName: "Toppings",
                    choiceId: "jelly",
                    choiceName: "Jelly",
                  },
                ],
              },
            },
          ],
        }),
      ).rejects.toThrow(
        /Invalid customization: group toppings allows at most 1 choices/,
      );
    });

    // The seeded egg is capped at 3. Until the modal grew a stepper nothing
    // could send more than one, so this bound had never been exercised.
    it("refuses an add-on quantity above its cap", async () => {
      await expect(
        service().createOrder({
          restaurantId,
          items: [
            {
              menuItemId,
              quantity: 1,
              customizations: {
                addOns: [
                  {
                    id: "egg",
                    name: "Egg",
                    unitPrice: 1,
                    quantity: 4,
                    totalPrice: 4,
                  },
                ],
              },
            },
          ],
        }),
      ).rejects.toThrow(/Add-on egg quantity exceeds maximum/);
    });

    it("prices a multi-unit add-on from the catalog", async () => {
      const order = await service().createOrder({
        restaurantId,
        items: [
          {
            menuItemId,
            quantity: 1,
            customizations: {
              addOns: [
                {
                  id: "egg",
                  name: "Egg",
                  unitPrice: -99,
                  quantity: 3,
                  totalPrice: -297,
                },
              ],
            },
          },
        ],
      });

      // 10.00 base + 3 x 1.00 catalog price, not the client's numbers.
      expect(order.subtotal).toBe(13);
      expect(order.items?.[0].customizations?.addOns?.[0]).toMatchObject({
        quantity: 3,
        unitPrice: 1,
        totalPrice: 3,
      });
    });

    it("accepts a selection that satisfies every group rule", async () => {
      await seedGroups([
        {
          id: "toppings",
          name: "Toppings",
          type: "multiple",
          required: true,
          maxSelections: 2,
          choices: [
            { id: "pearl", name: "Pearl", priceAdjustment: 0 },
            { id: "jelly", name: "Jelly", priceAdjustment: 0 },
          ],
        },
      ]);

      const order = await service().createOrder({
        restaurantId,
        items: [
          {
            menuItemId,
            quantity: 1,
            customizations: {
              options: [
                {
                  id: "toppings",
                  optionName: "Toppings",
                  choiceId: "pearl",
                  choiceName: "Pearl",
                },
                {
                  id: "toppings",
                  optionName: "Toppings",
                  choiceId: "jelly",
                  choiceName: "Jelly",
                },
              ],
            },
          },
        ],
      });

      expect(order.items?.[0].customizations?.options).toHaveLength(2);
    });
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

  describe("assembled option row validation", () => {
    async function replaceCatalogWithOptionRows() {
      await testDb.drizzle
        .update(menuItems)
        .set({ options: null })
        .where(eq(menuItems.id, menuItemId));
      await testDb.drizzle.insert(optionGroups).values([
        {
          id: "order-group-spice",
          restaurantId,
          publicId: "spice",
          kind: "choice",
          name: "Spice",
          type: "multiple",
          required: true,
          maxSelections: 1,
          sortOrder: 1,
        },
        {
          id: "order-group-addons",
          restaurantId,
          publicId: "addOns",
          kind: "addon",
          name: "Add-ons",
          type: "multiple",
          required: false,
          sortOrder: 2,
        },
      ]);
      await testDb.drizzle.insert(optionChoices).values([
        {
          id: "order-choice-hot",
          groupId: "order-group-spice",
          publicId: "hot",
          name: "Hot",
          priceAdjustmentCents: 150,
          sortOrder: 1,
        },
        {
          id: "order-choice-mild",
          groupId: "order-group-spice",
          publicId: "mild",
          name: "Mild",
          priceAdjustmentCents: 0,
          sortOrder: 2,
        },
        {
          id: "order-choice-egg",
          groupId: "order-group-addons",
          publicId: "egg",
          name: "Egg",
          priceAdjustmentCents: 100,
          maxQuantity: 3,
          sortOrder: 1,
        },
      ]);
      await testDb.drizzle.insert(menuItemOptionGroups).values([
        {
          menuItemId,
          groupId: "order-group-spice",
          sortOrder: 1,
        },
        {
          menuItemId,
          groupId: "order-group-addons",
          sortOrder: 2,
        },
      ]);
    }

    it("enforces required, maxSelections, and maxQuantity from rows", async () => {
      const service = new OrderService(testDb.bindings.DB, {
        JWT_SECRET: "test",
      });
      await replaceCatalogWithOptionRows();

      await expect(
        service.createOrder({
          restaurantId,
          items: [{ menuItemId, quantity: 1 }],
        }),
      ).rejects.toThrow(/Invalid customization: group spice is required/);

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
                    choiceId: "hot",
                    choiceName: "Hot",
                  },
                  {
                    id: "spice",
                    optionName: "Spice",
                    choiceId: "mild",
                    choiceName: "Mild",
                  },
                ],
              },
            },
          ],
        }),
      ).rejects.toThrow(/Invalid customization: group spice allows at most 1/);

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
                    choiceId: "hot",
                    choiceName: "Hot",
                  },
                ],
                addOns: [
                  {
                    id: "egg",
                    name: "Egg",
                    unitPrice: 1,
                    quantity: 4,
                    totalPrice: 4,
                  },
                ],
              },
            },
          ],
        }),
      ).rejects.toThrow(/Add-on egg quantity exceeds maximum/);
    });
  });

  it("filters orders by canonical payment status", async () => {
    const service = new OrderService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const pendingOrder = await service.createOrder({
      restaurantId,
      items: [{ menuItemId, quantity: 1 }],
    });
    const completedOrder = await service.createOrder({
      restaurantId,
      items: [{ menuItemId, quantity: 1 }],
    });
    await testDb.drizzle
      .update(orders)
      .set({ paymentStatus: "completed" })
      .where(eq(orders.id, completedOrder.id));

    const result = await service.getOrders({
      restaurantId,
      paymentStatus: "pending",
    });

    expect(result.orders.map((order) => order.id)).toEqual([pendingOrder.id]);
    expect(result.pagination.total).toBe(1);
  });

  it("searches the complete order set by customer name", async () => {
    const service = new OrderService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const adaOrder = await service.createOrder({
      restaurantId,
      customerInfo: { name: "Ada Lovelace" },
      items: [{ menuItemId, quantity: 1 }],
    });
    await service.createOrder({
      restaurantId,
      customerInfo: { name: "Grace Hopper" },
      items: [{ menuItemId, quantity: 1 }],
    });

    const result = await service.getOrders({ restaurantId, search: "Ada" });

    expect(result.orders.map((order) => order.id)).toEqual([adaOrder.id]);
    expect(result.pagination.total).toBe(1);
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
  type WrappedStatement = D1PreparedStatement & {
    __sql: string;
    __real: D1PreparedStatement;
  };

  const wrapStatement = (
    stmt: D1PreparedStatement,
    sqlText: string,
  ): WrappedStatement => ({
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
    batch: async (statements: D1PreparedStatement[]) => {
      if (
        statements.some(
          (statement) =>
            "__sql" in statement &&
            typeof statement.__sql === "string" &&
            shouldFail(statement.__sql),
        )
      ) {
        throw new Error(INJECTED_FAILURE);
      }
      return db.batch(
        statements.map((statement) =>
          "__real" in statement ? statement.__real : statement,
        ),
      );
    },
    exec: (query: string) => db.exec(query),
    dump: () => db.dump(),
  } as unknown as D1Database;
}

describe("OrderService createOrder atomicity", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, REAL_D1_SETUP_TIMEOUT_MS);

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

  it("creates human-readable order numbers without embedding restaurant ids", async () => {
    const service = new OrderService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });

    const order = await service.createOrder({
      restaurantId,
      items: [{ menuItemId, quantity: 1 }],
    });

    expect(order.orderNumber).toMatch(
      /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
    );
    expect(order.orderNumber).not.toContain(restaurantId.toUpperCase());
    expect(order.orderNumber.length).toBe(9);
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
  }, REAL_D1_SETUP_TIMEOUT_MS);

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
