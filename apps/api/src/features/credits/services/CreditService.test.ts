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

interface QueueItem {
  get?: unknown;
  all?: unknown[];
  returning?: unknown[];
}

function createFakeDb() {
  const queues = {
    select: [] as QueueItem[],
    insert: [] as QueueItem[],
    update: [] as QueueItem[],
    insertValues: [] as unknown[],
    updateValues: [] as unknown[],
  };

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      groupBy: vi.fn(() => chain),
      having: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      offset: vi.fn(() => chain),
      get: vi.fn(async () => queues.select.shift()?.get ?? null),
      all: vi.fn(async () => queues.select.shift()?.all ?? []),
    };
    return chain;
  };

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
    select: vi.fn(() => createSelectChain()),
    insert: vi.fn(() => createInsertChain()),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        queues.updateValues.push(values);
        return createUpdateSetChain();
      }),
    })),
  };

  return { db, queues };
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
    const { service, queues } = createService();
    queues.select.push({ get: card }, { get: account });

    await expect(service.getBalance("public-1")).resolves.toEqual({
      publicId: "public-1",
      accountId: "account-1",
      currency: "TWD",
      balanceCents: 50000,
      status: "active",
      cardStatus: "active",
      expiresAtMs: account.expiresAtMs.getTime(),
    });

    queues.select.push({ get: null });
    await expect(service.getBalance("missing")).rejects.toMatchObject({
      code: "CREDIT_CARD_NOT_FOUND",
    });

    queues.select.push({ get: card }, { get: null });
    await expect(service.getBalance("orphan")).rejects.toMatchObject({
      code: "CREDIT_ACCOUNT_NOT_FOUND",
    });
  });

  it("spends with replay, guard, PIN, deduction, and ledger compensation branches", async () => {
    const { service, queues } = createService({
      CREDIT_PIN_THRESHOLD_CENTS: "1000",
    } as Partial<Env>);
    queues.select.push({
      get: {
        id: "ledger-existing",
        accountId: "account-1",
        balanceAfterCents: 49000,
      },
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

    queues.select.push(
      { get: null },
      { get: card },
      { get: { ...account, status: "suspended" } },
    );
    await expect(
      service.spend({
        publicId: "public-1",
        amountCents: 100,
        currency: "TWD",
        idempotencyKey: "inactive",
        sourceType: "checkout",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_ACCOUNT_INACTIVE" });

    queues.select.push(
      { get: null },
      { get: card },
      { get: { ...account, currency: "MYR" } },
    );
    await expect(
      service.spend({
        publicId: "public-1",
        amountCents: 100,
        currency: "TWD",
        idempotencyKey: "currency",
        sourceType: "checkout",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_CURRENCY_MISMATCH" });

    queues.select.push({ get: null }, { get: card }, { get: account });
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
    queues.select.push({ get: null }, { get: card }, { get: account });
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

    queues.select.push({ get: null }, { get: card }, { get: account });
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

    queues.select.push({ get: null }, { get: card }, { get: account });
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

    queues.select.push({ get: null }, { get: card }, { get: account });
    queues.update.push(
      { returning: [{ balanceAfter: 47000 }] },
      { returning: [{ balanceAfter: 50000 }] },
    );
    queues.insert.push({ returning: [] });
    queues.select.push({
      get: {
        id: "ledger-canonical",
        accountId: "account-1",
        balanceAfterCents: 47000,
      },
    });
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
    const { service, queues } = createService();

    queues.select.push({
      get: {
        id: "topup-existing",
        accountId: "account-1",
        balanceAfterCents: 55000,
      },
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

    queues.select.push(
      { get: null },
      { get: card },
      { get: { ...account, currency: "MYR" } },
    );
    await expect(
      service.topup({
        publicId: "public-1",
        amountCents: 1000,
        currency: "TWD",
        idempotencyKey: "topup-currency",
        sourceType: "topup",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_CURRENCY_MISMATCH" });

    queues.select.push({ get: null }, { get: card }, { get: account });
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

    queues.select.push({ get: null }, { get: null });
    await expect(
      service.refund({
        accountId: "missing",
        amountCents: 100,
        currency: "TWD",
        idempotencyKey: "refund-missing",
        sourceType: "refund",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_ACCOUNT_NOT_FOUND" });

    queues.select.push({ get: null }, { get: { ...account, currency: "MYR" } });
    await expect(
      service.refund({
        accountId: "account-1",
        amountCents: 100,
        currency: "TWD",
        idempotencyKey: "refund-currency",
        sourceType: "refund",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_CURRENCY_MISMATCH" });

    queues.select.push({ get: null }, { get: account });
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

    queues.select.push({ get: null });
    await expect(
      service.refundByOriginalSpend({
        spendIdempotencyKey: "unknown-spend",
        refundIdempotencyKey: "refund-by-spend",
        amountCents: 100,
        currency: "TWD",
        sourceType: "refund",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_SPEND_NOT_FOUND" });

    queues.select.push({
      get: {
        id: "spend-ledger",
        accountId: "account-1",
        balanceAfterCents: 49000,
      },
    });
    queues.select.push({ get: null }, { get: account });
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
    const { service, queues } = createService();

    queues.select.push({ get: card }, { get: account });
    await service.setPin("public-1", "4321");
    expect(queues.updateValues.at(-1)).toMatchObject({
      secretHash: "hash:new-pin",
      pinRetryCount: 0,
      lockedUntilMs: null,
    });

    queues.select.push({ get: card }, { get: account });
    await service.setCardStatus("public-1", "frozen");
    expect(queues.updateValues.at(-1)).toMatchObject({ status: "frozen" });

    queues.select.push({ get: card }, { get: account });
    queues.select.push({ all: [{ id: "ledger-1" }] });
    await expect(
      service.listLedger("public-1", { limit: 500, offset: -5 }),
    ).resolves.toEqual({
      accountId: "account-1",
      entries: [{ id: "ledger-1" }],
    });

    queues.select.push({ all: [{ id: "export-1" }] });
    await expect(service.listLedgerForExport({ limit: 0 })).resolves.toEqual([
      { id: "export-1" },
    ]);

    queues.select.push({ all: [{ id: "export-2" }] });
    await expect(
      service.listLedgerForExport({
        fromMs: Date.parse("2026-06-01T00:00:00.000Z"),
        toMs: Date.parse("2026-06-02T00:00:00.000Z"),
      }),
    ).resolves.toEqual([{ id: "export-2" }]);

    queues.select.push({
      all: [
        { accountId: "account-1", balanceCents: 5000, ledgerSumCents: 4500 },
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
    const { service, queues } = createService();
    queues.select.push({
      all: [
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
