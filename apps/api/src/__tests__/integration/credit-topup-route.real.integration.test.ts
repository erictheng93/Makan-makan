import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
} from "@makanmasak/database/testing";
import { creditLedgerEntries } from "@makanmasak/database";
import { eq } from "drizzle-orm";
import type { Env } from "../../types/env";
import { CreditService } from "../../features/credits/services/CreditService";

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

import routes from "../../features/credits/routes";

let testDb: TestDatabase;

function env(): Env {
  return {
    DB: testDb.bindings.DB,
    CACHE_KV: testDb.bindings.CACHE_KV,
  } as Env;
}

function topup(publicId: string, idempotencyKey: string) {
  return routes.request(
    `/cards/${publicId}/topup`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ amountCents: 1500, currency: "TWD" }),
    },
    env(),
  );
}

routes.onError((error, c) =>
  c.json(
    {
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
      },
    },
    500,
  ),
);

beforeAll(async () => {
  testDb = await createTestDatabase();
});

afterAll(async () => {
  await testDb.dispose();
});

beforeEach(async () => {
  await testDb.truncateAll();
});

describe("credit topup route — retry after transient failure", () => {
  it("releases a 500 reservation and credits one movement on same-key retry", async () => {
    const service = new CreditService(env());
    const card = await service.issueCard({ currency: "TWD" });
    const idempotencyKey = "topup-route-transient-retry";

    await testDb.db
      .prepare(
        `CREATE TRIGGER poison_route_topup_ledger
           BEFORE INSERT ON credit_ledger_entries
           WHEN NEW.idempotency_key = '${idempotencyKey}'
           BEGIN SELECT RAISE(ABORT, 'temporary topup ledger failure'); END`,
      )
      .run();

    let first: Response;
    try {
      first = await topup(card.publicId, idempotencyKey);
    } finally {
      await testDb.db.prepare("DROP TRIGGER poison_route_topup_ledger").run();
    }

    expect(first.status).toBe(500);
    expect((await service.getBalance(card.publicId)).balanceCents).toBe(0);

    const second = await topup(card.publicId, idempotencyKey);
    expect(second.status).toBe(200);
    expect(second.headers.get("X-Idempotent-Replay")).toBeNull();

    const replay = await topup(card.publicId, idempotencyKey);
    expect(replay.status).toBe(200);
    expect(replay.headers.get("X-Idempotent-Replay")).toBe("true");
    expect((await service.getBalance(card.publicId)).balanceCents).toBe(1500);

    const topups = (
      await testDb.drizzle
        .select()
        .from(creditLedgerEntries)
        .where(eq(creditLedgerEntries.accountId, card.accountId))
        .all()
    ).filter((entry) => entry.entryType === "topup");
    expect(topups).toHaveLength(1);
    expect(topups[0]).toMatchObject({
      amountCents: 1500,
      balanceAfterCents: 1500,
      idempotencyKey,
    });
  });
});
