import type { Env } from "../../../types/env";
import { PaymentService } from "../../payments/services/PaymentService";

export type MarketCheckoutChildPaymentStatus = "paid" | "failed" | "refunded";
export type MarketCheckoutSplitMode = "child_transactions";

export interface MarketCheckoutPaymentChildOrder {
  restaurantId: string;
  restaurantName: string;
  orderId: number;
  orderNumber: string;
  totalAmount: number;
}

export interface MarketCheckoutChildPayment {
  restaurantId: string;
  restaurantName: string;
  orderId: number;
  orderNumber: string;
  paymentId?: string;
  refundId?: string;
  status: MarketCheckoutChildPaymentStatus;
  amount: number;
  amountCents: number;
  errorMessage?: string;
}

export interface MarketCheckoutPaymentProviderInput {
  checkoutId: string;
  marketSlug: string;
  childOrders: MarketCheckoutPaymentChildOrder[];
  existingChildPayments?: MarketCheckoutChildPayment[];
  method: string;
  country: "TW" | "MY" | "VN";
  currency: "TWD" | "MYR" | "VND";
  customerInfo?: unknown;
  requestIdempotencyKey?: string;
}

export interface MarketCheckoutPaymentProviderResult {
  provider: string;
  splitMode: MarketCheckoutSplitMode;
  idempotencyKey: string;
  childPayments: MarketCheckoutChildPayment[];
}

export interface MarketCheckoutPaymentProvider {
  process(
    input: MarketCheckoutPaymentProviderInput,
  ): Promise<MarketCheckoutPaymentProviderResult>;
}

export class ChildTransactionMarketCheckoutPaymentProvider implements MarketCheckoutPaymentProvider {
  constructor(
    private readonly env: Env,
    private readonly paymentService = new PaymentService(env),
  ) {}

  async process(
    input: MarketCheckoutPaymentProviderInput,
  ): Promise<MarketCheckoutPaymentProviderResult> {
    const childPaymentsByOrderId = new Map(
      input.existingChildPayments?.map((payment) => [
        payment.orderId,
        payment,
      ]) ?? [],
    );
    const parentIdempotencyKey =
      input.requestIdempotencyKey ?? `market-checkout:${input.checkoutId}`;

    for (const child of input.childOrders) {
      if (childPaymentsByOrderId.get(child.orderId)?.status === "paid") {
        continue;
      }

      const amount = Number(child.totalAmount ?? 0);
      try {
        const result = await this.paymentService.processPayment(
          {
            orderId: child.orderId,
            paymentMode: "full",
            amount,
            expectedTotal: amount,
            closeOrder: false,
            method: input.method,
            gateway: input.method,
          },
          {
            country: input.country,
            currency: input.currency,
            idempotencyKey: `${parentIdempotencyKey}:${child.orderId}`,
            customerInfo: input.customerInfo,
            metadata: {
              source: "market-checkouts",
              marketCheckoutId: input.checkoutId,
              marketSlug: input.marketSlug,
              restaurantId: child.restaurantId,
              splitMode: "child_transactions",
            },
          },
        );

        childPaymentsByOrderId.set(child.orderId, {
          restaurantId: child.restaurantId,
          restaurantName: child.restaurantName,
          orderId: child.orderId,
          orderNumber: child.orderNumber,
          paymentId: result.data.paymentId,
          status: "paid",
          amount: result.data.authorizedTotal,
          amountCents: Math.round(result.data.authorizedTotal * 100),
        });
      } catch (error) {
        childPaymentsByOrderId.set(child.orderId, {
          restaurantId: child.restaurantId,
          restaurantName: child.restaurantName,
          orderId: child.orderId,
          orderNumber: child.orderNumber,
          status: "failed",
          amount,
          amountCents: Math.round(amount * 100),
          errorMessage:
            error instanceof Error
              ? error.message
              : "Payment processing failed",
        });
      }
    }

    return {
      provider: input.method,
      splitMode: "child_transactions",
      idempotencyKey: parentIdempotencyKey,
      childPayments: input.childOrders
        .map((child) => childPaymentsByOrderId.get(child.orderId))
        .filter((payment): payment is MarketCheckoutChildPayment =>
          Boolean(payment),
        ),
    };
  }
}

export function createMarketCheckoutPaymentProvider(
  env: Env,
): MarketCheckoutPaymentProvider {
  return new ChildTransactionMarketCheckoutPaymentProvider(env);
}
