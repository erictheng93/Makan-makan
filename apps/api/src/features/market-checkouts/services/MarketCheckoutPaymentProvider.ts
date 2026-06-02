import type { Env } from "../../../types/env";
import { PaymentService } from "../../payments/services/PaymentService";

export type MarketCheckoutChildPaymentStatus = "paid" | "failed" | "refunded";
export type MarketCheckoutSplitMode = "child_transactions" | "provider_split";
export type MarketCheckoutPaymentProviderReadiness =
  | "ready"
  | "warning"
  | "not_configured";
export type MarketCheckoutProviderAdapterOperation =
  | "create_payment"
  | "status_lookup"
  | "webhook_verification"
  | "refund";

export const MARKET_CHECKOUT_PROVIDER_ADAPTER_OPERATIONS = [
  "create_payment",
  "status_lookup",
  "webhook_verification",
  "refund",
] as const satisfies readonly MarketCheckoutProviderAdapterOperation[];

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
  providerInput?: Record<string, unknown>;
  requestIdempotencyKey?: string;
}

export interface MarketCheckoutPaymentProviderResult {
  provider: string;
  splitMode: MarketCheckoutSplitMode;
  idempotencyKey: string;
  paymentStatus?: "paid" | "pending";
  childPayments: MarketCheckoutChildPayment[];
  providerTransactionId?: string;
  nextAction?: MarketCheckoutProviderNextAction;
}

export interface MarketCheckoutPaymentProvider {
  process(
    input: MarketCheckoutPaymentProviderInput,
  ): Promise<MarketCheckoutPaymentProviderResult>;
}

export interface MarketCheckoutPaymentProviderStatus {
  splitMode: MarketCheckoutSplitMode;
  readiness: MarketCheckoutPaymentProviderReadiness;
  providerKind: "internal_child_transactions" | "http_provider_split";
  providerSplitUrlConfigured: boolean;
  providerSplitHealthUrlConfigured: boolean;
  providerStatusUrlConfigured: boolean;
  providerSplitTokenConfigured: boolean;
  providerSplitSigningConfigured: boolean;
  providerWebhookSecretConfigured: boolean;
  capabilities: string[];
  missingConfiguration: string[];
  notes: string[];
}

export interface MarketCheckoutPaymentProviderConnectivityCheck {
  status: "passed" | "skipped" | "failed";
  checkedAt: string;
  splitMode: MarketCheckoutSplitMode;
  target?: string;
  message: string;
  responseStatus?: number;
  capabilities?: string[];
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
  providerInput?: Record<string, unknown>;
  allocations: MarketCheckoutProviderSplitAllocation[];
}

export interface MarketCheckoutProviderSplitGatewayResult {
  provider: string;
  providerTransactionId: string;
  status?: "paid" | "pending" | "requires_action";
  authorizedAmountCents: number;
  allocations: Array<
    Pick<MarketCheckoutProviderSplitAllocation, "orderId"> & {
      paymentId?: string;
      amountCents: number;
    }
  >;
  nextAction?: MarketCheckoutProviderNextAction;
}

export interface MarketCheckoutProviderSplitStatusInput {
  checkoutId: string;
  paymentId: string;
  provider: string;
  providerTransactionId?: string;
  idempotencyKey?: string;
  amountCents: number;
  currency?: string;
  country?: string;
}

export interface MarketCheckoutProviderSplitStatusResult {
  provider: string;
  providerTransactionId?: string;
  status: "paid" | "pending" | "failed" | "refunded" | "partial_refunded";
  amountReceivedCents?: number;
  amountRefundedCents?: number;
  currency?: string;
  eventId?: string;
  eventType?: string;
  providerPayload?: Record<string, unknown>;
}

export interface MarketCheckoutProviderNextAction {
  type: "redirect" | "client_secret" | "sdk_confirmation";
  redirectUrl?: string;
  clientSecret?: string;
  expiresAt?: string;
  providerPayload?: Record<string, unknown>;
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
      providerInput: input.providerInput,
      allocations,
    });
    if (result.status === "pending" || result.status === "requires_action") {
      return {
        provider: result.provider,
        splitMode: "provider_split",
        idempotencyKey: parentIdempotencyKey,
        paymentStatus: "pending",
        providerTransactionId: result.providerTransactionId,
        childPayments: [],
        nextAction: result.nextAction,
      };
    }

    if (result.authorizedAmountCents !== amountCents) {
      throw new Error(
        "Provider split authorized amount does not match checkout total",
      );
    }

    const allocationByOrderId = validateProviderSplitAllocations(
      allocations,
      result.allocations,
    );

    return {
      provider: result.provider,
      splitMode: "provider_split",
      idempotencyKey: parentIdempotencyKey,
      paymentStatus: "paid",
      providerTransactionId: result.providerTransactionId,
      nextAction: result.nextAction,
      childPayments: input.childOrders.map((child) => {
        const allocation = allocationByOrderId.get(child.orderId)!;
        const amountCents = allocation.amountCents;

        return {
          restaurantId: child.restaurantId,
          restaurantName: child.restaurantName,
          orderId: child.orderId,
          orderNumber: child.orderNumber,
          paymentId:
            allocation.paymentId ??
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
    private readonly signingSecret?: string,
  ) {}

  async process(
    input: MarketCheckoutProviderSplitGatewayInput,
  ): Promise<MarketCheckoutProviderSplitGatewayResult> {
    const body = JSON.stringify(input);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(this.bearerToken
        ? { authorization: `Bearer ${this.bearerToken}` }
        : {}),
    };

    if (this.signingSecret) {
      const timestamp = new Date().toISOString();
      headers["x-market-checkout-signature-algorithm"] = "hmac-sha256";
      headers["x-market-checkout-signature-timestamp"] = timestamp;
      headers["x-market-checkout-signature"] =
        await signMarketCheckoutProviderSplitPayload(
          this.signingSecret,
          timestamp,
          body,
        );
    }

    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers,
      body,
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
            fetch,
            env.MARKET_CHECKOUT_PROVIDER_SPLIT_SIGNING_SECRET,
          )
        : new UnconfiguredProviderSplitGateway(),
    );
  }

  return new ChildTransactionMarketCheckoutPaymentProvider(env);
}

export function getMarketCheckoutPaymentProviderStatus(
  env: Env,
): MarketCheckoutPaymentProviderStatus {
  const splitMode =
    env.MARKET_CHECKOUT_SPLIT_MODE === "provider_split"
      ? "provider_split"
      : "child_transactions";
  const providerSplitUrlConfigured = Boolean(
    env.MARKET_CHECKOUT_PROVIDER_SPLIT_URL,
  );
  const providerSplitHealthUrlConfigured = Boolean(
    env.MARKET_CHECKOUT_PROVIDER_SPLIT_HEALTH_URL,
  );
  const providerStatusUrlConfigured = Boolean(
    env.MARKET_CHECKOUT_PROVIDER_STATUS_URL,
  );
  const providerSplitTokenConfigured = Boolean(
    env.MARKET_CHECKOUT_PROVIDER_SPLIT_TOKEN,
  );
  const providerSplitSigningConfigured = Boolean(
    env.MARKET_CHECKOUT_PROVIDER_SPLIT_SIGNING_SECRET,
  );
  const providerWebhookSecretConfigured = Boolean(
    env.MARKET_CHECKOUT_WEBHOOK_SECRET,
  );

  if (splitMode === "provider_split") {
    const missingConfiguration: string[] = [];
    if (!providerSplitUrlConfigured) {
      missingConfiguration.push("MARKET_CHECKOUT_PROVIDER_SPLIT_URL");
    }
    if (providerSplitUrlConfigured && !providerWebhookSecretConfigured) {
      missingConfiguration.push("MARKET_CHECKOUT_WEBHOOK_SECRET");
    }
    if (providerSplitUrlConfigured && !providerStatusUrlConfigured) {
      missingConfiguration.push("MARKET_CHECKOUT_PROVIDER_STATUS_URL");
    }
    const providerCapabilities = [
      ...MARKET_CHECKOUT_PROVIDER_ADAPTER_OPERATIONS,
      "aggregate_authorization",
      "provider_allocations",
      "health_check",
      "webhook_status_sync",
      "provider_status_lookup",
      "refunds",
    ];
    if (providerSplitSigningConfigured) {
      providerCapabilities.push("signed_requests");
    }
    if (providerWebhookSecretConfigured) {
      providerCapabilities.push("signed_webhooks");
    }

    return {
      splitMode,
      readiness: !providerSplitUrlConfigured
        ? "not_configured"
        : providerWebhookSecretConfigured && providerStatusUrlConfigured
          ? "ready"
          : "warning",
      providerKind: "http_provider_split",
      providerSplitUrlConfigured,
      providerSplitHealthUrlConfigured,
      providerStatusUrlConfigured,
      providerSplitTokenConfigured,
      providerSplitSigningConfigured,
      providerWebhookSecretConfigured,
      capabilities: providerSplitUrlConfigured
        ? providerCapabilities
        : ["webhook_status_sync", "refunds"],
      missingConfiguration,
      notes: providerSplitUrlConfigured
        ? [
            providerSplitTokenConfigured
              ? "Provider split gateway is configured with bearer-token authentication."
              : "Provider split gateway is configured without bearer-token authentication.",
            providerSplitSigningConfigured
              ? "Provider split gateway requests are signed with HMAC-SHA256."
              : "Provider split gateway requests are not signed; configure a signing secret before production use.",
            providerWebhookSecretConfigured
              ? "Market checkout webhooks are verified with MARKET_CHECKOUT_WEBHOOK_SECRET."
              : "Market checkout webhook verification secret is not configured; payment status callbacks will be rejected.",
            providerStatusUrlConfigured
              ? "Provider status lookup URL is configured for manual reconciliation."
              : "Provider status lookup URL is not configured; manual reconciliation will be unavailable.",
            providerSplitHealthUrlConfigured
              ? "Provider split health check URL is configured."
              : "Provider split health check URL is not configured; connectivity is not verified.",
          ]
        : [
            "Provider split mode is enabled but no HTTP gateway URL is configured.",
          ],
    };
  }

  return {
    splitMode,
    readiness: "warning",
    providerKind: "internal_child_transactions",
    providerSplitUrlConfigured,
    providerSplitHealthUrlConfigured,
    providerStatusUrlConfigured,
    providerSplitTokenConfigured,
    providerSplitSigningConfigured,
    providerWebhookSecretConfigured,
    capabilities: [
      "child_order_payments",
      "idempotency",
      "webhook_status_sync",
      "refunds",
    ],
    missingConfiguration: [],
    notes: [
      "Market checkouts are charged as child order transactions; configure provider_split for one aggregate provider authorization.",
    ],
  };
}

export async function signMarketCheckoutProviderSplitPayload(
  secret: string,
  timestamp: string,
  body: string,
) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${body}`),
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function checkMarketCheckoutPaymentProviderConnectivity(
  env: Env,
  fetcher: typeof fetch = fetch,
): Promise<MarketCheckoutPaymentProviderConnectivityCheck> {
  const status = getMarketCheckoutPaymentProviderStatus(env);
  const checkedAt = new Date().toISOString();

  if (status.splitMode !== "provider_split") {
    return {
      status: "skipped",
      checkedAt,
      splitMode: status.splitMode,
      message:
        "Provider split connectivity check is skipped because child transaction mode is active.",
    };
  }
  if (!env.MARKET_CHECKOUT_PROVIDER_SPLIT_URL) {
    return {
      status: "failed",
      checkedAt,
      splitMode: status.splitMode,
      message: "Provider split gateway URL is not configured.",
    };
  }
  if (!env.MARKET_CHECKOUT_PROVIDER_SPLIT_HEALTH_URL) {
    return {
      status: "skipped",
      checkedAt,
      splitMode: status.splitMode,
      target: env.MARKET_CHECKOUT_PROVIDER_SPLIT_URL,
      message:
        "Provider split gateway URL is configured, but no health check URL is configured.",
    };
  }

  const target = env.MARKET_CHECKOUT_PROVIDER_SPLIT_HEALTH_URL;
  try {
    const response = await fetcher(target, {
      method: "GET",
      headers: {
        ...(env.MARKET_CHECKOUT_PROVIDER_SPLIT_TOKEN
          ? {
              authorization: `Bearer ${env.MARKET_CHECKOUT_PROVIDER_SPLIT_TOKEN}`,
            }
          : {}),
      },
    });
    if (!response.ok) {
      return {
        status: "failed",
        checkedAt,
        splitMode: status.splitMode,
        target,
        responseStatus: response.status,
        message: `Provider split health check failed: ${response.status}`,
      };
    }

    const payload = await parseProviderHealthPayload(response);
    return {
      status: "passed",
      checkedAt,
      splitMode: status.splitMode,
      target,
      responseStatus: response.status,
      capabilities: payload.capabilities,
      message: payload.message ?? "Provider split health check passed.",
    };
  } catch (error) {
    return {
      status: "failed",
      checkedAt,
      splitMode: status.splitMode,
      target,
      message:
        error instanceof Error
          ? error.message
          : "Provider split health check failed.",
    };
  }
}

export async function queryMarketCheckoutProviderSplitStatus(
  env: Env,
  input: MarketCheckoutProviderSplitStatusInput,
  fetcher: typeof fetch = fetch,
): Promise<MarketCheckoutProviderSplitStatusResult> {
  if (env.MARKET_CHECKOUT_SPLIT_MODE !== "provider_split") {
    throw new Error(
      "Market checkout provider status reconciliation requires provider_split mode",
    );
  }
  if (!env.MARKET_CHECKOUT_PROVIDER_STATUS_URL) {
    throw new Error("Market checkout provider status URL is not configured");
  }

  const body = JSON.stringify(input);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(env.MARKET_CHECKOUT_PROVIDER_SPLIT_TOKEN
      ? {
          authorization: `Bearer ${env.MARKET_CHECKOUT_PROVIDER_SPLIT_TOKEN}`,
        }
      : {}),
  };
  if (env.MARKET_CHECKOUT_PROVIDER_SPLIT_SIGNING_SECRET) {
    const timestamp = new Date().toISOString();
    headers["x-market-checkout-signature-algorithm"] = "hmac-sha256";
    headers["x-market-checkout-signature-timestamp"] = timestamp;
    headers["x-market-checkout-signature"] =
      await signMarketCheckoutProviderSplitPayload(
        env.MARKET_CHECKOUT_PROVIDER_SPLIT_SIGNING_SECRET,
        timestamp,
        body,
      );
  }

  const response = await fetcher(env.MARKET_CHECKOUT_PROVIDER_STATUS_URL, {
    method: "POST",
    headers,
    body,
  });
  if (!response.ok) {
    throw new Error(
      `Market checkout provider status lookup failed: ${response.status}`,
    );
  }

  return parseHttpStatusResult(
    (await response.json()) as Partial<MarketCheckoutProviderSplitStatusResult>,
  );
}

async function parseProviderHealthPayload(response: Response) {
  try {
    const payload = (await response.json()) as {
      message?: unknown;
      capabilities?: unknown;
    };
    return {
      message:
        typeof payload.message === "string" ? payload.message : undefined,
      capabilities: Array.isArray(payload.capabilities)
        ? payload.capabilities.filter(
            (capability): capability is string =>
              typeof capability === "string",
          )
        : undefined,
    };
  } catch {
    return {};
  }
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
    status: isProviderSplitGatewayStatus(payload.status)
      ? payload.status
      : undefined,
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
    nextAction: parseProviderNextAction(payload.nextAction),
  };
}

function parseHttpStatusResult(
  payload: Partial<MarketCheckoutProviderSplitStatusResult>,
): MarketCheckoutProviderSplitStatusResult {
  if (!payload.provider || !payload.status) {
    throw new Error("Invalid provider status lookup response");
  }
  if (
    !["paid", "pending", "failed", "refunded", "partial_refunded"].includes(
      payload.status,
    )
  ) {
    throw new Error("Invalid provider status lookup payment status");
  }

  return {
    provider: payload.provider,
    providerTransactionId:
      typeof payload.providerTransactionId === "string"
        ? payload.providerTransactionId
        : undefined,
    status: payload.status,
    amountReceivedCents:
      typeof payload.amountReceivedCents === "number"
        ? Math.round(payload.amountReceivedCents)
        : undefined,
    amountRefundedCents:
      typeof payload.amountRefundedCents === "number"
        ? Math.round(payload.amountRefundedCents)
        : undefined,
    currency:
      typeof payload.currency === "string" ? payload.currency : undefined,
    eventId: typeof payload.eventId === "string" ? payload.eventId : undefined,
    eventType:
      typeof payload.eventType === "string" ? payload.eventType : undefined,
    providerPayload:
      payload.providerPayload && typeof payload.providerPayload === "object"
        ? payload.providerPayload
        : undefined,
  };
}

function isProviderSplitGatewayStatus(
  value: unknown,
): value is NonNullable<MarketCheckoutProviderSplitGatewayResult["status"]> {
  return value === "paid" || value === "pending" || value === "requires_action";
}

function parseProviderNextAction(
  value: unknown,
): MarketCheckoutProviderNextAction | undefined {
  if (!value || typeof value !== "object") return undefined;
  const action = value as Partial<MarketCheckoutProviderNextAction>;
  if (
    action.type !== "redirect" &&
    action.type !== "client_secret" &&
    action.type !== "sdk_confirmation"
  ) {
    return undefined;
  }

  return {
    type: action.type,
    redirectUrl:
      typeof action.redirectUrl === "string" ? action.redirectUrl : undefined,
    clientSecret:
      typeof action.clientSecret === "string" ? action.clientSecret : undefined,
    expiresAt:
      typeof action.expiresAt === "string" ? action.expiresAt : undefined,
    providerPayload:
      action.providerPayload && typeof action.providerPayload === "object"
        ? (action.providerPayload as Record<string, unknown>)
        : undefined,
  };
}

function validateProviderSplitAllocations(
  expectedAllocations: MarketCheckoutProviderSplitAllocation[],
  actualAllocations: MarketCheckoutProviderSplitGatewayResult["allocations"],
) {
  const actualByOrderId = new Map<
    number,
    MarketCheckoutProviderSplitGatewayResult["allocations"][number]
  >();

  for (const allocation of actualAllocations) {
    if (actualByOrderId.has(allocation.orderId)) {
      throw new Error("Provider split returned duplicate child allocation");
    }
    actualByOrderId.set(allocation.orderId, allocation);
  }

  for (const expected of expectedAllocations) {
    const actual = actualByOrderId.get(expected.orderId);
    if (!actual) {
      throw new Error("Provider split response is missing child allocation");
    }
    if (actual.amountCents !== expected.amountCents) {
      throw new Error("Provider split child allocation amount does not match");
    }
  }

  return actualByOrderId;
}
