import { afterEach, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { POSService } from "./POSService";

function createServiceWithDb<TDb extends object>(db: TDb): POSService {
  const service = new POSService({} as D1Database, {
    JWT_SECRET: "test",
  });
  (service as unknown as { db: TDb }).db = db;
  return service;
}

function createSelectQueue(results: unknown[]) {
  return vi.fn(() => {
    const builder = {
      from: vi.fn(() => builder),
      innerJoin: vi.fn(() => builder),
      where: vi.fn(() => builder),
      orderBy: vi.fn(() => builder),
      get: vi.fn(async () => results.shift() ?? null),
      all: vi.fn(async () => results.shift() ?? []),
    };
    return builder;
  });
}

function createDbMutations(captured: {
  inserted: unknown[];
  updated: unknown[];
}) {
  return {
    insert: vi.fn(() => ({
      values: vi.fn(async (payload: unknown) => {
        captured.inserted.push(payload);
        return { kind: "insert" };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((payload: unknown) => {
        captured.updated.push(payload);
        return { where: vi.fn(() => ({ kind: "update" })) };
      }),
    })),
  };
}

describe("POSService money reads", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calculates shift closing totals from authoritative cents", async () => {
    const captured = { inserted: [], updated: [] as unknown[] };
    const mutations = createDbMutations(captured);
    const db = {
      ...mutations,
      select: createSelectQueue([
        {
          id: "shift-1",
          registerId: "register-1",
          operatorId: "7",
          status: "active",
          startAmountCents: 10000,
          totalSalesCents: 7500,
          totalRefundsCents: 2500,
          cashSalesCents: 7500,
          cardSalesCents: 0,
          digitalSalesCents: 0,
          startedAt: new Date("2026-06-07T08:00:00.000Z"),
        },
        {
          shift: {
            id: "shift-1",
            registerId: "register-1",
            operatorId: "7",
            status: "active",
            startAmountCents: 10000,
            totalSalesCents: 7500,
            totalRefundsCents: 2500,
            cashSalesCents: 7500,
            cardSalesCents: 0,
            digitalSalesCents: 0,
            startedAt: new Date("2026-06-07T08:00:00.000Z"),
          },
          registerName: "Front Register",
          operatorName: "Cashier",
        },
        [],
        { totalReceipts: 2, printedReceipts: 1 },
      ]),
      batch: vi.fn(async () => []),
    };
    const service = createServiceWithDb(db);

    const result = await service.endShift("shift-1", { actualAmount: 150 }, 7);

    expect(result).toMatchObject({
      success: true,
      data: {
        shift: {
          expectedAmount: 150,
          differenceAmount: 0,
        },
      },
    });
    const batchStatements = db.batch.mock.calls[0][0];
    expect(batchStatements).toHaveLength(4);
    expect(captured.updated[0]).toMatchObject({
      expectedAmountCents: 15000,
      differenceAmountCents: 0,
    });
    expect(captured.inserted[0]).toMatchObject({
      shiftId: "shift-1",
      registerId: "register-1",
      type: "closing",
      amountCents: 15000,
    });
    expect(captured.inserted[1]).toMatchObject({
      shiftId: "shift-1",
      registerId: "register-1",
      operatorId: "7",
    });
    expect(
      JSON.parse((captured.inserted[1] as { summaryData: string }).summaryData),
    ).toMatchObject({
      expectedAmount: 150,
      actualAmount: 150,
      difference: 0,
    });
    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(captured.updated[0]).not.toHaveProperty("expectedAmount");
    expect(captured.updated[0]).not.toHaveProperty("differenceAmount");
  });

  it("validates and records refunds from authoritative order total cents", async () => {
    vi.useFakeTimers();
    const captured = { inserted: [] as unknown[], updated: [] };
    const mutations = createDbMutations(captured);
    const db = {
      ...mutations,
      select: createSelectQueue([
        {
          id: "018f0000-0000-7000-8000-000000000123",
          totalAmountCents: 10000,
        },
        {
          id: "refund-1",
          itemsRefunded: "[]",
          metadata: "{}",
        },
      ]),
      batch: vi.fn(async () => []),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
      })),
    };
    const service = createServiceWithDb(db);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("refund-1");

    const result = await service.processRefund(
      {
        originalOrderId: "018f0000-0000-7000-8000-000000000123",
        refundType: "partial",
        refundAmount: 50,
        refundMethod: "card",
        reasonCode: "customer_request",
      },
      "register-1",
      7,
    );

    expect(result.success).toBe(true);
    expect(captured.inserted[0]).toMatchObject({
      originalAmountCents: 10000,
      refundAmountCents: 5000,
    });
    expect(captured.inserted[0]).not.toHaveProperty("originalAmount");
    expect(captured.inserted[0]).not.toHaveProperty("refundAmount");
  });
});
