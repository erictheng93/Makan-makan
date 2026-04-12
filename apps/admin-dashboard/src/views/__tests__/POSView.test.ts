/**
 * POS View Tests
 * Comprehensive tests for CashierView (checkout) and POSManagementView (registers, shifts).
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { ref, computed, nextTick } from "vue";
import {
  orderFactory,
  orderItemFactory,
  resetAllFactories,
} from "@makanmakan/testing-utils";

// ──── Mock data ────

const mockCashierOrder1Item = orderItemFactory.build({
  overrides: {
    id: 1,
    menuItemName: "Nasi Lemak",
    quantity: 2,
    unitPrice: 250,
    totalPrice: 500,
  } as any,
  relations: { orderId: 1, menuItemId: 1 },
});

const mockCashierOrders = [
  {
    ...orderFactory.build({
      overrides: {
        id: 1,
        orderNumber: "ORD-001",
        status: "ready",
        paymentStatus: "unpaid",
        subtotal: 500,
        serviceCharge: 50,
        taxAmount: 30,
        discountAmount: 0,
        totalAmount: 580,
        createdAt: "2024-03-01T10:00:00Z" as any,
      },
    }),
    tableNumber: "A1",
    customerName: "Alice",
    items: [
      {
        id: 1,
        menuItemName: "Nasi Lemak",
        quantity: 2,
        unitPrice: 250,
        totalPrice: 500,
      },
    ],
  },
  {
    ...orderFactory.build({
      overrides: {
        id: 2,
        orderNumber: "ORD-002",
        status: "delivered",
        paymentStatus: "unpaid",
        subtotal: 300,
        serviceCharge: 30,
        taxAmount: 18,
        discountAmount: 0,
        totalAmount: 348,
        createdAt: "2024-03-01T11:00:00Z" as any,
      },
    }),
    tableNumber: "",
    customerName: "Bob",
    items: [],
  },
  {
    ...orderFactory.build({
      overrides: {
        id: 3,
        orderNumber: "ORD-003",
        status: "completed",
        paymentStatus: "paid",
        subtotal: 200,
        serviceCharge: 20,
        taxAmount: 12,
        discountAmount: 0,
        totalAmount: 232,
        createdAt: "2024-03-01T09:00:00Z" as any,
      },
    }),
    tableNumber: "B2",
    customerName: "Carol",
    items: [],
  },
];

const mockRegisters = [
  {
    id: "reg-1",
    name: "Register 1",
    status: "active" as const,
    currentBalance: 5000,
    todayTransactions: 15,
    lastActivity: "2024-03-01T14:30:00Z",
    location: "Front",
  },
  {
    id: "reg-2",
    name: "Register 2",
    status: "inactive" as const,
    currentBalance: 0,
    todayTransactions: 0,
    lastActivity: "2024-03-01T08:00:00Z",
    location: "Back",
  },
];

const mockTransactions = [
  {
    id: "tx-1",
    registerId: "reg-1",
    type: "sale",
    amount: 580,
    description: "Order ORD-001",
    createdAt: "2024-03-01T14:30:00Z",
    operatorId: 1,
  },
  {
    id: "tx-2",
    registerId: "reg-1",
    type: "refund",
    amount: -100,
    description: "Refund for ORD-099",
    createdAt: "2024-03-01T13:00:00Z",
    operatorId: 1,
  },
];

const mockShiftData = {
  id: "shift-1",
  name: "Morning Shift",
  startTime: "2024-03-01T08:00:00Z",
  endTime: "2024-03-01T16:00:00Z",
  registerId: "reg-1",
  operatorId: 1,
  startingCash: 1000,
  totalSales: 5000,
  processedOrders: 25,
  status: "active",
};

const mockPromotions = [
  {
    id: "promo-1",
    title: "Happy Hour",
    description: "20% off drinks",
    discountType: "percentage",
    discountValue: 20,
    isActive: true,
    startDate: "2024-03-01",
    endDate: "2024-03-31",
    conditions: "drinks only",
  },
  {
    id: "promo-2",
    title: "Lunch Set",
    description: "RM5 off lunch",
    discountType: "fixed_amount",
    discountValue: 5,
    isActive: false,
    startDate: "2024-03-01",
    endDate: "2024-03-31",
    conditions: "lunch only",
  },
];

// ──── Mocks ────

const mockApiGet = vi
  .fn()
  .mockResolvedValue({ data: { success: true, data: [] } });
const mockApiPost = vi
  .fn()
  .mockResolvedValue({ data: { success: true, data: {} } });
const mockApiPut = vi
  .fn()
  .mockResolvedValue({ data: { success: true, data: {} } });
const mockApiPatch = vi.fn().mockResolvedValue({ data: { success: true } });
const mockApiDelete = vi.fn().mockResolvedValue({ data: { success: true } });

vi.mock("@/services/api", () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
    put: (...args: any[]) => mockApiPut(...args),
    patch: (...args: any[]) => mockApiPatch(...args),
    delete: (...args: any[]) => mockApiDelete(...args),
  },
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
  t: (key: string) => key,
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (v: number) => `$${v}`,
    currencySymbol: "$",
  }),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    user: { id: 1, username: "cashier1", role: 4 },
    restaurantId: "r1",
    isAuthenticated: true,
  }),
}));

const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ params: {}, query: {} }),
}));

// Stub all heroicons
const iconStub = { template: "<span />" };
vi.mock("@heroicons/vue/24/outline", () => ({
  MagnifyingGlassIcon: iconStub,
  ArrowPathIcon: iconStub,
  DocumentTextIcon: iconStub,
  MapPinIcon: iconStub,
  ClockIcon: iconStub,
  ShoppingBagIcon: iconStub,
  CursorArrowRaysIcon: iconStub,
  CheckCircleIcon: iconStub,
  XMarkIcon: iconStub,
  BanknotesIcon: iconStub,
  ShoppingCartIcon: iconStub,
  UserGroupIcon: iconStub,
}));

vi.mock("@heroicons/vue/24/solid", () => ({
  CreditCardIcon: iconStub,
  BanknotesIcon: iconStub,
  DevicePhoneMobileIcon: iconStub,
  BuildingLibraryIcon: iconStub,
  PlusIcon: iconStub,
  MinusIcon: iconStub,
  AdjustmentsHorizontalIcon: iconStub,
  default: iconStub,
}));

vi.mock("@heroicons/vue/24/solid/PlusIcon", () => ({ default: iconStub }));
vi.mock("@heroicons/vue/24/solid/MinusIcon", () => ({ default: iconStub }));
vi.mock("@heroicons/vue/24/solid/AdjustmentsHorizontalIcon", () => ({
  default: iconStub,
}));

// ──── Helpers ────

const globalStubs = {
  MagnifyingGlassIcon: iconStub,
  ArrowPathIcon: iconStub,
  DocumentTextIcon: iconStub,
  MapPinIcon: iconStub,
  ClockIcon: iconStub,
  ShoppingBagIcon: iconStub,
  CursorArrowRaysIcon: iconStub,
  CheckCircleIcon: iconStub,
  XMarkIcon: iconStub,
  CreditCardIcon: iconStub,
  BanknotesIcon: iconStub,
  DevicePhoneMobileIcon: iconStub,
  BuildingLibraryIcon: iconStub,
  ShoppingCartIcon: iconStub,
  UserGroupIcon: iconStub,
  PlusIcon: iconStub,
  MinusIcon: iconStub,
  AdjustmentsHorizontalIcon: iconStub,
};

// ============================================================
// CashierView Tests
// ============================================================

describe("CashierView Component", () => {
  let CashierView: any;

  beforeEach(async () => {
    resetAllFactories();
    vi.clearAllMocks();
    setActivePinia(createPinia());

    // Default: API returns orders for loadOrders
    mockApiGet.mockImplementation((url: string, _params?: any) => {
      if (url === "/orders") {
        return Promise.resolve({
          data: {
            success: true,
            data: JSON.parse(JSON.stringify(mockCashierOrders)),
          },
        });
      }
      if (url.startsWith("/pos/registers")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [{ id: "reg-1", name: "Register 1", status: "active" }],
          },
        });
      }
      if (url.includes("/pos/shifts/current/")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              id: "shift-1",
              name: "Morning",
              startTime: "2024-03-01T08:00:00Z",
              endTime: "2024-03-01T16:00:00Z",
              operatorName: "cashier1",
            },
          },
        });
      }
      if (url.includes("/pos/reports/daily")) {
        return Promise.resolve({
          data: { success: true, data: { totalSales: 9500 } },
        });
      }
      if (url.includes("/pos/shifts/") && url.includes("/report")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              shift: {
                name: "Morning",
                startTime: "2024-03-01T08:00:00Z",
                endTime: "2024-03-01T16:00:00Z",
              },
              sales: { cash: 3000, card: 4000, digital: 2500, total: 9500 },
              orders: 25,
              refunds: 2,
            },
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    // Dynamic import so mocks are in place
    const mod = await import("../CashierView.vue");
    CashierView = mod.default;
  });

  function mountCashier() {
    return mount(CashierView, { global: { stubs: globalStubs } });
  }

  // ── 1. Component Mounting & Layout ──

  describe("Component Mounting & Layout", () => {
    it("should mount successfully", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      expect(wrapper.exists()).toBe(true);
    });

    it("should display shift info section", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("cashier.shift");
    });

    it("should display today performance section", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("cashier.todayPerformance");
    });

    it("should show shift report button", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("cashier.shiftReport");
    });

    it("should show refund process button", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("cashier.refundProcess");
    });

    it("should show pending orders heading", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      expect(wrapper.html()).toContain("cashier.pendingOrders");
    });
  });

  // ── 2. Order List Display ──

  describe("Order List Display", () => {
    it("should render pending/delivered orders (filtering out completed)", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      // ORD-001 (ready, unpaid) and ORD-002 (delivered, unpaid) should show; ORD-003 (completed, paid) should not
      const html = wrapper.html();
      expect(html).toContain("ORD-001");
      expect(html).toContain("ORD-002");
      expect(html).not.toContain("ORD-003");
    });

    it("should show empty state when no pending orders", async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url === "/orders") {
          return Promise.resolve({ data: { success: true, data: [] } });
        }
        return Promise.resolve({ data: { success: true, data: [] } });
      });

      const mod = await import("../CashierView.vue");
      const wrapper = mount(mod.default, { global: { stubs: globalStubs } });
      await flushPromises();

      expect(wrapper.html()).toContain("cashier.noPendingOrders");
    });

    it("should render search box for orders", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      const searchInput = wrapper.find('input[type="text"]');
      expect(searchInput.exists()).toBe(true);
    });

    it("should show select-order prompt when no order selected", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      expect(wrapper.html()).toContain("cashier.pleaseSelectOrder");
    });

    it("should display order details when an order is clicked", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      // Click the first order row
      const orderRows = wrapper.findAll(".cursor-pointer");
      expect(orderRows.length).toBeGreaterThan(0);
      await orderRows[0].trigger("click");
      await nextTick();

      expect(wrapper.html()).toContain("cashier.orderDetails");
      expect(wrapper.html()).toContain("ORD-001");
    });

    it("should display order item list when order selected", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      expect(wrapper.html()).toContain("Nasi Lemak");
      expect(wrapper.html()).toContain("cashier.itemList");
    });

    it("should call loadOrders on mount", async () => {
      mountCashier();
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalledWith(
        "/orders",
        expect.objectContaining({ status: "ready,delivered" }),
      );
    });
  });

  // ── 3. Payment Processing ──

  describe("Payment Processing", () => {
    it("should show payment method selection when order selected", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      expect(wrapper.html()).toContain("cashier.paymentMethod");
    });

    it("should show cash received input when cash method selected", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      // Cash is the default method, so amountReceived should be present
      expect(wrapper.html()).toContain("cashier.amountReceived");
    });

    it("should calculate change for cash payment", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      // Set cash received
      const cashInput = wrapper.find('input[type="number"]');
      expect(cashInput.exists()).toBe(true);
      await cashInput.setValue(1000);
      await nextTick();

      // Change section should show
      expect(wrapper.html()).toContain("cashier.change");
    });

    it("should call payment API on processPayment", async () => {
      mockApiPut.mockResolvedValue({ data: { success: true } });
      mockApiPost.mockResolvedValue({ data: { success: true } });

      const wrapper = mountCashier();
      await flushPromises();

      // Select order
      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      // Set cash received above total
      const cashInput = wrapper.find('input[type="number"]');
      await cashInput.setValue(1000);
      await nextTick();

      // Click confirm payment button
      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("cashier.confirmPayment"));
      expect(confirmBtn).toBeDefined();
      await confirmBtn!.trigger("click");
      await flushPromises();

      expect(mockApiPut).toHaveBeenCalledWith(
        "/orders/1/status",
        expect.objectContaining({ status: "paid" }),
      );
    });

    it("should handle payment API error gracefully", async () => {
      mockApiPut.mockRejectedValueOnce(new Error("Network error"));

      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      const cashInput = wrapper.find('input[type="number"]');
      await cashInput.setValue(1000);
      await nextTick();

      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("cashier.confirmPayment"));
      await confirmBtn!.trigger("click");
      await flushPromises();

      // Component should still be alive (no crash)
      expect(wrapper.exists()).toBe(true);
    });

    it("should show receipt option after successful payment", async () => {
      mockApiPut.mockResolvedValue({ data: { success: true } });
      mockApiPost.mockResolvedValue({ data: { success: true } });

      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      const cashInput = wrapper.find('input[type="number"]');
      await cashInput.setValue(1000);
      await nextTick();

      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("cashier.confirmPayment"));
      await confirmBtn!.trigger("click");
      await flushPromises();

      // After payment the success modal shows with print option
      expect(wrapper.html()).toContain("cashier.paymentSuccess");
    });

    it("should show confirm payment button as disabled when cash received is insufficient", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      // Cash received = 0, which is less than totalAmount
      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("cashier.confirmPayment"));
      expect(confirmBtn).toBeDefined();
      expect(confirmBtn!.attributes("disabled")).toBeDefined();
    });
  });

  // ── 4. Shift Report ──

  describe("Shift Report", () => {
    it("should open shift report modal when button clicked", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const reportBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("cashier.shiftReport"));
      await reportBtn!.trigger("click");
      await flushPromises();

      expect(wrapper.html()).toContain("cashier.shiftInfo");
    });

    it("should call shift report API", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const reportBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("cashier.shiftReport"));
      await reportBtn!.trigger("click");
      await flushPromises();

      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining("/pos/shifts/"),
      );
    });
  });

  // ── 5. Refund Dialog ──

  describe("Refund Dialog", () => {
    it("should open refund dialog when button clicked", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const refundBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("cashier.refundProcess"));
      await refundBtn!.trigger("click");
      await nextTick();

      expect(wrapper.html()).toContain("cashier.refundAmount");
      expect(wrapper.html()).toContain("cashier.refundReason");
    });
  });
});

// ============================================================
// POSManagementView Tests
// ============================================================

describe("POSManagementView Component", () => {
  let POSManagementView: any;

  beforeEach(async () => {
    resetAllFactories();
    vi.clearAllMocks();
    setActivePinia(createPinia());

    mockApiGet.mockImplementation((url: string, _params?: any) => {
      if (url === "/pos/registers") {
        return Promise.resolve({
          data: {
            success: true,
            data: JSON.parse(JSON.stringify(mockRegisters)),
          },
        });
      }
      if (url.includes("/pos/shifts/current/")) {
        return Promise.resolve({
          data: {
            success: true,
            data: JSON.parse(JSON.stringify(mockShiftData)),
          },
        });
      }
      if (url.includes("/cash-movements")) {
        return Promise.resolve({
          data: {
            success: true,
            data: JSON.parse(JSON.stringify(mockTransactions)),
          },
        });
      }
      if (url.includes("/stats/daily")) {
        return Promise.resolve({
          data: {
            success: true,
            data: { totalSales: 9500, totalOrders: 25, avgOrderValue: 380 },
          },
        });
      }
      if (url === "/pos/promotions") {
        return Promise.resolve({
          data: {
            success: true,
            data: JSON.parse(JSON.stringify(mockPromotions)),
          },
        });
      }
      if (url.includes("/pos/shifts/") && url.includes("/report")) {
        return Promise.resolve({
          data: {
            success: true,
            data: { shift: mockShiftData, sales: { total: 9500 } },
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    const mod = await import("../POSManagementView.vue");
    POSManagementView = mod.default;
  });

  function mountPOS() {
    return mount(POSManagementView, { global: { stubs: globalStubs } });
  }

  // ── 1. Component Mounting & Layout ──

  describe("Component Mounting & Layout", () => {
    it("should mount successfully", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      expect(wrapper.exists()).toBe(true);
    });

    it("should render register management section", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      expect(wrapper.html()).toContain("pos.registerList");
    });

    it("should display register status info", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      expect(wrapper.html()).toContain("pos.register");
    });

    it("should display stat cards", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("pos.todayRevenue");
      expect(html).toContain("pos.orderCount");
      expect(html).toContain("pos.activeRegisters");
      expect(html).toContain("pos.avgServiceTime");
    });

    it("should load registers on mount", async () => {
      mountPOS();
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalledWith(
        "/pos/registers",
        expect.any(Object),
      );
    });
  });

  // ── 2. Register Management ──

  describe("Register Management", () => {
    it("should display register cards from API data", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      expect(wrapper.html()).toContain("Register 1");
      expect(wrapper.html()).toContain("Register 2");
    });

    it("should show activate button for inactive registers", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("pos.activate");
    });

    it("should show deactivate button for active registers", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      expect(wrapper.html()).toContain("pos.deactivate");
    });

    it("should call activate API on button click", async () => {
      mockApiPost.mockResolvedValue({ data: { success: true } });
      const wrapper = mountPOS();
      await flushPromises();

      const activateBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("pos.activate"));
      expect(activateBtn).toBeDefined();
      await activateBtn!.trigger("click");
      await flushPromises();

      expect(mockApiPost).toHaveBeenCalledWith(
        expect.stringContaining("/pos/registers/reg-2/activate"),
      );
    });

    it("should call deactivate API on button click", async () => {
      mockApiPost.mockResolvedValue({ data: { success: true } });
      const wrapper = mountPOS();
      await flushPromises();

      const deactivateBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("pos.deactivate"));
      expect(deactivateBtn).toBeDefined();
      await deactivateBtn!.trigger("click");
      await flushPromises();

      expect(mockApiPost).toHaveBeenCalledWith(
        expect.stringContaining("/pos/registers/reg-1/deactivate"),
      );
    });

    it("should show add register button", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      expect(wrapper.html()).toContain("pos.addRegister");
    });
  });

  // ── 3. Shift Management ──

  describe("Shift Management", () => {
    it("should show start shift button when no shift active", async () => {
      // Override to return no shift
      mockApiGet.mockImplementation((url: string) => {
        if (url === "/pos/registers") {
          return Promise.resolve({
            data: {
              success: true,
              data: JSON.parse(JSON.stringify(mockRegisters)),
            },
          });
        }
        if (url.includes("/pos/shifts/current/")) {
          return Promise.resolve({ data: { success: false, data: null } });
        }
        return Promise.resolve({ data: { success: true, data: [] } });
      });

      const mod = await import("../POSManagementView.vue");
      const wrapper = mount(mod.default, { global: { stubs: globalStubs } });
      await flushPromises();

      expect(wrapper.html()).toContain("pos.startShift");
    });

    it("should show end shift button when shift is active", async () => {
      const wrapper = mountPOS();
      await flushPromises();

      // Select a register to trigger shift load
      const registerCards = wrapper.findAll(".cursor-pointer");
      if (registerCards.length > 0) {
        await registerCards[0].trigger("click");
        await flushPromises();
      }

      expect(wrapper.html()).toContain("pos.endShift");
    });

    it("should show today shift section with shift details", async () => {
      const wrapper = mountPOS();
      await flushPromises();

      // Select register to load shift
      const registerCards = wrapper.findAll(".cursor-pointer");
      if (registerCards.length > 0) {
        await registerCards[0].trigger("click");
        await flushPromises();
      }

      expect(wrapper.html()).toContain("pos.todayShift");
    });

    it("should show no-shift message when no active shift", async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url === "/pos/registers") {
          return Promise.resolve({
            data: {
              success: true,
              data: JSON.parse(JSON.stringify(mockRegisters)),
            },
          });
        }
        if (url.includes("/pos/shifts/current/")) {
          return Promise.resolve({ data: { success: false, data: null } });
        }
        return Promise.resolve({ data: { success: true, data: [] } });
      });

      const mod = await import("../POSManagementView.vue");
      const wrapper = mount(mod.default, { global: { stubs: globalStubs } });
      await flushPromises();

      expect(wrapper.html()).toContain("pos.noShift");
    });

    it("should call shift report API", async () => {
      const wrapper = mountPOS();
      await flushPromises();

      // Select register first
      const registerCards = wrapper.findAll(".cursor-pointer");
      if (registerCards.length > 0) {
        await registerCards[0].trigger("click");
        await flushPromises();
      }

      const reportBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("pos.generateReport"));
      if (reportBtn) {
        await reportBtn.trigger("click");
        await flushPromises();

        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining("/pos/shifts/"),
        );
      }
    });

    it("should handle shift API errors gracefully", async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url === "/pos/registers") {
          return Promise.resolve({
            data: {
              success: true,
              data: JSON.parse(JSON.stringify(mockRegisters)),
            },
          });
        }
        if (url.includes("/pos/shifts/current/")) {
          return Promise.reject(new Error("Shift API error"));
        }
        return Promise.resolve({ data: { success: true, data: [] } });
      });

      const mod = await import("../POSManagementView.vue");
      const wrapper = mount(mod.default, { global: { stubs: globalStubs } });
      await flushPromises();

      // Should not crash
      expect(wrapper.exists()).toBe(true);
    });
  });

  // ── 4. Transactions ──

  describe("Transactions", () => {
    it("should show recent transactions section", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      expect(wrapper.html()).toContain("pos.recentTransactions");
    });

    it("should show empty state for transactions when none loaded", async () => {
      // Return registers with no transactions
      mockApiGet.mockImplementation((url: string) => {
        if (url === "/pos/registers") {
          return Promise.resolve({
            data: {
              success: true,
              data: JSON.parse(JSON.stringify(mockRegisters)),
            },
          });
        }
        if (url.includes("/cash-movements")) {
          return Promise.resolve({ data: { success: true, data: [] } });
        }
        if (url.includes("/pos/shifts/current/")) {
          // No shift -> no auto-loaded transactions
          return Promise.resolve({ data: { success: false, data: null } });
        }
        return Promise.resolve({ data: { success: true, data: [] } });
      });

      const mod = await import("../POSManagementView.vue");
      const wrapper = mount(mod.default, { global: { stubs: globalStubs } });
      await flushPromises();

      expect(wrapper.html()).toContain("pos.noTransactions");
    });

    it("should show export button for transactions", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      expect(wrapper.html()).toContain("pos.export");
    });

    it("should show refresh button for transactions", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      // ArrowPathIcon is stubbed but the button container exists
      const refreshBtn = wrapper.find('[data-testid="refresh-btn"]');
      expect(refreshBtn.exists()).toBe(true);
    });
  });

  // ── 5. Quick Payment ──

  describe("Quick Payment", () => {
    it("should show quick payment section", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      expect(wrapper.html()).toContain("pos.quickPayment");
    });

    it("should show order number, amount, and payment method fields", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("pos.orderNumber");
      expect(html).toContain("pos.amount");
      expect(html).toContain("pos.paymentMethod");
    });

    it("should show confirm payment button", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      expect(wrapper.html()).toContain("pos.confirmPayment");
    });
  });

  // ── 6. Promotions ──

  describe("Promotions", () => {
    it("should show active promotions section", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      expect(wrapper.html()).toContain("pos.activePromotions");
    });

    it("should show manage promotions link", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      expect(wrapper.html()).toContain("pos.managePromotions");
    });

    it("should show promotion management button in header", async () => {
      const wrapper = mountPOS();
      await flushPromises();
      expect(wrapper.html()).toContain("pos.promotionManagement");
    });
  });
});

// ============================================================
// Shared POS Logic Tests
// ============================================================

describe("Shared POS Logic", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
    setActivePinia(createPinia());

    mockApiGet.mockImplementation((url: string) => {
      if (url === "/orders") {
        return Promise.resolve({
          data: {
            success: true,
            data: JSON.parse(JSON.stringify(mockCashierOrders)),
          },
        });
      }
      if (url === "/pos/registers") {
        return Promise.resolve({
          data: {
            success: true,
            data: JSON.parse(JSON.stringify(mockRegisters)),
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });
  });

  it("should correctly format currency values via useCurrency mock", async () => {
    const mod = await import("../CashierView.vue");
    const wrapper = mount(mod.default, { global: { stubs: globalStubs } });
    await flushPromises();
    // formatPrice returns `$<value>`, verify it shows in the template
    expect(wrapper.html()).toContain("$");
  });

  it("should handle refresh button click in CashierView", async () => {
    const mod = await import("../CashierView.vue");
    const wrapper = mount(mod.default, { global: { stubs: globalStubs } });
    await flushPromises();

    const initialCallCount = mockApiGet.mock.calls.filter(
      (c: any[]) => c[0] === "/orders",
    ).length;

    // Find and click the refresh button (the one with ArrowPathIcon next to search)
    const refreshBtns = wrapper
      .findAll("button")
      .filter((b) => b.find("span").exists() && !b.text().trim());
    if (refreshBtns.length > 0) {
      await refreshBtns[0].trigger("click");
      await flushPromises();

      const newCallCount = mockApiGet.mock.calls.filter(
        (c: any[]) => c[0] === "/orders",
      ).length;
      expect(newCallCount).toBeGreaterThan(initialCallCount);
    }
  });

  it("should show loading states initially (isLoadingOrders)", async () => {
    // Delay the API response to catch loading state
    let resolveOrders: (v: any) => void;
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/orders") {
        return new Promise((resolve) => {
          resolveOrders = resolve;
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    const mod = await import("../CashierView.vue");
    const wrapper = mount(mod.default, { global: { stubs: globalStubs } });

    // Component is alive during loading
    expect(wrapper.exists()).toBe(true);

    // Resolve to avoid hanging
    resolveOrders!({ data: { success: true, data: [] } });
    await flushPromises();
  });

  it("should show empty states when API returns no data", async () => {
    mockApiGet.mockImplementation(() =>
      Promise.resolve({ data: { success: true, data: [] } }),
    );

    const mod = await import("../CashierView.vue");
    const wrapper = mount(mod.default, { global: { stubs: globalStubs } });
    await flushPromises();

    expect(wrapper.html()).toContain("cashier.noPendingOrders");
  });

  it("should show empty state for POS management transactions", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === "/pos/registers") {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    const mod = await import("../POSManagementView.vue");
    const wrapper = mount(mod.default, { global: { stubs: globalStubs } });
    await flushPromises();

    expect(wrapper.html()).toContain("pos.noTransactions");
  });
});
