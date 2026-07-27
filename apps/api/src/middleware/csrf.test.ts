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

describe("csrfProtection excludePaths", () => {
  /**
   * Regression coverage for the exclusion patterns added when CSRF was moved
   * ahead of the feature mounts. Public customer flows (join a waiting list,
   * book, pay) carry no session cookie and must stay reachable, but the staff
   * routes that live under the same prefixes must NOT be swept in with them —
   * a bare "/api/v1/waiting-list" prefix would have exempted POST /:id/call.
   */
  function appWithExclusions() {
    const app = new Hono();
    app.use(
      "*",
      csrfProtection({
        useDoubleSubmit: true,
        excludePaths: [
          "/api/v1/waiting-list$",
          "/api/v1/waiting-list/*/confirm",
        ],
      }),
    );
    app.post("/api/v1/waiting-list", (c) => c.json({ ok: "join" }));
    app.post("/api/v1/waiting-list/:id/confirm", (c) =>
      c.json({ ok: "confirm" }),
    );
    app.post("/api/v1/waiting-list/:id/call", (c) => c.json({ ok: "call" }));
    return app;
  }

  function post(app: Hono, path: string) {
    return app.fetch(
      new Request(`https://api.test${path}`, {
        method: "POST",
        headers: { Host: "api.test", "Content-Type": "application/json" },
        body: "{}",
      }),
      { NODE_ENV: "production" } as never,
    );
  }

  it("exempts the public join and confirm routes", async () => {
    const app = appWithExclusions();

    expect((await post(app, "/api/v1/waiting-list")).status).toBe(200);
    expect((await post(app, "/api/v1/waiting-list/42/confirm")).status).toBe(
      200,
    );
  });

  it("still protects the staff route under the same prefix", async () => {
    const app = appWithExclusions();

    // No CSRF token: an exact-match exclusion must not cascade to children.
    expect((await post(app, "/api/v1/waiting-list/42/call")).status).toBe(403);
  });
});
