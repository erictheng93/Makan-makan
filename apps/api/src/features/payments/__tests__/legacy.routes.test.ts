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
        err.status as any,
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
  return { app, env: { NODE_ENV: "test", DB: {}, ...env } };
}

describe("Payments Legacy Compatibility Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps legacy create requests to the canonical payment service", async () => {
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
        headers: { "Content-Type": "application/json" },
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
    const json = (await response.json()) as any;

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
        user: expect.objectContaining({ id: 7, restaurantId: "rest-1" }),
      }),
    );
  });

  it("resolves legacy string order ids before creating payments", async () => {
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
    const first = vi.fn().mockResolvedValue({ id: 42 });
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    const { app, env } = buildApp({ DB: { prepare } });

    const response = await app.request(
      "/payments/create",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    const json = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(json.data.transactionId).toBe("pay_42_1");
    expect(bind).toHaveBeenCalledWith(
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
    const first = vi.fn().mockResolvedValue({ id: 42, payment_status: "paid" });
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    const { app, env } = buildApp({ DB: { prepare } });

    const response = await app.request("/payments/status/pay_42_1", {}, env);
    const json = (await response.json()) as any;

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

  it("updates the order refund state for legacy refund requests", async () => {
    const first = vi.fn().mockResolvedValue({
      id: 42,
      total_amount: 100,
      refund_amount: null,
    });
    const run = vi.fn().mockResolvedValue({ success: true });
    const selectBind = vi.fn(() => ({ first }));
    const updateBind = vi.fn(() => ({ run }));
    const prepare = vi
      .fn()
      .mockReturnValueOnce({ bind: selectBind })
      .mockReturnValueOnce({ bind: updateBind });
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
    const json = (await response.json()) as any;

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
  });

  it("returns supported methods by country", async () => {
    const { app, env } = buildApp();

    const response = await app.request("/payments/methods/MY", {}, env);
    const json = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.supportedMethods).toContain("fpx");
    expect(json.data.supportedMethods).toContain("credit_card");
  });
});
