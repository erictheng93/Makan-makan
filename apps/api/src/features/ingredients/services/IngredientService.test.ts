import { beforeEach, describe, expect, it, vi } from "vitest";
import { IngredientService } from "./IngredientService";

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    selectDistinct: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

function createQuery(result: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    offset: vi.fn(() => builder),
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

function mockDistinctResults(results: unknown[]) {
  mocks.db.selectDistinct.mockImplementation(() =>
    createQuery(results.shift() ?? []),
  );
}

function mockInsertions() {
  const inserted: unknown[] = [];
  const returningRows: unknown[] = [];

  mocks.db.insert.mockImplementation(() => {
    const builder = {
      values: vi.fn((payload: unknown) => {
        inserted.push(payload);
        return builder;
      }),
      returning: vi.fn(async () => returningRows.shift() ?? []),
      then: (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) => Promise.resolve(undefined).then(resolve, reject),
    };
    return builder;
  });

  return { inserted, returningRows };
}

function mockUpdates(results: Array<{ meta?: { changes?: number } }> = []) {
  const updated: unknown[] = [];

  mocks.db.update.mockImplementation(() => {
    const builder = {
      set: vi.fn((payload: unknown) => {
        updated.push(payload);
        return builder;
      }),
      where: vi.fn(() => builder),
      then: (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) =>
        Promise.resolve(results.shift() ?? { meta: { changes: 1 } }).then(
          resolve,
          reject,
        ),
    };
    return builder;
  });

  return { updated };
}

function createService() {
  return new IngredientService({} as D1Database);
}

function ingredientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    restaurantId: "restaurant-1",
    name: "Rice",
    unit: "kg",
    category: "Dry goods",
    costPerUnit: 50,
    costPerUnitCents: 5000,
    supplier: "Local supplier",
    minStockLevel: 5,
    currentStock: 20,
    isActive: true,
    deletedAt: null,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("IngredientService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("lists ingredients with pagination metadata and response mapping", async () => {
    mockSelectResults([
      [{ total: 2 }],
      [
        ingredientRow({ costPerUnit: 999, costPerUnitCents: 1250 }),
        ingredientRow({
          id: 102,
          name: "Sambal",
          category: null,
          costPerUnit: null,
          costPerUnitCents: null,
          supplier: null,
          minStockLevel: null,
          currentStock: null,
          isActive: false,
        }),
      ],
    ]);

    await expect(
      createService().list("restaurant-1", {
        page: 2,
        limit: 10,
        category: "Dry goods",
        search: "Rice",
        includeInactive: true,
      }),
    ).resolves.toEqual({
      total: 2,
      items: [
        {
          id: 101,
          name: "Rice",
          unit: "kg",
          category: "Dry goods",
          costPerUnit: 12.5,
          supplier: "Local supplier",
          minStockLevel: 5,
          currentStock: 20,
          isActive: true,
        },
        {
          id: 102,
          name: "Sambal",
          unit: "kg",
          category: null,
          costPerUnit: null,
          supplier: null,
          minStockLevel: null,
          currentStock: null,
          isActive: false,
        },
      ],
    });
  });

  it("gets ingredients by restaurant scope and returns null for misses", async () => {
    mockSelectResults([
      [ingredientRow({ costPerUnit: 999, costPerUnitCents: 1250 })],
      [],
    ]);

    await expect(createService().get("restaurant-1", 101)).resolves.toEqual({
      id: 101,
      name: "Rice",
      unit: "kg",
      category: "Dry goods",
      costPerUnit: 12.5,
      supplier: "Local supplier",
      minStockLevel: 5,
      currentStock: 20,
      isActive: true,
    });
    await expect(createService().get("restaurant-1", 404)).resolves.toBeNull();
  });

  it("creates and bulk imports ingredients with cent-normalized costs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const mutations = mockInsertions();
    mutations.returningRows.push([ingredientRow({ id: 103, name: "Noodles" })]);

    await expect(
      createService().create("restaurant-1", {
        name: "Noodles",
        unit: "pack",
        category: "Dry goods",
        costPerUnit: 12.5,
        supplier: "Vendor",
        minStockLevel: 3,
        currentStock: 9,
      }),
    ).resolves.toMatchObject({
      id: 103,
      name: "Noodles",
      costPerUnit: 50,
    });
    await expect(
      createService().bulkImport("restaurant-1", [
        { name: "Salt", unit: "g", costPerUnit: 0.25 },
        { name: "Water", unit: "ml" },
      ]),
    ).resolves.toEqual({ imported: 2 });

    expect(mutations.inserted).toEqual([
      expect.objectContaining({
        restaurantId: "restaurant-1",
        name: "Noodles",
        unit: "pack",
        category: "Dry goods",
        costPerUnit: 12.5,
        costPerUnitCents: 1250,
        supplier: "Vendor",
        minStockLevel: 3,
        currentStock: 9,
        isActive: true,
        createdAt: new Date("2026-06-07T00:00:00.000Z"),
        updatedAt: new Date("2026-06-07T00:00:00.000Z"),
      }),
      [
        expect.objectContaining({
          restaurantId: "restaurant-1",
          name: "Salt",
          costPerUnit: 0.25,
          costPerUnitCents: 25,
        }),
        expect.objectContaining({
          restaurantId: "restaurant-1",
          name: "Water",
          costPerUnit: null,
          costPerUnitCents: null,
        }),
      ],
    ]);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("updates existing ingredients and skips empty update payloads", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const mutations = mockUpdates();
    mockSelectResults([
      [ingredientRow()],
      [ingredientRow()],
      [
        ingredientRow({
          name: "Brown Rice",
          category: null,
          costPerUnit: null,
          costPerUnitCents: null,
          supplier: null,
          minStockLevel: null,
          currentStock: null,
        }),
      ],
    ]);

    await expect(
      createService().update("restaurant-1", 101, {}),
    ).resolves.toMatchObject({ id: 101, name: "Rice" });
    await expect(
      createService().update("restaurant-1", 101, {
        name: "Brown Rice",
        category: null,
        costPerUnit: null,
        supplier: null,
        minStockLevel: null,
        currentStock: null,
      }),
    ).resolves.toMatchObject({
      id: 101,
      name: "Brown Rice",
      category: null,
      costPerUnit: null,
    });

    expect(mutations.updated).toEqual([
      expect.objectContaining({
        name: "Brown Rice",
        category: null,
        costPerUnit: null,
        costPerUnitCents: null,
        supplier: null,
        minStockLevel: null,
        currentStock: null,
        updatedAt: new Date("2026-06-07T00:00:00.000Z"),
      }),
    ]);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("returns null when updating missing ingredients", async () => {
    const mutations = mockUpdates();
    mockSelectResults([[]]);

    await expect(
      createService().update("restaurant-1", 404, { name: "Missing" }),
    ).resolves.toBeNull();
    expect(mutations.updated).toHaveLength(0);
  });

  it("soft deletes ingredients, updates stock, and lists active categories", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const mutations = mockUpdates([
      { meta: { changes: 1 } },
      { meta: { changes: 0 } },
      { meta: { changes: 1 } },
      { meta: { changes: 0 } },
    ]);
    mockDistinctResults([[{ category: "Dry goods" }, { category: "Sauces" }]]);

    await expect(createService().delete("restaurant-1", 101)).resolves.toBe(
      true,
    );
    await expect(createService().delete("restaurant-1", 404)).resolves.toBe(
      false,
    );
    await expect(
      createService().updateStock("restaurant-1", 101, 42),
    ).resolves.toBe(true);
    await expect(
      createService().updateStock("restaurant-1", 404, 42),
    ).resolves.toBe(false);
    await expect(
      createService().getCategories("restaurant-1"),
    ).resolves.toEqual(["Dry goods", "Sauces"]);

    expect(mutations.updated).toEqual([
      {
        deletedAt: new Date("2026-06-07T00:00:00.000Z"),
        isActive: false,
        updatedAt: new Date("2026-06-07T00:00:00.000Z"),
      },
      {
        deletedAt: new Date("2026-06-07T00:00:00.000Z"),
        isActive: false,
        updatedAt: new Date("2026-06-07T00:00:00.000Z"),
      },
      {
        currentStock: 42,
        updatedAt: new Date("2026-06-07T00:00:00.000Z"),
      },
      {
        currentStock: 42,
        updatedAt: new Date("2026-06-07T00:00:00.000Z"),
      },
    ]);
    vi.clearAllTimers();
    vi.useRealTimers();
  });
});
