/**
 * Real-D1 tests for online top-up (代幣線上儲值, Phase 2).
 *
 *   - createIntent → pending intent + provider next action
 *   - confirmIntent credits the balance once (idempotent on replay)
 *   - failed confirmation does not credit
 *   - webhook signature verification + duplicate-delivery handling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
} from "@makanmakan/database/testing";
import { creditLedgerEntries } from "@makanmakan/database";
import { eq } from "drizzle-orm";
import type { Env } from "../../types/env";
import { CreditService } from "../../features/credits/services/CreditService";
import {
  CreditTopupService,
  hmacSha256Hex,
  type CreditTopupGateway,
  type CreditTopupGatewayInput,
} from "../../features/credits/services/CreditTopupService";
import { CreditTopupWebhookService } from "../../features/credits/services/CreditTopupWebhookService";

let testDb: TestDatabase;

const WEBHOOK_SECRET = "topup-webhook-secret";

function buildEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: testDb.bindings.DB,
    CACHE_KV: testDb.bindings.CACHE_KV,
    CREDIT_TOPUP_WEBHOOK_SECRET: WEBHOOK_SECRET,
    ...overrides,
  } as Env;
}

class FakeGateway implements CreditTopupGateway {
  async createCharge(input: CreditTopupGatewayInput) {
    return {
      providerTransactionId: `ptxn-${input.intentId}`,
      status: "pending" as const,
      nextAction: {
        type: "redirect" as const,
        redirectUrl: "https://pay.example/checkout",
      },
    };
  }
}

function topupService(env = buildEnv()): CreditTopupService {
  return new CreditTopupService(env, new CreditService(env), new FakeGateway());
}

async function issueCard(env = buildEnv()) {
  return new CreditService(env).issueCard({ currency: "TWD" });
}

async function balanceOf(publicId: string): Promise<number> {
  return (await new CreditService(buildEnv()).getBalance(publicId))
    .balanceCents;
}

beforeAll(async () => {
  testDb = await createTestDatabase();
});

afterAll(async () => {
  await testDb.dispose();
});

beforeEach(async () => {
  await testDb.truncateAll();
});

describe("CreditTopupService — intent lifecycle", () => {
  it("creates a pending intent with provider next action", async () => {
    const card = await issueCard();
    const { intent, nextAction } = await topupService().createIntent({
      publicId: card.publicId,
      amountCents: 5000,
      currency: "TWD",
    });

    expect(intent).toMatchObject({
      status: "pending",
      amountCents: 5000,
      currency: "TWD",
      providerTransactionId: `ptxn-${intent.id}`,
    });
    expect(nextAction).toMatchObject({ type: "redirect" });
    expect(await balanceOf(card.publicId)).toBe(0); // not credited yet
  });

  it("credits the balance on paid confirmation and is idempotent on replay", async () => {
    const card = await issueCard();
    const service = topupService();
    const { intent } = await service.createIntent({
      publicId: card.publicId,
      amountCents: 5000,
      currency: "TWD",
    });

    const first = await service.confirmIntent({
      intentId: intent.id,
      status: "paid",
    });
    expect(first).toMatchObject({ credited: true, balanceAfterCents: 5000 });
    expect(await balanceOf(card.publicId)).toBe(5000);

    const replay = await service.confirmIntent({
      intentId: intent.id,
      status: "paid",
    });
    expect(replay.alreadyProcessed).toBe(true);
    expect(await balanceOf(card.publicId)).toBe(5000); // credited once

    const topups = (
      await testDb.drizzle
        .select()
        .from(creditLedgerEntries)
        .where(eq(creditLedgerEntries.accountId, card.accountId))
        .all()
    ).filter((e) => e.entryType === "topup");
    expect(topups).toHaveLength(1);
  });

  it("does not credit when the payment fails", async () => {
    const card = await issueCard();
    const service = topupService();
    const { intent } = await service.createIntent({
      publicId: card.publicId,
      amountCents: 5000,
      currency: "TWD",
    });

    const result = await service.confirmIntent({
      intentId: intent.id,
      status: "failed",
      errorMessage: "card declined",
    });
    expect(result.credited).toBe(false);
    expect(result.intent.status).toBe("failed");
    expect(await balanceOf(card.publicId)).toBe(0);
  });

  it("rejects online top-up when no provider is configured", async () => {
    const card = await issueCard();
    // Default gateway (no CREDIT_TOPUP_PROVIDER_URL) is unconfigured.
    const service = new CreditTopupService(buildEnv());
    await expect(
      service.createIntent({
        publicId: card.publicId,
        amountCents: 5000,
        currency: "TWD",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_TOPUP_NOT_CONFIGURED" });
  });
});

describe("CreditTopupWebhookService — signature + idempotency", () => {
  async function signedHeaders(body: string): Promise<Headers> {
    const timestamp = "2026-06-03T00:00:00.000Z";
    const signature = await hmacSha256Hex(
      WEBHOOK_SECRET,
      `${timestamp}.${body}`,
    );
    return new Headers({
      "content-type": "application/json",
      "x-credit-topup-signature": signature,
      "x-credit-topup-signature-timestamp": timestamp,
    });
  }

  it("credits the balance on a validly-signed paid webhook", async () => {
    const card = await issueCard();
    const { intent } = await topupService().createIntent({
      publicId: card.publicId,
      amountCents: 8000,
      currency: "TWD",
    });

    const body = JSON.stringify({ intentId: intent.id, status: "paid" });
    const result = await new CreditTopupWebhookService(buildEnv()).handle(
      body,
      await signedHeaders(body),
    );

    expect(result).toMatchObject({ credited: true, status: "paid" });
    expect(await balanceOf(card.publicId)).toBe(8000);
  });

  it("rejects an invalid signature", async () => {
    const card = await issueCard();
    const { intent } = await topupService().createIntent({
      publicId: card.publicId,
      amountCents: 8000,
      currency: "TWD",
    });

    const body = JSON.stringify({ intentId: intent.id, status: "paid" });
    const headers = new Headers({
      "x-credit-topup-signature": "deadbeef",
      "x-credit-topup-signature-timestamp": "2026-06-03T00:00:00.000Z",
    });

    await expect(
      new CreditTopupWebhookService(buildEnv()).handle(body, headers),
    ).rejects.toMatchObject({ code: "CREDIT_TOPUP_WEBHOOK_SIGNATURE_INVALID" });
    expect(await balanceOf(card.publicId)).toBe(0);
  });

  it("is idempotent on duplicate webhook delivery", async () => {
    const card = await issueCard();
    const { intent } = await topupService().createIntent({
      publicId: card.publicId,
      amountCents: 8000,
      currency: "TWD",
    });

    const body = JSON.stringify({ intentId: intent.id, status: "paid" });
    const webhook = new CreditTopupWebhookService(buildEnv());

    const first = await webhook.handle(body, await signedHeaders(body));
    const second = await webhook.handle(body, await signedHeaders(body));

    expect(first.credited).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(await balanceOf(card.publicId)).toBe(8000); // credited once
  });
});
