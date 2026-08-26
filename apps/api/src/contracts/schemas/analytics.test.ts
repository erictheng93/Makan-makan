import { describe, expect, it } from "vitest";
import { DashboardResponse } from "./analytics";

describe("DashboardResponse", () => {
  it("requires the complete owner dashboard payload", () => {
    const response = {
      success: true as const,
      data: {
        summary: {
          todayRevenue: 1250,
          todayOrders: 25,
          monthRevenue: 12_500,
          monthOrders: 250,
          growthRates: { revenueGrowth: 12, orderGrowth: 8 },
        },
        recentOrders: [],
        topSellingItems: [
          {
            itemId: 7,
            itemName: "Nasi Lemak",
            quantity: 4,
            revenue: 800,
          },
        ],
        tableStatus: { occupied: 2, available: 3, total: 5 },
      },
      timestamp: "2026-06-07T12:00:00.000Z",
    };

    expect(DashboardResponse.parse(response)).toEqual(response);
    expect(
      DashboardResponse.safeParse({
        ...response,
        data: response.data.summary,
      }).success,
    ).toBe(false);
  });
});
