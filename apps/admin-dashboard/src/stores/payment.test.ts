// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { usePaymentStore } from "./payment";
import { apiClient } from "@/services/api";
import { AxiosHeaders, type AxiosResponse } from "axios";
import type { ApiResponse } from "@/types";
import type { PaymentRequest } from "@makanmasak/shared-types";

vi.mock("@/i18n", () => ({
  t: (key: string) => key,
}));

vi.mock("@/services/api", () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

// api.* return a full AxiosResponse, so a mock has to supply the whole envelope
// rather than just `data`.
function axiosResponse<T>(response: {
  data: ApiResponse<T>;
  status?: number;
}): AxiosResponse<ApiResponse<T>> {
  return {
    data: response.data,
    status: response.status ?? 200,
    statusText: "OK",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
}

const paymentRequest = (): PaymentRequest => ({
  orderId: "order-1",
  restaurantId: "restaurant-1",
  country: "TW",
  currency: "TWD",
  amount: 120,
  method: "cash",
});

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(crypto, "randomUUID")
    .mockReturnValueOnce("018f0000-0000-7000-8000-000000000001")
    .mockReturnValueOnce("018f0000-0000-7000-8000-000000000002");
  vi.mocked(apiClient.post).mockResolvedValue(
    axiosResponse({
      data: {
        success: true,
        data: {
          transactionId: "payment-1",
          status: "completed",
        },
      },
    }),
  );
});

describe("usePaymentStore", () => {
  it("sends a unique Idempotency-Key for every payment creation request", async () => {
    const store = usePaymentStore();

    await store.createPayment(paymentRequest());
    await store.createPayment(paymentRequest());

    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/payments/create",
      paymentRequest(),
      {
        headers: {
          "Idempotency-Key":
            "payment-order-1-018f0000-0000-7000-8000-000000000001",
        },
      },
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      "/payments/create",
      paymentRequest(),
      {
        headers: {
          "Idempotency-Key":
            "payment-order-1-018f0000-0000-7000-8000-000000000002",
        },
      },
    );
  });
});
