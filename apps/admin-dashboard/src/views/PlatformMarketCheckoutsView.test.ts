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
    providerStatus: vi.fn(),
    checkProviderConnectivity: vi.fn(),
    exportCsv: vi.fn(),
    exportVendorsCsv: vi.fn(),
    exportAccountingCsv: vi.fn(),
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
          platformFeeCents: 840,
          vendorNetAmountCents: 15160,
          refundedPaymentCount: 1,
          failedPaymentCount: 0,
        },
      ],
    });
    vi.mocked(marketCheckoutsService.providerStatus).mockResolvedValue({
      splitMode: "provider_split",
      readiness: "not_configured",
      providerKind: "http_provider_split",
      providerSplitUrlConfigured: false,
      providerSplitHealthUrlConfigured: false,
      providerSplitTokenConfigured: false,
      providerSplitSigningConfigured: false,
      providerWebhookSecretConfigured: false,
      capabilities: ["webhook_status_sync", "refunds"],
      missingConfiguration: ["MARKET_CHECKOUT_PROVIDER_SPLIT_URL"],
      notes: [
        "Provider split mode is enabled but no HTTP gateway URL is configured.",
      ],
    });
    vi.mocked(
      marketCheckoutsService.checkProviderConnectivity,
    ).mockResolvedValue({
      status: "skipped",
      checkedAt: "2026-06-01T10:10:00.000Z",
      splitMode: "provider_split",
      message:
        "Provider split gateway URL is configured, but no health check URL is configured.",
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
          {
            restaurantId: "restaurant-2",
            restaurantName: "甜點攤",
            orderId: 1002,
            orderNumber: "A002",
            status: "failed",
            amount: 80,
            amountCents: 8000,
            errorMessage: "Gateway declined",
          },
        ],
        parentPayment: {
          paymentId: "market_pay_checkout-1",
          status: "pending",
          provider: "mock_market_provider",
          splitMode: "provider_split",
          idempotencyKey: "market-checkout:checkout-1",
          providerTransactionId: "intent-market-checkout-1",
          nextAction: {
            type: "redirect",
            redirectUrl:
              "https://payments.example.test/confirm/intent-market-checkout-1",
          },
          lastWebhook: {
            provider: "mock_market_provider",
            eventId: "evt-market-checkout-failed-1",
            eventType: "market_checkout.payment_failed",
            status: "failed",
            receivedAt: "2026-06-01T10:09:00.000Z",
          },
          amountCents: 24000,
          paidAmountCents: 16000,
          refundedAmountCents: 0,
          childPaymentIds: ["pay-1"],
          createdAt: "2026-06-01T10:05:00.000Z",
          updatedAt: "2026-06-01T10:05:00.000Z",
        },
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
    vi.mocked(marketCheckoutsService.exportAccountingCsv).mockResolvedValue(
      new Blob(["account_code\n1100"], { type: "text/csv" }),
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
    expect(marketCheckoutsService.providerStatus).toHaveBeenCalled();
    expect(wrapper.text()).toContain("逢甲夜市");
    expect(wrapper.text()).toContain("部分付款");
    expect(wrapper.text()).toContain("2 攤");
    expect(wrapper.get('[data-testid="provider-status"]').text()).toContain(
      "Provider 統一授權拆帳",
    );
    expect(wrapper.get('[data-testid="provider-status"]').text()).toContain(
      "未設定",
    );
    expect(wrapper.get('[data-testid="provider-status"]').text()).toContain(
      "MARKET_CHECKOUT_PROVIDER_SPLIT_URL",
    );
    expect(wrapper.get('[data-testid="provider-status"]').text()).toContain(
      "Webhook 驗簽 secret",
    );

    await wrapper
      .get('[data-testid="check-provider-connectivity"]')
      .trigger("click");
    await flushPromises();

    expect(marketCheckoutsService.checkProviderConnectivity).toHaveBeenCalled();
    expect(
      wrapper.get('[data-testid="provider-connectivity-check"]').text(),
    ).toContain("未檢查");
    expect(
      wrapper.get('[data-testid="provider-connectivity-check"]').text(),
    ).toContain("Provider split gateway URL is configured");
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
    expect(wrapper.get('[data-testid="vendor-settlements"]').text()).toContain(
      "平台費",
    );
    expect(wrapper.get('[data-testid="vendor-settlements"]').text()).toContain(
      "淨撥款",
    );
    expect(wrapper.get('[data-testid="vendor-settlements"]').text()).toContain(
      "$8",
    );
    expect(wrapper.get('[data-testid="vendor-settlements"]').text()).toContain(
      "$152",
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
      .get('[data-testid="export-accounting-ledger"]')
      .trigger("click");
    await flushPromises();

    expect(marketCheckoutsService.exportAccountingCsv).toHaveBeenCalledWith({
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
    expect(
      wrapper.get('[data-testid="checkout-parent-payment"]').text(),
    ).toContain("market_pay_checkout-1");
    expect(
      wrapper.get('[data-testid="checkout-parent-payment"]').text(),
    ).toContain("付款商拆帳");
    expect(
      wrapper.get('[data-testid="checkout-parent-payment"]').text(),
    ).toContain("mock_market_provider");
    expect(
      wrapper.get('[data-testid="checkout-parent-payment"]').text(),
    ).toContain("intent-market-checkout-1");
    expect(
      wrapper.get('[data-testid="checkout-parent-payment"]').text(),
    ).toContain("redirect");
    expect(
      wrapper.get('[data-testid="checkout-parent-payment"]').text(),
    ).toContain("payments.example.test");
    expect(
      wrapper.get('[data-testid="checkout-parent-payment"]').text(),
    ).toContain("最後 webhook");
    expect(
      wrapper.get('[data-testid="checkout-parent-payment"]').text(),
    ).toContain("evt-market-checkout-failed-1");
    expect(
      wrapper.get('[data-testid="checkout-parent-payment"]').text(),
    ).toContain("market_checkout.payment_failed");
    expect(
      wrapper.get('[data-testid="checkout-parent-payment"]').text(),
    ).toContain("付款失敗");
    expect(
      wrapper.get('[data-testid="checkout-parent-payment"]').text(),
    ).toContain("06/01 18:09");
    expect(
      wrapper.get('[data-testid="checkout-provider-alerts"]').text(),
    ).toContain("Provider 付款仍待處理超過 30 分鐘");
    expect(
      wrapper.get('[data-testid="checkout-provider-alerts"]').text(),
    ).toContain("最後 webhook 回報付款失敗");
    expect(
      wrapper.get('[data-testid="checkout-parent-payment"]').text(),
    ).toContain("子交易 1");
    expect(
      wrapper.get('[data-testid="checkout-parent-payment"]').text(),
    ).toContain("冪等鍵 market-checkout:checkout-1");
    expect(
      wrapper.get('[data-testid="checkout-parent-payment"]').text(),
    ).toContain("更新 06/01 18:05");
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
    expect(
      wrapper.get('[data-testid="checkout-child-payments"]').text(),
    ).toContain("付款子交易");
    expect(
      wrapper.get('[data-testid="checkout-child-payments"]').text(),
    ).toContain("1 筆失敗");
    expect(
      wrapper.get('[data-testid="checkout-child-payments"]').text(),
    ).toContain("甜點攤");
    expect(
      wrapper.get('[data-testid="checkout-child-payments"]').text(),
    ).toContain("付款失敗");
    expect(
      wrapper.get('[data-testid="checkout-child-payments"]').text(),
    ).toContain("Gateway declined");
    expect(
      wrapper.get('[data-testid="checkout-child-payments"]').text(),
    ).toContain("pay-1");

    await wrapper.get('[data-testid="refund-checkout"]').trigger("click");
    await flushPromises();

    expect(marketCheckoutsService.refund).toHaveBeenCalledWith(
      "checkout-1",
      "admin_market_checkout_refund",
    );
  });
});
