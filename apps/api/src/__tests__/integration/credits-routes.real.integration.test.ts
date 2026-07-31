/**
 * Real-D1 tests for the credits HTTP routes (代幣 stored-value API).
 *
 * Exercises the full Hono app (auth, validation, rate-limit, idempotency)
 * against a Miniflare D1 database:
 *   - public rate-limited balance lookup
 *   - admin-only issue / topup with idempotency
 *   - auth gating and validation errors
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import { CreditService } from "../../features/credits/services/CreditService";

let testApp: RealIntegrationTestApp;

const CSRF = "a".repeat(64);
const CSRF_HEADERS = {
  host: "test",
  origin: "https://test",
  cookie: `csrf_token=${CSRF}`,
  "x-csrf-token": CSRF,
};

async function adminAuth(): Promise<Record<string, string>> {
  const token = await testApp.authHelper.adminToken();
  return { authorization: `Bearer ${token}`, ...CSRF_HEADERS };
}

// app.fetch (not app.request) so the test-app Proxy injects env.
function call(path: string, init?: RequestInit): Promise<Response> {
  return Promise.resolve(
    testApp.app.fetch(new Request(`https://test${path}`, init)),
  );
}

beforeAll(async () => {
  // Stored-value credits ship switched off: zero accounts and no frontend
  // caller in production, and money code that has never settled a real
  // transaction should not be reachable. This suite is what exercises it, so
  // it turns the feature on for itself.
  testApp = await createRealIntegrationTestApp({
    env: { STORED_VALUE_CREDITS_ENABLED: "true" } as never,
  });
});

afterAll(async () => {
  await testApp.dispose();
});

beforeEach(async () => {
  await testApp.testDb.truncateAll();
  await buildSeedHelpers(testApp.testDb).user({ id: 1, role: 0 });
});

describe("credits routes — public balance", () => {
  it("returns balance for a card without auth", async () => {
    const card = await new CreditService(testApp.env).issueCard({
      currency: "TWD",
      initialBalanceCents: 2500,
    });

    const res = await call(`/api/v1/credits/cards/${card.publicId}/balance`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: { balanceCents: number; currency: string };
    };
    expect(json.success).toBe(true);
    expect(json.data).toMatchObject({ balanceCents: 2500, currency: "TWD" });
  });

  it("returns 404 for an unknown card", async () => {
    const res = await call("/api/v1/credits/cards/does-not-exist/balance");
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("CREDIT_CARD_NOT_FOUND");
  });
});

describe("credits routes — admin gating", () => {
  it("rejects card issuance without auth", async () => {
    const res = await call("/api/v1/credits/cards", {
      method: "POST",
      headers: { "content-type": "application/json", ...CSRF_HEADERS },
      body: JSON.stringify({ currency: "TWD" }),
    });
    expect([401, 403]).toContain(res.status);
  });

  it("issues a card for an admin", async () => {
    const res = await call("/api/v1/credits/cards", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await adminAuth()) },
      body: JSON.stringify({ currency: "TWD" }),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      success: boolean;
      data: { publicId: string; currency: string };
    };
    expect(json.data).toMatchObject({
      currency: "TWD",
      publicId: expect.any(String),
    });
  });

  it("rejects an invalid currency", async () => {
    const res = await call("/api/v1/credits/cards", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await adminAuth()) },
      body: JSON.stringify({ currency: "USD" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("credits routes — topup idempotency", () => {
  it("requires an Idempotency-Key for topup", async () => {
    const card = await new CreditService(testApp.env).issueCard({
      currency: "TWD",
    });
    const res = await call(`/api/v1/credits/cards/${card.publicId}/topup`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(await adminAuth()) },
      body: JSON.stringify({ amountCents: 1000, currency: "TWD" }),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("tops up once even when the request is replayed", async () => {
    const service = new CreditService(testApp.env);
    const card = await service.issueCard({ currency: "TWD" });
    const headers = {
      "content-type": "application/json",
      "Idempotency-Key": "topup-route-1",
      ...(await adminAuth()),
    };
    const body = JSON.stringify({ amountCents: 1500, currency: "TWD" });

    const first = await call(`/api/v1/credits/cards/${card.publicId}/topup`, {
      method: "POST",
      headers,
      body,
    });
    const second = await call(`/api/v1/credits/cards/${card.publicId}/topup`, {
      method: "POST",
      headers,
      body,
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await service.getBalance(card.publicId)).balanceCents).toBe(1500);
  });
});

describe("credits routes — online topup", () => {
  it("is public, validated, and reaches the service (no provider configured)", async () => {
    const card = await new CreditService(testApp.env).issueCard({
      currency: "TWD",
    });
    // No CREDIT_TOPUP_PROVIDER_URL in the test env → the service rejects with a
    // configuration error, proving the public route is mounted and wired.
    const res = await call(
      `/api/v1/credits/cards/${card.publicId}/topup/online`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...CSRF_HEADERS },
        body: JSON.stringify({ amountCents: 5000, currency: "TWD" }),
      },
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("CREDIT_TOPUP_NOT_CONFIGURED");
  });

  it("validates the request body", async () => {
    const card = await new CreditService(testApp.env).issueCard({
      currency: "TWD",
    });
    const res = await call(
      `/api/v1/credits/cards/${card.publicId}/topup/online`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...CSRF_HEADERS },
        body: JSON.stringify({ amountCents: -1, currency: "TWD" }),
      },
    );
    expect(res.status).toBe(400);
  });
});

describe("credits routes — accounting export", () => {
  it("returns the credit liability sub-ledger as CSV for an admin", async () => {
    const card = await new CreditService(testApp.env).issueCard({
      currency: "TWD",
      initialBalanceCents: 5000,
    });

    const res = await call("/api/v1/credits/accounting/export", {
      headers: await adminAuth(),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");

    const body = await res.text();
    expect(body).toContain("account_code");
    expect(body).toContain("2100");
    expect(body).toContain("credits_liability");
    expect(body).toContain(card.accountId); // the opening-balance entry
  });

  it("rejects export without admin auth", async () => {
    const res = await call("/api/v1/credits/accounting/export");
    expect([401, 403]).toContain(res.status);
  });
});
