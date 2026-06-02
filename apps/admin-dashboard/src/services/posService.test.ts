import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api";
import { posService } from "./posService";

vi.mock("@/services/api", () => ({
  apiClient: {
    post: vi.fn(),
  },
  unwrapApiData: (response: { data?: unknown }) => response.data,
}));

describe("posService", () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
  });

  it("pays a market checkout through the active POS shift", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        checkout: {
          id: "checkout-1",
          paymentStatus: "paid",
        },
        payment: {
          status: "paid",
          method: "pos_cash",
          totalAmountCents: 20000,
        },
      },
    } as never);

    const result = await posService.payMarketCheckout({
      checkoutId: "checkout-1",
      registerId: "register-1",
      shiftId: "shift-1",
      paymentMethod: "cash",
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      "/pos/market-checkouts/checkout-1/pay",
      {
        registerId: "register-1",
        shiftId: "shift-1",
        paymentMethod: "cash",
      },
    );
    expect(result.payment).toMatchObject({
      status: "paid",
      method: "pos_cash",
    });
  });
});
