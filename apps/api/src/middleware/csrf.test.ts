import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { csrfProtection, generateCSRFTokenHandler } from "./csrf";

const CSRF_TOKEN = "a".repeat(64);

function createApp() {
  const app = new Hono();
  app.use("*", csrfProtection({ useDoubleSubmit: true }));
  app.put("/api/v1/orders/:id/status", (c) =>
    c.json({ success: true, orderId: c.req.param("id") }),
  );
  return app;
}

describe("csrfProtection", () => {
  it("allows configured development frontend origins before token validation", async () => {
    const app = createApp();

    const response = await app.fetch(
      new Request("https://api.test/api/v1/orders/42/status", {
        method: "PUT",
        headers: {
          Host: "api.test",
          Origin: "http://localhost:3001",
          "Content-Type": "application/json",
          "X-CSRF-Token": CSRF_TOKEN,
          Cookie: `csrf_token=${CSRF_TOKEN}`,
        },
        body: JSON.stringify({ status: "confirmed" }),
      }),
      { NODE_ENV: "development" },
    );

    await expect(response.json()).resolves.toEqual({
      success: true,
      orderId: "42",
    });
    expect(response.status).toBe(200);
  });

  it("allows explicit development frontend origins before token validation", async () => {
    const app = createApp();

    const response = await app.fetch(
      new Request("https://api.test/api/v1/orders/42/status", {
        method: "PUT",
        headers: {
          Host: "api.test",
          Origin: "http://localhost:3011",
          "Content-Type": "application/json",
          "X-CSRF-Token": CSRF_TOKEN,
          Cookie: `csrf_token=${CSRF_TOKEN}`,
        },
        body: JSON.stringify({ status: "confirmed" }),
      }),
      {
        NODE_ENV: "development",
        DEV_CORS_ORIGINS: "http://localhost:3011",
      },
    );

    await expect(response.json()).resolves.toEqual({
      success: true,
      orderId: "42",
    });
    expect(response.status).toBe(200);
  });

  it("sets CSRF cookies with host-only HttpOnly attributes", async () => {
    const app = new Hono();
    app.get("/csrf", generateCSRFTokenHandler);

    const response = await app.fetch(new Request("https://api.test/csrf"), {
      NODE_ENV: "production",
    });

    expect(response.headers.get("set-cookie")).toContain("__Host-mm_csrf=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("Path=/");
  });
});
