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
});
