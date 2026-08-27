import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ingredientDefinitions,
  menuItemIngredients,
  menuItems,
} from "@makanmasak/database";
import {
  createSelectFixtureDb,
  type SelectFixtures,
} from "@makanmasak/database/testing";
import { RecipeService } from "./RecipeService";

const mocks = vi.hoisted(() => ({
  db: {
    delete: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
    selectDistinct: vi.fn(),
    batch: vi.fn(),
  },
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

const RESTAURANT = "restaurant-1";
const fixtureTables = { ingredientDefinitions, menuItemIngredients, menuItems };
type SelectFixtureName = keyof typeof fixtureTables;

function mockSelectResults(fixtures: SelectFixtures<SelectFixtureName>) {
  Object.assign(mocks.db, createSelectFixtureDb(fixtureTables, fixtures));
}

function mockBatch() {
  const deleted: unknown[] = [];
  const inserted: unknown[] = [];
  mocks.db.delete.mockReturnValue({
    where: vi.fn((condition: unknown) => {
      deleted.push(condition);
      return { kind: "delete" };
    }),
  });
  mocks.db.insert.mockReturnValue({
    values: vi.fn((payload: unknown) => {
      inserted.push(payload);
      return { kind: "insert" };
    }),
  });
  mocks.db.batch.mockResolvedValue([]);
  return { deleted, inserted };
}

function createService() {
  return new RecipeService({} as D1Database);
}

describe("RecipeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("maps recipe rows with default ingredient names", async () => {
    mockSelectResults({
      menuItems: [[{ id: 51 }]],
      menuItemIngredients: [
        [
          {
            ingredientId: 2,
            ingredientName: "Rice",
            quantityPerServing: 120,
            unit: "g",
            isOptional: false,
          },
          {
            ingredientId: 3,
            ingredientName: null,
            quantityPerServing: 10,
            unit: "ml",
            isOptional: true,
          },
        ],
      ],
    });

    await expect(createService().getRecipe(RESTAURANT, 51)).resolves.toEqual([
      {
        ingredientId: 2,
        ingredientName: "Rice",
        quantityPerServing: 120,
        unit: "g",
        isOptional: false,
      },
      {
        ingredientId: 3,
        ingredientName: "",
        quantityPerServing: 10,
        unit: "ml",
        isOptional: true,
      },
    ]);
  });

  it("replaces recipe entries in a transaction and defaults optional flags", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    mockSelectResults({
      menuItems: [[{ id: 51 }]],
      ingredientDefinitions: [
        [
          { id: 2, name: "Flour", unit: "g" },
          { id: 3, name: "Milk", unit: "ml" },
        ],
      ],
    });
    const mutations = mockBatch();

    await createService().setRecipe(RESTAURANT, 51, [
      {
        ingredientId: 2,
        quantityPerServing: 120,
        unit: "g",
      },
      {
        ingredientId: 3,
        quantityPerServing: 10,
        unit: "ml",
        isOptional: true,
      },
    ]);

    expect(mocks.db.delete).toHaveBeenCalledTimes(1);
    expect(mocks.db.batch).toHaveBeenCalledWith([
      { kind: "delete" },
      { kind: "insert" },
    ]);
    expect(mutations.inserted).toEqual([
      [
        {
          menuItemId: 51,
          ingredientId: 2,
          quantityPerServing: 120,
          unit: "g",
          isOptional: false,
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
          updatedAt: new Date("2026-06-07T00:00:00.000Z"),
        },
        {
          menuItemId: 51,
          ingredientId: 3,
          quantityPerServing: 10,
          unit: "ml",
          isOptional: true,
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
          updatedAt: new Date("2026-06-07T00:00:00.000Z"),
        },
      ],
    ]);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("deletes existing recipe rows without inserting when replacement is empty", async () => {
    mockSelectResults({ menuItems: [[{ id: 51 }]] });
    const mutations = mockBatch();

    await createService().setRecipe(RESTAURANT, 51, []);

    expect(mocks.db.delete).toHaveBeenCalledTimes(1);
    expect(mocks.db.insert).not.toHaveBeenCalled();
    expect(mocks.db.batch).toHaveBeenCalledWith([{ kind: "delete" }]);
    expect(mutations.inserted).toHaveLength(0);
  });

  it("validates missing, deleted, inactive, and valid recipe entries", async () => {
    mockSelectResults({
      menuItems: [[{ id: 51 }], [{ id: 52 }], [{ id: 53 }]],
      menuItemIngredients: [
        [],
        [
          { ingredientId: 2, name: null, isActive: null, deletedAt: null },
          {
            ingredientId: 3,
            name: "Old Rice",
            isActive: true,
            deletedAt: new Date("2026-06-01T00:00:00.000Z"),
          },
          {
            ingredientId: 4,
            name: "Sambal",
            isActive: false,
            deletedAt: null,
          },
        ],
        [{ ingredientId: 5, name: "Salt", isActive: true, deletedAt: null }],
      ],
    });

    await expect(
      createService().validateRecipe(RESTAURANT, 51),
    ).resolves.toEqual({
      valid: false,
      errors: ["No recipe entries found for this menu item"],
    });
    await expect(
      createService().validateRecipe(RESTAURANT, 52),
    ).resolves.toEqual({
      valid: false,
      errors: [
        "Ingredient #2 does not exist",
        'Ingredient "Old Rice" has been deleted',
        'Ingredient "Sambal" is inactive',
      ],
    });
    await expect(
      createService().validateRecipe(RESTAURANT, 53),
    ).resolves.toEqual({
      valid: true,
      errors: [],
    });
  });

  it("refuses a menu item that belongs to another restaurant", async () => {
    // The ownership lookup finds nothing, which is what a foreign menuItemId
    // produces once the query is scoped by restaurant.
    mockSelectResults({ menuItems: [[], [], []] });
    const service = createService();

    await expect(service.getRecipe(RESTAURANT, 999)).rejects.toMatchObject({
      code: "MENU_ITEM_NOT_FOUND",
    });
    await expect(service.validateRecipe(RESTAURANT, 999)).rejects.toMatchObject(
      { code: "MENU_ITEM_NOT_FOUND" },
    );

    const mutations = mockBatch();
    await expect(
      service.setRecipe(RESTAURANT, 999, [
        { ingredientId: 2, quantityPerServing: 1, unit: "g" },
      ]),
    ).rejects.toMatchObject({ code: "MENU_ITEM_NOT_FOUND" });

    // The point of the guard: nothing was written on the way to the error.
    expect(mocks.db.batch).not.toHaveBeenCalled();
    expect(mutations.deleted).toHaveLength(0);
  });

  it("refuses ingredients that belong to another restaurant", async () => {
    mockSelectResults({
      menuItems: [[{ id: 51 }]],
      // Two ids requested, one owned: explodeForecast would otherwise fold a
      // foreign ingredient into this restaurant's purchasing.
      ingredientDefinitions: [[{ id: 2 }]],
    });
    const mutations = mockBatch();

    await expect(
      createService().setRecipe(RESTAURANT, 51, [
        { ingredientId: 2, quantityPerServing: 1, unit: "g" },
        { ingredientId: 3, quantityPerServing: 1, unit: "g" },
      ]),
    ).rejects.toMatchObject({ code: "INGREDIENT_NOT_IN_RESTAURANT" });

    expect(mocks.db.batch).not.toHaveBeenCalled();
    expect(mutations.deleted).toHaveLength(0);
  });

  it("lists menu items missing recipes and ingredient usage", async () => {
    mockSelectResults({
      menuItems: [
        [
          { id: 61, name: "Laksa" },
          { id: 62, name: "Nasi Lemak" },
        ],
      ],
      menuItemIngredients: [
        [
          { menuItemId: 51, menuItemName: "Laksa" },
          { menuItemId: 52, menuItemName: "Nasi Lemak" },
        ],
      ],
    });

    await expect(
      createService().getMenuItemsWithoutRecipes("restaurant-1"),
    ).resolves.toEqual([
      { id: 61, name: "Laksa" },
      { id: 62, name: "Nasi Lemak" },
    ]);
    expect(mocks.db.selectDistinct).toHaveBeenCalledTimes(1);
    // createSelectFixtureDb owns both select mocks, so the distinct builder has
    // to be read back off the mock rather than captured before the call.
    expect(
      mocks.db.selectDistinct.mock.results[0]?.value.from,
    ).toHaveBeenCalled();

    await expect(
      createService().getIngredientUsage(RESTAURANT, 2),
    ).resolves.toEqual([
      { menuItemId: 51, menuItemName: "Laksa" },
      { menuItemId: 52, menuItemName: "Nasi Lemak" },
    ]);
  });

  it("rejects a recipe unit that disagrees with the ingredient's stock unit", async () => {
    mockSelectResults({
      menuItems: [[{ id: 51 }]],
      ingredientDefinitions: [[{ id: 2, name: "Flour", unit: "kg" }]],
    });
    mockBatch();

    // Order consumption skips a mismatched row rather than subtract grams
    // from kilograms, so saving one would be a dish that silently never
    // consumes anything.
    await expect(
      createService().setRecipe(RESTAURANT, 51, [
        { ingredientId: 2, quantityPerServing: 120, unit: "g" },
      ]),
    ).rejects.toMatchObject({ code: "RECIPE_UNIT_MISMATCH" });

    expect(mocks.db.batch).not.toHaveBeenCalled();
  });
});
