// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrdersView from "./OrdersView.vue";
import type { Order } from "@/types";

const orderStore = vi.hoisted(() => ({
  orders: [] as Order[],
  error: null as string | null,
  fetchOrders: vi.fn().mockResolvedValue(undefined),
  updateOrderStatus: vi.fn().mockResolvedValue(true),
  cancelOrder: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("vue-toastification", () => ({
  useToast: () => ({ error: vi.fn() }),
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (value: number) => `$${value}`,
  }),
}));

vi.mock("@/composables/useConfirmModal", () => ({
  useConfirmModal: () => ({
    confirm: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock("@/stores/order", () => ({
  useOrderStore: () => orderStore,
}));

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "019fc320-c159-700c-a66c-39c9b98ed964",
  restaurantId: "019f9373-397c-7202-99d6-24c61976f3ff",
  tableId: 2,
  table: { id: 2, number: "A1" },
  orderNumber: "019FA136-CFE3-709F-A2AB-F8A3EBCD31A1-MSBYTLO8-DCV5",
  orderType: "table",
  status: "pending",
  totalAmount: 12000,
  items: [],
  customerInfo: { name: "Test Customer" },
  createdAt: "2026-08-03T10:00:00.000Z",
  updatedAt: "2026-08-03T10:00:00.000Z",
  ...overrides,
});

describe("OrdersView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orderStore.orders = [];
    orderStore.error = null;
  });

  it("renders API order numbers and table numbers, and searches by real order number", async () => {
    orderStore.orders = [makeOrder()];

    const wrapper = mount(OrdersView);

    expect(wrapper.text()).toContain(
      "019FA136-CFE3-709F-A2AB-F8A3EBCD31A1-MSBYTLO8-DCV5",
    );
    expect(wrapper.text()).toContain("A1");

    await wrapper
      .get('[data-testid="admin-orders-search"]')
      .setValue("MSBYTLO8");

    expect(wrapper.text()).toContain(
      "019FA136-CFE3-709F-A2AB-F8A3EBCD31A1-MSBYTLO8-DCV5",
    );
    expect(wrapper.text()).toContain("A1");
  });
});
