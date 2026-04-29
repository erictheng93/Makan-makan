/**
 * AnalyticsView Component Tests
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { resetAllFactories } from "@makanmakan/testing-utils";
import { useAuthStore } from "@/stores/auth";

// ── Mocks (before component import) ──────────────────────────────────────────

// Mock heroicons — return stub components
vi.mock("@heroicons/vue/24/outline", () => {
  const stub = { name: "IconStub", template: "<span />" };
  return {
    CurrencyDollarIcon: stub,
    ShoppingBagIcon: stub,
    CalculatorIcon: stub,
    TableCellsIcon: stub,
    ChartBarIcon: stub,
    DocumentArrowDownIcon: stub,
    ArrowTrendingUpIcon: stub,
    ArrowTrendingDownIcon: stub,
    ClockIcon: stub,
  };
});

// Mock i18n
vi.mock("@/i18n", () => ({
  t: (key: string) => key,
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}`;
      return key;
    },
  }),
}));

// Mock useCurrency
vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (v: number) => `$${v}`,
  }),
}));

// Mock API
const mockApiGet = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

// ── Import component after mocks ─────────────────────────────────────────────

import AnalyticsView from "../AnalyticsView.vue";

// ── Test data ────────────────────────────────────────────────────────────────

function setupSuccessfulApiMocks() {
  mockApiGet.mockImplementation((url: string) => {
    if (url.includes("/analytics/dashboard")) {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            todayRevenue: 5000,
            todayOrders: 50,
            monthRevenue: 100000,
            monthOrders: 1000,
            growthRates: { revenueGrowth: 15.5, orderGrowth: 10.2 },
          },
        },
      });
    }
    if (url.includes("/analytics/performance")) {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            totalOrders: 150,
            completedOrders: 120,
            cancelledOrders: 10,
            averageOrderValue: 350,
            totalRevenue: 52500,
            conversionRate: 0.8,
            averagePreparationTime: 15,
            popularTimeSlots: [
              { hour: 12, orderCount: 30 },
              { hour: 13, orderCount: 25 },
              { hour: 18, orderCount: 35 },
              { hour: 19, orderCount: 28 },
            ],
          },
        },
      });
    }
    if (url.includes("/analytics/products")) {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            popularItems: [
              {
                itemId: 1,
                itemName: "Nasi Lemak",
                categoryName: "Main",
                quantity: 80,
                revenue: 16000,
              },
              {
                itemId: 2,
                itemName: "Roti Canai",
                categoryName: "Bread",
                quantity: 60,
                revenue: 6000,
              },
            ],
          },
        },
      });
    }
    if (url.includes("/analytics/revenue")) {
      return Promise.resolve({
        data: {
          success: true,
          data: [
            {
              date: "2024-03-01",
              revenue: 5000,
              orderCount: 50,
              averageOrderValue: 100,
            },
            {
              date: "2024-03-02",
              revenue: 6000,
              orderCount: 60,
              averageOrderValue: 100,
            },
          ],
        },
      });
    }
    if (url.includes("/analytics/realtime-dashboard")) {
      return Promise.resolve({
        data: {
          success: true,
          data: { tableUtilization: 75 },
        },
      });
    }
    return Promise.resolve({ data: { success: true, data: {} } });
  });
}

function setupFailingApiMocks() {
  mockApiGet.mockRejectedValue(new Error("Network error"));
}

function setupAllRejectedSettled() {
  // Promise.allSettled will mark each as rejected
  mockApiGet.mockImplementation(() => Promise.reject(new Error("API failure")));
}

async function mountAndWait() {
  const wrapper = mount(AnalyticsView);
  await flushPromises();
  return wrapper;
}

function setAuthRestaurantId(id: string | null) {
  const authStore = useAuthStore();
  Object.defineProperty(authStore, "restaurantId", {
    value: id,
    configurable: true,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AnalyticsView Component", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  // ── 1. Component Mounting ──────────────────────────────────────────────────

  describe("Component Mounting", () => {
    it("should mount successfully", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      expect(wrapper.exists()).toBe(true);
    });

    it("should display analytics title", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("analytics.title");
    });

    it('should show period selector with default "today"', async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      const select = wrapper.find("select");
      expect(select.exists()).toBe(true);
      expect((select.element as HTMLSelectElement).value).toBe("today");
    });

    it("should show export button", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("analytics.exportReport");
    });
  });

  // ── 2. Data Loading ───────────────────────────────────────────────────────

  describe("Data Loading", () => {
    it("should fetch all analytics data on mount", async () => {
      setupSuccessfulApiMocks();
      await mountAndWait();
      expect(mockApiGet).toHaveBeenCalled();
    });

    it("should call 5 API endpoints on mount", async () => {
      setupSuccessfulApiMocks();
      await mountAndWait();
      expect(mockApiGet).toHaveBeenCalledTimes(5);
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining("/analytics/dashboard"),
      );
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining("/analytics/performance"),
      );
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining("/analytics/products"),
      );
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining("/analytics/revenue"),
      );
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining("/analytics/realtime-dashboard"),
      );
    });

    it("should scope analytics endpoints to the selected restaurant", async () => {
      setupSuccessfulApiMocks();
      setAuthRestaurantId("rest-1");

      await mountAndWait();

      const calledUrls = mockApiGet.mock.calls.map(([url]) => String(url));
      for (const endpoint of [
        "/analytics/dashboard",
        "/analytics/performance",
        "/analytics/products",
        "/analytics/revenue",
        "/analytics/realtime-dashboard",
      ]) {
        expect(calledUrls.find((url) => url.includes(endpoint))).toContain(
          "restaurantId=rest-1",
        );
      }
    });

    it("should display loading state while fetching", async () => {
      // Use a promise that never resolves so loading stays true
      mockApiGet.mockImplementation(
        () => new Promise(() => {}), // never resolves
      );
      const wrapper = mount(AnalyticsView);
      // Need to wait a tick for onMounted to fire and set isLoading = true
      await wrapper.vm.$nextTick();
      // Loading placeholders show "--"
      expect(wrapper.text()).toContain("--");
      expect(wrapper.text()).toContain("analytics.loading");
    });

    it("should display metrics after data loads", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      // Revenue from performanceData.totalRevenue = 52500
      expect(wrapper.text()).toContain("$52500");
      // Orders from performanceData.totalOrders = 150
      expect(wrapper.text()).toContain("150");
    });
  });

  // ── 3. Metric Cards ──────────────────────────────────────────────────────

  describe("Metric Cards", () => {
    it("should display total revenue", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("analytics.metrics.totalRevenue");
      expect(wrapper.text()).toContain("$52500");
    });

    it("should display total orders", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("analytics.metrics.totalOrders");
      expect(wrapper.text()).toContain("150");
    });

    it("should display average order value", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("analytics.metrics.averageOrderValue");
      expect(wrapper.text()).toContain("$350");
    });

    it("should display table utilization percentage", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("analytics.metrics.tableUtilization");
      expect(wrapper.text()).toContain("75%");
    });

    it("should show trend indicators with percentage", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      // revenueChange = growthRates.revenueGrowth = 15.5
      expect(wrapper.text()).toContain("15.5%");
      // ordersChange = growthRates.orderGrowth = 10.2
      expect(wrapper.text()).toContain("10.2%");
      expect(wrapper.text()).toContain("analytics.metrics.vsPrevious");
    });
  });

  // ── 4. Period Selection ───────────────────────────────────────────────────

  describe("Period Selection", () => {
    it("should change selected period", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      const select = wrapper.find("select");
      await select.setValue("month");
      expect((select.element as HTMLSelectElement).value).toBe("month");
    });

    it("should refetch data when period changes", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      // Clear call count from initial mount
      mockApiGet.mockClear();
      setupSuccessfulApiMocks();

      const select = wrapper.find("select");
      await select.setValue("week");
      await flushPromises();

      // Should have called all 5 endpoints again
      expect(mockApiGet).toHaveBeenCalledTimes(5);
    });
  });

  // ── 5. Revenue Chart ─────────────────────────────────────────────────────

  describe("Revenue Chart", () => {
    it("should display revenue chart data", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("analytics.charts.revenueTrend");
      // Revenue values from mock data
      expect(wrapper.text()).toContain("$5000");
      expect(wrapper.text()).toContain("$6000");
    });

    it("should show date and revenue for each data point", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      // formatDate("2024-03-01") => "3/1"
      expect(wrapper.text()).toContain("3/1");
      expect(wrapper.text()).toContain("3/2");
    });

    it("should show empty state when no revenue data", async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes("/analytics/revenue")) {
          return Promise.resolve({
            data: { success: true, data: [] },
          });
        }
        if (url.includes("/analytics/dashboard")) {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                todayRevenue: 0,
                todayOrders: 0,
                monthRevenue: 0,
                monthOrders: 0,
                growthRates: { revenueGrowth: 0, orderGrowth: 0 },
              },
            },
          });
        }
        if (url.includes("/analytics/performance")) {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                totalOrders: 0,
                completedOrders: 0,
                cancelledOrders: 0,
                averageOrderValue: 0,
                totalRevenue: 0,
                conversionRate: 0,
                averagePreparationTime: 0,
                popularTimeSlots: [],
              },
            },
          });
        }
        if (url.includes("/analytics/products")) {
          return Promise.resolve({
            data: { success: true, data: { popularItems: [] } },
          });
        }
        if (url.includes("/analytics/realtime-dashboard")) {
          return Promise.resolve({
            data: { success: true, data: { tableUtilization: 0 } },
          });
        }
        return Promise.resolve({ data: { success: true, data: {} } });
      });
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("analytics.noData");
    });
  });

  // ── 6. Order Status Distribution ──────────────────────────────────────────

  describe("Order Status Distribution", () => {
    it("should display order status section", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("analytics.charts.orderStatusDist");
    });

    it("should display status counts", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      // completed=120, inProgress=150-120-10=20, pending=0, cancelled=10
      expect(wrapper.text()).toContain("120");
      expect(wrapper.text()).toContain("20");
      expect(wrapper.text()).toContain("10");
    });

    it("should display status labels", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("analytics.orderStatus.delivered");
      expect(wrapper.text()).toContain("analytics.orderStatus.preparing");
      expect(wrapper.text()).toContain("analytics.orderStatus.pending");
      expect(wrapper.text()).toContain("analytics.orderStatus.cancelled");
    });
  });

  // ── 7. Popular Items ─────────────────────────────────────────────────────

  describe("Popular Items", () => {
    it("should display popular items section title", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("analytics.popularItems.title");
    });

    it("should display top menu items with ranking", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      // Rankings: 1 and 2
      expect(wrapper.text()).toContain("1");
      expect(wrapper.text()).toContain("2");
    });

    it("should show item name and order count", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("Nasi Lemak");
      expect(wrapper.text()).toContain("Roti Canai");
      // t() returns the key; orders display via t("analytics.popularItems.ordersCount", { count: 80 })
      expect(wrapper.text()).toContain("analytics.popularItems.ordersCount");
    });

    it("should show item revenue", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("$16000");
      expect(wrapper.text()).toContain("$6000");
    });
  });

  // ── 8. Business Hours ────────────────────────────────────────────────────

  describe("Business Hours", () => {
    it("should display business hours section title", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("analytics.businessHours.title");
    });

    it("should display business hour time slots", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      // Hours 12,13 -> slot 12:00 - 14:00; hours 18,19 -> slot 18:00 - 20:00
      expect(wrapper.text()).toContain("12:00 - 14:00");
      expect(wrapper.text()).toContain("18:00 - 20:00");
    });

    it("should display order counts for business hours", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      // Slot 12:00-14:00 has hours 12 (30) + 13 (25) = 55
      expect(wrapper.text()).toContain("analytics.businessHours.orders");
    });
  });

  // ── 9. Detailed Report Table ──────────────────────────────────────────────

  describe("Detailed Report Table", () => {
    it("should display detailed report title", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("analytics.detailedReport.title");
    });

    it("should display table column headers", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("analytics.detailedReport.date");
      expect(wrapper.text()).toContain("analytics.detailedReport.orders");
      expect(wrapper.text()).toContain("analytics.detailedReport.revenue");
      expect(wrapper.text()).toContain("analytics.detailedReport.averageOrder");
    });

    it("should display daily data rows", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      const table = wrapper.find("table");
      expect(table.exists()).toBe(true);
      // Should have 2 data rows (from revenue mock)
      const rows = table.findAll("tbody tr");
      expect(rows).toHaveLength(2);
    });

    it("should show date, orders, revenue, average order columns", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();
      const table = wrapper.find("table");
      const firstRow = table.find("tbody tr");
      const text = firstRow.text();
      // date: "2024-03-01", orders: 50, revenue: $5000, averageOrder: $100
      expect(text).toContain("2024-03-01");
      expect(text).toContain("50");
      expect(text).toContain("$5000");
      expect(text).toContain("$100");
    });
  });

  // ── 10. Export ────────────────────────────────────────────────────────────

  describe("Export", () => {
    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;
    let originalCreateElement: typeof document.createElement;

    beforeEach(() => {
      originalCreateObjectURL = URL.createObjectURL;
      originalRevokeObjectURL = URL.revokeObjectURL;
      originalCreateElement = document.createElement.bind(document);
    });

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      // Restore createElement without using vi.restoreAllMocks (which can break other things)
      Object.defineProperty(document, "createElement", {
        value: originalCreateElement,
        writable: true,
        configurable: true,
      });
    });

    it("should trigger CSV export when export button clicked", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();

      const mockCreateObjectURL = vi.fn().mockReturnValue("blob:mock-url");
      const mockRevokeObjectURL = vi.fn();
      const mockClick = vi.fn();
      const mockLink = { href: "", download: "", click: mockClick };

      URL.createObjectURL = mockCreateObjectURL;
      URL.revokeObjectURL = mockRevokeObjectURL;
      Object.defineProperty(document, "createElement", {
        value: vi.fn().mockReturnValue(mockLink),
        writable: true,
        configurable: true,
      });

      const exportBtn = wrapper.find("button");
      await exportBtn.trigger("click");
      await flushPromises();

      expect(mockCreateObjectURL).toHaveBeenCalledOnce();
      expect(mockClick).toHaveBeenCalledOnce();
      expect(mockRevokeObjectURL).toHaveBeenCalledOnce();
    });

    it("should create a download link with CSV filename", async () => {
      setupSuccessfulApiMocks();
      const wrapper = await mountAndWait();

      const mockLink = { href: "", download: "", click: vi.fn() };
      URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
      URL.revokeObjectURL = vi.fn();
      Object.defineProperty(document, "createElement", {
        value: vi.fn().mockReturnValue(mockLink),
        writable: true,
        configurable: true,
      });

      const exportBtn = wrapper.find("button");
      await exportBtn.trigger("click");
      await flushPromises();

      expect(mockLink.download).toContain("analytics_today_");
      expect(mockLink.download).toContain(".csv");
    });
  });

  // ── 11. Error Handling ────────────────────────────────────────────────────

  describe("Error Handling", () => {
    it("should display error message when all API calls fail", async () => {
      setupAllRejectedSettled();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("analytics.fetchError");
    });

    it("should show retry button on error", async () => {
      setupAllRejectedSettled();
      const wrapper = await mountAndWait();
      expect(wrapper.text()).toContain("analytics.retry");
    });

    it("should refetch when retry clicked", async () => {
      setupAllRejectedSettled();
      const wrapper = await mountAndWait();

      // Clear and set up success mocks for retry
      mockApiGet.mockClear();
      setupSuccessfulApiMocks();

      // Find and click the retry button (it's the button inside the error div)
      const retryButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("analytics.retry"));
      expect(retryButton).toBeDefined();
      await retryButton!.trigger("click");
      await flushPromises();

      // Should have called all 5 endpoints again
      expect(mockApiGet).toHaveBeenCalledTimes(5);
      // Error should be cleared after successful retry
      expect(wrapper.text()).not.toContain("analytics.fetchError");
    });

    it("should handle partial API failures gracefully", async () => {
      // Only dashboard and performance succeed; others fail
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes("/analytics/dashboard")) {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                todayRevenue: 5000,
                todayOrders: 50,
                monthRevenue: 100000,
                monthOrders: 1000,
                growthRates: { revenueGrowth: 15.5, orderGrowth: 10.2 },
              },
            },
          });
        }
        if (url.includes("/analytics/performance")) {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                totalOrders: 150,
                completedOrders: 120,
                cancelledOrders: 10,
                averageOrderValue: 350,
                totalRevenue: 52500,
                conversionRate: 0.8,
                averagePreparationTime: 15,
                popularTimeSlots: [],
              },
            },
          });
        }
        return Promise.reject(new Error("Partial failure"));
      });

      const wrapper = await mountAndWait();

      // Should not show error since not all failed
      expect(wrapper.text()).not.toContain("analytics.fetchError");
      // Should still display available data
      expect(wrapper.text()).toContain("$52500");
      expect(wrapper.text()).toContain("150");
    });
  });
});
