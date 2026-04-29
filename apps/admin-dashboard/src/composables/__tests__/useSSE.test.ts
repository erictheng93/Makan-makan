import { describe, expect, it, vi } from "vitest";

describe("buildSSEUrl", () => {
  it("encodes restaurant and token query params", async () => {
    const { buildSSEUrl } =
      await vi.importActual<typeof import("../useSSE")>("../useSSE");
    const url = buildSSEUrl("restaurant/1", "token with + symbols");

    expect(url).toBe(
      "/api/v1/sse/events?restaurant_id=restaurant%2F1&token=token+with+%2B+symbols",
    );
  });
});
