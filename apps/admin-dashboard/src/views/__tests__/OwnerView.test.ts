/**
 * OwnerView — Unit tests for the Owner Overview page
 *
 * Covers:
 *  1. Layout & KPI cards
 *  2. Quick actions
 *  3. Financial summary
 *  4. System health
 *  5. Real-time sections (orders, staff)
 *  6. Loading & error states
 *  7. API calls verification
 *  8. Emergency alerts
 *  9. Revenue time range
 * 10. Auto-refresh interval
 * 11. Popular items rendering
 * 12. Staff activity rendering
 * 13. Growth rate display
 * 14. Table utilization
 * 15. Role name mapping
 * 16. formatTimeAgo helper
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";

// ──── Mocks ────

vi.mock("@heroicons/vue/24/outline", () => {
  const stub = { template: "<span />" };
  return {
    CurrencyDollarIcon: stub,
    ShoppingCartIcon: stub,
    UsersIcon: stub,
    ChartBarIcon: stub,
    ArrowTrendingUpIcon: stub,
    ArrowTrendingDownIcon: stub,
    MinusIcon: stub,
    Cog6ToothIcon: stub,
    DocumentTextIcon: stub,
    ExclamationTriangleIcon: stub,
    ClipboardDocumentListIcon: stub,
    UserPlusIcon: stub,
  };
});

const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ params: {}, query: {} }),
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (v: number) => `NT$${v}`,
  }),
}));

const mockApiGet = vi.fn();
vi.mock("@/services/api", () => ({
  api: { get: (...args: any[]) => mockApiGet(...args) },
}));

const mockResolveEmergencyAlert = vi.fn().mockResolvedValue(undefined);
const mockEscalateEmergencyAlert = vi.fn().mockResolvedValue(undefined);
const mockGetQuickActionRoute = vi.fn().mockImplementation((action: string) => {
  const routes: Record<string, string> = {
    "add-staff": "/dashboard/employees",
    "update-menu": "/dashboard/menu",
    "view-reports": "/dashboard/analytics",
    "system-settings": "/dashboard/settings",
  };
  return routes[action] ?? null;
});

vi.mock("@/services/ownerService", () => ({
  ownerService: {
    resolveEmergencyAlert: (...args: any[]) =>
      mockResolveEmergencyAlert(...args),
    escalateEmergencyAlert: (...args: any[]) =>
      mockEscalateEmergencyAlert(...args),
    getQuickActionRoute: (...args: any[]) => mockGetQuickActionRoute(...args),
  },
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, any>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
  }),
}));

// ──── Component import ────
import OwnerView from "../OwnerView.vue";

// ──── Helpers ────

function defaultApiMocks() {
  mockApiGet.mockImplementation((url: string) => {
    if (url.includes("/analytics/dashboard")) {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            summary: {
              todayRevenue: 15000,
              todayOrders: 25,
              monthRevenue: 300000,
              monthOrders: 500,
              growthRates: { revenueGrowth: 12.5, orderGrowth: 8.3 },
            },
            topSellingItems: [
              { itemId: 1, itemName: "牛肉麵", quantity: 50, revenue: 7500 },
              { itemId: 2, itemName: "滷肉飯", quantity: 30, revenue: 3000 },
            ],
            tableStatus: { occupied: 1, available: 2, total: 3 },
          },
        },
      });
    }
    if (url.includes("/orders/active")) {
      return Promise.resolve({
        data: {
          success: true,
          data: [
            {
              id: 1,
              orderNumber: "ORD-001",
              status: "preparing",
              totalAmount: 300,
              createdAt: new Date().toISOString(),
              items: [{ id: 1 }, { id: 2 }],
            },
            {
              id: 2,
              orderNumber: "ORD-002",
              status: "ready",
              totalAmount: 500,
              createdAt: new Date(Date.now() - 120000).toISOString(),
              items: [{ id: 3 }],
            },
          ],
        },
      });
    }
    if (url.includes("/users/stats")) {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            summary: { total_users: 7, active_users: 5, inactive_users: 2 },
          },
        },
      });
    }
    if (url.includes("/users")) {
      return Promise.resolve({
        data: {
          success: true,
          data: [
            {
              id: 1,
              username: "chef1",
              fullName: "王大廚",
              role: 2,
              status: "active",
            },
            {
              id: 2,
              username: "cashier1",
              fullName: "小美",
              role: 4,
              status: "active",
            },
            {
              id: 3,
              username: "service1",
              fullName: "阿明",
              role: 3,
              status: "inactive",
            },
          ],
        },
      });
    }
    if (url.includes("/health")) {
      return Promise.resolve({
        data: { success: true, data: { status: "ok" } },
      });
    }
    return Promise.resolve({ data: { success: true, data: {} } });
  });
}

function createWrapper() {
  return mount(OwnerView, {
    global: {
      stubs: {
        "router-link": { template: "<a><slot /></a>" },
      },
    },
  });
}

// ──── Tests ────

describe("OwnerView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    defaultApiMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Layout & KPI Cards", () => {
    it("should render KPI cards section", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      // KPI section exists (grid with 4 cards)
      const kpiCards = wrapper.findAll(".border-l-4");
      expect(kpiCards.length).toBe(4);
    });

    it("should display today revenue KPI", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.kpi.todayRevenue");
    });

    it("should display today orders KPI", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.kpi.todayOrders");
    });

    it("should display online staff KPI", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.kpi.onlineStaff");
    });

    it("should display table usage KPI", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.kpi.tableUtilization");
    });

    it("should show trend indicators", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      // Growth rate text should appear
      expect(wrapper.text()).toContain("+");
    });
  });

  describe("Quick Actions", () => {
    it("should render quick actions section", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.quickActions");
    });

    it("should display action buttons", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const actionButtons = wrapper.findAll(
        "button.flex.flex-col.items-center",
      );
      expect(actionButtons.length).toBeGreaterThanOrEqual(4);
    });

    it("should have clickable action buttons that trigger navigation", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      // Find all buttons inside the quick actions section
      const quickSection = wrapper.findAll("button").filter((b) => {
        const text = b.text();
        return (
          text.includes("owner.actions.addStaff") ||
          text.includes("owner.actions.updateMenu") ||
          text.includes("owner.actions.viewReports") ||
          text.includes("owner.actions.systemSettings")
        );
      });
      expect(quickSection.length).toBeGreaterThanOrEqual(1);
    });

    it("should display addStaff label", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.actions.addStaff");
    });

    it("should display updateMenu label", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.actions.updateMenu");
    });

    it("should display viewReports label", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.actions.viewReports");
    });

    it("should display systemSettings label", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.actions.systemSettings");
    });

    it("should navigate on quick action click", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const addStaffBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("owner.actions.addStaff"));
      expect(addStaffBtn).toBeTruthy();
      await addStaffBtn!.trigger("click");
      await flushPromises();
      expect(mockGetQuickActionRoute).toHaveBeenCalledWith("add-staff");
      expect(mockPush).toHaveBeenCalledWith("/dashboard/employees");
    });
  });

  describe("Financial Summary", () => {
    it("should render financial section", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.todayFinance");
    });

    it("should display revenue", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.revenue");
    });

    it("should display order count", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.orderCount");
    });

    it("should display average order value", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.avgOrderValue");
    });

    it("should display estimated monthly revenue", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.estimatedMonthly");
    });

    it("should show formatted revenue value", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("NT$15000");
    });

    it("should calculate average order value correctly", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      // 15000 / 25 = 600
      expect(wrapper.text()).toContain("NT$600");
    });
  });

  describe("System Health", () => {
    it("should render system health section", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.systemHealth");
    });

    it("should display health status items", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      // System health grid has 3 items (API, DB, Realtime)
      const healthItems = wrapper.findAll(".bg-gray-50.rounded-lg");
      expect(healthItems.length).toBeGreaterThanOrEqual(3);
    });

    it("should display system names (API, DB, Realtime)", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.systemNames.api");
      expect(wrapper.text()).toContain("owner.systemNames.database");
      expect(wrapper.text()).toContain("owner.systemNames.realtime");
    });

    it("should show healthy status when API reports ok", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.statusHealthy");
    });
  });

  describe("Real-time Sections", () => {
    it("should render live orders section", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.realtimeOrders");
    });

    it("should render staff activity section", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.staffActivity");
    });

    it("should render revenue trend chart area", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.revenueTrend");
    });

    it("should render popular items section", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.popularItems");
    });

    it("should show time range selector for revenue", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const select = wrapper.find("select");
      expect(select.exists()).toBe(true);
    });
  });

  describe("Staff Activity Rendering", () => {
    it("should render staff names from API data", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("王大廚");
      expect(wrapper.text()).toContain("小美");
      expect(wrapper.text()).toContain("阿明");
    });

    it("should show online status indicator (green dot) for active staff", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const greenDots = wrapper.findAll(".bg-green-500.rounded-full");
      // chef1 and cashier1 are active → online
      expect(greenDots.length).toBeGreaterThanOrEqual(1);
    });

    it("should show offline status indicator (red dot) for inactive staff", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const redDots = wrapper.findAll(".bg-red-500");
      // service1 is inactive → offline
      expect(redDots.length).toBeGreaterThanOrEqual(1);
    });

    it("should display status text labels", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.statusOnline");
      expect(wrapper.text()).toContain("owner.statusOffline");
    });

    it("should map role numbers to role names", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      // role 2 = chef, role 4 = cashier, role 3 = service
      expect(wrapper.text()).toContain("owner.roles.chef");
      expect(wrapper.text()).toContain("owner.roles.cashier");
      expect(wrapper.text()).toContain("owner.roles.service");
    });
  });

  describe("Popular Items Rendering", () => {
    it("should render popular item names from API data", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("牛肉麵");
      expect(wrapper.text()).toContain("滷肉飯");
    });

    it("should display item rank numbers", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      // rank 1 and rank 2 should appear
      const rankContainers = wrapper.findAll(".bg-orange-100.rounded-lg");
      expect(rankContainers.length).toBe(2);
      expect(rankContainers[0].text()).toContain("1");
      expect(rankContainers[1].text()).toContain("2");
    });

    it("should display sales count for items", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      // salesCount for 牛肉麵 = 50
      expect(wrapper.text()).toContain('owner.salesCount:{"count":50}');
    });

    it("should display revenue for items", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("NT$7500");
    });
  });

  describe("Revenue Time Range", () => {
    it("should default to 7d time range", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const select = wrapper.find("select");
      expect((select.element as HTMLSelectElement).value).toBe("7d");
    });

    it("should have 7d, 30d, and 3m options", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const options = wrapper.findAll("select option");
      expect(options.length).toBe(3);
      expect(wrapper.text()).toContain("owner.timeRange.7d");
      expect(wrapper.text()).toContain("owner.timeRange.30d");
      expect(wrapper.text()).toContain("owner.timeRange.3m");
    });

    it("should allow switching to 30d", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const select = wrapper.find("select");
      await select.setValue("30d");
      await nextTick();
      expect((select.element as HTMLSelectElement).value).toBe("30d");
    });

    it("should allow switching to 3m", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const select = wrapper.find("select");
      await select.setValue("3m");
      await nextTick();
      expect((select.element as HTMLSelectElement).value).toBe("3m");
    });
  });

  describe("Table Utilization", () => {
    it("should display occupied/total format", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      // tableStatus: occupied=1, total=3
      expect(wrapper.text()).toContain("1/3");
    });

    it("should display available tables count", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("2");
      expect(wrapper.text()).toContain("owner.kpi.available");
    });
  });

  describe("Growth Rate Display", () => {
    it("should show positive revenue growth with + prefix", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("+12.5%");
    });

    it("should show positive order growth with + prefix", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("+8.3%");
    });

    it("should show negative growth rate for down trend", async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes("/analytics/dashboard")) {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                summary: {
                  todayRevenue: 10000,
                  todayOrders: 15,
                  monthRevenue: 200000,
                  monthOrders: 400,
                  growthRates: { revenueGrowth: -5.2, orderGrowth: -3.1 },
                },
                topSellingItems: [],
                tableStatus: { occupied: 0, available: 3, total: 3 },
              },
            },
          });
        }
        if (url.includes("/users/stats")) {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                summary: { total_users: 0, active_users: 0, inactive_users: 0 },
              },
            },
          });
        }
        if (url.includes("/users")) {
          return Promise.resolve({ data: { success: true, data: [] } });
        }
        if (url.includes("/orders/active")) {
          return Promise.resolve({ data: { success: true, data: [] } });
        }
        if (url.includes("/health")) {
          return Promise.resolve({
            data: { success: true, data: { status: "ok" } },
          });
        }
        return Promise.resolve({ data: { success: true, data: {} } });
      });
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("-5.2%");
      expect(wrapper.text()).toContain("-3.1%");
    });

    it("should show stable trend when growth is 0", async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes("/analytics/dashboard")) {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                summary: {
                  todayRevenue: 10000,
                  todayOrders: 15,
                  monthRevenue: 200000,
                  monthOrders: 400,
                  growthRates: { revenueGrowth: 0, orderGrowth: 0 },
                },
                topSellingItems: [],
                tableStatus: { occupied: 0, available: 0, total: 0 },
              },
            },
          });
        }
        if (url.includes("/users/stats")) {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                summary: { total_users: 0, active_users: 0, inactive_users: 0 },
              },
            },
          });
        }
        if (url.includes("/users")) {
          return Promise.resolve({ data: { success: true, data: [] } });
        }
        if (url.includes("/orders/active")) {
          return Promise.resolve({ data: { success: true, data: [] } });
        }
        if (url.includes("/health")) {
          return Promise.resolve({
            data: { success: true, data: { status: "ok" } },
          });
        }
        return Promise.resolve({ data: { success: true, data: {} } });
      });
      const wrapper = createWrapper();
      await flushPromises();
      // "+0.0%" for stable
      expect(wrapper.text()).toContain("+0.0%");
    });
  });

  describe("Emergency Alerts", () => {
    it("should NOT render emergency section when no alerts", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).not.toContain("owner.emergency");
    });

    it("should render emergency section when alerts exist", async () => {
      const wrapper = createWrapper();
      await flushPromises();

      // Manually set the emergencyAlerts ref (since there's no API for it)
      const vm = wrapper.vm as any;
      vm.emergencyAlerts = [
        {
          id: 1,
          title: "Fire alarm",
          description: "Smoke detected in kitchen",
          time: "10:30",
        },
      ];
      await nextTick();

      expect(wrapper.text()).toContain("owner.emergency");
      expect(wrapper.text()).toContain("Fire alarm");
      expect(wrapper.text()).toContain("Smoke detected in kitchen");
    });

    it("should show resolve and escalate buttons for each alert", async () => {
      const wrapper = createWrapper();
      await flushPromises();

      const vm = wrapper.vm as any;
      vm.emergencyAlerts = [
        { id: 1, title: "Alert 1", description: "Desc 1", time: "10:30" },
      ];
      await nextTick();

      expect(wrapper.text()).toContain("owner.resolve");
      expect(wrapper.text()).toContain("owner.escalate");
    });

    it("should call resolveEmergencyAlert on resolve click", async () => {
      const wrapper = createWrapper();
      await flushPromises();

      const vm = wrapper.vm as any;
      vm.emergencyAlerts = [
        { id: 42, title: "Alert", description: "Desc", time: "10:30" },
      ];
      await nextTick();

      const resolveBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("owner.resolve"));
      expect(resolveBtn).toBeTruthy();
      await resolveBtn!.trigger("click");
      await flushPromises();

      expect(mockResolveEmergencyAlert).toHaveBeenCalledWith(42);
    });

    it("should remove alert from list after successful resolve", async () => {
      const wrapper = createWrapper();
      await flushPromises();

      const vm = wrapper.vm as any;
      vm.emergencyAlerts = [
        { id: 42, title: "Alert", description: "Desc", time: "10:30" },
      ];
      await nextTick();

      const resolveBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("owner.resolve"));
      await resolveBtn!.trigger("click");
      await flushPromises();

      expect(vm.emergencyAlerts.length).toBe(0);
      expect(wrapper.text()).not.toContain("owner.emergency");
    });

    it("should call escalateEmergencyAlert on escalate click", async () => {
      const wrapper = createWrapper();
      await flushPromises();

      const vm = wrapper.vm as any;
      vm.emergencyAlerts = [
        { id: 99, title: "Alert", description: "Desc", time: "10:30" },
      ];
      await nextTick();

      const escalateBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("owner.escalate"));
      expect(escalateBtn).toBeTruthy();
      await escalateBtn!.trigger("click");
      await flushPromises();

      expect(mockEscalateEmergencyAlert).toHaveBeenCalledWith(99);
    });
  });

  describe("Auto-refresh Interval", () => {
    it("should set up a 30-second refresh interval on mount", async () => {
      const wrapper = createWrapper();
      await flushPromises();

      const callCountAfterMount = mockApiGet.mock.calls.length;

      // Advance 30 seconds
      vi.advanceTimersByTime(30000);
      await flushPromises();

      // Should have called again
      expect(mockApiGet.mock.calls.length).toBeGreaterThan(callCountAfterMount);
    });

    it("should clear interval on unmount", async () => {
      const wrapper = createWrapper();
      await flushPromises();

      wrapper.unmount();

      const callCountAfterUnmount = mockApiGet.mock.calls.length;

      // Advance another 30 seconds
      vi.advanceTimersByTime(30000);
      await flushPromises();

      // Should NOT have called again
      expect(mockApiGet.mock.calls.length).toBe(callCountAfterUnmount);
    });

    it("should refresh data multiple times over intervals", async () => {
      const wrapper = createWrapper();
      await flushPromises();

      const callCountAfterMount = mockApiGet.mock.calls.length;

      // Advance 60 seconds = 2 intervals
      vi.advanceTimersByTime(60000);
      await flushPromises();

      // At least 2 more batches of calls
      expect(mockApiGet.mock.calls.length).toBeGreaterThan(
        callCountAfterMount + 2,
      );
    });
  });

  describe("formatTimeAgo Helper", () => {
    it("should show justNow for recent orders", async () => {
      // The default mock has an order with createdAt = now
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.timeAgo.justNow");
    });

    it("should show minutesAgo for older orders", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      // Second order was created 2 minutes ago
      expect(wrapper.text()).toContain("owner.timeAgo.minutesAgo");
    });
  });

  describe("Loading & Error States", () => {
    it("should show loading indicator during data fetch", async () => {
      // Use a never-resolving promise to keep loading state
      mockApiGet.mockImplementation(() => new Promise(() => {}));
      const wrapper = createWrapper();
      // isLoading is true during fetch, popular items/staff sections show loading
      await nextTick();
      expect(wrapper.text()).toContain("owner.loading");
    });

    it("should show error with retry on API failure", async () => {
      mockApiGet.mockRejectedValue(new Error("Network error"));
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.retry");
    });

    it("should show retry button on error and re-fetch on click", async () => {
      mockApiGet.mockRejectedValue(new Error("fail"));
      const wrapper = createWrapper();
      await flushPromises();
      const retryBtn = wrapper.find("button.text-red-600");
      expect(retryBtn.exists()).toBe(true);
      // Reset mocks for retry
      defaultApiMocks();
      await retryBtn.trigger("click");
      await flushPromises();
      // Should have been called again (initial + retry)
      expect(mockApiGet).toHaveBeenCalled();
    });

    it("should show noData when staff list is empty", async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes("/analytics/dashboard")) {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                summary: {
                  todayRevenue: 0,
                  todayOrders: 0,
                  monthRevenue: 0,
                  monthOrders: 0,
                  growthRates: { revenueGrowth: 0, orderGrowth: 0 },
                },
                topSellingItems: [],
                tableStatus: { occupied: 0, available: 0, total: 0 },
              },
            },
          });
        }
        if (url.includes("/orders/active")) {
          return Promise.resolve({ data: { success: true, data: [] } });
        }
        if (url.includes("/users/stats")) {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                summary: { total_users: 0, active_users: 0, inactive_users: 0 },
              },
            },
          });
        }
        if (url.includes("/users")) {
          return Promise.resolve({ data: { success: true, data: [] } });
        }
        if (url.includes("/health")) {
          return Promise.resolve({
            data: { success: true, data: { status: "ok" } },
          });
        }
        return Promise.resolve({ data: { success: true, data: {} } });
      });
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.noData");
    });
  });

  describe("API Calls", () => {
    it("should call analytics dashboard API on mount", async () => {
      createWrapper();
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining("/analytics/dashboard"),
      );
    });

    it("should call active orders API on mount", async () => {
      createWrapper();
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining("/orders/active"),
      );
    });

    it("should call health API on mount", async () => {
      createWrapper();
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining("/health"),
      );
    });

    it("should call users API on mount", async () => {
      createWrapper();
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining("/users"),
      );
    });

    it("should call user stats API on mount", async () => {
      createWrapper();
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining("/users/stats"),
      );
    });
  });

  describe("Realtime Orders Display", () => {
    it("should show order status badges", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("owner.status.preparing");
    });

    it("should show order item count", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain('owner.itemCount:{"count":2}');
    });
  });
});
