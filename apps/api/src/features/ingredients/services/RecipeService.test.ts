import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecipeService } from "./RecipeService";

const mocks = vi.hoisted(() => ({
  db: {
    delete: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
    selectDistinct: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

function createQuery(result: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    leftJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    then: (
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function mockSelectResults(results: unknown[]) {
  mocks.db.select.mockImplementation(() => createQuery(results.shift() ?? []));
}

function mockSelectDistinctResult(result: unknown = []) {
  const query = createQuery(result);
  mocks.db.selectDistinct.mockReturnValue(query);
  return query;
}

function mockTransaction() {
  const deleted: unknown[] = [];
  const inserted: unknown[] = [];
  const tx = {
    delete: vi.fn(() => ({
      where: vi.fn((condition: unknown) => {
        deleted.push(condition);
        return Promise.resolve();
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((payload: unknown) => {
        inserted.push(payload);
        return Promise.resolve();
      }),
    })),
  };
  mocks.db.transaction.mockImplementation(async (callback) => callback(tx));
  return { deleted, inserted, tx };
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
    mockSelectResults([
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
    ]);

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
    const mutations = mockTransaction();

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

    expect(mutations.tx.delete).toHaveBeenCalledTimes(1);
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
    const mutations = mockTransaction();

    await createService().setRecipe(51, []);

    expect(mutations.tx.delete).toHaveBeenCalledTimes(1);
    expect(mutations.tx.insert).not.toHaveBeenCalled();
    expect(mutations.inserted).toHaveLength(0);
  });

  it("validates missing, deleted, inactive, and valid recipe entries", async () => {
    mockSelectResults([
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
    ]);

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
    const distinctQuery = mockSelectDistinctResult([
      { menuItemId: 51 },
      { menuItemId: 52 },
    ]);
    mockSelectResults([
      [
        { id: 61, name: "Laksa" },
        { id: 62, name: "Nasi Lemak" },
      ],
      [
        { menuItemId: 51, menuItemName: "Laksa" },
        { menuItemId: 52, menuItemName: "Nasi Lemak" },
      ],
    ]);

    await expect(
      createService().getMenuItemsWithoutRecipes("restaurant-1"),
    ).resolves.toEqual([
      { id: 61, name: "Laksa" },
      { id: 62, name: "Nasi Lemak" },
    ]);
    expect(mocks.db.selectDistinct).toHaveBeenCalledTimes(1);
    expect(distinctQuery.from).toHaveBeenCalled();

    await expect(createService().getIngredientUsage(2)).resolves.toEqual([
      { menuItemId: 51, menuItemName: "Laksa" },
      { menuItemId: 52, menuItemName: "Nasi Lemak" },
    ]);
  });
});
