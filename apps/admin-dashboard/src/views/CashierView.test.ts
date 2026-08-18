// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CashierView from "./CashierView.vue";
import { api } from "@/services/api";

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: ref("zh-TW") }),
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({ currencySymbol: "$", formatPrice: String }),
}));

vi.mock("@/composables/useDateFormatter", () => ({
  useDateFormatter: () => ({
    formatDateTime: () => "2026-08-18 12:00",
    formatTime: () => "12:00",
  }),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    restaurantId: "restaurant-1",
    user: { id: 7, username: "cashier" },
  }),
}));

vi.mock("@/services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
  unwrapApiList: (payload: unknown) => payload,
  unwrapApiPayload: (payload: unknown) => payload,
}));

describe("CashierView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/orders") {
        return {
          data: {
            success: true,
            data: [
              {
                id: "019fc320-c159-700c-a66c-39c9b98ed964",
                orderNumber: "ORD-206",
                table: { id: 2, number: "A1" },
                customerInfo: { name: "Ada" },
                status: "ready",
                paymentStatus: "pending",
                createdAt: Date.parse("2026-08-18T12:00:00.000Z"),
                subtotal: 100,
                totalAmount: 100,
                items: [],
              },
            ],
          },
        } as never;
      }
      return { data: { success: true, data: [] } } as never;
    });
  });

  it("loads pending orders with their API table and customer fields", async () => {
    const wrapper = mount(CashierView);
    await flushPromises();

    expect(api.get).toHaveBeenCalledWith("/orders", {
      status: "ready,delivered",
      paymentStatus: "pending",
      restaurantId: "restaurant-1",
      limit: 50,
    });
    expect(wrapper.text()).toContain("ORD-206");
    expect(wrapper.text()).toContain("cashier.tableNumber A1");

    await wrapper.find(".cursor-pointer").trigger("click");
    expect(wrapper.text()).toContain("Ada");
  });
});
