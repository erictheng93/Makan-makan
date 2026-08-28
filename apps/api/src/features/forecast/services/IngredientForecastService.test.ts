import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ForecastResult } from "@makanmasak/shared-types";
import { forecastCache, menuItemIngredients } from "@makanmasak/database";

const drizzleState = vi.hoisted(() => ({
  db: {} as Record<string, unknown>,
}));

const enhancerFns = vi.hoisted(() => ({
  enhancePredictions: vi.fn(),
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => drizzleState.db),
}));

vi.mock("./AIForecastEnhancer", () => ({
  AIForecastEnhancer: vi.fn(function AIForecastEnhancer() {
    return {
      enhancePredictions: enhancerFns.enhancePredictions,
    };
  }),
}));

import { IngredientForecastService } from "./IngredientForecastService";

function createKV(initial: Record<string, unknown> = {}) {
  const values = new Map<string, string>(
    Object.entries(initial).map(([key, value]) => [
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    ]),
  );

  return {
    values,
    kv: {
      get: vi.fn(async (key: string) => values.get(key) ?? null),
      put: vi.fn(
        async (
          key: string,
          value: string,
          _options?: { expirationTtl?: number },
        ) => {
          values.set(key, value);
        },
      ),
    } as unknown as KVNamespace,
  };
}

/**
 * Select fixtures are keyed by table, not by call order: `from(table)` decides
 * which queue a query draws from, so adding a query against one table can no
 * longer shift another table's results out from under it.
 *
 * Two things still need care when the code under test grows a new query:
 *
 * - Within a single table the queue is positional. The Nth read of a table
 *   takes that table's Nth fixture, so a new query means inserting a fixture
 *   at the matching index rather than appending one at the end.
 * - A table has to be listed in `fixtureTables` before it can be declared. An
 *   unregistered table matches no queue, so every read of it throws.
 *
 * Missing and exhausted fixtures both throw and name the table. Nothing falls
 * back to `[]`; a silent empty result is what made the previous positional
 * queues so hard to trace back to their cause.
 */
type SelectFixtureName = "forecastCache" | "menuItemIngredients";
type SelectFixtures = Partial<Record<SelectFixtureName, unknown[][]>>;

const fixtureTables: Record<SelectFixtureName, unknown> = {
  forecastCache,
  menuItemIngredients,
};
const fixtureTableNames = new Map<unknown, SelectFixtureName>(
  Object.entries(fixtureTables).map(([name, table]) => [
    table,
    name as SelectFixtureName,
  ]),
);

function createQuery(nextResultFor: (table: unknown) => unknown) {
  let selectedTable: unknown;
  const query = {
    from: vi.fn((table: unknown) => {
      selectedTable = table;
      return query;
    }),
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    then: vi.fn((resolve, reject) => {
      if (!selectedTable) {
        return Promise.reject(
          new Error("Select fixture query never called from(table)"),
        ).then(resolve, reject);
      }
      return Promise.resolve(nextResultFor(selectedTable)).then(
        resolve,
        reject,
      );
    }),
  };
  return query;
}

function createDb(fixtures: SelectFixtures = {}) {
  const selectResults = new Map<unknown, unknown[][]>(
    Object.entries(fixtures).map(([name, results]) => [
      fixtureTables[name as SelectFixtureName],
      [...(results ?? [])],
    ]),
  );
  const nextResultFor = (table: unknown) => {
    const name = fixtureTableNames.get(table) ?? "<unknown table>";
    const queue = selectResults.get(table);
    if (!queue) throw new Error(`Missing select fixture for ${name}`);
    const result = queue.shift();
    if (result === undefined) {
      throw new Error(`No select fixtures remaining for ${name}`);
    }
    return result;
  };
  const insertValues: unknown[] = [];
  const conflictUpdates: unknown[] = [];
  const db = {
    insertValues,
    conflictUpdates,
    select: vi.fn(() => createQuery(nextResultFor)),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        insertValues.push(values);
        return {
          onConflictDoUpdate: vi.fn(async (config: unknown) => {
            conflictUpdates.push(config);
          }),
        };
      }),
    })),
  };
  return db;
}

function createForecastService(forecasts: ForecastResult[] = []) {
  return {
    generateForecast: vi.fn(async () => forecasts),
  };
}

function itemForecast(overrides: Partial<ForecastResult> = {}): ForecastResult {
  return {
    date: "2026-06-08",
    type: "item_level",
    generatedBy: "statistical",
    items: [
      {
        menuItemId: 1,
        menuItemName: "Nasi Lemak",
        predicted: 10,
        confidence: 0.8,
        trend: "stable",
        trendPercent: 0,
        historicalAvg: 10,
      },
      {
        menuItemId: 2,
        menuItemName: "Tea",
        predicted: 5,
        confidence: 0.6,
        trend: "up",
        trendPercent: 20,
        historicalAvg: 4,
      },
      {
        menuItemId: 99,
        menuItemName: "No Recipe",
        predicted: 50,
        confidence: 0.9,
        trend: "up",
        trendPercent: 100,
        historicalAvg: 25,
      },
    ],
    metadata: {
      dataSourceDays: 28,
      model: "weighted_average",
      weights: {},
      generatedAt: "2026-06-07T00:00:00.000Z",
    },
    ...overrides,
  };
}

describe("IngredientForecastService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    enhancerFns.enhancePredictions.mockReset();
    drizzleState.db = createDb();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("routes select fixtures by table and reports missing fixtures", async () => {
    const db = createDb({
      forecastCache: [[{ data: [] }]],
      menuItemIngredients: [[{ ingredientId: 7 }]],
    });

    await expect(db.select().from(menuItemIngredients)).resolves.toEqual([
      { ingredientId: 7 },
    ]);
    await expect(db.select().from(forecastCache)).resolves.toEqual([
      { data: [] },
    ]);
    await expect(db.select().from(forecastCache)).rejects.toThrow(
      "No select fixtures remaining for forecastCache",
    );
  });

  it("explodes item forecasts into sorted ingredient demand and persists results", async () => {
    const db = createDb({
      menuItemIngredients: [
        [
          {
            menuItemId: 1,
            ingredientId: 7,
            quantityPerServing: 0.2,
            unit: "kg",
            ingredientName: "Rice",
            currentStock: 1,
          },
          {
            menuItemId: 2,
            ingredientId: 7,
            quantityPerServing: 0.05,
            unit: "kg",
            ingredientName: "Rice",
            currentStock: 1,
          },
          {
            menuItemId: 1,
            ingredientId: 8,
            quantityPerServing: 1.5,
            unit: "pcs",
            ingredientName: "Egg",
            currentStock: 20,
          },
        ],
      ],
    });
    drizzleState.db = db;
    const { kv, values } = createKV();
    const forecastService = createForecastService([itemForecast()]);
    const service = new IngredientForecastService(
      {} as D1Database,
      kv,
      forecastService as never,
    );

    const result = await service.generateIngredientForecast("restaurant-1", {
      startDate: "2026-06-08",
      endDate: "2026-06-08",
      useAI: true,
    });

    expect(forecastService.generateForecast).toHaveBeenCalledWith(
      "restaurant-1",
      {
        startDate: "2026-06-08",
        endDate: "2026-06-08",
        type: "item_level",
        useAI: true,
      },
    );
    expect(result).toEqual([
      {
        date: "2026-06-08",
        generatedBy: "statistical",
        metadata: {
          dataSourceDays: 28,
          model: "weighted_average",
          generatedAt: "2026-06-07T00:00:00.000Z",
        },
        ingredients: [
          {
            ingredientId: 8,
            ingredientName: "Egg",
            unit: "pcs",
            predictedQuantity: 15,
            confidence: 0.8,
            contributingItems: [
              { menuItemId: 1, menuItemName: "Nasi Lemak", quantity: 15 },
            ],
            currentStock: 20,
          },
          {
            ingredientId: 7,
            ingredientName: "Rice",
            unit: "kg",
            predictedQuantity: 2.25,
            confidence: 0.78,
            contributingItems: [
              { menuItemId: 1, menuItemName: "Nasi Lemak", quantity: 2 },
              { menuItemId: 2, menuItemName: "Tea", quantity: 0.25 },
            ],
            currentStock: 1,
            gap: 1.25,
          },
        ],
      },
    ]);
    expect(
      JSON.parse(values.get("forecast:ingredient:restaurant-1:2026-06-08")!),
    ).toMatchObject({ date: "2026-06-08", ingredients: expect.any(Array) });
    expect(kv.put).toHaveBeenCalledWith(
      "forecast:ingredient:restaurant-1:2026-06-08",
      expect.any(String),
      { expirationTtl: 21_600 },
    );
    expect(db.insertValues[0]).toMatchObject({
      restaurantId: "restaurant-1",
      forecastDate: "2026-06-08",
      forecastType: "ingredient_level",
      generatedBy: "statistical",
    });
    expect(db.conflictUpdates).toHaveLength(1);
  });

  it("uses AI enhanced ingredient forecasts when configured", async () => {
    const db = createDb({
      menuItemIngredients: [
        [
          {
            menuItemId: 1,
            ingredientId: 7,
            quantityPerServing: 1,
            unit: "kg",
            ingredientName: "Rice",
            currentStock: 1,
          },
        ],
      ],
    });
    drizzleState.db = db;
    const { kv } = createKV();
    const enhancedForecasts = [
      {
        ingredientId: 7,
        ingredientName: "Rice",
        unit: "kg",
        predictedQuantity: 12,
        confidence: 0.7,
        contributingItems: [],
        currentStock: 1,
        gap: 11,
      },
    ];
    enhancerFns.enhancePredictions.mockResolvedValue({
      enhancedForecasts,
      generatedBy: "ai_enhanced",
    });
    const service = new IngredientForecastService(
      {} as D1Database,
      kv,
      createForecastService([itemForecast()]) as never,
      "encryption-key",
    );

    await expect(
      service.generateIngredientForecast("restaurant-1", {
        startDate: "2026-06-08",
        endDate: "2026-06-08",
        useAI: true,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        generatedBy: "ai_enhanced",
        ingredients: enhancedForecasts,
      }),
    ]);
    expect(enhancerFns.enhancePredictions).toHaveBeenCalledWith(
      "restaurant-1",
      expect.any(Array),
      { startDate: "2026-06-08", endDate: "2026-06-08" },
    );
  });

  it("reads cached ingredient forecasts before querying the database", async () => {
    const cached = {
      date: "2026-06-08",
      ingredients: [],
      generatedBy: "statistical",
      metadata: {
        dataSourceDays: 7,
        model: "cached",
        generatedAt: "2026-06-07T00:00:00.000Z",
      },
    };
    const { kv } = createKV({
      "forecast:ingredient:restaurant-1:2026-06-08": cached,
    });
    const db = createDb();
    drizzleState.db = db;
    const service = new IngredientForecastService(
      {} as D1Database,
      kv,
      createForecastService() as never,
    );

    await expect(
      service.getIngredientForecast("restaurant-1", "2026-06-08", "2026-06-08"),
    ).resolves.toEqual([cached]);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("hydrates database fallback forecasts into KV and generates missing dates", async () => {
    const db = createDb({
      forecastCache: [
        [
          {
            data: [
              {
                ingredientId: 7,
                ingredientName: "Rice",
                unit: "kg",
                predictedQuantity: 3,
                confidence: 0.8,
                contributingItems: [],
              },
            ],
            metadata: {
              dataSourceDays: 14,
              model: "db-cache",
              generatedAt: "2026-06-07T00:00:00.000Z",
            },
            generatedBy: "statistical",
          },
        ],
        [],
      ],
    });
    drizzleState.db = db;
    const { kv } = createKV();
    const forecastService = createForecastService();
    const service = new IngredientForecastService(
      {} as D1Database,
      kv,
      forecastService as never,
    );
    const generateSpy = vi
      .spyOn(service, "generateIngredientForecast")
      .mockResolvedValueOnce([
        {
          date: "2026-06-09",
          ingredients: [],
          generatedBy: "statistical",
          metadata: {
            dataSourceDays: 1,
            model: "generated",
            generatedAt: "2026-06-07T00:00:00.000Z",
          },
        },
      ]);

    const result = await service.getIngredientForecast(
      "restaurant-1",
      "2026-06-08",
      "2026-06-09",
    );

    expect(result).toEqual([
      {
        date: "2026-06-08",
        ingredients: [
          {
            ingredientId: 7,
            ingredientName: "Rice",
            unit: "kg",
            predictedQuantity: 3,
            confidence: 0.8,
            contributingItems: [],
          },
        ],
        generatedBy: "statistical",
        metadata: {
          dataSourceDays: 14,
          model: "db-cache",
          generatedAt: "2026-06-07T00:00:00.000Z",
        },
      },
      {
        date: "2026-06-09",
        ingredients: [],
        generatedBy: "statistical",
        metadata: {
          dataSourceDays: 1,
          model: "generated",
          generatedAt: "2026-06-07T00:00:00.000Z",
        },
      },
    ]);
    expect(kv.put).toHaveBeenCalledWith(
      "forecast:ingredient:restaurant-1:2026-06-08",
      expect.any(String),
      { expirationTtl: 21_600 },
    );
    expect(generateSpy).toHaveBeenCalledWith("restaurant-1", {
      startDate: "2026-06-09",
      endDate: "2026-06-09",
    });
  });

  it("does not hydrate an expired database ingredient forecast into KV", async () => {
    const db = createDb({
      forecastCache: [
        [
          {
            data: [],
            metadata: { dataSourceDays: 14, model: "expired", generatedAt: "" },
            generatedBy: "statistical",
            expiresAt: new Date(Date.now() - 1),
          },
        ],
      ],
    });
    drizzleState.db = db;
    const { kv } = createKV();
    const service = new IngredientForecastService(
      {} as D1Database,
      kv,
      createForecastService() as never,
    );
    const generated = [
      {
        date: "2026-06-08",
        ingredients: [],
        generatedBy: "statistical" as const,
        metadata: { dataSourceDays: 1, model: "generated", generatedAt: "" },
      },
    ];
    vi.spyOn(service, "generateIngredientForecast").mockResolvedValue(
      generated,
    );

    await expect(
      service.getIngredientForecast("restaurant-1", "2026-06-08", "2026-06-08"),
    ).resolves.toEqual(generated);
    expect(kv.put).not.toHaveBeenCalled();
    expect(service.generateIngredientForecast).toHaveBeenCalledWith(
      "restaurant-1",
      { startDate: "2026-06-08", endDate: "2026-06-08" },
    );
  });

  it("computes date ranges and direct forecast explosion edge cases", () => {
    const service = new IngredientForecastService(
      {} as D1Database,
      createKV().kv,
      createForecastService() as never,
    );

    expect(service["getDateRange"]("2026-06-08", "2026-06-10")).toEqual([
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
    ]);

    expect(
      service["explodeForecast"](
        [
          {
            menuItemId: 1,
            menuItemName: "Tiny",
            predicted: 0,
            confidence: 0.5,
          },
          {
            menuItemId: 2,
            menuItemName: "Missing Recipe",
            predicted: 10,
            confidence: 1,
          },
        ],
        {
          1: [
            {
              ingredientId: 7,
              ingredientName: "Rice",
              unit: "kg",
              quantityPerServing: 2,
              currentStock: null,
            },
          ],
        },
      ),
    ).toEqual([
      {
        ingredientId: 7,
        ingredientName: "Rice",
        unit: "kg",
        predictedQuantity: 0,
        confidence: 0,
        contributingItems: [
          { menuItemId: 1, menuItemName: "Tiny", quantity: 0 },
        ],
      },
    ]);
  });
});
