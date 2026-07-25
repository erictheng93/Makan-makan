import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportService } from "./ReportService";

const mocks = vi.hoisted(() => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

const uuidMocks = vi.hoisted(() => ({ generateUUID: vi.fn() }));

vi.mock("@makanmakan/utils", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  generateUUID: uuidMocks.generateUUID,
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

function createQuery(result: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    groupBy: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    leftJoin: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    where: vi.fn(() => builder),
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

function mockInsert() {
  const inserted: unknown[] = [];
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
  return inserted;
}

function createService() {
  return new ReportService({} as D1Database);
}

function shiftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "shift-1",
    registerId: "register-1",
    operatorId: 7,
    startAmount: 100,
    startAmountCents: 10000,
    endAmount: 500,
    endAmountCents: 50000,
    expectedAmount: 450,
    expectedAmountCents: 45000,
    actualAmount: 460,
    actualAmountCents: 46000,
    differenceAmount: 10,
    differenceAmountCents: 1000,
    totalRefunds: 25,
    totalRefundsCents: 2500,
    cashSales: 200,
    cashSalesCents: 20000,
    cardSales: 150,
    cardSalesCents: 15000,
    digitalSales: 75,
    digitalSalesCents: 7500,
    startedAt: new Date("2026-06-07T08:00:00.000Z"),
    endedAt: new Date("2026-06-07T10:30:00.000Z"),
    status: "closed",
    ...overrides,
  };
}

describe("ReportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("generates shift reports with normalized money, JSON fields, and persisted summaries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T12:00:00.000Z"));
    uuidMocks.generateUUID.mockReturnValue("report-1");
    const inserted = mockInsert();
    mockSelectResults([
      [shiftRow()],
      [
        {
          id: "movement-1",
          amount: 50,
          amountCents: 5000,
          denominationBreakdown: JSON.stringify({ "100": 1 }),
          metadata: JSON.stringify({ source: "cash_count" }),
        },
      ],
      [{ totalReceipts: 4, printedReceipts: 3 }],
      [
        {
          totalOrders: 6,
          totalSales: 425,
          avgOrderValue: 70.83,
          cashOrders: 3,
          cardOrders: 2,
          digitalOrders: 1,
        },
      ],
    ]);

    const result = await createService().generateShiftReport("shift-1");

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      reportId: "report-1",
      reportData: {
        shift: { id: "shift-1", duration: 150 },
        summary: {
          startAmount: 100,
          endAmount: 500,
          totalSales: 425,
          totalRefunds: 25,
          netSales: 400,
          expectedAmount: 450,
          actualAmount: 460,
          difference: 10,
        },
        breakdown: {
          cashSales: 200,
          cardSales: 150,
          digitalSales: 75,
        },
        orderStats: {
          totalOrders: 6,
          avgOrderValue: 70.83,
          cashOrders: 3,
          cardOrders: 2,
          digitalOrders: 1,
        },
        movements: [
          expect.objectContaining({
            amount: 50,
            denominationBreakdown: { "100": 1 },
            metadata: { source: "cash_count" },
          }),
        ],
        receipts: { totalReceipts: 4, printedReceipts: 3 },
      },
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      id: "report-1",
      shiftId: "shift-1",
      registerId: "register-1",
      operatorId: 7,
      generatedAt: new Date("2026-06-07T12:00:00.000Z"),
    });
    expect(
      JSON.parse((inserted[0] as { summaryData: string }).summaryData),
    ).toMatchObject({ netSales: 400, actualAmount: 460 });
    vi.useRealTimers();
  });

  it("returns a service failure when a shift does not exist", async () => {
    const inserted = mockInsert();
    mockSelectResults([[]]);

    await expect(
      createService().generateShiftReport("missing-shift"),
    ).resolves.toMatchObject({ success: false });
    expect(inserted).toHaveLength(0);
  });

  it("builds daily reports from shift, order, refund, and top item stats", async () => {
    mockSelectResults([
      [
        { cash_shifts: shiftRow({ id: "shift-1" }) },
        { cash_shifts: shiftRow({ id: "shift-2" }) },
      ],
      [
        {
          totalOrders: 8,
          totalSales: 1000,
          totalTax: 50,
          totalDiscounts: 20,
          avgOrderValue: 125,
          cashOrders: 4,
          cardOrders: 3,
          digitalOrders: 1,
        },
      ],
      [{ totalRefunds: 2, totalRefundAmount: 100 }],
      [{ name: "Laksa", totalQuantity: 5, totalRevenue: 600 }],
    ]);

    await expect(
      createService().getDailyReport("restaurant-1", "2026-06-07"),
    ).resolves.toMatchObject({
      success: true,
      data: {
        date: "2026-06-07",
        shifts: [{ id: "shift-1" }, { id: "shift-2" }],
        summary: {
          totalOrders: 8,
          totalSales: 1000,
          totalTax: 50,
          totalDiscounts: 20,
          totalRefunds: 2,
          totalRefundAmount: 100,
          avgOrderValue: 125,
          netSales: 900,
        },
        paymentBreakdown: {
          cashOrders: 4,
          cardOrders: 3,
          digitalOrders: 1,
        },
        topItems: [{ name: "Laksa", totalQuantity: 5, totalRevenue: 600 }],
      },
    });
  });

  it("returns shift and register usage stats", async () => {
    mockSelectResults([
      [
        {
          totalShifts: 3,
          totalSales: 1200,
          totalRefunds: 75,
          avgSalesPerShift: 400,
          totalCashSales: 700,
          totalCardSales: 300,
          totalDigitalSales: 200,
          closedShifts: 2,
          avgCashDifference: 5,
        },
      ],
      [
        {
          registerName: "Front POS",
          period: "2026-06",
          shiftCount: 4,
          totalSales: 1500,
          totalTransactions: 30,
          avgSalesPerShift: 375,
        },
      ],
    ]);

    await expect(
      createService().getShiftStats("restaurant-1", {
        from: new Date("2026-06-01T00:00:00.000Z"),
        to: new Date("2026-06-07T23:59:59.000Z"),
      }),
    ).resolves.toMatchObject({
      success: true,
      data: {
        totalShifts: 3,
        totalSales: 1200,
        totalRefunds: 75,
        avgSalesPerShift: 400,
      },
    });

    await expect(
      createService().getRegisterUsageStats("restaurant-1", "month"),
    ).resolves.toEqual({
      success: true,
      data: {
        period: "month",
        stats: [
          {
            registerName: "Front POS",
            period: "2026-06",
            shiftCount: 4,
            totalSales: 1500,
            totalTransactions: 30,
            avgSalesPerShift: 375,
          },
        ],
      },
    });
  });

  it("wraps query failures in service result objects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.db.select.mockImplementation(() => {
      throw new Error("database unavailable");
    });

    await expect(
      createService().getDailyReport("restaurant-1", "2026-06-07"),
    ).resolves.toEqual({
      success: false,
      error: "database unavailable",
    });
    await expect(
      createService().getShiftStats("restaurant-1"),
    ).resolves.toEqual({
      success: false,
      error: "database unavailable",
    });
    await expect(
      createService().getRegisterUsageStats("restaurant-1", "day"),
    ).resolves.toEqual({
      success: false,
      error: "database unavailable",
    });
  });
});
