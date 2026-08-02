import { beforeEach, describe, expect, it, vi } from "vitest";

const meterEmit = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("./shared/utils/meter", () => ({ meterEmit }));

import { createApp } from "./app-factory";

describe("createApp API middleware registration", () => {
  beforeEach(() => {
    meterEmit.mockClear();
  });

  it("protects mounted coupon writes with CSRF and meters the request", async () => {
    const app = createApp(undefined, {
      disableEdgeCache: true,
      disableObservability: true,
    });

    const response = await app.fetch(
      new Request("https://api.test/api/v1/coupons", {
        method: "POST",
        headers: {
          Host: "api.test",
          Origin: "https://api.test",
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
      { NODE_ENV: "test" } as never,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "CSRF_TOKEN_MISSING",
        message: "CSRF token is required for this request",
      },
    });
    expect(meterEmit).toHaveBeenCalledWith(
      expect.anything(),
      "api.requests",
      expect.objectContaining({
        metadata: expect.objectContaining({ path: "/api/v1/coupons" }),
      }),
    );
  });
});
