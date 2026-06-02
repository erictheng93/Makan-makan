import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../types/env";
import {
  ChildTransactionMarketCheckoutPaymentProvider,
  ProviderSplitMarketCheckoutPaymentProvider,
  createMarketCheckoutPaymentProvider,
} from "./MarketCheckoutPaymentProvider";

const processPayment = vi.hoisted(() => vi.fn());

vi.mock("../../payments/services/PaymentService", () => ({
  PaymentService: function PaymentService() {
    return { processPayment };
  },
}));

describe("ChildTransactionMarketCheckoutPaymentProvider", () => {
  beforeEach(() => {
    processPayment.mockReset();
  });

  it("processes child orders with market checkout metadata", async () => {
    processPayment
      .mockResolvedValueOnce({
        data: { paymentId: "pay-1001", authorizedTotal: 120 },
      })
      .mockResolvedValueOnce({
        data: { paymentId: "pay-1002", authorizedTotal: 80 },
      });

    const provider = new ChildTransactionMarketCheckoutPaymentProvider(
      {} as Env,
    );
    const result = await provider.process({
      checkoutId: "checkout-1",
      marketSlug: "fengjia",
      childOrders: [
        {
          restaurantId: "restaurant-1",
          restaurantName: "Noodle Stall",
          orderId: 1001,
          orderNumber: "A001",
          totalAmount: 120,
        },
        {
          restaurantId: "restaurant-2",
          restaurantName: "Dessert Stall",
          orderId: 1002,
          orderNumber: "A002",
          totalAmount: 80,
        },
      ],
      method: "line_pay",
      country: "TW",
      currency: "TWD",
      customerInfo: { name: "Guest" },
      requestIdempotencyKey: "market-pay-1",
    });

    expect(processPayment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderId: 1001,
        paymentMode: "full",
        amount: 120,
        expectedTotal: 120,
        closeOrder: false,
        method: "line_pay",
        gateway: "line_pay",
      }),
      expect.objectContaining({
        country: "TW",
        currency: "TWD",
        idempotencyKey: "market-pay-1:1001",
        customerInfo: { name: "Guest" },
        metadata: expect.objectContaining({
          source: "market-checkouts",
          marketCheckoutId: "checkout-1",
          marketSlug: "fengjia",
          restaurantId: "restaurant-1",
          splitMode: "child_transactions",
        }),
      }),
    );
    expect(processPayment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ orderId: 1002 }),
      expect.objectContaining({
        idempotencyKey: "market-pay-1:1002",
        metadata: expect.objectContaining({
          restaurantId: "restaurant-2",
        }),
      }),
    );
    expect(result).toEqual({
      provider: "line_pay",
      splitMode: "child_transactions",
      idempotencyKey: "market-pay-1",
      childPayments: [
        expect.objectContaining({
          restaurantId: "restaurant-1",
          orderId: 1001,
          paymentId: "pay-1001",
          status: "paid",
          amount: 120,
          amountCents: 12000,
        }),
        expect.objectContaining({
          restaurantId: "restaurant-2",
          orderId: 1002,
          paymentId: "pay-1002",
          status: "paid",
          amount: 80,
          amountCents: 8000,
        }),
      ],
    });
  });

  it("keeps existing paid child payments and retries unpaid children", async () => {
    processPayment.mockResolvedValueOnce({
      data: { paymentId: "pay-1002", authorizedTotal: 80 },
    });

    const provider = new ChildTransactionMarketCheckoutPaymentProvider(
      {} as Env,
    );
    const result = await provider.process({
      checkoutId: "checkout-1",
      marketSlug: "fengjia",
      childOrders: [
        {
          restaurantId: "restaurant-1",
          restaurantName: "Noodle Stall",
          orderId: 1001,
          orderNumber: "A001",
          totalAmount: 120,
        },
        {
          restaurantId: "restaurant-2",
          restaurantName: "Dessert Stall",
          orderId: 1002,
          orderNumber: "A002",
          totalAmount: 80,
        },
      ],
      existingChildPayments: [
        {
          restaurantId: "restaurant-1",
          restaurantName: "Noodle Stall",
          orderId: 1001,
          orderNumber: "A001",
          paymentId: "pay-1001",
          status: "paid",
          amount: 120,
          amountCents: 12000,
        },
      ],
      method: "line_pay",
      country: "TW",
      currency: "TWD",
    });

    expect(processPayment).toHaveBeenCalledTimes(1);
    expect(processPayment).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 1002 }),
      expect.objectContaining({
        idempotencyKey: "market-checkout:checkout-1:1002",
      }),
    );
    expect(result.idempotencyKey).toBe("market-checkout:checkout-1");
    expect(result.childPayments).toEqual([
      expect.objectContaining({
        orderId: 1001,
        paymentId: "pay-1001",
        status: "paid",
      }),
      expect.objectContaining({
        orderId: 1002,
        paymentId: "pay-1002",
        status: "paid",
      }),
    ]);
  });

  it("records failed child payments without throwing", async () => {
    processPayment.mockRejectedValueOnce(new Error("Gateway declined"));

    const provider = new ChildTransactionMarketCheckoutPaymentProvider(
      {} as Env,
    );
    const result = await provider.process({
      checkoutId: "checkout-1",
      marketSlug: "fengjia",
      childOrders: [
        {
          restaurantId: "restaurant-1",
          restaurantName: "Noodle Stall",
          orderId: 1001,
          orderNumber: "A001",
          totalAmount: 120,
        },
      ],
      method: "line_pay",
      country: "TW",
      currency: "TWD",
    });

    expect(result.childPayments).toEqual([
      expect.objectContaining({
        orderId: 1001,
        status: "failed",
        amount: 120,
        amountCents: 12000,
        errorMessage: "Gateway declined",
      }),
    ]);
  });

  it("processes provider split payments through an injected gateway", async () => {
    const gateway = {
      process: vi.fn(async () => ({
        provider: "stripe_connect",
        providerTransactionId: "pi_market_1",
        authorizedAmountCents: 20000,
        allocations: [
          { orderId: 1001, paymentId: "alloc-1001", amountCents: 12000 },
          { orderId: 1002, paymentId: "alloc-1002", amountCents: 8000 },
        ],
      })),
    };
    const provider = new ProviderSplitMarketCheckoutPaymentProvider(gateway);

    const result = await provider.process({
      checkoutId: "checkout-1",
      marketSlug: "fengjia",
      childOrders: [
        {
          restaurantId: "restaurant-1",
          restaurantName: "Noodle Stall",
          orderId: 1001,
          orderNumber: "A001",
          totalAmount: 120,
        },
        {
          restaurantId: "restaurant-2",
          restaurantName: "Dessert Stall",
          orderId: 1002,
          orderNumber: "A002",
          totalAmount: 80,
        },
      ],
      method: "stripe_connect",
      country: "TW",
      currency: "TWD",
      requestIdempotencyKey: "market-pay-1",
    });

    expect(gateway.process).toHaveBeenCalledWith({
      checkoutId: "checkout-1",
      marketSlug: "fengjia",
      method: "stripe_connect",
      country: "TW",
      currency: "TWD",
      idempotencyKey: "market-pay-1",
      amountCents: 20000,
      customerInfo: undefined,
      allocations: [
        {
          restaurantId: "restaurant-1",
          restaurantName: "Noodle Stall",
          orderId: 1001,
          orderNumber: "A001",
          amountCents: 12000,
        },
        {
          restaurantId: "restaurant-2",
          restaurantName: "Dessert Stall",
          orderId: 1002,
          orderNumber: "A002",
          amountCents: 8000,
        },
      ],
    });
    expect(result).toEqual({
      provider: "stripe_connect",
      splitMode: "provider_split",
      idempotencyKey: "market-pay-1",
      providerTransactionId: "pi_market_1",
      childPayments: [
        expect.objectContaining({
          orderId: 1001,
          paymentId: "alloc-1001",
          status: "paid",
          amountCents: 12000,
        }),
        expect.objectContaining({
          orderId: 1002,
          paymentId: "alloc-1002",
          status: "paid",
          amountCents: 8000,
        }),
      ],
    });
  });

  it("keeps child transaction processing as the default factory mode", () => {
    const provider = createMarketCheckoutPaymentProvider({} as Env);

    expect(provider).toBeInstanceOf(
      ChildTransactionMarketCheckoutPaymentProvider,
    );
  });

  it("rejects provider split results with mismatched authorized amount", async () => {
    const provider = new ProviderSplitMarketCheckoutPaymentProvider({
      process: vi.fn(async () => ({
        provider: "stripe_connect",
        providerTransactionId: "pi_market_1",
        authorizedAmountCents: 19999,
        allocations: [{ orderId: 1001, amountCents: 12000 }],
      })),
    });

    await expect(
      provider.process({
        checkoutId: "checkout-1",
        marketSlug: "fengjia",
        childOrders: [
          {
            restaurantId: "restaurant-1",
            restaurantName: "Noodle Stall",
            orderId: 1001,
            orderNumber: "A001",
            totalAmount: 120,
          },
        ],
        method: "stripe_connect",
        country: "TW",
        currency: "TWD",
      }),
    ).rejects.toThrow(
      "Provider split authorized amount does not match checkout total",
    );
  });

  it("creates an explicit provider split provider when configured", async () => {
    const provider = createMarketCheckoutPaymentProvider({
      MARKET_CHECKOUT_SPLIT_MODE: "provider_split",
    } as Env & { MARKET_CHECKOUT_SPLIT_MODE: string });

    expect(provider).toBeInstanceOf(ProviderSplitMarketCheckoutPaymentProvider);
    await expect(
      provider.process({
        checkoutId: "checkout-1",
        marketSlug: "fengjia",
        childOrders: [],
        method: "stripe_connect",
        country: "TW",
        currency: "TWD",
      }),
    ).rejects.toThrow(
      "Market checkout provider split gateway is not configured",
    );
  });
});
