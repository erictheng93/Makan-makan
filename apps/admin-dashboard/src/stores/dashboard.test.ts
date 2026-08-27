// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { AxiosHeaders, type AxiosResponse } from "axios";
import { mapDashboardPayload } from "./dashboard";
import { useDashboardStore } from "./dashboard";
import { api } from "@/services/api";

const authState = vi.hoisted(() => ({
  restaurantId: "restaurant-1" as string | null,
  isAuthenticated: true,
}));

vi.mock("./auth", () => ({
  useAuthStore: () => authState,
}));

vi.mock("@/services/api", () => ({
  api: { get: vi.fn() },
}));

vi.mock("@/i18n", () => ({ t: (key: string) => key }));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({ formatPrice: (amount: number) => `NT$${amount}` }),
}));

function axiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  authState.restaurantId = "restaurant-1";
});

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

describe("dashboard analytics charts", () => {
  it("writes each requested chart series into the state consumed by the charts", async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(
        axiosResponse({
          success: true,
          data: [{ date: "2026-08-26", revenue: 320, orderCount: 2 }],
        }),
      )
      .mockResolvedValueOnce(
        axiosResponse({
          success: true,
          data: [{ date: "2026-08-26", revenue: 320, orderCount: 2 }],
        }),
      )
      .mockResolvedValueOnce(
        axiosResponse({
          success: true,
          data: {
            summary: {
              todayRevenue: 320,
              todayOrders: 2,
              monthRevenue: 320,
              monthOrders: 2,
              growthRates: { revenueGrowth: 0, orderGrowth: 0 },
            },
            recentOrders: [],
            topSellingItems: [],
            tableStatus: { occupied: 0, available: 1, total: 1 },
          },
        }),
      );
    const store = useDashboardStore();

    await store.fetchRevenueAnalytics("weekly");
    await store.fetchOrderAnalytics("monthly");
    await store.fetchDashboardStats();

    expect(api.get).toHaveBeenNthCalledWith(
      1,
      "/analytics/revenue?restaurantId=restaurant-1&groupBy=week",
    );
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      "/analytics/revenue?restaurantId=restaurant-1&groupBy=month",
    );
    expect(store.revenueChart).toEqual([{ label: "2026-08-26", value: 320 }]);
    expect(store.ordersChart).toEqual([{ label: "2026-08-26", value: 2 }]);
  });
});

describe("dashboard analytics access errors", () => {
  it("shows module-plan copy instead of a generic permission error", async () => {
    vi.mocked(api.get).mockRejectedValue({
      response: {
        status: 403,
        data: {
          success: false,
          error: { code: "MODULE_NOT_ENABLED", message: "not for display" },
        },
      },
    });

    const store = useDashboardStore();
    await store.fetchDashboardStats();

    expect(store.error).toBe("errors.subscription.moduleNotEnabled");
  });
});
