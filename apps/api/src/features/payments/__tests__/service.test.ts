import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

import { PaymentService } from "../services/PaymentService";
import type { Env } from "../../../types/env";

function createEnvDb() {
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare } as unknown as Env["DB"], prepare, bind, run };
}

describe("PaymentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 42,
              restaurantId: "rest-1",
              totalAmount: 100,
              totalAmountCents: 10_000,
              status: "pending",
            },
          ]),
        }),
      }),
    });
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              status: "paid",
              paymentStatus: "paid",
            },
          ]),
        }),
      }),
    });
  });

  it("writes attempt and success audit logs around payment transaction updates", async () => {
    const { db, prepare, bind } = createEnvDb();
    const service = new PaymentService({
      DB: db,
      NODE_ENV: "test",
    } as unknown as Env);

    const result = await service.processPayment(
      {
        orderId: 42,
        paymentMode: "full",
        amount: 100,
        expectedTotal: 100,
        closeOrder: true,
        method: "credit_card",
        gateway: "line_pay",
      },
      {
        currency: "TWD",
        idempotencyKey: "idem-1",
        user: {
          id: 1,
          username: "owner",
          role: 1,
          restaurantId: "rest-1",
        },
      },
    );

    expect(result.status).toBe(200);
    expect(prepare).toHaveBeenCalledTimes(4);
    expect(bind).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      "rest-1",
      expect.stringMatching(/^pay_42_/),
      null,
      "attempt",
      "line_pay",
      null,
      null,
      10_000,
      "TWD",
      expect.stringContaining('"idempotencyKey":"idem-1"'),
      null,
      null,
      expect.any(Number),
    );
    expect(bind).toHaveBeenNthCalledWith(
      4,
      expect.any(String),
      "rest-1",
      expect.stringMatching(/^pay_42_/),
      null,
      "success",
      "line_pay",
      null,
      null,
      10_000,
      "TWD",
      JSON.stringify({ status: "paid" }),
      null,
      null,
      expect.any(Number),
    );
  });

  it("writes failure audit logs when a gateway timeout fails the transaction", async () => {
    const { db, prepare, bind } = createEnvDb();
    const service = new PaymentService({
      DB: db,
      NODE_ENV: "test",
    } as unknown as Env);

    const result = await service.processPayment(
      {
        orderId: 42,
        paymentMode: "full",
        amount: 100,
        expectedTotal: 100,
        closeOrder: true,
        method: "credit_card",
        gateway: "line_pay",
      },
      {
        currency: "TWD",
        gatewayFixture: "timeout",
        user: {
          id: 1,
          username: "owner",
          role: 1,
          restaurantId: "rest-1",
        },
      },
    );

    expect(result.status).toBe(202);
    expect(prepare).toHaveBeenCalledTimes(4);
    expect(bind).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      "rest-1",
      expect.stringMatching(/^pay_42_/),
      null,
      "attempt",
      "line_pay",
      null,
      null,
      10_000,
      "TWD",
      expect.stringContaining('"closeOrder":true'),
      null,
      null,
      expect.any(Number),
    );
    expect(bind).toHaveBeenNthCalledWith(
      3,
      "failed",
      expect.any(Number),
      "failed",
      expect.any(Number),
      "failed",
      expect.any(Number),
      expect.stringMatching(/^pay_42_/),
    );
    expect(bind).toHaveBeenNthCalledWith(
      4,
      expect.any(String),
      "rest-1",
      expect.stringMatching(/^pay_42_/),
      null,
      "failure",
      "line_pay",
      null,
      null,
      10_000,
      "TWD",
      JSON.stringify({ status: "failed" }),
      null,
      null,
      expect.any(Number),
    );
  });
});
