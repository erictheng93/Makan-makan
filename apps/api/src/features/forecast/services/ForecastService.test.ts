import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({})),
}));

import { ForecastService } from "./ForecastService";

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

function createQuery<T>(result: T) {
  const query = {
    from: vi.fn(() => query),
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    groupBy: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    then: vi.fn((resolve, reject) =>
      Promise.resolve(result).then(resolve, reject),
    ),
  };
  return query;
}

describe("ForecastService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
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
    (service as any).db = {
      select: vi.fn(() =>
        createQuery([
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
        ]),
      ),
    };

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
    (service as any).db = {
      select: vi.fn(() =>
        createQuery([
          {
            data: {},
            metadata: { generatedAt: "old" },
            generatedBy: "statistical",
            expiresAt: new Date("2026-06-06T00:00:00.000Z"),
          },
        ]),
      ),
    };
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
    const queries = [
      createQuery([{ forecastDate: "2026-06-08", data: predictions }]),
      createQuery(
        Array.from({ length: 90 }, (_, index) => ({
          id: index + 1,
          name: `Item ${index + 1}`,
        })),
      ),
      createQuery([
        { id: 91, name: "Item 91" },
        { id: 92, name: "Item 92" },
      ]),
      createQuery([
        {
          menuItemId: 1,
          itemName: "Tea",
          actualQuantity: 15,
          orderDate: "2026-06-08",
        },
      ]),
    ];
    (service as any).db = {
      select: vi.fn(() => queries.shift()),
    };

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
    (service as any).db = {
      select: vi.fn(() => createQuery([])),
    };

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
    const queries = [
      createQuery([{ id: 1, name: "Tea", inventoryCount: 20 }]),
      createQuery([
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
      ]),
    ];
    (service as any).db = {
      select: vi.fn(() => queries.shift()),
    };

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
    const queries = [
      createQuery([{ id: 1, name: "Tea", inventoryCount: null }]),
      {
        from: vi.fn(function () {
          return this;
        }),
        where: vi.fn(function () {
          return this;
        }),
        limit: vi.fn(function () {
          return this;
        }),
        then: vi.fn((_resolve, reject) =>
          Promise.reject(new Error("ingredient db unavailable")).then(
            undefined,
            reject,
          ),
        ),
      },
    ];
    (service as any).db = {
      select: vi.fn(() => queries.shift()),
    };

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
    (service as any).db = {
      select: vi.fn(() =>
        createQuery([
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
        ]),
      ),
    };

    await expect(
      (service as any).getHistoricalSales("restaurant-1", "2026-06-08", 1),
    ).resolves.toEqual({
      1: { name: "Tea", weeklySales: [12, 8] },
      2: { name: "Rice", weeklySales: [4] },
    });
  });
});
