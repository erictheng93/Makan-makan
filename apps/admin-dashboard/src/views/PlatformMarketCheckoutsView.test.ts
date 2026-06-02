// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformMarketCheckoutsView from "./PlatformMarketCheckoutsView.vue";
import { marketCheckoutsService } from "@/services/marketCheckoutsService";

vi.mock("@/services/marketCheckoutsService", () => ({
  marketCheckoutsService: {
    list: vi.fn(),
    get: vi.fn(),
    summary: vi.fn(),
    vendors: vi.fn(),
    exportCsv: vi.fn(),
    exportVendorsCsv: vi.fn(),
    refund: vi.fn(),
  },
}));

describe("PlatformMarketCheckoutsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:market-checkouts"),
        revokeObjectURL: vi.fn(),
      }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(vi.fn());
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
    vi.mocked(marketCheckoutsService.summary).mockResolvedValue({
      totalCheckouts: 2,
      totalSubtotalCents: 32000,
      paidAmountCents: 16000,
      refundedAmountCents: 8000,
      netPaidAmountCents: 8000,
      averageCheckoutCents: 16000,
      childOrderCount: 3,
      paymentStatusCounts: {
        pending: 0,
        partial_paid: 1,
        paid: 0,
        failed: 1,
        refunded: 0,
        partial_refunded: 0,
      },
      topMarkets: [
        {
          id: "market-1",
          slug: "fengjia",
          name: "逢甲夜市",
          checkoutCount: 2,
          subtotalCents: 32000,
          paidAmountCents: 16000,
          refundedAmountCents: 8000,
        },
      ],
    });
    vi.mocked(marketCheckoutsService.vendors).mockResolvedValue({
      vendors: [
        {
          restaurantId: "restaurant-1",
          restaurantName: "雞排攤",
          checkoutCount: 2,
          childOrderCount: 2,
          subtotalCents: 24000,
          paidAmountCents: 24000,
          refundedAmountCents: 8000,
          netPaidAmountCents: 16000,
          refundedPaymentCount: 1,
          failedPaymentCount: 0,
        },
      ],
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
        settlement: {
          platformFeeRateBps: 350,
          platformFeeCents: 560,
          vendorNetAmountCents: 15440,
          vendorAllocations: [
            {
              restaurantId: "restaurant-1",
              restaurantName: "雞排攤",
              orderId: 1001,
              orderNumber: "A001",
              grossAmountCents: 16000,
              refundedAmountCents: 0,
              platformFeeCents: 560,
              netAmountCents: 15440,
            },
            {
              restaurantId: "restaurant-2",
              restaurantName: "甜點攤",
              orderId: 1002,
              orderNumber: "A002",
              grossAmountCents: 0,
              refundedAmountCents: 0,
              platformFeeCents: 0,
              netAmountCents: 0,
            },
          ],
        },
      },
    });
    vi.mocked(marketCheckoutsService.exportCsv).mockResolvedValue(
      new Blob(["checkout_id\ncheckout-1"], { type: "text/csv" }),
    );
    vi.mocked(marketCheckoutsService.exportVendorsCsv).mockResolvedValue(
      new Blob(["restaurant_id\nrestaurant-1"], { type: "text/csv" }),
    );
    vi.mocked(marketCheckoutsService.refund).mockResolvedValue({
      id: "checkout-1",
      market: { id: "market-1", slug: "fengjia", name: "逢甲夜市" },
      status: "submitted",
      paymentStatus: "refunded",
      subtotal: 24000,
      childOrderCount: 2,
      createdAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T10:05:00.000Z",
      childOrders: [],
      payment: {
        status: "refunded",
        method: "line_pay",
        currency: "TWD",
        country: "TW",
        totalAmount: 240,
        totalAmountCents: 24000,
        paidAmount: 160,
        paidAmountCents: 16000,
        refundedAmount: 160,
        refundedAmountCents: 16000,
        childPayments: [],
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
      dateFrom: "",
      dateTo: "",
    });
    expect(marketCheckoutsService.summary).toHaveBeenCalledWith({
      marketSlug: "",
      paymentStatus: "",
      dateFrom: "",
      dateTo: "",
    });
    expect(marketCheckoutsService.vendors).toHaveBeenCalledWith({
      marketSlug: "",
      paymentStatus: "",
      dateFrom: "",
      dateTo: "",
    });
    expect(wrapper.text()).toContain("逢甲夜市");
    expect(wrapper.text()).toContain("部分付款");
    expect(wrapper.text()).toContain("2 攤");
    expect(wrapper.get('[data-testid="checkout-summary"]').text()).toContain(
      "GMV",
    );
    expect(wrapper.get('[data-testid="checkout-summary"]').text()).toContain(
      "$320",
    );
    expect(wrapper.get('[data-testid="checkout-summary"]').text()).toContain(
      "異常",
    );
    expect(wrapper.get('[data-testid="vendor-settlements"]').text()).toContain(
      "雞排攤",
    );
    expect(wrapper.get('[data-testid="vendor-settlements"]').text()).toContain(
      "$160",
    );

    await wrapper
      .get('[data-testid="market-checkout-date-from"]')
      .setValue("2026-06-01");
    await wrapper
      .get('[data-testid="market-checkout-date-to"]')
      .setValue("2026-06-02");
    await wrapper
      .get('[data-testid="market-checkout-filter"]')
      .trigger("click");
    await flushPromises();

    expect(marketCheckoutsService.list).toHaveBeenLastCalledWith({
      page: 1,
      limit: 20,
      marketSlug: "",
      paymentStatus: "",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-02",
    });
    expect(marketCheckoutsService.summary).toHaveBeenLastCalledWith({
      marketSlug: "",
      paymentStatus: "",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-02",
    });
    expect(marketCheckoutsService.vendors).toHaveBeenLastCalledWith({
      marketSlug: "",
      paymentStatus: "",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-02",
    });

    await wrapper.get('[data-testid="export-checkouts"]').trigger("click");
    await flushPromises();

    expect(marketCheckoutsService.exportCsv).toHaveBeenCalledWith({
      marketSlug: "",
      paymentStatus: "",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-02",
    });

    await wrapper
      .get('[data-testid="export-vendor-settlements"]')
      .trigger("click");
    await flushPromises();

    expect(marketCheckoutsService.exportVendorsCsv).toHaveBeenCalledWith({
      marketSlug: "",
      paymentStatus: "",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-02",
    });

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
    expect(wrapper.get('[data-testid="checkout-settlement"]').text()).toContain(
      "對帳分配",
    );
    expect(wrapper.get('[data-testid="checkout-settlement"]').text()).toContain(
      "平台費率 3.50%",
    );
    expect(wrapper.get('[data-testid="checkout-settlement"]').text()).toContain(
      "攤位淨收 $154",
    );
    expect(wrapper.get('[data-testid="checkout-settlement"]').text()).toContain(
      "平台費 $6",
    );
    expect(wrapper.get('[data-testid="checkout-settlement"]').text()).toContain(
      "甜點攤",
    );
    expect(wrapper.get('[data-testid="checkout-settlement"]').text()).toContain(
      "$0",
    );

    await wrapper.get('[data-testid="refund-checkout"]').trigger("click");
    await flushPromises();

    expect(marketCheckoutsService.refund).toHaveBeenCalledWith(
      "checkout-1",
      "admin_market_checkout_refund",
    );
  });
});
