import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../../../middleware/auth";
import { ApiError } from "../../../shared/utils/api-error";

const mocks = vi.hoisted(() => ({
  creditService: {
    issueCard: vi.fn(),
    topup: vi.fn(),
    getBalance: vi.fn(),
    setPin: vi.fn(),
    setCardStatus: vi.fn(),
    listLedger: vi.fn(),
    listLedgerForExport: vi.fn(),
  },
  creditServiceCtor: vi.fn(),
  topupService: {
    createIntent: vi.fn(),
  },
  topupServiceCtor: vi.fn(),
  webhookService: {
    handle: vi.fn(),
  },
  webhookServiceCtor: vi.fn(),
  user: {
    id: "user-1",
    username: "admin",
    role: 0,
    restaurantId: "restaurant-1",
  } as AuthUser,
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("user", mocks.user);
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../../../middleware/idempotency", () => ({
  idempotencyMiddleware: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../../../middleware/rateLimiter", () => ({
  rateLimitMiddleware: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../services/CreditService", () => ({
  CreditService: vi.fn(function CreditService(...args: unknown[]) {
    mocks.creditServiceCtor(...args);
    return mocks.creditService;
  }),
}));

vi.mock("../services/CreditTopupService", () => ({
  CreditTopupService: vi.fn(function CreditTopupService(...args: unknown[]) {
    mocks.topupServiceCtor(...args);
    return mocks.topupService;
  }),
}));

vi.mock("../services/CreditTopupWebhookService", () => ({
  CreditTopupWebhookService: vi.fn(function CreditTopupWebhookService(
    ...args: unknown[]
  ) {
    mocks.webhookServiceCtor(...args);
    return mocks.webhookService;
  }),
}));

import routes from "./index";

routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }

  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function env() {
  return { DB: { binding: "db" }, CACHE_KV: { binding: "cache" } };
}

function request(path: string, init: RequestInit = {}) {
  return routes.request(path, init, env() as never);
}

function jsonRequest(
  path: string,
  method: "POST" | "PUT",
  body: unknown,
  headers: Record<string, string> = {},
) {
  return request(path, {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function json(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data?: unknown;
    error?: { code?: string; message?: string; details?: unknown };
  };
}

describe("credits routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = {
      id: "user-1",
      username: "admin",
      role: 0,
      restaurantId: "restaurant-1",
    };
    mocks.creditService.issueCard.mockResolvedValue({
      account: { id: "acct-1", balanceCents: 5000, currency: "TWD" },
      card: { publicId: "card-public-1", status: "active" },
    });
    mocks.creditService.topup.mockResolvedValue({
      accountId: "acct-1",
      balanceCents: 7000,
      ledgerEntryId: "ledger-1",
    });
    mocks.creditService.getBalance.mockResolvedValue({
      publicId: "card-public-1",
      balanceCents: 7000,
      currency: "TWD",
      status: "active",
    });
    mocks.creditService.setPin.mockResolvedValue(undefined);
    mocks.creditService.setCardStatus.mockResolvedValue(undefined);
    mocks.creditService.listLedger.mockResolvedValue({
      items: [{ id: "ledger-1", amountCents: 2000 }],
      total: 1,
    });
    mocks.creditService.listLedgerForExport.mockResolvedValue([
      {
        createdAt: new Date("2026-06-07T10:00:00.000Z"),
        accountId: "acct-1",
        entryType: "topup",
        amountCents: 2000,
        currency: "TWD",
        sourceType: "topup",
        sourceId: "cash,terminal",
        balanceAfterCents: 7000,
        idempotencyKey: 'key-"1"',
      },
      {
        createdAt: 1780840800000,
        accountId: "acct-1",
        entryType: "spend",
        amountCents: -350,
        currency: "TWD",
        sourceType: "market_checkout",
        sourceId: null,
        balanceAfterCents: 6650,
        idempotencyKey: "key-2",
      },
    ]);
    mocks.topupService.createIntent.mockResolvedValue({
      intent: {
        id: "intent-1",
        status: "pending",
        amountCents: 3000,
        currency: "TWD",
        providerTransactionId: "provider-1",
      },
      nextAction: { type: "redirect", url: "https://pay.example.test" },
    });
    mocks.webhookService.handle.mockResolvedValue({
      credited: true,
      intentId: "intent-1",
    });
  });

  it("issues stored-value cards through the credit service", async () => {
    const payload = {
      currency: "TWD",
      ownerCustomerId: "customer-1",
      pin: "1234",
      initialBalanceCents: 5000,
    };

    const response = await jsonRequest("/cards", "POST", payload);
    const body = await json(response);

    expect(response.status).toBe(201);
    expect(mocks.creditServiceCtor).toHaveBeenCalledWith(env());
    expect(mocks.creditService.issueCard).toHaveBeenCalledWith(payload);
    expect(body).toEqual({
      success: true,
      data: {
        account: { id: "acct-1", balanceCents: 5000, currency: "TWD" },
        card: { publicId: "card-public-1", status: "active" },
      },
    });
  });

  it("requires valid issue-card payloads before service calls", async () => {
    const response = await jsonRequest("/cards", "POST", {
      currency: "USD",
      initialBalanceCents: -1,
    });
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(mocks.creditService.issueCard).not.toHaveBeenCalled();
  });

  it("tops up cards with idempotency key and reference mapping", async () => {
    const response = await jsonRequest(
      "/cards/card-public-1/topup",
      "POST",
      {
        amountCents: 2000,
        currency: "TWD",
        fundingSource: "cash",
        reference: "register-1",
      },
      { "Idempotency-Key": "idem-1" },
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.creditService.topup).toHaveBeenCalledWith({
      publicId: "card-public-1",
      amountCents: 2000,
      currency: "TWD",
      idempotencyKey: "idem-1",
      sourceType: "topup",
      sourceId: "register-1",
    });
    expect(body).toEqual({
      success: true,
      data: {
        accountId: "acct-1",
        balanceCents: 7000,
        ledgerEntryId: "ledger-1",
      },
    });
  });

  it("creates online top-up intents with provider next actions", async () => {
    const response = await jsonRequest(
      "/cards/card-public-1/topup/online",
      "POST",
      { amountCents: 3000, currency: "TWD" },
    );
    const body = await json(response);

    expect(response.status).toBe(201);
    expect(mocks.topupServiceCtor).toHaveBeenCalledWith(env());
    expect(mocks.topupService.createIntent).toHaveBeenCalledWith({
      publicId: "card-public-1",
      amountCents: 3000,
      currency: "TWD",
    });
    expect(body).toEqual({
      success: true,
      data: {
        intentId: "intent-1",
        status: "pending",
        amountCents: 3000,
        currency: "TWD",
        providerTransactionId: "provider-1",
        nextAction: { type: "redirect", url: "https://pay.example.test" },
      },
    });
  });

  it("passes raw top-up webhook payloads and headers to the webhook service", async () => {
    const response = await request("/topup-webhooks/ecpay", {
      method: "POST",
      body: '{"event":"paid"}',
      headers: {
        "Content-Type": "application/json",
        "x-provider-signature": "sig-1",
      },
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.webhookServiceCtor).toHaveBeenCalledWith(env());
    expect(mocks.webhookService.handle).toHaveBeenCalledWith(
      '{"event":"paid"}',
      expect.any(Headers),
    );
    expect(body).toEqual({
      success: true,
      data: { credited: true, intentId: "intent-1" },
    });
  });

  it("returns public balances without leaking PII", async () => {
    const response = await request("/cards/card-public-1/balance");
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.creditService.getBalance).toHaveBeenCalledWith(
      "card-public-1",
    );
    expect(body).toEqual({
      success: true,
      data: {
        publicId: "card-public-1",
        balanceCents: 7000,
        currency: "TWD",
        status: "active",
      },
    });
  });

  it("sets PINs and card statuses for admin card operations", async () => {
    let response = await jsonRequest("/cards/card-public-1/pin", "POST", {
      newPin: "654321",
    });
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.creditService.setPin).toHaveBeenCalledWith(
      "card-public-1",
      "654321",
    );
    expect(body).toEqual({ success: true });

    response = await jsonRequest("/cards/card-public-1/freeze", "POST", {
      status: "lost",
    });
    body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.creditService.setCardStatus).toHaveBeenCalledWith(
      "card-public-1",
      "lost",
    );
    expect(body).toEqual({ success: true });
  });

  it("lists ledger entries with validated pagination", async () => {
    const response = await request(
      "/cards/card-public-1/ledger?limit=25&offset=5",
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.creditService.listLedger).toHaveBeenCalledWith(
      "card-public-1",
      { limit: 25, offset: 5 },
    );
    expect(body).toEqual({
      success: true,
      data: { items: [{ id: "ledger-1", amountCents: 2000 }], total: 1 },
    });
  });

  it("exports liability ledger CSV with escaped values and debit directions", async () => {
    const response = await request("/accounting/export?from=100&to=200");
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/csv; charset=utf-8",
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="credit-liability-ledger.csv"',
    );
    expect(mocks.creditService.listLedgerForExport).toHaveBeenCalledWith({
      fromMs: 100,
      toMs: 200,
    });
    expect(text.split("\n")).toEqual([
      [
        "created_at_ms",
        "account_id",
        "entry_type",
        "account_code",
        "account_name",
        "direction",
        "amount_cents",
        "currency",
        "source_type",
        "source_id",
        "balance_after_cents",
        "idempotency_key",
      ].join(","),
      '1780826400000,acct-1,topup,2100,credits_liability,credit,2000,TWD,topup,"cash,terminal",7000,"key-""1"""',
      "1780840800000,acct-1,spend,2100,credits_liability,debit,350,TWD,market_checkout,,6650,key-2",
    ]);
  });
});
