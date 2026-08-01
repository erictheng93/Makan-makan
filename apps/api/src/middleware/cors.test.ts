import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { corsMiddleware } from "./cors";

function createApp() {
  const app = new Hono();
  app.use("*", corsMiddleware);
  app.get("/api/v1/menu/:restaurantId", (c) =>
    c.json({ success: true, restaurantId: c.req.param("restaurantId") }),
  );
  return app;
}

describe("corsMiddleware", () => {
  it("allows customer app client headers during browser preflight", async () => {
    const app = createApp();

    const response = await app.fetch(
      new Request("https://api.test/api/v1/menu/restaurant-1", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3001",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": [
            "content-type",
            "x-client-version",
            "x-client-platform",
            "x-request-id",
            "x-restaurant-id",
            "x-table-id",
          ].join(", "),
        },
      }),
      {
        NODE_ENV: "development",
      },
    );

    const allowedHeaders = response.headers
      .get("Access-Control-Allow-Headers")
      ?.toLowerCase();

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3001",
    );
    expect(allowedHeaders).toContain("x-client-version");
    expect(allowedHeaders).toContain("x-client-platform");
    expect(allowedHeaders).toContain("x-request-id");
    expect(allowedHeaders).toContain("x-restaurant-id");
    expect(allowedHeaders).toContain("x-table-id");
  });

  it("does not send a browser policy that disables same-origin QR scanning", async () => {
    const app = createApp();

    const response = await app.fetch(
      new Request("https://api.test/api/v1/menu/restaurant-1", {
        headers: {
          Origin: "https://makanmasak.com",
        },
      }),
      {
        NODE_ENV: "production",
      },
    );

    const permissionsPolicy = response.headers.get("Permissions-Policy");

    expect(permissionsPolicy).toContain("camera=(self)");
    expect(permissionsPolicy).not.toContain("camera=()");
  });
});
