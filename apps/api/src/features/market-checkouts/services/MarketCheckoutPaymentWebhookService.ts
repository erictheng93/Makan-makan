import { PAYMENT_AUDIT_EVENT_TYPES } from "@makanmakan/database";
import type { Env } from "../../../types/env";
import { ApiError } from "../../../shared/utils/api-error";
import { PaymentAuditService } from "../../billing/services/PaymentAuditService";
import type { MarketCheckoutSplitMode } from "./MarketCheckoutPaymentProvider";

const MARKET_CHECKOUT_INDEX_KEY = "market_checkout:index";

type MarketCheckoutWebhookStatus =
  | "paid"
  | "failed"
  | "refunded"
  | "partial_refunded";

interface MarketCheckoutWebhookPayload {
  id?: string;
  type?: string;
  status?: string;
  amount?: number;
  amount_cents?: number;
  amount_received?: number;
  amount_refunded?: number;
  currency?: string;
  data?: {
    object?: {
      id?: string;
      status?: string;
      amount?: number;
      amount_received?: number;
      amount_refunded?: number;
      currency?: string;
      metadata?: Record<string, unknown>;
    };
  };
  metadata?: Record<string, unknown>;
}

interface MarketCheckoutPaymentRow {
  payment_id: string;
  checkout_id: string;
  market_id: string;
  provider: string;
  split_mode: MarketCheckoutSplitMode;
  idempotency_key: string | null;
  status: string;
  amount_cents: number;
  paid_amount_cents: number;
  refunded_amount_cents: number;
  currency: string | null;
  country_code: string | null;
  child_payment_ids: string | null;
  provider_transaction_id: string | null;
  provider_payload: string | null;
  created_at_ms: number;
  updated_at_ms: number;
  session_payment_summary: string | Record<string, unknown> | null;
}

export interface MarketCheckoutPaymentWebhookResult {
  provider: string;
  eventId: string | null;
  eventType: string;
  duplicate: boolean;
  reconciled: boolean;
  checkoutId?: string;
  paymentId?: string;
  status?: MarketCheckoutWebhookStatus;
}

export class MarketCheckoutPaymentWebhookService {
  constructor(private readonly env: Env) {}

  async handle(
    provider: string,
    rawBody: string,
    headers: Headers,
  ): Promise<MarketCheckoutPaymentWebhookResult> {
    await this.verifySignature(provider, rawBody, headers);

    const payload = JSON.parse(rawBody) as MarketCheckoutWebhookPayload;
    const eventId = eventIdFrom(payload, headers);
    const eventType = eventTypeFrom(payload, headers);
    const status = statusFrom(payload, eventType);
    if (!status) {
      return {
        provider,
        eventId,
        eventType,
        duplicate: false,
        reconciled: false,
      };
    }

    const identifiers = identifiersFrom(payload, headers);
    const audit = await new PaymentAuditService(this.env.DB).append({
      paymentTransactionId: identifiers.paymentId,
      eventType: PAYMENT_AUDIT_EVENT_TYPES.WEBHOOK_RECEIVED,
      provider,
      providerEventId: eventId,
      providerEventType: eventType,
      rawPayload: payload,
    });
    if (!audit.inserted) {
      return {
        provider,
        eventId,
        eventType,
        duplicate: true,
        reconciled: false,
      };
    }

    const row = await this.findPayment(identifiers);
    if (!row) {
      throw new ApiError(
        "MARKET_CHECKOUT_PAYMENT_NOT_FOUND",
        "Market checkout payment not found for webhook event",
        404,
      );
    }

    const now = Date.now();
    const amounts = amountsFrom(payload, row, status);
    const providerTransactionId =
      identifiers.providerTransactionId ?? row.provider_transaction_id;
    const providerPayload = mergeProviderPayload(row.provider_payload, {
      lastWebhook: {
        provider,
        eventId,
        eventType,
        status,
        receivedAt: new Date(now).toISOString(),
        payload,
      },
    });

    await this.env.DB.prepare(
      `UPDATE market_checkout_payments
          SET status = ?,
              paid_amount_cents = ?,
              refunded_amount_cents = ?,
              provider_transaction_id = COALESCE(?, provider_transaction_id),
              provider_payload = ?,
              updated_at_ms = ?,
              completed_at_ms = CASE WHEN ? = 'paid' THEN COALESCE(completed_at_ms, ?) ELSE completed_at_ms END,
              refunded_at_ms = CASE WHEN ? IN ('refunded', 'partial_refunded') THEN ? ELSE refunded_at_ms END,
              failed_at_ms = CASE WHEN ? = 'failed' THEN COALESCE(failed_at_ms, ?) ELSE failed_at_ms END
        WHERE payment_id = ?`,
    )
      .bind(
        status,
        amounts.paidAmountCents,
        amounts.refundedAmountCents,
        providerTransactionId,
        JSON.stringify(providerPayload),
        now,
        status,
        now,
        status,
        now,
        status,
        now,
        row.payment_id,
      )
      .run();

    const paymentSummary = updatePaymentSummary(row, {
      status,
      provider,
      providerTransactionId,
      paidAmountCents: amounts.paidAmountCents,
      refundedAmountCents: amounts.refundedAmountCents,
      updatedAtMs: now,
    });

    await this.env.DB.prepare(
      `UPDATE market_checkout_sessions
          SET payment_status = ?,
              payment_summary = ?,
              updated_at_ms = ?
        WHERE id = ?`,
    )
      .bind(status, JSON.stringify(paymentSummary), now, row.checkout_id)
      .run();

    await Promise.all([
      this.updateCachedSession(row.checkout_id, paymentSummary),
      this.updateCachedIndex(row.checkout_id, status),
    ]);

    return {
      provider,
      eventId,
      eventType,
      duplicate: false,
      reconciled: true,
      checkoutId: row.checkout_id,
      paymentId: row.payment_id,
      status,
    };
  }

  private async findPayment(identifiers: {
    paymentId?: string;
    checkoutId?: string;
    providerTransactionId?: string;
  }) {
    if (
      !identifiers.paymentId &&
      !identifiers.checkoutId &&
      !identifiers.providerTransactionId
    ) {
      throw new ApiError(
        "MARKET_CHECKOUT_PAYMENT_IDENTIFIER_REQUIRED",
        "Webhook event must include a checkout, payment, or provider transaction identifier",
        400,
      );
    }

    return this.env.DB.prepare(
      `SELECT p.payment_id, p.checkout_id, p.market_id, p.provider,
              p.split_mode, p.idempotency_key, p.status, p.amount_cents,
              p.paid_amount_cents, p.refunded_amount_cents, p.currency,
              p.country_code, p.child_payment_ids, p.provider_transaction_id,
              p.provider_payload, p.created_at_ms, p.updated_at_ms,
              s.payment_summary AS session_payment_summary
         FROM market_checkout_payments p
         JOIN market_checkout_sessions s ON s.id = p.checkout_id
        WHERE (? IS NOT NULL AND p.payment_id = ?)
           OR (? IS NOT NULL AND p.checkout_id = ?)
           OR (? IS NOT NULL AND p.provider_transaction_id = ?)
        ORDER BY p.updated_at_ms DESC
        LIMIT 1`,
    )
      .bind(
        identifiers.paymentId ?? null,
        identifiers.paymentId ?? null,
        identifiers.checkoutId ?? null,
        identifiers.checkoutId ?? null,
        identifiers.providerTransactionId ?? null,
        identifiers.providerTransactionId ?? null,
      )
      .first<MarketCheckoutPaymentRow>();
  }

  private async updateCachedSession(
    checkoutId: string,
    paymentSummary: Record<string, unknown>,
  ) {
    const key = `market_checkout:${checkoutId}`;
    const stored = await this.env.CACHE_KV.get(key);
    if (!stored) return;

    const parsed = JSON.parse(stored) as Record<string, unknown>;
    await this.env.CACHE_KV.put(
      key,
      JSON.stringify({
        ...parsed,
        payment: paymentSummary,
      }),
      { expirationTtl: 4 * 60 * 60 },
    );
  }

  private async updateCachedIndex(
    checkoutId: string,
    paymentStatus: MarketCheckoutWebhookStatus,
  ) {
    const stored = await this.env.CACHE_KV.get(MARKET_CHECKOUT_INDEX_KEY);
    if (!stored) return;

    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return;

    const updatedAt = new Date().toISOString();
    const nextIndex = parsed.map((item) => {
      if (!item || typeof item !== "object") return item;
      const checkout = item as Record<string, unknown>;
      if (checkout.id !== checkoutId) return item;

      return {
        ...checkout,
        paymentStatus,
        updatedAt,
      };
    });

    await this.env.CACHE_KV.put(
      MARKET_CHECKOUT_INDEX_KEY,
      JSON.stringify(nextIndex),
      { expirationTtl: 4 * 60 * 60 },
    );
  }

  private async verifySignature(
    provider: string,
    rawBody: string,
    headers: Headers,
  ) {
    if (provider === "linepay") {
      await this.verifyLinePaySignature(rawBody, headers);
      return;
    }

    const secret =
      this.env.MARKET_CHECKOUT_WEBHOOK_SECRET ??
      (provider === "stripe" ? this.env.STRIPE_WEBHOOK_SECRET : undefined);
    if (!secret) {
      throw new Error("Market checkout webhook secret is not configured");
    }

    const stripeSignature = headers.get("stripe-signature");
    const signature = stripeSignature
      ? parseStripeSignature(stripeSignature)
      : headers.get("x-webhook-signature");
    if (!signature) {
      throw new Error("Missing webhook signature");
    }

    const signedPayload = stripeSignature
      ? `${parseStripeTimestamp(stripeSignature)}.${rawBody}`
      : rawBody;
    const expected = await hmacSha256Hex(secret, signedPayload);
    if (signature !== expected) {
      throw new Error("Invalid webhook signature");
    }
  }

  private async verifyLinePaySignature(rawBody: string, headers: Headers) {
    const secret =
      this.env.MARKET_CHECKOUT_WEBHOOK_SECRET ??
      this.env.LINEPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error(
        "Market checkout LINE Pay webhook secret is not configured",
      );
    }

    const nonce = headers.get("x-linepay-nonce");
    const signature = headers.get("x-linepay-signature");
    if (!nonce || !signature) {
      throw new Error("Missing LINE Pay webhook signature");
    }

    const expected = await hmacSha256Base64(
      secret,
      `${secret}${rawBody}${nonce}`,
    );
    if (signature !== expected) {
      throw new Error("Invalid LINE Pay webhook signature");
    }
  }
}

function eventIdFrom(payload: MarketCheckoutWebhookPayload, headers: Headers) {
  return (
    headers.get("x-provider-event-id") ??
    payload.id ??
    payload.data?.object?.id ??
    null
  );
}

function eventTypeFrom(
  payload: MarketCheckoutWebhookPayload,
  headers: Headers,
) {
  return headers.get("x-provider-event-type") ?? payload.type ?? "unknown";
}

function identifiersFrom(
  payload: MarketCheckoutWebhookPayload,
  headers: Headers,
) {
  const metadata = {
    ...(payload.metadata ?? {}),
    ...(payload.data?.object?.metadata ?? {}),
  };

  return {
    paymentId: stringValue(
      headers.get("x-market-payment-id") ??
        metadata.marketCheckoutPaymentId ??
        metadata.market_checkout_payment_id,
    ),
    checkoutId: stringValue(
      headers.get("x-market-checkout-id") ??
        metadata.marketCheckoutId ??
        metadata.market_checkout_id,
    ),
    providerTransactionId: stringValue(
      headers.get("x-provider-transaction-id") ??
        payload.data?.object?.id ??
        metadata.providerTransactionId ??
        metadata.provider_transaction_id,
    ),
  };
}

function statusFrom(
  payload: MarketCheckoutWebhookPayload,
  eventType: string,
): MarketCheckoutWebhookStatus | null {
  const normalizedEventType = eventType.toLowerCase();
  if (
    [
      "market_checkout.payment_paid",
      "payment_intent.succeeded",
      "checkout.session.completed",
    ].includes(normalizedEventType)
  ) {
    return "paid";
  }
  if (
    [
      "market_checkout.payment_failed",
      "payment_intent.payment_failed",
      "charge.failed",
    ].includes(normalizedEventType)
  ) {
    return "failed";
  }
  if (
    [
      "market_checkout.payment_refunded",
      "charge.refunded",
      "refund.succeeded",
    ].includes(normalizedEventType)
  ) {
    return "refunded";
  }
  if (normalizedEventType === "market_checkout.payment_partial_refunded") {
    return "partial_refunded";
  }

  const rawStatus = (
    payload.status ??
    payload.data?.object?.status ??
    ""
  ).toLowerCase();
  if (["succeeded", "paid", "completed"].includes(rawStatus)) return "paid";
  if (["failed", "payment_failed"].includes(rawStatus)) return "failed";
  if (["refunded"].includes(rawStatus)) return "refunded";
  if (["partial_refunded", "partially_refunded"].includes(rawStatus)) {
    return "partial_refunded";
  }

  return null;
}

function amountsFrom(
  payload: MarketCheckoutWebhookPayload,
  row: MarketCheckoutPaymentRow,
  status: MarketCheckoutWebhookStatus,
) {
  const payloadAmountCents =
    numberValue(payload.amount_cents) ??
    numberValue(payload.amount_received) ??
    numberValue(payload.data?.object?.amount_received) ??
    numberValue(payload.amount) ??
    numberValue(payload.data?.object?.amount);
  const refundedAmountCents =
    numberValue(payload.amount_refunded) ??
    numberValue(payload.data?.object?.amount_refunded);

  if (status === "paid") {
    return {
      paidAmountCents: payloadAmountCents ?? row.amount_cents,
      refundedAmountCents: row.refunded_amount_cents,
    };
  }
  if (status === "refunded") {
    return {
      paidAmountCents: Math.max(row.paid_amount_cents, row.amount_cents),
      refundedAmountCents: refundedAmountCents ?? row.amount_cents,
    };
  }
  if (status === "partial_refunded") {
    return {
      paidAmountCents: Math.max(row.paid_amount_cents, row.amount_cents),
      refundedAmountCents:
        refundedAmountCents ?? Math.max(row.refunded_amount_cents, 0),
    };
  }

  return {
    paidAmountCents: row.paid_amount_cents,
    refundedAmountCents: row.refunded_amount_cents,
  };
}

function updatePaymentSummary(
  row: MarketCheckoutPaymentRow,
  input: {
    status: MarketCheckoutWebhookStatus;
    provider: string;
    providerTransactionId?: string | null;
    paidAmountCents: number;
    refundedAmountCents: number;
    updatedAtMs: number;
  },
) {
  const existing = parsePaymentSummary(row.session_payment_summary);
  const updatedAt = new Date(input.updatedAtMs).toISOString();
  const childPaymentIds = parseJsonStringArray(row.child_payment_ids);
  const payment = {
    ...existing,
    status: input.status,
    method: existing.method ?? row.provider,
    currency: existing.currency ?? row.currency ?? "TWD",
    country: existing.country ?? row.country_code ?? "TW",
    totalAmount: row.amount_cents / 100,
    totalAmountCents: row.amount_cents,
    paidAmount: input.paidAmountCents / 100,
    paidAmountCents: input.paidAmountCents,
    refundedAmount: input.refundedAmountCents / 100,
    refundedAmountCents: input.refundedAmountCents,
    childPayments: Array.isArray(existing.childPayments)
      ? existing.childPayments
      : [],
    parentPayment: {
      ...(typeof existing.parentPayment === "object" &&
      existing.parentPayment !== null
        ? existing.parentPayment
        : {}),
      paymentId: row.payment_id,
      status: input.status,
      provider: row.provider || input.provider,
      splitMode: row.split_mode,
      idempotencyKey:
        row.idempotency_key ?? `market-checkout:${row.checkout_id}`,
      providerTransactionId:
        input.providerTransactionId ?? row.provider_transaction_id ?? undefined,
      amountCents: row.amount_cents,
      paidAmountCents: input.paidAmountCents,
      refundedAmountCents: input.refundedAmountCents,
      childPaymentIds,
      createdAt: new Date(row.created_at_ms).toISOString(),
      updatedAt,
    },
  };

  if (input.status === "paid") {
    return { ...payment, paidAt: existing.paidAt ?? updatedAt };
  }
  if (input.status === "failed") {
    return { ...payment, failedAt: updatedAt };
  }
  if (input.status === "refunded" || input.status === "partial_refunded") {
    return { ...payment, refundedAt: updatedAt };
  }

  return payment;
}

function parsePaymentSummary(
  value: MarketCheckoutPaymentRow["session_payment_summary"],
) {
  if (!value) return {} as Record<string, unknown>;
  if (typeof value === "object") return value;

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function mergeProviderPayload(
  rawPayload: string | null,
  patch: Record<string, unknown>,
) {
  if (!rawPayload) return patch;

  try {
    const parsed = JSON.parse(rawPayload) as unknown;
    return parsed && typeof parsed === "object"
      ? { ...(parsed as Record<string, unknown>), ...patch }
      : patch;
  } catch {
    return patch;
  }
}

function parseJsonStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : undefined;
}

function parseStripeSignature(header: string) {
  return header
    .split(",")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === "v1")?.[1];
}

function parseStripeTimestamp(header: string) {
  return (
    header
      .split(",")
      .map((part) => part.trim().split("="))
      .find(([key]) => key === "t")?.[1] ?? ""
  );
}

async function hmacSha256Hex(secret: string, value: string) {
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
    encoder.encode(value),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Base64(secret: string, value: string) {
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
    encoder.encode(value),
  );
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
