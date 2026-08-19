import { beforeEach, describe, expect, it, vi } from "vitest";
import { menuItemIngredients, menuItems } from "@makanmasak/database";
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

const fixtureTables = { menuItemIngredients, menuItems };
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

    await expect(createService().getRecipe(51)).resolves.toEqual([
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
    const mutations = mockBatch();

    await createService().setRecipe(51, [
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
    const mutations = mockBatch();

    await createService().setRecipe(51, []);

    expect(mocks.db.delete).toHaveBeenCalledTimes(1);
    expect(mocks.db.insert).not.toHaveBeenCalled();
    expect(mocks.db.batch).toHaveBeenCalledWith([{ kind: "delete" }]);
    expect(mutations.inserted).toHaveLength(0);
  });

  it("validates missing, deleted, inactive, and valid recipe entries", async () => {
    mockSelectResults({
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

    await expect(createService().validateRecipe(51)).resolves.toEqual({
      valid: false,
      errors: ["No recipe entries found for this menu item"],
    });
    await expect(createService().validateRecipe(52)).resolves.toEqual({
      valid: false,
      errors: [
        "Ingredient #2 does not exist",
        'Ingredient "Old Rice" has been deleted',
        'Ingredient "Sambal" is inactive',
      ],
    });
    await expect(createService().validateRecipe(53)).resolves.toEqual({
      valid: true,
      errors: [],
    });
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

    await expect(createService().getIngredientUsage(2)).resolves.toEqual([
      { menuItemId: 51, menuItemName: "Laksa" },
      { menuItemId: 52, menuItemName: "Nasi Lemak" },
    ]);
  });
});
