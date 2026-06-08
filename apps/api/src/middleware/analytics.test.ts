import { describe, expect, it, vi } from "vitest";
import { AdvancedAnalyticsService } from "./analytics";

describe("AdvancedAnalyticsService", () => {
  it("skips recording when Analytics Engine is not bound", async () => {
    const waitUntil = vi.fn();
    const service = new AdvancedAnalyticsService(
      undefined,
      { waitUntil } as unknown as ExecutionContext,
      {} as never,
    );

    await service.recordEvent({
      event: "api_request",
      dimensions: {},
      metrics: {},
    });

    expect(waitUntil).not.toHaveBeenCalled();
  });
});
