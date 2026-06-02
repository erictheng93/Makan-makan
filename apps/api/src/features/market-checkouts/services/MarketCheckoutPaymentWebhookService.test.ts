import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../../types/env";
import { MarketCheckoutPaymentWebhookService } from "./MarketCheckoutPaymentWebhookService";
import {
  mockMarketCheckoutProviderPaidWebhookPayload,
  signMockMarketCheckoutWebhook,
} from "../testing/mockMarketCheckoutProviderContract";

function createEnv(options: {
  auditInserted?: boolean;
  paymentRow?: Record<string, unknown> | null;
  cachedSession?: Record<string, unknown> | null;
  cachedIndex?: Array<Record<string, unknown>>;
}): Env {
  const kv = new Map<string, string>();
  if (options.cachedSession) {
    kv.set(
      `market_checkout:${options.paymentRow?.checkout_id ?? "checkout-1"}`,
      JSON.stringify(options.cachedSession),
    );
  }
  if (options.cachedIndex) {
    kv.set("market_checkout:index", JSON.stringify(options.cachedIndex));
  }

  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...params: unknown[]) => ({
        first: vi.fn(async () => {
          if (sql.includes("FROM market_checkout_payments")) {
            return options.paymentRow ?? null;
          }
          return null;
        }),
        run: vi.fn(async () => ({
          meta: {
            changes: sql.includes("INSERT OR IGNORE INTO payment_audit_log")
              ? options.auditInserted === false
                ? 0
                : 1
              : 1,
          },
          params,
        })),
      })),
    })),
  };

  return {
    NODE_ENV: "test",
    JWT_SECRET: "test",
    API_VERSION: "v1",
    ENCRYPTION_KEY: "test",
    MARKET_CHECKOUT_WEBHOOK_SECRET: "market-secret",
    DB: db,
    CACHE_KV: {
      get: vi.fn(async (key: string) => kv.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        kv.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        kv.delete(key);
      }),
    },
  } as unknown as Env;
}

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    payment_id: "market_pay_checkout-1",
    checkout_id: "checkout-1",
    market_id: "market-1",
    provider: "stripe",
    split_mode: "provider_split",
    idempotency_key: "market-checkout:checkout-1",
    status: "pending",
    amount_cents: 12500,
    paid_amount_cents: 0,
    refunded_amount_cents: 0,
    currency: "TWD",
    country_code: "TW",
    child_payment_ids: JSON.stringify(["pi_1:1001", "pi_1:1002"]),
    provider_transaction_id: null,
    provider_payload: JSON.stringify({ source: "market-checkouts" }),
    created_at_ms: Date.parse("2026-06-01T10:00:00.000Z"),
    updated_at_ms: Date.parse("2026-06-01T10:00:00.000Z"),
    session_payment_summary: JSON.stringify({
      status: "pending",
      method: "stripe",
      currency: "TWD",
      country: "TW",
      totalAmount: 125,
      totalAmountCents: 12500,
      paidAmount: 0,
      paidAmountCents: 0,
      childPayments: [],
    }),
    ...overrides,
  };
}

async function stripeSignature(secret: string, rawBody: string) {
  const timestamp = "1780308000";
  const signature = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  return `t=${timestamp},v1=${signature}`;
}

describe("MarketCheckoutPaymentWebhookService", () => {
  it("reconciles a signed provider payment event into parent ledger and session summary", async () => {
    const rawBody = JSON.stringify({
      id: "evt_1",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_1",
          amount_received: 12500,
          metadata: {
            marketCheckoutId: "checkout-1",
          },
        },
      },
    });
    const env = createEnv({
      paymentRow: paymentRow(),
      cachedSession: {
        id: "checkout-1",
        payment: { status: "pending" },
      },
      cachedIndex: [
        {
          id: "checkout-1",
          paymentStatus: "pending",
          updatedAt: "2026-06-01T10:00:00.000Z",
        },
      ],
    });
    const headers = new Headers({
      "stripe-signature": await stripeSignature("market-secret", rawBody),
    });

    const result = await new MarketCheckoutPaymentWebhookService(env).handle(
      "stripe",
      rawBody,
      headers,
    );

    expect(result).toMatchObject({
      duplicate: false,
      reconciled: true,
      checkoutId: "checkout-1",
      paymentId: "market_pay_checkout-1",
      status: "paid",
    });

    const prepareCalls = vi.mocked(env.DB.prepare).mock.calls;
    const paymentUpdateIndex = prepareCalls.findIndex(([sql]) =>
      sql.includes("UPDATE market_checkout_payments"),
    );
    const sessionUpdateIndex = prepareCalls.findIndex(([sql]) =>
      sql.includes("UPDATE market_checkout_sessions"),
    );
    expect(paymentUpdateIndex).toBeGreaterThanOrEqual(0);
    expect(sessionUpdateIndex).toBeGreaterThanOrEqual(0);

    const paymentUpdate = vi.mocked(env.DB.prepare).mock.results[
      paymentUpdateIndex
    ]?.value;
    expect(paymentUpdate.bind).toHaveBeenCalledWith(
      "paid",
      12500,
      0,
      "pi_1",
      expect.stringContaining('"eventId":"evt_1"'),
      expect.any(Number),
      "paid",
      expect.any(Number),
      "paid",
      expect.any(Number),
      "paid",
      expect.any(Number),
      "market_pay_checkout-1",
    );

    const sessionUpdate = vi.mocked(env.DB.prepare).mock.results[
      sessionUpdateIndex
    ]?.value;
    const sessionParams = vi.mocked(sessionUpdate.bind).mock.calls[0];
    const paymentSummary = JSON.parse(String(sessionParams?.[1])) as {
      status: string;
      paidAmountCents: number;
      parentPayment: { providerTransactionId: string };
    };
    expect(paymentSummary).toMatchObject({
      status: "paid",
      paidAmountCents: 12500,
      parentPayment: {
        providerTransactionId: "pi_1",
      },
    });
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "market_checkout:checkout-1",
      expect.stringContaining('"status":"paid"'),
      { expirationTtl: 14400 },
    );
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "market_checkout:index",
      expect.stringContaining('"paymentStatus":"paid"'),
      { expirationTtl: 14400 },
    );
  });

  it("deduplicates provider events through payment audit log", async () => {
    const rawBody = JSON.stringify({
      id: "evt_duplicate",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_duplicate",
          metadata: { marketCheckoutId: "checkout-1" },
        },
      },
    });
    const env = createEnv({
      auditInserted: false,
      paymentRow: paymentRow(),
    });

    const result = await new MarketCheckoutPaymentWebhookService(env).handle(
      "stripe",
      rawBody,
      new Headers({
        "stripe-signature": await stripeSignature("market-secret", rawBody),
      }),
    );

    expect(result).toMatchObject({
      duplicate: true,
      reconciled: false,
    });
    expect(
      vi
        .mocked(env.DB.prepare)
        .mock.calls.some(([sql]) =>
          sql.includes("UPDATE market_checkout_payments"),
        ),
    ).toBe(false);
  });

  it("reconciles the mock provider paid webhook fixture", async () => {
    const rawBody = JSON.stringify(
      mockMarketCheckoutProviderPaidWebhookPayload,
    );
    const env = createEnv({
      paymentRow: paymentRow({
        provider: "mock_market_provider",
        amount_cents: 24000,
        provider_transaction_id: "intent-market-checkout-1",
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
      }),
    });
    const headers = new Headers({
      "x-webhook-signature": await signMockMarketCheckoutWebhook(
        "market-secret",
        rawBody,
      ),
    });

    const result = await new MarketCheckoutPaymentWebhookService(env).handle(
      "mock_market_provider",
      rawBody,
      headers,
    );

    expect(result).toMatchObject({
      provider: "mock_market_provider",
      eventId: "evt-market-checkout-paid-1",
      eventType: "market_checkout.payment_paid",
      reconciled: true,
      status: "paid",
    });
  });

  it("rejects invalid provider signatures", async () => {
    const env = createEnv({
      paymentRow: paymentRow(),
    });

    await expect(
      new MarketCheckoutPaymentWebhookService(env).handle(
        "stripe",
        JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" }),
        new Headers({ "x-webhook-signature": "bad-signature" }),
      ),
    ).rejects.toThrow("Invalid webhook signature");
  });
});

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
