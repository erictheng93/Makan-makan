import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api";
import { posService } from "./posService";

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  unwrapApiData: (response: { data?: unknown }) => response.data,
}));

describe("posService", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.delete).mockReset();
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

  it("forwards the selected restaurant to every print-agent request", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] } as never);
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: {} } as never);
    vi.mocked(apiClient.delete).mockResolvedValueOnce({} as never);

    await posService.getPrintAgents("restaurant-1");
    await posService.issuePrintAgent({ label: "Kitchen" }, "restaurant-1");
    await posService.revokePrintAgent("agent-1", "restaurant-1");

    expect(apiClient.get).toHaveBeenCalledWith("/pos/print-agents", {
      params: { restaurantId: "restaurant-1" },
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      "/pos/print-agents",
      { label: "Kitchen" },
      { params: { restaurantId: "restaurant-1" } },
    );
    expect(apiClient.delete).toHaveBeenCalledWith("/pos/print-agents/agent-1", {
      params: { restaurantId: "restaurant-1" },
    });
  });
});
