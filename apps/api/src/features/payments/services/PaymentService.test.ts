import { beforeEach, describe, expect, it, vi } from "vitest";
import { orders } from "@makanmasak/database";
import { createSelectFixtureDb } from "@makanmasak/database/testing";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { Env } from "../../../types/env";
import { ApiError } from "../../../shared/utils/api-error";
import { PaymentService } from "./PaymentService";

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    batch: vi.fn(),
  },
}));

let currentOrderUpdateChanges = 1;

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

vi.mock("@makanmasak/utils", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  generateUUID: vi.fn(() => "audit-id"),
}));

interface PreparedStatement {
  sql: string;
  values: unknown[];
  payload?: unknown;
  bind: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
}

function queueOrderRows(rows: unknown[][]) {
  Object.assign(mocks.db, createSelectFixtureDb({ orders }, { orders: rows }));
}

function mockOrderUpdate(_returningRows: unknown[] = []) {
  return [];
}

function createD1(orderUpdateChanges = 1) {
  const statements: PreparedStatement[] = [];
  const committed: PreparedStatement[] = [];
  currentOrderUpdateChanges = orderUpdateChanges;
  mocks.db.insert.mockImplementation(() => {
    const statement: PreparedStatement = {
      sql: "INSERT",
      values: [],
      bind: vi.fn(() => statement),
      run: vi.fn(async () => ({ meta: { changes: 1 }, success: true })),
    };
    const builder = {
      values: vi.fn((payload: Record<string, unknown>) => {
        statement.payload = payload;
        statement.values = Object.values(payload);
        statement.sql =
          "refundId" in payload
            ? "INSERT INTO refund_transactions"
            : "eventType" in payload
              ? "INSERT OR IGNORE INTO payment_audit_log"
              : "INSERT INTO payment_transactions";
        statements.push(statement);
        return {
          ...statement,
          onConflictDoNothing: vi.fn(() => {
            statement.sql = statement.sql.replace(
              "INSERT INTO",
              "INSERT OR IGNORE INTO",
            );
            return statement;
          }),
        };
      }),
    };
    return builder;
  });
  mocks.db.batch.mockImplementation(
    async (batchStatements: PreparedStatement[]) => {
      committed.push(...batchStatements);
      return batchStatements.map(() => ({
        meta: { changes: 1 },
        success: true,
      }));
    },
  );
  mocks.db.update.mockImplementation(() => {
    const statement: PreparedStatement = {
      sql: "UPDATE",
      values: [],
      bind: vi.fn(() => statement),
      run: vi.fn(async () => ({
        meta: { changes: currentOrderUpdateChanges },
        success: true,
      })),
    };
    const builder = {
      set: vi.fn((payload: Record<string, unknown>) => {
        statement.payload = payload;
        statement.values = Object.values(payload);
        statement.sql =
          "paymentStatus" in payload && "paymentTransactionId" in payload
            ? "UPDATE orders"
            : "isOccupied" in payload
              ? "UPDATE tables"
              : "UPDATE payment_transactions";
        statements.push(statement);
        return builder;
      }),
      where: vi.fn(() => {
        statement.run.mockImplementation(async () => {
          committed.push(statement);
          return {
            meta: { changes: currentOrderUpdateChanges },
            success: true,
          };
        });
        return statement;
      }),
    };
    return builder;
  });
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
    batch: mocks.db.batch,
  };
  return { db, statements, committed };
}

function createD1WithBatchFailure(
  failWhen: (statement: PreparedStatement) => boolean,
) {
  const setup = createD1();
  mocks.db.batch.mockImplementation(
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
  // Typed as the KVNamespace slice the service actually touches: an inline
  // `vi.fn()` would make the literal a `Mock<...>` that `Env` cannot be
  // compared against.
  const cacheKV: Pick<KVNamespace, "delete"> = {
    delete: vi.fn(async () => undefined),
  };
  return { DB: db, CACHE_KV: cacheKV } as Env;
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
    id: "order-101",
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
          orderId: "order-101",
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
        paymentId: "pay_order-101_1780833600000",
        orderId: "order-101",
        orderStatus: "paid",
        paymentStatus: "paid",
        authorizedTotal: 120,
      },
    });

    expect(
      statementContaining(statements, "INSERT INTO payment_transactions")
        ?.payload,
    ).toMatchObject({
      transactionId: "pay_order-101_1780833600000",
      orderId: "order-101",
      restaurantId: "restaurant-1",
      amountCents: 12000,
      currency: "TWD",
      countryCode: "TW",
      paymentMethod: "cash",
      gateway: "cash",
      status: "pending",
      idempotencyKey: "idem-1",
      customerInfo: { phone: "0912345678" },
      metadata: {
        terminal: "front",
        paymentMode: "full",
        closeOrder: true,
      },
      createdAt: new Date(1780833600000),
      updatedAt: new Date(1780833600000),
    });

    expect(statementContaining(statements, "UPDATE orders")?.payload).toEqual({
      status: "paid",
      paidAt: new Date(1780833600000),
      paymentStatus: "paid",
      paymentMethod: "cash",
      paymentTransactionId: "pay_order-101_1780833600000",
      updatedAt: new Date(1780833600000),
    });
    expect(
      statementContaining(statements, "UPDATE payment_transactions")?.payload,
    ).toMatchObject({
      status: "paid",
      updatedAt: new Date(1780833600000),
      completedAt: new Date(1780833600000),
    });
    expect(
      statements
        .filter((statement) =>
          statement.sql.includes("INSERT OR IGNORE INTO payment_audit_log"),
        )
        .map(
          (statement) => (statement.payload as { eventType: string }).eventType,
        ),
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
        orderId: "order-101",
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
        orderId: "order-101",
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
        orderId: "order-101",
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

    expect(statementContaining(statements, "UPDATE orders")?.payload).toEqual({
      paymentStatus: "paid",
      paymentMethod: "split",
      paymentTransactionId: "pay_order-101_1780833600000",
      updatedAt: new Date(1780833600000),
    });
    expect(
      (
        statementContaining(statements, "INSERT INTO payment_transactions")
          ?.payload as { paymentMethod: string }
      ).paymentMethod,
    ).toBe("split");
    expect(
      statementContaining(statements, "INSERT INTO payment_transactions")
        ?.payload,
    ).toMatchObject({
      metadata: { paymentMode: "partial", closeOrder: false },
    });
  });

  it("releases occupied tables when a payment closes the order", async () => {
    const { db, statements } = createD1();
    queueOrderRows([[order({ tableId: 9 })]]);
    mockOrderUpdate([{ status: "paid", paymentStatus: "paid" }]);

    await new PaymentService(env(db)).processPayment({
      orderId: "order-101",
      paymentMode: "full",
      amount: 120,
      expectedTotal: 120,
      method: "cash",
    });

    expect(statementContaining(statements, "UPDATE tables")?.payload).toEqual({
      isOccupied: false,
      currentOrderId: null,
      occupiedAt: null,
      occupiedBy: null,
      updatedAt: new Date(1780833600000),
    });
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
        orderId: "order-101",
        paymentMode: "full",
        amount: 120,
        expectedTotal: 120,
        method: "cash",
      },
      {
        user: {
          id: "user-4",
          role: 4,
          restaurantId: "restaurant-1",
          username: "cashier",
        },
      },
    );

    expect(setup.cacheKV.delete).toHaveBeenCalledWith("order:order-101:full");
    expect(setup.cacheKV.delete).toHaveBeenCalledWith("order:order-101:basic");
    // restaurant + kitchen + admin rooms (admin added in bug-inventory fix #1),
    // plus the per-order customer room that 2b894649 added so the diner's order
    // tracking page updates on payment.
    expect(setup.fetch).toHaveBeenCalledTimes(4);

    const event = JSON.parse(
      String(setup.fetch.mock.calls[0]?.[1]?.body),
    ) as Record<string, any>;
    expect(event).toMatchObject({
      type: "order_status_update",
      restaurantId: "restaurant-1",
      data: {
        orderId: "order-101",
        orderNumber: "A001",
        previousStatus: "served",
        status: "paid",
        updatedBy: {
          userId: "user-4",
          role: "cashier",
        },
      },
    });
  });

  it("does not fail a committed payment when close-order side effects fail", async () => {
    const { db } = createD1();
    const setup = envWithRealtime(db);
    setup.cacheKV.delete.mockRejectedValueOnce(new Error("kv unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    queueOrderRows([[order()]]);
    mockOrderUpdate([{ status: "paid", paymentStatus: "paid" }]);

    await expect(
      new PaymentService(setup.env).processPayment({
        orderId: "order-101",
        paymentMode: "full",
        amount: 120,
        expectedTotal: 120,
        method: "cash",
      }),
    ).resolves.toMatchObject({
      status: 200,
      data: {
        paymentId: "pay_order-101_1780833600000",
        orderStatus: "paid",
      },
    });

    expect(errorSpy).toHaveBeenCalledWith(
      "Payment succeeded but order side effects failed",
      expect.objectContaining({ orderId: "order-101" }),
    );
    errorSpy.mockRestore();
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
        orderId: "order-101",
        paymentMode: "full",
        amount: 120,
      }),
    ).rejects.toMatchObject({
      code: "ORDER_NOT_PAYABLE",
      status: 409,
    });

    await expect(
      service.processPayment({
        orderId: "order-101",
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
          orderId: "order-101",
          paymentMode: "full",
          amount: 120,
        },
        {
          user: {
            id: "user-2",
            username: "chef",
            role: 2,
            restaurantId: "restaurant-1",
          },
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
        orderId: "order-404",
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
          orderId: "order-101",
          paymentMode: "full",
          amount: 120,
        },
        {
          user: {
            id: "user-42",
            username: "owner",
            role: 1,
            restaurantId: "restaurant-2",
          },
        },
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });

    await expect(
      service.processPayment({
        orderId: "order-101",
        paymentMode: "full",
        amount: 119,
      }),
    ).rejects.toMatchObject({
      code: "PAYMENT_AMOUNT_MISMATCH",
      status: 409,
    });

    await expect(
      service.processPayment({
        orderId: "order-101",
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
        orderId: "order-101",
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
