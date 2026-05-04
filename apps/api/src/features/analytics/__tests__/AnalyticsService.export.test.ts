import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsService } from "../services/AnalyticsService";

const mockDatabaseAnalyticsService = {
  getDashboardData: vi.fn(),
  getRevenueAnalytics: vi.fn(),
  getMenuAnalytics: vi.fn(),
  getCustomerAnalytics: vi.fn(),
  getOrderAnalytics: vi.fn(),
  getFinancialReport: vi.fn(),
  getRealtimeDashboard: vi.fn(),
};

vi.mock("@makanmasak/database", () => ({
  AnalyticsService: vi.fn(function () {
    return mockDatabaseAnalyticsService;
  }),
}));

vi.mock("../../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function () {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };
  }),
}));

describe("AnalyticsService.generateExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a JSON export from live analytics data", async () => {
    mockDatabaseAnalyticsService.getRevenueAnalytics.mockResolvedValue([
      {
        date: "2024-01-01",
        revenue: 1250.5,
        orderCount: 10,
        averageOrderValue: 125.05,
      },
    ]);

    const service = new AnalyticsService({} as never, {} as never);
    const result = await service.generateExport({
      type: "revenue",
      format: "json",
      restaurantId: "rest-1",
      dateFrom: "2024-01-01",
      dateTo: "2024-01-31",
    });

    expect(
      mockDatabaseAnalyticsService.getRevenueAnalytics,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "rest-1",
        dateFrom: "2024-01-01",
        dateTo: "2024-01-31",
      }),
    );
    expect(result.data.download_url).toMatch(
      /^data:application\/json;charset=utf-8,/,
    );

    const payload = JSON.parse(
      decodeURIComponent(result.data.download_url.split(",", 2)[1]),
    );
    expect(payload.metadata).toMatchObject({
      type: "revenue",
      restaurantId: "rest-1",
      dateFrom: "2024-01-01",
      dateTo: "2024-01-31",
    });
    expect(payload.data).toEqual([
      {
        date: "2024-01-01",
        revenue: 1250.5,
        orderCount: 10,
        averageOrderValue: 125.05,
      },
    ]);
    expect(result.data.filename).toMatch(/^revenue_\d+\.json$/);
    expect(result.data.size_bytes).toBeGreaterThan(0);
  });

  it("generates escaped CSV exports for nested analytics data", async () => {
    mockDatabaseAnalyticsService.getMenuAnalytics.mockResolvedValue({
      popularItems: [
        {
          itemId: 1,
          itemName: 'Nasi "Special", Large',
          categoryName: "Mains",
          quantity: 3,
          revenue: 450,
        },
      ],
      categoryPerformance: [],
      lowPerformingItems: [],
    });

    const service = new AnalyticsService({} as never, {} as never);
    const result = await service.generateExport({
      type: "products",
      format: "csv",
      restaurantId: "rest-1",
    });

    expect(mockDatabaseAnalyticsService.getMenuAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "rest-1" }),
    );
    expect(result.data.download_url).toMatch(/^data:text\/csv;charset=utf-8,/);

    const csv = decodeURIComponent(result.data.download_url.split(",", 2)[1]);
    expect(csv).toContain("section,itemId,itemName,categoryName,quantity");
    expect(csv).toContain('"Nasi ""Special"", Large"');
    expect(result.data.content_type).toBe("text/csv");
    expect(result.data.filename).toMatch(/^products_\d+\.csv$/);
  });
});
