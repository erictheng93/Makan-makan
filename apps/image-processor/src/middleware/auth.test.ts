import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { apiKeyAuth, corsMiddleware } from "./auth";

function createApp(env: Record<string, unknown>) {
  const app = new Hono();
  app.use("*", (c, next) => apiKeyAuth(c as never, next));
  app.get("/protected", (c) => c.json({ success: true }));

  return {
    request: (apiKey?: string) =>
      app.fetch(
        new Request("https://images.test/protected", {
          headers: apiKey ? { "X-API-Key": apiKey } : {},
        }),
        env,
      ),
  };
}

describe("image processor API key auth", () => {
  it("fails closed when API_KEY is not configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await createApp({}).request("default-api-key");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Server configuration error",
    });
  });

  it("requires the configured API key", async () => {
    const app = createApp({ API_KEY: "x".repeat(32) });

    expect((await app.request("wrong")).status).toBe(401);
    expect((await app.request("x".repeat(32))).status).toBe(200);
  });
});

describe("image processor CORS", () => {
  it("does not emit wildcard CORS for arbitrary origins", async () => {
    const app = new Hono();
    app.use("*", (c, next) => corsMiddleware(c as never, next));
    app.get("/images", (c) => c.json({ success: true }));

    const response = await app.fetch(
      new Request("https://images.test/images", {
        headers: { Origin: "https://evil.example" },
      }),
      { NODE_ENV: "production" },
    );

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("reflects configured image origins", async () => {
    const app = new Hono();
    app.use("*", (c, next) => corsMiddleware(c as never, next));
    app.get("/images", (c) => c.json({ success: true }));

    const response = await app.fetch(
      new Request("https://images.test/images", {
        headers: { Origin: "https://makanmasak.com" },
      }),
      {
        NODE_ENV: "production",
        CORS_ORIGIN: "https://makanmasak.com",
      },
    );

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://makanmasak.com",
    );
  });
});
