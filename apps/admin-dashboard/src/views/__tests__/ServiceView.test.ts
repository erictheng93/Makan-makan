/**
 * ServiceView — Unit tests for the Service Crew (送菜員) delivery console
 *
 * Covers:
 *  1. Layout & heading
 *  2. Status cards (Ready, Delivering, Delivered, Avg Time)
 *  3. Order list rendering
 *  4. Action buttons (Start Delivery, Confirm Delivery)
 *  5. Filter by table / priority
 *  6. Refresh button
 *  7. Today's delivered count
 *  8. Delivery efficiency percentage
 *  9. Loading / empty states
 * 10. API calls on mount
 * 11. Contact customer dialog
 * 12. Report issue dialog
 * 13. My active deliveries sidebar
 * 14. Today performance stats
 * 15. Today timeline records
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";
import { orderFactory, resetAllFactories } from "@makanmakan/testing-utils";

// ──── Mocks ────

vi.mock("@heroicons/vue/24/outline", () => {
  const stub = { template: "<span />" };
  return {
    ArrowPathIcon: stub,
    TruckIcon: stub,
    MapIcon: stub,
    CheckCircleIcon: stub,
    ClockIcon: stub,
    ExclamationTriangleIcon: stub,
    ExclamationCircleIcon: stub,
    UserIcon: stub,
    XMarkIcon: stub,
  };
});

const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ params: {}, query: {} }),
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, any>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
  }),
}));

const mockApiGet = vi.fn();
const mockApiPut = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    put: (...args: any[]) => mockApiPut(...args),
  },
  // ServiceView also imports unwrapApiData from this module. Mirror the real
  // helper's contract: unwrap { data: { data: T } } → T (or { data: T } → T).
  unwrapApiData: <T>(response: { data: unknown }): T => {
    const payload = response?.data as { data?: T } | T | undefined;
    if (
      payload &&
      typeof payload === "object" &&
      "data" in (payload as object)
    ) {
      return (payload as { data: T }).data;
    }
    return payload as T;
  },
}));

// ──── Component import ────
import ServiceView from "../ServiceView.vue";

// ──── Test data ────

const sampleOrders = [
  {
    ...orderFactory.build({
      overrides: {
        id: 1,
        orderNumber: "ORD-001",
        orderType: "dine_in",
        status: "ready",
        readyAt: new Date(Date.now() - 300000).toISOString() as never,
        deliveredAt: null,
        customerInfo: { name: "Alice", phone: "0912345678" },
      },
    }),
    tableNumber: "A1",
    priority: "high",
    deliveryStartTime: null,
    deliveryNotes: "Extra napkins",
    assignedTo: null,
    items: [{ id: 1, quantity: 2, menuItemName: "牛肉麵" }],
  },
  {
    ...orderFactory.build({
      overrides: {
        id: 2,
        orderNumber: "ORD-002",
        orderType: "dine_in",
        status: "delivering",
        readyAt: new Date(Date.now() - 600000).toISOString() as never,
        deliveredAt: null,
        customerInfo: { name: "Bob", phone: "0987654321" },
      },
    }),
    tableNumber: "B2",
    priority: "normal",
    deliveryStartTime: new Date(Date.now() - 120000).toISOString(),
    deliveryNotes: "",
    assignedTo: "current_user",
    items: [{ id: 2, quantity: 1, menuItemName: "滷肉飯" }],
  },
  {
    ...orderFactory.build({
      overrides: {
        id: 3,
        orderNumber: "ORD-003",
        orderType: "dine_in",
        status: "ready",
        readyAt: new Date(Date.now() - 100000).toISOString() as never,
        deliveredAt: null,
        customerInfo: { name: "Charlie", phone: "" },
      },
    }),
    tableNumber: "A1",
    priority: "normal",
    deliveryStartTime: null,
    deliveryNotes: "",
    assignedTo: null,
    items: [{ id: 3, quantity: 3, menuItemName: "水餃" }],
  },
];

const deliveredOrders = [
  {
    ...orderFactory.build({
      overrides: {
        id: 10,
        orderNumber: "ORD-010",
        status: "delivered",
        deliveredAt: new Date(Date.now() - 3600000).toISOString() as never,
        readyAt: new Date(Date.now() - 4000000).toISOString() as never,
        createdAt: new Date(Date.now() - 4200000).toISOString() as never,
        updatedAt: new Date(Date.now() - 3600000).toISOString() as never,
      },
    }),
    deliveryStartTime: new Date(Date.now() - 3900000).toISOString(),
  },
  {
    ...orderFactory.build({
      overrides: {
        id: 11,
        orderNumber: "ORD-011",
        status: "delivered",
        deliveredAt: new Date(Date.now() - 1800000).toISOString() as never,
        readyAt: new Date(Date.now() - 2200000).toISOString() as never,
        createdAt: new Date(Date.now() - 2400000).toISOString() as never,
        updatedAt: new Date(Date.now() - 1800000).toISOString() as never,
      },
    }),
    deliveryStartTime: new Date(Date.now() - 2100000).toISOString(),
  },
];

// ──── Helpers ────

function defaultApiMocks() {
  mockApiGet.mockImplementation((url: string) => {
    // First call: ready + delivering orders
    if (typeof url === "string" && url === "/orders") {
      // The component calls api.get("/orders", { status: ... }) twice
      // We track call count to differentiate
      return Promise.resolve({ data: { data: sampleOrders } });
    }
    return Promise.resolve({ data: { data: [] } });
  });

  // Use call tracking for two sequential /orders calls
  let orderCallCount = 0;
  mockApiGet.mockImplementation((_url: string, _params?: any) => {
    orderCallCount++;
    if (orderCallCount === 1) {
      // ready + delivering orders
      return Promise.resolve({ data: { data: sampleOrders } });
    }
    if (orderCallCount === 2) {
      // delivered orders (today timeline)
      return Promise.resolve({ data: { data: deliveredOrders } });
    }
    return Promise.resolve({ data: { data: [] } });
  });

  mockApiPut.mockResolvedValue({ data: { success: true } });
}

function emptyApiMocks() {
  mockApiGet.mockResolvedValue({ data: { data: [] } });
}

function createWrapper() {
  return mount(ServiceView, {
    global: {
      stubs: {
        "router-link": { template: "<a><slot /></a>" },
      },
    },
  });
}

// ──── Tests ────

describe("ServiceView", () => {
  beforeEach(() => {
    resetAllFactories();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    defaultApiMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Layout & Heading", () => {
    it("should render the page title", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.title");
    });

    it("should render the subtitle", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.subtitle");
    });

    it("should render the current time section", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.currentTime");
    });
  });

  describe("Status Cards", () => {
    it("should render 4 status cards", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const cards = wrapper.findAll(".border-l-4");
      expect(cards.length).toBe(4);
    });

    it("should display Ready for Delivery card", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.readyForDelivery");
    });

    it("should display Delivering card", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.delivering");
    });

    it("should display Delivered card", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.delivered");
    });

    it("should display Avg Delivery Time card", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.avgDeliveryTime");
    });

    it("should show correct ready count from data", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      // 2 ready orders in sampleOrders
      const orangeCard = wrapper.find(".border-orange-500");
      expect(orangeCard.text()).toContain("2");
    });

    it("should show correct delivering count from data", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      // 1 delivering order in sampleOrders
      const blueCard = wrapper.find(".border-blue-500");
      expect(blueCard.text()).toContain("1");
    });
  });

  describe("Order List Rendering", () => {
    it("should render order numbers in the list", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("ORD-001");
      expect(wrapper.text()).toContain("ORD-002");
    });

    it("should render table numbers for dine-in orders", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      // tableNumber params rendered via i18n key
      expect(wrapper.text()).toContain("serviceView.tableNumber");
    });

    it("should render menu item names", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("牛肉麵");
      expect(wrapper.text()).toContain("滷肉飯");
    });

    it("should render delivery notes when present", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("Extra napkins");
    });

    it("should render customer info", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("Alice");
    });

    it("should show priority badges", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.priority.high");
      expect(wrapper.text()).toContain("serviceView.priority.normal");
    });
  });

  describe("Action Buttons", () => {
    it("should show Start Delivery button for ready orders", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const startButtons = wrapper
        .findAll("button")
        .filter((b) => b.text().includes("serviceView.startDelivery"));
      expect(startButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("should show Confirm Delivery button for delivering orders", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const confirmButtons = wrapper
        .findAll("button")
        .filter((b) => b.text().includes("serviceView.confirmDelivery"));
      expect(confirmButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("should call api.put when Start Delivery is clicked", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const startBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("serviceView.startDelivery"));
      expect(startBtn).toBeTruthy();
      await startBtn!.trigger("click");
      await flushPromises();
      expect(mockApiPut).toHaveBeenCalledWith(
        "/orders/1/status",
        expect.objectContaining({ status: "delivering" }),
      );
    });

    it("should call api.put when Confirm Delivery is clicked", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("serviceView.confirmDelivery"));
      expect(confirmBtn).toBeTruthy();
      await confirmBtn!.trigger("click");
      await flushPromises();
      expect(mockApiPut).toHaveBeenCalledWith(
        "/orders/2/status",
        expect.objectContaining({ status: "delivered" }),
      );
    });

    it("should show Contact Customer button for each order", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const contactButtons = wrapper
        .findAll("button")
        .filter((b) => b.text().includes("serviceView.contactCustomer"));
      // One per filtered order (ready + delivering = 3)
      expect(contactButtons.length).toBe(3);
    });

    it("should show Report Issue button for each order", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const reportButtons = wrapper
        .findAll("button")
        .filter((b) => b.text().includes("serviceView.reportIssue"));
      expect(reportButtons.length).toBe(3);
    });
  });

  describe("Filter by Table / Priority", () => {
    it("should render table filter select", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const selects = wrapper.findAll("select");
      expect(selects.length).toBeGreaterThanOrEqual(2);
    });

    it("should filter orders by table when selected", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const tableSelect = wrapper.findAll("select")[0];
      await tableSelect.setValue("B2");
      await nextTick();
      // Only ORD-002 is at table B2
      const orderItems = wrapper.findAll(".hover\\:bg-gray-50");
      // Check text for ORD-002
      const text = wrapper.text();
      expect(text).toContain("ORD-002");
    });

    it("should filter orders by priority when selected", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const prioritySelect = wrapper.findAll("select")[1];
      await prioritySelect.setValue("high");
      await nextTick();
      // Only ORD-001 is high priority
      const startButtons = wrapper
        .findAll("button")
        .filter((b) => b.text().includes("serviceView.startDelivery"));
      expect(startButtons.length).toBe(1);
    });
  });

  describe("Refresh Button", () => {
    it("should render refresh button", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const refreshBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("serviceView.refresh"));
      expect(refreshBtn).toBeTruthy();
    });

    it("should call API again when refresh is clicked", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      mockApiGet.mockClear();
      defaultApiMocks();
      const refreshBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("serviceView.refresh"));
      await refreshBtn!.trigger("click");
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalled();
    });
  });

  describe("Today's Delivered Count & Efficiency", () => {
    it("should display today delivered count", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.todayDelivered");
      // deliveredOrders has 2 items
      expect(wrapper.text()).toContain("2");
    });

    it("should display delivery efficiency percentage", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.efficiency");
    });

    it("should display efficiency progress bar", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.serviceEfficiency");
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no orders", async () => {
      emptyApiMocks();
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.noOrders");
      expect(wrapper.text()).toContain("serviceView.allDelivered");
    });

    it("should show no active deliveries message when sidebar is empty", async () => {
      emptyApiMocks();
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.noActiveDeliveries");
    });
  });

  describe("API Calls on Mount", () => {
    it("should call api.get for orders on mount", async () => {
      createWrapper();
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalled();
      // First call should be for ready/delivering orders
      expect(mockApiGet).toHaveBeenCalledWith(
        "/orders",
        expect.objectContaining({ status: "ready,delivering" }),
      );
    });

    it("should call api.get for delivered orders on mount", async () => {
      createWrapper();
      await flushPromises();
      // Second call for delivered orders
      expect(mockApiGet).toHaveBeenCalledWith(
        "/orders",
        expect.objectContaining({ status: "delivered" }),
      );
    });
  });

  describe("Contact Customer Dialog", () => {
    it("should open contact dialog when clicking Contact Customer", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const contactBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("serviceView.contactCustomer"));
      await contactBtn!.trigger("click");
      await nextTick();
      expect(wrapper.text()).toContain("serviceView.makeCall");
      expect(wrapper.text()).toContain("serviceView.sendMessage");
    });

    it("should close contact dialog when backdrop is clicked", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const contactBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("serviceView.contactCustomer"));
      await contactBtn!.trigger("click");
      await nextTick();
      // Click the backdrop (opacity-30 overlay)
      const backdrop = wrapper.find(".opacity-30");
      await backdrop.trigger("click");
      await nextTick();
      expect(wrapper.text()).not.toContain("serviceView.makeCall");
    });
  });

  describe("Report Issue Dialog", () => {
    it("should open issue dialog when clicking Report Issue", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const reportBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("serviceView.reportIssue"));
      await reportBtn!.trigger("click");
      await nextTick();
      expect(wrapper.text()).toContain("serviceView.issueType");
      expect(wrapper.text()).toContain("serviceView.issueDescription");
    });

    it("should disable submit button when form is incomplete", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const reportBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("serviceView.reportIssue"));
      await reportBtn!.trigger("click");
      await nextTick();
      const submitBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("serviceView.submitIssue"));
      expect(submitBtn).toBeTruthy();
      expect((submitBtn!.element as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe("My Active Deliveries Sidebar", () => {
    it("should render My Deliveries section title", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.myDeliveries");
    });
  });

  describe("Today Performance Stats", () => {
    it("should render today performance section", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.todayPerformance");
    });

    it("should render completed deliveries stat", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.completedDeliveries");
    });

    it("should render avg time stat", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.avgTime");
    });

    it("should render on-time rate stat", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.onTimeRate");
    });

    it("should render customer rating stat", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.customerRating");
    });
  });

  describe("Today Timeline", () => {
    it("should render timeline section", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("serviceView.todayTimeline");
    });

    it("should render delivery records from API", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("ORD-010");
      expect(wrapper.text()).toContain("ORD-011");
    });
  });
});
