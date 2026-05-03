import { describe, expect, it, vi } from "vitest";
import {
  PAYMENT_AUDIT_EVENT_TYPES,
  PaymentAuditService,
} from "../PaymentAuditService";
import type { Env } from "../../../../types/env";

function createDbMock() {
  const run = vi
    .fn()
    .mockResolvedValue({ success: true, meta: { changes: 1 } });
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare } as unknown as Env["DB"], prepare, bind, run };
}

describe("PaymentAuditService", () => {
  it("appends payment audit events with encoded payloads", async () => {
    const { db, bind, run } = createDbMock();
    const service = new PaymentAuditService(db);

    const result = await service.append({
      restaurantId: "rest-1",
      paymentTransactionId: "pay_1",
      eventType: PAYMENT_AUDIT_EVENT_TYPES.SUCCESS,
      provider: "line_pay",
      amount: 12345,
      currency: "TWD",
      rawPayload: { orderId: 42, status: "paid" },
      occurredAtMs: 1_700_000_000_000,
    });

    expect(result).toEqual({ inserted: true });
    expect(run).toHaveBeenCalledOnce();
    expect(bind).toHaveBeenCalledWith(
      expect.any(String),
      "rest-1",
      "pay_1",
      null,
      "success",
      "line_pay",
      null,
      null,
      12345,
      "TWD",
      JSON.stringify({ orderId: 42, status: "paid" }),
      null,
      null,
      1_700_000_000_000,
    );
  });
});
