import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/utils/api-error";

const mocks = vi.hoisted(() => ({
  paymentService: {
    processPayment: vi.fn(),
  },
  paymentServiceCtor: vi.fn(),
  refundPaymentTransaction: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: { id: 7, username: "cashier", role: 4, restaurantId: "restaurant-1" },
}));

vi.mock("../../../middleware/idempotency", () => ({
  idempotencyMiddleware: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../../../middleware/auth", async () => {
  const { ApiError } = await vi.importActual<
    typeof import("../../../shared/utils/api-error")
  >("../../../shared/utils/api-error");

  return {
    requireRole: vi.fn((allowedRoles: number[]) => async (c, next) => {
      c.set("user", authState.user);
      if (!allowedRoles.includes(authState.user.role)) {
        throw new ApiError(
          "INSUFFICIENT_ROLE",
          "Insufficient permissions",
          403,
        );
      }
      await next();
    }),
  };
});

vi.mock("../services/PaymentService", () => ({
  PaymentService: vi.fn(function PaymentService(...args: unknown[]) {
    mocks.paymentServiceCtor(...args);
    return mocks.paymentService;
  }),
}));

vi.mock("../services/refundPayment", () => ({
  refundPaymentTransaction: vi.fn((...args: unknown[]) =>
    mocks.refundPaymentTransaction(...args),
  ),
  toExternalPaymentStatus: vi.fn((status: string | null) => {
    if (status === "paid" || status === "completed") return "completed";
    if (status === "failed") return "failed";
    if (status === "refunded") return "refunded";
    if (status === "partially_refunded") return "partially_refunded";
    return "pending";
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

interface D1MockRows {
  orderLookup?: Array<Record<string, unknown> | null>;
  orderStatus?: Array<Record<string, unknown> | null>;
  transaction?: Array<Record<string, unknown> | null>;
}

function createDb(rows: D1MockRows = {}) {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn(() => {
        const takeRow = () => {
          const normalizedSql = sql.toLowerCase();
          if (normalizedSql.includes('from "payment_transactions"')) {
            return rows.transaction?.shift() ?? null;
          }

          if (normalizedSql.includes("payment_transaction_id")) {
            return rows.orderStatus?.shift() ?? null;
          }

          if (
            normalizedSql.includes("public_id") ||
            normalizedSql.includes("order_number") ||
            normalizedSql.includes("client_mutation_id")
          ) {
            return rows.orderLookup?.shift() ?? null;
          }

          return null;
        };
        return {
          first: vi.fn(async () => takeRow()),
          raw: vi.fn(async () => {
            const row = takeRow();
            return row ? [Object.values(row)] : [];
          }),
          all: vi.fn(async () => {
            const row = takeRow();
            return { results: row ? [row] : [] };
          }),
        };
      }),
    })),
  };
}

function request(path: string, init: RequestInit = {}, db = createDb()) {
  return routes.request(path, init, { DB: db } as never);
}

async function json(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data?: unknown;
    error?: { code?: string; message?: string; details?: unknown };
  };
}

function postJson(path: string, body: unknown, db = createDb()) {
  return request(
    path,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idem-1",
      },
    },
    db,
  );
}

describe("payments routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = {
      id: 7,
      username: "cashier",
      role: 4,
      restaurantId: "restaurant-1",
    };
    mocks.paymentService.processPayment.mockResolvedValue({
      status: 200,
      data: {
        paymentId: "pay-1",
        orderId: 101,
        orderStatus: "paid",
        paymentStatus: "paid",
        authorizedTotal: 120,
      },
    });
    mocks.refundPaymentTransaction.mockResolvedValue({
      refundId: "refund-1",
      transactionId: "pay-1",
      amount: 25,
      status: "succeeded",
      paymentStatus: "partially_refunded",
    });
  });

  it("creates full payments for numeric orders with default route mapping", async () => {
    const response = await postJson("/", {
      orderId: 101,
      amount: 120,
      method: "cash",
      country: "TW",
      currency: "TWD",
      metadata: { source: "pos" },
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.paymentServiceCtor).toHaveBeenCalledWith(
      expect.objectContaining({ DB: expect.any(Object) }),
    );
    expect(mocks.paymentService.processPayment).toHaveBeenCalledWith(
      {
        orderId: 101,
        paymentMode: "full",
        amount: 120,
        expectedTotal: 120,
        payments: undefined,
        closeOrder: true,
        method: "cash",
        gateway: "cash",
      },
      {
        user: undefined,
        country: "TW",
        currency: "TWD",
        idempotencyKey: "idem-1",
        customerInfo: undefined,
        metadata: { source: "pos" },
      },
    );
    expect(body).toEqual({
      success: true,
      data: {
        id: "pay-1",
        paymentId: "pay-1",
        transactionId: "pay-1",
        status: "completed",
        metadata: {
          orderId: 101,
          orderStatus: "paid",
          paymentStatus: "paid",
          authorizedTotal: 120,
          country: "TW",
          currency: "TWD",
          method: "cash",
        },
      },
    });
  });

  it("requires restaurant scope for non-numeric order identifiers", async () => {
    const response = await postJson("/", {
      orderId: "ORD-101",
      amount: 120,
      method: "cash",
    });
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("RESTAURANT_ID_REQUIRED");
    expect(mocks.paymentService.processPayment).not.toHaveBeenCalled();
  });

  it("resolves create-payment order aliases inside a restaurant", async () => {
    const db = createDb({
      orderLookup: [
        {
          id: 202,
          public_id: "018f0000-0000-7000-8000-000000000202",
          order_number: "ORD-202",
          restaurant_id: "restaurant-1",
        },
      ],
    });
    mocks.paymentService.processPayment.mockResolvedValueOnce({
      status: 201,
      data: {
        paymentId: "pay-202",
        orderId: 202,
        orderStatus: "processing",
        paymentStatus: "pending",
        authorizedTotal: 42,
      },
    });

    const response = await postJson(
      "/create",
      {
        orderId: "ORD-202",
        restaurantId: "restaurant-1",
        amount: 42,
        method: "credit_card",
        country: "MY",
        currency: "MYR",
        customerInfo: { email: "guest@example.test" },
        metadata: { terminal: "front" },
      },
      db,
    );
    const body = await json(response);

    expect(response.status).toBe(201);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("orders"));
    expect(mocks.paymentService.processPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 202,
        paymentMode: "full",
        amount: 42,
        gateway: "credit_card",
      }),
      expect.objectContaining({
        country: "MY",
        currency: "MYR",
        customerInfo: { email: "guest@example.test" },
        metadata: { terminal: "front" },
      }),
    );
    expect(body).toMatchObject({
      success: true,
      data: {
        paymentId: "pay-202",
        status: "pending",
        metadata: {
          orderPublicId: "018f0000-0000-7000-8000-000000000202",
        },
      },
    });
  });

  it("resolves public order ids inside a restaurant", async () => {
    const db = createDb({
      orderLookup: [
        {
          id: 606,
          public_id: "018f0000-0000-7000-8000-000000000606",
          order_number: "ORD-606",
          restaurant_id: "restaurant-1",
        },
      ],
    });

    await postJson(
      "/",
      {
        orderId: "018f0000-0000-7000-8000-000000000606",
        restaurantId: "restaurant-1",
        amount: 88,
        method: "cash",
      },
      db,
    );

    expect(mocks.paymentService.processPayment).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 606 }),
      expect.any(Object),
    );
  });

  it("passes partial payments through without closing the order", async () => {
    const payments = [
      { method: "cash", amount: 40 },
      { method: "card", amount: 60 },
    ];

    await postJson("/", {
      orderId: "303",
      paymentMode: "partial",
      expectedTotal: 100,
      payments,
      gateway: "mixed",
      closeOrder: false,
    });

    expect(mocks.paymentService.processPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 303,
        paymentMode: "partial",
        amount: undefined,
        expectedTotal: 100,
        payments,
        closeOrder: false,
        method: undefined,
        gateway: "mixed",
      }),
      expect.any(Object),
    );
  });

  it("returns payment transaction status rows before order fallbacks", async () => {
    const db = createDb({
      transaction: [
        {
          transaction_id: "txn-1",
          order_id: 404,
          status: "paid",
        },
      ],
      orderStatus: [{ id: 999, payment_status: "failed" }],
    });

    const response = await request("/status/txn-1", undefined, db);
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        transactionId: "txn-1",
        orderId: 404,
        paymentStatus: "paid",
        status: "completed",
      },
    });
  });

  it("falls back to order payment status and reports missing transactions", async () => {
    let db = createDb({
      transaction: [null],
      orderStatus: [
        {
          id: 505,
          public_id: "018f0000-0000-7000-8000-000000000505",
          payment_status: "paid",
        },
      ],
    });

    let response = await request("/status/order-txn", undefined, db);
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        transactionId: "order-txn",
        orderId: 505,
        orderPublicId: "018f0000-0000-7000-8000-000000000505",
        paymentStatus: "paid",
        status: "completed",
      },
    });

    db = createDb({ transaction: [null], orderStatus: [null] });
    response = await request("/status/missing", undefined, db);
    body = await json(response);

    expect(response.status).toBe(404);
    expect(body.error?.code).toBe("TRANSACTION_NOT_FOUND");
  });

  it("refunds transactions with validated input", async () => {
    const response = await postJson("/refund", {
      transactionId: "pay-1",
      amount: 25,
      reason: "guest changed order",
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.refundPaymentTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ DB: expect.any(Object) }),
      {
        transactionId: "pay-1",
        amount: 25,
        reason: "guest changed order",
      },
      {
        user: authState.user,
      },
    );
    expect(body).toEqual({
      success: true,
      data: {
        refundId: "refund-1",
        transactionId: "pay-1",
        amount: 25,
        status: "succeeded",
        paymentStatus: "partially_refunded",
      },
    });
  });

  it("rejects refund requests from staff roles without refund authority", async () => {
    authState.user = {
      id: 8,
      username: "chef",
      role: 2,
      restaurantId: "restaurant-1",
    };

    const response = await postJson("/refund", {
      transactionId: "pay-1",
      amount: 25,
    });
    const body = await json(response);

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("INSUFFICIENT_ROLE");
    expect(mocks.refundPaymentTransaction).not.toHaveBeenCalled();
  });

  it("lists supported payment methods by country", async () => {
    let response = await request("/methods/my");
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        country: "MY",
        supportedMethods: [
          "credit_card",
          "debit_card",
          "fpx",
          "touch_n_go",
          "grab_pay",
        ],
      },
    });

    response = await request("/methods/sg");
    body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: { country: "SG", supportedMethods: [] },
    });
  });

  it("rejects partial payments without payment splits", async () => {
    const response = await postJson("/", {
      orderId: 101,
      paymentMode: "partial",
    });
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(mocks.paymentService.processPayment).not.toHaveBeenCalled();
  });
});
