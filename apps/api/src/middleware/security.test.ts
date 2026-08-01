import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import {
  inputSanitizationMiddleware,
  securityHeadersMiddleware,
} from "./security";

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

describe("securityHeadersMiddleware", () => {
  it("does not disable same-origin camera access for customer QR scanning", async () => {
    const app = new Hono();
    app.use("*", securityHeadersMiddleware);
    app.get("/api/v1/menu/:restaurantId", (c) => c.json({ success: true }));

    const response = await app.fetch(
      new Request("https://api.test/api/v1/menu/restaurant-1"),
      {
        NODE_ENV: "production",
      },
    );

    const permissionsPolicy = response.headers.get("Permissions-Policy");

    expect(permissionsPolicy).toContain("camera=(self)");
    expect(permissionsPolicy).not.toContain("camera=()");
  });
});
