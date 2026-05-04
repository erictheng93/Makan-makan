import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";

const { mockProcessPayment } = vi.hoisted(() => ({
  mockProcessPayment: vi.fn(),
}));

vi.mock("../services/PaymentService", () => ({
  PaymentService: vi.fn(function () {
    return { processPayment: mockProcessPayment };
  }),
}));

import paymentRoutes from "../routes";

/**
 * Idempotency middleware reads + writes idempotency_keys via the bound DB.
 * Tests that don't drive that table directly receive a no-op stub so the
 * middleware sees "no existing key" and proceeds, lets the response write
 * back, and never crashes on `db.prepare(...).bind(...).first()`.
 */
function noopIdempotencyDb() {
  const first = vi.fn().mockResolvedValue(null);
  const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
  const all = vi.fn().mockResolvedValue({ results: [] });
  const bind = vi.fn(() => ({ first, run, all }));
  return { prepare: vi.fn(() => ({ bind, first, run, all })) };
}

function buildApp(env: Record<string, unknown> = {}) {
  const app = new Hono<any>();

  app.use("*", async (c, next) => {
    c.set("user", {
      id: 7,
      username: "owner",
      role: 1,
      restaurantId: "rest-1",
    });
    await next();
  });

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as never,
      );
    }
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: err.message },
      },
      500,
    );
  });

  app.route("/payments", paymentRoutes);
  return {
    app,
    env: { NODE_ENV: "test", DB: noopIdempotencyDb(), ...env },
  };
}

const idempotencyHeaders = (key: string) => ({
  "Content-Type": "application/json",
  "Idempotency-Key": key,
});

describe("Payments Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps create requests to the underlying payment service", async () => {
    mockProcessPayment.mockResolvedValue({
      status: 200,
      data: {
        paymentId: "pay_42_1",
        orderId: 42,
        orderStatus: "paid",
        paymentStatus: "paid",
        authorizedTotal: 100,
      },
    });
    const { app, env } = buildApp();

    const response = await app.request(
      "/payments/create",
      {
        method: "POST",
        headers: idempotencyHeaders("test-key-numeric-id"),
        body: JSON.stringify({
          orderId: "42",
          restaurantId: "rest-1",
          country: "MY",
          currency: "MYR",
          amount: 100,
          method: "credit_card",
        }),
      },
      env,
    );
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      data: {
        transactionId: "pay_42_1",
        status: "completed",
        metadata: {
          orderId: 42,
          paymentStatus: "paid",
          country: "MY",
          currency: "MYR",
          method: "credit_card",
        },
      },
    });
    expect(mockProcessPayment).toHaveBeenCalledWith(
      {
        orderId: 42,
        paymentMode: "full",
        amount: 100,
        expectedTotal: 100,
        closeOrder: true,
        method: "credit_card",
        gateway: "credit_card",
      },
      expect.objectContaining({
        country: "MY",
        currency: "MYR",
        idempotencyKey: "test-key-numeric-id",
        user: expect.objectContaining({ id: 7, restaurantId: "rest-1" }),
      }),
    );
  });

  it("maps root payment requests to the payment service with Taiwan defaults", async () => {
    mockProcessPayment.mockResolvedValue({
      status: 200,
      data: {
        paymentId: "pay_42_1",
        orderId: 42,
        orderStatus: "paid",
        paymentStatus: "paid",
        authorizedTotal: 100,
      },
    });
    const { app, env } = buildApp();

    const response = await app.request(
      "/payments",
      {
        method: "POST",
        headers: idempotencyHeaders("test-key-root-payment"),
        body: JSON.stringify({
          orderId: 42,
          amount: 100,
          method: "card",
        }),
      },
      env,
    );
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      data: {
        id: "pay_42_1",
        paymentId: "pay_42_1",
        transactionId: "pay_42_1",
        status: "completed",
        metadata: {
          orderId: 42,
          paymentStatus: "paid",
          country: "TW",
          currency: "TWD",
          method: "card",
        },
      },
    });
    expect(mockProcessPayment).toHaveBeenCalledWith(
      {
        orderId: 42,
        paymentMode: "full",
        amount: 100,
        expectedTotal: 100,
        closeOrder: true,
        method: "card",
        gateway: "card",
      },
      expect.objectContaining({
        country: "TW",
        currency: "TWD",
        idempotencyKey: "test-key-root-payment",
        user: expect.objectContaining({ id: 7, restaurantId: "rest-1" }),
      }),
    );
  });

  it("resolves string order ids (order_number / client_mutation_id) before creating payments", async () => {
    mockProcessPayment.mockResolvedValue({
      status: 200,
      data: {
        paymentId: "pay_42_1",
        orderId: 42,
        orderStatus: "paid",
        paymentStatus: "paid",
        authorizedTotal: 100,
      },
    });
    // Build a DB stub that:
    //   - returns null for idempotency key lookups (so the middleware
    //     thinks the request is new) and accepts writes;
    //   - returns { id: 42 } for the orders lookup the route performs
    //     while resolving the string order id.
    const idempotencyFirst = vi.fn().mockResolvedValue(null);
    const orderFirst = vi.fn().mockResolvedValue({ id: 42 });
    const ordersBind = vi.fn(() => ({ first: orderFirst }));
    const idempotencyBind = vi.fn(() => ({
      first: idempotencyFirst,
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }));
    const prepare = vi.fn((sqlText: string) => {
      if (sqlText.includes("orders")) {
        return { bind: ordersBind };
      }
      return { bind: idempotencyBind };
    });
    const { app, env } = buildApp({ DB: { prepare } });

    const response = await app.request(
      "/payments/create",
      {
        method: "POST",
        headers: idempotencyHeaders("test-key-string-id"),
        body: JSON.stringify({
          orderId: "order-public-id",
          restaurantId: "rest-1",
          country: "MY",
          currency: "MYR",
          amount: 100,
          method: "credit_card",
        }),
      },
      env,
    );
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(200);
    expect(json.data.transactionId).toBe("pay_42_1");
    expect(ordersBind).toHaveBeenCalledWith(
      "rest-1",
      "order-public-id",
      "order-public-id",
    );
    expect(mockProcessPayment).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 42 }),
      expect.any(Object),
    );
  });

  it("returns status for canonical payment transaction ids", async () => {
    const first = vi.fn().mockResolvedValue({
      transaction_id: "pay_42_1",
      order_id: 42,
      status: "paid",
    });
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    const { app, env } = buildApp({ DB: { prepare } });

    const response = await app.request("/payments/status/pay_42_1", {}, env);
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      data: {
        transactionId: "pay_42_1",
        orderId: 42,
        paymentStatus: "paid",
        status: "completed",
      },
    });
    expect(bind).toHaveBeenCalledWith("pay_42_1");
  });

  it("updates the order refund state for refund requests", async () => {
    const first = vi.fn().mockResolvedValue({
      id: 42,
      restaurant_id: "rest-1",
      total_amount: 100,
      refund_amount: null,
      payment_method: "credit_card",
      payment_status: "paid",
    });
    const ledgerRun = vi.fn().mockResolvedValue({ success: true });
    const orderRun = vi.fn().mockResolvedValue({ success: true });
    const paymentRun = vi.fn().mockResolvedValue({ success: true });
    const refundRun = vi.fn().mockResolvedValue({ success: true });
    const auditRun = vi.fn().mockResolvedValue({ success: true });
    const selectBind = vi.fn(() => ({ first }));
    const ledgerBind = vi.fn(() => ({ run: ledgerRun }));
    const updateBind = vi.fn(() => ({ run: orderRun }));
    const paymentBind = vi.fn(() => ({ run: paymentRun }));
    const refundBind = vi.fn(() => ({ run: refundRun }));
    const auditBind = vi.fn(() => ({ run: auditRun }));
    const prepare = vi
      .fn()
      .mockReturnValueOnce({ bind: selectBind })
      .mockReturnValueOnce({ bind: ledgerBind })
      .mockReturnValueOnce({ bind: updateBind })
      .mockReturnValueOnce({ bind: paymentBind })
      .mockReturnValueOnce({ bind: refundBind })
      .mockReturnValueOnce({ bind: auditBind });
    const { app, env } = buildApp({ DB: { prepare } });

    const response = await app.request(
      "/payments/refund",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: "pay_42_1",
          amount: 50,
          reason: "Customer request",
        }),
      },
      env,
    );
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      data: {
        transactionId: "pay_42_1",
        amount: 50,
        status: "completed",
        paymentStatus: "partial_refunded",
      },
    });
    expect(updateBind).toHaveBeenCalledWith(
      "partial_refunded",
      50,
      0,
      expect.any(Number),
      42,
    );
    expect(ledgerBind).toHaveBeenCalledWith(
      "pay_42_1",
      42,
      "rest-1",
      10000,
      "credit_card",
      "paid",
      JSON.stringify({ source: "refund_legacy_backfill" }),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
    expect(paymentBind).toHaveBeenCalledWith(
      "partial_refunded",
      expect.any(Number),
      "pay_42_1",
    );
    expect(refundBind).toHaveBeenCalledWith(
      expect.stringMatching(/^ref_pay_42_1_/),
      "pay_42_1",
      42,
      "rest-1",
      5000,
      "Customer request",
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
    expect(auditBind).toHaveBeenCalledWith(
      expect.any(String),
      "rest-1",
      "pay_42_1",
      null,
      "refund",
      "credit_card",
      null,
      null,
      5000,
      null,
      expect.stringContaining('"reason":"Customer request"'),
      null,
      null,
      expect.any(Number),
    );
  });

  it("rejects cumulative refunds that exceed the payment total", async () => {
    const first = vi.fn().mockResolvedValue({
      id: 42,
      restaurant_id: "rest-1",
      total_amount: 100,
      refund_amount: 80,
      payment_method: "credit_card",
      payment_status: "paid",
    });
    const selectBind = vi.fn(() => ({ first }));
    const prepare = vi.fn().mockReturnValueOnce({ bind: selectBind });
    const { app, env } = buildApp({ DB: { prepare } });

    const response = await app.request(
      "/payments/refund",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: "pay_42_1",
          amount: 30,
        }),
      },
      env,
    );
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(409);
    expect(json.error.code).toBe("REFUND_AMOUNT_EXCEEDS_PAYMENT");
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("returns supported methods by country", async () => {
    const { app, env } = buildApp();

    const response = await app.request("/payments/methods/MY", {}, env);
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.supportedMethods).toContain("fpx");
    expect(json.data.supportedMethods).toContain("credit_card");
  });
});
