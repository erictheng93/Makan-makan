import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { D1Database } from "@cloudflare/workers-types";
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
  REAL_D1_SETUP_TIMEOUT_MS,
  type TestDatabase,
} from "../testing/create-test-database";
import {
  backfillMenuItemOptions,
  loadAssembledMenuItemOptions,
} from "./menu-options";

const restaurantId = "restaurant-menu-options-test";

function withBackfillAudit(
  db: D1Database,
  audit: { batchSizes: number[]; failBatch?: number },
): D1Database {
  return {
    prepare: (sqlText: string) => {
      if (
        /^\s*select\b/i.test(sqlText) &&
        /from\s+"menu_item_option_groups"/i.test(sqlText) &&
        !/\bwhere\b/i.test(sqlText)
      ) {
        throw new Error("menu_item_option_groups idempotency scan lacks WHERE");
      }
      return db.prepare(sqlText);
    },
    batch: async (statements: D1PreparedStatement[]) => {
      audit.batchSizes.push(statements.length);
      if (audit.failBatch === audit.batchSizes.length) {
        throw new Error(`Injected backfill batch ${audit.failBatch} failure`);
      }
      return db.batch(statements);
    },
    exec: (query: string) => db.exec(query),
    dump: () => db.dump(),
  } as unknown as D1Database;
}

async function countBackfilledOptionRows(db: D1Database): Promise<{
  groups: number;
  links: number;
  orphanGroups: number;
}> {
  const groups =
    (
      await db
        .prepare("SELECT COUNT(*) AS count FROM option_groups")
        .first<{ count: number }>()
    )?.count ?? 0;
  const links =
    (
      await db
        .prepare("SELECT COUNT(*) AS count FROM menu_item_option_groups")
        .first<{ count: number }>()
    )?.count ?? 0;
  const orphanGroups =
    (
      await db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM option_groups AS og
           LEFT JOIN menu_item_option_groups AS miog ON miog.group_id = og.id
           WHERE miog.group_id IS NULL`,
        )
        .first<{ count: number }>()
    )?.count ?? 0;

  return { groups, links, orphanGroups };
}

describe("menu item option rows", () => {
  let testDb: TestDatabase;
  let categoryId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, REAL_D1_SETUP_TIMEOUT_MS);

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

  it("chunks backfill writes and scopes idempotency reads to the target items", async () => {
    const itemCount = 15;
    for (let index = 0; index < itemCount; index++) {
      await testDb.drizzle.insert(menuItems).values({
        restaurantId,
        categoryId,
        name: `Batch Item ${index}`,
        priceCents: 1000,
        isAvailable: true,
        // Deliberately distinct per item: identical shapes now collapse into
        // one shared group, which would leave too few statements to batch.
        options: {
          customizations: [
            {
              id: `spice_${index}`,
              name: `Spice ${index}`,
              type: "single",
              required: true,
              choices: [
                { id: "hot", name: "Hot", priceAdjustment: 1 },
                { id: "mild", name: "Mild", priceAdjustment: 0 },
              ],
            },
          ],
          addOns: [
            {
              id: `egg_${index}`,
              name: `Egg ${index}`,
              price: 1,
              maxQuantity: 3,
            },
          ],
        },
      });
    }
    const audit = { batchSizes: [] as number[] };

    await backfillMenuItemOptions(withBackfillAudit(testDb.bindings.DB, audit));

    expect(audit.batchSizes.length).toBeGreaterThan(1);
    expect(Math.max(...audit.batchSizes)).toBeLessThanOrEqual(100);
  }, 30_000);

  it("does not split one item across backfill batches", async () => {
    const itemCount = 15;
    for (let index = 0; index < itemCount; index++) {
      await testDb.drizzle.insert(menuItems).values({
        restaurantId,
        categoryId,
        name: `Retry Item ${index}`,
        priceCents: 1000,
        isAvailable: true,
        // Deliberately distinct per item: identical shapes now collapse into
        // one shared group, which would leave too few statements to batch.
        options: {
          customizations: [
            {
              id: `spice_${index}`,
              name: `Spice ${index}`,
              type: "single",
              required: true,
              choices: [
                { id: "hot", name: "Hot", priceAdjustment: 1 },
                { id: "mild", name: "Mild", priceAdjustment: 0 },
              ],
            },
          ],
          addOns: [
            {
              id: `egg_${index}`,
              name: `Egg ${index}`,
              price: 1,
              maxQuantity: 3,
            },
          ],
        },
      });
    }

    await expect(
      backfillMenuItemOptions(
        withBackfillAudit(testDb.bindings.DB, {
          batchSizes: [],
          failBatch: 2,
        }),
      ),
    ).rejects.toThrow("Injected backfill batch 2 failure");

    await expect(
      countBackfilledOptionRows(testDb.bindings.DB),
    ).resolves.toEqual({
      groups: 28,
      links: 28,
      orphanGroups: 0,
    });

    await backfillMenuItemOptions(testDb.bindings.DB);

    await expect(
      countBackfilledOptionRows(testDb.bindings.DB),
    ).resolves.toEqual({
      groups: 30,
      links: 30,
      orphanGroups: 0,
    });
  }, 30_000);

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

  it("does not emit maxSelections for single-choice groups", async () => {
    await testDb.drizzle.insert(menuItems).values({
      id: 202,
      restaurantId,
      categoryId,
      name: "Tea",
      priceCents: 500,
      isAvailable: true,
      options: null,
    });
    await testDb.drizzle.insert(optionGroups).values({
      id: "group-sugar",
      restaurantId,
      publicId: "sugar",
      kind: "choice",
      name: "Sugar",
      type: "single",
      required: false,
      maxSelections: 2,
    });
    await testDb.drizzle.insert(optionChoices).values({
      id: "choice-half",
      groupId: "group-sugar",
      publicId: "half",
      name: "Half",
      priceAdjustmentCents: 0,
    });
    await testDb.drizzle.insert(menuItemOptionGroups).values({
      menuItemId: 202,
      groupId: "group-sugar",
      maxSelectionsOverride: 3,
    });

    const [item] = await testDb.drizzle
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, 202));
    const optionMap = await loadAssembledMenuItemOptions(testDb.drizzle, [
      item,
    ]);

    expect(optionMap.get(202)).toEqual({
      customizations: [
        {
          id: "sugar",
          name: "Sugar",
          type: "single",
          required: false,
          choices: [{ id: "half", name: "Half", priceAdjustment: 0 }],
        },
      ],
    });
  });

  // Backfilling a group per item would give a 50-dish menu fifty copies of
  // 甜度. The safety property is that sharing changes nothing a customer sees:
  // each item must still assemble to exactly the JSON it started from.
  describe("shared groups during backfill", () => {
    const drinkOptions = (sweetnessName = "甜度") => ({
      customizations: [
        {
          id: "sweetness",
          name: sweetnessName,
          type: "single" as const,
          required: true,
          choices: [
            { id: "half", name: "半糖", priceAdjustment: 0 },
            { id: "none", name: "無糖", priceAdjustment: 0 },
          ],
        },
      ],
      addOns: [{ id: "pearl", name: "珍珠", price: 10 }],
    });

    async function seedItem(name: string, options: unknown) {
      const [item] = await testDb.drizzle
        .insert(menuItems)
        .values({
          restaurantId,
          categoryId,
          name,
          priceCents: 6000,
          isAvailable: true,
          options: options as never,
        })
        .returning();
      return item;
    }

    it("gives identically shaped items one group instead of one each", async () => {
      const a = await seedItem("珍珠奶茶", drinkOptions());
      const b = await seedItem("紅茶拿鐵", drinkOptions());
      const c = await seedItem("烏龍茶", drinkOptions());

      const result = await backfillMenuItemOptions(testDb.bindings.DB);

      // Three drinks, one 甜度 group and one 加購 group between them.
      expect(result).toMatchObject({
        menuItemsBackfilled: 3,
        groupsInserted: 2,
        groupsReused: 4,
      });
      expect(await testDb.drizzle.select().from(optionGroups)).toHaveLength(2);
      expect(
        await testDb.drizzle.select().from(menuItemOptionGroups),
      ).toHaveLength(6);

      // The whole point: no menu changed.
      const optionMap = await loadAssembledMenuItemOptions(testDb.drizzle, [
        a,
        b,
        c,
      ]);
      for (const item of [a, b, c]) {
        expect(optionMap.get(item.id)).toEqual(drinkOptions());
      }
    });

    it("keeps a separate group when anything the assembler reads differs", async () => {
      const a = await seedItem("珍珠奶茶", drinkOptions());
      // Same id and choices, different display name.
      const b = await seedItem("特調", drinkOptions("糖度"));

      await backfillMenuItemOptions(testDb.bindings.DB);

      const groups = await testDb.drizzle.select().from(optionGroups);
      const sweetness = groups.filter(
        (group) => group.publicId === "sweetness",
      );
      expect(sweetness).toHaveLength(2);

      const optionMap = await loadAssembledMenuItemOptions(testDb.drizzle, [
        a,
        b,
      ]);
      expect(optionMap.get(a.id)).toEqual(drinkOptions());
      expect(optionMap.get(b.id)).toEqual(drinkOptions("糖度"));
    });

    it("does not share a group across restaurants", async () => {
      const other = "restaurant-menu-options-other";
      await testDb.drizzle.insert(restaurants).values({
        id: other,
        name: "Other Shop",
        type: "taiwanese",
        category: "casual",
        address: "2 Test St",
        district: "D",
        city: "C",
        phone: "0912345679",
        isAvailable: true,
      });
      const [otherCategory] = await testDb.drizzle
        .insert(categories)
        .values({ restaurantId: other, name: "Drinks", sortOrder: 1 })
        .returning({ id: categories.id });

      await seedItem("珍珠奶茶", drinkOptions());
      await testDb.drizzle.insert(menuItems).values({
        restaurantId: other,
        categoryId: otherCategory.id,
        name: "珍珠奶茶",
        priceCents: 6000,
        isAvailable: true,
        options: drinkOptions() as never,
      });

      await backfillMenuItemOptions(testDb.bindings.DB);

      const groups = await testDb.drizzle.select().from(optionGroups);
      // A group belongs to one restaurant; the same shape in two shops is two
      // groups, not one shared across tenants.
      expect(new Set(groups.map((group) => group.restaurantId)).size).toBe(2);
      expect(groups.filter((g) => g.publicId === "sweetness")).toHaveLength(2);
    });
  });

  // Found by running the backfill against production: all three items that
  // still carried JSON options had been soft-deleted, so the migration created
  // groups for dishes nobody can order or edit.
  it("skips soft-deleted menu items", async () => {
    await testDb.drizzle.insert(menuItems).values([
      {
        id: 501,
        restaurantId,
        categoryId,
        name: "Retired Dish",
        priceCents: 1000,
        isAvailable: false,
        deletedAt: new Date("2026-07-01T00:00:00.000Z"),
        options: {
          addOns: [{ id: "egg", name: "Egg", price: 1 }],
        } as never,
      },
      {
        id: 502,
        restaurantId,
        categoryId,
        name: "Live Dish",
        priceCents: 1000,
        isAvailable: true,
        options: {
          addOns: [{ id: "egg", name: "Egg", price: 1 }],
        } as never,
      },
    ]);

    const result = await backfillMenuItemOptions(testDb.bindings.DB);

    expect(result).toMatchObject({
      menuItemsScanned: 1,
      menuItemsBackfilled: 1,
    });
    const links = await testDb.drizzle.select().from(menuItemOptionGroups);
    expect(links.map((link) => link.menuItemId)).toEqual([502]);
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

  it("does not hide query-layer mistakes behind a JSON fallback", async () => {
    await expect(
      loadAssembledMenuItemOptions({} as D1Database, [
        {
          id: 1,
          options: {
            addOns: [{ id: "egg", name: "Egg", price: 1 }],
          },
        },
      ]),
    ).rejects.toThrow(/select/);
  });
});
