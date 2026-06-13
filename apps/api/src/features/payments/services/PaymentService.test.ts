import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../types/env";
import { ApiError } from "../../../shared/utils/api-error";
import { PaymentService } from "./PaymentService";

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

vi.mock("@makanmakan/utils", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  generateUUID: vi.fn(() => "audit-id"),
}));

interface PreparedStatement {
  sql: string;
  values: unknown[];
  bind: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
}

function createSelectQuery(result: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (
      resolve: (value: unknown[]) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function queueOrderRows(rows: unknown[][]) {
  mocks.db.select.mockImplementation(() =>
    createSelectQuery(rows.shift() ?? []),
  );
}

function mockOrderUpdate(returningRows: unknown[] = []) {
  const updates: unknown[] = [];
  mocks.db.update.mockImplementation(() => {
    const builder = {
      set: vi.fn((payload: unknown) => {
        updates.push(payload);
        return builder;
      }),
      where: vi.fn(() => builder),
      returning: vi.fn(() => Promise.resolve(returningRows)),
    };
    return builder;
  });
  return updates;
}

function createD1(orderUpdateChanges = 1) {
  const statements: PreparedStatement[] = [];
  const committed: PreparedStatement[] = [];
  const db = {
    prepare: vi.fn((sql: string) => {
      const statement: PreparedStatement = {
        sql,
        values: [],
        bind: vi.fn((...values: unknown[]) => {
          statement.values = values;
          return statement;
        }),
        run: vi.fn(async () => {
          committed.push(statement);
          return {
            meta: {
              changes: statement.sql.includes("UPDATE orders")
                ? orderUpdateChanges
                : 1,
            },
            success: true,
          };
        }),
      };
      statements.push(statement);
      return statement;
    }),
    batch: vi.fn(async (batchStatements: PreparedStatement[]) => {
      committed.push(...batchStatements);
      return batchStatements.map(() => ({
        meta: { changes: 1 },
        success: true,
      }));
    }),
  };
  return { db, statements, committed };
}

function createD1WithBatchFailure(
  failWhen: (statement: PreparedStatement) => boolean,
) {
  const setup = createD1();
  setup.db.batch.mockImplementation(
    async (batchStatements: PreparedStatement[]) => {
      if (batchStatements.some(failWhen)) {
        throw new Error("injected batch failure");
      }
      setup.committed.push(...batchStatements);
      return batchStatements.map(() => ({
        meta: { changes: 1 },
        success: true,
      }));
    },
  );
  return setup;
}

function env(db: unknown) {
  return {
    DB: db,
    CACHE_KV: {
      delete: vi.fn(async () => undefined),
    },
  } as Env;
}

function envWithRealtime(db: unknown) {
  const fetch = vi.fn(async (_request: string, init?: RequestInit) => ({
    json: async () => ({
      success: true,
      eventId: JSON.parse(String(init?.body)).eventId,
      recipientCount: 2,
    }),
  }));
  const cacheKV = {
    delete: vi.fn(async () => undefined),
  };
  return {
    env: {
      DB: db,
      CACHE_KV: cacheKV,
      REALTIME_SESSION: {
        idFromName: vi.fn((name: string) => name),
        get: vi.fn(() => ({ fetch })),
      },
    } as unknown as Env,
    cacheKV,
    fetch,
  };
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    restaurantId: "restaurant-1",
    status: "confirmed",
    paymentStatus: "pending",
    tableId: null,
    totalAmount: 120,
    totalAmountCents: 12000,
    ...overrides,
  };
}

function statementContaining(statements: PreparedStatement[], text: string) {
  return statements.find((statement) => statement.sql.includes(text));
}

describe("PaymentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1780833600000);
  });

  it("processes full payments from the authoritative order total", async () => {
    const { db, statements } = createD1();
    queueOrderRows([[order()]]);
    mockOrderUpdate([{ status: "paid", paymentStatus: "paid" }]);

    await expect(
      new PaymentService(env(db)).processPayment(
        {
          orderId: 101,
          paymentMode: "full",
          amount: 120,
          expectedTotal: 120,
          method: "cash",
        },
        {
          country: "TW",
          currency: "TWD",
          idempotencyKey: "idem-1",
          customerInfo: { phone: "0912345678" },
          metadata: { terminal: "front" },
        },
      ),
    ).resolves.toEqual({
      status: 200,
      data: {
        paymentId: "pay_101_1780833600000",
        orderId: 101,
        orderStatus: "paid",
        paymentStatus: "paid",
        authorizedTotal: 120,
      },
    });

    expect(
      statementContaining(statements, "INSERT INTO payment_transactions")
        ?.values,
    ).toEqual([
      "pay_101_1780833600000",
      101,
      "restaurant-1",
      12000,
      "TWD",
      "TW",
      "cash",
      "cash",
      "idem-1",
      JSON.stringify({ phone: "0912345678" }),
      JSON.stringify({
        terminal: "front",
        paymentMode: "full",
        closeOrder: true,
      }),
      1780833600000,
      1780833600000,
    ]);

    expect(statementContaining(statements, "UPDATE orders")?.sql).toContain(
      "status = 'paid'",
    );
    expect(statementContaining(statements, "UPDATE orders")?.values).toEqual([
      1780833600000,
      "cash",
      "pay_101_1780833600000",
      1780833600000,
      101,
    ]);
    expect(
      statementContaining(statements, "UPDATE payment_transactions")?.values,
    ).toEqual([
      "paid",
      1780833600000,
      "paid",
      1780833600000,
      "paid",
      1780833600000,
      "pay_101_1780833600000",
    ]);
    expect(
      statements
        .filter((statement) =>
          statement.sql.includes("INSERT OR IGNORE INTO payment_audit_log"),
        )
        .map((statement) => statement.values[4]),
    ).toEqual(["attempt", "success"]);
  });

  it("does not commit payment ledger writes when a middle write fails", async () => {
    const { db, committed } = createD1WithBatchFailure((statement) =>
      statement.sql.includes("UPDATE payment_transactions"),
    );
    queueOrderRows([[order()]]);
    mockOrderUpdate([{ status: "paid", paymentStatus: "paid" }]);

    await expect(
      new PaymentService(env(db)).processPayment({
        orderId: 101,
        paymentMode: "full",
        amount: 120,
        expectedTotal: 120,
        method: "cash",
      }),
    ).rejects.toThrow("injected batch failure");

    expect(db.batch).toHaveBeenCalledOnce();
    expect(committed.map((statement) => statement.sql)).toEqual([
      expect.stringContaining("UPDATE orders"),
    ]);
  });

  it("rejects payment finalization when the payable-state guard loses the race", async () => {
    const { db } = createD1(0);
    queueOrderRows([[order()]]);
    mockOrderUpdate([{ status: "paid", paymentStatus: "paid" }]);

    await expect(
      new PaymentService(env(db)).processPayment({
        orderId: 101,
        paymentMode: "full",
        amount: 120,
        expectedTotal: 120,
        method: "cash",
      }),
    ).rejects.toMatchObject({
      code: "ORDER_NOT_PAYABLE",
      status: 409,
    });

    expect(db.batch).not.toHaveBeenCalled();
  });

  it("processes partial payments without closing the order when requested", async () => {
    const { db, statements } = createD1();
    queueOrderRows([[order({ status: "served" })]]);
    mockOrderUpdate([{ status: "served", paymentStatus: "paid" }]);

    await expect(
      new PaymentService(env(db)).processPayment({
        orderId: 101,
        paymentMode: "partial",
        expectedTotal: 120,
        payments: [
          { method: "cash", amount: 50 },
          { method: "card", amount: 70 },
        ],
        gateway: "mixed",
        closeOrder: false,
      }),
    ).resolves.toMatchObject({
      data: {
        orderStatus: "served",
        paymentStatus: "paid",
        authorizedTotal: 120,
      },
    });

    expect(statementContaining(statements, "UPDATE orders")?.sql).not.toContain(
      "SET status = 'paid'",
    );
    expect(statementContaining(statements, "UPDATE orders")?.values).toEqual([
      "split",
      "pay_101_1780833600000",
      1780833600000,
      101,
    ]);
    expect(
      statementContaining(statements, "INSERT INTO payment_transactions")
        ?.values[6],
    ).toBe("split");
    expect(
      statementContaining(statements, "INSERT INTO payment_transactions")
        ?.values[10],
    ).toBe(JSON.stringify({ paymentMode: "partial", closeOrder: false }));
  });

  it("releases occupied tables when a payment closes the order", async () => {
    const { db, statements } = createD1();
    queueOrderRows([[order({ tableId: 9 })]]);
    mockOrderUpdate([{ status: "paid", paymentStatus: "paid" }]);

    await new PaymentService(env(db)).processPayment({
      orderId: 101,
      paymentMode: "full",
      amount: 120,
      expectedTotal: 120,
      method: "cash",
    });

    expect(statementContaining(statements, "UPDATE tables")?.values).toEqual([
      1780833600000, 9,
    ]);
  });

  it("invalidates order cache and broadcasts paid status when payment closes the order", async () => {
    const { db } = createD1();
    const setup = envWithRealtime(db);
    queueOrderRows([
      [
        order({
          orderNumber: "A001",
          status: "served",
        }),
      ],
    ]);
    mockOrderUpdate([{ status: "paid", paymentStatus: "paid" }]);

    await new PaymentService(setup.env).processPayment(
      {
        orderId: 101,
        paymentMode: "full",
        amount: 120,
        expectedTotal: 120,
        method: "cash",
      },
      {
        user: {
          id: 4,
          role: 4,
          restaurantId: "restaurant-1",
          username: "cashier",
        },
      },
    );

    expect(setup.cacheKV.delete).toHaveBeenCalledWith("order:101:full");
    expect(setup.cacheKV.delete).toHaveBeenCalledWith("order:101:basic");
    expect(setup.fetch).toHaveBeenCalledTimes(2);

    const event = JSON.parse(
      String(setup.fetch.mock.calls[0]?.[1]?.body),
    ) as Record<string, any>;
    expect(event).toMatchObject({
      type: "order_status_update",
      restaurantId: "restaurant-1",
      data: {
        orderId: 101,
        orderNumber: "A001",
        previousStatus: "served",
        status: "paid",
        updatedBy: {
          userId: 4,
          role: "cashier",
        },
      },
    });
  });

  it("rejects finalized orders and staff roles without payment authority", async () => {
    const { db } = createD1();
    queueOrderRows([
      [order({ paymentStatus: "paid" })],
      [order({ status: "cancelled", paymentStatus: "pending" })],
      [order()],
    ]);
    mockOrderUpdate();
    const service = new PaymentService(env(db));

    await expect(
      service.processPayment({
        orderId: 101,
        paymentMode: "full",
        amount: 120,
      }),
    ).rejects.toMatchObject({
      code: "ORDER_NOT_PAYABLE",
      status: 409,
    });

    await expect(
      service.processPayment({
        orderId: 101,
        paymentMode: "full",
        amount: 120,
      }),
    ).rejects.toMatchObject({
      code: "ORDER_NOT_PAYABLE",
      status: 409,
    });

    await expect(
      service.processPayment(
        {
          orderId: 101,
          paymentMode: "full",
          amount: 120,
        },
        {
          user: {
            id: 2,
            role: 2,
            restaurantId: "restaurant-1",
          } as never,
        },
      ),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_ROLE",
      status: 403,
    });
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it("rejects missing orders, restaurant mismatches, and stale totals", async () => {
    const { db } = createD1();
    queueOrderRows([
      [],
      [order({ restaurantId: "restaurant-1" })],
      [order({ totalAmountCents: 12000 })],
      [order({ totalAmountCents: 12000 })],
    ]);
    mockOrderUpdate();
    const service = new PaymentService(env(db));

    await expect(
      service.processPayment({
        orderId: 404,
        paymentMode: "full",
        amount: 120,
      }),
    ).rejects.toMatchObject({
      code: "ORDER_NOT_FOUND",
      status: 404,
    });

    await expect(
      service.processPayment(
        {
          orderId: 101,
          paymentMode: "full",
          amount: 120,
        },
        {
          user: {
            id: 42,
            role: 1,
            restaurantId: "restaurant-2",
          } as never,
        },
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });

    await expect(
      service.processPayment({
        orderId: 101,
        paymentMode: "full",
        amount: 119,
      }),
    ).rejects.toMatchObject({
      code: "PAYMENT_AMOUNT_MISMATCH",
      status: 409,
    });

    await expect(
      service.processPayment({
        orderId: 101,
        paymentMode: "partial",
        expectedTotal: 120,
        payments: [
          { method: "cash", amount: 60 },
          { method: "card", amount: 59 },
        ],
      }),
    ).rejects.toMatchObject({
      code: "PARTIAL_PAYMENT_TOTAL_MISMATCH",
      status: 409,
    });
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it("exposes ApiError details for mismatched expected totals", async () => {
    const { db } = createD1();
    queueOrderRows([[order({ totalAmountCents: 12000 })]]);
    mockOrderUpdate();

    await expect(
      new PaymentService(env(db)).processPayment({
        orderId: 101,
        paymentMode: "full",
        amount: 120,
        expectedTotal: 121,
      }),
    ).rejects.toEqual(
      new ApiError(
        "PAYMENT_TOTAL_MISMATCH",
        "Expected total does not match authoritative order total",
        409,
        { expected: 120, actual: 121 },
      ),
    );
  });
});
