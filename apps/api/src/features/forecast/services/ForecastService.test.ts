import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({})),
}));

import { ForecastService } from "./ForecastService";
import {
  forecastCache,
  menuItems,
  orderItems,
  orders,
} from "@makanmasak/database";

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
    } as any,
  };
}

/**
 * Select fixtures are keyed by table, not by call order: `from(table)`
 * decides which queue a query draws from, so adding a query against one
 * table can no longer shift another table's results out from under it.
 * `ForecastService` doesn't share a hoisted `db` mock (its `drizzle-orm/d1`
 * mock just returns `{}`) — each test that needs a select assigns
 * `(service as any).db = createSelectDb({...})` directly after constructing
 * the service, matching the file's existing convention.
 *
 * Two things still need care when the code under test grows a new query:
 *
 * - Within a single table the queue is positional. The Nth read of a table
 *   takes that table's Nth fixture, so a new query means inserting a fixture
 *   at the matching index rather than appending one at the end.
 * - A table has to be listed in `fixtureTables` before it can be declared. An
 *   unregistered table matches no queue, so every read of it throws.
 *
 * Missing and exhausted fixtures both throw and name the table. Nothing
 * falls back to `[]`; a silent empty result is what made the previous
 * positional queues so hard to trace back to their cause.
 *
 * `forecastCache`, `menuItems`, and `orderItems` are all read directly
 * somewhere in this service (`getStaleCache`, `getForecast`, `getAccuracy`,
 * `getAlerts`, `getHistoricalSales`), so all three are registered below.
 * `getAccuracy`'s and `getHistoricalSales`'s actuals queries innerJoin
 * `orders` and `menuItems` but select `from(orderItems)`, so those calls
 * still route to `orderItems` — joins never change the routing table.
 * `orders` is never itself the `from(table)` target anywhere in this
 * service, so it stays out of `fixtureTables`; it is imported only so the
 * regression test below has a real, unregistered table to demonstrate the
 * "<unknown table>" case.
 *
 * One extension beyond the base recipe: a queued entry may be an `Error`
 * instance instead of a rows array, in which case `nextResultFor` throws
 * that exact error instead of returning rows. This is only for genuinely
 * simulating a backend failure (e.g. the "ingredient db unavailable" case
 * below) — it never fires unless a test deliberately queues an `Error`, so
 * the missing/exhausted-fixture throws for every other read are unaffected.
 *
 * `getAlerts` wraps only its ingredient-forecast select
 * (`forecastCache`, queried for `forecastType: "ingredient_level"`) in a
 * local try/catch that logs to `console.error` and continues without
 * ingredient alerts. A harness throw (missing/exhausted fixture, or an
 * injected `Error` fixture) from that one query is swallowed there and never
 * surfaces as a rejected promise — assert via `console.error` and the
 * returned alert list instead of `rejects.toThrow()`. Every other select in
 * this file (`getStaleCache`, `getForecast`, `getAccuracy`, the menu-item
 * inventory read in `getAlerts`, `getHistoricalSales`) has no surrounding
 * try/catch of its own, so a harness throw there surfaces directly as a
 * rejected promise.
 */
type SelectFixtureName = "forecastCache" | "menuItems" | "orderItems";
type SelectFixtureRow = unknown[] | Error;
type SelectFixtures = Partial<Record<SelectFixtureName, SelectFixtureRow[]>>;

const fixtureTables: Record<SelectFixtureName, unknown> = {
  forecastCache,
  menuItems,
  orderItems,
};
const fixtureTableNames = new Map<unknown, SelectFixtureName>(
  Object.entries(fixtureTables).map(([name, table]) => [
    table,
    name as SelectFixtureName,
  ]),
);
const unselectedTable = Symbol("unselectedTable");

function createQuery(nextResultFor: (table: unknown) => unknown) {
  let selectedTable: unknown = unselectedTable;
  const query = {
    from: vi.fn((table: unknown) => {
      selectedTable = table;
      return query;
    }),
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    groupBy: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    then: (
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void,
    ) => {
      if (selectedTable === unselectedTable) {
        return Promise.reject(
          new Error("Select fixture query never called from(table)"),
        ).then(resolve, reject);
      }
      return Promise.resolve(nextResultFor(selectedTable)).then(
        resolve,
        reject,
      );
    },
  };
  return query;
}

function createSelectDb(fixtures: SelectFixtures = {}) {
  const selectResults = new Map<unknown, SelectFixtureRow[]>(
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
    if (result instanceof Error) throw result;
    return result;
  };
  return { select: vi.fn(() => createQuery(nextResultFor)) };
}

describe("ForecastService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("routes select fixtures by table and reports missing fixtures", async () => {
    const db = createSelectDb({
      forecastCache: [[{ id: "forecast-row" }]],
      menuItems: [[{ id: "menu-row" }]],
    });

    // Read in reverse declaration order: routing follows the table passed to
    // from(), not the execution order.
    await expect(db.select().from(menuItems)).resolves.toEqual([
      { id: "menu-row" },
    ]);
    await expect(db.select().from(forecastCache)).resolves.toEqual([
      { id: "forecast-row" },
    ]);
    await expect(db.select().from(forecastCache)).rejects.toThrow(
      "No select fixtures remaining for forecastCache",
    );
    // orders is innerJoin'd elsewhere but never the from(table) target in
    // ForecastService, so it stays out of fixtureTables and reports
    // <unknown table>.
    await expect(db.select().from(orders)).rejects.toThrow(
      "Missing select fixture for <unknown table>",
    );
  });

  it("returns cached forecasts without querying the database", async () => {
    const cached = [
      {
        date: "2026-06-08",
        type: "item_level",
        items: [{ menuItemId: 1, menuItemName: "Tea", predicted: 12 }],
        generatedBy: "statistical",
        metadata: { generatedAt: "2026-06-07T00:00:00.000Z" },
      },
    ];
    const { kv } = createKV({
      "forecast:restaurant-1:2026-06-08:item_level": cached,
    });
    const service = new ForecastService({} as D1Database, kv);

    await expect(
      service.getForecast(
        "restaurant-1",
        "2026-06-08",
        "2026-06-08",
        "item_level",
      ),
    ).resolves.toEqual(cached);
    expect(kv.get).toHaveBeenCalledWith(
      "forecast:restaurant-1:2026-06-08:item_level",
    );
  });

  it("generates weighted forecasts and persists them to KV and DB", async () => {
    const { kv, values } = createKV();
    const service = new ForecastService({} as D1Database, kv);
    vi.spyOn(service as any, "getHistoricalSales").mockResolvedValue({
      1: { name: "Tea", weeklySales: [20, 10, 10, 10] },
      2: { name: "Rice", weeklySales: [] },
    });
    const saveSpy = vi
      .spyOn(service as any, "saveForecastToDb")
      .mockResolvedValue(undefined);

    const forecasts = await service.generateForecast("restaurant-1", {
      startDate: "2026-06-08",
      endDate: "2026-06-09",
      type: "item_level",
      useAI: true,
    });

    expect(forecasts).toHaveLength(2);
    expect(forecasts[0]).toMatchObject({
      date: "2026-06-08",
      type: "item_level",
      generatedBy: "ai_enhanced",
      items: [
        {
          menuItemId: 1,
          menuItemName: "Tea",
          predicted: expect.any(Number),
          confidence: expect.any(Number),
          trend: "up",
        },
      ],
    });
    expect(saveSpy).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(
        values.get("forecast:restaurant-1:2026-06-08:item_level") ?? "[]",
      ),
    ).toHaveLength(1);
    expect(kv.put).toHaveBeenCalledWith(
      "forecast:restaurant-1:2026-06-08:item_level",
      expect.any(String),
      { expirationTtl: 21_600 },
    );
  });

  it("returns stale DB cache when generation fails", async () => {
    const { kv } = createKV();
    const service = new ForecastService({} as D1Database, kv);
    vi.spyOn(service as any, "getHistoricalSales").mockRejectedValue(
      new Error("db unavailable"),
    );
    vi.spyOn(service as any, "getStaleCache").mockResolvedValue({
      date: "2026-06-08",
      type: "item_level",
      items: [],
      generatedBy: "statistical",
      metadata: { generatedAt: "old" },
    });

    await expect(
      service.generateForecast("restaurant-1", {
        startDate: "2026-06-08",
        endDate: "2026-06-08",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        date: "2026-06-08",
        stale: true,
      }),
    ]);
  });

  it("computes date ranges and weighted prediction details", () => {
    const service = new ForecastService({} as D1Database, createKV().kv);

    expect((service as any).getDateRange("2026-06-08", "2026-06-10")).toEqual([
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
    ]);

    expect(
      (service as any).calculatePrediction(7, {
        name: "Nasi Lemak",
        weeklySales: [10, 10, 10, 10],
      }),
    ).toEqual({
      menuItemId: 7,
      menuItemName: "Nasi Lemak",
      predicted: 10,
      confidence: 1,
      trend: "stable",
      trendPercent: 0,
      historicalAvg: 10,
    });

    expect(
      (service as any).calculatePrediction(7, {
        name: "Nasi Lemak",
        weeklySales: [],
      }),
    ).toBeNull();
  });

  it("hydrates fresh DB cache misses back into KV", async () => {
    const { kv } = createKV();
    const service = new ForecastService({} as D1Database, kv);
    (service as any).db = createSelectDb({
      forecastCache: [
        [
          {
            data: {
              1: {
                predicted: 14,
                confidence: 0.9,
                trend: "up",
                menuItemName: "Tea",
                trendPercent: 25,
                historicalAvg: 10,
              },
            },
            metadata: { generatedAt: "2026-06-07T00:00:00.000Z" },
            generatedBy: "statistical",
            expiresAt: new Date("2026-06-07T06:00:00.000Z"),
          },
        ],
      ],
    });

    const result = await service.getForecast(
      "restaurant-1",
      "2026-06-08",
      "2026-06-08",
    );

    expect(result).toEqual([
      {
        date: "2026-06-08",
        type: "item_level",
        items: [
          {
            menuItemId: 1,
            menuItemName: "Tea",
            predicted: 14,
            confidence: 0.9,
            trend: "up",
            trendPercent: 25,
            historicalAvg: 10,
          },
        ],
        generatedBy: "statistical",
        metadata: { generatedAt: "2026-06-07T00:00:00.000Z" },
      },
    ]);
    expect(kv.put).toHaveBeenCalledWith(
      "forecast:restaurant-1:2026-06-08:item_level",
      expect.any(String),
      { expirationTtl: 21_600 },
    );
  });

  it("falls back from expired DB cache by generating a fresh forecast", async () => {
    const { kv } = createKV();
    const service = new ForecastService({} as D1Database, kv);
    (service as any).db = createSelectDb({
      forecastCache: [
        [
          {
            data: {},
            metadata: { generatedAt: "old" },
            generatedBy: "statistical",
            expiresAt: new Date("2026-06-06T00:00:00.000Z"),
          },
        ],
      ],
    });
    const generateSpy = vi
      .spyOn(service, "generateForecast")
      .mockResolvedValue([
        {
          date: "2026-06-08",
          type: "item_level",
          items: [],
          generatedBy: "statistical",
          metadata: { generatedAt: "fresh" },
        },
      ]);

    await expect(
      service.getForecast("restaurant-1", "2026-06-08", "2026-06-08"),
    ).resolves.toEqual([
      expect.objectContaining({
        date: "2026-06-08",
        metadata: { generatedAt: "fresh" },
      }),
    ]);
    expect(generateSpy).toHaveBeenCalledWith("restaurant-1", {
      startDate: "2026-06-08",
      endDate: "2026-06-08",
      type: "item_level",
    });
  });

  it("computes accuracy across forecast, name, and actual sales queries", async () => {
    const service = new ForecastService({} as D1Database, createKV().kv);
    const predictions = Object.fromEntries(
      Array.from({ length: 95 }, (_, index) => [
        String(index + 1),
        { predicted: index === 0 ? 20 : 10 },
      ]),
    );
    (service as any).db = createSelectDb({
      forecastCache: [[{ forecastDate: "2026-06-08", data: predictions }]],
      menuItems: [
        Array.from({ length: 90 }, (_, index) => ({
          id: index + 1,
          name: `Item ${index + 1}`,
        })),
        [
          { id: 91, name: "Item 91" },
          { id: 92, name: "Item 92" },
        ],
      ],
      orderItems: [
        [
          {
            menuItemId: 1,
            itemName: "Tea",
            actualQuantity: 15,
            orderDate: "2026-06-08",
          },
        ],
      ],
    });

    const accuracy = await service.getAccuracy(
      "restaurant-1",
      "2026-06-08",
      "2026-06-08",
    );

    expect(accuracy).toHaveLength(95);
    expect(accuracy[0]).toEqual({
      menuItemId: 1,
      menuItemName: "Item 1",
      predicted: 20,
      actual: 15,
      deviation: 25,
    });
    expect(accuracy[94]).toEqual({
      menuItemId: 95,
      menuItemName: "Item #95",
      predicted: 10,
      actual: 0,
      deviation: 100,
    });
    expect((service as any).db.select).toHaveBeenCalledTimes(4);
  });

  it("returns no accuracy rows when no forecasts exist", async () => {
    const service = new ForecastService({} as D1Database, createKV().kv);
    (service as any).db = createSelectDb({
      forecastCache: [[]],
    });

    await expect(
      service.getAccuracy("restaurant-1", "2026-06-08", "2026-06-08"),
    ).resolves.toEqual([]);
  });

  it("builds demand, stock, spike, and ingredient alerts in severity order", async () => {
    const service = new ForecastService({} as D1Database, createKV().kv);
    vi.spyOn(service, "getForecast").mockResolvedValue([
      {
        date: "2026-06-08",
        type: "item_level",
        generatedBy: "statistical",
        metadata: { generatedAt: "2026-06-07T00:00:00.000Z" },
        items: [
          {
            menuItemId: 1,
            menuItemName: "Tea",
            predicted: 60,
            confidence: 0.8,
            trend: "up",
            trendPercent: 200,
            historicalAvg: 20,
          },
        ],
      },
    ]);
    (service as any).db = createSelectDb({
      menuItems: [[{ id: 1, name: "Tea", inventoryCount: 20 }]],
      forecastCache: [
        [
          {
            data: [
              {
                ingredientId: 7,
                ingredientName: "Milk",
                unit: "L",
                predictedQuantity: 5,
                currentStock: 2,
              },
              {
                ingredientId: 8,
                ingredientName: "Sugar",
                unit: "kg",
                predictedQuantity: 10,
                currentStock: 40,
              },
              {
                ingredientId: 9,
                ingredientName: "Ignored",
                unit: "kg",
                predictedQuantity: 10,
              },
            ],
          },
        ],
      ],
    });

    const alerts = await service.getAlerts("restaurant-1");

    expect(alerts.map((alert) => alert.type)).toEqual([
      "low_stock",
      "procurement_needed",
      "high_demand",
      "unusual_spike",
      "excess_stock",
    ]);
    expect(alerts[0]).toMatchObject({
      severity: "critical",
      menuItemId: 1,
    });
    expect(alerts[1]).toMatchObject({
      ingredientId: 7,
      severity: "critical",
      data: { predicted: 5, currentStock: 2, gap: 3, unit: "L" },
    });
  });

  it("continues alert generation when ingredient forecast lookup fails", async () => {
    const service = new ForecastService({} as D1Database, createKV().kv);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(service, "getForecast").mockResolvedValue([
      {
        date: "2026-06-08",
        type: "item_level",
        generatedBy: "statistical",
        metadata: { generatedAt: "2026-06-07T00:00:00.000Z" },
        items: [
          {
            menuItemId: 1,
            menuItemName: "Tea",
            predicted: 31,
            confidence: 0.7,
            trend: "stable",
            trendPercent: 0,
            historicalAvg: 31,
          },
        ],
      },
    ]);
    // forecastCache's ingredient-forecast select throws here, standing in
    // for a genuine backend failure. getAlerts's local try/catch swallows
    // it (see doc comment above), so this never surfaces as a rejection —
    // only as the console.error call and a shorter alert list, asserted
    // below.
    (service as any).db = createSelectDb({
      menuItems: [[{ id: 1, name: "Tea", inventoryCount: null }]],
      forecastCache: [new Error("ingredient db unavailable")],
    });

    await expect(service.getAlerts("restaurant-1")).resolves.toEqual([
      expect.objectContaining({ type: "high_demand" }),
    ]);
    expect(console.error).toHaveBeenCalledWith(
      "Ingredient alert generation error:",
      expect.any(Error),
    );
    vi.mocked(console.error).mockRestore();
  });

  it("groups historical sales by menu item in descending query order", async () => {
    const service = new ForecastService({} as D1Database, createKV().kv);
    (service as any).db = createSelectDb({
      orderItems: [
        [
          {
            menuItemId: 1,
            itemName: "Tea",
            quantitySum: 12,
            orderDate: "2026-06-01",
          },
          {
            menuItemId: 1,
            itemName: "Tea",
            quantitySum: 8,
            orderDate: "2026-05-25",
          },
          {
            menuItemId: 2,
            itemName: "Rice",
            quantitySum: 4,
            orderDate: "2026-06-01",
          },
        ],
      ],
    });

    await expect(
      (service as any).getHistoricalSales("restaurant-1", "2026-06-08", 1),
    ).resolves.toEqual({
      1: { name: "Tea", weeklySales: [12, 8] },
      2: { name: "Rice", weeklySales: [4] },
    });
  });
});
