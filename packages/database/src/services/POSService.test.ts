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
      where: vi.fn(() => builder),
      get: vi.fn(async () => results.shift() ?? null),
    };
    return builder;
  });
}

function createTx(captured: { inserted: unknown[]; updated: unknown[] }) {
  return {
    insert: vi.fn(() => ({
      values: vi.fn(async (payload: unknown) => {
        captured.inserted.push(payload);
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((payload: unknown) => {
        captured.updated.push(payload);
        return { where: vi.fn(async () => undefined) };
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
    const tx = createTx(captured);
    const db = {
      select: createSelectQueue([
        {
          id: "shift-1",
          registerId: "register-1",
          status: "active",
          startAmountCents: 10000,
          totalSalesCents: 7500,
          totalRefundsCents: 2500,
        },
      ]),
      transaction: vi.fn(async (callback: (tx: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
    };
    const service = createServiceWithDb(db);
    vi.spyOn(
      service as unknown as { recordCashMovement: () => Promise<void> },
      "recordCashMovement",
    ).mockResolvedValue(undefined);
    vi.spyOn(service, "generateShiftReport").mockResolvedValue({
      success: true,
      data: { shiftId: "shift-1" },
    });

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
    expect(captured.updated[0]).toMatchObject({
      expectedAmountCents: 15000,
      differenceAmountCents: 0,
    });
    expect(captured.updated[0]).not.toHaveProperty("expectedAmount");
    expect(captured.updated[0]).not.toHaveProperty("differenceAmount");
  });

  it("validates and records refunds from authoritative order total cents", async () => {
    vi.useFakeTimers();
    const captured = { inserted: [] as unknown[], updated: [] };
    const tx = createTx(captured);
    const db = {
      select: createSelectQueue([
        {
          id: 123,
          totalAmountCents: 10000,
        },
        {
          id: "refund-1",
          itemsRefunded: "[]",
          metadata: "{}",
        },
      ]),
      transaction: vi.fn(async (callback: (tx: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
      })),
    };
    const service = createServiceWithDb(db);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("refund-1");

    const result = await service.processRefund(
      {
        originalOrderId: 123,
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
