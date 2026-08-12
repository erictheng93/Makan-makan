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
