import type { Env } from "../../../types/env";
import { ApiError } from "../../../shared/utils/api-error";
import type {
  MarketCheckoutProviderSplitStatusInput,
  MarketCheckoutProviderSplitStatusResult,
  MarketCheckoutSplitMode,
} from "./MarketCheckoutPaymentProvider";

const MARKET_CHECKOUT_INDEX_KEY = "market_checkout:index";

type MarketCheckoutReconciliationStatus =
  | "paid"
  | "pending"
  | "failed"
  | "refunded"
  | "partial_refunded";

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

export interface MarketCheckoutPaymentReconciliationResult {
  provider: string;
  checkoutId: string;
  paymentId: string;
  status: MarketCheckoutReconciliationStatus;
  providerTransactionId?: string;
  eventId?: string;
  eventType: string;
}

export class MarketCheckoutPaymentReconciliationService {
  private readonly lookupRows = new Map<string, MarketCheckoutPaymentRow>();

  constructor(private readonly env: Env) {}

  async getStatusLookupInput(
    checkoutId: string,
  ): Promise<MarketCheckoutProviderSplitStatusInput> {
    const row = await this.findPayment(checkoutId);
    if (!row) {
      throw new ApiError(
        "MARKET_CHECKOUT_PAYMENT_NOT_FOUND",
        "Market checkout payment not found for reconciliation",
        404,
      );
    }
    if (row.split_mode !== "provider_split") {
      throw new ApiError(
        "MARKET_CHECKOUT_RECONCILIATION_UNSUPPORTED",
        "Only provider split market checkout payments can be reconciled through the provider status endpoint",
        400,
      );
    }
    this.lookupRows.set(checkoutId, row);

    return {
      checkoutId: row.checkout_id,
      paymentId: row.payment_id,
      provider: row.provider,
      providerTransactionId: row.provider_transaction_id ?? undefined,
      idempotencyKey: row.idempotency_key ?? undefined,
      amountCents: row.amount_cents,
      currency: row.currency ?? undefined,
      country: row.country_code ?? undefined,
    };
  }

  async listPendingStatusLookupInputs(input: {
    updatedBeforeMs: number;
    limit: number;
  }): Promise<MarketCheckoutProviderSplitStatusInput[]> {
    const result = await this.env.DB.prepare(
      `SELECT p.payment_id, p.checkout_id, p.market_id, p.provider,
              p.split_mode, p.idempotency_key, p.status, p.amount_cents,
              p.paid_amount_cents, p.refunded_amount_cents, p.currency,
              p.country_code, p.child_payment_ids, p.provider_transaction_id,
              p.provider_payload, p.created_at_ms, p.updated_at_ms,
              s.payment_summary AS session_payment_summary
         FROM market_checkout_payments p
         JOIN market_checkout_sessions s ON s.id = p.checkout_id
        WHERE p.split_mode = 'provider_split'
          AND p.status = 'pending'
          AND p.updated_at_ms <= ?
        ORDER BY p.updated_at_ms ASC
        LIMIT ?`,
    )
      .bind(input.updatedBeforeMs, input.limit)
      .all<MarketCheckoutPaymentRow>();
    const rows = result.results ?? [];

    return rows.map((row) => {
      this.lookupRows.set(row.checkout_id, row);
      return {
        checkoutId: row.checkout_id,
        paymentId: row.payment_id,
        provider: row.provider,
        providerTransactionId: row.provider_transaction_id ?? undefined,
        idempotencyKey: row.idempotency_key ?? undefined,
        amountCents: row.amount_cents,
        currency: row.currency ?? undefined,
        country: row.country_code ?? undefined,
      };
    });
  }

  async reconcile(
    checkoutId: string,
    providerStatus: MarketCheckoutProviderSplitStatusResult,
  ): Promise<MarketCheckoutPaymentReconciliationResult> {
    const row =
      this.lookupRows.get(checkoutId) ?? (await this.findPayment(checkoutId));
    if (!row) {
      throw new ApiError(
        "MARKET_CHECKOUT_PAYMENT_NOT_FOUND",
        "Market checkout payment not found for reconciliation",
        404,
      );
    }
    if (row.split_mode !== "provider_split") {
      throw new ApiError(
        "MARKET_CHECKOUT_RECONCILIATION_UNSUPPORTED",
        "Only provider split market checkout payments can be reconciled through the provider status endpoint",
        400,
      );
    }
    if (providerStatus.provider !== row.provider) {
      throw new ApiError(
        "MARKET_CHECKOUT_RECONCILIATION_PROVIDER_MISMATCH",
        "Provider status response does not match the stored market checkout payment provider",
        409,
      );
    }

    const now = Date.now();
    const status = providerStatus.status;
    const paidAmountCents =
      status === "paid"
        ? (providerStatus.amountReceivedCents ?? row.amount_cents)
        : status === "refunded" || status === "partial_refunded"
          ? Math.max(row.paid_amount_cents, row.amount_cents)
          : row.paid_amount_cents;
    const refundedAmountCents =
      status === "refunded"
        ? (providerStatus.amountRefundedCents ?? row.amount_cents)
        : status === "partial_refunded"
          ? (providerStatus.amountRefundedCents ??
            Math.max(row.refunded_amount_cents, 0))
          : row.refunded_amount_cents;
    const providerTransactionId =
      providerStatus.providerTransactionId ?? row.provider_transaction_id;
    const eventType =
      providerStatus.eventType ?? `market_checkout.payment_${status}`;
    const providerPayload = mergeProviderPayload(row.provider_payload, {
      lastReconciliation: {
        provider: providerStatus.provider,
        eventId: providerStatus.eventId,
        eventType,
        status,
        receivedAt: new Date(now).toISOString(),
        payload: providerStatus.providerPayload ?? providerStatus,
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
        paidAmountCents,
        refundedAmountCents,
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
      providerTransactionId,
      paidAmountCents,
      refundedAmountCents,
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
      provider: row.provider,
      checkoutId: row.checkout_id,
      paymentId: row.payment_id,
      status,
      providerTransactionId: providerTransactionId ?? undefined,
      eventId: providerStatus.eventId,
      eventType,
    };
  }

  private async findPayment(checkoutId: string) {
    return this.env.DB.prepare(
      `SELECT p.payment_id, p.checkout_id, p.market_id, p.provider,
              p.split_mode, p.idempotency_key, p.status, p.amount_cents,
              p.paid_amount_cents, p.refunded_amount_cents, p.currency,
              p.country_code, p.child_payment_ids, p.provider_transaction_id,
              p.provider_payload, p.created_at_ms, p.updated_at_ms,
              s.payment_summary AS session_payment_summary
         FROM market_checkout_payments p
         JOIN market_checkout_sessions s ON s.id = p.checkout_id
        WHERE p.checkout_id = ?
        ORDER BY p.updated_at_ms DESC
        LIMIT 1`,
    )
      .bind(checkoutId)
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
    paymentStatus: MarketCheckoutReconciliationStatus,
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
}

function updatePaymentSummary(
  row: MarketCheckoutPaymentRow,
  input: {
    status: MarketCheckoutReconciliationStatus;
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
      provider: row.provider,
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
