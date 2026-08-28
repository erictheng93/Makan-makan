import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ingredientDefinitions,
  ingredientStockMovements,
} from "@makanmasak/database";
import {
  createMutationFixtureDb,
  createSelectFixtureDb,
  type MutationFixtures,
  type SelectFixtures,
} from "@makanmasak/database/testing";
import { IngredientService } from "./IngredientService";

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    selectDistinct: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    batch: vi.fn(),
  },
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

const fixtureTables = { ingredientDefinitions, ingredientStockMovements };
type FixtureName = keyof typeof fixtureTables;

function mockSelectResults(fixtures: SelectFixtures<FixtureName>) {
  Object.assign(mocks.db, createSelectFixtureDb(fixtureTables, fixtures));
}

function mockMutationResults(fixtures: MutationFixtures<FixtureName> = {}) {
  const fixtureDb = createMutationFixtureDb(fixtureTables, fixtures);
  mocks.db.insert.mockImplementation(fixtureDb.insert);
  mocks.db.update.mockImplementation(fixtureDb.update);
  mocks.db.batch.mockImplementation(
    async (statements: PromiseLike<unknown>[]) => {
      const results = [];
      for (const statement of statements) results.push(await statement);
      return results;
    },
  );
  return fixtureDb;
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
    mockSelectResults({
      ingredientDefinitions: [
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
      ],
    });

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
    mockSelectResults({
      ingredientDefinitions: [
        [ingredientRow({ costPerUnit: 999, costPerUnitCents: 1250 })],
        [],
      ],
    });

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
    const mutations = mockMutationResults({
      ingredientDefinitions: {
        // create() reads its row back; bulkImport() only reports how many
        // rows the one insert wrote.
        insert: [[ingredientRow({ id: 103, name: "Noodles" })], { changes: 2 }],
      },
    });

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
          costPerUnitCents: 25,
        }),
        expect.objectContaining({
          restaurantId: "restaurant-1",
          name: "Water",
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
    const mutations = mockMutationResults({
      // The empty-payload update returns before writing; only the second
      // update reaches the database.
      ingredientDefinitions: { update: [{ changes: 1 }] },
    });
    mockSelectResults({
      ingredientDefinitions: [
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
      ],
    });

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
        costPerUnitCents: null,
        supplier: null,
        minStockLevel: null,
        updatedAt: new Date("2026-06-07T00:00:00.000Z"),
      }),
    ]);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("returns null when updating missing ingredients", async () => {
    const mutations = mockMutationResults();
    mockSelectResults({ ingredientDefinitions: [[]] });

    await expect(
      createService().update("restaurant-1", 404, { name: "Missing" }),
    ).resolves.toBeNull();
    expect(mutations.updated).toHaveLength(0);
  });

  it("soft deletes ingredients, updates stock, and lists active categories", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const mutations = mockMutationResults({
      ingredientDefinitions: {
        update: [{ changes: 1 }, { changes: 0 }, { changes: 1 }],
      },
      ingredientStockMovements: { insert: [{ changes: 1 }] },
    });
    // getCategories reads ingredientDefinitions through selectDistinct, which
    // draws from the same per-table queue as select.
    mockSelectResults({
      ingredientDefinitions: [
        [ingredientRow({ currentStock: 20 })],
        [ingredientRow({ currentStock: 42 })],
        [],
        [{ category: "Dry goods" }, { category: "Sauces" }],
      ],
    });

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
    ]);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("adjusts stock by a signed delta and records the movement", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const mutations = mockMutationResults({
      ingredientDefinitions: { update: [{ changes: 1 }] },
      ingredientStockMovements: { insert: [{ changes: 1 }] },
    });
    mockSelectResults({
      // get() before the write, then get() again for the response.
      ingredientDefinitions: [
        [ingredientRow({ currentStock: 20 })],
        [ingredientRow({ currentStock: 12 })],
      ],
    });

    await expect(
      createService().adjustStock(
        "restaurant-1",
        101,
        { delta: -8, reason: "waste", note: "spoiled" },
        "user-7",
      ),
    ).resolves.toMatchObject({ id: 101, currentStock: 12 });

    expect(mutations.updated).toEqual([
      { currentStock: 12, updatedAt: new Date("2026-06-07T00:00:00.000Z") },
    ]);
    expect(mocks.db.batch).toHaveBeenCalledOnce();
    expect(mutations.remaining()).toEqual({});
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("submits the balance update and movement as one batch", async () => {
    const mutations = mockMutationResults({
      ingredientDefinitions: { update: [{ changes: 1 }] },
      ingredientStockMovements: {
        insert: [new Error("injected movement failure")],
      },
    });
    mockSelectResults({
      ingredientDefinitions: [[ingredientRow({ currentStock: 20 })]],
    });

    await expect(
      createService().adjustStock("restaurant-1", 101, {
        delta: 5,
        reason: "purchase",
      }),
    ).rejects.toThrow("injected movement failure");
    expect(mocks.db.batch).toHaveBeenCalledOnce();
    expect(mutations.updated).toHaveLength(1);
    expect(mutations.inserted).toHaveLength(0);
  });

  it("treats a null stock as zero and defaults the movement's note and author", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const mutations = mockMutationResults({
      ingredientDefinitions: { update: [{ changes: 1 }] },
      ingredientStockMovements: { insert: [{ changes: 1 }] },
    });
    mockSelectResults({
      ingredientDefinitions: [
        [ingredientRow({ currentStock: null })],
        [ingredientRow({ currentStock: 5 })],
      ],
    });

    await expect(
      createService().adjustStock("restaurant-1", 101, {
        delta: 5,
        reason: "purchase",
      }),
    ).resolves.toMatchObject({ currentStock: 5 });

    expect(mutations.remaining()).toEqual({});
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("loses the race rather than the delta when the balance moved under it", async () => {
    // The UPDATE is conditional on the balance we read. A concurrent
    // adjustment makes it match zero rows, and the caller must see that as a
    // failure -- not as a success whose movement row never got written.
    const mutations = mockMutationResults({
      ingredientDefinitions: { update: [{ changes: 0 }] },
      ingredientStockMovements: { insert: [{ changes: 0 }] },
    });
    mockSelectResults({
      ingredientDefinitions: [[ingredientRow({ currentStock: 20 })]],
    });

    await expect(
      createService().adjustStock("restaurant-1", 101, {
        delta: -8,
        reason: "waste",
      }),
    ).resolves.toBeNull();
    expect(mutations.remaining()).toEqual({});
  });

  it("returns null without writing when adjusting a missing ingredient", async () => {
    const mutations = mockMutationResults();
    mockSelectResults({ ingredientDefinitions: [[]] });

    await expect(
      createService().adjustStock("restaurant-1", 404, {
        delta: 1,
        reason: "purchase",
      }),
    ).resolves.toBeNull();
    expect(mutations.updated).toHaveLength(0);
    expect(mutations.inserted).toHaveLength(0);
  });

  it("records a correction when the edit form moves stock, and nothing when it does not", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const mutations = mockMutationResults({
      ingredientDefinitions: { update: [{ changes: 1 }, { changes: 1 }] },
      ingredientStockMovements: { insert: [{ changes: 1 }] },
    });
    mockSelectResults({
      ingredientDefinitions: [
        [ingredientRow({ currentStock: 20 })],
        [ingredientRow({ currentStock: 30 })],
        [ingredientRow({ currentStock: 30 })],
        [ingredientRow({ currentStock: 30 })],
      ],
    });

    const service = createService();
    await service.update("restaurant-1", 101, { currentStock: 30 }, "user-7");
    // Re-stating the same figure is not a movement.
    await service.update("restaurant-1", 101, { currentStock: 30 }, "user-7");

    expect(mocks.db.batch).toHaveBeenCalledOnce();
    expect(mutations.remaining()).toEqual({});
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("routes the legacy absolute stock update through an attributed correction", async () => {
    const mutations = mockMutationResults({
      ingredientDefinitions: { update: [{ changes: 1 }] },
      ingredientStockMovements: { insert: [{ changes: 1 }] },
    });
    mockSelectResults({
      ingredientDefinitions: [
        [ingredientRow({ currentStock: 20 })],
        [ingredientRow({ currentStock: 42 })],
      ],
    });

    await expect(
      createService().updateStock("restaurant-1", 101, 42, "user-7"),
    ).resolves.toBe(true);
    expect(mutations.remaining()).toEqual({});
  });

  it("scopes the movement history to the restaurant as well as the ingredient", async () => {
    mockSelectResults({
      ingredientStockMovements: [
        [
          {
            id: 2,
            delta: -8,
            balanceAfter: 12,
            reason: "waste",
            note: null,
            createdAt: new Date("2026-06-07T00:00:00.000Z"),
          },
        ],
      ],
    });

    await expect(
      createService().listMovements("restaurant-1", 101),
    ).resolves.toEqual([
      expect.objectContaining({ id: 2, delta: -8, balanceAfter: 12 }),
    ]);
  });
});
