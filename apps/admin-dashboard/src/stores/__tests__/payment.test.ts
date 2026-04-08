/**
 * Payment Store Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@/i18n", () => ({
  t: (key: string) => key,
}));

import { usePaymentStore } from "../payment";

describe("Payment Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockReset();
  });

  describe("Initial State", () => {
    it("should have idle step", () => {
      const store = usePaymentStore();
      expect(store.currentStep).toBe("idle");
    });

    it("should not be loading", () => {
      const store = usePaymentStore();
      expect(store.isLoading).toBe(false);
    });

    it("should not have errors", () => {
      const store = usePaymentStore();
      expect(store.hasError).toBe(false);
    });

    it("should have default payment methods for supported countries", () => {
      const store = usePaymentStore();
      expect(store.getAvailableMethodsForCountry("TW")).toContain(
        "credit_card",
      );
      expect(store.getAvailableMethodsForCountry("MY")).toContain(
        "credit_card",
      );
    });

    it("should return empty array for unsupported country", () => {
      const store = usePaymentStore();
      expect(store.getAvailableMethodsForCountry("XX" as any)).toEqual([]);
    });
  });

  describe("initializePayment", () => {
    it("should set step to method and clear errors", async () => {
      // Mock loadPaymentMethods fetch
      vi.mocked(global.fetch).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            data: { supportedMethods: ["credit_card"] },
          }),
      } as Response);

      const store = usePaymentStore();
      const request = {
        orderId: "o1",
        restaurantId: "r1",
        amount: 100,
        currency: "MYR" as const,
        country: "MY" as const,
        method: "credit_card" as const,
      };

      await store.initializePayment(request);

      expect(store.currentStep).toBe("method");
      expect(store.getCurrentPayment.request).toEqual(request);
    });
  });

  describe("createPayment", () => {
    const validRequest = {
      orderId: "o1",
      restaurantId: "r1",
      amount: 100,
      currency: "MYR" as const,
      country: "MY" as const,
      method: "credit_card" as const,
    };

    it("should create payment successfully", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              transactionId: "tx-1",
              status: "completed",
              clientSecret: "cs-1",
            },
          }),
      } as Response);

      const store = usePaymentStore();
      const result = await store.createPayment(validRequest);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe("tx-1");
      expect(result.status).toBe("completed");
      expect(store.currentStep).toBe("completed");

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/payments/create",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(validRequest),
        }),
      );
    });

    it("should handle failed payment from API", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: false,
            error: { message: "Insufficient funds" },
          }),
      } as Response);

      const store = usePaymentStore();
      const result = await store.createPayment(validRequest);

      expect(result.success).toBe(false);
      expect(store.currentStep).toBe("failed");
      expect(store.hasError).toBe(true);
    });

    it("should fail validation when orderId missing", async () => {
      const store = usePaymentStore();
      const result = await store.createPayment({
        ...validRequest,
        orderId: "",
      });

      expect(result.success).toBe(false);
      expect(store.currentStep).toBe("failed");
      // fetch should not be called for invalid requests
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should fail validation for negative amount", async () => {
      const store = usePaymentStore();
      const result = await store.createPayment({
        ...validRequest,
        amount: -10,
      });

      expect(result.success).toBe(false);
    });

    it("should set loading state during creation", async () => {
      let resolvePromise: (v: any) => void;
      vi.mocked(global.fetch).mockReturnValue(
        new Promise((r) => {
          resolvePromise = r;
        }),
      );

      const store = usePaymentStore();
      const promise = store.createPayment(validRequest);

      expect(store.state.loading.creating).toBe(true);

      resolvePromise!({
        json: () =>
          Promise.resolve({
            success: true,
            data: { transactionId: "tx-1", status: "completed" },
          }),
      });

      await promise;
      expect(store.state.loading.creating).toBe(false);
    });
  });

  describe("checkPaymentStatus", () => {
    it("should fetch and return status", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            data: { status: "completed" },
          }),
      } as Response);

      const store = usePaymentStore();

      const status = await store.checkPaymentStatus("tx-1");

      expect(status).toBe("completed");
      expect(global.fetch).toHaveBeenCalledWith("/api/payments/status/tx-1");
    });

    it("should return pending on error", async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

      const store = usePaymentStore();
      const status = await store.checkPaymentStatus("tx-1");

      expect(status).toBe("pending");
    });
  });

  describe("refundPayment", () => {
    it("should call refund endpoint", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            data: { refundId: "rf-1" },
          }),
      } as Response);

      const store = usePaymentStore();
      const result = await store.refundPayment("tx-1", 50, "Customer request");

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/payments/refund",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            transactionId: "tx-1",
            amount: 50,
            reason: "Customer request",
          }),
        }),
      );
      expect(result).toEqual({ refundId: "rf-1" });
    });

    it("should throw on refund failure", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: false,
            error: { message: "Refund not allowed" },
          }),
      } as Response);

      const store = usePaymentStore();
      await expect(store.refundPayment("tx-1")).rejects.toThrow(
        "Refund not allowed",
      );
    });
  });

  describe("cancelPayment", () => {
    it("should reset current payment to idle", () => {
      const store = usePaymentStore();
      store.state.currentPayment.step = "processing";
      store.state.currentPayment.transactionId = "tx-1";

      store.cancelPayment();

      expect(store.currentStep).toBe("idle");
      expect(store.getCurrentPayment.status).toBe("cancelled");
      expect(store.getCurrentPayment.transactionId).toBeNull();
    });
  });

  describe("retryPayment", () => {
    it("should return null if no current request", async () => {
      const store = usePaymentStore();
      const result = await store.retryPayment();
      expect(result).toBeNull();
    });

    it("should return null if canRetry is false", async () => {
      const store = usePaymentStore();
      store.state.currentPayment.request = {
        orderId: "o1",
        restaurantId: "r1",
        amount: 100,
        currency: "MYR",
        country: "MY",
        method: "credit_card",
      } as any;
      store.state.currentPayment.status = "completed"; // not failed
      store.state.settings.autoRetry = true;

      const result = await store.retryPayment();
      expect(result).toBeNull();
    });
  });

  describe("formatAmount", () => {
    it("should format TWD without decimals", () => {
      const store = usePaymentStore();
      const formatted = store.formatAmount(1000, "TWD");
      expect(formatted).toContain("1,000");
    });

    it("should format MYR with 2 decimals", () => {
      const store = usePaymentStore();
      const formatted = store.formatAmount(99.5, "MYR");
      expect(formatted).toContain("99.50");
    });
  });

  describe("getPaymentStats", () => {
    it("should calculate stats from empty history", () => {
      const store = usePaymentStore();
      expect(store.getPaymentStats.total).toBe(0);
      expect(store.getPaymentStats.successRate).toBe(0);
    });
  });

  describe("reset", () => {
    it("should reset current payment and clear errors", () => {
      const store = usePaymentStore();
      store.setError("some error");
      store.setStep("processing");

      store.reset();

      expect(store.currentStep).toBe("idle");
      expect(store.hasError).toBe(false);
    });
  });

  describe("updateSettings", () => {
    it("should merge new settings", () => {
      const store = usePaymentStore();
      store.updateSettings({ maxRetries: 5 });

      expect(store.state.settings.maxRetries).toBe(5);
      expect(store.state.settings.autoRetry).toBe(true); // unchanged
    });
  });
});
