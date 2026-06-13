import { describe, expect, it, vi } from "vitest";
import { inputSanitizationMiddleware } from "./security";

describe("inputSanitizationMiddleware", () => {
  it("leaves JSON body strings unchanged", async () => {
    const body = {
      token: "abc=def",
      url: "https://example.test/pay?sig=a=b",
      note: "<b>raw</b>",
    };
    const c = {
      req: {
        json: vi.fn(async () => body),
        header: vi.fn(() => "application/json"),
      },
    };
    const next = vi.fn(async () => undefined);

    await inputSanitizationMiddleware(c as never, next);

    await expect(c.req.json()).resolves.toEqual(body);
    expect(next).toHaveBeenCalledOnce();
  });
});
