import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { usePaymentStore } from "../payment";
import type { PaymentRequest, PaymentResult } from "@makanmakan/shared-types";

// Mock fetch
global.fetch = vi.fn();

describe("Payment Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe("Initial State", () => {
    it("initializes with correct default state", () => {
      const store = usePaymentStore();

      expect(store.currentStep).toBe("idle");
      expect(store.isLoading).toBe(false);
      expect(store.hasError).toBe(false);
      expect(store.canRetry).toBe(false);
      expect(store.state.paymentHistory).toHaveLength(0);
      expect(store.state.availableMethods).toEqual({
        TW: ["credit_card", "debit_card"],
        MY: ["credit_card", "debit_card"],
        VN: ["credit_card", "debit_card"],
      });
    });

    it("has correct default settings", () => {
      const store = usePaymentStore();

      expect(store.state.settings.testMode).toBe(true); // NODE_ENV !== 'production' in tests
      expect(store.state.settings.autoRetry).toBe(true);
      expect(store.state.settings.maxRetries).toBe(3);
    });
  });

  describe("Payment Initialization", () => {
    it("initializes payment correctly", async () => {
      const store = usePaymentStore();

      const request: PaymentRequest = {
        orderId: "ORDER_123",
        restaurantId: 1,
        country: "TW",
        currency: "TWD",
        amount: 500,
        method: "credit_card",
      };

      await store.initializePayment(request);

      expect(store.currentStep).toBe("method");
      expect(store.getCurrentPayment.request).toEqual(request);
      expect(store.getCurrentPayment.status).toBe("pending");
    });

    it("clears errors on initialization", async () => {
      const store = usePaymentStore();

      // Set an error first
      store.setError("Previous error");
      expect(store.hasError).toBe(true);

      const request: PaymentRequest = {
        orderId: "ORDER_123",
        restaurantId: 1,
        country: "TW",
        currency: "TWD",
        amount: 500,
        method: "credit_card",
      };

      await store.initializePayment(request);

      expect(store.hasError).toBe(false);
    });
  });

  describe("Payment Creation", () => {
    it("creates payment successfully", async () => {
      const store = usePaymentStore();

      const mockResponse: PaymentResult = {
        success: true,
        transactionId: "TXN_123",
        status: "completed",
        clientSecret: "cs_test_123",
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockResponse }),
      } as Response);

      const request: PaymentRequest = {
        orderId: "ORDER_123",
        restaurantId: 1,
        country: "TW",
        currency: "TWD",
        amount: 500,
        method: "credit_card",
      };

      const result = await store.createPayment(request);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe("TXN_123");
      expect(store.getCurrentPayment.result).toEqual(mockResponse);
      expect(store.state.paymentHistory).toHaveLength(1);
    });

    it("handles payment validation errors", async () => {
      const store = usePaymentStore();

      const invalidRequest: PaymentRequest = {
        orderId: "", // Invalid: empty order ID
        restaurantId: 0, // Invalid: zero restaurant ID
        country: "TW",
        currency: "TWD",
        amount: -100, // Invalid: negative amount
        method: "credit_card",
      };

      const result = await store.createPayment(invalidRequest);

      expect(result.success).toBe(false);
      expect(store.state.errors.validation).toBeDefined();
      expect(Object.keys(store.state.errors.validation)).toHaveLength(3);
    });

    it("handles API errors gracefully", async () => {
      const store = usePaymentStore();

      vi.mocked(fetch).mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: false,
            error: { message: "Payment gateway error" },
          }),
      } as Response);

      const request: PaymentRequest = {
        orderId: "ORDER_123",
        restaurantId: 1,
        country: "TW",
        currency: "TWD",
        amount: 500,
        method: "credit_card",
      };

      const result = await store.createPayment(request);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Payment gateway error");
      expect(store.getCurrentPayment.status).toBe("failed");
    });
  });

  describe("Payment Status Checking", () => {
    it("checks payment status successfully", async () => {
      const store = usePaymentStore();

      vi.mocked(fetch).mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { status: "completed" },
          }),
      } as Response);

      const status = await store.checkPaymentStatus("TXN_123");

      expect(status).toBe("completed");
      expect(fetch).toHaveBeenCalledWith("/api/payments/status/TXN_123");
    });

    it("updates current payment status", async () => {
      const store = usePaymentStore();

      // Set up current payment
      store.state.currentPayment.transactionId = "TXN_123";
      store.state.currentPayment.status = "processing";

      vi.mocked(fetch).mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { status: "completed" },
          }),
      } as Response);

      await store.checkPaymentStatus("TXN_123");

      expect(store.getCurrentPayment.status).toBe("completed");
      expect(store.currentStep).toBe("completed");
    });

    it("handles status check errors", async () => {
      const store = usePaymentStore();

      vi.mocked(fetch).mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false }),
      } as Response);

      const status = await store.checkPaymentStatus("TXN_123");

      expect(status).toBe("pending"); // Default fallback
    });
  });

  describe("Payment Refunds", () => {
    it("processes full refund successfully", async () => {
      const store = usePaymentStore();

      vi.mocked(fetch).mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { refundId: "REF_123" },
          }),
      } as Response);

      const result = await store.refundPayment("TXN_123");

      expect(result.refundId).toBe("REF_123");
      expect(fetch).toHaveBeenCalledWith("/api/payments/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: "TXN_123",
          amount: undefined,
          reason: undefined,
        }),
      });
    });

    it("processes partial refund with amount", async () => {
      const store = usePaymentStore();

      vi.mocked(fetch).mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { refundId: "REF_123" },
          }),
      } as Response);

      await store.refundPayment("TXN_123", 100, "Partial refund");

      expect(fetch).toHaveBeenCalledWith("/api/payments/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: "TXN_123",
          amount: 100,
          reason: "Partial refund",
        }),
      });
    });

    it("handles refund errors", async () => {
      const store = usePaymentStore();

      vi.mocked(fetch).mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: false,
            error: { message: "Refund failed" },
          }),
      } as Response);

      await expect(store.refundPayment("TXN_123")).rejects.toThrow(
        "Refund failed",
      );
    });
  });

  describe("Payment Methods Loading", () => {
    it("loads payment methods for country", async () => {
      const store = usePaymentStore();

      const mockMethods = ["credit_card", "debit_card", "e_wallet"];

      vi.mocked(fetch).mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { supportedMethods: mockMethods },
          }),
      } as Response);

      await store.loadPaymentMethods("TW");

      expect(store.getAvailableMethodsForCountry("TW")).toEqual(mockMethods);
    });

    it("handles loading errors gracefully", async () => {
      const store = usePaymentStore();

      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      await store.loadPaymentMethods("TW");

      // Should maintain original methods on error
      expect(store.getAvailableMethodsForCountry("TW")).toEqual([
        "credit_card",
        "debit_card",
      ]);
    });
  });

  describe("Payment Retry", () => {
    it("retries payment successfully", async () => {
      const store = usePaymentStore();

      // Set up failed payment
      const request: PaymentRequest = {
        orderId: "ORDER_123",
        restaurantId: 1,
        country: "TW",
        currency: "TWD",
        amount: 500,
        method: "credit_card",
      };

      store.state.currentPayment.request = request;
      store.state.currentPayment.status = "failed";
      store.state.settings.autoRetry = true;

      // Mock successful retry
      vi.mocked(fetch).mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              transactionId: "TXN_RETRY_123",
              status: "completed",
            },
          }),
      } as Response);

      const result = await store.retryPayment();

      expect(result?.success).toBe(true);
      expect(result?.transactionId).toBe("TXN_RETRY_123");
    });

    it("returns null when retry is not allowed", async () => {
      const store = usePaymentStore();

      store.state.currentPayment.status = "completed"; // Cannot retry completed

      const result = await store.retryPayment();

      expect(result).toBeNull();
    });
  });

  describe("Payment History", () => {
    it("adds payments to history", async () => {
      const store = usePaymentStore();

      const transaction = {
        id: "TXN_123",
        orderId: "ORDER_123",
        amount: 500,
        currency: "TWD" as const,
        method: "credit_card" as const,
        status: "completed" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      store.addToHistory(transaction);

      expect(store.state.paymentHistory).toHaveLength(1);
      expect(store.state.paymentHistory[0]).toEqual(transaction);
    });

    it("sorts payment history by date", () => {
      const store = usePaymentStore();

      const oldTransaction = {
        id: "TXN_OLD",
        orderId: "ORDER_OLD",
        amount: 300,
        currency: "TWD" as const,
        method: "credit_card" as const,
        status: "completed" as const,
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-01"),
      };

      const newTransaction = {
        id: "TXN_NEW",
        orderId: "ORDER_NEW",
        amount: 500,
        currency: "TWD" as const,
        method: "credit_card" as const,
        status: "completed" as const,
        createdAt: new Date("2023-12-01"),
        updatedAt: new Date("2023-12-01"),
      };

      store.addToHistory(oldTransaction);
      store.addToHistory(newTransaction);

      const sortedHistory = store.getPaymentHistory;
      expect(sortedHistory[0].id).toBe("TXN_NEW");
      expect(sortedHistory[1].id).toBe("TXN_OLD");
    });
  });

  describe("Payment Statistics", () => {
    it("calculates payment statistics correctly", () => {
      const store = usePaymentStore();

      // Add sample transactions
      const transactions = [
        { id: "1", status: "completed" },
        { id: "2", status: "completed" },
        { id: "3", status: "failed" },
        { id: "4", status: "processing" },
      ].map((t) => ({
        ...t,
        orderId: `ORDER_${t.id}`,
        amount: 100,
        currency: "TWD" as const,
        method: "credit_card" as const,
        status: t.status as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      transactions.forEach((t) => store.addToHistory(t));

      const stats = store.getPaymentStats;

      expect(stats.total).toBe(4);
      expect(stats.successful).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.successRate).toBe(50);
    });

    it("handles empty history", () => {
      const store = usePaymentStore();

      const stats = store.getPaymentStats;

      expect(stats.total).toBe(0);
      expect(stats.successful).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  describe("Currency Formatting", () => {
    it("formats TWD correctly", () => {
      const store = usePaymentStore();

      const formatted = store.formatAmount(1234, "TWD");

      expect(formatted).toMatch(/NT\$1,234|1,234/);
    });

    it("formats MYR correctly", () => {
      const store = usePaymentStore();

      const formatted = store.formatAmount(12.34, "MYR");

      expect(formatted).toContain("12.34");
    });

    it("formats VND correctly", () => {
      const store = usePaymentStore();

      const formatted = store.formatAmount(123456, "VND");

      expect(formatted).toMatch(/123,456/);
    });
  });

  describe("Form Validation", () => {
    it("validates payment request correctly", () => {
      const store = usePaymentStore();

      const validRequest: PaymentRequest = {
        orderId: "ORDER_123",
        restaurantId: 1,
        country: "TW",
        currency: "TWD",
        amount: 500,
        method: "credit_card",
        customerInfo: {
          name: "John Doe",
          email: "john@example.com",
          phone: "+886912345678",
        },
      };

      const validation = store.validatePaymentRequest(validRequest);

      expect(validation.valid).toBe(true);
      expect(Object.keys(validation.errors)).toHaveLength(0);
    });

    it("catches validation errors", () => {
      const store = usePaymentStore();

      const invalidRequest: PaymentRequest = {
        orderId: "",
        restaurantId: 0,
        country: "TW",
        currency: "TWD",
        amount: -100,
        method: "credit_card",
        customerInfo: {
          name: "",
          email: "invalid-email",
        },
      };

      const validation = store.validatePaymentRequest(invalidRequest);

      expect(validation.valid).toBe(false);
      expect(validation.errors.orderId).toBeTruthy();
      expect(validation.errors.restaurantId).toBeTruthy();
      expect(validation.errors.amount).toBeTruthy();
      expect(validation.errors.name).toBeTruthy();
      expect(validation.errors.email).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("sets and clears errors", () => {
      const store = usePaymentStore();

      store.setError("Test error");
      expect(store.hasError).toBe(true);
      expect(store.state.errors.payment).toBe("Test error");

      store.clearErrors();
      expect(store.hasError).toBe(false);
      expect(store.state.errors.payment).toBeNull();
    });
  });

  describe("Settings Management", () => {
    it("updates settings", () => {
      const store = usePaymentStore();

      store.updateSettings({
        testMode: false,
        maxRetries: 5,
      });

      expect(store.state.settings.testMode).toBe(false);
      expect(store.state.settings.maxRetries).toBe(5);
      expect(store.state.settings.autoRetry).toBe(true); // Unchanged
    });
  });

  describe("Store Reset", () => {
    it("resets store to initial state", () => {
      const store = usePaymentStore();

      // Modify state
      store.setError("Test error");
      store.state.currentPayment.status = "completed";

      store.reset();

      expect(store.hasError).toBe(false);
      expect(store.getCurrentPayment.status).toBe("pending");
      expect(store.currentStep).toBe("idle");
    });
  });
});
