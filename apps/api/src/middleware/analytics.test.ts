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

  // Regression: this passed 20 indexes, so the runtime threw
  // `writeDataPoint(): Maximum of 1 indexes supported` on every request and the
  // dataset silently received nothing for as long as the code shipped. The
  // throw was caught and logged, so it never surfaced as a failure.
  it("writes exactly one index, keyed on restaurant", async () => {
    const writeDataPoint = vi.fn();
    const service = new AdvancedAnalyticsService(
      { writeDataPoint } as never,
      { waitUntil: (p: Promise<unknown>) => p } as unknown as ExecutionContext,
      {} as never,
    );

    await service.recordEvent({
      event: "api_request",
      restaurant_id: 42,
      dimensions: { endpoint: "/api/v1/menu", status_code: "200" },
      metrics: { response_time: 120 },
    });

    expect(writeDataPoint).toHaveBeenCalledOnce();
    const [payload] = writeDataPoint.mock.calls[0] as [
      { indexes: string[]; blobs: string[]; doubles: number[] },
    ];
    expect(payload.indexes).toEqual(["42"]);
    expect(payload.indexes).toHaveLength(1);

    // The dimensions the query side reads must stay where it expects them:
    // blob1 event, blob8 endpoint, blob10 status, double2 response time.
    expect(payload.blobs[0]).toBe("api_request");
    expect(payload.blobs[7]).toBe("/api/v1/menu");
    expect(payload.blobs[9]).toBe("200");
    expect(payload.doubles[1]).toBe(120);
  });

  it("falls back to a zero index when no restaurant is in scope", async () => {
    const writeDataPoint = vi.fn();
    const service = new AdvancedAnalyticsService(
      { writeDataPoint } as never,
      { waitUntil: (p: Promise<unknown>) => p } as unknown as ExecutionContext,
      {} as never,
    );

    await service.recordEvent({
      event: "api_request",
      dimensions: {},
      metrics: {},
    });

    const [payload] = writeDataPoint.mock.calls[0] as [{ indexes: string[] }];
    expect(payload.indexes).toEqual(["0"]);
  });
});
