import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { categories, menuItems, restaurants } from "../schema";
import {
  createTestDatabase,
  type TestDatabase,
} from "../testing/create-test-database";
import { OrderService } from "./order";

const restaurantId = "restaurant-price-test";
const menuItemId = 101;

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
    price: 10,
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
