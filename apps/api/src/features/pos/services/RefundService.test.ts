import { beforeEach, describe, expect, it, vi } from "vitest";
import { RefundService } from "./RefundService";

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

function createQuery(result: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    offset: vi.fn(() => builder),
    then: (
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function mockSelectResults(results: unknown[]) {
  mocks.db.select.mockImplementation(() => createQuery(results.shift() ?? []));
}

function mockMutations() {
  const inserted: unknown[] = [];
  const updated: unknown[] = [];

  mocks.db.insert.mockImplementation(() => {
    const builder = {
      values: vi.fn((payload: unknown) => {
        inserted.push(payload);
        return builder;
      }),
      then: (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) => Promise.resolve(undefined).then(resolve, reject),
    };
    return builder;
  });
  mocks.db.update.mockImplementation(() => {
    const builder = {
      set: vi.fn((payload: unknown) => {
        updated.push(payload);
        return builder;
      }),
      where: vi.fn(() => builder),
      then: (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) => Promise.resolve(undefined).then(resolve, reject),
    };
    return builder;
  });

  return { inserted, updated };
}

function createService() {
  return new RefundService({} as D1Database);
}

function refundRequest(overrides: Record<string, unknown> = {}) {
  return {
    originalOrderId: 101,
    refundType: "partial" as const,
    refundAmount: 25,
    refundMethod: "cash",
    reasonCode: "customer_request",
    reasonDescription: "Changed mind",
    itemsRefunded: [{ itemId: 1, quantity: 1 }],
    customerSignature: "signed",
    ...overrides,
  };
}

function refundRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "refund-1",
    originalOrderId: 101,
    registerId: "register-1",
    shiftId: "shift-1",
    refundNumber: "RF1",
    refundType: "partial",
    originalAmount: 100,
    refundAmount: 25,
    refundMethod: "cash",
    reasonCode: "customer_request",
    itemsRefunded: JSON.stringify([{ itemId: 1 }]),
    processedBy: 7,
    status: "processing",
    metadata: "{}",
    ...overrides,
  };
}

describe("RefundService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("processes live cash refunds and records a cash movement", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const mutations = mockMutations();
    mockSelectResults([
      [{ id: 101, totalAmount: 100, totalAmountCents: 10000 }],
      [{ totalRefunded: 10 }],
      [{ status: "active" }],
      [refundRow()],
    ]);

    const result = await createService().processRefund(
      refundRequest(),
      "register-1",
      7,
      "shift-1",
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        refundId: "refund-1",
        ledgerMutation: true,
        itemsRefunded: [{ itemId: 1 }],
        metadata: {},
      },
    });
    expect(mutations.inserted).toHaveLength(2);
    expect(mutations.inserted[0]).toMatchObject({
      originalOrderId: 101,
      registerId: "register-1",
      shiftId: "shift-1",
      refundAmount: 25,
      refundAmountCents: 2500,
      metadata: "{}",
    });
    expect(mutations.inserted[1]).toMatchObject({
      shiftId: "shift-1",
      registerId: "register-1",
      type: "refund",
      amount: -25,
      amountCents: -2500,
      referenceId: 101,
      referenceType: "refund",
    });
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("records post-close refunds without mutating the live cash ledger", async () => {
    vi.useFakeTimers();
    const mutations = mockMutations();
    mockSelectResults([
      [{ id: 101, totalAmount: 100, totalAmountCents: 10000 }],
      [{ totalRefunded: 0 }],
      [{ status: "closed" }],
      [refundRow({ metadata: JSON.stringify({ postCloseAdjustment: true }) })],
    ]);

    const result = await createService().processRefund(
      refundRequest(),
      "register-1",
      7,
      "shift-1",
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        refundId: "refund-1",
        adjustmentId: "refund-1",
        ledgerMutation: false,
        metadata: { postCloseAdjustment: true },
      },
    });
    expect(mutations.inserted).toHaveLength(1);
    expect(mutations.inserted[0]).toMatchObject({
      metadata: JSON.stringify({ postCloseAdjustment: true }),
    });
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("rejects invalid refund requests before inserting rows", async () => {
    const mutations = mockMutations();

    mockSelectResults([[]]);
    await expect(
      createService().processRefund(refundRequest(), "register-1", 7),
    ).resolves.toMatchObject({ success: false });

    mockSelectResults([[{ id: 101, totalAmount: 100 }]]);
    await expect(
      createService().processRefund(
        refundRequest({ refundAmount: 125 }),
        "register-1",
        7,
      ),
    ).resolves.toMatchObject({ success: false });

    mockSelectResults([
      [{ id: 101, totalAmount: 100 }],
      [{ totalRefunded: 90 }],
    ]);
    await expect(
      createService().processRefund(refundRequest(), "register-1", 7),
    ).resolves.toMatchObject({ success: false });

    expect(mutations.inserted).toHaveLength(0);
  });

  it("lists refunds with parsed JSON fields and pagination metadata", async () => {
    mockSelectResults([
      [
        refundRow({
          id: "refund-1",
          itemsRefunded: JSON.stringify([{ itemId: 1 }]),
          metadata: JSON.stringify({ channel: "pos" }),
        }),
        refundRow({
          id: "refund-2",
          itemsRefunded: "",
          metadata: "",
        }),
      ],
    ]);

    await expect(
      createService().getRefunds("register-1", {
        startDate: "2026-06-01",
        endDate: "2026-06-07",
        status: "completed",
        orderId: 101,
        page: 2,
        limit: 2,
      }),
    ).resolves.toMatchObject({
      success: true,
      data: {
        refunds: [
          {
            id: "refund-1",
            itemsRefunded: [{ itemId: 1 }],
            metadata: { channel: "pos" },
          },
          { id: "refund-2", itemsRefunded: [], metadata: {} },
        ],
        pagination: { page: 2, limit: 2, hasMore: true },
      },
    });
  });

  it("returns refund details, missing refunds, and status transition updates", async () => {
    const mutations = mockMutations();
    mockSelectResults([[refundRow()], []]);

    await expect(
      createService().getRefundDetail("refund-1"),
    ).resolves.toMatchObject({
      success: true,
      data: { id: "refund-1", itemsRefunded: [{ itemId: 1 }], metadata: {} },
    });
    await expect(
      createService().getRefundDetail("missing"),
    ).resolves.toMatchObject({
      success: false,
    });

    await expect(
      createService().cancelRefund("refund-1", 7, "duplicate"),
    ).resolves.toEqual({ success: true });
    await expect(createService().approveRefund("refund-1", 8)).resolves.toEqual(
      {
        success: true,
      },
    );
    await expect(
      createService().rejectRefund("refund-1", 9, "not eligible"),
    ).resolves.toEqual({ success: true });

    expect(mutations.updated).toEqual([
      expect.objectContaining({
        status: "cancelled",
        approvedBy: 7,
        metadata: JSON.stringify({ cancellation_reason: "duplicate" }),
      }),
      expect.objectContaining({
        status: "completed",
        approvedBy: 8,
        completedAt: expect.any(Date),
      }),
      expect.objectContaining({
        status: "failed",
        approvedBy: 9,
        metadata: JSON.stringify({ rejection_reason: "not eligible" }),
      }),
    ]);
  });
});
