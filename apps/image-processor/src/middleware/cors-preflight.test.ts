import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { corsMiddleware } from "./auth";
import type { Env } from "../types/env";

const ALLOWED_ORIGIN = "https://admin.makanmasak.com";

function createApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", corsMiddleware);
  app.post("/images/upload", (c) => c.json({ success: true }));
  return app;
}

function createEnv(): Env {
  return { CORS_ORIGIN: ALLOWED_ORIGIN, NODE_ENV: "production" } as Env;
}

function preflight(origin: string) {
  return new Request("https://images.test/images/upload?category=menu", {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization",
    },
  });
}

describe("image-processor CORS preflight", () => {
  it("returns the allow-origin header on the preflight response itself", async () => {
    // The browser reads CORS headers off the OPTIONS response, not off the
    // later POST. Returning a bare `new Response()` from the middleware drops
    // every header staged with c.header(), which blocks admin uploads.
    const response = await createApp().fetch(
      preflight(ALLOWED_ORIGIN),
      createEnv(),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      ALLOWED_ORIGIN,
    );
    expect(response.headers.get("Vary")).toContain("Origin");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "POST",
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
      "Authorization",
    );
    expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  it("omits allow-origin for an origin outside the allowlist", async () => {
    const response = await createApp().fetch(
      preflight("https://attacker.example"),
      createEnv(),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("still exposes the allow-origin header on real requests", async () => {
    const response = await createApp().fetch(
      new Request("https://images.test/images/upload?category=menu", {
        method: "POST",
        headers: { Origin: ALLOWED_ORIGIN },
      }),
      createEnv(),
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      ALLOWED_ORIGIN,
    );
  });
});
