import { beforeEach, describe, expect, it, vi } from "vitest";

const bcryptHash = vi.hoisted(() => vi.fn());
const bcryptCompare = vi.hoisted(() => vi.fn());

vi.mock("bcryptjs", () => ({
  default: {
    hash: bcryptHash,
    compare: bcryptCompare,
  },
}));

import { CreditService } from "./CreditService";
import type { Env } from "../../../types/env";
import {
  creditAccounts,
  creditCards,
  creditLedgerEntries,
  creditTopupIntents,
} from "@makanmasak/database";
import {
  createSelectFixtureDb,
  type SelectFixtures,
} from "@makanmasak/database/testing";

const account = {
  id: "account-1",
  ownerCustomerId: null,
  currency: "TWD",
  balanceCents: 50000,
  status: "active",
  version: 1,
  expiresAtMs: new Date("2027-06-01T00:00:00.000Z"),
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

const card = {
  id: "card-1",
  accountId: "account-1",
  publicId: "public-1",
  secretHash: "hash:1234",
  status: "active",
  pinRetryCount: 0,
  lockedUntilMs: null,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

/**
 * Select fixtures are keyed by table, not by call order: `from(table)`
 * decides which queue a query draws from, so adding a query against one
 * table can no longer shift another table's results out from under it.
 *
 * Two things still need care when the code under test grows a new query:
 *
 * - Within a single table the queue is positional. The Nth read of a table
 *   takes that table's Nth fixture, so a new query means inserting a fixture
 *   at the matching index rather than appending one at the end.
 * - A table has to be listed in `fixtureTables` before it can be declared. An
 *   unregistered table matches no queue, so every read of it throws.
 *
 * Missing and exhausted fixtures both throw and name the table. Nothing
 * falls back to `[]`/`null`; a silent empty/null result is what made the
 * previous positional queue so hard to trace back to its cause.
 *
 * `CreditService` terminates its selects with `.get()` (single row, or
 * `undefined` when the fixture entry is `[]`) or `.all()` (the whole array)
 * instead of awaiting the builder directly. Both consume the next fixture
 * queued for the table passed to `from()` — `.get()` just takes index 0 of
 * it.
 *
 * `creditAccounts`, `creditCards`, and `creditLedgerEntries` are all read
 * directly somewhere in this service (`loadCardAndAccount`, `refund`,
 * `expireStaleAccounts`, `findBalanceLedgerDrift`, `listLedger`,
 * `listLedgerForExport`, `findLedgerByIdempotencyKey`), so all three are
 * registered below. `findBalanceLedgerDrift` left-joins `creditLedgerEntries`
 * but selects `from(creditAccounts)`, so that call still routes to
 * `creditAccounts` — joins never change the routing table.
 * `creditTopupIntents` belongs to `CreditTopupService`, not this file's
 * service, and is never selected here; it is imported only so the
 * regression test below has a real, unregistered table to demonstrate the
 * "<unknown table>" case.
 *
 * Neither this service's selects nor its mutations are wrapped in try/catch
 * on the read paths — the one try/catch, in `expireStaleAccounts`, wraps
 * only its per-account update/insert calls, after the select already ran.
 * A harness throw from a missing/exhausted select fixture therefore always
 * surfaces as a rejected promise here; no swallowing caveat applies.
 */
const fixtureTables = {
  creditAccounts,
  creditCards,
  creditLedgerEntries,
};
type SelectFixtureName = keyof typeof fixtureTables;

interface MutationQueueItem {
  returning?: unknown[];
}

function createFakeDb() {
  const queues = {
    insert: [] as MutationQueueItem[],
    update: [] as MutationQueueItem[],
    insertValues: [] as unknown[],
    updateValues: [] as unknown[],
  };

  const selectFn = vi.fn();

  function mockSelectResults(fixtures: SelectFixtures<SelectFixtureName> = {}) {
    const fixtureDb = createSelectFixtureDb(fixtureTables, fixtures);
    selectFn.mockImplementation(fixtureDb.select);
  }

  const createInsertChain = () => {
    const chain = {
      values: vi.fn((values: unknown) => {
        queues.insertValues.push(values);
        return chain;
      }),
      onConflictDoNothing: vi.fn(() => chain),
      returning: vi.fn(async () => queues.insert.shift()?.returning ?? []),
    };
    return chain;
  };

  const createUpdateSetChain = () => {
    const chain = {
      where: vi.fn(() => chain),
      returning: vi.fn(async () => queues.update.shift()?.returning ?? []),
    };
    return chain;
  };

  const db = {
    select: selectFn,
    insert: vi.fn(() => createInsertChain()),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        queues.updateValues.push(values);
        return createUpdateSetChain();
      }),
    })),
  };

  return { db, queues, mockSelectResults };
}

function createService(options: Partial<Env> = {}) {
  const fake = createFakeDb();
  const service = new CreditService({
    DB: {},
    CACHE_KV: {},
    ...options,
  } as Env);
  (service as unknown as { db: unknown }).db = fake.db;
  return { service, ...fake };
}

describe("CreditService", () => {
  beforeEach(() => {
    bcryptHash.mockReset();
    bcryptHash.mockResolvedValue("hash:new-pin");
    bcryptCompare.mockReset();
    bcryptCompare.mockResolvedValue(true);
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "card-public-id" as `${string}-${string}-${string}-${string}-${string}`,
    );
  });

  it("routes select fixtures by table and reports missing fixtures", async () => {
    const { db, mockSelectResults } = createService();
    mockSelectResults({
      creditAccounts: [[account], [{ ...account, id: "account-2" }]],
      creditCards: [[card]],
    });

    // Read in reverse declaration order: routing follows the table passed to
    // from(), not the execution order.
    await expect(db.select().from(creditCards).get()).resolves.toEqual(card);
    await expect(db.select().from(creditAccounts).get()).resolves.toEqual(
      account,
    );
    await expect(db.select().from(creditAccounts).get()).resolves.toEqual({
      ...account,
      id: "account-2",
    });
    await expect(db.select().from(creditAccounts).get()).rejects.toThrow(
      "No select fixtures remaining for creditAccounts",
    );
    // creditTopupIntents is selected by CreditTopupService, not
    // CreditService, so it stays out of fixtureTables here and reports
    // <unknown table>.
    await expect(db.select().from(creditTopupIntents).get()).rejects.toThrow(
      "Missing select fixture for <unknown table>",
    );
  });

  it("issues cards, audits opening balances, and rejects negative balances", async () => {
    const { service, queues } = createService();
    queues.insert.push(
      { returning: [{ ...account, balanceCents: 12000 }] },
      { returning: [{ ...card, publicId: "card-public-id" }] },
    );

    const result = await service.issueCard({
      currency: "TWD",
      ownerCustomerId: "customer-1",
      pin: "1234",
      initialBalanceCents: 12000,
    });

    expect(result).toEqual({
      cardId: "card-1",
      publicId: "card-public-id",
      accountId: "account-1",
      currency: "TWD",
    });
    expect(bcryptHash).toHaveBeenCalledWith("1234", 10);
    expect(queues.insertValues[0]).toMatchObject({
      ownerCustomerId: "customer-1",
      currency: "TWD",
      balanceCents: 12000,
    });
    expect(queues.insertValues[2]).toMatchObject({
      accountId: "account-1",
      entryType: "adjust",
      amountCents: 12000,
      idempotencyKey: "credit-issue:account-1",
    });

    await expect(
      service.issueCard({ currency: "TWD", initialBalanceCents: -1 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("returns balances and validates card/account lookup failures", async () => {
    const { service, mockSelectResults } = createService();
    mockSelectResults({ creditCards: [[card]], creditAccounts: [[account]] });

    await expect(service.getBalance("public-1")).resolves.toEqual({
      publicId: "public-1",
      accountId: "account-1",
      currency: "TWD",
      balanceCents: 50000,
      status: "active",
      cardStatus: "active",
      expiresAtMs: account.expiresAtMs.getTime(),
    });

    mockSelectResults({ creditCards: [[]] });
    await expect(service.getBalance("missing")).rejects.toMatchObject({
      code: "CREDIT_CARD_NOT_FOUND",
    });

    mockSelectResults({ creditCards: [[card]], creditAccounts: [[]] });
    await expect(service.getBalance("orphan")).rejects.toMatchObject({
      code: "CREDIT_ACCOUNT_NOT_FOUND",
    });
  });

  it("spends with replay, guard, PIN, deduction, and ledger compensation branches", async () => {
    const { service, queues, mockSelectResults } = createService({
      CREDIT_PIN_THRESHOLD_CENTS: "1000",
    } as Partial<Env>);
    mockSelectResults({
      creditLedgerEntries: [
        [
          {
            id: "ledger-existing",
            accountId: "account-1",
            balanceAfterCents: 49000,
          },
        ],
      ],
    });
    await expect(
      service.spend({
        publicId: "public-1",
        amountCents: 1000,
        currency: "TWD",
        idempotencyKey: "spend-replay",
        sourceType: "checkout",
      }),
    ).resolves.toEqual({
      ledgerEntryId: "ledger-existing",
      accountId: "account-1",
      balanceAfterCents: 49000,
    });

    await expect(
      service.spend({
        publicId: "public-1",
        amountCents: 0,
        currency: "TWD",
        idempotencyKey: "bad",
        sourceType: "checkout",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    mockSelectResults({
      creditLedgerEntries: [[]],
      creditCards: [[card]],
      creditAccounts: [[{ ...account, status: "suspended" }]],
    });
    await expect(
      service.spend({
        publicId: "public-1",
        amountCents: 100,
        currency: "TWD",
        idempotencyKey: "inactive",
        sourceType: "checkout",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_ACCOUNT_INACTIVE" });

    mockSelectResults({
      creditLedgerEntries: [[]],
      creditCards: [[card]],
      creditAccounts: [[{ ...account, currency: "MYR" }]],
    });
    await expect(
      service.spend({
        publicId: "public-1",
        amountCents: 100,
        currency: "TWD",
        idempotencyKey: "currency",
        sourceType: "checkout",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_CURRENCY_MISMATCH" });

    mockSelectResults({
      creditLedgerEntries: [[]],
      creditCards: [[card]],
      creditAccounts: [[account]],
    });
    await expect(
      service.spend({
        publicId: "public-1",
        amountCents: 2000,
        currency: "TWD",
        idempotencyKey: "missing-pin",
        sourceType: "checkout",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_PIN_REQUIRED" });

    bcryptCompare.mockResolvedValueOnce(false);
    mockSelectResults({
      creditLedgerEntries: [[]],
      creditCards: [[card]],
      creditAccounts: [[account]],
    });
    await expect(
      service.spend({
        publicId: "public-1",
        amountCents: 2000,
        currency: "TWD",
        idempotencyKey: "bad-pin",
        sourceType: "checkout",
        pin: "0000",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_PIN_INVALID" });
    expect(queues.updateValues.at(-1)).toMatchObject({ pinRetryCount: 1 });

    mockSelectResults({
      creditLedgerEntries: [[]],
      creditCards: [[card]],
      creditAccounts: [[account]],
    });
    queues.update.push({ returning: [] });
    await expect(
      service.spend({
        publicId: "public-1",
        amountCents: 60000,
        currency: "TWD",
        idempotencyKey: "overspend",
        sourceType: "checkout",
        pin: "1234",
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });

    mockSelectResults({
      creditLedgerEntries: [[]],
      creditCards: [[card]],
      creditAccounts: [[account]],
    });
    queues.update.push({ returning: [{ balanceAfter: 48000 }] });
    queues.insert.push({ returning: [{ id: "ledger-1" }] });
    await expect(
      service.spend({
        publicId: "public-1",
        amountCents: 2000,
        currency: "TWD",
        idempotencyKey: "spend-ok",
        sourceType: "checkout",
        sourceId: "checkout-1",
        marketCheckoutPaymentId: "pay-1",
        pin: "1234",
      }),
    ).resolves.toEqual({
      ledgerEntryId: "ledger-1",
      accountId: "account-1",
      balanceAfterCents: 48000,
    });
    expect(queues.insertValues.at(-1)).toMatchObject({
      entryType: "spend",
      amountCents: -2000,
      balanceAfterCents: 48000,
      idempotencyKey: "spend-ok",
      marketCheckoutPaymentId: "pay-1",
    });

    mockSelectResults({
      creditLedgerEntries: [
        [],
        [
          {
            id: "ledger-canonical",
            accountId: "account-1",
            balanceAfterCents: 47000,
          },
        ],
      ],
      creditCards: [[card]],
      creditAccounts: [[account]],
    });
    queues.update.push(
      { returning: [{ balanceAfter: 47000 }] },
      { returning: [{ balanceAfter: 50000 }] },
    );
    queues.insert.push({ returning: [] });
    await expect(
      service.spend({
        publicId: "public-1",
        amountCents: 3000,
        currency: "TWD",
        idempotencyKey: "spend-race",
        sourceType: "checkout",
        pin: "1234",
      }),
    ).resolves.toEqual({
      ledgerEntryId: "ledger-canonical",
      accountId: "account-1",
      balanceAfterCents: 47000,
    });
  });

  it("topups, refunds, and resolves refunds from original spend keys", async () => {
    const { service, queues, mockSelectResults } = createService();

    mockSelectResults({
      creditLedgerEntries: [
        [
          {
            id: "topup-existing",
            accountId: "account-1",
            balanceAfterCents: 55000,
          },
        ],
      ],
    });
    await expect(
      service.topup({
        publicId: "public-1",
        amountCents: 5000,
        currency: "TWD",
        idempotencyKey: "topup-replay",
        sourceType: "topup",
      }),
    ).resolves.toMatchObject({ ledgerEntryId: "topup-existing" });

    await expect(
      service.topup({
        publicId: "public-1",
        amountCents: 0,
        currency: "TWD",
        idempotencyKey: "bad-topup",
        sourceType: "topup",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    mockSelectResults({
      creditLedgerEntries: [[]],
      creditCards: [[card]],
      creditAccounts: [[{ ...account, currency: "MYR" }]],
    });
    await expect(
      service.topup({
        publicId: "public-1",
        amountCents: 1000,
        currency: "TWD",
        idempotencyKey: "topup-currency",
        sourceType: "topup",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_CURRENCY_MISMATCH" });

    mockSelectResults({
      creditLedgerEntries: [[]],
      creditCards: [[card]],
      creditAccounts: [[account]],
    });
    queues.update.push({ returning: [{ balanceAfter: 55000 }] });
    queues.insert.push({ returning: [{ id: "topup-ledger" }] });
    await expect(
      service.topup({
        publicId: "public-1",
        amountCents: 5000,
        currency: "TWD",
        idempotencyKey: "topup-ok",
        sourceType: "topup",
        sourceId: "cashier-1",
      }),
    ).resolves.toEqual({
      ledgerEntryId: "topup-ledger",
      accountId: "account-1",
      balanceAfterCents: 55000,
    });

    mockSelectResults({
      creditLedgerEntries: [[]],
      creditAccounts: [[]],
    });
    await expect(
      service.refund({
        accountId: "missing",
        amountCents: 100,
        currency: "TWD",
        idempotencyKey: "refund-missing",
        sourceType: "refund",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_ACCOUNT_NOT_FOUND" });

    mockSelectResults({
      creditLedgerEntries: [[]],
      creditAccounts: [[{ ...account, currency: "MYR" }]],
    });
    await expect(
      service.refund({
        accountId: "account-1",
        amountCents: 100,
        currency: "TWD",
        idempotencyKey: "refund-currency",
        sourceType: "refund",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_CURRENCY_MISMATCH" });

    mockSelectResults({
      creditLedgerEntries: [[]],
      creditAccounts: [[account]],
    });
    queues.update.push({ returning: [{ balanceAfter: 51000 }] });
    queues.insert.push({ returning: [{ id: "refund-ledger" }] });
    await expect(
      service.refund({
        accountId: "account-1",
        amountCents: 1000,
        currency: "TWD",
        idempotencyKey: "refund-ok",
        sourceType: "refund",
        marketCheckoutPaymentId: "pay-1",
      }),
    ).resolves.toMatchObject({
      ledgerEntryId: "refund-ledger",
      balanceAfterCents: 51000,
    });

    mockSelectResults({ creditLedgerEntries: [[]] });
    await expect(
      service.refundByOriginalSpend({
        spendIdempotencyKey: "unknown-spend",
        refundIdempotencyKey: "refund-by-spend",
        amountCents: 100,
        currency: "TWD",
        sourceType: "refund",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_SPEND_NOT_FOUND" });

    mockSelectResults({
      creditLedgerEntries: [
        [
          {
            id: "spend-ledger",
            accountId: "account-1",
            balanceAfterCents: 49000,
          },
        ],
        [],
      ],
      creditAccounts: [[account]],
    });
    queues.update.push({ returning: [{ balanceAfter: 50000 }] });
    queues.insert.push({ returning: [{ id: "refund-from-spend" }] });
    await expect(
      service.refundByOriginalSpend({
        spendIdempotencyKey: "known-spend",
        refundIdempotencyKey: "refund-from-spend",
        amountCents: 1000,
        currency: "TWD",
        sourceType: "refund",
      }),
    ).resolves.toMatchObject({ ledgerEntryId: "refund-from-spend" });
  });

  it("manages cards and reads ledger/export/drift reports", async () => {
    const { service, queues, mockSelectResults } = createService();

    mockSelectResults({ creditCards: [[card]], creditAccounts: [[account]] });
    await service.setPin("public-1", "4321");
    expect(queues.updateValues.at(-1)).toMatchObject({
      secretHash: "hash:new-pin",
      pinRetryCount: 0,
      lockedUntilMs: null,
    });

    mockSelectResults({ creditCards: [[card]], creditAccounts: [[account]] });
    await service.setCardStatus("public-1", "frozen");
    expect(queues.updateValues.at(-1)).toMatchObject({ status: "frozen" });

    mockSelectResults({
      creditCards: [[card]],
      creditAccounts: [[account]],
      creditLedgerEntries: [[{ id: "ledger-1" }]],
    });
    await expect(
      service.listLedger("public-1", { limit: 500, offset: -5 }),
    ).resolves.toEqual({
      accountId: "account-1",
      entries: [{ id: "ledger-1" }],
    });

    mockSelectResults({ creditLedgerEntries: [[{ id: "export-1" }]] });
    await expect(service.listLedgerForExport({ limit: 0 })).resolves.toEqual([
      { id: "export-1" },
    ]);

    mockSelectResults({ creditLedgerEntries: [[{ id: "export-2" }]] });
    await expect(
      service.listLedgerForExport({
        fromMs: Date.parse("2026-06-01T00:00:00.000Z"),
        toMs: Date.parse("2026-06-02T00:00:00.000Z"),
      }),
    ).resolves.toEqual([{ id: "export-2" }]);

    mockSelectResults({
      creditAccounts: [
        [{ accountId: "account-1", balanceCents: 5000, ledgerSumCents: 4500 }],
      ],
    });
    await expect(service.findBalanceLedgerDrift()).resolves.toEqual([
      {
        accountId: "account-1",
        balanceCents: 5000,
        ledgerSumCents: 4500,
        driftCents: 500,
      },
    ]);
  });

  it("expires stale accounts with isolated failures and concurrent-update skips", async () => {
    const { service, queues, mockSelectResults } = createService();
    mockSelectResults({
      creditAccounts: [
        [
          {
            id: "account-skip",
            balanceCents: 1000,
            version: 1,
            currency: "TWD",
            expiresAtMs: new Date("2026-01-01T00:00:00.000Z"),
          },
          {
            id: "account-expire",
            balanceCents: 2000,
            version: 2,
            currency: "TWD",
            expiresAtMs: new Date("2026-01-02T00:00:00.000Z"),
          },
          {
            id: "account-fail",
            balanceCents: 3000,
            version: 3,
            currency: "TWD",
            expiresAtMs: new Date("2026-01-03T00:00:00.000Z"),
          },
        ],
      ],
    });
    queues.update.push(
      { returning: [] },
      { returning: [{ id: "account-expire" }] },
    );
    queues.update.push({
      returning: Promise.reject(new Error("write failed")) as never,
    });

    const result = await service.expireStaleAccounts({
      nowMs: Date.parse("2026-06-01T00:00:00.000Z"),
      limit: 5000,
    });

    expect(result).toEqual({
      scanned: 3,
      expired: 1,
      totalExpiredCents: 2000,
      failures: [{ accountId: "account-fail", error: "write failed" }],
    });
    expect(queues.insertValues.at(-1)).toMatchObject({
      accountId: "account-expire",
      entryType: "expire",
      amountCents: -2000,
      balanceAfterCents: 0,
      sourceType: "expiry_job",
    });
  });
});
