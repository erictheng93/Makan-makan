import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../types/env";

const mocks = vi.hoisted(() => {
  const databaseService = {
    getDashboardData: vi.fn(),
    getRevenueAnalytics: vi.fn(),
    getMenuAnalytics: vi.fn(),
    getCustomerAnalytics: vi.fn(),
    getOrderAnalytics: vi.fn(),
    getRealtimeDashboard: vi.fn(),
    getFinancialReport: vi.fn(),
  };
  const cache = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  };

  return { databaseService, cache };
});

vi.mock("../../../core/cache", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    KVCacheService: vi.fn(function KVCacheService() {
      return mocks.cache;
    }),
    NoopCacheService: vi.fn(function NoopCacheService() {
      return mocks.cache;
    }),
  };
});

vi.mock("../../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function ConsoleLogger() {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  }),
}));

vi.mock("@makanmasak/database", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    AnalyticsService: vi.fn(function AnalyticsService() {
      return mocks.databaseService;
    }),
  };
});

import { AnalyticsService } from "./AnalyticsService";

function createService() {
  return new AnalyticsService(
    {} as D1Database,
    { DB: {} as D1Database, CACHE_KV: {} as KVNamespace } as Env,
    {} as KVNamespace,
  );
}

const dashboardSummary = {
  todayRevenue: 1250,
  todayOrders: 25,
  monthRevenue: 12_500,
  monthOrders: 250,
  growthRates: {
    revenueGrowth: 12,
    orderGrowth: 8,
  },
};

describe("AnalyticsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cached analytics without calling database readers", async () => {
    const cachedProduct = {
      popularItems: [],
      categoryPerformance: [],
      lowPerformingItems: [],
    };
    const cachedCustomer = {
      totalCustomers: 9,
      newCustomers: 2,
      returningCustomers: 7,
      averageOrdersPerCustomer: 3,
      customerLifetimeValue: 450,
      topCustomers: [],
    };
    const cachedPerformance = {
      totalOrders: 20,
      completedOrders: 18,
      cancelledOrders: 2,
      averageOrderValue: 50,
      totalRevenue: 900,
      conversionRate: 90,
      averagePreparationTime: 12,
      popularTimeSlots: [],
    };

    mocks.cache.get
      .mockResolvedValueOnce(dashboardSummary)
      .mockResolvedValueOnce([{ date: "2026-06-07", revenue: 100 }])
      .mockResolvedValueOnce(cachedProduct)
      .mockResolvedValueOnce(cachedCustomer)
      .mockResolvedValueOnce(cachedPerformance);

    const service = createService();

    await expect(service.getDashboardData("7", "today")).resolves.toEqual(
      dashboardSummary,
    );
    await expect(
      service.getRevenueAnalytics({ restaurantId: "7" }),
    ).resolves.toHaveLength(1);
    await expect(
      service.getProductAnalytics({ restaurantId: "7" }),
    ).resolves.toBe(cachedProduct);
    await expect(
      service.getCustomerAnalytics({ restaurantId: "7" }),
    ).resolves.toBe(cachedCustomer);
    await expect(
      service.getPerformanceAnalytics({ restaurantId: "7" }),
    ).resolves.toBe(cachedPerformance);

    expect(mocks.databaseService.getDashboardData).not.toHaveBeenCalled();
    expect(mocks.databaseService.getRevenueAnalytics).not.toHaveBeenCalled();
    expect(mocks.databaseService.getMenuAnalytics).not.toHaveBeenCalled();
    expect(mocks.databaseService.getCustomerAnalytics).not.toHaveBeenCalled();
    expect(mocks.databaseService.getOrderAnalytics).not.toHaveBeenCalled();
  });

  it("loads analytics from database and stores cache entries", async () => {
    const revenue = [
      {
        date: "2026-06-07",
        revenue: 200,
        orderCount: 4,
        averageOrderValue: 50,
      },
    ];
    const product = {
      popularItems: [
        {
          itemId: 1,
          itemName: "Nasi Lemak",
          categoryName: "Rice",
          quantity: 4,
          revenue: 200,
        },
      ],
      categoryPerformance: [
        {
          categoryId: 1,
          categoryName: "Rice",
          quantity: 4,
          revenue: 200,
          itemCount: 1,
        },
      ],
      lowPerformingItems: [],
    };
    const customer = {
      totalCustomers: 10,
      newCustomers: 3,
      returningCustomers: 7,
      averageOrdersPerCustomer: 2,
      customerLifetimeValue: 300,
      topCustomers: [],
    };
    const performance = {
      totalOrders: 5,
      completedOrders: 4,
      cancelledOrders: 1,
      averageOrderValue: 50,
      totalRevenue: 200,
      conversionRate: 80,
      averagePreparationTime: 10,
      popularTimeSlots: [{ hour: 12, orderCount: 3 }],
    };
    mocks.cache.get.mockResolvedValue(null);
    mocks.databaseService.getDashboardData.mockResolvedValue({
      summary: dashboardSummary,
    });
    mocks.databaseService.getRevenueAnalytics.mockResolvedValue(revenue);
    mocks.databaseService.getMenuAnalytics.mockResolvedValue(product);
    mocks.databaseService.getCustomerAnalytics.mockResolvedValue(customer);
    mocks.databaseService.getOrderAnalytics.mockResolvedValue(performance);

    const service = createService();
    const filters = {
      restaurantId: "7",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-07",
      groupBy: "day" as const,
    };

    await expect(service.getDashboardData("7", "week")).resolves.toEqual(
      dashboardSummary,
    );
    await expect(service.getRevenueAnalytics(filters)).resolves.toEqual(
      revenue,
    );
    await expect(service.getProductAnalytics(filters)).resolves.toEqual(
      product,
    );
    await expect(service.getCustomerAnalytics(filters)).resolves.toEqual(
      customer,
    );
    await expect(service.getPerformanceAnalytics(filters)).resolves.toEqual(
      performance,
    );

    expect(mocks.databaseService.getDashboardData).toHaveBeenCalledWith("7");
    expect(mocks.databaseService.getRevenueAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "7", dateFrom: "2026-06-01" }),
    );
    expect(mocks.databaseService.getMenuAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "7", groupBy: "day" }),
    );
    expect(mocks.cache.set).toHaveBeenCalledWith(
      "analytics:dashboard:7:week",
      dashboardSummary,
      expect.any(Number),
    );
  });

  it("computes realtime metrics from dashboard and realtime snapshots", async () => {
    mocks.databaseService.getDashboardData.mockResolvedValue({
      summary: dashboardSummary,
      tableStatus: { total: 10 },
    });
    mocks.databaseService.getRealtimeDashboard.mockResolvedValue({
      activeOrders: 6,
      kitchenQueue: 3,
      occupiedTables: 4,
    });

    await expect(createService().getRealtimeData("7")).resolves.toEqual({
      timestamp: "2026-06-07T12:00:00.000Z",
      summary: dashboardSummary,
      activeOrders: 6,
      pendingOrders: 3,
      tableUtilization: 40,
    });
  });

  it("generates json and csv exports with encoded payload metadata", async () => {
    const service = createService();
    vi.spyOn(service, "getDashboardData").mockResolvedValue(dashboardSummary);
    vi.spyOn(service, "getRevenueAnalytics").mockResolvedValue([
      {
        // RevenueData has no free-text column, so the quoting case rides on
        // `date`, the one string field the CSV writer emits.
        date: 'quoted, "value"',
        revenue: 100,
        orderCount: 2,
        averageOrderValue: 50,
      },
    ]);

    const jsonExport = await service.generateExport({
      type: "dashboard",
      format: "json",
      restaurantId: "7",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-07",
    });
    const csvExport = await service.generateExport({
      type: "revenue",
      format: "csv",
      restaurantId: "7",
    });

    const jsonPayload = decodeURIComponent(
      jsonExport.data.download_url.split(",", 2)[1],
    );
    const csvPayload = decodeURIComponent(
      csvExport.data.download_url.split(",", 2)[1],
    );

    expect(jsonExport.data).toMatchObject({
      filename: "dashboard_1780833600000.json",
      content_type: "application/json",
      expires_at: "2026-06-08T12:00:00.000Z",
    });
    expect(JSON.parse(jsonPayload)).toMatchObject({
      metadata: {
        type: "dashboard",
        restaurantId: "7",
        generatedAt: "2026-06-07T12:00:00.000Z",
      },
      data: dashboardSummary,
    });
    expect(csvExport.data.content_type).toBe("text/csv");
    expect(csvPayload).toContain("date,revenue,orderCount");
    expect(csvPayload).toContain('"quoted, ""value"""');
  });

  it("normalizes financial reports and clears analytics cache patterns", async () => {
    mocks.cache.get.mockResolvedValue(null);
    mocks.databaseService.getFinancialReport.mockResolvedValue({
      summary: {
        totalRevenue: 500,
        totalOrders: 10,
        averageOrderValue: 50,
        taxAmount: 25,
        netRevenue: 475,
      },
      // The database layer returns one `byDay` bucket list at the grain the
      // filters asked for, labelled `date` and counting `orderCount`. This
      // endpoint republishes it under the period-named key.
      revenueBreakdown: {
        byDay: [
          {
            date: "2026-06-07",
            revenue: 500,
            orderCount: 10,
            averageOrderValue: 50,
          },
        ],
        byCategory: [],
        topItems: [],
      },
    });

    const service = createService();
    await expect(
      service.getFinancialReport({ restaurantId: "7", period: "daily" }),
    ).resolves.toEqual({
      totalRevenue: 500,
      totalOrders: 10,
      averageOrderValue: 50,
      taxAmount: 25,
      netRevenue: 475,
      breakdown: {
        daily: [{ date: "2026-06-07", revenue: 500, orders: 10 }],
      },
    });

    await service.clearCache("7");
    await service.clearCache();

    expect(mocks.databaseService.getFinancialReport).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "7", period: "daily" }),
    );
    expect(mocks.cache.clear).toHaveBeenNthCalledWith(1, "analytics:*:7:*");
    expect(mocks.cache.clear).toHaveBeenNthCalledWith(2, "analytics:*");
  });
});
