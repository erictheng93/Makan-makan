/**
 * Real-D1 tests for CreditService (代幣 stored-value ledger).
 *
 * Runs the real implementation against a Miniflare D1 database through Drizzle,
 * so the money-safety guarantees are proven against actual SQLite semantics:
 *   - guarded conditional UPDATE prevents overspend
 *   - concurrent spends on one balance cannot double-spend
 *   - idempotency-key replays never deduct twice
 *   - threshold-based PIN + lockout
 *   - top-up / refund movements
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

let testDb: TestDatabase;

function buildEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: testDb.bindings.DB,
    CACHE_KV: testDb.bindings.CACHE_KV,
    ...overrides,
  } as Env;
}

function makeService(overrides: Partial<Env> = {}): CreditService {
  return new CreditService(buildEnv(overrides));
}

async function ledgerEntriesFor(accountId: string) {
  return testDb.drizzle
    .select()
    .from(creditLedgerEntries)
    .where(eq(creditLedgerEntries.accountId, accountId))
    .all();
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

describe("CreditService — issue & balance", () => {
  it("issues a card with an account and reports balance", async () => {
    const service = makeService();
    const card = await service.issueCard({
      currency: "TWD",
      initialBalanceCents: 5000,
    });

    expect(card).toMatchObject({
      publicId: expect.any(String),
      accountId: expect.any(String),
      currency: "TWD",
    });

    const balance = await service.getBalance(card.publicId);
    expect(balance).toMatchObject({
      balanceCents: 5000,
      currency: "TWD",
      status: "active",
      cardStatus: "active",
    });
  });
});

describe("CreditService — spend guards", () => {
  it("deducts the full amount and records a signed ledger entry", async () => {
    const service = makeService();
    const card = await service.issueCard({
      currency: "TWD",
      initialBalanceCents: 1000,
    });

    const result = await service.spend({
      publicId: card.publicId,
      amountCents: 300,
      currency: "TWD",
      idempotencyKey: "spend-1",
      sourceType: "market_checkout",
      sourceId: "checkout-1",
    });

    expect(result.balanceAfterCents).toBe(700);
    expect((await service.getBalance(card.publicId)).balanceCents).toBe(700);

    const entries = await ledgerEntriesFor(card.accountId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      entryType: "spend",
      amountCents: -300,
      balanceAfterCents: 700,
      currency: "TWD",
      idempotencyKey: "spend-1",
    });
  });

  it("rejects overspend and leaves the balance untouched", async () => {
    const service = makeService();
    const card = await service.issueCard({
      currency: "TWD",
      initialBalanceCents: 200,
    });

    await expect(
      service.spend({
        publicId: card.publicId,
        amountCents: 500,
        currency: "TWD",
        idempotencyKey: "spend-over",
        sourceType: "market_checkout",
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });

    expect((await service.getBalance(card.publicId)).balanceCents).toBe(200);
    expect(await ledgerEntriesFor(card.accountId)).toHaveLength(0);
  });

  it("rejects a currency mismatch", async () => {
    const service = makeService();
    const card = await service.issueCard({
      currency: "TWD",
      initialBalanceCents: 1000,
    });

    await expect(
      service.spend({
        publicId: card.publicId,
        amountCents: 100,
        currency: "MYR",
        idempotencyKey: "spend-cur",
        sourceType: "market_checkout",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_CURRENCY_MISMATCH" });
  });

  it("does not double-spend under concurrent spends on one balance", async () => {
    const service = makeService();
    const card = await service.issueCard({
      currency: "TWD",
      initialBalanceCents: 300,
    });

    const settled = await Promise.allSettled([
      service.spend({
        publicId: card.publicId,
        amountCents: 200,
        currency: "TWD",
        idempotencyKey: "concurrent-a",
        sourceType: "market_checkout",
      }),
      service.spend({
        publicId: card.publicId,
        amountCents: 200,
        currency: "TWD",
        idempotencyKey: "concurrent-b",
        sourceType: "market_checkout",
      }),
    ]);

    const fulfilled = settled.filter((s) => s.status === "fulfilled");
    const rejected = settled.filter((s) => s.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "INSUFFICIENT_BALANCE",
    });

    expect((await service.getBalance(card.publicId)).balanceCents).toBe(100);
    const spends = (await ledgerEntriesFor(card.accountId)).filter(
      (e) => e.entryType === "spend",
    );
    expect(spends).toHaveLength(1);
  });

  it("replays an idempotent spend without deducting twice", async () => {
    const service = makeService();
    const card = await service.issueCard({
      currency: "TWD",
      initialBalanceCents: 1000,
    });

    const first = await service.spend({
      publicId: card.publicId,
      amountCents: 400,
      currency: "TWD",
      idempotencyKey: "same-key",
      sourceType: "market_checkout",
    });
    const second = await service.spend({
      publicId: card.publicId,
      amountCents: 400,
      currency: "TWD",
      idempotencyKey: "same-key",
      sourceType: "market_checkout",
    });

    expect(second.ledgerEntryId).toBe(first.ledgerEntryId);
    expect((await service.getBalance(card.publicId)).balanceCents).toBe(600);
    expect(await ledgerEntriesFor(card.accountId)).toHaveLength(1);
  });
});

describe("CreditService — threshold PIN", () => {
  const PIN_ENV = { CREDIT_PIN_THRESHOLD_CENTS: "1000" } as Partial<Env>;

  it("skips PIN at or below the threshold", async () => {
    const service = makeService(PIN_ENV);
    const card = await service.issueCard({
      currency: "TWD",
      initialBalanceCents: 5000,
      pin: "1234",
    });

    await expect(
      service.spend({
        publicId: card.publicId,
        amountCents: 1000, // == threshold, no PIN required
        currency: "TWD",
        idempotencyKey: "pin-small",
        sourceType: "market_checkout",
      }),
    ).resolves.toMatchObject({ balanceAfterCents: 4000 });
  });

  it("requires a PIN above the threshold and accepts the correct one", async () => {
    const service = makeService(PIN_ENV);
    const card = await service.issueCard({
      currency: "TWD",
      initialBalanceCents: 5000,
      pin: "1234",
    });

    await expect(
      service.spend({
        publicId: card.publicId,
        amountCents: 2000,
        currency: "TWD",
        idempotencyKey: "pin-missing",
        sourceType: "market_checkout",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_PIN_REQUIRED" });

    await expect(
      service.spend({
        publicId: card.publicId,
        amountCents: 2000,
        currency: "TWD",
        idempotencyKey: "pin-wrong",
        sourceType: "market_checkout",
        pin: "0000",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_PIN_INVALID" });

    await expect(
      service.spend({
        publicId: card.publicId,
        amountCents: 2000,
        currency: "TWD",
        idempotencyKey: "pin-ok",
        sourceType: "market_checkout",
        pin: "1234",
      }),
    ).resolves.toMatchObject({ balanceAfterCents: 3000 });
  });

  it("locks the card after repeated PIN failures", async () => {
    const service = makeService(PIN_ENV);
    const card = await service.issueCard({
      currency: "TWD",
      initialBalanceCents: 50000,
      pin: "1234",
    });

    for (let i = 0; i < 5; i++) {
      await expect(
        service.spend({
          publicId: card.publicId,
          amountCents: 2000,
          currency: "TWD",
          idempotencyKey: `lock-${i}`,
          sourceType: "market_checkout",
          pin: "0000",
        }),
      ).rejects.toMatchObject({ code: "CREDIT_PIN_INVALID" });
    }

    // Even the correct PIN is refused while locked.
    await expect(
      service.spend({
        publicId: card.publicId,
        amountCents: 2000,
        currency: "TWD",
        idempotencyKey: "lock-after",
        sourceType: "market_checkout",
        pin: "1234",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_CARD_LOCKED" });
  });
});

describe("CreditService — topup & refund", () => {
  it("tops up the balance and records a topup entry", async () => {
    const service = makeService();
    const card = await service.issueCard({ currency: "TWD" });

    const result = await service.topup({
      publicId: card.publicId,
      amountCents: 1500,
      currency: "TWD",
      idempotencyKey: "topup-1",
      sourceType: "topup",
    });

    expect(result.balanceAfterCents).toBe(1500);
    const entries = await ledgerEntriesFor(card.accountId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ entryType: "topup", amountCents: 1500 });
  });

  it("refunds a prior spend back to the originating account", async () => {
    const service = makeService();
    const card = await service.issueCard({
      currency: "TWD",
      initialBalanceCents: 1000,
    });
    await service.spend({
      publicId: card.publicId,
      amountCents: 600,
      currency: "TWD",
      idempotencyKey: "spend-for-refund",
      sourceType: "market_checkout",
      sourceId: "checkout-9",
    });

    const refund = await service.refundByOriginalSpend({
      spendIdempotencyKey: "spend-for-refund",
      refundIdempotencyKey: "spend-for-refund:refund",
      amountCents: 600,
      currency: "TWD",
      sourceType: "market_checkout",
      sourceId: "checkout-9",
    });

    expect(refund.balanceAfterCents).toBe(1000);
    expect((await service.getBalance(card.publicId)).balanceCents).toBe(1000);
    const refundEntries = (await ledgerEntriesFor(card.accountId)).filter(
      (e) => e.entryType === "refund",
    );
    expect(refundEntries).toHaveLength(1);
    expect(refundEntries[0]).toMatchObject({ amountCents: 600 });
  });

  it("is idempotent on refund replays", async () => {
    const service = makeService();
    const card = await service.issueCard({
      currency: "TWD",
      initialBalanceCents: 1000,
    });
    await service.spend({
      publicId: card.publicId,
      amountCents: 600,
      currency: "TWD",
      idempotencyKey: "spend-r2",
      sourceType: "market_checkout",
    });

    const first = await service.refundByOriginalSpend({
      spendIdempotencyKey: "spend-r2",
      refundIdempotencyKey: "spend-r2:refund",
      amountCents: 600,
      currency: "TWD",
      sourceType: "market_checkout",
    });
    const second = await service.refundByOriginalSpend({
      spendIdempotencyKey: "spend-r2",
      refundIdempotencyKey: "spend-r2:refund",
      amountCents: 600,
      currency: "TWD",
      sourceType: "market_checkout",
    });

    expect(second.ledgerEntryId).toBe(first.ledgerEntryId);
    expect((await service.getBalance(card.publicId)).balanceCents).toBe(1000);
  });
});

describe("CreditService — card management", () => {
  it("sets a PIN that then authorises an above-threshold spend", async () => {
    const service = makeService({ CREDIT_PIN_THRESHOLD_CENTS: "1000" });
    const card = await service.issueCard({
      currency: "TWD",
      initialBalanceCents: 5000,
    });

    await expect(
      service.spend({
        publicId: card.publicId,
        amountCents: 2000,
        currency: "TWD",
        idempotencyKey: "no-pin",
        sourceType: "market_checkout",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_PIN_NOT_SET" });

    await service.setPin(card.publicId, "4321");

    await expect(
      service.spend({
        publicId: card.publicId,
        amountCents: 2000,
        currency: "TWD",
        idempotencyKey: "with-pin",
        sourceType: "market_checkout",
        pin: "4321",
      }),
    ).resolves.toMatchObject({ balanceAfterCents: 3000 });
  });

  it("freezes a card so further spends are rejected", async () => {
    const service = makeService();
    const card = await service.issueCard({
      currency: "TWD",
      initialBalanceCents: 5000,
    });

    await service.setCardStatus(card.publicId, "frozen");
    expect((await service.getBalance(card.publicId)).cardStatus).toBe("frozen");

    await expect(
      service.spend({
        publicId: card.publicId,
        amountCents: 100,
        currency: "TWD",
        idempotencyKey: "frozen-spend",
        sourceType: "market_checkout",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_CARD_INACTIVE" });
  });

  it("lists ledger entries newest-first with pagination", async () => {
    const service = makeService();
    const card = await service.issueCard({ currency: "TWD" });
    await service.topup({
      publicId: card.publicId,
      amountCents: 1000,
      currency: "TWD",
      idempotencyKey: "lg-topup",
      sourceType: "topup",
    });
    await service.spend({
      publicId: card.publicId,
      amountCents: 300,
      currency: "TWD",
      idempotencyKey: "lg-spend",
      sourceType: "market_checkout",
    });

    const all = await service.listLedger(card.publicId);
    expect(all.entries).toHaveLength(2);
    expect(all.entries[0].entryType).toBe("spend"); // newest first

    const page = await service.listLedger(card.publicId, {
      limit: 1,
      offset: 1,
    });
    expect(page.entries).toHaveLength(1);
    expect(page.entries[0].entryType).toBe("topup");
  });
});
