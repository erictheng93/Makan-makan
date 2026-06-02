import { describe, expect, it, vi } from "vitest";
import { reconcilePendingMarketCheckoutPayments } from "./market-checkout-reconciliation";
import { mockMarketCheckoutProviderPaidStatusResponse } from "../features/market-checkouts/testing/mockMarketCheckoutProviderContract";

function createEnv(rows: unknown[]) {
  const kv = new Map<string, string>();
  const prepare = vi.fn((sql: string) => ({
    bind: vi.fn((..._args: unknown[]) => ({
      all: vi.fn(async () => {
        if (sql.includes("FROM market_checkout_payments")) {
          return { results: rows };
        }
        return { results: [] };
      }),
      first: vi.fn(async () => {
        if (sql.includes("FROM market_checkout_payments")) {
          return rows[0] ?? null;
        }
        return null;
      }),
      run: vi.fn(async () => ({ meta: { changes: 1 } })),
    })),
  }));

  return {
    DB: { prepare },
    CACHE_KV: {
      get: vi.fn(async (key: string) => kv.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        kv.set(key, value);
      }),
    },
    MARKET_CHECKOUT_SPLIT_MODE: "provider_split",
    MARKET_CHECKOUT_PROVIDER_STATUS_URL:
      "https://payments.example.test/market-split/status",
    MARKET_CHECKOUT_PROVIDER_SPLIT_TOKEN: "provider-token",
  };
}

describe("reconcilePendingMarketCheckoutPayments", () => {
  it("reconciles stale pending provider split payments through provider status lookup", async () => {
    const staleUpdatedAt = Date.parse("2026-06-01T10:00:00.000Z");
    const env = createEnv([
      {
        payment_id: "market_pay_checkout-1",
        checkout_id: "checkout-1",
        market_id: "market-1",
        provider: "mock_market_provider",
        split_mode: "provider_split",
        idempotency_key: "market-checkout:checkout-1",
        status: "pending",
        amount_cents: 24000,
        paid_amount_cents: 0,
        refunded_amount_cents: 0,
        currency: "TWD",
        country_code: "TW",
        child_payment_ids: JSON.stringify([]),
        provider_transaction_id: "intent-market-checkout-1",
        provider_payload: JSON.stringify({ source: "market-checkouts" }),
        created_at_ms: staleUpdatedAt - 60_000,
        updated_at_ms: staleUpdatedAt,
        session_payment_summary: JSON.stringify({
          status: "pending",
          method: "market_online",
          currency: "TWD",
          country: "TW",
          totalAmount: 240,
          totalAmountCents: 24000,
          paidAmount: 0,
          paidAmountCents: 0,
          childPayments: [],
        }),
      },
    ]);
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify(mockMarketCheckoutProviderPaidStatusResponse),
        ),
    );

    const result = await reconcilePendingMarketCheckoutPayments(env as never, {
      nowMs: Date.parse("2026-06-01T10:45:00.000Z"),
      pendingAfterMs: 30 * 60 * 1000,
      limit: 10,
      fetcher: fetcher as never,
    });

    expect(result).toMatchObject({
      scanned: 1,
      reconciled: 1,
      failed: 0,
      skipped: 0,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://payments.example.test/market-split/status",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer provider-token",
        }),
      }),
    );
    const request = fetcher.mock.calls[0]?.[1] as { body?: string } | undefined;
    expect(JSON.parse(request?.body ?? "{}")).toMatchObject({
      checkoutId: "checkout-1",
      paymentId: "market_pay_checkout-1",
      providerTransactionId: "intent-market-checkout-1",
    });
    expect(env.DB.prepare).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE market_checkout_payments"),
    );
  });

  it("skips when provider status lookup is not configured", async () => {
    const env = createEnv([]);
    delete (env as { MARKET_CHECKOUT_PROVIDER_STATUS_URL?: string })
      .MARKET_CHECKOUT_PROVIDER_STATUS_URL;

    await expect(
      reconcilePendingMarketCheckoutPayments(env as never),
    ).resolves.toMatchObject({
      scanned: 0,
      reconciled: 0,
      failed: 0,
      skipped: 0,
      skippedReason: "provider_status_lookup_not_configured",
    });
  });
});
