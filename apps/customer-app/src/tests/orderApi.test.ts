import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api";
import { orderApi } from "@/services/orderApi";

vi.mock("@/services/api", () => ({
  apiClient: {
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const getMarketCheckoutGuestToken = vi.hoisted(() => vi.fn());

vi.mock("@/utils/marketCheckouts", () => ({
  getMarketCheckoutGuestToken,
  recordMarketCheckoutGuestTokens: vi.fn(),
  recordRecentMarketCheckout: vi.fn(),
  recordRecoveredMarketCheckoutGuestToken: vi.fn(),
}));

describe("orderApi market checkout vouchers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMarketCheckoutGuestToken.mockReturnValue(undefined);
  });

  it("applies a market checkout voucher", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      checkout: { id: "checkout-1" },
      voucher: { code: "MARKET10", discountCents: 2400 },
      subtotalCents: 24000,
      discountCents: 2400,
      payableCents: 21600,
    });

    await expect(
      orderApi.applyMarketCheckoutVoucher("checkout-1", "MARKET10"),
    ).resolves.toMatchObject({
      voucher: { code: "MARKET10" },
      payableCents: 21600,
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      "/market-checkouts/checkout-1/voucher",
      { code: "MARKET10" },
      undefined,
    );
  });

  it("removes a market checkout voucher", async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      checkout: { id: "checkout-1" },
    });

    await expect(
      orderApi.removeMarketCheckoutVoucher("checkout-1"),
    ).resolves.toMatchObject({
      checkout: { id: "checkout-1" },
    });
    expect(apiClient.delete).toHaveBeenCalledWith(
      "/market-checkouts/checkout-1/voucher",
      undefined,
      undefined,
    );
  });
  it("proves checkout ownership with a header the JWT cannot displace", () => {
    // The API client puts either the customer JWT or a guest token in
    // `Authorization`, never both, so a signed-in shopper paying a checkout
    // they placed while signed out has to send the guest token elsewhere.
    getMarketCheckoutGuestToken.mockReturnValue("gt_holder");
    vi.mocked(apiClient.post).mockResolvedValueOnce({});

    void orderApi.payMarketCheckout("checkout-1", { method: "market_online" });

    expect(apiClient.post).toHaveBeenCalledWith(
      "/market-checkouts/checkout-1/pay",
      expect.objectContaining({ method: "market_online" }),
      { headers: { "X-Guest-Token": "gt_holder" } },
    );
  });
});
