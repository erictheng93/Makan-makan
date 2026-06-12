import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../types/env";
import {
  refundPaymentTransaction,
  toExternalPaymentStatus,
} from "./refundPayment";

vi.mock("@makanmakan/utils", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  generateUUID: vi.fn(() => "audit-id"),
}));

interface PreparedStatement {
  sql: string;
  values: unknown[];
  bind: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
}

interface RefundOrderRow {
  id: number;
  restaurant_id: string;
  total_amount: number;
  total_amount_cents: number | null;
  refund_amount: number | null;
  refund_amount_cents: number | null;
  payment_method: string | null;
  payment_status: string | null;
}

function createD1(orderRow: RefundOrderRow | null) {
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
        first: vi.fn(async () => orderRow),
        run: vi.fn(async () => {
          committed.push(statement);
          return { meta: { changes: 1 }, success: true };
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
  orderRow: RefundOrderRow,
  failWhen: (statement: PreparedStatement) => boolean,
) {
  const setup = createD1(orderRow);
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
  return { DB: db } as Env;
}

function paidOrder(overrides: Partial<RefundOrderRow> = {}): RefundOrderRow {
  return {
    id: 42,
    restaurant_id: "restaurant-1",
    total_amount: 120,
    total_amount_cents: 12000,
    refund_amount: null,
    refund_amount_cents: null,
    payment_method: "line_pay",
    payment_status: "completed",
    ...overrides,
  };
}

function statementContaining(statements: PreparedStatement[], text: string) {
  return statements.find((statement) => statement.sql.includes(text));
}

describe("refundPaymentTransaction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1780833600000);
  });

  it("rejects missing and non-refundable transactions before mutating ledgers", async () => {
    let setup = createD1(null);

    await expect(
      refundPaymentTransaction(env(setup.db), { transactionId: "missing" }),
    ).rejects.toMatchObject({
      code: "TRANSACTION_NOT_FOUND",
      status: 404,
    });
    expect(setup.statements).toHaveLength(1);

    setup = createD1(paidOrder({ payment_status: "pending" }));

    await expect(
      refundPaymentTransaction(env(setup.db), { transactionId: "pending" }),
    ).rejects.toMatchObject({
      code: "PAYMENT_NOT_REFUNDABLE",
      status: 409,
    });
    expect(setup.statements).toHaveLength(1);
  });

  it("records partial refunds with existing refunded cents and fallback providers", async () => {
    const { db, statements } = createD1(
      paidOrder({
        refund_amount_cents: 2000,
        payment_method: null,
      }),
    );

    await expect(
      refundPaymentTransaction(env(db), {
        transactionId: "txn-1",
        amount: 30,
        reason: "customer changed mind",
      }),
    ).resolves.toEqual({
      refundId: "ref_txn-1_1780833600000",
      transactionId: "txn-1",
      orderId: 42,
      amount: 30,
      status: "completed",
      paymentStatus: "partial_refunded",
    });

    expect(
      statementContaining(
        statements,
        "INSERT OR IGNORE INTO payment_transactions",
      )?.values,
    ).toEqual([
      "txn-1",
      42,
      "restaurant-1",
      12000,
      "unknown",
      "paid",
      JSON.stringify({ source: "refund_legacy_backfill" }),
      1780833600000,
      1780833600000,
      1780833600000,
    ]);
    expect(statementContaining(statements, "UPDATE orders")?.values).toEqual([
      "partial_refunded",
      50,
      0,
      1780833600000,
      42,
    ]);
    expect(
      statementContaining(statements, "UPDATE payment_transactions")?.values,
    ).toEqual(["partial_refunded", 1780833600000, "txn-1"]);
    expect(
      statementContaining(statements, "INSERT INTO refund_transactions")
        ?.values,
    ).toEqual([
      "ref_txn-1_1780833600000",
      "txn-1",
      42,
      "restaurant-1",
      3000,
      "customer changed mind",
      1780833600000,
      1780833600000,
      1780833600000,
    ]);
    expect(
      statementContaining(statements, "INSERT OR IGNORE INTO payment_audit_log")
        ?.values,
    ).toEqual([
      "audit-id",
      "restaurant-1",
      "txn-1",
      null,
      "refund",
      "internal",
      null,
      null,
      3000,
      null,
      JSON.stringify({
        refundId: "ref_txn-1_1780833600000",
        orderId: 42,
        reason: "customer changed mind",
        paymentStatus: "partial_refunded",
      }),
      null,
      null,
      1780833600000,
    ]);
  });

  it("does not commit partial refund writes when a middle write fails", async () => {
    const { db, committed } = createD1WithBatchFailure(
      paidOrder({ refund_amount_cents: 2000 }),
      (statement) => statement.sql.includes("INSERT INTO refund_transactions"),
    );

    await expect(
      refundPaymentTransaction(env(db), {
        transactionId: "txn-rollback",
        amount: 30,
        reason: "customer changed mind",
      }),
    ).rejects.toThrow("injected batch failure");

    expect(db.batch).toHaveBeenCalledOnce();
    expect(committed).toEqual([]);
  });

  it("marks full refunds from legacy decimal totals and blocks over-refunds", async () => {
    const fullRefund = createD1(
      paidOrder({
        total_amount: 45.67,
        total_amount_cents: null,
        refund_amount: 15.67,
        refund_amount_cents: null,
        payment_method: "card",
        payment_status: "paid",
      }),
    );

    await expect(
      refundPaymentTransaction(env(fullRefund.db), {
        transactionId: "txn-2",
        amount: 30,
      }),
    ).resolves.toMatchObject({
      refundId: "ref_txn-2_1780833600000",
      amount: 30,
      paymentStatus: "refunded",
    });
    expect(
      statementContaining(
        fullRefund.statements,
        "INSERT OR IGNORE INTO payment_transactions",
      )?.values.slice(0, 6),
    ).toEqual(["txn-2", 42, "restaurant-1", 4567, "card", "paid"]);
    expect(
      statementContaining(fullRefund.statements, "UPDATE orders")?.values,
    ).toEqual(["refunded", 45.67, 1, 1780833600000, 42]);
    expect(
      statementContaining(
        fullRefund.statements,
        "INSERT OR IGNORE INTO payment_audit_log",
      )?.values[8],
    ).toBe(3000);

    await expect(
      refundPaymentTransaction(
        env(
          createD1(
            paidOrder({
              total_amount_cents: 12000,
              refund_amount_cents: 10000,
            }),
          ).db,
        ),
        { transactionId: "txn-3", amount: 21 },
      ),
    ).rejects.toMatchObject({
      code: "REFUND_AMOUNT_EXCEEDS_PAYMENT",
      status: 409,
    });
  });
});

describe("toExternalPaymentStatus", () => {
  it.each([
    ["paid", "completed"],
    ["completed", "completed"],
    ["refunded", "refunded"],
    ["partial_refunded", "partial_refunded"],
    ["failed", "failed"],
    ["cancelled", "cancelled"],
    ["processing", "processing"],
    [null, "pending"],
    ["unknown", "pending"],
  ])("maps %s to %s", (input, expected) => {
    expect(toExternalPaymentStatus(input)).toBe(expected);
  });
});
