/**
 * Real-D1 tests for the stored-value credit expiry worker (代幣過期).
 *
 * Rolling expiry is set ~1 year out on activity; the worker zeroes balances
 * whose expiry has lapsed and records an `expire` ledger entry (breakage).
 * Tests drive expiry deterministically by passing a future `nowMs`.
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
import { expireStaleCredits } from "../../workers/credit-expiry";

let testDb: TestDatabase;

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

function env(): Env {
  return { DB: testDb.bindings.DB } as Env;
}

function service(): CreditService {
  return new CreditService(env());
}

async function ledgerFor(accountId: string) {
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

describe("credit expiry worker", () => {
  it("zeroes a lapsed balance and records an expire ledger entry", async () => {
    const card = await service().issueCard({
      currency: "TWD",
      initialBalanceCents: 5000,
    });

    const result = await expireStaleCredits(env(), {
      nowMs: Date.now() + TWO_YEARS_MS,
    });

    expect(result).toMatchObject({
      scanned: 1,
      expired: 1,
      totalExpiredCents: 5000,
    });
    expect((await service().getBalance(card.publicId)).balanceCents).toBe(0);

    const expireEntries = (await ledgerFor(card.accountId)).filter(
      (e) => e.entryType === "expire",
    );
    expect(expireEntries).toHaveLength(1);
    expect(expireEntries[0]).toMatchObject({
      amountCents: -5000,
      balanceAfterCents: 0,
      sourceType: "expiry_job",
    });
  });

  it("leaves a non-lapsed balance untouched", async () => {
    const card = await service().issueCard({
      currency: "TWD",
      initialBalanceCents: 5000,
    });

    const result = await expireStaleCredits(env(), { nowMs: Date.now() });

    expect(result).toMatchObject({ scanned: 0, expired: 0 });
    expect((await service().getBalance(card.publicId)).balanceCents).toBe(5000);
  });

  it("skips zero-balance accounts", async () => {
    await service().issueCard({ currency: "TWD" }); // balance 0

    const result = await expireStaleCredits(env(), {
      nowMs: Date.now() + TWO_YEARS_MS,
    });
    expect(result).toMatchObject({ scanned: 0, expired: 0 });
  });

  it("is safe to re-run (does not double-expire)", async () => {
    const card = await service().issueCard({
      currency: "TWD",
      initialBalanceCents: 5000,
    });
    const future = Date.now() + TWO_YEARS_MS;

    const first = await expireStaleCredits(env(), { nowMs: future });
    const second = await expireStaleCredits(env(), { nowMs: future });

    expect(first.expired).toBe(1);
    expect(second.expired).toBe(0); // already zeroed
    expect((await service().getBalance(card.publicId)).balanceCents).toBe(0);
    const expireEntries = (await ledgerFor(card.accountId)).filter(
      (e) => e.entryType === "expire",
    );
    expect(expireEntries).toHaveLength(1);
  });
});
