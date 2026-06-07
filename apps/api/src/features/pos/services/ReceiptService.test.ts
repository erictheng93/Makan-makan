import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReceiptService } from "./ReceiptService";

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
  return new ReceiptService({} as D1Database);
}

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    orderNumber: "A001",
    customerInfo: { name: "Dina" },
    subtotal: 300,
    subtotalCents: 30000,
    taxAmount: 15,
    taxAmountCents: 1500,
    discountAmount: 20,
    discountAmountCents: 2000,
    totalAmount: 295,
    totalAmountCents: 29500,
    paymentMethod: "cash",
    ...overrides,
  };
}

function itemRow(overrides: Record<string, unknown> = {}) {
  return {
    itemSnapshot: { name: "Nasi Lemak" },
    quantity: 2,
    unitPrice: 120,
    unitPriceCents: 12000,
    totalPrice: 240,
    totalPriceCents: 24000,
    customizations: JSON.stringify([{ name: "Extra sambal" }]),
    ...overrides,
  };
}

function receiptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "receipt-1",
    orderId: 101,
    registerId: "register-1",
    shiftId: "shift-1",
    receiptNumber: "R1710000000000-4FZZZX",
    receiptType: "customer",
    templateName: "standard",
    content: JSON.stringify({ orderNumber: "A001", totalAmount: 295 }),
    rawContent: null,
    printStatus: "pending",
    printAttempts: 0,
    printerName: null,
    printerResponse: null,
    printedAt: null,
    reprintedCount: 0,
    lastReprintAt: null,
    createdAt: new Date("2026-06-07T00:00:00.000Z"),
    ...overrides,
  };
}

describe("ReceiptService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("prints a receipt with generated content and queued print status", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    vi.spyOn(crypto, "randomUUID").mockReturnValue("receipt-1");
    vi.spyOn(Math, "random").mockReturnValue(0.125);
    const mutations = mockMutations();
    mockSelectResults([[orderRow()], [itemRow()], [receiptRow()]]);

    const result = await createService().printReceipt(
      { orderId: 101 },
      "register-1",
      "shift-1",
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        id: "receipt-1",
        orderId: 101,
        registerId: "register-1",
        shiftId: "shift-1",
        receiptType: "customer",
        templateName: "standard",
        content: { orderNumber: "A001", totalAmount: 295 },
      },
    });
    expect(mutations.inserted).toHaveLength(1);
    expect(mutations.inserted[0]).toMatchObject({
      id: "receipt-1",
      orderId: 101,
      registerId: "register-1",
      shiftId: "shift-1",
      receiptType: "customer",
      templateName: "standard",
      printStatus: "pending",
      printAttempts: 0,
      reprintedCount: 0,
      createdAt: new Date("2026-06-07T00:00:00.000Z"),
    });
    expect(
      JSON.parse((mutations.inserted[0] as { content: string }).content),
    ).toMatchObject({
      template: "standard",
      orderNumber: "A001",
      customerName: "Dina",
      items: [
        {
          name: "Nasi Lemak",
          quantity: 2,
          price: 120,
          subtotal: 240,
          customizations: [{ name: "Extra sambal" }],
        },
      ],
      subtotal: 300,
      taxAmount: 15,
      discountAmount: 20,
      totalAmount: 295,
      paymentMethod: "cash",
    });
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("rejects missing orders before inserting receipts", async () => {
    const mutations = mockMutations();
    mockSelectResults([[]]);

    await expect(
      createService().printReceipt({ orderId: 101 }, "register-1"),
    ).resolves.toMatchObject({ success: false });

    expect(mutations.inserted).toHaveLength(0);
  });

  it("lists receipts with parsed content and pagination metadata", async () => {
    mockSelectResults([
      [
        receiptRow({
          id: "receipt-1",
          content: JSON.stringify({ orderNumber: "A001" }),
          rawContent: "printer bytes",
          printedAt: new Date("2026-06-07T01:00:00.000Z"),
        }),
        receiptRow({
          id: "receipt-2",
          shiftId: null,
          content: "",
        }),
      ],
    ]);

    await expect(
      createService().getReceipts("register-1", {
        startDate: "2026-06-01",
        endDate: "2026-06-07",
        receiptType: "customer",
        page: 2,
        limit: 2,
      }),
    ).resolves.toMatchObject({
      success: true,
      data: {
        receipts: [
          {
            id: "receipt-1",
            content: { orderNumber: "A001" },
            rawContent: "printer bytes",
            printedAt: new Date("2026-06-07T01:00:00.000Z"),
          },
          {
            id: "receipt-2",
            shiftId: undefined,
            content: {},
          },
        ],
        pagination: { page: 2, limit: 2, hasMore: true },
      },
    });
  });

  it("returns receipt details and missing receipt responses", async () => {
    mockSelectResults([[receiptRow()], []]);

    await expect(
      createService().getReceiptDetail("receipt-1"),
    ).resolves.toMatchObject({
      success: true,
      data: {
        id: "receipt-1",
        content: { orderNumber: "A001", totalAmount: 295 },
      },
    });
    await expect(
      createService().getReceiptDetail("missing"),
    ).resolves.toMatchObject({ success: false });
  });

  it("reprints and cancels receipts with the expected update payloads", async () => {
    vi.useFakeTimers();
    const mutations = mockMutations();
    mockSelectResults([[receiptRow()], []]);

    await expect(createService().reprintReceipt("receipt-1")).resolves.toEqual({
      success: true,
    });
    await expect(
      createService().reprintReceipt("missing"),
    ).resolves.toMatchObject({ success: false });
    await expect(createService().cancelPrint("receipt-1")).resolves.toEqual({
      success: true,
    });

    expect(mutations.updated).toEqual([
      expect.objectContaining({
        printStatus: "pending",
        lastReprintAt: expect.any(Date),
      }),
      { printStatus: "cancelled" },
    ]);
    vi.clearAllTimers();
    vi.useRealTimers();
  });
});
