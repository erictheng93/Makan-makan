import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { orders, restaurants } from "../schema";
import {
  createTestDatabase,
  REAL_D1_SETUP_TIMEOUT_MS,
  type TestDatabase,
} from "../testing/create-test-database";
import { AnalyticsService } from "./analytics";

describe("AnalyticsService revenue analytics", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, REAL_D1_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
    await testDb.drizzle.insert(restaurants).values({
      id: "analytics-restaurant",
      name: "Analytics Test Restaurant",
      type: "casual",
      category: "testing",
      address: "1 Test Road",
      district: "Test District",
      phone: "0912345678",
    });
  });

  it("returns prior-period revenue comparison when requested", async () => {
    await testDb.drizzle.insert(orders).values([
      order("current-1", "A-001", "2026-01-08T12:00:00.000Z", 15000),
      order("current-2", "A-002", "2026-01-09T12:00:00.000Z", 30000),
      order("previous-1", "A-003", "2026-01-06T12:00:00.000Z", 10000),
      order("previous-2", "A-004", "2026-01-07T12:00:00.000Z", 20000),
      order("cancelled", "A-005", "2026-01-07T13:00:00.000Z", 50000, {
        status: "cancelled",
      }),
    ]);

    const service = new AnalyticsService(testDb.bindings.DB, {} as never);

    const result = await service.getRevenueAnalytics({
      restaurantId: "analytics-restaurant",
      dateFrom: "2026-01-08T00:00:00.000Z",
      dateTo: "2026-01-10T00:00:00.000Z",
      groupBy: "day",
      includeComparison: true,
    });

    expect(result).toEqual([
      {
        date: "2026-01-08",
        revenue: 150,
        orderCount: 1,
        averageOrderValue: 150,
        comparison: {
          previousRevenue: 100,
          growthRate: 50,
        },
      },
      {
        date: "2026-01-09",
        revenue: 300,
        orderCount: 1,
        averageOrderValue: 300,
        comparison: {
          previousRevenue: 200,
          growthRate: 50,
        },
      },
    ]);
  });

  it("buckets a UTC evening order into the following Taipei business day", async () => {
    await testDb.drizzle
      .insert(orders)
      .values([
        order("taipei-midnight", "TZ-001", "2026-01-08T17:00:00.000Z", 15000),
      ]);

    const service = new AnalyticsService(testDb.bindings.DB, {} as never);

    await expect(
      service.getRevenueAnalytics({
        restaurantId: "analytics-restaurant",
        groupBy: "day",
      }),
    ).resolves.toContainEqual(
      expect.objectContaining({ date: "2026-01-09", revenue: 150 }),
    );
  });

  it("uses Taipei buckets for shifted explicit-range comparisons", async () => {
    await testDb.drizzle
      .insert(orders)
      .values([
        order("current-taipei", "TZ-101", "2026-01-09T17:00:00.000Z", 15000),
        order("previous-taipei", "TZ-100", "2026-01-08T17:00:00.000Z", 10000),
      ]);

    const service = new AnalyticsService(testDb.bindings.DB, {} as never);

    await expect(
      service.getRevenueAnalytics({
        restaurantId: "analytics-restaurant",
        dateFrom: "2026-01-09T16:00:00.000Z",
        dateTo: "2026-01-10T16:00:00.000Z",
        groupBy: "day",
        includeComparison: true,
      }),
    ).resolves.toContainEqual(
      expect.objectContaining({
        date: "2026-01-10",
        revenue: 150,
        comparison: {
          previousRevenue: 100,
          growthRate: 50,
        },
      }),
    );
  });

  it("excludes current-period boundary orders from the prior period", async () => {
    await testDb.drizzle
      .insert(orders)
      .values([
        order("current-boundary", "B-001", "2026-01-08T00:00:00.000Z", 15000),
        order("previous-boundary", "B-002", "2026-01-06T00:00:00.000Z", 10000),
        order("current-end", "B-003", "2026-01-10T00:00:00.000Z", 50000),
      ]);

    const service = new AnalyticsService(testDb.bindings.DB, {} as never);

    const result = await service.getRevenueAnalytics({
      restaurantId: "analytics-restaurant",
      dateFrom: "2026-01-08T00:00:00.000Z",
      dateTo: "2026-01-10T00:00:00.000Z",
      groupBy: "day",
      includeComparison: true,
    });

    expect(result).toEqual([
      {
        date: "2026-01-08",
        revenue: 150,
        orderCount: 1,
        averageOrderValue: 150,
        comparison: {
          previousRevenue: 100,
          growthRate: 50,
        },
      },
      {
        date: "2026-01-10",
        revenue: 500,
        orderCount: 1,
        averageOrderValue: 500,
        comparison: {
          previousRevenue: 0,
          growthRate: 100,
        },
      },
    ]);
  });

  it("compares each day with the previous day when no date range is supplied", async () => {
    await testDb.drizzle
      .insert(orders)
      .values([
        order("daily-1", "C-001", "2026-01-08T12:00:00.000Z", 10000),
        order("daily-2", "C-002", "2026-01-09T12:00:00.000Z", 20000),
        order("daily-3", "C-003", "2026-01-10T12:00:00.000Z", 30000),
      ]);

    const service = new AnalyticsService(testDb.bindings.DB, {} as never);

    const result = await service.getRevenueAnalytics({
      restaurantId: "analytics-restaurant",
      groupBy: "day",
      includeComparison: true,
    });

    expect(result).toEqual([
      expect.objectContaining({
        date: "2026-01-08",
        comparison: {
          previousRevenue: 0,
          growthRate: 100,
        },
      }),
      expect.objectContaining({
        date: "2026-01-09",
        comparison: {
          previousRevenue: 100,
          growthRate: 100,
        },
      }),
      expect.objectContaining({
        date: "2026-01-10",
        comparison: {
          previousRevenue: 200,
          growthRate: 50,
        },
      }),
    ]);
  });

  it.each([
    {
      groupBy: "week" as const,
      currentDate: "2026-01-12T12:00:00.000Z",
      previousDate: "2026-01-05T12:00:00.000Z",
      currentBucket: "2026-W02",
    },
    {
      groupBy: "month" as const,
      currentDate: "2026-03-15T12:00:00.000Z",
      previousDate: "2026-02-15T12:00:00.000Z",
      currentBucket: "2026-03",
    },
    {
      groupBy: "year" as const,
      currentDate: "2026-03-15T12:00:00.000Z",
      previousDate: "2025-03-15T12:00:00.000Z",
      currentBucket: "2026",
    },
  ])(
    "compares $groupBy buckets with their previous bucket when no date range is supplied",
    async ({ groupBy, currentDate, previousDate, currentBucket }) => {
      await testDb.drizzle
        .insert(orders)
        .values([
          order(`${groupBy}-current`, `${groupBy}-001`, currentDate, 30000),
          order(`${groupBy}-previous`, `${groupBy}-002`, previousDate, 20000),
        ]);

      const service = new AnalyticsService(testDb.bindings.DB, {} as never);

      const result = await service.getRevenueAnalytics({
        restaurantId: "analytics-restaurant",
        groupBy,
        includeComparison: true,
      });

      expect(result).toContainEqual(
        expect.objectContaining({
          date: currentBucket,
          revenue: 300,
          comparison: {
            previousRevenue: 200,
            growthRate: 50,
          },
        }),
      );
    },
  );
});

describe("AnalyticsService financial report", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, REAL_D1_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
    await testDb.drizzle.insert(restaurants).values({
      id: "analytics-restaurant",
      name: "Analytics Test Restaurant",
      type: "casual",
      category: "testing",
      address: "1 Test Road",
      district: "Test District",
      phone: "0912345678",
    });
  });

  it("reports the tax carried in the orders and the revenue net of it", async () => {
    await testDb.drizzle.insert(orders).values([
      order("fin-1", "F-001", "2026-02-02T12:00:00.000Z", 21000, {
        taxAmountCents: 1000,
      }),
      order("fin-2", "F-002", "2026-02-03T12:00:00.000Z", 10500, {
        taxAmountCents: 500,
      }),
      order("fin-cancelled", "F-003", "2026-02-03T13:00:00.000Z", 90000, {
        taxAmountCents: 9000,
        status: "cancelled",
      }),
    ]);

    const service = new AnalyticsService(testDb.bindings.DB, {} as never);

    const report = await service.getFinancialReport({
      restaurantId: "analytics-restaurant",
      dateFrom: "2026-02-01T00:00:00.000Z",
      dateTo: "2026-02-05T00:00:00.000Z",
      groupBy: "day",
    });

    expect(report.summary).toMatchObject({
      totalRevenue: 315,
      totalOrders: 2,
      taxAmount: 15,
      netRevenue: 300,
    });
  });

  it("sums tax only over the buckets the revenue total kept", async () => {
    // getRevenueAnalytics caps its bucket list at `limit`. A range-wide tax
    // sum would subtract the dropped day's tax from a revenue total that never
    // included that day's revenue, dragging netRevenue below the truth.
    await testDb.drizzle.insert(orders).values([
      order("cap-1", "G-001", "2026-02-02T12:00:00.000Z", 21000, {
        taxAmountCents: 1000,
      }),
      order("cap-2", "G-002", "2026-02-03T12:00:00.000Z", 10500, {
        taxAmountCents: 500,
      }),
      order("cap-dropped", "G-003", "2026-02-04T12:00:00.000Z", 50000, {
        taxAmountCents: 5000,
      }),
    ]);

    const service = new AnalyticsService(testDb.bindings.DB, {} as never);

    const report = await service.getFinancialReport({
      restaurantId: "analytics-restaurant",
      dateFrom: "2026-02-01T00:00:00.000Z",
      dateTo: "2026-02-05T00:00:00.000Z",
      groupBy: "day",
      limit: 2,
    });

    expect(report.summary).toMatchObject({
      totalRevenue: 315,
      taxAmount: 15,
      netRevenue: 300,
    });
    expect(report.summary.netRevenue).toBeGreaterThan(0);
  });
});

function order(
  id: string,
  orderNumber: string,
  createdAt: string,
  totalAmountCents: number,
  overrides: Partial<typeof orders.$inferInsert> = {},
): typeof orders.$inferInsert {
  return {
    id,
    orderNumber,
    restaurantId: "analytics-restaurant",
    status: "paid",
    totalAmountCents,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    ...overrides,
  };
}
