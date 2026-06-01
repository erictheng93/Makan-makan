// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformMarketCheckoutsView from "./PlatformMarketCheckoutsView.vue";
import { marketCheckoutsService } from "@/services/marketCheckoutsService";

vi.mock("@/services/marketCheckoutsService", () => ({
  marketCheckoutsService: {
    list: vi.fn(),
    get: vi.fn(),
  },
}));

describe("PlatformMarketCheckoutsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(marketCheckoutsService.list).mockResolvedValue({
      checkouts: [
        {
          id: "checkout-1",
          market: { id: "market-1", slug: "fengjia", name: "逢甲夜市" },
          status: "submitted",
          paymentStatus: "partial_paid",
          subtotal: 24000,
          childOrderCount: 2,
          createdAt: "2026-06-01T10:00:00.000Z",
          updatedAt: "2026-06-01T10:05:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    vi.mocked(marketCheckoutsService.get).mockResolvedValue({
      id: "checkout-1",
      market: { id: "market-1", slug: "fengjia", name: "逢甲夜市" },
      status: "submitted",
      paymentStatus: "partial_paid",
      subtotal: 24000,
      childOrderCount: 2,
      createdAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T10:05:00.000Z",
      childOrders: [
        {
          restaurantId: "restaurant-1",
          restaurantName: "雞排攤",
          orderId: 1001,
          orderNumber: "A001",
          totalAmount: 160,
          tokenExpiresAt: "2026-06-01T14:00:00.000Z",
          status: "preparing",
          paymentStatus: "paid",
        },
        {
          restaurantId: "restaurant-2",
          restaurantName: "甜點攤",
          orderId: 1002,
          orderNumber: "A002",
          totalAmount: 80,
          tokenExpiresAt: "2026-06-01T14:00:00.000Z",
          status: "confirmed",
          paymentStatus: "pending",
        },
      ],
      payment: {
        status: "partial_paid",
        method: "line_pay",
        currency: "TWD",
        country: "TW",
        totalAmount: 240,
        totalAmountCents: 24000,
        paidAmount: 160,
        paidAmountCents: 16000,
        childPayments: [
          {
            restaurantId: "restaurant-1",
            restaurantName: "雞排攤",
            orderId: 1001,
            orderNumber: "A001",
            paymentId: "pay-1",
            status: "paid",
            amount: 160,
            amountCents: 16000,
          },
        ],
      },
    });
  });

  it("lists market checkouts and opens child order details", async () => {
    const wrapper = mount(PlatformMarketCheckoutsView);
    await flushPromises();

    expect(marketCheckoutsService.list).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      marketSlug: "",
      paymentStatus: "",
    });
    expect(wrapper.text()).toContain("逢甲夜市");
    expect(wrapper.text()).toContain("部分付款");
    expect(wrapper.text()).toContain("2 攤");

    await wrapper
      .get('[data-testid="open-checkout-checkout-1"]')
      .trigger("click");
    await flushPromises();

    expect(marketCheckoutsService.get).toHaveBeenCalledWith("checkout-1");
    expect(wrapper.get('[data-testid="checkout-detail"]').text()).toContain(
      "雞排攤",
    );
    expect(wrapper.get('[data-testid="checkout-detail"]').text()).toContain(
      "A001",
    );
    expect(wrapper.get('[data-testid="checkout-detail"]').text()).toContain(
      "已付款 160 / 240",
    );
  });
});
