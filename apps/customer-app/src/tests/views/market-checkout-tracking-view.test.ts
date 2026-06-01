import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketCheckoutTrackingView from "@/views/MarketCheckoutTrackingView.vue";

const routerPush = vi.hoisted(() => vi.fn());
const getMarketCheckout = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

vi.mock("@/services/orderApi", () => ({
  orderApi: {
    getMarketCheckout,
  },
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (amount: number) => `NT$${amount}`,
  }),
}));

function mountView() {
  return mount(MarketCheckoutTrackingView, {
    props: {
      slug: "fengjia",
      checkoutId: "checkout-1",
    },
  });
}

describe("MarketCheckoutTrackingView", () => {
  beforeEach(() => {
    routerPush.mockReset();
    getMarketCheckout.mockReset();
  });

  it("loads and renders a market checkout summary", async () => {
    getMarketCheckout.mockResolvedValueOnce({
      id: "checkout-1",
      market: { id: "market-1", slug: "fengjia", name: "逢甲夜市" },
      status: "submitted",
      childOrders: [
        {
          restaurantId: "restaurant-1",
          restaurantName: "雞排攤",
          orderId: 101,
          orderNumber: "A001",
          totalAmount: 160,
          tokenExpiresAt: "2026-06-01T12:00:00.000Z",
          status: "preparing",
          paymentStatus: "pending",
          updatedAt: 1780308300000,
        },
        {
          restaurantId: "restaurant-2",
          restaurantName: "甜點攤",
          orderId: 102,
          orderNumber: "A002",
          totalAmount: 80,
          tokenExpiresAt: "2026-06-01T12:00:00.000Z",
          status: "ready",
          paymentStatus: "completed",
          updatedAt: 1780308400000,
        },
      ],
      subtotal: 240,
      createdAt: "2026-06-01T10:00:00.000Z",
    });

    const wrapper = mountView();
    await flushPromises();

    expect(getMarketCheckout).toHaveBeenCalledWith("checkout-1");
    const summary = wrapper.get('[data-testid="market-checkout-summary"]');
    expect(summary.text()).toContain("逢甲夜市");
    expect(summary.text()).toContain("已送出");
    expect(summary.text()).toContain("2 攤");
    expect(summary.text()).toContain("NT$240");

    const childOrders = wrapper.findAll(
      '[data-testid="market-checkout-child-order"]',
    );
    expect(childOrders).toHaveLength(2);
    expect(childOrders[0].text()).toContain("雞排攤");
    expect(childOrders[0].text()).toContain("A001");
    expect(childOrders[0].text()).toContain("製作中");
    expect(childOrders[0].text()).toContain("待付款");
    expect(childOrders[0].text()).toContain("NT$160");
    expect(childOrders[1].text()).toContain("可取餐");
    expect(childOrders[1].text()).toContain("已付款");
  });

  it("returns to the market page", async () => {
    getMarketCheckout.mockResolvedValueOnce({
      id: "checkout-1",
      market: { id: "market-1", slug: "fengjia", name: "逢甲夜市" },
      status: "submitted",
      childOrders: [],
      subtotal: 0,
      createdAt: "2026-06-01T10:00:00.000Z",
    });

    const wrapper = mountView();
    await flushPromises();

    await wrapper
      .get('[data-testid="market-checkout-return"]')
      .trigger("click");

    expect(routerPush).toHaveBeenCalledWith("/markets/fengjia");
  });

  it("shows a retry state when checkout loading fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    getMarketCheckout.mockRejectedValueOnce(new Error("Not found"));

    const wrapper = mountView();
    await flushPromises();

    expect(
      wrapper.get('[data-testid="market-checkout-error"]').text(),
    ).toContain("Not found");
    consoleError.mockRestore();
  });
});
