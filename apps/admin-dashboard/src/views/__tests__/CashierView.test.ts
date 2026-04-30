/**
 * CashierView Tests
 * Comprehensive tests for the cashier checkout view.
 *
 * Covers:
 *  1. Checkout layout (left panel orders, right panel payment)
 *  2. Pending orders list with search
 *  3. Order selection → details display
 *  4. Payment method selection (cash/card)
 *  5. Cash input → change calculation
 *  6. Coupon/discount application
 *  7. Process payment API call
 *  8. Receipt generation
 *  9. Shift info display
 * 10. Refund dialog
 * 11. Shift report modal
 * 12. Empty pending orders state
 * 13. Payment validation (insufficient amount)
 * 14. Post-payment order list refresh
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";
import {
  orderFactory,
  orderItemFactory,
  resetAllFactories,
} from "@makanmakan/testing-utils";

// ──── Mock data ────

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
        createdAt: "2024-03-01T10:00:00Z" as never,
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
        createdAt: "2024-03-01T11:00:00Z" as never,
      },
    }),
    tableNumber: "",
    customerName: "Bob",
    items: [
      {
        id: 2,
        menuItemName: "Roti Canai",
        quantity: 3,
        unitPrice: 100,
        totalPrice: 300,
      },
    ],
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
        createdAt: "2024-03-01T09:00:00Z" as never,
      },
    }),
    tableNumber: "B2",
    customerName: "Carol",
    items: [],
  },
];

// ──── Mocks ────

const mockApiGet = vi.fn();
const mockApiPost = vi
  .fn()
  .mockResolvedValue({ data: { success: true, data: {} } });
const mockApiPut = vi
  .fn()
  .mockResolvedValue({ data: { success: true, data: {} } });

vi.mock("@/services/api", () => {
  const unwrapApiPayload = (payload: unknown) =>
    typeof payload === "object" && payload !== null && "data" in payload
      ? (payload as { data: unknown }).data
      : payload;

  return {
    api: {
      get: (...args: any[]) => mockApiGet(...args),
      post: (...args: any[]) => mockApiPost(...args),
      put: (...args: any[]) => mockApiPut(...args),
    },
    unwrapApiPayload,
    unwrapApiData: (response: { data: unknown }) =>
      unwrapApiPayload(response.data),
    unwrapApiList: (payload: unknown) => {
      const data = unwrapApiPayload(payload);
      return Array.isArray(data) ? data : [];
    },
  };
});

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, any>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
  }),
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
vi.mock("@heroicons/vue/24/outline", () => {
  const s = { template: "<span />" };
  return {
    MagnifyingGlassIcon: s,
    ArrowPathIcon: s,
    DocumentTextIcon: s,
    MapPinIcon: s,
    ClockIcon: s,
    ShoppingBagIcon: s,
    CursorArrowRaysIcon: s,
    CheckCircleIcon: s,
    XMarkIcon: s,
  };
});

vi.mock("@heroicons/vue/24/solid", () => {
  const s = { template: "<span />" };
  return {
    CreditCardIcon: s,
    BanknotesIcon: s,
    DevicePhoneMobileIcon: s,
    BuildingLibraryIcon: s,
  };
});

// ──── Helpers ────

const iconStub = { template: "<span />" };
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
};

function setupDefaultApiMocks() {
  mockApiGet.mockImplementation((url: string) => {
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
            startTime: "08:00",
            endTime: "16:00",
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
            shift: { name: "Morning", startTime: "08:00", endTime: "16:00" },
            sales: { cash: 3000, card: 4000, digital: 2500, total: 9500 },
            orders: 25,
            refunds: 2,
          },
        },
      });
    }
    return Promise.resolve({ data: { success: true, data: [] } });
  });
}

// ──── Component import (dynamic to apply mocks) ────

import CashierView from "../CashierView.vue";

function mountCashier() {
  return mount(CashierView, { global: { stubs: globalStubs } });
}

// ──── Tests ────

describe("CashierView", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
    setActivePinia(createPinia());
    setupDefaultApiMocks();
  });

  // ── 1. Checkout Layout ──

  describe("Checkout Layout", () => {
    it("should mount successfully", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      expect(wrapper.exists()).toBe(true);
    });

    it("should display shift info section", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      expect(wrapper.text()).toContain("cashier.shift");
    });

    it("should display today performance section", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      expect(wrapper.text()).toContain("cashier.todayPerformance");
    });

    it("should show shift report button", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      expect(wrapper.text()).toContain("cashier.shiftReport");
    });

    it("should show refund process button", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      expect(wrapper.text()).toContain("cashier.refundProcess");
    });

    it("should show pending orders heading (left panel)", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      expect(wrapper.text()).toContain("cashier.pendingOrders");
    });

    it("should show select-order prompt in right panel initially", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      expect(wrapper.text()).toContain("cashier.pleaseSelectOrder");
    });

    it("should display today revenue formatted value", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      expect(wrapper.text()).toContain("$9500");
    });
  });

  // ── 2. Pending Orders List ──

  describe("Pending Orders List", () => {
    it("should render pending/delivered orders (filtering out completed)", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("ORD-001");
      expect(html).toContain("ORD-002");
      expect(html).not.toContain("ORD-003");
    });

    it("should show search box for orders", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      const searchInput = wrapper.find('input[type="text"]');
      expect(searchInput.exists()).toBe(true);
    });

    it("should filter orders by search query (order number)", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("ORD-001");
      await nextTick();

      expect(wrapper.text()).toContain("ORD-001");
      // ORD-002 should be filtered out
      const orderRows = wrapper.findAll(".cursor-pointer");
      expect(orderRows.length).toBe(1);
    });

    it("should filter orders by table number search", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("A1");
      await nextTick();

      expect(wrapper.text()).toContain("ORD-001");
    });

    it("should filter orders by customer name search", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("Bob");
      await nextTick();

      expect(wrapper.text()).toContain("ORD-002");
    });

    it("should display order total amount", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      expect(wrapper.text()).toContain("$580");
      expect(wrapper.text()).toContain("$348");
    });

    it("should show item count per order", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      expect(wrapper.text()).toContain('cashier.itemCount:{"count":1}');
    });

    it("should show refresh button", async () => {
      const wrapper = mountCashier();
      await flushPromises();
      // Refresh button contains ArrowPathIcon stub
      const buttons = wrapper.findAll("button");
      const refreshBtn = buttons.find(
        (b) => b.find("span").exists() && b.text().trim() === "",
      );
      expect(refreshBtn).toBeTruthy();
    });
  });

  // ── 3. Empty Orders State ──

  describe("Empty Orders State", () => {
    it("should show empty state when no pending orders", async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url === "/orders") {
          return Promise.resolve({ data: { success: true, data: [] } });
        }
        return Promise.resolve({ data: { success: true, data: [] } });
      });

      const wrapper = mountCashier();
      await flushPromises();

      expect(wrapper.text()).toContain("cashier.noPendingOrders");
      expect(wrapper.text()).toContain("cashier.allOrdersCompleted");
    });
  });

  // ── 4. Order Selection → Details ──

  describe("Order Selection", () => {
    it("should display order details when an order is clicked", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      expect(orderRows.length).toBeGreaterThan(0);
      await orderRows[0].trigger("click");
      await nextTick();

      expect(wrapper.text()).toContain("cashier.orderDetails");
      expect(wrapper.text()).toContain("ORD-001");
    });

    it("should show order items in detail panel", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      expect(wrapper.text()).toContain("Nasi Lemak");
      expect(wrapper.text()).toContain("x2");
    });

    it("should show order breakdown (subtotal, service, tax, total)", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      expect(wrapper.text()).toContain("cashier.subtotal");
      expect(wrapper.text()).toContain("$500");
      expect(wrapper.text()).toContain("cashier.serviceCharge");
      expect(wrapper.text()).toContain("$50");
      expect(wrapper.text()).toContain("cashier.tax");
      expect(wrapper.text()).toContain("$30");
      expect(wrapper.text()).toContain("cashier.total");
      expect(wrapper.text()).toContain("$580");
    });

    it("should highlight selected order row", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      // Selected order gets bg-blue-50 + border-l-4 classes
      const selectedRow = wrapper.find(".bg-blue-50.border-l-4");
      expect(selectedRow.exists()).toBe(true);
    });

    it("should show table number or takeaway for selected order", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      expect(wrapper.text()).toContain("cashier.tableNumber");
      expect(wrapper.text()).toContain("A1");
    });
  });

  // ── 5. Payment Method Selection ──

  describe("Payment Method Selection", () => {
    it("should show payment method buttons when order is selected", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      expect(wrapper.text()).toContain("cashier.paymentMethod");
      expect(wrapper.text()).toContain("cashier.paymentMethods.cash");
      expect(wrapper.text()).toContain("cashier.paymentMethods.card");
    });

    it("should default to cash payment method", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      // Cash button should be selected
      const cashBtn = wrapper
        .findAll(".border-2")
        .find(
          (b) =>
            b.text().includes("cashier.paymentMethods.cash") &&
            b.attributes("data-selected") === "true",
        );
      expect(cashBtn).toBeTruthy();
    });

    it("should show cash input when cash method selected", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      expect(wrapper.text()).toContain("cashier.amountReceived");
      const numberInput = wrapper.find('input[type="number"]');
      expect(numberInput.exists()).toBe(true);
    });

    it("should switch payment method on button click", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      // Click card payment method
      const paymentBtns = wrapper.findAll(".border-2");
      const cardBtn = paymentBtns.find((b) =>
        b.text().includes("cashier.paymentMethods.card"),
      );
      expect(cardBtn).toBeTruthy();
      await cardBtn!.trigger("click");
      await nextTick();

      // Card button should now be selected
      expect(cardBtn!.attributes("data-selected")).toBe("true");
    });
  });

  // ── 6. Cash Input & Change Calculation ──

  describe("Cash Input & Change Calculation", () => {
    it("should calculate change when cash received exceeds total", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      // Enter cash amount
      const numberInput = wrapper.find('input[type="number"]');
      await numberInput.setValue(600);
      await nextTick();

      // Change = 600 - 580 = 20
      expect(wrapper.text()).toContain("cashier.change");
      expect(wrapper.text()).toContain("$20");
    });

    it("should show negative change (red) when insufficient cash", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      const numberInput = wrapper.find('input[type="number"]');
      await numberInput.setValue(500);
      await nextTick();

      // Change = 500 - 580 = -80
      expect(wrapper.text()).toContain("cashier.change");
      expect(wrapper.text()).toContain("$-80");
    });

    it("should show amount due and received", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      const numberInput = wrapper.find('input[type="number"]');
      await numberInput.setValue(600);
      await nextTick();

      expect(wrapper.text()).toContain("cashier.amountDue");
      expect(wrapper.text()).toContain("cashier.received");
      expect(wrapper.text()).toContain("$600");
    });
  });

  // ── 7. Payment Validation ──

  describe("Payment Validation", () => {
    it("should disable confirm payment button when cash is insufficient", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      // cashReceived = 0, totalAmount = 580
      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.confirmPayment");
      expect(confirmBtn).toBeTruthy();
      expect(confirmBtn!.attributes("disabled")).toBeDefined();
    });

    it("should enable confirm payment button when cash is sufficient", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      const numberInput = wrapper.find('input[type="number"]');
      await numberInput.setValue(580);
      await nextTick();

      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.confirmPayment");
      expect(confirmBtn).toBeTruthy();
      expect(confirmBtn!.attributes("disabled")).toBeUndefined();
    });

    it("should enable confirm for card payment without cash input", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      // Switch to card
      const paymentBtns = wrapper.findAll(".border-2");
      const cardBtn = paymentBtns.find((b) =>
        b.text().includes("cashier.paymentMethods.card"),
      );
      await cardBtn!.trigger("click");
      await nextTick();

      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.confirmPayment");
      expect(confirmBtn!.attributes("disabled")).toBeUndefined();
    });
  });

  // ── 8. Process Payment ──

  describe("Process Payment", () => {
    it("should call order status update API on payment", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      const numberInput = wrapper.find('input[type="number"]');
      await numberInput.setValue(600);
      await nextTick();

      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.confirmPayment");
      await confirmBtn!.trigger("click");
      await flushPromises();

      expect(mockApiPut).toHaveBeenCalledWith("/orders/1/status", {
        status: "paid",
      });
    });

    it("should show payment success modal after successful payment", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      const numberInput = wrapper.find('input[type="number"]');
      await numberInput.setValue(600);
      await nextTick();

      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.confirmPayment");
      await confirmBtn!.trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("cashier.paymentSuccess");
    });

    it("should show print receipt button in success modal", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      const numberInput = wrapper.find('input[type="number"]');
      await numberInput.setValue(600);
      await nextTick();

      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.confirmPayment");
      await confirmBtn!.trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("cashier.printReceipt");
      expect(wrapper.text()).toContain("cashier.done");
    });

    it("should clear selected order after payment", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      const numberInput = wrapper.find('input[type="number"]');
      await numberInput.setValue(600);
      await nextTick();

      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.confirmPayment");
      await confirmBtn!.trigger("click");
      await flushPromises();

      // Close success modal
      const doneBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.done");
      await doneBtn!.trigger("click");
      await nextTick();

      // Should show select order prompt again
      expect(wrapper.text()).toContain("cashier.pleaseSelectOrder");
    });
  });

  // ── 9. Discount Application ──

  describe("Discount Application", () => {
    it("should show apply discount button when order selected", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      expect(wrapper.text()).toContain("cashier.applyDiscount");
    });

    it("should open discount modal on applyDiscount click", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      const discountBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.applyDiscount");
      await discountBtn!.trigger("click");
      await nextTick();

      // Discount modal shows percentage input
      expect(wrapper.text()).toContain("cashier.applyDiscount");
    });
  });

  // ── 10. Print Receipt ──

  describe("Print Receipt", () => {
    it("should show print receipt button when order selected", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const orderRows = wrapper.findAll(".cursor-pointer");
      await orderRows[0].trigger("click");
      await nextTick();

      expect(wrapper.text()).toContain("cashier.printReceipt");
    });
  });

  // ── 11. Shift Info Display ──

  describe("Shift Info Display", () => {
    it("should load shift name from API", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      expect(wrapper.text()).toContain("Morning");
    });

    it("should show shift time range", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      expect(wrapper.text()).toContain("08:00");
      expect(wrapper.text()).toContain("16:00");
    });
  });

  // ── 12. Shift Report Modal ──

  describe("Shift Report Modal", () => {
    it("should open shift report modal on button click", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const shiftReportBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.shiftReport");
      expect(shiftReportBtn).toBeTruthy();
      await shiftReportBtn!.trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("cashier.shiftInfo");
      expect(wrapper.text()).toContain("cashier.revenueTotal");
    });

    it("should show transaction details in shift report", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const shiftReportBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.shiftReport");
      await shiftReportBtn!.trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("cashier.totalOrders");
      expect(wrapper.text()).toContain("cashier.avgOrderValue");
      expect(wrapper.text()).toContain("cashier.refundCount");
    });

    it("should show cash count section in shift report", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const shiftReportBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.shiftReport");
      await shiftReportBtn!.trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("cashier.cashCount");
      expect(wrapper.text()).toContain("cashier.systemAmount");
      expect(wrapper.text()).toContain("cashier.actualAmount");
    });

    it("should close shift report on close button click", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const shiftReportBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.shiftReport");
      await shiftReportBtn!.trigger("click");
      await flushPromises();

      const closeBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "common.close");
      expect(closeBtn).toBeTruthy();
      await closeBtn!.trigger("click");
      await nextTick();

      // Modal should be closed
      expect(wrapper.text()).not.toContain("cashier.shiftInfo");
    });
  });

  // ── 13. Refund Dialog ──

  describe("Refund Dialog", () => {
    it("should open refund dialog on button click", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const refundBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.refundProcess");
      expect(refundBtn).toBeTruthy();
      await refundBtn!.trigger("click");
      await nextTick();

      expect(wrapper.text()).toContain("cashier.orderNumber");
      expect(wrapper.text()).toContain("cashier.refundAmount");
      expect(wrapper.text()).toContain("cashier.refundReason");
    });

    it("should disable confirm refund when form is incomplete", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const refundBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.refundProcess");
      await refundBtn!.trigger("click");
      await nextTick();

      const confirmRefundBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.confirmRefund");
      expect(confirmRefundBtn).toBeTruthy();
      expect(confirmRefundBtn!.attributes("disabled")).toBeDefined();
    });

    it("should close refund dialog on cancel", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const refundBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "cashier.refundProcess");
      await refundBtn!.trigger("click");
      await nextTick();

      const cancelBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "common.cancel");
      expect(cancelBtn).toBeTruthy();
      await cancelBtn!.trigger("click");
      await nextTick();

      // Dialog should be closed
      expect(wrapper.text()).not.toContain("cashier.refundAmount");
    });
  });

  // ── 14. Refresh Button ──

  describe("Refresh Button", () => {
    it("should reload orders when refresh button is clicked", async () => {
      const wrapper = mountCashier();
      await flushPromises();

      const initialCallCount = mockApiGet.mock.calls.filter(
        (c) => c[0] === "/orders",
      ).length;

      // Click refresh button (icon-only button in header)
      const buttons = wrapper.findAll("button");
      const refreshBtn = buttons.find(
        (b) => b.find("span").exists() && b.text().trim() === "",
      );
      expect(refreshBtn).toBeTruthy();
      await refreshBtn!.trigger("click");
      await flushPromises();

      const newCallCount = mockApiGet.mock.calls.filter(
        (c) => c[0] === "/orders",
      ).length;
      expect(newCallCount).toBe(initialCallCount + 1);
    });
  });

  // ── 15. API Calls on Mount ──

  describe("API Calls on Mount", () => {
    it("should call orders API on mount", async () => {
      mountCashier();
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalledWith("/orders", expect.any(Object));
    });

    it("should call POS registers API on mount", async () => {
      mountCashier();
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalledWith(
        "/pos/registers",
        expect.any(Object),
      );
    });

    it("should call daily report API on mount", async () => {
      mountCashier();
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalledWith(
        "/pos/reports/daily",
        expect.any(Object),
      );
    });
  });
});
