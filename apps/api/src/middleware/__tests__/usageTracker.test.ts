import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { usageTracker } from "../usageTracker";
import type { Env } from "../../types/env";

function createDbMock() {
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare }, bind };
}

function buildApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.use("*", async (c, next) => {
    c.set("user", {
      id: 1,
      username: "owner",
      role: 1,
      restaurantId: "rest-1",
    });
    await next();
  });
  app.use("*", usageTracker);
  app.get("/api/v1/orders", (c) => c.json({ success: true }));
  app.get("/api/v1/me/modules", (c) => c.json({ success: true }));

  return app;
}

describe("usageTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits api.requests for non-excluded routes", async () => {
    const { db, bind } = createDbMock();
    const app = buildApp();

    const response = await app.request("http://localhost/api/v1/orders", {}, {
      DB: db,
    } as unknown as Env);

    expect(response.status).toBe(200);
    expect(bind).toHaveBeenCalledWith(
      expect.any(String),
      "rest-1",
      "api.requests",
      1,
      JSON.stringify({
        method: "GET",
        path: "/api/v1/orders",
        status: 200,
      }),
    );
  });

  it("skips module access and OPTIONS requests", async () => {
    const { db } = createDbMock();
    const app = buildApp();
    const env = { DB: db } as unknown as Env;

    await app.request("http://localhost/api/v1/me/modules", {}, env);
    await app.request(
      "http://localhost/api/v1/orders",
      { method: "OPTIONS" },
      env,
    );

    expect(db.prepare).not.toHaveBeenCalled();
  });
});
