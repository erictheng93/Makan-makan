import { describe, expect, it, vi } from "vitest";
import { CustomerWebPushService } from "./CustomerWebPushService";

describe("CustomerWebPushService", () => {
  it("does not load or deliver subscriptions when web push is disabled", async () => {
    const d1 = { prepare: vi.fn() };
    const service = new CustomerWebPushService(d1 as never, {
      JWT_SECRET: "test",
      WEB_PUSH_ENABLED: "false",
    });

    await expect(
      service.sendWaitingCalled({ customerId: "customer-1" } as never),
    ).resolves.toEqual({
      targeted: 0,
      sent: 0,
      failed: 0,
      stale: 0,
      skipped: true,
    });
    expect(d1.prepare).not.toHaveBeenCalled();
  });
});
