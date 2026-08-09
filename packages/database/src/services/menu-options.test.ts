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
import {
  backfillMenuItemOptions,
  loadAssembledMenuItemOptions,
} from "./menu-options";

const restaurantId = "restaurant-menu-options-test";

describe("menu item option rows", () => {
  let testDb: TestDatabase;
  let categoryId: number;

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
      name: "Menu Options Test",
      type: "taiwanese",
      category: "casual",
      address: "1 Test St",
      district: "Test District",
      city: "Test City",
      phone: "0912345678",
      isAvailable: true,
    });
    const [category] = await testDb.drizzle
      .insert(categories)
      .values({
        restaurantId,
        name: "Meals",
        sortOrder: 1,
      })
      .returning({ id: categories.id });
    categoryId = category.id;
  });

  it("backfills JSON options and assembles the same public shape", async () => {
    const originalOptions = {
      sizes: [
        {
          id: "large",
          name: "Large",
          priceAdjustment: 2,
          isDefault: true,
        },
      ],
      customizations: [
        {
          id: "spice",
          name: "Spice",
          type: "single" as const,
          required: true,
          choices: [
            { id: "hot", name: "Hot", priceAdjustment: 1.5 },
            { id: "mild", name: "Mild", priceAdjustment: 0 },
          ],
        },
      ],
      addOns: [
        {
          id: "egg",
          name: "Egg",
          price: 1,
          maxQuantity: 3,
          available: false,
        },
      ],
    };

    const [item] = await testDb.drizzle
      .insert(menuItems)
      .values({
        restaurantId,
        categoryId,
        name: "Nasi Lemak",
        priceCents: 1000,
        isAvailable: true,
        options: originalOptions,
      })
      .returning();

    const result = await backfillMenuItemOptions(testDb.bindings.DB);
    const optionMap = await loadAssembledMenuItemOptions(testDb.drizzle, [
      item,
    ]);
    const groups = await testDb.drizzle.select().from(optionGroups);
    const choices = await testDb.drizzle.select().from(optionChoices);

    expect(result).toMatchObject({
      menuItemsScanned: 1,
      menuItemsBackfilled: 1,
      groupsInserted: 3,
      choicesInserted: 4,
    });
    expect(optionMap.get(item.id)).toEqual(originalOptions);
    expect(groups.map((group) => group.publicId)).toEqual([
      "sizes",
      "spice",
      "addOns",
    ]);
    expect(choices.map((choice) => choice.publicId)).toEqual([
      "large",
      "hot",
      "mild",
      "egg",
    ]);
    expect(groups.every((group) => /^[0-9a-f-]{36}$/.test(group.id))).toBe(
      true,
    );
  });

  it("applies hidden, price, required, and sold-out overrides", async () => {
    await testDb.drizzle.insert(menuItems).values({
      id: 201,
      restaurantId,
      categoryId,
      name: "Laksa",
      priceCents: 1200,
      isAvailable: true,
      options: null,
    });

    await testDb.drizzle.insert(optionGroups).values([
      {
        id: "group-spice",
        restaurantId,
        publicId: "spice",
        kind: "choice",
        name: "Spice",
        type: "multiple",
        required: false,
        maxSelections: 2,
        sortOrder: 1,
      },
      {
        id: "group-addons",
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
        id: "choice-hot",
        groupId: "group-spice",
        publicId: "hot",
        name: "Hot",
        priceAdjustmentCents: 100,
        sortOrder: 1,
      },
      {
        id: "choice-mild",
        groupId: "group-spice",
        publicId: "mild",
        name: "Mild",
        priceAdjustmentCents: 0,
        sortOrder: 2,
      },
      {
        id: "choice-egg",
        groupId: "group-addons",
        publicId: "egg",
        name: "Egg",
        priceAdjustmentCents: 150,
        isAvailable: false,
        maxQuantity: 2,
        sortOrder: 1,
      },
    ]);
    await testDb.drizzle.insert(menuItemOptionGroups).values([
      {
        menuItemId: 201,
        groupId: "group-spice",
        sortOrder: 1,
        requiredOverride: true,
      },
      {
        menuItemId: 201,
        groupId: "group-addons",
        sortOrder: 2,
      },
    ]);
    await testDb.drizzle.insert(menuItemOptionChoiceOverrides).values([
      {
        menuItemId: 201,
        choiceId: "choice-hot",
        priceAdjustmentCents: 250,
      },
      {
        menuItemId: 201,
        choiceId: "choice-mild",
        isHidden: true,
      },
    ]);

    const [item] = await testDb.drizzle
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, 201));
    const optionMap = await loadAssembledMenuItemOptions(testDb.drizzle, [
      item,
    ]);

    expect(optionMap.get(201)).toEqual({
      customizations: [
        {
          id: "spice",
          name: "Spice",
          type: "multiple",
          required: true,
          maxSelections: 2,
          choices: [{ id: "hot", name: "Hot", priceAdjustment: 2.5 }],
        },
      ],
      addOns: [
        {
          id: "egg",
          name: "Egg",
          price: 1.5,
          maxQuantity: 2,
          available: false,
        },
      ],
    });
  });

  it("falls back to menu_items.options when no relation rows exist", async () => {
    const fallbackOptions = {
      customizations: [
        {
          id: "temperature",
          name: "Temperature",
          type: "single" as const,
          required: false,
          choices: [{ id: "iced", name: "Iced", priceAdjustment: 0 }],
        },
      ],
    };
    const [item] = await testDb.drizzle
      .insert(menuItems)
      .values({
        restaurantId,
        categoryId,
        name: "Tea",
        priceCents: 500,
        isAvailable: true,
        options: fallbackOptions,
      })
      .returning();

    const optionMap = await loadAssembledMenuItemOptions(testDb.drizzle, [
      item,
    ]);

    expect(optionMap.get(item.id)).toEqual(fallbackOptions);
  });

  // Sharing exists so an item can reference more than one group. The backfill
  // only ever produces one group per kind, so nothing derived from it can
  // reveal a second one being dropped.
  it("keeps every group of the same kind an item references", async () => {
    const [item] = await testDb.drizzle
      .insert(menuItems)
      .values({
        restaurantId,
        categoryId,
        name: "Milk Tea",
        priceCents: 6000,
        isAvailable: true,
        options: null,
      })
      .returning();

    await testDb.drizzle.insert(optionGroups).values([
      {
        id: "group-toppings",
        restaurantId,
        publicId: "toppings",
        kind: "addon",
        name: "配料",
        type: "multiple",
        sortOrder: 1,
      },
      {
        id: "group-drink-addons",
        restaurantId,
        publicId: "drinkAddOns",
        kind: "addon",
        name: "飲品加購",
        type: "multiple",
        sortOrder: 2,
      },
    ]);
    await testDb.drizzle.insert(optionChoices).values([
      {
        id: "choice-pearl",
        groupId: "group-toppings",
        publicId: "pearl",
        name: "珍珠",
      },
      {
        id: "choice-shot",
        groupId: "group-drink-addons",
        publicId: "shot",
        name: "加濃",
      },
    ]);
    await testDb.drizzle.insert(menuItemOptionGroups).values([
      { menuItemId: item.id, groupId: "group-toppings", sortOrder: 1 },
      { menuItemId: item.id, groupId: "group-drink-addons", sortOrder: 2 },
    ]);

    const optionMap = await loadAssembledMenuItemOptions(testDb.drizzle, [
      item,
    ]);

    expect(optionMap.get(item.id)?.addOns?.map((addOn) => addOn.id)).toEqual([
      "pearl",
      "shot",
    ]);
  });

  // The sold-out switch is a property of the choice. It used to reach the
  // assembled shape for add-ons only, so flipping 半糖 or 大碗 off did nothing.
  it("marks a sold-out choice and size, without removing them", async () => {
    const [item] = await testDb.drizzle
      .insert(menuItems)
      .values({
        restaurantId,
        categoryId,
        name: "Congee",
        priceCents: 9000,
        isAvailable: true,
        options: null,
      })
      .returning();

    await testDb.drizzle.insert(optionGroups).values([
      {
        id: "group-sizes",
        restaurantId,
        publicId: "sizes",
        kind: "size",
        name: "Sizes",
        type: "single",
        sortOrder: 1,
      },
      {
        id: "group-sweetness",
        restaurantId,
        publicId: "sweetness",
        kind: "choice",
        name: "甜度",
        type: "single",
        sortOrder: 2,
      },
    ]);
    await testDb.drizzle.insert(optionChoices).values([
      {
        id: "size-small",
        groupId: "group-sizes",
        publicId: "small",
        name: "小碗",
        sortOrder: 1,
      },
      {
        id: "size-large",
        groupId: "group-sizes",
        publicId: "large",
        name: "大碗",
        isAvailable: false,
        sortOrder: 2,
      },
      {
        id: "sweet-half",
        groupId: "group-sweetness",
        publicId: "half",
        name: "半糖",
        isAvailable: false,
      },
    ]);
    await testDb.drizzle.insert(menuItemOptionGroups).values([
      { menuItemId: item.id, groupId: "group-sizes", sortOrder: 1 },
      { menuItemId: item.id, groupId: "group-sweetness", sortOrder: 2 },
    ]);

    const assembled = (
      await loadAssembledMenuItemOptions(testDb.drizzle, [item])
    ).get(item.id);

    expect(assembled?.sizes).toEqual([
      { id: "small", name: "小碗", priceAdjustment: 0 },
      { id: "large", name: "大碗", priceAdjustment: 0, available: false },
    ]);
    expect(assembled?.customizations?.[0].choices).toEqual([
      { id: "half", name: "半糖", priceAdjustment: 0, available: false },
    ]);
  });
});
