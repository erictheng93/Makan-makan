import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../types/env";

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

import {
  createCreditTopupGateway,
  CreditTopupService,
  hmacSha256Hex,
  HttpCreditTopupGateway,
  type CreditTopupGateway,
} from "./CreditTopupService";

interface QueueItem {
  get?: unknown;
  returning?: unknown[];
}

function createSelectChain(queues: { select: QueueItem[] }) {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    get: vi.fn(async () => queues.select.shift()?.get ?? null),
  };
  return chain;
}

function createFakeDb() {
  const queues = {
    select: [] as QueueItem[],
    insert: [] as QueueItem[],
    update: [] as QueueItem[],
    insertValues: [] as unknown[],
    updateValues: [] as unknown[],
  };

  mocks.db.select.mockImplementation(() => createSelectChain(queues));
  mocks.db.insert.mockImplementation(() => {
    const chain = {
      values: vi.fn((values: unknown) => {
        queues.insertValues.push(values);
        return chain;
      }),
      returning: vi.fn(async () => queues.insert.shift()?.returning ?? []),
    };
    return chain;
  });
  mocks.db.update.mockImplementation(() => {
    const chain = {
      set: vi.fn((values: unknown) => {
        queues.updateValues.push(values);
        return chain;
      }),
      where: vi.fn(() => chain),
      returning: vi.fn(async () => queues.update.shift()?.returning ?? []),
      then: (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) => Promise.resolve(undefined).then(resolve, reject),
    };
    return chain;
  });

  return { queues };
}

function env(overrides: Partial<Env> = {}) {
  return {
    DB: {},
    CACHE_KV: {},
    ...overrides,
  } as Env;
}

function intent(overrides: Record<string, unknown> = {}) {
  return {
    id: "intent-1",
    accountId: "account-1",
    publicId: "card-public-1",
    provider: "credit_topup",
    providerTransactionId: "txn-1",
    amountCents: 1500,
    currency: "TWD",
    status: "pending",
    ledgerEntryId: null,
    providerPayload: null,
    errorMessage: null,
    expiresAtMs: new Date("2026-06-07T00:30:00.000Z"),
    paidAtMs: null,
    failedAtMs: null,
    createdAt: new Date("2026-06-07T00:00:00.000Z"),
    updatedAt: new Date("2026-06-07T00:00:00.000Z"),
    ...overrides,
  };
}

function creditService() {
  return {
    topup: vi.fn(async () => ({
      ledgerEntryId: "ledger-1",
      accountId: "account-1",
      balanceAfterCents: 6500,
    })),
  };
}

function gateway(overrides: Partial<CreditTopupGateway> = {}) {
  return {
    createCharge: vi.fn(async () => ({
      providerTransactionId: "txn-1",
      status: "requires_action" as const,
      nextAction: {
        type: "redirect" as const,
        redirectUrl: "https://pay.example.test/intent-1",
      },
    })),
    ...overrides,
  };
}

describe("CreditTopupService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("creates an online top-up intent and stores provider metadata", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const { queues } = createFakeDb();
    const fakeGateway = gateway();
    queues.select.push({
      get: { id: "account-1", currency: "TWD", status: "active" },
    });
    queues.insert.push({
      returning: [intent({ providerTransactionId: null })],
    });
    queues.update.push({ returning: [intent()] });

    const result = await new CreditTopupService(
      env(),
      creditService() as never,
      fakeGateway,
    ).createIntent({
      publicId: "card-public-1",
      amountCents: 1500,
      currency: "TWD",
    });

    expect(result).toMatchObject({
      intent: { id: "intent-1", providerTransactionId: "txn-1" },
      nextAction: {
        type: "redirect",
        redirectUrl: "https://pay.example.test/intent-1",
      },
    });
    expect(queues.insertValues[0]).toMatchObject({
      accountId: "account-1",
      publicId: "card-public-1",
      provider: "credit_topup",
      amountCents: 1500,
      currency: "TWD",
      expiresAtMs: new Date("2026-06-07T00:30:00.000Z"),
    });
    expect(fakeGateway.createCharge).toHaveBeenCalledWith({
      intentId: "intent-1",
      publicId: "card-public-1",
      amountCents: 1500,
      currency: "TWD",
      idempotencyKey: "credit-topup:intent-1",
    });
    expect(queues.updateValues.at(-1)).toMatchObject({
      providerTransactionId: "txn-1",
      updatedAt: expect.any(Date),
    });
    vi.useRealTimers();
  });

  it("rejects invalid create intent states and marks gateway failures", async () => {
    const { queues } = createFakeDb();
    const service = new CreditTopupService(
      env(),
      creditService() as never,
      gateway(),
    );

    await expect(
      service.createIntent({
        publicId: "card-public-1",
        amountCents: 0,
        currency: "TWD",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    queues.select.push({ get: null });
    await expect(
      service.createIntent({
        publicId: "missing",
        amountCents: 1000,
        currency: "TWD",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_CARD_NOT_FOUND" });

    queues.select.push({
      get: { id: "account-1", currency: "TWD", status: "suspended" },
    });
    await expect(
      service.createIntent({
        publicId: "card-public-1",
        amountCents: 1000,
        currency: "TWD",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_ACCOUNT_INACTIVE" });

    queues.select.push({
      get: { id: "account-1", currency: "MYR", status: "active" },
    });
    await expect(
      service.createIntent({
        publicId: "card-public-1",
        amountCents: 1000,
        currency: "TWD",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_CURRENCY_MISMATCH" });

    const failingGateway = gateway({
      createCharge: vi.fn(async () => {
        throw new Error("gateway down");
      }),
    });
    queues.select.push({
      get: { id: "account-1", currency: "TWD", status: "active" },
    });
    queues.insert.push({
      returning: [intent({ providerTransactionId: null })],
    });
    await expect(
      new CreditTopupService(
        env(),
        creditService() as never,
        failingGateway,
      ).createIntent({
        publicId: "card-public-1",
        amountCents: 1000,
        currency: "TWD",
      }),
    ).rejects.toThrow("gateway down");
    expect(queues.updateValues.at(-1)).toMatchObject({
      status: "failed",
      errorMessage: "gateway down",
      updatedAt: expect.any(Date),
    });
  });

  it("confirms failed and paid intents while preserving idempotency", async () => {
    const { queues } = createFakeDb();
    const fakeCreditService = creditService();
    const service = new CreditTopupService(
      env(),
      fakeCreditService as never,
      gateway(),
    );

    queues.select.push({ get: intent() });
    queues.update.push({
      returning: [intent({ status: "failed", errorMessage: "declined" })],
    });
    await expect(
      service.confirmIntent({
        intentId: "intent-1",
        status: "failed",
        providerPayload: { event: "failed" },
        errorMessage: "declined",
      }),
    ).resolves.toMatchObject({
      intent: { status: "failed", errorMessage: "declined" },
      credited: false,
      alreadyProcessed: false,
    });

    queues.select.push({ get: intent() });
    queues.update.push({
      returning: [
        intent({
          status: "paid",
          ledgerEntryId: "ledger-1",
          paidAtMs: new Date("2026-06-07T00:01:00.000Z"),
        }),
      ],
    });
    await expect(
      service.confirmIntent({
        intentId: "intent-1",
        status: "paid",
        providerPayload: { event: "paid" },
      }),
    ).resolves.toMatchObject({
      intent: { status: "paid", ledgerEntryId: "ledger-1" },
      credited: true,
      alreadyProcessed: false,
      balanceAfterCents: 6500,
    });
    expect(fakeCreditService.topup).toHaveBeenCalledWith({
      publicId: "card-public-1",
      amountCents: 1500,
      currency: "TWD",
      idempotencyKey: "credit-topup:intent-1",
      sourceType: "topup",
      sourceId: "intent-1",
    });

    queues.select.push({ get: intent({ status: "paid" }) });
    await expect(
      service.confirmIntent({ intentId: "intent-1", status: "paid" }),
    ).resolves.toMatchObject({
      credited: false,
      alreadyProcessed: true,
    });

    queues.select.push({ get: intent({ status: "expired" }) });
    await expect(
      service.confirmIntent({ providerTransactionId: "txn-1", status: "paid" }),
    ).resolves.toMatchObject({
      credited: false,
      alreadyProcessed: true,
    });
  });

  it("guards confirmation identifiers and reads intents by id", async () => {
    const { queues } = createFakeDb();
    const service = new CreditTopupService(
      env(),
      creditService() as never,
      gateway(),
    );

    await expect(
      service.confirmIntent({ status: "paid" }),
    ).rejects.toMatchObject({ code: "CREDIT_TOPUP_IDENTIFIER_REQUIRED" });

    queues.select.push({ get: null });
    await expect(
      service.confirmIntent({ intentId: "missing", status: "paid" }),
    ).rejects.toMatchObject({ code: "CREDIT_TOPUP_INTENT_NOT_FOUND" });

    queues.select.push({ get: intent({ providerTransactionId: "txn-real" }) });
    await expect(
      service.confirmIntent({
        intentId: "intent-1",
        providerTransactionId: "txn-spoof",
        status: "paid",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_TOPUP_IDENTIFIER_MISMATCH" });

    queues.select.push({ get: intent() });
    await expect(service.getIntent("intent-1")).resolves.toMatchObject({
      id: "intent-1",
    });
  });
});

describe("Credit top-up gateway helpers", () => {
  it("returns an unconfigured gateway when no provider URL is set", async () => {
    await expect(
      createCreditTopupGateway(env()).createCharge({
        intentId: "intent-1",
        publicId: "card-public-1",
        amountCents: 1000,
        currency: "TWD",
        idempotencyKey: "credit-topup:intent-1",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_TOPUP_NOT_CONFIGURED" });
  });

  it("posts signed HTTP charge requests and normalizes gateway responses", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          providerTransactionId: "txn-http",
          status: "unexpected",
          nextAction: {
            type: "client_secret",
            clientSecret: "secret-1",
          },
        }),
        { status: 200 },
      );
    });
    const gateway = new HttpCreditTopupGateway(
      "https://pay.example.test/topups",
      "bearer-token",
      "signing-secret",
      fetcher as never,
    );

    await expect(
      gateway.createCharge({
        intentId: "intent-1",
        publicId: "card-public-1",
        amountCents: 1000,
        currency: "TWD",
        idempotencyKey: "credit-topup:intent-1",
      }),
    ).resolves.toEqual({
      providerTransactionId: "txn-http",
      status: "pending",
      nextAction: { type: "client_secret", clientSecret: "secret-1" },
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://pay.example.test/topups",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          authorization: "Bearer bearer-token",
          "x-credit-topup-signature": expect.any(String),
          "x-credit-topup-signature-timestamp": expect.any(String),
        }),
        body: JSON.stringify({
          intentId: "intent-1",
          publicId: "card-public-1",
          amountCents: 1000,
          currency: "TWD",
          idempotencyKey: "credit-topup:intent-1",
        }),
      }),
    );
  });

  it("rejects failed or malformed HTTP gateway responses", async () => {
    await expect(
      new HttpCreditTopupGateway(
        "https://pay.example.test/topups",
        undefined,
        undefined,
        vi.fn(async () => new Response("nope", { status: 503 })) as never,
      ).createCharge({
        intentId: "intent-1",
        publicId: "card-public-1",
        amountCents: 1000,
        currency: "TWD",
        idempotencyKey: "credit-topup:intent-1",
      }),
    ).rejects.toThrow("Credit top-up gateway failed: 503");

    await expect(
      new HttpCreditTopupGateway(
        "https://pay.example.test/topups",
        undefined,
        undefined,
        vi.fn(
          async () => new Response(JSON.stringify({ status: "paid" })),
        ) as never,
      ).createCharge({
        intentId: "intent-1",
        publicId: "card-public-1",
        amountCents: 1000,
        currency: "TWD",
        idempotencyKey: "credit-topup:intent-1",
      }),
    ).rejects.toThrow("Credit top-up gateway response is invalid");
  });

  it("computes deterministic HMAC SHA-256 hex signatures", async () => {
    await expect(hmacSha256Hex("secret", "value")).resolves.toBe(
      "50e03ebe65be98bb8bf11ba2c892d54c079aca2b0d3b0162769c6d757a25434f",
    );
  });
});
