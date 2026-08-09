import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  categories,
  menuItems,
  menuItemOptionChoiceOverrides,
  menuItemOptionGroups,
  optionChoices,
  optionGroups,
  restaurants,
} from "../schema";
import {
  createTestDatabase,
  type TestDatabase,
} from "../testing/create-test-database";
import { MenuService } from "./menu";
import { loadAssembledMenuItemOptions } from "./menu-options";
import { OrderService } from "./order";

const restaurantId = "restaurant-option-writes";

describe("option group writes", () => {
  let testDb: TestDatabase;
  let categoryId: number;
  let menuItemId: number;

  const menuService = () =>
    new MenuService(testDb.bindings.DB, { JWT_SECRET: "test" });

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, 180_000);

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
    await testDb.drizzle.insert(restaurants).values({
      id: restaurantId,
      name: "Option Writes",
      type: "taiwanese",
      category: "casual",
      address: "1 Test St",
      district: "D",
      city: "C",
      phone: "0912345678",
      isAvailable: true,
    });
    const [category] = await testDb.drizzle
      .insert(categories)
      .values({ restaurantId, name: "Drinks", sortOrder: 1 })
      .returning({ id: categories.id });
    categoryId = category.id;
    const [item] = await testDb.drizzle
      .insert(menuItems)
      .values({
        restaurantId,
        categoryId,
        name: "Milk Tea",
        priceCents: 6000,
        isAvailable: true,
        inventoryCount: 10,
        options: null,
      })
      .returning({ id: menuItems.id });
    menuItemId = item.id;
  });

  async function seedGroup(
    id: string,
    publicId: string,
    overrides: Partial<typeof optionGroups.$inferInsert> = {},
  ) {
    await testDb.drizzle.insert(optionGroups).values({
      id,
      restaurantId,
      publicId,
      kind: "choice",
      name: publicId,
      type: "single",
      ...overrides,
    });
  }

  // public_id repeating across a restaurant is legitimate; repeating within one
  // item is what breaks the order validator's per-group counting.
  it("refuses to offer two groups with the same public id on one item", async () => {
    await seedGroup("group-1", "spice");
    await seedGroup("group-2", "spice");
    await menuService().linkMenuItemOptionGroup({
      menuItemId,
      groupId: "group-1",
    });

    await expect(
      menuService().linkMenuItemOptionGroup({
        menuItemId,
        groupId: "group-2",
      }),
    ).rejects.toThrow(/already offers an option group with public id spice/);
  });

  it("allows the same public id on a different item", async () => {
    await seedGroup("group-1", "spice");
    await seedGroup("group-2", "spice");
    const [other] = await testDb.drizzle
      .insert(menuItems)
      .values({
        restaurantId,
        categoryId,
        name: "Green Tea",
        priceCents: 5000,
        isAvailable: true,
        options: null,
      })
      .returning({ id: menuItems.id });

    await menuService().linkMenuItemOptionGroup({
      menuItemId,
      groupId: "group-1",
    });

    await expect(
      menuService().linkMenuItemOptionGroup({
        menuItemId: other.id,
        groupId: "group-2",
      }),
    ).resolves.toMatchObject({ groupId: "group-2" });
  });

  it("takes a soft-deleted group out of the assembled options", async () => {
    await seedGroup("group-1", "spice");
    await testDb.drizzle.insert(optionChoices).values({
      id: "choice-hot",
      groupId: "group-1",
      publicId: "hot",
      name: "Hot",
    });
    await menuService().linkMenuItemOptionGroup({
      menuItemId,
      groupId: "group-1",
    });

    const assembled = async () => {
      const [item] = await testDb.drizzle
        .select()
        .from(menuItems)
        .where(eq(menuItems.id, menuItemId));
      return (await loadAssembledMenuItemOptions(testDb.drizzle, [item])).get(
        menuItemId,
      );
    };

    expect((await assembled())?.customizations).toHaveLength(1);
    expect(await menuService().softDeleteOptionGroup("group-1")).toBe(true);
    expect((await assembled())?.customizations).toBeUndefined();
    // The link survives, so the delete is reversible.
    expect(
      await testDb.drizzle.select().from(menuItemOptionGroups),
    ).toHaveLength(1);
  });

  it("removes overrides with the choice they point at", async () => {
    await seedGroup("group-1", "spice");
    await testDb.drizzle.insert(optionChoices).values({
      id: "choice-hot",
      groupId: "group-1",
      publicId: "hot",
      name: "Hot",
    });
    await menuService().linkMenuItemOptionGroup({
      menuItemId,
      groupId: "group-1",
    });
    await menuService().upsertMenuItemOptionChoiceOverride({
      menuItemId,
      choiceId: "choice-hot",
      isHidden: true,
    });

    expect(await menuService().deleteOptionChoice("choice-hot")).toBe(true);

    expect(
      await testDb.drizzle.select().from(menuItemOptionChoiceOverrides),
    ).toHaveLength(0);
  });

  it("reports a miss instead of throwing when there is nothing to remove", async () => {
    expect(
      await menuService().unlinkMenuItemOptionGroup(menuItemId, "missing"),
    ).toBe(false);
    expect(await menuService().deleteOptionChoice("missing")).toBe(false);
    expect(
      await menuService().deleteMenuItemOptionChoiceOverride(
        menuItemId,
        "missing",
      ),
    ).toBe(false);
  });

  // The owner flips the switch mid-service; a modal opened a minute earlier
  // still shows what has since run out.
  describe("sold out is refused at submit", () => {
    const orderService = () =>
      new OrderService(testDb.bindings.DB, { JWT_SECRET: "test" });

    beforeEach(async () => {
      await seedGroup("group-sweet", "sweetness");
      await testDb.drizzle.insert(optionChoices).values([
        {
          id: "choice-half",
          groupId: "group-sweet",
          publicId: "half",
          name: "半糖",
          isAvailable: false,
        },
        {
          id: "choice-full",
          groupId: "group-sweet",
          publicId: "full",
          name: "全糖",
        },
      ]);
      await testDb.drizzle
        .insert(menuItemOptionGroups)
        .values({ menuItemId, groupId: "group-sweet" });
    });

    it("refuses a sold-out choice", async () => {
      await expect(
        orderService().createOrder({
          restaurantId,
          items: [
            {
              menuItemId,
              quantity: 1,
              customizations: {
                options: [
                  {
                    id: "sweetness",
                    optionName: "sweetness",
                    choiceId: "half",
                    choiceName: "半糖",
                  },
                ],
              },
            },
          ],
        }),
      ).rejects.toThrow(/Invalid customization: choice half is sold out/);
    });

    it("still takes the choice that is in stock", async () => {
      const order = await orderService().createOrder({
        restaurantId,
        items: [
          {
            menuItemId,
            quantity: 1,
            customizations: {
              options: [
                {
                  id: "sweetness",
                  optionName: "sweetness",
                  choiceId: "full",
                  choiceName: "全糖",
                },
              ],
            },
          },
        ],
      });

      expect(order.items?.[0].customizations?.options).toHaveLength(1);
    });
  });
});
