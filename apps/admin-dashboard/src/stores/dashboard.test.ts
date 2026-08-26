// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { mapDashboardPayload } from "./dashboard";

describe("mapDashboardPayload", () => {
  it("maps the complete analytics dashboard payload for the legacy dashboard", () => {
    expect(
      mapDashboardPayload({
        summary: {
          todayRevenue: 1250,
          todayOrders: 5,
          monthRevenue: 12_500,
          monthOrders: 50,
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
      }),
    ).toMatchObject({
      todayRevenue: 1250,
      todayOrders: 5,
      averageOrderValue: 250,
      topMenuItems: [{ id: 7, name: "Nasi Lemak", quantity: 4, revenue: 800 }],
    });
  });
});
