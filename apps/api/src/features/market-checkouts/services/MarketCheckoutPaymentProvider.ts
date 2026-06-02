import type { Env } from "../../../types/env";
import { PaymentService } from "../../payments/services/PaymentService";

export type MarketCheckoutChildPaymentStatus = "paid" | "failed" | "refunded";
export type MarketCheckoutSplitMode = "child_transactions" | "provider_split";

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
  providerTransactionId?: string;
}

export interface MarketCheckoutPaymentProvider {
  process(
    input: MarketCheckoutPaymentProviderInput,
  ): Promise<MarketCheckoutPaymentProviderResult>;
}

export interface MarketCheckoutProviderSplitAllocation {
  restaurantId: string;
  restaurantName: string;
  orderId: number;
  orderNumber: string;
  amountCents: number;
}

export interface MarketCheckoutProviderSplitGatewayInput {
  checkoutId: string;
  marketSlug: string;
  method: string;
  country: "TW" | "MY" | "VN";
  currency: "TWD" | "MYR" | "VND";
  idempotencyKey: string;
  amountCents: number;
  customerInfo?: unknown;
  allocations: MarketCheckoutProviderSplitAllocation[];
}

export interface MarketCheckoutProviderSplitGatewayResult {
  provider: string;
  providerTransactionId: string;
  authorizedAmountCents: number;
  allocations: Array<
    Pick<MarketCheckoutProviderSplitAllocation, "orderId"> & {
      paymentId?: string;
      amountCents: number;
    }
  >;
}

export interface MarketCheckoutProviderSplitGateway {
  process(
    input: MarketCheckoutProviderSplitGatewayInput,
  ): Promise<MarketCheckoutProviderSplitGatewayResult>;
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

export class ProviderSplitMarketCheckoutPaymentProvider implements MarketCheckoutPaymentProvider {
  constructor(private readonly gateway: MarketCheckoutProviderSplitGateway) {}

  async process(
    input: MarketCheckoutPaymentProviderInput,
  ): Promise<MarketCheckoutPaymentProviderResult> {
    const parentIdempotencyKey =
      input.requestIdempotencyKey ?? `market-checkout:${input.checkoutId}`;
    const allocations = input.childOrders.map((child) => ({
      restaurantId: child.restaurantId,
      restaurantName: child.restaurantName,
      orderId: child.orderId,
      orderNumber: child.orderNumber,
      amountCents: Math.round(Number(child.totalAmount ?? 0) * 100),
    }));
    const amountCents = allocations.reduce(
      (sum, allocation) => sum + allocation.amountCents,
      0,
    );

    const result = await this.gateway.process({
      checkoutId: input.checkoutId,
      marketSlug: input.marketSlug,
      method: input.method,
      country: input.country,
      currency: input.currency,
      idempotencyKey: parentIdempotencyKey,
      amountCents,
      customerInfo: input.customerInfo,
      allocations,
    });
    if (result.authorizedAmountCents !== amountCents) {
      throw new Error(
        "Provider split authorized amount does not match checkout total",
      );
    }

    const allocationByOrderId = new Map(
      result.allocations.map((allocation) => [allocation.orderId, allocation]),
    );

    return {
      provider: result.provider,
      splitMode: "provider_split",
      idempotencyKey: parentIdempotencyKey,
      providerTransactionId: result.providerTransactionId,
      childPayments: input.childOrders.map((child) => {
        const allocation = allocationByOrderId.get(child.orderId);
        const amountCents =
          allocation?.amountCents ??
          Math.round(Number(child.totalAmount ?? 0) * 100);

        return {
          restaurantId: child.restaurantId,
          restaurantName: child.restaurantName,
          orderId: child.orderId,
          orderNumber: child.orderNumber,
          paymentId:
            allocation?.paymentId ??
            `${result.providerTransactionId}:${child.orderId}`,
          status: "paid" as const,
          amount: amountCents / 100,
          amountCents,
        };
      }),
    };
  }
}

class UnconfiguredProviderSplitGateway implements MarketCheckoutProviderSplitGateway {
  async process(): Promise<MarketCheckoutProviderSplitGatewayResult> {
    throw new Error("Market checkout provider split gateway is not configured");
  }
}

export class HttpProviderSplitGateway implements MarketCheckoutProviderSplitGateway {
  constructor(
    private readonly endpoint: string,
    private readonly bearerToken?: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async process(
    input: MarketCheckoutProviderSplitGatewayInput,
  ): Promise<MarketCheckoutProviderSplitGatewayResult> {
    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.bearerToken
          ? { authorization: `Bearer ${this.bearerToken}` }
          : {}),
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(
        `Market checkout provider split gateway failed: ${response.status}`,
      );
    }

    const payload =
      (await response.json()) as Partial<MarketCheckoutProviderSplitGatewayResult>;
    return parseHttpGatewayResult(payload);
  }
}

export function createMarketCheckoutPaymentProvider(
  env: Env,
): MarketCheckoutPaymentProvider {
  const splitMode = env.MARKET_CHECKOUT_SPLIT_MODE;
  if (splitMode === "provider_split") {
    return new ProviderSplitMarketCheckoutPaymentProvider(
      env.MARKET_CHECKOUT_PROVIDER_SPLIT_URL
        ? new HttpProviderSplitGateway(
            env.MARKET_CHECKOUT_PROVIDER_SPLIT_URL,
            env.MARKET_CHECKOUT_PROVIDER_SPLIT_TOKEN,
          )
        : new UnconfiguredProviderSplitGateway(),
    );
  }

  return new ChildTransactionMarketCheckoutPaymentProvider(env);
}

function parseHttpGatewayResult(
  payload: Partial<MarketCheckoutProviderSplitGatewayResult>,
): MarketCheckoutProviderSplitGatewayResult {
  if (
    !payload.provider ||
    !payload.providerTransactionId ||
    typeof payload.authorizedAmountCents !== "number" ||
    !Array.isArray(payload.allocations)
  ) {
    throw new Error(
      "Market checkout provider split gateway response is invalid",
    );
  }

  return {
    provider: payload.provider,
    providerTransactionId: payload.providerTransactionId,
    authorizedAmountCents: payload.authorizedAmountCents,
    allocations: payload.allocations.map((allocation) => {
      if (
        typeof allocation?.orderId !== "number" ||
        typeof allocation.amountCents !== "number"
      ) {
        throw new Error(
          "Market checkout provider split gateway allocation is invalid",
        );
      }

      return {
        orderId: allocation.orderId,
        paymentId: allocation.paymentId,
        amountCents: allocation.amountCents,
      };
    }),
  };
}
